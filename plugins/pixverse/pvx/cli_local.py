"""Local (credit-free) command groups: media, script, timeline, graphics.

These commands prepare and inspect material with FFmpeg, Pillow and an optional local
speech aligner. They never contact PixVerse. Paid generation stays in `queue`.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import media as media_mod
from .media import MediaToolError, Transcript, import_words
from .python_dependencies import PythonDependencyError, ensure_pillow
from .script import Script, ScriptError, load_script, measure
from .timeline import (
    PLAN_FORMAT,
    TimelineError,
    build_timeline,
    captions_ass,
    load_timeline,
    render_plan,
    resolve_window,
)


def _print(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _error(code: str, message: str, **extra: Any) -> int:
    _print({"error": code, "message": message, **extra})
    return 2


def _floats(text: str | None) -> list[float] | None:
    if not text:
        return None
    return [float(part) for part in text.replace(";", ",").split(",") if part.strip()]


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------


def build_local_parsers(sub: argparse._SubParsersAction) -> None:
    media = sub.add_parser("media", help="Inspect and prepare media locally: probe, frames, tile, boundaries, cut, fetch, transcribe.")
    media_sub = media.add_subparsers(dest="media_command", required=True)

    probe = media_sub.add_parser("probe", help="Duration, streams, size and frame rate.")
    probe.add_argument("file")

    frames = media_sub.add_parser("frames", help="Save individual frames named by source time.")
    frames.add_argument("file")
    frames.add_argument("--to", required=True, help="Output directory.")
    frames.add_argument("--at", default="", help="Comma-separated seconds.")
    frames.add_argument("--every", type=float, default=None, help="Sample interval in seconds.")
    frames.add_argument("--count", type=int, default=None, help="Evenly spaced sample count.")
    frames.add_argument("--start", type=float, default=0.0)
    frames.add_argument("--end", type=float, default=None)
    frames.add_argument("--width", type=int, default=None, help="Scale frames to this width.")
    frames.add_argument("--label-time", action="store_true", help="Write the source time under each frame.")
    frames.add_argument("--words", default="", help="Word-timing JSON; labels each frame with the words spoken there.")

    tile = media_sub.add_parser("tile", help="One contact sheet with time (and word) labels.")
    tile.add_argument("file")
    tile.add_argument("--to", required=True, help="Output image (.jpg/.png).")
    tile.add_argument("--at", default="")
    tile.add_argument("--every", type=float, default=None)
    tile.add_argument("--count", type=int, default=None)
    tile.add_argument("--start", type=float, default=0.0)
    tile.add_argument("--end", type=float, default=None)
    tile.add_argument("--columns", type=int, default=4)
    tile.add_argument("--cell", type=int, default=320, help="Cell width in pixels.")
    tile.add_argument("--words", default="", help="Word-timing JSON for word labels.")

    boundaries = media_sub.add_parser("boundaries", help="Mechanical visual-change candidates (not shot labels).")
    boundaries.add_argument("file")
    boundaries.add_argument("--threshold", type=float, default=0.3)

    cut = media_sub.add_parser("cut", help="Save one interval as a clip.")
    cut.add_argument("file")
    cut.add_argument("--start", type=float, required=True)
    cut.add_argument("--end", type=float, required=True)
    cut.add_argument("--to", required=True)
    cut.add_argument("--copy", action="store_true", help="Stream copy instead of re-encoding (keyframe accuracy only).")

    fetch = media_sub.add_parser("fetch", help="Save a linked video locally with an installed yt-dlp.")
    fetch.add_argument("url")
    fetch.add_argument("--to", required=True, help="New .mp4 path.")
    fetch.add_argument("--max-height", type=int, default=1080)

    transcribe = media_sub.add_parser("transcribe", help="Measure word times with a local Whisper, or convert an existing word JSON.")
    transcribe.add_argument("file", nargs="?", default="")
    transcribe.add_argument("--to", required=True, help="Output words JSON (pvx.words@1).")
    transcribe.add_argument("--language", default="", help="ISO code such as en, zh, ja, es; empty = auto.")
    transcribe.add_argument("--model", default="small", help="Whisper model size.")
    transcribe.add_argument("--words-from", default="", help="Convert an existing whisper/whisperx/words JSON instead of running a model.")

    script = sub.add_parser("script", help="Parse and measure a semantic script (phrases, roles, pronunciation, anchors).")
    script_sub = script.add_subparsers(dest="script_command", required=True)
    parse = script_sub.add_parser("parse", help="Parse a script file and print its words, phrases, anchors and dialogue.")
    parse.add_argument("script", help="Script text file or pvx.script@1 JSON.")
    parse.add_argument("--to", default="", help="Write the parsed pvx.script@1 JSON here.")
    parse.add_argument("--segment", default="", help="Only print this segment's projections.")
    meas = script_sub.add_parser("measure", help="Estimate spoken seconds before choosing a request duration.")
    meas.add_argument("script", nargs="?", default="", help="Script file (or use --text).")
    meas.add_argument("--text", default="", help="Plain text instead of a script file; `||` still counts as a pause.")
    meas.add_argument("--segment", default="")
    meas.add_argument("--language", default="auto")
    meas.add_argument("--pace", default="normal", choices=["slow", "normal", "fast"])
    meas.add_argument("--rate", type=float, default=None, help="Units per second, overrides --pace.")
    meas.add_argument("--padding", type=float, default=0.4)
    meas.add_argument("--rounding", default="none", choices=["none", "round", "ceil"])

    timeline = sub.add_parser("timeline", help="Bind script words to measured performance time and render anchored layers.")
    timeline_sub = timeline.add_subparsers(dest="timeline_command", required=True)
    build = timeline_sub.add_parser("build", help="Align each take against the script and place takes on one program clock.")
    build.add_argument("--script", required=True, help="Script text file or pvx.script@1 JSON.")
    build.add_argument(
        "--take",
        action="append",
        default=[],
        required=True,
        help="<id>=<media>[:<words.json>][@<segment>][+<start-seconds>]; repeatable, in program order.",
    )
    build.add_argument("--to", required=True, help="Output timeline JSON (pvx.timeline@1).")
    build.add_argument("--language", default="", help="Speech language for local transcription.")
    build.add_argument("--model", default="small")
    build.add_argument("--gap", type=float, default=0.0, help="Seconds of black between takes.")
    build.add_argument("--work-dir", default="", help="Where transcriptions are written (default: beside the timeline).")
    anchors = timeline_sub.add_parser("anchors", help="Print resolved anchors, phrases and words.")
    anchors.add_argument("timeline")
    anchors.add_argument("--format", choices=["json", "markdown"], default="markdown")
    caps = timeline_sub.add_parser("captions", help="Write ASS (or SRT) captions from the timeline's phrases.")
    caps.add_argument("timeline")
    caps.add_argument("--to", required=True)
    caps.add_argument("--style", default="karaoke", help="karaoke | bold | clean | ugc | pop")
    caps.add_argument("--role-color", action="append", default=[], help="ROLE=#RRGGBB; repeatable.")
    caps.add_argument("--font", default="")
    caps.add_argument("--size", type=int, default=None)
    caps.add_argument("--margin-v", type=int, default=None)
    caps.add_argument("--width", type=int, default=1080)
    caps.add_argument("--height", type=int, default=1920)
    caps.add_argument("--hold", type=float, default=0.6, help="Seconds a phrase stays after its last word.")
    render = timeline_sub.add_parser("render", help="Render a plan of anchored layers with FFmpeg.")
    render.add_argument("timeline")
    render.add_argument("--plan", required=True, help="Plan JSON (pvx.plan@1).")
    render.add_argument("--to", required=True, help="Output video.")
    render.add_argument("--work-dir", default="", help="Intermediate files (default: <output>.build/).")
    render.add_argument("--dry-run", action="store_true", help="Print the FFmpeg command without rendering.")
    window = timeline_sub.add_parser("window", help="Resolve one time reference to seconds.")
    window.add_argument("timeline")
    window.add_argument("ref")

    gfx = sub.add_parser("graphics", help="Render Pillow graphic components (tier board, cards, strips, labels) as PNG states.")
    gfx_sub = gfx.add_subparsers(dest="graphics_command", required=True)
    gfx_sub.add_parser("components", help="List available components and their state fields.")
    gr = gfx_sub.add_parser("render", help="Render every state of a component spec JSON.")
    gr.add_argument("spec")
    gr.add_argument("--to", required=True, help="Output directory.")
    gs = gfx_sub.add_parser("styles", help="List kinetic-text style packs: look, mood, entrance, sound and a prose description.")
    gs.add_argument("--family", default="", help="Only packs of this family (variety, comic, meme, kawaii, night, broadcast, handmade, retro, luxury, clean).")
    gs.add_argument("--pick", type=int, default=0, help="Randomly pick this many distinct packs from the selection (reproducible with --seed).")
    gs.add_argument("--seed", type=int, default=None, help="Seed for --pick; printed so the choice can be repeated.")
    sheet = gfx_sub.add_parser("sheet", help="Render every style pack with sample text into one contact sheet.")
    sheet.add_argument("--to", required=True, help="Output image (.jpg/.png).")
    sheet.add_argument("--text", action="append", default=[], help="Sample text; repeat for several languages.")
    sheet.add_argument("--family", default="")
    an = gfx_sub.add_parser("animate", help="Turn a rendered PNG (full canvas) into an entrance/loop PNG sequence.")
    an.add_argument("png")
    an.add_argument("--to", required=True, help="Output sequence directory.")
    an.add_argument("--entrance", default="pop", help="pop | stamp | bounce | drop | slide-left | slide-right | slide-up | wobble | flicker | fade | none")
    an.add_argument("--loop", default="none", help="shake | pulse | sway | none")
    an.add_argument("--fps", type=int, default=24)
    an.add_argument("--seconds", type=float, default=0.35, help="Entrance length in seconds.")
    an.add_argument("--loop-seconds", type=float, default=0.5)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def dispatch_local(args: argparse.Namespace) -> int:
    try:
        if (args.command == "graphics" and args.graphics_command in {"render", "sheet", "animate"}) or (
            args.command == "media" and (
                args.media_command == "tile" or
                (args.media_command == "frames" and args.label_time)
            )
        ):
            ensure_pillow()
        if args.command == "media":
            return _media(args)
        if args.command == "script":
            return _script(args)
        if args.command == "timeline":
            return _timeline(args)
        if args.command == "graphics":
            return _graphics(args)
    except PythonDependencyError as exc:
        return _error(
            "dependency_install_failed",
            str(exc),
            dependency="Pillow",
            python=sys.executable,
        )
    except MediaToolError as exc:
        return _error("media_tool_error", str(exc))
    except ScriptError as exc:
        return _error("script_error", str(exc))
    except TimelineError as exc:
        return _error("timeline_error", str(exc))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return _error("invalid_input", str(exc))
    return 2


def _load_words(path: str) -> Transcript | None:
    return import_words(path) if path else None


def _media(args: argparse.Namespace) -> int:
    if args.media_command == "probe":
        _print(media_mod.probe(args.file).as_dict())
        return 0
    if args.media_command == "frames":
        rows = media_mod.frames(
            args.file, args.to, at=_floats(args.at), every=args.every, count=args.count, start=args.start,
            end=args.end, width=args.width, label_time=args.label_time, transcript=_load_words(args.words),
        )
        _print({"file": args.file, "frames": rows})
        return 0
    if args.media_command == "tile":
        _print(media_mod.tile(
            args.file, args.to, start=args.start, end=args.end, every=args.every, count=args.count, at=_floats(args.at),
            columns=args.columns, cell=args.cell, transcript=_load_words(args.words),
        ))
        return 0
    if args.media_command == "boundaries":
        _print({"file": args.file, "threshold": args.threshold, "candidates": media_mod.boundaries(args.file, threshold=args.threshold),
                "note": "Mechanical adjacent-frame change candidates; inspect frames before calling any of them a cut."})
        return 0
    if args.media_command == "cut":
        target = media_mod.cut(args.file, args.to, start=args.start, end=args.end, reencode=not args.copy)
        _print(media_mod.probe(target).as_dict())
        return 0
    if args.media_command == "fetch":
        _print(media_mod.fetch(args.url, args.to, max_height=args.max_height))
        return 0
    if args.media_command == "transcribe":
        if args.words_from:
            transcript = import_words(args.words_from)
            transcript.language = args.language or transcript.language
        elif args.file:
            transcript = media_mod.transcribe(args.file, language=args.language, model=args.model,
                                              work_dir=Path(args.to).parent / f".{Path(args.to).stem}-work")
        else:
            return _error("missing_input", "Pass a media file or --words-from <json>.")
        target = Path(args.to)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = transcript.as_dict()
        target.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        _print({"path": str(target), "tool": transcript.tool, "language": transcript.language,
                "words": len(transcript.words), "text": payload["text"]})
        return 0
    return 2


def _script(args: argparse.Namespace) -> int:
    if args.script_command == "parse":
        script = load_script(args.script)
        payload = script.as_dict()
        segment = args.segment or None
        payload["display_text"] = script.display_text(segment)
        payload["spoken_text"] = script.spoken_text(segment)
        payload["dialogue"] = script.dialogue(segment)
        if args.to:
            Path(args.to).parent.mkdir(parents=True, exist_ok=True)
            Path(args.to).write_text(json.dumps(script.as_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            payload["written"] = args.to
        _print(payload)
        return 0
    if args.script_command == "measure":
        if args.text:
            result = measure(text=args.text, language=args.language, pace=args.pace, rate=args.rate,
                             padding=args.padding, rounding=args.rounding)
        elif args.script:
            script = load_script(args.script)
            result = measure(script, segment=args.segment or None, language=args.language, pace=args.pace,
                             rate=args.rate, padding=args.padding, rounding=args.rounding)
        else:
            return _error("missing_input", "Pass a script file or --text.")
        _print(result)
        return 0
    return 2


def _parse_take(spec: str) -> dict[str, Any]:
    """<id>=<media>[:<words.json>][@<segment>][+<start>]"""
    if "=" not in spec:
        raise TimelineError(f"--take needs <id>=<media>[...], got {spec!r}")
    take_id, rest = spec.split("=", 1)
    start = None
    if "+" in rest and rest.rsplit("+", 1)[1].replace(".", "", 1).isdigit():
        rest, start_text = rest.rsplit("+", 1)
        start = float(start_text)
    segment = None
    if "@" in rest:
        rest, segment = rest.rsplit("@", 1)
    media = rest
    words = ""
    # a words file is separated by ':' but Windows drive letters also contain ':'
    if ":" in rest:
        head, tail = rest.rsplit(":", 1)
        if tail.lower().endswith(".json"):
            media, words = head, tail
    return {"id": take_id.strip(), "media": media.strip(), "words": words.strip(), "segment": segment, "start": start}


def _timeline(args: argparse.Namespace) -> int:
    if args.timeline_command == "build":
        script = load_script(args.script)
        target = Path(args.to)
        work = Path(args.work_dir) if args.work_dir else target.parent / f".{target.stem}-work"
        takes: list[dict[str, Any]] = []
        for spec in args.take:
            take = _parse_take(spec)
            if not Path(take["media"]).is_file():
                return _error("media_not_found", f"take {take['id']}: {take['media']} does not exist")
            if take["words"]:
                transcript = import_words(take["words"])
            else:
                print(f"[pvx] transcribing {take['id']} locally ({take['media']})", file=sys.stderr, flush=True)
                transcript = media_mod.transcribe(take["media"], language=args.language, model=args.model, work_dir=work / take["id"])
                words_path = work / f"{take['id']}.words.json"
                words_path.parent.mkdir(parents=True, exist_ok=True)
                words_path.write_text(json.dumps(transcript.as_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                take["words"] = str(words_path)
            takes.append({**take, "transcript": transcript})
        timeline = build_timeline(script, takes, gap=args.gap)
        timeline["script_document"] = script.as_dict()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(timeline, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        summary = {
            "path": str(target),
            "duration": timeline["duration"],
            "takes": [{"id": t["id"], "start": t["start"], "duration": t["duration"], "confidence": t["alignment"].get("confidence"),
                       "unmatched_words": t["alignment"].get("unmatched_words"),
                       "extra_asr_words": t["alignment"].get("extra_asr_words"),
                       "subdivided_asr_tokens": t["alignment"].get("subdivided_asr_tokens"),
                       "needs_review": t["alignment"].get("needs_review")} for t in timeline["takes"]],
            "anchors": timeline["anchors"],
        }
        _print(summary)
        return 0
    timeline = load_timeline(args.timeline)
    if args.timeline_command == "anchors":
        if args.format == "json":
            _print({"duration": timeline["duration"], "anchors": timeline["anchors"], "phrases": timeline["phrases"], "words": timeline["words"]})
        else:
            print(_anchors_markdown(timeline))
        return 0
    if args.timeline_command == "window":
        start, end = resolve_window(timeline, args.ref)
        _print({"ref": args.ref, "start": round(start, 3), "end": round(end, 3)})
        return 0
    if args.timeline_command == "captions":
        role_colors: dict[str, str] = {}
        for item in args.role_color:
            role, _, colour = item.partition("=")
            if role and colour:
                role_colors[role.strip().upper()] = colour.strip()
        target = Path(args.to)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.suffix.lower() == ".srt":
            target.write_text(_srt(timeline), encoding="utf-8")
        else:
            target.write_text(captions_ass(
                timeline, style=args.style, width=args.width, height=args.height, role_colors=role_colors,
                font=args.font or None, size=args.size, margin_v=args.margin_v, hold=args.hold,
            ), encoding="utf-8")
        _print({"path": str(target), "style": args.style, "phrases": len(timeline.get("phrases") or []), "role_colors": role_colors})
        return 0
    if args.timeline_command == "render":
        plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
        if plan.get("format") not in {None, PLAN_FORMAT}:
            return _error("invalid_plan", f"plan must be {PLAN_FORMAT}")
        target = Path(args.to)
        work = Path(args.work_dir) if args.work_dir else target.with_suffix("").parent / f"{target.stem}.build"
        result = render_plan(timeline, plan, out=target, work_dir=work, dry_run=args.dry_run)
        _print(result)
        return 0
    return 2


def _srt(timeline: dict[str, Any]) -> str:
    def stamp(t: float) -> str:
        ms = int(round(t * 1000))
        h, rem = divmod(ms, 3_600_000)
        m, rem = divmod(rem, 60_000)
        s, ms = divmod(rem, 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    rows: list[str] = []
    phrases = timeline.get("phrases") or []
    for n, phrase in enumerate(phrases, start=1):
        end = float(phrase["end"]) + 0.3
        if n < len(phrases):
            end = min(end, float(phrases[n]["start"]))
        rows.append(f"{n}\n{stamp(float(phrase['start']))} --> {stamp(end)}\n{phrase.get('text', '')}\n")
    return "\n".join(rows)


def _anchors_markdown(timeline: dict[str, Any]) -> str:
    lines = [f"# Timeline ({timeline['duration']:.2f}s)", "", "| Anchor | Kind | Start | End |", "|---|---|---:|---:|"]
    for name, a in sorted(timeline.get("anchors", {}).items()):
        lines.append(f"| `{name}` | {a.get('kind')} | {a.get('start', a.get('at')):.2f} | {a.get('end', a.get('at')):.2f} |")
    lines += ["", "| Phrase | Role | Start | End | Text |", "|---:|---|---:|---:|---|"]
    for p in timeline.get("phrases") or []:
        lines.append(f"| {p['index']} | {p.get('role') or ''} | {p['start']:.2f} | {p['end']:.2f} | {p.get('text', '')} |")
    unmatched = [w["display"] for w in timeline.get("words") or [] if not w.get("matched", True)]
    if unmatched:
        lines += ["", f"Unmatched words (time interpolated): {', '.join(unmatched)}"]
    return "\n".join(lines)


def _graphics(args: argparse.Namespace) -> int:
    if args.graphics_command == "components":
        _print({
            "components": {
                "tier-board": {"spec": ["tiers", "icons{key:path}", "x", "y", "width", "row_height"], "state": ["placed{tier:[icon-keys]}"]},
                "ranked-column": {"spec": ["rows[{id,rank,label,preset}]", "x", "y", "width", "row_height"], "state": ["revealed[ids]"]},
                "comment-card": {"spec": ["x", "y", "width", "plate_color"], "state": ["name", "text", "likes", "avatar"]},
                "reveal-strip": {"spec": ["slots[{text|icon}]", "y", "slot_size", "gap"], "state": ["revealed"]},
                "lower-third": {"spec": ["x", "y", "accent_color"], "state": ["name", "subtitle"]},
                "split-frame": {"spec": ["orientation", "at", "thickness", "color", "highlight_color"], "state": ["active"]},
                "highlight-box": {"spec": ["radius", "color", "thickness", "dim_outside"], "state": ["x", "y", "w", "h"]},
                "label": {"spec": ["font_size", "color", "stroke", "plate_color", "rotate"], "state": ["text", "x", "y"]},
                "kinetic-text": {"spec": ["pack", "overrides{size,fill,strokes,plate,rotate,jitter}", "animate{entrance,loop}"], "state": ["text", "x", "y", "seed", "animate"]},
                "sticker": {"spec": ["source", "key_color", "tolerance", "outline", "outline_color", "shadow", "size"], "state": ["x", "y", "rotate", "flip", "animate"]},
                "emoji-sticker": {"spec": ["size", "outline"], "state": ["text", "x", "y", "rotate", "animate"]},
            },
            "animate": {"entrance": "pop | stamp | bounce | drop | slide-left | slide-right | slide-up | wobble | flicker | fade | none",
                        "loop": "shake | pulse | sway | none", "fps": 24, "seconds": 0.35,
                        "note": "adds <id>-<state>-seq/ with f%04d.png + sequence.json; bind it with a `sequence` plan layer"},
            "spec_shape": {"component": "tier-board", "id": "board", "canvas": {"width": 1080, "height": 1920}, "states": [{"id": "empty"}, {"id": "one", "placed": {"D": ["tea"]}}]},
        })
        return 0
    if args.graphics_command == "render":
        from . import graphics as graphics_mod

        rows = graphics_mod.render_spec_file(args.spec, args.to)
        _print({"spec": args.spec, "rendered": rows})
        return 0
    if args.graphics_command == "styles":
        from . import kinetic

        rows = {
            name: {k: pack.get(k) for k in ("family", "font", "size", "entrance", "sfx", "mood", "prompt")}
            for name, pack in kinetic.STYLE_PACKS.items() if not args.family or pack.get("family") == args.family
        }
        if args.pick:
            import random

            seed = args.seed if args.seed is not None else random.randrange(1, 10_000)
            names = list(rows)
            chosen = random.Random(seed).sample(names, k=min(args.pick, len(names)))
            _print({"seed": seed, "picked": chosen, "packs": {n: rows[n] for n in chosen}})
            return 0
        _print({"packs": rows, "entrances": kinetic.ENTRANCES, "loops": kinetic.LOOPS,
                "usage": {"component": "kinetic-text", "pack": "<name>", "states": [{"id": "a", "text": "...", "x": "50%", "y": "20%", "animate": {"entrance": "pop", "loop": "shake"}}]}})
        return 0
    if args.graphics_command == "sheet":
        from . import kinetic
        from .graphics import load_font
        from PIL import Image, ImageDraw

        texts = args.text or ["NO WAY!?", "\u307e\u3055\u304b!?", "\u4e0d\u4f1a\u5427!?"]
        names = [n for n, p in kinetic.STYLE_PACKS.items() if not args.family or p.get("family") == args.family]
        cell_w, cell_h, label_w = 440, 220, 260
        sheet_im = Image.new("RGB", (label_w + cell_w * len(texts), cell_h * len(names)), (70, 70, 74))
        draw = ImageDraw.Draw(sheet_im)
        font = load_font(26, kind="text")
        for r, name in enumerate(names):
            draw.text((16, r * cell_h + cell_h // 2 - 12), name, font=font, fill=(255, 255, 255))
            for c, text in enumerate(texts):
                im = kinetic.render_kinetic_text(text, name)
                im.thumbnail((cell_w - 20, cell_h - 20), Image.LANCZOS)
                sheet_im.paste(im, (label_w + c * cell_w + (cell_w - im.width) // 2, r * cell_h + (cell_h - im.height) // 2), im)
        target = Path(args.to)
        target.parent.mkdir(parents=True, exist_ok=True)
        sheet_im.save(target, quality=90)
        _print({"path": str(target), "packs": names, "texts": texts})
        return 0
    if args.graphics_command == "animate":
        from . import kinetic
        from PIL import Image

        image = Image.open(args.png).convert("RGBA")
        bbox = image.getbbox()
        if not bbox:
            return _error("empty_image", "the PNG has no opaque pixels to animate")
        element = image.crop(bbox)
        center = ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
        manifest = kinetic.animate_element(element, canvas_size=image.size, center=center, entrance=args.entrance,
                                           loop=args.loop, fps=args.fps, entrance_seconds=args.seconds,
                                           loop_seconds=args.loop_seconds, to_dir=args.to)
        _print(manifest)
        return 0
    return 2
