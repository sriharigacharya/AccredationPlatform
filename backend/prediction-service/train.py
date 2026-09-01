"""
Train script — generates and saves the Random Forest model.
Run this script once to produce models/rf_model.pkl.
Also called via POST /predict/train endpoint.
"""

import os
import json
import pickle
import numpy as np
from pathlib import Path

MODEL_DIR = Path(os.getenv("MODEL_DIR", "./models"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "semester",
    "attendance_pct",
    "internal_marks",
    "assignment_score_pct",
    "previous_gpa",
    "backlogs",
    "course_performance_pct",
    "engagement_encoded",
]

ENGAGEMENT_MAP = {"Low": 0, "Medium": 1, "High": 2}


def generate_synthetic_data(n=2000):
    """Generate realistic synthetic student records for training."""
    np.random.seed(42)
    X, y = [], []

    for _ in range(n):
        semester        = np.random.randint(1, 9)
        attendance      = np.random.normal(73, 12)
        internal        = np.random.normal(62, 14)
        assignment      = np.random.normal(70, 12)
        gpa             = np.random.normal(7.0, 1.0)
        backlogs        = max(0, int(np.random.exponential(0.8)))
        course_perf     = np.random.normal(67, 13)
        eng_encoded     = np.random.choice([0, 1, 2], p=[0.2, 0.5, 0.3])

        # Clip to realistic ranges
        attendance  = np.clip(attendance, 20, 100)
        internal    = np.clip(internal, 0, 100)
        assignment  = np.clip(assignment, 0, 100)
        gpa         = np.clip(gpa, 0, 10)
        course_perf = np.clip(course_perf, 0, 100)
        backlogs    = min(backlogs, 8)

        # Risk score (domain rules)
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


def train_model(X=None, y=None):
    """Train Random Forest (primary) + XGBoost (secondary) models."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score

    if X is None or y is None:
        print("[train] Generating synthetic training data…")
        X, y = generate_synthetic_data(2000)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # ── Random Forest ─────────────────────────────────────────
    rf_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
        )),
    ])
    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_acc   = accuracy_score(y_test, rf_preds)
    print(f"[train] RF Accuracy: {rf_acc:.3f}")
    print(classification_report(y_test, rf_preds, target_names=["Pass", "Fail"]))

    # Save RF model
    rf_path = MODEL_DIR / "rf_model.pkl"
    with open(rf_path, "wb") as f:
        pickle.dump(rf_pipeline, f)
    print(f"[train] RF model saved to {rf_path}")

    # ── XGBoost ───────────────────────────────────────────────
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
        xgb_acc   = accuracy_score(y_test, xgb_preds)
        print(f"[train] XGB Accuracy: {xgb_acc:.3f}")

        xgb_path = MODEL_DIR / "xgb_model.pkl"
        with open(xgb_path, "wb") as f:
            pickle.dump(xgb, f)
        print(f"[train] XGB model saved to {xgb_path}")
    except ImportError:
        print("[train] XGBoost not installed — skipping.")
        xgb_acc = None

    # Save metadata
    meta = {
        "features": FEATURES,
        "engagement_map": ENGAGEMENT_MAP,
        "rf_accuracy": rf_acc,
        "xgb_accuracy": xgb_acc,
        "training_samples": len(X),
    }
    with open(MODEL_DIR / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    return rf_pipeline, meta


if __name__ == "__main__":
    print("Training AcademiQ prediction models…")
    train_model()
    print("Done.")
