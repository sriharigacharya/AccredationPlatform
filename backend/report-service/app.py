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

    @app.get("/criteria")
    def criteria():
        from routes.reports import list_criteria
        return list_criteria()

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
        _run_db_migrations()
        _seed_demo_narratives()

    return app


def _seed_demo_narratives():
    """Seed sample realistic NBA narrative for Section 4.6.2 (Publication of Technical Magazines & Newsletters)."""
    from models import ReportNarrative
    try:
        if ReportNarrative.query.filter_by(node_id="4.6.2").count() == 0:
            narrative_text = (
                "1. MANTHANA, Yearly College Magazine: 'MANTHANA', the flagship college magazine, is published annually during the inauguration of the academic session. It features high-quality technical articles, innovations, and retrospective reports on academic, co-curricular, and extra-curricular milestones achieved during the previous academic year. It serves as an open publication platform for both undergraduate students and faculty researchers.\n\n"
                "2. THE EDIFICE, Biannual Departmental Newsletter: 'THE EDIFICE', the Department of Computer Science & Engineering biannual newsletter, documents department-level symposiums, hackathons, guest lectures, student club initiatives, and competitive milestones.\n\n"
                "3. TECHPULSE NEWSLETTER: Released quarterly under the guidance of the student editorial committee and department faculty advisors.\n"
                "Editorial Board: Dr. Meena Iyer (Chief Editor), Prof. Ravi Shankar (Associate Editor), along with 6 student editors elected from 3rd and 4th year batches.\n"
                "During academic year 2025-26, more than 38 student technical articles, 15 competitive coding solutions, and 8 patent summaries were authored and published across department releases."
            )
            for dept in ["CSE", "ISE", "ECE"]:
                for ay in ["2025-26", "2024-25", "2023-24"]:
                    db.session.add(ReportNarrative(
                        sar_format="ug_tier_ii_gapc_v4",
                        node_id="4.6.2",
                        department_id=dept,
                        academic_year=ay,
                        narrative_text=narrative_text,
                        author_id="U_ADM001",
                        author_role="admin",
                    ))
            db.session.commit()
    except Exception as e:
        db.session.rollback()


def _run_db_migrations():
    """Add any missing columns for existing report_jobs table."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS include_event_ids JSON",
    ]
    for sql in migrations:
        try:
            db.session.execute(text(sql))
            db.session.commit()
        except Exception:
            db.session.rollback()




if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8007))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
