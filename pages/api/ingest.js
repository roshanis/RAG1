/**
 * API endpoint for document ingestion and embedding generation
 * Handles file uploads, text extraction, chunking, and embedding creation
 * Integrates with Python FAISS script for vector storage
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { IncomingForm } from 'formidable';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import crypto from 'crypto';

// Path to the metadata file
const METADATA_FILE = path.join(process.cwd(), 'faiss_metadata.json');

// Configure API to disable default body parsing
export const config = {
  api: {
    bodyParser: false, // Use formidable for multipart form parsing
  },
};

/**
 * Splits text into manageable chunks for embedding generation
 * @param {string} text - Input text to chunk
 * @param {number} wordsPerChunk - Number of words per chunk (default: 500)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, wordsPerChunk = 500) {
  // Split text by whitespace to count words
  const words = text.split(/\s+/);
  const chunks = [];
  
  // Create chunks using sliding window approach
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Main API handler for document ingestion
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse multipart form data using formidable
  const form = new IncomingForm({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    // Process uploaded files
    const fileList = [];
    if (Array.isArray(files.files)) {
      fileList.push(...files.files);
    } else if (files.files) {
      fileList.push(files.files);
    } else {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const embeddingsData = [];
    const fileEmbeddingCounts = {};

    // Load existing hashes from metadata file
    const existingHashes = fs.existsSync(METADATA_FILE) ?
      JSON.parse(fs.readFileSync(METADATA_FILE)).hashes || [] : [];

    // Process each file in the upload
    for (const file of fileList) {
      const ext = path.extname(file.originalFilename).toLowerCase();
      let fileText = '';

      try {
        // File type handling using appropriate libraries
        if (ext === '.pdf') {
          const dataBuffer = fs.readFileSync(file.filepath);
          const pdfData = await pdfParse(dataBuffer);
          fileText = pdfData.text;
        } else if (ext === '.docx') {
          const dataBuffer = fs.readFileSync(file.filepath);
          const result = await mammoth.extractRawText({ buffer: dataBuffer });
          fileText = result.value;
        } else if (ext === '.xlsx') {
          const workbook = XLSX.readFile(file.filepath);
          let sheetTexts = [];
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            sheetTexts.push(csv);
          });
          fileText = sheetTexts.join("\n");
        } else if (ext === '.txt') {
          fileText = fs.readFileSync(file.filepath, 'utf8');
        } else {
          console.warn(`Unsupported file type: ${file.originalFilename}`);
          continue;
        }

        console.log(`Extracted ${fileText.length} characters from ${file.originalFilename}`);
      } catch (fileErr) {
        console.error(`Error processing file ${file.originalFilename}:`, fileErr);
        continue;
      }

      // Check if file already exists in index
      const fileHash = calculateFileHash(file.filepath);
      if (existingHashes.includes(fileHash)) {
        console.log(`Skipping duplicate file: ${file.originalFilename}`);
        continue;
      }

      // Split text into chunks and generate embeddings
      const chunks = chunkText(fileText);
      for (const chunk of chunks) {
        try {
          // Generate embedding for each text chunk
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
          });

          embeddingsData.push({
            text: chunk,
            embedding: response.data[0].embedding,
            hash: fileHash
          });
        } catch (openaiErr) {
          console.error('OpenAI error:', openaiErr);
        }
      }

      fileEmbeddingCounts[file.originalFilename] = chunks.length;
    }

    // Write embeddings to temporary file for Python processing
    const tempDataPath = path.join(process.cwd(), 'temp_embeddings.json');
    fs.writeFileSync(tempDataPath, JSON.stringify(embeddingsData));

    // Execute Python FAISS ingestion script
    const pythonProcess = spawn('python3', [
      'python/faiss_index.py',
      'ingest',
      '--data-file',
      tempDataPath
    ]);

    res.status(200).json({ embeddings: embeddingsData, fileEmbeddingCounts });
  });
};

export default handler;