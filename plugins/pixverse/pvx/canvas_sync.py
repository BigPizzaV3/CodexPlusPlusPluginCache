from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .state import canvas_project_binding_path, utc_now


CANVAS_SYNC_STATE_FILENAME = ".canvas-sync-state.json"
CANVAS_PAID_LEDGER_FILENAME = ".canvas-paid-runs.jsonl"
CANVAS_PAID_CONFIRMATION_PLANS_FILENAME = ".canvas-paid-confirmation-plans.jsonl"
CANVAS_SYNC_STATE_SCHEMA_VERSION = "pixverse.canvas_sync_state.v1"
CANVAS_SYNC_REPORT_SCHEMA_VERSION = "pixverse.canvas_sync.v1"
CANVAS_APPROVAL_CONTENT_SCHEMA_VERSION = "pixverse.canvas_approval_content.v2"

# Every runnable Canvas command exposed by the reviewed internal CLI. Keep the
# semantic surface here as well as the command name: a same-name command that
# changes effect or removes an atomic option is just as unsafe as a new command.
CANVAS_REVIEWED_COMMAND_CONTRACTS = {
    "pixverse canvas arrange": {
        "policy": "non_atomic",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset({"--project-id <id>", "--json"}),
    },
    "pixverse canvas project create": {
        "policy": "project_create",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset({"--name <name>", "--description <text>", "--json"}),
    },
    "pixverse canvas graph get": {
        "policy": "read",
        "effect": "",
        "options": frozenset({"--project-id <id>", "--json"}),
    },
    "pixverse canvas graph status": {
        "policy": "read",
        "effect": "",
        "options": frozenset({"--project-id <id>", "--node-ids <a,b,c>", "--json"}),
    },
    "pixverse canvas graph invalid-nodes": {
        "policy": "read",
        "effect": "",
        "options": frozenset({"--project-id <id>", "--json"}),
    },
    "pixverse canvas graph reconcile": {
        "policy": "edit_version",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--node-ids <a,b,c>",
                "--edit-version <n>",
                "--session-id <id>",
                "--run-id <id>",
                "--dispatch-plan-id <id>",
                "--require-dispatch",
                "--json",
            }
        ),
    },
    "pixverse canvas node get": {
        "policy": "read",
        "effect": "",
        "options": frozenset({"--project-id <id>", "--node-id <id>", "--json"}),
    },
    "pixverse canvas node schema": {
        "policy": "read",
        "effect": "",
        "options": frozenset({"--node-type <type>", "--json"}),
    },
    "pixverse canvas node versions": {
        "policy": "read",
        "effect": "",
        "options": frozenset(
            {"--project-id <id>", "--node-id <id>", "--page <n>", "--page-size <n>", "--json"}
        ),
    },
    "pixverse canvas node version": {
        "policy": "read",
        "effect": "",
        "options": frozenset(
            {"--project-id <id>", "--node-id <id>", "--history-id <id>", "--json"}
        ),
    },
    "pixverse canvas node version apply": {
        "policy": "non_atomic",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--node-id <id>",
                "--history-id <id>",
                "--session-id <id>",
                "--run-id <id>",
                "--json",
            }
        ),
    },
    "pixverse canvas node rerun": {
        "policy": "edit_version",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--node-id <id>",
                "--edit-version <n>",
                "--session-id <id>",
                "--run-id <id>",
                "--json",
            }
        ),
    },
    "pixverse canvas node extract-audio": {
        "policy": "non_atomic",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {"--project-id <id>", "--node-id <id>", "--source-node-id <id>", "--json"}
        ),
    },
    "pixverse capabilities canvas": {
        "policy": "read",
        "effect": "",
        "options": frozenset(
            {
                "--node-type <type>",
                "--selector <value>",
                "-m, --model <id>",
                "--raw",
                "--refresh",
                "--json",
            }
        ),
    },
    "pixverse canvas patch dry-run": {
        "policy": "read",
        "effect": "",
        "options": frozenset(
            {
                "--project-id <id>",
                "--patch <input>",
                "--session-id <id>",
                "--run-id <id>",
                "--idempotency-key <key>",
                "--json",
            }
        ),
    },
    "pixverse canvas patch apply": {
        "policy": "patch",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--patch <input>",
                "--session-id <id>",
                "--run-id <id>",
                "--idempotency-key <key>",
                "--json",
            }
        ),
    },
    "pixverse canvas dispatch": {
        "policy": "edit_version",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--node-ids <a,b,c>",
                "--edit-version <n>",
                "--session-id <id>",
                "--run-id <id>",
                "--dispatch-plan-id <id>",
                "--require-dispatch",
                "--json",
            }
        ),
    },
    "pixverse canvas dispatch rebind": {
        "policy": "non_atomic",
        "effect": "mutates_cli_or_remote_state",
        "options": frozenset(
            {
                "--project-id <id>",
                "--dispatch-plan-id <id>",
                "--node-ids <a,b,c>",
                "--session-id <id>",
                "--run-id <id>",
                "--json",
            }
        ),
    },
}

_CANVAS_OPTION_DESCRIPTIONS = {
    "--name <name>": "Project name",
    "--description <text>": "Project description",
    "--project-id <id>": "Canvas project ID",
    "--node-ids <a,b,c>": "Node IDs to process (required, comma-separated)",
    "--edit-version <n>": "Current Canvas edit version (required)",
    "--session-id <id>": "Optional agent session ID (positive decimal)",
    "--run-id <id>": "Optional agent run ID (positive decimal)",
    "--dispatch-plan-id <id>": "Confirmed dispatch plan ID",
    "--require-dispatch": "Fail if no new generation is started",
    "--node-id <id>": "Canvas node ID",
    "--node-type <type>": "Canvas node type (for example video_compose)",
    "--page <n>": "Page number (default: 1)",
    "--page-size <n>": "Items per page, 1..100 (default: 20)",
    "--history-id <id>": "Saved version ID",
    "--source-node-id <id>": "Source video node ID",
    "--selector <value>": "Filter by Canvas adapter route selector",
    "-m, --model <id>": "Resolve mapped CLI capabilities for one model",
    "--raw": "Show the unmodified Canvas capabilities response",
    "--refresh": "Refresh Canvas capabilities from the server",
    "--patch <input>": 'Canvas graph_patch as JSON - a literal string, a file path, or "-" for stdin',
    "--idempotency-key <key>": "Custom stable retry key (automatically derived if omitted)",
    "--json": "Output as JSON",
}
_CANVAS_OPTION_DESCRIPTION_OVERRIDES = {
    ("pixverse canvas arrange", "--project-id <id>"): "Canvas project ID (positive decimal integer string)",
    (
        "pixverse capabilities canvas",
        "--node-type <type>",
    ): "Filter by Canvas node type",
    ("pixverse canvas graph status", "--node-ids <a,b,c>"): "Node IDs to include (comma-separated)",
    (
        "pixverse canvas node version",
        "--history-id <id>",
    ): "Saved version ID (from `canvas node versions`)",
    (
        "pixverse canvas node extract-audio",
        "--node-id <id>",
    ): "Target audio node ID (created if missing)",
    (
        "pixverse canvas dispatch rebind",
        "--dispatch-plan-id <id>",
    ): "Dispatch plan ID",
    (
        "pixverse canvas dispatch rebind",
        "--node-ids <a,b,c>",
    ): "Ready node IDs (required, comma-separated)",
}
CANVAS_REVIEWED_OPTION_DESCRIPTIONS = {
    command: {
        option: _CANVAS_OPTION_DESCRIPTION_OVERRIDES.get(
            (command, option),
            _CANVAS_OPTION_DESCRIPTIONS[option],
        )
        for option in contract["options"]
    }
    for command, contract in CANVAS_REVIEWED_COMMAND_CONTRACTS.items()
}
CANVAS_REVIEWED_COMMAND_CHILDREN = {
    "pixverse canvas node version": frozenset({"apply"}),
    "pixverse canvas dispatch": frozenset({"rebind"}),
}
CANVAS_REVIEWED_COMMAND_POLICIES = {
    command: str(contract["policy"])
    for command, contract in CANVAS_REVIEWED_COMMAND_CONTRACTS.items()
}
# CLI 1.4.5 adds arrange without an edit-version precondition. Recognize its
# exact contract and use the non-atomic mutation guard; older channels need not expose it.
CANVAS_OPTIONAL_REVIEWED_COMMANDS = {"pixverse canvas arrange"}
CANVAS_MUTATION_POLICIES = {
    command: policy
    for command, policy in CANVAS_REVIEWED_COMMAND_POLICIES.items()
    if policy in {"patch", "edit_version", "non_atomic"}
}
CANVAS_PAID_MUTATION_COMMANDS = {
    "pixverse canvas graph reconcile",
    "pixverse canvas node rerun",
    "pixverse canvas dispatch",
}

_VOLATILE_KEYS = {
    "agent_patch_id",
    "created_at",
    "dragging",
    "edit_version",
    "idempotency_key",
    "last_event_id",
    "lock_state",
    "schema_version",
    "trace_id",
    "updated_at",
}
_LAYOUT_KEYS = {"position", "style", "viewport"}


class CanvasGraphError(ValueError):
    pass


class CanvasSyncStateError(ValueError):
    pass


class CanvasSyncLockError(RuntimeError):
    pass


def canvas_command_path(args: list[str]) -> str:
    """Resolve a reviewed Canvas command using the longest matching path."""
    rendered = ["pixverse", *args]
    matches = [
        command
        for command in CANVAS_REVIEWED_COMMAND_POLICIES
        if rendered[: len(command.split())] == command.split()
    ]
    return max(matches, key=lambda command: len(command.split()), default="")


def canvas_mutation_policy(args: list[str]) -> str:
    return CANVAS_MUTATION_POLICIES.get(canvas_command_path(args), "")


def canvas_sync_state_path(*, binding_path: Path | None = None) -> Path:
    binding = binding_path or canvas_project_binding_path()
    return binding.with_name(CANVAS_SYNC_STATE_FILENAME)


def canvas_paid_ledger_path(*, binding_path: Path | None = None) -> Path:
    binding = binding_path or canvas_project_binding_path()
    return binding.with_name(CANVAS_PAID_LEDGER_FILENAME)


def canvas_paid_confirmation_plans_path(*, binding_path: Path | None = None) -> Path:
    binding = binding_path or canvas_project_binding_path()
    return binding.with_name(CANVAS_PAID_CONFIRMATION_PLANS_FILENAME)


@contextmanager
def canvas_sync_lock(
    state_path: Path,
    *,
    timeout_seconds: float = 30.0,
    poll_interval_seconds: float = 0.05,
) -> Iterator[Path]:
    """Serialize local checkpoint read/compare/write and Canvas mutations.

    Atomic rename prevents partial JSON, while this advisory OS lock prevents an
    older local process from replacing a newer accepted checkpoint. Supported OS
    file locks are released automatically if the process exits or crashes.
    """

    lock_path = state_path.with_name(f"{state_path.name}.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        import fcntl
    except ImportError:  # pragma: no cover - Windows fallback
        try:
            import msvcrt
        except ImportError:
            yield from _exclusive_lockfile_fallback(
                lock_path.with_name(f"{lock_path.name}.owner"),
                timeout_seconds=timeout_seconds,
                poll_interval_seconds=poll_interval_seconds,
            )
        else:
            yield from _windows_file_lock(
                lock_path,
                msvcrt=msvcrt,
                timeout_seconds=timeout_seconds,
                poll_interval_seconds=poll_interval_seconds,
            )
        return

    handle = lock_path.open("a+", encoding="utf-8")
    try:
        deadline = time.monotonic() + max(0.0, timeout_seconds)
        while True:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError as exc:
                if time.monotonic() >= deadline:
                    raise CanvasSyncLockError(
                        f"Timed out waiting for the local Canvas checkpoint lock at {lock_path}"
                    ) from exc
                time.sleep(max(0.01, poll_interval_seconds))
        try:
            yield lock_path
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    finally:
        handle.close()


def _windows_file_lock(
    lock_path: Path,
    *,
    msvcrt: Any,
    timeout_seconds: float,
    poll_interval_seconds: float,
) -> Iterator[Path]:
    handle = lock_path.open("a+b")
    try:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"\0")
            handle.flush()
        handle.seek(0)
        deadline = time.monotonic() + max(0.0, timeout_seconds)
        while True:
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                break
            except OSError as exc:
                if time.monotonic() >= deadline:
                    raise CanvasSyncLockError(
                        f"Timed out waiting for the local Canvas checkpoint lock at {lock_path}"
                    ) from exc
                time.sleep(max(0.01, poll_interval_seconds))
        try:
            yield lock_path
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    finally:
        handle.close()


def _exclusive_lockfile_fallback(
    lock_path: Path,
    *,
    timeout_seconds: float,
    poll_interval_seconds: float,
) -> Iterator[Path]:
    deadline = time.monotonic() + max(0.0, timeout_seconds)
    while True:
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(descriptor)
            break
        except FileExistsError as exc:
            if time.monotonic() >= deadline:
                raise CanvasSyncLockError(
                    f"Timed out waiting for the local Canvas checkpoint lock at {lock_path}"
                ) from exc
            time.sleep(max(0.01, poll_interval_seconds))
    try:
        yield lock_path
    finally:
        lock_path.unlink(missing_ok=True)


def canvas_capability_option_declarations(options: Any) -> frozenset[str]:
    if not isinstance(options, dict):
        return frozenset()
    declarations: set[str] = set()
    for declaration in options:
        if not isinstance(declaration, str):
            continue
        normalized = " ".join(declaration.strip().split())
        if normalized.startswith("-"):
            declarations.add(normalized)
    return frozenset(declarations)


def canvas_command_contract_issues(command: dict[str, Any]) -> list[str]:
    path = str(command.get("cmd") or "")
    expected = CANVAS_REVIEWED_COMMAND_CONTRACTS.get(path)
    if expected is None:
        return [f"{path or '<missing cmd>'}: command is not reviewed"]
    issues: list[str] = []
    if command.get("run") is not True:
        issues.append(f"{path}: run must remain true")
    observed_effect = str(command.get("effect") or "")
    expected_effect = str(expected["effect"])
    if observed_effect != expected_effect:
        issues.append(f"{path}: effect {observed_effect!r} != {expected_effect!r}")
    observed_options = canvas_capability_option_declarations(command.get("options"))
    expected_options = expected["options"]
    if observed_options != expected_options:
        missing = sorted(expected_options - observed_options)
        extra = sorted(observed_options - expected_options)
        if missing:
            issues.append(f"{path}: missing reviewed options {', '.join(missing)}")
        if extra:
            issues.append(f"{path}: unreviewed options {', '.join(extra)}")
    observed_option_descriptions = command.get("options")
    expected_option_descriptions = CANVAS_REVIEWED_OPTION_DESCRIPTIONS[path]
    if isinstance(observed_option_descriptions, dict):
        for option in sorted(expected_options & observed_options):
            observed_description = observed_option_descriptions.get(option)
            expected_description = expected_option_descriptions[option]
            if observed_description != expected_description:
                issues.append(
                    f"{path}: option {option} description {observed_description!r} "
                    f"!= {expected_description!r}"
                )
    else:
        issues.append(f"{path}: options must remain an object")
    observed_args = command.get("args")
    project_alias = {"id?": "Canvas project ID (or use --project-id)"}
    alias_reviewed = "--project-id <id>" in expected_options and observed_args == project_alias
    if observed_args not in (None, [], {}) and not alias_reviewed:
        issues.append(f"{path}: positional args are not reviewed: {observed_args!r}")
    observed_destructive = command.get("destructive", False)
    if observed_destructive is not False:
        issues.append(f"{path}: destructive must remain false")
    observed_children = command.get("children")
    if observed_children is None:
        normalized_children = frozenset()
    elif isinstance(observed_children, list) and all(
        isinstance(item, str) for item in observed_children
    ):
        normalized_children = frozenset(observed_children)
        if len(normalized_children) != len(observed_children):
            issues.append(f"{path}: children must not contain duplicates")
    else:
        normalized_children = frozenset()
        issues.append(f"{path}: children must remain a string array")
    expected_children = CANVAS_REVIEWED_COMMAND_CHILDREN.get(path, frozenset())
    if normalized_children != expected_children:
        issues.append(
            f"{path}: children {sorted(normalized_children)!r} != {sorted(expected_children)!r}"
        )
    if command.get("auth") is not True:
        issues.append(f"{path}: auth must remain true")
    return issues


def parse_canvas_graph_output(output: str) -> dict[str, Any]:
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as exc:
        raise CanvasGraphError(f"Canvas graph output is not valid JSON: {exc}") from exc
    graph = _find_graph_payload(payload)
    if graph is None:
        raise CanvasGraphError(
            "Canvas graph output does not contain a graph with project_id, edit_version, and nodes"
        )
    return graph


def snapshot_canvas_graph(
    graph: dict[str, Any],
    *,
    include_layout: bool = False,
) -> dict[str, Any]:
    project_id = _scalar_string(graph.get("project_id"))
    if not project_id:
        raise CanvasGraphError("Canvas graph does not contain a readable project_id")
    edit_version = _integer(graph.get("edit_version"))
    if edit_version is None:
        raise CanvasGraphError("Canvas graph does not contain a readable edit_version")

    project = {
        key: _normalize_value(graph[key], include_layout=include_layout)
        for key in ("name", "description")
        if key in graph
    }
    if include_layout and "viewport" in graph:
        project["viewport"] = _normalize_value(graph["viewport"], include_layout=True)

    nodes: dict[str, Any] = {}
    raw_nodes = graph.get("nodes")
    node_values = list(raw_nodes.values()) if isinstance(raw_nodes, dict) else raw_nodes
    if not isinstance(node_values, (list, tuple)):
        node_values = []
    for raw_node in node_values:
        if not isinstance(raw_node, dict):
            continue
        node_id = _scalar_string(raw_node.get("node_id") or raw_node.get("id"))
        if not node_id:
            continue
        normalized = _normalize_value(raw_node, include_layout=include_layout)
        if isinstance(normalized, dict):
            normalized["node_id"] = node_id
            nodes[node_id] = normalized

    connections: dict[str, Any] = {}
    raw_connections = graph.get("connections", graph.get("edges", []))
    connection_values = list(raw_connections.values()) if isinstance(raw_connections, dict) else raw_connections
    if not isinstance(connection_values, (list, tuple)):
        connection_values = []
    for raw_connection in connection_values:
        if not isinstance(raw_connection, dict):
            continue
        normalized = _normalize_value(raw_connection, include_layout=include_layout)
        if not isinstance(normalized, dict):
            continue
        key = _connection_key(normalized)
        connections[key] = normalized

    return {
        "schema_version": CANVAS_SYNC_STATE_SCHEMA_VERSION,
        "project_id": project_id,
        "edit_version": edit_version,
        "include_layout": include_layout,
        "captured_at": utc_now(),
        "project": project,
        "nodes": dict(sorted(nodes.items())),
        "connections": dict(sorted(connections.items())),
        # Paid approval must bind the raw inputs, not the display-oriented sync
        # normalization (which historically strips nested keys such as style).
        "approval_content": canvas_approval_content(graph),
    }


def canvas_approval_content(graph: dict[str, Any]) -> dict[str, str]:
    """Fingerprint canonical Canvas content, excluding reviewed presentation noise.

    Retain unknown fields and all nested data/params/track/reference content.
    Binding the whole graph is conservative but covers dependencies expressed
    outside edges as well. List ordering is meaningful and is never discarded.

    The Web editor may rewrite a small set of representations without changing
    what will be generated. Normalize only those reviewed equivalences: a title
    duplicated into ``data.extra``, empty materialized image/video/audio reference arrays on the
    reviewed image/video generation node types, and a plain script rewritten as
    a simple ProseMirror paragraph document. Unknown shapes remain byte-for-byte
    approval inputs and therefore fail closed.
    """

    def prose_mirror_plain_text(value: str) -> str | None:
        try:
            document = json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return None
        if not isinstance(document, dict) or set(document) - {"type", "content"}:
            return None
        blocks = document.get("content")
        if document.get("type") != "doc" or not isinstance(blocks, list):
            return None
        paragraphs: list[str] = []
        for block in blocks:
            if not isinstance(block, dict) or set(block) - {"type", "content"}:
                return None
            inline = block.get("content", [])
            if block.get("type") != "paragraph" or not isinstance(inline, list):
                return None
            parts: list[str] = []
            for item in inline:
                if not isinstance(item, dict):
                    return None
                if item.get("type") == "text" and set(item) <= {"type", "text"}:
                    text = item.get("text")
                    if not isinstance(text, str):
                        return None
                    parts.append(text)
                elif item.get("type") in {"hard_break", "hardBreak"} and set(item) == {"type"}:
                    parts.append("\n")
                else:
                    return None
            paragraphs.append("".join(parts))
        return "\n".join(paragraphs)

    missing_title = object()

    def normalize(
        value: Any,
        path: tuple[str, ...] = (),
        *,
        node_title: Any = missing_title,
        node_type: str = "",
        text_node: bool = False,
    ) -> Any:
        if text_node and path[-2:] == ("data", "text") and isinstance(value, str):
            plain_text = prose_mirror_plain_text(value)
            if plain_text is not None:
                return plain_text
        if isinstance(value, list):
            return [
                normalize(
                    item,
                    (*path, str(index)),
                    node_title=node_title,
                    node_type=node_type,
                    text_node=text_node,
                )
                for index, item in enumerate(value)
            ]
        if not isinstance(value, dict):
            return value
        is_node_root = len(path) == 2 and path[0] == "nodes"
        if is_node_root:
            data = value.get("data") if isinstance(value.get("data"), dict) else {}
            info = value.get("info") if isinstance(value.get("info"), dict) else {}
            extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
            node_type = str(
                value.get("node_type")
                or info.get("node_type")
                or extra.get("node_type")
                or ""
            ).lower()
            content_type = str(data.get("content_type") or value.get("content_type") or "").lower()
            node_title = value.get("title", missing_title)
            text_node = node_type in {"script", "text"} or content_type == "text"
        ignored: set[str] = set()
        if not path:
            ignored = {
                "edit_version", "created_at", "updated_at", "trace_id", "last_event_id", "viewport",
            }
        elif len(path) == 2 and path[0] == "nodes":
            ignored = {
                "edit_version", "created_at", "updated_at", "position", "style",
                "width", "height", "selected", "dragging",
            }
        elif len(path) == 3 and path[0] == "nodes" and path[2] == "info":
            ignored = {"dragging"}
        elif len(path) == 2 and path[0] in {"edges", "connections"}:
            ignored = {"edit_version", "created_at", "updated_at", "selected", "style"}
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if key in ignored:
                continue
            if (
                path[-2:] == ("data", "extra")
                and key == "title"
                and node_title is not missing_title
                and item == node_title
            ):
                continue
            if (
                path[-2:] == ("data", "params")
                and node_type in {"image_generate", "video_generate"}
                and key in {
                    "customer_img_paths",
                    "customer_video_paths",
                    "customer_audio_paths",
                }
                and item == []
            ):
                continue
            child = normalize(
                item,
                (*path, key),
                node_title=node_title,
                node_type=node_type,
                text_node=text_node,
            )
            if path[-1:] == ("data",) and child == {} and isinstance(item, dict):
                if (
                    key == "extra"
                    and set(item) == {"title"}
                    and node_title is not missing_title
                    and item.get("title") == node_title
                ):
                    continue
                if (
                    key == "params"
                    and node_type in {"image_generate", "video_generate"}
                    and bool(item)
                    and set(item).issubset(
                        {
                            "customer_img_paths",
                            "customer_video_paths",
                            "customer_audio_paths",
                        }
                    )
                    and all(value == [] for value in item.values())
                ):
                    continue
            normalized[key] = child
        return normalized

    try:
        encoded = json.dumps(
            normalize(graph),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise CanvasGraphError(f"Canvas approval content is not readable JSON: {exc}") from exc
    return {
        "schema_version": CANVAS_APPROVAL_CONTENT_SCHEMA_VERSION,
        "scope": "full_graph",
        "sha256": hashlib.sha256(encoded).hexdigest(),
    }


def diff_canvas_snapshots(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
) -> dict[str, Any]:
    if not previous or previous.get("project_id") != current.get("project_id"):
        return _empty_diff()

    project_changes = _changed_fields(previous.get("project", {}), current.get("project", {}))
    previous_nodes = _dict(previous.get("nodes"))
    current_nodes = _dict(current.get("nodes"))
    previous_ids = set(previous_nodes)
    current_ids = set(current_nodes)

    added_nodes = [_node_summary(current_nodes[node_id]) for node_id in sorted(current_ids - previous_ids)]
    deleted_nodes = [_node_summary(previous_nodes[node_id]) for node_id in sorted(previous_ids - current_ids)]
    updated_nodes: list[dict[str, Any]] = []
    for node_id in sorted(previous_ids & current_ids):
        changes = _changed_fields(previous_nodes[node_id], current_nodes[node_id])
        if changes:
            updated_nodes.append(
                {
                    **_node_summary(current_nodes[node_id]),
                    "changed_fields": changes,
                }
            )

    previous_connections = _dict(previous.get("connections"))
    current_connections = _dict(current.get("connections"))
    previous_connection_ids = set(previous_connections)
    current_connection_ids = set(current_connections)
    added_connections = [
        current_connections[key] for key in sorted(current_connection_ids - previous_connection_ids)
    ]
    deleted_connections = [
        previous_connections[key] for key in sorted(previous_connection_ids - current_connection_ids)
    ]
    updated_connections: list[dict[str, Any]] = []
    for key in sorted(previous_connection_ids & current_connection_ids):
        changes = _changed_fields(previous_connections[key], current_connections[key])
        if changes:
            updated_connections.append({"connection_id": key, "changed_fields": changes})

    change_count = (
        len(project_changes)
        + len(added_nodes)
        + len(updated_nodes)
        + len(deleted_nodes)
        + len(added_connections)
        + len(updated_connections)
        + len(deleted_connections)
    )
    return {
        "change_count": change_count,
        "semantic_changes_detected": change_count > 0,
        "project": {"changed_fields": project_changes},
        "nodes": {
            "added": added_nodes,
            "updated": updated_nodes,
            "deleted": deleted_nodes,
        },
        "connections": {
            "added": added_connections,
            "updated": updated_connections,
            "deleted": deleted_connections,
        },
    }


def verify_canvas_patch_semantics(
    patch: dict[str, Any],
    *,
    previous: dict[str, Any],
    current: dict[str, Any],
) -> dict[str, Any]:
    """Verify that a post-read contains one patch and no unrelated semantic edits.

    This is deliberately narrower than general graph reconciliation. It exists only
    for accepting a post-read whose edit version advanced beyond a successful patch
    receipt while layout was excluded from the checkpoint. Unknown patch shapes or
    semantic changes outside the patch fail closed.
    """

    issues: list[str] = []
    allowed_top_level = {"schema_version", "base_edit_version", "project_id", "nodes"}
    unknown_top_level = sorted(str(key) for key in patch if key not in allowed_top_level)
    if unknown_top_level:
        issues.append(f"unreviewed patch fields: {', '.join(unknown_top_level)}")
    raw_nodes = patch.get("nodes")
    if not isinstance(raw_nodes, list):
        issues.append("patch nodes must be a list")
        raw_nodes = []

    patch_nodes: dict[str, dict[str, Any]] = {}
    allowed_changed_paths: dict[str, set[str]] = {}
    for item in raw_nodes:
        if not isinstance(item, dict):
            issues.append("every patch node must be an object")
            continue
        node_id = _scalar_string(item.get("node_id"))
        if not node_id:
            issues.append("every patch node must have a string node_id")
            continue
        if node_id in patch_nodes:
            issues.append(f"duplicate patch node_id: {node_id}")
            continue
        patch_nodes[node_id] = item
        allowed_changed_paths[node_id] = _canvas_patch_allowed_paths(item, issues=issues)

    current_nodes = _dict(current.get("nodes"))
    for node_id, patch_node in patch_nodes.items():
        current_node = current_nodes.get(node_id)
        if not isinstance(current_node, dict):
            issues.append(f"patched node missing from post-read: {node_id}")
            continue
        _verify_canvas_patch_node(node_id, patch_node, current_node, issues=issues)

    changes = diff_canvas_snapshots(previous, current)
    if changes.get("project", {}).get("changed_fields"):
        issues.append("project metadata changed outside the patch")
    node_changes = changes.get("nodes") if isinstance(changes.get("nodes"), dict) else {}
    for item in node_changes.get("added", []):
        node_id = _scalar_string(item.get("node_id")) if isinstance(item, dict) else ""
        if node_id not in patch_nodes:
            issues.append(f"unrelated node added: {node_id or '<unknown>'}")
    for item in node_changes.get("deleted", []):
        node_id = _scalar_string(item.get("node_id")) if isinstance(item, dict) else ""
        issues.append(f"node deleted outside the reviewed patch shape: {node_id or '<unknown>'}")
    for item in node_changes.get("updated", []):
        if not isinstance(item, dict):
            issues.append("unreadable updated node in post-read diff")
            continue
        node_id = _scalar_string(item.get("node_id"))
        if node_id not in patch_nodes:
            issues.append(f"unrelated node updated: {node_id or '<unknown>'}")
            continue
        allowed = allowed_changed_paths.get(node_id, set())
        for changed in item.get("changed_fields", []):
            path = _scalar_string(changed.get("path")) if isinstance(changed, dict) else ""
            if not path or not any(path == prefix or path.startswith(f"{prefix}.") for prefix in allowed):
                issues.append(f"unrelated field changed on {node_id}: {path or '<unknown>'}")

    connection_changes = changes.get("connections") if isinstance(changes.get("connections"), dict) else {}
    for kind in ("added", "updated", "deleted"):
        for item in connection_changes.get(kind, []):
            if not isinstance(item, dict):
                issues.append(f"unreadable {kind} connection in post-read diff")
                continue
            target_id = _canvas_connection_target_id(item)
            if target_id not in patch_nodes or "depends_on" not in patch_nodes[target_id]:
                issues.append(
                    f"unrelated connection {kind}: {item.get('connection_id') or target_id or '<unknown>'}"
                )

    return {
        "verified": not issues,
        "issues": issues,
        "patch_node_ids": sorted(patch_nodes),
        "semantic_change_count": changes.get("change_count", 0),
        "changes": changes,
    }


def _canvas_patch_allowed_paths(node: dict[str, Any], *, issues: list[str]) -> set[str]:
    allowed = {
        "action_type",
        "data.content_type",
        "data.extra.content_type",
        "data.extra.source",
        "history_id",
        "history_total",
        "source_type",
    }
    field_paths = {
        "node_id": {"node_id"},
        "node_type": {"info.node_type", "data.extra.node_type"},
        "title": {"title", "data.extra.title"},
        "model": {"data.model", "data.params.model"},
        "payload": {"data.params"},
        "artifact": {"data.extra.artifact", "data.text"},
        "depends_on": {"data.extra.depends_on"},
        "file_path": {"file_path", "data.file_path", "data.extra.file_path"},
        "url": {"url", "data.url", "data.extra.url"},
        "thumbnail_url": {"thumbnail_url", "data.thumbnail_url", "data.extra.thumbnail_url"},
        "video_info": {"video_info", "data.video_info", "data.extra.video_info"},
        "action_type": {"action_type"},
        "content_type": {"data.content_type", "data.extra.content_type"},
        "position": set(),
        "style": set(),
    }
    for key in node:
        paths = field_paths.get(str(key))
        if paths is None:
            issues.append(f"unreviewed field on patch node {node.get('node_id')}: {key}")
            continue
        allowed.update(paths)
    return allowed


def _verify_canvas_patch_node(
    node_id: str,
    patch_node: dict[str, Any],
    current_node: dict[str, Any],
    *,
    issues: list[str],
) -> None:
    data = _dict(current_node.get("data"))
    extra = _dict(data.get("extra"))
    info = _dict(current_node.get("info"))
    params = _dict(data.get("params"))
    observed = {
        "node_id": current_node.get("node_id"),
        "node_type": info.get("node_type") or extra.get("node_type"),
        "title": current_node.get("title") or extra.get("title"),
        "model": data.get("model") or params.get("model"),
        "artifact": extra.get("artifact"),
        "depends_on": extra.get("depends_on", []),
        "file_path": current_node.get("file_path") or data.get("file_path") or extra.get("file_path"),
        "url": current_node.get("url") or data.get("url") or extra.get("url"),
        "thumbnail_url": (
            current_node.get("thumbnail_url") or data.get("thumbnail_url") or extra.get("thumbnail_url")
        ),
        "video_info": current_node.get("video_info") or data.get("video_info") or extra.get("video_info"),
        "action_type": current_node.get("action_type"),
        "content_type": data.get("content_type") or extra.get("content_type"),
    }
    for key, expected in patch_node.items():
        if key in {"position", "style"}:
            continue
        if key == "payload":
            if not isinstance(expected, dict) or not _is_value_subset(expected, params):
                issues.append(f"patched payload is not fully present on {node_id}")
            continue
        if key == "artifact":
            if not isinstance(expected, dict) or not _is_value_subset(expected, observed.get("artifact")):
                issues.append(f"patched artifact is not fully present on {node_id}")
            continue
        if key not in observed:
            continue
        if _normalize_value(expected, include_layout=False) != _normalize_value(
            observed.get(key),
            include_layout=False,
        ):
            issues.append(f"patched field {key} is not present on {node_id}")


def _is_value_subset(expected: Any, observed: Any) -> bool:
    if isinstance(expected, dict):
        if not isinstance(observed, dict):
            return False
        return all(key in observed and _is_value_subset(value, observed[key]) for key, value in expected.items())
    if isinstance(expected, list):
        return isinstance(observed, list) and expected == observed
    return expected == observed


def _canvas_connection_target_id(connection: dict[str, Any]) -> str:
    target = connection.get("target")
    if isinstance(target, dict):
        return _scalar_string(target.get("node_id") or target.get("id"))
    return _scalar_string(connection.get("target_node_id") or target)


def load_canvas_sync_state(
    *,
    path: Path | None = None,
    project_id: str = "",
    fail_on_invalid: bool = False,
) -> dict[str, Any] | None:
    target = path or canvas_sync_state_path()
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as exc:
        if fail_on_invalid:
            raise CanvasSyncStateError(f"Canvas checkpoint is unreadable at {target}: {exc}") from exc
        return None
    if not isinstance(payload, dict) or payload.get("schema_version") != CANVAS_SYNC_STATE_SCHEMA_VERSION:
        if fail_on_invalid:
            raise CanvasSyncStateError(
                f"Canvas checkpoint at {target} does not use schema {CANVAS_SYNC_STATE_SCHEMA_VERSION}"
            )
        return None
    if project_id and _scalar_string(payload.get("project_id")) != str(project_id).strip():
        return None
    return payload


def write_canvas_sync_state(snapshot: dict[str, Any], *, path: Path | None = None) -> Path:
    target = path or canvas_sync_state_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(snapshot, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            temporary_path = Path(handle.name)
        temporary_path.replace(target)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return target


def canvas_sync_report(
    *,
    previous: dict[str, Any] | None,
    current: dict[str, Any],
    state_path: Path,
    accepted: bool,
) -> dict[str, Any]:
    changes = diff_canvas_snapshots(previous, current)
    return {
        "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
        "project_id": current["project_id"],
        "baseline_created": previous is None,
        "baseline_edit_version": previous.get("edit_version") if previous else None,
        "current_edit_version": current["edit_version"],
        "edit_version_changed": bool(previous and previous.get("edit_version") != current.get("edit_version")),
        "semantic_changes_detected": changes["semantic_changes_detected"],
        "change_count": changes["change_count"],
        "changes": changes,
        "snapshot_accepted": accepted,
        "state_path": str(state_path),
        "layout_changes_ignored": not bool(current.get("include_layout")),
        "concurrency_contract": {
            "checkpoint": "required_before_mutation",
            "local_checkpoint_lock": "one OS-backed critical section per binding",
            "patch_apply": "graph_patch.base_edit_version",
            "dispatch_reconcile_rerun": "--edit-version",
            "mutation_receipt": "readable edit_version required before accepting post-read",
            "paid_dispatch_reconcile_rerun": (
                "setup/account/balance/model-entitlement preflight, bound plan with explicit --confirmed "
                "or configured --run-if-allowed, durable paid ledger"
            ),
            "paid_recovery": "bounded canvas paid reconcile with explicit deadline",
            "unsupported_without_opt_in": [
                "canvas dispatch rebind",
                "canvas node extract-audio",
                "canvas node version apply",
            ],
            "mutation_retry": "never_automatic",
        },
    }


def render_canvas_sync_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Canvas Sync",
        "",
        f"- Project: `{report['project_id']}`",
        f"- Edit version: `{report.get('baseline_edit_version')}` → `{report['current_edit_version']}`",
        f"- Semantic changes: `{report['change_count']}`",
        f"- Snapshot accepted: `{'yes' if report['snapshot_accepted'] else 'no'}`",
        f"- Sync elapsed: `{report.get('timings', {}).get('elapsed_seconds', 'unknown')}s`",
        f"- State: `{report['state_path']}`",
        "",
    ]
    changes = report["changes"]
    for label, key in (("Added nodes", "added"), ("Updated nodes", "updated"), ("Deleted nodes", "deleted")):
        nodes = changes["nodes"][key]
        if not nodes:
            continue
        lines.extend([f"## {label}", ""])
        for node in nodes:
            title = node.get("title") or node.get("node_type") or "untitled"
            suffix = ""
            if key == "updated":
                fields = ", ".join(change["path"] for change in node.get("changed_fields", []))
                suffix = f" — {fields}" if fields else ""
            lines.append(f"- `{node['node_id']}` · {title}{suffix}")
        lines.append("")
    connection_changes = changes["connections"]
    connection_count = sum(len(connection_changes[key]) for key in ("added", "updated", "deleted"))
    if connection_count:
        lines.extend(["## Connections", "", f"- Changed connections: `{connection_count}`", ""])
    if report["layout_changes_ignored"]:
        lines.append("Layout-only changes (viewport, position, size, dragging state) were ignored.")
    return "\n".join(lines).rstrip() + "\n"


def changed_node_ids(diff: dict[str, Any]) -> set[str]:
    nodes = diff.get("nodes") if isinstance(diff, dict) else None
    if not isinstance(nodes, dict):
        return set()
    result: set[str] = set()
    for key in ("added", "updated", "deleted"):
        values = nodes.get(key)
        if not isinstance(values, list):
            continue
        for item in values:
            if isinstance(item, dict):
                node_id = _scalar_string(item.get("node_id"))
                if node_id:
                    result.add(node_id)
    return result


def _find_graph_payload(payload: Any) -> dict[str, Any] | None:
    if isinstance(payload, dict):
        if "project_id" in payload and "edit_version" in payload and "nodes" in payload:
            return payload
        for key in ("data", "result", "graph"):
            nested = _find_graph_payload(payload.get(key))
            if nested is not None:
                return nested
        if (
            "project_id" in payload
            and "edit_version" in payload
            and _integer(payload.get("node_count")) == 0
        ):
            # The internal CLI omits graph collections for a newly created,
            # genuinely empty Canvas. Keep malformed non-empty responses fail
            # closed, but normalize this explicit empty-graph representation so
            # the first sync can create its concurrency checkpoint.
            graph = dict(payload)
            graph["nodes"] = []
            graph.setdefault("connections", [])
            return graph
    return None


def _normalize_value(value: Any, *, include_layout: bool) -> Any:
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key in sorted(value):
            if key in _VOLATILE_KEYS or (not include_layout and key in _LAYOUT_KEYS):
                continue
            normalized[key] = _normalize_value(value[key], include_layout=include_layout)
        return normalized
    if isinstance(value, list):
        return [_normalize_value(item, include_layout=include_layout) for item in value]
    return value


def _changed_fields(previous: Any, current: Any, prefix: str = "") -> list[dict[str, Any]]:
    if previous == current:
        return []
    if isinstance(previous, dict) and isinstance(current, dict):
        changes: list[dict[str, Any]] = []
        for key in sorted(set(previous) | set(current)):
            path = f"{prefix}.{key}" if prefix else key
            if key not in previous:
                changes.append({"path": path, "before": None, "after": _display_value(current[key])})
            elif key not in current:
                changes.append({"path": path, "before": _display_value(previous[key]), "after": None})
            else:
                changes.extend(_changed_fields(previous[key], current[key], path))
        return changes
    return [{"path": prefix or "$", "before": _display_value(previous), "after": _display_value(current)}]


def _display_value(value: Any) -> Any:
    if isinstance(value, str) and len(value) > 240:
        return value[:237] + "..."
    if isinstance(value, list) and len(value) > 20:
        return [*_display_value(value[:20]), f"... ({len(value) - 20} more)"]
    if isinstance(value, dict):
        return {key: _display_value(item) for key, item in value.items()}
    return value


def _node_summary(node: Any) -> dict[str, Any]:
    if not isinstance(node, dict):
        return {"node_id": "", "title": "", "node_type": ""}
    info = node.get("info") if isinstance(node.get("info"), dict) else {}
    extra = {}
    data = node.get("data")
    if isinstance(data, dict) and isinstance(data.get("extra"), dict):
        extra = data["extra"]
    return {
        "node_id": _scalar_string(node.get("node_id")),
        "title": _scalar_string(node.get("title") or extra.get("title")),
        "node_type": _scalar_string(info.get("node_type") or extra.get("node_type")),
    }


def _connection_key(connection: dict[str, Any]) -> str:
    for key in ("connection_id", "edge_id", "id"):
        value = _scalar_string(connection.get(key))
        if value:
            return value
    canonical = json.dumps(connection, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]


def _empty_diff() -> dict[str, Any]:
    return {
        "change_count": 0,
        "semantic_changes_detected": False,
        "project": {"changed_fields": []},
        "nodes": {"added": [], "updated": [], "deleted": []},
        "connections": {"added": [], "updated": [], "deleted": []},
    }


def _scalar_string(value: Any) -> str:
    if isinstance(value, (str, int)) and not isinstance(value, bool):
        return str(value).strip()
    return ""


def _integer(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}
