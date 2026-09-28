from __future__ import annotations
from collections.abc import Sequence
import albumentations as A
import numpy as np
from albumentations.pytorch import ToTensorV2
from PIL import Image

def build_classifier_eval_transform(
    image_size: int,
    mean: Sequence[float],
    std: Sequence[float],
) -> A.Compose:
    return A.Compose([
        A.Resize(image_size, image_size),
        A.Normalize(mean=mean, std=std),
        ToTensorV2(),
    ])

def build_grading_eval_transform(
    image_size: int,
    mean: Sequence[float],
    std: Sequence[float],
) -> A.Compose:
    return A.Compose([
        A.LongestMaxSize(max_size=image_size),
        A.PadIfNeeded(
            min_height=image_size,
            min_width=image_size,
            border_mode=0,
            fill=(0, 0, 0),
        ),
        A.Normalize(mean=mean, std=std),
        ToTensorV2(),
    ])

class EvalTransform:
    def __init__(self, transform: A.Compose):
        self.transform = transform

    def __call__(self, image: Image.Image):
        image = np.array(image.convert("RGB"))
        return self.transform(image=image)["image"]