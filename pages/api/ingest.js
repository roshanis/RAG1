import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { IncomingForm } from 'formidable';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import mammoth from 'mammoth';
import XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: false, // we use formidable to parse multipart forms
  },
};

// Helper: chunk text into pieces (e.g. 500 words each)
function chunkText(text, wordsPerChunk = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse form using formidable
  const form = new IncomingForm({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Error parsing form data' });
    }

    const fileList = [];
    // files could be an object with one or many files.
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

    // Process each uploaded file
    for (const file of fileList) {
      const ext = path.extname(file.originalFilename).toLowerCase();
      let fileText = '';

      try {
        if (ext === '.pdf') {
          // Read and extract text from PDF using pdf-parse
          const dataBuffer = fs.readFileSync(file.filepath);
          const pdfData = await pdfParse(dataBuffer);
          fileText = pdfData.text;
        } else if (ext === '.docx') {
          // Process DOCX file using mammoth
          const dataBuffer = fs.readFileSync(file.filepath);
          const result = await mammoth.extractRawText({ buffer: dataBuffer });
          fileText = result.value;
        } else if (ext === '.xlsx') {
          // Process XLSX file using xlsx
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
          continue; // Skip unsupported file types
        }
        console.log(`Extracted ${fileText.length} characters from ${file.originalFilename}`);
      } catch (fileErr) {
        console.error(`Error processing file ${file.originalFilename}:`, fileErr);
        continue; // Skip files that cause errors
      }

      // Split text into chunks
      const chunks = chunkText(fileText);
      for (const chunk of chunks) {
        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
          });

          embeddingsData.push({
            text: chunk,
            embedding: response.data[0].embedding,
          });
        } catch (openaiErr) {
          console.error('OpenAI error:', openaiErr);
        }
      }
    }

    // Write embeddingsData to a temporary JSON file
    const tempDataPath = path.join(process.cwd(), 'temp_embeddings.json');
    fs.writeFileSync(tempDataPath, JSON.stringify(embeddingsData));

    // Call the Python script for ingestion
    const pythonProcess = spawn('python3', ['python/faiss_index.py', 'ingest', '--data-file', tempDataPath]);

    res.status(200).json({ embeddings: embeddingsData });
  });
};

export default handler;