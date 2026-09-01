"""
API Gateway — AcademiQ
Single entry point for the React frontend.
Validates JWT, attaches user context headers, proxies to backend services.
"""

import os
import logging
from flask import Flask
from flask_cors import CORS
from middleware.proxy import proxy_bp

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def create_app():
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:3000", "http://frontend:3000"])

    # Service URLs
    app.config["AUTH_SERVICE_URL"]         = os.getenv("AUTH_SERVICE_URL",         "http://auth-service:8001")
    app.config["ACADEMIC_DATA_SERVICE_URL"]= os.getenv("ACADEMIC_DATA_SERVICE_URL","http://academic-data-service:8002")
    app.config["PARENT_CONTACT_SERVICE_URL"]= os.getenv("PARENT_CONTACT_SERVICE_URL","http://parent-contact-service:8003")
    app.config["DOCUMENT_SERVICE_URL"]     = os.getenv("DOCUMENT_SERVICE_URL",     "http://document-service:8004")
    app.config["NLP_RAG_SERVICE_URL"]      = os.getenv("NLP_RAG_SERVICE_URL",      "http://nlp-rag-service:8005")
    app.config["PREDICTION_SERVICE_URL"]   = os.getenv("PREDICTION_SERVICE_URL",   "http://prediction-service:8006")
    app.config["REPORT_SERVICE_URL"]       = os.getenv("REPORT_SERVICE_URL",       "http://report-service:8007")
    app.config["JWT_SECRET"]              = os.getenv("JWT_SECRET", "changeme")
    app.config["JWT_ALGORITHM"]           = os.getenv("JWT_ALGORITHM", "HS256")

    app.register_blueprint(proxy_bp, url_prefix="/api/v1")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "api-gateway"}

    @app.get("/")
    def root():
        return {"message": "AcademiQ API Gateway", "version": "1.0",
                "docs": "See README.md for API reference"}

    return app


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8000))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
