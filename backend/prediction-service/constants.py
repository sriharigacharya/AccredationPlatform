"""
constants.py — Single source of truth for all prediction-service threshold values,
feature definitions, and flag rules.

Rules:
- All routes and the training script MUST import from this module.
- No bare numeric threshold literals for tiers, flags, or attendance/backlog
  cutoffs may appear anywhere else in this service.
"""

# ── Risk Tier Thresholds ───────────────────────────────────────────────────────
# Model-probability thresholds used to map calibrated P(Fail) → model_tier.
# These replace the previous inconsistent values (0.70 / 0.40 / 0.60).
TIER_HIGH:   float = 0.65
TIER_MEDIUM: float = 0.35

# ── Feature List (ordered — must match training order) ────────────────────────
FEATURES: list[str] = [
    "semester",
    "attendance_pct",
    "internal_marks",
    "assignment_score_pct",
    "previous_gpa",
    "backlogs",
    "course_performance_pct",
    "engagement_encoded",
]

# ── Engagement Encoding ────────────────────────────────────────────────────────
ENGAGEMENT_MAP: dict[str, int] = {
    "Low":    0,
    "Medium": 1,
    "High":   2,
}

# ── Population-Mean Defaults (for missing-field imputation) ───────────────────
# Derived from the synthetic training distribution (train.py / generate_synthetic_data).
# Used when a feature is absent from the input payload to avoid worst-case zeros.
FEATURE_DEFAULTS: dict[str, float] = {
    "semester":              1.0,
    "attendance_pct":       73.0,
    "internal_marks":       62.0,
    "assignment_score_pct": 70.0,
    "previous_gpa":          7.0,
    "backlogs":              0.0,
    "course_performance_pct": 67.0,
    "engagement_encoded":    1.0,   # "Medium"
}

# ── Input Validation Ranges ────────────────────────────────────────────────────
# (inclusive min, inclusive max).  Values outside these ranges return HTTP 400.
FEATURE_RANGES: dict[str, tuple[float, float]] = {
    "semester":               (1,   8),
    "attendance_pct":         (0, 100),
    "internal_marks":         (0, 100),
    "assignment_score_pct":   (0, 100),
    "previous_gpa":           (0,  10),
    "backlogs":               (0,  20),
    "course_performance_pct": (0, 100),
}

# ── Detention / Backlog Flag Thresholds ───────────────────────────────────────
# These express POLICY rules and are kept separate from the model probability.
DETENTION_ATTENDANCE_THRESHOLD: int = 75   # < 75 → DETENTION_RISK flag (medium)
DETENTION_SEVERE_THRESHOLD:     int = 65   # < 65 → DETENTION_RISK flag (high)
BACKLOG_SEVERE_THRESHOLD:       int = 3    # ≥ 3  → ACTIVE_BACKLOG flag (high)
                                           # ≥ 1  → ACTIVE_BACKLOG flag (medium)

# ── Low-Confidence Trigger ────────────────────────────────────────────────────
LOW_CONFIDENCE_MISSING_THRESHOLD: int = 3  # flag low_confidence if ≥ this many fields missing
