"""
NLP / RAG Service — AcademiQ
Handles: document embedding (BGE-M3), vector storage (Qdrant), RAG Q&A (LLM), summarization.
"""

import os
from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["QDRANT_HOST"]    = os.getenv("QDRANT_HOST", "qdrant")
    app.config["QDRANT_PORT"]    = int(os.getenv("QDRANT_PORT", 6333))
    app.config["QDRANT_COLLECTION"] = os.getenv("QDRANT_COLLECTION", "academiq_docs")
    app.config["LLM_BACKEND"]   = os.getenv("LLM_BACKEND", "groq")
    app.config["LLM_MODEL"]     = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
    app.config["OPENAI_API_KEY"]= os.getenv("OPENAI_API_KEY", "")
    app.config["OPENAI_BASE_URL"]= os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    app.config["OLLAMA_HOST"]   = os.getenv("OLLAMA_HOST", "http://ollama:11434")
    app.config["EMBEDDING_MODEL"]= os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

    from routes.rag import rag_bp
    from routes.embed import embed_bp
    app.register_blueprint(rag_bp,   url_prefix="/rag")
    app.register_blueprint(embed_bp, url_prefix="")

    @app.get("/health")
    def health():
        return {
            "status":      "ok",
            "service":     "nlp-rag-service",
            "llm_backend": app.config["LLM_BACKEND"],
            "llm_model":   app.config["LLM_MODEL"],
        }

    return app


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8005))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
