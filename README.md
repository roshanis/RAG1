# RAG Document Assistant

A Retrieval-Augmented Generation (RAG) system built with Next.js and Python/FAISS for intelligent document question answering. The system processes documents, creates embeddings, and uses semantic search to provide context-aware answers.

## Features
- Document ingestion (PDF, DOCX, XLSX, TXT)
- Duplicate document detection using SHA-256 hashing
- FAISS vector store with OpenAI embeddings
- GPT-4 powered question answering
- Chunk-based document processing
- Real-time embedding count display
- File conversion to Markdown

## Tech Stack
- **Frontend**: Next.js 14, TailwindCSS
- **Backend**: Next.js API routes
- **Vector DB**: FAISS (Facebook AI Similarity Search)
- **NLP**: OpenAI Embeddings & GPT-4
- **Document Processing**: 
  - PDF: pdf-parse
  - DOCX: mammoth
  - XLSX: xlsx
  - TXT: native Node.js

## Getting Started

### Prerequisites
- Node.js 18+ (`node --version`)
- Python 3.9+ (`python3 --version`)
- OpenAI API key

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/yourusername/RAG1.git
   cd RAG1
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create `.env.local`:
   ```env
   OPENAI_API_KEY=your-api-key-here
   ```

### Usage

1. Start development server:
   ```bash
   npm run dev
   ```

2. Access the application:
   - Open `http://localhost:3000`
   - Use the folder upload to ingest documents
   - View embedding counts per file
   - Ask questions about your documents

## Project Structure
```
├── pages/
│   ├── api/
│   │   ├── ingest.js    # Document processing & embedding
│   │   └── query.js     # Question answering
│   ├── _app.js
│   └── index.js         # Main UI
├── python/
│   └── faiss_index.py   # FAISS operations
├── styles/
│   └── globals.css      # TailwindCSS styles
└── public/              # Static assets
```

## Features in Detail

### Document Processing
- Chunks text into segments (default: 500 words)
- Generates embeddings using OpenAI's text-embedding-3-small
- Stores vectors in FAISS index for efficient similarity search

### Duplicate Detection
- Calculates SHA-256 hash for each file
- Prevents re-processing of identical documents
- Maintains hash records in metadata

### Vector Search
- Uses FAISS for fast similarity search
- Retrieves k-nearest neighbors (default: k=5)
- Returns most relevant context for questions

## Configuration

### Chunking
Adjust chunk size in `pages/api/ingest.js`:
```javascript
function chunkText(text, wordsPerChunk = 500)
```

### Search Results
Modify number of results in `python/faiss_index.py`:
```python
def query(query_file, k=5)
```

## Troubleshooting

### Empty Results
If queries return no results:
1. Check if documents were ingested successfully
2. Verify FAISS index exists: `ls -l faiss.index`
3. Check metadata file: `ls -l faiss_metadata.json`
4. Delete index and re-ingest if necessary:
   ```bash
   rm faiss.index faiss_metadata.json
   ```

### Ingestion Issues
If document ingestion fails:
1. Check file permissions
2. Verify Python dependencies
3. Check OpenAI API key
4. Review console for error messages

### Query Problems
If queries fail:
1. Ensure FAISS index is not empty
2. Check Python script output
3. Verify embedding generation
4. Review API response in browser console

## API Endpoints

### POST /api/ingest
Processes and ingests documents:
```bash
curl -X POST -F "files=@/path/to/document.pdf" http://localhost:3000/api/ingest
```

### POST /api/query
Queries the knowledge base:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"question":"Your question here"}' \
  http://localhost:3000/api/query
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

## License
MIT License - see LICENSE file for details
