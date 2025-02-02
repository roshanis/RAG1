import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let questionEmbedding = [];
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const [{ embedding }] = response.data;
    questionEmbedding = embedding;
  } catch (openaiErr) {
    console.error('Error obtaining question embedding:', openaiErr);
    return res.status(500).json({ error: 'Error generating embedding for question' });
  }

  // Write the question embedding into a temporary JSON file
  const tempQueryPath = path.join(process.cwd(), 'temp_query.json');
  fs.writeFileSync(tempQueryPath, JSON.stringify({ embedding: questionEmbedding }));

  // Call the Python script in "query" mode
  const pythonProcess = spawn('python3', ['python/faiss_index.py', 'query', '--query-file', tempQueryPath]);

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      console.error('Python script error:', stderr);
      console.error('Query Python Script Output:', stdout);
      return res.status(500).json({ error: 'Error querying the FAISS index' });
    }
    // Remove temporary query file
    fs.unlinkSync(tempQueryPath);

    // Parse the retrieved context chunks from Python stdout
    let retrievedChunks = [];
    try {
      if (!stdout) {
        console.error('FAISS script returned empty output');
        return res.status(500).json({ error: 'Search service unavailable' });
      }
      
      retrievedChunks = JSON.parse(stdout);
    } catch (parseErr) {
      console.error('Error parsing FAISS output:', parseErr);
      console.error('FAISS Output (unparsed):', stdout);
      return res.status(500).json({ error: 'Error processing FAISS query results' });
    }

    if (retrievedChunks.length === 0) {
      console.warn('FAISS query returned empty results');
      return res.status(200).json({ answer: 'No relevant information found in documents', context: [] });
    }

    // Create a prompt for Chat Completion by combining context and question
    const contextText = retrievedChunks.map((item, idx) => `Chunk ${idx + 1}: ${item}`).join('\n\n');
    const prompt = `Use the following document excerpts to answer the question below.\n\nDocument Excerpts:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });
      const answer = completion.choices[0].message.content;
      return res.status(200).json({ answer, context: retrievedChunks });
    } catch (completionErr) {
      console.error('Error generating answer:', completionErr);
      return res.status(500).json({ error: 'Error generating answer from LLM' });
    }
  });
};

export default handler; 