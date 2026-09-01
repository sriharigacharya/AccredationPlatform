"""
Embedding routes — receive chunks from document-service and upsert to Qdrant.
"""

import uuid
import logging
from flask import Blueprint, request, jsonify, current_app
from rag.embedder import get_embedder
from rag.retriever import get_qdrant_client, ensure_collection

embed_bp = Blueprint("embed", __name__)
logger   = logging.getLogger(__name__)


@embed_bp.post("/embed")
def embed_chunks():
    """
    POST /embed  (internal, called by document-service worker)
    Body: {
        "doc_id": "...",
        "doc_type": "SAR",
        "collection": "academiq_docs",
        "chunks": [{"text": "...", "index": 0}, ...],
        "metadata": { "doc_type": "...", "pages": 5 }
    }
    """
    data = request.get_json(force=True) or {}
    doc_id     = data.get("doc_id")
    doc_type   = data.get("doc_type", "other")
    collection = data.get("collection", current_app.config["QDRANT_COLLECTION"])
    chunks     = data.get("chunks", [])
    metadata   = data.get("metadata", {})

    if not doc_id or not chunks:
        return jsonify({"error": "doc_id and chunks are required"}), 400

    client   = get_qdrant_client(current_app)
    embedder = get_embedder(current_app.config["EMBEDDING_MODEL"])

    ensure_collection(client, collection)

    texts = [c["text"] for c in chunks]
    embeddings = embedder.encode(texts, normalize_embeddings=True)

    from qdrant_client.models import PointStruct
    points = []
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=emb.tolist(),
            payload={
                "doc_id":     doc_id,
                "doc_type":   doc_type,
                "chunk_index":chunk.get("index", i),
                "text":       chunk["text"],
                **metadata,
            }
        ))

    client.upsert(collection_name=collection, points=points)

    logger.info(f"[embed] doc={doc_id} collection={collection} chunks={len(points)}")
    return jsonify({
        "status":  "embedded",
        "doc_id":  doc_id,
        "vectors": len(points),
    })


@embed_bp.get("/collections")
def list_collections():
    """GET /collections — list all Qdrant collections."""
    client = get_qdrant_client(current_app)
    cols   = client.get_collections()
    return jsonify({
        "collections": [c.name for c in cols.collections]
    })
