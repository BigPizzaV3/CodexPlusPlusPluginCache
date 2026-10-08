#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import struct
from pathlib import Path
from tempfile import TemporaryDirectory

VERSION = "0.5.0"
MARKER = "MEMORY_KEEPER_V4_2026-09-17"
REQUIRED_SKILLS = {
    "using-memory-keeper",
    "maintaining-project-memory",
    "auditing-persistent-state",
    "organizing-persistent-files",
    "repairing-memory-state",
    "recovering-persistent-work",
    "verifying-persistent-work",
    "maintaining-memory-keeper",
}
FORBIDDEN_PARTS = {"__pycache__"}
FORBIDDEN_SUFFIXES = {".pyc", ".pyo", ".tmp"}
OPENAI_CATEGORIES = {
    "Productivity", "Creativity", "Developer Tools", "Business & Operations",
    "Data & Analytics", "Communication", "Education & Research", "Security",
    "Finance", "Healthcare", "Travel", "Entertainment", "Other",
}


def _openai_interface(manifest: dict, codex: dict) -> dict:
    ext = manifest.get("extensions")
    if isinstance(ext, dict):
        oa = ext.get("com.openai")
        if isinstance(oa, dict):
            iface = oa.get("interface")
            if isinstance(iface, dict):
                return iface
    iface = codex.get("interface") if isinstance(codex, dict) else None
    return iface if isinstance(iface, dict) else {}


def _png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        data = path.read_bytes()[:24]
    except OSError:
        return None
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def lint_openai_directory_metadata(plugin: Path, manifest: dict, codex: dict, errors: list[str]) -> None:
    author = manifest.get("author")
    if not isinstance(author, dict) or not isinstance(author.get("name"), str) or not author["name"].strip():
        fail(errors, "author.name missing")

    iface = _openai_interface(manifest, codex)
    if not iface:
        fail(errors, "OpenAI interface missing")
        return

    def req_text(key: str, max_len: int, *, label: str | None = None) -> None:
        value = iface.get(key)
        label = label or key
        if not isinstance(value, str) or not value.strip():
            fail(errors, f"{label} missing")
        elif "\n" in value or "\r" in value:
            fail(errors, f"{label} must be one line")
        elif len(value) > max_len:
            fail(errors, f"{label} exceeds {max_len} characters")

    req_text("displayName", 30)
    req_text("shortDescription", 30)
    req_text("developerName", 80)
    long_description = iface.get("longDescription")
    if not isinstance(long_description, str) or not long_description.strip():
        fail(errors, "longDescription missing")
    elif len(long_description) > 4000:
        fail(errors, "longDescription exceeds 4000 characters")

    category = iface.get("category")
    if category is not None and category not in OPENAI_CATEGORIES:
        fail(errors, f"unsupported OpenAI category: {category}")

    capabilities = iface.get("capabilities", [])
    if not isinstance(capabilities, list):
        fail(errors, "capabilities must be a list")
    else:
        if len(capabilities) > 20:
            fail(errors, "capabilities has more than 20 entries")
        for value in capabilities:
            if not isinstance(value, str) or not value.strip() or "\n" in value or "\r" in value or len(value) > 120:
                fail(errors, "capability entry is invalid")

    prompts = iface.get("defaultPrompt", [])
    if not isinstance(prompts, list):
        fail(errors, "defaultPrompt must be a list")
    else:
        if len(prompts) > 3:
            fail(errors, "defaultPrompt has more than 3 entries")
        normalized: list[str] = []
        for prompt in prompts:
            if not isinstance(prompt, str) or not prompt.strip() or "\n" in prompt or "\r" in prompt or len(prompt) > 128:
                fail(errors, "defaultPrompt entry is invalid")
                continue
            if re.search(r"(^|\s)@\S+", prompt):
                fail(errors, "defaultPrompt contains @mention")
            normalized.append(" ".join(prompt.split()))
        if len(normalized) != len(set(normalized)):
            fail(errors, "defaultPrompt contains duplicates")

    brand = iface.get("brandColor")
    if brand is not None and (not isinstance(brand, str) or not re.fullmatch(r"#[0-9A-Fa-f]{6}", brand)):
        fail(errors, "brandColor must be #RRGGBB")

    for key in ("composerIcon", "logo"):
        rel = iface.get(key)
        if not isinstance(rel, str) or not rel.strip():
            fail(errors, f"{key} missing")
            continue
        if not rel.startswith("./") or ".." in Path(rel).parts:
            fail(errors, f"{key} path is invalid")
            continue
        asset = plugin / rel[2:]
        if not asset.is_file():
            fail(errors, f"{key} file missing: {rel}")
            continue
        if asset.stat().st_size > 5 * 1024 * 1024:
            fail(errors, f"{key} exceeds 5 MiB")
        if asset.suffix.lower() == ".png":
            dims = _png_dimensions(asset)
            if dims is None:
                fail(errors, f"{key} PNG is unreadable")
            else:
                w, h = dims
                if w != h:
                    fail(errors, f"{key} image is not square")
                if w < 48 or w > 4096:
                    fail(errors, f"{key} dimensions outside 48..4096")


def fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


def find_plugin_root(root: Path) -> Path | None:
    if (root / "plugin.json").is_file() and (root / "skills").is_dir():
        return root
    nested = root / "plugins" / "memory-keeper"
    if (nested / "plugin.json").is_file():
        return nested
    matches = [p for p in root.rglob("plugin.json") if p.parent.name == "memory-keeper" or (p.parent / "skills").is_dir()]
    return matches[0].parent if len(matches) == 1 else None


def lint_tree(root: Path) -> list[str]:
    errors: list[str] = []
    plugin = find_plugin_root(root)
    skills_root = (plugin / "skills") if plugin else (root / "skills")
    fallback_bundle = plugin is None and skills_root.is_dir()
    if not plugin and not fallback_bundle:
        return ["cannot resolve Memory Keeper plugin root or skills fallback bundle"]

    for p in root.rglob("*"):
        if any(part in FORBIDDEN_PARTS for part in p.parts):
            fail(errors, f"forbidden cache path: {p.relative_to(root)}")
        if p.is_file() and (p.suffix.lower() in FORBIDDEN_SUFFIXES or p.name.endswith("~")):
            fail(errors, f"forbidden generated/temp file: {p.relative_to(root)}")
        if p.is_file() and p.suffix.lower() == ".zip" and p != root:
            fail(errors, f"nested release ZIP is forbidden: {p.relative_to(root)}")

    if plugin:
        try:
            manifest = json.loads((plugin / "plugin.json").read_text(encoding="utf-8"))
            codex = json.loads((plugin / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
        except Exception as exc:
            return errors + [f"manifest parse failure: {exc}"]

        if manifest.get("version") != VERSION:
            fail(errors, f"plugin.json version != {VERSION}")
        if codex.get("version") != VERSION:
            fail(errors, f".codex-plugin/plugin.json version != {VERSION}")
        lint_openai_directory_metadata(plugin, manifest, codex, errors)
        corpus_manifest = json.dumps(manifest).lower() + json.dumps(codex).lower()
        if "mcp" in corpus_manifest:
            fail(errors, "MCP declaration found in skills-only plugin")

    skills = {
        p.name for p in skills_root.iterdir()
        if p.is_dir() and (p / "SKILL.md").is_file()
    }
    if skills != REQUIRED_SKILLS:
        fail(errors, f"skill set mismatch: {sorted(skills)}")

    for name in REQUIRED_SKILLS:
        path = skills_root / name / "SKILL.md"
        if not path.is_file():
            fail(errors, f"missing required skill: {name}")
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        if not re.search(rf"(?m)^name:\s*{re.escape(name)}\s*$", content):
            fail(errors, f"skill frontmatter name mismatch: {name}")
        m = re.search(r"(?m)^description:\s*(.+)$", content)
        if not m or not m.group(1).strip('"').startswith("Use when"):
            fail(errors, f"skill description is not trigger-shaped: {name}")

    docs = []
    for name in ("README.md", "MEMORY_KEEPER_SPEC.md", "MEMOIRE_GLOBALE.md", "SUBMISSION.md", "INSTALL.md"):
        candidates = [root / name] + ([plugin / name] if plugin else [])
        for c in candidates:
            if c.is_file():
                docs.append(c.read_text(encoding="utf-8", errors="replace"))
                break
    corpus = "\n".join(docs)
    if docs and VERSION not in corpus:
        fail(errors, f"documentation missing version {VERSION}")
    if docs and MARKER not in corpus:
        fail(errors, f"documentation missing marker {MARKER}")

    marker_re = re.compile(r"MEMORY_KEEPER_V\d+_\d{4}-\d{2}-\d{2}")
    for text_path in root.rglob("*"):
        if not text_path.is_file() or text_path.suffix.lower() not in {".md", ".json", ".py"}:
            continue
        try:
            text = text_path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            fail(errors, f"cannot inspect text file {text_path.relative_to(root)}: {exc}")
            continue
        for found in marker_re.findall(text):
            if found != MARKER:
                fail(errors, f"stale diagnostic marker {found}: {text_path.relative_to(root)}")

    return sorted(set(errors))


def lint_zip(path: Path) -> list[str]:
    try:
        with TemporaryDirectory(prefix="mk-lint-") as td:
            base = Path(td).resolve()
            with zipfile.ZipFile(path) as zf:
                for member in zf.infolist():
                    target = (base / member.filename).resolve()
                    try:
                        target.relative_to(base)
                    except ValueError:
                        return [f"unsafe ZIP member path: {member.filename}"]
                zf.extractall(td)
            return lint_tree(base)
    except (zipfile.BadZipFile, OSError) as exc:
        return [f"cannot read ZIP: {exc}"]


def main() -> int:
    ap = argparse.ArgumentParser(description="Lint Memory Keeper package/source tree")
    ap.add_argument("path")
    args = ap.parse_args()
    path = Path(args.path).resolve()
    errors = lint_zip(path) if path.is_file() and path.suffix.lower() == ".zip" else lint_tree(path)
    if errors:
        print("Memory Keeper package lint: FAIL")
        for e in errors:
            print("ERROR:", e)
        return 1
    print("Memory Keeper package lint: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
