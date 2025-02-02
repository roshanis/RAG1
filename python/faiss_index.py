import argparse
import json
import os
import sys

import numpy as np
import faiss

# Define file paths for saving the index and metadata
INDEX_FILE = "faiss.index"
METADATA_FILE = "faiss_metadata.json"
VECTOR_DIM = 1536  # Dimension for OpenAI's text-embedding-3-small

def load_index():
    """Load FAISS index and metadata if they exist."""
    if os.path.exists(INDEX_FILE):
        print(f"Loading existing index from {INDEX_FILE}", file=sys.stderr)
        index = faiss.read_index(INDEX_FILE)
    else:
        print("Creating new FAISS index", file=sys.stderr)
        index = faiss.IndexFlatL2(VECTOR_DIM)

    if os.path.exists(METADATA_FILE):
        print(f"Loading metadata from {METADATA_FILE}", file=sys.stderr)
        with open(METADATA_FILE, "r") as f:
            metadata = json.load(f)
    else:
        print("No metadata found - initializing empty list", file=sys.stderr)
        metadata = []
    return index, metadata

def save_index(index, metadata):
    """Save the FAISS index and metadata to disk."""
    faiss.write_index(index, INDEX_FILE)
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)

def ingest(data_file):
    """Ingest embeddings and associated text from a JSON file."""
    with open(data_file, "r") as f:
        data = json.load(f)

    if not data:
        print("Error: No data loaded from data file. Check if temp_embeddings.json is valid.")
        sys.exit(1)
    
    print(f"Loaded {len(data)} embeddings from {data_file}")

    # Prepare embeddings array
    embeddings = []
    texts = []
    for item in data:
        embeddings.append(item["embedding"])
        texts.append(item["text"])
    embeddings_np = np.array(embeddings).astype('float32')
    print(f"Converted embeddings to numpy array of shape {embeddings_np.shape}")

    index, metadata = load_index()
    initial_index_size = index.ntotal
    print(f"Current index size before ingestion: {initial_index_size}")

    try:
        index.add(embeddings_np)
        metadata.extend(texts)
        save_index(index, metadata)
        ingested_count = index.ntotal - initial_index_size
        print(f"Successfully ingested {ingested_count} chunks. New index size: {index.ntotal}")
    except Exception as e:
        print(f"Error during ingestion: {e}")
        sys.exit(1)

    sys.exit(0)

def query(query_file, k=5):
    """Query the FAISS index with the provided query embedding."""
    with open(query_file, "r") as f:
        query_data = json.load(f)
    
    if not query_data or 'embedding' not in query_data:
        print("Error: Invalid query data.")
        sys.exit(1)

    query_vector = np.array([query_data["embedding"]]).astype('float32')
    
    index, metadata = load_index()
    if index.ntotal == 0:
        print(json.dumps([]))
        sys.exit(0)

    distances, indices = index.search(query_vector, k)
    try:
        retrieved_texts = []
        for idx in indices[0]:
            if idx >= 0 and idx < len(metadata):
                retrieved_texts.append(metadata[idx])
            else:
                print(f"Warning: Invalid index {idx} encountered", file=sys.stderr)
        # Only output final JSON to stdout
        sys.stdout.write(json.dumps(retrieved_texts))
        sys.stdout.flush()
    except Exception as e:
        print(f"Error during query: {e}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["ingest", "query"], help="Mode: ingest or query")
    parser.add_argument("--data-file", help="Path to JSON file for ingestion")
    parser.add_argument("--query-file", help="Path to JSON file for query")

    args = parser.parse_args()

    if args.mode == "ingest":
        if not args.data_file:
            print("Error: --data-file is required in ingest mode.")
            sys.exit(1)
        ingest(args.data_file)
    elif args.mode == "query":
        if not args.query_file:
            print("Error: --query-file is required in query mode.")
            sys.exit(1)
        query(args.query_file) 