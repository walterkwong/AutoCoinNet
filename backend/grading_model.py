from __future__ import annotations
import torch
from torch import nn
from backbones import pooled_forward

ADJECTIVAL_TIERS = [
    "PO_FR_AG",
    "G",
    "VG",
    "F",
    "VF",
    "EF",
    "AU",
    "MS_LOW",
    "MS_MID",
    "MS_GEM",
]

STATE_LABELS = ["Circulated", "Mint State"]

def grade_to_tier_id(grade: float) -> int:
    if grade < 4:
        return 0
    if grade < 8:
        return 1
    if grade < 12:
        return 2
    if grade < 20:
        return 3
    if grade < 40:
        return 4
    if grade < 50:
        return 5
    if grade < 60:
        return 6
    if grade < 63:
        return 7
    if grade < 65:
        return 8
    return 9

def grade_to_state_id(grade: float) -> int:
    return int(grade >= 60)

class GaussianRegressionHead(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden_dim: int,
        grade_levels: list[float],
        max_grade: float = 70.0,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.grade_levels = sorted(float(g) for g in grade_levels)
        self.max_grade = max_grade

        self.trunk = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.mu = nn.Linear(hidden_dim, 1)
        self.logvar = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        x = self.trunk(x)
        mu = torch.sigmoid(self.mu(x).squeeze(-1)) * self.max_grade
        logvar = self.logvar(x).squeeze(-1).clamp(-4, 4)

        return {"mu": mu, "logvar": logvar}

    def get_discrete_probabilities(
        self,
        output: dict[str, torch.Tensor],
    ) -> torch.Tensor:
        mu = output["mu"].unsqueeze(1)
        std = torch.exp(0.5 * output["logvar"]).unsqueeze(1)

        grades = torch.tensor(
            self.grade_levels,
            device=mu.device,
        ).unsqueeze(0)

        probs = torch.exp(-0.5 * ((grades - mu) / (std + 1e-6)) ** 2)
        probs = probs / (std + 1e-6)    # prevent /0

        return (
            probs / probs.sum(dim=1, keepdim=True).clamp_min(1e-8)
        ).clamp_min(1e-8)   # clamp to avoid NaN in loss computation

class DeepGrader(nn.Module):
    def __init__(
        self,
        backbone: nn.Module,
        embed_dim: int,
        hidden_dim: int = 512,
        grade_levels: list[float] | None = None,
        max_grade: float = 70.0,
        dropout: float = 0.1,
    ):
        super().__init__()

        self.backbone = backbone
        self.trunk = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        self.grade_head = GaussianRegressionHead(
            hidden_dim,
            hidden_dim,
            grade_levels,
            max_grade,
            dropout,
        )

        self.tier_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 10),
        )

        self.state_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 2),
        )

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        embedding = pooled_forward(self.backbone, x)
        embedding = self.trunk(embedding)
        output = self.grade_head(embedding)
        output["tier_logits"] = self.tier_head(embedding)
        output["state_logits"] = self.state_head(embedding)

        return output