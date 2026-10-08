#!/usr/bin/env python3
"""Create deterministic Markdown, OPML, and FreeMind-compatible mind maps."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


VERSION = "1.0.0"
MAX_NODES = 2_000
MAX_DEPTH = 64
ALLOWED_DOCUMENT_KEYS = {"title", "root"}
ALLOWED_NODE_KEYS = {"text", "children"}
ALLOWED_SYSTEM_SYMLINKS = {Path("/etc"), Path("/tmp"), Path("/var")}


class SpecError(ValueError):
    """Raised when the input or output contract is unsafe or malformed."""


@dataclass(frozen=True)
class Node:
    text: str
    children: tuple["Node", ...]


@dataclass(frozen=True)
class Document:
    title: str
    root: Node


def validate_text(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SpecError(f"{context} must be a non-empty string")
    if len(value) > 2_000:
        raise SpecError(f"{context} must be 2,000 characters or fewer")
    for character in value:
        codepoint = ord(character)
        category = unicodedata.category(character)
        if category in {"Cc", "Cs", "Zl", "Zp"}:
            raise SpecError(f"{context} contains unsupported U+{codepoint:04X}")
        is_plane_noncharacter = codepoint & 0xFFFF in {0xFFFE, 0xFFFF}
        if 0xFDD0 <= codepoint <= 0xFDEF or is_plane_noncharacter:
            raise SpecError(f"{context} contains Unicode noncharacter U+{codepoint:04X}")
    return value


def parse_document(payload: Any) -> Document:
    if not isinstance(payload, dict):
        raise SpecError("specification root must be an object")
    unknown = set(payload) - ALLOWED_DOCUMENT_KEYS
    missing = ALLOWED_DOCUMENT_KEYS - set(payload)
    if unknown:
        raise SpecError(f"specification has unsupported keys: {sorted(unknown)}")
    if missing:
        raise SpecError(f"specification is missing keys: {sorted(missing)}")

    count = 0

    def parse_node(raw: Any, context: str, depth: int) -> Node:
        nonlocal count
        if depth > MAX_DEPTH:
            raise SpecError(f"mind map exceeds maximum depth {MAX_DEPTH}")
        if not isinstance(raw, dict):
            raise SpecError(f"{context} must be an object")
        unknown_node = set(raw) - ALLOWED_NODE_KEYS
        missing_node = ALLOWED_NODE_KEYS - set(raw)
        if unknown_node:
            raise SpecError(f"{context} has unsupported keys: {sorted(unknown_node)}")
        if missing_node:
            raise SpecError(f"{context} is missing keys: {sorted(missing_node)}")
        children = raw["children"]
        if not isinstance(children, list):
            raise SpecError(f"{context}.children must be an array")
        count += 1
        if count > MAX_NODES:
            raise SpecError(f"mind map exceeds maximum node count {MAX_NODES}")
        parsed_children = tuple(
            parse_node(child, f"{context}.children[{index}]", depth + 1)
            for index, child in enumerate(children)
        )
        return Node(validate_text(raw["text"], f"{context}.text"), parsed_children)

    title = validate_text(payload["title"], "title")
    return Document(title, parse_node(payload["root"], "root", 1))


def markdown_escape(value: str) -> str:
    escaped = value.replace("\\", "\\\\")
    for character in "`*_{}[]<>#|":
        escaped = escaped.replace(character, "\\" + character)
    return escaped


def build_markdown(document: Document) -> str:
    lines = [f"# {markdown_escape(document.title)}", ""]

    def append_node(node: Node, depth: int) -> None:
        lines.append(f"{'  ' * depth}- {markdown_escape(node.text)}")
        for child in node.children:
            append_node(child, depth + 1)

    append_node(document.root, 0)
    return "\n".join(lines) + "\n"


def build_opml(document: Document) -> str:
    root = ET.Element("opml", {"version": "2.0"})
    head = ET.SubElement(root, "head")
    ET.SubElement(head, "title").text = document.title
    body = ET.SubElement(root, "body")

    def append_node(parent: ET.Element, node: Node) -> None:
        outline = ET.SubElement(parent, "outline", {"text": node.text})
        for child in node.children:
            append_node(outline, child)

    append_node(body, document.root)
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(
        root, encoding="unicode", short_empty_elements=True
    ) + "\n"


def build_freemind(document: Document) -> str:
    root = ET.Element("map", {"version": "1.0.1"})

    def append_node(parent: ET.Element, node: Node) -> None:
        element = ET.SubElement(parent, "node", {"TEXT": node.text})
        for child in node.children:
            append_node(element, child)

    append_node(root, document.root)
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(
        root, encoding="unicode", short_empty_elements=True
    ) + "\n"


def check_markdown(path: Path) -> list[str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        return [f"cannot read UTF-8 Markdown: {exc}"]
    errors: list[str] = []
    if len(lines) < 3 or not lines[0].startswith("# ") or not lines[0][2:].strip():
        errors.append("Markdown must start with a non-empty H1 title")
    if len(lines) >= 2 and lines[1] != "":
        errors.append("Markdown title must be followed by one blank line")
    bullet_depths: list[int] = []
    for number, line in enumerate(lines[2:], 3):
        if not line.strip():
            errors.append(f"unexpected blank line at line {number}")
            continue
        spaces = len(line) - len(line.lstrip(" "))
        if spaces % 2 or not line[spaces:].startswith("- ") or not line[spaces + 2 :].strip():
            errors.append(f"invalid generated bullet at line {number}")
            continue
        depth = spaces // 2
        if not bullet_depths and depth != 0:
            errors.append("root bullet must have zero indentation")
        elif bullet_depths and depth > bullet_depths[-1] + 1:
            errors.append(f"bullet depth skips a level at line {number}")
        bullet_depths.append(depth)
    if not bullet_depths:
        errors.append("Markdown contains no mind-map nodes")
    elif bullet_depths.count(0) != 1:
        errors.append("Markdown must contain exactly one root bullet")
    return errors


def check_opml(path: Path) -> list[str]:
    try:
        root = ET.fromstring(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ET.ParseError) as exc:
        return [f"cannot parse UTF-8 OPML: {exc}"]
    errors: list[str] = []
    if root.tag != "opml" or root.get("version") != "2.0":
        errors.append("root must be opml version 2.0")
    title = root.find("./head/title")
    if title is None or not (title.text or "").strip():
        errors.append("OPML head must contain a non-empty title")
    bodies = root.findall("./body")
    if len(bodies) != 1:
        errors.append("OPML must contain exactly one body")
        return errors
    top_outlines = bodies[0].findall("./outline")
    if len(top_outlines) != 1:
        errors.append("OPML body must contain exactly one root outline")
    for outline in bodies[0].iter("outline"):
        if not (outline.get("text") or "").strip():
            errors.append("every OPML outline must have non-empty text")
            break
        if set(outline.attrib) != {"text"}:
            errors.append("generated OPML outlines may contain only the text attribute")
            break
    return errors


def check_freemind(path: Path) -> list[str]:
    try:
        root = ET.fromstring(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ET.ParseError) as exc:
        return [f"cannot parse UTF-8 FreeMind XML: {exc}"]
    errors: list[str] = []
    if root.tag != "map" or root.get("version") != "1.0.1":
        errors.append("root must be a FreeMind map at version 1.0.1")
    top_nodes = root.findall("./node")
    if len(top_nodes) != 1:
        errors.append("FreeMind map must contain exactly one root node")
    if any(child.tag != "node" for child in root):
        errors.append("generated FreeMind map may contain only a root node")
    if set(root.attrib) != {"version"}:
        errors.append("generated FreeMind map may contain only the version attribute")
    for node in root.iter("node"):
        if not (node.get("TEXT") or "").strip():
            errors.append("every FreeMind node must have non-empty TEXT")
            break
        if set(node.attrib) != {"TEXT"}:
            errors.append("generated FreeMind nodes may contain only the TEXT attribute")
            break
        if any(child.tag != "node" for child in node):
            errors.append("generated FreeMind nodes may contain only child nodes")
            break
    return errors


def existing_ancestors(path: Path) -> Iterable[Path]:
    current = path
    seen: set[Path] = set()
    while current not in seen:
        seen.add(current)
        if current.exists() or current.is_symlink():
            yield current
        if current.parent == current:
            break
        current = current.parent


def reject_unsafe_path(raw: str, *, must_exist: bool = False) -> Path:
    expanded = Path(raw).expanduser()
    if ".." in expanded.parts:
        raise SpecError(f"path traversal is not allowed: {raw}")
    path = expanded.absolute()
    for ancestor in existing_ancestors(path):
        if ancestor.is_symlink() and ancestor not in ALLOWED_SYSTEM_SYMLINKS:
            raise SpecError(f"symbolic links are not allowed: {ancestor}")
    if must_exist and not path.is_file():
        raise SpecError(f"file does not exist: {path}")
    return path


def output_paths(base: Path) -> tuple[Path, Path, Path]:
    if base.suffix:
        raise SpecError("output base path must not have an extension")
    return (
        base.with_suffix(".md"),
        base.with_suffix(".opml"),
        base.with_suffix(".mm"),
    )


def preflight_outputs(paths: Iterable[Path], overwrite: bool) -> None:
    for path in paths:
        for ancestor in existing_ancestors(path.parent):
            if ancestor.is_symlink() and ancestor not in ALLOWED_SYSTEM_SYMLINKS:
                raise SpecError(f"symbolic links are not allowed: {ancestor}")
        if path.is_symlink():
            raise SpecError(f"output must not be a symbolic link: {path}")
        if path.exists() and not overwrite:
            raise SpecError(f"output exists; use --overwrite: {path}")
        if path.exists() and not path.is_file():
            raise SpecError(f"output is not a regular file: {path}")


def stage_write(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="\n",
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=path.suffix,
        delete=False,
    ) as handle:
        temporary = Path(handle.name)
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    return temporary


def transactional_write(outputs: list[tuple[Path, str]]) -> None:
    staged: list[tuple[Path, Path]] = []
    backups: list[tuple[Path, Path]] = []
    installed: list[Path] = []
    try:
        for path, content in outputs:
            staged.append((path, stage_write(path, content)))
        staged_by_suffix = {path.suffix: temp for path, temp in staged}
        errors = (
            check_markdown(staged_by_suffix[".md"])
            + check_opml(staged_by_suffix[".opml"])
            + check_freemind(staged_by_suffix[".mm"])
        )
        if errors:
            raise RuntimeError("; ".join(errors))
        for path, _ in staged:
            if path.exists():
                descriptor, raw_backup = tempfile.mkstemp(
                    prefix=f".{path.name}.backup.", dir=path.parent
                )
                os.close(descriptor)
                backup = Path(raw_backup)
                backup.unlink()
                path.rename(backup)
                backups.append((path, backup))
        for path, temporary in staged:
            os.replace(temporary, path)
            installed.append(path)
        for _, backup in backups:
            backup.unlink(missing_ok=True)
    except BaseException:
        for path in installed:
            path.unlink(missing_ok=True)
        for path, backup in reversed(backups):
            if backup.exists():
                backup.rename(path)
        raise
    finally:
        for _, temporary in staged:
            temporary.unlink(missing_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", nargs="?", help="UTF-8 JSON mind-map specification")
    parser.add_argument("output", nargs="?", help="output base path without an extension")
    parser.add_argument("--overwrite", action="store_true")
    checks = parser.add_mutually_exclusive_group()
    checks.add_argument("--check-markdown", metavar="PATH")
    checks.add_argument("--check-opml", metavar="PATH")
    checks.add_argument("--check-freemind", metavar="PATH")
    return parser.parse_args()


def report_check(errors: list[str], label: str, path: Path) -> int:
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"{label} check passed: {path}")
    return 0


def main() -> int:
    args = parse_args()
    try:
        if args.check_markdown:
            path = reject_unsafe_path(args.check_markdown, must_exist=True)
            return report_check(check_markdown(path), "Markdown", path)
        if args.check_opml:
            path = reject_unsafe_path(args.check_opml, must_exist=True)
            return report_check(check_opml(path), "OPML", path)
        if args.check_freemind:
            path = reject_unsafe_path(args.check_freemind, must_exist=True)
            return report_check(check_freemind(path), "FreeMind", path)
        if not args.spec or not args.output:
            raise SpecError("provide SPEC and OUTPUT, or use one of the --check options")

        spec_path = reject_unsafe_path(args.spec, must_exist=True)
        base = reject_unsafe_path(args.output)
        markdown_path, opml_path, freemind_path = output_paths(base)
        preflight_outputs([markdown_path, opml_path, freemind_path], args.overwrite)
        payload = json.loads(spec_path.read_text(encoding="utf-8"))
        document = parse_document(payload)
        transactional_write(
            [
                (markdown_path, build_markdown(document)),
                (opml_path, build_opml(document)),
                (freemind_path, build_freemind(document)),
            ]
        )
        portable_errors = (
            check_markdown(markdown_path)
            + check_opml(opml_path)
            + check_freemind(freemind_path)
        )
        if portable_errors:
            raise RuntimeError("; ".join(portable_errors))
        print(f"Created Markdown mind map: {markdown_path}")
        print(f"Created OPML 2.0 mind map: {opml_path}")
        print(f"Created FreeMind-compatible mind map: {freemind_path}")
        return 0
    except (OSError, UnicodeError, json.JSONDecodeError, SpecError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
