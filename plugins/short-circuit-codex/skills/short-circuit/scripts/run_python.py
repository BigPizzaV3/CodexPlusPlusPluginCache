#!/usr/bin/env python3
from __future__ import annotations as _annotations

import argparse
import importlib
import importlib.metadata
import importlib.util
import json
import sys
import traceback
from pathlib import Path
from types import ModuleType
from typing import TypeAlias

MIN_PYDANTIC_MONTY_VERSION = "0.0.18"
JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)


def _version_tuple(value: str) -> tuple[int, ...]:
    parts: list[int] = []
    for part in value.split("."):
        digits = "".join(char for char in part if char.isdigit())
        if digits == "":
            break
        parts.append(int(digits))
    return tuple(parts)


def _load_pydantic_monty() -> ModuleType:
    if importlib.util.find_spec("pydantic_monty") is None:
        raise SystemExit(
            "pydantic-monty is required. Install it with `uv add pydantic-monty` "
            "or `pip install pydantic-monty`."
        )
    version = importlib.metadata.version("pydantic-monty")
    if _version_tuple(version) < _version_tuple(MIN_PYDANTIC_MONTY_VERSION):
        raise SystemExit(
            f"pydantic-monty>={MIN_PYDANTIC_MONTY_VERSION} is required; found {version}. "
            "Upgrade with `uv add pydantic-monty` or `pip install -U pydantic-monty`."
        )
    return importlib.import_module("pydantic_monty")


def _read_json_arg(value: str | None, file_path: str | None) -> dict[str, JsonValue]:
    if value is not None and file_path is not None:
        raise SystemExit("Use only one of --inputs or --inputs-file.")
    if file_path is not None:
        value = Path(file_path).expanduser().read_text(encoding="utf-8")
    if value is None:
        return {}
    data = json.loads(value)
    if not isinstance(data, dict):
        raise SystemExit("--inputs must decode to a JSON object.")
    return data


def _read_code(args: argparse.Namespace) -> str:
    if args.code and args.code_file:
        raise SystemExit("Use only one of --code or --code-file.")
    if args.code_file:
        return Path(args.code_file).expanduser().read_text(encoding="utf-8")
    if args.code:
        return args.code
    if not sys.stdin.isatty():
        return sys.stdin.read()
    raise SystemExit("Provide --code, --code-file, or stdin code.")


def _jsonable(value) -> JsonValue:
    try:
        json.dumps(value)
    except TypeError:
        return {"repr": repr(value), "type": type(value).__name__}
    return value


def _write_if_requested(path: str | None, content: str) -> None:
    if path is None:
        return
    output = Path(path).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Python code through pydantic-monty and export captured outputs."
    )
    parser.add_argument("--code", help="Python expression/code to run through Monty.")
    parser.add_argument(
        "--code-file",
        help="File containing Python expression/code to run through Monty.",
    )
    parser.add_argument("--inputs", help="JSON object passed as Monty inputs.")
    parser.add_argument(
        "--inputs-file", help="Path to JSON object passed as Monty inputs."
    )
    parser.add_argument(
        "--input-name",
        action="append",
        default=[],
        help="Extra allowed input name. May be repeated.",
    )
    parser.add_argument(
        "--max-duration-secs",
        type=float,
        help="Monty ResourceLimits max_duration_secs.",
    )
    parser.add_argument(
        "--stdout-export", help="Write captured Monty stdout to this file."
    )
    parser.add_argument(
        "--stderr-export", help="Write captured Monty stderr to this file."
    )
    parser.add_argument(
        "--result-export", help="Write JSON result payload to this file."
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print the JSON result payload to stdout.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    pydantic_monty = _load_pydantic_monty()

    code = _read_code(args)
    inputs = _read_json_arg(args.inputs, args.inputs_file)
    input_names = sorted(set(inputs) | set(args.input_name))
    limits = None
    if args.max_duration_secs is not None:
        limits = pydantic_monty.ResourceLimits(max_duration_secs=args.max_duration_secs)

    status = "ok"
    result = None
    error: dict[str, str] | None = None
    stdout_parts: list[str] = []
    stderr_parts: list[str] = []

    def print_callback(stream: str, text: str) -> None:
        if stream == "stderr":
            stderr_parts.append(text)
        else:
            stdout_parts.append(text)

    try:
        monty = pydantic_monty.Monty(code, inputs=input_names)
        result = monty.run(inputs=inputs, limits=limits, print_callback=print_callback)
    except Exception as exc:  # report Monty errors without hiding captured output
        status = "error"
        formatted_traceback = traceback.format_exc()
        error = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": formatted_traceback,
        }
        if not stderr_parts:
            stderr_parts.append(formatted_traceback)

    captured_stdout = "".join(stdout_parts)
    captured_stderr = "".join(stderr_parts)

    _write_if_requested(args.stdout_export, captured_stdout)
    _write_if_requested(args.stderr_export, captured_stderr)
    payload = {
        "status": status,
        "result": _jsonable(result),
        "error": error,
        "inputs": inputs,
        "input_names": input_names,
        "stdout_export": args.stdout_export,
        "stderr_export": args.stderr_export,
    }
    result_json = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    _write_if_requested(args.result_export, result_json)
    if not args.quiet:
        print(result_json, end="")
    return 0 if status == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
