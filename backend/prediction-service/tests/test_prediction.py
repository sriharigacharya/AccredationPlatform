"""
Tests for Prediction Service (AcademiQ)
Covers feature extraction, single student prediction, batch prediction, and model info endpoints.
"""

import os
import sys
import json
from pathlib import Path
from unittest.mock import MagicMock

# Add service directory to sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from app import create_app
import routes.predict as predict_module


class MockRFModel:
    def __init__(self, fail_prob=0.8):
        self.fail_prob = fail_prob
        clf = MagicMock()
        clf.feature_importances_ = [0.12, 0.25, 0.18, 0.10, 0.15, 0.10, 0.05, 0.05]
        self.named_steps = {"clf": clf}

    def predict_proba(self, X):
        return [[1.0 - self.fail_prob, self.fail_prob]]


@pytest.fixture
def client(tmp_path):
    app = create_app()
    app.config["TESTING"] = True
    app.config["MODEL_DIR"] = str(tmp_path)

    # Inject mock model into cache
    predict_module._model_cache["rf_model.pkl"] = MockRFModel(fail_prob=0.85)

    with app.app_context():
        yield app.test_client()

    predict_module._model_cache.clear()


def test_student_to_features():
    """Verify student dict converts to correct numeric feature vector."""
    student_data = {
        "semester": 5,
        "attendance_pct": 68.5,
        "internal_marks": 42.0,
        "assignment_score_pct": 75.0,
        "previous_gpa": 6.2,
        "backlogs": 2,
        "course_performance_pct": 58.0,
        "engagement": "Low"
    }
    features = predict_module._student_to_features(student_data)
    assert features == [5.0, 68.5, 42.0, 75.0, 6.2, 2.0, 58.0, 0.0]

    # Test high engagement encoding
    student_data["engagement"] = "High"
    features_high = predict_module._student_to_features(student_data)
    assert features_high[-1] == 2.0


def test_predict_student_high_risk(client):
    """POST /predict/student returns High risk and Fail for fail_prob=0.85."""
    payload = {
        "student_id": "STU005",
        "semester": 4,
        "attendance_pct": 52.0,
        "internal_marks": 35.0,
        "assignment_score_pct": 45.0,
        "previous_gpa": 5.1,
        "backlogs": 3,
        "course_performance_pct": 40.0,
        "engagement": "Low"
    }
    resp = client.post("/predict/student", json=payload)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["student_id"] == "STU005"
    assert data["prediction"] == "Fail"
    assert data["risk_score"] == 0.85
    assert data["risk_level"] == "High"
    assert "feature_importance" in data
    assert "attendance_pct" in data["feature_importance"]


def test_predict_student_low_risk(client):
    """POST /predict/student returns Low risk and Pass when fail_prob is low."""
    predict_module._model_cache["rf_model.pkl"] = MockRFModel(fail_prob=0.15)

    payload = {
        "student_id": "STU001",
        "semester": 4,
        "attendance_pct": 92.0,
        "internal_marks": 85.0,
        "assignment_score_pct": 90.0,
        "previous_gpa": 8.5,
        "backlogs": 0,
        "course_performance_pct": 88.0,
        "engagement": "High"
    }
    resp = client.post("/predict/student", json=payload)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["prediction"] == "Pass"
    assert data["risk_score"] == 0.15
    assert data["risk_level"] == "Low"


def test_predict_student_empty_body(client):
    """POST /predict/student with empty body returns 400."""
    resp = client.post("/predict/student", json={})
    assert resp.status_code == 400


def test_predict_batch(client):
    """POST /predict/batch scores multiple students."""
    students = [
        {"student_id": "STU001", "semester": 3, "attendance_pct": 80.0},
        {"student_id": "STU002", "semester": 3, "attendance_pct": 55.0},
    ]
    resp = client.post("/predict/batch", json={"students": students})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 2
    assert len(data["predictions"]) == 2
    assert data["predictions"][0]["student_id"] == "STU001"


def test_predict_batch_empty(client):
    """POST /predict/batch without students returns 400."""
    resp = client.post("/predict/batch", json={"students": []})
    assert resp.status_code == 400


def test_model_info(client, tmp_path):
    """GET /predict/model/info returns model metadata from disk."""
    # When file does not exist -> 404
    resp = client.get("/predict/model/info")
    assert resp.status_code == 404

    # Write dummy meta
    meta_path = tmp_path / "model_meta.json"
    meta_path.write_text(json.dumps({"model_type": "RandomForestClassifier", "accuracy": 0.92}))

    resp2 = client.get("/predict/model/info")
    assert resp2.status_code == 200
    assert resp2.get_json()["model_type"] == "RandomForestClassifier"
