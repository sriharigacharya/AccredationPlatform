"""
Document Service — AcademiQ
Handles: file upload, async OCR pipeline, chunk forwarding to nlp-rag-service.
"""

import os
from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["UPLOAD_FOLDER"]     = os.getenv("UPLOAD_FOLDER", "/app/uploads")
    app.config["MAX_CONTENT_LENGTH"]= 50 * 1024 * 1024  # 50 MB max upload
    app.config["MONGO_URI"]         = os.getenv("MONGO_URI", "mongodb://mongodb:27017/academiq_docs")
    app.config["NLP_RAG_SERVICE_URL"]= os.getenv("NLP_RAG_SERVICE_URL", "http://nlp-rag-service:8005")

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # MongoDB connection (stored on app)
    mongo_client = MongoClient(app.config["MONGO_URI"])
    app.mongo = mongo_client.get_default_database()

    from routes.documents import docs_bp
    app.register_blueprint(docs_bp, url_prefix="/documents")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "document-service"}

    return app


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8004))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
