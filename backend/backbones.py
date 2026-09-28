from __future__ import annotations
import torch
from torch import nn
from transformers import AutoImageProcessor, AutoModel

def get_processor_stats(
    processor,
    default_size: int = 224,
) -> tuple[int, list[float], list[float]]:
    
    size = getattr(processor, "size", {}) or {}
    size = (
        size.get("shortest_edge")
        or size.get("height")
        or default_size
    )
    mean = getattr(processor, "image_mean", [0.485, 0.456, 0.406])  # ImageNet mean
    std = getattr(processor, "image_std", [0.229, 0.224, 0.225])    # ImageNet std

    return int(size), list(mean), list(std)

def build_dinov2(
    pretrained: str = "facebook/dinov2-base",
):
    model = AutoModel.from_pretrained(pretrained)
    processor = AutoImageProcessor.from_pretrained(pretrained)

    size, mean, std = get_processor_stats(processor)
    return model, model.config.hidden_size, size, mean, std


def build_convnext(
    pretrained: str = "facebook/convnextv2-tiny-22k-224",
):
    model = AutoModel.from_pretrained(pretrained)
    processor = AutoImageProcessor.from_pretrained(pretrained)
    size, mean, std = get_processor_stats(processor)

    return model, model.config.hidden_sizes[-1], size, mean, std


def pooled_forward(
    backbone: nn.Module,
    pixel_values: torch.Tensor,
) -> torch.Tensor:
    outputs = backbone(pixel_values=pixel_values)

    if outputs.pooler_output is not None:
        return outputs.pooler_output

    hidden = outputs.last_hidden_state

    if hidden.dim() == 3:
        return hidden[:, 0]  # CLS token for DINOv2

    if hidden.dim() == 4:
        return hidden.mean(dim=(2, 3))  # Global average pooling

    raise ValueError(f"Unexpected hidden state shape: {hidden.shape}")

def freeze(backbone: nn.Module) -> nn.Module:
    for param in backbone.parameters():
        param.requires_grad = False
    backbone.eval()
    return backbone

def build_backbone(
    name: str,
    adapt: str,
):
    builders = {
        "dinov2": build_dinov2,
        "convnext_tiny": build_convnext,
    }

    if name not in builders:
        raise ValueError(f"Unknown backbone: {name}")

    if adapt not in {"linear", "full"}:
        raise ValueError(f"Unsupported adaptation mode: {adapt}")
    backbone, embed_dim, size, mean, std = builders[name]()

    if adapt == "linear":
        backbone = freeze(backbone)

    return backbone, embed_dim, size, mean, std