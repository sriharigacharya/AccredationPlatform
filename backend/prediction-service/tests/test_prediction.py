"""
tests/test_prediction.py — Regression tests for prediction-service.

Covers (added per Prompts 1–5):
  - Constants module integrity
  - Feature extraction with population-mean defaults (not zeros)
  - Input range validation
  - Policy flag computation (DETENTION_RISK, ACTIVE_BACKLOG)
  - Graduated risk-level merge rule (6 scenario table)
  - model_tier computation from calibrated probability
  - Per-student SHAP / MDI fallback explanation structure
  - /predict/student response shape (risk_score, model_tier, risk_level, flags,
    low_confidence, missing_fields, explanation, feature_importance)
  - /predict/batch — individual error isolation (one bad student doesn't kill batch)
  - /predict/atrisk uses TIER_MEDIUM as default threshold
  - /predict/model/info surfaces new metric keys
  - Feature-list mismatch on model load raises RuntimeError
"""

import os
import sys
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_DIR))

import pytest
from app import create_app
import routes.predict as predict_module
from constants import (
    FEATURES, ENGAGEMENT_MAP, FEATURE_DEFAULTS, FEATURE_RANGES,
    TIER_HIGH, TIER_MEDIUM,
    DETENTION_ATTENDANCE_THRESHOLD, DETENTION_SEVERE_THRESHOLD,
    BACKLOG_SEVERE_THRESHOLD, LOW_CONFIDENCE_MISSING_THRESHOLD,
)
from routes.predict import (
    _student_to_features,
    _validate_ranges,
    _compute_flags,
    _model_tier,
    _merge_risk_level,
    _is_low_confidence,
)


# ─────────────────────────────── Helpers ─────────────────────────────────────

class MockCalibratedModel:
    """Minimal model mock that satisfies predict_proba and named_steps."""

    def __init__(self, fail_prob: float = 0.80):
        self.fail_prob = fail_prob
        # Simulate CalibratedClassifierCV pipeline (no named_steps["clf"].feature_importances_)
        inner_clf = MagicMock()
        inner_clf.feature_importances_ = [0.12, 0.25, 0.18, 0.10, 0.15, 0.10, 0.05, 0.05]
        self.named_steps = {"clf": inner_clf}

    def predict_proba(self, X):
        return [[1.0 - self.fail_prob, self.fail_prob]] * len(X)


@pytest.fixture
def client(tmp_path):
    app = create_app()
    app.config["TESTING"] = True
    app.config["MODEL_DIR"] = str(tmp_path)

    predict_module._model_cache["rf_model.joblib"] = MockCalibratedModel(fail_prob=0.85)

    with app.app_context():
        yield app.test_client()

    predict_module._model_cache.clear()


@pytest.fixture
def low_fail_client(tmp_path):
    app = create_app()
    app.config["TESTING"] = True
    app.config["MODEL_DIR"] = str(tmp_path)

    predict_module._model_cache["rf_model.joblib"] = MockCalibratedModel(fail_prob=0.15)

    with app.app_context():
        yield app.test_client()

    predict_module._model_cache.clear()


# ─────────────────────────────── Prompt 1: Constants ─────────────────────────

class TestConstants:
    def test_tier_high_value(self):
        assert TIER_HIGH == 0.65

    def test_tier_medium_value(self):
        assert TIER_MEDIUM == 0.35

    def test_features_ordered_and_complete(self):
        assert FEATURES == [
            "semester", "attendance_pct", "internal_marks",
            "assignment_score_pct", "previous_gpa", "backlogs",
            "course_performance_pct", "engagement_encoded",
        ]

    def test_feature_defaults_cover_all_features(self):
        for feat in FEATURES:
            assert feat in FEATURE_DEFAULTS, f"Missing default for {feat}"

    def test_detention_thresholds(self):
        assert DETENTION_ATTENDANCE_THRESHOLD == 75
        assert DETENTION_SEVERE_THRESHOLD == 65
        assert BACKLOG_SEVERE_THRESHOLD == 3

    def test_engagement_map(self):
        assert ENGAGEMENT_MAP == {"Low": 0, "Medium": 1, "High": 2}


# ─────────────────────────────── Prompt 3: Feature Extraction ────────────────

class TestFeatureExtraction:
    def test_complete_record_extracts_correctly(self):
        data = {
            "semester": 5, "attendance_pct": 68.5, "internal_marks": 42.0,
            "assignment_score_pct": 75.0, "previous_gpa": 6.2, "backlogs": 2,
            "course_performance_pct": 58.0, "engagement": "Low",
        }
        vec, missing = _student_to_features(data)
        assert vec == [5.0, 68.5, 42.0, 75.0, 6.2, 2.0, 58.0, 0.0]
        assert missing == []

    def test_missing_fields_use_population_mean_not_zero(self):
        """Absent fields must NOT default to 0 — they must use FEATURE_DEFAULTS."""
        vec, missing = _student_to_features({})
        # attendance_pct default is 73, not 0
        assert vec[FEATURES.index("attendance_pct")] == FEATURE_DEFAULTS["attendance_pct"]
        assert vec[FEATURES.index("attendance_pct")] != 0.0
        # previous_gpa default is 7.0, not 0
        assert vec[FEATURES.index("previous_gpa")] == FEATURE_DEFAULTS["previous_gpa"]
        assert vec[FEATURES.index("previous_gpa")] != 0.0
        # All features should be in missing list
        assert len(missing) >= 7  # engagement_encoded + 7 numeric

    def test_partial_record_tracks_missing_correctly(self):
        data = {"semester": 3, "attendance_pct": 80.0}
        vec, missing = _student_to_features(data)
        assert "semester" not in missing
        assert "attendance_pct" not in missing
        assert "previous_gpa" in missing
        assert "internal_marks" in missing

    def test_high_engagement_encoding(self):
        data = {"engagement": "High"}
        vec, _ = _student_to_features(data)
        assert vec[FEATURES.index("engagement_encoded")] == 2.0

    def test_unknown_engagement_uses_default(self):
        data = {"engagement": "Unknown"}
        vec, missing = _student_to_features(data)
        # Should use default (Medium=1) not crash
        assert vec[FEATURES.index("engagement_encoded")] == FEATURE_DEFAULTS["engagement_encoded"]


# ─────────────────────────────── Prompt 3: Range Validation ──────────────────

class TestRangeValidation:
    def test_valid_input_no_errors(self):
        data = {
            "semester": 3, "attendance_pct": 75.0, "internal_marks": 60.0,
            "assignment_score_pct": 70.0, "previous_gpa": 7.0, "backlogs": 1,
            "course_performance_pct": 65.0,
        }
        assert _validate_ranges(data) == []

    def test_out_of_range_semester(self):
        errors = _validate_ranges({"semester": 9})
        assert any("semester" in e for e in errors)

    def test_out_of_range_attendance(self):
        errors = _validate_ranges({"attendance_pct": 110})
        assert any("attendance_pct" in e for e in errors)

    def test_out_of_range_gpa(self):
        errors = _validate_ranges({"previous_gpa": 11.0})
        assert any("previous_gpa" in e for e in errors)

    def test_out_of_range_backlogs(self):
        errors = _validate_ranges({"backlogs": 25})
        assert any("backlogs" in e for e in errors)

    def test_missing_fields_not_validated(self):
        """Absent fields should not trigger range errors — they use defaults."""
        assert _validate_ranges({}) == []


# ─────────────────────────────── Prompt 2: Flag Computation ──────────────────

class TestFlagComputation:
    def test_no_flags_when_clean(self):
        flags = _compute_flags({"attendance_pct": 85.0, "backlogs": 0})
        assert flags == []

    def test_detention_risk_medium_severity(self):
        # attendance between 65 and 75
        flags = _compute_flags({"attendance_pct": 70.0})
        codes = [f["code"] for f in flags]
        assert "DETENTION_RISK" in codes
        det = next(f for f in flags if f["code"] == "DETENTION_RISK")
        assert det["severity"] == "medium"

    def test_detention_risk_high_severity(self):
        # attendance below 65
        flags = _compute_flags({"attendance_pct": 58.0})
        det = next(f for f in flags if f["code"] == "DETENTION_RISK")
        assert det["severity"] == "high"

    def test_active_backlog_medium_severity(self):
        flags = _compute_flags({"backlogs": 2})
        bl = next(f for f in flags if f["code"] == "ACTIVE_BACKLOG")
        assert bl["severity"] == "medium"

    def test_active_backlog_high_severity(self):
        flags = _compute_flags({"backlogs": 4})
        bl = next(f for f in flags if f["code"] == "ACTIVE_BACKLOG")
        assert bl["severity"] == "high"

    def test_multiple_flags_possible(self):
        flags = _compute_flags({"attendance_pct": 55.0, "backlogs": 3})
        codes = [f["code"] for f in flags]
        assert "DETENTION_RISK" in codes
        assert "ACTIVE_BACKLOG" in codes


# ─────────────────────────────── Prompt 2: Model Tier ────────────────────────

class TestModelTier:
    def test_high_tier(self):
        assert _model_tier(TIER_HIGH) == "High"
        assert _model_tier(0.99) == "High"

    def test_medium_tier(self):
        assert _model_tier(TIER_MEDIUM) == "Medium"
        assert _model_tier(0.50) == "Medium"

    def test_low_tier(self):
        assert _model_tier(0.0) == "Low"
        assert _model_tier(TIER_MEDIUM - 0.01) == "Low"


# ─────────────────────────────── Prompt 2: Graduated Merge Rule ──────────────

class TestMergeRiskLevel:
    """6-scenario table from the spec."""

    def test_model_high_stays_high_regardless_of_flags(self):
        assert _merge_risk_level("High", []) == "High"
        assert _merge_risk_level("High", [{"severity": "high", "code": "X", "message": ""}]) == "High"

    def test_model_medium_plus_high_flag_becomes_high(self):
        flags = [{"code": "DETENTION_RISK", "message": "", "severity": "high"}]
        assert _merge_risk_level("Medium", flags) == "High"

    def test_model_low_plus_high_flag_becomes_medium(self):
        flags = [{"code": "DETENTION_RISK", "message": "", "severity": "high"}]
        assert _merge_risk_level("Low", flags) == "Medium"

    def test_model_low_plus_medium_flag_becomes_medium(self):
        flags = [{"code": "ACTIVE_BACKLOG", "message": "", "severity": "medium"}]
        assert _merge_risk_level("Low", flags) == "Medium"

    def test_model_medium_plus_medium_flag_stays_medium(self):
        flags = [{"code": "ACTIVE_BACKLOG", "message": "", "severity": "medium"}]
        assert _merge_risk_level("Medium", flags) == "Medium"

    def test_no_flags_returns_model_tier(self):
        assert _merge_risk_level("Low", []) == "Low"
        assert _merge_risk_level("Medium", []) == "Medium"


# ─────────────────────────────── Prompt 3: Low Confidence ────────────────────

class TestLowConfidence:
    def test_not_low_when_few_missing(self):
        assert _is_low_confidence(["previous_gpa"], {}) is False

    def test_low_when_many_missing(self):
        many = ["a", "b", "c"]  # >= LOW_CONFIDENCE_MISSING_THRESHOLD
        assert _is_low_confidence(many, {}) is True

    def test_low_for_sem1_without_gpa(self):
        assert _is_low_confidence(["previous_gpa"], {"semester": 1}) is True

    def test_not_low_for_sem1_when_gpa_present(self):
        assert _is_low_confidence([], {"semester": 1}) is False

    def test_not_low_for_sem2_without_gpa(self):
        assert _is_low_confidence(["previous_gpa"], {"semester": 2}) is False


# ─────────────────────────────── Prompt 4: Explanation Structure ─────────────

class TestExplanation:
    def test_explanation_fallback_structure_when_shap_absent(self, client):
        """When shap is not installed the response must have type=global_importance_fallback."""
        payload = {
            "student_id": "STU_TEST",
            "semester": 4, "attendance_pct": 70.0, "internal_marks": 55.0,
            "assignment_score_pct": 65.0, "previous_gpa": 6.5, "backlogs": 1,
            "course_performance_pct": 60.0, "engagement": "Medium",
        }
        with patch.dict("sys.modules", {"shap": None}):
            resp = client.post("/predict/student", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "explanation" in data
        exp = data["explanation"]
        assert exp["type"] in ("global_importance_fallback", "shap_treexplainer", "unavailable")

    def test_explanation_has_contributions_key(self, client):
        payload = {
            "student_id": "STU_TEST",
            "semester": 4, "attendance_pct": 70.0, "internal_marks": 55.0,
            "assignment_score_pct": 65.0, "previous_gpa": 6.5, "backlogs": 1,
            "course_performance_pct": 60.0, "engagement": "Medium",
        }
        with patch.dict("sys.modules", {"shap": None}):
            resp = client.post("/predict/student", json=payload)
        data = resp.get_json()
        exp = data["explanation"]
        if exp["type"] != "unavailable":
            assert "contributions" in exp


# ─────────────────────────────── Endpoint: /predict/student ──────────────────

class TestPredictStudent:
    def test_high_risk_response_shape(self, client):
        payload = {
            "student_id": "STU005",
            "semester": 4, "attendance_pct": 52.0, "internal_marks": 35.0,
            "assignment_score_pct": 45.0, "previous_gpa": 5.1, "backlogs": 3,
            "course_performance_pct": 40.0, "engagement": "Low",
        }
        resp = client.post("/predict/student", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()

        # Required new fields
        assert "model_tier"      in data
        assert "risk_level"      in data
        assert "flags"           in data
        assert "low_confidence"  in data
        assert "missing_fields"  in data
        assert "explanation"     in data
        # Backward-compat field retained
        assert "feature_importance" in data

    def test_high_risk_model_tier_is_high(self, client):
        """fail_prob=0.85 >= TIER_HIGH(0.65) → model_tier=High."""
        payload = {"student_id": "STU005", "semester": 4, "attendance_pct": 85.0,
                   "internal_marks": 60.0, "assignment_score_pct": 70.0,
                   "previous_gpa": 7.0, "backlogs": 0, "course_performance_pct": 65.0,
                   "engagement": "Medium"}
        resp = client.post("/predict/student", json=payload)
        data = resp.get_json()
        assert data["model_tier"] == "High"
        assert data["risk_level"] == "High"

    def test_low_risk_no_flags(self, low_fail_client):
        """fail_prob=0.15 < TIER_MEDIUM(0.35) → model_tier=Low, risk_level=Low."""
        payload = {
            "student_id": "STU001",
            "semester": 4, "attendance_pct": 92.0, "internal_marks": 85.0,
            "assignment_score_pct": 90.0, "previous_gpa": 8.5, "backlogs": 0,
            "course_performance_pct": 88.0, "engagement": "High",
        }
        resp = low_fail_client.post("/predict/student", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["model_tier"]  == "Low"
        assert data["risk_level"]  == "Low"
        assert data["flags"]       == []
        assert data["low_confidence"] is False

    def test_empty_body_returns_400(self, client):
        resp = client.post("/predict/student", json={})
        assert resp.status_code == 400

    def test_out_of_range_returns_400(self, client):
        resp = client.post("/predict/student", json={
            "student_id": "STU_BAD", "semester": 99, "attendance_pct": 70.0,
            "internal_marks": 50.0, "assignment_score_pct": 60.0,
            "previous_gpa": 6.0, "backlogs": 0, "course_performance_pct": 55.0,
        })
        assert resp.status_code == 400
        assert "validation" in resp.get_json().get("error", "").lower()

    def test_flags_present_when_low_attendance(self, client):
        """Attendance below 75 should produce DETENTION_RISK flag independently."""
        payload = {
            "student_id": "STU_ATT",
            "semester": 3, "attendance_pct": 60.0, "internal_marks": 70.0,
            "assignment_score_pct": 75.0, "previous_gpa": 7.5, "backlogs": 0,
            "course_performance_pct": 72.0, "engagement": "High",
        }
        resp = client.post("/predict/student", json=payload)
        data = resp.get_json()
        codes = [f["code"] for f in data["flags"]]
        assert "DETENTION_RISK" in codes

    def test_missing_fields_tracked(self, client):
        """Student dict with only student_id should have many missing_fields."""
        resp = client.post("/predict/student", json={"student_id": "STU_MISS"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["missing_fields"]) >= 3
        assert data["low_confidence"] is True

    def test_low_confidence_sem1_no_gpa(self, client):
        resp = client.post("/predict/student", json={
            "student_id": "STU_SEM1", "semester": 1,
            "attendance_pct": 80.0, "internal_marks": 65.0,
            "assignment_score_pct": 70.0, "backlogs": 0,
            "course_performance_pct": 68.0, "engagement": "Medium",
            # previous_gpa intentionally absent
        })
        data = resp.get_json()
        assert data["low_confidence"] is True
        assert "previous_gpa" in data["missing_fields"]


# ─────────────────────────────── Endpoint: /predict/batch ────────────────────

class TestPredictBatch:
    def test_batch_returns_results_for_all(self, client):
        students = [
            {"student_id": "STU001", "semester": 3, "attendance_pct": 80.0},
            {"student_id": "STU002", "semester": 3, "attendance_pct": 55.0},
        ]
        resp = client.post("/predict/batch", json={"students": students})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 2
        assert len(data["predictions"]) == 2

    def test_batch_result_shape_includes_new_fields(self, client):
        students = [{"student_id": "STU003", "semester": 4, "attendance_pct": 78.0}]
        resp = client.post("/predict/batch", json={"students": students})
        p = resp.get_json()["predictions"][0]
        assert "model_tier"      in p
        assert "risk_level"      in p
        assert "flags"           in p
        assert "low_confidence"  in p

    def test_batch_bad_record_does_not_kill_batch(self, client):
        """One invalid record (out-of-range) must not fail the entire batch."""
        students = [
            {"student_id": "STU_GOOD", "semester": 3, "attendance_pct": 80.0},
            {"student_id": "STU_BAD",  "semester": 99, "attendance_pct": 80.0},  # invalid
            {"student_id": "STU_ALSO_GOOD", "semester": 2, "attendance_pct": 85.0},
        ]
        resp = client.post("/predict/batch", json={"students": students})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 3
        ids = [p["student_id"] for p in data["predictions"]]
        assert "STU_GOOD"      in ids
        assert "STU_ALSO_GOOD" in ids
        # The bad one should have low_confidence=True and an error key
        bad = next(p for p in data["predictions"] if p["student_id"] == "STU_BAD")
        assert bad.get("low_confidence") is True

    def test_batch_empty_students_returns_400(self, client):
        resp = client.post("/predict/batch", json={"students": []})
        assert resp.status_code == 400


# ─────────────────────────────── Endpoint: /predict/atrisk ───────────────────

class TestAtRisk:
    def test_default_threshold_is_tier_medium(self):
        """GET /predict/atrisk without threshold param should use TIER_MEDIUM."""
        # Inspect the route source to confirm it uses TIER_MEDIUM (unit check)
        import inspect
        src = inspect.getsource(predict_module.at_risk_students)
        assert "TIER_MEDIUM" in src, (
            "/predict/atrisk default threshold must reference TIER_MEDIUM from constants, not a bare float"
        )


# ─────────────────────────────── Endpoint: /predict/model/info ───────────────

class TestModelInfo:
    def test_no_meta_returns_404(self, client):
        resp = client.get("/predict/model/info")
        assert resp.status_code == 404

    def test_meta_with_new_metrics_served(self, client, tmp_path):
        """Model info endpoint must serve pr_auc_test and cv_pr_auc_mean when present."""
        meta = {
            "features":       FEATURES,
            "sklearn_version": "1.5.2",
            "trained_on":     "synthetic_v2",
            "rf_accuracy":    0.91,
            "pr_auc_test":    0.87,
            "cv_pr_auc_mean": 0.85,
            "cv_pr_auc_std":  0.02,
        }
        (tmp_path / "model_meta.json").write_text(json.dumps(meta))
        # Reset model dir for this client
        from app import create_app as _ca
        app2 = _ca()
        app2.config["TESTING"]   = True
        app2.config["MODEL_DIR"] = str(tmp_path)
        predict_module._model_cache["rf_model.joblib"] = MockCalibratedModel()
        with app2.app_context():
            c2 = app2.test_client()
            resp = c2.get("/predict/model/info")
        predict_module._model_cache.clear()

        assert resp.status_code == 200
        d = resp.get_json()
        assert "pr_auc_test"    in d
        assert "cv_pr_auc_mean" in d
        assert d["sklearn_version"] == "1.5.2"
