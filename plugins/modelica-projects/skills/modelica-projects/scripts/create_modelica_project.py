#!/usr/bin/env python3
"""Create a deterministic, portable Modelica package tree from strict JSON."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import unicodedata
from pathlib import Path, PurePosixPath

import static_check_modelica


IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
ROOT_FIELDS = {"package", "description", "mslVersion", "files"}
FILE_FIELDS = {"path", "source"}
MAX_FILES = 512
MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_DEPTH = 32
MAX_INPUT_BYTES = 8 * 1024 * 1024
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}


class ContractError(ValueError):
    pass


def reject_unknown(payload: dict[str, object], allowed: set[str], context: str) -> None:
    unknown = sorted(set(payload) - allowed)
    if unknown:
        raise ContractError(f"unknown {context} fields: {unknown}")


def validate_text(value: object, field: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        raise ContractError(f"{field} must be a non-empty string")
    for char in value:
        category = unicodedata.category(char)
        if category == "Cs" or (category == "Cc" and char not in "\n\r\t"):
            raise ContractError(f"{field} contains an invalid Unicode/control character")
    return value


def safe_relative_modelica_path(raw: object) -> PurePosixPath:
    value = validate_text(raw, "files[].path")
    if "\\" in value:
        raise ContractError("files[].path must use forward slashes")
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or len(path.parts) > MAX_DEPTH:
        raise ContractError(f"unsafe or excessively deep Modelica path: {value!r}")
    if any(part in {"", ".", ".."} or not IDENT.fullmatch(part) for part in path.parts[:-1]):
        raise ContractError(f"invalid Modelica path: {value!r}")
    if path.suffix != ".mo" or path.name == "package.mo" or not IDENT.fullmatch(path.stem):
        raise ContractError("files[].path must name a class .mo file, not package.mo")
    return path


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
    if not isinstance(payload, dict):
        raise ContractError("specification root must be an object")
    reject_unknown(payload, ROOT_FIELDS, "root")
    if set(payload) != ROOT_FIELDS:
        raise ContractError(f"specification requires exactly these fields: {sorted(ROOT_FIELDS)}")
    return payload


def package_source(qualified: tuple[str, ...], description: str, msl_version: str) -> str:
    name = qualified[-1]
    parent = ".".join(qualified[:-1])
    within = f"within {parent};\n" if parent else "within;\n"
    escaped = (
        description.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    annotation = ""
    if len(qualified) == 1:
        annotation = f'\n  annotation(uses(Modelica(version = "{msl_version}")));'
    return f'{within}package {name} "{escaped}"{annotation}\nend {name};\n'


def build_tree(spec: dict[str, object], staging_parent: Path) -> Path:
    package = validate_text(spec["package"], "package")
    if not IDENT.fullmatch(package):
        raise ContractError("package must be a valid unquoted Modelica identifier")
    description = validate_text(spec["description"], "description")
    msl_version = validate_text(spec["mslVersion"], "mslVersion")
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,2}", msl_version):
        raise ContractError("mslVersion must contain two or three numeric components")
    files = spec["files"]
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_FILES:
        raise ContractError(f"files must contain 1-{MAX_FILES} entries")

    parsed: list[tuple[PurePosixPath, str]] = []
    seen: set[PurePosixPath] = set()
    for index, item in enumerate(files):
        if not isinstance(item, dict):
            raise ContractError(f"files[{index}] must be an object")
        reject_unknown(item, FILE_FIELDS, f"files[{index}]")
        if set(item) != FILE_FIELDS:
            raise ContractError(f"files[{index}] requires path and source")
        relative = safe_relative_modelica_path(item["path"])
        if relative in seen:
            raise ContractError(f"duplicate file path: {relative}")
        seen.add(relative)
        source = validate_text(item["source"], f"files[{index}].source")
        if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise ContractError(f"source is too large: {relative}")
        parsed.append((relative, source if source.endswith("\n") else source + "\n"))

    root = staging_parent / package
    root.mkdir()
    directories: set[PurePosixPath] = {PurePosixPath()}
    children: dict[PurePosixPath, set[str]] = {PurePosixPath(): set()}
    for relative, _ in parsed:
        parent = relative.parent
        cursor = PurePosixPath()
        for part in parent.parts:
            children.setdefault(cursor, set()).add(part)
            cursor /= part
            directories.add(cursor)
            children.setdefault(cursor, set())
        children.setdefault(parent, set()).add(relative.stem)

    for relative_dir in sorted(directories, key=lambda item: (len(item.parts), item.as_posix())):
        directory = root.joinpath(*relative_dir.parts)
        directory.mkdir(parents=True, exist_ok=True)
        qualified = (package, *relative_dir.parts)
        label = description if not relative_dir.parts else f"{relative_dir.name} package"
        (directory / "package.mo").write_text(
            package_source(qualified, label, msl_version), encoding="utf-8", newline="\n"
        )
        ordered = "".join(f"{name}\n" for name in sorted(children[relative_dir]))
        (directory / "package.order").write_text(ordered, encoding="utf-8", newline="\n")

    for relative, source in sorted(parsed, key=lambda item: item[0].as_posix()):
        target = root.joinpath(*relative.parts)
        target.write_text(source, encoding="utf-8", newline="\n")

    report = static_check_modelica.check_target(root)
    if report.errors:
        raise ContractError("generated project failed static validation: " + "; ".join(report.errors))
    return root


def ensure_safe_destination(destination: Path) -> None:
    if destination.is_symlink():
        raise ContractError("destination must not be a symbolic link")


def reject_symlink_ancestors(path: Path) -> None:
    current = path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS:
            raise ContractError(f"symbolic-link path component is not allowed: {current}")
        current = current.parent


def cli_path(raw: str, field: str) -> Path:
    path = Path(raw).expanduser()
    if ".." in path.parts:
        raise ContractError(f"{field} must not contain '..' traversal")
    return path.absolute()


def install_tree(staged: Path, destination: Path, overwrite: bool) -> None:
    ensure_safe_destination(destination)
    if destination.exists() and not overwrite:
        raise ContractError("destination exists; pass --overwrite to replace it")
    backup: Path | None = None
    if destination.exists():
        backup = destination.with_name(destination.name + ".modelica-projects-backup")
        if backup.exists() or backup.is_symlink():
            raise ContractError(f"refusing to overwrite backup path: {backup}")
        destination.rename(backup)
    try:
        os.replace(staged, destination)
    except BaseException:
        if backup is not None and not destination.exists():
            backup.rename(destination)
        raise
    if backup is not None:
        if backup.is_dir():
            shutil.rmtree(backup)
        else:
            backup.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", help="UTF-8 JSON project specification")
    parser.add_argument("output", help="parent directory for the generated package")
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        spec = load_spec(cli_path(args.spec, "specification path"))
        package = validate_text(spec["package"], "package")
        output_parent = cli_path(args.output, "output path")
        if output_parent.is_symlink():
            raise ContractError("output parent must not be a symbolic link")
        reject_symlink_ancestors(output_parent.parent)
        output_parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".modelica-projects-", dir=output_parent) as temp:
            staged = build_tree(spec, Path(temp))
            destination = output_parent / package
            install_tree(staged, destination, args.overwrite)
        print(json.dumps({"ok": True, "package": package, "output": str(destination)}, sort_keys=True))
        return 0
    except (ContractError, OSError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, sort_keys=True), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
