#!/usr/bin/env python3
"""Statically check portable Mermaid source or Mermaid-enabled Markdown."""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path
from typing import NamedTuple


CORE_HEADERS = {
    "C4Component",
    "C4Container",
    "C4Context",
    "C4Deployment",
    "C4Dynamic",
    "flowchart",
    "flowchart-elk",
    "graph",
    "sequenceDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "classDiagram",
    "classDiagram-v2",
    "erDiagram",
    "gantt",
    "timeline",
    "mindmap",
    "pie",
    "requirement",
    "requirementDiagram",
    "gitGraph",
    "journey",
}
VERSION_SENSITIVE_HEADERS = {
    "architecture",
    "architecture-beta",
    "block",
    "block-beta",
    "cynefin-beta",
    "eventmodeling",
    "ishikawa",
    "ishikawa-beta",
    "kanban",
    "packet",
    "packet-beta",
    "quadrantChart",
    "radar-beta",
    "railroad-abnf-beta",
    "railroad-beta",
    "railroad-ebnf-beta",
    "railroad-peg-beta",
    "sankey",
    "sankey-beta",
    "swimlane-beta",
    "treeView-beta",
    "treemap",
    "venn-beta",
    "wardley-beta",
    "xychart",
    "xychart-beta",
    "zenuml",
}
STRICT_MARKDOWN_SUFFIXES = {".md", ".markdown", ".mdown", ".mkdn", ".mkd", ".mkx", ".mdwn"}
MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_LINE_BYTES = 256 * 1024
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}

FENCE_OPEN_RE = re.compile(
    r"^(?P<indent>[ \t]*)(?P<marker>`{3,}|~{3,})(?P<info>[^\r\n]*)$"
)
FENCE_CANDIDATE_RE = re.compile(r"^[ \t]*(?P<marker>`{3,}|~{3,})[ \t]*$")
MERMAID_INFO_RE = re.compile(r"^mermaid(?:[ \t].*)?$", re.IGNORECASE)
RAW_FENCE_LINE_RE = re.compile(r"^[ \t]*(?:`{3,}|~{3,})", re.MULTILINE)
DIRECTIVE_RE = re.compile(r"%%\{(.*?)\}%%", re.DOTALL)
UNSAFE_HTML_RE = re.compile(
    r"<\s*/?\s*(?:a|audio|base|blockquote|body|br|button|canvas|code|details|dialog|div|"
    r"embed|em|footer|form|foreignObject|frame|frameset|h[1-6]|head|header|hr|html|iframe|"
    r"img|input|label|li|link|main|math|meta|nav|object|ol|option|p|picture|pre|script|"
    r"section|select|small|source|span|strong|style|summary|svg|table|tbody|td|template|"
    r"textarea|tfoot|th|thead|tr|ul|video)\b",
    re.IGNORECASE,
)
EVENT_HANDLER_RE = re.compile(r"\bon[a-z][a-z0-9_-]*\s*=", re.IGNORECASE)
REMOTE_STYLE_RE = re.compile(r"(?:url\s*\(|@import\b)", re.IGNORECASE)
URL_BEARING_STYLE_RE = re.compile(
    r"^[ \t]*(?:classDef|linkStyle|style)\b[^\r\n]*(?:https?://|ftp://|file:|data:|//)",
    re.IGNORECASE | re.MULTILINE,
)
STYLE_LINE_RE = re.compile(
    r"^[ \t]*(?:classDef|linkStyle|style)\b(?P<body>[^\r\n]*)",
    re.IGNORECASE | re.MULTILINE,
)
RESOURCE_ATTRIBUTE_RE = re.compile(
    r"\b(?:href|src)\s*(?:=|:)\s*[\"']?\s*(?:https?:|ftp:|file:|data:|//)",
    re.IGNORECASE,
)
UNSAFE_SCHEME_RE = re.compile(r"(?:javascript:|vbscript:)", re.IGNORECASE)
FRONT_MATTER_RE = re.compile(r"\A[ \t\r\n]*---[ \t]*\r?\n(.*?)^[ \t]*---[ \t]*$", re.DOTALL | re.MULTILINE)


class MermaidFence(NamedTuple):
    """A single Mermaid fence discovered by the shared line-oriented parser."""

    source: str
    start_line: int
    end_line: int
    indent: str
    marker: str
    info: str


def _has_click_statement(source: str) -> bool:
    """Detect click directives at line or semicolon statement boundaries.

    Mermaid permits semicolons as statement separators. Quoted labels and `%%`
    comments are skipped so ordinary text such as `A["safe; click label"]` does
    not become a false positive.
    """

    index = 0
    statement_start = True
    quoted = False
    escaped = False
    in_comment = False
    while index < len(source):
        character = source[index]
        if character in "\r\n":
            in_comment = False
            if not quoted:
                statement_start = True
            escaped = False
            index += 1
            continue
        if in_comment:
            index += 1
            continue
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
            index += 1
            continue
        if source.startswith("%%", index):
            in_comment = True
            index += 2
            continue
        if character == '"':
            quoted = True
            statement_start = False
            index += 1
            continue
        if character == ";":
            statement_start = True
            index += 1
            continue
        if statement_start and character in " \t":
            index += 1
            continue
        if statement_start:
            token = source[index : index + 5]
            following = source[index + 5 : index + 6]
            if token.casefold() == "click" and (not following or not (following.isalnum() or following in "_-")):
                return True
            statement_start = False
        index += 1
    return False


def _has_external_shape_field(source: str) -> bool:
    """Detect image/icon fields inside single- or multiline Mermaid shape blocks."""

    index = 0
    quoted = False
    escaped = False
    in_comment = False
    while index < len(source):
        character = source[index]
        if character in "\r\n":
            in_comment = False
            escaped = False
            index += 1
            continue
        if in_comment:
            index += 1
            continue
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
            index += 1
            continue
        if source.startswith("%%", index):
            in_comment = True
            index += 2
            continue
        if character == '"':
            quoted = True
            index += 1
            continue
        if not source.startswith("@{", index):
            index += 1
            continue

        depth = 1
        cursor = index + 2
        block_quoted = False
        block_escaped = False
        while cursor < len(source) and depth:
            current = source[cursor]
            if block_quoted:
                if block_escaped:
                    block_escaped = False
                elif current == "\\":
                    block_escaped = True
                elif current == '"':
                    block_quoted = False
                cursor += 1
                continue
            if current == '"':
                block_quoted = True
                cursor += 1
                continue
            if current == "{":
                depth += 1
                cursor += 1
                continue
            if current == "}":
                depth -= 1
                cursor += 1
                continue
            if current.isalpha() or current == "_":
                token_start = cursor
                cursor += 1
                while cursor < len(source) and (source[cursor].isalnum() or source[cursor] in "_-"):
                    cursor += 1
                token = source[token_start:cursor].casefold()
                after = cursor
                while after < len(source) and source[after] in " \t\r\n":
                    after += 1
                if token in {"icon", "image", "img"} and after < len(source) and source[after] == ":":
                    return True
                continue
            cursor += 1
        index = max(cursor, index + 2)
    return False


def _without_eol(line: str) -> str:
    return line[:-2] if line.endswith("\r\n") else line[:-1] if line.endswith(("\n", "\r")) else line


def _is_closing_fence(line: str, marker: str) -> bool:
    candidate = FENCE_CANDIDATE_RE.fullmatch(_without_eol(line))
    if candidate is None:
        return False
    candidate_marker = candidate.group("marker")
    return candidate_marker[0] == marker[0] and len(candidate_marker) >= len(marker)


def parse_mermaid_fences(contents: str) -> list[MermaidFence]:
    """Parse Mermaid fences once for import, lint, repair, and standalone checks.

    Unrelated fenced blocks are skipped. Mermaid closing fences must use the same
    delimiter character and at least the opening delimiter length; a fence-like
    but incompatible closing line is reported rather than absorbed as source.
    """

    lines = contents.splitlines(keepends=True)
    results: list[MermaidFence] = []
    active_marker: str | None = None
    active_indent = ""
    active_info = ""
    active_start = 0
    active_body: list[str] = []
    active_is_mermaid = False

    for line_number, line in enumerate(lines, 1):
        plain = _without_eol(line)
        if active_marker is None:
            opened = FENCE_OPEN_RE.fullmatch(plain)
            if opened is None:
                continue
            info = opened.group("info").strip()
            active_marker = opened.group("marker")
            active_indent = opened.group("indent")
            active_info = info
            active_start = line_number
            active_body = []
            active_is_mermaid = MERMAID_INFO_RE.fullmatch(info) is not None
            continue

        if _is_closing_fence(line, active_marker):
            if active_is_mermaid:
                results.append(
                    MermaidFence(
                        source="".join(active_body),
                        start_line=active_start,
                        end_line=line_number,
                        indent=active_indent,
                        marker=active_marker,
                        info=active_info,
                    )
                )
            active_marker = None
            active_body = []
            active_is_mermaid = False
            continue

        if active_is_mermaid and FENCE_CANDIDATE_RE.fullmatch(plain):
            raise ValueError(
                f"malformed closing fence for Mermaid block opened at line {active_start}"
            )
        active_body.append(line)

    if active_marker is not None and active_is_mermaid:
        raise ValueError(f"malformed or unterminated Mermaid fence opened at line {active_start}")
    return results


def extract_mermaid_text(contents: str, *, markdown: bool) -> tuple[list[str], list[str]]:
    """Return Mermaid sources using the shared parser and the given file posture."""

    fences = parse_mermaid_fences(contents)
    warnings: list[str] = []
    if fences:
        if len(fences) > 1:
            warnings.append(f"Markdown contains {len(fences)} Mermaid blocks; checking all blocks")
        return [fence.source.strip() for fence in fences], warnings
    if markdown:
        raise ValueError("Markdown file contains no fenced Mermaid block")
    return [contents.strip()], warnings


def extract_mermaid(path: Path) -> tuple[list[str], list[str]]:
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("input exceeds 8 MiB")
    contents = path.read_text(encoding="utf-8")
    return extract_mermaid_text(contents, markdown=path.suffix.lower() in STRICT_MARKDOWN_SUFFIXES)


def _symlink_ancestor(path: Path) -> Path | None:
    current = path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS:
            return current
        current = current.parent
    return None


def input_path(raw: str) -> Path:
    candidate = Path(raw).expanduser()
    if ".." in candidate.parts:
        raise ValueError("source path traversal is not allowed")
    path = candidate.absolute()
    if path.is_symlink():
        raise ValueError("source must not be a symbolic link")
    ancestor = _symlink_ancestor(path.parent)
    if ancestor is not None:
        raise ValueError(f"symbolic-link path component is not allowed: {ancestor}")
    return path


def diagram_header(source: str) -> tuple[str | None, str | None]:
    lines = source.splitlines()
    index = 0

    while index < len(lines) and not lines[index].strip():
        index += 1
    if index < len(lines) and lines[index].strip() == "---":
        index += 1
        while index < len(lines) and lines[index].strip() != "---":
            index += 1
        if index == len(lines):
            return None, "unterminated YAML front matter"
        index += 1

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("%%{"):
            while index < len(lines) and "}%%" not in lines[index]:
                index += 1
            if index == len(lines):
                return None, "unterminated Mermaid directive"
            index += 1
            continue
        if line.startswith("%%"):
            index += 1
            continue
        return line.split(maxsplit=1)[0], None
    return None, None


def _active_content_errors(source: str, context: str) -> list[str]:
    errors: list[str] = []
    lowered = source.casefold()
    if RAW_FENCE_LINE_RE.search(source):
        errors.append(f"{context}fence delimiters are not allowed inside Mermaid source")
    if UNSAFE_HTML_RE.search(source):
        errors.append(f"{context}raw HTML containers are not allowed")
    if EVENT_HANDLER_RE.search(source):
        errors.append(f"{context}HTML event handlers are not allowed")
    if _has_click_statement(source):
        errors.append(f"{context}click and hyperlink directives are not allowed")
    if REMOTE_STYLE_RE.search(source):
        errors.append(f"{context}URL-bearing or imported styles are not allowed")
    if URL_BEARING_STYLE_RE.search(source):
        errors.append(f"{context}URL-bearing or imported styles are not allowed")
    for style_line in STYLE_LINE_RE.finditer(source):
        body = style_line.group("body").casefold()
        if "\\" in body or re.search(
            r"\b(?:background(?:-image)?|behavior|clip-path|content|cursor|filter|list-style-image|mask)\s*:",
            body,
        ):
            errors.append(f"{context}unsafe style property or escape is not allowed")
    if _has_external_shape_field(source):
        errors.append(f"{context}external images and icon packs are not allowed")
    if RESOURCE_ATTRIBUTE_RE.search(source):
        errors.append(f"{context}remote or embedded resources are not allowed")
    if UNSAFE_SCHEME_RE.search(source):
        errors.append(f"{context}active URI schemes are not allowed")

    directives = DIRECTIVE_RE.findall(source)
    if lowered.count("%%{") != len(directives):
        errors.append(f"{context}malformed or unterminated Mermaid directive")
    for directive in directives:
        normalized = directive.strip().casefold()
        if not re.match(r"^init\s*:", normalized):
            errors.append(f"{context}unsupported Mermaid directive")
            continue
        if any(
            token in normalized
            for token in (
                "javascript:",
                "vbscript:",
                "http://",
                "https://",
                "ftp://",
                "file:",
                "data:",
                "url(",
                "@import",
                "securitylevel",
                "themecss",
                "htmllabels",
                "callback",
            )
        ):
            errors.append(f"{context}unsafe Mermaid init directive")
    front_matter = FRONT_MATTER_RE.search(source)
    if front_matter is not None:
        normalized = front_matter.group(1).casefold()
        if any(
            token in normalized
            for token in (
                "javascript:",
                "vbscript:",
                "http://",
                "https://",
                "ftp://",
                "file:",
                "data:",
                "url(",
                "@import",
                "securitylevel",
                "themecss",
                "htmllabels",
                "callback",
            )
        ):
            errors.append(f"{context}unsafe Mermaid front matter")
    return list(dict.fromkeys(errors))


def check_source(source: str, context: str = "") -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not source:
        return [f"{context}Mermaid source is empty"], warnings
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        return [f"{context}Mermaid source exceeds 2 MiB"], warnings
    for line_number, line in enumerate(source.splitlines(), 1):
        if len(line.encode("utf-8")) > MAX_LINE_BYTES:
            errors.append(f"{context}line {line_number} exceeds 256 KiB")
            break
    for character in source:
        category = unicodedata.category(character)
        if category in {"Cs", "Zl", "Zp"} or (category == "Cc" and character not in "\n\r\t"):
            errors.append(f"{context}source contains unsupported Unicode/control characters")
            break

    header, header_error = diagram_header(source)
    if header_error:
        errors.append(f"{context}{header_error}")
    elif header is None:
        errors.append(f"{context}Mermaid source contains only comments")
    elif header not in CORE_HEADERS | VERSION_SENSITIVE_HEADERS:
        errors.append(f"{context}unrecognized or unsupported diagram header: {header}")
    elif header in VERSION_SENSITIVE_HEADERS:
        warnings.append(f"{context}{header} is version-sensitive; verify with the intended Mermaid host")

    errors.extend(_active_content_errors(source, context))
    if source.count('"') % 2:
        warnings.append(f"{context}source contains an odd number of double quotes")
    return list(dict.fromkeys(errors)), warnings


def static_check(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if ".." in path.parts:
        return ["source path traversal is not allowed"], warnings
    if path.is_symlink():
        return ["source must not be a symbolic link"], warnings
    ancestor = _symlink_ancestor(path.absolute().parent)
    if ancestor is not None:
        return [f"symbolic-link path component is not allowed: {ancestor}"], warnings
    try:
        sources, extraction_warnings = extract_mermaid(path)
        warnings.extend(extraction_warnings)
    except (OSError, UnicodeError, ValueError) as exc:
        return [str(exc)], warnings
    for index, source in enumerate(sources, 1):
        context = f"block {index}: " if len(sources) > 1 else ""
        source_errors, source_warnings = check_source(source, context)
        errors.extend(source_errors)
        warnings.extend(source_warnings)
    return errors, warnings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Mermaid or Markdown source file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        source = input_path(args.source)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    errors, warnings = static_check(source)
    for warning in warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"Mermaid static check passed: {source}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
