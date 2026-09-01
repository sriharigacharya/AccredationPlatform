"""
Vector DB retrieval — Qdrant client and semantic search.
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

VECTOR_DIM = 1024  # BGE-M3 dimension


def get_qdrant_client(app):
    """Return a Qdrant client using Flask app config."""
    from qdrant_client import QdrantClient
    return QdrantClient(
        host=app.config["QDRANT_HOST"],
        port=app.config["QDRANT_PORT"],
    )


def ensure_collection(client, collection_name: str):
    """Create Qdrant collection if it doesn't exist."""
    from qdrant_client.models import VectorParams, Distance
    existing = [c.name for c in client.get_collections().collections]
    if collection_name not in existing:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )
        logger.info(f"[qdrant] Created collection '{collection_name}'.")


def retrieve_chunks(
    app,
    query: str,
    collection: str,
    top_k: int = 5,
    doc_type_filter: Optional[str] = None,
) -> List[dict]:
    """
    Embed the query and retrieve top-k most relevant chunks from Qdrant.
    
    Returns list of dicts: { text, doc_id, doc_type, score, ... }
    """
    from rag.embedder import get_embedder
    embedder = get_embedder(app.config["EMBEDDING_MODEL"])
    q_vec    = embedder.encode([query], normalize_embeddings=True)[0].tolist()

    client = get_qdrant_client(app)

    # Build optional payload filter
    query_filter = None
    if doc_type_filter:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        query_filter = Filter(
            must=[FieldCondition(key="doc_type", match=MatchValue(value=doc_type_filter))]
        )

    try:
        results = client.search(
            collection_name=collection,
            query_vector=q_vec,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        )
    except Exception as e:
        logger.error(f"[qdrant] Search failed on '{collection}': {e}")
        return []

    chunks = []
    for r in results:
        payload = r.payload or {}
        chunks.append({
            "text":       payload.get("text", ""),
            "doc_id":     payload.get("doc_id"),
            "doc_type":   payload.get("doc_type"),
            "chunk_index":payload.get("chunk_index", 0),
            "score":      r.score,
        })

    return chunks
