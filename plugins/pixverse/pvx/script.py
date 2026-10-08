"""Semantic script: spoken words with caption cues, roles, pronunciation and named anchors.

The script is the single source of truth for what is said. Caption text comes from it, the
performance prompt comes from it, and every graphic that must land on a word points at one
of its named anchors instead of a second value. Timing arrives later from the actual
performance (see `pvx.timeline`), so a rewrite or a new take moves the graphics with it.

Text form (one file, plain UTF-8):

    # comments start with a hash
    [hook]                              -> a segment (default: "main")
    HOST: Tea is D tier. || Bro has more @{leaves}leaves than flavor.@{/leaves}
    GUEST: <API|A P I> is @{verdict!}fine.

    ||            caption cue break between complete units
    <shown|said>  display text and pronunciation differ; <shown|> same words; <|said> spoken only
    @{name}       open a selection at the next word's start
    @{/name}      close a selection at the previous word's end
    @{name!}      moment at the next word's start; @{~name!} at the previous word's end
    word{emphasis,size=2}   attributes on the preceding display word
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

SCRIPT_FORMAT = "pvx.script@1"
NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
ROLE_LINE_RE = re.compile(r"^([A-Za-z][\w-]{0,31}):\s*(.*)$")
SEGMENT_LINE_RE = re.compile(r"^\[([a-z][a-z0-9_-]{0,63})\]\s*$")
TOKEN_RE = re.compile(
    r"@\{[^}]*\}"                                  # markers, even when glued to a word
    r"|<[^<>]*\|[^<>]*>[^\s@<|{]*"                   # dual text, trailing punctuation stays attached
    r"|\|\|"                                        # cue break
    r"|(?:(?!@\{|\|\||<[^<>]*\|)[^\s])+"            # ordinary token, stops before a marker/cue/dual
)
ATTR_RE = re.compile(r"^(?P<word>.+?)\{(?P<attrs>[^{}]*)\}$")
CJK_RE = re.compile("[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]")


class ScriptError(ValueError):
    pass


@dataclass
class ScriptWord:
    index: int
    display: str
    spoken: str
    segment: str
    role: str
    phrase: int
    attrs: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "index": self.index,
            "display": self.display,
            "spoken": self.spoken,
            "segment": self.segment,
            "role": self.role,
            "phrase": self.phrase,
        }
        if self.attrs:
            out["attrs"] = self.attrs
        return out


@dataclass
class Anchor:
    name: str
    kind: str  # "selection" | "moment"
    start_word: int
    start_edge: str  # "start" | "end" of that word
    end_word: int | None = None
    end_edge: str = "end"

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "name": self.name,
            "kind": self.kind,
            "start_word": self.start_word,
            "start_edge": self.start_edge,
        }
        if self.kind == "selection":
            out["end_word"] = self.end_word
            out["end_edge"] = self.end_edge
        return out


@dataclass
class Script:
    words: list[ScriptWord] = field(default_factory=list)
    anchors: dict[str, Anchor] = field(default_factory=dict)
    segments: list[str] = field(default_factory=list)
    source: str = ""

    # -- projections ---------------------------------------------------------------
    def phrases(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for word in self.words:
            if not rows or rows[-1]["index"] != word.phrase:
                rows.append({"index": word.phrase, "segment": word.segment, "role": word.role, "words": []})
            rows[-1]["words"].append(word.index)
        return rows

    def display_text(self, segment: str | None = None) -> str:
        return " ".join(w.display for w in self.words if w.display and (segment is None or w.segment == segment))

    def spoken_text(self, segment: str | None = None) -> str:
        return " ".join(w.spoken for w in self.words if w.spoken and (segment is None or w.segment == segment))

    def dialogue(self, segment: str | None = None) -> str:
        """Role-aware spoken text, one line per turn, ready for a performance prompt."""
        lines: list[str] = []
        current_role = None
        buffer: list[str] = []
        for word in self.words:
            if segment is not None and word.segment != segment:
                continue
            if word.role != current_role:
                if buffer:
                    lines.append((f"{current_role}: " if current_role else "") + " ".join(buffer))
                current_role, buffer = word.role, []
            if word.spoken:
                buffer.append(word.spoken)
        if buffer:
            lines.append((f"{current_role}: " if current_role else "") + " ".join(buffer))
        return "\n".join(lines)

    def as_dict(self) -> dict[str, Any]:
        return {
            "format": SCRIPT_FORMAT,
            "source": self.source,
            "segments": self.segments,
            "words": [w.as_dict() for w in self.words],
            "phrases": self.phrases(),
            "anchors": {name: anchor.as_dict() for name, anchor in self.anchors.items()},
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Script":
        script = cls(source=str(payload.get("source") or ""), segments=list(payload.get("segments") or []))
        for row in payload.get("words") or []:
            script.words.append(
                ScriptWord(
                    index=int(row["index"]),
                    display=str(row.get("display") or ""),
                    spoken=str(row.get("spoken") or ""),
                    segment=str(row.get("segment") or "main"),
                    role=str(row.get("role") or ""),
                    phrase=int(row.get("phrase") or 0),
                    attrs=dict(row.get("attrs") or {}),
                )
            )
        for name, row in (payload.get("anchors") or {}).items():
            script.anchors[name] = Anchor(
                name=name,
                kind=str(row.get("kind") or "selection"),
                start_word=int(row.get("start_word") or 0),
                start_edge=str(row.get("start_edge") or "start"),
                end_word=row.get("end_word"),
                end_edge=str(row.get("end_edge") or "end"),
            )
        return script


def parse_script(text: str, *, source: str = "") -> Script:
    script = Script(source=source)
    segment = "main"
    role = ""
    phrase = 0
    phrase_has_words = False
    open_selections: dict[str, tuple[int, str]] = {}
    pending_starts: list[tuple[str, str]] = []  # (name, kind) waiting for the next word
    prev_word_index: int | None = None

    def next_word_index() -> int:
        return len(script.words)

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        seg_match = SEGMENT_LINE_RE.match(line)
        if seg_match:
            segment = seg_match.group(1)
            if segment not in script.segments:
                script.segments.append(segment)
            if phrase_has_words:
                phrase += 1
                phrase_has_words = False
            continue
        role_match = ROLE_LINE_RE.match(line)
        if role_match and not line.startswith("<") and not line.startswith("@"):
            role = role_match.group(1).upper()
            line = role_match.group(2)
            if phrase_has_words:
                phrase += 1
                phrase_has_words = False
        if segment not in script.segments:
            script.segments.append(segment)
        for token in TOKEN_RE.findall(line):
            if token == "||":
                if phrase_has_words:
                    phrase += 1
                    phrase_has_words = False
                continue
            if token.startswith("@{") and token.endswith("}"):
                body = token[2:-1].strip()
                if body.startswith("/"):
                    name = body[1:].rstrip("~")
                    tilde = body.endswith("~")
                    _check_name(name)
                    if name not in open_selections:
                        raise ScriptError(f"@{{/{name}}} closes a selection that was never opened")
                    start_word, start_edge = open_selections.pop(name)
                    if tilde:
                        # close at the next word's start
                        pending_starts.append((f"/{name}", "close-next"))
                        script.anchors[name] = Anchor(name, "selection", start_word, start_edge, None, "start")
                    else:
                        if prev_word_index is None:
                            raise ScriptError(f"@{{/{name}}} has no previous word to close on")
                        script.anchors[name] = Anchor(name, "selection", start_word, start_edge, prev_word_index, "end")
                    continue
                moment = body.endswith("!")
                name = body.rstrip("!")
                prev_edge = name.startswith("~")
                name = name.lstrip("~")
                _check_name(name)
                if name in script.anchors or name in open_selections:
                    raise ScriptError(f"anchor {name} is defined twice")
                if moment:
                    if prev_edge:
                        if prev_word_index is None:
                            raise ScriptError(f"@{{~{name}!}} has no previous word")
                        script.anchors[name] = Anchor(name, "moment", prev_word_index, "end")
                    else:
                        pending_starts.append((name, "moment"))
                else:
                    if prev_edge:
                        if prev_word_index is None:
                            raise ScriptError(f"@{{~{name}}} has no previous word")
                        open_selections[name] = (prev_word_index, "end")
                    else:
                        pending_starts.append((name, "selection"))
                continue
            display, spoken, attrs = _split_token(token)
            index = next_word_index()
            script.words.append(ScriptWord(index, display, spoken, segment, role, phrase, attrs))
            phrase_has_words = True
            for name, kind in pending_starts:
                if kind == "moment":
                    script.anchors[name] = Anchor(name, "moment", index, "start")
                elif kind == "selection":
                    open_selections[name] = (index, "start")
                elif kind == "close-next":
                    real = name[1:]
                    anchor = script.anchors[real]
                    anchor.end_word = index
                    anchor.end_edge = "start"
            pending_starts = []
            prev_word_index = index
    if pending_starts:
        names = ", ".join(name for name, _ in pending_starts)
        raise ScriptError(f"markers without a following word: {names}")
    if open_selections:
        raise ScriptError(f"unclosed selections: {', '.join(sorted(open_selections))}")
    if not script.words:
        raise ScriptError("script contains no words")
    return script


def _check_name(name: str) -> None:
    if not NAME_RE.match(name):
        raise ScriptError(f"invalid anchor name {name!r}; use [a-z][a-z0-9_-]*")


def _split_token(token: str) -> tuple[str, str, dict[str, Any]]:
    attrs: dict[str, Any] = {}
    attr_match = ATTR_RE.match(token)
    if attr_match and not token.startswith("<"):
        token = attr_match.group("word")
        attrs = _parse_attrs(attr_match.group("attrs"))
    if token.startswith("<") and ">" in token and "|" in token:
        close = token.rfind(">")
        inner, suffix = token[1:close], token[close + 1:]
        display, _, spoken = inner.partition("|")
        display, spoken = display.strip(), spoken.strip()
        if not display and not spoken:
            raise ScriptError(f"empty dual text {token!r}")
        if not spoken:
            spoken = display
        if suffix:
            display = display + suffix if display else display
            spoken = spoken + suffix
        return display, spoken, attrs
    return token, token, attrs


def _parse_attrs(body: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for part in body.split(","):
        part = part.strip()
        if not part:
            continue
        key, sep, value = part.partition("=")
        if not sep:
            out[key] = True
        else:
            value = value.strip()
            if value.lower() in {"true", "false"}:
                out[key] = value.lower() == "true"
            else:
                try:
                    out[key] = float(value) if "." in value else int(value)
                except ValueError:
                    out[key] = value
    return out


def load_script(path_or_text: str, *, is_text: bool = False) -> Script:
    from pathlib import Path

    if is_text:
        return parse_script(path_or_text)
    path = Path(path_or_text)
    body = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        payload = json.loads(body)
        if payload.get("format") != SCRIPT_FORMAT:
            raise ScriptError(f"{path} is not a {SCRIPT_FORMAT} document")
        return Script.from_dict(payload)
    return parse_script(body, source=str(path))


# ---------------------------------------------------------------------------
# Duration estimate
# ---------------------------------------------------------------------------

PACE_UNITS_PER_SECOND = {
    "en": {"slow": 4.2, "normal": 4.6, "fast": 5.0},
    "zh": {"slow": 3.3, "normal": 3.9, "fast": 4.6},
    "ja": {"slow": 5.6, "normal": 6.4, "fast": 7.2},
    "ko": {"slow": 4.6, "normal": 5.3, "fast": 6.0},
    "es": {"slow": 5.0, "normal": 5.6, "fast": 6.2},
}
DEFAULT_CUE_PAUSE = 0.30
DEFAULT_TURN_PAUSE = 0.45
DEFAULT_PADDING = 0.40


def syllable_units(text: str, language: str = "auto") -> int:
    """Rough pronunciation units: CJK characters count one each; Latin words by vowel groups."""
    units = 0
    for token in re.findall("[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]|[A-Za-z']+|\\d+", text):
        if CJK_RE.match(token):
            units += 1
        elif token.isdigit():
            units += max(1, len(token))
        else:
            units += _latin_syllables(token)
    return units


def _latin_syllables(word: str) -> int:
    w = word.lower().strip("'")
    if not w:
        return 0
    if len(w) <= 2:
        return 1
    if w.isupper() or (len(w) <= 4 and not re.search(r"[aeiouy]", w)):
        return len(w)  # initialisms are read letter by letter
    groups = re.findall(r"[aeiouy]+", w)
    count = len(groups)
    if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and count > 1:
        count -= 1
    if w.endswith("ed") and count > 1 and not re.search(r"[td]ed$", w):
        count -= 1
    return max(1, count)


def detect_language(text: str) -> str:
    cjk = len(CJK_RE.findall(text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if cjk and cjk >= latin / 3:
        if re.search("[\\u3040-\\u30ff]", text):
            return "ja"
        if re.search("[\\uac00-\\ud7af]", text):
            return "ko"
        return "zh"
    return "en"


def measure(
    script: Script | None = None,
    *,
    text: str | None = None,
    segment: str | None = None,
    language: str = "auto",
    pace: str = "normal",
    rate: float | None = None,
    cue_pause: float = DEFAULT_CUE_PAUSE,
    turn_pause: float = DEFAULT_TURN_PAUSE,
    padding: float = DEFAULT_PADDING,
    rounding: str = "none",
) -> dict[str, Any]:
    if script is None and text is None:
        raise ScriptError("measure needs a script or text")
    if script is not None:
        words = [w for w in script.words if segment is None or w.segment == segment]
        spoken = " ".join(w.spoken for w in words)
        cues = max(0, len({w.phrase for w in words}) - 1)
        turns = 0
        last_role = None
        for w in words:
            if w.role != last_role and last_role is not None:
                turns += 1
            last_role = w.role
    else:
        spoken = text or ""
        cues = spoken.count("||")
        turns = 0
    lang = detect_language(spoken) if language in {"auto", ""} else language
    units = syllable_units(spoken, lang)
    table = PACE_UNITS_PER_SECOND.get(lang, PACE_UNITS_PER_SECOND["en"])
    if rate is None:
        if pace not in table:
            raise ScriptError(f"pace must be one of {', '.join(table)}")
        rate = table[pace]
    speech = units / rate if rate else 0.0
    seconds = speech + cues * cue_pause + turns * turn_pause + padding
    estimate = seconds
    if rounding == "ceil":
        import math

        estimate = float(math.ceil(seconds))
    elif rounding == "round":
        estimate = float(round(seconds))
    return {
        "seconds": round(estimate, 2),
        "raw_seconds": round(seconds, 2),
        "units": units,
        "language": lang,
        "pace": pace if rate == table.get(pace) else "custom",
        "rate": rate,
        "cue_breaks": cues,
        "role_turns": turns,
        "padding": padding,
        "note": (
            "Estimate for a natural read; generated performances often add expressive pauses. "
            "Choose the request duration from this estimate, the intended performance and the model's supported values."
        ),
    }
