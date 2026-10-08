"""Local inventory, transparent classification, exact duplicates and media previews."""
from __future__ import annotations

from collections import defaultdict
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess

from guard import (KINDS, PACKAGES, PROJECTS, SIDECARS, VAULT, Root, SafetyError,
                   canonical, collision_key, protected_name, stamp, write_new)
from workflow import make_plan, metadata_safe


def kind(path):
    suffix = path.suffix.lower()
    return next((name for name, suffixes in KINDS.items() if suffix in suffixes.split()),
                "project" if suffix in PROJECTS else "other")


def media_info(path, file_kind):
    """Optional local-only inspection. Failure never implies deletion eligibility."""
    if file_kind not in {"video", "audio"} or not shutil.which("ffprobe"):
        return {}
    try:
        result = subprocess.run([
            shutil.which("ffprobe"), "-v", "error", "-protocol_whitelist", "file,pipe",
            "-show_entries", "format=duration:format_tags=creation_time",
            "-of", "json", str(path),
        ], capture_output=True, text=True, timeout=15, check=True)
        return json.loads(result.stdout).get("format", {})
    except (OSError, ValueError, subprocess.SubprocessError):
        return {}


def date_fields(path, st, inspect_media=False):
    date = dt.datetime.fromtimestamp(st.st_mtime).astimezone()
    basis = "mtime"
    if inspect_media:
        creation = media_info(path, kind(path)).get("tags", {}).get("creation_time")
        if creation:
            try:
                date = dt.datetime.fromisoformat(creation.replace("Z", "+00:00"))
                basis = "embedded_creation_time"
            except ValueError:
                pass
        elif kind(path) == "image":
            try:
                from PIL import Image  # Optional; no dependency is installed automatically.
                with Image.open(path) as image:
                    exif = image.getexif()
                    original = exif.get_ifd(0x8769).get(36867) if hasattr(exif, "get_ifd") else None
                    if original:
                        date = dt.datetime.strptime(str(original), "%Y:%m:%d %H:%M:%S")
                        basis = "exif_original_timezone_unknown"
            except (ImportError, OSError, ValueError, TypeError, KeyError, SyntaxError):
                pass
    return {"year": str(date.year), "month": date.strftime("%Y-%m"),
            "date_iso": date.isoformat(), "date_basis": basis}


def scan(root, *, inspect_media=False):
    entries, skipped = [], []
    def walk_error(exc):
        skipped.append({"path": str(exc.filename), "reason": f"scan_error: {exc}"})
    for current, dirs, files in os.walk(root.path, followlinks=False, onerror=walk_error):
        parent = Path(current)
        allowed = []
        for name in sorted(dirs):
            rel = (parent / name).relative_to(root.path).as_posix()
            try:
                root.check(rel)
                if protected_name(name):
                    raise SafetyError("Protected folder")
                allowed.append(name)
            except (SafetyError, OSError) as exc:
                skipped.append({"path": rel, "reason": str(exc)})
        dirs[:] = allowed
        for name in sorted(files):
            rel = (parent / name).relative_to(root.path).as_posix()
            try:
                p = root.check(rel)
                st = p.lstat()
                if not stat.S_ISREG(st.st_mode):
                    raise SafetyError("Non-regular file")
                entry = {"rel_path": rel, "entry_type": "file", "kind": kind(p),
                         "size": st.st_size, "suffix": p.suffix.lower(), "observed": stamp(st),
                         **date_fields(p, st, inspect_media)}
                try:
                    root.protect_project(rel)
                    if st.st_nlink != 1:
                        raise SafetyError("Hard-linked file")
                    if name.startswith("._") or name in {".DS_Store", "Thumbs.db", "desktop.ini"}:
                        raise SafetyError("Metadata-like name; separate review required")
                    entry["eligible"] = True
                except SafetyError as exc:
                    entry.update(eligible=False, reason=str(exc))
                entries.append(entry)
            except (SafetyError, OSError) as exc:
                skipped.append({"path": rel, "reason": str(exc)})
    return {"version": 2, "root": str(root.path), "root_identity": root.id,
            "policy": root.policy, "entries": entries, "skipped": skipped}


def export_csv(path, rows, fields):
    """Human report only: formula-neutralized CSV must NOT be used as an execution plan."""
    buf = io.StringIO(newline="")
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        clean = {}
        for field in fields:
            value = row.get(field, "")
            if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
                value = "'" + value
            clean[field] = value
        writer.writerow(clean)
    write_new(path, buf.getvalue())


def classify(rel, file_kind):
    text = rel.casefold()
    tokens = set(re.findall(r"\w+", text))
    groups = [
        ({"concert", "stage", "festival", "performance", "rehearsal", "gig"}, ("演出", "音樂會", "排練"), "Concerts and Shows"),
        ({"travel", "trip", "hotel", "airport", "flight", "tokyo", "japan", "taiwan", "korea"}, ("旅行", "旅遊", "日本"), "Trips"),
        ({"beach", "ocean", "forest", "mountain", "hike", "sunset", "nature", "river"}, ("海灘", "日落", "山林"), "Nature"),
        ({"family", "birthday", "wedding", "baby", "mom", "dad"}, ("家人", "生日", "婚禮"), "Memories"),
        ({"screenshot", "capture"}, ("截圖", "錄屏"), "Screenshots"),
    ]
    for words, chinese, category in groups:
        if tokens & words or any(word in text for word in chinese):
            return category, "path keyword; review required"
    return {"audio": "Audio", "document": "Documents", "archive": "Software and Archives"}.get(file_kind, "Review Needed"), "file type only; content not inferred"


def move_plan(root, catalog, organized="_TidyGuardian_Organized", limit=1000):
    root.check(organized + "/probe")
    if catalog.get("root_identity") and catalog["root_identity"] != root.id:
        raise SafetyError("Catalog belongs to a different root")
    requests, used = [], set()
    for row in catalog["entries"]:
        src = row["rel_path"]
        if not row.get("eligible", True) or src.startswith(organized + "/"):
            continue
        root.protect_project(src)
        p = root.check(src)
        if row.get("observed") and stamp(p.lstat()) != row["observed"]:
            raise SafetyError("Catalog is stale; rescan before making a move plan")
        category, reason = classify(src, row.get("kind", kind(p)))
        # Ambiguous files stay where they are rather than being moved automatically.
        if category == "Review Needed":
            continue
        year = str(row.get("year") or "Undated")
        month = str(row.get("month") or "Unknown-Month")
        base = f"{organized}/{category}/{year}/{month}/{p.name}"
        dest, count = base, 1
        while collision_key(dest) in used or os.path.lexists(root.check(dest)):
            count += 1
            dest = str(Path(base).with_name(f"{Path(base).stem}-{count}{Path(base).suffix}"))
        used.add(collision_key(dest))
        requests.append({"action": "MOVE", "src": src, "dest": dest,
                         "reason": reason + "; date basis: " + row.get("date_basis", "mtime")})
        if len(requests) >= limit:
            break
    return make_plan(root, requests)


def duplicate_plan(root, catalog, *, preferred=(), min_size=1, max_bytes=0):
    by_size = defaultdict(list)
    for row in catalog["entries"]:
        if row.get("eligible", True) and row["size"] >= min_size and (not max_bytes or row["size"] <= max_bytes):
            by_size[row["size"]].append(row["rel_path"])
    all_paths = {r["rel_path"] for r in catalog["entries"]}
    if not set(preferred).issubset(all_paths):
        raise SafetyError("A preferred keep path is not in this inventory")
    requests = []
    for group in by_size.values():
        if len(group) < 2:
            continue
        hashes = defaultdict(list)
        for rel in group:
            root.protect_project(rel)
            snap = root.snapshot(rel)
            hashes[(snap["size"], snap["sha256"])].append(rel)
        for matches in hashes.values():
            if len(matches) < 2:
                continue
            pinned = [p for p in preferred if p in matches]
            keep = pinned[0] if pinned else min(matches, key=lambda p: (len(p), p))
            for src in sorted(set(matches) - set(pinned) - {keep}):
                requests.append({"action": "QUARANTINE", "src": src, "keep": keep,
                                 "reason": "Exact duplicate; proposed retained copy is reviewable, not deletion permission"})
    return make_plan(root, requests)


def cleanup_plan(root):
    requests = []
    for current, dirs, files in os.walk(root.path, topdown=True, followlinks=False):
        parent = Path(current)
        kept = []
        for name in dirs:
            try:
                root.check((parent / name).relative_to(root.path).as_posix())
                kept.append(name)
            except (SafetyError, OSError):
                pass
        # A pruned protected child still counts as a child. Never reinterpret its parent as empty.
        has_children = bool(dirs)
        dirs[:] = kept
        if parent == root.path or has_children or not files:
            continue
        rels = [(parent / f).relative_to(root.path).as_posix() for f in files]
        try:
            if not all(metadata_safe(root, r) for r in rels):
                continue
            for r in rels:
                root.protect_project(r)
                requests.append({"action": "METADATA", "src": r, "reason": "Signature-recognized metadata in a leaf folder; quarantine only, leave directory intact"})
        except (SafetyError, OSError):
            continue
    return make_plan(root, requests)


def thumbnails(root, catalog, folder, limit=100):
    import html
    ffmpeg = shutil.which("ffmpeg")
    cards, manifest = [], []
    if not ffmpeg:
        raise SafetyError("FFmpeg is not installed; no automatic installation is performed")
    target = folder / "thumbnails"
    target.mkdir(mode=0o700)
    media = [r for r in catalog["entries"] if r.get("kind") in {"video", "image"}][:limit]
    for row in media:
        rel = row["rel_path"]
        source = root.check(rel)
        images, errors = [], []
        before = root.snapshot(rel)
        info = media_info(source, row["kind"])
        try:
            duration = float(info.get("duration", 0))
        except (TypeError, ValueError):
            duration = 0
        samples = [0] if row["kind"] == "image" else ([duration * f for f in (0.1, 0.5, 0.9)] if duration > 0 else [0, 1, 3])
        for index, second in enumerate(samples):
            name = hashlib.sha256(rel.encode()).hexdigest()[:24] + f"-{index}.jpg"
            dest = target / name
            cmd = [ffmpeg, "-nostdin", "-n", "-v", "error", "-protocol_whitelist", "file,pipe"]
            if row["kind"] == "video":
                cmd += ["-ss", str(second)]
            cmd += ["-i", str(source), "-frames:v", "1", "-threads", "1", "-vf", "scale=360:-2", str(dest)]
            try:
                subprocess.run(cmd, capture_output=True, timeout=20, check=True)
                if dest.exists():
                    images.append(f"thumbnails/{name}")
            except (OSError, subprocess.SubprocessError) as exc:
                errors.append(type(exc).__name__)
        if before != root.snapshot(rel):
            raise SafetyError("Media changed during preview; discard this review and rescan")
        manifest.append({"rel_path": rel, "thumbnails": images, "errors": errors})
        cards.append("<article><h2>" + html.escape(rel) + "</h2>" + "".join(
            '<img width="240" alt="Local media preview" src="' + html.escape(p, quote=True) + '">' for p in images) +
            "<p>" + html.escape(", ".join(errors) or "Preview only. Blank/failed frames never authorize deletion.") + "</p></article>")
    write_new(folder / "thumbnail_manifest.json", canonical(manifest) + "\n")
    write_new(folder / "review.html", '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local media review</title><h1>Media review</h1>' + "".join(cards))
