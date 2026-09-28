from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import torch
from peft import PeftModel
from PIL import Image
from backbones import build_backbone
from classifier_model import MultiTaskCoinModel, denormalize_year
from grading_model import DeepGrader
from transforms import (
    EvalTransform,
    build_classifier_eval_transform,
    build_grading_eval_transform,
)

CLASSIFIER_BACKBONE = "convnext_tiny"
CLASSIFIER_ADAPT = "full"

GRADER_BACKBONE = "dinov2"
GRADER_ADAPT = "lora"
GRADER_HEAD = "gaussian"
GRADER_MAX_GRADE = 70.0

@dataclass
class LoadedClassifier:
    model: MultiTaskCoinModel
    transform: EvalTransform
    device: torch.device

    @torch.no_grad()
    def predict(self, image: Image.Image) -> dict:
        image = self.transform(image).unsqueeze(0).to(self.device)
        output = self.model(image)

        return {
            "family": torch.softmax(output["family"][0], dim=-1).cpu().numpy(),
            "category": torch.softmax(output["category"][0], dim=-1).cpu().numpy(),
            "variety": torch.softmax(output["variety"][0], dim=-1).cpu().numpy(),
            "face_value": torch.softmax(
                output["face_value"][0], dim=-1
            ).cpu().numpy(),
            "year": denormalize_year(float(output["year"][0])),
        }

@dataclass
class LoadedGrader:
    model: DeepGrader
    transform: EvalTransform
    device: torch.device
    grade_levels: list[float]

    @torch.no_grad()
    def predict(self, image: Image.Image) -> dict:
        image = self.transform(image).unsqueeze(0).to(self.device)
        output = self.model(image)
        grade_probs = self.model.grade_head.get_discrete_probabilities(output)

        return {
            "state": torch.softmax(
                output["state_logits"][0], dim=-1
            ).cpu().numpy(),
            "tier": torch.softmax(
                output["tier_logits"][0], dim=-1
            ).cpu().numpy(),
            "grade": grade_probs[0].cpu().numpy(),
        }


def load_grade_levels(path: Path) -> list[float]:
    levels = json.loads(path.read_text())
    return sorted(float(level) for level in levels)


def load_classifier(
    weights_dir: Path,
    num_families: int,
    num_categories: int,
    num_varieties: int,
    num_face_values: int,
    device: torch.device,
) -> LoadedClassifier:

    backbone, embed_dim, image_size, mean, std = build_backbone(
        CLASSIFIER_BACKBONE,
        CLASSIFIER_ADAPT,
    )

    weights = torch.load(
        weights_dir / "models" / "classifier_backbone.pt",
        map_location="cpu",
    )
    backbone.load_state_dict(weights)

    model = MultiTaskCoinModel(
        backbone=backbone,
        embed_dim=embed_dim,
        num_families=num_families,
        num_categories=num_categories,
        num_varieties=num_varieties,
        num_face_values=num_face_values,
    )

    model.load_state_dict(
        torch.load(
            weights_dir / "models" / "classifier_heads.pt",
            map_location="cpu",
        ),
        strict=False,
    )

    model.to(device).eval()

    transform = EvalTransform(
        build_classifier_eval_transform(
            image_size,
            mean,
            std,
        )
    )
    return LoadedClassifier(model, transform, device)


def load_grader(
    weights_dir: Path,
    device: torch.device,
) -> LoadedGrader:

    grade_levels = load_grade_levels(
        weights_dir / "grade_levels.json"
    )

    backbone, embed_dim, image_size, mean, std = build_backbone(
        GRADER_BACKBONE,
        "linear",
    )

    backbone = PeftModel.from_pretrained(
        backbone,
        str(weights_dir / "models" / "grader_lora"),
    )

    model = DeepGrader(
        backbone=backbone,
        embed_dim=embed_dim,
        hidden_dim=512,
        grade_levels=grade_levels,
        max_grade=GRADER_MAX_GRADE,
    )

    model.load_state_dict(
        torch.load(
            weights_dir / "models" / "grader_heads.pt",
            map_location="cpu",
        ),
        strict=False,
    )

    model.to(device).eval()

    transform = EvalTransform(
        build_grading_eval_transform(
            image_size,
            mean,
            std,
        )
    )

    return LoadedGrader(
        model=model,
        transform=transform,
        device=device,
        grade_levels=grade_levels,
    )


def combine_face_predictions(predictions: list[dict]) -> dict:
    if len(predictions) == 1:
        return predictions[0]

    result = {}

    for key in predictions[0]:
        values = [prediction[key] for prediction in predictions]

        if isinstance(values[0], np.ndarray):
            result[key] = np.mean(values, axis=0)
        else:
            result[key] = float(np.mean(values))

    return result