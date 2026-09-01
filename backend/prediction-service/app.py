"""
Prediction Service — AcademiQ
Student pass/fail risk prediction using Random Forest + XGBoost.
Pre-trained model is included. Retrain via POST /predict/train.
"""

import os
from flask import Flask
from flask_cors import CORS


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

    return app


if __name__ == "__main__":
    port = int(os.getenv("SERVICE_PORT", 8006))
    app  = create_app()
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "0") == "1")
