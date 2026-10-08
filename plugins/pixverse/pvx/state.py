from __future__ import annotations

import json
import os
import shlex
import tempfile
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from .region import PIXVERSE_DEFAULT_REGION, PIXVERSE_REGIONS, effective_pixverse_region


ROOT_MARKERS = (".git", "pyproject.toml", "README.md")
CANVAS_PROJECT_BINDING_FILENAME = ".canvas-project.json"


class CanvasProjectBindingError(ValueError):
    """The local Canvas binding exists but cannot be trusted safely."""


PROJECT_ARTIFACT_TEMPLATES = {
    "brief": (
        "brief.md",
        """# Brief

## Goal

## Audience / Platform

## Hard Constraints

## References

## Scope Classification

- Production depth: direct task / controlled shot / short-film production / long-form production
- Evidence: shot count, recurring identity, dialogue, exact locks, delivery stakes, revision depth
- Why this is the smallest reliable workflow:

## Stage Plan

| Stage | User-visible output | Paid task shape | Approval gate | Editable records |
|---|---|---:|---|---|
| Planning |  | 0 | Creative approval | brief / bibles / storyboard |

## Open Questions
""",
    ),
    "route-board": (
        "route-board.md",
        """# Route Board

| Route | Why it fits | Model / Mode | Cost shape | Risk | Decision |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
""",
    ),
    "storyboard-table": (
        "storyboard-table.md",
        """# Production Storyboard

## Film Locks

| Field | Locked decision |
|---|---|
| Format / aspect |  |
| Target duration |  |
| Audience / platform |  |
| Visual grammar |  |
| Continuity rule |  |
| Sound grammar |  |
| Prohibited elements |  |

## Character Continuity

| Character | Identity anchors | Wardrobe / props | Physical state | Emotional arc | Never change |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Scene Bible

| Scene | Place / time | Spatial anchors | Lighting | Palette / texture | Atmosphere | Continuity risks |
|---|---|---|---|---|---|---|
| A |  |  |  |  |  |  |

## Shot Table

| Shot | Timecode | Dur. | Scene | Story beat | Character state / exact action | Framing / lens | Camera path | Light / palette | Transition | Dialogue / SFX / music cue | Control assets | Paid stage | Approval |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 00:00-00:00 |  | A |  |  |  |  |  |  |  |  | video | pending |

## Visual Timeline

```mermaid
flowchart LR
  "S01 · opening state" --> "S02 · change"
  "S02 · change" --> "S03 · resolution"
```

## Generation Gates

| Gate | What the user sees | Paid tasks | Approval required | Status |
|---|---|---:|---|---|
| Storyboard plan | Shot table + visual timeline | 0 | Creative approval | pending |
| Control assets | Individual frame per approved shot, never one shared contact sheet |  | Preflight; confirm only if enabled | pending |
| Motion preview | Direct clips shown as each succeeds |  | Preflight; confirm only if enabled | pending |
| Finish | Edit, mix, subtitles, QA, deliverable | 0 unless regeneration is requested | Paid rework follows effective confirmation policy | pending |
""",
    ),
    "character-bible": (
        "character-bible.md",
        """# Character Bible

| Character | Narrative role | Age / build | Face / hair anchors | Wardrobe / props | Movement grammar | Voice / sound | Emotional states | Negative constraints | Approved references |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |

## Continuity Checks

- Identity anchors visible in every applicable shot:
- Changes that must be motivated on screen:
- Features the model must never invent:
""",
    ),
    "scene-bible": (
        "scene-bible.md",
        """# Scene Bible

| Scene | Narrative purpose | Geography / blocking | Time / weather | Lighting logic | Palette / materials | Recurring objects | Sound bed | Negative constraints | Approved references |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |

## Spatial Continuity

- Screen direction:
- Entrances / exits:
- Fixed landmarks:
- Allowed dream or time discontinuities:
""",
    ),
    "workflow-profile": (
        "workflow-profile.md",
        """# Workflow Profile

## User Defaults

| Decision | Current preference | Source | Editable? |
|---|---|---|---|
| Scope selection | Smallest chain that clears the quality bar; duration is only one signal | system safety default | yes |
| First visible proof | Direct requested medium for a small task; character/look proof for a continuity project | system safety default | yes |
| Paid confirmation | Preflight each stage; follow the user's effective project confirmation preference | project scope | yes |
| Preview timing | Show successful media immediately, then continue QA | system default | yes |
| Advanced control | Opt-in only | system safety default | yes |

## Preferred Production Chain

1. Interpret the brief, classify production depth, expose assumptions, and explain why the chain is proportionate.
2. Produce a direct preview for a simple request, or character/scene locks plus a detailed zero-cost storyboard for a serious film.
3. Show the exact paid stage quote and editable queue file.
4. Run automatically after preflight unless confirmation is enabled; surface each successful preview immediately.
5. Hand off every editable record, asset, QA report, and deliverable path.

## Advanced-Control Triggers

- Character identity drifts:
- Product/UI/text must remain exact:
- Multi-shot spatial continuity matters:
- User requests shot-level approvals:

## Custom Skill Candidate

- Repeated workflow worth packaging:
- Inputs and required references:
- Fixed stages and approval gates:
- Naming / delivery conventions:
""",
    ),
    "asset-map": (
        "asset-map.md",
        """# Asset Map

| Role | Source | Task id / path / URL | Model / mode | Status | Used by | Notes |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
""",
    ),
    "prompt-ledger": (
        "prompt-ledger.md",
        """# Prompt Ledger

| Version | Asset / task | What changed | What worked | What failed | Next action |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
""",
    ),
    "sound-cue-sheet": (
        "sound-cue-sheet.md",
        """# Sound Cue Sheet

| Time / shot | Required sound | Source | Keep / replace | Mix note | Status |
|---|---|---|---|---|---|
|  |  |  |  |  | planned |
""",
    ),
    "production-canvas": (
        "production-canvas.md",
        """# Production Canvas

```mermaid
flowchart LR
  "Brief" --> "Route Board"
  "Route Board" --> "Boards / References"
  "Boards / References" --> "PixVerse Queue"
  "PixVerse Queue" --> "QA"
  "QA" --> "Final Delivery"
```
""",
    ),
}


def plugin_root() -> Path:
    """Return the installed plugin root independently from the user's workspace."""
    configured = os.environ.get("PIXVERSE_AGENT_PLUGIN_ROOT", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[1]


def pvx_command() -> str:
    """Return a shell-ready command prefix for user-facing next-step messages."""
    executable = os.environ.get("PIXVERSE_AGENT_PVX_EXECUTABLE", "").strip()
    return shlex.quote(executable) if executable else "python -m pvx.cli"


def repo_root(start: Path | None = None) -> Path:
    """Return the user's current project root, not the installed plugin root."""
    current = (start or Path.cwd()).resolve()
    for candidate in (current, *current.parents):
        if any((candidate / marker).exists() for marker in ROOT_MARKERS):
            return candidate
    return current


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def canvas_project_binding_path(
    *,
    root: Path | None = None,
    cwd: Path | None = None,
) -> Path:
    """Locate the closest inspectable Canvas binding for the current project.

    Commands run from ``projects/<slug>`` keep their binding with that project.
    Commands run elsewhere in the workspace use one repository-level default
    under ``projects/``. Only the project id is persisted; the web URL remains
    a local wrapper concern.
    """
    current = (cwd or Path.cwd()).resolve()
    workspace = repo_root(root if root is not None else current)
    projects_root = workspace / "projects"
    try:
        relative = current.relative_to(projects_root)
    except ValueError:
        relative = None
    if relative is not None and relative.parts:
        return projects_root / relative.parts[0] / CANVAS_PROJECT_BINDING_FILENAME
    return projects_root / CANVAS_PROJECT_BINDING_FILENAME


def load_canvas_project_id(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> str:
    payload = _load_canvas_project_binding(path=path, root=root, cwd=cwd)
    project_id = payload.get("project_id")
    if not isinstance(project_id, (str, int)) or isinstance(project_id, bool):
        return ""
    return str(project_id).strip()


def load_canvas_project_region(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> str:
    payload = _load_canvas_project_binding(path=path, root=root, cwd=cwd)
    if not payload:
        return ""
    region = payload.get("region")
    if region is None:
        # Bindings created before regional routing existed belong to the only
        # previously available route.
        return PIXVERSE_DEFAULT_REGION
    return str(region).strip().lower()


def canvas_project_binding_status(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> str:
    payload = _load_canvas_project_binding(path=path, root=root, cwd=cwd)
    status = payload.get("status")
    if status in {"creation_started", "creation_unresolved"}:
        return status
    project_id = payload.get("project_id")
    return (
        "bound"
        if isinstance(project_id, (str, int))
        and not isinstance(project_id, bool)
        and str(project_id).strip()
        else ""
    )


def remember_canvas_project_id(
    project_id: str,
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> Path:
    normalized = str(project_id).strip()
    if not normalized:
        raise ValueError("Canvas project_id must not be empty")
    payload = {
        "schema_version": 1,
        "status": "bound",
        "project_id": normalized,
        "region": effective_pixverse_region(cwd=cwd),
        "updated_at": utc_now(),
    }
    return _write_canvas_project_binding(payload, path=path, root=root, cwd=cwd)


def remember_canvas_project_creation_unresolved(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> Path:
    """Prevent a successful-but-unparseable create from being repeated blindly."""
    requested_region = effective_pixverse_region(cwd=cwd)
    payload = {
        "schema_version": 1,
        "status": "creation_unresolved",
        "region": requested_region,
        "updated_at": utc_now(),
    }
    previous_project_id = _existing_canvas_project_id_for_create_transition(
        path=path,
        root=root,
        cwd=cwd,
    )
    if previous_project_id:
        payload["region"] = load_canvas_project_region(path=path, root=root, cwd=cwd)
        payload["creation_region"] = requested_region
        payload["project_id"] = previous_project_id
        payload["previous_project_id"] = previous_project_id
    return _write_canvas_project_binding(payload, path=path, root=root, cwd=cwd)


def remember_canvas_project_creation_started(
    *,
    attempt_id: str,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> Path:
    """Durably block a second automatic create before contacting the server."""
    normalized = str(attempt_id).strip()
    if not normalized:
        raise ValueError("Canvas creation attempt_id must not be empty")
    requested_region = effective_pixverse_region(cwd=cwd)
    payload = {
        "schema_version": 1,
        "status": "creation_started",
        "attempt_id": normalized,
        "region": requested_region,
        "updated_at": utc_now(),
    }
    previous_project_id = _existing_canvas_project_id_for_create_transition(
        path=path,
        root=root,
        cwd=cwd,
    )
    if previous_project_id:
        payload["region"] = load_canvas_project_region(path=path, root=root, cwd=cwd)
        payload["creation_region"] = requested_region
        payload["project_id"] = previous_project_id
        payload["previous_project_id"] = previous_project_id
    return _write_canvas_project_binding(payload, path=path, root=root, cwd=cwd)


def _existing_canvas_project_id_for_create_transition(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> str:
    """Keep the last usable binding while a replacement create is in flight."""

    try:
        payload = _load_canvas_project_binding(path=path, root=root, cwd=cwd)
    except CanvasProjectBindingError:
        # An explicit create remains a supported way to repair an invalid binding.
        return ""
    project_id = payload.get("project_id")
    if not isinstance(project_id, (str, int)) or isinstance(project_id, bool):
        return ""
    return str(project_id).strip()


def _load_canvas_project_binding(
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> dict[str, Any]:
    binding_path = path or canvas_project_binding_path(root=root, cwd=cwd)
    try:
        payload = json.loads(binding_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as exc:
        raise CanvasProjectBindingError(
            f"Canvas project binding is unreadable at {binding_path}: {exc}"
        ) from exc
    if not isinstance(payload, dict):
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} must contain a JSON object"
        )
    schema_version = payload.get("schema_version")
    if schema_version != 1:
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} has unsupported schema_version "
            f"{schema_version!r}"
        )
    status = payload.get("status")
    project_id = payload.get("project_id")
    region = payload.get("region")
    if region is not None and (
        not isinstance(region, str) or region.strip().lower() not in PIXVERSE_REGIONS
    ):
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} has unsupported region {region!r}"
        )
    creation_region = payload.get("creation_region")
    if creation_region is not None and (
        not isinstance(creation_region, str)
        or creation_region.strip().lower() not in PIXVERSE_REGIONS
    ):
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} has unsupported creation_region "
            f"{creation_region!r}"
        )
    has_project_id = (
        isinstance(project_id, (str, int))
        and not isinstance(project_id, bool)
        and bool(str(project_id).strip())
    )
    if status == "bound" and not has_project_id:
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} is marked bound without a readable project_id"
        )
    if status not in {None, "bound", "creation_started", "creation_unresolved"}:
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} has unsupported status {status!r}"
        )
    if status is None and payload and not has_project_id:
        raise CanvasProjectBindingError(
            f"Canvas project binding at {binding_path} has no readable project_id or recovery status"
        )
    return payload


def _write_canvas_project_binding(
    payload: dict[str, Any],
    *,
    path: Path | None = None,
    root: Path | None = None,
    cwd: Path | None = None,
) -> Path:
    binding_path = path or canvas_project_binding_path(root=root, cwd=cwd)
    binding_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=binding_path.parent,
            prefix=f".{binding_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
            temporary_path = Path(handle.name)
        temporary_path.replace(binding_path)
        try:
            directory_descriptor = os.open(binding_path.parent, os.O_RDONLY)
        except OSError:
            directory_descriptor = None
        if directory_descriptor is not None:
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return binding_path


def slugify(value: str, fallback: str = "untitled") -> str:
    value = unicodedata.normalize("NFKC", value).strip().lower()
    parts: list[str] = []
    previous_separator = False
    for char in value:
        if char.isalnum():
            parts.append(char)
            previous_separator = False
            continue
        if parts and not previous_separator:
            parts.append("-")
            previous_separator = True
    slug = "".join(parts).strip("-")
    return slug or fallback


class InvalidProjectSlug(ValueError):
    """A caller passed a filesystem path where a project slug was required."""


_PATH_SEPARATORS = tuple(sep for sep in ("/", "\\", os.sep, os.altsep) if sep)


def normalize_project_slug(value: str) -> str:
    """Reject path-like project slugs before they reach `slugify()`.

    `slugify()` folds every non-alphanumeric character -- including path
    separators -- into "-", with no validation and no error. So
    `--project projects/perfect-nordic-roadtrip-v05` silently became the slug
    `projects-perfect-nordic-roadtrip-v05` and wrote a whole parallel project
    tree at `projects/projects-perfect-nordic-roadtrip-v05/`. Four completed,
    billed videos were stranded there because nothing ever looked in that
    directory.

    Fail loudly here instead. `slugify()` itself is deliberately left alone: it
    has to keep folding punctuation for unicode project titles.
    """
    raw = str(value).strip()
    if not raw:
        raise InvalidProjectSlug("--project requires a non-empty project slug")
    if any(separator in raw for separator in _PATH_SEPARATORS):
        suggestion = raw.replace("\\", "/").strip("/").rsplit("/", 1)[-1]
        raise InvalidProjectSlug(
            f"--project takes a slug, not a path (got '{raw}'; did you mean '{suggestion}'?)"
        )
    return raw


def project_dir(slug: str, root: Path | None = None) -> Path:
    return repo_root(root) / "projects" / slugify(normalize_project_slug(slug))


def list_projects(root: Path | None = None, limit: int = 50) -> list[dict[str, Any]]:
    projects_root = repo_root(root) / "projects"
    if not projects_root.exists():
        return []
    rows: list[dict[str, Any]] = []
    for path in projects_root.iterdir():
        if not path.is_dir():
            continue
        project_md = path / "project.md"
        title = path.name
        if project_md.exists():
            first_line = project_md.read_text(encoding="utf-8", errors="ignore").splitlines()[:1]
            if first_line and first_line[0].startswith("# "):
                title = first_line[0][2:].strip() or title
        updated_at = max(
            (child.stat().st_mtime for child in path.rglob("*") if child.is_file()),
            default=path.stat().st_mtime,
        )
        rows.append(
            {
                "slug": path.name,
                "title": title,
                "path": str(path),
                "updated_at_epoch": int(updated_at),
            }
        )
    rows.sort(key=lambda item: int(item["updated_at_epoch"]), reverse=True)
    return rows[: max(1, limit)]


def ensure_project(slug: str, title: str | None = None, root: Path | None = None) -> Path:
    path = project_dir(slug, root)
    for child in (
        path,
        path / "assets",
        path / "assets" / "images",
        path / "assets" / "videos",
        path / "assets" / "audio",
        path / "prompts",
        path / "logs",
        path / "quality",
        path / "deliverables",
    ):
        child.mkdir(parents=True, exist_ok=True)
    project_md = path / "project.md"
    if not project_md.exists():
        project_md.write_text(
            "\n".join(
                [
                    f"# {title or slug}",
                    "",
                    f"- created_at: {utc_now()}",
                    "- status: active",
                    "- intent: ",
                    "- visual_direction: ",
                    "- delivery_target: ",
                    "",
                    "## Current Decisions",
                    "",
                    "## Open Questions",
                    "",
                    "## User Notes",
                    "",
                ]
            ),
            encoding="utf-8",
        )
    for name in ("notebook.jsonl", "preferences.jsonl", "manifest.jsonl", "decisions.jsonl"):
        (path / name).touch(exist_ok=True)
    return path


def scaffold_project_artifact(
    slug: str,
    artifact: str,
    *,
    root: Path | None = None,
    force: bool = False,
) -> dict[str, Any]:
    key = artifact.strip().lower()
    if key not in PROJECT_ARTIFACT_TEMPLATES:
        raise ValueError(f"unknown project artifact: {artifact}")
    path = ensure_project(slug, root=root)
    filename, body = PROJECT_ARTIFACT_TEMPLATES[key]
    output = path / "development" / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    created = False
    if not output.exists() or force:
        output.write_text(body.rstrip() + "\n", encoding="utf-8")
        created = True
    return {
        "project": str(path),
        "artifact": key,
        "path": str(output),
        "created": created,
        "overwritten": bool(force and created),
    }


def project_handoff(slug: str, *, stage: str = "current", root: Path | None = None, surface: str = "local") -> dict[str, Any]:
    path = project_dir(slug, root)
    groups: dict[str, list[str]] = {
        "editable": [],
        "memory": [],
        "audit": [],
        "media": [],
    }
    if not path.exists():
        return {
            "project": slugify(slug),
            "project_path": str(path),
            "stage": stage,
            "exists": False,
            "groups": groups,
            "file_count": 0,
            "canvas": {"bound": False},
        }

    memory_names = {"notebook.jsonl", "preferences.jsonl", "decisions.jsonl"}
    for file_path in sorted(candidate for candidate in path.rglob("*") if candidate.is_file()):
        relative = file_path.relative_to(path)
        if relative.name.endswith(".lock"):
            continue
        top = relative.parts[0]
        absolute = str(file_path.resolve())
        if top in {"assets", "deliverables"} or file_path.suffix.lower() in {
            ".mp4",
            ".mov",
            ".webm",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".wav",
            ".mp3",
            ".m4a",
        }:
            groups["media"].append(absolute)
        elif relative.name in memory_names:
            groups["memory"].append(absolute)
        elif relative.name in {"manifest.jsonl", ".canvas-paid-runs.jsonl"} or top in {"quality", "logs"}:
            groups["audit"].append(absolute)
        else:
            groups["editable"].append(absolute)
    canvas = _project_canvas_handoff(path, groups)
    canvas["active"] = surface == "canvas"
    return {
        "project": slugify(slug),
        "project_path": str(path.resolve()),
        "stage": stage,
        "surface": surface,
        "exists": True,
        "groups": groups,
        "canvas": canvas,
        "file_count": sum(len(items) for items in groups.values()),
        "guidance": (
            "Editable files and queue specs may be changed before the next paid stage. "
            "Generated media and manifests are retained as audit evidence."
        ),
    }


def canvas_cloud_nodes(snapshot: dict[str, Any], *, node_ids: list[str] | None = None) -> list[dict[str, Any]]:
    """Project current cloud results without downloading or treating input params as QA evidence."""
    nodes = snapshot.get("nodes") if isinstance(snapshot.get("nodes"), dict) else {}
    projected: list[dict[str, Any]] = []
    for node_id in sorted(nodes if node_ids is None else node_ids):
        node = nodes.get(node_id) if isinstance(nodes.get(node_id), dict) else {}
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        info = node.get("info") if isinstance(node.get("info"), dict) else {}
        references: dict[str, Any] = {}
        metadata: dict[str, Any] = {}
        sources = [("node", node), ("data", data)]
        for name in ("extra", "result", "output"):
            if isinstance(data.get(name), dict):
                sources.append((f"data.{name}", data[name]))
        for source, value in sources:
            for key in ("asset_id", "image_id", "video_id", "audio_id", "task_id", "file_path", "path", "url", "download_url", "cover_url"):
                if isinstance(value.get(key), (str, int)) and not isinstance(value[key], bool):
                    references[key] = value[key]
            for key in ("width", "height", "duration", "fps", "has_audio", "codec"):
                if source != "node" and key in value and isinstance(value[key], (str, int, float, bool)):
                    metadata[key] = {"value": value[key], "source": f"canvas_graph.{source}.{key}"}
        projected.append({
            "node_id": str(node_id),
            "title": str(node.get("title") or info.get("title") or ""),
            "node_type": str(info.get("node_type") or ""),
            "content_type": str(data.get("content_type") or ""),
            "status": _canvas_handoff_node_status(node),
            "references": references,
            "metadata": metadata,
            "technical_qa_status": "not_checked",
        })
    return projected


def _project_canvas_handoff(path: Path, groups: dict[str, list[str]]) -> dict[str, Any]:
    binding_path = path / CANVAS_PROJECT_BINDING_FILENAME
    binding = _read_json_object(binding_path)
    project_id = str(binding.get("project_id") or "").strip()
    if not project_id:
        return {"bound": False, "binding_path": str(binding_path.resolve())}

    sync_path = path / ".canvas-sync-state.json"
    sync = _read_json_object(sync_path)
    if str(sync.get("project_id") or "") != project_id:
        sync = {}
    cloud_by_id = {node["node_id"]: node for node in canvas_cloud_nodes(sync)}
    checkpoint_version = sync.get("edit_version")
    checkpoint_version = checkpoint_version if type(checkpoint_version) is int else 0
    node_versions = {node_id: checkpoint_version for node_id in cloud_by_id}
    paid_rows = [row for row in read_jsonl(path / ".canvas-paid-runs.jsonl")
                 if isinstance(row, dict) and str(row.get("project_id") or "") == project_id]
    starts = [row for row in paid_rows if row.get("event") == "canvas.paid.submission_started"]
    latest_run_id = str(starts[-1].get("run_id") or "") if starts else ""
    latest_run: dict[str, Any] = {"submitted_at": starts[-1].get("at", "")} if starts else {}
    for row in paid_rows:
        if latest_run_id and str(row.get("run_id") or "") == latest_run_id:
            latest_run.update({key: row[key] for key in ("run_id", "generation_state", "generation_status", "node_ids", "download_status", "at") if key in row})
            if isinstance(row.get("billing"), dict):
                latest_run["credits_status"] = row["billing"].get("settlement_state", "not_requested")
        version = row.get("observed_edit_version")
        if type(version) is not int or version < checkpoint_version:
            continue
        for output in row.get("cloud_outputs", []):
            if isinstance(output, dict) and output.get("node_id"):
                node_id = str(output["node_id"])
                if version >= node_versions.get(node_id, checkpoint_version):
                    cloud_by_id[node_id] = output
                    node_versions[node_id] = version
    cloud_nodes = list(cloud_by_id.values())

    canvas_state_names = {
        CANVAS_PROJECT_BINDING_FILENAME,
        ".canvas-sync-state.json",
        ".canvas-paid-runs.jsonl",
    }
    local_only_plans = [
        item
        for item in groups.get("editable", [])
        if Path(item).name not in canvas_state_names
        and Path(item).suffix.lower() in {".md", ".json", ".txt", ".srt"}
    ]
    manifest_rows = read_jsonl(path / "manifest.jsonl")
    localized_preview_copies = _canvas_localized_preview_copies(path, manifest_rows)
    stage_status, stage_status_source = _canvas_stage_handoff_status(manifest_rows)
    return {
        "bound": True,
        "project_id": project_id,
        "editor_url": f"https://app.pixverse.ai/canvas/project/{quote(project_id, safe='')}",
        "binding_path": str(binding_path.resolve()),
        "sync_state_path": str(sync_path.resolve()),
        "accepted_edit_version": sync.get("edit_version"),
        "sync_captured_at": str(sync.get("captured_at") or ""),
        "cloud_node_count": len(cloud_nodes),
        "cloud_nodes": cloud_nodes,
        "local_only_plans": local_only_plans,
        "localized_preview_copies": localized_preview_copies,
        "latest_run": latest_run,
        "preview_surface": "canvas",
        "local_media_required": stage_status.get("delivery_mode") == "local",
        "download_status": latest_run.get("download_status", "not_requested"),
        "credits_status": latest_run.get("credits_status", "not_requested"),
        "technical_qa_status": "not_checked",
        "stage_status": stage_status,
        "next_paid_task": stage_status["next_paid_task"],
        "next_paid_task_source": stage_status_source,
    }


def _canvas_localized_preview_copies(
    project_path: Path,
    manifest_rows: list[dict[str, Any]],
) -> list[str]:
    project_root = project_path.resolve()
    copies: list[str] = []
    seen: set[str] = set()
    for row in manifest_rows:
        if (
            row.get("event") != "task.localized"
            or row.get("source") != "canvas paid follow"
            or row.get("local_preview_status") != "ready"
        ):
            continue
        raw_path = str(row.get("local_path") or "").strip()
        if not raw_path:
            continue
        candidate = Path(raw_path).expanduser()
        if not candidate.is_absolute():
            candidate = project_root / candidate
        resolved = candidate.resolve()
        try:
            resolved.relative_to(project_root)
        except ValueError:
            continue
        rendered = str(resolved)
        if resolved.is_file() and rendered not in seen:
            seen.add(rendered)
            copies.append(rendered)
    return copies


def _canvas_stage_handoff_status(
    manifest_rows: list[dict[str, Any]],
) -> tuple[dict[str, Any], str]:
    latest = next(
        (
            row
            for row in reversed(manifest_rows)
            if row.get("event") == "canvas.stage.handoff"
        ),
        None,
    )
    if not isinstance(latest, dict):
        return (
            {
                "stage": "",
                "position": "",
                "final_deliverable_status": "unknown",
                "remaining_stages": [],
                "next_paid_task": {
                    "description": "",
                    "count": None,
                    "approval_gate": "unknown",
                },
                "recorded_at": "",
                "delivery_mode": "cloud",
                "deliverable_paths": [],
            },
            "not_recorded",
        )
    raw_next = latest.get("next_paid_task")
    next_paid = raw_next if isinstance(raw_next, dict) else {}
    remaining = latest.get("remaining_stages")
    return (
        {
            "stage": str(latest.get("stage") or ""),
            "delivery_mode": str(latest.get("delivery_mode") or "cloud"),
            "deliverable_paths": list(latest.get("deliverable_paths") or []),
            "position": str(latest.get("stage_position") or ""),
            "final_deliverable_status": str(
                latest.get("final_deliverable_status") or "unknown"
            ),
            "remaining_stages": [
                str(item) for item in remaining if str(item).strip()
            ]
            if isinstance(remaining, list)
            else [],
            "next_paid_task": {
                "description": str(next_paid.get("description") or ""),
                "count": next_paid.get("count")
                if isinstance(next_paid.get("count"), int)
                and not isinstance(next_paid.get("count"), bool)
                else None,
                "approval_gate": str(next_paid.get("approval_gate") or "unknown"),
            },
            "recorded_at": str(latest.get("at") or ""),
        },
        "manifest",
    )


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _canvas_handoff_node_status(node: dict[str, Any]) -> str:
    for key in ("status", "task_status", "generation_status", "generate_status", "state"):
        value = node.get(key)
        if isinstance(value, (str, int)) and not isinstance(value, bool) and str(value).strip():
            rendered = str(value).strip()
            normalized = rendered.lower().replace("-", "_").replace(" ", "_")
            if normalized in {"1", "success", "succeeded", "done", "completed", "complete"}:
                return "succeeded"
            if normalized in {"7", "8", "failed", "invalid", "failure", "error", "rejected"}:
                return "failed"
            if normalized in {
                "0",
                "2",
                "5",
                "9",
                "10",
                "pending",
                "queued",
                "waiting",
                "running",
                "generating",
                "processing",
            }:
                return "running"
            return rendered
    for key in ("data", "info", "extra", "result", "task"):
        nested = node.get(key)
        if isinstance(nested, dict):
            rendered = _canvas_handoff_node_status(nested)
            if rendered:
                return rendered
    return "unknown"


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                rows.append(
                    {
                        "kind": "invalid_jsonl",
                        "line": line_number,
                        "error": str(exc),
                        "raw": _compact_text(line),
                    }
                )
    return rows


def search_project(slug: str, query: str, root: Path | None = None, limit: int = 20) -> list[dict[str, Any]]:
    path = project_dir(slug, root)
    needle = query.strip().lower()
    if not needle or not path.exists():
        return []
    results: list[dict[str, Any]] = []
    for file_path in _project_search_files(path):
        if len(results) >= limit:
            break
        if file_path.suffix == ".jsonl":
            results.extend(_search_jsonl_file(path, file_path, needle, limit - len(results)))
        else:
            results.extend(_search_text_file(path, file_path, needle, limit - len(results)))
    return results[:limit]


def _project_search_files(path: Path) -> list[Path]:
    fixed = [
        path / "project.md",
        path / "notebook.jsonl",
        path / "preferences.jsonl",
        path / "manifest.jsonl",
        path / "decisions.jsonl",
    ]
    searchable_suffixes = {".md", ".txt", ".json", ".jsonl", ".srt"}
    root_files = [
        candidate
        for candidate in path.iterdir()
        if candidate.is_file() and candidate.suffix.lower() in searchable_suffixes and candidate not in fixed
    ]
    folders = [path / "development", path / "prompts", path / "quality"]
    discovered: list[Path] = []
    for folder in folders:
        if not folder.exists():
            continue
        for candidate in folder.rglob("*"):
            if candidate.suffix.lower() in searchable_suffixes:
                discovered.append(candidate)
    return [candidate for candidate in fixed if candidate.exists()] + sorted(root_files) + sorted(discovered)


def _search_jsonl_file(root: Path, file_path: Path, needle: str, limit: int) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for line_number, record in enumerate(read_jsonl(file_path), start=1):
        if len(matches) >= limit:
            break
        rendered = json.dumps(record, ensure_ascii=False, sort_keys=True)
        if needle not in rendered.lower():
            continue
        matches.append(
            {
                "file": str(file_path.relative_to(root)),
                "line": line_number,
                "kind": record.get("kind") or record.get("type") or "",
                "text": _compact_text(str(record.get("text") or rendered)),
                "record": record,
            }
        )
    return matches


def _search_text_file(root: Path, file_path: Path, needle: str, limit: int) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    with file_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if len(matches) >= limit:
                break
            if needle not in line.lower():
                continue
            matches.append(
                {
                    "file": str(file_path.relative_to(root)),
                    "line": line_number,
                    "kind": "text",
                    "text": _compact_text(line),
                }
            )
    return matches


def _compact_text(value: str, max_length: int = 280) -> str:
    value = " ".join(value.split())
    if len(value) <= max_length:
        return value
    return value[: max_length - 3].rstrip() + "..."


@dataclass
class MemoryEntry:
    kind: str
    text: str
    source: str = "agent"
    confidence: str = "observed"
    at: str = ""

    def to_record(self) -> dict[str, Any]:
        data = asdict(self)
        data["at"] = data["at"] or utc_now()
        return data


def local_data_home() -> Path:
    base = os.environ.get("PIXVERSE_AGENT_HOME")
    if base:
        return Path(base).expanduser()
    legacy_base = os.environ.get("PVX_HOME")
    if legacy_base:
        return Path(legacy_base).expanduser()
    return Path.home() / ".pixverse-agent-plugin"
