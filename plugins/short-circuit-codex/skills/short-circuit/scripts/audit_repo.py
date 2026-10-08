#!/usr/bin/env python3
from __future__ import annotations as _annotations

import argparse
import json
import re
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TypeAlias

Status = Literal["pass", "warn", "fail", "unknown"]
Profile = Literal["library", "app", "monorepo"]
TomlValue: TypeAlias = (
    None | bool | int | float | str | list["TomlValue"] | dict[str, "TomlValue"]
)
TomlTable: TypeAlias = dict[str, TomlValue]

DISCLAIMER = (
    "This audit checks deterministic structural signals only. It does not validate code quality, "
    "test meaning, type escape justification, security, runtime correctness, product fit, or "
    "production readiness."
)


@dataclass(frozen=True, kw_only=True)
class Finding:
    check: str
    status: Status
    title: str
    detail: str
    path: str | None = None


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except UnicodeDecodeError:
        return path.read_text(errors="replace")


def _load_pyproject(root: Path) -> TomlTable:
    path = root / "pyproject.toml"
    if not path.exists():
        return {}
    with path.open("rb") as f:
        data = tomllib.load(f)
    if isinstance(data, dict):
        return data
    return {}


def _has_dependency(pyproject: TomlTable, names: set[str]) -> dict[str, bool]:
    found = {name: False for name in names}
    project = pyproject.get("project")
    dependencies: list[str] = []
    if isinstance(project, dict):
        raw_deps = project.get("dependencies")
        if isinstance(raw_deps, list):
            dependencies.extend(str(dep) for dep in raw_deps)
        optional = project.get("optional-dependencies")
        if isinstance(optional, dict):
            for group in optional.values():
                if isinstance(group, list):
                    dependencies.extend(str(dep) for dep in group)

    dependency_groups = pyproject.get("dependency-groups")
    if isinstance(dependency_groups, dict):
        for group in dependency_groups.values():
            if isinstance(group, list):
                dependencies.extend(str(dep) for dep in group)

    lowered = [dep.lower().replace("_", "-") for dep in dependencies]
    for name in names:
        normalized = name.lower().replace("_", "-")
        found[name] = any(
            dep == normalized
            or dep.startswith(f"{normalized}<")
            or dep.startswith(f"{normalized}>")
            or dep.startswith(f"{normalized}=")
            or dep.startswith(f"{normalized}[")
            or dep.startswith(f"{normalized};")
            or dep.startswith(f"{normalized} ")
            for dep in lowered
        )
    return found


def _table_get(data: TomlTable, *keys: str) -> TomlValue:
    current: TomlValue = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _add_file_presence(
    findings: list[Finding], *, check: str, root: Path, rel: str, title: str
) -> None:
    path = root / rel
    findings.append(
        Finding(
            check=check,
            status="pass" if path.exists() else "fail",
            title=title,
            detail=f"Found {rel}." if path.exists() else f"Missing {rel}.",
            path=rel,
        )
    )


def audit_python(
    root: Path, pyproject: TomlTable, *, strict: bool, profile: Profile
) -> list[Finding]:
    findings: list[Finding] = []
    pyproject_path = root / "pyproject.toml"
    findings.append(
        Finding(
            check="python",
            status="pass" if pyproject_path.exists() else "fail",
            title="pyproject.toml",
            detail="Found pyproject.toml."
            if pyproject_path.exists()
            else "Missing pyproject.toml.",
            path="pyproject.toml",
        )
    )
    uv_lock = root / "uv.lock"
    lock_required = profile == "app"
    findings.append(
        Finding(
            check="python",
            status="pass"
            if uv_lock.exists()
            else ("fail" if strict and lock_required else "unknown"),
            title="uv lockfile",
            detail=(
                "Found uv.lock."
                if uv_lock.exists()
                else "No uv.lock found; acceptable for reusable libraries/templates unless exact builds or production deployment require a lockfile."
                if not lock_required
                else "No uv.lock found; app/production profile expects a committed lockfile."
            ),
            path="uv.lock",
        )
    )

    deps = _has_dependency(
        pyproject,
        {
            "ruff",
            "ty",
            "basedpyright",
            "pytest",
            "pytest-cov",
            "pytest-asyncio",
            "pre-commit",
        },
    )
    for name, exists in deps.items():
        findings.append(
            Finding(
                check="python",
                status="pass"
                if exists
                else (
                    "fail"
                    if strict and name in {"ruff", "ty", "basedpyright", "pytest"}
                    else "warn"
                ),
                title=f"{name} dependency",
                detail=f"{name} appears in project dependencies."
                if exists
                else f"{name} not found in project dependencies.",
            )
        )

    tool = pyproject.get("tool") if isinstance(pyproject.get("tool"), dict) else {}
    assert isinstance(tool, dict)
    for name in ("ruff", "ty", "basedpyright"):
        has_tool = name in tool
        alt = root / (
            "pyrightconfig.json" if name == "basedpyright" else f"{name}.toml"
        )
        findings.append(
            Finding(
                check="python",
                status="pass" if has_tool or alt.exists() else "warn",
                title=f"{name} configuration",
                detail=(
                    f"Found [tool.{name}] in pyproject.toml."
                    if has_tool
                    else f"Found {alt.name}."
                    if alt.exists()
                    else f"No explicit {name} configuration found."
                ),
                path="pyproject.toml"
                if has_tool
                else alt.name
                if alt.exists()
                else None,
            )
        )

    return findings


def _make_targets(makefile: str) -> set[str]:
    targets: set[str] = set()
    for line in makefile.splitlines():
        if not line or line.startswith(("\t", "#", ".")):
            continue
        match = re.match(r"^([A-Za-z0-9_.-]+)\s*:(?!=)", line)
        if match is not None:
            targets.add(match.group(1))
    return targets


def audit_makefile(root: Path, *, strict: bool) -> list[Finding]:
    makefile_path = root / "Makefile"
    text = _read_text(makefile_path)
    findings: list[Finding] = [
        Finding(
            check="makefile",
            status="pass" if text is not None else "fail",
            title="Makefile",
            detail="Found Makefile." if text is not None else "Missing Makefile.",
            path="Makefile",
        )
    ]
    if text is None:
        return findings

    targets = _make_targets(text)
    expected = ["check", "format", "format-check", "tests", "pre-commit", "prod"]
    optional = ["serve", "serve-check"]
    for target in expected:
        findings.append(
            Finding(
                check="makefile",
                status="pass" if target in targets else "fail",
                title=f"make {target}",
                detail=f"Found make target {target}."
                if target in targets
                else f"Missing make target {target}.",
                path="Makefile",
            )
        )
    for target in optional:
        findings.append(
            Finding(
                check="makefile",
                status="pass" if target in targets else "unknown",
                title=f"make {target}",
                detail=f"Found make target {target}."
                if target in targets
                else f"No {target} target found; may be fine if docs are absent.",
                path="Makefile",
            )
        )

    uses_uv = "uv run" in text or re.search(r"\buv\s+", text) is not None
    findings.append(
        Finding(
            check="makefile",
            status="pass" if uses_uv else ("fail" if strict else "warn"),
            title="uv-backed Makefile",
            detail="Makefile uses uv."
            if uses_uv
            else "Makefile does not appear to use uv.",
            path="Makefile",
        )
    )

    prod_section = _target_body(text, "prod")
    if prod_section is not None:
        calls = {
            target
            for target in expected
            if re.search(rf"\b(?:make\s+)?{re.escape(target)}\b", prod_section)
        }
        missing = sorted({"check", "tests", "format-check", "pre-commit"} - calls)
        findings.append(
            Finding(
                check="makefile",
                status="pass" if not missing else ("fail" if strict else "warn"),
                title="make prod gates",
                detail="make prod references core gates."
                if not missing
                else f"make prod may not call: {', '.join(missing)}.",
                path="Makefile",
            )
        )
    return findings


def _target_body(makefile: str, target: str) -> str | None:
    lines = makefile.splitlines()
    start: int | None = None
    for index, line in enumerate(lines):
        if re.match(rf"^{re.escape(target)}\s*:(?!=)", line):
            start = index + 1
            break
    if start is None:
        return None
    body: list[str] = []
    for line in lines[start:]:
        if (
            line
            and not line.startswith(("\t", " ", "#"))
            and re.match(r"^[A-Za-z0-9_.-]+\s*:", line)
        ):
            break
        body.append(line)
    return "\n".join(body)


def audit_ci(root: Path, *, strict: bool, profile: Profile) -> list[Finding]:
    workflows = root / ".github" / "workflows"
    findings: list[Finding] = []
    for rel in [".github/workflows/tests.yml", ".github/workflows/check.yml"]:
        _add_file_presence(
            findings, check="ci", root=root, rel=rel, title=Path(rel).name
        )
    publish_path = root / ".github" / "workflows" / "publish.yml"
    publish_required = profile == "app"
    findings.append(
        Finding(
            check="ci",
            status="pass"
            if publish_path.exists()
            else ("fail" if strict and publish_required else "unknown"),
            title="publish.yml",
            detail=(
                "Found .github/workflows/publish.yml."
                if publish_path.exists()
                else "No publish.yml found; acceptable until the package is releasable."
                if not publish_required
                else "Missing publish.yml for app/production profile."
            ),
            path=".github/workflows/publish.yml",
        )
    )

    publish_text = _read_text(root / ".github" / "workflows" / "publish.yml") or ""
    trusted = "id-token: write" in publish_text and (
        "pypa/gh-action-pypi-publish" in publish_text
        or "trusted" in publish_text.lower()
    )
    if publish_text:
        findings.append(
            Finding(
                check="ci",
                status="pass" if trusted else ("fail" if strict else "warn"),
                title="PyPI trusted publishing",
                detail="publish.yml appears to use trusted publishing."
                if trusted
                else "publish.yml does not clearly use PyPI trusted publishing.",
                path=".github/workflows/publish.yml",
            )
        )

    if workflows.exists():
        all_text = "\n".join(
            _read_text(path) or "" for path in workflows.glob("*.y*ml")
        )
        uses_frozen = "uv sync --frozen" in all_text
        has_lock = (root / "uv.lock").exists()
        findings.append(
            Finding(
                check="ci",
                status="pass"
                if "uv " in all_text or "astral-sh/setup-uv" in all_text
                else ("fail" if strict else "warn"),
                title="uv in workflows",
                detail="GitHub workflows appear to use uv."
                if "uv " in all_text or "astral-sh/setup-uv" in all_text
                else "GitHub workflows do not clearly use uv.",
                path=".github/workflows",
            )
        )
        findings.append(
            Finding(
                check="ci",
                status="pass"
                if not uses_frozen or has_lock
                else ("fail" if strict or profile == "app" else "warn"),
                title="frozen sync lockfile",
                detail=(
                    "Frozen uv sync is backed by uv.lock."
                    if uses_frozen and has_lock
                    else "Workflows do not use frozen uv sync."
                    if not uses_frozen
                    else "Workflows use uv sync --frozen but uv.lock is absent."
                ),
                path=".github/workflows",
            )
        )
    return findings


def audit_coverage(root: Path, pyproject: TomlTable, *, strict: bool) -> list[Finding]:
    findings: list[Finding] = []
    coverage_run = _table_get(pyproject, "tool", "coverage", "run")
    coverage_report = _table_get(pyproject, "tool", "coverage", "report")
    branch = isinstance(coverage_run, dict) and coverage_run.get("branch") is True
    fail_under = (
        coverage_report.get("fail_under") if isinstance(coverage_report, dict) else None
    )
    findings.append(
        Finding(
            check="coverage",
            status="pass" if branch else ("fail" if strict else "warn"),
            title="branch coverage",
            detail="Coverage branch measurement is enabled."
            if branch
            else "Coverage branch measurement not found.",
            path="pyproject.toml" if coverage_run is not None else None,
        )
    )
    findings.append(
        Finding(
            check="coverage",
            status="pass"
            if isinstance(fail_under, int | float)
            else ("fail" if strict else "warn"),
            title="coverage fail_under",
            detail=f"Coverage fail_under is {fail_under}."
            if isinstance(fail_under, int | float)
            else "Coverage fail_under not found.",
            path="pyproject.toml" if coverage_report is not None else None,
        )
    )

    makefile = _read_text(root / "Makefile") or ""
    workflows = root / ".github" / "workflows"
    workflow_text = (
        "\n".join(_read_text(path) or "" for path in workflows.glob("*.y*ml"))
        if workflows.exists()
        else ""
    )
    has_cov_command = (
        "pytest-cov" in makefile
        or "--cov" in makefile
        or "coverage report" in makefile
        or "--cov" in workflow_text
    )
    findings.append(
        Finding(
            check="coverage",
            status="pass" if has_cov_command else ("fail" if strict else "warn"),
            title="coverage command",
            detail="Coverage command found in Makefile/workflows."
            if has_cov_command
            else "No coverage command found in Makefile/workflows.",
        )
    )
    return findings


def audit_cassettes(root: Path, pyproject: TomlTable, *, strict: bool) -> list[Finding]:
    findings: list[Finding] = []
    deps = _has_dependency(pyproject, {"casetter"})
    has_cassetter = deps["casetter"]
    findings.append(
        Finding(
            check="cassettes",
            status="pass" if has_cassetter else "unknown",
            title="casetter dependency",
            detail="casetter appears in dependencies."
            if has_cassetter
            else "casetter dependency not found; cassette tests may use another tool or be absent.",
        )
    )

    cassette_dirs = [
        path
        for path in [
            root / "tests" / "cassettes",
            root / "tests" / "fixtures" / "cassettes",
        ]
        if path.exists()
    ]
    findings.append(
        Finding(
            check="cassettes",
            status="pass" if cassette_dirs else "unknown",
            title="cassette directory",
            detail="Found cassette directory: "
            + ", ".join(str(path.relative_to(root)) for path in cassette_dirs)
            if cassette_dirs
            else "No standard cassette directory found.",
        )
    )

    test_files = (
        list((root / "tests").rglob("test_*.py")) if (root / "tests").exists() else []
    )
    vcr_refs = []
    for path in test_files:
        text = _read_text(path) or ""
        if "mark.vcr" in text or "cassette" in text or "vcr_config" in text:
            vcr_refs.append(path)
    findings.append(
        Finding(
            check="cassettes",
            status="pass" if vcr_refs else "unknown",
            title="recorded tests",
            detail=f"Found {len(vcr_refs)} tests with cassette/vcr references."
            if vcr_refs
            else "No cassette/vcr test references found.",
        )
    )

    if has_cassetter and not cassette_dirs and strict:
        findings.append(
            Finding(
                check="cassettes",
                status="fail",
                title="cassette storage",
                detail="casetter is configured but no standard cassette directory was found.",
            )
        )
    return findings


def audit_docs(root: Path, *, strict: bool) -> list[Finding]:
    findings: list[Finding] = []
    mkdocs = root / "mkdocs.yml"
    docs_dir = root / "docs"
    readme = root / "README.md"
    findings.append(
        Finding(
            check="docs",
            status="pass" if readme.exists() else "warn",
            title="README",
            detail="Found README.md." if readme.exists() else "Missing README.md.",
            path="README.md",
        )
    )
    findings.append(
        Finding(
            check="docs",
            status="pass" if mkdocs.exists() else "unknown",
            title="mkdocs",
            detail="Found mkdocs.yml." if mkdocs.exists() else "No mkdocs.yml found.",
            path="mkdocs.yml" if mkdocs.exists() else None,
        )
    )
    findings.append(
        Finding(
            check="docs",
            status="pass" if docs_dir.exists() else "unknown",
            title="docs directory",
            detail="Found docs directory."
            if docs_dir.exists()
            else "No docs directory found.",
            path="docs" if docs_dir.exists() else None,
        )
    )
    makefile = _read_text(root / "Makefile") or ""
    strict_docs = "mkdocs build --strict" in makefile or "build --strict" in makefile
    if mkdocs.exists() or docs_dir.exists():
        findings.append(
            Finding(
                check="docs",
                status="pass" if strict_docs else ("fail" if strict else "warn"),
                title="strict docs build",
                detail="Strict docs build found in Makefile."
                if strict_docs
                else "No strict docs build found in Makefile.",
                path="Makefile",
            )
        )
    return findings


def _render_markdown(findings: list[Finding]) -> str:
    counts = {
        status: sum(1 for item in findings if item.status == status)
        for status in ("fail", "warn", "unknown", "pass")
    }
    lines = [
        "# Short Circuit Repo Audit",
        "",
        "> " + DISCLAIMER,
        "",
        "## Summary",
        "",
        f"- fail: {counts['fail']}",
        f"- warn: {counts['warn']}",
        f"- unknown: {counts['unknown']}",
        f"- pass: {counts['pass']}",
        "",
        "## Findings",
        "",
    ]
    for status in ("fail", "warn", "unknown", "pass"):
        group = [item for item in findings if item.status == status]
        if not group:
            continue
        lines.extend([f"### {status.title()}", ""])
        for item in group:
            path = f" (`{item.path}`)" if item.path else ""
            lines.append(f"- **{item.check}: {item.title}**{path}: {item.detail}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _render_json(findings: list[Finding]) -> str:
    payload = {
        "disclaimer": DISCLAIMER,
        "summary": {
            status: sum(1 for item in findings if item.status == status)
            for status in ("fail", "warn", "unknown", "pass")
        },
        "findings": [
            {
                "check": item.check,
                "status": item.status,
                "title": item.title,
                "detail": item.detail,
                "path": item.path,
            }
            for item in findings
        ],
    }
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit a Python repo against short-circuit expectations."
    )
    parser.add_argument("--path", default=".", help="Repository path to audit.")
    parser.add_argument(
        "--profile",
        choices=("library", "app", "monorepo"),
        default="library",
        help="Repo profile used to interpret optional static checks.",
    )
    parser.add_argument("--all", action="store_true", help="Run all checks.")
    parser.add_argument(
        "--python", action="store_true", help="Audit Python tool/dependency setup."
    )
    parser.add_argument(
        "--makefile", action="store_true", help="Audit Makefile targets."
    )
    parser.add_argument(
        "--ci", action="store_true", help="Audit GitHub workflow setup."
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Audit coverage configuration and commands.",
    )
    parser.add_argument(
        "--cassettes", action="store_true", help="Audit cassette testing signals."
    )
    parser.add_argument("--docs", action="store_true", help="Audit docs signals.")
    parser.add_argument(
        "--strict", action="store_true", help="Promote selected warnings to failures."
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format.",
    )
    parser.add_argument("--out", help="Write output to this path instead of stdout.")
    return parser.parse_args(argv)


def selected_checks(args: argparse.Namespace) -> set[str]:
    checks = {
        name
        for name in ("python", "makefile", "ci", "coverage", "cassettes", "docs")
        if getattr(args, name)
    }
    if args.all or not checks:
        return {"python", "makefile", "ci", "coverage", "cassettes", "docs"}
    return checks


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    root = Path(args.path).expanduser().resolve()
    if not root.exists():
        print(f"Path does not exist: {root}", file=sys.stderr)
        return 2
    pyproject = _load_pyproject(root)
    checks = selected_checks(args)
    findings: list[Finding] = []
    if "python" in checks:
        findings.extend(
            audit_python(root, pyproject, strict=args.strict, profile=args.profile)
        )
    if "makefile" in checks:
        findings.extend(audit_makefile(root, strict=args.strict))
    if "ci" in checks:
        findings.extend(audit_ci(root, strict=args.strict, profile=args.profile))
    if "coverage" in checks:
        findings.extend(audit_coverage(root, pyproject, strict=args.strict))
    if "cassettes" in checks:
        findings.extend(audit_cassettes(root, pyproject, strict=args.strict))
    if "docs" in checks:
        findings.extend(audit_docs(root, strict=args.strict))

    output = (
        _render_json(findings) if args.format == "json" else _render_markdown(findings)
    )
    if args.out:
        Path(args.out).expanduser().write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
