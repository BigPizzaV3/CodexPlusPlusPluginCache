from __future__ import annotations

import json
import shlex
from datetime import datetime
from pathlib import Path
from typing import Any

from .state import list_projects, project_dir, project_handoff, pvx_command, read_jsonl, slugify


MEDIA_SUFFIXES = {
    ".aac",
    ".flac",
    ".gif",
    ".jpeg",
    ".jpg",
    ".m4a",
    ".mov",
    ".mp3",
    ".mp4",
    ".png",
    ".wav",
    ".webm",
    ".webp",
}


def project_snapshot(slug: str, *, root: Path | None = None, surface: str = "local") -> dict[str, Any]:
    path = project_dir(slug, root)
    normalized_slug = path.name
    if not path.exists():
        return {
            "slug": normalized_slug,
            "title": normalized_slug,
            "path": str(path),
            "exists": False,
            "stage": "missing",
            "next_action": {
                "label": "Choose or initialize a project",
                "command": f"{pvx_command()} project portfolio --format markdown",
                "reason": "The requested project workspace does not exist.",
            },
        }

    title = _project_title(path)
    updated_at_epoch = _project_updated_at(path)
    notebook = read_jsonl(path / "notebook.jsonl")
    preferences = read_jsonl(path / "preferences.jsonl")
    manifest = read_jsonl(path / "manifest.jsonl")
    if surface == "canvas":
        return _canvas_project_snapshot(path, root=root, title=title, updated_at_epoch=updated_at_epoch,
                                        notebook=notebook, preferences=preferences)
    billing_runs = [row for row in manifest if row.get("event") == "queue.billing"]
    latest_run = billing_runs[-1] if billing_runs else {}
    totals = project_run_totals(billing_runs)
    ledger = totals["assets"]
    latest_ledger = latest_run.get("asset_ledger") if isinstance(latest_run.get("asset_ledger"), list) else []
    latest_ledger = [item for item in latest_ledger if isinstance(item, dict)]
    invoice = latest_run.get("invoice") if isinstance(latest_run.get("invoice"), dict) else {}
    timing = latest_run.get("timing") if isinstance(latest_run.get("timing"), dict) else {}
    prepared_queues = _queue_plans(path)
    queue_specs = [str(item["path"]) for item in prepared_queues]
    deliverables = _media_files(path / "deliverables")
    local_assets = _media_files(path / "assets")
    qa = _latest_qa(path)
    latest_run_epoch = _timestamp_epoch(latest_run.get("at"))
    deliverable_fresh = not latest_run_epoch or _latest_file_epoch(deliverables) >= latest_run_epoch
    if qa:
        qa["fresh_for_latest_run"] = not latest_run_epoch or qa["checked_at_epoch"] >= latest_run_epoch
    current_qa = qa if qa and qa.get("fresh_for_latest_run") else None
    unresolved = _unresolved_tasks(path, manifest)
    failed_assets = [item for item in latest_ledger if str(item.get("status") or "") not in {"", "success"}]
    successful_latest_assets = [item for item in latest_ledger if item.get("status") == "success"]
    successful_assets = [item for item in ledger if item.get("status") == "success"]
    stage = _project_stage(
        unresolved=unresolved,
        failed_assets=failed_assets,
        successful_assets=successful_latest_assets,
        qa=current_qa,
        deliverables=deliverables if deliverable_fresh else [],
        queue_specs=queue_specs,
        notebook=notebook,
        preferences=preferences,
    )
    highlights = _memory_highlights(notebook, preferences)
    significance = _significance_score(
        title=title,
        slug=normalized_slug,
        highlights=highlights,
        ledger=ledger,
        deliverables=deliverables,
        local_assets=local_assets,
        qa=current_qa,
        queue_specs=queue_specs,
    )
    result = {
        "slug": normalized_slug,
        "title": title,
        "path": str(path.resolve()),
        "exists": True,
        "updated_at_epoch": updated_at_epoch,
        "stage": stage,
        "signals": {
            "notebook_entries": len(notebook),
            "preferences": len(preferences),
            "queue_specs": len(queue_specs),
            "billing_runs": len(billing_runs),
            "generated_assets": len(ledger),
            "successful_assets": len(successful_assets),
            "failed_assets": len(failed_assets),
            "local_assets": len(local_assets),
            "deliverables": len(deliverables),
            "latest_run_has_deliverable": bool(deliverables) and deliverable_fresh,
            "unresolved_tasks": len(unresolved),
            "significance_score": significance,
        },
        "memory": highlights,
        "latest_run": {
            "at": latest_run.get("at") or "",
            "wall_seconds": timing.get("wall_seconds"),
            "generated_assets": invoice.get("generated_assets", len(ledger)),
            "total_actual_credits": invoice.get("total_actual_credits"),
            "observed_credit_delta": invoice.get("observed_credit_delta"),
        }
        if latest_run
        else None,
        "project_totals": {
            "billing_runs": len(billing_runs),
            "generated_assets": totals["generated_assets"],
            "successful_assets": totals["successful_assets"],
            "total_attributable_credits": totals["total_attributable_credits"],
            "assets_with_unknown_credits": totals["assets_with_unknown_credits"],
        },
        "assets": [_compact_asset(item) for item in ledger[-12:]],
        "deliverables": deliverables[-8:],
        "local_assets": local_assets[-8:],
        "qa": qa,
        "unresolved_tasks": unresolved,
        "queue_specs": queue_specs,
        "prepared_queues": prepared_queues[-4:],
    }
    result["next_action"] = _next_action(result)
    return result


def _canvas_project_snapshot(path: Path, *, root: Path | None, title: str, updated_at_epoch: int,
                             notebook: list[dict[str, Any]], preferences: list[dict[str, Any]]) -> dict[str, Any]:
    canvas = project_handoff(path.name, root=root, surface="canvas")["canvas"]
    bound = bool(canvas.get("bound"))
    stage_record = canvas.get("stage_status") or {}
    latest = canvas.get("latest_run") or {}
    nodes = canvas.get("cloud_nodes") or []
    generation = latest.get("generation_status") or "unknown"
    slug = shlex.quote(path.name)
    command = f"{pvx_command()} project handoff {slug} --surface canvas --format markdown"
    stage = "canvas_review"
    label, reason = "Review the Canvas and continue cloud nodes", "Cloud outputs do not require local media, QA recovery, or credit reporting."
    if not bound:
        stage, label, reason = "canvas_binding_missing", "Resolve the intended Canvas project", "No valid Canvas binding exists for this selected target; do not create a replacement automatically."
        command = ""
    elif latest.get("run_id") and (latest.get("generation_state") != "started" or generation == "unknown"):
        stage, label, reason = "canvas_needs_recovery", "Recover the existing Canvas run", "Submission ownership is unresolved; inspect the existing run without resubmitting."
        command = f"{pvx_command()} canvas paid reconcile --project {slug} --run-id {shlex.quote(str(latest['run_id']))}"
    elif generation in {"running", "blocked"}:
        stage, label, reason = "canvas_generating", "Follow the existing Canvas run", "Continue cloud status following without downloads or credits."
        command = f"{pvx_command()} canvas paid follow --project {slug} --run-id {shlex.quote(str(latest['run_id']))}"
    elif generation == "failed":
        stage, label, reason = "canvas_needs_attention", "Review failed Canvas nodes", "Keep existing cloud results and obtain a fresh paid plan before any new generation."
    elif (stage_record.get("final_deliverable_status") == "complete"
          and _timestamp_epoch(stage_record.get("recorded_at")) >= _timestamp_epoch(latest.get("submitted_at"))):
        local_paths = stage_record.get("deliverable_paths") or []
        if stage_record.get("delivery_mode") == "local" and (not local_paths or not all(Path(p).is_file() for p in local_paths)):
            stage, label, reason = "canvas_local_delivery_incomplete", "Complete requested local delivery", "The user requested local files, but recorded exports are unavailable; do not regenerate."
        else:
            stage, label, reason = "canvas_delivered", "Continue from the Canvas deliverable", "The recorded stage is complete; cloud delivery does not require a local copy."
    return {
        "slug": path.name, "title": title, "path": str(path.resolve()), "exists": True,
        "surface": "canvas", "stage": stage, "updated_at_epoch": updated_at_epoch,
        "canvas": canvas, "memory": _memory_highlights(notebook, preferences),
        "assets": nodes, "latest_run": latest or None,
        "signals": {"generated_assets": len(nodes), "significance_score": 10 if bound else 0},
        "next_action": {"label": label, "reason": reason, "command": command},
    }


def project_portfolio(*, root: Path | None = None, limit: int = 20, surface: str = "local") -> dict[str, Any]:
    rows = list_projects(root=root, limit=limit)
    snapshots = [project_snapshot(str(row["slug"]), root=root, surface=surface) for row in rows]
    if surface == "canvas":
        snapshots = [item for item in snapshots if item.get("canvas", {}).get("bound")]
    for index, snapshot in enumerate(snapshots):
        # "Continue" should usually mean recent meaningful work, not the
        # historically largest project. Richness filters out empty/demo noise;
        # recency then dominates among credible candidates.
        recency_score = max(0, 100 - index * 5)
        snapshot["resume_score"] = int(snapshot.get("signals", {}).get("significance_score", 0)) + recency_score
    meaningful = [snapshot for snapshot in snapshots if snapshot.get("stage") not in {"idle", "missing"}]
    suggested = max(meaningful, key=lambda item: int(item.get("resume_score", 0)), default=None)
    duplicate_titles = _duplicate_title_groups(snapshots)
    return {
        "surface": surface,
        "projects": snapshots,
        "suggested_resume": _compact_project(suggested) if suggested else None,
        "possible_duplicate_titles": duplicate_titles,
        "selection_rule": "recent activity plus real assets, deliverables, QA, queues, and useful memory",
    }


def project_run_totals(runs: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize unique generated assets without double-counting idempotent reruns."""
    unique: dict[str, dict[str, Any]] = {}
    anonymous_index = 0
    for run in runs:
        run_ledger = run.get("asset_ledger") if isinstance(run.get("asset_ledger"), list) else []
        for item in run_ledger:
            if not isinstance(item, dict):
                continue
            stable = item.get("task_id") or item.get("url") or item.get("path") or item.get("cover_url")
            if stable:
                key = str(stable)
            else:
                anonymous_index += 1
                key = f"anonymous:{anonymous_index}:{item.get('id') or ''}"
            unique[key] = item
    assets = list(unique.values())
    known_credits = [
        item.get("actual_credits")
        for item in assets
        if isinstance(item.get("actual_credits"), (int, float))
        and not isinstance(item.get("actual_credits"), bool)
    ]
    invoice_fallback_credits: list[float] = []
    seen_run_signatures: set[tuple[str, ...]] = set()
    for run_index, run in enumerate(runs):
        run_ledger = run.get("asset_ledger") if isinstance(run.get("asset_ledger"), list) else []
        stable_keys = tuple(
            sorted(
                str(item.get("task_id") or item.get("url") or item.get("path") or item.get("cover_url"))
                for item in run_ledger
                if isinstance(item, dict)
                and (item.get("task_id") or item.get("url") or item.get("path") or item.get("cover_url"))
            )
        )
        signature = stable_keys or (f"anonymous-run:{run_index}",)
        if signature in seen_run_signatures:
            continue
        seen_run_signatures.add(signature)
        unknown_items = [
            item
            for item in run_ledger
            if isinstance(item, dict)
            and not (
                isinstance(item.get("actual_credits"), (int, float))
                and not isinstance(item.get("actual_credits"), bool)
            )
        ]
        invoice = run.get("invoice") if isinstance(run.get("invoice"), dict) else {}
        invoice_total = invoice.get("total_actual_credits")
        if unknown_items and isinstance(invoice_total, (int, float)) and not isinstance(invoice_total, bool):
            itemized = sum(
                item.get("actual_credits")
                for item in run_ledger
                if isinstance(item, dict)
                and isinstance(item.get("actual_credits"), (int, float))
                and not isinstance(item.get("actual_credits"), bool)
            )
            invoice_fallback_credits.append(max(0, invoice_total - itemized))
    total_credits = sum(known_credits) + sum(invoice_fallback_credits)
    return {
        "assets": assets,
        "generated_assets": len(assets),
        "successful_assets": sum(item.get("status") == "success" for item in assets),
        "total_attributable_credits": total_credits if known_credits or invoice_fallback_credits else None,
        "assets_with_unknown_credits": len(assets) - len(known_credits),
    }


def resolve_project_resume(
    selector: str = "",
    *,
    root: Path | None = None,
    limit: int = 20,
    surface: str = "local",
) -> dict[str, Any]:
    portfolio = project_portfolio(root=root, limit=limit, surface=surface)
    projects = portfolio["projects"]
    query = selector.strip()
    matched_by = "portfolio_recommendation"
    candidates: list[dict[str, Any]] = []

    if query:
        normalized = slugify(query)
        exact = [item for item in projects if item.get("slug") == query or item.get("slug") == normalized]
        if exact:
            candidates = exact
            matched_by = "exact_slug"
        else:
            needle = query.casefold()
            candidates = [
                item
                for item in projects
                if needle in str(item.get("slug") or "").casefold()
                or needle in str(item.get("title") or "").casefold()
            ]
            matched_by = "title_or_slug_search"
    elif portfolio.get("suggested_resume"):
        suggested_slug = portfolio["suggested_resume"]["slug"]
        candidates = [item for item in projects if item.get("slug") == suggested_slug]

    if not candidates:
        return {
            "ok": False,
            "query": query,
            "error": "project_not_found" if query else "project_portfolio_empty",
            "message": "No matching meaningful project workspace was found.",
            "recent_projects": [_compact_project(item) for item in projects[:5]],
        }

    selected = max(candidates, key=lambda item: int(item.get("resume_score", 0)))
    alternatives = [
        _compact_project(item)
        for item in sorted(candidates, key=lambda item: int(item.get("resume_score", 0)), reverse=True)
        if item.get("slug") != selected.get("slug")
    ][:4]
    return {
        "ok": True,
        "query": query,
        "matched_by": matched_by,
        "selection_reason": _selection_reason(selected),
        "project": selected,
        "alternatives": alternatives,
        "possible_duplicate_titles": portfolio.get("possible_duplicate_titles", []),
    }


def render_project_resume_markdown(payload: dict[str, Any]) -> str:
    if not payload.get("ok"):
        lines = ["# PixVerse Project Resume", "", str(payload.get("message") or "Project not found.")]
        recent = payload.get("recent_projects") if isinstance(payload.get("recent_projects"), list) else []
        if recent:
            lines.extend(["", "## Recent projects", ""])
            lines.extend(f"- `{item['slug']}` — {item['title']} ({item['stage']})" for item in recent)
        return "\n".join(lines)

    project = payload["project"]
    if project.get("surface") == "canvas":
        canvas = project.get("canvas") or {}
        stage = canvas.get("stage_status") or {}
        action = project.get("next_action") or {}
        lines = ["# PixVerse Canvas Resume", "", f"- Project: **{project['title']}** (`{project['slug']}`)",
                 f"- Canvas: [Open project]({canvas.get('editor_url', '')})",
                 f"- Stage: `{project['stage']}`; position: `{stage.get('position') or 'not recorded'}`",
                 f"- Final deliverable: `{stage.get('final_deliverable_status', 'unknown')}`",
                 f"- Remaining: {', '.join(stage.get('remaining_stages') or []) or 'none recorded'}",
                 "- Technical QA: `not_checked`; downloads and credits are on demand.", "", "## Cloud nodes", ""]
        lines.extend(f"- `{node['node_id']}` — {node.get('title') or node.get('node_type')} (`{node.get('status')}`)"
                     for node in canvas.get("cloud_nodes", []))
        memory = project.get("memory") or {}
        if memory.get("entries"):
            lines.extend(["", "## Remembered context", ""])
            lines.extend(f"- {entry.get('kind', 'note')}: {entry.get('text')}" for entry in memory["entries"])
        lines.extend(["", "## Recommended next move", "", f"{action.get('label')}: {action.get('reason')}"])
        if action.get("command"):
            lines.append(f"`{action['command']}`")
        return "\n".join(lines)
    signals = project.get("signals") if isinstance(project.get("signals"), dict) else {}
    latest_run = project.get("latest_run") if isinstance(project.get("latest_run"), dict) else {}
    totals = project.get("project_totals") if isinstance(project.get("project_totals"), dict) else {}
    unknown_credit_assets = int(totals.get("assets_with_unknown_credits", 0) or 0)
    credit_note = f"; {unknown_credit_assets} asset(s) not itemized" if unknown_credit_assets else ""
    project_credits = totals.get("total_attributable_credits")
    project_credit_text = project_credits if project_credits is not None else "unknown"
    next_action = project.get("next_action") if isinstance(project.get("next_action"), dict) else {}
    lines = [
        "# PixVerse Project Resume",
        "",
        f"- Project: **{project.get('title')}** (`{project.get('slug')}`)",
        f"- Stage: `{project.get('stage')}`",
        f"- Selected because: {payload.get('selection_reason')}",
        f"- Project assets: `{signals.get('generated_assets', 0)}` across `{totals.get('billing_runs', 0)}` run(s); deliverables: `{signals.get('deliverables', 0)}`; unresolved: `{signals.get('unresolved_tasks', 0)}`",
        f"- Project attributable credits: `{project_credit_text}`{credit_note}; latest run: `{latest_run.get('total_actual_credits', 'unknown')}`",
    ]
    qa = project.get("qa") if isinstance(project.get("qa"), dict) else None
    if qa:
        qa_state = (
            "stale after latest generation"
            if qa.get("fresh_for_latest_run") is False
            else "passed"
            if qa.get("ok")
            else "needs attention"
        )
        lines.append(f"- Latest QA: `{qa_state}` ({qa.get('issues_count', 0)} issue(s))")
    memory = project.get("memory") if isinstance(project.get("memory"), dict) else {}
    entries = memory.get("entries") if isinstance(memory.get("entries"), list) else []
    if entries:
        lines.extend(["", "## Remembered context", ""])
        lines.extend(f"- **{item.get('kind', 'note')}** — {item.get('text')}" for item in entries)
    assets = project.get("assets") if isinstance(project.get("assets"), list) else []
    if assets:
        lines.extend(["", "## Recent generated assets", "", "| Role | Model | Status | Task | Credits |", "|---|---|---|---|---:|"])
        lines.extend(
            f"| {_md(item.get('role'))} | {_md(item.get('model'))} | {_md(item.get('status'))} | {_md(item.get('task_id'))} | {_md(item.get('actual_credits'))} |"
            for item in assets
        )
    deliverables = project.get("deliverables") if isinstance(project.get("deliverables"), list) else []
    if deliverables:
        lines.extend(["", "## Deliverables", ""])
        lines.extend(f"- `{item}`" for item in deliverables)
    prepared_queues = project.get("prepared_queues") if isinstance(project.get("prepared_queues"), list) else []
    if project.get("stage") == "ready_to_generate" and prepared_queues:
        prepared = prepared_queues[-1]
        route = prepared.get("route") if isinstance(prepared.get("route"), dict) else {}
        models = ", ".join(str(model) for model in prepared.get("models", []) if model) or "unspecified"
        lines.extend(
            [
                "",
                "## Prepared generation",
                "",
                f"- Tasks: `{prepared.get('task_count', 0)}`; models: `{models}`",
                f"- Route: `{route.get('kind') or 'custom'} / {route.get('control_layer') or 'custom'}`; intent: `{route.get('intent') or 'unspecified'}`",
            ]
        )
        if route.get("reason"):
            lines.append(f"- Why this route: {route['reason']}")
        lines.append(f"- Queue: `{prepared.get('path')}`")
    lines.extend(["", "## Recommended next move", "", f"**{next_action.get('label', 'Continue project')}** — {next_action.get('reason', '')}"])
    if next_action.get("command"):
        lines.extend(["", f"`{next_action['command']}`"])
    return "\n".join(lines)


def render_project_portfolio_markdown(payload: dict[str, Any]) -> str:
    projects = payload.get("projects") if isinstance(payload.get("projects"), list) else []
    if payload.get("surface") == "canvas":
        lines = ["# PixVerse Canvas Portfolio", "", "| Project | Stage | Cloud nodes | Next move |", "|---|---|---:|---|"]
        for item in projects:
            canvas = item.get("canvas") or {}
            action = item.get("next_action") or {}
            lines.append(
                f"| [{_md(item.get('title'))}]({canvas.get('editor_url', '')}) | {_md(item.get('stage'))} | "
                f"{canvas.get('cloud_node_count', 0)} | {_md(action.get('label'))} |"
            )
        lines.extend(["", "Cloud preview is the default. Downloads, local QA, and credits are on demand."])
        return "\n".join(lines)
    lines = [
        "# PixVerse Project Portfolio",
        "",
        "| Project | Stage | Assets | Deliverables | QA | Credits | Next move |",
        "|---|---|---:|---:|---|---:|---|",
    ]
    for item in projects:
        signals = item.get("signals") if isinstance(item.get("signals"), dict) else {}
        totals = item.get("project_totals") if isinstance(item.get("project_totals"), dict) else {}
        qa = item.get("qa") if isinstance(item.get("qa"), dict) else None
        next_action = item.get("next_action") if isinstance(item.get("next_action"), dict) else {}
        qa_text = (
            "stale"
            if qa and qa.get("fresh_for_latest_run") is False
            else "passed"
            if qa and qa.get("ok")
            else "issues"
            if qa
            else "not checked"
        )
        lines.append(
            f"| **{_md(item.get('title'))}** (`{_md(item.get('slug'))}`) | {_md(item.get('stage'))} | "
            f"{signals.get('generated_assets', 0)} | {signals.get('deliverables', 0)} | {qa_text} | "
            f"{_md(totals.get('total_attributable_credits', ''))} | {_md(next_action.get('label'))} |"
        )
    suggested = payload.get("suggested_resume") if isinstance(payload.get("suggested_resume"), dict) else None
    if suggested:
        lines.extend(
            [
                "",
                f"Suggested resume: **{suggested.get('title')}** (`{suggested.get('slug')}`) — stage `{suggested.get('stage')}`.",
            ]
        )
    duplicates = payload.get("possible_duplicate_titles") if isinstance(payload.get("possible_duplicate_titles"), list) else []
    if duplicates:
        lines.extend(["", "Possible duplicate project titles:", ""])
        lines.extend(f"- {item['title']}: {', '.join(f'`{slug}`' for slug in item['slugs'])}" for item in duplicates)
    return "\n".join(lines)


def _project_title(path: Path) -> str:
    project_md = path / "project.md"
    if project_md.exists():
        first_line = project_md.read_text(encoding="utf-8", errors="ignore").splitlines()[:1]
        if first_line and first_line[0].startswith("# "):
            return first_line[0][2:].strip() or path.name
    return path.name


def _project_updated_at(path: Path) -> int:
    return int(
        max(
            (child.stat().st_mtime for child in path.rglob("*") if child.is_file()),
            default=path.stat().st_mtime,
        )
    )


def _queue_plans(path: Path) -> list[dict[str, Any]]:
    plans: list[dict[str, Any]] = []
    # Queue files often start at the project root, but users and agents also
    # organize them under `briefs/`, `queues/`, or another shallow planning
    # folder. Resume should discover that intent instead of treating a prepared
    # project as empty. Generated media and QA trees are excluded so provider
    # payloads or reports cannot masquerade as executable plans.
    ignored_trees = {"assets", "deliverables", "quality"}
    candidates = [
        candidate
        for candidate in path.rglob("*.json")
        if not ignored_trees.intersection(candidate.relative_to(path).parts[:-1])
    ]
    for candidate in sorted(candidates):
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict) or not isinstance(payload.get("tasks"), list):
            continue
        tasks = [item for item in payload["tasks"] if isinstance(item, dict)]
        models: list[str] = []
        for task in tasks:
            model = _command_option(str(task.get("cmd") or task.get("command") or ""), "--model", "-m")
            if model and model not in models:
                models.append(model)
        route = payload.get("route") if isinstance(payload.get("route"), dict) else {}
        reasons = route.get("reasons") if isinstance(route.get("reasons"), list) else []
        plans.append(
            {
                "path": str(candidate.resolve()),
                "updated_at_epoch": candidate.stat().st_mtime,
                "task_count": len(tasks),
                "models": models,
                "route": {
                    "kind": route.get("kind") or "",
                    "intent": route.get("intent") or "",
                    "control_layer": route.get("control_layer") or "",
                    "model": route.get("model") or "",
                    "quality": route.get("quality") or "",
                    "reason": _compact_text(str(reasons[0])) if reasons else "",
                },
            }
        )
    plans.sort(key=lambda item: float(item["updated_at_epoch"]))
    return plans


def _command_option(command: str, *names: str) -> str:
    try:
        argv = shlex.split(command)
    except ValueError:
        return ""
    for index, value in enumerate(argv):
        if value in names and index + 1 < len(argv):
            return argv[index + 1]
        for name in names:
            if value.startswith(f"{name}="):
                return value.split("=", 1)[1]
    return ""


def _media_files(path: Path) -> list[str]:
    if not path.exists():
        return []
    files = [
        candidate
        for candidate in path.rglob("*")
        if candidate.is_file() and candidate.suffix.lower() in MEDIA_SUFFIXES
    ]
    files.sort(key=lambda candidate: candidate.stat().st_mtime)
    return [str(candidate.resolve()) for candidate in files]


def _latest_file_epoch(paths: list[str]) -> float:
    mtimes: list[float] = []
    for value in paths:
        try:
            mtimes.append(Path(value).stat().st_mtime)
        except OSError:
            continue
    return max(mtimes, default=0.0)


def _latest_qa(path: Path) -> dict[str, Any] | None:
    quality = path / "quality"
    if not quality.exists():
        return None
    candidates = [candidate for candidate in quality.glob("*.json") if candidate.is_file()]
    candidates.sort(key=lambda candidate: candidate.stat().st_mtime, reverse=True)
    for candidate in candidates:
        try:
            payload = json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
        issues = payload.get("issues") if isinstance(payload.get("issues"), list) else []
        issues_count = summary.get("assets_with_issues", len(issues))
        ok = payload.get("ok")
        if not isinstance(ok, bool):
            ok = bool(payload.get("exists", True)) and not issues
        return {
            "ok": ok,
            "issues_count": int(issues_count or 0),
            "checked_at": payload.get("checked_at") or "",
            "checked_at_epoch": _timestamp_epoch(payload.get("checked_at")) or candidate.stat().st_mtime,
            "report_path": str(candidate.resolve()),
        }
    return None


def _unresolved_tasks(path: Path, manifest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pending_file = path / "pending-reconcile.jsonl"
    if pending_file.exists():
        rows = read_jsonl(pending_file)
        if rows:
            return [
                {"id": row.get("id") or "", "task_id": row.get("task_id") or "", "reason": row.get("error_class") or "pending_reconcile"}
                for row in rows
            ]
    latest_by_id: dict[str, dict[str, Any]] = {}
    for row in manifest:
        event = str(row.get("event") or "")
        task_id = str(row.get("task_id") or "")
        if task_id and event.startswith("task."):
            latest_by_id[task_id] = row
    return [
        {"id": row.get("id") or "", "task_id": task_id, "reason": row.get("error_class") or row.get("event")}
        for task_id, row in latest_by_id.items()
        if row.get("event") in {"task.submitted", "task.progress", "task.unresolved"}
    ]


def _project_stage(**signals: Any) -> str:
    if signals["unresolved"]:
        return "needs_reconcile"
    if signals["failed_assets"]:
        return "needs_attention"
    if signals["successful_assets"]:
        qa = signals["qa"]
        if qa is None:
            return "delivered" if signals["deliverables"] else "generated"
        if not qa.get("ok"):
            return "needs_attention"
        return "delivered" if signals["deliverables"] else "qa_passed"
    if signals["queue_specs"]:
        return "ready_to_generate"
    if signals["notebook"] or signals["preferences"]:
        return "planning"
    return "idle"


def _memory_highlights(notebook: list[dict[str, Any]], preferences: list[dict[str, Any]]) -> dict[str, Any]:
    entries: list[dict[str, str]] = []
    for record in notebook:
        kind = str(record.get("kind") or "note")
        if kind == "prompt":
            continue
        text = str(record.get("text") or "").strip()
        if text:
            entries.append({"kind": kind, "text": _compact_text(text)})
    for record in preferences:
        text = str(record.get("preference") or record.get("text") or "").strip()
        if text:
            entries.append({"kind": "preference", "text": _compact_text(text)})
    return {"entries": entries[-8:]}


def _significance_score(**signals: Any) -> int:
    score = 0
    score += min(20, len(signals["highlights"].get("entries", [])) * 4)
    score += min(16, len(signals["queue_specs"]) * 4)
    real_assets = [
        item
        for item in signals["ledger"]
        if item.get("task_id") and "example.test" not in str(item.get("url") or item.get("cover_url") or "")
    ]
    score += min(32, len(real_assets) * 8)
    score += min(16, len(signals["local_assets"]) * 4)
    score += min(32, len(signals["deliverables"]) * 16)
    if signals["qa"] and signals["qa"].get("ok"):
        score += 12
    if str(signals["title"]).casefold() != str(signals["slug"]).replace("-", " ").casefold():
        score += 4
    return score


def _compact_asset(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id") or "",
        "role": item.get("role") or item.get("id") or "",
        "kind": item.get("kind") or item.get("media_type") or "",
        "model": item.get("model") or "",
        "status": item.get("status") or "",
        "task_id": item.get("task_id") or "",
        "local_path": item.get("local_path") or "",
        "url_or_path": (
            item.get("local_path")
            or item.get("url")
            or item.get("path")
            or item.get("cover_url")
            or ""
        ),
        "actual_credits": item.get("actual_credits"),
    }


def _next_action(snapshot: dict[str, Any]) -> dict[str, str]:
    slug = str(snapshot.get("slug") or "")
    stage = snapshot.get("stage")
    if stage == "needs_reconcile":
        return {
            "label": "Reconcile submitted tasks",
            "command": f"{pvx_command()} queue reconcile {slug}",
            "reason": "At least one billed or submitted task has no terminal result in project memory.",
        }
    if stage == "needs_attention":
        return {
            "label": "Inspect the failed or weak asset before spending again",
            "command": f"{pvx_command()} project ledger {slug} --format markdown",
            "reason": "The latest run or QA contains an issue that should shape any retry.",
        }
    if stage == "generated":
        return {
            "label": "Deliver generated assets",
            "command": f"{pvx_command()} project ledger {slug} --format markdown",
            "reason": "Generation succeeded; deliver the recorded local files or recover missing downloads. QA runs only when requested or required by a specialized workflow.",
        }
    if stage == "qa_passed":
        return {
            "label": "Choose or package the final deliverable",
            "command": f"{pvx_command()} project ledger {slug} --format markdown",
            "reason": "The generated assets passed QA but no local deliverable is recorded yet.",
        }
    if stage == "delivered":
        return {
            "label": "Continue from the final deliverable without losing prior choices",
            "command": f"{pvx_command()} project search {slug} \"<requested change>\"",
            "reason": "A final local deliverable is already present; search memory before revising. QA is optional.",
        }
    if stage == "ready_to_generate":
        spec = snapshot.get("queue_specs", [""])[-1]
        return {
            "label": "Preflight the prepared queue",
            "command": f"{pvx_command()} quote queue {spec} --format markdown",
            "reason": "A queue exists but no generated run is recorded.",
        }
    if stage == "planning":
        return {
            "label": "Turn remembered decisions into the next queue",
            "command": f"{pvx_command()} project summary {slug}",
            "reason": "The project has useful memory but no prepared generation queue yet.",
        }
    return {
        "label": "Add a brief or choose another project",
        "command": f"{pvx_command()} project portfolio --format markdown",
        "reason": "This workspace contains no meaningful creative state yet.",
    }


def _duplicate_title_groups(projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in projects:
        title_key = slugify(str(item.get("title") or ""), fallback="")
        if title_key:
            groups.setdefault(title_key, []).append(item)
    return [
        {"title": items[0].get("title") or key, "slugs": sorted(str(item.get("slug")) for item in items)}
        for key, items in groups.items()
        if len(items) > 1
    ]


def _compact_project(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    return {
        "slug": item.get("slug"),
        "title": item.get("title"),
        "stage": item.get("stage"),
        "resume_score": item.get("resume_score", 0),
        "next_action": item.get("next_action"),
    }


def _selection_reason(project: dict[str, Any]) -> str:
    signals = project.get("signals") if isinstance(project.get("signals"), dict) else {}
    parts = [f"stage {project.get('stage')}"]
    for key, label in (("generated_assets", "generated asset(s)"), ("deliverables", "deliverable(s)"), ("unresolved_tasks", "unresolved task(s)")):
        value = int(signals.get(key, 0) or 0)
        if value:
            parts.append(f"{value} {label}")
    qa = project.get("qa") if isinstance(project.get("qa"), dict) else None
    if qa:
        if qa.get("fresh_for_latest_run") is False:
            parts.append("QA stale after latest run")
        else:
            parts.append("passing QA" if qa.get("ok") else "QA needing attention")
    return ", ".join(parts)


def _compact_text(value: str, max_length: int = 220) -> str:
    rendered = " ".join(value.split())
    if len(rendered) <= max_length:
        return rendered
    return rendered[: max_length - 3].rstrip() + "..."


def _timestamp_epoch(value: Any) -> float:
    if not isinstance(value, str) or not value.strip():
        return 0.0
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def _md(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("|", "\\|").replace("\n", " ")
