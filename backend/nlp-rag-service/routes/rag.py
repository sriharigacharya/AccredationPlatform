"""
RAG query routes — Q&A over the document corpus.
"""

import logging
from flask import Blueprint, request, jsonify, current_app
from rag.retriever import retrieve_chunks, get_qdrant_client
from rag.generator import generate_answer
from rag.summarizer import summarize_text

rag_bp = Blueprint("rag", __name__)
logger = logging.getLogger(__name__)


@rag_bp.post("/query")
def rag_query():
    """
    POST /rag/query
    Body: {
        "query": "What are the PEOs of the CSE department?",
        "collection": "academiq_docs",    (optional)
        "doc_type_filter": "SAR",          (optional)
        "top_k": 5,                        (optional, default 5)
        "include_sources": true            (optional)
    }
    Returns: {
        "answer": "...",
        "sources": [ { "doc_id", "doc_type", "text", "score" }, ... ]
    }
    """
    data       = request.get_json(force=True) or {}
    query      = data.get("query", "").strip()
    collection = data.get("collection", current_app.config["QDRANT_COLLECTION"])
    doc_filter = data.get("doc_type_filter")
    top_k      = int(data.get("top_k", 5))
    inc_sources= data.get("include_sources", True)

    if not query:
        return jsonify({"error": "query is required"}), 400

    # ── Retrieve relevant chunks ───────────────────────────────
    try:
        chunks = retrieve_chunks(
            app=current_app,
            query=query,
            collection=collection,
            top_k=top_k,
            doc_type_filter=doc_filter,
        )
    except Exception as e:
        logger.error(f"[RAG] Retrieval failed: {e}")
        return jsonify({"error": f"Retrieval failed: {e}"}), 500

    if not chunks:
        return jsonify({
            "answer":  "I could not find relevant information in the document corpus. Please upload relevant documents first.",
            "sources": [],
        })

    # ── Build context and generate answer ─────────────────────
    context = "\n\n---\n\n".join(c["text"] for c in chunks)

    try:
        answer = generate_answer(
            app=current_app,
            query=query,
            context=context,
        )
    except Exception as e:
        logger.error(f"[RAG] Generation failed: {e}")
        return jsonify({"error": f"LLM generation failed: {e}"}), 500

    sources = []
    if inc_sources:
        sources = [
            {
                "doc_id":   c.get("doc_id"),
                "doc_type": c.get("doc_type"),
                "text":     c["text"][:300] + "..." if len(c["text"]) > 300 else c["text"],
                "score":    round(c.get("score", 0.0), 4),
            }
            for c in chunks
        ]

    return jsonify({"answer": answer, "sources": sources, "query": query})


@rag_bp.post("/summarize")
def summarize():
    """
    POST /rag/summarize
    Body: { "text": "...", "max_length": 200 }
    Returns: { "summary": "..." }
    """
    data   = request.get_json(force=True) or {}
    text   = data.get("text", "").strip()
    max_len= int(data.get("max_length", 200))

    if not text:
        return jsonify({"error": "text is required"}), 400

    try:
        summary = summarize_text(current_app, text, max_length=max_len)
        return jsonify({"summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rag_bp.get("/stats")
def rag_stats():
    """GET /rag/stats — collection info."""
    client     = get_qdrant_client(current_app)
    collection = current_app.config["QDRANT_COLLECTION"]
    try:
        info = client.get_collection(collection)
        return jsonify({
            "collection":     collection,
            "vectors_count":  info.vectors_count,
            "points_count":   info.points_count,
            "status":         str(info.status),
        })
    except Exception as e:
        return jsonify({"collection": collection, "error": str(e), "vectors_count": 0})


@rag_bp.post("/narrate")
def narrate():
    """
    POST /rag/narrate
    Expand structured bullet points into formal SAR-style narrative prose.
    Called by report-service (NOT by the frontend directly).

    This endpoint is intentionally separate from /rag/query:
      - /rag/query: document-grounded Q&A (retrieves from Qdrant, answers questions)
      - /rag/narrate: structured-bullets-to-prose (no retrieval, different system prompt)

    Body: {
        "section_id":    "4.1",
        "section_title": "Enrolment Ratio",
        "bullets":       ["Students enrolled: 58", "Sanctioned intake: 60", ...],
        "style":         "sar_tier_ii" | "json_only",
        "max_words":     300
    }
    Returns: { "narrative": "..." }
    """
    data          = request.get_json(force=True) or {}
    section_id    = data.get("section_id", "")
    section_title = data.get("section_title", "")
    bullets       = data.get("bullets", [])
    style         = data.get("style", "sar_tier_ii")
    max_words     = int(data.get("max_words", 300))

    if not bullets:
        return jsonify({"error": "bullets is required and must be non-empty"}), 400

    try:
        from rag.generator import generate_narrative
        narrative = generate_narrative(
            app=current_app,
            section_id=section_id,
            section_title=section_title,
            bullets=bullets,
            style=style,
            max_words=max_words,
        )
        return jsonify({"narrative": narrative, "section_id": section_id})
    except Exception as e:
        logger.error(f"[narrate] Failed for section {section_id}: {e}")
        return jsonify({"error": str(e)}), 500
