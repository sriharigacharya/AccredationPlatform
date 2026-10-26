"""
Prediction Service — AcademiQ
Student pass/fail risk prediction using Random Forest + XGBoost.

Prediction strategy (persisted results):
  - On startup: runs a full batch prediction and writes results to the DB.
  - Daily at 02:00 AM: re-runs batch prediction automatically.
  - Manual trigger: POST /predict/run-batch (admin-initiated from Settings page).
  - Dashboard query: GET /predict/atrisk reads cached DB results — instant response.
"""

import os
import logging
from flask import Flask
from flask_cors import CORS

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["POSTGRES_USER"]     = os.getenv("POSTGRES_USER", "academiq")
    app.config["POSTGRES_PASSWORD"] = os.getenv("POSTGRES_PASSWORD", "academiq_pass")
    app.config["POSTGRES_HOST"]     = os.getenv("POSTGRES_HOST", "postgres")
    app.config["POSTGRES_PORT"]     = os.getenv("POSTGRES_PORT", "5432")
    app.config["POSTGRES_DB"]       = os.getenv("POSTGRES_DB", "academiq")
    app.config["MODEL_DIR"]         = os.getenv("MODEL_DIR", "/app/models")

    from routes.predict import predict_bp
    app.register_blueprint(predict_bp, url_prefix="/predict")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "prediction-service"}

    # ── APScheduler: daily 2 AM batch + startup run ───────────────────────────
    _start_scheduler(app)

    return app


def _start_scheduler(app):
    """
    Start APScheduler with two jobs:
      1. Daily cron at 02:00 AM — full batch prediction written to DB.
      2. One-shot delayed startup run — runs 15 s after boot to let
         academic-data-service finish seeding before we read students.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from routes.predict import run_batch_and_persist
    except ImportError:
        logger.warning("[scheduler] APScheduler not installed — skipping scheduler setup.")
        return

    model_dir = app.config["MODEL_DIR"]

    def _daily_job():
        logger.info("[scheduler] Daily 02:00 AM batch prediction triggered.")
        with app.app_context():
            run_batch_and_persist(model_dir)

    def _startup_job():
        import time
        time.sleep(15)          # wait for academic-data-service to be ready
        logger.info("[scheduler] Startup batch prediction triggered.")
        with app.app_context():
            run_batch_and_persist(model_dir)

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(_daily_job, CronTrigger(hour=2, minute=0), id="daily_batch")

    import threading
    t = threading.Thread(target=_startup_job, daemon=True, name="startup-batch")
    t.start()

    scheduler.start()
    logger.info("[scheduler] APScheduler started — daily batch scheduled at 02:00 AM.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    port = int(os.getenv("SERVICE_PORT", 8006))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
