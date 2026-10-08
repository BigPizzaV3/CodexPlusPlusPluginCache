from __future__ import annotations

import re
import shlex
from pathlib import Path
from typing import Any

TIMESTAMP_RE = re.compile(
    r"^(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(?P<end>\d{2}:\d{2}:\d{2},\d{3})(?:\s+.*)?$"
)
DEFAULT_MAX_LINES = 1
DEFAULT_MAX_CHARS_PER_LINE = 22
DEFAULT_TERMINAL_PUNCTUATION = ".。!！?？;；:：,，、…"
TRAILING_SUBTITLE_CLOSERS = "\"'”’」』»）》】〕〉）]"
DEFAULT_SUBTITLE_STYLE: dict[str, str] = {
    "FontName": "PingFang SC",
    "Fontsize": "18",
    "PrimaryColour": "&H00FFFFFF",
    "OutlineColour": "&HAA000000",
    "BorderStyle": "1",
    "Outline": "1",
    "Shadow": "0",
    "Alignment": "2",
    "MarginV": "28",
}
SUBTITLE_STYLE_ORDER = (
    "FontName",
    "Fontsize",
    "PrimaryColour",
    "OutlineColour",
    "BorderStyle",
    "Outline",
    "Shadow",
    "Alignment",
    "MarginV",
)


def subtitle_force_style(overrides: dict[str, str] | None = None) -> str:
    style = {**DEFAULT_SUBTITLE_STYLE, **(overrides or {})}
    keys = [key for key in SUBTITLE_STYLE_ORDER if key in style]
    keys.extend(sorted(key for key in style if key not in SUBTITLE_STYLE_ORDER))
    return ",".join(f"{key}={style[key]}" for key in keys)


def terminal_subtitle_punctuation(text: str, punctuation: str = DEFAULT_TERMINAL_PUNCTUATION) -> str:
    body = text.rstrip()
    while body and body[-1] in TRAILING_SUBTITLE_CLOSERS:
        body = body[:-1].rstrip()
    return body[-1] if body and body[-1] in punctuation else ""


def strip_terminal_subtitle_punctuation(
    text: str,
    punctuation: str = DEFAULT_TERMINAL_PUNCTUATION,
) -> str:
    body = text.rstrip()
    tail = ""
    while body and body[-1] in TRAILING_SUBTITLE_CLOSERS:
        tail = body[-1] + tail
        body = body[:-1].rstrip()
    while body and body[-1] in punctuation:
        body = body[:-1].rstrip()
    return f"{body}{tail}"


def srt_timestamp_seconds(value: str) -> float:
    hour_text, minute_text, second_text = value.split(":")
    second_whole, millisecond_text = second_text.split(",")
    return (
        int(hour_text) * 3600
        + int(minute_text) * 60
        + int(second_whole)
        + int(millisecond_text) / 1000
    )


def read_srt(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8-sig")
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").strip())
    entries: list[dict[str, Any]] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        index = ""
        if lines[0].isdigit():
            index = lines.pop(0)
        if not lines:
            continue
        match = TIMESTAMP_RE.match(lines.pop(0))
        if not match:
            continue
        caption = " ".join(lines).strip()
        if not caption:
            continue
        start = match.group("start")
        end = match.group("end")
        entries.append(
            {
                "index": index or str(len(entries) + 1),
                "start": start,
                "end": end,
                "text": caption,
                "lines": lines,
                "duration_seconds": round(srt_timestamp_seconds(end) - srt_timestamp_seconds(start), 3),
            }
        )
    return entries


def srt_to_tts_text(path: Path, *, separator: str = "\n") -> str:
    return separator.join(entry["text"] for entry in read_srt(path)).strip()


def inspect_srt(
    path: Path,
    *,
    max_lines: int = DEFAULT_MAX_LINES,
    max_chars_per_line: int = DEFAULT_MAX_CHARS_PER_LINE,
    allow_terminal_punctuation: bool = False,
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    for entry in read_srt(path):
        lines = [str(line) for line in entry.get("lines", [])]
        line_lengths = [len(line) for line in lines]
        entry_issues: list[str] = []
        if len(lines) > max_lines:
            entry_issues.append("too_many_lines")
        if any(length > max_chars_per_line for length in line_lengths):
            entry_issues.append("line_too_long")
        terminal_punctuation = [
            {
                "line": idx,
                "character": mark,
            }
            for idx, mark in (
                (line_idx, terminal_subtitle_punctuation(line))
                for line_idx, line in enumerate(lines, start=1)
            )
            if mark
        ]
        if terminal_punctuation and not allow_terminal_punctuation:
            entry_issues.append("terminal_punctuation")
        if float(entry.get("duration_seconds") or 0) <= 0:
            entry_issues.append("non_positive_duration")
        row = {
            **entry,
            "line_count": len(lines),
            "characters": len(str(entry.get("text") or "")),
            "line_characters": line_lengths,
            "max_line_characters": max(line_lengths) if line_lengths else 0,
            "terminal_punctuation": terminal_punctuation,
            "issues": entry_issues,
        }
        entries.append(row)
        for code in entry_issues:
            issues.append(
                {
                    "index": entry["index"],
                    "code": code,
                    "text": entry["text"],
                    "line_count": len(lines),
                    "max_line_characters": row["max_line_characters"],
                    "terminal_punctuation": terminal_punctuation,
                }
            )
    return {
        "path": str(path),
        "contract": {
            "max_lines": max_lines,
            "max_chars_per_line": max_chars_per_line,
            "allow_terminal_punctuation": allow_terminal_punctuation,
            "voice_task_grain": "one_tts_task_per_srt_caption",
        },
        "entry_count": len(entries),
        "entries": entries,
        "issues": issues,
        "ok": not issues,
    }


def write_clean_srt(path: Path, output: Path, *, force: bool = False) -> dict[str, Any]:
    if output.exists() and not force:
        raise FileExistsError(f"SRT already exists: {output}")
    entries = read_srt(path)
    rows: list[dict[str, Any]] = []
    blocks: list[str] = []
    for idx, entry in enumerate(entries, start=1):
        source_lines = [str(line) for line in entry.get("lines", [])]
        clean_lines = [strip_terminal_subtitle_punctuation(line) for line in source_lines]
        changed = source_lines != clean_lines
        blocks.append(
            "\n".join(
                [
                    str(idx),
                    f"{entry['start']} --> {entry['end']}",
                    *clean_lines,
                ]
            )
        )
        rows.append(
            {
                "index": entry["index"],
                "start": entry["start"],
                "end": entry["end"],
                "before": entry["text"],
                "after": " ".join(clean_lines).strip(),
                "changed": changed,
            }
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n\n".join(blocks).rstrip() + "\n", encoding="utf-8")
    return {
        "source": str(path),
        "path": str(output),
        "entry_count": len(entries),
        "changed_count": sum(1 for row in rows if row["changed"]),
        "entries": rows,
    }


def write_srt_segments(path: Path, output_dir: Path, *, prefix: str = "line") -> list[dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for idx, entry in enumerate(read_srt(path), start=1):
        out_path = output_dir / f"{prefix}-{idx:03d}.txt"
        text = str(entry["text"]).strip()
        out_path.write_text(text + "\n", encoding="utf-8")
        rows.append(
            {
                "index": entry["index"],
                "start": entry["start"],
                "end": entry["end"],
                "text": text,
                "path": str(out_path),
                "characters": len(text),
                "duration_seconds": entry["duration_seconds"],
            }
        )
    return rows


def build_voice_queue_from_srt(
    path: Path,
    output: Path,
    *,
    project: str = "",
    segments_dir: Path | None = None,
    text_prefix: str = "voice",
    task_prefix: str = "voice",
    label_prefix: str = "Voice segment",
    model: str = "speech-2.8-hd",
    voice_id: str = "",
    language: str = "",
    speed: str = "",
    force: bool = False,
) -> dict[str, Any]:
    if output.exists() and not force:
        raise FileExistsError(f"Queue spec already exists: {output}")
    text_dir = segments_dir or output.parent / "tts-segments"
    segments = write_srt_segments(path, text_dir, prefix=text_prefix)
    tasks: list[dict[str, str]] = []
    for idx, segment in enumerate(segments, start=1):
        task_id = f"{task_prefix}_{idx:03d}"
        command = ["pixverse", "create", "voice", "--model", model]
        if voice_id:
            command.extend(["--voice-id", voice_id])
        if language:
            command.extend(["--language", language])
        if speed:
            command.extend(["--speed", speed])
        command.extend(["--text", str(segment["path"])])
        tasks.append(
            {
                "id": task_id,
                "label": f"{label_prefix} {idx:03d}",
                "cmd": shlex.join(command),
            }
        )
    payload: dict[str, Any] = {
        "project": project or output.stem,
        "source_srt": str(path),
        "segments_dir": str(text_dir),
        "tts_alignment": "one_tts_task_per_srt_caption",
        "tasks": tasks,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json_dumps(payload), encoding="utf-8")
    return {"path": str(output), "segments": segments, "queue": payload}


def json_dumps(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
