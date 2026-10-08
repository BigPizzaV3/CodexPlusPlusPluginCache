#!/usr/bin/env python3
"""Build and check the skills-only ZIP from the current working tree (standard library)."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import contextlib
import json
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
FILES = ("plugin.json", ".codex-plugin/plugin.json", "README.md", "LICENSE",
         "SECURITY.md", "CHANGELOG.md", "CONTRIBUTING.md", "scripts/package_plugin.py")
TREES = ("skills", "assets", "docs")
MAX_ENTRIES = 5000
MAX_COMPRESSED = 100 * 1024 * 1024
MAX_EXTRACTED = 512 * 1024 * 1024


def markdown_layout_errors(name: str, text: str) -> list[str]:
    """Return prose lines that continue a Markdown paragraph or list item."""
    errors = []
    previous_plain = False
    in_fence = False
    in_frontmatter = False
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if number == 1 and stripped == "---":
            in_frontmatter = True
            previous_plain = False
            continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            previous_plain = False
            continue
        if in_fence or not stripped:
            previous_plain = False
            continue
        structural = bool(
            re.match(r"^\s{0,3}(#{1,6}\s|[-*_]{3,}\s*$|(?:[-+*]|\d+[.)])\s+)", line)
            or re.match(r"^\s*(\|.*|\[[^]]+\]:\s|<[^>]+>|[A-Z][A-Za-z -]+:\s)", line)
        )
        indented_prose = bool(re.match(r"^\s{2,}\S", line)) and not bool(
            re.match(r"^\s+(?:[-+*]|\d+[.)])\s+", line)
        )
        if previous_plain or indented_prose:
            errors.append(f"{name}:{number}")
        previous_plain = not structural
    return errors


def source_files(root: Path) -> list[Path]:
    paths = [root / name for name in FILES]
    for name in TREES:
        directory = root / name
        if directory.is_symlink() or not directory.is_dir():
            raise ValueError(f"Expected a real package directory: {directory}")
        for path in sorted(directory.rglob("*")):
            if path.is_symlink():
                raise ValueError(f"Symlink is not allowed in the package: {path}")
            if "__pycache__" in path.parts or path.suffix == ".pyc":
                continue
            if path.is_file():
                paths.append(path)
            elif not path.is_dir():
                raise ValueError(f"Non-regular package entry: {path}")
    for path in paths:
        if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode):
            raise ValueError(f"Expected a regular package file: {path}")
        if any(parent.is_symlink() for parent in path.parents if parent != root.parent):
            raise ValueError(f"Symlink package parent: {path}")
    return sorted(paths)


def validate_zip(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        names = {member.filename for member in members}
        if len(names) != len(members) or len(names) > MAX_ENTRIES:
            raise ValueError("ZIP has duplicate paths or too many entries")
        extracted_size = sum(member.file_size for member in members)
        if path.stat().st_size > MAX_COMPRESSED or extracted_size > MAX_EXTRACTED:
            raise ValueError("ZIP exceeds submission size limits")
        for member in members:
            name = member.filename
            normalized = PurePosixPath(name)
            if ("\\" in name or normalized.is_absolute() or ".." in normalized.parts
                    or normalized.as_posix() != name or name.startswith(".agents/")):
                raise ValueError(f"Unsafe ZIP path: {name}")
            if not stat.S_ISREG(member.external_attr >> 16):
                raise ValueError(f"Non-regular ZIP entry: {name}")
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC validation failed")
        if "plugin.json" not in names or "skills/project-os/SKILL.md" not in names:
            raise ValueError("ZIP is missing the portable manifest or skill")
        reusable_template = "skills/project-os/assets/templates/core/.agents/knowledge/reusable/failures.json"
        forbidden_knowledge = [
            name for name in names
            if name.startswith("skills/project-os/assets/knowledge/")
            or "/knowledge/shared/" in name
        ]
        if forbidden_knowledge:
            raise ValueError(
                "Package contains release-managed failure knowledge: "
                + ", ".join(sorted(forbidden_knowledge)[:10])
            )
        if reusable_template not in names:
            raise ValueError("ZIP is missing the empty reusable knowledge template")
        reusable = json.loads(archive.read(reusable_template))
        if reusable != {"schema_version": 1, "entries": []}:
            raise ValueError("Reusable knowledge template must be an empty user-owned registry")
        portable = json.loads(archive.read("plugin.json"))
        compatibility = json.loads(archive.read(".codex-plugin/plugin.json"))
        if portable["version"] != compatibility["version"]:
            raise ValueError("Package manifest versions disagree")
        portable_interface = portable["extensions"]["com.openai"]["interface"]
        compatibility_interface = compatibility["interface"]
        if portable_interface["defaultPrompt"] != compatibility_interface["defaultPrompt"]:
            raise ValueError("Package starter prompts disagree")
        helper = archive.read("skills/project-os/scripts/project_os.py").decode("utf-8")
        helper_version = re.search(r'^VERSION = "([^"]+)"$', helper, re.MULTILINE)
        helper_schema = re.search(r"^SCHEMA_VERSION = (\d+)$", helper, re.MULTILINE)
        if helper_version is None or helper_version.group(1) != portable["version"]:
            raise ValueError("Package helper and manifest versions disagree")
        if helper_schema is None or int(helper_schema.group(1)) != 5:
            raise ValueError("Package helper must use Project OS schema 5")
        skill_policy = archive.read("skills/project-os/agents/openai.yaml").decode("utf-8")
        if "allow_implicit_invocation: true" not in skill_policy or "products:" in skill_policy:
            raise ValueError("Package skill policy is not portable")
        for name in sorted(item for item in names if item.endswith(".json")):
            json.loads(archive.read(name))
        # Relative public-document links must also work in the extracted artifact.
        public_docs = [name for name in names if name.endswith(".md")
                       and ("/" not in name or name.startswith("docs/"))]
        layout_errors = []
        for name in sorted(item for item in names if item.endswith(".md")):
            layout_errors.extend(markdown_layout_errors(name, archive.read(name).decode("utf-8")))
        if layout_errors:
            raise ValueError("Hard-wrapped Markdown prose: " + ", ".join(layout_errors[:10]))
        for name in public_docs:
            text = archive.read(name).decode("utf-8")
            links = re.findall(r"\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)", text)
            for raw_link in links:
                link = urlsplit(raw_link.strip("<>"))
                if link.scheme or link.netloc or not link.path:
                    continue
                parts = list(PurePosixPath(name).parent.parts)
                for part in PurePosixPath(unquote(link.path)).parts:
                    if part == "..":
                        if not parts:
                            raise ValueError(f"Escaping document link: {name}: {raw_link}")
                        parts.pop()
                    elif part != ".":
                        parts.append(part)
                target = "/".join(parts)
                if target not in names and not any(item.startswith(target + "/") for item in names):
                    raise ValueError(f"Broken packaged document link: {name}: {raw_link}")
        return {"version": portable["version"], "entries": len(members),
                "compressed_bytes": path.stat().st_size, "extracted_bytes": extracted_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def build_zip(root: Path, output: Path) -> dict[str, object]:
    paths = source_files(root)
    # Exclusive output creation prevents replacing an earlier reviewed artifact.
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            info = zipfile.ZipInfo(path.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    return validate_zip(output)


def validate_release_acceptance(root: Path, archive_path: Path, target: Path, plan_id: str) -> dict[str, object]:
    """Read-only guard for the exact candidate, separate from ZIP consistency."""
    sources = source_files(root)
    with zipfile.ZipFile(archive_path) as archive:
        expected = {path.relative_to(root).as_posix(): path.read_bytes() for path in sources}
        if set(archive.namelist()) != set(expected) or any(
            archive.read(name) != content for name, content in expected.items()
        ):
            raise ValueError("NOT_READY: ZIP differs from the candidate checkout; rebuild and repeat affected acceptance")
    spec = importlib.util.spec_from_file_location("project_os_release_guard", root / "skills/project-os/scripts/project_os.py")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    snapshots = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            report = helper.plan_status_report(target.resolve(), plan_id, snapshots)
        if not report["ready"]:
            raise ValueError("NOT_READY: " + "; ".join(report["readiness_blockers"]))
        for product in ("codex", "chatgpt"):
            if not any(gate.get("evidence_class") == "host" and product in gate.get("target", "").lower()
                       and gate.get("status") == "verified" for gate in report["gates"]):
                raise ValueError(f"NOT_READY: release acceptance requires verified {product} host evidence; a narrower source plan is insufficient")
        for path, digest in snapshots.items():
            helper.reject_symlink_path(target.resolve(), path)
            content, _ = helper.read_regular_at_path(path)
            if hashlib.sha256(content).hexdigest() != digest:
                raise ValueError("NOT_READY: acceptance inputs changed during validation")
        current = {path.relative_to(root).as_posix(): path.read_bytes() for path in source_files(root)}
        if current != expected:
            raise ValueError("NOT_READY: candidate source changed during acceptance validation")
    except helper.ProjectOSError as error:
        raise ValueError("NOT_READY: " + str(error)) from error
    return {"readiness": "READY", "plan_id": report["plan_id"], "outcome": report["outcome"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=Path, help="New ZIP path; existing files are never overwritten")
    group.add_argument("--check", type=Path, help="Validate an existing ZIP without writes")
    parser.add_argument("--acceptance-target", type=Path, help="Connected repository owning candidate acceptance; requires --check and --plan-id")
    parser.add_argument("--plan-id", help="Candidate acceptance plan; requires --acceptance-target")
    arguments = parser.parse_args()
    if bool(arguments.acceptance_target) != bool(arguments.plan_id) or arguments.acceptance_target and not arguments.check:
        parser.error("Release acceptance requires --check, --acceptance-target and --plan-id together")
    try:
        result = validate_zip(arguments.check) if arguments.check else build_zip(ROOT, arguments.output)
        if arguments.acceptance_target:
            result["acceptance"] = validate_release_acceptance(ROOT, arguments.check, arguments.acceptance_target, arguments.plan_id)
        else:
            result["acceptance"] = "NOT_EVALUATED: package consistency only; not release readiness"
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(2, f"Package validation failed: {error}\n")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
