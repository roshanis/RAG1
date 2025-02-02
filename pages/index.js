import { useState } from 'react';

export default function Home() {
  const [uploadStatus, setUploadStatus] = useState('');
  const [question, setQuestion] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [fileEmbeddingCounts, setFileEmbeddingCounts] = useState({});

  // Handler for file/folder upload
  const handleUpload = async (e) => {
    e.preventDefault();
    const files = e.target.files; // access file list from file input element
    if (!files || files.length === 0) {
      setUploadStatus('No files selected');
      return;
    }
    const formData = new FormData();
    // Append all files from the folder upload
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    setIsUploading(true);
    setUploadStatus('Uploading and ingesting documents...');
    const response = await fetch('/api/ingest', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (response.ok) {
      setUploadStatus('Documents ingested successfully.');
      setFileEmbeddingCounts(result.fileEmbeddingCounts);
    } else {
      setUploadStatus(`Error: ${result.error}`);
    }
    setIsUploading(false);
  };

  // Handler for asking a question
  const handleQuery = async (e) => {
    e.preventDefault();
    setQueryResult(null);
    setIsQuerying(true);
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const result = await response.json();
    if (response.ok) {
      setQueryResult(result);
    } else {
      setQueryResult({ error: result.error });
    }
    setIsQuerying(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">Retrieval-Augmented Generation App</h1>
      
      {/* Ingestion Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Upload Documents (Folder)</h2>
        <form>
          {/* The "webkitdirectory" attribute allows folder uploads */}
          <input
            type="file"
            name="files"
            webkitdirectory="true"
            directory="true"
            multiple
            className="mb-4"
            onChange={handleUpload}
            disabled={isUploading}
          />
          {isUploading && <p>Uploading...</p>}
          <p>{uploadStatus}</p>
          {Object.keys(fileEmbeddingCounts).length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold">Embeddings Created:</h3>
              <ul className="list-disc pl-5">
                {Object.entries(fileEmbeddingCounts).map(([filename, count]) => (
                  <li key={filename}>
                    {filename}: {count} embeddings
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </section>
      
      {/* Query Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Ask a Question</h2>
        <form onSubmit={handleQuery}>
          <input
            type="text"
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-4" disabled={isQuerying}
          />
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded" disabled={isQuerying}>Ask</button>
        </form>
        {queryResult && (
          <div className="mt-6 p-4 bg-white border rounded shadow">
            {queryResult.error ? (
              <p className="text-red-500">{queryResult.error}</p>
            ) : (
              <>
                <h3 className="font-semibold mb-2">Answer:</h3>
                <p>{queryResult.answer}</p>
                <h4 className="mt-4 font-semibold">Retrieved Context:</h4>
                <ul className="list-disc pl-5">
                  {queryResult.context.map((chunk, idx) => (
                    <li key={idx} className="mt-1">{chunk}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}