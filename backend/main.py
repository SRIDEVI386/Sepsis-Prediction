
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Session

from auth import Base, engine, get_db, get_current_user, User
from auth import router as auth_router
from report_upload import router as report_upload_router


# ==================================================
# CONFIGURATION
# ==================================================

VITALS = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp", "EtCO2"]

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
MODEL_DIR = PROJECT_DIR / "saved_models"

app = FastAPI(
    title="SepsisCare API",
    description="Vital-sign-based academic research prototype",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# DATABASE
# ==================================================

class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    model_name = Column(String, nullable=False)
    label = Column(String, nullable=False)
    score = Column(Float, nullable=True)
    score_type = Column(
        String,
        default="Estimated model risk score (%)",
    )
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


Base.metadata.create_all(bind=engine)


def history_to_dict(row):
    return {
        "id": row.id,
        "model_name": row.model_name,
        "label": row.label,
        "score": row.score,
        "score_type": row.score_type,
        "created_at": (
            row.created_at.isoformat()
            if row.created_at
            else None
        ),
    }


# ==================================================
# LOAD EXISTING MODELS
# ==================================================

def load_model(filename):
    path = MODEL_DIR / filename

    if not path.exists():
        print(f"[MODEL WARNING] File not found: {path}")
        return None

    try:
        loaded = joblib.load(path)
        print(f"[MODEL OK] Loaded: {filename}")
        return loaded
    except Exception as exc:
        print(f"[MODEL ERROR] {filename}: {exc}")
        return None


logistic_model = load_model("logistic_regression.joblib")
random_forest_model = load_model("random_forest.joblib")

model_config = {}

config_path = MODEL_DIR / "model_config.joblib"

if config_path.exists():
    try:
        model_config = joblib.load(config_path)
        print("[MODEL OK] Model configuration loaded")
    except Exception as exc:
        print(f"[MODEL WARNING] Could not read model config: {exc}")


# ==================================================
# INPUT SCHEMA
# ==================================================

class VitalReading(BaseModel):
    HR: float | None = Field(default=None, gt=0, le=300)
    O2Sat: float | None = Field(default=None, gt=0, le=100)
    Temp: float | None = Field(default=None, gt=25, le=45)
    SBP: float | None = Field(default=None, gt=0, le=350)
    MAP: float | None = Field(default=None, gt=0, le=250)
    DBP: float | None = Field(default=None, gt=0, le=250)
    Resp: float | None = Field(default=None, gt=0, le=100)
    EtCO2: float | None = Field(default=None, gt=0, le=150)


class PredictionRequest(BaseModel):
    readings: list[VitalReading] = Field(min_length=1, max_length=1)


# ==================================================
# FEATURE PREPARATION
# Supports eight raw vital signs or models with the
# earlier *_mean, *_std, *_change, *_slope features.
# ==================================================

def make_feature_frame(reading, model):
    if hasattr(reading, "model_dump"):
        reading = reading.model_dump()
    else:
        reading = dict(reading)

    clean = {}

    for vital in VITALS:
        value = reading.get(vital)

        if value is None:
            clean[vital] = np.nan
            continue

        try:
            value = float(value)
            clean[vital] = value if np.isfinite(value) else np.nan
        except (TypeError, ValueError):
            clean[vital] = np.nan

    if all(pd.isna(value) for value in clean.values()):
        raise HTTPException(
            status_code=422,
            detail="No valid vital-sign values were detected. Review the report first.",
        )

    feature_names = getattr(model, "feature_names_in_", None)

    if feature_names is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "This model does not expose its training feature names. "
                "Check the saved model and training configuration."
            ),
        )

    result = {}

    for name in list(feature_names):
        if name in clean:
            result[name] = clean[name]
            continue

        # Compatibility with the previous 6-observation feature format.
        # A single observation cannot establish variation or a time trend.
        if "_" in name:
            vital, suffix = name.rsplit("_", 1)

            if vital in clean and suffix == "mean":
                result[name] = clean[vital]
            elif vital in clean and suffix in {"std", "change", "slope"}:
                result[name] = np.nan
            else:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Model feature '{name}' is not supported by this "
                        "single-observation endpoint. Retrain the model "
                        "using the single-observation training setup."
                    ),
                )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Unsupported model feature: {name}",
            )

    return pd.DataFrame([result], columns=list(feature_names))


# ==================================================
# ONE MODEL'S PROBABILITY
# ==================================================

def get_model_probability(model, reading, model_name):
    if model is None:
        return None

    try:
        features = make_feature_frame(reading, model)

        if not hasattr(model, "predict_proba"):
            print(f"[MODEL WARNING] {model_name} has no predict_proba")
            return None

        probabilities = model.predict_proba(features)[0]
        classes = list(model.classes_)

        if 1 not in classes:
            print(f"[MODEL WARNING] {model_name} has no positive class")
            return None

        probability = float(probabilities[classes.index(1)])

        if not np.isfinite(probability):
            return None

        return float(np.clip(probability, 0.0, 1.0))

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[PREDICTION ERROR] {model_name}: {exc}")
        return None


# ==================================================
# HISTORY AND DASHBOARD
# ==================================================

@app.get("/")
def home():
    return {
        "message": "SepsisCare API is running",
        "docs": "/docs",
        "logistic_model_loaded": logistic_model is not None,
        "random_forest_loaded": random_forest_model is not None,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/history")
def get_prediction_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(PredictionHistory)
        .filter(PredictionHistory.user_id == current_user.id)
        .order_by(PredictionHistory.created_at.desc())
        .all()
    )

    return [history_to_dict(row) for row in rows]


@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PredictionHistory).filter(
        PredictionHistory.user_id == current_user.id
    )

    return {
        "total_predictions": query.count(),
        "recent": [
            history_to_dict(row)
            for row in query.order_by(
                PredictionHistory.created_at.desc()
            ).limit(5).all()
        ],
    }


# ==================================================
# PREDICT: ONE COMBINED RESULT
# ==================================================

@app.post("/api/predict")
def predict(
    request: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reading = request.readings[0]

    if hasattr(reading, "model_dump"):
        reading_dict = reading.model_dump()
    else:
        reading_dict = dict(reading)

    available_probabilities = []

    # Use whichever compatible trained models are available.
    for model, name in [
        (logistic_model, "Logistic Regression"),
        (random_forest_model, "Random Forest"),
    ]:
        if model is None:
            continue

        probability = get_model_probability(
            model,
            reading_dict,
            name,
        )

        if probability is not None:
            available_probabilities.append(probability)

    if not available_probabilities:
        raise HTTPException(
            status_code=503,
            detail=(
                "No usable trained model could produce a probability. "
                "Check the backend terminal and saved_models folder. "
                "The app will not generate a fake prediction."
            ),
        )

    # One combined score, even when both models are available.
    combined_probability = float(np.mean(available_probabilities))
    score_percent = round(combined_probability * 100, 2)

    # Research prototype threshold only; not a clinical threshold.
    threshold = 0.5
    prediction_label = (
        "YES" if combined_probability >= threshold else "NO"
    )

    history_row = PredictionHistory(
        user_id=current_user.id,
        model_name=(
            "Combined model"
            if len(available_probabilities) > 1
            else "Available trained model"
        ),
        label=prediction_label,
        score=score_percent,
        score_type="Estimated model risk score (%)",
    )

    try:
        db.add(history_row)
        db.commit()
        db.refresh(history_row)
    except Exception as exc:
        db.rollback()
        print(f"[DATABASE ERROR] {exc}")
        raise HTTPException(
            status_code=500,
            detail="Prediction completed, but saving history failed.",
        )

    return {
        "prediction": prediction_label,
        "risk_score": score_percent,
        "score_percent": score_percent,
        "models_used": len(available_probabilities),
        "notice": (
            "Educational research prototype only. The score is a model "
            "estimate, not a validated clinical risk or severity measure. "
            "Do not use it to diagnose or make treatment decisions."
        ),
        "history": history_to_dict(history_row),
    }


# ==================================================
# ROUTERS
# ==================================================

app.include_router(report_upload_router)
app.include_router(auth_router)
