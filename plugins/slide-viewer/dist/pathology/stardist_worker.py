"""One explicitly provisioned, CPU-only StarDist inference over a bounded local pipe.

No installer, model downloader, image path, URL, or source authority is accepted.
The parent withholds stdin until its durable worker-PID record is committed.
"""

from __future__ import annotations

import argparse
import base64
import contextlib
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TypeAlias

JsonValue: TypeAlias = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]
MAX_PIXELS = 512 * 512
MAX_INPUT_BYTES = 2 * 1024 * 1024
MAX_OBJECTS = 4096


@dataclass(frozen=True)
class Input:
    width: int
    height: int
    rgb: bytes
    probability_threshold: float
    nms_threshold: float
    percentile_low: float
    percentile_high: float


def record(value: JsonValue) -> dict[str, JsonValue]:
    if not isinstance(value, dict):
        raise ValueError("Expected a closed JSON object")
    return value


def text(value: JsonValue) -> str:
    if not isinstance(value, str):
        raise ValueError("Expected a bounded string")
    return value


def number(value: JsonValue) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Expected a finite number")
    return float(value)


def positive_integer(value: JsonValue, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > maximum:
        raise ValueError("Integer exceeds the worker bounds")
    return value


def read_input() -> Input:
    # Deliberately before any NumPy/TensorFlow/StarDist import or computation.
    data = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(data) > MAX_INPUT_BYTES:
        raise ValueError("Worker input exceeds the bounded local-pipe protocol")
    raw: JsonValue = json.loads(data)
    value = record(raw)
    if (
        set(value)
        != {
            "schemaVersion",
            "width",
            "height",
            "rgbBase64",
            "probabilityThreshold",
            "nmsThreshold",
            "percentileLow",
            "percentileHigh",
        }
        or value["schemaVersion"] != 1
    ):
        raise ValueError("Unexpected worker input schema")
    width = positive_integer(value["width"], 512)
    height = positive_integer(value["height"], 512)
    if width * height > MAX_PIXELS:
        raise ValueError("Worker raster exceeds 512 squared pixels")
    rgb = base64.b64decode(text(value["rgbBase64"]), validate=True)
    if len(rgb) != width * height * 3:
        raise ValueError("Worker requires exactly three RGB8 bytes per pixel")
    probability = number(value["probabilityThreshold"])
    nms = number(value["nmsThreshold"])
    low = number(value["percentileLow"])
    high = number(value["percentileHigh"])
    if not (0 < probability < 1 and 0 < nms < 1 and 0 <= low < high <= 100):
        raise ValueError("Worker thresholds or normalization percentiles are invalid")
    return Input(width, height, rgb, probability, nms, low, high)


def bounded_read(path: Path, limit: int) -> bytes:
    if not path.is_file() or path.stat().st_size > limit:
        raise ValueError("A pinned runtime asset is missing or exceeds its bound")
    with path.open("rb") as reader:
        data = reader.read(limit + 1)
    if len(data) > limit:
        raise ValueError("A pinned runtime asset changed size")
    return data


def verify_runtime(assets: Path) -> dict[str, str]:
    raw: JsonValue = json.loads(
        bounded_read(Path(__file__).with_name("model-registry.json"), 16_384)
    )
    registry = record(raw)
    if registry["id"] != "stardist-2d-versatile-he" or registry["release"] != "0.1":
        raise ValueError("The packaged model registry does not identify the supported model")
    versions = {"python": platform.python_version()}
    for package, expected in record(registry["runtime"]).items():
        actual = importlib.metadata.version(package)
        if actual != text(expected):
            raise ValueError(
                "Installed scientific packages differ from the declared qualified runtime"
            )
        versions[package] = actual
    model_dir = assets / "models" / "stardist-2d-versatile-he"
    for filename, key in (
        ("config.json", "configSha256"),
        ("thresholds.json", "thresholdsSha256"),
        ("weights_best.h5", "weightsSha256"),
    ):
        path = model_dir / filename
        if assets.resolve() not in path.resolve().parents:
            raise ValueError("Model assets must remain inside the explicitly provisioned cache")
        data = bounded_read(path, 32 * 1024 * 1024)
        if "sha256:" + hashlib.sha256(data).hexdigest() != text(registry[key]):
            raise ValueError("A model asset failed its pinned content digest")
    return versions


def infer(value: Input, assets: Path) -> dict[str, JsonValue]:
    versions = verify_runtime(assets)
    # Heavy imports happen only after the parent releases the durable PID gate.
    import numpy as np
    import tensorflow as tf
    from csbdeep.utils import normalize
    from stardist.models import StarDist2D

    tf.config.set_visible_devices([], "GPU")
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.config.threading.set_intra_op_parallelism_threads(1)
    if tf.config.get_visible_devices("GPU"):
        raise ValueError("The optional pathology worker must run on CPU only")
    image = np.frombuffer(value.rgb, dtype=np.uint8).reshape(value.height, value.width, 3)
    normalized = normalize(
        image, pmin=value.percentile_low, pmax=value.percentile_high, axis=(0, 1), clip=False
    )
    if not np.isfinite(normalized).all():
        raise ValueError("Image normalization produced non-finite values")
    model = StarDist2D(None, name="stardist-2d-versatile-he", basedir=str(assets / "models"))
    labels, details = model.predict_instances(
        normalized,
        axes="YXC",
        prob_thresh=value.probability_threshold,
        nms_thresh=value.nms_threshold,
        n_tiles=(1, 1, 1),
        show_tile_progress=False,
        verbose=False,
        predict_kwargs={"verbose": 0},
    )
    probabilities = np.asarray(details["prob"], dtype=np.float64)
    if (
        labels.shape != (value.height, value.width)
        or len(probabilities) > MAX_OBJECTS
        or np.any(labels < 0)
        or int(labels.max(initial=0)) > len(probabilities)
    ):
        raise ValueError("Model output exceeds the bounded instance protocol")
    if (
        not np.isfinite(probabilities).all()
        or np.any(probabilities < 0)
        or np.any(probabilities > 1)
    ):
        raise ValueError("Model output contains invalid object scores")
    # StarDist polygons_to_label assigns detail index+1 even after overlap ordering.
    present = np.unique(labels)
    instances: list[JsonValue] = [
        {"label": int(label), "probability": float(probabilities[int(label) - 1])}
        for label in present
        if label != 0
    ]
    label_bytes = np.asarray(labels, dtype="<u4").tobytes(order="C")
    runtime: dict[str, JsonValue] = dict(versions)
    runtime["device"] = "CPU"
    runtime["cpuThreads"] = "1"
    return {
        "schemaVersion": 1,
        "width": value.width,
        "height": value.height,
        "labelsLittleEndianBase64": base64.b64encode(label_bytes).decode("ascii"),
        "maskSha256": "sha256:" + hashlib.sha256(label_bytes).hexdigest(),
        "rasterSha256": "sha256:" + hashlib.sha256(value.rgb).hexdigest(),
        "instances": instances,
        "runtime": runtime,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-directory", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=120, choices=range(1, 181))
    args = parser.parse_args()
    if os.name == "posix":
        import resource

        # Kernel termination, not a Python handler deferred by a native call.
        # This wall deadline survives loss of the supervising Node process.
        signal.signal(signal.SIGALRM, signal.SIG_DFL)
        signal.alarm(args.timeout_seconds)
        resource.setrlimit(resource.RLIMIT_CPU, (args.timeout_seconds, args.timeout_seconds + 1))
    started = time.monotonic()
    try:
        value = read_input()
        with contextlib.redirect_stdout(sys.stderr):
            result = infer(value, args.assets_directory)
        runtime = record(result["runtime"])
        runtime["workerElapsedMs"] = str(round((time.monotonic() - started) * 1000, 3))
        if os.name == "posix":
            peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            runtime["peakResidentBytes"] = str(
                int(peak_rss if sys.platform == "darwin" else peak_rss * 1024)
            )
        sys.stdout.write(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    except Exception as error:
        # Never return image input, local paths, arbitrary library tracebacks, or secrets.
        sys.stdout.write(
            json.dumps(
                {
                    "error": {
                        "type": type(error).__name__,
                        "message": "The explicitly provisioned CPU worker failed validation or inference.",
                    }
                }
            )
            + "\n"
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
