from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

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


def test_success_exports_stdout_and_result(tmp_path: Path, capsys) -> None:
    run_python = load_script_module("run_python")
    stdout_path = tmp_path / "stdout.txt"
    result_path = tmp_path / "result.json"

    exit_code = run_python.main(
        [
            "--code",
            "print('hello'); 2 + 3",
            "--stdout-export",
            str(stdout_path),
            "--result-export",
            str(result_path),
        ]
    )

    assert exit_code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ok"
    assert payload["result"] == 5
    assert stdout_path.read_text(encoding="utf-8") == "hello\n"
    exported = json.loads(result_path.read_text(encoding="utf-8"))
    assert exported["status"] == "ok"
    assert exported["result"] == 5


def test_syntax_error_exports_traceback_to_stderr(tmp_path: Path, capsys) -> None:
    run_python = load_script_module("run_python")
    stderr_path = tmp_path / "stderr.txt"

    exit_code = run_python.main(
        ["--code", "print('unterminated)", "--stderr-export", str(stderr_path)]
    )

    assert exit_code == 1
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "error"
    assert payload["error"]["type"]
    stderr = stderr_path.read_text(encoding="utf-8")
    assert "Traceback" in stderr
    assert "unterminated" in stderr or "closing quote" in stderr


def test_missing_pydantic_monty_has_actionable_error(
    monkeypatch,
) -> None:
    run_python = load_script_module("run_python")
    monkeypatch.setattr(run_python.importlib.util, "find_spec", lambda name: None)

    try:
        run_python._load_pydantic_monty()
    except SystemExit as exc:
        message = str(exc)
    else:
        raise AssertionError("Expected SystemExit when pydantic-monty is missing.")

    assert "pydantic-monty is required" in message
    assert "uv add pydantic-monty" in message
