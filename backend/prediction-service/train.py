"""
train.py — Train and persist the AcademiQ risk-prediction model.

Fixes applied (Prompt 5):
  - StandardScaler removed (RF is scale-invariant).
  - RandomForestClassifier wrapped in CalibratedClassifierCV (isotonic, cv=5)
    so output probabilities are meaningful against shared thresholds.
  - Richer evaluation: classification_report, confusion matrix, PR-AUC,
    and 5-fold stratified cross-validated PR-AUC (mean ± std).
  - Model persisted via joblib (not pickle), bundled with: sklearn version,
    FEATURES list (ordered), trained_on label.
  - On load, persisted FEATURES list is checked against constants.py — mismatch
    raises a hard error.
  - Synthetic label-generation equation intentionally left unchanged pending
    Srihari's decision on semester / assignment_score_pct (see deviation report).

Run directly:
    python train.py

Or call via POST /predict/train endpoint.
"""

import os
import json
import numpy as np
from pathlib import Path

import sklearn
import joblib

# ── Constants (single source of truth) ────────────────────────────────────────
from constants import FEATURES, ENGAGEMENT_MAP

MODEL_DIR = Path(os.getenv("MODEL_DIR", "./models"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)


# ── Synthetic Data Generator ───────────────────────────────────────────────────
def generate_synthetic_data(n: int = 2000):
    """
    Generate realistic synthetic student records for training.

    NOTE (Prompt 5, item 5): The risk equation below (attendance < 60, internal < 40,
    backlogs ≥ 3, etc.) is intentionally left unchanged pending Srihari's decision
    on whether `semester` and `assignment_score_pct` should be added to the label
    logic or dropped from the feature set.  They currently have zero true effect
    on the label and are pure noise features.

    *** OPEN ITEM — do not resolve without Srihari's sign-off ***
    """
    np.random.seed(42)
    X, y = [], []

    for _ in range(n):
        semester    = np.random.randint(1, 9)
        attendance  = np.random.normal(73, 12)
        internal    = np.random.normal(62, 14)
        assignment  = np.random.normal(70, 12)
        gpa         = np.random.normal(7.0, 1.0)
        backlogs    = max(0, int(np.random.exponential(0.8)))
        course_perf = np.random.normal(67, 13)
        eng_encoded = np.random.choice([0, 1, 2], p=[0.2, 0.5, 0.3])

        # Clip to realistic ranges
        attendance  = np.clip(attendance,  20, 100)
        internal    = np.clip(internal,     0, 100)
        assignment  = np.clip(assignment,   0, 100)
        gpa         = np.clip(gpa,          0,  10)
        course_perf = np.clip(course_perf,  0, 100)
        backlogs    = min(backlogs, 8)

        # Risk score (domain rules) — UNCHANGED pending Prompt-5/item-5 decision
        risk = 0.0
        if attendance < 60:   risk += 3.0
        elif attendance < 75: risk += 1.5
        if internal < 40:     risk += 3.0
        elif internal < 50:   risk += 1.5
        if backlogs >= 3:     risk += 2.5
        elif backlogs >= 1:   risk += 1.0
        if gpa < 5.5:         risk += 2.0
        elif gpa < 6.5:       risk += 0.5
        if course_perf < 50:  risk += 1.5
        if eng_encoded == 0:  risk += 0.5
        if eng_encoded == 2:  risk -= 0.5

        # Add noise
        risk += np.random.normal(0, 0.5)
        label = "Fail" if risk >= 4.0 else "Pass"

        X.append([semester, attendance, internal, assignment, gpa, backlogs, course_perf, eng_encoded])
        y.append(1 if label == "Fail" else 0)

    return np.array(X), np.array(y)


# ── Training ───────────────────────────────────────────────────────────────────
def train_model(X=None, y=None):
    """
    Train a calibrated Random Forest classifier.

    Returns (pipeline, metadata_dict).
    """
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
    from sklearn.metrics import (
        classification_report,
        confusion_matrix,
        average_precision_score,
    )
    from sklearn.pipeline import Pipeline

    if X is None or y is None:
        print("[train] Generating synthetic training data…")
        X, y = generate_synthetic_data(2000)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Pipeline: NO StandardScaler (RF is scale-invariant) ───────────────────
    # Wrapped in CalibratedClassifierCV so P(Fail) is a true probability usable
    # directly against TIER_HIGH / TIER_MEDIUM thresholds from constants.py.
    base_rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
    )
    calibrated_rf = CalibratedClassifierCV(base_rf, method="isotonic", cv=5)

    rf_pipeline = Pipeline([
        ("clf", calibrated_rf),
    ])

    print("[train] Fitting calibrated Random Forest…")
    rf_pipeline.fit(X_train, y_train)

    # ── Evaluation ────────────────────────────────────────────────────────────
    rf_proba = rf_pipeline.predict_proba(X_test)[:, 1]
    rf_preds = (rf_proba >= 0.5).astype(int)

    print("\n[train] Classification Report:")
    report_str = classification_report(y_test, rf_preds, target_names=["Pass", "Fail"])
    print(report_str)

    cm = confusion_matrix(y_test, rf_preds)
    print(f"[train] Confusion Matrix:\n{cm}")

    pr_auc = average_precision_score(y_test, rf_proba)
    print(f"[train] PR-AUC (test split): {pr_auc:.4f}")

    # 5-fold stratified cross-validated PR-AUC
    # Note: cross_validate re-fits base estimator on folds; calibration applied via cv=5 in
    # CalibratedClassifierCV which uses 5 folds of the training split internally.
    # For CV PR-AUC we evaluate the already-fitted pipeline on X_train folds.
    base_rf_cv = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
    )
    cv_results = cross_validate(
        base_rf_cv, X_train, y_train,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        scoring="average_precision",
        return_train_score=False,
        n_jobs=-1,
    )
    cv_pr_auc_mean = float(np.mean(cv_results["test_score"]))
    cv_pr_auc_std  = float(np.std(cv_results["test_score"]))
    print(f"[train] 5-Fold CV PR-AUC: {cv_pr_auc_mean:.4f} ± {cv_pr_auc_std:.4f}")

    # Legacy accuracy (kept for backward compat display)
    from sklearn.metrics import accuracy_score
    rf_acc = accuracy_score(y_test, rf_preds)
    print(f"[train] RF Accuracy (test split): {rf_acc:.4f}")

    # ── Save Model (joblib) ───────────────────────────────────────────────────
    rf_path = MODEL_DIR / "rf_model.joblib"
    joblib.dump(rf_pipeline, rf_path)
    print(f"[train] Calibrated RF model saved to {rf_path}")

    # ── XGBoost (optional secondary benchmark) ────────────────────────────────
    xgb_acc = None
    try:
        from xgboost import XGBClassifier
        xgb = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
        )
        xgb.fit(X_train, y_train)
        xgb_preds = xgb.predict(X_test)
        xgb_acc   = float(accuracy_score(y_test, xgb_preds))
        print(f"[train] XGB Accuracy: {xgb_acc:.4f}")

        xgb_path = MODEL_DIR / "xgb_model.joblib"
        joblib.dump(xgb, xgb_path)
        print(f"[train] XGB model saved to {xgb_path}")
    except ImportError:
        print("[train] XGBoost not installed — skipping.")

    # ── Metadata ──────────────────────────────────────────────────────────────
    # Bundled with: sklearn version, FEATURES list (ordered), trained_on label.
    # On load, predict.py checks persisted features against constants.FEATURES
    # and raises a hard error on mismatch.
    meta = {
        "features":            FEATURES,           # CRITICAL: must match constants.py
        "engagement_map":      ENGAGEMENT_MAP,
        "sklearn_version":     sklearn.__version__,
        "trained_on":          "synthetic_v2",
        "training_samples":    len(X),
        "rf_accuracy":         float(rf_acc),
        "xgb_accuracy":        xgb_acc,
        "pr_auc_test":         float(pr_auc),
        "cv_pr_auc_mean":      cv_pr_auc_mean,
        "cv_pr_auc_std":       cv_pr_auc_std,
        "confusion_matrix":    cm.tolist(),
        "classification_report": report_str,
        "calibration_method":  "isotonic (CalibratedClassifierCV, cv=5)",
        "open_items": [
            "PROMPT5_ITEM5: semester and assignment_score_pct have zero true effect "
            "on the synthetic label. Decision deferred to Srihari: add to label "
            "logic, or drop from feature set. Do not resolve without sign-off."
        ],
    }

    with open(MODEL_DIR / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"[train] Metadata saved to {MODEL_DIR / 'model_meta.json'}")
    return rf_pipeline, meta


if __name__ == "__main__":
    print("Training AcademiQ prediction models…")
    _, meta = train_model()
    print(f"\nDone.\n  PR-AUC (test): {meta['pr_auc_test']:.4f}")
    print(f"  5-Fold CV PR-AUC: {meta['cv_pr_auc_mean']:.4f} ± {meta['cv_pr_auc_std']:.4f}")
