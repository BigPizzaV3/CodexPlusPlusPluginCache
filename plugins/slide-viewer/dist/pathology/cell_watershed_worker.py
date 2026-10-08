"""Bounded image-derived DNA-seeded cytoplasm watershed; no reference labels enter.

The caller explicitly identifies registered nuclear-DNA and cytoplasm channels.
This estimates fluorescence cell regions, not H&E or verified biological cells.
No installer or network is used.
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
from pathlib import Path
from typing import TypeAlias

JsonValue: TypeAlias = str | int | float | bool | None | list["JsonValue"] | dict[str, "JsonValue"]


def record(value: JsonValue) -> dict[str, JsonValue]:
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


def finite(value: JsonValue, low: float, high: float) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < low
        or value > high
    ):
        raise ValueError("Cell watershed parameter exceeds its finite bound")
    return float(value)


def integer(value: JsonValue, low: int, high: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < low or value > high:
        raise ValueError("Cell watershed integer exceeds its bound")
    return value


def encoded_channel(value: JsonValue, pixels: int) -> bytes:
    if not isinstance(value, str) or len(value) > 350_000:
        raise ValueError("Cell watershed channel exceeds its bounded encoding")
    data = base64.b64decode(value, validate=True)
    if len(data) != pixels:
        raise ValueError("Cell watershed requires one selected byte per raster pixel")
    return data


def execute(value: dict[str, JsonValue]) -> dict[str, JsonValue]:
    if (
        set(value)
        != {"schemaVersion", "width", "height", "nucleiBase64", "cytoplasmBase64", "parameters"}
        or value["schemaVersion"] != 1
    ):
        raise ValueError("Unexpected cell watershed input protocol")
    width, height = integer(value["width"], 1, 512), integer(value["height"], 1, 512)
    nucleus_bytes = encoded_channel(value["nucleiBase64"], width * height)
    cytoplasm_bytes = encoded_channel(value["cytoplasmBase64"], width * height)
    parameters = record(value["parameters"])
    if set(parameters) != {
        "nucleiSigmaPixels",
        "cytoplasmSigmaPixels",
        "nucleiThreshold",
        "cytoplasmThreshold",
        "minimumNucleusAreaPixels",
        "minimumCellAreaPixels",
        "minimumSeedDistancePixels",
        "foregroundClosingRadiusPixels",
    }:
        raise ValueError("Unexpected cell watershed parameters")
    nucleus_sigma = finite(parameters["nucleiSigmaPixels"], 0, 4)
    cytoplasm_sigma = finite(parameters["cytoplasmSigmaPixels"], 0, 4)
    minimum_nucleus = integer(parameters["minimumNucleusAreaPixels"], 1, 65_536)
    minimum_cell = integer(parameters["minimumCellAreaPixels"], 1, 65_536)
    seed_distance = integer(parameters["minimumSeedDistancePixels"], 1, 32)
    closing_radius = integer(parameters["foregroundClosingRadiusPixels"], 0, 4)
    registry_path = Path(__file__).with_name("cell-watershed-registry.json")
    if registry_path.stat().st_size > 16_384:
        raise ValueError("Cell watershed registry exceeds its bound")
    registry = record(json.loads(registry_path.read_bytes()))
    if (
        registry["id"] != "DNA-seeded-cytoplasm-gradient-watershed"
        or registry["methodVersion"] != "1"
    ):
        raise ValueError("Cell watershed registry is invalid")
    runtime: dict[str, JsonValue] = {
        "python": platform.python_version(),
        "device": "CPU",
        "cpuThreads": "1",
    }
    for package, expected in record(registry["runtime"]).items():
        actual = importlib.metadata.version(package)
        if actual != expected:
            raise ValueError("Cell watershed runtime differs from the explicitly qualified version")
        runtime[package] = actual
    import numpy as np
    from scipy import ndimage as ndi
    from skimage.feature import peak_local_max
    from skimage.filters import sobel, threshold_otsu
    from skimage.morphology import disk
    from skimage.segmentation import watershed

    nuclei = (
        np.frombuffer(nucleus_bytes, dtype=np.uint8).reshape(height, width).astype(np.float64) / 255
    )
    cytoplasm = (
        np.frombuffer(cytoplasm_bytes, dtype=np.uint8).reshape(height, width).astype(np.float64)
        / 255
    )
    nuclei = ndi.gaussian_filter(nuclei, sigma=nucleus_sigma, mode="reflect", truncate=4)
    cytoplasm = ndi.gaussian_filter(cytoplasm, sigma=cytoplasm_sigma, mode="reflect", truncate=4)
    nucleus_threshold = (
        float(threshold_otsu(nuclei))
        if parameters["nucleiThreshold"] == "otsu"
        else finite(parameters["nucleiThreshold"], 0, 1)
    )
    cytoplasm_threshold = (
        float(threshold_otsu(cytoplasm))
        if parameters["cytoplasmThreshold"] == "otsu"
        else finite(parameters["cytoplasmThreshold"], 0, 1)
    )
    components, _ = ndi.label(
        nuclei > nucleus_threshold, structure=ndi.generate_binary_structure(2, 2)
    )
    areas = np.bincount(components.ravel())
    keep = areas >= minimum_nucleus
    keep[0] = False
    nucleus_foreground = keep[components]
    distance = ndi.distance_transform_edt(nucleus_foreground)
    peaks = peak_local_max(
        distance,
        min_distance=seed_distance,
        labels=nucleus_foreground,
        exclude_border=False,
        num_peaks=4097,
    )
    if len(peaks) > 4096:
        raise ValueError("Cell watershed exceeds its bounded nucleus-seed count")
    seed_points = np.zeros((height, width), dtype=np.int32)
    for index, (row, column) in enumerate(peaks):
        seed_points[row, column] = index + 1
    # Both seed points and nuclear masks are derived from the actual DNA image.
    nucleus_labels = watershed(-distance, seed_points, mask=nucleus_foreground, connectivity=1)
    foreground = (cytoplasm > cytoplasm_threshold) | (nucleus_labels > 0)
    if closing_radius:
        foreground = ndi.binary_closing(foreground, structure=disk(closing_radius), border_value=0)
        foreground |= nucleus_labels > 0
    foreground = ndi.binary_fill_holes(foreground)
    # Boundaries follow the measured cytoplasm gradient, not nuclear dilation.
    labels = watershed(sobel(cytoplasm), nucleus_labels, mask=foreground, connectivity=1).astype(
        "<u4"
    )
    cell_areas = np.bincount(labels.ravel())
    keep_cells = cell_areas >= minimum_cell
    keep_cells[0] = False
    labels[~keep_cells[labels]] = 0
    present = np.unique(labels)
    label_bytes = labels.tobytes(order="C")
    return {
        "schemaVersion": 1,
        "width": width,
        "height": height,
        "labelsLittleEndianBase64": base64.b64encode(label_bytes).decode("ascii"),
        "maskSha256": "sha256:" + hashlib.sha256(label_bytes).hexdigest(),
        "nucleiChannelSha256": "sha256:" + hashlib.sha256(nucleus_bytes).hexdigest(),
        "cytoplasmChannelSha256": "sha256:" + hashlib.sha256(cytoplasm_bytes).hexdigest(),
        "instances": [
            {"label": int(label), "nucleusSeedLabel": int(label)} for label in present if label != 0
        ],
        "seedCount": len(peaks),
        "thresholdsUsed": {"nuclei": nucleus_threshold, "cytoplasm": cytoplasm_threshold},
        "runtime": runtime,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets-directory", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=60, choices=range(1, 181))
    args = parser.parse_args()
    if os.name == "posix":
        import resource

        # Independent OS wall termination also applies while blocked in native code.
        signal.signal(signal.SIGALRM, signal.SIG_DFL)
        signal.alarm(args.timeout_seconds)
        resource.setrlimit(resource.RLIMIT_CPU, (args.timeout_seconds, args.timeout_seconds + 1))
    started = time.monotonic()
    try:
        # Stdin is withheld until durable PID and source admission finishes.
        data = sys.stdin.buffer.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise ValueError("Cell watershed input exceeds one MiB")
        with contextlib.redirect_stdout(sys.stderr):
            result = execute(record(json.loads(data)))
        runtime = record(result["runtime"])
        runtime["workerElapsedMs"] = str(round((time.monotonic() - started) * 1000, 3))
        if os.name == "posix":
            peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            runtime["peakResidentBytes"] = str(
                int(peak_rss if sys.platform == "darwin" else peak_rss * 1024)
            )
        sys.stdout.write(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    except Exception as error:
        sys.stdout.write(
            json.dumps(
                {
                    "error": {
                        "type": type(error).__name__,
                        "message": "The explicitly provisioned cell watershed worker failed validation or inference.",
                    }
                }
            )
            + "\n"
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
