#!/usr/bin/env python3
"""Create deterministic Mermaid source or Mermaid-enabled Markdown from strict JSON."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import unicodedata
from pathlib import Path

import validate_mermaid


FIELDS = {"format", "title", "source"}
FORMATS = {"mmd": ".mmd", "mermaid": ".mermaid", "md": ".md"}
MAX_SOURCE_BYTES = validate_mermaid.MAX_SOURCE_BYTES
MAX_INPUT_BYTES = validate_mermaid.MAX_INPUT_BYTES
MAX_OUTPUT_BYTES = 8 * 1024 * 1024
MAX_TEXT_BYTES = 64 * 1024
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}


class ContractError(ValueError):
    pass


def valid_text(
    value: object,
    field: str,
    *,
    nullable: bool = False,
    single_line: bool = False,
    max_bytes: int = MAX_TEXT_BYTES,
) -> str | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{field} must be a non-empty string")
    if len(value.encode("utf-8")) > max_bytes:
        raise ContractError(f"{field} is too large")
    for char in value:
        category = unicodedata.category(char)
        if single_line and (char in "\n\r" or category in {"Zl", "Zp"}):
            raise ContractError(f"{field} must be a single line")
        if category in {"Cs", "Zl", "Zp"} or (category == "Cc" and char not in "\n\r\t"):
            raise ContractError(f"{field} contains an invalid Unicode/control character")
    return value


def load_spec(path: Path) -> dict[str, object]:
    if path.is_symlink():
        raise ContractError("specification must not be a symbolic link")
    reject_symlink_ancestors(path.parent)
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ContractError("specification exceeds 8 MiB")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"cannot read specification: {exc}") from exc
    if not isinstance(payload, dict) or set(payload) != FIELDS:
        raise ContractError(f"specification requires exactly these fields: {sorted(FIELDS)}")
    return payload


def build(payload: dict[str, object]) -> tuple[str, str]:
    output_format = payload["format"]
    if output_format not in FORMATS:
        raise ContractError(f"format must be one of {sorted(FORMATS)}")
    title = valid_text(payload["title"], "title", nullable=True, single_line=True)
    source = valid_text(payload["source"], "source", max_bytes=MAX_SOURCE_BYTES)
    assert isinstance(source, str)
    source = source.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise ContractError("source is too large")
    errors, _ = validate_mermaid.check_source(source)
    if errors:
        raise ContractError("invalid Mermaid source: " + "; ".join(errors))
    if output_format == "md":
        if title is None:
            raise ContractError("title is required for Markdown output")
        body = f"# {title}\n\n```mermaid\n{source}```\n"
    else:
        if title is not None:
            raise ContractError("title must be null for raw Mermaid output")
        body = source
    if len(body.encode("utf-8")) > MAX_OUTPUT_BYTES:
        raise ContractError("output exceeds 8 MiB")
    return output_format, body


def write_atomic(output: Path, body: str, overwrite: bool) -> None:
    if output.is_symlink():
        raise ContractError("output must not be a symbolic link")
    if output.exists() and not overwrite:
        raise ContractError("output exists; pass --overwrite to replace it")
    reject_symlink_ancestors(output.parent)
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, raw_temp = tempfile.mkstemp(prefix=f".{output.name}.", dir=output.parent)
    temp = Path(raw_temp)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, output)
    finally:
        if temp.exists():
            temp.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec")
    parser.add_argument("output")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def reject_symlink_ancestors(path: Path) -> None:
    current = path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS:
            raise ContractError(f"symbolic-link path component is not allowed: {current}")
        current = current.parent


def main() -> int:
    args = parse_args()
    try:
        raw_spec = Path(args.spec).expanduser()
        if ".." in raw_spec.parts:
            raise ContractError("specification path traversal is not allowed")
        payload = load_spec(raw_spec.absolute())
        output_format, body = build(payload)
        raw_output = Path(args.output).expanduser()
        if ".." in raw_output.parts:
            raise ContractError("output path traversal is not allowed")
        output = raw_output.absolute()
        reject_symlink_ancestors(output.parent)
        if output.suffix.lower() != FORMATS[output_format]:
            raise ContractError(f"output extension must be {FORMATS[output_format]}")
        write_atomic(output, body, args.overwrite)
        errors, warnings = validate_mermaid.static_check(output)
        if errors:
            raise ContractError("written output failed validation: " + "; ".join(errors))
        print(json.dumps({"ok": True, "output": str(output), "warnings": warnings}, sort_keys=True))
        return 0
    except (ContractError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, sort_keys=True), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
