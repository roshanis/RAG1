# RAG Document Assistant

A Retrieval-Augmented Generation (RAG) system built with Next.js , Microsoft MarkItDown and Python/FAISS for document question answering.

## Features
- Document ingestion (PDF, DOCX, XLSX, TXT)
- FAISS vector store with OpenAI embeddings
- GPT-4 powered question answering
- File conversion to Markdown using Microsoft MarkItDown

## Tech Stack
- Frontend: Next.js 14
- Backend: Next.js API routes
- Vector DB: FAISS (via Python)
- NLP: OpenAI Embeddings & GPT-4

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- OpenAI API key

### Installation
1. Clone repository:
   ```bash
   git clone https://github.com/roshanis/RAG1.git
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

4. Create `.env.local` file:
   ```env
   OPENAI_API_KEY=your-api-key-here
   ```

### Usage
1. Start development server:
   ```bash
   npm run dev
   ```

2. Ingest documents:
   ```bash
   # Via UI: http://localhost:3000
   # Or via curl:
   curl -X POST -F "files=@/path/to/document.docx" http://localhost:3000/api/ingest
   ```

3. Query documents:
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"question":"Your question"}' http://localhost:3000/api/query
   ```

## Project Structure 
├── pages/ # Next.js pages and API routes
│ ├── api/
│ │ ├── ingest.js # Document ingestion endpoint
│ │ └── query.js # Question answering endpoint
├── python/ # FAISS integration
│ ├── faiss_index.py # FAISS index management
│ └── convert_to_md.py # Markdown conversion
├── public/ # Static assets
└── package.json # Node.js dependencies


## Configuration
- `OPENAI_API_KEY`: OpenAI API key in `.env.local`
- `wordsPerChunk`: Chunk size in `pages/api/ingest.js`
- `k`: Number of retrieved chunks in `python/faiss_index.py`

## Troubleshooting
**FAISS Index Not Found:**
- Ensure ingestion process completed successfully
- Check for `faiss.index` and `faiss_metadata.json` in project root

**Document Conversion Issues:**
- Verify file formats (supports PDF, DOCX, XLSX, TXT)
- Check Python dependencies: `pip show markitdown`

**API Errors:**
- Check Next.js server logs for detailed error messages
- Verify OpenAI API key is set in `.env.local`

## License
MIT License
