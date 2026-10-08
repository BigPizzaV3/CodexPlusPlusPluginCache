"""Semantic timeline: measured word times for a script, and rendering plans bound to them.

Flow:
  script (pvx.script)  +  measured words per take (pvx.media Transcript)
      -> align()            words get start/end on the take clock, anchors resolve
      -> build_timeline()   takes are placed one after another on one program clock
      -> captions_ass()     caption cues from the script's phrases, word-highlight styles
      -> render_plan()      overlays/audio bound to anchors -> one FFmpeg render

Nothing here calls PixVerse. A new take (another host, another language) re-runs align()
and every layer follows the new words.
"""
from __future__ import annotations

import difflib
import json
import math
import re
import shlex
import subprocess
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .media import MediaToolError, Transcript, Word, probe
from .script import CJK_RE, Script, ScriptWord
from .shell import which

TIMELINE_FORMAT = "pvx.timeline@1"
PLAN_FORMAT = "pvx.plan@1"
PUNCT_RE = re.compile(r"[^\w\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+", re.UNICODE)


class TimelineError(ValueError):
    pass


# ---------------------------------------------------------------------------
# Alignment
# ---------------------------------------------------------------------------


def _normalize(token: str) -> str:
    return PUNCT_RE.sub("", token).lower()


def _units(text: str) -> list[str]:
    """Alignment units: CJK characters and Unicode words, preserving diacritics."""
    out: list[str] = []
    pending = ""
    for char in unicodedata.normalize("NFC", text).casefold():
        if CJK_RE.fullmatch(char):
            if pending:
                out.append(pending)
                pending = ""
            out.append(char)
        elif char.isalnum() or unicodedata.category(char).startswith("M") or char in "'’":
            pending += char
        elif pending:
            out.append(pending)
            pending = ""
    if pending:
        out.append(pending)
    return out


@dataclass
class TimedWord:
    index: int
    display: str
    spoken: str
    start: float
    end: float
    segment: str
    role: str
    phrase: int
    matched: bool = True
    asr: str = ""
    take: str = ""
    attrs: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        out = {
            "index": self.index, "display": self.display, "spoken": self.spoken,
            "start": round(self.start, 3), "end": round(self.end, 3), "segment": self.segment,
            "role": self.role, "phrase": self.phrase, "matched": self.matched, "asr": self.asr, "take": self.take,
        }
        if self.attrs:
            out["attrs"] = self.attrs
        return out


def align(
    script: Script,
    transcript: Transcript,
    *,
    segment: str | None = None,
    offset: float = 0.0,
    take: str = "",
    duration: float | None = None,
) -> tuple[list[TimedWord], dict[str, Any]]:
    """Give each script word a measured time from an ASR transcript of the same speech.

    Display text always comes from the script. ASR spelling only locates time, so
    "T is D-Ear" still times "Tea is D tier." correctly. Unmatched script words borrow
    time proportionally inside the nearest matched span.
    """
    words = [w for w in script.words if w.spoken and (segment is None or w.segment == segment)]
    if not words:
        raise TimelineError("script has no spoken words to align" + (f" in segment {segment}" if segment else ""))
    script_units: list[tuple[int, str]] = []  # (word index in `words`, unit)
    for i, w in enumerate(words):
        for unit in _units(w.spoken):
            script_units.append((i, unit))
    asr_units: list[tuple[Word, str]] = []
    subdivided_tokens = 0
    for aw in transcript.words:
        units = _units(aw.text)
        if len(units) > 1:
            subdivided_tokens += 1
        for i, unit in enumerate(units):
            # ASR often returns a whole CJK word. Share its measured span instead
            # of assigning every character the entire span then collapsing overlaps.
            span = (aw.end - aw.start) / len(units)
            asr_units.append((Word(aw.text, aw.start + i * span, aw.start + (i + 1) * span), unit))
    if not asr_units:
        raise TimelineError("transcript has no words")
    a = [u for _, u in script_units]
    b = [u for _, u in asr_units]
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    unit_times: list[tuple[float, float] | None] = [None] * len(script_units)
    reliable_units: set[int] = set()
    extra_asr_words: list[str] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                aw = asr_units[j1 + k][0]
                unit_times[i1 + k] = (aw.start, aw.end)
                reliable_units.add(i1 + k)
        elif tag == "replace" and j2 > j1:
            # Different spelling, same slot: spread the ASR span over the script units.
            span_start = asr_units[j1][0].start
            span_end = asr_units[j2 - 1][0].end
            n = i2 - i1
            for k in range(n):
                s = span_start + (span_end - span_start) * k / n
                e = span_start + (span_end - span_start) * (k + 1) / n
                unit_times[i1 + k] = (s, e)
            # Timing interpolation is not evidence that the words were spoken.
            # Tolerate short spelling errors, but never bless an unrelated passage.
            similarity = difflib.SequenceMatcher(None, "".join(a[i1:i2]), "".join(b[j1:j2])).ratio()
            if max(i2 - i1, j2 - j1) <= 2 and similarity >= 0.6:
                reliable_units.update(range(i1, i2))
        elif tag == "insert":
            extra_asr_words.extend(dict.fromkeys(aw.text for aw, _ in asr_units[j1:j2]))
    matched_units = len(reliable_units)
    # Fill gaps (script units the ASR dropped) by interpolating between neighbours.
    for i, t in enumerate(unit_times):
        if t is not None:
            continue
        prev_end = next((unit_times[j][1] for j in range(i - 1, -1, -1) if unit_times[j] is not None), None)  # type: ignore[index]
        next_start = next((unit_times[j][0] for j in range(i + 1, len(unit_times)) if unit_times[j] is not None), None)  # type: ignore[index]
        if prev_end is None and next_start is None:
            raise TimelineError("no script word could be matched to the transcript")
        if prev_end is None:
            prev_end = max(0.0, next_start - 0.25)  # type: ignore[operator]
        if next_start is None:
            next_start = prev_end + 0.25
        # count consecutive missing units to share the gap
        j = i
        while j < len(unit_times) and unit_times[j] is None:
            j += 1
        missing = j - i
        for k in range(missing):
            s = prev_end + (next_start - prev_end) * k / missing
            e = prev_end + (next_start - prev_end) * (k + 1) / missing
            unit_times[i + k] = (s, e)
    timed: list[TimedWord] = []
    by_word: dict[int, list[tuple[float, float]]] = {}
    matched_words: set[int] = set()
    for (wi, _), t in zip(script_units, unit_times):
        by_word.setdefault(wi, []).append(t)  # type: ignore[arg-type]
    for wi in by_word:
        if all(k in reliable_units for k, (word_index, _) in enumerate(script_units) if word_index == wi):
            matched_words.add(wi)
    asr_text_by_word: dict[int, list[str]] = {}
    for k, ((wi, _), (aw_text)) in enumerate(zip(script_units, _asr_text_for_units(matcher, asr_units, len(script_units)))):
        if aw_text:
            asr_text_by_word.setdefault(wi, []).append(aw_text)
    for i, w in enumerate(words):
        spans = by_word.get(i)
        if not spans:
            # a word with no alignment units (pure punctuation); borrow neighbours
            prev = timed[-1].end if timed else 0.0
            spans = [(prev, prev)]
        start = min(s for s, _ in spans) + offset
        end = max(e for _, e in spans) + offset
        timed.append(
            TimedWord(
                index=w.index, display=w.display, spoken=w.spoken, start=start, end=max(end, start),
                segment=w.segment, role=w.role, phrase=w.phrase, matched=i in matched_words,
                asr=" ".join(dict.fromkeys(asr_text_by_word.get(i, []))), take=take, attrs=dict(w.attrs),
            )
        )
    # keep monotonic
    for prev, cur in zip(timed, timed[1:]):
        if cur.start < prev.end - 1e-6:
            cur.start = prev.end
            cur.end = max(cur.end, cur.start)
    total_units = len(script_units)
    report = {
        "take": take,
        "segment": segment,
        "script_units": total_units,
        "asr_units": len(asr_units),
        "matched_units": matched_units,
        "confidence": round(matched_units / total_units, 3) if total_units else 0.0,
        "unmatched_words": [w.display for w in timed if not w.matched],
        "extra_asr_words": extra_asr_words,
        "subdivided_asr_tokens": subdivided_tokens,
        "needs_review": any(not w.matched for w in timed) or bool(extra_asr_words),
        "speech_start": round(timed[0].start, 3),
        "speech_end": round(timed[-1].end, 3),
        "duration": round(duration, 3) if duration else None,
    }
    return timed, report


def _asr_text_for_units(matcher: difflib.SequenceMatcher, asr_units: list[tuple[Word, str]], n: int) -> list[str]:
    out = [""] * n
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                out[i1 + k] = asr_units[j1 + k][0].text
        elif tag == "replace" and j2 > j1:
            joined = " ".join(dict.fromkeys(asr_units[j][0].text for j in range(j1, j2)))
            for k in range(i1, i2):
                out[k] = joined
    return out


# ---------------------------------------------------------------------------
# Timeline document
# ---------------------------------------------------------------------------


@dataclass
class Take:
    id: str
    media: str
    start: float
    duration: float
    segment: str | None = None
    report: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "media": self.media, "start": round(self.start, 3),
            "duration": round(self.duration, 3), "segment": self.segment, "alignment": self.report,
        }


def build_timeline(
    script: Script,
    takes: list[dict[str, Any]],
    *,
    gap: float = 0.0,
) -> dict[str, Any]:
    """Place takes one after another and resolve every script anchor on the program clock.

    Each take: {"id", "media", "transcript": Transcript, "segment": optional, "start": optional}
    """
    placed: list[Take] = []
    words: list[TimedWord] = []
    clock = 0.0
    for row in takes:
        media = str(row["media"])
        info = probe(media)
        duration = float(row.get("duration") or info.duration)
        start = float(row["start"]) if row.get("start") is not None else clock
        segment = row.get("segment")
        transcript: Transcript = row["transcript"]
        timed, report = align(script, transcript, segment=segment, offset=start, take=str(row["id"]), duration=duration)
        words.extend(timed)
        placed.append(Take(id=str(row["id"]), media=media, start=start, duration=duration, segment=segment, report=report))
        clock = max(clock, start + duration + gap)
    words.sort(key=lambda w: w.index)
    by_index = {w.index: w for w in words}
    anchors: dict[str, dict[str, Any]] = {}
    for name, anchor in script.anchors.items():
        start_word = by_index.get(anchor.start_word)
        if start_word is None:
            continue
        start = start_word.start if anchor.start_edge == "start" else start_word.end
        if anchor.kind == "moment":
            anchors[name] = {"kind": "moment", "at": round(start, 3), "start": round(start, 3), "end": round(start, 3)}
        else:
            end_word = by_index.get(anchor.end_word if anchor.end_word is not None else anchor.start_word)
            if end_word is None:
                continue
            end = end_word.end if anchor.end_edge == "end" else end_word.start
            anchors[name] = {"kind": "selection", "start": round(start, 3), "end": round(max(end, start), 3)}
    phrases: list[dict[str, Any]] = []
    for w in words:
        if not phrases or phrases[-1]["index"] != w.phrase:
            phrases.append({"index": w.phrase, "segment": w.segment, "role": w.role, "start": w.start, "end": w.end, "words": []})
        phrases[-1]["words"].append(w.index)
        phrases[-1]["end"] = max(phrases[-1]["end"], w.end)
        displays = [by_index[i].display for i in phrases[-1]["words"] if by_index[i].display]
        phrases[-1]["text"] = ("" if all(CJK_RE.search(d) for d in displays) else " ").join(displays)
    for p in phrases:
        p["start"] = round(p["start"], 3)
        p["end"] = round(p["end"], 3)
    # program end = last take end
    program_end = max((t.start + t.duration for t in placed), default=0.0)
    for seg in script.segments:
        seg_words = [w for w in words if w.segment == seg]
        if seg_words:
            anchors.setdefault(f"segment:{seg}", {"kind": "selection", "start": round(seg_words[0].start, 3), "end": round(seg_words[-1].end, 3)})
    anchors["program"] = {"kind": "selection", "start": 0.0, "end": round(program_end, 3)}
    return {
        "format": TIMELINE_FORMAT,
        "duration": round(program_end, 3),
        "script": script.source,
        "takes": [t.as_dict() for t in placed],
        "words": [w.as_dict() for w in words],
        "phrases": phrases,
        "anchors": anchors,
    }


def load_timeline(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("format") != TIMELINE_FORMAT:
        raise TimelineError(f"{path} is not a {TIMELINE_FORMAT} document")
    return payload


# ---------------------------------------------------------------------------
# Time references
# ---------------------------------------------------------------------------


def resolve_window(timeline: dict[str, Any], ref: Any, *, default_len: float = 0.0) -> tuple[float, float]:
    """Resolve an anchor name, number, {"start","end"}, "word:<index>" or "phrase:<index>" to seconds."""
    anchors = timeline.get("anchors") or {}
    duration = float(timeline.get("duration") or 0.0)
    if ref is None or ref == "program":
        return 0.0, duration
    if isinstance(ref, (int, float)):
        return float(ref), float(ref) + default_len
    if isinstance(ref, dict):
        start = _time_value(timeline, ref.get("start"), 0.0)
        end = _time_value(timeline, ref.get("end"), duration)
        if ref.get("for") is not None:
            end = start + float(ref["for"])
        offset = float(ref.get("offset", 0.0))
        start += offset + float(ref.get("start_offset", 0.0))
        end += offset + float(ref.get("end_offset", 0.0))
        return start, max(end, start)
    text = str(ref)
    if text in anchors:
        a = anchors[text]
        if a.get("kind") == "moment":
            return float(a["at"]), float(a["at"]) + default_len
        return float(a["start"]), float(a["end"])
    if text.startswith("word:"):
        w = _word(timeline, int(text.split(":", 1)[1]))
        return float(w["start"]), float(w["end"])
    if text.startswith("phrase:"):
        idx = int(text.split(":", 1)[1])
        for p in timeline.get("phrases") or []:
            if int(p["index"]) == idx:
                return float(p["start"]), float(p["end"])
    if text.startswith("take:"):
        for t in timeline.get("takes") or []:
            if t["id"] == text.split(":", 1)[1]:
                return float(t["start"]), float(t["start"]) + float(t["duration"])
    try:
        value = float(text.rstrip("s"))
        return value, value + default_len
    except ValueError:
        raise TimelineError(f"unknown time reference {ref!r}; anchors: {', '.join(sorted(anchors))}")


def _time_value(timeline: dict[str, Any], ref: Any, default: float) -> float:
    if ref is None:
        return default
    if isinstance(ref, (int, float)):
        return float(ref)
    text = str(ref)
    edge = "start"
    if "." in text and text.rsplit(".", 1)[1] in {"start", "end"}:
        text, edge = text.rsplit(".", 1)
    start, end = resolve_window(timeline, text)
    return end if edge == "end" else start


def _word(timeline: dict[str, Any], index: int) -> dict[str, Any]:
    for w in timeline.get("words") or []:
        if int(w["index"]) == index:
            return w
    raise TimelineError(f"no word with index {index}")


# ---------------------------------------------------------------------------
# Captions (ASS)
# ---------------------------------------------------------------------------

CAPTION_STYLES: dict[str, dict[str, Any]] = {
    # karaoke: phrase stays up, the active word is highlighted
    "karaoke": {"font": "Arial Black", "size": 78, "bold": True, "outline": 6, "shadow": 3, "margin_v": 300,
                 "upper": True, "highlight": "&H00E5FF", "highlight_scale": 112, "align": 2},
    "bold": {"font": "Arial Black", "size": 72, "bold": True, "outline": 6, "shadow": 2, "margin_v": 320,
             "upper": True, "highlight": None, "align": 2},
    "clean": {"font": "Helvetica", "size": 58, "bold": True, "outline": 3, "shadow": 1, "margin_v": 230,
              "upper": False, "highlight": None, "align": 2},
    "ugc": {"font": "Helvetica", "size": 64, "bold": True, "outline": 4, "shadow": 0, "margin_v": 360,
            "upper": False, "highlight": None, "align": 2},
    "pop": {"font": "Arial Black", "size": 96, "bold": True, "outline": 8, "shadow": 0, "margin_v": 560,
            "upper": True, "highlight": "&H00E5FF", "highlight_scale": 118, "align": 2, "word_by_word": True},
}
CJK_FONT = "PingFang SC"


def _ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _ass_colour(value: str | None, default: str = "&H00FFFFFF") -> str:
    if not value:
        return default
    text = value.strip()
    if text.startswith("&H"):
        return text if len(text) == 10 else "&H00" + text[2:]
    text = text.lstrip("#")
    if len(text) == 6:  # RRGGBB -> &H00BBGGRR
        return f"&H00{text[4:6]}{text[2:4]}{text[0:2]}".upper()
    raise TimelineError(f"colour must be #RRGGBB or &HBBGGRR, got {value!r}")


def captions_ass(
    timeline: dict[str, Any],
    *,
    style: str = "karaoke",
    width: int = 1080,
    height: int = 1920,
    role_colors: dict[str, str] | None = None,
    font: str | None = None,
    size: int | None = None,
    margin_v: int | None = None,
    hold: float = 0.6,
    extra_events: list[str] | None = None,
    extra_styles: list[str] | None = None,
) -> str:
    if style not in CAPTION_STYLES:
        raise TimelineError(f"unknown caption style {style!r}; choose from {', '.join(CAPTION_STYLES)}")
    preset = dict(CAPTION_STYLES[style])
    words = {int(w["index"]): w for w in timeline.get("words") or []}
    all_text = " ".join(str(w.get("display") or "") for w in words.values())
    font_name = font or (CJK_FONT if CJK_RE.search(all_text) else preset["font"])
    font_size = size or preset["size"]
    mv = margin_v if margin_v is not None else preset["margin_v"]
    role_colors = role_colors or {}
    styles = [
        f"Style: Cap,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
        f"{-1 if preset['bold'] else 0},0,0,0,100,100,0,0,1,{preset['outline']},{preset['shadow']},{preset['align']},60,60,{mv},1"
    ]
    for role, colour in role_colors.items():
        styles.append(
            f"Style: Cap-{role},{font_name},{font_size},{_ass_colour(colour)},&H000000FF,&H00000000,&H80000000,"
            f"{-1 if preset['bold'] else 0},0,0,0,100,100,0,0,1,{preset['outline']},{preset['shadow']},{preset['align']},60,60,{mv},1"
        )
    styles.extend(extra_styles or [])
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding\n" + "\n".join(styles) + "\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events: list[str] = []
    phrases = timeline.get("phrases") or []
    duration = float(timeline.get("duration") or 0.0)
    cjk = bool(CJK_RE.search(all_text))
    for pi, phrase in enumerate(phrases):
        pw = [words[i] for i in phrase["words"] if i in words and words[i].get("display")]
        if not pw:
            continue
        role = str(phrase.get("role") or "")
        style_name = f"Cap-{role}" if role in role_colors else "Cap"
        next_start = float(phrases[pi + 1]["start"]) if pi + 1 < len(phrases) else duration
        phrase_end = min(next_start, float(phrase["end"]) + hold) if pi + 1 < len(phrases) else min(duration, float(phrase["end"]) + hold)
        joiner = "" if cjk else " "

        def render(active: int | None) -> str:
            parts = []
            for wi, w in enumerate(pw):
                text = str(w["display"])
                if preset.get("upper") and not cjk:
                    text = text.upper()
                text = text.replace("{", "\\{").replace("}", "\\}")
                if active is not None and wi == active and preset.get("highlight"):
                    hl = preset["highlight"]
                    sc = preset.get("highlight_scale", 110)
                    parts.append(f"{{\\c{hl}&\\fscx{sc}\\fscy{sc}\\bord{preset['outline'] + 2}}}{text}{{\\r{style_name}}}")
                else:
                    parts.append(text)
            return joiner.join(parts)

        if preset.get("word_by_word"):
            for wi, w in enumerate(pw):
                end = float(pw[wi + 1]["start"]) if wi + 1 < len(pw) else phrase_end
                text = str(w["display"]).upper() if preset.get("upper") and not cjk else str(w["display"])
                events.append(f"Dialogue: 1,{_ass_time(float(w['start']))},{_ass_time(end)},{style_name},,0,0,0,,{text}")
        elif preset.get("highlight"):
            for wi, w in enumerate(pw):
                start = float(w["start"]) if wi > 0 else float(phrase["start"])
                end = float(pw[wi + 1]["start"]) if wi + 1 < len(pw) else phrase_end
                if end <= start:
                    continue
                events.append(f"Dialogue: 1,{_ass_time(start)},{_ass_time(end)},{style_name},,0,0,0,,{render(wi)}")
        else:
            events.append(f"Dialogue: 1,{_ass_time(float(phrase['start']))},{_ass_time(phrase_end)},{style_name},,0,0,0,,{render(None)}")
    events.extend(extra_events or [])
    return header + "\n".join(events) + "\n"


# ---------------------------------------------------------------------------
# Rendering plan
# ---------------------------------------------------------------------------

TEXT_STYLES: dict[str, dict[str, Any]] = {
    "stamp": {"font": "Impact", "size": 150, "color": "#FF2B2B", "outline_color": "#FFFFFF", "outline": 10,
               "rotate": -8, "pop": True, "align": 8, "margin_v": 330},
    "title": {"font": "Arial Black", "size": 96, "color": "#FFFFFF", "outline_color": "#000000", "outline": 8,
               "rotate": 0, "pop": False, "align": 8, "margin_v": 220},
    "verdict": {"font": "Arial Black", "size": 120, "color": "#FFE060", "outline_color": "#000000", "outline": 10,
                 "rotate": -4, "pop": True, "align": 5, "margin_v": 0},
    "note": {"font": "Helvetica", "size": 52, "color": "#FFFFFF", "outline_color": "#000000", "outline": 4,
              "rotate": 0, "pop": False, "align": 8, "margin_v": 160},
}


def _fmt(value: float) -> str:
    return f"{value:.3f}"


def _px(value: Any, total: int) -> int:
    if isinstance(value, str) and value.strip().endswith("%"):
        return int(round(total * float(value.strip()[:-1]) / 100.0))
    return int(round(float(value)))


def _builtin_sfx(name: str, out_dir: Path) -> Path:
    ffmpeg = which("ffmpeg")
    if not ffmpeg:
        raise MediaToolError("ffmpeg is not installed")
    recipes = {
        "pop": ("sine=frequency=880:duration=0.18", "afade=t=in:d=0.005,afade=t=out:st=0.05:d=0.13,volume=0.9"),
        "ding": ("sine=frequency=1320:duration=0.35", "afade=t=in:d=0.005,afade=t=out:st=0.08:d=0.27,volume=0.7"),
        "thud": ("sine=frequency=110:duration=0.22", "afade=t=in:d=0.002,afade=t=out:st=0.04:d=0.18,volume=1.0"),
        "whoosh": ("anoisesrc=color=pink:duration=0.3:amplitude=0.6", "afade=t=in:d=0.08,afade=t=out:st=0.12:d=0.18,volume=0.8"),
        "click": ("sine=frequency=2000:duration=0.05", "afade=t=out:st=0.01:d=0.04,volume=0.6"),
        # cartoon / variety-show cues, all synthesized
        "boing": ("aevalsrc=0.7*sin(2*PI*t*(520+260*sin(2*PI*t*7)))*exp(-5*t):d=0.55:s=48000", "volume=0.9"),
        "tada": ("aevalsrc=0.3*(sin(2*PI*523*t)+sin(2*PI*659*t)+sin(2*PI*784*t)+0.6*sin(2*PI*1047*t))*exp(-3*t):d=0.8:s=48000", "afade=t=in:d=0.01,volume=0.9"),
        "sparkle": ("aevalsrc=0.25*(sin(2*PI*2093*t)*exp(-9*t)+sin(2*PI*2637*t)*exp(-7*(t-0.08))*gt(t\\,0.08)+sin(2*PI*3136*t)*exp(-6*(t-0.16))*gt(t\\,0.16)):d=0.6:s=48000", "volume=0.8"),
        "bubble": ("aevalsrc=0.6*sin(2*PI*t*(320+1400*t))*exp(-14*t):d=0.3:s=48000", "volume=0.9"),
        "swoosh": ("anoisesrc=color=white:duration=0.35:amplitude=0.8:seed=7", "bandpass=f=1800:width_type=o:w=1.5,afade=t=in:d=0.12,afade=t=out:st=0.18:d=0.17,volume=0.9"),
        "hit": ("aevalsrc=0.9*sin(2*PI*t*(180-140*t))*exp(-9*t)+0.3*random(0)*exp(-30*t):d=0.35:s=48000", "volume=1.0"),
        "tap": ("aevalsrc=0.7*sin(2*PI*t*(900-500*t))*exp(-40*t):d=0.12:s=48000", "volume=0.8"),
        "buzz": ("aevalsrc=0.35*sin(2*PI*110*t)*(1+0.5*sin(2*PI*30*t))*lt(mod(t\\,0.09)\\,0.06):d=0.45:s=48000", "afade=t=out:st=0.3:d=0.15,volume=0.8"),
        "drumroll": ("aevalsrc=0.5*random(0)*exp(-60*mod(t\\,0.06)):d=1.2:s=48000", "lowpass=f=1200,afade=t=out:st=0.9:d=0.3,volume=0.7"),
    }
    if name not in recipes:
        raise TimelineError(f"unknown builtin sound {name!r}; choose from {', '.join(recipes)}")
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"sfx-{name}.wav"
    if not path.exists():
        source, chain = recipes[name]
        subprocess.run([ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i", source, "-af", chain, str(path)], check=True)
    return path


def render_plan(
    timeline: dict[str, Any],
    plan: dict[str, Any],
    *,
    out: str | Path,
    work_dir: str | Path,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Turn a plan into one FFmpeg render. Returns the command and layer resolution report."""
    if plan.get("format") not in {None, PLAN_FORMAT}:
        raise TimelineError(f"plan must be {PLAN_FORMAT}")
    ffmpeg = which("ffmpeg")
    if not ffmpeg:
        raise MediaToolError("ffmpeg is not installed")
    work = Path(work_dir)
    work.mkdir(parents=True, exist_ok=True)
    canvas = plan.get("canvas") or {}
    W = int(canvas.get("width", 1080)); H = int(canvas.get("height", 1920)); fps = float(canvas.get("fps", 0) or 0)
    duration = float(plan.get("duration") or timeline.get("duration") or 0.0)
    takes = {t["id"]: t for t in timeline.get("takes") or []}

    inputs: list[list[str]] = []
    filters: list[str] = []
    report: list[dict[str, Any]] = []

    def add_input(argv: list[str]) -> int:
        inputs.append(argv)
        return len(inputs) - 1

    # -- base picture --------------------------------------------------------------
    base = plan.get("base") or {}
    base_kind = "takes"
    if base.get("media"):
        idx = add_input(["-i", str(base["media"])])
        filters.append(f"[{idx}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[base]")
        base_audio = f"[{idx}:a]" if probe(str(base["media"])).has_audio and not base.get("mute") else None
        base_kind = "media"
    elif base.get("color") or not takes:
        colour = str(base.get("color") or "#000000").lstrip("#")
        idx = add_input(["-f", "lavfi", "-t", _fmt(duration), "-i", f"color=c=0x{colour}:s={W}x{H}:r={fps or 30}"])
        filters.append(f"[{idx}:v]format=yuv420p[base]")
        base_audio = None
        base_kind = "color"
    else:
        # concatenate takes on the program clock (gaps become black)
        parts_v: list[str] = []
        parts_a: list[str] = []
        ordered = sorted(takes.values(), key=lambda t: float(t["start"]))
        cursor = 0.0
        for n, t in enumerate(ordered):
            gap = float(t["start"]) - cursor
            if gap > 0.02:
                gidx = add_input(["-f", "lavfi", "-t", _fmt(gap), "-i", f"color=c=black:s={W}x{H}:r={fps or 30}"])
                filters.append(f"[{gidx}:v]format=yuv420p,setsar=1[gapv{n}]")
                aidx = add_input(["-f", "lavfi", "-t", _fmt(gap), "-i", "anullsrc=r=48000:cl=stereo"])
                parts_v.append(f"[gapv{n}]"); parts_a.append(f"[{aidx}:a]")
            idx = add_input(["-i", str(t["media"])])
            info = probe(str(t["media"]))
            video_idx = idx
            if not info.has_video:
                video_idx = add_input(["-f", "lavfi", "-t", _fmt(float(t["duration"])), "-i",
                                       f"color=c=black:s={W}x{H}:r={fps or 30}"])
            filters.append(
                f"[{video_idx}:v]setpts=PTS-STARTPTS,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
                + (f",fps={fps}" if fps else "") + f"[tv{n}]"
            )
            if info.has_audio:
                filters.append(f"[{idx}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[ta{n}]")
            else:
                sidx = add_input(["-f", "lavfi", "-t", _fmt(float(t["duration"])), "-i", "anullsrc=r=48000:cl=stereo"])
                filters.append(f"[{sidx}:a]anull[ta{n}]")
            parts_v.append(f"[tv{n}]"); parts_a.append(f"[ta{n}]")
            cursor = float(t["start"]) + float(t["duration"])
        if len(parts_v) == 1:
            filters.append(f"{parts_v[0]}null[base]")
            filters.append(f"{parts_a[0]}anull[basea]")
        else:
            filters.append("".join(f"{v}{a}" for v, a in zip(parts_v, parts_a)) + f"concat=n={len(parts_v)}:v=1:a=1[base][basea]")
        base_audio = "[basea]"
        if base.get("mute"):
            filters.append("[basea]anullsink")
            base_audio = None

    current = "[base]"
    audio_inputs: list[str] = []
    if base_audio:
        if base_kind == "media":
            filters.append(f"{base_audio}aresample=48000,aformat=channel_layouts=stereo,volume={float(base.get('gain', 1.0))}[basea]")
            audio_inputs.append("[basea]")
        else:
            filters.append(f"[basea]volume={float(base.get('gain', 1.0))}[basea2]")
            audio_inputs.append("[basea2]")

    # -- captions and text share one ASS file ----------------------------------------
    caption_layer = next((l for l in plan.get("layers") or [] if l.get("type") == "captions"), None)
    text_layers = [l for l in plan.get("layers") or [] if l.get("type") == "text"]
    ass_path: Path | None = None
    if caption_layer is not None or text_layers:
        extra_styles: list[str] = []
        extra_events: list[str] = []
        for n, layer in enumerate(text_layers):
            preset = dict(TEXT_STYLES.get(str(layer.get("style", "title")), TEXT_STYLES["title"]))
            preset.update({k: v for k, v in layer.items() if k in preset})
            start, end = resolve_window(timeline, layer.get("during", layer.get("at")), default_len=float(layer.get("for", duration)))
            if layer.get("at") is not None and layer.get("during") is None and layer.get("for") is None:
                end = duration
            text = str(layer.get("text") or "")
            font_name = preset["font"] if not CJK_RE.search(text) else CJK_FONT
            extra_styles.append(
                f"Style: Text{n},{font_name},{preset['size']},{_ass_colour(preset['color'])},&H000000FF,"
                f"{_ass_colour(preset['outline_color'], '&H00000000')},&H80000000,-1,0,0,0,100,100,2,0,1,{preset['outline']},0,"
                f"{preset['align']},40,40,{preset['margin_v']},1"
            )
            tags = ""
            if preset.get("rotate"):
                tags += f"\\frz{preset['rotate']}"
            if layer.get("x") is not None and layer.get("y") is not None:
                tags += f"\\an5\\pos({_px(layer['x'], W)},{_px(layer['y'], H)})"
            if preset.get("pop"):
                tags += "\\fscx40\\fscy40\\t(0,120,\\fscx100\\fscy100)"
            if layer.get("fade"):
                tags += f"\\fad({int(float(layer['fade']) * 1000)},{int(float(layer['fade']) * 1000)})"
            safe = text.replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")
            extra_events.append(f"Dialogue: 3,{_ass_time(start)},{_ass_time(end)},Text{n},,0,0,0,,{{{tags}}}{safe}" if tags else f"Dialogue: 3,{_ass_time(start)},{_ass_time(end)},Text{n},,0,0,0,,{safe}")
            report.append({"layer": f"text:{text[:24]}", "start": round(start, 3), "end": round(end, 3)})
        if caption_layer is not None and caption_layer.get("source"):
            ass_text = Path(str(caption_layer["source"])).read_text(encoding="utf-8")
            if extra_styles or extra_events:
                ass_text = _merge_ass(ass_text, extra_styles, extra_events)
        else:
            c = caption_layer or {}
            ass_text = captions_ass(
                timeline, style=str(c.get("style", "karaoke")), width=W, height=H,
                role_colors=c.get("role_colors"), font=c.get("font"), size=c.get("size"), margin_v=c.get("margin_v"),
                hold=float(c.get("hold", 0.6)), extra_events=extra_events, extra_styles=extra_styles,
            ) if caption_layer is not None else captions_ass({**timeline, "phrases": []}, width=W, height=H, extra_events=extra_events, extra_styles=extra_styles)
        ass_path = work / "overlay.ass"
        ass_path.write_text(ass_text, encoding="utf-8")

    # -- picture layers ------------------------------------------------------------------
    n_layer = 0
    auto_sfx: list[dict[str, Any]] = []

    def overlay_xy(x: int, y: int, layer_spec: dict[str, Any]) -> str:
        """Static position, or a per-frame jitter expression when the layer asks for one."""
        jitter = float(layer_spec.get("jitter", 0) or 0)
        if not jitter:
            return f"{x}:{y}"
        seed = int(layer_spec.get("jitter_seed", n_layer))
        return (f"x='{x}+{jitter:.2f}*(random({seed})-0.5)*2':y='{y}+{jitter:.2f}*(random({seed + 101})-0.5)*2'"
                f":eval=frame")

    for layer in plan.get("layers") or []:
        kind = str(layer.get("type") or "")
        if kind in {"captions", "text", "audio", "sfx", "music"}:
            continue
        n_layer += 1
        tag = f"l{n_layer}"
        if kind == "sequence":
            # PNG sequence (entrance animation) played from the window start, then held or looped
            start, end = resolve_window(timeline, layer.get("during", layer.get("at")), default_len=float(layer.get("for", 0) or 0))
            if layer.get("for") is not None and layer.get("at") is not None:
                end = start + float(layer["for"])
            if end <= start:
                end = duration
            source = str(layer["source"])
            manifest: dict[str, Any] = {}
            if source.endswith(".json"):
                manifest = json.loads(Path(source).read_text(encoding="utf-8"))
                pattern = str(manifest.get("pattern") or "")
            elif Path(source).is_dir():
                seq_json = Path(source) / "sequence.json"
                manifest = json.loads(seq_json.read_text(encoding="utf-8")) if seq_json.is_file() else {}
                pattern = str(manifest.get("pattern") or str(Path(source) / "f%04d.png"))
            else:
                pattern = source
            seq_fps = float(layer.get("fps") or manifest.get("fps") or 24)
            n_frames = int(layer.get("frames") or manifest.get("frames") or len(list(Path(pattern).parent.glob("f*.png"))))
            loop_frames = int(manifest.get("loop_frames") or 0)
            entrance_frames = int(manifest.get("entrance_frames") or n_frames)
            frame = layer.get("frame") or {}
            x = _px(frame.get("x", 0), W); y = _px(frame.get("y", 0), H)
            window = max(0.0, end - start)
            loop_wanted = bool(layer.get("loop", loop_frames > 0))
            if loop_wanted and loop_frames > 0:
                # play the entrance once, then loop the tail frames for the rest of the window
                idx = add_input(["-framerate", f"{seq_fps:g}", "-i", pattern])
                loops = int(math.ceil(max(0.0, window - entrance_frames / seq_fps) * seq_fps / loop_frames)) + 1
                filters.append(f"[{idx}:v]loop=loop={loops}:size={loop_frames}:start={entrance_frames},"
                               f"trim=duration={_fmt(window)},format=yuva420p,setpts=PTS-STARTPTS+{_fmt(start)}/TB[{tag}]")
            else:
                idx = add_input(["-framerate", f"{seq_fps:g}", "-i", pattern])
                hold = max(0.0, window - n_frames / seq_fps)
                filters.append(f"[{idx}:v]tpad=stop_mode=clone:stop_duration={_fmt(hold)},"
                               f"trim=duration={_fmt(window)},format=yuva420p,setpts=PTS-STARTPTS+{_fmt(start)}/TB[{tag}]")
            filters.append(f"{current}[{tag}]overlay={overlay_xy(x, y, layer)}:enable='between(t,{_fmt(start)},{_fmt(end)})'[v{n_layer}]")
            current = f"[v{n_layer}]"
            report.append({"layer": f"sequence:{Path(pattern).parent.name}", "start": round(start, 3), "end": round(end, 3),
                           "frames": n_frames, "fps": seq_fps, "loop": loop_wanted and loop_frames > 0})
            if layer.get("sfx"):
                auto_sfx.append({"type": "sfx", "builtin": layer["sfx"], "at": start, "gain": layer.get("sfx_gain", 1.0)})
            continue
        if kind in {"image", "video"}:
            start, end = resolve_window(timeline, layer.get("during", layer.get("at")), default_len=float(layer.get("for", 0) or 0))
            if layer.get("for") is not None and layer.get("at") is not None:
                end = start + float(layer["for"])
            if end <= start:
                end = duration if layer.get("during") is None else end
            frame = layer.get("frame") or {}
            x = _px(frame.get("x", 0), W); y = _px(frame.get("y", 0), H)
            w = _px(frame["w"], W) if frame.get("w") is not None else None
            h = _px(frame["h"], H) if frame.get("h") is not None else None
            fit = str(layer.get("fit", "cover"))
            if kind == "image":
                idx = add_input(["-loop", "1", "-t", _fmt(duration), "-i", str(layer["source"])])
                chain = f"[{idx}:v]"
            else:
                idx = add_input(["-i", str(layer["source"])])
                # play the clip from its own start when the window opens
                chain = f"[{idx}:v]setpts=PTS-STARTPTS+{_fmt(start)}/TB,"
                chain = chain.rstrip(",") + ","
                if not layer.get("mute", True) and probe(str(layer["source"])).has_audio:
                    filters.append(f"[{idx}:a]atrim=0:{_fmt(end - start)},asetpts=PTS-STARTPTS,"
                                   f"aresample=48000,aformat=channel_layouts=stereo,"
                                   f"adelay={int(start * 1000)}|{int(start * 1000)},volume={float(layer.get('gain', 1.0))}[la{n_layer}]")
                    audio_inputs.append(f"[la{n_layer}]")
                chain = f"[{idx}:v]setpts=PTS-STARTPTS+{_fmt(start)}/TB,"
            scale = ""
            if w and h:
                scale = (f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}" if fit == "cover"
                         else f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black@0")
            elif w:
                scale = f"scale={w}:-2"
            elif h:
                scale = f"scale=-2:{h}"
            steps = [s for s in (scale, "format=yuva420p") if s]
            fade_in = float(layer.get("fade_in", 0) or 0); fade_out = float(layer.get("fade_out", 0) or 0)
            if fade_in:
                steps.append(f"fade=t=in:st={_fmt(start)}:d={_fmt(fade_in)}:alpha=1")
            if fade_out:
                steps.append(f"fade=t=out:st={_fmt(max(start, end - fade_out))}:d={_fmt(fade_out)}:alpha=1")
            if layer.get("opacity") is not None:
                steps.append(f"colorchannelmixer=aa={float(layer['opacity'])}")
            filters.append(chain + ",".join(steps) + f"[{tag}]")
            filters.append(f"{current}[{tag}]overlay={overlay_xy(x, y, layer)}:enable='between(t,{_fmt(start)},{_fmt(end)})'[v{n_layer}]")
            current = f"[v{n_layer}]"
            report.append({"layer": f"{kind}:{Path(str(layer['source'])).name}", "start": round(start, 3), "end": round(end, 3)})
            if layer.get("sfx"):
                auto_sfx.append({"type": "sfx", "builtin": layer["sfx"], "at": start, "gain": layer.get("sfx_gain", 1.0)})
        elif kind == "states":
            # ordered states; each with optional from/until anchors; gaps fall back to previous state
            frame = layer.get("frame") or {}
            x = _px(frame.get("x", 0), W); y = _px(frame.get("y", 0), H)
            states = list(layer.get("states") or [])
            windows: list[tuple[float, float, str]] = []
            prev_end = 0.0
            for si, state in enumerate(states):
                s = _time_value(timeline, state.get("from"), prev_end) if state.get("from") is not None else prev_end
                if state.get("until") is not None:
                    e = _time_value(timeline, state["until"], duration)
                elif si + 1 < len(states) and states[si + 1].get("from") is not None:
                    e = _time_value(timeline, states[si + 1]["from"], duration)
                else:
                    e = duration
                windows.append((s, max(e, s), str(state["source"])))
                prev_end = max(e, s)
            for si, (s, e, source) in enumerate(windows):
                if e <= s:
                    continue
                idx = add_input(["-loop", "1", "-t", _fmt(duration), "-i", source])
                st = f"{tag}s{si}"
                filters.append(f"[{idx}:v]format=yuva420p[{st}]")
                filters.append(f"{current}[{st}]overlay={overlay_xy(x, y, layer)}:enable='between(t,{_fmt(s)},{_fmt(e)})'[v{n_layer}s{si}]")
                current = f"[v{n_layer}s{si}]"
                report.append({"layer": f"state:{Path(source).name}", "start": round(s, 3), "end": round(e, 3)})
                if layer.get("sfx") and si > 0:
                    auto_sfx.append({"type": "sfx", "builtin": layer["sfx"], "at": s, "gain": layer.get("sfx_gain", 1.0)})
        else:
            raise TimelineError(f"unknown layer type {kind!r}")

    if ass_path is not None:
        escaped = str(ass_path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        filters.append(f"{current}ass='{escaped}'[vout]")
    else:
        filters.append(f"{current}null[vout]")

    # -- audio layers ---------------------------------------------------------------------
    for layer in list(plan.get("layers") or []) + auto_sfx:
        kind = str(layer.get("type") or "")
        if kind not in {"audio", "music", "sfx"}:
            continue
        n_layer += 1
        tag = f"a{n_layer}"
        if kind == "sfx":
            source = _builtin_sfx(str(layer["builtin"]), work) if layer.get("builtin") else Path(str(layer["source"]))
            at, _ = resolve_window(timeline, layer.get("at"))
            idx = add_input(["-i", str(source)])
            filters.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume={float(layer.get('gain', 1.0))},adelay={int(at * 1000)}|{int(at * 1000)}[{tag}]")
            audio_inputs.append(f"[{tag}]")
            report.append({"layer": f"sfx:{source.name}", "start": round(at, 3), "end": round(at, 3)})
            continue
        start, end = resolve_window(timeline, layer.get("during", layer.get("at", "program")), default_len=duration)
        if layer.get("at") is not None and layer.get("during") is None:
            end = duration
        idx = add_input((["-stream_loop", "-1"] if layer.get("loop") else []) + ["-i", str(layer["source"])])
        gain = float(layer.get("gain", 1.0)); fi = float(layer.get("fade_in", 0) or 0); fo = float(layer.get("fade_out", 0) or 0)
        chain = [f"[{idx}:a]aresample=48000", "aformat=channel_layouts=stereo", f"atrim=0:{_fmt(end - start)}", "asetpts=PTS-STARTPTS"]
        if fi:
            chain.append(f"afade=t=in:d={_fmt(fi)}")
        if fo:
            chain.append(f"afade=t=out:st={_fmt(max(0.0, end - start - fo))}:d={_fmt(fo)}")
        chain.append(f"volume={gain}")
        if start > 0:
            chain.append(f"adelay={int(start * 1000)}|{int(start * 1000)}")
        filters.append(",".join(chain) + f"[{tag}]")
        audio_inputs.append(f"[{tag}]")
        report.append({"layer": f"{kind}:{Path(str(layer['source'])).name}", "start": round(start, 3), "end": round(end, 3)})

    if audio_inputs:
        if len(audio_inputs) == 1:
            filters.append(f"{audio_inputs[0]}anull[aout]")
        else:
            filters.append("".join(audio_inputs) + f"amix=inputs={len(audio_inputs)}:normalize=0:duration=longest,atrim=0:{_fmt(duration)}[aout]")
    else:
        sidx = add_input(["-f", "lavfi", "-t", _fmt(duration), "-i", "anullsrc=r=48000:cl=stereo"])
        filters.append(f"[{sidx}:a]anull[aout]")

    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    encode = plan.get("encode") or {}
    argv = [ffmpeg, "-v", "error", "-y"]
    for item in inputs:
        argv += item
    argv += ["-filter_complex", ";".join(filters), "-map", "[vout]", "-map", "[aout]",
             "-t", _fmt(duration), "-c:v", str(encode.get("video_codec", "libx264")), "-preset", str(encode.get("preset", "medium")),
             "-crf", str(encode.get("crf", 18)), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", str(encode.get("audio_bitrate", "192k")),
             "-movflags", "+faststart"]
    if fps:
        argv += ["-r", str(fps)]
    argv.append(str(out_path))
    command_text = " ".join(shlex.quote(a) for a in argv)
    (work / "ffmpeg-command.txt").write_text(command_text + "\n", encoding="utf-8")
    result: dict[str, Any] = {
        "output": str(out_path), "work_dir": str(work), "duration": round(duration, 3), "canvas": {"width": W, "height": H, "fps": fps},
        "layers": report, "command_file": str(work / "ffmpeg-command.txt"), "ass": str(ass_path) if ass_path else None,
        "dry_run": dry_run,
    }
    if dry_run:
        result["command"] = command_text
        return result
    if ass_path is not None:
        available = subprocess.run([ffmpeg, "-hide_banner", "-filters"], capture_output=True, text=True)
        if available.returncode != 0:
            raise MediaToolError("could not query ffmpeg filters: " + (available.stderr.strip() or "unknown error"))
        if not any(len(parts) > 1 and parts[1] == "ass" for parts in (line.split() for line in available.stdout.splitlines())):
            raise MediaToolError("ffmpeg render requires the ass subtitle filter (libass); install an FFmpeg build with libass")
    proc = subprocess.run(argv, capture_output=True, text=True)
    if proc.returncode != 0:
        raise MediaToolError("ffmpeg render failed: " + (proc.stderr.strip().splitlines() or ["unknown"])[-1])
    result["probe"] = probe(out_path).as_dict()
    return result


def _merge_ass(ass_text: str, styles: list[str], events: list[str]) -> str:
    lines = ass_text.splitlines()
    out: list[str] = []
    for line in lines:
        out.append(line)
        if line.startswith("Format: Name, Fontname"):
            out.extend(styles)
    if events:
        out.extend(events)
    return "\n".join(out) + "\n"
