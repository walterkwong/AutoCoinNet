from __future__ import annotations
import torch
from torch import nn
from backbones import pooled_forward

YEAR_MIN, YEAR_MAX = 1600.0, 2026.0

def denormalize_year(year: float) -> float:
    return year * (YEAR_MAX - YEAR_MIN) + YEAR_MIN


class MLPHead(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden_dim: int,
        out_dim: int,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, out_dim),
        )

    def forward(self, x):
        return self.net(x)


class MultiTaskCoinModel(nn.Module):
    def __init__(
        self,
        backbone: nn.Module,
        embed_dim: int,
        num_families: int,
        num_categories: int,
        num_varieties: int,
        num_face_values: int,
        hidden_dim: int = 512,
    ):
        super().__init__()

        self.backbone = backbone

        self.family_head = MLPHead(embed_dim, hidden_dim, num_families)
        self.category_head = MLPHead(embed_dim, hidden_dim, num_categories)
        self.variety_head = MLPHead(embed_dim, hidden_dim, num_varieties)
        self.face_value_head = MLPHead(embed_dim, hidden_dim, num_face_values)
        self.year_head = MLPHead(embed_dim, hidden_dim, 1)

    def forward(self, pixel_values: torch.Tensor) -> dict:
        embedding = pooled_forward(self.backbone, pixel_values)

        return {
            "family": self.family_head(embedding),
            "category": self.category_head(embedding),
            "variety": self.variety_head(embedding),
            "face_value": self.face_value_head(embedding),
            "year": self.year_head(embedding).squeeze(-1),
            "embedding": embedding,
        }