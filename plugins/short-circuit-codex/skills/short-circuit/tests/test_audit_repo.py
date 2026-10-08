from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import TypeAlias

JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)
JsonObject: TypeAlias = dict[str, JsonValue]
ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT / "scripts"


def load_script_module(name: str) -> ModuleType:
    path = SCRIPT_DIR / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def finding(payload: JsonObject, *, title: str) -> JsonObject:
    findings_value = payload.get("findings")
    if not isinstance(findings_value, list):
        raise AssertionError("missing findings list")
    for item in findings_value:
        if isinstance(item, dict) and item.get("title") == title:
            return item
    raise AssertionError(f"missing finding: {title}")


def test_json_output_includes_disclaimer_and_library_lockfile_is_optional(
    tmp_path: Path, capsys
) -> None:
    audit_repo = load_script_module("audit_repo")
    write(tmp_path / "pyproject.toml", "[project]\nname = 'demo'\nversion = '0.1.0'\n")

    exit_code = audit_repo.main(
        ["--path", str(tmp_path), "--python", "--format", "json"]
    )

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["disclaimer"].startswith(
        "This audit checks deterministic structural signals only."
    )
    assert finding(payload, title="pyproject.toml")["status"] == "pass"
    assert finding(payload, title="uv lockfile")["status"] == "unknown"


def test_app_profile_strict_requires_lockfile(tmp_path: Path, capsys) -> None:
    audit_repo = load_script_module("audit_repo")
    write(tmp_path / "pyproject.toml", "[project]\nname = 'demo'\nversion = '0.1.0'\n")

    exit_code = audit_repo.main(
        [
            "--path",
            str(tmp_path),
            "--profile",
            "app",
            "--python",
            "--strict",
            "--format",
            "json",
        ]
    )

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    uv_lock = finding(payload, title="uv lockfile")
    detail = uv_lock.get("detail")
    assert uv_lock["status"] == "fail"
    assert isinstance(detail, str)
    assert "app/production profile expects" in detail


def test_markdown_output_includes_disclaimer(tmp_path: Path, capsys) -> None:
    audit_repo = load_script_module("audit_repo")
    write(tmp_path / "pyproject.toml", "[project]\nname = 'demo'\nversion = '0.1.0'\n")

    exit_code = audit_repo.main(["--path", str(tmp_path), "--python"])

    assert exit_code == 0
    output = capsys.readouterr().out
    assert output.startswith("# Short Circuit Repo Audit")
    assert "> This audit checks deterministic structural signals only." in output


def test_strict_ci_fails_frozen_sync_without_lockfile(tmp_path: Path, capsys) -> None:
    audit_repo = load_script_module("audit_repo")
    write(
        tmp_path / ".github" / "workflows" / "tests.yml",
        "steps:\n  - run: uv sync --frozen\n",
    )
    write(
        tmp_path / ".github" / "workflows" / "check.yml",
        "steps:\n  - run: uv run ruff check\n",
    )

    exit_code = audit_repo.main(
        ["--path", str(tmp_path), "--ci", "--strict", "--format", "json"]
    )

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    frozen = finding(payload, title="frozen sync lockfile")
    detail = frozen.get("detail")
    assert frozen["status"] == "fail"
    assert isinstance(detail, str)
    assert "uv sync --frozen but uv.lock is absent" in detail
