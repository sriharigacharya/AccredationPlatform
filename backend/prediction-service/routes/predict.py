"""
Prediction routes — pass/fail risk prediction endpoints.

Architecture (persisted results):
  - run_batch_and_persist()  : fetches all students, runs ML, writes risk fields
                               back to academic-data-service via PATCH.
  - GET  /predict/atrisk     : reads pre-computed risk data from the DB (instant).
  - POST /predict/run-batch  : manually triggers a fresh batch run (admin).
  - GET  /predict/batch-status : returns last run time, student count, etc.
  - POST /predict/student    : single-student on-demand prediction (unchanged).
  - POST /predict/batch      : raw batch predictions (unchanged).
  - POST /predict/train      : retrain model then re-run batch.
  - GET  /predict/model/info : model metadata.

Fixes retained from previous version:
  - Prompt 1: All threshold/feature constants imported from constants.py
  - Prompt 2: Flag logic separated from model probability; graduated merge rule
  - Prompt 3: Population-mean defaults replace zero-fallback; missing_fields /
              low_confidence tracked; per-field range validation; batch does not
              fail on single bad record
  - Prompt 4: Per-student SHAP (TreeExplainer) explanation; global MDI fallback
              clearly labelled if shap unavailable
"""

import os
import json
import time
import joblib
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from flask import Blueprint, request, jsonify, current_app

from constants import (
    FEATURES,
    ENGAGEMENT_MAP,
    FEATURE_DEFAULTS,
    FEATURE_RANGES,
    TIER_HIGH,
    TIER_MEDIUM,
    DETENTION_ATTENDANCE_THRESHOLD,
    DETENTION_SEVERE_THRESHOLD,
    BACKLOG_SEVERE_THRESHOLD,
    LOW_CONFIDENCE_MISSING_THRESHOLD,
)

predict_bp = Blueprint("predict", __name__)
logger     = logging.getLogger(__name__)

# ── Model Cache ────────────────────────────────────────────────────────────────
_model_cache: dict = {}

# ── Batch Job State ────────────────────────────────────────────────────────────
# Tracks the last batch run result so the frontend can poll status.
_batch_status: dict = {
    "status":        "idle",          # idle | running | completed | failed
    "last_run_at":   None,            # ISO-8601 UTC string
    "students_total": 0,
    "students_updated": 0,
    "error":         None,
    "triggered_by":  None,            # "startup" | "scheduler" | "manual"
}
_batch_lock = threading.Lock()


# ── Model Loading ──────────────────────────────────────────────────────────────
def _load_model(model_dir: str, name: str = "rf_model.joblib"):
    """Load and cache joblib model.  Falls back to pickle name for legacy files."""
    if name not in _model_cache:
        path = Path(model_dir) / name
        if not path.exists():
            # Try legacy pickle name produced by old train.py
            legacy = Path(model_dir) / "rf_model.pkl"
            if legacy.exists():
                path = legacy
            else:
                logger.warning("[predict] Model not found at %s. Training now…", path)
                from train import train_model
                train_model()
                path = Path(model_dir) / name
                if not path.exists():
                    path = Path(model_dir) / "rf_model.pkl"

        try:
            import joblib as _jl
            _model_cache[name] = _jl.load(path)
        except Exception:
            with open(path, "rb") as f:
                import pickle as _pk
                _model_cache[name] = _pk.load(f)

        logger.info("[predict] Loaded model: %s", path)

        # ── Feature-list compatibility check ──────────────────────────────────
        meta_path = Path(model_dir) / "model_meta.json"
        if meta_path.exists():
            with open(meta_path) as fh:
                stored_meta = json.load(fh)
            stored_features = stored_meta.get("features")
            if stored_features and stored_features != FEATURES:
                raise RuntimeError(
                    f"[predict] FEATURE MISMATCH: persisted model was trained with "
                    f"{stored_features} but constants.py defines {FEATURES}. "
                    f"Retrain the model before running predictions."
                )

    return _model_cache[name]


# ── Input Validation ───────────────────────────────────────────────────────────
def _validate_ranges(data: dict) -> list[str]:
    """Return list of validation error messages for out-of-range numeric inputs."""
    errors: list[str] = []
    for field, (lo, hi) in FEATURE_RANGES.items():
        if field not in data:
            continue
        try:
            val = float(data[field])
        except (TypeError, ValueError):
            errors.append(f"'{field}' must be numeric, got {data[field]!r}")
            continue
        if not (lo <= val <= hi):
            errors.append(f"'{field}' out of range [{lo}, {hi}]: {val}")
    return errors


# ── Feature Extraction ─────────────────────────────────────────────────────────
def _student_to_features(data: dict) -> tuple[list[float], list[str]]:
    """
    Convert a student dict to (feature_vector, missing_fields).

    Absent numeric fields are filled with the documented population-mean defaults
    (from constants.FEATURE_DEFAULTS) rather than 0.
    """
    missing_fields: list[str] = []

    def _get(key: str, raw_key: str | None = None) -> float:
        lookup = raw_key or key
        if lookup not in data or data[lookup] is None:
            missing_fields.append(key)
            return float(FEATURE_DEFAULTS[key])
        return float(data[lookup])

    engagement_raw = data.get("engagement", None)
    if engagement_raw is None:
        missing_fields.append("engagement_encoded")
        eng_encoded = float(FEATURE_DEFAULTS["engagement_encoded"])
    else:
        eng_encoded = float(ENGAGEMENT_MAP.get(str(engagement_raw), FEATURE_DEFAULTS["engagement_encoded"]))

    vector = [
        _get("semester"),
        _get("attendance_pct"),
        _get("internal_marks"),
        _get("assignment_score_pct"),
        _get("previous_gpa"),
        _get("backlogs"),
        _get("course_performance_pct"),
        eng_encoded,
    ]
    return vector, missing_fields


# ── Policy Flag Computation ────────────────────────────────────────────────────
def _compute_flags(data: dict) -> list[dict]:
    """
    Compute deterministic policy flags INDEPENDENTLY of the model probability.
    Returns a list of {code, message, severity} dicts.
    """
    flags: list[dict] = []

    attendance = data.get("attendance_pct")
    if attendance is not None:
        try:
            att = float(attendance)
            if att < DETENTION_ATTENDANCE_THRESHOLD:
                severity = "high" if att < DETENTION_SEVERE_THRESHOLD else "medium"
                flags.append({
                    "code":     "DETENTION_RISK",
                    "message":  (
                        f"Attendance {att:.1f}% is below the statutory "
                        f"{DETENTION_ATTENDANCE_THRESHOLD}% minimum — "
                        f"student is at risk of detention."
                    ),
                    "severity": severity,
                })
        except (TypeError, ValueError):
            pass

    backlogs = data.get("backlogs")
    if backlogs is not None:
        try:
            bl = float(backlogs)
            if bl >= 1:
                severity = "high" if bl >= BACKLOG_SEVERE_THRESHOLD else "medium"
                flags.append({
                    "code":     "ACTIVE_BACKLOG",
                    "message":  (
                        f"Student has {int(bl)} active subject backlog(s). "
                        f"{'Severe backlog standing.' if severity == 'high' else 'Moderate backlog standing.'}"
                    ),
                    "severity": severity,
                })
        except (TypeError, ValueError):
            pass

    return flags


# ── Tier + Flag Merge (Graduated Rule) ────────────────────────────────────────
def _model_tier(fail_prob: float) -> str:
    """Map calibrated P(Fail) → 'High' | 'Medium' | 'Low' using shared constants."""
    if fail_prob >= TIER_HIGH:
        return "High"
    if fail_prob >= TIER_MEDIUM:
        return "Medium"
    return "Low"


def _merge_risk_level(model_tier: str, flags: list[dict]) -> str:
    """Graduated merge rule — see DECISIONS.md."""
    if model_tier == "High":
        return "High"

    max_flag_severity = None
    for f in flags:
        if f["severity"] == "high":
            max_flag_severity = "high"
            break
        if f["severity"] == "medium":
            max_flag_severity = "medium"

    if max_flag_severity == "high":
        return "High" if model_tier == "Medium" else "Medium"
    if max_flag_severity == "medium" and model_tier == "Low":
        return "Medium"
    return model_tier


# ── SHAP Explanation ───────────────────────────────────────────────────────────
def _build_explanation(model, features: list[float]) -> dict:
    """Return per-student SHAP contributions (TreeExplainer, class=1/Fail)."""
    try:
        import shap  # type: ignore
        try:
            clf = model.named_steps["clf"]
        except (AttributeError, KeyError):
            clf = model

        explainer = shap.TreeExplainer(clf)
        shap_values = explainer.shap_values([features])
        if isinstance(shap_values, list) and len(shap_values) > 1:
            contrib_raw = shap_values[1][0]
            base_raw    = explainer.expected_value[1]
        else:
            contrib_raw = shap_values[0]
            base_raw    = explainer.expected_value

        contributions = {feat: round(float(val), 5) for feat, val in zip(FEATURES, contrib_raw)}
        return {
            "type":          "shap_treexplainer",
            "base_value":    round(float(base_raw), 5),
            "contributions": contributions,
        }
    except ImportError:
        logger.warning("[predict] shap not installed — using global MDI fallback")
    except Exception as exc:
        logger.warning("[predict] SHAP computation failed (%s) — using global MDI fallback", exc)

    try:
        clf = model.named_steps["clf"]
        importances = {
            feat: round(float(imp), 4)
            for feat, imp in zip(FEATURES, clf.feature_importances_)
        }
        return {
            "type":        "global_importance_fallback",
            "disclaimer":  (
                "shap is not installed. These are global training-time "
                "importances, NOT personalised per-student contributions."
            ),
            "contributions": importances,
        }
    except Exception:
        return {"type": "unavailable"}


# ── Low Confidence ─────────────────────────────────────────────────────────────
def _is_low_confidence(missing_fields: list[str], data: dict) -> bool:
    if len(missing_fields) >= LOW_CONFIDENCE_MISSING_THRESHOLD:
        return True
    try:
        if int(float(data.get("semester", 2))) == 1 and "previous_gpa" in missing_fields:
            return True
    except (TypeError, ValueError):
        pass
    return False


# ── Core Batch Prediction + DB Persistence ────────────────────────────────────
def run_batch_and_persist(model_dir: str, triggered_by: str = "scheduler") -> dict:
    """
    Fetch all students from academic-data-service, run ML predictions,
    and PATCH each student's risk fields back into the DB.

    This is the single source of truth for risk data used by the dashboard.
    Returns a summary dict.
    """
    global _batch_status

    with _batch_lock:
        if _batch_status["status"] == "running":
            logger.info("[batch] Already running — skipping duplicate trigger.")
            return {"skipped": True, "reason": "already running"}

        _batch_status.update({
            "status":      "running",
            "triggered_by": triggered_by,
            "error":       None,
        })

    academic_url = os.getenv("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")
    import requests as req

    try:
        # 1. Fetch all students
        resp = req.get(f"{academic_url}/students/", timeout=30)
        resp.raise_for_status()
        students = resp.json()
    except Exception as e:
        err = f"Could not fetch student data: {e}"
        logger.error("[batch] %s", err)
        with _batch_lock:
            _batch_status.update({"status": "failed", "error": err})
        return {"error": err}

    if not students:
        with _batch_lock:
            _batch_status.update({
                "status":          "completed",
                "last_run_at":     datetime.now(timezone.utc).isoformat(),
                "students_total":  0,
                "students_updated": 0,
            })
        return {"students_total": 0, "students_updated": 0}

    try:
        model = _load_model(model_dir)
    except Exception as e:
        err = f"Model load failed: {e}"
        logger.error("[batch] %s", err)
        with _batch_lock:
            _batch_status.update({"status": "failed", "error": err})
        return {"error": err}

    updated = 0
    errors  = 0
    run_ts  = datetime.now(timezone.utc).isoformat()

    for s in students:
        sid = s.get("student_id") or s.get("id")
        try:
            features, missing_fields = _student_to_features(s)
            proba     = model.predict_proba([features])[0]
            fail_prob = float(proba[1])
            m_tier    = _model_tier(fail_prob)
            flags     = _compute_flags(s)
            final_risk = _merge_risk_level(m_tier, flags)
            low_conf   = _is_low_confidence(missing_fields, s)

            payload = {
                "ml_risk_score":      round(fail_prob, 4),
                "ml_risk_level":      final_risk,
                "ml_risk_flags":      json.dumps(flags),
                "ml_risk_computed_at": run_ts,
                "ml_low_confidence":  low_conf,
            }

            patch_resp = req.patch(
                f"{academic_url}/students/{sid}/risk",
                json=payload,
                timeout=10,
            )
            if patch_resp.status_code in (200, 204):
                updated += 1
            else:
                logger.warning(
                    "[batch] PATCH /students/%s/risk → HTTP %d: %s",
                    sid, patch_resp.status_code, patch_resp.text[:200],
                )
                errors += 1

        except Exception as exc:
            logger.warning("[batch] Error processing student %s: %s", sid, exc)
            errors += 1

    logger.info(
        "[batch] Completed: %d updated, %d errors (total=%d, triggered_by=%s)",
        updated, errors, len(students), triggered_by,
    )

    with _batch_lock:
        _batch_status.update({
            "status":           "completed",
            "last_run_at":      run_ts,
            "students_total":   len(students),
            "students_updated": updated,
            "students_errors":  errors,
        })

    return {
        "students_total":   len(students),
        "students_updated": updated,
        "students_errors":  errors,
        "run_at":           run_ts,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@predict_bp.get("/atrisk")
def at_risk_students():
    """
    GET /predict/atrisk?threshold=<float>&limit=<int>

    Returns at-risk students using PRE-COMPUTED risk data stored in the DB.
    This is instant — no ML inference happens here.

    Falls back to live computation only if no persisted data exists (e.g. first
    boot before the startup batch has completed).
    """
    threshold = float(request.args.get("threshold", TIER_MEDIUM))
    limit     = int(request.args.get("limit", 50))

    academic_url = os.getenv("ACADEMIC_DATA_SERVICE_URL", "http://academic-data-service:8002")
    import requests as req

    # ── Try DB-backed fast path ────────────────────────────────────────────────
    try:
        resp = req.get(
            f"{academic_url}/students/atrisk",
            params={"threshold": threshold, "limit": limit},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Attach batch status info
            data["batch_status"] = _batch_status.get("status")
            data["last_computed_at"] = _batch_status.get("last_run_at")
            return jsonify(data)
    except Exception as e:
        logger.warning("[predict] DB-backed atrisk failed (%s) — using live fallback.", e)

    # ── Live fallback (startup race condition only) ────────────────────────────
    logger.info("[predict] atrisk: live fallback (batch not yet run)")
    try:
        resp = req.get(f"{academic_url}/students/", timeout=10)
        resp.raise_for_status()
        students = resp.json()
    except Exception as e:
        return jsonify({"error": f"Could not fetch student data: {e}"}), 503

    if not students:
        return jsonify({"at_risk": [], "count": 0, "threshold": threshold,
                        "source": "live_fallback"})

    model   = _load_model(current_app.config["MODEL_DIR"])
    at_risk = []

    for s in students:
        try:
            features, missing_fields = _student_to_features(s)
            proba     = model.predict_proba([features])[0]
            fail_prob = float(proba[1])
            if fail_prob >= threshold:
                m_tier    = _model_tier(fail_prob)
                flags     = _compute_flags(s)
                final_risk = _merge_risk_level(m_tier, flags)
                at_risk.append({
                    **s,
                    "risk_score":  round(fail_prob, 4),
                    "risk_level":  final_risk,
                    "flags":       flags,
                })
        except Exception:
            pass

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    return jsonify({
        "at_risk":   at_risk[:limit],
        "count":     len(at_risk),
        "threshold": threshold,
        "source":    "live_fallback",
        "batch_status": _batch_status.get("status"),
    })


@predict_bp.post("/run-batch")
def trigger_batch():
    """
    POST /predict/run-batch

    Manually trigger a full batch prediction run.
    Results are persisted to the DB immediately.
    Returns status immediately; poll GET /predict/batch-status for progress.
    """
    if _batch_status.get("status") == "running":
        return jsonify({
            "message": "Batch run already in progress.",
            "status":  _batch_status,
        }), 202

    model_dir = current_app.config["MODEL_DIR"]

    def _run():
        run_batch_and_persist(model_dir, triggered_by="manual")

    t = threading.Thread(target=_run, daemon=True, name="manual-batch")
    t.start()

    return jsonify({
        "message": "Batch prediction run started in background.",
        "status":  "running",
    }), 202


@predict_bp.get("/batch-status")
def batch_status():
    """GET /predict/batch-status — returns the last batch run metadata."""
    return jsonify(_batch_status)


@predict_bp.post("/student")
def predict_student():
    """
    POST /predict/student
    On-demand single-student prediction (unchanged from previous version).
    """
    data = request.get_json(force=True) or {}
    if not data:
        return jsonify({"error": "Student data required"}), 400

    range_errors = _validate_ranges(data)
    if range_errors:
        return jsonify({"error": "Input validation failed", "details": range_errors}), 400

    features, missing_fields = _student_to_features(data)
    model = _load_model(current_app.config["MODEL_DIR"])

    proba     = model.predict_proba([features])[0]
    fail_prob = float(proba[1])
    pred      = "Fail" if fail_prob >= 0.5 else "Pass"

    m_tier     = _model_tier(fail_prob)
    flags      = _compute_flags(data)
    final_risk = _merge_risk_level(m_tier, flags)
    low_conf   = _is_low_confidence(missing_fields, data)
    explanation = _build_explanation(model, features)

    feature_importance = explanation.get("contributions", {})

    return jsonify({
        "student_id":        data.get("student_id"),
        "prediction":        pred,
        "risk_score":        round(fail_prob, 4),
        "model_tier":        m_tier,
        "risk_level":        final_risk,
        "flags":             flags,
        "low_confidence":    low_conf,
        "missing_fields":    missing_fields,
        "explanation":       explanation,
        "feature_importance": feature_importance,
        "input_features":    dict(zip(FEATURES, features)),
    })


@predict_bp.post("/batch")
def predict_batch():
    """
    POST /predict/batch
    Raw batch predictions — does NOT persist to DB.
    """
    data     = request.get_json(force=True) or {}
    students = data.get("students", [])
    if not students:
        return jsonify({"error": "students list required"}), 400

    model   = _load_model(current_app.config["MODEL_DIR"])
    results = []

    for s in students:
        try:
            range_errors = _validate_ranges(s)
            if range_errors:
                results.append({
                    "student_id":     s.get("student_id"),
                    "error":          f"Input validation failed: {'; '.join(range_errors)}",
                    "low_confidence": True,
                })
                continue

            features, missing_fields = _student_to_features(s)
            proba     = model.predict_proba([features])[0]
            fail_prob = float(proba[1])
            m_tier    = _model_tier(fail_prob)
            flags     = _compute_flags(s)
            final_risk = _merge_risk_level(m_tier, flags)
            low_conf   = _is_low_confidence(missing_fields, s)

            results.append({
                "student_id":    s.get("student_id"),
                "prediction":    "Fail" if fail_prob >= 0.5 else "Pass",
                "risk_score":    round(fail_prob, 4),
                "model_tier":    m_tier,
                "risk_level":    final_risk,
                "flags":         flags,
                "low_confidence": low_conf,
                "missing_fields": missing_fields,
            })
        except Exception as exc:
            logger.exception("[predict] Batch: error processing student %s", s.get("student_id"))
            results.append({
                "student_id":    s.get("student_id"),
                "error":         str(exc),
                "low_confidence": True,
            })

    return jsonify({"predictions": results, "count": len(results)})


@predict_bp.post("/train")
def retrain():
    """POST /predict/train — retrain model then re-run batch to refresh DB results."""
    try:
        from train import train_model
        _model_cache.clear()
        _, meta = train_model()

        # Re-run batch in background so DB results reflect new model
        model_dir = current_app.config["MODEL_DIR"]
        t = threading.Thread(
            target=run_batch_and_persist,
            args=(model_dir, "post_train"),
            daemon=True,
        )
        t.start()

        return jsonify({"status": "trained", "metadata": meta,
                        "batch": "started in background"})
    except Exception as e:
        logger.exception("[predict] Training failed")
        return jsonify({"error": str(e)}), 500


@predict_bp.get("/model/info")
def model_info():
    """GET /predict/model/info — model metadata including evaluation metrics."""
    model_dir = current_app.config["MODEL_DIR"]
    meta_path = Path(model_dir) / "model_meta.json"
    if meta_path.exists():
        with open(meta_path) as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Model metadata not found. Run /predict/train first."}), 404
