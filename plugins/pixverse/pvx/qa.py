from __future__ import annotations

import json
import mimetypes
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .shell import CommandResult, run, run_json, which
from .state import utc_now


def inspect_media(
    target: str,
    output_dir: Path | None = None,
    expect_audio: bool | None = None,
    expect_duration: float | None = None,
    duration_tolerance: float = 0.75,
    expect_aspect_ratio: str = "",
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "target": target,
        "checked_at": utc_now(),
        "exists": False,
        "kind": "",
        "issues": [],
        "metadata": {},
    }
    if target.startswith(("http://", "https://")):
        report.update(_inspect_url(target))
    else:
        report.update(_inspect_file(Path(target).expanduser()))
    _add_expectation_findings(
        report,
        expect_audio=expect_audio,
        expect_duration=expect_duration,
        duration_tolerance=duration_tolerance,
        expect_aspect_ratio=expect_aspect_ratio,
    )

    if output_dir is not None:
        output_dir.mkdir(parents=True, exist_ok=True)
        report_path = output_dir / f"{_target_slug(target)}-qa.json"
        latest_path = output_dir / "qa-report.json"
        report["report_path"] = str(report_path)
        report["latest_report_path"] = str(latest_path)
        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        report_path.write_text(rendered, encoding="utf-8")
        latest_path.write_text(rendered, encoding="utf-8")
    return report


def _inspect_url(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    kind = _kind_from_name(parsed.path)
    out: dict[str, Any] = {"exists": False, "kind": kind, "metadata": {"url": url}, "issues": []}
    try:
        req = Request(url, method="HEAD", headers={"User-Agent": "PixVerse Agent Plugin/0.1"})
        with urlopen(req, timeout=15) as response:
            out["exists"] = 200 <= response.status < 400
            out["metadata"]["status"] = response.status
            out["metadata"]["content_type"] = response.headers.get("Content-Type", "")
            out["metadata"]["content_length"] = response.headers.get("Content-Length", "")
    except Exception as exc:
        out["issues"].append(f"url_check_failed: {exc}")
    if out["exists"] and kind in {"video", "audio"} and which("ffprobe"):
        result, payload = _safe_run_json(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                url,
            ],
            timeout=45,
        )
        if result.ok:
            out["metadata"]["ffprobe"] = payload
            _add_media_findings(out, payload)
        else:
            out["issues"].append(result.stderr or "ffprobe_url_failed")
    return out


def _inspect_file(path: Path) -> dict[str, Any]:
    out: dict[str, Any] = {
        "exists": path.exists(),
        "kind": _kind_from_name(path.name),
        "metadata": {"path": str(path)},
        "issues": [],
    }
    if not path.exists():
        out["issues"].append("file_not_found")
        return out
    out["metadata"]["bytes"] = path.stat().st_size
    out["metadata"]["mime_guess"] = mimetypes.guess_type(path.name)[0] or ""
    if out["kind"] in {"video", "audio"}:
        if not which("ffprobe"):
            out["issues"].append("ffprobe_missing")
            return out
        result, payload = _safe_run_json(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(path),
            ],
            timeout=30,
        )
        if result.ok:
            out["metadata"]["ffprobe"] = payload
            _add_media_findings(out, payload)
        else:
            out["issues"].append(result.stderr or "ffprobe_failed")
    elif out["kind"] == "image":
        if which("ffprobe"):
            result, payload = _safe_run_json(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-print_format",
                    "json",
                    "-show_streams",
                    str(path),
                ],
                timeout=20,
            )
            if result.ok:
                out["metadata"]["ffprobe"] = payload
                _add_image_findings(out, payload)
    return out


def _kind_from_name(name: str) -> str:
    lower = name.lower()
    if lower.endswith((".mp4", ".mov", ".webm", ".m4v")):
        return "video"
    if lower.endswith((".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac")):
        return "audio"
    if lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
        return "image"
    return "unknown"


def _target_slug(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https"}:
        value = parsed.path or parsed.netloc
    stem = Path(value).stem or "target"
    slug = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in stem)
    return slug.strip("-_")[:80] or "target"


def _add_media_findings(out: dict[str, Any], payload: dict[str, Any]) -> None:
    streams = payload.get("streams") if isinstance(payload, dict) else []
    if not isinstance(streams, list):
        streams = []
    video_streams = [s for s in streams if s.get("codec_type") == "video"]
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    if out["kind"] == "video" and not video_streams:
        out["issues"].append("no_video_stream")
    if out["kind"] == "audio" and not audio_streams:
        out["issues"].append("no_audio_stream")
    out["metadata"]["video_stream_count"] = len(video_streams)
    out["metadata"]["audio_stream_count"] = len(audio_streams)
    out["metadata"]["has_audio"] = bool(audio_streams)
    if audio_streams:
        out["metadata"]["audio_codecs"] = sorted({str(stream.get("codec_name") or "") for stream in audio_streams})
        audio_duration = _max_stream_duration(audio_streams)
        if audio_duration > 0:
            out["metadata"]["audio_duration_seconds"] = audio_duration
    fmt = payload.get("format") if isinstance(payload, dict) else {}
    try:
        duration = float(fmt.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0 and out["kind"] in {"video", "audio"}:
        out["issues"].append("missing_duration")
    out["metadata"]["duration_seconds"] = duration
    if video_streams:
        stream = video_streams[0]
        out["metadata"]["width"] = stream.get("width")
        out["metadata"]["height"] = stream.get("height")
        if not stream.get("width") or not stream.get("height"):
            out["issues"].append("missing_dimensions")


def _add_image_findings(out: dict[str, Any], payload: dict[str, Any]) -> None:
    streams = payload.get("streams") if isinstance(payload, dict) else []
    if not isinstance(streams, list):
        streams = []
    image_streams = [s for s in streams if s.get("codec_type") in {"video", "image"}]
    if not image_streams:
        return
    stream = image_streams[0]
    out["metadata"]["width"] = stream.get("width")
    out["metadata"]["height"] = stream.get("height")
    if not stream.get("width") or not stream.get("height"):
        out["issues"].append("missing_dimensions")


def _add_expectation_findings(
    report: dict[str, Any],
    *,
    expect_audio: bool | None,
    expect_duration: float | None,
    duration_tolerance: float,
    expect_aspect_ratio: str,
) -> None:
    if report.get("kind") not in {"video", "audio", "image"}:
        return
    metadata = report.get("metadata")
    if not isinstance(metadata, dict):
        return
    if expect_audio is not None and report.get("kind") in {"video", "audio"}:
        has_audio = metadata.get("has_audio")
        if has_audio is not None:
            if expect_audio and not has_audio:
                report["issues"].append("expected_audio_missing")
            if expect_audio is False and has_audio:
                report["issues"].append("unexpected_audio_stream")
    if expect_duration is not None and report.get("kind") in {"video", "audio"}:
        duration = metadata.get("duration_seconds")
        if isinstance(duration, (int, float)):
            delta = abs(float(duration) - expect_duration)
            metadata["expected_duration_seconds"] = expect_duration
            metadata["duration_tolerance_seconds"] = duration_tolerance
            if delta > max(0.0, duration_tolerance):
                report["issues"].append("duration_mismatch")
    if expect_aspect_ratio and report.get("kind") in {"video", "image"}:
        expected = _ratio_value(expect_aspect_ratio)
        width = metadata.get("width")
        height = metadata.get("height")
        if expected and isinstance(width, int) and isinstance(height, int) and height > 0:
            actual = width / height
            metadata["expected_aspect_ratio"] = expect_aspect_ratio
            metadata["actual_aspect_ratio"] = round(actual, 4)
            if abs(actual - expected) > 0.03:
                report["issues"].append("aspect_ratio_mismatch")


def _max_stream_duration(streams: list[dict[str, Any]]) -> float:
    durations: list[float] = []
    for stream in streams:
        try:
            duration = float(stream.get("duration") or 0)
        except (TypeError, ValueError):
            duration = 0
        if duration > 0:
            durations.append(duration)
    return max(durations) if durations else 0


def _ratio_value(value: str) -> float | None:
    if ":" not in value:
        return None
    left, right = value.split(":", 1)
    try:
        width = float(left)
        height = float(right)
    except ValueError:
        return None
    if width <= 0 or height <= 0:
        return None
    return width / height


def sample_frames(
    video: Path,
    output_dir: Path,
    every_seconds: float = 3,
    count: int = 4,
    duration_seconds: float | None = None,
) -> list[str]:
    if count < 1 or not which("ffmpeg"):
        return []
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = output_dir / "frame-%03d.jpg"
    for stale_frame in output_dir.glob("frame-*.jpg"):
        stale_frame.unlink(missing_ok=True)
    # ffmpeg's fps filter does not promise that its first output timestamp is
    # zero, so a calculated cadence can still miss the ending. When duration is
    # known, seek each frame explicitly across the full timeline. These remain
    # internal subprocesses inside one host-level QA transaction.
    if duration_seconds is not None and duration_seconds > 0 and count > 1:
        tail_margin = min(0.25, duration_seconds * 0.05)
        interval = (duration_seconds - tail_margin) / (count - 1)
        frames: list[str] = []
        for index in range(count):
            frame = output_dir / f"frame-{index + 1:03d}.jpg"
            timestamp = interval * index
            result = _safe_run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    f"{timestamp:.3f}",
                    "-i",
                    str(video),
                    "-frames:v",
                    "1",
                    "-update",
                    "1",
                    str(frame),
                ],
                timeout=60,
            )
            if result.ok and frame.exists():
                frames.append(str(frame))
        if frames:
            return frames

    result = _safe_run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-vf",
            f"fps=1/{every_seconds:g}",
            "-frames:v",
            str(count),
            str(pattern),
        ],
        timeout=60,
    )
    if result.ok:
        frames = [str(path) for path in sorted(output_dir.glob("frame-*.jpg"))]
        if frames:
            return frames
    first_frame = output_dir / "frame-001.jpg"
    fallback = _safe_run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "0",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-update",
            "1",
            str(first_frame),
        ],
        timeout=60,
    )
    if fallback.ok and first_frame.exists():
        return [str(first_frame)]
    return []


def _safe_run(argv: list[str], *, timeout: float) -> CommandResult:
    try:
        return run(argv, timeout=timeout)
    except subprocess.TimeoutExpired:
        return CommandResult(
            argv=argv,
            returncode=124,
            stdout="",
            stderr=f"command_timeout_after_{timeout:g}s",
        )


def _safe_run_json(argv: list[str], *, timeout: float) -> tuple[CommandResult, dict[str, Any]]:
    try:
        return run_json(argv, timeout=timeout)
    except subprocess.TimeoutExpired:
        return (
            CommandResult(
                argv=argv,
                returncode=124,
                stdout="",
                stderr=f"command_timeout_after_{timeout:g}s",
            ),
            {},
        )
