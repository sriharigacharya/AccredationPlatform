"""
Report Service — AcademiQ
Generates NBA SAR reports (PDF + DOCX) and ad-hoc AI-powered reports.
Port 8007.
"""

import os
import logging
from flask import Flask
from flask_cors import CORS
from models import db

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def create_app():
    app = Flask(__name__)
    CORS(app)

    # ── Database (shared PostgreSQL instance) ──────────────────
    pg_user = os.getenv("POSTGRES_USER", "academiq")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "academiq_pass")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db   = os.getenv("POSTGRES_DB", "academiq")

    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # ── Service URLs (injected by Docker Compose via .env) ─────
    app.config["ACADEMIC_DATA_SERVICE_URL"] = os.getenv(
        "ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002"
    )
    app.config["PREDICTION_SERVICE_URL"] = os.getenv(
        "PREDICTION_SERVICE_URL", "http://prediction-service:8006"
    )
    app.config["NLP_RAG_SERVICE_URL"] = os.getenv(
        "NLP_RAG_SERVICE_URL", "http://nlp-rag-service:8005"
    )

    # ── File storage ──────────────────────────────────────────
    app.config["REPORTS_DIR"] = os.getenv("REPORTS_DIR", "/app/reports")
    os.makedirs(app.config["REPORTS_DIR"], exist_ok=True)

    db.init_app(app)

    from routes.reports import reports_bp
    app.register_blueprint(reports_bp, url_prefix="/reports")

    @app.get("/health")
    def health():
        return {
            "status":  "ok",
            "service": "report-service",
            "formats": ["pdf", "docx"],
            "sar_formats": ["ug_tier_ii_gapc_v4"],
        }

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8007))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
