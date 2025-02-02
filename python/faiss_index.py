"""
FAISS Index Management Module
Handles creation, updating, and querying of FAISS vector index
Integrates with OpenAI embeddings for semantic search
"""

import argparse
import json
import os
import sys

import numpy as np
import faiss

# File paths for persistent storage
INDEX_FILE = "faiss.index"
METADATA_FILE = "faiss_metadata.json"
VECTOR_DIM = 1536  # Dimension for OpenAI's text-embedding-3-small

def load_index():
    """
    Loads existing FAISS index and metadata or initializes new ones
    Returns:
        tuple: (FAISS index, metadata list)
    """
    # Initialize or load index
    if os.path.exists(INDEX_FILE):
        print(f"Loading existing index from {INDEX_FILE}", file=sys.stderr)
        index = faiss.read_index(INDEX_FILE)
    else:
        print("Creating new FAISS index", file=sys.stderr)
        index = faiss.IndexFlatL2(VECTOR_DIM)  # L2 distance for similarity

    # Initialize or load metadata
    if os.path.exists(METADATA_FILE):
        print(f"Loading metadata from {METADATA_FILE}", file=sys.stderr)
        try:
            with open(METADATA_FILE, "r") as f:
                metadata = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: {METADATA_FILE} is empty or corrupted. Initializing new metadata.", file=sys.stderr)
            metadata = []
    else:
        print("No metadata found - initializing empty list", file=sys.stderr)
        metadata = []
        
    return index, metadata

def save_index(index, metadata):
    """Persists FAISS index and metadata to disk"""
    faiss.write_index(index, INDEX_FILE)
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)

def ingest(data_file):
    """
    Ingests embeddings from JSON file into FAISS index
    Args:
        data_file (str): Path to JSON file with embeddings data
    """
    with open(data_file, "r") as f:
        data = json.load(f)

    if not data:
        print("Error: No data loaded from data file", file=sys.stderr)
        sys.exit(1)
    
    # Prepare numpy arrays for FAISS
    embeddings = []
    texts = []
    hashes = []
    for item in data:
        embeddings.append(item["embedding"])
        texts.append(item["text"])
        hashes.append(item.get("hash", ""))

    embeddings_np = np.array(embeddings).astype('float32')

    index, metadata = load_index()
    initial_size = index.ntotal

    try:
        # Add vectors to index and extend metadata
        index.add(embeddings_np)
        metadata.extend(texts)
        save_index(index, metadata)
        print(f"Successfully ingested {index.ntotal - initial_size} new chunks", file=sys.stderr)
    except Exception as e:
        print(f"Ingestion error: {e}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)

def query(query_file, k=5):
    """
    Queries FAISS index with provided embedding
    Args:
        query_file (str): Path to JSON file with query embedding
        k (int): Number of nearest neighbors to return
    """
    with open(query_file, "r") as f:
        query_data = json.load(f)
    
    if not query_data or 'embedding' not in query_data:
        print("Error: Invalid query data", file=sys.stderr)
        sys.exit(1)

    # Convert to numpy array for FAISS
    query_vector = np.array([query_data["embedding"]]).astype('float32')
    
    index, metadata = load_index()
    if index.ntotal == 0:
        print("Error: FAISS index is empty. Please ingest documents first.", file=sys.stderr)
        print(json.dumps([]))
        sys.exit(1)

    # Perform similarity search
    distances, indices = index.search(query_vector, k)
    
    try:
        # Retrieve metadata for matched indices
        retrieved_texts = []
        for idx in indices[0]:
            if 0 <= idx < len(metadata):
                retrieved_texts.append(metadata[idx])
            else:
                print(f"Warning: Invalid index {idx}", file=sys.stderr)
        # Output clean JSON through stdout
        sys.stdout.write(json.dumps(retrieved_texts))
        sys.stdout.flush()
    except Exception as e:
        print(f"Query error: {e}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    """Main entry point for FAISS operations"""
    # Configure command line interface
    parser = argparse.ArgumentParser(description="FAISS index management")
    parser.add_argument("mode", choices=["ingest", "query"], help="Operation mode")
    parser.add_argument("--data-file", help="Data file for ingestion")
    parser.add_argument("--query-file", help="Query file for search")

    args = parser.parse_args()

    # Execute requested operation
    if args.mode == "ingest":
        if not args.data_file:
            print("Error: Missing data file", file=sys.stderr)
            sys.exit(1)
        ingest(args.data_file)
    elif args.mode == "query":
        if not args.query_file:
            print("Error: Missing query file", file=sys.stderr)
            sys.exit(1)
        query(args.query_file) 