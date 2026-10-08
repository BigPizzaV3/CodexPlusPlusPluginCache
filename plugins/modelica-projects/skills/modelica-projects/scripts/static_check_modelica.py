#!/usr/bin/env python3
"""Check portable Modelica filesystem/package invariants without a compiler."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


IDENT = r"[A-Za-z_][A-Za-z0-9_]*"
CLASS_RE = re.compile(
    rf"\b(?:(?:encapsulated|partial|expandable|operator|pure|impure)\s+)*"
    rf"(?:package|model|block|connector|record|function|class|type)\s+({IDENT})\b"
)
WITHIN_RE = re.compile(rf"\bwithin\s*(?:({IDENT}(?:\.{IDENT})*)\s*)?;")
END_RE = re.compile(rf"\bend\s+({IDENT})\s*;")
VALID_NAME = re.compile(rf"^{IDENT}$")
NON_PACKAGE_DIRECTORIES = {"Resources"}
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    files: int = 0

    def error(self, path: Path, message: str) -> None:
        self.errors.append(f"{path}: {message}")

    def warn(self, path: Path, message: str) -> None:
        self.warnings.append(f"{path}: {message}")


def mask_comments_and_strings(text: str) -> tuple[str, list[str]]:
    result: list[str] = []
    errors: list[str] = []
    index = 0
    block_depth = 0
    line_comment = False
    in_string = False
    escaped = False
    while index < len(text):
        pair = text[index : index + 2]
        char = text[index]
        if line_comment:
            if char == "\n":
                line_comment = False
                result.append("\n")
            else:
                result.append(" ")
            index += 1
            continue
        if block_depth:
            if pair == "/*":
                block_depth += 1
                result.extend("  ")
                index += 2
            elif pair == "*/":
                block_depth -= 1
                result.extend("  ")
                index += 2
            else:
                result.append("\n" if char == "\n" else " ")
                index += 1
            continue
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            result.append("\n" if char == "\n" else " ")
            index += 1
            continue
        if pair == "//":
            line_comment = True
            result.extend("  ")
            index += 2
        elif pair == "/*":
            block_depth = 1
            result.extend("  ")
            index += 2
        elif char == '"':
            in_string = True
            result.append(" ")
            index += 1
        else:
            result.append(char)
            index += 1
    if block_depth:
        errors.append("unterminated block comment")
    if in_string:
        errors.append("unterminated string literal")
    return "".join(result), errors


def balanced_delimiters(masked: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack: list[str] = []
    for char in masked:
        if char in "([{":
            stack.append(char)
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
    return not stack


def expected_parent(root: Path, path: Path) -> str | None:
    relative_parent = path.parent.relative_to(root.parent)
    parts = list(relative_parent.parts)
    if path.name == "package.mo":
        parts = parts[:-1]
    return ".".join(parts) if parts else None


def read_modelica(path: Path, report: Report) -> tuple[str, str] | None:
    try:
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            report.error(path, "UTF-8 BOM is deprecated; write UTF-8 without BOM")
        text = raw.decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        report.error(path, f"cannot read UTF-8: {exc}")
        return None
    report.files += 1
    masked, lexical_errors = mask_comments_and_strings(text)
    for error in lexical_errors:
        report.error(path, error)
    return text, masked


def check_file(root: Path, path: Path, report: Report) -> None:
    loaded = read_modelica(path, report)
    if loaded is None:
        return
    text, masked = loaded
    if not balanced_delimiters(masked):
        report.error(path, "unbalanced (), [], or {} delimiters")
    match = CLASS_RE.search(masked)
    if not match:
        report.error(path, "no top-level Modelica class declaration found")
        return
    class_name = match.group(1)
    class_tail = masked[match.end() :]
    is_short_class = re.match(r"\s*=", class_tail) is not None
    expected_name = path.parent.name if path.name == "package.mo" else path.stem
    if class_name != expected_name:
        report.error(path, f"declares {class_name}, expected {expected_name}")
    if not VALID_NAME.fullmatch(expected_name):
        report.error(path, f"invalid Modelica identifier: {expected_name}")

    within_match = WITHIN_RE.search(masked)
    actual_parent = within_match.group(1) if within_match else None
    expected = expected_parent(root, path)
    if expected is None:
        if actual_parent:
            report.error(path, f"top-level package must not be within {actual_parent}")
    elif actual_parent != expected:
        report.error(path, f"within clause is {actual_parent!r}, expected {expected!r}")

    if is_short_class:
        if ";" not in class_tail:
            report.error(path, "short class declaration is missing its terminating semicolon")
    else:
        endings = END_RE.findall(masked)
        if not endings or endings[-1] != class_name:
            report.error(path, f"final named end must be 'end {class_name};'")
    if "Modelica.SIunits" in text:
        report.error(path, "uses obsolete Modelica.SIunits; use Modelica.Units.SI")
    if re.search(r"\b__[A-Za-z_][A-Za-z0-9_]*\s*\(", masked):
        report.error(path, "vendor-prefixed annotations are outside the portable contract")
    if re.search(r"(?:file|image):///(?:Users|home|tmp|var)/", text, re.IGNORECASE):
        report.warn(path, "contains an absolute resource URI; prefer modelica:/Package/Resources")


def order_entries(path: Path) -> list[str]:
    entries: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if value and not value.startswith("#"):
            entries.append(value)
    return entries


def check_package_directory(root: Path, directory: Path, report: Report) -> None:
    package_file = directory / "package.mo"
    if not package_file.is_file():
        report.error(directory, "package directory is missing package.mo")
        return
    check_file(root, package_file, report)

    child_files = sorted(
        path.stem for path in directory.glob("*.mo") if path.name != "package.mo"
    )
    child_packages = sorted(
        path.name for path in directory.iterdir() if path.is_dir() and (path / "package.mo").is_file()
    )
    expected_children = set(child_files + child_packages)
    order_file = directory / "package.order"
    if not order_file.is_file():
        report.error(directory, "package directory is missing package.order")
    else:
        try:
            entries = order_entries(order_file)
        except (OSError, UnicodeError) as exc:
            report.error(order_file, f"cannot read UTF-8: {exc}")
            entries = []
        duplicates = sorted({item for item in entries if entries.count(item) > 1})
        if duplicates:
            report.error(order_file, f"duplicate entries: {duplicates}")
        invalid = sorted({item for item in entries if not VALID_NAME.fullmatch(item)})
        if invalid:
            report.error(order_file, f"invalid Modelica identifiers: {invalid}")
        missing = sorted(expected_children - set(entries))
        extra = sorted(set(entries) - expected_children)
        if missing:
            report.error(order_file, f"missing direct children: {missing}")
        if extra:
            report.warn(order_file, f"entries not mapped to direct files/directories: {extra}")

    for model_file in sorted(directory.glob("*.mo")):
        if model_file.name != "package.mo":
            check_file(root, model_file, report)
    for subpackage in sorted(
        path for path in directory.iterdir() if path.is_dir() and (path / "package.mo").is_file()
    ):
        check_package_directory(root, subpackage, report)

    for child in sorted(path for path in directory.iterdir() if path.is_dir()):
        if (
            child.name.startswith(".")
            or child.name in NON_PACKAGE_DIRECTORIES
            or (child / "package.mo").is_file()
        ):
            continue
        if any(path.is_file() for path in child.rglob("*.mo")):
            report.error(child, "contains Modelica files but is missing package.mo")


def find_symlinks(target: Path) -> list[Path]:
    if target.is_symlink():
        return [target]
    if not target.is_dir():
        return []
    return sorted(path for path in target.rglob("*") if path.is_symlink())


def symlink_ancestor(path: Path) -> Path | None:
    current = path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS:
            return current
        current = current.parent
    return None


def check_target(target: Path) -> Report:
    report = Report()
    if ".." in target.parts:
        report.error(target, "target path traversal is not allowed")
        return report
    ancestor = symlink_ancestor(target.absolute().parent)
    if ancestor is not None:
        report.error(ancestor, "symbolic-link path components are not allowed")
        return report
    symlinks = find_symlinks(target)
    if symlinks:
        for path in symlinks:
            report.error(path, "symbolic links are not allowed in checked Modelica projects")
        return report
    if target.is_file():
        if target.suffix.lower() != ".mo":
            report.error(target, "single-file target must end in .mo")
            return report
        root = target.parent / target.stem
        check_file(root, target, report)
        return report
    if not target.is_dir():
        report.error(target, "target does not exist")
        return report
    if not (target / "package.mo").is_file():
        report.error(target, "target is not a directory-form Modelica package")
        return report
    if not VALID_NAME.fullmatch(target.name):
        report.error(target, f"invalid top-level package identifier: {target.name}")
    check_package_directory(target, target, report)
    try:
        top_text = (target / "package.mo").read_text(encoding="utf-8-sig")
        if "uses(Modelica" not in re.sub(r"\s+", "", top_text):
            report.warn(target / "package.mo", "no annotation(uses(Modelica(...))) dependency found")
    except (OSError, UnicodeError):
        pass
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="Modelica package directory or one-off .mo file")
    parser.add_argument("--warnings-as-errors", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    raw_target = Path(args.target).expanduser()
    if ".." in raw_target.parts:
        print("ERROR: target path traversal is not allowed", file=sys.stderr)
        return 1
    target = raw_target.absolute()
    report = check_target(target)
    for warning in report.warnings:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in report.errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if report.errors or (args.warnings_as_errors and report.warnings):
        return 1
    print(
        f"Modelica static check passed: {target} "
        f"({report.files} files, {len(report.warnings)} warnings)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
