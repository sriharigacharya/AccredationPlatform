"""
Prediction routes — pass/fail risk prediction endpoints.
"""

import os
import json
import pickle
import logging
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app

predict_bp = Blueprint("predict", __name__)
logger     = logging.getLogger(__name__)

FEATURES = [
    "semester", "attendance_pct", "internal_marks",
    "assignment_score_pct", "previous_gpa", "backlogs",
    "course_performance_pct", "engagement_encoded",
]
ENGAGEMENT_MAP = {"Low": 0, "Medium": 1, "High": 2}

_model_cache = {}


def _load_model(model_dir: str, name: str = "rf_model.pkl"):
    """Load and cache pickled model."""
    if name not in _model_cache:
        path = Path(model_dir) / name
        if not path.exists():
            # Train on first boot if model not found
            logger.warning(f"[predict] Model not found at {path}. Training now…")
            from train import train_model
            train_model()
        with open(path, "rb") as f:
            _model_cache[name] = pickle.load(f)
        logger.info(f"[predict] Loaded model: {path}")
    return _model_cache[name]


def _student_to_features(data: dict) -> list:
    """Convert student dict to feature vector."""
    engagement = data.get("engagement", "Medium")
    return [
        float(data.get("semester", 1)),
        float(data.get("attendance_pct", 0)),
        float(data.get("internal_marks", 0)),
        float(data.get("assignment_score_pct", 0)),
        float(data.get("previous_gpa", 0)),
        float(data.get("backlogs", 0)),
        float(data.get("course_performance_pct", 0)),
        float(ENGAGEMENT_MAP.get(engagement, 1)),
    ]


@predict_bp.post("/student")
def predict_student():
    """
    POST /predict/student
    Body: student record matching the schema in brief
    Returns: {
        "prediction": "Pass" | "Fail",
        "risk_score": 0.73,       (probability of Fail)
        "risk_level": "High" | "Medium" | "Low",
        "feature_importance": { ... }
    }
    """
    data = request.get_json(force=True) or {}
    if not data:
        return jsonify({"error": "Student data required"}), 400

    features = _student_to_features(data)
    model    = _load_model(current_app.config["MODEL_DIR"])

    proba    = model.predict_proba([features])[0]
    fail_prob= float(proba[1])
    pred     = "Fail" if fail_prob >= 0.5 else "Pass"
    risk_lvl = "High" if fail_prob >= 0.7 else "Medium" if fail_prob >= 0.4 else "Low"

    # Feature importances (RF only)
    importance = {}
    try:
        clf = model.named_steps["clf"]
        for feat, imp in zip(FEATURES, clf.feature_importances_):
            importance[feat] = round(float(imp), 4)
    except Exception:
        pass

    return jsonify({
        "student_id":        data.get("student_id"),
        "prediction":        pred,
        "risk_score":        round(fail_prob, 4),
        "risk_level":        risk_lvl,
        "feature_importance":importance,
        "input_features":    dict(zip(FEATURES, features)),
    })


@predict_bp.post("/batch")
def predict_batch():
    """
    POST /predict/batch
    Body: { "students": [ {...}, {...} ] }
    Returns list of predictions.
    """
    data     = request.get_json(force=True) or {}
    students = data.get("students", [])
    if not students:
        return jsonify({"error": "students list required"}), 400

    model   = _load_model(current_app.config["MODEL_DIR"])
    results = []

    for s in students:
        features = _student_to_features(s)
        proba    = model.predict_proba([features])[0]
        fail_prob= float(proba[1])
        results.append({
            "student_id": s.get("student_id"),
            "prediction": "Fail" if fail_prob >= 0.5 else "Pass",
            "risk_score": round(fail_prob, 4),
            "risk_level": "High" if fail_prob >= 0.7 else "Medium" if fail_prob >= 0.4 else "Low",
        })

    return jsonify({"predictions": results, "count": len(results)})


@predict_bp.get("/atrisk")
def at_risk_students():
    """
    GET /predict/atrisk?threshold=0.5&limit=50
    Fetches all students from academic-data-service and returns those above risk threshold.
    """
    threshold = float(request.args.get("threshold", 0.5))
    limit     = int(request.args.get("limit", 50))

    # Fetch students from academic-data-service (internal call)
    academic_url = os.getenv("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")
    import requests as req
    try:
        resp = req.get(f"{academic_url}/students/", timeout=10)
        resp.raise_for_status()
        students = resp.json()
    except Exception as e:
        return jsonify({"error": f"Could not fetch student data: {e}"}), 503

    if not students:
        return jsonify({"at_risk": [], "count": 0})

    model   = _load_model(current_app.config["MODEL_DIR"])
    at_risk = []

    for s in students:
        features = _student_to_features(s)
        proba    = model.predict_proba([features])[0]
        fail_prob= float(proba[1])
        if fail_prob >= threshold:
            at_risk.append({
                **s,
                "risk_score": round(fail_prob, 4),
                "risk_level": "High" if fail_prob >= 0.7 else "Medium",
            })

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    return jsonify({"at_risk": at_risk[:limit], "count": len(at_risk), "threshold": threshold})


@predict_bp.post("/train")
def retrain():
    """POST /predict/train — retrain model on current student data (admin only)."""
    # NOTE: Add auth check in production (admin only)
    try:
        from train import train_model
        _model_cache.clear()  # Invalidate cache
        _, meta = train_model()
        return jsonify({"status": "trained", "metadata": meta})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@predict_bp.get("/model/info")
def model_info():
    """GET /predict/model/info — model metadata."""
    model_dir = current_app.config["MODEL_DIR"]
    meta_path = Path(model_dir) / "model_meta.json"
    if meta_path.exists():
        with open(meta_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Model metadata not found. Run /predict/train first."}), 404
