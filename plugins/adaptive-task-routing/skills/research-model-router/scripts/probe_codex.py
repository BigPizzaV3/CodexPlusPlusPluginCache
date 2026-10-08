#!/usr/bin/env python3
"""Bounded Codex metadata discovery; no inference, config writes or thread resume.

Python 3.10+, standard library only. Output is evidence, not a routing decision.
Normal Codex startup may update host-owned caches/logs or contact its provider.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import queue
import shlex
import subprocess
import threading
import time

READ_METHODS = frozenset({"initialize", "model/list", "config/read", "thread/read"})
MAX_LINE = 1_048_576
MAX_TOTAL = 8 * MAX_LINE
MAX_STDERR = 65_536


class ProbeError(Exception):
    """Only stable, non-sensitive reason codes should reach stdout."""


def classify_server_exit(stderr):
    """Map bounded private diagnostics to a stable code without returning their text."""
    text = stderr.decode("utf-8", errors="ignore").lower()
    denied = "operation not permitted" in text or "permission denied" in text
    state_failure = ("failed to initialize sqlite state runtime" in text or
                     "failed to initialize state runtime" in text)
    if denied and state_failure:
        return "codex_state_unwritable"
    if denied:
        return "permission_denied"
    return "server_closed"


class Rpc:
    def __init__(self, command, cwd, timeout):
        self.deadline = time.monotonic() + timeout
        self.identifier = 0
        self.process = subprocess.Popen(command, cwd=cwd, stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.messages = queue.Queue(maxsize=16)
        self.stderr_buffer = bytearray()
        self.stderr_done = threading.Event()
        self.stderr_reader = threading.Thread(target=self._read_stderr, daemon=True)
        self.stderr_reader.start()
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read_stderr(self):
        try:
            while True:
                chunk = self.process.stderr.read(4096)
                if not chunk:
                    return
                remaining = MAX_STDERR - len(self.stderr_buffer)
                if remaining > 0:
                    self.stderr_buffer.extend(chunk[:remaining])
        except OSError:
            pass
        finally:
            self.stderr_done.set()

    def _closed_reason(self):
        if not self.stderr_done.wait(timeout=0.25):
            return "server_closed"
        return classify_server_exit(bytes(self.stderr_buffer))

    def _read(self):
        total = 0
        try:
            while True:
                line = self.process.stdout.readline(MAX_LINE + 1)
                total += len(line)
                if not line:
                    self.messages.put(ProbeError(self._closed_reason())); return
                if len(line) > MAX_LINE or total > MAX_TOTAL:
                    self.messages.put(ProbeError("output_limit")); return
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise ValueError()
                # Ignore notifications and unsolicited requests; never execute them.
                if "id" in value and ("result" in value or "error" in value):
                    self.messages.put(value)
        except (ValueError, OSError):
            self.messages.put(ProbeError("invalid_protocol"))

    def _send(self, value):
        try:
            self.process.stdin.write((json.dumps(value) + "\n").encode())
            self.process.stdin.flush()
        except (OSError, ValueError):
            raise ProbeError("server_closed") from None

    def initialize(self):
        self.call("initialize", {"clientInfo": {"name": "atr-metadata-probe", "version": "1.0.0"},
                                 "capabilities": {"experimentalApi": True}})
        self._send({"method": "initialized"})

    def call(self, method, params):
        if method not in READ_METHODS:
            raise ProbeError("method_not_allowed")
        if method == "thread/read" and params.get("includeTurns") is not False:
            raise ProbeError("history_not_allowed")
        if time.monotonic() >= self.deadline:
            raise ProbeError("timeout")
        self.identifier += 1
        self._send({"id": self.identifier, "method": method, "params": params})
        while True:
            remaining = self.deadline - time.monotonic()
            if remaining <= 0:
                raise ProbeError("timeout")
            try:
                value = self.messages.get(timeout=remaining)
            except queue.Empty:
                raise ProbeError("timeout") from None
            if isinstance(value, ProbeError):
                raise value
            if value.get("id") != self.identifier:
                continue
            if "error" in value:
                # Server error text can contain private paths/settings; don't echo it.
                raise ProbeError("rpc_error")
            if not isinstance(value.get("result"), dict):
                raise ProbeError("invalid_response")
            return value["result"]

    def close(self):
        self.process.terminate()
        try:
            self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.process.kill(); self.process.wait(timeout=2)
        self.reader.join(timeout=0.2)
        self.stderr_reader.join(timeout=0.2)
        try:
            self.process.stdin.close()
        except OSError:
            pass
        # The daemon reader may still own the stream if a descendant inherited it.
        if not self.reader.is_alive():
            try:
                self.process.stdout.close()
            except OSError:
                pass
        if not self.stderr_reader.is_alive():
            try:
                self.process.stderr.close()
            except OSError:
                pass


def scalar(value):
    return value if isinstance(value, str) and 0 < len(value) <= 2048 else None


def model_entry(value):
    if not isinstance(value, dict) or not scalar(value.get("model")):
        raise ProbeError("invalid_catalog")
    efforts = value.get("supportedReasoningEfforts", [])
    if not isinstance(efforts, list):
        raise ProbeError("invalid_catalog")
    return {"model": value["model"], "description": scalar(value.get("description")),
            "default_reasoning_effort": scalar(value.get("defaultReasoningEffort")),
            "supported_reasoning_efforts": [scalar(e.get("reasoningEffort")) for e in efforts
                                             if isinstance(e, dict) and scalar(e.get("reasoningEffort"))]}


def detect_surface(process_commands=None):
    """Classify only positive Codex CLI/App process evidence; never return commands."""
    if process_commands is None:
        process_commands = []
        pid = os.getppid()
        try:
            for _ in range(12):
                parent = subprocess.run(["ps", "-o", "ppid=", "-p", str(pid)], check=True,
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                        text=True, timeout=1).stdout.strip()
                command = subprocess.run(["ps", "-o", "command=", "-p", str(pid)], check=True,
                                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                         text=True, timeout=1).stdout.strip()
                if command:
                    process_commands.append(command)
                if not parent or int(parent) <= 0:
                    break
                pid = int(parent)
        except (OSError, ValueError, subprocess.SubprocessError):
            return "unknown", "process_ancestry_unavailable"

    lowered = [command.lower() for command in process_commands]
    if any("/codex.app/" in command or "\\codex.app\\" in command for command in lowered):
        return "codex-app", "process_ancestry_codex_app"
    if any("/chatgpt.app/" in command or "\\chatgpt.app\\" in command for command in lowered):
        return "unknown", "process_ancestry_chatgpt_app"
    for command in process_commands:
        try:
            tokens = shlex.split(command)
        except ValueError:
            tokens = command.split()
        if not tokens:
            continue
        executable = Path(tokens[0]).name.lower()
        if executable in {"codex", "codex.exe"}:
            return "codex-cli", "process_ancestry_codex_cli"
        if executable in {"node", "node.exe"} and len(tokens) > 1:
            entrypoint = Path(tokens[1]).name.lower()
            if entrypoint in {"codex", "codex.js", "codex.mjs"}:
                return "codex-cli", "process_ancestry_codex_cli"
    return "unknown", "no_positive_surface_evidence"


def resolve_auto_surface(report, detected, basis):
    """Use exact-thread origin only when process ancestry did not identify a surface."""
    thread_source = report.get("thread_configuration", {}).get("thread_source")
    if detected == "unknown" and thread_source == "cli":
        detected, basis = "codex-cli", "thread_read_source_cli"
        report.get("catalog", {}).update(scope="current_cli_environment",
                                          applicability="verified",
                                          applicability_basis=basis)
    return {"requested": "auto", "detected": detected, "basis": basis}


def collect(client, cwd, thread_id=None, via_socket=False, surface=None, surface_basis=None):
    observed = datetime.now(timezone.utc).isoformat()
    scope = "explicit_control_socket" if via_socket else "separate_cli_process"
    def observation(source):
        return {"status": "not_probed", "source": source, "scope": scope,
                "observed_at": observed, "applicability": "unverified"}
    report = {"schema_version": 1, "status": "partial",
              "current_configuration": {"model": "unknown", "reasoning_effort": "unknown"},
              "catalog": observation("model/list"),
              "disk_defaults": observation("config/read"),
              "thread_configuration": observation("thread/read"),
              "switch_capability": "not_tested"}
    catalog = report["catalog"]
    catalog["models"] = []
    if surface == "codex-cli":
        catalog.update(scope="current_cli_environment", applicability="verified",
                       applicability_basis=surface_basis or "caller_identified_codex_cli")
    elif surface == "codex-app":
        catalog["applicability_basis"] = (surface_basis or
                                          "separate_cli_process_does_not_establish_app_catalog")
    try:
        cursor, seen, identifiers = None, set(), set()
        for _ in range(20):
            params = {"includeHidden": False, "limit": 100}
            if cursor is not None:
                params["cursor"] = cursor
            page = client.call("model/list", params)
            if not isinstance(page.get("data"), list):
                raise ProbeError("invalid_catalog")
            for raw in page["data"]:
                if isinstance(raw, dict) and raw.get("hidden") is True:
                    continue
                entry = model_entry(raw)
                if entry["model"] in identifiers:
                    raise ProbeError("duplicate_model")
                identifiers.add(entry["model"])
                catalog["models"].append(entry)
            cursor = page.get("nextCursor")
            if cursor is None:
                catalog["status"] = "available" if catalog["models"] else "unavailable"
                break
            if not scalar(cursor) or cursor in seen:
                raise ProbeError("invalid_pagination")
            seen.add(cursor)
        else:
            raise ProbeError("page_limit")
    except ProbeError as error:
        catalog.update(status="partial" if catalog["models"] else "error", reason=str(error))
    config = report["disk_defaults"]
    try:
        result = client.call("config/read", {"includeLayers": False, "cwd": str(cwd)})
        value = result.get("config")
        if not isinstance(value, dict):
            raise ProbeError("invalid_config")
        config.update(status="available", evidence="disk_defaults",
                      model=scalar(value.get("model")),
                      reasoning_effort=scalar(value.get("model_reasoning_effort")))
    except ProbeError as error:
        config.update(status="error", reason=str(error))
    thread = report["thread_configuration"]
    if not thread_id:
        thread.update(status="unavailable", reason="no_exact_thread_id")
    else:
        try:
            value = client.call("thread/read", {"threadId": thread_id, "includeTurns": False}).get("thread")
            if not isinstance(value, dict) or value.get("id") != thread_id:
                raise ProbeError("thread_scope_mismatch")
            status = value.get("status", {})
            state = status.get("type") if isinstance(status, dict) else None
            live = via_socket and state in {"active", "idle"}
            thread.update(status="available", evidence="live_configured" if live else "persisted_or_unverified",
                          thread_state=scalar(state), model=scalar(value.get("model")),
                          reasoning_effort=scalar(value.get("reasoningEffort")),
                          model_provider=scalar(value.get("modelProvider")),
                          thread_source=scalar(value.get("source")))
        except ProbeError as error:
            thread.update(status="scope_mismatch" if str(error) == "thread_scope_mismatch" else "error",
                          reason=str(error))
    statuses = [report[k]["status"] for k in ("catalog", "disk_defaults", "thread_configuration")]
    report["status"] = "available" if all(s == "available" for s in statuses) else "partial"
    if not any(s in {"available", "partial"} for s in statuses):
        report["status"] = "unavailable"
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cwd", type=Path, default=Path.cwd())
    parser.add_argument("--thread-id", default=os.environ.get("CODEX_THREAD_ID"))
    parser.add_argument("--socket", type=Path, help="Verified existing control socket; never starts a daemon")
    parser.add_argument("--surface", choices=("auto", "codex-cli", "codex-app"),
                        help="Surface scope; auto uses bounded process-ancestry evidence")
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args()
    if not 0 < args.timeout <= 30 or not args.cwd.is_dir():
        parser.error("timeout must be in (0, 30] and cwd must be an existing directory")
    if args.socket and (not args.socket.is_absolute() or not args.socket.is_socket()):
        parser.error("socket must be an absolute existing socket path")
    command = ["codex", "app-server", "proxy", "--sock", str(args.socket)] if args.socket else [
        "codex", "app-server", "--stdio", "-c", "analytics.enabled=false"]
    surface = args.surface
    surface_basis = None
    if surface == "auto":
        surface, surface_basis = detect_surface()
        if surface not in {"codex-cli", "codex-app"}:
            surface = None
    client = None
    try:
        client = Rpc(command, args.cwd.resolve(), args.timeout)
        client.initialize()
        result = collect(client, args.cwd.resolve(), args.thread_id, bool(args.socket), surface,
                         surface_basis)
    except (OSError, ProbeError) as error:
        reason = str(error) if isinstance(error, ProbeError) else (
            "permission_denied" if isinstance(error, PermissionError) else "executable_or_transport_unavailable")
        result = {"schema_version": 1, "status": "unavailable", "reason": reason,
                  "current_configuration": {"model": "unknown", "reasoning_effort": "unknown"},
                  "switch_capability": "not_tested"}
    finally:
        if client:
            client.close()
    if args.surface == "auto":
        result["surface_detection"] = resolve_auto_surface(
            result, surface or "unknown", surface_basis or "no_positive_surface_evidence")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["status"] == "unavailable" else 0


if __name__ == "__main__":
    raise SystemExit(main())
