#!/usr/bin/env python3
"""Cross-platform runtime helpers shared by rough-cut scripts."""
from __future__ import annotations

import os
import platform
import shutil
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]


def media_binary(name: str) -> str:
    """Resolve ffmpeg/ffprobe from an explicit dir, Skill-local tools, or PATH."""
    executable = name + (".exe" if os.name == "nt" else "")
    candidates = []
    explicit = os.environ.get("ROUGH_CUT_FFMPEG_DIR")
    if explicit:
        candidates.append(Path(explicit).expanduser() / executable)
    candidates.extend([
        SKILL_ROOT / ".tools/ffmpeg/bin" / executable,
        SKILL_ROOT / "tools/ffmpeg/bin" / executable,
    ])
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return shutil.which(name) or name


FFMPEG = media_binary("ffmpeg")
FFPROBE = media_binary("ffprobe")


def encoder_attempts(requested: str = "auto"):
    """Return ordered (label, ffmpeg args) candidates with a software fallback."""
    specs = {
        "nvenc": (
            "NVIDIA NVENC",
            ["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "12M"],
        ),
        "videotoolbox": (
            "Apple VideoToolbox",
            ["-c:v", "h264_videotoolbox", "-b:v", "12M"],
        ),
        "x264": (
            "libx264",
            ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"],
        ),
    }
    if requested != "auto":
        return [specs[requested]]
    system = platform.system()
    order = ["videotoolbox"] if system == "Darwin" else ["nvenc"]
    order.append("x264")
    return [specs[name] for name in order]


def font_candidates():
    """Ordered Chinese font candidates across the packaged Skill and host OS."""
    windir = Path(os.environ.get("WINDIR", "C:/Windows"))
    return [
        SKILL_ROOT / "assets/fonts/SourceHanSerifSC-Heavy.otf",
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/System/Library/Fonts/STHeiti Medium.ttc"),
        windir / "Fonts/msyh.ttc",
        windir / "Fonts/simhei.ttf",
    ]
