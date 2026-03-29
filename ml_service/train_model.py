"""
train_model.py — Train a Random Forest model for garbage intensity prediction.

Reads training_data.csv, trains RandomForestRegressor, evaluates accuracy,
and saves the model to model.pkl.
"""

import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATA_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(DATA_DIR, "training_data.csv")
MODEL_PATH = os.path.join(DATA_DIR, "model.pkl")
META_PATH = os.path.join(DATA_DIR, "model_meta.json")

# ─── Features used by the model ──────────────────────────────
FEATURES = [
    "latitude",
    "longitude",
    "hour",
    "day_of_week",
    "is_weekend",
    "population_density",
    "market_proximity",
]
TARGET = "intensity"


def train():
    """Load data, train model, evaluate, and save."""

    # 1. Load data
    if not os.path.exists(DATA_PATH):
        print("❌ training_data.csv not found. Run generate_data.py first.")
        return

    df = pd.read_csv(DATA_PATH)
    print(f"📂 Loaded {len(df)} samples from training_data.csv")

    X = df[FEATURES]
    y = df[TARGET]

    # 2. Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"   Train: {len(X_train)}  |  Test: {len(X_test)}")

    # 3. Train Random Forest
    print("\n🌲 Training Random Forest Regressor...")
    model = RandomForestRegressor(
        n_estimators=150,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # 4. Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print(f"\n📈 Model Performance:")
    print(f"   MAE:  {mae:.4f}")
    print(f"   RMSE: {rmse:.4f}")
    print(f"   R²:   {r2:.4f}")

    # 5. Feature importance
    importances = dict(zip(FEATURES, model.feature_importances_))
    print(f"\n🔍 Feature Importance:")
    for feat, imp in sorted(importances.items(), key=lambda x: -x[1]):
        bar = "█" * int(imp * 40)
        print(f"   {feat:25s} {imp:.3f}  {bar}")

    # 6. Save model
    joblib.dump(model, MODEL_PATH)
    print(f"\n💾 Model saved → {MODEL_PATH}")

    # 7. Save metadata
    import json
    meta = {
        "model_type": "RandomForestRegressor",
        "n_estimators": 150,
        "features": FEATURES,
        "metrics": {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
        },
        "feature_importance": {k: round(v, 4) for k, v in importances.items()},
        "training_samples": len(X_train),
        "test_samples": len(X_test),
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"📋 Metadata saved → {META_PATH}")


if __name__ == "__main__":
    train()
