from __future__ import annotations
import io
import json
import os
import re
from pathlib import Path
import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO
from grading_model import (
    ADJECTIVAL_TIERS,
    STATE_LABELS,
    grade_to_state_id,
    grade_to_tier_id,
)
from inference import (
    CLASSIFIER_ADAPT,
    CLASSIFIER_BACKBONE,
    GRADER_ADAPT,
    GRADER_BACKBONE,
    GRADER_HEAD,
    combine_face_predictions,
    load_classifier,
    load_grader,
)

def get_weights_dir() -> Path:
    default = Path(__file__).resolve().parent / "WEIGHTS_DIR"
    if not default.exists():
        default = Path(__file__).resolve().parent

    path = Path(os.environ.get("WEIGHTS_DIR", default)).resolve()
    if not path.exists():
        raise FileNotFoundError(f"WEIGHTS_DIR does not exist: {path}")
    return path


WEIGHTS_DIR = get_weights_dir()
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="AutoCoinNet backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

class Labels:
    def __init__(self, path: Path):
        data = json.loads(path.read_text())
        if data.get("schemaVersion") != 2:
            raise ValueError(f"Unsupported labels schema in {path}")

        self.families = {
            int(k): v for k, v in data["families"].items()
        }
        self.categories = {
            int(k): v for k, v in data["categories"].items()
        }
        self.face_values = {
            int(k): v for k, v in data["faceValues"].items()
        }
        self.varieties = {
            int(k): v for k, v in data["varieties"].items()
        }

    @property
    def num_families(self):
        return len(self.families)

    @property
    def num_categories(self):
        return len(self.categories)

    @property
    def num_varieties(self):
        return max(self.varieties, default=-1) + 1

    @property
    def num_face_values(self):
        return len(self.face_values)

labels = Labels(WEIGHTS_DIR / "labels.json")

def build_hierarchy(labels: Labels) -> dict[str, np.ndarray]:
    category_family = {}
    variety_category = np.zeros(labels.num_varieties, dtype=np.int64)
    variety_family = np.zeros(labels.num_varieties, dtype=np.int64)

    for variety_id, meta in labels.varieties.items():
        family_id = meta["familyId"]
        category_id = meta["categoryId"]

        if 0 <= variety_id < labels.num_varieties:
            variety_category[variety_id] = category_id
            variety_family[variety_id] = family_id

        category_family.setdefault(category_id, family_id)

    category_family_ids = np.zeros(
        labels.num_categories,
        dtype=np.int64,
    )

    for category_id, family_id in category_family.items():
        if 0 <= category_id < labels.num_categories:
            category_family_ids[category_id] = family_id

    return{
        "category_family_id": category_family_ids,
        "variety_category_id": variety_category,
        "variety_family_id": variety_family,
    }

HIERARCHY = build_hierarchy(labels)

classifier = load_classifier(
    WEIGHTS_DIR,
    labels.num_families,
    labels.num_categories,
    labels.num_varieties,
    labels.num_face_values,
    DEVICE,
)

grader = load_grader(WEIGHTS_DIR, DEVICE)

GRADE_LEVELS = np.array(grader.grade_levels)
TIER_MAPPING = np.array(
    [grade_to_tier_id(g) for g in grader.grade_levels],
    dtype=np.int64,
)
STATE_MAPPING = np.array(
    [grade_to_state_id(g) for g in grader.grade_levels],
    dtype=np.int64,
)


# YOLO detector
yolo_path = WEIGHTS_DIR / "yolo" / "best.onnx"
yolo_model = (
    YOLO(str(yolo_path), task="segment")
    if yolo_path.exists()
    else None
)

# Auction transactions
def load_transactions(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text())

TRANSACTIONS = load_transactions(
    WEIGHTS_DIR / "transactions.json"
)

def normalize(value: str | None) -> str:
    if not value:
        return ""

    value = value.lower().replace("&amp;", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)

    return value.strip()

# Routes
@app.get("/")
async def root():
    return status()

@app.get("/health")
async def health():
    return status(include_weights=True)

def status(include_weights: bool = False) -> dict:
    result = {
        "status": "ok",
        "name": "AutoCoinNet backend",
        "stages": ["detect", "classify"],
        "numVarieties": labels.num_varieties,
        "detectorLoaded": yolo_model is not None,
        "classifier": f"{CLASSIFIER_BACKBONE}/{CLASSIFIER_ADAPT}",
        "grader": f"{GRADER_BACKBONE}/{GRADER_ADAPT}/{GRADER_HEAD}",
        "numGradeLevels": len(grader.grade_levels),
        "transactionsLoaded": len(TRANSACTIONS),
    }

    if include_weights:
        result["weightsDir"] = str(WEIGHTS_DIR)

    return result

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if yolo_model is None:
        raise HTTPException(
            status_code=503,
            detail="YOLO detector weights are not loaded",
        )

    image = np.frombuffer(await file.read(), np.uint8)
    image = cv2.imdecode(image, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file",
        )

    height, width = image.shape[:2]
    result = yolo_model(image)[0]

    detections = []

    if result.masks is None or result.boxes is None:
        return {"detections": detections}

    for box, mask in zip(result.boxes, result.masks):
        confidence = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()

        if len(mask.xyn):
            polygon = mask.xyn[0].tolist()
        else:
            polygon = [
                [x1 / width, y1 / height],
                [x2 / width, y1 / height],
                [x2 / width, y2 / height],
                [x1 / width, y2 / height],
            ]

        detections.append({
            "confidence": confidence,
            "bbox": {
                "x": x1 / width,
                "y": y1 / height,
                "w": (x2 - x1) / width,
                "h": (y2 - y1) / height,
            },
            "bboxPixels": {
                "x": x1,
                "y": y1,
                "w": x2 - x1,
                "h": y2 - y1,
            },
            "polygonNorm": polygon,
        })

    return {"detections": detections}


@app.get("/transactions")
async def get_transactions(
    family: str | None = Query(None),
    category: str | None = Query(None),
    name: str | None = Query(None),
):
    if name:
        name = normalize(name)
        return [
            r for r in TRANSACTIONS
            if normalize(r["name"]) == name
        ]

    category = normalize(category)
    family = normalize(family)

    if not category and not family:
        return []

    matches = [
        r for r in TRANSACTIONS
        if category and normalize(r["category"]) == category
    ]

    if not matches and family:
        matches = [
            r for r in TRANSACTIONS
            if normalize(r["big_family"]) == family
        ]

    if not matches:
        words = [
            word
            for word in (category or family).split()
            if len(word) > 2
        ]

        matches = [
            r for r in TRANSACTIONS
            if all(
                word in normalize(
                    f"{r['big_family']} {r['category']}"
                )
                for word in words
            )
        ]

    return matches


def named_predictions(
    probabilities: np.ndarray,
    names: dict[int, object],
    top_k: int,
) -> list[dict]:
    top_k = min(top_k, len(probabilities))
    indices = np.argsort(-probabilities)[:top_k]

    return [
        {
            "label": names.get(int(i), str(i)),
            "confidence": float(probabilities[i]),
        }
        for i in indices
    ]


def bayes_variety_predictions(
    probabilities: dict,
    top_k: int,
) -> list[dict]:
    family = probabilities["family"]
    category = probabilities["category"]
    variety = probabilities["variety"]

    category_family = HIERARCHY["category_family_id"]
    variety_category = HIERARCHY["variety_category_id"]
    variety_family = HIERARCHY["variety_family_id"]

    category_total = np.bincount(
        category_family,
        weights=category,
        minlength=labels.num_families,
    )

    p_category = category / np.maximum(
        category_total[category_family],
        1e-12,
    )

    variety_total = np.bincount(
        variety_category,
        weights=variety,
        minlength=labels.num_categories,
    )

    p_variety = variety / np.maximum(
        variety_total[variety_category],
        1e-12,
    )

    scores = (
        family[variety_family]
        * p_category[variety_category]
        * p_variety
    )

    scores /= max(scores.sum(), 1e-12)

    indices = np.argsort(-scores)[:top_k]
    predictions = []

    for i in indices:
        meta = labels.varieties.get(int(i))

        if meta is None:
            predictions.append({
                "varietyId": int(i),
                "label": f"variety#{i}",
                "confidence": float(scores[i]),
            })
            continue

        predictions.append({
            "varietyId": int(i),
            "label": meta["displayLabel"],
            "fullLabel": meta["fullLabel"],
            "family": meta["family"],
            "category": meta["category"],
            "faceValueCents": meta["faceValueCents"],
            "year": meta["year"],
            "confidence": float(scores[i]),
            "rawConfidence": float(variety[i]),
        })

    return predictions


def classify_result(
    probabilities: dict,
    top_k: int,
) -> dict:
    return{
        "familyPredictions": named_predictions(
            probabilities["family"],
            labels.families,
            top_k,
        ),
        "categoryPredictions": named_predictions(
            probabilities["category"],
            labels.categories,
            top_k,
        ),
        "varietyPredictions": bayes_variety_predictions(
            probabilities,
            top_k,
        ),
        "faceValuePredictions": named_predictions(
            probabilities["face_value"],
            labels.face_values,
            top_k,
        ),
        "yearEstimate": round(probabilities["year"]),
    }


def bayes_grade_result(
    probabilities: dict,
    top_k: int,
) -> dict:
    grade = probabilities["grade"]
    tier = probabilities["tier"][TIER_MAPPING]
    state = probabilities["state"][STATE_MAPPING]

    joint = np.exp(
        np.log(grade + 1e-8)
        + np.log(tier + 1e-8)
        + np.log(state + 1e-8)
    )

    joint /= joint.sum()

    raw_expected = float((grade * GRADE_LEVELS).sum())
    bayes_expected = float((joint * GRADE_LEVELS).sum())

    indices = np.argsort(-joint)[:top_k]

    return{
        "gradeEstimate": round(bayes_expected),
        "gradeEstimateRaw": round(raw_expected),
        "gradePredictions": [
            {
                "grade": float(GRADE_LEVELS[i]),
                "confidence": float(joint[i]),
            }
            for i in indices
        ],
        "gradeDistribution": [
            {
                "grade": float(g),
                "confidence": float(p),
            }
            for g, p in zip(GRADE_LEVELS, joint)
        ],
        "tier": ADJECTIVAL_TIERS[int(np.argmax(probabilities["tier"]))],
        "tierConfidence": float(
            probabilities["tier"].max()
        ),
        "state": STATE_LABELS[int(np.argmax(probabilities["state"]))],
        "stateConfidence": float(
            probabilities["state"].max()
        ),
    }


async def load_image(file: UploadFile) -> Image.Image:
    try:
        return Image.open(
            io.BytesIO(await file.read())
        ).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image file: {file.filename}",
        )


def predict_coin(
    images: list[Image.Image],
    include_grade: bool,
    top_k: int,
) -> dict:
    classifier_predictions = combine_face_predictions([
        classifier.predict(image)
        for image in images
    ])

    result = classify_result(
        classifier_predictions,
        top_k,
    )

    if include_grade:
        grader_predictions = combine_face_predictions([
            grader.predict(image)
            for image in images
        ])

        result.update(
            bayes_grade_result(
                grader_predictions,
                top_k,
            )
        )

    return result


@app.post("/classify")
async def classify(
    obverse: UploadFile = File(...),
    reverse: UploadFile | None = File(None),
    grade: bool = Query(True),
    top_k: int = Query(5, ge=1, le=25),
):
    images = [
        await load_image(file)
        for file in (obverse, reverse)
        if file is not None
    ]

    return predict_coin(images, grade, top_k)


@app.post("/classify_batch")
async def classify_batch(
    files: list[UploadFile] = File(...),
    grade: bool = Query(True),
    top_k: int = Query(5, ge=1, le=25),
):
    if not files:
        raise HTTPException(
            status_code=400,
            detail="No files provided",
        )

    return{
        "results": [
            predict_coin(
                [await load_image(file)],
                grade,
                top_k,
            )
            for file in files
        ]
    }