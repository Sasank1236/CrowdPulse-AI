"""
train_model.py
─────────────────────────────────────────────────────────────────────────────
Trains the Next-Day Crowd Prediction models with genuine model selection:
for each target (next-day average people, next-day peak people), several
candidate regressors are cross-validated and the best-performing one is
kept — rather than assuming one algorithm up front.

Candidates tried (whichever are installed):
    - XGBoost Regressor        (usually best for this kind of tabular data)
    - Random Forest Regressor
    - Gradient Boosting Regressor

If XGBoost isn't installed, it's simply skipped — the other candidates
still compete, so training never fails for lack of one library.

Also produces ml/backtest.csv: for every historical row in the dataset, the
FINAL chosen models predict what "next day" would have been, alongside what
actually happened. This is what powers the "Accuracy & Trends" view in the
AI Prediction dashboard page (predicted vs. actual, over time) — the same
kind of analytics-over-history the rest of the dashboard already provides
for live data.

Run:
    python train_model.py
"""

import os
import sys
import json

# Force UTF-8 stdout on Windows to support emoji/arrow print statements
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor

from dataset_generator import generate_dataset, DATASET_PATH

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")
BACKTEST_PATH = os.path.join(os.path.dirname(__file__), "backtest.csv")

FEATURE_COLS = [
    "camera_encoded",
    "day_of_week",
    "month",
    "weekend",
    "avg_people",
    "max_people",
    "min_people",
    "avg_capacity",
    "peak_hour",
    "total_records",
]


def get_candidates():
    """Every candidate regressor to compete for each target. XGBoost is
    included only if it's actually installed."""
    candidates = {
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=8, random_state=42
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=200, max_depth=3, learning_rate=0.05, random_state=42
        ),
    }
    try:
        from xgboost import XGBRegressor
        candidates["XGBoost"] = XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
        )
    except ImportError:
        print("⚠️  xgboost not installed — competing only RandomForest vs GradientBoosting")

    return candidates


def select_best_model(X_train, y_train, label):
    """Cross-validate every candidate on the TRAINING split only (test data
    stays untouched until final evaluation), pick the one with the lowest
    mean absolute error, then fit it on the full training split."""

    candidates = get_candidates()
    n_splits = min(5, max(2, len(X_train) // 3))  # graceful on small datasets
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)

    scores = {}
    for name, model in candidates.items():
        try:
            cv_mae = -cross_val_score(
                model, X_train, y_train, cv=kf, scoring="neg_mean_absolute_error"
            ).mean()
            scores[name] = cv_mae
            print(f"  [{label}] {name}: CV MAE = {cv_mae:.2f}")
        except Exception as e:
            print(f"  [{label}] {name}: skipped ({e})")

    if not scores:
        raise RuntimeError(f"No candidate model could be trained for {label}")

    best_name = min(scores, key=scores.get)
    best_model = candidates[best_name]
    best_model.fit(X_train, y_train)

    print(f"  -> [{label}] Selected: {best_name} (CV MAE = {scores[best_name]:.2f})")
    return best_model, best_name, scores


def evaluate(model, X_test, y_test, label):
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = mean_squared_error(y_test, preds) ** 0.5
    r2 = r2_score(y_test, preds)
    print(f"  [{label}] Test set -> MAE={mae:.2f}  RMSE={rmse:.2f}  R2={r2:.3f}")
    return {"MAE": round(mae, 3), "RMSE": round(rmse, 3), "R2": round(r2, 3)}


def build_peak_hour_lookup(df):
    """Most common historical peak_hour per (camera, day_of_week)."""
    lookup = {}
    for (camera, dow), hours in df.groupby(["camera", "day_of_week"])["peak_hour"]:
        lookup[f"{camera}_{dow}"] = int(hours.mode().iloc[0])
    return lookup


def build_location_map(df):
    """camera -> most common location, for display purposes only.
    Resilient to older dataset.csv files that don't have a location column."""
    mapping = {}
    if "location" not in df.columns:
        return mapping
    for camera, sub in df.groupby("camera"):
        locs = sub["location"].dropna()
        mapping[camera] = locs.mode().iloc[0] if not locs.empty else None
    return mapping


def generate_backtest(df, encoder, avg_model, peak_model):
    """Re-predict every historical row using the FINAL chosen models, so the
    frontend can chart predicted-vs-actual over time (like the rest of the
    dashboard's trend charts, but for prediction accuracy specifically)."""

    df = df.copy()
    df["camera_encoded"] = encoder.transform(df["camera"])
    X = df[FEATURE_COLS]

    df["predicted_next_day_avg_people"] = avg_model.predict(X).round(1)
    df["predicted_next_day_peak_people"] = peak_model.predict(X).round(1)

    df["avg_error"] = (df["predicted_next_day_avg_people"] - df["next_day_avg_people"]).round(1)
    df["peak_error"] = (df["predicted_next_day_peak_people"] - df["next_day_peak_people"]).round(1)

    out_cols = [
        "date", "camera",
        "next_day_avg_people", "predicted_next_day_avg_people", "avg_error",
        "next_day_peak_people", "predicted_next_day_peak_people", "peak_error",
    ]
    if "location" in df.columns:
        out_cols.insert(2, "location")
    df[out_cols].to_csv(BACKTEST_PATH, index=False)
    print(f"✅ Backtest saved to {BACKTEST_PATH} ({len(df)} rows)")


def train():
    if os.path.exists(DATASET_PATH):
        df = pd.read_csv(DATASET_PATH)
    else:
        df = generate_dataset()

    if df is None or df.empty:
        print("❌ No dataset available. Run dataset_generator.py once you "
              "have at least 2 days of historical data per camera.")
        return

    encoder = LabelEncoder()
    df["camera_encoded"] = encoder.fit_transform(df["camera"])

    X = df[FEATURE_COLS]
    y_avg = df["next_day_avg_people"]
    y_peak = df["next_day_peak_people"]

    X_train, X_test, y_avg_train, y_avg_test, y_peak_train, y_peak_test = (
        train_test_split(X, y_avg, y_peak, test_size=0.2, random_state=42)
    )

    print("Selecting best model for next-day AVERAGE people…")
    avg_model, avg_model_name, avg_cv_scores = select_best_model(
        X_train, y_avg_train, "avg_people"
    )

    print("Selecting best model for next-day PEAK people…")
    peak_model, peak_model_name, peak_cv_scores = select_best_model(
        X_train, y_peak_train, "peak_people"
    )

    print("Evaluating on held-out test set:")
    metrics = {
        "average_people_model": {
            "selected": avg_model_name,
            "cv_mae_by_candidate": {k: round(v, 3) for k, v in avg_cv_scores.items()},
            "test_metrics": evaluate(avg_model, X_test, y_avg_test, "avg_people"),
        },
        "peak_people_model": {
            "selected": peak_model_name,
            "cv_mae_by_candidate": {k: round(v, 3) for k, v in peak_cv_scores.items()},
            "test_metrics": evaluate(peak_model, X_test, y_peak_test, "peak_people"),
        },
        "dataset_rows": len(df),
        "trained_at": pd.Timestamp.now().isoformat(),
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    peak_hour_lookup = build_peak_hour_lookup(df)
    location_map = build_location_map(df)

    joblib.dump({
        "avg_model": avg_model,
        "peak_model": peak_model,
        "avg_model_name": avg_model_name,
        "peak_model_name": peak_model_name,
        "encoder": encoder,
        "feature_cols": FEATURE_COLS,
        "peak_hour_lookup": peak_hour_lookup,
        "location_map": location_map,
        "known_cameras": list(encoder.classes_),
    }, MODEL_PATH)

    generate_backtest(df, encoder, avg_model, peak_model)

    print(f"✅ Model saved to {MODEL_PATH}")
    print(f"✅ Metrics saved to {METRICS_PATH}")


if __name__ == "__main__":
    train()