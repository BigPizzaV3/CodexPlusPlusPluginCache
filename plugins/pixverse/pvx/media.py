"""Local media inspection and preparation helpers (FFmpeg/ffprobe, optional yt-dlp and Whisper).

These helpers never call PixVerse and never spend credits. They give the agent the same
evidence a human editor would gather before adapting a reference: stream facts, labelled
frames, contact sheets that keep spoken words beside the picture, mechanical cut candidates,
a local copy of a linked video, and measured word times for the speech it contains.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .shell import which

WORDS_FORMAT = "pvx.words@1"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


class MediaToolError(RuntimeError):
    """A local tool is missing or a local media operation failed."""


@dataclass
class MediaInfo:
    path: str
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    has_video: bool = False
    has_audio: bool = False
    audio_sample_rate: int = 0
    audio_channels: int = 0
    video_codec: str = ""
    audio_codec: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "duration": round(self.duration, 3),
            "width": self.width,
            "height": self.height,
            "fps": round(self.fps, 3),
            "has_video": self.has_video,
            "has_audio": self.has_audio,
            "audio_sample_rate": self.audio_sample_rate,
            "audio_channels": self.audio_channels,
            "video_codec": self.video_codec,
            "audio_codec": self.audio_codec,
        }


def _require(binary: str) -> str:
    path = which(binary)
    if not path:
        raise MediaToolError(f"{binary} is not installed or not on PATH")
    return path


def _run(argv: list[str], timeout: float = 600) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-6:]
        raise MediaToolError(f"{argv[0]} failed ({proc.returncode}): " + " | ".join(tail))
    return proc


def probe(path: str | Path) -> MediaInfo:
    ffprobe = _require("ffprobe")
    source = Path(path)
    if not source.is_file():
        raise MediaToolError(f"media file not found: {source}")
    proc = _run(
        [ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(source)],
        timeout=60,
    )
    payload = json.loads(proc.stdout or "{}")
    info = MediaInfo(path=str(source))
    fmt = payload.get("format") or {}
    try:
        info.duration = float(fmt.get("duration") or 0.0)
    except (TypeError, ValueError):
        info.duration = 0.0
    for stream in payload.get("streams") or []:
        kind = stream.get("codec_type")
        if kind == "video" and not info.has_video:
            info.has_video = True
            info.width = int(stream.get("width") or 0)
            info.height = int(stream.get("height") or 0)
            info.video_codec = str(stream.get("codec_name") or "")
            rate = str(stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1")
            num, _, den = rate.partition("/")
            try:
                info.fps = float(num) / float(den or 1) if float(den or 1) else 0.0
            except ValueError:
                info.fps = 0.0
            if not info.duration:
                try:
                    info.duration = float(stream.get("duration") or 0.0)
                except (TypeError, ValueError):
                    pass
        elif kind == "audio" and not info.has_audio:
            info.has_audio = True
            info.audio_codec = str(stream.get("codec_name") or "")
            info.audio_sample_rate = int(stream.get("sample_rate") or 0)
            info.audio_channels = int(stream.get("channels") or 0)
    return info


# ---------------------------------------------------------------------------
# Word transcripts
# ---------------------------------------------------------------------------


@dataclass
class Word:
    text: str
    start: float
    end: float

    def as_dict(self) -> dict[str, Any]:
        return {"text": self.text, "start": round(self.start, 3), "end": round(self.end, 3)}


@dataclass
class Transcript:
    words: list[Word] = field(default_factory=list)
    language: str = ""
    source: str = ""
    tool: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "format": WORDS_FORMAT,
            "language": self.language,
            "source": self.source,
            "tool": self.tool,
            "text": " ".join(word.text for word in self.words),
            "words": [word.as_dict() for word in self.words],
        }


def import_words(path: str | Path) -> Transcript:
    """Read word timings from the formats an agent is likely to have on disk.

    Accepted: pvx.words@1, openai-whisper JSON (segments[].words), WhisperX JSON
    (word_segments[] or segments[].words), a generic {"words": [...]} list, and
    Hypit-style {"passages": [{"words": [{"text", "start_seconds", "end_seconds"}]}]}.
    """
    source = Path(path)
    payload = json.loads(source.read_text(encoding="utf-8"))
    words: list[Word] = []

    def add(item: dict[str, Any]) -> None:
        text = str(item.get("text") if item.get("text") is not None else item.get("word") or "").strip()
        start = item.get("start", item.get("start_seconds"))
        end = item.get("end", item.get("end_seconds"))
        if not text or start is None or end is None:
            return
        words.append(Word(text=text, start=float(start), end=float(end)))

    if isinstance(payload, dict):
        if isinstance(payload.get("word_segments"), list):
            for item in payload["word_segments"]:
                if isinstance(item, dict):
                    add(item)
        elif isinstance(payload.get("words"), list):
            for item in payload["words"]:
                if isinstance(item, dict):
                    add(item)
        elif isinstance(payload.get("passages"), list):
            for passage in payload["passages"]:
                for item in (passage or {}).get("words") or []:
                    if isinstance(item, dict):
                        add(item)
        elif isinstance(payload.get("segments"), list):
            for segment in payload["segments"]:
                for item in (segment or {}).get("words") or []:
                    if isinstance(item, dict):
                        add(item)
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                add(item)
    if not words:
        raise MediaToolError(f"no timed words found in {source}")
    language = str(payload.get("language") or "") if isinstance(payload, dict) else ""
    return Transcript(words=words, language=language, source=str(source), tool="import")


def transcribe(
    path: str | Path,
    *,
    language: str = "",
    model: str = "small",
    work_dir: str | Path | None = None,
) -> Transcript:
    """Measure word times with a locally installed Whisper.

    Order of preference: the `whisperx` CLI, then the `whisper` CLI (openai-whisper),
    then the `whisper` Python module. Nothing is downloaded by this function; the
    selected tool manages its own model cache. A missing tool raises MediaToolError
    with the install hint instead of guessing timings.
    """
    source = Path(path)
    if not source.is_file():
        raise MediaToolError(f"media file not found: {source}")
    _require("ffmpeg")
    out_dir = Path(work_dir) if work_dir else source.parent / f".{source.stem}-words"
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / f"{source.stem}.16k.wav"
    _run(
        [
            _require("ffmpeg"), "-v", "error", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le", str(wav),
        ]
    )
    if which("whisperx"):
        argv = [which("whisperx") or "whisperx", str(wav), "--model", model, "--output_dir", str(out_dir),
                "--output_format", "json", "--compute_type", "int8", "--device", "cpu"]
        if language:
            argv += ["--language", language]
        _run(argv, timeout=3600)
        produced = out_dir / f"{wav.stem}.json"
        transcript = import_words(produced)
        transcript.tool = "whisperx"
    elif which("whisper"):
        argv = [which("whisper") or "whisper", str(wav), "--model", model, "--word_timestamps", "True",
                "--output_format", "json", "--output_dir", str(out_dir), "--fp16", "False"]
        if language:
            argv += ["--language", language]
        _run(argv, timeout=3600)
        produced = out_dir / f"{wav.stem}.json"
        transcript = import_words(produced)
        transcript.tool = "openai-whisper"
    else:
        try:
            import whisper  # type: ignore
        except Exception as exc:  # pragma: no cover - depends on host
            raise MediaToolError(
                "no local speech aligner found; install one of: `pip install openai-whisper` "
                "(whisper CLI), `pip install whisperx`, or pass an existing word JSON with --words"
            ) from exc
        engine = whisper.load_model(model)
        result = engine.transcribe(str(wav), word_timestamps=True, language=language or None, fp16=False)
        produced = out_dir / f"{wav.stem}.json"
        produced.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        transcript = import_words(produced)
        transcript.tool = "whisper-python"
    transcript.language = language or transcript.language
    transcript.source = str(source)
    return transcript


# ---------------------------------------------------------------------------
# Frames, contact sheets and cut candidates
# ---------------------------------------------------------------------------


def _times_for(
    duration: float,
    *,
    at: list[float] | None = None,
    every: float | None = None,
    count: int | None = None,
    start: float = 0.0,
    end: float | None = None,
) -> list[float]:
    stop = min(duration, end) if end is not None and duration else (end if end is not None else duration)
    if at:
        return [t for t in at if 0 <= t <= max(stop, 0)]
    if every and every > 0:
        times: list[float] = []
        t = start
        while t < stop - 1e-6:
            times.append(round(t, 3))
            t += every
        return times
    n = max(1, int(count or 8))
    span = max(stop - start, 0.0)
    return [round(start + span * (i + 0.5) / n, 3) for i in range(n)]


def extract_frame(path: str | Path, at: float, to: str | Path, *, width: int | None = None) -> Path:
    ffmpeg = _require("ffmpeg")
    target = Path(to)
    target.parent.mkdir(parents=True, exist_ok=True)
    argv = [ffmpeg, "-v", "error", "-y", "-ss", f"{max(at, 0):.3f}", "-i", str(path), "-frames:v", "1"]
    if width:
        argv += ["-vf", f"scale={int(width)}:-2"]
    argv.append(str(target))
    _run(argv, timeout=120)
    return target


def frames(
    path: str | Path,
    to_dir: str | Path,
    *,
    at: list[float] | None = None,
    every: float | None = None,
    count: int | None = None,
    start: float = 0.0,
    end: float | None = None,
    width: int | None = None,
    label_time: bool = False,
    transcript: Transcript | None = None,
) -> list[dict[str, Any]]:
    info = probe(path)
    out_dir = Path(to_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for t in _times_for(info.duration, at=at, every=every, count=count, start=start, end=end):
        target = out_dir / f"t{t:08.3f}.png"
        extract_frame(path, t, target, width=width)
        words = words_around(transcript, t, every or 0.0) if transcript else []
        if label_time or words:
            _label_image(target, _time_label(t, words))
        rows.append({"time": t, "path": str(target), "words": [w.text for w in words]})
    return rows


def words_around(transcript: Transcript | None, at: float, window: float = 0.0) -> list[Word]:
    if transcript is None:
        return []
    stop = at + max(window, 0.0)
    active = [w for w in transcript.words if w.start < stop + 1e-6 and w.end > at - 1e-6]
    if active:
        return active
    nearest = min(transcript.words, key=lambda w: abs(w.start - at), default=None)
    return [nearest] if nearest is not None and abs(nearest.start - at) <= 0.75 else []


def _time_label(t: float, words: list[Word]) -> str:
    label = f"{t:6.2f}s"
    if words:
        label += "  " + " ".join(w.text for w in words)
    return label


def _load_font(size: int):
    from PIL import ImageFont

    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _label_image(path: Path, label: str, *, band: int = 36) -> None:
    from PIL import Image, ImageDraw

    image = Image.open(path).convert("RGB")
    canvas = Image.new("RGB", (image.width, image.height + band), (16, 16, 16))
    canvas.paste(image, (0, 0))
    draw = ImageDraw.Draw(canvas)
    font = _load_font(max(12, band - 14))
    draw.text((8, image.height + 6), label[:120], fill=(255, 255, 255), font=font)
    canvas.save(path)


def tile(
    path: str | Path,
    to: str | Path,
    *,
    start: float = 0.0,
    end: float | None = None,
    every: float | None = None,
    count: int | None = None,
    at: list[float] | None = None,
    columns: int = 4,
    cell: int = 320,
    transcript: Transcript | None = None,
) -> dict[str, Any]:
    """One contact sheet: frames in reading order, each labelled with its source time and words."""
    from PIL import Image, ImageDraw

    info = probe(path)
    times = _times_for(info.duration, at=at, every=every, count=count, start=start, end=end)
    if not times:
        raise MediaToolError("no frames selected; check --start/--end/--every")
    target = Path(to)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = target.parent / f".{target.stem}-cells"
    tmp_dir.mkdir(exist_ok=True)
    tiles: list[Image.Image] = []
    labels: list[str] = []
    window = every or (times[1] - times[0] if len(times) > 1 else 0.0)
    for t in times:
        cell_path = extract_frame(path, t, tmp_dir / f"t{t:08.3f}.png", width=cell)
        tiles.append(Image.open(cell_path).convert("RGB"))
        labels.append(_time_label(t, words_around(transcript, t, window)))
    columns = max(1, columns)
    rows = (len(tiles) + columns - 1) // columns
    cell_w = max(im.width for im in tiles)
    cell_h = max(im.height for im in tiles)
    band = 30 if transcript is None else 46
    sheet = Image.new("RGB", (columns * cell_w, rows * (cell_h + band)), (14, 14, 14))
    draw = ImageDraw.Draw(sheet)
    font = _load_font(18)
    for index, (im, label) in enumerate(zip(tiles, labels)):
        x = (index % columns) * cell_w
        y = (index // columns) * (cell_h + band)
        sheet.paste(im, (x, y))
        for line_no, line in enumerate(_wrap(label, max(8, cell_w // 11))[:2]):
            draw.text((x + 6, y + cell_h + 4 + line_no * 20), line, fill=(255, 255, 255), font=font)
    sheet.save(target, quality=88)
    shutil.rmtree(tmp_dir, ignore_errors=True)
    return {
        "path": str(target),
        "frames": len(tiles),
        "columns": columns,
        "rows": rows,
        "cell": cell,
        "times": times,
        "labels": labels,
    }


def _wrap(text: str, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines or [""]


def boundaries(path: str | Path, *, threshold: float = 0.3, limit: int = 200) -> list[dict[str, Any]]:
    """Mechanical visual-change candidates (FFmpeg scene score); never editorial shot labels."""
    ffmpeg = _require("ffmpeg")
    proc = subprocess.run(
        [
            ffmpeg, "-v", "info", "-i", str(path), "-vf",
            f"select='gt(scene,{threshold})',showinfo", "-an", "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
        timeout=900,
    )
    rows: list[dict[str, Any]] = []
    for match in re.finditer(r"pts_time:(?P<t>[0-9.]+).*?scene_score=(?P<s>[0-9.]+)|pts_time:(?P<t2>[0-9.]+)", proc.stderr):
        t = match.group("t") or match.group("t2")
        score = match.group("s")
        if t is None:
            continue
        rows.append({"time": round(float(t), 3), "score": round(float(score), 3) if score else None})
        if len(rows) >= limit:
            break
    return rows


def cut(path: str | Path, to: str | Path, *, start: float, end: float, reencode: bool = True) -> Path:
    ffmpeg = _require("ffmpeg")
    target = Path(to)
    target.parent.mkdir(parents=True, exist_ok=True)
    argv = [ffmpeg, "-v", "error", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(path)]
    if reencode:
        argv += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart"]
    else:
        argv += ["-c", "copy"]
    argv.append(str(target))
    _run(argv, timeout=900)
    return target


def fetch(url: str, to: str | Path, *, max_height: int = 1080) -> dict[str, Any]:
    """Save a linked video locally with yt-dlp (must already be installed)."""
    ytdlp = which("yt-dlp")
    if not ytdlp:
        raise MediaToolError(
            "yt-dlp is not installed; install it (`pip install yt-dlp` or `brew install yt-dlp`) "
            "or save the video manually and pass the local file"
        )
    _require("ffmpeg")
    target = Path(to)
    if target.exists():
        raise MediaToolError(f"refusing to overwrite existing file: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    fmt = (
        f"bv*[ext=mp4][height<={max_height}]+ba[ext=m4a]/bv*[height<={max_height}]+ba/"
        f"b[ext=mp4][height<={max_height}]/b"
    )
    _run(
        [
            ytdlp, "--no-playlist", "-f", fmt, "--merge-output-format", "mp4", "--no-overwrites",
            "-o", str(target), url,
        ],
        timeout=1800,
    )
    if not target.is_file():
        candidates = sorted(target.parent.glob(f"{target.stem}.*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not candidates:
            raise MediaToolError("yt-dlp finished without producing the expected file")
        candidates[0].rename(target)
    info = probe(target)
    return {"url": url, **info.as_dict()}
