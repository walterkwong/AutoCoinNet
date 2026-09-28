import os
import modal

# https://modal.com/docs

WEIGHTS_VOLUME_NAME = "autocoinnet-weights"
WEIGHTS_MOUNT_PATH = "/weights"

app = modal.App("AutoCoinNet-backend")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi[standard]",
        "torch",
        "torchvision",
        "transformers",
        "peft",
        "albumentations",
        "ultralytics",
        "onnx",
        "onnxruntime-gpu",
        "opencv-python-headless",
        "pillow",
        "numpy",
    )
    .add_local_python_source(
        "main",
        "inference",
        "backbones",
        "classifier_model",
        "grading_model",
        "transforms",
    )
)

weights_volume = modal.Volume.from_name(
    WEIGHTS_VOLUME_NAME,
    create_if_missing=True,
)

@app.function(
    image=image,
    gpu="T4",
    volumes={WEIGHTS_MOUNT_PATH: weights_volume},
    scaledown_window=300,
    timeout=120,
)
@modal.asgi_app()
def fastapi_app():
    os.environ["WEIGHTS_DIR"] = WEIGHTS_MOUNT_PATH
    from main import app

    return app