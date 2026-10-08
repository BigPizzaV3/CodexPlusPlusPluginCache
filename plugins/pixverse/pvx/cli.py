from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import re
import shlex
import subprocess
import sys
import tempfile
import time
import uuid
import webbrowser
from pathlib import Path
from typing import Any
from urllib.parse import quote

from . import __version__
from .python_dependencies import PythonDependencyError, ensure_pillow, pillow_status
from .billing import billing_snapshot, insufficient_balance_blocker, quote_queue
from .capabilities import canvas_wrapper_contract_issues, load_create_capabilities
from .canvas_sync import (
    CANVAS_APPROVAL_CONTENT_SCHEMA_VERSION,
    CANVAS_PAID_MUTATION_COMMANDS,
    CANVAS_REVIEWED_COMMAND_CONTRACTS,
    CANVAS_SYNC_REPORT_SCHEMA_VERSION,
    CanvasGraphError,
    CanvasSyncLockError,
    CanvasSyncStateError,
    canvas_command_path,
    canvas_mutation_policy,
    canvas_paid_confirmation_plans_path,
    canvas_paid_ledger_path,
    canvas_sync_report,
    canvas_sync_lock,
    canvas_sync_state_path,
    changed_node_ids,
    diff_canvas_snapshots,
    load_canvas_sync_state,
    parse_canvas_graph_output,
    render_canvas_sync_markdown,
    snapshot_canvas_graph,
    verify_canvas_patch_semantics,
    write_canvas_sync_state,
)
from .compatibility import (
    PIXVERSE_CLI_INSTALL_SPEC,
    PIXVERSE_CLI_MINIMUM_VERSION,
    pixverse_cli_node_requirement,
    pixverse_cli_channel,
    pixverse_cli_effective_install_spec,
    pixverse_cli_install_argv,
    pixverse_cli_internal_artifact,
    pixverse_cli_installed_version,
    pixverse_cli_runtime_root,
    pixverse_cli_source,
    pixverse_cli_version_supported,
)
from .internal_cli import (
    INTERNAL_CLI_CHANNEL,
    InternalCliError,
    InternalCliInstallError,
    install_internal_cli,
    node_version_satisfies,
)
from .pixverse import (
    reuse_record_from_manifest,
    TaskSpec,
    canonicalize_internal_asset_placeholders,
    classify_error,
    create_kind,
    ensure_local_asset,
    load_task_specs,
    media_type_for_kind,
    placeholder_refs,
    reconcile_project,
    run_queue,
    split_command,
    validate_create_argv,
    apply_generation_defaults,
)
from .preferences import (
    MEMBERSHIP_ROUTING_UNRESTRICTED_TEST,
    canvas_quote_confirmation_state,
    membership_routing_mode,
    membership_routing_record,
    preferences_snapshot,
    reset_plugin_memory,
    set_membership_routing_mode,
    set_project_quote_confirmation_mode,
    set_quote_confirmation_mode,
)
from .project_context import (
    project_portfolio,
    project_run_totals,
    render_project_portfolio_markdown,
    render_project_resume_markdown,
    resolve_project_resume,
)
from .qa import inspect_media, sample_frames
from .region import (
    PixVerseRegionError,
    effective_pixverse_region,
    explicit_pixverse_region,
)
from .model_defaults import fallback_route, PROMPT_ENHANCE_SKILL
from .routing import IMAGE_FAMILIES, recommend_route, render_route_markdown
from .shell import CommandResult, run, run_captured, run_passthrough, which
from .skills import list_skills, validate_skills
from .cli_local import build_local_parsers, dispatch_local
from .setup import SETUP_GATE_EXIT, run_setup_doctor, setup_blocker, setup_status
from .state import (
    CANVAS_PROJECT_BINDING_FILENAME,
    CanvasProjectBindingError,
    PROJECT_ARTIFACT_TEMPLATES,
    InvalidProjectSlug,
    MemoryEntry,
    append_jsonl,
    canvas_project_binding_path,
    canvas_project_binding_status,
    canvas_cloud_nodes,
    ensure_project,
    list_projects,
    load_canvas_project_id,
    load_canvas_project_region,
    normalize_project_slug,
    project_dir,
    project_handoff,
    pvx_command,
    read_jsonl,
    remember_canvas_project_creation_started,
    remember_canvas_project_creation_unresolved,
    remember_canvas_project_id,
    repo_root,
    scaffold_project_artifact,
    search_project,
    slugify,
    utc_now,
)
from .subtitles import (
    DEFAULT_MAX_CHARS_PER_LINE,
    DEFAULT_MAX_LINES,
    DEFAULT_SUBTITLE_STYLE,
    build_voice_queue_from_srt,
    inspect_srt,
    srt_to_tts_text,
    subtitle_force_style,
    write_clean_srt,
    write_srt_segments,
)


PAID_CREATE_COMMANDS = {
    "video",
    "image",
    "transition",
    "voice",
    "music",
    "extend",
    "modify",
    "upscale",
    "reference",
    "motion-control",
    "template",
}
HELP_FLAGS = {"-h", "--help"}
CANVAS_PROJECT_WEB_BASE_URL = "https://app.pixverse.ai/canvas/project"
CANVAS_BROWSER_HANDOFF_SCHEMA_VERSION = "pixverse.canvas_browser_handoff.v1"
WEB_BROWSER_HANDOFF_SCHEMA_VERSION = "pixverse.web_browser_handoff.v1"
WEB_OPEN_SYSTEM_FLAG = "--open-system"
PIXVERSE_WEB_APP_BASE_URLS = {
    "production": "https://app.pixverse.ai",
    "preview": "https://preview-app.pixverseai.com",
    "test": "https://test-app.pixverseai.com",
}
PIXVERSE_ENV_ALIASES = {
    "prod": "production",
    "production": "production",
    "staging": "preview",
    "preview": "preview",
    "dev": "test",
    "testing": "test",
    "test": "test",
}
CANVAS_SYNC_GUARD_SCHEMA_VERSION = "pixverse.canvas_sync_guard.v1"
CANVAS_PAID_RUN_SCHEMA_VERSION = "pixverse.canvas_paid_run.v1"
CANVAS_PAID_PREFLIGHT_SCHEMA_VERSION = "pixverse.canvas_paid_preflight.v1"
CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION = "pixverse.canvas_paid_confirmation_plan.v1"
CANVAS_PREPARE_SCHEMA_VERSION = "pixverse.canvas_prepare.v1"
CANVAS_PAID_RECONCILE_DEFAULT_DEADLINE_SECONDS = 0.0
CANVAS_PAID_FOLLOW_DEFAULT_DEADLINE_SECONDS = 30 * 60
CANVAS_PAID_FOLLOW_DEFAULT_POLL_INTERVAL_SECONDS = 30.0
CANVAS_LOCALIZATION_MAX_ATTEMPTS = 3
CANVAS_PAID_RECONCILE_MAX_DEADLINE_SECONDS = 24 * 60 * 60
CANVAS_PAID_RECONCILE_MAX_POLL_INTERVAL_SECONDS = 5 * 60
CANVAS_READ_TIMEOUT_SECONDS = 30.0
CANVAS_MUTATION_TIMEOUT_SECONDS = 5 * 60.0
CANVAS_MIN_RECONCILE_READ_TIMEOUT_SECONDS = 0.1
CANVAS_NON_ATOMIC_OPT_IN_FLAG = "--allow-non-atomic-canvas-mutation"
CANVAS_PAID_CONFIRMATION_FLAG = "--confirmed"
CANVAS_PAID_PREFERENCE_FLAG = "--run-if-allowed"
BASIC_FALLBACK_FLAG = "--accept-basic-fallback"
CANVAS_PAID_CONFIRMATION_PLAN_FLAG = "--confirmation-plan-id"
CANVAS_VIDEO_GEN_TYPE_ALIASES = {
    "reference": "reference_to_video",
}
CANVAS_VIDEO_GEN_TYPES = {"text_to_video", "image_to_video", "reference_to_video"}
CANVAS_VIDEO_REFERENCE_GEN_TYPES = {"reference_to_video"}
CANVAS_IMAGE_GEN_TYPES = {"text_to_image", "image_to_image"}
CANVAS_AUDIO_GEN_TYPES = {"text_to_music", "text_to_speech"}
CANVAS_PROJECT_SCOPED_COMMANDS = (
    ("canvas", "arrange"),
    ("canvas", "graph", "get"),
    ("canvas", "graph", "status"),
    ("canvas", "graph", "invalid-nodes"),
    ("canvas", "graph", "reconcile"),
    ("canvas", "node", "get"),
    ("canvas", "node", "versions"),
    ("canvas", "node", "version"),
    ("canvas", "node", "rerun"),
    ("canvas", "node", "extract-audio"),
    ("canvas", "patch", "dry-run"),
    ("canvas", "patch", "apply"),
    ("canvas", "dispatch"),
)


def _add_combined_run_timing_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=15.0,
        help="Polling cadence used when --run-if-allowed starts this queue.",
    )
    parser.add_argument(
        "--status-interval",
        type=float,
        default=30.0,
        help="Studio-heartbeat cadence used when --run-if-allowed starts this queue.",
    )
    parser.add_argument(
        "--deadline-seconds",
        type=float,
        default=25 * 60,
        help="Whole-queue wall-clock budget used when --run-if-allowed starts this queue.",
    )


def main(argv: list[str] | None = None) -> int:
    raw_argv = list(argv if argv is not None else sys.argv[1:])
    if raw_argv and raw_argv[0] == "pixverse":
        return _pixverse_passthrough(raw_argv[1:])
    if raw_argv[:2] == ["queue", "write"]:
        return _queue_write_from_argv(raw_argv[2:])
    if raw_argv[:2] == ["queue", "append"]:
        return _queue_append_from_argv(raw_argv[2:])

    parser = argparse.ArgumentParser(prog="pvx", description="PixVerse Agent Plugin local agent helper.")
    parser.add_argument("--version", action="version", version=f"pixverse-agent-plugin {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("doctor", help="Check PixVerse CLI, auth, ffmpeg, node, and skills, then write local setup state.")
    setup = sub.add_parser("setup", help="Read or refresh PixVerse Agent Plugin first-run setup state.")
    setup_sub = setup.add_subparsers(dest="setup_command", required=True)
    setup_sub.add_parser("status", help="Read cached setup readiness without running live checks.")
    setup_sub.add_parser("refresh", help="Run doctor checks and refresh cached setup readiness.")
    pixverse = sub.add_parser("pixverse", help="Run PixVerse CLI through PixVerse Agent Plugin's realpath-safe wrapper.")
    pixverse.add_argument("pixverse_args", nargs=argparse.REMAINDER)

    canvas = sub.add_parser("canvas", help="Canvas project and Codex browser handoff helpers.")
    canvas_sub = canvas.add_subparsers(dest="canvas_command", required=True)
    canvas_handoff = canvas_sub.add_parser(
        "handoff",
        help="Return the current Canvas project URL and Codex in-app browser handoff contract.",
    )
    canvas_handoff.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the closest local project binding.",
    )
    canvas_handoff.add_argument(
        "--open-system",
        action="store_true",
        help="Open the system browser explicitly for non-Codex hosts.",
    )
    canvas_prepare = canvas_sub.add_parser(
        "prepare",
        help=(
            "Return the Canvas browser handoff, selected capability contracts, and an accepted graph "
            "checkpoint in one host call."
        ),
    )
    canvas_prepare.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the closest local project binding.",
    )
    canvas_prepare.add_argument(
        "--node-type",
        action="append",
        required=True,
        help="Target Canvas node type whose capabilities contract is needed; repeat as required.",
    )
    canvas_prepare.add_argument(
        "--refresh-capabilities",
        action="store_true",
        help="Request a live capabilities refresh instead of the CLI's normal cached path.",
    )
    canvas_prepare.add_argument("--format", choices=["json", "markdown"], default="json")
    canvas_prepare.add_argument(
        "--include-layout",
        action="store_true",
        help="Include viewport, node position, and node size changes in the checkpoint diff.",
    )
    canvas_prepare.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Explicitly replace an unreadable or incompatible local Canvas checkpoint.",
    )
    canvas_sync = canvas_sub.add_parser(
        "sync",
        help="Read the current Canvas graph, report semantic changes, and accept a new local checkpoint.",
    )
    canvas_sync.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the closest local project binding.",
    )
    canvas_sync.add_argument("--format", choices=["json", "markdown"], default="json")
    canvas_sync.add_argument(
        "--include-layout",
        action="store_true",
        help="Include viewport, node position, and node size changes in the checkpoint diff.",
    )
    canvas_sync.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Explicitly replace an unreadable or incompatible local Canvas checkpoint.",
    )
    canvas_paid = canvas_sub.add_parser(
        "paid",
        help="Preflight, inspect, and reconcile durable Canvas paid-generation runs.",
    )
    canvas_paid_sub = canvas_paid.add_subparsers(dest="canvas_paid_command", required=True)
    canvas_paid_preflight = canvas_paid_sub.add_parser(
        "preflight",
        help="Read Canvas and billing state and create a one-time paid confirmation plan without generation.",
        description=(
            "Read-only remote preflight. Returns the effective require/skip policy and a bound command: "
            "--confirmed after explicit approval, or --run-if-allowed under the default or selected automatic policy. "
            "Both require the returned --confirmation-plan-id; this command never starts generation."
        ),
    )
    canvas_paid_preflight.add_argument(
        "--operation",
        choices=["dispatch", "graph-reconcile", "node-rerun"],
        required=True,
        help="Paid Canvas operation to prepare; this command never executes it.",
    )
    canvas_paid_preflight.add_argument(
        "--node-ids",
        default="",
        help="Comma-separated target node IDs for dispatch or graph-reconcile.",
    )
    canvas_paid_preflight.add_argument(
        "--node-id",
        default="",
        help="Single target node ID for node-rerun.",
    )
    canvas_paid_preflight.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the selected local project binding.",
    )
    canvas_paid_preflight.add_argument(
        "--project",
        default="",
        help="Local project slug used to resolve its Canvas binding and confirmation-plan file.",
    )
    canvas_paid_preflight.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    canvas_paid_preflight.add_argument("--format", choices=["json", "markdown"], default="json")
    canvas_paid_reconcile = canvas_paid_sub.add_parser(
        "reconcile",
        help="Refresh a Canvas paid run once by default, or poll it with an explicit deadline.",
    )
    canvas_paid_reconcile.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the closest local project binding.",
    )
    canvas_paid_reconcile.add_argument(
        "--project",
        default="",
        help="Local project slug used to resolve its Canvas binding and audit files.",
    )
    canvas_paid_reconcile.add_argument("--run-id", default="", help="Reconcile a specific paid run id.")
    canvas_paid_reconcile.add_argument("--poll-interval", type=float, default=5.0)
    canvas_paid_reconcile.add_argument(
        "--deadline-seconds",
        type=float,
        default=CANVAS_PAID_RECONCILE_DEFAULT_DEADLINE_SECONDS,
        help=(
            "Total polling deadline. Defaults to 0 for one non-blocking refresh; pass an explicit "
            "positive value such as 300 only for retry or generation-attribution recovery."
        ),
    )
    canvas_paid_reconcile.add_argument("--format", choices=["json", "markdown"], default="json")
    canvas_paid_follow = canvas_paid_sub.add_parser(
        "follow",
        help="Boundedly follow Canvas generation and cloud outputs; download and credits are opt-in.",
    )
    canvas_paid_follow.add_argument(
        "--project-id",
        default="",
        help="Explicit Canvas project id; defaults to the selected local project binding.",
    )
    canvas_paid_follow.add_argument(
        "--project",
        default="",
        help="Local project slug used for the binding and lightweight run records.",
    )
    canvas_paid_follow.add_argument("--run-id", default="", help="Follow a specific paid run id.")
    canvas_paid_follow.add_argument(
        "--poll-interval",
        type=float,
        default=CANVAS_PAID_FOLLOW_DEFAULT_POLL_INTERVAL_SECONDS,
        help="Maximum polling interval; early polls adapt below this value.",
    )
    canvas_paid_follow.add_argument(
        "--deadline-seconds",
        type=float,
        default=CANVAS_PAID_FOLLOW_DEFAULT_DEADLINE_SECONDS,
        help="Finite wall-clock deadline for generation following (default: 1800 seconds).",
    )
    canvas_paid_follow.add_argument("--format", choices=["json", "markdown"], default="json")
    for paid_reader in (canvas_paid_follow, canvas_paid_reconcile):
        paid_reader.add_argument("--download", action="store_true", help="Explicitly download successful run outputs; does not run QA or query credits.")
        paid_reader.add_argument("--download-node-ids", default="", help="Limit requested downloads to these comma-separated run node IDs; requires --download.")
        paid_reader.add_argument("--credits", action="store_true", help="Explicitly request a post-generation balance delta; does not download media.")

    bootstrap = sub.add_parser("bootstrap", help="Install or verify local dependencies.")
    bootstrap.add_argument("--yes", action="store_true", help="Run safe package-manager install commands when possible.")

    project = sub.add_parser("project", help="Project notebook helpers.")
    project_sub = project.add_subparsers(dest="project_command", required=True)
    project_list = project_sub.add_parser("list", help="List local PixVerse project workspaces.")
    project_list.add_argument("--limit", type=int, default=50)
    project_portfolio_parser = project_sub.add_parser(
        "portfolio",
        help="Show compact stages and recommended next moves across recent projects.",
    )
    project_portfolio_parser.add_argument("--limit", type=int, default=20)
    project_portfolio_parser.add_argument("--format", choices=["json", "markdown"], default="json")
    project_portfolio_parser.add_argument("--surface", choices=["local", "canvas"], default="local")
    project_resume = project_sub.add_parser(
        "resume",
        help="Resolve and summarize the most likely project to continue in one call.",
    )
    project_resume.add_argument("selector", nargs="?", default="", help="Optional slug or title fragment.")
    project_resume.add_argument("--limit", type=int, default=20)
    project_resume.add_argument("--format", choices=["json", "markdown"], default="json")
    project_resume.add_argument("--surface", choices=["local", "canvas"], default="local", help="Explicit current workflow; a historical binding never changes the local default.")
    project_init = project_sub.add_parser("init", help="Create a local project workspace.")
    project_init.add_argument("slug")
    project_init.add_argument("--title", default="")
    project_summary = project_sub.add_parser("summary", help="Print project memory summary.")
    project_summary.add_argument("slug")
    project_search = project_sub.add_parser(
        "search",
        help="Search project memory, queue specs, prompts, subtitles, QA notes, and manifests.",
    )
    project_search.add_argument("slug")
    project_search.add_argument("query")
    project_search.add_argument("--limit", type=int, default=20)
    project_ledger = project_sub.add_parser("ledger", help="Print recent generated asset ledgers from project manifests.")
    project_ledger.add_argument("slug")
    project_ledger.add_argument("--limit", type=int, default=20)
    project_ledger.add_argument("--format", choices=["json", "markdown"], default="json")
    project_handoff_parser = project_sub.add_parser(
        "handoff",
        help="List every editable record, memory file, audit artifact, and media path for a project stage.",
    )
    project_handoff_parser.add_argument("slug")
    project_handoff_parser.add_argument("--stage", default="current")
    project_handoff_parser.add_argument("--surface", choices=["local", "canvas"], default="local")
    project_handoff_parser.add_argument("--delivery-mode", choices=["cloud", "local"], default="cloud", help="Canvas delivery intent; local completion requires --deliverable-path.")
    project_handoff_parser.add_argument("--deliverable-path", action="append", default=[], help="Explicitly requested local Canvas deliverable; repeat for multiple files.")
    project_handoff_parser.add_argument(
        "--stage-position",
        default="",
        help="Structured Canvas stage position such as 2/5.",
    )
    project_handoff_parser.add_argument(
        "--final-deliverable-status",
        choices=["incomplete", "complete"],
        default="",
    )
    project_handoff_parser.add_argument(
        "--remaining-stage",
        action="append",
        default=[],
        help="Remaining Canvas production stage; repeat in delivery order.",
    )
    project_handoff_parser.add_argument(
        "--next-paid-task-count",
        type=int,
        default=None,
        help="Number of generation tasks in the next paid Canvas batch.",
    )
    project_handoff_parser.add_argument(
        "--next-paid-task",
        default="",
        help="Short description of the next paid Canvas batch.",
    )
    project_handoff_parser.add_argument(
        "--approval-gate",
        choices=["required", "not_required", "complete"],
        default="",
    )
    project_handoff_parser.add_argument("--format", choices=["json", "markdown"], default="markdown")
    project_prompt = project_sub.add_parser("prompt", help="Write and record a reusable prompt file.")
    project_prompt.add_argument("slug")
    project_prompt.add_argument("name")
    project_prompt.add_argument("--kind", default="prompt", help="Prompt role such as image, video, audio, voice, or music.")
    prompt_source = project_prompt.add_mutually_exclusive_group()
    prompt_source.add_argument("--text", default="")
    prompt_source.add_argument("--input", default="", help="Read prompt text from an existing local file.")
    prompt_source.add_argument("--stdin", action="store_true", help="Read prompt text from stdin.")
    project_prompt.add_argument("--force", action="store_true", help="Overwrite an existing prompt file.")
    project_scaffold = project_sub.add_parser("scaffold", help="Create a lightweight development artifact template.")
    project_scaffold.add_argument("slug")
    project_scaffold.add_argument("artifact", choices=sorted(PROJECT_ARTIFACT_TEMPLATES))
    project_scaffold.add_argument("--force", action="store_true", help="Overwrite an existing artifact template.")
    memory_add = project_sub.add_parser("remember", help="Append a project notebook entry.")
    memory_add.add_argument("slug")
    memory_add.add_argument("text")
    memory_add.add_argument("--kind", default="decision")
    memory_add.add_argument("--source", default="agent")
    pref_add = project_sub.add_parser("prefer", help="Append a durable local preference.")
    pref_add.add_argument("slug")
    pref_add.add_argument("text")
    pref_add.add_argument("--category", default="working-style")
    pref_add.add_argument("--polarity", default="like")

    skills = sub.add_parser("skills", help="List or validate agent skills.")
    skills_sub = skills.add_subparsers(dest="skills_command", required=True)
    skills_list = skills_sub.add_parser("list", help="List local skills.")
    skills_list.add_argument("--compact", action="store_true", help="Print a human-readable one-line list.")
    skills_list.add_argument("--all", action="store_true", help="Include internal expert playbooks.")
    skills_sub.add_parser("validate", help="Validate local skill frontmatter.")

    route = sub.add_parser("route", help="Recommend a PixVerse control layer and advanced model chain.")
    route_sub = route.add_subparsers(dest="route_command", required=True)
    route_recommend = route_sub.add_parser("recommend", help="Return a deterministic route recommendation.")
    route_recommend.add_argument("--kind", choices=["image", "video"], required=True)
    route_recommend.add_argument("--intent", choices=["draft", "final"], default="final")
    route_recommend.add_argument(
        "--mode",
        choices=["auto", "video", "board-to-video", "reference", "transition", "extend", "modify", "motion-control"],
        default="auto",
    )
    route_recommend.add_argument(
        "--references",
        type=int,
        default=0,
        help="Reference count; for transition mode this is the keyframe-image count.",
    )
    route_recommend.add_argument(
        "--image-family",
        choices=["auto", *IMAGE_FAMILIES],
        default="auto",
        help="Still family used for an explicit image or board-to-video route.",
    )
    route_recommend.add_argument("--aspect-ratio", default="16:9")
    route_recommend.add_argument("--duration", type=float, default=8)
    route_recommend.add_argument("--quality", default="")
    route_recommend.add_argument(
        "--membership-tier",
        choices=["auto", "basic", "premium"],
        default="auto",
        help="Account entitlement route. Auto reads PixVerse account info; unverified accounts cannot spend; Free/Basic requires an upgrade/fallback choice.",
    )
    route_recommend.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    route_recommend.add_argument("--format", choices=["json", "markdown"], default="json")
    route_queue = route_sub.add_parser(
        "queue",
        help="Compose a recommended one- or two-step queue, optionally preflight and run it in the same call.",
    )
    route_queue.add_argument("output")
    route_queue.add_argument("--project", default="", help="Project slug stored in the queue spec.")
    route_queue.add_argument("--kind", choices=["image", "video"], required=True)
    route_queue.add_argument("--intent", choices=["draft", "final"], default="final")
    route_queue.add_argument(
        "--mode",
        choices=["auto", "video", "board-to-video", "reference", "transition"],
        default="auto",
    )
    route_queue.add_argument(
        "--reference",
        action="append",
        default=[],
        help="Reference path/URL; repeat for multiple references or transition keyframes.",
    )
    route_queue.add_argument(
        "--image-family",
        choices=["auto", *IMAGE_FAMILIES],
        default="auto",
    )
    route_queue.add_argument("--aspect-ratio", default="16:9")
    route_queue.add_argument("--duration", type=float, default=8)
    route_queue.add_argument("--quality", default="")
    route_queue.add_argument(
        "--membership-tier",
        choices=["auto", "basic", "premium"],
        default="auto",
        help="Account entitlement route. Auto reads PixVerse account info before composing the queue.",
    )
    route_queue.add_argument("--prompt", required=True, help="Final image/video prompt text or prompt-file path.")
    route_queue.add_argument(
        "--board-prompt",
        default="",
        help="Control-plate prompt text/file; used only with the explicit --mode board-to-video route.",
    )
    route_audio = route_queue.add_mutually_exclusive_group()
    route_audio.add_argument("--audio", action="store_true")
    route_audio.add_argument("--no-audio", action="store_true")
    route_queue.add_argument("--force", action="store_true")
    route_queue.add_argument("--preflight", action="store_true")
    route_queue.add_argument("--run-if-allowed", action="store_true")
    route_queue.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    route_queue.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(route_queue)

    story = sub.add_parser("story", help="Compose and finish controlled multi-shot story videos.")
    story_sub = story.add_subparsers(dest="story_command", required=True)
    story_queue = story_sub.add_parser(
        "queue",
        help="Build a board-plus-multi-shot Seedance Standard queue, optionally preflight and run it.",
    )
    story_queue.add_argument("output")
    story_queue.add_argument("--project", default="", help="Project slug stored in the queue spec.")
    story_queue.add_argument(
        "--shot",
        action="append",
        required=True,
        help="Ordered shot prompt text or prompt-file path; repeat at least twice.",
    )
    story_queue.add_argument(
        "--duration",
        action="append",
        type=float,
        default=[],
        help="Per-shot seconds; pass once for all shots or once per shot. Defaults to splitting --target-duration evenly.",
    )
    story_queue.add_argument("--target-duration", type=float, default=30.0)
    story_queue.add_argument(
        "--board-prompt",
        default="",
        help="Single-frame identity/world-lock prompt text/file. Avoid contact sheets or panel grids because this image feeds every video shot directly.",
    )
    story_queue.add_argument(
        "--music-prompt",
        default="",
        help="Optional instrumental score prompt text/file; adds one independent music task to the same queue.",
    )
    story_queue.add_argument(
        "--music-model",
        default="music-2.6",
        help="Music model used with --music-prompt (default: music-2.6).",
    )
    story_queue.add_argument("--reference", action="append", default=[])
    story_queue.add_argument(
        "--shot-reference",
        action="append",
        default=[],
        help="Shot-specific storyboard/control image; omit or pass exactly once per --shot.",
    )
    story_queue.add_argument(
        "--image-family",
        choices=list(IMAGE_FAMILIES),
        default="gpt-image",
    )
    story_queue.add_argument("--aspect-ratio", default="16:9")
    story_queue.add_argument("--quality", default="")
    story_queue.add_argument(
        "--membership-tier",
        choices=["auto", "basic", "premium"],
        default="auto",
        help="Account entitlement route. Free/Basic stops for an explicit upgrade or fallback choice.",
    )
    story_audio = story_queue.add_mutually_exclusive_group()
    story_audio.add_argument("--audio", action="store_true")
    story_audio.add_argument("--no-audio", action="store_true")
    story_queue.add_argument("--force", action="store_true")
    story_queue.add_argument("--preflight", action="store_true")
    story_queue.add_argument("--run-if-allowed", action="store_true")
    story_queue.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    story_queue.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(story_queue)
    story_assemble = story_sub.add_parser(
        "assemble",
        help="Resolve/download ordered story shots, stitch them locally, and run technical QA in one call.",
    )
    story_assemble.add_argument("project", help="Project slug.")
    story_assemble.add_argument("--output", default="", help="Final path; defaults to deliverables/story-final.mp4.")
    story_assemble.add_argument("--clip", action="append", default=[], help="Ordered local clip path; repeatable.")
    story_assemble.add_argument(
        "--asset-id",
        action="append",
        default=[],
        help="Ordered queue asset id such as shot-01; missing local clips are downloaded by task id.",
    )
    story_assemble.add_argument("--expect-duration", type=float, default=None)
    story_assemble.add_argument("--duration-tolerance", type=float, default=0.75)
    story_assemble.add_argument("--sample-frames", action="store_true")
    story_assemble.add_argument("--force", action="store_true")

    queue = sub.add_parser("queue", help="Run a PixVerse task queue spec.")
    queue_sub = queue.add_subparsers(dest="queue_command", required=True)
    queue_plan = queue_sub.add_parser("plan", help="Validate and print a queue spec.")
    queue_plan.add_argument("spec")
    queue_graph = queue_sub.add_parser("graph", help="Render a queue dependency graph.")
    queue_graph.add_argument("spec")
    queue_graph.add_argument("--format", choices=["mermaid", "json"], default="mermaid")
    queue_write = queue_sub.add_parser("write", help="Write a one-task PixVerse queue spec from a create command.")
    queue_write.add_argument("output")
    queue_write.add_argument("--project", default="", help="Project slug stored in the queue spec.")
    queue_write.add_argument("--id", default="task", help="Task id for the generated queue item.")
    queue_write.add_argument("--label", default="", help="Human-readable task label.")
    queue_write.add_argument("--force", action="store_true", help="Overwrite an existing queue spec.")
    queue_write.add_argument(
        "--preflight",
        action="store_true",
        help="Write the queue and run the paid-work preflight in the same CLI call.",
    )
    queue_write.add_argument(
        "--run-if-allowed",
        action="store_true",
        help="After preflight, run immediately under the default or selected automatic policy.",
    )
    queue_write.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    queue_write.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(queue_write)
    queue_write.add_argument("pixverse_command", nargs=argparse.REMAINDER)
    queue_append = queue_sub.add_parser("append", help="Append one PixVerse create task to a queue spec.")
    queue_append.add_argument("output")
    queue_append.add_argument("--project", default="", help="Project slug for a new queue spec.")
    queue_append.add_argument("--id", required=True, help="Task id for the appended queue item.")
    queue_append.add_argument("--label", default="", help="Human-readable task label.")
    queue_append.add_argument(
        "--depends-on",
        action="append",
        default=[],
        help="Existing task id dependency; repeatable.",
    )
    queue_append.add_argument(
        "--preflight",
        action="store_true",
        help="Append the task and run the paid-work preflight in the same CLI call.",
    )
    queue_append.add_argument(
        "--run-if-allowed",
        action="store_true",
        help="After preflight, run immediately under the default or selected automatic policy.",
    )
    queue_append.add_argument("--accept-basic-fallback", action="store_true", help="Use only after the user explicitly chooses the lower-quality fallback; never bypasses paid approval.")
    queue_append.add_argument(
        "--reuse",
        default="",
        help="Carry an accepted asset from an earlier run instead of generating: <project-slug>:<task-id> or <manifest.jsonl>:<task-id>. No create command follows.",
    )
    queue_append.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(queue_append)
    queue_append.add_argument("pixverse_command", nargs=argparse.REMAINDER)
    queue_run = queue_sub.add_parser("run", help="Submit and poll a queue spec.")
    queue_run.add_argument("spec")
    queue_run.add_argument("--project", default="")
    queue_run.add_argument("--dry-run", action="store_true")
    queue_run.add_argument("--confirmed", action="store_true", help="Confirm the user approved the generation confirmation before paid work.")
    queue_run.add_argument("--poll-interval", type=float, default=15.0)
    queue_run.add_argument("--status-interval", type=float, default=30.0, help="Print a useful in-progress heartbeat at least this often while tasks keep running.")
    queue_run.add_argument(
        "--deadline-seconds",
        type=float,
        default=25 * 60,
        help=(
            "One wall-clock budget for the WHOLE queue, not a per-task timeout. Large batches must "
            "set this explicitly: a 44-task batch has been measured at 5047s, 3.4x this default."
        ),
    )
    queue_reconcile = queue_sub.add_parser(
        "reconcile",
        help=(
            "Re-check submitted tasks that never reached a terminal state and append any recovered "
            "results to the manifest. Free and read-only; spends no credits."
        ),
    )
    queue_reconcile.add_argument("project", help="Project slug (a slug, not a path).")
    queue_reconcile.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be re-checked without calling PixVerse or touching the manifest.",
    )

    quote = sub.add_parser("quote", help="Show planned paid PixVerse task counts before generation.")
    quote_sub = quote.add_subparsers(dest="quote_command", required=True)
    quote_queue_parser = quote_sub.add_parser("queue", help="Count planned paid tasks and check balance for a PixVerse queue spec.")
    quote_queue_parser.add_argument("spec")
    quote_queue_parser.add_argument("--usage-limit", type=int, default=0)
    quote_queue_parser.add_argument("--format", choices=["json", "markdown"], default="json")

    billing = sub.add_parser("billing", help="Inspect PixVerse billing/account context.")
    billing_sub = billing.add_subparsers(dest="billing_command", required=True)
    billing_snapshot_parser = billing_sub.add_parser("snapshot", help="Fetch account, usage, slots, voice, and music billing context.")
    billing_snapshot_parser.add_argument("--usage-limit", type=int, default=100)

    preferences = sub.add_parser("preferences", help="Manage durable PixVerse Agent Plugin preferences.")
    preferences_sub = preferences.add_subparsers(dest="preferences_command", required=True)
    preferences_show = preferences_sub.add_parser("show", help="Show preference state.")
    preferences_show.add_argument("--project", default="", help="Show project-scoped quote-confirmation state.")
    quote_confirmation = preferences_sub.add_parser(
        "quote-confirmation",
        help="Set quote confirmation behavior. Prefer --project for ordinary work.",
    )
    quote_confirmation.add_argument("mode", choices=["require", "skip"])
    quote_confirmation.add_argument(
        "--project",
        default="",
        help="Project slug. Omit only when the user requests a global confirmation preference.",
    )
    membership_routing = preferences_sub.add_parser(
        "membership-routing",
        help="Set a local account capability override; unrestricted-test is only for explicitly confirmed test accounts.",
    )
    membership_routing.add_argument("mode", choices=["auto", "unrestricted-test"])
    preferences_reset = preferences_sub.add_parser(
        "reset",
        help="Clear learned creative memory while preserving login, manifests, media, and deliverables.",
    )
    preferences_reset.add_argument(
        "--all-project-memory",
        action="store_true",
        help="Clear notebook, decision, and preference records from every local project.",
    )
    preferences_reset.add_argument("--yes", action="store_true", help="Confirm the memory reset.")

    subtitles = sub.add_parser("subtitles", help="Helpers for keeping subtitles and TTS text in sync.")
    subtitles_sub = subtitles.add_subparsers(dest="subtitles_command", required=True)
    subtitles_text = subtitles_sub.add_parser("text", help="Print TTS text derived from a canonical SRT file.")
    subtitles_text.add_argument("srt")
    subtitles_text.add_argument("--separator", default="\n")
    subtitles_text.add_argument("--output", default="", help="Write derived TTS text to a file instead of stdout text.")
    subtitles_inspect = subtitles_sub.add_parser("inspect", help="Inspect parsed SRT entries and caption/TTS contract risks as JSON.")
    subtitles_inspect.add_argument("srt")
    subtitles_inspect.add_argument("--max-lines", type=int, default=DEFAULT_MAX_LINES)
    subtitles_inspect.add_argument("--max-chars-per-line", type=int, default=DEFAULT_MAX_CHARS_PER_LINE)
    subtitles_inspect.add_argument("--allow-terminal-punctuation", action="store_true", help="Permit display subtitle lines ending in punctuation.")
    subtitles_clean = subtitles_sub.add_parser("clean", help="Write an SRT with display-line terminal punctuation stripped.")
    subtitles_clean.add_argument("srt")
    subtitles_clean.add_argument("output")
    subtitles_clean.add_argument("--force", action="store_true", help="Overwrite an existing output SRT.")
    subtitles_split = subtitles_sub.add_parser("split", help="Write one TTS text file per SRT caption.")
    subtitles_split.add_argument("srt")
    subtitles_split.add_argument("--output-dir", required=True)
    subtitles_split.add_argument("--prefix", default="line")
    subtitles_style = subtitles_sub.add_parser("style", help="Print the default burn-in subtitle style.")
    subtitles_style.add_argument("--format", choices=["json", "force-style"], default="json")
    subtitles_style.add_argument("--font-size", default="", help="Override ASS Fontsize for this printout.")
    subtitles_style.add_argument("--margin-v", default="", help="Override ASS MarginV for this printout.")
    subtitles_voice_queue = subtitles_sub.add_parser(
        "voice-queue",
        help="Create one PixVerse voice queue task per SRT caption for subtitle-locked narration.",
    )
    subtitles_voice_queue.add_argument("srt")
    subtitles_voice_queue.add_argument("output")
    subtitles_voice_queue.add_argument("--project", default="", help="Project slug stored in the queue spec.")
    subtitles_voice_queue.add_argument("--segments-dir", default="", help="Directory for one-caption TTS text files.")
    subtitles_voice_queue.add_argument("--text-prefix", default="voice")
    subtitles_voice_queue.add_argument("--task-prefix", default="voice")
    subtitles_voice_queue.add_argument("--label-prefix", default="Voice segment")
    subtitles_voice_queue.add_argument("--model", default="speech-2.8-hd")
    subtitles_voice_queue.add_argument("--voice-id", default="")
    subtitles_voice_queue.add_argument("--language", default="")
    subtitles_voice_queue.add_argument("--speed", default="")
    subtitles_voice_queue.add_argument("--max-lines", type=int, default=DEFAULT_MAX_LINES)
    subtitles_voice_queue.add_argument("--max-chars-per-line", type=int, default=DEFAULT_MAX_CHARS_PER_LINE)
    subtitles_voice_queue.add_argument("--allow-terminal-punctuation", action="store_true", help="Permit display subtitle lines ending in punctuation.")
    subtitles_voice_queue.add_argument("--allow-issues", action="store_true", help="Write the queue even if caption contract issues are detected.")
    subtitles_voice_queue.add_argument("--force", action="store_true", help="Overwrite an existing queue spec.")

    qa = sub.add_parser("qa", help="Inspect generated media.")
    qa_sub = qa.add_subparsers(dest="qa_command", required=True)
    qa_inspect = qa_sub.add_parser("inspect", help="Run a lightweight media QA inspection.")
    qa_inspect.add_argument("target")
    qa_inspect.add_argument("--project", default="")
    qa_inspect.add_argument("--sample-frames", action="store_true")
    qa_inspect.add_argument("--expect-duration", type=float, default=None)
    qa_inspect.add_argument("--duration-tolerance", type=float, default=0.75)
    qa_inspect.add_argument("--expect-aspect-ratio", default="")
    qa_audio = qa_inspect.add_mutually_exclusive_group()
    qa_audio.add_argument("--expect-audio", action="store_true", help="Flag videos/audio files that do not contain an audio stream.")
    qa_audio.add_argument("--expect-no-audio", action="store_true", help="Flag videos/audio files that contain an audio stream.")
    qa_project = qa_sub.add_parser(
        "project",
        help="Inspect every asset from the latest project run and return QA plus the asset/invoice ledger.",
    )
    qa_project.add_argument("project", help="Project slug.")
    qa_project.add_argument("--sample-frames", action="store_true", help="Sample frames for local video paths.")
    qa_project.add_argument("--duration-tolerance", type=float, default=0.75)
    qa_project.add_argument(
        "--all-runs",
        action="store_true",
        help="Inspect every unique generated asset across the full project history instead of only the latest run.",
    )

    build_local_parsers(sub)

    args = parser.parse_args(raw_argv)

    if args.command in {"media", "script", "timeline", "graphics"}:
        return dispatch_local(args)
    if args.command == "doctor":
        return _doctor()
    if args.command == "setup":
        return _setup(args)
    if args.command == "pixverse":
        return _pixverse_passthrough(args.pixverse_args)
    if args.command == "canvas":
        return _canvas(args)
    if args.command == "bootstrap":
        return _bootstrap(args.yes)
    if args.command == "project":
        return _project(args)
    if args.command == "skills":
        return _skills(args)
    if args.command == "route":
        if args.route_command == "queue":
            return _route_queue(args)
        membership_tier = _resolve_membership_tier(args)
        payload = recommend_route(
            kind=args.kind,
            intent=args.intent,
            mode=args.mode,
            references=args.references,
            image_family=args.image_family,
            aspect_ratio=args.aspect_ratio,
            duration=args.duration,
            quality=args.quality,
            membership_tier=membership_tier,
            accept_basic_fallback=args.accept_basic_fallback,
        )
        print(
            render_route_markdown(payload)
            if args.format == "markdown"
            else json.dumps(payload, indent=2, ensure_ascii=False)
        )
        return 0 if payload.get("valid") else 2
    if args.command == "story":
        return _story(args)
    if args.command == "queue":
        return _queue(args)
    if args.command == "quote":
        return _quote(args)
    if args.command == "billing":
        return _billing(args)
    if args.command == "preferences":
        return _preferences(args)
    if args.command == "subtitles":
        return _subtitles(args)
    if args.command == "qa":
        return _qa(args)
    parser.print_help()
    return 2


def _doctor() -> int:
    report = run_setup_doctor()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report.get("ready") else 1


def _setup(args: argparse.Namespace) -> int:
    report = run_setup_doctor() if args.setup_command == "refresh" else setup_status()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report.get("ready") else 1


def _canvas(args: argparse.Namespace) -> int:
    if args.canvas_command == "prepare":
        return _canvas_prepare(args)
    if args.canvas_command == "sync":
        return _canvas_sync(args)
    if args.canvas_command == "paid":
        if args.canvas_paid_command == "preflight":
            return _canvas_paid_preflight(args)
        return _canvas_paid_reconcile(args)
    if args.canvas_command != "handoff":
        return 2
    binding_path = canvas_project_binding_path()
    try:
        project_id = str(args.project_id).strip() or load_canvas_project_id(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_BROWSER_HANDOFF_SCHEMA_VERSION,
                    "error": "canvas_project_binding_invalid",
                    "message": str(exc),
                    "binding_path": str(binding_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if not project_id:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_BROWSER_HANDOFF_SCHEMA_VERSION,
                    "error": "canvas_project_binding_required",
                    "message": (
                        "No Canvas project is bound to this local scope. Run the intended project-scoped "
                        "Canvas command first so the internal wrapper can create or reuse a project, or pass "
                        "--project-id explicitly."
                    ),
                    "binding_path": str(binding_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    region_error, region = _canvas_region_guard(
        binding_path=binding_path,
        project_id=project_id,
        explicit_project_id=bool(str(args.project_id).strip()),
        json_output=True,
    )
    if region_error is not None:
        return region_error

    editor_url = _canvas_project_url(project_id)
    payload = {
        "schema_version": CANVAS_BROWSER_HANDOFF_SCHEMA_VERSION,
        "project_id": project_id,
        "region": region,
        "editor_url": editor_url,
        "binding_path": str(binding_path),
        "browser_handoff": _codex_browser_handoff(
            editor_url,
            refresh_after_mutation=True,
        ),
        "authentication": _web_authentication_handoff(),
        "fallback": _web_direct_link_fallback(editor_url),
    }
    if args.open_system:
        payload["system_browser_opened"] = _open_web_url(editor_url, label="Canvas")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _codex_browser_handoff(
    url: str,
    *,
    refresh_after_mutation: bool = False,
) -> dict[str, Any]:
    payload = {
        "required": True,
        "agent_action_required": True,
        "url": url,
        "preferred_mode": "codex-internal-browser",
        "required_mode": "codex-internal-browser",
        "browser_selector": "iab",
        "selection_policy": "exact",
        "allow_url_autoselect": False,
        "allow_external_browser": False,
        "reuse_existing_tab": True,
        "reuse_existing_binding": True,
        "binding_scope": "codex-task",
        "documentation_policy": "reuse-for-valid-binding; reread-only-when-host-requires-or-binding-invalid",
        "computer_use": {
            "preferred_tool": "mcp__cua_repl.js",
            "reset_tool": "mcp__cua_repl.js_reset",
            "runtime": "cua",
            "browser_id": "iab",
            "availability_check": "direct-invocation",
            "forbid_nested_tool_inventory": True,
            "entry_strategy": "reuse-known-binding-or-create-known-url",
            "reuse_scope": "known-task-local-exact-target-binding",
            "first_call": "cua.createBrowserTab",
            "preopen_inventory": False,
            "create_tab": "cua.createBrowserTab",
            "create_visible": True,
            "postopen_url_verification": "cua.listTabs",
            "startup_retry_count": 1,
            "startup_retry_action": "reset-then-repeat-first-call",
        },
        "refresh_after_mutation": refresh_after_mutation,
        "keep_open": True,
        "presentation": {
            "set_visible": True,
            "reuse_exact_url": True,
            "retention": "markDeliverable-or-markHandoff",
            "remark_each_turn": True,
        },
        "verification": {
            "require_visible": True,
            "require_target_url_match": True,
            "prefer_selected_target": True,
            "screenshot_optional": True,
        },
    }
    if refresh_after_mutation:
        # Declarative Agent policy, not a claim that the host browser API is
        # intercepted. Only Canvas handoffs carry media-inspection constraints.
        payload["preview_policy"] = {
            "automatic_mode": "preserve_current_view",
            "enlargement_requires_explicit_user_request": True,
            "allow_automatic_enlargement": False,
            "allow_automatic_focus_change": False,
            "preserve_user_enlarged_view": True,
            "on_inspection_failure": "stop_and_report_not_checked",
        }
        payload["presentation"]["visibility_scope"] = "initial_handoff_only"
        payload["refresh_policy"] = "only_if_stale_and_non_interrupting"
    return payload


def _web_authentication_handoff() -> dict[str, str]:
    return {
        "browser_profile": "separate",
        "action_if_login_redirected": (
            "Ask the user to sign in inside the Codex in-app browser, then reuse the same tab."
        ),
    }


def _web_direct_link_fallback(url: str) -> dict[str, Any]:
    return {
        "mode": "direct-link",
        "url": url,
        "system_browser_is_opt_in": True,
    }


def _canvas_region_guard(
    *,
    binding_path: Path,
    project_id: str,
    explicit_project_id: bool,
    json_output: bool,
) -> tuple[int | None, str]:
    try:
        current_region = effective_pixverse_region()
        bound_region = load_canvas_project_region(path=binding_path)
    except (CanvasProjectBindingError, PixVerseRegionError) as exc:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_region_invalid",
                    "message": str(exc),
                    "project_id": project_id,
                    "binding_path": str(binding_path),
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            ),
            "",
        )
    if bound_region and bound_region != current_region and not explicit_project_id:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_region_mismatch",
                    "message": (
                        f"This Canvas binding belongs to region {bound_region!r}, but the current "
                        f"PixVerse region is {current_region!r}. Restore PIXVERSE_REGION={bound_region} "
                        "or explicitly select a project in the intended region before continuing."
                    ),
                    "project_id": project_id,
                    "binding_path": str(binding_path),
                    "bound_region": bound_region,
                    "current_region": current_region,
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            ),
            current_region,
        )
    return None, current_region


def _canvas_wrapper_contract_guard(*, schema_version: str, json_output: bool) -> int | None:
    issues = canvas_wrapper_contract_issues()
    if not issues:
        return None
    return _emit_canvas_guard_error(
        {
            "schema_version": schema_version,
            "error": "canvas_wrapper_contract_unsupported",
            "message": (
                "The active PixVerse CLI does not match the reviewed Canvas wrapper contract. "
                "Refresh the managed CLI or update the plugin contract before Canvas automation."
            ),
            "channel": pixverse_cli_channel(),
            "minimum_version": PIXVERSE_CLI_MINIMUM_VERSION,
            "installed_version": pixverse_cli_installed_version(),
            "issues": issues,
            "mutation_executed": False,
            "generation_started": False,
            "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
        },
        json_output=json_output,
    )


def _canvas_paid_preflight(args: argparse.Namespace) -> int:
    """Create a one-time approval plan without executing a paid Canvas mutation."""

    if not which("pixverse"):
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                    "error": "pixverse_cli_required",
                    "message": "The managed PixVerse CLI is not ready.",
                    "generation_started": False,
                    "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return SETUP_GATE_EXIT
    contract_error = _canvas_wrapper_contract_guard(
        schema_version=CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
        json_output=True,
    )
    if contract_error is not None:
        return contract_error

    project_slug = str(args.project or "").strip()
    try:
        local_project_path = project_dir(project_slug) if project_slug else None
    except InvalidProjectSlug as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                    "error": "canvas_local_project_invalid",
                    "message": str(exc),
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    binding_path = (
        local_project_path / CANVAS_PROJECT_BINDING_FILENAME
        if local_project_path is not None
        else canvas_project_binding_path()
    )
    state_path = canvas_sync_state_path(binding_path=binding_path)
    plan_path = canvas_paid_confirmation_plans_path(binding_path=binding_path)
    try:
        project_id = str(args.project_id).strip() or load_canvas_project_id(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                    "error": "canvas_project_binding_invalid",
                    "message": str(exc),
                    "binding_path": str(binding_path),
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if not project_id:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                    "error": "canvas_project_binding_required",
                    "message": "No Canvas project is bound to this local scope.",
                    "binding_path": str(binding_path),
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    region_error, region = _canvas_region_guard(
        binding_path=binding_path,
        project_id=project_id,
        explicit_project_id=bool(str(args.project_id).strip()),
        json_output=args.format == "json",
    )
    if region_error is not None:
        return region_error

    raw_node_ids = sorted(
        {value.strip() for value in str(args.node_ids or "").split(",") if value.strip()}
    )
    raw_node_id = str(args.node_id or "").strip()
    if args.operation == "node-rerun":
        node_ids = [raw_node_id] if raw_node_id else []
        valid_selection = bool(raw_node_id) and not raw_node_ids
    else:
        node_ids = raw_node_ids
        valid_selection = bool(raw_node_ids) and not raw_node_id
    if not valid_selection:
        expected = "--node-id <id>" if args.operation == "node-rerun" else "--node-ids <a,b,c>"
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                    "error": "canvas_paid_preflight_targets_invalid",
                    "message": f"Operation {args.operation!r} requires exactly {expected}.",
                    "operation": args.operation,
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    json_output = args.format == "json"
    try:
        with canvas_sync_lock(state_path):
            snapshot_result, _, pre_snapshot = _canvas_guarded_pre_snapshot(
                project_id=project_id,
                state_path=state_path,
                json_output=json_output,
            )
            if snapshot_result is not None or pre_snapshot is None:
                return snapshot_result if snapshot_result is not None else 2

            mutation_args = _canvas_paid_mutation_args(
                operation=str(args.operation),
                project_id=project_id,
                node_ids=node_ids,
                edit_version=int(pre_snapshot["edit_version"]),
            )
            if args.accept_basic_fallback:
                mutation_args.append(BASIC_FALLBACK_FLAG)
            mutation_args = _normalize_pixverse_global_options(mutation_args)
            preflight_result, preflight = _canvas_paid_preflight_snapshot(
                mutation_args,
                project_id=project_id,
                json_output=json_output,
                pre_snapshot=pre_snapshot,
                binding_path=binding_path,
            )
            if preflight_result is not None or preflight is None:
                return preflight_result if preflight_result is not None else 2
            try:
                # The guarded read matched the accepted checkpoint. Persist its
                # raw content proof too, including when upgrading an older
                # checkpoint that predates content-bound paid approvals.
                write_canvas_sync_state(pre_snapshot, path=state_path)
                confirmation_plan = _create_canvas_paid_confirmation_plan(
                    mutation_args,
                    preflight=preflight,
                    pre_snapshot=pre_snapshot,
                    binding_path=binding_path,
                )
            except (OSError, ValueError) as exc:
                return _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                        "error": "canvas_confirmation_plan_write_failed",
                        "message": (
                            "Paid generation was not started because its immutable confirmation plan "
                            f"could not be saved: {exc}"
                        ),
                        "project_id": project_id,
                        "plan_path": str(plan_path),
                        "mutation_executed": False,
                        "generation_started": False,
                    },
                    json_output=json_output,
                )
    except CanvasSyncLockError as exc:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
                "error": "canvas_sync_lock_timeout",
                "message": str(exc),
                "project_id": project_id,
                "state_path": str(state_path),
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=json_output,
        )

    payload = {
        "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
        "success": True,
        "remote_effect": "read_only",
        "generation_started": False,
        "region": region,
        "confirmation_required": preflight["confirmation_required"],
        "confirmation_policy": preflight["confirmation_policy"],
        "confirmation_plan_id": confirmation_plan["confirmation_plan_id"],
        "approval_digest": confirmation_plan["approval_digest"],
        "plan_path": str(plan_path),
        "created_at": confirmation_plan["created_at"],
        "preflight": preflight,
        "confirmation_command": confirmation_plan["confirmation_command"],
    }
    if args.format == "markdown":
        print(_render_canvas_paid_preflight_markdown(payload))
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _canvas_paid_mutation_args(
    *,
    operation: str,
    project_id: str,
    node_ids: list[str],
    edit_version: int,
) -> list[str]:
    if operation == "node-rerun":
        return [
            "canvas",
            "node",
            "rerun",
            "--project-id",
            project_id,
            "--node-id",
            node_ids[0],
            "--edit-version",
            str(edit_version),
            "--json",
        ]
    command = ["canvas", "dispatch"] if operation == "dispatch" else ["canvas", "graph", "reconcile"]
    return [
        *command,
        "--project-id",
        project_id,
        "--node-ids",
        ",".join(node_ids),
        "--edit-version",
        str(edit_version),
        "--require-dispatch",
        "--json",
    ]


def _canvas_paid_target_parameter_lines(targets: list[Any]) -> list[str]:
    lines = ["", "## Generation parameters for approval", ""]
    rendered_any = False
    for target in targets:
        if not isinstance(target, dict):
            continue
        node_id = str(target.get("node_id") or "unknown")
        contract = (
            target.get("generation_contract")
            if isinstance(target.get("generation_contract"), dict)
            else {}
        )
        if not contract:
            lines.append(
                f"- `{node_id}`: `{target.get('route_display') or target.get('model') or 'unresolved'}`; "
                f"render intent `{target.get('render_intent') or 'unresolved'}`"
            )
            rendered_any = True
            continue
        media_kind = str(contract.get("media_kind") or target.get("kind") or "").lower()
        if media_kind == "image":
            lines.append(
                f"- `{node_id}`: mode `{contract.get('gen_type') or 'unresolved'}`; "
                f"quality `{contract.get('quality', 'default')}`; "
                f"aspect `{contract.get('aspect_ratio', 'default')}`; "
                f"detail `{contract.get('detail_level', 'default')}`; "
                f"outputs `{contract.get('create_count', 1)}`; references "
                f"`image:{contract.get('image_reference_count', 0)}`"
            )
        elif media_kind == "audio":
            lines.append(
                f"- `{node_id}`: mode `{contract.get('gen_type') or 'unresolved'}`; "
                f"route `{contract.get('capability_mode') or 'unresolved'}`; "
                f"model `{contract.get('model') or 'unresolved'}`; "
                f"outputs `{contract.get('create_count', 1)}`"
            )
        elif media_kind == "text":
            lines.append(
                f"- `{node_id}`: Canvas text generation; "
                f"model `{contract.get('model') or 'unresolved'}`; "
                f"outputs `{contract.get('create_count', 1)}`"
            )
        else:
            audio = contract.get("audio", "default")
            audio_display = "on" if audio == 1 else "off" if audio == 0 else "default"
            lines.append(
                f"- `{node_id}`: mode `{contract.get('gen_type') or 'unresolved'}`; "
                f"duration `{contract.get('duration', 'default')}`; quality `{contract.get('quality', 'default')}`; "
                f"aspect `{contract.get('aspect_ratio', 'default')}`; audio `{audio_display}`; "
                f"outputs `{contract.get('create_count', 1)}`; references "
                f"`image:{contract.get('image_reference_count', 0)}, "
                f"video:{contract.get('video_reference_count', 0)}, "
                f"audio:{contract.get('audio_reference_count', 0)}`"
            )
        for media_label, source_key in (
            ("image", "resolved_image_source_node_ids"),
            ("video", "resolved_video_source_node_ids"),
            ("audio", "resolved_audio_source_node_ids"),
        ):
            source_node_ids = [
                str(item)
                for item in contract.get(source_key, [])
                if isinstance(item, (str, int)) and not isinstance(item, bool) and str(item)
            ]
            if source_node_ids:
                lines.append(
                    f"  - Resolved {media_label} source nodes: `"
                    + ", ".join(source_node_ids)
                    + "`"
                )
        for media_label, count_key, digest_key in (
            ("image", "image_reference_count", "image_references_sha256"),
            ("video", "video_reference_count", "video_references_sha256"),
            ("audio", "audio_reference_count", "audio_references_sha256"),
        ):
            digest = str(contract.get(digest_key) or "")
            count = contract.get(count_key, 0)
            if digest and isinstance(count, int) and count > 0:
                lines.append(
                    f"  - {media_label.capitalize()} references ({count}, ordered sha256 `{digest[:12]}`)"
                )
        prompt = " ".join(str(contract.get("prompt") or "").split())
        if prompt:
            preview = prompt if len(prompt) <= 240 else f"{prompt[:237]}..."
            preview = preview.replace("`", "'")
            digest = str(contract.get("prompt_sha256") or "")[:12]
            lines.append(
                f"  - Prompt ({contract.get('prompt_length', len(prompt))} chars, sha256 `{digest}`): `{preview}`"
            )
        else:
            lines.append("  - Prompt: `(empty)`")
        rendered_any = True
    return lines if rendered_any else []


def _render_canvas_paid_preflight_markdown(payload: dict[str, Any]) -> str:
    preflight = payload.get("preflight") if isinstance(payload.get("preflight"), dict) else {}
    targets = preflight.get("targets") if isinstance(preflight.get("targets"), list) else []
    model_routes = ", ".join(
        f"{target.get('node_id')} → {target.get('route_display') or target.get('model') or 'unresolved'}"
        for target in targets
        if isinstance(target, dict)
    ) or "unresolved"
    render_intents = ", ".join(
        f"{target.get('node_id')} → {target.get('render_intent') or 'unresolved'}"
        for target in targets
        if isinstance(target, dict)
    ) or "unresolved"
    account = preflight.get("account") if isinstance(preflight.get("account"), dict) else {}
    credits = account.get("credits_total")
    requires_confirmation = payload.get("confirmation_required", True)
    policy = preflight.get("confirmation_policy", {})
    parameter_lines = _canvas_paid_target_parameter_lines(targets)
    return "\n".join(
        [
            "# Canvas Paid Preflight",
            "",
            f"- Confirmation plan: `{payload.get('confirmation_plan_id')}`",
            f"- Project: `{preflight.get('project_id')}`",
            f"- Region: `{preflight.get('region', 'global')}`",
            f"- Operation: `{preflight.get('operation')}`",
            f"- Canvas edit version: `{preflight.get('edit_version')}`",
            f"- Planned generation tasks: `{preflight.get('planned_generation_tasks')}`",
            f"- Model routes: `{model_routes}`",
            f"- Render intents: `{render_intents}`",
            f"- Membership: `{preflight.get('membership_tier')}`",
            f"- Balance snapshot: `{credits if isinstance(credits, int) else 'unknown'} credits` at `{preflight.get('snapshot_at')}`",
            "- Generation started: `no`",
            f"- Confirmation policy: `{policy.get('effective_mode', 'require')}` ({policy.get('scope', 'default')})",
            ("- Confirmation: `one explicit user approval; plan is one-time and state-bound`"
             if requires_confirmation else
             "- Confirmation: `automatic policy permits execution; plan is one-time and state-bound`"),
            *parameter_lines,
            "",
            "After approval, run exactly:" if requires_confirmation else "No new approval needed; run exactly:",
            "",
            "```bash",
            str(payload.get("confirmation_command") or ""),
            "```",
        ]
    )


def _canvas_paid_reconcile(args: argparse.Namespace) -> int:
    follow_mode = args.canvas_paid_command == "follow"
    download_requested = bool(getattr(args, "download", False))
    credits_requested = bool(getattr(args, "credits", False))
    download_node_ids = {
        value.strip() for value in str(getattr(args, "download_node_ids", "") or "").split(",") if value.strip()
    }
    if download_node_ids and not download_requested:
        print(json.dumps({"error": "canvas_download_not_requested", "message": "--download-node-ids requires --download."}))
        return 2
    if not which("pixverse"):
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "pixverse_cli_required",
                    "message": "The managed PixVerse CLI is not ready.",
                    "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return SETUP_GATE_EXIT
    contract_error = _canvas_wrapper_contract_guard(
        schema_version=CANVAS_PAID_RUN_SCHEMA_VERSION,
        json_output=True,
    )
    if contract_error is not None:
        return contract_error

    project_slug = str(getattr(args, "project", "") or "").strip()
    try:
        local_project_path = project_dir(project_slug) if project_slug else None
    except InvalidProjectSlug as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_local_project_invalid",
                    "message": str(exc),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    binding_path = (
        local_project_path / CANVAS_PROJECT_BINDING_FILENAME
        if local_project_path is not None
        else canvas_project_binding_path()
    )
    if local_project_path is None and (binding_path.parent / "project.md").is_file():
        local_project_path = binding_path.parent
    ledger_path = canvas_paid_ledger_path(binding_path=binding_path)
    try:
        project_id = str(args.project_id).strip() or load_canvas_project_id(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_project_binding_invalid",
                    "message": str(exc),
                    "ledger_path": str(ledger_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if not project_id:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_project_binding_required",
                    "message": "No Canvas project is bound to this local scope.",
                    "ledger_path": str(ledger_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    region_error, region = _canvas_region_guard(
        binding_path=binding_path,
        project_id=project_id,
        explicit_project_id=bool(str(args.project_id).strip()),
        json_output=args.format == "json",
    )
    if region_error is not None:
        return region_error
    if (
        not math.isfinite(args.poll_interval)
        or not math.isfinite(args.deadline_seconds)
        or args.poll_interval <= 0
        or args.poll_interval > CANVAS_PAID_RECONCILE_MAX_POLL_INTERVAL_SECONDS
        or args.deadline_seconds < 0
        or args.deadline_seconds > CANVAS_PAID_RECONCILE_MAX_DEADLINE_SECONDS
        or (follow_mode and args.deadline_seconds <= 0)
    ):
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_paid_reconcile_timing_invalid",
                    "message": (
                        "Timing values must be finite; --poll-interval must be > 0 and <= 300, and "
                        "--deadline-seconds must be >= 0 and <= 86400 (and > 0 for follow)."
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    try:
        rows = [
            row
            for row in read_jsonl(ledger_path)
            if row.get("schema_version") == CANVAS_PAID_RUN_SCHEMA_VERSION
            and str(row.get("project_id") or "") == project_id
        ]
    except OSError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_paid_ledger_unreadable",
                    "message": str(exc),
                    "ledger_path": str(ledger_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    requested_run_id = str(args.run_id).strip()
    starts = [
        row
        for row in rows
        if row.get("event") == "canvas.paid.submission_started"
        and (not requested_run_id or str(row.get("run_id") or "") == requested_run_id)
    ]
    if not starts:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_paid_run_not_found",
                    "message": "No matching durable Canvas paid run was found.",
                    "project_id": project_id,
                    "run_id": requested_run_id,
                    "ledger_path": str(ledger_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1

    started = starts[-1]
    run_id = str(started.get("run_id") or "")
    preflight = started.get("preflight") if isinstance(started.get("preflight"), dict) else {}
    context = {
        **preflight,
        "run_id": run_id,
        "cli_run_id": started.get("cli_run_id") or preflight.get("cli_run_id") or "",
        "project_id": project_id,
        "operation": started.get("operation") or preflight.get("operation") or "",
        "node_ids": list(started.get("node_ids") or preflight.get("node_ids") or []),
        "ledger_path": str(ledger_path),
    }
    if not context["node_ids"]:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
                    "error": "canvas_paid_run_nodes_missing",
                    "message": "The paid run has no target node ids to reconcile safely.",
                    "run_id": run_id,
                    "ledger_path": str(ledger_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    submission_rows = [
        row
        for row in rows
        if str(row.get("run_id") or "") == run_id
        and row.get("event") == "canvas.paid.submission_result"
    ]
    submission = dict(submission_rows[-1]) if submission_rows else {}
    try:
        submission_returncode = int(submission.get("returncode") or 0)
    except (TypeError, ValueError):
        submission_returncode = 0
    generation_state = str(submission.get("generation_state") or "")
    if generation_state == "submission_failed":
        legacy_dispatch_status = str(submission.get("dispatch_status") or "").strip().lower()
        generation_state = (
            "not_started"
            if legacy_dispatch_status
            in {"skipped", "no_ready_nodes", "no_ready", "not_dispatched"}
            else "unknown"
        )
    if not generation_state and submission:
        if submission.get("generation_started") is True:
            generation_state = "started"
        elif submission_returncode != 0:
            generation_state = "unknown"
        elif submission.get("generation_started") is False:
            generation_state = "not_started"
    generation_state = generation_state or "unknown"
    submission["generation_state"] = generation_state
    context["submission"] = submission
    reconcile_node_ids = [
        str(item).strip()
        for item in submission.get("reconcile_node_ids", [])
        if isinstance(item, (str, int)) and not isinstance(item, bool) and str(item).strip()
    ]
    if not reconcile_node_ids and generation_state not in {"not_started", "submission_failed"}:
        reconcile_node_ids = list(context["node_ids"])
    if download_node_ids - set(reconcile_node_ids):
        print(json.dumps({"error": "canvas_download_nodes_invalid", "message": "Download nodes must belong to this run's dispatched nodes."}))
        return 2
    selected_download_nodes = download_node_ids or set(reconcile_node_ids)
    context["credits_requested"] = credits_requested
    context["download_requested"] = download_requested
    started_monotonic = time.monotonic()
    timings: dict[str, Any] = {
        "started_at": utc_now(),
        "status_read_seconds": 0.0,
        "graph_read_seconds": 0.0,
        "localize_seconds": 0.0,
    }
    refresh_once = float(args.deadline_seconds) == 0
    deadline = started_monotonic + float(args.deadline_seconds)
    polls = 0
    status_state = (
        "submission_unresolved"
        if not submission_rows
        else "submission_failed"
        if generation_state == "submission_failed"
        else "not_started"
        if generation_state == "not_started"
        else "unknown"
    )
    statuses: dict[str, str] = {}
    status_details: dict[str, dict[str, Any]] = {}
    attribution: dict[str, Any] = {
        "complete": False,
        "nodes": {},
        "task_ids": [],
        "history_ids": [],
    }
    post_snapshot: dict[str, Any] | None = None
    localized_assets: list[dict[str, Any]] = []
    localization_attempts: dict[str, int] = {}
    localized_node_ids: set[str] = set()
    cloud_ready_node_ids: set[str] = set()
    snapshot_statuses: dict[str, str] = {}
    read_error = ""
    while submission_rows and generation_state not in {"not_started", "submission_failed"}:
        polls += 1
        status_started = time.monotonic()
        status_result = _read_canvas_graph_status(
            project_id,
            reconcile_node_ids,
            timeout=_canvas_reconcile_read_timeout(deadline, refresh_once=refresh_once),
        )
        timings["status_read_seconds"] += time.monotonic() - status_started
        if not status_result.ok:
            read_error = status_result.stderr.strip() or status_result.stdout.strip() or "Canvas status read failed"
            status_state = "read_failed"
            break
        try:
            status_details = _parse_canvas_graph_status_output(status_result.stdout)
        except (json.JSONDecodeError, ValueError) as exc:
            read_error = str(exc)
            status_state = "read_failed"
            break
        statuses = {
            node_id: str(status_details.get(node_id, {}).get("derived_state") or "unknown")
            for node_id in reconcile_node_ids
        }
        attribution = _canvas_paid_status_attribution(context, status_details, reconcile_node_ids)
        status_classes = {_canvas_paid_status_class(value) for value in statuses.values()}
        successful_node_ids = {
            node_id
            for node_id, status in statuses.items()
            if _canvas_paid_status_class(status) == "success"
        }
        newly_ready = sorted(
            node_id
            for node_id in successful_node_ids
            if download_requested and node_id in selected_download_nodes
            and node_id not in localized_node_ids
            and localization_attempts.get(node_id, 0) < CANVAS_LOCALIZATION_MAX_ATTEMPTS
        )
        newly_cloud_ready = sorted(successful_node_ids - cloud_ready_node_ids)
        if newly_cloud_ready or newly_ready:
            if download_requested and newly_ready and local_project_path is None:
                localized_assets.extend(
                    {
                        "node_id": node_id,
                        "task_id": "",
                        "media_type": "",
                        "local_path": "",
                        "local_preview_status": "local_project_unavailable",
                        "local_preview_error": (
                            "Pass --project <slug> or run from a bound local project to localize previews."
                        ),
                    }
                    for node_id in newly_ready
                )
                localization_attempts.update(
                    {node_id: CANVAS_LOCALIZATION_MAX_ATTEMPTS for node_id in newly_ready}
                )
            if newly_cloud_ready or (newly_ready and local_project_path is not None):
                graph_started = time.monotonic()
                ready_graph_result = _read_canvas_graph(
                    project_id,
                    timeout=_canvas_reconcile_read_timeout(deadline, refresh_once=refresh_once),
                )
                timings["graph_read_seconds"] += time.monotonic() - graph_started
                if ready_graph_result.ok:
                    try:
                        ready_graph = parse_canvas_graph_output(ready_graph_result.stdout)
                        post_snapshot = snapshot_canvas_graph(ready_graph, include_layout=False)
                        snapshot_statuses = dict(statuses)
                        localize_started = time.monotonic()
                        ready_assets = _localize_canvas_ready_nodes(
                            post_snapshot,
                            newly_ready,
                            project_path=local_project_path,
                            run_id=run_id,
                            attribution_nodes=(
                                attribution.get("nodes")
                                if isinstance(attribution.get("nodes"), dict)
                                else {}
                            ),
                        ) if newly_ready and local_project_path is not None else []
                        timings["localize_seconds"] += time.monotonic() - localize_started
                        localized_assets.extend(ready_assets)
                        _record_canvas_localization_attempts(
                            ready_assets,
                            attempts=localization_attempts,
                            localized_node_ids=localized_node_ids,
                        )
                    except CanvasGraphError as exc:
                        read_error = f"{read_error}; {exc}".strip("; ")
                else:
                    graph_error = (
                        ready_graph_result.stderr.strip()
                        or ready_graph_result.stdout.strip()
                        or "Canvas graph read failed while collecting cloud outputs"
                    )
                    read_error = f"{read_error}; {graph_error}".strip("; ")
            for node_id in newly_cloud_ready:
                print(
                    f"[pixverse-agent canvas-paid] Canvas node ready: {node_id} — {_canvas_project_url(project_id)}",
                    file=sys.stderr,
                    flush=True,
                )
            cloud_ready_node_ids.update(newly_cloud_ready)
        if status_classes and status_classes <= {"success"}:
            if attribution["complete"]:
                status_state = "success"
            else:
                status_state = "success_unattributed" if follow_mode else "status_unattributed"
            if not download_requested or not _canvas_localization_retry_pending(
                successful_node_ids & selected_download_nodes,
                attempts=localization_attempts,
                localized_node_ids=localized_node_ids,
                local_project_path=local_project_path,
            ):
                break
        elif status_classes == {"success", "failed"}:
            if attribution["complete"]:
                status_state = "partially_succeeded"
            else:
                status_state = (
                    "partially_succeeded_unattributed" if follow_mode else "status_unattributed"
                )
            if not download_requested or not _canvas_localization_retry_pending(
                successful_node_ids & selected_download_nodes,
                attempts=localization_attempts,
                localized_node_ids=localized_node_ids,
                local_project_path=local_project_path,
            ):
                break
        elif status_classes and status_classes <= {"failed"}:
            if attribution["complete"]:
                status_state = "failed"
            else:
                status_state = "failed_unattributed" if follow_mode else "status_unattributed"
            if not download_requested or not _canvas_localization_retry_pending(
                successful_node_ids & selected_download_nodes,
                attempts=localization_attempts,
                localized_node_ids=localized_node_ids,
                local_project_path=local_project_path,
            ):
                break
        if _canvas_blocked_is_terminal(status_classes):
            status_state = "blocked"
            break
        if "unknown" in status_classes:
            status_state = "status_unknown"
            break
        elapsed = time.monotonic() - started_monotonic
        print(
            f"[pixverse-agent canvas-paid] run {run_id}: {statuses}; elapsed {elapsed:.1f}s",
            file=sys.stderr,
            flush=True,
        )
        if time.monotonic() >= deadline:
            if status_state != "status_unattributed":
                status_state = "deadline_unresolved"
            break
        poll_interval = (
            _canvas_follow_poll_interval(
                max_interval=float(args.poll_interval),
                elapsed_seconds=elapsed,
            )
            if follow_mode
            else float(args.poll_interval)
        )
        time.sleep(min(poll_interval, max(0.0, deadline - time.monotonic())))

    if post_snapshot is None or snapshot_statuses != statuses:
        graph_started = time.monotonic()
        graph_result = _read_canvas_graph(
            project_id,
            timeout=_canvas_reconcile_read_timeout(deadline, refresh_once=refresh_once),
        )
        timings["graph_read_seconds"] += time.monotonic() - graph_started
        if graph_result.ok:
            try:
                post_graph = parse_canvas_graph_output(graph_result.stdout)
                post_snapshot = snapshot_canvas_graph(post_graph, include_layout=False)
            except CanvasGraphError as exc:
                read_error = f"{read_error}; {exc}".strip("; ")
        else:
            graph_error = graph_result.stderr.strip() or graph_result.stdout.strip() or "Canvas graph read failed"
            read_error = f"{read_error}; {graph_error}".strip("; ")

    terminal_ready = [
        node_id
        for node_id, status in statuses.items()
        if _canvas_paid_status_class(status) == "success"
        and node_id in selected_download_nodes
        and node_id not in localized_node_ids
        and localization_attempts.get(node_id, 0) < CANVAS_LOCALIZATION_MAX_ATTEMPTS
    ]
    if download_requested and terminal_ready and post_snapshot is not None and local_project_path is not None:
        localize_started = time.monotonic()
        ready_assets = _localize_canvas_ready_nodes(
            post_snapshot,
            terminal_ready,
            project_path=local_project_path,
            run_id=run_id,
            attribution_nodes=(
                attribution.get("nodes") if isinstance(attribution.get("nodes"), dict) else {}
            ),
        )
        timings["localize_seconds"] += time.monotonic() - localize_started
        localized_assets.extend(ready_assets)
        _record_canvas_localization_attempts(
            ready_assets,
            attempts=localization_attempts,
            localized_node_ids=localized_node_ids,
        )

    dummy_result = CommandResult(
        argv=["canvas", "paid", "reconcile"],
        returncode=submission_returncode,
        stdout=json.dumps(
            {
                "task_ids": sorted(
                    {
                        *[str(item) for item in submission.get("new_task_ids", []) if str(item)],
                        *[str(item) for item in attribution.get("task_ids", []) if str(item)],
                    }
                )
            }
        ),
        stderr="",
    )
    finalize_status_details = dict(status_details)
    finalize_status_details["_attribution"] = attribution
    state_path = canvas_sync_state_path(binding_path=binding_path)
    billing_summary: dict[str, Any] = {}
    generation_status = _canvas_paid_generation_status(statuses)
    if generation_state == "not_started":
        generation_status = "not_started"
    outcome_summary = _canvas_paid_node_outcome_summary(statuses)
    status_counts = outcome_summary["status_counts"]
    succeeded_node_ids = outcome_summary["succeeded_node_ids"]
    failed_node_ids = outcome_summary["failed_node_ids"]
    timings["elapsed_before_billing_seconds"] = round(time.monotonic() - started_monotonic, 3)
    canvas_api_seconds = round(
        float(timings.get("status_read_seconds") or 0)
        + float(timings.get("graph_read_seconds") or 0),
        3,
    )
    localize_seconds = round(float(timings.get("localize_seconds") or 0), 3)
    generation_wait_seconds = round(
        max(
            0.0,
            float(timings["elapsed_before_billing_seconds"])
            - canvas_api_seconds
            - localize_seconds,
        ),
        3,
    )
    timings["components"] = {
        "pixverse_api": {
            "status_and_graph_seconds": canvas_api_seconds,
        },
        "local_io": {"localize_seconds": localize_seconds},
        "paid_generation": {"wait_and_poll_idle_seconds": generation_wait_seconds},
        "host_required": ["agent_planning", "iab_handoff"],
    }
    context["timings"] = timings
    context["localized_assets"] = localized_assets
    context["download_status"] = (
        "not_requested" if not download_requested
        else "ready" if selected_download_nodes and selected_download_nodes <= localized_node_ids
        else "incomplete"
    )
    context["generation_status"] = generation_status
    context["status_counts"] = status_counts
    context["succeeded_node_ids"] = succeeded_node_ids
    context["failed_node_ids"] = failed_node_ids
    try:
        with canvas_sync_lock(state_path):
            billing_summary = _finalize_canvas_paid_run(
                context,
                mutation_result=dummy_result,
                post_snapshot=post_snapshot,
                verification_status=(
                    f"{'refresh_once' if refresh_once else 'bounded_reconcile'}_{status_state}"
                ),
                status_details=finalize_status_details,
                observe_credits=credits_requested and _canvas_should_observe_credits(
                    generation_state=generation_state,
                    generation_status=generation_status,
                ),
            )
    except CanvasSyncLockError as exc:
        read_error = str(exc)
        status_state = "lock_timeout"

    timings["finished_at"] = utc_now()
    timings["elapsed_seconds"] = round(time.monotonic() - started_monotonic, 3)
    timings["components"]["cli"] = {"total_seconds": timings["elapsed_seconds"]}
    cloud_outputs = canvas_cloud_nodes(post_snapshot or {}, node_ids=reconcile_node_ids)
    for output in cloud_outputs:
        output["status"] = statuses.get(output["node_id"], output["status"])
    download_status = context["download_status"]
    membership_failed_nodes = [
        node_id for node_id, detail in status_details.items()
        if _canvas_paid_status_class(statuses.get(node_id, "")) in {"failed", "blocked"}
        and (
            detail.get("failure_class") == "membership_required"
            or classify_error(
                CommandResult(argv=[], returncode=1, stdout="", stderr=str(detail.get("error_message") or "")),
                {"code": detail.get("error_code")},
            ) == "membership_required"
        )
    ]
    failure_guidance = _queue_failure_guidance(
        [{"status": "failed", "error_class": "membership_required"}] if membership_failed_nodes else []
    )
    if failure_guidance:
        failure_guidance[0]["node_ids"] = membership_failed_nodes
    payload = {
        "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
        "run_id": run_id,
        "project_id": project_id,
        "region": region,
        "operation": context["operation"],
        "node_ids": reconcile_node_ids,
        "generation_state": generation_state,
        "generation_status": generation_status,
        "status_counts": status_counts,
        "succeeded_node_ids": succeeded_node_ids,
        "failed_node_ids": failed_node_ids,
        "downstream_ready_node_ids": succeeded_node_ids,
        "editor_url": _canvas_project_url(project_id),
        "preview_surface": "canvas",
        "cloud_outputs": cloud_outputs,
        "download_status": download_status,
        "local_qa_status": "not_requested",
        "technical_qa_status": "not_checked",
        "credits_status": billing_summary.get("settlement_state", "not_requested" if not credits_requested else "unavailable"),
        "downstream_ready": bool(succeeded_node_ids),
        "attribution_complete": bool(attribution.get("complete")),
        "credits_consumed": billing_summary.get("credits_consumed"),
        "credits_source": billing_summary.get("credits_source", "unavailable"),
        "pre_credits_total": billing_summary.get("pre_credits_total"),
        "post_credits_total": billing_summary.get("post_credits_total"),
        "reconcile_mode": "follow" if follow_mode else "refresh_once" if refresh_once else "bounded_wait",
        "reconcile_status": status_state,
        "status": status_state,
        "node_statuses": statuses,
        "node_status_details": status_details,
        "attribution": attribution,
        "local_project_path": str(local_project_path.resolve()) if local_project_path is not None else "",
        "local_previews": localized_assets,
        "first_local_preview": next(
            (
                str(item.get("local_path") or "")
                for item in localized_assets
                if item.get("local_preview_status") == "ready" and item.get("local_path")
            ),
            "",
        ),
        "polls": polls,
        "elapsed_seconds": timings["elapsed_seconds"],
        "deadline_seconds": args.deadline_seconds,
        "timings": timings,
        "ledger_path": str(ledger_path),
        "error": read_error,
    }
    if failure_guidance:
        payload["failure_guidance"] = failure_guidance
    if args.format == "markdown":
        print(
            "\n".join(
                [
                    "# Canvas Paid Follow" if follow_mode else "# Canvas Paid Reconcile",
                    "",
                    f"- Run: `{run_id}`",
                    f"- Project: `{project_id}`",
                    f"- Preview: [Canvas]({_canvas_project_url(project_id)})",
                    f"- Reconcile mode: `{'follow' if follow_mode else 'refresh_once' if refresh_once else 'bounded_wait'}`",
                    (
                        f"- Generation: `{generation_status}` "
                        f"({status_counts['succeeded']} succeeded / {status_counts['failed']} failed "
                        f"/ {status_counts['running']} running)"
                    ),
                    f"- Downstream ready nodes: `{','.join(succeeded_node_ids) or 'none'}`",
                    "- Credits consumed: `"
                    f"{billing_summary.get('credits_consumed') if isinstance(billing_summary.get('credits_consumed'), int) else payload['credits_status']}`",
                    f"- Credits source: `{billing_summary.get('credits_source', 'unavailable')}`",
                    "- First local preview: `"
                    f"{payload['first_local_preview'] or download_status}`",
                    "- Technical QA: `not_checked`; local QA: `not_requested`",
                    f"- Ledger: `{ledger_path}`",
                ]
            )
        )
        for guidance in failure_guidance:
            print(f"\n## Account action required\n\n{guidance['message']}\n\n{guidance['subscription_link']}\n\n{guidance['quality_notice']}")
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return (
        0
        if status_state in {"success", "success_unattributed"}
        else 1
        if status_state in {
            "partially_succeeded",
            "partially_succeeded_unattributed",
            "failed",
            "failed_unattributed",
            "submission_failed",
            "not_started",
        }
        else 2
    )


def _canvas_follow_poll_interval(*, max_interval: float, elapsed_seconds: float) -> float:
    """Use a short early cadence without turning Canvas following into an unbounded watcher."""

    if elapsed_seconds < 15:
        return min(max_interval, 2.0)
    if elapsed_seconds < 60:
        return min(max_interval, 5.0)
    if elapsed_seconds < 180:
        return min(max_interval, 10.0)
    if elapsed_seconds < 600:
        return min(max_interval, 20.0)
    return max_interval


def _canvas_blocked_is_terminal(status_classes: set[str]) -> bool:
    return "blocked" in status_classes and "running" not in status_classes


def _canvas_localization_retry_pending(
    successful_node_ids: set[str],
    *,
    attempts: dict[str, int],
    localized_node_ids: set[str],
    local_project_path: Path | None,
) -> bool:
    if local_project_path is None:
        return False
    return any(
        node_id not in localized_node_ids
        and attempts.get(node_id, 0) < CANVAS_LOCALIZATION_MAX_ATTEMPTS
        for node_id in successful_node_ids
    )


def _record_canvas_localization_attempts(
    records: list[dict[str, Any]],
    *,
    attempts: dict[str, int],
    localized_node_ids: set[str],
) -> None:
    for record in records:
        node_id = str(record.get("node_id") or "").strip()
        if not node_id:
            continue
        attempts[node_id] = attempts.get(node_id, 0) + 1
        if record.get("local_preview_status") == "ready":
            localized_node_ids.add(node_id)


def _localize_canvas_ready_nodes(
    snapshot: dict[str, Any],
    node_ids: list[str],
    *,
    project_path: Path,
    run_id: str,
    attribution_nodes: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    nodes = snapshot.get("nodes") if isinstance(snapshot.get("nodes"), dict) else {}
    attribution_by_node = attribution_nodes if isinstance(attribution_nodes, dict) else {}
    records: list[dict[str, Any]] = []
    for node_id in node_ids:
        node = nodes.get(node_id) if isinstance(nodes.get(node_id), dict) else {}
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        info = node.get("info") if isinstance(node.get("info"), dict) else {}
        media_type = _canvas_media_kind(
            str(data.get("content_type") or ""),
            str(info.get("node_type") or ""),
        )
        media_type = media_type if media_type in {"image", "video", "audio"} else ""
        attribution_node = (
            attribution_by_node.get(node_id)
            if isinstance(attribution_by_node.get(node_id), dict)
            else {}
        )
        task_id, task_id_status, task_id_error = _canvas_ready_task_id(
            data,
            attribution_node,
        )
        title = str(node.get("title") or info.get("title") or node_id)
        localized = (
            ensure_local_asset(
                task_id=task_id,
                media_type=media_type,
                project_path=project_path,
                progress=True,
                label=title,
            )
            if task_id
            else {"local_path": "", "status": task_id_status, "error": task_id_error}
        )
        record = {
            "node_id": node_id,
            "task_id": task_id,
            "media_type": media_type,
            "local_path": localized["local_path"],
            "local_preview_status": localized["status"],
            "local_preview_error": localized["error"],
        }
        records.append(record)
        if localized["status"] == "ready":
            print(
                f"[pixverse-agent canvas-paid] Local preview ready for {title}: {localized['local_path']}",
                file=sys.stderr,
                flush=True,
            )
        try:
            append_jsonl(
                project_path / "manifest.jsonl",
                {
                    "event": "task.localized",
                    "at": utc_now(),
                    "source": "canvas paid follow",
                    "run_id": run_id,
                    **record,
                },
            )
        except OSError as exc:
            record["audit_error"] = str(exc)
    return records


def _canvas_ready_task_id(
    data: dict[str, Any],
    attribution_node: dict[str, Any],
) -> tuple[str, str, str]:
    """Resolve only the current run's asset id; never guess from recursive node history."""

    direct_ids = {
        str(data.get(key) or "").strip()
        for key in ("asset_id", "video_id", "image_id", "audio_id", "task_id")
        if str(data.get(key) or "").strip()
    }
    baseline_ids = {
        str(item).strip()
        for item in attribution_node.get("baseline_task_ids", [])
        if str(item).strip()
    }
    attributed_ids = {
        str(item).strip()
        for item in attribution_node.get("matched_receipt_task_ids", [])
        if str(item).strip()
    }
    if attribution_node.get("attributed") is True:
        attributed_ids.update(
            str(item).strip()
            for item in attribution_node.get("new_task_ids", [])
            if str(item).strip()
        )
    owned_ids = attributed_ids - baseline_ids
    direct_owned_ids = direct_ids & owned_ids
    if len(direct_owned_ids) == 1:
        return next(iter(direct_owned_ids)), "ready", ""
    if len(owned_ids) == 1:
        return next(iter(owned_ids)), "ready", ""
    current_direct_ids = direct_ids - baseline_ids
    if len(current_direct_ids) == 1:
        return next(iter(current_direct_ids)), "ready", ""
    candidates = owned_ids or current_direct_ids or direct_ids
    if len(candidates) > 1:
        return (
            "",
            "asset_id_ambiguous",
            "Canvas returned multiple current asset ids; preview download was deferred until one can be attributed.",
        )
    if direct_ids and direct_ids <= baseline_ids:
        return (
            "",
            "asset_id_stale",
            "Canvas still exposes only the pre-submit asset id; preview download will be retried after graph refresh.",
        )
    return (
        "",
        "task_id_missing",
        "Canvas has not exposed a current PixVerse asset id yet; preview download will be retried.",
    )


def _canvas_should_observe_credits(*, generation_state: str, generation_status: str) -> bool:
    if generation_status in {"succeeded", "partially_succeeded", "failed", "not_started"}:
        return True
    return generation_state in {"unknown", "not_started", "submission_failed"}


def _canvas_reconcile_read_timeout(deadline: float, *, refresh_once: bool = False) -> float:
    """Cap child reads without starving the mandatory read in refresh-once mode."""

    if refresh_once:
        return CANVAS_READ_TIMEOUT_SECONDS

    remaining = deadline - time.monotonic()
    return min(
        CANVAS_READ_TIMEOUT_SECONDS,
        max(CANVAS_MIN_RECONCILE_READ_TIMEOUT_SECONDS, remaining),
    )


def _canvas_paid_generation_status(statuses: dict[str, str]) -> str:
    """Summarize generation progress independently from credit observation."""

    classes = {_canvas_paid_status_class(value) for value in statuses.values()}
    if not classes:
        return "unknown"
    if classes <= {"success"}:
        return "succeeded"
    if classes == {"success", "failed"}:
        return "partially_succeeded"
    if classes <= {"failed"}:
        return "failed"
    if "blocked" in classes:
        return "blocked"
    if classes <= {"not_dispatched"}:
        return "not_started"
    if "running" in classes:
        return "running"
    return "unknown"


def _canvas_paid_status_counts(statuses: dict[str, str]) -> dict[str, int]:
    counts = {
        "total": len(statuses),
        "succeeded": 0,
        "failed": 0,
        "running": 0,
        "blocked": 0,
        "not_started": 0,
        "unknown": 0,
    }
    names = {
        "success": "succeeded",
        "failed": "failed",
        "running": "running",
        "blocked": "blocked",
        "not_dispatched": "not_started",
        "unknown": "unknown",
    }
    for status in statuses.values():
        key = names.get(_canvas_paid_status_class(status), "unknown")
        counts[key] += 1
    return counts


def _canvas_paid_node_outcome_summary(statuses: dict[str, str]) -> dict[str, Any]:
    succeeded_node_ids = sorted(
        node_id
        for node_id, status in statuses.items()
        if _canvas_paid_status_class(status) == "success"
    )
    failed_node_ids = sorted(
        node_id
        for node_id, status in statuses.items()
        if _canvas_paid_status_class(status) == "failed"
    )
    return {
        "status_counts": _canvas_paid_status_counts(statuses),
        "succeeded_node_ids": succeeded_node_ids,
        "failed_node_ids": failed_node_ids,
        "downstream_ready_node_ids": succeeded_node_ids,
        "downstream_ready": bool(succeeded_node_ids),
    }


def _canvas_paid_snapshot_generation_status(
    context: dict[str, Any],
    snapshot: dict[str, Any] | None,
) -> str:
    if snapshot is None:
        return "unknown"
    nodes = snapshot.get("nodes") if isinstance(snapshot.get("nodes"), dict) else {}
    statuses = {
        str(node_id): _canvas_node_status(nodes.get(str(node_id)))
        for node_id in context.get("node_ids", [])
    }
    return _canvas_paid_generation_status(statuses)


def _canvas_paid_status_class(status: str) -> str:
    normalized = str(status or "").strip().lower().replace("-", "_").replace(" ", "_")
    if normalized in {"1", "success", "succeeded", "done", "completed", "complete", "finished"}:
        return "success"
    if normalized in {
        "7",
        "8",
        "failed",
        "invalid",
        "failure",
        "error",
        "cancelled",
        "canceled",
        "rejected",
    }:
        return "failed"
    if normalized == "blocked":
        return "blocked"
    if normalized in {"metadata", "ready"}:
        return "not_dispatched"
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
        "submitted",
        "rendering",
    }:
        return "running"
    return "unknown"


def _canvas_prepare(args: argparse.Namespace) -> int:
    started_monotonic = time.monotonic()
    started_at = utc_now()
    correlation_id = uuid.uuid4().hex
    if not which("pixverse"):
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "pixverse_cli_required",
                    "message": "The managed PixVerse CLI is not ready.",
                    "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return SETUP_GATE_EXIT
    contract_error = _canvas_wrapper_contract_guard(
        schema_version=CANVAS_PREPARE_SCHEMA_VERSION,
        json_output=True,
    )
    if contract_error is not None:
        return contract_error

    binding_path = canvas_project_binding_path()
    explicit_project_id = str(args.project_id).strip()
    try:
        project_id = explicit_project_id or load_canvas_project_id(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_project_binding_invalid",
                    "message": str(exc),
                    "binding_path": str(binding_path),
                    "snapshot_accepted": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if not project_id:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_project_binding_required",
                    "message": (
                        "No Canvas project is bound to this local scope. Establish the intended project "
                        "binding first or pass --project-id explicitly."
                    ),
                    "binding_path": str(binding_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    region_error, region = _canvas_region_guard(
        binding_path=binding_path,
        project_id=project_id,
        explicit_project_id=bool(explicit_project_id),
        json_output=args.format == "json",
    )
    if region_error is not None:
        return region_error
    if explicit_project_id and not _bind_explicit_canvas_project_before_remote(
        project_id,
        binding_path=binding_path,
    ):
        return 2

    requested_node_types = list(dict.fromkeys(str(value).strip() for value in args.node_type if str(value).strip()))
    capabilities_args = ["pixverse", "capabilities", "canvas"]
    if args.refresh_capabilities:
        capabilities_args.append("--refresh")
    capabilities_args.append("--json")
    capabilities_started = time.monotonic()
    capabilities_result = run_captured(capabilities_args, timeout=CANVAS_READ_TIMEOUT_SECONDS)
    capabilities_seconds = round(time.monotonic() - capabilities_started, 3)
    if not capabilities_result.ok:
        _relay_command_result(capabilities_result)
        return capabilities_result.returncode
    try:
        capabilities = _parse_canvas_capabilities_output(capabilities_result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_capabilities_unreadable",
                    "message": str(exc),
                    "project_id": project_id,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    capability_compatibility = _canvas_capability_handshake(capabilities)
    if not capability_compatibility["accepted"]:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_capability_contract_incompatible",
                    "message": (
                        "Canvas capability discovery reported an incompatible contract. "
                        "No graph mutation or paid operation was attempted."
                    ),
                    "project_id": project_id,
                    "capability_compatibility": capability_compatibility,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    available_contracts = _canvas_capability_contracts(capabilities)
    missing_node_types = [node_type for node_type in requested_node_types if node_type not in available_contracts]
    if missing_node_types:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_capability_contract_missing",
                    "message": (
                        "Canvas capabilities did not contain every requested node contract. Query schema only "
                        "for the listed missing type after confirming that the capability response is current."
                    ),
                    "project_id": project_id,
                    "missing_node_types": missing_node_types,
                    "schema_query_required_for": missing_node_types,
                    "refresh_used": bool(args.refresh_capabilities),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    unusable_node_types = [
        node_type
        for node_type in requested_node_types
        if not _canvas_capability_contract_usable(available_contracts[node_type])
    ]
    if unusable_node_types:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_capability_contract_unsupported",
                    "message": (
                        "Canvas currently exposes the listed node types as non-executable and "
                        "non-authorable. Do not construct or dispatch them."
                    ),
                    "project_id": project_id,
                    "unsupported_node_types": unusable_node_types,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    state_path = canvas_sync_state_path(binding_path=binding_path)
    sync_reports: list[dict[str, Any]] = []
    sync_started = time.monotonic()
    try:
        with canvas_sync_lock(state_path):
            sync_returncode = _canvas_sync_locked(
                args,
                project_id,
                binding_path,
                state_path,
                report_sink=sync_reports,
                binding_already_persisted=bool(explicit_project_id),
            )
    except CanvasSyncLockError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
                    "error": "canvas_sync_lock_timeout",
                    "message": str(exc),
                    "project_id": project_id,
                    "state_path": str(state_path),
                    "snapshot_accepted": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if sync_returncode != 0 or not sync_reports:
        return sync_returncode
    sync_report = sync_reports[0]
    sync_seconds = round(time.monotonic() - sync_started, 3)
    elapsed_seconds = round(time.monotonic() - started_monotonic, 3)
    editor_url = _canvas_project_url(project_id)
    payload = {
        "schema_version": CANVAS_PREPARE_SCHEMA_VERSION,
        "correlation_id": correlation_id,
        "project_id": project_id,
        "region": region,
        "editor_url": editor_url,
        "browser_handoff": _codex_browser_handoff(editor_url, refresh_after_mutation=True),
        "capability_contracts": [available_contracts[node_type] for node_type in requested_node_types],
        "capability_compatibility": capability_compatibility,
        "capabilities_trace_id": capabilities.get("trace_id") or "",
        "contracts_source": "capabilities canvas",
        "schema_queries_skipped": requested_node_types,
        "schema_query_required_for": [],
        "sync": sync_report,
        "timings": {
            "started_at": started_at,
            "finished_at": utc_now(),
            "elapsed_seconds": elapsed_seconds,
            "components": {
                "pixverse_api": {
                    "capabilities_seconds": capabilities_seconds,
                    "graph_read_seconds": sync_report.get("timings", {}).get("graph_read_seconds", 0.0),
                },
                "local_io": {
                    "checkpoint_write_seconds": sync_report.get("timings", {}).get("state_write_seconds", 0.0),
                },
                "cli": {
                    "sync_seconds": sync_seconds,
                    "total_seconds": elapsed_seconds,
                },
                "host_required": ["agent_planning", "iab_handoff"],
            },
        },
    }
    if capabilities_result.stderr:
        sys.stderr.write(capabilities_result.stderr)
        sys.stderr.flush()
    if args.format == "markdown":
        print(_render_canvas_prepare_markdown(payload), end="")
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _parse_canvas_capabilities_output(output: str) -> dict[str, Any]:
    payload = json.loads(output)

    def find(value: Any) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        if any(isinstance(value.get(key), list) for key in ("nodes", "node_types")):
            return value
        for key in ("data", "result", "capabilities"):
            nested = find(value.get(key))
            if nested is not None:
                return nested
        return None

    capabilities = find(payload)
    if capabilities is None:
        raise ValueError(
            "Canvas capabilities output does not contain a nodes list or legacy node_types list"
        )
    return capabilities


def _canvas_capability_nodes(capabilities: dict[str, Any]) -> list[dict[str, Any]]:
    """Return current ``nodes[]`` records, with legacy ``node_types[]`` compatibility."""

    for key in ("nodes", "node_types"):
        records = capabilities.get(key)
        if isinstance(records, list):
            return [item for item in records if isinstance(item, dict)]
    return []


def _canvas_capability_contracts(capabilities: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("node_type") or "").strip(): item
        for item in _canvas_capability_nodes(capabilities)
        if str(item.get("node_type") or "").strip()
    }


def _canvas_capability_graph_contract(contract: dict[str, Any]) -> dict[str, Any]:
    graph_contract = contract.get("canvas")
    return graph_contract if isinstance(graph_contract, dict) else contract


def _read_canvas_runtime_capabilities() -> tuple[CommandResult, dict[str, Any] | None, str]:
    """Read the merged live Canvas/CLI contract once for a guarded operation."""

    result = run_captured(
        ["pixverse", "capabilities", "canvas", "--json"],
        timeout=CANVAS_READ_TIMEOUT_SECONDS,
    )
    if not result.ok:
        return result, None, "command_failed"
    try:
        return result, _parse_canvas_capabilities_output(result.stdout), ""
    except (json.JSONDecodeError, ValueError) as exc:
        return result, None, str(exc)


def _canvas_capability_route_context(
    contract: dict[str, Any] | None,
    selector: str,
) -> dict[str, Any]:
    """Resolve one current Canvas route without confusing Graph and Create schemas."""

    if not isinstance(contract, dict):
        return {}
    routes = contract.get("routes")
    if not isinstance(routes, list):
        return {}
    for route in routes:
        if not isinstance(route, dict):
            continue
        if str(route.get("selector") or "").strip() != selector:
            continue
        cli = route.get("cli") if isinstance(route.get("cli"), dict) else {}
        capability = cli.get("capability") if isinstance(cli.get("capability"), dict) else {}
        field_mapping = route.get("field_mapping")
        return {
            "selector": selector,
            "route": route,
            "capability": capability,
            "field_mapping": (
                [item for item in field_mapping if isinstance(item, dict)]
                if isinstance(field_mapping, list)
                else []
            ),
        }
    return {}


def _canvas_generation_route_context(
    *,
    node_id: str,
    node_type: str,
    selector: str,
    contract: dict[str, Any] | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    if not isinstance(contract, dict):
        return {}, [
            {
                "node_id": node_id,
                "field": "node_type",
                "code": "canvas_capability_contract_missing",
                "message": f"capabilities canvas did not return a contract for {node_type!r}.",
            }
        ]
    if not _canvas_capability_contract_usable(contract):
        return {}, [
            {
                "node_id": node_id,
                "field": "node_type",
                "code": "canvas_capability_contract_unsupported",
                "message": f"The runtime Canvas contract for {node_type!r} is not executable.",
            }
        ]
    context = _canvas_capability_route_context(contract, selector)
    if not context:
        return {}, [
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_capability_route_missing",
                "message": (
                    f"capabilities canvas did not resolve selector {selector!r} for {node_type!r}."
                ),
            }
        ]
    route = context.get("route") if isinstance(context.get("route"), dict) else {}
    if route.get("compatible") is False:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_capability_route_incompatible",
                "message": f"The runtime route for selector {selector!r} is incompatible.",
                "route_issues": route.get("issues") if isinstance(route.get("issues"), list) else [],
            }
        )
    capability = context.get("capability")
    if not isinstance(capability, dict) or not capability:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_create_capability_missing",
                "message": (
                    "The selected Canvas route did not include its resolved routes[].cli.capability "
                    "Create contract."
                ),
            }
        )
    capability_ref = str(route.get("capability_ref") or "").strip()
    capability_id = str(capability.get("capability_id") or "").strip() if isinstance(capability, dict) else ""
    if capability_ref and capability_id and capability_ref != capability_id:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_create_capability_mismatch",
                "message": (
                    f"Canvas route {capability_ref!r} resolved to a different Create capability "
                    f"{capability_id!r}."
                ),
            }
        )
    if not context.get("field_mapping"):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_capability_field_mapping_missing",
                "message": "The selected Canvas route did not publish a readable field mapping.",
            }
        )
    return context, issues


def _canvas_resolved_create_mode_capability(route_context: dict[str, Any]) -> dict[str, Any]:
    """Adapt ``routes[].cli.capability`` to the validator's normalized mode view."""

    capability = route_context.get("capability")
    if not isinstance(capability, dict) or not capability:
        return {}
    parameters = capability.get("parameters")
    parameters = parameters if isinstance(parameters, dict) else {}
    models = capability.get("models")
    models = models if isinstance(models, dict) else {}
    model_parameters: dict[str, dict[str, Any]] = {}
    for model_id, model_record in models.items():
        if not isinstance(model_record, dict):
            continue
        definitions = model_record.get("parameters")
        if not isinstance(definitions, dict):
            continue
        for field, definition in definitions.items():
            if isinstance(definition, dict):
                model_parameters.setdefault(str(field), {})[str(model_id)] = definition
    model_ids = [str(model_id) for model_id in models]
    model_parameter = parameters.get("model")
    if not model_ids and isinstance(model_parameter, dict):
        enum = model_parameter.get("enum")
        if isinstance(enum, list):
            model_ids = [str(value) for value in enum]
    return {
        "capability_id": capability.get("capability_id") or "",
        "model_ids": model_ids,
        "parameters": parameters,
        "model_parameters": model_parameters,
    }


def _canvas_route_target_fields(route_context: dict[str, Any]) -> set[str]:
    return {
        str(item.get("to") or "").strip()
        for item in route_context.get("field_mapping", [])
        if isinstance(item, dict) and str(item.get("to") or "").strip()
    }


def _canvas_capability_handshake(capabilities: dict[str, Any]) -> dict[str, Any]:
    """Interpret the preview capability envelope without discarding usable node contracts.

    Preview currently omits the optional top-level capability_schema_revision
    while exposing adapter-v2 contracts per executable node. The CLI reports
    that envelope as incompatible even though each target contract is usable.
    Accept only that specific handshake gap; every other compatibility issue
    remains fail-closed.
    """

    reported = capabilities.get("compatible")
    sources = capabilities.get("sources") if isinstance(capabilities.get("sources"), dict) else {}
    canvas_source = sources.get("canvas") if isinstance(sources.get("canvas"), dict) else {}
    revision = capabilities.get("capability_schema_revision") or canvas_source.get(
        "capability_schema_revision"
    )
    raw_issues = capabilities.get("issues")
    issues = [item for item in raw_issues if isinstance(item, dict)] if isinstance(raw_issues, list) else []
    missing_revision_only = bool(issues) and all(
        str(issue.get("code") or "") == "unsupported_canvas_capability_schema"
        and str(issue.get("path") or "") == "capability_schema_revision"
        and (
            revision in {None, ""}
            or "undefined" in str(issue.get("message") or "").lower()
            or "missing" in str(issue.get("message") or "").lower()
        )
        for issue in issues
    )
    accepted = reported is not False or missing_revision_only
    return {
        "reported_compatible": reported,
        "accepted": accepted,
        "basis": (
            "reported_compatible"
            if reported is not False
            else "adapter_v2_node_contracts_with_missing_envelope_revision"
            if missing_revision_only
            else "incompatible"
        ),
        "schema_version": capabilities.get("schema_version") or "",
        "capability_schema_revision": revision,
        "capabilities_version": (
            capabilities.get("capabilities_version")
            or canvas_source.get("capabilities_version")
            or ""
        ),
        "issues": issues,
    }


def _canvas_capability_contract_usable(contract: dict[str, Any]) -> bool:
    if contract.get("compatible") is False:
        return False
    graph_contract = _canvas_capability_graph_contract(contract)
    if graph_contract.get("executable") is True:
        node_type = str(contract.get("node_type") or "").strip().lower()
        if node_type in {"image_generate", "video_generate", "audio_generate"}:
            adapter = graph_contract.get("capability_adapter")
            return (
                isinstance(adapter, dict)
                and adapter.get("contract_revision") == "canvas_cli_capability_adapter.v2"
            )
        return True
    authoring = graph_contract.get("authoring")
    return (
        isinstance(authoring, dict) and authoring.get("supported") is True
    ) or graph_contract.get("graph_patch_authoring_status") == "supported"


def _render_canvas_prepare_markdown(payload: dict[str, Any]) -> str:
    contracts = payload.get("capability_contracts") if isinstance(payload.get("capability_contracts"), list) else []
    compatibility = (
        payload.get("capability_compatibility")
        if isinstance(payload.get("capability_compatibility"), dict)
        else {}
    )
    sync = payload.get("sync") if isinstance(payload.get("sync"), dict) else {}
    timings = payload.get("timings") if isinstance(payload.get("timings"), dict) else {}
    lines = [
        "# Canvas Prepare",
        "",
        f"- Project: `{payload.get('project_id', '')}`",
        f"- Editor: {payload.get('editor_url', '')}",
        f"- Edit version: `{sync.get('current_edit_version', '')}`",
        f"- Snapshot accepted: `{'yes' if sync.get('snapshot_accepted') else 'no'}`",
        f"- Capability contracts: `{len(contracts)}`",
        f"- Capability compatibility: `{compatibility.get('basis', 'unreported')}`",
        f"- Capability version: `{compatibility.get('capabilities_version', '')}`",
        f"- Schema queries skipped: `{len(payload.get('schema_queries_skipped', []))}`",
        f"- Elapsed: `{timings.get('elapsed_seconds', 'unknown')}s`",
        f"- Correlation: `{payload.get('correlation_id', '')}`",
        "",
    ]
    for contract in contracts:
        if isinstance(contract, dict):
            lines.append(f"- `{contract.get('node_type', '')}` · executable `{bool(contract.get('executable'))}`")
    return "\n".join(lines).rstrip() + "\n"


def _canvas_sync(args: argparse.Namespace) -> int:
    if not which("pixverse"):
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "pixverse_cli_required",
                    "message": "The managed PixVerse CLI is not ready.",
                    "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return SETUP_GATE_EXIT
    contract_error = _canvas_wrapper_contract_guard(
        schema_version=CANVAS_SYNC_REPORT_SCHEMA_VERSION,
        json_output=True,
    )
    if contract_error is not None:
        return contract_error

    binding_path = canvas_project_binding_path()
    try:
        project_id = str(args.project_id).strip() or load_canvas_project_id(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "canvas_project_binding_invalid",
                    "message": str(exc),
                    "binding_path": str(binding_path),
                    "snapshot_accepted": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if not project_id:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "canvas_project_binding_required",
                    "message": (
                        "No Canvas project is bound to this local scope. Run a project-scoped Canvas command "
                        "first or pass --project-id explicitly."
                    ),
                    "binding_path": str(binding_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    region_error, _ = _canvas_region_guard(
        binding_path=binding_path,
        project_id=project_id,
        explicit_project_id=bool(str(args.project_id).strip()),
        json_output=args.format == "json",
    )
    if region_error is not None:
        return region_error

    state_path = canvas_sync_state_path(binding_path=binding_path)
    try:
        with canvas_sync_lock(state_path):
            return _canvas_sync_locked(args, project_id, binding_path, state_path)
    except CanvasSyncLockError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "canvas_sync_lock_timeout",
                    "message": str(exc),
                    "project_id": project_id,
                    "state_path": str(state_path),
                    "snapshot_accepted": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2


def _canvas_sync_locked(
    args: argparse.Namespace,
    project_id: str,
    binding_path: Path,
    state_path: Path,
    *,
    report_sink: list[dict[str, Any]] | None = None,
    binding_already_persisted: bool = False,
) -> int:
    sync_started = time.monotonic()
    sync_started_at = utc_now()
    if (
        str(args.project_id).strip()
        and not binding_already_persisted
        and not _bind_explicit_canvas_project_before_remote(
            project_id,
            binding_path=binding_path,
        )
    ):
        return 2
    graph_read_started = time.monotonic()
    graph_result = _read_canvas_graph(project_id)
    graph_read_seconds = round(time.monotonic() - graph_read_started, 3)
    if not graph_result.ok:
        _relay_command_result(graph_result)
        return graph_result.returncode
    try:
        graph = parse_canvas_graph_output(graph_result.stdout)
        current = snapshot_canvas_graph(graph, include_layout=bool(args.include_layout))
    except CanvasGraphError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "canvas_graph_unreadable",
                    "message": str(exc),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1

    try:
        previous = load_canvas_sync_state(path=state_path, project_id=project_id, fail_on_invalid=True)
    except CanvasSyncStateError as exc:
        if not args.reset_checkpoint:
            print(
                json.dumps(
                    {
                        "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                        "error": "canvas_sync_state_invalid",
                        "message": str(exc),
                        "state_path": str(state_path),
                        "snapshot_accepted": False,
                        "next_steps": [
                            f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} "
                            "--reset-checkpoint --format markdown"
                        ],
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        previous = None
    if previous and bool(previous.get("include_layout")) != bool(args.include_layout):
        if not args.reset_checkpoint:
            requested_flag = " --include-layout" if args.include_layout else ""
            print(
                json.dumps(
                    {
                        "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                        "error": "canvas_sync_layout_mode_change_requires_reset",
                        "message": (
                            "The requested layout comparison mode differs from the accepted checkpoint. "
                            "The checkpoint was not replaced because resetting it would hide any semantic "
                            "Web changes since the last sync. Review the cloud graph, then explicitly reset "
                            "the checkpoint if the mode change is intentional."
                        ),
                        "project_id": project_id,
                        "state_path": str(state_path),
                        "accepted_include_layout": bool(previous.get("include_layout")),
                        "requested_include_layout": bool(args.include_layout),
                        "snapshot_accepted": False,
                        "next_steps": [
                            f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)}"
                            f"{requested_flag} --reset-checkpoint --format markdown"
                        ],
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        previous = None
    elif args.reset_checkpoint:
        previous = None
    state_write_started = time.monotonic()
    try:
        write_canvas_sync_state(current, path=state_path)
    except OSError as exc:
        print(
            json.dumps(
                {
                    "schema_version": CANVAS_SYNC_REPORT_SCHEMA_VERSION,
                    "error": "canvas_sync_state_write_failed",
                    "message": str(exc),
                    "state_path": str(state_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    state_write_seconds = round(time.monotonic() - state_write_started, 3)
    report = canvas_sync_report(
        previous=previous,
        current=current,
        state_path=state_path,
        accepted=True,
    )
    sync_elapsed_seconds = round(time.monotonic() - sync_started, 3)
    report["timings"] = {
        "started_at": sync_started_at,
        "graph_read_seconds": graph_read_seconds,
        "state_write_seconds": state_write_seconds,
        "elapsed_seconds": sync_elapsed_seconds,
        "finished_at": utc_now(),
        "components": {
            "pixverse_api": {"graph_read_seconds": graph_read_seconds},
            "local_io": {"checkpoint_write_seconds": state_write_seconds},
            "cli": {"total_seconds": sync_elapsed_seconds},
            "host_required": ["agent_planning", "iab_handoff"],
        },
    }
    if graph_result.stderr:
        sys.stderr.write(graph_result.stderr)
        sys.stderr.flush()
    if report_sink is not None:
        report_sink.append(report)
    elif args.format == "markdown":
        print(render_canvas_sync_markdown(report), end="")
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


def _pixverse_passthrough(args: list[str]) -> int:
    if args and args[0] == "--":
        args = args[1:]
    original_args = list(args)
    policy_args = _normalize_pixverse_global_options(args)
    if not which("pixverse"):
        print(
            json.dumps(
                {
                    "error": "pixverse_cli_required",
                    "message": (
                        f"PixVerse Agent Plugin {__version__} requires PixVerse CLI "
                        f">={PIXVERSE_CLI_MINIMUM_VERSION} in its managed {pixverse_cli_channel()} runtime. "
                        "Install or refresh it before running CLI commands."
                    ),
                    "channel": pixverse_cli_channel(),
                    "source": pixverse_cli_source(),
                    "runtime": str(pixverse_cli_runtime_root()),
                    "next_steps": [f"{pvx_command()} bootstrap --yes", f"{pvx_command()} doctor"],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return SETUP_GATE_EXIT
    direct_paid_create = _is_direct_paid_create(policy_args)
    direct_paid_miniapp = policy_args[:2] == ["miniapps", "create"]
    is_help = _is_explicit_pixverse_help_request(original_args, policy_args)
    if is_help:
        return run_passthrough(["pixverse", *original_args])
    try:
        region = effective_pixverse_region(original_args)
        explicit_region = explicit_pixverse_region(original_args)
    except PixVerseRegionError as exc:
        print(
            json.dumps(
                {
                    "error": "pixverse_region_invalid",
                    "message": str(exc),
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if policy_args[:1] == ["update"]:
        internal = pixverse_cli_channel() == INTERNAL_CLI_CHANNEL
        print(
            json.dumps(
                {
                    "error": "managed_cli_update_blocked",
                    "message": (
                        f"Plugin {__version__} manages PixVerse CLI >={PIXVERSE_CLI_MINIMUM_VERSION}. "
                        + (
                            "Internal CLI updates come from the ZIP bundled with the local plugin; "
                            f"rebuild/reinstall the local package and run `{pvx_command()} bootstrap --yes`."
                            if internal
                            else f"Run `{pvx_command()} bootstrap --yes` to refresh this private runtime to npm {PIXVERSE_CLI_INSTALL_SPEC}."
                        )
                    ),
                    "channel": pixverse_cli_channel(),
                    "source": pixverse_cli_source(),
                    "minimum_version": PIXVERSE_CLI_MINIMUM_VERSION,
                    "install_spec": pixverse_cli_effective_install_spec(),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if policy_args[:2] == ["auth", "login"]:
        return _run_pixverse_auth_login(policy_args)
    web_action = _pixverse_static_web_action(policy_args)
    if web_action:
        return _emit_pixverse_web_handoff(web_action, policy_args)
    if direct_paid_miniapp:
        print(
            json.dumps(
                {
                    "error": "miniapps_create_unsupported",
                    "message": (
                        "Paid MiniApps creation is not supported by the pvx queue yet. "
                        "Use pixverse miniapps list/info for read-only inspection; do not bypass "
                        "generation preflight, billing, polling, or receipt capture."
                    ),
                    "received_command": shlex.join(["pixverse", *original_args]),
                    "generation_started": False,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if direct_paid_create:
        print(
            json.dumps(
                {
                    "error": "direct_paid_create_blocked",
                    "message": f"Paid PixVerse generation, including retries and reworks, must go through queue preflight. Create a one-task queue, run `{pvx_command()} quote queue <queue.json>`, then use `{pvx_command()} queue run <queue.json>` under the default automatic policy. If effective confirmation policy is require, show the batch, wait for approval, and add --confirmed.",
                    "received_command": shlex.join(["pixverse", *original_args]),
                    "suggested_next_steps": _direct_create_queue_steps(policy_args),
                    "retry_policy": "Corrections, prompt fixes, audio fixes, reruns, regenerations, and extra variants are new paid work and are not exempt.",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if policy_args[:1] == ["create"]:
        blocked = _print_setup_blocker("pixverse create")
        if blocked:
            return blocked
    guarded_canvas_command = (
        policy_args[:1] == ["canvas"]
        or policy_args[:2] == ["capabilities", "canvas"]
    )
    if guarded_canvas_command:
        try:
            policy_args = _normalize_canvas_project_argument(policy_args)
        except ValueError as exc:
            return _emit_canvas_guard_error(
                {"error": "canvas_project_id_invalid", "message": str(exc),
                 "mutation_executed": False, "generation_started": False},
                json_output=_requests_json_output(original_args),
            )
        contract_error = _canvas_wrapper_contract_guard(
            schema_version=CANVAS_SYNC_GUARD_SCHEMA_VERSION,
            json_output=_requests_json_output(original_args),
        )
        if contract_error is not None:
            return contract_error
    if guarded_canvas_command and explicit_region:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_region_option_unsupported",
                "message": (
                    "Guarded Canvas workflows require one region for graph reads, billing preflight, "
                    "submission, and recovery. Set PIXVERSE_REGION for the whole workflow instead of "
                    "passing --region to one Canvas command."
                ),
                "region": region,
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=_requests_json_output(original_args),
    )
    if (
        guarded_canvas_command
        and _option_value(original_args, "--workspace-id").strip()
    ):
        workspace_id = _option_value(original_args, "--workspace-id").strip()
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_workspace_override_unsupported",
                "message": (
                    "Guarded Canvas commands do not accept --workspace-id because graph reads, "
                    "billing preflight, mutation, and reconciliation must use one verified active workspace."
                ),
                "workspace_id": workspace_id,
                "mutation_executed": False,
                "generation_started": False,
                "next_steps": [
                    "Select the intended workspace as the active PixVerse CLI workspace.",
                    "Rerun the command without --workspace-id.",
                ],
            },
            json_output=_requests_json_output(original_args),
        )
    args = policy_args
    if guarded_canvas_command and _is_canvas_project_create(args):
        return _run_canvas_project_create(args)

    explicit_project_id = _canvas_project_id_from_args(args)
    canvas_project_scoped = guarded_canvas_command and _is_canvas_project_scoped_command(args)
    if canvas_project_scoped and _option_is_present(args, "--project-id") and not explicit_project_id:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_project_id_invalid",
                "message": "--project-id was supplied without a valid non-option value.",
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=_requests_json_output(args),
        )
    if canvas_project_scoped:
        confirmation_plan_id = _option_value(args, CANVAS_PAID_CONFIRMATION_PLAN_FLAG).strip()
        binding_path = canvas_project_binding_path()
        if confirmation_plan_id and not confirmation_plan_id.startswith("-"):
            try:
                plan_binding_paths = _canvas_paid_confirmation_plan_binding_paths(
                    confirmation_plan_id
                )
            except (OSError, ValueError) as exc:
                return _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": "canvas_confirmation_plan_state_unreadable",
                        "message": str(exc),
                        "confirmation_plan_id": confirmation_plan_id,
                        "mutation_executed": False,
                        "generation_started": False,
                    },
                    json_output=_requests_json_output(args),
                )
            if len(plan_binding_paths) != 1:
                return _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": (
                            "canvas_confirmation_plan_not_found"
                            if not plan_binding_paths
                            else "canvas_confirmation_plan_ambiguous"
                        ),
                        "message": (
                            "No local Canvas paid confirmation plan matches this id."
                            if not plan_binding_paths
                            else "More than one local Canvas paid confirmation plan matches this id."
                        ),
                        "confirmation_plan_id": confirmation_plan_id,
                        "mutation_executed": False,
                        "generation_started": False,
                    },
                    json_output=_requests_json_output(args),
                )
            binding_path = plan_binding_paths[0]
        region_error, _ = _canvas_region_guard(
            binding_path=binding_path,
            project_id=explicit_project_id or "",
            # A bound confirmation command carries --project-id as immutable
            # approval data, not as permission to rebind the local project in
            # another region. Region drift must stop before any local write.
            explicit_project_id=bool(explicit_project_id) and not confirmation_plan_id,
            json_output=_requests_json_output(args),
        )
        if region_error is not None:
            return region_error
        state_path = canvas_sync_state_path(binding_path=binding_path)
        try:
            with canvas_sync_lock(state_path):
                if explicit_project_id:
                    project_id = explicit_project_id
                    if confirmation_plan_id:
                        try:
                            bound_project_id = load_canvas_project_id(path=binding_path)
                        except CanvasProjectBindingError as exc:
                            return _emit_canvas_guard_error(
                                {
                                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                                    "error": "canvas_confirmation_plan_state_unreadable",
                                    "message": str(exc),
                                    "confirmation_plan_id": confirmation_plan_id,
                                    "binding_path": str(binding_path),
                                    "mutation_executed": False,
                                    "generation_started": False,
                                },
                                json_output=_requests_json_output(args),
                            )
                        if bound_project_id and bound_project_id != project_id:
                            return _emit_canvas_guard_error(
                                {
                                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                                    "error": "canvas_confirmation_plan_stale",
                                    "message": (
                                        "The bound Canvas confirmation plan cannot select or rebind a "
                                        "different local project. Create a fresh preflight for the active binding."
                                    ),
                                    "confirmation_plan_id": confirmation_plan_id,
                                    "binding_path": str(binding_path),
                                    "bound_project_id": bound_project_id,
                                    "project_id": project_id,
                                    "changed_fields": ["project_id"],
                                    "mutation_executed": False,
                                    "generation_started": False,
                                },
                                json_output=_requests_json_output(args),
                            )
                    elif not _bind_explicit_canvas_project_before_remote(
                        project_id,
                        binding_path=binding_path,
                    ):
                        return 2
                else:
                    args, binding_error = _inject_canvas_project_binding(
                        args,
                        binding_path=binding_path,
                    )
                    if binding_error is not None:
                        return binding_error
                    project_id = _canvas_project_id_from_args(args)
                if _canvas_mutation_kind(args):
                    return _run_canvas_mutation_with_sync_locked(
                        args,
                        project_id,
                        binding_path=binding_path,
                        state_path=state_path,
                    )
                return run_passthrough(["pixverse", *args])
        except CanvasSyncLockError as exc:
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_sync_lock_timeout",
                    "message": str(exc),
                    "project_id": explicit_project_id,
                    "state_path": str(state_path),
                    "mutation_executed": False,
                },
                json_output=_requests_json_output(args),
            )

    project_id = _canvas_project_id_from_args(args)
    if guarded_canvas_command and _canvas_mutation_kind(args):
        return _run_canvas_mutation_with_sync(
            args,
            project_id,
            bind_explicit_project=bool(explicit_project_id),
        )
    return run_passthrough(["pixverse", *original_args])


def _run_pixverse_auth_login(args: list[str]) -> int:
    """Keep OAuth polling in the CLI while making browser selection Agent-owned."""

    open_system = WEB_OPEN_SYSTEM_FLAG in args
    forwarded = [arg for arg in args if arg != WEB_OPEN_SYSTEM_FLAG]
    if open_system:
        forwarded = [arg for arg in forwarded if arg not in {"--json", "-p"}]
    elif not _requests_json_output(forwarded):
        # PixVerse CLI deliberately skips its system-browser opener in JSON mode and
        # emits the complete authorization URL to stderr before polling for a token.
        forwarded.append("--json")
    try:
        return run_passthrough(["pixverse", *forwarded])
    except KeyboardInterrupt:
        # A user may cancel the long-lived device-flow poll after inspecting the
        # authorization page. Exit like an interrupted CLI without leaking a Python
        # traceback into the Agent conversation.
        return 130


def _pixverse_static_web_action(args: list[str]) -> str:
    if args[:1] == ["subscribe"]:
        return "subscribe"
    if args[:2] == ["workspace", "manage"]:
        return "workspace-manage"
    return ""


def _emit_pixverse_web_handoff(action: str, args: list[str]) -> int:
    allowed = {"--json", "-p", WEB_OPEN_SYSTEM_FLAG}
    command_length = 1 if action == "subscribe" else 2
    unsupported = [arg for arg in args[command_length:] if arg not in allowed]
    if unsupported:
        print(
            json.dumps(
                {
                    "schema_version": WEB_BROWSER_HANDOFF_SCHEMA_VERSION,
                    "error": "web_handoff_option_unsupported",
                    "action": action,
                    "unsupported_options": unsupported,
                    "allowed_options": sorted(allowed),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    try:
        base_url = _pixverse_web_app_base_url()
    except ValueError as exc:
        print(
            json.dumps(
                {
                    "schema_version": WEB_BROWSER_HANDOFF_SCHEMA_VERSION,
                    "error": "pixverse_web_environment_invalid",
                    "message": str(exc),
                    "action": action,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    path = "/subscribe" if action == "subscribe" else "/team"
    url = f"{base_url}{path}"
    payload: dict[str, Any] = {
        "schema_version": WEB_BROWSER_HANDOFF_SCHEMA_VERSION,
        "success": True,
        "action": action,
        "url": url,
        "browser_handoff": _codex_browser_handoff(url),
        "authentication": _web_authentication_handoff(),
        "fallback": _web_direct_link_fallback(url),
    }
    if WEB_OPEN_SYSTEM_FLAG in args:
        payload["system_browser_opened"] = _open_web_url(url, label="PixVerse page")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def _pixverse_web_app_base_url() -> str:
    if pixverse_cli_channel() != INTERNAL_CLI_CHANNEL:
        return PIXVERSE_WEB_APP_BASE_URLS["production"]
    raw_environment = os.environ.get("PIXVERSE_ENV", "").strip().lower()
    if not raw_environment:
        return PIXVERSE_WEB_APP_BASE_URLS["production"]
    environment = PIXVERSE_ENV_ALIASES.get(raw_environment)
    if not environment:
        valid = ", ".join(sorted(PIXVERSE_ENV_ALIASES))
        raise ValueError(
            f'Invalid PIXVERSE_ENV="{raw_environment}". Valid values: {valid}'
        )
    return PIXVERSE_WEB_APP_BASE_URLS[environment]


def _normalize_pixverse_global_options(args: list[str]) -> list[str]:
    """Move reviewed Commander globals behind the command for policy matching.

    The original argv remains untouched for ordinary passthrough. Guarded Canvas paths
    consume this normalized form so an output flag cannot bypass policy checks even when
    Commander accepts it between subcommands. Values after ``--`` remain positional.
    Workspace overrides are recognized here but rejected separately before any Canvas IO.
    """

    command_args: list[str] = []
    deferred: list[str] = []
    index = 0
    while index < len(args):
        arg = args[index]
        if arg == "--":
            command_args.extend(args[index:])
            break
        if arg in {"--json", "-p"}:
            deferred.append(arg)
            index += 1
            continue
        if arg in {"--workspace-id", "--trace-id", "--region"}:
            deferred.append(arg)
            index += 1
            if index < len(args) and args[index] != "--":
                deferred.append(args[index])
                index += 1
            continue
        if (
            arg.startswith("--workspace-id=")
            or arg.startswith("--trace-id=")
            or arg.startswith("--region=")
        ):
            deferred.append(arg)
            index += 1
            continue
        command_args.append(arg)
        index += 1
    return [*command_args, *deferred]


def _is_explicit_pixverse_help_request(
    original_args: list[str],
    policy_args: list[str],
) -> bool:
    """Recognize help syntax without mistaking an option value for a help flag.

    Commander accepts values beginning with ``-`` for required options, so a
    raw membership test would treat ``--prompt --help`` or ``--name --help`` as
    documentation and bypass the wrapper's paid/mutation policy. Reviewed
    Canvas option arity lets us consume those values before looking for help.
    Paid create commands deliberately allow only their direct help form; any
    more complex argv fails closed into the queue guard.
    """

    if not policy_args:
        return any(arg in HELP_FLAGS for arg in original_args)
    if len(policy_args) >= 2 and policy_args[1] == "help":
        return True
    if policy_args[:1] == ["create"] and len(policy_args) >= 2:
        return _is_direct_paid_create_help(policy_args)
    if policy_args[:1] != ["canvas"]:
        return any(arg in HELP_FLAGS for arg in original_args)

    command = canvas_command_path(policy_args)
    if command:
        command_length = len(command.split()) - 1  # reviewed paths include the leading "pixverse"
        tail = policy_args[command_length:]
        value_options = {
            declaration.split(maxsplit=1)[0]
            for declaration in CANVAS_REVIEWED_COMMAND_CONTRACTS[command]["options"]
            if " " in declaration
        }
        value_options.update(
            {"--workspace-id", "--trace-id", CANVAS_PAID_CONFIRMATION_PLAN_FLAG}
        )
        index = 0
        while index < len(tail):
            arg = tail[index]
            if arg == "--":
                return False
            if arg in HELP_FLAGS:
                return True
            if arg in value_options:
                index += 2
                continue
            index += 1
        return False

    # Parent-level and future non-runnable Canvas help remains inspectable. No
    # reviewed mutation can reach this branch because it has a known path above.
    return bool(policy_args and policy_args[-1] in HELP_FLAGS)


def _is_direct_paid_create_help(args: list[str]) -> bool:
    if len(args) < 3 or args[:1] != ["create"] or args[1] not in PAID_CREATE_COMMANDS:
        return False
    return args[2] in HELP_FLAGS and all(
        arg in {*HELP_FLAGS, "--json", "-p"} for arg in args[2:]
    )


def _is_canvas_project_create(args: list[str]) -> bool:
    return args[:3] == ["canvas", "project", "create"]


def _is_canvas_project_scoped_command(args: list[str]) -> bool:
    return any(tuple(args[: len(prefix)]) == prefix for prefix in CANVAS_PROJECT_SCOPED_COMMANDS)


def _normalize_canvas_project_argument(args: list[str]) -> list[str]:
    """Resolve the 1.4.5 positional alias before binding and paid-plan checks."""
    path = canvas_command_path(args)
    contract = CANVAS_REVIEWED_COMMAND_CONTRACTS.get(path, {})
    options = contract.get("options", ())
    if "--project-id <id>" not in options:
        return args
    value_flags = {option.split()[0] for option in options if " <" in option}
    value_flags.update({CANVAS_PAID_CONFIRMATION_PLAN_FLAG, "--workspace-id", "--region", "--trace-id"})
    prefix_length = len(path.split()) - 1
    normalized = list(args[:prefix_length])
    positional = []
    index = prefix_length
    after_separator = False
    while index < len(args):
        token = args[index]
        if token == "--":
            after_separator = True
            index += 1
            continue
        if after_separator or not token.startswith("-"):
            positional.append(token)
            index += 1
            continue
        normalized.append(token)
        if token in value_flags and index + 1 < len(args):
            normalized.append(args[index + 1])
            index += 2
        else:
            index += 1
    if not positional:
        return args
    if len(positional) != 1 or not positional[0].strip() or positional[0].startswith("-"):
        raise ValueError("Supply one Canvas project ID as a positional argument or --project-id.")
    project_id = positional[0].strip()
    flag_id = _canvas_project_id_from_args(normalized)
    if _option_is_present(normalized, "--project-id") and flag_id != project_id:
        raise ValueError("The positional ID and --project-id must identify the same Canvas project.")
    if not flag_id:
        normalized.extend(["--project-id", project_id])
    return normalized


def _inject_canvas_project_binding(
    args: list[str],
    *,
    binding_path: Path,
) -> tuple[list[str], int | None]:
    """Resolve/create one binding while the caller holds the local Canvas lock."""

    try:
        project_id = load_canvas_project_id(path=binding_path)
        binding_status = canvas_project_binding_status(path=binding_path)
    except CanvasProjectBindingError as exc:
        print(
            "[pixverse-agent] The local Canvas binding is invalid and automatic creation was blocked: "
            f"{exc}. Repair or remove the binding only after identifying the intended cloud project.",
            file=sys.stderr,
            flush=True,
        )
        return args, 2
    if not project_id:
        if binding_status in {"creation_started", "creation_unresolved"}:
            print(
                "[pixverse-agent] A previous automatic Canvas project creation is still unresolved. "
                "Pass a known --project-id or run `pixverse canvas project create --json` explicitly "
                "to repair the local binding; no second project was created.",
                file=sys.stderr,
                flush=True,
            )
            return args, 1
        creation_attempt_id = uuid.uuid4().hex
        if not _remember_canvas_project_creation_started(
            creation_attempt_id,
            binding_path=binding_path,
        ):
            print(
                "[pixverse-agent] Automatic Canvas project creation was stopped before contacting "
                "PixVerse because its durable creation intent could not be saved.",
                file=sys.stderr,
                flush=True,
            )
            return args, 2
        create_result = run_captured(
            [
                "pixverse",
                "canvas",
                "project",
                "create",
                "--name",
                _default_canvas_project_name(binding_path=binding_path),
                "--json",
            ],
            timeout=CANVAS_MUTATION_TIMEOUT_SECONDS,
        )
        if not create_result.ok:
            _remember_canvas_project_creation_unresolved(binding_path=binding_path)
            _relay_command_result(create_result)
            return args, create_result.returncode
        if create_result.stderr:
            sys.stderr.write(create_result.stderr)
            sys.stderr.flush()
        project_id = _canvas_project_id_from_output(create_result.stdout, create_result.stderr)
        if not project_id:
            _remember_canvas_project_creation_unresolved(binding_path=binding_path)
            print(
                "[pixverse-agent] Canvas project was created, but its project_id could not be read; "
                "the requested command was not run to avoid creating duplicate projects.",
                file=sys.stderr,
                flush=True,
            )
            return args, 1
        if not _remember_canvas_project_id(project_id, binding_path=binding_path):
            print(
                "[pixverse-agent] Canvas project creation returned project_id "
                f"{project_id!r}, but the durable binding could not be saved. The requested command "
                "was not run; repair the local binding with this project id before continuing.",
                file=sys.stderr,
                flush=True,
            )
            return args, 2
    elif binding_status in {"creation_started", "creation_unresolved"}:
        print(
            "[pixverse-agent] A replacement Canvas project creation is unresolved; "
            f"continuing with the preserved project binding {project_id!r}. Recover the replacement "
            "project id before attempting another create.",
            file=sys.stderr,
            flush=True,
        )
    return [*args, "--project-id", project_id], None


def _canvas_project_id_from_args(args: list[str]) -> str:
    project_id = ""
    for index, arg in enumerate(args):
        if arg == "--project-id":
            if index + 1 < len(args) and not args[index + 1].startswith("-"):
                project_id = args[index + 1].strip()
        elif arg.startswith("--project-id="):
            project_id = arg.partition("=")[2].strip()
    return project_id


def _canvas_mutation_kind(args: list[str]) -> str:
    return canvas_mutation_policy(args)


def _run_canvas_mutation_with_sync(
    args: list[str],
    project_id: str,
    *,
    bind_explicit_project: bool = False,
    binding_path: Path | None = None,
) -> int:
    resolved_binding_path = binding_path or canvas_project_binding_path()
    state_path = canvas_sync_state_path(binding_path=resolved_binding_path)
    json_output = _requests_json_output(args)
    try:
        with canvas_sync_lock(state_path):
            if bind_explicit_project and not _bind_explicit_canvas_project_before_remote(
                project_id,
                binding_path=resolved_binding_path,
            ):
                return 2
            return _run_canvas_mutation_with_sync_locked(
                args,
                project_id,
                binding_path=resolved_binding_path,
                state_path=state_path,
            )
    except CanvasSyncLockError as exc:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_sync_lock_timeout",
                "message": str(exc),
                "project_id": project_id,
                "state_path": str(state_path),
                "mutation_executed": False,
            },
            json_output=json_output,
        )


def _canvas_guarded_pre_snapshot(
    *,
    project_id: str,
    state_path: Path,
    json_output: bool,
    confirmation_plan_id: str = "",
) -> tuple[int | None, CommandResult | None, dict[str, Any] | None]:
    """Read one graph and enforce the accepted Canvas checkpoint contract."""

    pre_result = _read_canvas_graph(project_id)
    if not pre_result.ok:
        _relay_command_result(pre_result)
        return pre_result.returncode, None, None
    try:
        pre_graph = parse_canvas_graph_output(pre_result.stdout)
        previous = load_canvas_sync_state(
            path=state_path,
            project_id=project_id,
            fail_on_invalid=True,
        )
    except CanvasGraphError as exc:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_graph_unreadable",
                    "message": str(exc),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            ),
            pre_result,
            None,
        )
    except CanvasSyncStateError as exc:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_sync_state_invalid",
                    "message": str(exc),
                    "project_id": project_id,
                    "state_path": str(state_path),
                    "mutation_executed": False,
                    "generation_started": False,
                    "next_steps": [
                        f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} "
                        "--reset-checkpoint --format markdown"
                    ],
                },
                json_output=json_output,
            ),
            pre_result,
            None,
        )
    if previous is None:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_sync_checkpoint_required",
                    "message": (
                        "No accepted Canvas checkpoint exists for this project. Synchronize and review the "
                        "current cloud graph before preparing or running a mutation."
                    ),
                    "project_id": project_id,
                    "state_path": str(state_path),
                    "mutation_executed": False,
                    "generation_started": False,
                    "next_steps": [
                        f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} --format markdown"
                    ],
                },
                json_output=json_output,
            ),
            pre_result,
            None,
        )
    try:
        pre_snapshot = snapshot_canvas_graph(
            pre_graph,
            include_layout=bool(previous.get("include_layout")),
        )
    except CanvasGraphError as exc:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_graph_unreadable",
                    "message": str(exc),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            ),
            pre_result,
            None,
        )
    external_changes = diff_canvas_snapshots(previous, pre_snapshot)
    # The display-oriented sync diff may see layout or reviewed Web-editor
    # representation changes that do not alter canonical production content.
    # Only the approval fingerprint may waive those changes for a bound plan.
    approval_content_unchanged = (
        bool(confirmation_plan_id)
        and not previous.get("include_layout")
        and _canvas_approval_content_valid(previous.get("approval_content"))
        and previous.get("approval_content") == pre_snapshot.get("approval_content")
    )
    if external_changes["semantic_changes_detected"] and not approval_content_unchanged:
        external_node_ids = sorted(changed_node_ids(external_changes))
        if confirmation_plan_id:
            return (
                _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": "canvas_confirmation_plan_stale",
                        "message": (
                            "Canvas content changed after paid preflight. Sync and review it, then create and "
                            "show a fresh confirmation plan before generation."
                        ),
                        "project_id": project_id,
                        "confirmation_plan_id": confirmation_plan_id,
                        "baseline_edit_version": previous.get("edit_version"),
                        "current_edit_version": pre_snapshot["edit_version"],
                        "changed_fields": ["edit_version", "graph"],
                        "changed_node_ids": external_node_ids,
                        "changes": external_changes,
                        "state_path": str(state_path),
                        "mutation_executed": False,
                        "generation_started": False,
                        "next_steps": [
                            f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} --format markdown",
                            f"{pvx_command()} canvas paid preflight --help",
                        ],
                    },
                    json_output=json_output,
                ),
                pre_result,
                None,
            )
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_external_changes_detected",
                    "message": (
                        "Canvas content changed since the last accepted checkpoint. Review and accept the "
                        "latest graph, then rebuild the operation from that graph."
                    ),
                    "project_id": project_id,
                    "baseline_edit_version": previous.get("edit_version"),
                    "current_edit_version": pre_snapshot["edit_version"],
                    "changed_node_ids": external_node_ids,
                    "changes": external_changes,
                    "state_path": str(state_path),
                    "mutation_executed": False,
                    "generation_started": False,
                    "next_steps": [
                        f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} --format markdown",
                        "Re-read the affected nodes and rebuild the operation.",
                    ],
                },
                json_output=json_output,
            ),
            pre_result,
            None,
        )
    return None, pre_result, pre_snapshot


def _run_canvas_mutation_with_sync_locked(
    args: list[str],
    project_id: str,
    *,
    binding_path: Path,
    state_path: Path,
) -> int:
    mutation_started = time.monotonic()
    mutation_timings: dict[str, Any] = {
        "started_at": utc_now(),
        "graph_pre_read_seconds": 0.0,
        "preflight_seconds": 0.0,
        "submission_seconds": 0.0,
        "graph_post_read_seconds": 0.0,
    }
    kind = _canvas_mutation_kind(args)
    allow_non_atomic = CANVAS_NON_ATOMIC_OPT_IN_FLAG in args
    paid_confirmed = CANVAS_PAID_CONFIRMATION_FLAG in args
    run_if_allowed = CANVAS_PAID_PREFERENCE_FLAG in args
    if paid_confirmed and run_if_allowed:
        return _emit_canvas_guard_error(
            {"error": "canvas_confirmation_flags_conflict",
             "message": "Use the exact preflight command; explicit approval and stored skip are distinct.",
             "mutation_executed": False, "generation_started": False},
            json_output=_requests_json_output(args),
        )
    paid_execution_requested = paid_confirmed or run_if_allowed
    confirmation_plan_id = _option_value(args, CANVAS_PAID_CONFIRMATION_PLAN_FLAG).strip()
    if _option_is_present(args, CANVAS_PAID_CONFIRMATION_PLAN_FLAG) and (
        not confirmation_plan_id or confirmation_plan_id.startswith("-")
    ):
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_id_invalid",
                "message": f"{CANVAS_PAID_CONFIRMATION_PLAN_FLAG} requires a non-option value.",
                "project_id": project_id,
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=_requests_json_output(args),
        )
    local_flag_stripped_args = [
        arg
        for arg in args
        if arg not in {CANVAS_NON_ATOMIC_OPT_IN_FLAG, CANVAS_PAID_CONFIRMATION_FLAG, CANVAS_PAID_PREFERENCE_FLAG}
    ]
    command_args = _replace_option_value(
        local_flag_stripped_args,
        CANVAS_PAID_CONFIRMATION_PLAN_FLAG,
        None,
    )
    json_output = _requests_json_output(command_args)
    if not json_output:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_mutation_json_required",
                "message": (
                    "Guarded Canvas mutations require --json (or -p) so the wrapper can verify the returned "
                    "edit_version before accepting the post-mutation checkpoint."
                ),
                "project_id": project_id,
                "mutation_executed": False,
            },
            json_output=False,
        )

    if kind == "non_atomic" and not allow_non_atomic:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_atomic_guard_unavailable",
                "message": (
                    "This internal CLI command has no edit-version precondition, so the wrapper will not "
                    "present checkpoint sync as atomic concurrency protection."
                ),
                "project_id": project_id,
                "mutation_executed": False,
                "opt_in_flag": CANVAS_NON_ATOMIC_OPT_IN_FLAG,
                "next_steps": [
                    f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} --format markdown",
                    (
                        "After reviewing the checkpoint, repeat the command with "
                        f"{CANVAS_NON_ATOMIC_OPT_IN_FLAG} to accept best-effort pre/post verification."
                    ),
                ],
            },
            json_output=json_output,
        )

    if (
        paid_execution_requested
        and confirmation_plan_id
        and canvas_command_path(command_args) in CANVAS_PAID_MUTATION_COMMANDS
    ):
        # A consumed plan must route to recovery even if the graph/account has
        # since changed. Do this before any pre-read can return "preflight again".
        ledger_path = canvas_paid_ledger_path(binding_path=binding_path)
        try:
            ledger_rows = _read_canvas_paid_records(ledger_path, label="Canvas paid-run ledger")
        except (OSError, ValueError) as exc:
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_confirmation_plan_state_unreadable",
                    "message": str(exc),
                    "confirmation_plan_id": confirmation_plan_id,
                    "ledger_path": str(ledger_path),
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            )
        replay_error = _canvas_paid_consumed_plan_guard(
            confirmation_plan_id, ledger_rows=ledger_rows, json_output=json_output
        )
        if replay_error is not None:
            return replay_error

    pre_read_started = time.monotonic()
    snapshot_result, pre_result, pre_snapshot = _canvas_guarded_pre_snapshot(
        project_id=project_id,
        state_path=state_path,
        json_output=json_output,
        confirmation_plan_id=confirmation_plan_id,
    )
    mutation_timings["graph_pre_read_seconds"] = round(
        time.monotonic() - pre_read_started,
        3,
    )
    if snapshot_result is not None or pre_result is None or pre_snapshot is None:
        return snapshot_result if snapshot_result is not None else 2

    input_text: str | None = None
    current_edit_version = pre_snapshot["edit_version"]
    if kind == "patch":
        try:
            patch_payload, input_text = _canvas_patch_payload(command_args)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_patch_unreadable",
                    "message": str(exc),
                    "project_id": project_id,
                    "mutation_executed": False,
                },
                json_output=json_output,
            )
        supplied_edit_version = _canvas_patch_base_edit_version(patch_payload)
        if supplied_edit_version is None:
            return _emit_canvas_version_error(
                project_id=project_id,
                current_edit_version=current_edit_version,
                supplied_edit_version=None,
                source="graph_patch.base_edit_version",
                json_output=json_output,
            )
        if supplied_edit_version != current_edit_version:
            return _emit_canvas_version_error(
                project_id=project_id,
                current_edit_version=current_edit_version,
                supplied_edit_version=supplied_edit_version,
                source="graph_patch.base_edit_version",
                json_output=json_output,
            )
        try:
            pre_graph = parse_canvas_graph_output(pre_result.stdout)
            video_changes, video_issues = _canvas_normalize_video_patch_nodes(
                patch_payload,
                graph=pre_graph,
            )
            if video_issues:
                return _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": "canvas_video_contract_invalid",
                        "message": (
                            "Canvas patch submission was stopped because a video_generate payload uses "
                            "ambiguous or conflicting fields that the wrapper cannot normalize safely."
                        ),
                        "project_id": project_id,
                        "mutation_executed": False,
                        "generation_started": False,
                        "target_issues": video_issues,
                    },
                        json_output=json_output,
                    )
            compose_changes, compose_issues = _canvas_normalize_compose_patch_nodes(
                patch_payload,
            )
            if compose_issues:
                return _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": "canvas_compose_contract_invalid",
                        "message": (
                            "Canvas patch submission was stopped because a video_compose dependency "
                            "declaration cannot be normalized safely."
                        ),
                        "project_id": project_id,
                        "mutation_executed": False,
                        "generation_started": False,
                        "target_issues": compose_issues,
                    },
                    json_output=json_output,
                )
            placements = _canvas_autoposition_patch_nodes(patch_payload, graph=pre_graph)
        except CanvasGraphError as exc:
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_graph_unreadable",
                    "message": str(exc),
                    "project_id": project_id,
                    "mutation_executed": False,
                },
                json_output=json_output,
            )
        if video_changes or compose_changes or placements:
            command_args, input_text = _canvas_patch_submission_input(
                command_args,
                patch_payload,
            )
        if video_changes:
            rendered = "; ".join(
                f"{item['node_id']}: {', '.join(item['changes'])}"
                for item in video_changes
            )
            print(
                "[pixverse-agent canvas-video] Normalized reviewed video fields for submission only: "
                + rendered,
                file=sys.stderr,
                flush=True,
            )
        if compose_changes:
            rendered = "; ".join(
                f"{item['node_id']}: {', '.join(item['changes'])}"
                for item in compose_changes
            )
            print(
                "[pixverse-agent canvas-compose] Normalized capability-declared source dependencies "
                "for submission only: " + rendered,
                file=sys.stderr,
                flush=True,
            )
        if placements:
            rendered = "; ".join(
                f"{item['node_id']} at ({item['position']['x']}, {item['position']['y']}) "
                f"near {','.join(item['anchor_node_ids']) or 'the current viewport'}"
                for item in placements
            )
            print(
                "[pixverse-agent canvas-layout] Added missing positions for new nodes: " + rendered,
                file=sys.stderr,
                flush=True,
            )
    elif kind == "edit_version":
        supplied_edit_version = _integer_option(command_args, "--edit-version")
        bound_paid_mutation = (
            paid_execution_requested
            and bool(confirmation_plan_id)
            and canvas_command_path(command_args) in CANVAS_PAID_MUTATION_COMMANDS
        )
        if supplied_edit_version != current_edit_version and not bound_paid_mutation:
            return _emit_canvas_version_error(
                project_id=project_id,
                current_edit_version=current_edit_version,
                supplied_edit_version=supplied_edit_version,
                source="--edit-version",
                json_output=json_output,
            )

    preflight_started = time.monotonic()
    paid_preflight_result, paid_context = _canvas_paid_mutation_preflight(
        command_args,
        project_id=project_id,
        confirmed=paid_confirmed,
        run_if_allowed=run_if_allowed,
        json_output=json_output,
        pre_snapshot=pre_snapshot,
        binding_path=binding_path,
        confirmation_plan_id=confirmation_plan_id,
    )
    mutation_timings["preflight_seconds"] = round(time.monotonic() - preflight_started, 3)
    if paid_preflight_result is not None:
        return paid_preflight_result
    command_args = [arg for arg in command_args if arg != BASIC_FALLBACK_FLAG]

    if paid_context is not None:
        # Validate the caller's exact approved args first. Only the wrapper may
        # rebase their CAS version, after immutable content/account validation.
        command_args = _replace_option_value(
            command_args, "--edit-version", str(current_edit_version)
        )
        paid_context["timings"] = mutation_timings
        try:
            _append_canvas_paid_event(
                paid_context,
                "submission_started",
                checkpoint_edit_version=current_edit_version,
                mutation_executed=False,
                generation_started=False,
            )
        except OSError as exc:
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_paid_ledger_write_failed",
                    "message": (
                        "Canvas paid generation was stopped before submission because its durable audit "
                        f"record could not be written: {exc}"
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "ledger_path": str(paid_context["ledger_path"]),
                },
                json_output=json_output,
            )

    try:
        write_canvas_sync_state(pre_snapshot, path=state_path)
    except OSError as exc:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_sync_state_write_failed",
                "message": str(exc),
                "project_id": project_id,
                "state_path": str(state_path),
                "mutation_executed": False,
            },
            json_output=json_output,
        )

    if pre_result.stderr:
        sys.stderr.write(pre_result.stderr)
        sys.stderr.flush()
    if paid_context is not None and paid_context["edit_version_rebased"]:
        print(
            "[pixverse-agent canvas-paid] Approved content unchanged; retaining approval and using "
            f"current edit version {current_edit_version} (approved at {paid_context['approved_edit_version']}).",
            file=sys.stderr,
            flush=True,
        )
    if kind == "non_atomic":
        print(
            "[pixverse-agent canvas-sync] Non-atomic Canvas mutation explicitly allowed; "
            "using one pre-read and one post-read only.",
            file=sys.stderr,
            flush=True,
        )

    submission_args = command_args
    if paid_context is not None:
        submission_args = _replace_option_value(
            command_args,
            "--run-id",
            str(paid_context["cli_run_id"]),
        )
    submission_started = time.monotonic()
    mutation_result = run_captured(
        ["pixverse", *submission_args],
        input_text=input_text,
        timeout=CANVAS_MUTATION_TIMEOUT_SECONDS,
    )
    mutation_timings["submission_seconds"] = round(time.monotonic() - submission_started, 3)
    _relay_command_result(mutation_result)
    paid_submission: dict[str, Any] | None = None
    if paid_context is not None:
        paid_submission = _record_canvas_paid_submission(paid_context, mutation_result)
    if not mutation_result.ok:
        if paid_context is not None and classify_error(mutation_result) == "membership_required":
            print(json.dumps({"error": "membership_required", **_membership_recovery()}, ensure_ascii=False), file=sys.stderr)
        if paid_context is not None:
            _finalize_canvas_paid_run(
                paid_context,
                mutation_result=mutation_result,
                post_snapshot=None,
                verification_status=(
                    "submission_partial"
                    if paid_submission and paid_submission.get("generation_state") == "started"
                    else "submission_unknown"
                    if paid_submission and paid_submission.get("generation_state") == "unknown"
                    else "submission_rejected"
                    if paid_submission and paid_submission.get("rejection_class") == "deterministic_validation"
                    else "submission_failed"
                ),
            )
        return mutation_result.returncode

    post_read_started = time.monotonic()
    post_result = _read_canvas_graph(project_id)
    mutation_timings["graph_post_read_seconds"] = round(
        time.monotonic() - post_read_started,
        3,
    )
    if not post_result.ok:
        _canvas_post_read_warning(
            project_id,
            "The mutation returned success, but the one-time graph readback failed. Do not retry the mutation; "
            f"run `{pvx_command()} canvas sync --project-id {project_id}` to verify it.",
        )
        if paid_context is not None:
            _finalize_canvas_paid_run(
                paid_context,
                mutation_result=mutation_result,
                post_snapshot=None,
                verification_status="verification_unknown",
            )
        return mutation_result.returncode
    post_verification_status = "post_read_verified"
    try:
        post_graph = parse_canvas_graph_output(post_result.stdout)
        post_snapshot = snapshot_canvas_graph(
            post_graph,
            include_layout=bool(pre_snapshot.get("include_layout")),
        )
        applied_changes = diff_canvas_snapshots(pre_snapshot, post_snapshot)
        mutation_edit_version = _canvas_edit_version_from_output(mutation_result.stdout)
        if mutation_edit_version is None:
            _canvas_post_read_warning(
                project_id,
                "The successful mutation did not return a readable edit_version, so the immediate graph "
                "read was not accepted. Do not retry the mutation; run "
                f"`{pvx_command()} canvas sync --project-id {project_id}` and review the diff.",
            )
            if paid_context is not None:
                _finalize_canvas_paid_run(
                    paid_context,
                    mutation_result=mutation_result,
                    post_snapshot=post_snapshot,
                    verification_status="verification_unknown",
                )
            return mutation_result.returncode
        if post_snapshot["edit_version"] != mutation_edit_version:
            semantic_verification: dict[str, Any] | None = None
            if (
                kind == "patch"
                and post_snapshot["edit_version"] > mutation_edit_version
                and not bool(pre_snapshot.get("include_layout"))
            ):
                semantic_verification = verify_canvas_patch_semantics(
                    patch_payload,
                    previous=pre_snapshot,
                    current=post_snapshot,
                )
            if semantic_verification and semantic_verification.get("verified"):
                post_verification_status = "post_read_verified_latest_checkpoint"
                print(
                    "[pixverse-agent canvas-sync] The post-read advanced beyond the patch receipt, but the "
                    "normalized graph contains the complete patch and no unrelated semantic changes; accepting "
                    f"latest edit_version {post_snapshot['edit_version']}.",
                    file=sys.stderr,
                    flush=True,
                )
            else:
                verification_details = ""
                if semantic_verification:
                    verification_details = " Semantic verification: " + "; ".join(
                        str(item) for item in semantic_verification.get("issues", [])[:5]
                    )
                _canvas_post_read_warning(
                    project_id,
                    "The mutation returned edit_version "
                    f"{mutation_edit_version}, but the immediate graph read returned "
                    f"{post_snapshot['edit_version']}. A concurrent or subsequent graph change may be present, "
                    "so the post-read was not accepted. Do not retry the mutation; run "
                    f"`{pvx_command()} canvas sync --project-id {project_id}` and review the diff."
                    f"{verification_details}",
                )
                if paid_context is not None:
                    _finalize_canvas_paid_run(
                        paid_context,
                        mutation_result=mutation_result,
                        post_snapshot=post_snapshot,
                        verification_status="verification_unknown",
                    )
                return mutation_result.returncode
        write_canvas_sync_state(post_snapshot, path=state_path)
    except (CanvasGraphError, OSError) as exc:
        _canvas_post_read_warning(
            project_id,
            "The mutation returned success, but its graph readback could not be recorded. Do not retry the "
            f"mutation; run `{pvx_command()} canvas sync --project-id {project_id}` to verify it. ({exc})",
        )
        if paid_context is not None:
            _finalize_canvas_paid_run(
                paid_context,
                mutation_result=mutation_result,
                post_snapshot=None,
                verification_status="verification_unknown",
            )
        return mutation_result.returncode

    mutation_timings["finished_at"] = utc_now()
    mutation_timings["elapsed_seconds"] = round(time.monotonic() - mutation_started, 3)
    mutation_timings["components"] = {
        "pixverse_api": {
            "graph_pre_read_seconds": mutation_timings["graph_pre_read_seconds"],
            "preflight_seconds": mutation_timings["preflight_seconds"],
            "submission_seconds": mutation_timings["submission_seconds"],
            "graph_post_read_seconds": mutation_timings["graph_post_read_seconds"],
        },
        "cli": {"total_seconds": mutation_timings["elapsed_seconds"]},
        "host_required": ["agent_planning", "iab_handoff"],
    }

    if paid_context is not None:
        mutation_timings["elapsed_before_credit_observation_seconds"] = round(
            time.monotonic() - mutation_started,
            3,
        )
        _finalize_canvas_paid_run(
            paid_context,
            mutation_result=mutation_result,
            post_snapshot=post_snapshot,
            verification_status=post_verification_status,
        )

    if post_result.stderr:
        sys.stderr.write(post_result.stderr)
        sys.stderr.flush()
    print(
        "[pixverse-agent canvas-sync] Post-read verified: "
        f"edit_version {current_edit_version} -> {post_snapshot['edit_version']}; "
        f"semantic changes {applied_changes['change_count']}. Snapshot accepted at {state_path}.",
        file=sys.stderr,
        flush=True,
    )
    return mutation_result.returncode


def _read_canvas_graph(
    project_id: str,
    *,
    timeout: int | float = CANVAS_READ_TIMEOUT_SECONDS,
) -> CommandResult:
    return run_captured(
        [
            "pixverse",
            "canvas",
            "graph",
            "get",
            "--project-id",
            str(project_id).strip(),
            "--json",
        ],
        timeout=timeout,
    )


def _read_canvas_graph_status(
    project_id: str,
    node_ids: list[str],
    *,
    timeout: int | float = CANVAS_READ_TIMEOUT_SECONDS,
) -> CommandResult:
    args = [
        "pixverse",
        "canvas",
        "graph",
        "status",
        "--project-id",
        str(project_id).strip(),
    ]
    if node_ids:
        args.extend(["--node-ids", ",".join(node_ids)])
    args.append("--json")
    return run_captured(args, timeout=timeout)


def _parse_canvas_graph_status_output(output: str) -> dict[str, dict[str, Any]]:
    payload = json.loads(output)

    def find(value: Any) -> dict[str, Any] | None:
        if not isinstance(value, dict):
            return None
        if isinstance(value.get("nodes"), list):
            return value
        for key in ("data", "result", "graph"):
            nested = find(value.get(key))
            if nested is not None:
                return nested
        return None

    status = find(payload)
    if status is None:
        raise ValueError("Canvas graph status output does not contain a nodes list")
    result: dict[str, dict[str, Any]] = {}
    for node in status.get("nodes", []):
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("node_id") or "").strip()
        if not node_id:
            continue
        derived_state = str(node.get("derived_state") or _canvas_node_status(node)).strip()
        result[node_id] = {
            "node_id": node_id,
            "derived_state": derived_state or "unknown",
            "content_type": node.get("content_type") or "",
            "action_type": node.get("action_type") or "",
            "task_status": node.get("task_status"),
            "task_ids": sorted(_canvas_task_ids(node)),
            "history_id": node.get("history_id") or "",
            "run_id": node.get("run_id") or "",
            "depends_on": node.get("depends_on") if isinstance(node.get("depends_on"), list) else [],
            "error_code": node.get("error_code") or "",
            "error_message": node.get("error_message") or "",
            "failure_class": node.get("failure_class") or "",
            "retryable": node.get("retryable") if isinstance(node.get("retryable"), bool) else None,
        }
    return result


def _canvas_patch_payload(args: list[str]) -> tuple[dict[str, Any], str | None]:
    patch_input = _option_value(args, "--patch")
    if not patch_input:
        raise ValueError("Canvas patch apply requires --patch with graph_patch.base_edit_version")
    input_text: str | None = None
    if patch_input == "-":
        input_text = sys.stdin.read()
        rendered = input_text
    else:
        candidate = Path(patch_input).expanduser()
        try:
            is_file = candidate.is_file()
        except OSError:
            is_file = False
        if is_file:
            rendered = candidate.read_text(encoding="utf-8")
        else:
            rendered = patch_input
    payload = json.loads(rendered)
    if not isinstance(payload, dict):
        raise ValueError("Canvas patch input must be a JSON object")
    graph_patch = payload.get("graph_patch")
    if isinstance(graph_patch, dict):
        payload = graph_patch
    return payload, input_text


def _canvas_patch_submission_input(
    args: list[str],
    payload: dict[str, Any],
) -> tuple[list[str], str | None]:
    """Return the exact patch input after wrapper-owned compatibility defaults are applied."""

    rendered = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if _option_value(args, "--patch") == "-":
        return args, rendered
    return _replace_option_value(args, "--patch", rendered), None


def _canvas_nodes_by_id(graph: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw_nodes = graph.get("nodes")
    values = list(raw_nodes.values()) if isinstance(raw_nodes, dict) else raw_nodes
    if not isinstance(values, (list, tuple)):
        return {}
    nodes: dict[str, dict[str, Any]] = {}
    for item in values:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("node_id") or item.get("id") or "").strip()
        if node_id:
            nodes[node_id] = item
    return nodes


def _canvas_node_type_name(node: dict[str, Any]) -> str:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    info = node.get("info") if isinstance(node.get("info"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    return str(
        node.get("node_type")
        or info.get("node_type")
        or extra.get("node_type")
        or ""
    ).strip().lower()


def _canvas_node_media_type(node: dict[str, Any]) -> str:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    content_type = str(
        node.get("content_type")
        or data.get("content_type")
        or extra.get("content_type")
        or ""
    ).strip().lower()
    markers = f"{content_type} {_canvas_node_type_name(node)}"
    if "image" in markers:
        return "image"
    if "video" in markers:
        return "video"
    if "audio" in markers or "music" in markers or "speech" in markers:
        return "audio"
    return content_type


def _canvas_node_params(node: dict[str, Any]) -> dict[str, Any]:
    payload = node.get("payload")
    if isinstance(payload, dict):
        return payload
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    params = data.get("params")
    return params if isinstance(params, dict) else {}


def _canvas_provider_path(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    rendered = value.strip()
    lowered = rendered.lower()
    if (
        lowered.startswith(("http://", "https://", "file://"))
        or os.path.isabs(rendered)
        or re.match(r"^[a-zA-Z]:[\\/]", rendered)
    ):
        return ""
    return rendered


def _canvas_node_provider_path(node: dict[str, Any]) -> str:
    """Return a provider-backed media path without falling back to a public URL."""

    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    artifact = extra.get("artifact") if isinstance(extra.get("artifact"), dict) else {}
    result = node.get("result") if isinstance(node.get("result"), dict) else {}
    candidates = (
        node.get("file_path"),
        data.get("file_path"),
        extra.get("file_path"),
        artifact.get("file_path"),
        result.get("file_path"),
        result.get("media_path"),
    )
    for value in candidates:
        rendered = _canvas_provider_path(value)
        if rendered:
            return rendered
    return ""


def _canvas_declared_dependency_ids(
    node_id: str,
    node: dict[str, Any],
    *,
    graph: dict[str, Any],
) -> list[str]:
    dependencies: list[str] = []

    def add(value: Any) -> None:
        if isinstance(value, (str, int)) and not isinstance(value, bool):
            rendered = str(value).strip()
            if rendered and rendered != node_id and rendered not in dependencies:
                dependencies.append(rendered)

    top_level = node.get("depends_on")
    if isinstance(top_level, (list, tuple)):
        for value in top_level:
            add(value)
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    nested = extra.get("depends_on")
    if isinstance(nested, (list, tuple)):
        for value in nested:
            add(value)

    raw_connections = graph.get("connections", graph.get("edges", []))
    connections = (
        list(raw_connections.values())
        if isinstance(raw_connections, dict)
        else raw_connections
    )
    if isinstance(connections, (list, tuple)):
        for connection in connections:
            if not isinstance(connection, dict):
                continue
            source = _canvas_connection_endpoint(
                connection.get("source") or connection.get("source_node_id")
            )
            target = _canvas_connection_endpoint(
                connection.get("target") or connection.get("target_node_id")
            )
            if target == node_id:
                add(source)
    return dependencies


def _canvas_reference_paths_from_dependencies(
    node_id: str,
    node: dict[str, Any],
    *,
    graph: dict[str, Any],
    extra_nodes: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    nodes = _canvas_nodes_by_id(graph)
    if extra_nodes:
        for extra_node_id, extra_node in extra_nodes.items():
            nodes.setdefault(extra_node_id, extra_node)
    image_paths: list[str] = []
    video_paths: list[str] = []
    audio_paths: list[str] = []
    image_node_ids: list[str] = []
    video_node_ids: list[str] = []
    audio_node_ids: list[str] = []
    unresolved: list[dict[str, str]] = []
    dependency_ids = _canvas_declared_dependency_ids(node_id, node, graph=graph)
    for dependency_id in dependency_ids:
        source = nodes.get(dependency_id)
        if not isinstance(source, dict):
            unresolved.append(
                {
                    "node_id": dependency_id,
                    "media_type": "unknown",
                    "reason": "dependency_missing",
                }
            )
            continue
        media_type = _canvas_node_media_type(source)
        if media_type not in {"image", "video", "audio"}:
            continue
        provider_path = _canvas_node_provider_path(source)
        if not provider_path:
            unresolved.append(
                {
                    "node_id": dependency_id,
                    "media_type": media_type,
                    "reason": "provider_path_unavailable",
                }
            )
            continue
        target = {
            "image": image_paths,
            "video": video_paths,
            "audio": audio_paths,
        }[media_type]
        if provider_path not in target:
            target.append(provider_path)
        source_ids = {
            "image": image_node_ids,
            "video": video_node_ids,
            "audio": audio_node_ids,
        }[media_type]
        if dependency_id not in source_ids:
            source_ids.append(dependency_id)
    return {
        "dependency_node_ids": dependency_ids,
        "resolved_image_source_node_ids": image_node_ids,
        "resolved_video_source_node_ids": video_node_ids,
        "resolved_audio_source_node_ids": audio_node_ids,
        "customer_img_paths": image_paths,
        "customer_video_paths": video_paths,
        "customer_audio_paths": audio_paths,
        "unresolved_dependencies": unresolved,
    }


def _canvas_nonempty_string_list(value: Any) -> list[str] | None:
    if value is None:
        return []
    if not isinstance(value, (list, tuple)):
        return None
    rendered: list[str] = []
    for item in value:
        normalized = _canvas_provider_path(item)
        if not normalized:
            return None
        if normalized not in rendered:
            rendered.append(normalized)
    return rendered


def _canvas_value_present(value: Any) -> bool:
    return value is not None and value != ""


def _canvas_merge_unique_strings(existing: list[str], additions: list[str]) -> list[str]:
    merged = list(existing)
    for item in additions:
        if item not in merged:
            merged.append(item)
    return merged


def _canvas_reference_paths_sha256(paths: list[str]) -> str:
    if not paths:
        return ""
    encoded = json.dumps(
        paths,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _canvas_normalize_video_patch_nodes(
    patch: dict[str, Any],
    *,
    graph: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Normalize legacy Canvas video aliases to the runtime adapter v2 contract."""

    raw_nodes = patch.get("nodes")
    if not isinstance(raw_nodes, list):
        return [], []
    patch_nodes = {
        str(item.get("node_id") or "").strip(): item
        for item in raw_nodes
        if isinstance(item, dict) and str(item.get("node_id") or "").strip()
    }
    existing_nodes = _canvas_nodes_by_id(graph)
    changes: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    for node_id, node in patch_nodes.items():
        if _canvas_node_type_name(node) != "video_generate":
            continue
        payload = node.get("payload")
        if payload is None:
            continue
        if not isinstance(payload, dict):
            issues.append(
                {
                    "node_id": node_id,
                    "field": "payload",
                    "code": "canvas_video_payload_invalid",
                    "message": "video_generate payload must be an object.",
                }
            )
            continue
        node_changes: list[str] = []
        if "resolution" in payload:
            resolution = payload.get("resolution")
            quality = payload.get("quality")
            if _canvas_value_present(resolution) and not isinstance(resolution, str):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.resolution",
                        "code": "canvas_video_quality_invalid",
                        "message": "resolution must be a string before it can be normalized to quality.",
                    }
                )
                continue
            if _canvas_value_present(quality) and not isinstance(quality, str):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.quality",
                        "code": "canvas_video_quality_invalid",
                        "message": "quality must be a non-empty string.",
                    }
                )
                continue
            if (
                _canvas_value_present(quality)
                and _canvas_value_present(resolution)
                and quality != resolution
            ):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.quality",
                        "code": "canvas_video_quality_conflict",
                        "message": (
                            "video_generate payload contains conflicting quality and resolution values; "
                            "keep only canonical quality."
                        ),
                        "quality": quality,
                        "resolution": resolution,
                    }
                )
            else:
                if not _canvas_value_present(quality) and _canvas_value_present(resolution):
                    payload["quality"] = resolution
                    node_changes.append("resolution→quality")
                payload.pop("resolution", None)
                if "resolution→quality" not in node_changes:
                    node_changes.append("removed resolution alias")

        gen_type_value = payload.get("gen_type")
        if gen_type_value is not None and not isinstance(gen_type_value, str):
            issues.append(
                {
                    "node_id": node_id,
                    "field": "payload.gen_type",
                    "code": "canvas_video_gen_type_invalid",
                    "message": "gen_type must be a non-empty string.",
                }
            )
            continue
        raw_gen_type = str(gen_type_value or "").strip().lower()
        if not raw_gen_type and node_id not in existing_nodes:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "payload.gen_type",
                    "code": "canvas_video_gen_type_required",
                    "message": (
                        "A new video_generate node must declare gen_type; the wrapper will not guess "
                        "text_to_video, image_to_video, or reference_to_video."
                    ),
                }
            )
            continue
        canonical_gen_type = CANVAS_VIDEO_GEN_TYPE_ALIASES.get(raw_gen_type, raw_gen_type)
        if canonical_gen_type != raw_gen_type:
            payload["gen_type"] = canonical_gen_type
            node_changes.append(f"gen_type {raw_gen_type}→{canonical_gen_type}")

        if "audio" in payload:
            audio = payload.get("audio")
            # Adapter v2 maps this field into Create's boolean flag but does not
            # declare the persisted Canvas source type. Dispatch is verified
            # against the graph-native numeric switch, so keep 1/0 here.
            if isinstance(audio, bool):
                normalized_audio = 1 if audio else 0
                payload["audio"] = normalized_audio
                node_changes.append(f"audio {str(audio).lower()}→{normalized_audio}")
            elif not isinstance(audio, int) or audio not in {0, 1}:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.audio",
                        "code": "canvas_video_audio_invalid",
                        "message": "Canvas video audio must be the numeric switch 0 or 1.",
                    }
                )
                continue

        if canonical_gen_type in CANVAS_VIDEO_REFERENCE_GEN_TYPES:
            image_paths = _canvas_nonempty_string_list(payload.get("customer_img_paths"))
            video_paths = _canvas_nonempty_string_list(payload.get("customer_video_paths"))
            audio_paths = _canvas_nonempty_string_list(payload.get("customer_audio_paths"))
            if image_paths is None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_img_paths",
                        "code": "canvas_video_reference_paths_invalid",
                        "message": "customer_img_paths must be a list of non-empty provider paths.",
                    }
                )
                image_paths = []
            if video_paths is None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_video_paths",
                        "code": "canvas_video_reference_paths_invalid",
                        "message": "customer_video_paths must be a list of non-empty provider paths.",
                    }
                )
                video_paths = []
            if audio_paths is None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_audio_paths",
                        "code": "canvas_video_reference_paths_invalid",
                        "message": "customer_audio_paths must be a list of non-empty provider paths.",
                    }
                )
                audio_paths = []
            singular_image = payload.get("customer_img_path")
            normalized_singular_image = _canvas_provider_path(singular_image)
            if normalized_singular_image:
                image_paths = _canvas_merge_unique_strings(image_paths, [normalized_singular_image])
                payload.pop("customer_img_path", None)
                node_changes.append("customer_img_path→customer_img_paths")
            elif singular_image is not None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_img_path",
                        "code": "canvas_video_reference_path_invalid",
                        "message": "customer_img_path must be a non-empty provider path.",
                    }
                )
            singular_video = payload.get("customer_video_path")
            normalized_singular_video = _canvas_provider_path(singular_video)
            if normalized_singular_video:
                video_paths = _canvas_merge_unique_strings(video_paths, [normalized_singular_video])
                payload.pop("customer_video_path", None)
                node_changes.append("customer_video_path→customer_video_paths")
            elif singular_video is not None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_video_path",
                        "code": "canvas_video_reference_path_invalid",
                        "message": "customer_video_path must be a non-empty provider path.",
                    }
                )
            singular_audio = payload.get("customer_audio_path")
            normalized_singular_audio = _canvas_provider_path(singular_audio)
            if normalized_singular_audio:
                audio_paths = _canvas_merge_unique_strings(audio_paths, [normalized_singular_audio])
                payload.pop("customer_audio_path", None)
                node_changes.append("customer_audio_path→customer_audio_paths")
            elif singular_audio is not None:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_audio_path",
                        "code": "canvas_video_reference_path_invalid",
                        "message": "customer_audio_path must be a non-empty provider path.",
                    }
                )
            resolved = _canvas_reference_paths_from_dependencies(
                node_id,
                node,
                graph=graph,
                extra_nodes=patch_nodes,
            )
            merged_images = _canvas_merge_unique_strings(
                image_paths, resolved["customer_img_paths"]
            )
            merged_videos = _canvas_merge_unique_strings(
                video_paths, resolved["customer_video_paths"]
            )
            merged_audios = _canvas_merge_unique_strings(
                audio_paths, resolved["customer_audio_paths"]
            )
            if merged_images != image_paths:
                node_changes.append("materialized image dependencies")
            if merged_videos != video_paths:
                node_changes.append("materialized video dependencies")
            if merged_audios != audio_paths:
                node_changes.append("materialized audio dependencies")
            payload["customer_img_paths"] = merged_images
            payload["customer_video_paths"] = merged_videos
            payload["customer_audio_paths"] = merged_audios
        elif canonical_gen_type == "image_to_video":
            image = payload.get("customer_img_path")
            legacy_image = payload.get("image")
            normalized_image = _canvas_provider_path(image)
            normalized_legacy_image = _canvas_provider_path(legacy_image)
            if image is not None and not normalized_image:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_img_path",
                        "code": "canvas_video_image_invalid",
                        "message": "image_to_video customer_img_path must be a non-empty provider path.",
                    }
                )
            elif legacy_image is not None and not normalized_legacy_image:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.image",
                        "code": "canvas_video_image_invalid",
                        "message": "Legacy image must be a non-empty provider path before normalization.",
                    }
                )
            elif normalized_image and normalized_legacy_image and normalized_image != normalized_legacy_image:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "payload.customer_img_path",
                        "code": "canvas_video_image_conflict",
                        "message": "customer_img_path conflicts with the legacy image alias.",
                    }
                )
            elif normalized_legacy_image:
                payload["customer_img_path"] = normalized_legacy_image
                payload.pop("image", None)
                normalized_image = normalized_legacy_image
                node_changes.append("image→customer_img_path")
            elif not normalized_image:
                resolved = _canvas_reference_paths_from_dependencies(
                    node_id,
                    node,
                    graph=graph,
                    extra_nodes=patch_nodes,
                )
                candidate_images = resolved["customer_img_paths"]
                if len(candidate_images) == 1:
                    payload["customer_img_path"] = candidate_images[0]
                    node_changes.append("materialized image dependency")
                elif len(candidate_images) > 1:
                    issues.append(
                        {
                            "node_id": node_id,
                            "field": "payload.customer_img_path",
                            "code": "canvas_video_image_ambiguous",
                            "message": (
                                "image_to_video has multiple image dependencies; set the intended "
                                "provider path explicitly in customer_img_path."
                            ),
                            "candidate_images": candidate_images,
                        }
                    )
        if node_changes:
            changes.append({"node_id": node_id, "changes": node_changes})
    return changes, issues


def _canvas_compose_material_sources(node: dict[str, Any]) -> dict[str, list[str]]:
    payload = _canvas_node_params(node)
    tracks = payload.get("tracks") if isinstance(payload, dict) else None
    sources = {"image": [], "video": [], "audio": []}
    if not isinstance(tracks, list):
        return sources
    for track in tracks:
        segments = track.get("segments") if isinstance(track, dict) else None
        track_type = str(track.get("type") or "").strip().lower() if isinstance(track, dict) else ""
        if not isinstance(segments, list):
            continue
        for segment in segments:
            material = segment.get("material") if isinstance(segment, dict) else None
            node_id = material.get("node_id") if isinstance(material, dict) else None
            if isinstance(node_id, (str, int)) and not isinstance(node_id, bool):
                rendered = str(node_id).strip()
                media_type = str(material.get("type") or track_type).strip().lower()
                if rendered and media_type in sources and rendered not in sources[media_type]:
                    sources[media_type].append(rendered)
    return sources


def _canvas_compose_material_node_ids(node: dict[str, Any]) -> list[str]:
    sources = _canvas_compose_material_sources(node)
    ordered: list[str] = []
    for media_type in ("image", "video", "audio"):
        ordered = _canvas_merge_unique_strings(ordered, sources[media_type])
    return ordered


def _canvas_normalize_compose_patch_nodes(
    patch: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Materialize adapter-v2 composition sources in top-level depends_on."""

    raw_nodes = patch.get("nodes")
    if not isinstance(raw_nodes, list):
        return [], []
    changes: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    for node in raw_nodes:
        if not isinstance(node, dict) or _canvas_node_type_name(node) != "video_compose":
            continue
        node_id = str(node.get("node_id") or "").strip()
        material_node_ids = _canvas_compose_material_node_ids(node)
        depends_on = node.get("depends_on")
        if depends_on is None:
            declared: list[str] = []
        elif isinstance(depends_on, list):
            declared = []
            for dependency in depends_on:
                if not isinstance(dependency, (str, int)) or isinstance(dependency, bool) or not str(dependency).strip():
                    issues.append(
                        {
                            "node_id": node_id,
                            "field": "depends_on",
                            "code": "canvas_compose_depends_on_invalid",
                            "message": "video_compose depends_on must contain non-empty Canvas node IDs.",
                        }
                    )
                    declared = []
                    break
                rendered = str(dependency).strip()
                if rendered not in declared:
                    declared.append(rendered)
        else:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "depends_on",
                    "code": "canvas_compose_depends_on_invalid",
                    "message": "video_compose depends_on must be an array of Canvas node IDs.",
                }
            )
            continue
        if any(issue.get("node_id") == node_id for issue in issues):
            continue
        normalized = _canvas_merge_unique_strings(declared, material_node_ids)
        if normalized != declared or depends_on is None:
            node["depends_on"] = normalized
            changes.append(
                {
                    "node_id": node_id,
                    "changes": ["materialized composition dependencies"],
                    "material_node_ids": material_node_ids,
                }
            )
    return changes, issues


def _canvas_autoposition_patch_nodes(
    patch: dict[str, Any],
    *,
    graph: dict[str, Any],
) -> list[dict[str, Any]]:
    """Place new, unpositioned nodes in readable production-stage columns.

    Canvas does not find free space for Agent-created nodes. The wrapper keeps
    explicit coordinates untouched, but its missing-position fallback groups a
    dependency stage into one vertical lane instead of stretching every edge
    into another horizontal step. Unknown node types retain the local-neighbor
    fallback.
    """

    patch_nodes = patch.get("nodes")
    if not isinstance(patch_nodes, list):
        return []
    raw_nodes = graph.get("nodes")
    graph_nodes = list(raw_nodes.values()) if isinstance(raw_nodes, dict) else raw_nodes
    if not isinstance(graph_nodes, (list, tuple)):
        graph_nodes = []

    existing: dict[str, dict[str, Any]] = {}
    all_nodes: dict[str, dict[str, Any]] = {}
    occupied: list[tuple[float, float, float, float]] = []
    for item in graph_nodes:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("node_id") or item.get("id") or "").strip()
        if node_id:
            existing[node_id] = item
            all_nodes[node_id] = item
        rect = _canvas_node_rect(item)
        if rect is not None:
            occupied.append(rect)

    patch_new_nodes: list[dict[str, Any]] = []
    for item in patch_nodes:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("node_id") or "").strip()
        if not node_id or node_id in existing:
            continue
        patch_new_nodes.append(item)
        all_nodes[node_id] = item
        rect = _canvas_node_rect(item)
        if rect is not None:
            occupied.append(rect)

    dependencies = _canvas_layout_dependencies(all_nodes, graph=graph)
    stage_ranks = _canvas_layout_stage_ranks(all_nodes, dependencies=dependencies)
    stage_x_values: dict[int, list[float]] = {}
    for node_id, item in all_nodes.items():
        rect = _canvas_node_rect(item)
        stage_rank = stage_ranks.get(node_id)
        if rect is None or stage_rank is None or _canvas_layout_category(item) is None:
            continue
        stage_x_values.setdefault(stage_rank, []).append(rect[0])

    placements: list[dict[str, Any]] = []
    stage_groups: dict[int, list[dict[str, Any]]] = {}
    fallback_nodes: list[dict[str, Any]] = []
    for item in patch_new_nodes:
        if "position" in item:
            continue
        node_id = str(item.get("node_id") or "").strip()
        stage_rank = stage_ranks.get(node_id)
        if stage_rank is None or _canvas_layout_category(item) is None:
            fallback_nodes.append(item)
        else:
            stage_groups.setdefault(stage_rank, []).append(item)

    viewport = graph.get("viewport") if isinstance(graph.get("viewport"), dict) else {}
    viewport_x = _canvas_finite_number(viewport.get("x")) or 0.0
    viewport_y = _canvas_finite_number(viewport.get("y")) or 0.0

    for stage_rank in sorted(stage_groups):
        group = stage_groups[stage_rank]
        group_node_ids = [str(item.get("node_id") or "").strip() for item in group]
        group_anchor_ids: list[str] = []
        for node_id in group_node_ids:
            for anchor_id in dependencies.get(node_id, []):
                if anchor_id not in group_anchor_ids:
                    group_anchor_ids.append(anchor_id)
        anchor_rects = [
            rect
            for anchor_id in group_anchor_ids
            if (anchor := all_nodes.get(anchor_id)) is not None
            and (rect := _canvas_node_rect(anchor)) is not None
        ]

        if stage_x_values.get(stage_rank):
            lane_x = _canvas_align_to_grid(_canvas_median(stage_x_values[stage_rank]), 20.0)
            anchor_source = "existing_stage_column"
        elif anchor_rects:
            anchor = _canvas_bounding_rect(anchor_rects)
            lane_x = _canvas_align_to_grid(anchor[0] + anchor[2] + 60.0, 20.0)
            anchor_source = "related_stage"
        else:
            earlier_rects = [
                rect
                for other_id, other in all_nodes.items()
                if stage_ranks.get(other_id, stage_rank) < stage_rank
                and (rect := _canvas_node_rect(other)) is not None
            ]
            if earlier_rects:
                earlier = _canvas_bounding_rect(earlier_rects)
                lane_x = _canvas_align_to_grid(earlier[0] + earlier[2] + 60.0, 20.0)
                anchor_source = "previous_stage"
            else:
                lane_x = _canvas_align_to_grid(viewport_x, 20.0)
                anchor_source = "viewport"

        sizes = [_canvas_node_size(item) for item in group]
        if anchor_rects:
            anchor = _canvas_bounding_rect(anchor_rects)
            center_y = anchor[1] + anchor[3] / 2
        else:
            center_y = viewport_y + sum(height for _, height in sizes) / 2
        positions = _canvas_stage_column_positions(
            lane_x,
            center_y=center_y,
            sizes=sizes,
            occupied=occupied,
        )
        for item, node_id, position, (width, height) in zip(
            group, group_node_ids, positions, sizes
        ):
            item["position"] = position
            occupied.append((float(position["x"]), float(position["y"]), width, height))
            stage_x_values.setdefault(stage_rank, []).append(float(position["x"]))
            placements.append(
                {
                    "node_id": node_id,
                    "position": dict(position),
                    "anchor_node_ids": list(dependencies.get(node_id, [])),
                    "anchor_source": anchor_source,
                    "strategy": "production_stage_column",
                    "stage_rank": stage_rank,
                    "stage_category": _canvas_layout_category(item),
                }
            )

    for item in fallback_nodes:
        node_id = str(item.get("node_id") or "").strip()
        width, height = _canvas_node_size(item)
        anchor_node_ids = [
            anchor_id
            for anchor_id in dependencies.get(node_id, [])
            if (anchor := all_nodes.get(anchor_id)) is not None
            and _canvas_node_rect(anchor) is not None
        ]
        anchor_rects = [
            rect
            for anchor_id in anchor_node_ids
            if (anchor := all_nodes.get(anchor_id)) is not None
            and (rect := _canvas_node_rect(anchor)) is not None
        ]
        if anchor_rects:
            anchor = _canvas_bounding_rect(anchor_rects)
            anchor_source = "related_nodes"
        else:
            anchor = (viewport_x, viewport_y, 0.0, 0.0)
            anchor_source = "viewport"
        position = _canvas_nearby_free_position(
            anchor,
            width=width,
            height=height,
            occupied=occupied,
        )
        item["position"] = position
        occupied.append((float(position["x"]), float(position["y"]), width, height))
        placements.append(
            {
                "node_id": node_id,
                "position": dict(position),
                "anchor_node_ids": anchor_node_ids,
                "anchor_source": anchor_source,
                "strategy": "related_nodes_nearby_non_overlapping",
            }
        )
    return placements


def _canvas_patch_anchor_node_ids(node: dict[str, Any]) -> list[str]:
    anchors: list[str] = []

    def add(value: Any) -> None:
        if isinstance(value, (str, int)) and not isinstance(value, bool):
            rendered = str(value).strip()
            if rendered and rendered not in anchors:
                anchors.append(rendered)

    depends_on = node.get("depends_on")
    if isinstance(depends_on, (list, tuple)):
        for value in depends_on:
            add(value)

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for key, nested in value.items():
                normalized_key = re.sub(r"[^a-z0-9]", "", str(key).lower())
                if normalized_key in {"nodeid", "sourcenodeid", "referencenodeid"}:
                    add(nested)
                elif isinstance(nested, (dict, list, tuple)):
                    visit(nested)
        elif isinstance(value, (list, tuple)):
            for nested in value:
                visit(nested)

    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    nested_depends_on = extra.get("depends_on")
    if isinstance(nested_depends_on, (list, tuple)):
        for value in nested_depends_on:
            add(value)

    # Runtime patch references, including video_compose material.node_id, live
    # in payload. Provider-normalized graph references may instead live under
    # data.params or data.extra. Do not scan the node's own top-level node_id.
    visit(node.get("payload"))
    visit(data.get("params"))
    visit(extra)
    return anchors


def _canvas_layout_dependencies(
    nodes: dict[str, dict[str, Any]],
    *,
    graph: dict[str, Any],
) -> dict[str, list[str]]:
    dependencies = {
        node_id: [anchor_id for anchor_id in _canvas_patch_anchor_node_ids(node) if anchor_id != node_id]
        for node_id, node in nodes.items()
    }
    raw_connections = graph.get("connections")
    connections = list(raw_connections.values()) if isinstance(raw_connections, dict) else raw_connections
    if not isinstance(connections, (list, tuple)):
        return dependencies
    for connection in connections:
        if not isinstance(connection, dict):
            continue
        source = _canvas_connection_endpoint(connection.get("source")) or _canvas_connection_endpoint(
            connection.get("source_node_id")
        )
        target = _canvas_connection_endpoint(connection.get("target")) or _canvas_connection_endpoint(
            connection.get("target_node_id")
        )
        if not source or not target or target not in dependencies or source == target:
            continue
        if source not in dependencies[target]:
            dependencies[target].append(source)
    return dependencies


def _canvas_connection_endpoint(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("node_id") or value.get("id")
    if isinstance(value, (str, int)) and not isinstance(value, bool):
        return str(value).strip()
    return ""


def _canvas_layout_stage_ranks(
    nodes: dict[str, dict[str, Any]],
    *,
    dependencies: dict[str, list[str]],
) -> dict[str, int]:
    resolved: dict[str, int] = {}
    visiting: set[str] = set()

    def resolve(node_id: str) -> int:
        if node_id in resolved:
            return resolved[node_id]
        node = nodes[node_id]
        base_rank = 0 if _canvas_layout_category(node) == "text" else 1
        if node_id in visiting:
            return base_rank
        visiting.add(node_id)
        known_dependencies = [value for value in dependencies.get(node_id, []) if value in nodes]
        rank = max((resolve(value) + 1 for value in known_dependencies), default=base_rank)
        visiting.remove(node_id)
        resolved[node_id] = rank
        return rank

    for node_id in nodes:
        resolve(node_id)
    return resolved


def _canvas_layout_category(node: dict[str, Any]) -> str | None:
    info = node.get("info") if isinstance(node.get("info"), dict) else {}
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    payload = node.get("payload") if isinstance(node.get("payload"), dict) else {}
    params = data.get("params") if isinstance(data.get("params"), dict) else {}
    markers = " ".join(
        str(value or "").lower()
        for value in (
            node.get("node_type"),
            info.get("node_type"),
            extra.get("node_type"),
            data.get("content_type"),
            extra.get("content_type"),
            payload.get("gen_type"),
            params.get("gen_type"),
        )
    )
    if any(token in markers for token in ("compose", "compress", "edit", "mix", "merge")):
        return "finish"
    if "video" in markers:
        return "video"
    if "image" in markers:
        return "image"
    if "audio" in markers or "music" in markers or "speech" in markers:
        return "audio"
    if any(token in markers for token in ("script", "text", "prompt", "screenplay")):
        return "text"
    if any(token in markers for token in ("upload", "asset", "reference", "source")):
        return "source"
    return None


def _canvas_median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def _canvas_stage_column_positions(
    lane_x: float,
    *,
    center_y: float,
    sizes: list[tuple[float, float]],
    occupied: list[tuple[float, float, float, float]],
    gap: float = 60.0,
    grid: float = 20.0,
) -> list[dict[str, int]]:
    total_height = sum(height for _, height in sizes) + gap * max(0, len(sizes) - 1)
    start_y = center_y - total_height / 2
    desired_y: list[float] = []
    cursor = start_y
    for _, height in sizes:
        desired_y.append(cursor)
        cursor += height + gap

    step = max((height for _, height in sizes), default=240.0) + gap
    fan = [0, 1, -1, 2, -2, 3, -3, 4, -4]
    offset = 0
    while True:
        fan_offset = fan[offset] if offset < len(fan) else offset - len(fan) + 5
        shifted = fan_offset * step
        positions = [
            {
                "x": _canvas_align_to_grid(lane_x, grid),
                "y": _canvas_align_to_grid(y + shifted, grid),
            }
            for y in desired_y
        ]
        candidates = [
            (float(position["x"]), float(position["y"]), width, height)
            for position, (width, height) in zip(positions, sizes)
        ]
        if not any(
            _canvas_rects_too_close(candidate, other, minimum_gap=40.0)
            for candidate in candidates
            for other in occupied
        ):
            return positions
        offset += 1


def _canvas_node_rect(node: dict[str, Any]) -> tuple[float, float, float, float] | None:
    position = node.get("position") if isinstance(node.get("position"), dict) else None
    if position is None:
        return None
    x = _canvas_finite_number(position.get("x"))
    y = _canvas_finite_number(position.get("y"))
    if x is None or y is None:
        return None
    width, height = _canvas_node_size(node)
    return x, y, width, height


def _canvas_node_size(node: dict[str, Any]) -> tuple[float, float]:
    style = node.get("style") if isinstance(node.get("style"), dict) else {}
    width = _canvas_positive_number(style.get("width")) or _canvas_positive_number(node.get("width"))
    height = _canvas_positive_number(style.get("height")) or _canvas_positive_number(node.get("height"))
    info = node.get("info") if isinstance(node.get("info"), dict) else {}
    extra = node.get("extra") if isinstance(node.get("extra"), dict) else {}
    node_type = str(node.get("node_type") or info.get("node_type") or extra.get("node_type") or "").lower()
    if "compose" in node_type:
        return width or 360.0, height or 240.0
    if "video" in node_type or "image" in node_type:
        return width or 360.0, height or 240.0
    return width or 320.0, height or 180.0


def _canvas_finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        rendered = float(value)
    except (TypeError, ValueError):
        return None
    return rendered if math.isfinite(rendered) else None


def _canvas_positive_number(value: Any) -> float | None:
    rendered = _canvas_finite_number(value)
    return rendered if rendered is not None and rendered > 0 else None


def _canvas_bounding_rect(
    rects: list[tuple[float, float, float, float]],
) -> tuple[float, float, float, float]:
    left = min(rect[0] for rect in rects)
    top = min(rect[1] for rect in rects)
    right = max(rect[0] + rect[2] for rect in rects)
    bottom = max(rect[1] + rect[3] for rect in rects)
    return left, top, right - left, bottom - top


def _canvas_nearby_free_position(
    anchor: tuple[float, float, float, float],
    *,
    width: float,
    height: float,
    occupied: list[tuple[float, float, float, float]],
    gap: float = 60.0,
    grid: float = 20.0,
) -> dict[str, int]:
    anchor_x, anchor_y, anchor_width, anchor_height = anchor
    center_x = anchor_x + anchor_width / 2
    center_y = anchor_y + anchor_height / 2
    fan = [0, 1, -1, 2, -2, 3, -3, 4, -4]
    candidates: list[tuple[float, float]] = []
    for offset in fan:
        candidates.append((anchor_x + anchor_width + gap, center_y - height / 2 + offset * (height + gap)))
    for offset in fan:
        candidates.append((center_x - width / 2 + offset * (width + gap), anchor_y + anchor_height + gap))
    for offset in fan:
        candidates.append((center_x - width / 2 + offset * (width + gap), anchor_y - height - gap))
    for offset in fan:
        candidates.append((anchor_x - width - gap, center_y - height / 2 + offset * (height + gap)))
    for ring in range(1, 9):
        candidates.append(
            (anchor_x + anchor_width + gap + ring * (width + gap), center_y - height / 2)
        )

    for candidate_x, candidate_y in candidates:
        x = _canvas_align_to_grid(candidate_x, grid)
        y = _canvas_align_to_grid(candidate_y, grid)
        candidate = (float(x), float(y), width, height)
        if not any(_canvas_rects_too_close(candidate, other, minimum_gap=40.0) for other in occupied):
            return {"x": x, "y": y}

    # Keep scanning the same local right-side column until it clears every
    # finite occupied rectangle. This path is rare but remains deterministic.
    x = _canvas_align_to_grid(anchor_x + anchor_width + gap, grid)
    offset = len(fan)
    while True:
        y = _canvas_align_to_grid(center_y - height / 2 + offset * (height + gap), grid)
        candidate = (float(x), float(y), width, height)
        if not any(
            _canvas_rects_too_close(candidate, other, minimum_gap=40.0)
            for other in occupied
        ):
            return {"x": x, "y": y}
        offset += 1


def _canvas_align_to_grid(value: float, grid: float) -> int:
    return int(round(value / grid) * grid)


def _canvas_rects_too_close(
    left: tuple[float, float, float, float],
    right: tuple[float, float, float, float],
    *,
    minimum_gap: float,
) -> bool:
    left_x, left_y, left_width, left_height = left
    right_x, right_y, right_width, right_height = right
    return not (
        left_x + left_width + minimum_gap <= right_x
        or right_x + right_width + minimum_gap <= left_x
        or left_y + left_height + minimum_gap <= right_y
        or right_y + right_height + minimum_gap <= left_y
    )


def _canvas_patch_base_edit_version(payload: dict[str, Any]) -> int | None:
    value = payload.get("base_edit_version")
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _canvas_edit_version_from_output(output: str) -> int | None:
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return None

    def find(value: Any) -> int | None:
        if not isinstance(value, dict):
            return None
        edit_version = value.get("edit_version")
        if not isinstance(edit_version, bool):
            try:
                return int(edit_version)
            except (TypeError, ValueError):
                pass
        for key in ("data", "result"):
            nested = find(value.get(key))
            if nested is not None:
                return nested
        return None

    return find(payload)


def _canvas_paid_mutation_preflight(
    args: list[str],
    *,
    project_id: str,
    confirmed: bool,
    json_output: bool,
    pre_snapshot: dict[str, Any],
    binding_path: Path,
    confirmation_plan_id: str = "",
    run_if_allowed: bool = False,
) -> tuple[int | None, dict[str, Any] | None]:
    if canvas_command_path(args) not in CANVAS_PAID_MUTATION_COMMANDS:
        return None, None
    if (confirmed or run_if_allowed) and not confirmation_plan_id:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_confirmation_plan_required",
                    "message": (
                        "Confirmed Canvas paid generation requires a one-time plan from the read-only "
                        f"`{pvx_command()} canvas paid preflight` command."
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "next_steps": [f"{pvx_command()} canvas paid preflight --help"],
                },
                json_output=json_output,
            ),
            None,
        )
    if confirmation_plan_id and not (confirmed or run_if_allowed):
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_confirmation_plan_requires_confirmed",
                    "message": (
                        f"{CANVAS_PAID_CONFIRMATION_PLAN_FLAG} is valid only on the paid mutation "
                        "using the exact approval or stored-preference command returned by preflight."
                    ),
                    "project_id": project_id,
                    "confirmation_plan_id": confirmation_plan_id,
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            ),
            None,
        )
    result, preflight = _canvas_paid_preflight_snapshot(
        args,
        project_id=project_id,
        json_output=json_output,
        pre_snapshot=pre_snapshot,
        binding_path=binding_path,
    )
    if result is not None or preflight is None:
        return result, None
    if confirmed or run_if_allowed:
        if run_if_allowed and preflight["confirmation_required"]:
            return _emit_canvas_guard_error(
                {"error": "canvas_confirmation_preference_required",
                 "message": "The current configuration requires approval. Run a fresh read-only preflight; do not replace execution flags.",
                 "confirmation_plan_id": confirmation_plan_id,
                 "confirmation_policy": preflight["confirmation_policy"],
                 "mutation_executed": False, "generation_started": False},
                json_output=json_output,
            ), None
        # A flag is not an authorization source by itself. The immutable plan
        # must have been issued for this same explicit-approval/preference path.
        if confirmed:
            preflight["authorization_basis"] = "explicit_user"
        validation_result = _validate_canvas_paid_confirmation_plan(
            confirmation_plan_id,
            args=args,
            preflight=preflight,
            pre_snapshot=pre_snapshot,
            binding_path=binding_path,
            json_output=json_output,
        )
        if validation_result is not None:
            return validation_result, None
        cli_run_id = str((uuid.uuid4().int % (10**18)) or 1)
        context = {
            **preflight,
            "run_id": uuid.uuid4().hex,
            "cli_run_id": cli_run_id,
            "ledger_path": str(canvas_paid_ledger_path(binding_path=binding_path)),
        }
        context["confirmation_plan_id"] = confirmation_plan_id
        context["confirmation_mode"] = (
            "single_user_approval_with_bound_plan" if confirmed
            else "automatic_policy_with_bound_plan" if preflight["authorization_basis"] == "automatic_policy"
            else "stored_preference_with_bound_plan"
        )
        context["approved_edit_version"] = _integer_option(args, "--edit-version")
        context["submission_edit_version"] = pre_snapshot["edit_version"]
        context["edit_version_rebased"] = (
            context["approved_edit_version"] != context["submission_edit_version"]
        )
        context["approval_content"] = pre_snapshot["approval_content"]
        return None, context
    preflight["confirmation_mode"] = "legacy_mutation_preflight_with_bound_plan"
    try:
        confirmation_plan = _create_canvas_paid_confirmation_plan(
            args,
            preflight=preflight,
            pre_snapshot=pre_snapshot,
            binding_path=binding_path,
        )
    except (OSError, ValueError) as exc:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_confirmation_plan_write_failed",
                    "message": (
                        "Paid generation was not started because its immutable confirmation plan "
                        f"could not be saved: {exc}"
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "plan_path": str(
                        canvas_paid_confirmation_plans_path(binding_path=binding_path)
                    ),
                },
                json_output=json_output,
            ),
            None,
        )
    return (
        _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_paid_confirmation_required",
                "message": (
                    "Legacy compatibility preflight completed inside a paid mutation command. New Canvas "
                    f"flows must use `{pvx_command()} canvas paid preflight` before asking for approval. "
                    "Show the planned node/task count, model route, and balance state, then execute the "
                    "returned one-time bound-plan command according to its confirmation_required field."
                ),
                "project_id": project_id,
                "mutation_executed": False,
                "generation_started": False,
                "confirmation_required": preflight["confirmation_required"],
                "preflight": preflight,
                "confirmation_plan_id": confirmation_plan["confirmation_plan_id"],
                "confirmation_command": confirmation_plan["confirmation_command"],
                "legacy_compatibility_path": True,
            },
            json_output=json_output,
        ),
        None,
    )


def _canvas_paid_preflight_snapshot(
    args: list[str],
    *,
    project_id: str,
    json_output: bool,
    pre_snapshot: dict[str, Any],
    binding_path: Path | None = None,
) -> tuple[int | None, dict[str, Any] | None]:
    preflight_started = time.monotonic()
    command_path = canvas_command_path(args)
    if command_path not in CANVAS_PAID_MUTATION_COMMANDS:
        return None, None

    setup_issue = setup_blocker("Canvas paid generation")
    if setup_issue:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "setup_required",
                    "message": "Canvas paid generation was stopped because the managed CLI setup is not ready.",
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "setup": setup_issue,
                },
                json_output=json_output,
                returncode=SETUP_GATE_EXIT,
            ),
            None,
        )

    node_ids = _canvas_generation_node_ids(args)
    capabilities_result, capabilities, capabilities_error = _read_canvas_runtime_capabilities()
    if capabilities is None:
        detail = (
            capabilities_error
            if capabilities_error and capabilities_error != "command_failed"
            else (capabilities_result.stderr or capabilities_result.stdout).strip()
        )
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_capability_contract_unavailable",
                    "message": (
                        "Canvas paid generation was stopped because the merged runtime capability "
                        "contract could not be read. No account lookup or mutation was attempted."
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "capabilities_returncode": capabilities_result.returncode,
                    "capabilities_error": detail[:1000],
                },
                json_output=json_output,
            ),
            None,
        )
    capability_compatibility = _canvas_capability_handshake(capabilities)
    if not capability_compatibility["accepted"]:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_capability_contract_incompatible",
                    "message": (
                        "Canvas paid generation was stopped because runtime capability discovery "
                        "reported an incompatible Graph/Create adapter contract."
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "capability_compatibility": capability_compatibility,
                },
                json_output=json_output,
            ),
            None,
        )
    capability_contracts = _canvas_capability_contracts(capabilities)
    targets, target_issues = _canvas_generation_targets(
        pre_snapshot,
        node_ids,
        capability_contracts=capability_contracts,
    )
    if target_issues:
        unreadable = any(
            issue.get("code") in {"canvas_paid_target_missing", "canvas_paid_targets_empty"}
            for issue in target_issues
        )
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": (
                        "canvas_paid_targets_unreadable"
                        if unreadable
                        else "canvas_paid_target_contract_invalid"
                    ),
                    "message": (
                        "Canvas paid generation was stopped because every target node must be present in the "
                        "accepted graph before its model and entitlement route can be checked."
                        if unreadable
                        else (
                            "Canvas paid generation was stopped before account lookup or submission because "
                            "a target generation node does not satisfy the reviewed Canvas request contract. "
                            "Apply the returned repair fields, sync the graph, and run a fresh read-only preflight."
                        )
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "target_issues": target_issues,
                },
                json_output=json_output,
            ),
            None,
        )
    active_targets = [
        target for target in targets if target.get("render_intent") == "resume_existing"
    ]
    unresolved_runs: list[dict[str, Any]] = []
    if not active_targets and any(
        target.get("render_intent") == "first_render" for target in targets
    ):
        try:
            unresolved_runs = _canvas_unresolved_paid_runs(
                binding_path=binding_path or canvas_project_binding_path(),
                project_id=project_id,
                node_ids=node_ids,
            )
        except (OSError, ValueError) as exc:
            return (
                _emit_canvas_guard_error(
                    {
                        "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                        "error": "canvas_confirmation_plan_state_unreadable",
                        "message": str(exc),
                        "project_id": project_id,
                        "mutation_executed": False,
                        "generation_started": False,
                    },
                    json_output=json_output,
                ),
                None,
            )
    if active_targets or unresolved_runs:
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_generation_already_in_progress",
                    "message": (
                        "Canvas paid generation was not preflighted because at least one selected node already "
                        "has an active or dependency-blocked render. Follow or reconcile the existing run instead "
                        "of creating another paid submission."
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "targets": active_targets,
                    "existing_runs": unresolved_runs,
                    "next_steps": [
                        f"{pvx_command()} canvas paid follow --run-id <existing-run-id> --format markdown",
                        f"{pvx_command()} canvas paid reconcile --run-id <existing-run-id> --deadline-seconds 300 --format markdown",
                    ],
                },
                json_output=json_output,
            ),
            None,
        )

    snapshot = billing_snapshot(
        usage_limit=0,
        include_slots=False,
        include_model_catalogs=False,
    )
    raw_account = snapshot.get("account") if isinstance(snapshot.get("account"), dict) else {}
    account = dict(raw_account)
    detected_membership = str(account.get("membership_tier") or "unknown")
    membership_override = membership_routing_mode(
        account_fingerprint=str(account.get("account_fingerprint") or "")
    )
    if membership_override == MEMBERSHIP_ROUTING_UNRESTRICTED_TEST:
        account["detected_membership_tier"] = detected_membership
        account["membership_tier"] = "premium"
        account["membership_override"] = membership_override
    entitlement_issues = _canvas_entitlement_issues(
        targets,
        membership=str(account.get("membership_tier") or "unknown"),
    )
    fallback_accepted = BASIC_FALLBACK_FLAG in args
    membership_choice_required = account.get("membership_tier") == "basic" and not fallback_accepted
    credits_total = account.get("credits_total")
    balance_state = (
        "has_credits"
        if isinstance(credits_total, int) and credits_total > 0
        else "empty"
        if isinstance(credits_total, int)
        else "unknown"
    )
    caller_cli_run_id = _option_value(args, "--run-id").strip()
    preflight = {
        "schema_version": CANVAS_PAID_PREFLIGHT_SCHEMA_VERSION,
        "snapshot_at": snapshot.get("checked_at") or utc_now(),
        "project_id": project_id,
        "region": effective_pixverse_region(),
        "edit_version": pre_snapshot.get("edit_version"),
        "operation": command_path,
        "node_ids": node_ids,
        "planned_generation_tasks": len(node_ids) or 1,
        "targets": targets,
        "capability_contracts_source": "capabilities canvas",
        "capabilities_trace_id": capabilities.get("trace_id") or "",
        "capability_compatibility": capability_compatibility,
        "account": account,
        "balance_state": balance_state,
        "detected_membership_tier": detected_membership,
        "membership_tier": str(account.get("membership_tier") or "unknown"),
        "membership_override": membership_override,
        "cli_run_id_policy": "wrapper_generated_unique_per_submission",
        "caller_cli_run_id_replaced": bool(caller_cli_run_id),
        "basic_fallback_accepted": fallback_accepted,
        "membership_choice_required": membership_choice_required,
        "entitlement_state": "incompatible" if entitlement_issues else "compatible",
        "entitlement_issues": entitlement_issues,
        "exact_price_available_before_generation": False,
        "snapshot_issues": snapshot.get("issues", []),
        "confirmation_mode": "bound_plan_required",
        "preflight_wall_seconds": round(time.monotonic() - preflight_started, 3),
    }
    access_blocker = insufficient_balance_blocker(
        {"account": account, "entitlement_issues": entitlement_issues,
         "membership_choice_required": membership_choice_required}
    )
    if not access_blocker and (
        not str(account.get("account_fingerprint") or "").strip()
        or account.get("workspace_id") in {None, ""}
    ):
        access_blocker = "billing_context_unknown"
    if not access_blocker and str(account.get("membership_tier") or "unknown") == "unknown":
        access_blocker = "membership_unknown"
    if access_blocker:
        next_steps = [
            f"{pvx_command()} pixverse auth status --json",
            f"{pvx_command()} pixverse account info --json",
            f"{pvx_command()} doctor",
        ]
        if access_blocker == "membership_route_required":
            next_steps.insert(0, "Show the subscription link and wait for upgrade or explicit fallback; only then prepare v6 540p / Nano Banana 2 Lite 1080p nodes and preflight with --accept-basic-fallback.")
        return (
            _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": access_blocker,
                    **(_membership_recovery() if access_blocker in {"membership_route_required", "insufficient_balance"} else {}),
                    "message": (
                        "Canvas generation was stopped before submission because PixVerse account, membership, "
                        "model route, or balance readiness could not be confirmed."
                    ),
                    "project_id": project_id,
                    "mutation_executed": False,
                    "generation_started": False,
                    "preflight": preflight,
                    "next_steps": next_steps,
                },
                json_output=json_output,
                returncode=4,
            ),
            None,
        )
    policy = _canvas_confirmation_policy(
        binding_path=binding_path or canvas_project_binding_path(), project_id=project_id,
    )
    preflight["confirmation_policy"] = policy
    preflight["confirmation_required"] = policy["requires_confirmation"]
    preflight["authorization_basis"] = (
        "explicit_user" if policy["requires_confirmation"]
        else "automatic_policy" if policy["scope"] == "default" else "stored_preference"
    )
    preflight["confirmation_mode"] = (
        "single_user_approval_with_bound_plan" if policy["requires_confirmation"]
        else "automatic_policy_with_bound_plan" if policy["scope"] == "default"
        else "stored_preference_with_bound_plan"
    )
    return None, preflight


def _canvas_confirmation_policy(*, binding_path: Path, project_id: str) -> dict[str, Any]:
    """Read policy for the resolved binding; receipts remain scoped recovery evidence."""
    binding_path = binding_path.resolve()
    project_path = binding_path.parent
    projects_root = (repo_root() / "projects").resolve()
    issues: list[str] = []
    has_prior_generation = False
    try:
        if project_path.parent != projects_root or load_canvas_project_id(path=binding_path) != project_id:
            project_path = None
        if project_path is not None:
            rows = _read_canvas_paid_records(
                canvas_paid_ledger_path(binding_path=binding_path), label="Canvas paid-run ledger",
            )
            submitted_runs = {
                row.get("run_id") for row in rows
                if row.get("project_id") == project_id
                and row.get("event") == "canvas.paid.submission_started"
                and isinstance(row.get("confirmation_plan_id"), str) and row["confirmation_plan_id"]
                and isinstance(row.get("run_id"), str) and row["run_id"]
            }
            has_prior_generation = any(
                row.get("project_id") == project_id
                and isinstance(row.get("run_id"), str)
                and row.get("run_id") in submitted_runs
                and row.get("event") == "canvas.paid.submission_result"
                and row.get("generation_state") == "started"
                for row in rows
            )
    except (OSError, ValueError, CanvasProjectBindingError) as exc:
        issues.append(str(exc))
    policy = canvas_quote_confirmation_state(
        project_path=project_path, has_prior_generation=has_prior_generation,
    )
    if issues:
        policy.update(effective_mode="require", requires_confirmation=True)
        policy["issues"].extend(issues)
    policy["binding_path"] = str(binding_path)
    return policy


def _canvas_paid_confirmation_binding(
    preflight: dict[str, Any],
    *,
    args: list[str],
    pre_snapshot: dict[str, Any],
) -> dict[str, Any]:
    account = preflight.get("account") if isinstance(preflight.get("account"), dict) else {}
    # Keep the immutable binding shape compatible with existing v2 plans.
    # Operation/render labels are derived from the already-bound full graph and
    # are presentation/recovery metadata, not new approval inputs.
    route_fields = ("node_id", "kind", "content_type", "node_type", "model")
    targets = [
        {key: target.get(key) for key in route_fields}
        for target in preflight.get("targets", [])
        if isinstance(target, dict)
    ]
    return {
        "schema_version": "pixverse.canvas_paid_confirmation_binding.v2",
        "project_id": preflight.get("project_id"),
        "region": preflight.get("region"),
        "operation": preflight.get("operation"),
        "edit_version": pre_snapshot.get("edit_version"),
        "approval_content": pre_snapshot.get("approval_content"),
        "checkpoint_include_layout": bool(pre_snapshot.get("include_layout")),
        "authorization": {
            "basis": preflight.get("authorization_basis", "explicit_user"),
            "binding_path": preflight.get("confirmation_policy", {}).get("binding_path"),
            "preference_scope": (
                preflight.get("confirmation_policy", {}).get("scope")
                if preflight.get("authorization_basis") in {"stored_preference", "automatic_policy"} else None
            ),
        },
        "node_ids": list(preflight.get("node_ids") or []),
        "targets": targets,
        "account": {
            "account_fingerprint": account.get("account_fingerprint"),
            "workspace_id": account.get("workspace_id"),
            "membership_tier": account.get("membership_tier"),
            "detected_membership_tier": preflight.get("detected_membership_tier"),
            "membership_override": preflight.get("membership_override"),
            "credits_total": account.get("credits_total"),
        },
        "balance_state": preflight.get("balance_state"),
        "entitlement_state": preflight.get("entitlement_state"),
        "mutation_args": _replace_option_value(args, "--run-id", None),
    }


def _canvas_paid_confirmation_digest(binding: dict[str, Any]) -> str:
    encoded = json.dumps(
        binding,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _append_canvas_paid_confirmation_plan(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def _create_canvas_paid_confirmation_plan(
    mutation_args: list[str],
    *,
    preflight: dict[str, Any],
    pre_snapshot: dict[str, Any],
    binding_path: Path,
) -> dict[str, Any]:
    if not _canvas_approval_content_valid(pre_snapshot.get("approval_content")):
        raise ValueError(
            "Canvas confirmation requires a canonical full-graph content fingerprint; run a fresh preflight."
        )
    approval_binding = _canvas_paid_confirmation_binding(
        preflight,
        args=mutation_args,
        pre_snapshot=pre_snapshot,
    )
    approval_digest = _canvas_paid_confirmation_digest(approval_binding)
    confirmation_plan_id = uuid.uuid4().hex
    confirmed_args = [
        *_replace_option_value(mutation_args, "--run-id", None),
        (CANVAS_PAID_PREFERENCE_FLAG if preflight.get("authorization_basis") in {"stored_preference", "automatic_policy"}
         else CANVAS_PAID_CONFIRMATION_FLAG),
        CANVAS_PAID_CONFIRMATION_PLAN_FLAG,
        confirmation_plan_id,
    ]
    confirmation_command = f"{pvx_command()} pixverse {shlex.join(confirmed_args)}"
    created_at = utc_now()
    record = {
        "schema_version": CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION,
        "event": "canvas.paid.confirmation_plan_created",
        "created_at": created_at,
        "confirmation_plan_id": confirmation_plan_id,
        "approval_digest": approval_digest,
        "approval_binding": approval_binding,
        "mutation_args": _replace_option_value(mutation_args, "--run-id", None),
        "preflight": preflight,
    }
    _append_canvas_paid_confirmation_plan(
        canvas_paid_confirmation_plans_path(binding_path=binding_path),
        record,
    )
    return {
        "confirmation_plan_id": confirmation_plan_id,
        "approval_digest": approval_digest,
        "created_at": created_at,
        "confirmation_command": confirmation_command,
    }


def _read_canvas_paid_records(path: Path, *, label: str) -> list[dict[str, Any]]:
    rows = read_jsonl(path)
    records: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"{label} at {path} contains a non-object JSON record at row {index}")
        if row.get("kind") == "invalid_jsonl":
            line = row.get("line") or index
            raise ValueError(f"{label} at {path} contains invalid JSON at line {line}")
        records.append(row)
    return records


def _canvas_unresolved_paid_runs(
    *,
    binding_path: Path,
    project_id: str,
    node_ids: list[str],
) -> list[dict[str, Any]]:
    """Find durable submissions that still require recovery before a fresh first render."""

    rows = _read_canvas_paid_records(
        canvas_paid_ledger_path(binding_path=binding_path),
        label="Canvas paid-run ledger",
    )
    selected = set(node_ids)
    runs: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row.get("project_id") != project_id:
            continue
        run_id = str(row.get("run_id") or "").strip()
        row_node_ids = {
            str(item).strip()
            for item in row.get("node_ids", [])
            if isinstance(item, (str, int)) and not isinstance(item, bool) and str(item).strip()
        }
        if not run_id or not selected.intersection(row_node_ids):
            continue
        event = str(row.get("event") or "")
        state = runs.setdefault(
            run_id,
            {
                "run_id": run_id,
                "node_ids": sorted(row_node_ids),
                "confirmation_plan_id": row.get("confirmation_plan_id") or "",
                "generation_state": "unknown",
                "generation_status": "unknown",
                "unresolved": False,
            },
        )
        if event == "canvas.paid.submission_started":
            state["unresolved"] = True
        if event == "canvas.paid.submission_result":
            generation_state = str(row.get("generation_state") or "unknown")
            state["generation_state"] = generation_state
            state["unresolved"] = generation_state not in {"not_started", "submission_failed"}
        if event == "canvas.paid.reconciliation":
            generation_status = str(row.get("generation_status") or "unknown").lower()
            state["generation_status"] = generation_status
            if generation_status in {"succeeded", "partially_succeeded", "failed", "not_started"}:
                state["unresolved"] = False
    return [
        {key: value for key, value in state.items() if key != "unresolved"}
        for state in runs.values()
        if state.get("unresolved")
    ]


def _canvas_paid_confirmation_plan_binding_paths(
    confirmation_plan_id: str,
) -> list[Path]:
    projects_root = repo_root() / "projects"
    plan_paths = [projects_root / ".canvas-paid-confirmation-plans.jsonl"]
    if projects_root.is_dir():
        plan_paths.extend(
            sorted(projects_root.glob("*/.canvas-paid-confirmation-plans.jsonl"))
        )
    matches: list[Path] = []
    for plan_path in plan_paths:
        if not plan_path.is_file():
            continue
        if any(
            row.get("schema_version") == CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION
            and str(row.get("confirmation_plan_id") or "") == confirmation_plan_id
            for row in _read_canvas_paid_records(plan_path, label="Canvas confirmation-plan log")
        ):
            matches.append(plan_path.with_name(CANVAS_PROJECT_BINDING_FILENAME))
    return matches


def _validate_canvas_paid_confirmation_plan(
    confirmation_plan_id: str,
    *,
    args: list[str],
    preflight: dict[str, Any],
    pre_snapshot: dict[str, Any],
    binding_path: Path,
    json_output: bool,
) -> int | None:
    plan_path = canvas_paid_confirmation_plans_path(binding_path=binding_path)
    try:
        rows = _read_canvas_paid_records(
            plan_path,
            label="Canvas confirmation-plan log",
        )
        ledger_rows = _read_canvas_paid_records(
            canvas_paid_ledger_path(binding_path=binding_path),
            label="Canvas paid-run ledger",
        )
    except (OSError, ValueError) as exc:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_state_unreadable",
                "message": str(exc),
                "confirmation_plan_id": confirmation_plan_id,
                "plan_path": str(plan_path),
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=json_output,
        )
    plans = [
        row
        for row in rows
        if row.get("schema_version") == CANVAS_PAID_CONFIRMATION_PLAN_SCHEMA_VERSION
        and str(row.get("confirmation_plan_id") or "") == confirmation_plan_id
    ]
    if len(plans) != 1:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_not_found",
                "message": "No unique immutable Canvas paid confirmation plan matches this id.",
                "confirmation_plan_id": confirmation_plan_id,
                "plan_path": str(plan_path),
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=json_output,
        )
    plan = plans[0]
    planned_binding = plan.get("approval_binding")
    planned_digest = str(plan.get("approval_digest") or "")
    if (
        not isinstance(planned_binding, dict)
        or not planned_digest
        or _canvas_paid_confirmation_digest(planned_binding) != planned_digest
    ):
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_invalid",
                "message": "The Canvas paid confirmation plan failed its immutable content digest check.",
                "confirmation_plan_id": confirmation_plan_id,
                "plan_path": str(plan_path),
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=json_output,
        )
    replay_error = _canvas_paid_consumed_plan_guard(
        confirmation_plan_id, ledger_rows=ledger_rows, json_output=json_output
    )
    if replay_error is not None:
        return replay_error
    if not _canvas_approval_content_valid(planned_binding.get("approval_content")):
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_stale",
                "message": (
                    "This older plan has no current canonical content binding. "
                    "Create and show a fresh paid preflight."
                ),
                "confirmation_plan_id": confirmation_plan_id,
                "changed_fields": ["approval_content"],
                "mutation_executed": False,
                "generation_started": False,
            },
            json_output=json_output,
        )
    current_binding = _canvas_paid_confirmation_binding(
        preflight,
        args=args,
        pre_snapshot=pre_snapshot,
    )
    planned_version = planned_binding.get("edit_version")
    current_version = current_binding.get("edit_version")
    # Content approval and execution CAS are separate. The canonical fingerprint
    # accepts only reviewed Web representation equivalences; never ignore actual
    # content/argument edits, version rollback, or layout-aware checkpoints.
    if (
        type(planned_version) is int
        and type(current_version) is int
        and current_version > planned_version
        and not planned_binding.get("checkpoint_include_layout")
        and not current_binding.get("checkpoint_include_layout")
        and all(
            planned_binding.get(key) == current_binding.get(key)
            for key in (set(planned_binding) | set(current_binding)) - {"edit_version"}
        )
    ):
        current_binding["edit_version"] = planned_version
    current_digest = _canvas_paid_confirmation_digest(current_binding)
    if current_digest != planned_digest:
        changed_fields = sorted(
            key
            for key in set(planned_binding) | set(current_binding)
            if planned_binding.get(key) != current_binding.get(key)
        )
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_confirmation_plan_stale",
                "message": (
                    "Canvas graph, route, account, workspace, membership, or balance state changed after "
                    "approval. Create and show a fresh read-only paid preflight before generation."
                ),
                "confirmation_plan_id": confirmation_plan_id,
                "planned_edit_version": planned_version,
                "current_edit_version": current_version,
                "changed_fields": changed_fields,
                "planned_digest": planned_digest,
                "current_digest": current_digest,
                "mutation_executed": False,
                "generation_started": False,
                "next_steps": [f"{pvx_command()} canvas paid preflight --help"],
            },
            json_output=json_output,
        )
    return None


def _canvas_approval_content_valid(content: Any) -> bool:
    return (
        isinstance(content, dict)
        and content.get("schema_version") == CANVAS_APPROVAL_CONTENT_SCHEMA_VERSION
        and content.get("scope") == "full_graph"
        and isinstance(content.get("sha256"), str)
        and re.fullmatch(r"[0-9a-f]{64}", content["sha256"]) is not None
    )


def _canvas_paid_consumed_plan_guard(
    confirmation_plan_id: str,
    *,
    ledger_rows: list[dict[str, Any]],
    json_output: bool,
) -> int | None:
    for row in ledger_rows:
        if (
            row.get("event") == "canvas.paid.submission_started"
            and str(row.get("confirmation_plan_id") or "") == confirmation_plan_id
        ):
            return _emit_canvas_guard_error(
                {
                    "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                    "error": "canvas_confirmation_plan_already_used",
                    "message": (
                        "This one-time Canvas paid confirmation plan already owns a durable submission. "
                        "Reconcile that run instead of submitting again."
                    ),
                    "confirmation_plan_id": confirmation_plan_id,
                    "run_id": row.get("run_id"),
                    "mutation_executed": False,
                    "generation_started": False,
                },
                json_output=json_output,
            )
    return None


def _canvas_video_capability_mode(gen_type: str) -> str:
    return "reference" if gen_type == "reference_to_video" else "video"


def _canvas_generation_count(
    node_id: str,
    params: dict[str, Any],
    *,
    kind: str,
    create_capabilities: dict[str, Any] | None = None,
) -> tuple[int | str, list[dict[str, Any]]]:
    """Return the Canvas output count declared by adapter v2.

    The runtime Canvas adapter has no mapping from graph payload fields to the
    Create ``count`` option, so one Canvas generation node produces one output.
    Legacy aliases remain readable only to report a deterministic contract
    issue instead of silently ignoring a requested batch size.
    """

    del create_capabilities
    values: dict[str, int] = {}
    issues: list[dict[str, Any]] = []
    for field in ("create_count", "count", "n"):
        if field not in params:
            continue
        raw_value = params.get(field)
        try:
            if isinstance(raw_value, bool):
                raise ValueError
            parsed = int(raw_value)
            if str(parsed) != str(raw_value).strip() and not isinstance(raw_value, int):
                raise ValueError
        except (TypeError, ValueError):
            issues.append(
                {
                    "node_id": node_id,
                    "field": f"data.params.{field}",
                    "code": f"canvas_{kind}_create_count_invalid",
                    "message": f"{field} must be an integer generation count.",
                }
            )
            continue
        values[field] = parsed
    if len(set(values.values())) > 1:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.create_count",
                "code": f"canvas_{kind}_create_count_conflict",
                "message": "create_count, count, and n must not declare different generation counts.",
                "values": values,
            }
        )
    count = next((values[field] for field in ("create_count", "count", "n") if field in values), 1)
    if isinstance(count, int) and count != 1:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.create_count",
                "code": f"canvas_{kind}_create_count_unsupported",
                "message": (
                    "The current Canvas capability adapter produces exactly one output per node and "
                    "does not map create_count, count, or n to the Create count option."
                ),
                "value": count,
                "allowed": [1],
                "repair": {
                    "set_payload_fields": {},
                    "remove_payload_fields": ["create_count", "count", "n"],
                },
            }
        )
    return count, issues


def _canvas_video_reviewed_capability_issues(
    *,
    node_id: str,
    model: str,
    gen_type: str,
    params: dict[str, Any],
    prompt: str,
    image_reference_count: int,
    video_reference_count: int,
    audio_reference_count: int,
    route_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Check mapped Canvas values against the route-resolved Create capability."""

    issues: list[dict[str, Any]] = []
    count, count_issues = _canvas_generation_count(
        node_id,
        params,
        kind="video",
    )
    issues.extend(count_issues)
    capability_mode = _canvas_video_capability_mode(gen_type)
    if route_context is None:
        create_capabilities = load_create_capabilities()
        modes = (
            create_capabilities.get("modes")
            if isinstance(create_capabilities.get("modes"), dict)
            else {}
        )
        mode_capability = modes.get(capability_mode) if isinstance(modes, dict) else {}
        capability_source = "bundled_create_capabilities_compatibility_check"
    else:
        mode_capability = _canvas_resolved_create_mode_capability(route_context)
        capability_source = "canvas_runtime_route_cli_capability"
    mode_capability = mode_capability if isinstance(mode_capability, dict) else {}
    capability_available = bool(mode_capability)
    mapped_targets = (
        _canvas_route_target_fields(route_context)
        if route_context is not None
        else None
    )
    model_ids = mode_capability.get("model_ids") if capability_available else None
    model_parameters = (
        mode_capability.get("model_parameters")
        if isinstance(mode_capability.get("model_parameters"), dict)
        else {}
    )

    def model_parameter(field: str) -> dict[str, Any]:
        by_model = model_parameters.get(field) if isinstance(model_parameters, dict) else None
        value = by_model.get(model) if isinstance(by_model, dict) else None
        return value if isinstance(value, dict) else {}
    if not model:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.model",
                "code": "canvas_video_model_required",
                "message": "video_generate requires an explicit model before paid preflight.",
            }
        )
    elif isinstance(model_ids, list) and model not in model_ids:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.model",
                "code": "canvas_video_model_mode_unsupported",
                "message": f"Model {model!r} is not listed for reviewed {capability_mode} generation.",
                "gen_type": gen_type,
            }
        )

    mode_parameters = (
        mode_capability.get("parameters")
        if isinstance(mode_capability.get("parameters"), dict)
        else {}
    )
    prompt_capability = (
        mode_parameters.get("prompt") if isinstance(mode_parameters, dict) else None
    )
    prompt_required = (
        isinstance(prompt_capability, dict) and prompt_capability.get("required") is True
    )
    if prompt and mapped_targets is not None and "prompt" not in mapped_targets:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_video_prompt_unmapped",
                "message": "The selected Canvas route does not map prompt into Create.",
            }
        )
    if (prompt_required or gen_type == "text_to_video") and not prompt:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_video_prompt_required",
                "message": f"{gen_type or capability_mode} requires a non-empty prompt.",
            }
        )

    reviewed_values: dict[str, Any] = {}
    for field in ("duration", "quality", "aspect_ratio"):
        value = params.get(field)
        reviewed_values[field] = value if _canvas_value_present(value) else "default"
        if not _canvas_value_present(value):
            continue
        if mapped_targets is not None and field not in mapped_targets:
            issues.append(
                {
                    "node_id": node_id,
                    "field": f"data.params.{field}",
                    "code": f"canvas_video_{field}_unmapped",
                    "message": f"The selected Canvas route does not map {field} into Create.",
                }
            )
            continue
        if field in {"quality", "aspect_ratio"} and not isinstance(value, str):
            issues.append(
                {
                    "node_id": node_id,
                    "field": f"data.params.{field}",
                    "code": f"canvas_video_{field}_invalid",
                    "message": f"{field} must be a non-empty string.",
                }
            )
            continue
        if field == "duration" and isinstance(value, bool):
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.duration",
                    "code": "canvas_video_duration_invalid",
                    "message": "duration must be a supported number of seconds.",
                }
            )
            continue
        parameter = model_parameter(field) if model else {}
        allowed = parameter.get("enum") if isinstance(parameter, dict) else None
        if isinstance(allowed, list) and str(value) not in {str(item) for item in allowed}:
            issues.append(
                {
                    "node_id": node_id,
                    "field": f"data.params.{field}",
                    "code": f"canvas_video_{field}_unsupported",
                    "message": f"{field}={value!r} is outside the reviewed values for {model!r}.",
                    "value": value,
                    "allowed": allowed,
                }
            )

    audio = params.get("audio", "default")
    reviewed_values["audio"] = audio
    if audio != "default" and mapped_targets is not None and "audio" not in mapped_targets:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.audio",
                "code": "canvas_video_audio_unmapped",
                "message": "The selected Canvas route does not map audio into Create.",
            }
        )
    elif isinstance(audio, bool):
        normalized_audio = 1 if audio else 0
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.audio",
                "code": "canvas_video_audio_noncanonical",
                "message": "Canvas video audio must use the numeric switch 0 or 1, not a boolean.",
                "repair": {
                    "set_payload_fields": {"audio": normalized_audio},
                    "remove_payload_fields": [],
                },
            }
        )
    elif audio != "default" and (not isinstance(audio, int) or audio not in {0, 1}):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.audio",
                "code": "canvas_video_audio_invalid",
                "message": "Canvas video audio must be the numeric switch 0 or 1.",
            }
        )
    elif audio == 1 and model:
        audio_capability = model_parameter("audio")
        if audio_capability.get("supported") is False:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.audio",
                    "code": "canvas_video_audio_unsupported",
                    "message": f"Generated audio is not supported by the reviewed route for {model!r}.",
                }
            )

    for field, reference_count in (
        ("images", image_reference_count),
        ("videos", video_reference_count),
        ("audios", audio_reference_count),
    ):
        target_field = "image" if gen_type == "image_to_video" and field == "images" else field
        if reference_count and mapped_targets is not None and target_field not in mapped_targets:
            issues.append(
                {
                    "node_id": node_id,
                    "field": (
                        "data.params.customer_img_path"
                        if target_field == "image"
                        else f"data.params.customer_{field[:-1]}_paths"
                    ),
                    "code": f"canvas_video_{field}_unmapped",
                    "message": f"The selected Canvas route does not map {field} references into Create.",
                }
            )
            continue
        parameter = model_parameter(field) if model else {}
        if target_field == "image" and model:
            parameter = model_parameter("image")
        maximum = parameter.get("max_count") if isinstance(parameter, dict) else None
        if reference_count and parameter.get("supported") is False:
            issues.append(
                {
                    "node_id": node_id,
                    "field": (
                        "data.params.customer_img_paths"
                        if field == "images"
                        else (
                            "data.params.customer_video_paths"
                            if field == "videos"
                            else "data.params.customer_audio_paths"
                        )
                    ),
                    "code": f"canvas_video_{field}_unsupported",
                    "message": f"The reviewed route for {model!r} does not support {field} references.",
                }
            )
        elif isinstance(maximum, int) and reference_count > maximum:
            issues.append(
                {
                    "node_id": node_id,
                    "field": (
                        "data.params.customer_img_paths"
                        if field == "images"
                        else (
                            "data.params.customer_video_paths"
                            if field == "videos"
                            else "data.params.customer_audio_paths"
                        )
                    ),
                    "code": f"canvas_video_{field}_limit_exceeded",
                    "message": f"{reference_count} {field} exceed the reviewed maximum of {maximum} for {model!r}.",
                    "value": reference_count,
                    "allowed_max": maximum,
                }
            )

    return (
        {
            "capability_mode": capability_mode,
            "capability_source": capability_source if capability_available else "unavailable",
            "capability_id": mode_capability.get("capability_id") or "",
            "duration": reviewed_values["duration"],
            "quality": reviewed_values["quality"],
            "aspect_ratio": reviewed_values["aspect_ratio"],
            "audio": reviewed_values["audio"],
            "create_count": count,
        },
        issues,
    )


def _canvas_reviewed_create_parameter_issues(
    *,
    node_id: str,
    canvas_kind: str,
    capability_mode: str,
    model: str,
    values: dict[str, Any],
    route_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate adapter-mapped values against its resolved Create contract."""

    if route_context is None:
        create_capabilities = load_create_capabilities()
        modes = (
            create_capabilities.get("modes")
            if isinstance(create_capabilities.get("modes"), dict)
            else {}
        )
        mode_capability = modes.get(capability_mode) if isinstance(modes, dict) else None
        capability_source = "bundled_create_capabilities_compatibility_check"
    else:
        mode_capability = _canvas_resolved_create_mode_capability(route_context)
        capability_source = "canvas_runtime_route_cli_capability"
    if not isinstance(mode_capability, dict) or not mode_capability:
        return (
            {
                "capability_mode": capability_mode,
                "capability_source": "unavailable",
            },
            [],
        )

    issues: list[dict[str, Any]] = []
    model_ids = mode_capability.get("model_ids")
    if not model:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.model",
                "code": f"canvas_{canvas_kind}_model_required",
                "message": f"{canvas_kind}_generate requires an explicit model before paid preflight.",
            }
        )
    elif isinstance(model_ids, list) and model not in model_ids:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.model",
                "code": f"canvas_{canvas_kind}_model_mode_unsupported",
                "message": f"Model {model!r} is not listed for reviewed {capability_mode} generation.",
                "capability_mode": capability_mode,
            }
        )

    parameters = (
        mode_capability.get("parameters")
        if isinstance(mode_capability.get("parameters"), dict)
        else {}
    )
    mapped_targets = (
        _canvas_route_target_fields(route_context)
        if route_context is not None
        else None
    )
    model_parameters = (
        mode_capability.get("model_parameters")
        if isinstance(mode_capability.get("model_parameters"), dict)
        else {}
    )

    def model_parameter(field: str) -> dict[str, Any]:
        by_model = model_parameters.get(field) if isinstance(model_parameters, dict) else None
        value = by_model.get(model) if isinstance(by_model, dict) else None
        return value if isinstance(value, dict) else {}

    for field, value in values.items():
        if not _canvas_value_present(value):
            continue
        if mapped_targets is not None and field not in mapped_targets:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.prompt" if field in {"prompt", "text"} else f"data.params.{field}",
                    "code": f"canvas_{canvas_kind}_{field}_unmapped",
                    "message": f"The selected Canvas route does not map {field} into Create.",
                }
            )
            continue
        parameter = parameters.get(field) if isinstance(parameters.get(field), dict) else {}
        per_model = model_parameter(field) if model else {}
        field_path = "data.prompt" if field in {"prompt", "text"} else f"data.params.{field}"
        value_type = parameter.get("type")
        valid_type = True
        if value_type == "boolean":
            valid_type = isinstance(value, bool)
        elif value_type == "integer":
            valid_type = isinstance(value, int) and not isinstance(value, bool)
        elif value_type == "number":
            valid_type = isinstance(value, (int, float)) and not isinstance(value, bool)
        elif value_type in {"string", "text"}:
            valid_type = isinstance(value, str) and bool(value.strip())
        if not valid_type:
            issues.append(
                {
                    "node_id": node_id,
                    "field": field_path,
                    "code": f"canvas_{canvas_kind}_{field}_invalid",
                    "message": f"{field} does not match the reviewed {value_type or 'value'} type.",
                }
            )
            continue
        if per_model.get("supported") is False:
            issues.append(
                {
                    "node_id": node_id,
                    "field": field_path,
                    "code": f"canvas_{canvas_kind}_{field}_unsupported",
                    "message": f"{field} is not supported by the reviewed route for {model!r}.",
                }
            )
            continue
        allowed = per_model.get("enum", parameter.get("enum"))
        if isinstance(allowed, list) and value not in allowed:
            issues.append(
                {
                    "node_id": node_id,
                    "field": field_path,
                    "code": f"canvas_{canvas_kind}_{field}_unsupported",
                    "message": f"{field}={value!r} is outside the reviewed values for {model!r}.",
                    "value": value,
                    "allowed": allowed,
                }
            )
        minimum = per_model.get("min", parameter.get("min"))
        maximum = per_model.get("max", parameter.get("max"))
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if isinstance(minimum, (int, float)) and value < minimum:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": field_path,
                        "code": f"canvas_{canvas_kind}_{field}_out_of_range",
                        "message": f"{field} must be at least {minimum} for {model!r}.",
                        "value": value,
                        "minimum": minimum,
                    }
                )
            if isinstance(maximum, (int, float)) and value > maximum:
                issues.append(
                    {
                        "node_id": node_id,
                        "field": field_path,
                        "code": f"canvas_{canvas_kind}_{field}_out_of_range",
                        "message": f"{field} must be at most {maximum} for {model!r}.",
                        "value": value,
                        "maximum": maximum,
                    }
                )
        max_length = per_model.get("max_length", parameter.get("max_length"))
        if isinstance(value, str) and isinstance(max_length, int) and len(value) > max_length:
            issues.append(
                {
                    "node_id": node_id,
                    "field": field_path,
                    "code": f"canvas_{canvas_kind}_{field}_too_long",
                    "message": f"{field} exceeds the reviewed maximum length of {max_length} for {model!r}.",
                    "value_length": len(value),
                    "maximum_length": max_length,
                }
            )

    return (
        {
            "capability_mode": capability_mode,
            "capability_source": capability_source,
            "capability_id": mode_capability.get("capability_id") or "",
        },
        issues,
    )


def _canvas_image_generation_contract(
    snapshot: dict[str, Any],
    node_id: str,
    node: dict[str, Any],
    *,
    model: str,
    route_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate the adapter-v2 Canvas image route before paid approval."""

    params = _canvas_node_params(node)
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    issues: list[dict[str, Any]] = []
    raw_prompt = data.get("prompt") if "prompt" in data else params.get("prompt")
    prompt = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
    if raw_prompt is not None and not isinstance(raw_prompt, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_image_prompt_invalid",
                "message": "image_generate prompt must be text.",
            }
        )
    elif not prompt:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_image_prompt_required",
                "message": "image_generate requires a non-empty prompt before paid preflight.",
            }
        )

    count, count_issues = _canvas_generation_count(
        node_id,
        params,
        kind="image",
    )
    issues.extend(count_issues)

    references = _canvas_reference_paths_from_dependencies(
        node_id,
        node,
        graph=snapshot,
    )
    image_paths = _canvas_nonempty_string_list(params.get("customer_img_paths"))
    if image_paths is None:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.customer_img_paths",
                "code": "canvas_image_reference_paths_invalid",
                "message": "customer_img_paths must be a list of non-empty provider paths.",
            }
        )
        image_paths = []
    expected_image_paths = _canvas_merge_unique_strings(
        image_paths,
        references["customer_img_paths"],
    )
    singular_image = params.get("customer_img_path")
    if singular_image is not None:
        normalized_singular = _canvas_provider_path(singular_image)
        if normalized_singular:
            expected_image_paths = _canvas_merge_unique_strings(
                expected_image_paths,
                [normalized_singular],
            )
        else:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_path",
                    "code": "canvas_image_reference_path_invalid",
                    "message": "customer_img_path must be a non-empty provider path.",
                }
            )

    raw_gen_type = params.get("gen_type")
    gen_type = (
        raw_gen_type.strip().lower()
        if isinstance(raw_gen_type, str) and raw_gen_type.strip()
        else "text_to_image"
    )
    if raw_gen_type is not None and not isinstance(raw_gen_type, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_image_gen_type_invalid",
                "message": "image_generate gen_type must be text_to_image or image_to_image.",
            }
        )
    elif gen_type not in CANVAS_IMAGE_GEN_TYPES:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_image_gen_type_unsupported",
                "message": f"Unsupported Canvas image gen_type: {gen_type!r}.",
            }
        )

    if gen_type == "image_to_image":
        if not expected_image_paths:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_paths",
                    "code": "canvas_image_reference_required",
                    "message": (
                        "image_to_image requires at least one concrete provider-backed image path; "
                        "a depends_on edge alone is not a Create reference."
                    ),
                    "unresolved_dependencies": references["unresolved_dependencies"],
                }
            )
        persisted_paths = list(image_paths)
        normalized_singular = _canvas_provider_path(singular_image)
        if normalized_singular:
            persisted_paths = _canvas_merge_unique_strings(persisted_paths, [normalized_singular])
        if expected_image_paths != persisted_paths:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_paths",
                    "code": "canvas_image_references_not_materialized",
                    "message": (
                        "image_to_image dependencies must be copied into customer_img_paths before "
                        "paid dispatch."
                    ),
                    "repair": {
                        "set_payload_fields": {"customer_img_paths": expected_image_paths},
                        "remove_payload_fields": ["customer_img_path"],
                    },
                }
            )
    elif gen_type == "text_to_image" and expected_image_paths:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_image_reference_mode_mismatch",
                "message": (
                    "text_to_image does not map image references; use image_to_image or remove the "
                    "reference fields and media dependencies."
                ),
            }
        )

    reviewed_contract, reviewed_issues = _canvas_reviewed_create_parameter_issues(
        node_id=node_id,
        canvas_kind="image",
        capability_mode="image",
        model=model,
        values={
            "prompt": prompt,
            "quality": params.get("quality"),
            "aspect_ratio": params.get("aspect_ratio"),
            "detail_level": params.get("detail_level"),
        },
        route_context=route_context,
    )
    issues.extend(reviewed_issues)
    if route_context is None:
        create_capabilities = load_create_capabilities()
        image_mode = (
            create_capabilities.get("modes", {}).get("image", {})
            if isinstance(create_capabilities.get("modes"), dict)
            else {}
        )
    else:
        image_mode = _canvas_resolved_create_mode_capability(route_context)
    image_limits = image_mode.get("model_parameters", {}).get("images", {}) if isinstance(image_mode, dict) else {}
    model_image_limit = image_limits.get(model) if isinstance(image_limits, dict) else None
    maximum_images = model_image_limit.get("max_count") if isinstance(model_image_limit, dict) else None
    if isinstance(maximum_images, int) and len(expected_image_paths) > maximum_images:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.customer_img_paths",
                "code": "canvas_image_reference_limit_exceeded",
                "message": f"{len(expected_image_paths)} image references exceed the reviewed maximum of {maximum_images} for {model!r}.",
                "value": len(expected_image_paths),
                "allowed_max": maximum_images,
            }
        )
    contract = {
        "media_kind": "image",
        "gen_type": gen_type,
        **reviewed_contract,
        "duration": "not_applicable",
        "quality": params.get("quality") if _canvas_value_present(params.get("quality")) else "default",
        "aspect_ratio": (
            params.get("aspect_ratio")
            if _canvas_value_present(params.get("aspect_ratio"))
            else "default"
        ),
        "detail_level": (
            params.get("detail_level")
            if _canvas_value_present(params.get("detail_level"))
            else "default"
        ),
        "audio": "not_applicable",
        "create_count": count,
        "model": model,
        "prompt": prompt,
        "prompt_length": len(prompt),
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest() if prompt else "",
        "dependency_node_ids": references["dependency_node_ids"],
        "resolved_image_source_node_ids": references["resolved_image_source_node_ids"],
        "resolved_video_source_node_ids": [],
        "image_reference_count": len(expected_image_paths),
        "video_reference_count": 0,
        "image_references_sha256": _canvas_reference_paths_sha256(expected_image_paths),
        "video_references_sha256": "",
        "unresolved_dependencies": references["unresolved_dependencies"],
    }
    return contract, issues


def _canvas_audio_generation_contract(
    node_id: str,
    node: dict[str, Any],
    *,
    model: str,
    route_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate adapter-v2 music and speech routes before paid approval."""

    params = _canvas_node_params(node)
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    issues: list[dict[str, Any]] = []
    raw_gen_type = params.get("gen_type")
    gen_type = raw_gen_type.strip().lower() if isinstance(raw_gen_type, str) else ""
    if not gen_type:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_audio_gen_type_required",
                "message": "audio_generate requires text_to_music or text_to_speech before paid preflight.",
            }
        )
    elif gen_type not in CANVAS_AUDIO_GEN_TYPES:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_audio_gen_type_unsupported",
                "message": f"Unsupported Canvas audio gen_type: {gen_type!r}.",
            }
        )

    raw_prompt = data.get("prompt") if "prompt" in data else params.get("prompt")
    prompt = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
    if raw_prompt is not None and not isinstance(raw_prompt, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_audio_prompt_invalid",
                "message": "audio_generate prompt must be text.",
            }
        )
    elif not prompt:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_audio_prompt_required",
                "message": "audio_generate requires a non-empty prompt before paid preflight.",
            }
        )

    count, count_issues = _canvas_generation_count(node_id, params, kind="audio")
    issues.extend(count_issues)
    capability_mode = (
        "music"
        if gen_type == "text_to_music"
        else "voice"
        if gen_type == "text_to_speech"
        else "unresolved"
    )
    mapped_values: dict[str, Any] = {}
    if capability_mode == "music":
        mapped_values = {
            "prompt": prompt,
            "lyrics": params.get("lyrics"),
            "instrumental": params.get("instrumental"),
            "auto_lyrics": params.get("auto_lyrics"),
            "duration_auto": params.get("duration_auto"),
        }
    elif capability_mode == "voice":
        mapped_values = {
            "text": prompt,
            "voice_id": params.get("voice_id"),
            "provider_voice_id": params.get("provider_voice_id"),
            "language": params.get("language"),
            "speed": params.get("speed"),
            "stability": params.get("stability"),
            "similarity_boost": params.get("similarity_boost"),
            "style": params.get("style"),
            "use_speaker_boost": params.get("use_speaker_boost"),
            "volume": params.get("volume"),
            "pitch": params.get("pitch"),
            "emotion": params.get("emotion"),
        }
    if capability_mode == "unresolved":
        reviewed_contract = {
            "capability_mode": "unresolved",
            "capability_source": "canvas_capability_adapter.v2",
        }
        reviewed_issues: list[dict[str, Any]] = []
    else:
        reviewed_contract, reviewed_issues = _canvas_reviewed_create_parameter_issues(
            node_id=node_id,
            canvas_kind="audio",
            capability_mode=capability_mode,
            model=model,
            values=mapped_values,
            route_context=route_context,
        )
    issues.extend(reviewed_issues)

    if capability_mode == "voice" and not (
        _canvas_value_present(params.get("voice_id"))
        or _canvas_value_present(params.get("provider_voice_id"))
    ):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.voice_id",
                "code": "canvas_audio_voice_required",
                "message": "text_to_speech requires voice_id or provider_voice_id.",
            }
        )
    if capability_mode == "music":
        music_mode = (
            load_create_capabilities().get("modes", {}).get("music", {})
            if route_context is None
            else _canvas_resolved_create_mode_capability(route_context)
        )
        model_parameters = music_mode.get("model_parameters", {}) if isinstance(music_mode, dict) else {}
        lyrics_by_model = model_parameters.get("lyrics", {}) if isinstance(model_parameters, dict) else {}
        lyrics_capability = lyrics_by_model.get(model) if isinstance(lyrics_by_model, dict) else None
        if isinstance(lyrics_capability, dict) and lyrics_capability.get("supported") is True:
            if not (
                _canvas_value_present(params.get("lyrics"))
                or params.get("instrumental") is True
                or params.get("auto_lyrics") is True
            ):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "data.params.lyrics",
                        "code": "canvas_audio_music_lyrics_choice_required",
                        "message": "text_to_music requires lyrics, instrumental=true, or auto_lyrics=true for this model.",
                    }
                )
        if params.get("duration_auto") is False:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.duration_auto",
                    "code": "canvas_audio_manual_duration_unmapped",
                    "message": (
                        "The current Canvas adapter does not map duration_seconds; keep duration_auto=true "
                        "for this route."
                    ),
                }
            )

    return (
        {
            "media_kind": "audio",
            "gen_type": gen_type or "unresolved",
            **reviewed_contract,
            "duration": params.get("duration_auto", "default"),
            "quality": "not_applicable",
            "aspect_ratio": "not_applicable",
            "audio": "not_applicable",
            "create_count": count,
            "model": model,
            "prompt": prompt,
            "prompt_length": len(prompt),
            "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest() if prompt else "",
            "dependency_node_ids": [],
            "resolved_image_source_node_ids": [],
            "resolved_video_source_node_ids": [],
            "resolved_audio_source_node_ids": [],
            "image_reference_count": 0,
            "video_reference_count": 0,
            "audio_reference_count": 0,
            "image_references_sha256": "",
            "video_references_sha256": "",
            "audio_references_sha256": "",
        },
        issues,
    )


def _canvas_text_generation_contract(
    node_id: str,
    node: dict[str, Any],
    *,
    model: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate the payload-schema-only Canvas text node contract."""

    params = _canvas_node_params(node)
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    raw_prompt = data.get("prompt") if "prompt" in data else params.get("prompt")
    prompt = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
    issues: list[dict[str, Any]] = []
    if raw_prompt is not None and not isinstance(raw_prompt, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_text_prompt_invalid",
                "message": "text_generate prompt must be text.",
            }
        )
    elif not prompt:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_text_prompt_required",
                "message": "text_generate requires a non-empty prompt before paid preflight.",
            }
        )
    if not model:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.model",
                "code": "canvas_text_model_required",
                "message": "text_generate requires an explicit model before paid preflight.",
            }
        )
    count, count_issues = _canvas_generation_count(node_id, params, kind="text")
    issues.extend(count_issues)
    return (
        {
            "media_kind": "text",
            "gen_type": "text_generate",
            "capability_mode": "canvas_text_payload_schema",
            "capability_source": "canvas_node_payload_schema",
            "duration": "not_applicable",
            "quality": "not_applicable",
            "aspect_ratio": "not_applicable",
            "audio": "not_applicable",
            "create_count": count,
            "model": model,
            "prompt": prompt,
            "prompt_length": len(prompt),
            "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest() if prompt else "",
            "dependency_node_ids": [],
            "resolved_image_source_node_ids": [],
            "resolved_video_source_node_ids": [],
            "resolved_audio_source_node_ids": [],
            "image_reference_count": 0,
            "video_reference_count": 0,
            "audio_reference_count": 0,
            "image_references_sha256": "",
            "video_references_sha256": "",
            "audio_references_sha256": "",
        },
        issues,
    )


def _canvas_video_generation_contract(
    snapshot: dict[str, Any],
    node_id: str,
    node: dict[str, Any],
    *,
    route_context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate reviewed Canvas fields and expose confirmation-ready parameters."""

    params = _canvas_node_params(node)
    issues: list[dict[str, Any]] = []
    raw_gen_type_value = params.get("gen_type")
    raw_gen_type = (
        raw_gen_type_value.strip().lower()
        if isinstance(raw_gen_type_value, str)
        else ""
    )
    canonical_gen_type = CANVAS_VIDEO_GEN_TYPE_ALIASES.get(raw_gen_type, raw_gen_type)
    if not isinstance(raw_gen_type_value, str) or not raw_gen_type:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_video_gen_type_required",
                "message": (
                    "video_generate requires a canonical gen_type; the wrapper will not infer the "
                    "generation mode during a paid preflight."
                ),
            }
        )
    elif canonical_gen_type != raw_gen_type:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_video_gen_type_noncanonical",
                "message": (
                    f"gen_type={raw_gen_type!r} is not accepted by the reviewed Canvas route; "
                    f"use {canonical_gen_type!r}."
                ),
                "repair": {
                    "set_payload_fields": {"gen_type": canonical_gen_type},
                    "remove_payload_fields": [],
                },
            }
        )
    elif canonical_gen_type not in CANVAS_VIDEO_GEN_TYPES:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.gen_type",
                "code": "canvas_video_gen_type_unsupported",
                "message": f"Unsupported Canvas video gen_type: {canonical_gen_type!r}.",
            }
        )

    quality = params.get("quality")
    resolution_present = "resolution" in params
    resolution = params.get("resolution")
    if _canvas_value_present(quality) and not isinstance(quality, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.quality",
                "code": "canvas_video_quality_invalid",
                "message": "quality must be a non-empty string.",
            }
        )
    if resolution_present:
        if _canvas_value_present(resolution) and not isinstance(resolution, str):
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.resolution",
                    "code": "canvas_video_quality_invalid",
                    "message": "resolution cannot be converted because it is not a string.",
                }
            )
        elif (
            _canvas_value_present(quality)
            and _canvas_value_present(resolution)
            and quality != resolution
        ):
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.quality",
                    "code": "canvas_video_quality_conflict",
                    "message": "quality and resolution conflict; keep only the intended canonical quality.",
                    "quality": quality,
                    "resolution": resolution,
                }
            )
        else:
            repair_fields = {"quality": resolution} if _canvas_value_present(resolution) else {}
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.resolution",
                    "code": "canvas_video_resolution_noncanonical",
                    "message": "Canvas video quality must use quality; resolution can silently fall back to 720p.",
                    "repair": {
                        "set_payload_fields": repair_fields,
                        "remove_payload_fields": ["resolution"],
                    },
                }
            )

    references = _canvas_reference_paths_from_dependencies(
        node_id,
        node,
        graph=snapshot,
    )
    image_paths = _canvas_nonempty_string_list(params.get("customer_img_paths"))
    video_paths = _canvas_nonempty_string_list(params.get("customer_video_paths"))
    audio_paths = _canvas_nonempty_string_list(params.get("customer_audio_paths"))
    valid_image_paths = image_paths if image_paths is not None else []
    valid_video_paths = video_paths if video_paths is not None else []
    valid_audio_paths = audio_paths if audio_paths is not None else []

    expected_image_paths = _canvas_merge_unique_strings(
        valid_image_paths,
        references["customer_img_paths"],
    )
    expected_video_paths = _canvas_merge_unique_strings(
        valid_video_paths,
        references["customer_video_paths"],
    )
    expected_audio_paths = _canvas_merge_unique_strings(
        valid_audio_paths,
        references["customer_audio_paths"],
    )
    if canonical_gen_type in CANVAS_VIDEO_REFERENCE_GEN_TYPES:
        if image_paths is None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_paths",
                    "code": "canvas_video_reference_paths_invalid",
                    "message": "customer_img_paths must be a list of non-empty provider paths.",
                }
            )
        if video_paths is None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_video_paths",
                    "code": "canvas_video_reference_paths_invalid",
                    "message": "customer_video_paths must be a list of non-empty provider paths.",
                }
            )
        if audio_paths is None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_audio_paths",
                    "code": "canvas_video_reference_paths_invalid",
                    "message": "customer_audio_paths must be a list of non-empty provider paths.",
                }
            )
        singular_image = params.get("customer_img_path")
        singular_video = params.get("customer_video_path")
        singular_audio = params.get("customer_audio_path")
        normalized_singular_image = _canvas_provider_path(singular_image)
        normalized_singular_video = _canvas_provider_path(singular_video)
        normalized_singular_audio = _canvas_provider_path(singular_audio)
        if normalized_singular_image:
            expected_image_paths = _canvas_merge_unique_strings(
                expected_image_paths,
                [normalized_singular_image],
            )
        elif singular_image is not None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_path",
                    "code": "canvas_video_reference_path_invalid",
                    "message": "customer_img_path must be a non-empty provider path.",
                }
            )
        if normalized_singular_video:
            expected_video_paths = _canvas_merge_unique_strings(
                expected_video_paths,
                [normalized_singular_video],
            )
        elif singular_video is not None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_video_path",
                    "code": "canvas_video_reference_path_invalid",
                    "message": "customer_video_path must be a non-empty provider path.",
                }
            )
        if normalized_singular_audio:
            expected_audio_paths = _canvas_merge_unique_strings(
                expected_audio_paths,
                [normalized_singular_audio],
            )
        elif singular_audio is not None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_audio_path",
                    "code": "canvas_video_reference_path_invalid",
                    "message": "customer_audio_path must be a non-empty provider path.",
                }
            )
        needs_materialization = (
            expected_image_paths != valid_image_paths
            or expected_video_paths != valid_video_paths
            or expected_audio_paths != valid_audio_paths
            or "customer_img_path" in params
            or "customer_video_path" in params
            or "customer_audio_path" in params
        )
        if needs_materialization:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_paths",
                    "code": "canvas_video_references_not_materialized",
                    "message": (
                        "Reference dependencies must be copied into canonical customer_img_paths, "
                        "customer_video_paths, and customer_audio_paths before paid dispatch."
                    ),
                    "repair": {
                        "set_payload_fields": {
                            "customer_img_paths": expected_image_paths,
                            "customer_video_paths": expected_video_paths,
                            "customer_audio_paths": expected_audio_paths,
                        },
                        "remove_payload_fields": [
                            "customer_img_path",
                            "customer_video_path",
                            "customer_audio_path",
                        ],
                    },
                }
            )
        if not expected_image_paths and not expected_video_paths and not expected_audio_paths:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_paths",
                    "code": "canvas_video_reference_required",
                    "message": (
                        "reference_to_video requires at least one concrete image, video, or audio provider path; "
                        "a depends_on edge alone is not a media reference."
                    ),
                    "unresolved_dependencies": references["unresolved_dependencies"],
                }
            )
    elif canonical_gen_type == "image_to_video":
        image = _canvas_provider_path(params.get("customer_img_path"))
        legacy_image = _canvas_provider_path(params.get("image"))
        if image and legacy_image and image != legacy_image:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_path",
                    "code": "canvas_video_image_conflict",
                    "message": "customer_img_path conflicts with the legacy image alias.",
                }
            )
        elif legacy_image:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.image",
                    "code": "canvas_video_image_noncanonical",
                    "message": "image_to_video must use canonical customer_img_path.",
                    "repair": {
                        "set_payload_fields": {"customer_img_path": legacy_image},
                        "remove_payload_fields": ["image"],
                    },
                }
            )
            image = image or legacy_image
        elif params.get("image") is not None:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.image",
                    "code": "canvas_video_image_invalid",
                    "message": "Legacy image must be a non-empty provider path before normalization.",
                }
            )
        if params.get("customer_img_path") is not None and not image:
            issues.append(
                {
                    "node_id": node_id,
                    "field": "data.params.customer_img_path",
                    "code": "canvas_video_image_invalid",
                    "message": "customer_img_path must be a non-empty provider path.",
                }
            )
        elif not image:
            issue: dict[str, Any] = {
                "node_id": node_id,
                "field": "data.params.customer_img_path",
                "code": "canvas_video_image_required",
                "message": "image_to_video requires a concrete image provider path in customer_img_path.",
                "unresolved_dependencies": references["unresolved_dependencies"],
            }
            if len(expected_image_paths) == 1:
                issue["repair"] = {
                    "set_payload_fields": {"customer_img_path": expected_image_paths[0]},
                    "remove_payload_fields": [],
                }
            elif len(expected_image_paths) > 1:
                issue["code"] = "canvas_video_image_ambiguous"
                issue["message"] = (
                    "image_to_video has multiple image candidates; set the intended provider path "
                    "explicitly in customer_img_path."
                )
                issue["candidate_images"] = expected_image_paths
            issues.append(issue)

    disclosed_image_paths = list(expected_image_paths)
    if canonical_gen_type == "image_to_video":
        image = _canvas_provider_path(params.get("customer_img_path")) or _canvas_provider_path(
            params.get("image")
        )
        if image:
            disclosed_image_paths = _canvas_merge_unique_strings(
                disclosed_image_paths,
                [image],
            )

    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    info = node.get("info") if isinstance(node.get("info"), dict) else {}
    model = str(
        data.get("model")
        or params.get("model")
        or extra.get("model")
        or info.get("model")
        or node.get("model")
        or ""
    ).strip()
    raw_prompt = data.get("prompt") if "prompt" in data else params.get("prompt")
    prompt = raw_prompt.strip() if isinstance(raw_prompt, str) else ""
    if raw_prompt is not None and not isinstance(raw_prompt, str):
        issues.append(
            {
                "node_id": node_id,
                "field": "data.prompt",
                "code": "canvas_video_prompt_invalid",
                "message": "prompt must be text when specified.",
            }
        )
    capability_contract, capability_issues = _canvas_video_reviewed_capability_issues(
        node_id=node_id,
        model=model,
        gen_type=canonical_gen_type,
        params=params,
        prompt=prompt,
        image_reference_count=len(disclosed_image_paths),
        video_reference_count=len(expected_video_paths),
        audio_reference_count=len(expected_audio_paths),
        route_context=route_context,
    )
    issues.extend(capability_issues)
    contract = {
        "media_kind": "video",
        "gen_type": canonical_gen_type or "unresolved",
        **capability_contract,
        "prompt": prompt,
        "prompt_length": len(prompt),
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest() if prompt else "",
        "dependency_node_ids": references["dependency_node_ids"],
        "resolved_image_source_node_ids": references["resolved_image_source_node_ids"],
        "resolved_video_source_node_ids": references["resolved_video_source_node_ids"],
        "resolved_audio_source_node_ids": references["resolved_audio_source_node_ids"],
        "image_reference_count": len(disclosed_image_paths),
        "video_reference_count": len(expected_video_paths),
        "audio_reference_count": len(expected_audio_paths),
        "image_references_sha256": _canvas_reference_paths_sha256(disclosed_image_paths),
        "video_references_sha256": _canvas_reference_paths_sha256(expected_video_paths),
        "audio_references_sha256": _canvas_reference_paths_sha256(expected_audio_paths),
        "unresolved_dependencies": references["unresolved_dependencies"],
    }
    return contract, issues


def _canvas_compose_generation_contract(
    node_id: str,
    node: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Validate the capability-declared composition dependency invariant."""

    params = _canvas_node_params(node)
    tracks = params.get("tracks") if isinstance(params, dict) else None
    issues: list[dict[str, Any]] = []
    if not isinstance(tracks, list) or not tracks:
        issues.append(
            {
                "node_id": node_id,
                "field": "data.params.tracks",
                "code": "canvas_compose_tracks_required",
                "message": "video_compose requires a non-empty tracks array.",
            }
        )

    material_sources = _canvas_compose_material_sources(node)
    material_node_ids = _canvas_compose_material_node_ids(node)
    declared: list[str] = []
    top_level = node.get("depends_on")
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
    nested = extra.get("depends_on")
    for value in (top_level, nested):
        if not isinstance(value, (list, tuple)):
            continue
        for item in value:
            if isinstance(item, (str, int)) and not isinstance(item, bool):
                rendered = str(item).strip()
                if rendered and rendered not in declared:
                    declared.append(rendered)
    missing = [source_id for source_id in material_node_ids if source_id not in declared]
    if missing:
        issues.append(
            {
                "node_id": node_id,
                "field": "depends_on",
                "code": "canvas_compose_dependencies_not_materialized",
                "message": (
                    "Every video_compose material.node_id must also be declared in the enclosing "
                    "Canvas node's depends_on array."
                ),
                "missing_node_ids": missing,
                "repair": {
                    "set_node_fields": {
                        "depends_on": _canvas_merge_unique_strings(declared, material_node_ids),
                    }
                },
            }
        )
    return (
        {
            "media_kind": "video",
            "gen_type": "canvas_native_compose",
            "duration": params.get("duration", "derived"),
            "quality": "not_applicable",
            "aspect_ratio": "derived",
            "audio": "track_defined",
            "create_count": 1,
            "dependency_node_ids": declared,
            "resolved_image_source_node_ids": material_sources["image"],
            "resolved_video_source_node_ids": material_sources["video"],
            "resolved_audio_source_node_ids": material_sources["audio"],
            "image_reference_count": len(material_sources["image"]),
            "video_reference_count": len(material_sources["video"]),
            "audio_reference_count": len(material_sources["audio"]),
            "image_references_sha256": _canvas_reference_paths_sha256(material_sources["image"]),
            "video_references_sha256": _canvas_reference_paths_sha256(material_sources["video"]),
            "audio_references_sha256": _canvas_reference_paths_sha256(material_sources["audio"]),
            "prompt": "",
            "prompt_length": 0,
            "prompt_sha256": "",
            "material_node_ids": material_node_ids,
        },
        issues,
    )


def _canvas_generation_targets(
    snapshot: dict[str, Any],
    node_ids: list[str],
    *,
    capability_contracts: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes = snapshot.get("nodes") if isinstance(snapshot.get("nodes"), dict) else {}
    targets: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    if not node_ids:
        return [], [
            {
                "node_id": "",
                "code": "canvas_paid_targets_empty",
                "message": "The Canvas paid command did not select any node ids.",
            }
        ]
    for node_id in node_ids:
        node = nodes.get(node_id)
        if not isinstance(node, dict):
            issues.append(
                {
                    "node_id": node_id,
                    "code": "canvas_paid_target_missing",
                    "message": "Target node is absent from the accepted graph.",
                }
            )
            continue
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        params = data.get("params") if isinstance(data.get("params"), dict) else {}
        extra = data.get("extra") if isinstance(data.get("extra"), dict) else {}
        info = node.get("info") if isinstance(node.get("info"), dict) else {}
        content_type = str(data.get("content_type") or node.get("content_type") or "").strip().lower()
        node_type = _canvas_node_type_name(node)
        model = str(
            data.get("model")
            or params.get("model")
            or extra.get("model")
            or info.get("model")
            or node.get("model")
            or ""
        ).strip()
        kind = _canvas_media_kind(content_type, node_type)
        operation_class = "native_compose" if node_type == "video_compose" else "media_generation"
        status = _canvas_node_status(node)
        render_intent = _canvas_render_intent(node, status=status)
        generation_contract: dict[str, Any] = {}
        runtime_contract = (
            capability_contracts.get(node_type)
            if capability_contracts is not None
            else None
        )
        if node_type == "video_generate":
            raw_selector = params.get("gen_type")
            selector = (
                CANVAS_VIDEO_GEN_TYPE_ALIASES.get(raw_selector.strip().lower(), raw_selector.strip().lower())
                if isinstance(raw_selector, str)
                else ""
            )
            route_context: dict[str, Any] | None = None
            if capability_contracts is not None:
                route_context, route_issues = _canvas_generation_route_context(
                    node_id=node_id,
                    node_type=node_type,
                    selector=selector,
                    contract=runtime_contract,
                )
                issues.extend(route_issues)
            generation_contract, contract_issues = _canvas_video_generation_contract(
                snapshot,
                node_id,
                node,
                route_context=route_context,
            )
            issues.extend(contract_issues)
        elif node_type == "image_generate":
            raw_selector = params.get("gen_type")
            selector = (
                raw_selector.strip().lower()
                if isinstance(raw_selector, str) and raw_selector.strip()
                else "text_to_image"
            )
            route_context = None
            if capability_contracts is not None:
                route_context, route_issues = _canvas_generation_route_context(
                    node_id=node_id,
                    node_type=node_type,
                    selector=selector,
                    contract=runtime_contract,
                )
                issues.extend(route_issues)
            generation_contract, contract_issues = _canvas_image_generation_contract(
                snapshot,
                node_id,
                node,
                model=model,
                route_context=route_context,
            )
            issues.extend(contract_issues)
        elif node_type == "audio_generate":
            raw_selector = params.get("gen_type")
            selector = raw_selector.strip().lower() if isinstance(raw_selector, str) else ""
            route_context = None
            if capability_contracts is not None:
                route_context, route_issues = _canvas_generation_route_context(
                    node_id=node_id,
                    node_type=node_type,
                    selector=selector,
                    contract=runtime_contract,
                )
                issues.extend(route_issues)
            generation_contract, contract_issues = _canvas_audio_generation_contract(
                node_id,
                node,
                model=model,
                route_context=route_context,
            )
            issues.extend(contract_issues)
        elif node_type == "text_generate":
            if capability_contracts is not None and not isinstance(runtime_contract, dict):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "node_type",
                        "code": "canvas_capability_contract_missing",
                        "message": "capabilities canvas did not return a contract for 'text_generate'.",
                    }
                )
            elif capability_contracts is not None and not _canvas_capability_contract_usable(runtime_contract):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "node_type",
                        "code": "canvas_capability_contract_unsupported",
                        "message": "The runtime Canvas contract for 'text_generate' is not executable.",
                    }
                )
            generation_contract, contract_issues = _canvas_text_generation_contract(
                node_id,
                node,
                model=model,
            )
            issues.extend(contract_issues)
        elif node_type == "video_compose":
            if capability_contracts is not None and not isinstance(runtime_contract, dict):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "node_type",
                        "code": "canvas_capability_contract_missing",
                        "message": "capabilities canvas did not return a contract for 'video_compose'.",
                    }
                )
            elif capability_contracts is not None and not _canvas_capability_contract_usable(runtime_contract):
                issues.append(
                    {
                        "node_id": node_id,
                        "field": "node_type",
                        "code": "canvas_capability_contract_unsupported",
                        "message": "The runtime Canvas contract for 'video_compose' is not executable.",
                    }
                )
            generation_contract, contract_issues = _canvas_compose_generation_contract(
                node_id,
                node,
            )
            issues.extend(contract_issues)
        targets.append(
            {
                "node_id": node_id,
                "kind": kind,
                "content_type": content_type,
                "node_type": node_type,
                "model": model,
                "operation_class": operation_class,
                "model_applicable": operation_class != "native_compose",
                "route_display": (
                    "Canvas native compose (no generation model)"
                    if operation_class == "native_compose"
                    else model or "unresolved model route"
                ),
                "render_intent": render_intent,
                "status": status,
                "status_class": _canvas_paid_status_class(status),
                "task_ids": sorted(_canvas_task_ids(node)),
                "history_ids": sorted(_canvas_history_ids(node)),
                "generation_contract": generation_contract,
            }
        )
    return targets, issues


def _canvas_render_intent(node: dict[str, Any], *, status: str) -> str:
    status_class = _canvas_paid_status_class(status)
    if status_class in {"running", "blocked"}:
        return "resume_existing"
    task_ids = _canvas_task_ids(node)
    history_ids = _canvas_history_ids(node)
    assets = _canvas_asset_references(node)
    has_existing_result = bool(history_ids or any(assets.values()))
    if status_class == "failed":
        return "retry_render"
    if status_class == "success" or has_existing_result:
        return "rerender_existing"
    if task_ids:
        return "resume_existing"
    return "first_render"


def _canvas_media_kind(content_type: str, node_type: str) -> str:
    rendered = f"{content_type} {node_type}".lower()
    if "image" in rendered:
        return "image"
    if "video" in rendered:
        return "video"
    if "audio" in rendered or "voice" in rendered or "music" in rendered:
        return "audio"
    return content_type or node_type or "unknown"


def _canvas_entitlement_issues(
    targets: list[dict[str, Any]],
    *,
    membership: str,
) -> list[dict[str, str]]:
    if membership != "basic":
        return []
    issues: list[dict[str, str]] = []
    for target in targets:
        if target.get("operation_class") == "native_compose":
            # Native composition still uses the paid account/confirmation gate,
            # but it has no image/video generation model to route or compare.
            continue
        kind = str(target.get("kind") or "")
        model = str(target.get("model") or "").strip().lower()
        required_model = ""
        if kind == "image" and model != "gemini-3.1-flash-lite":
            required_model = "gemini-3.1-flash-lite"
        elif kind == "video" and model != "v6":
            required_model = "v6"
        elif kind not in {"image", "video", "audio"}:
            required_model = "review-required"
        if required_model:
            issues.append(
                {
                    "node_id": str(target.get("node_id") or ""),
                    "kind": kind,
                    "model": model or "unknown",
                    "required_model": required_model,
                    "message": (
                        "Basic/Free Canvas image fallback requires Nano Banana 2 Lite (gemini-3.1-flash-lite)."
                        if required_model == "gemini-3.1-flash-lite"
                        else "Basic/Free Canvas video generation requires v6."
                        if required_model == "v6"
                        else "The target node's Basic/Free generation route could not be verified."
                    ),
                }
            )
    return issues


def _canvas_generation_node_ids(args: list[str]) -> list[str]:
    values = _option_value(args, "--node-ids")
    if values:
        return sorted({value.strip() for value in values.split(",") if value.strip()})
    node_id = _option_value(args, "--node-id").strip()
    return [node_id] if node_id else []


def _canvas_node_status(node: Any) -> str:
    if not isinstance(node, dict):
        return "unknown"
    for key in ("status", "task_status", "generation_status", "generate_status", "state"):
        value = node.get(key)
        if isinstance(value, (str, int)) and not isinstance(value, bool):
            rendered = str(value).strip()
            if rendered:
                return rendered
    for key in ("data", "info", "extra", "result", "task"):
        nested = node.get(key)
        rendered = _canvas_node_status(nested)
        if rendered != "unknown":
            return rendered
    return "unknown"


def _canvas_task_ids(value: Any) -> set[str]:
    task_ids: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"task_id", "asset_id", "video_id", "image_id", "audio_id"}:
                if isinstance(item, (str, int)) and not isinstance(item, bool) and str(item).strip():
                    task_ids.add(str(item).strip())
                continue
            if key == "task_ids" and isinstance(item, (list, tuple)):
                task_ids.update(
                    str(candidate).strip()
                    for candidate in item
                    if isinstance(candidate, (str, int))
                    and not isinstance(candidate, bool)
                    and str(candidate).strip()
                )
                continue
            task_ids.update(_canvas_task_ids(item))
    elif isinstance(value, (list, tuple)):
        for item in value:
            task_ids.update(_canvas_task_ids(item))
    return task_ids


def _canvas_history_ids(value: Any) -> set[str]:
    history_ids: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "history_id":
                if isinstance(item, (str, int)) and not isinstance(item, bool) and str(item).strip():
                    history_ids.add(str(item).strip())
                continue
            history_ids.update(_canvas_history_ids(item))
    elif isinstance(value, (list, tuple)):
        for item in value:
            history_ids.update(_canvas_history_ids(item))
    return history_ids


def _canvas_receipt_values(value: Any, keys: set[str]) -> tuple[set[str], bool]:
    values: set[str] = set()
    found = False
    if isinstance(value, dict):
        for key, item in value.items():
            if key in keys:
                found = True
                candidates = item if isinstance(item, (list, tuple)) else [item]
                values.update(
                    str(candidate).strip()
                    for candidate in candidates
                    if isinstance(candidate, (str, int))
                    and not isinstance(candidate, bool)
                    and str(candidate).strip()
                )
            if isinstance(item, (dict, list, tuple)):
                nested_values, nested_found = _canvas_receipt_values(item, keys)
                values.update(nested_values)
                found = found or nested_found
    elif isinstance(value, (list, tuple)):
        for item in value:
            nested_values, nested_found = _canvas_receipt_values(item, keys)
            values.update(nested_values)
            found = found or nested_found
    return values, found


def _canvas_receipt_scalar(value: Any, keys: set[str]) -> str:
    if not isinstance(value, dict):
        return ""
    for key, item in value.items():
        if key in keys and isinstance(item, (str, int)) and not isinstance(item, bool):
            rendered = str(item).strip()
            if rendered:
                return rendered
    for item in value.values():
        if isinstance(item, dict):
            rendered = _canvas_receipt_scalar(item, keys)
            if rendered:
                return rendered
    return ""


def _canvas_receipt_boolean(value: Any, keys: set[str]) -> bool | None:
    if not isinstance(value, dict):
        return None
    for key, item in value.items():
        if key in keys and isinstance(item, bool):
            return item
    for item in value.values():
        if isinstance(item, dict):
            rendered = _canvas_receipt_boolean(item, keys)
            if rendered is not None:
                return rendered
    return None


def _canvas_command_receipt(mutation_result: CommandResult) -> tuple[dict[str, Any], str]:
    """Read one exact JSON receipt, including CLIs that emit errors on stderr."""

    for source, output in (("stdout", mutation_result.stdout), ("stderr", mutation_result.stderr)):
        if not output.strip():
            continue
        try:
            payload = json.loads(output)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and payload:
            return payload, source
    return {}, ""


def _canvas_receipt_errors(receipt: dict[str, Any]) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    values = receipt.get("errors")
    if isinstance(values, list):
        errors.extend(item for item in values if isinstance(item, dict))
    for key in ("data", "result"):
        nested = receipt.get(key)
        if isinstance(nested, dict):
            errors.extend(_canvas_receipt_errors(nested))
    return errors


def _canvas_receipt_error_node_id(error: dict[str, Any], target_ids: set[str]) -> str:
    direct = error.get("node_id")
    if isinstance(direct, (str, int)) and not isinstance(direct, bool):
        rendered = str(direct).strip()
        if rendered in target_ids:
            return rendered
    field = str(error.get("field") or "")
    for node_id in target_ids:
        node_field = f"nodes.{node_id}"
        if (
            field == node_id
            or field == node_field
            or field.startswith(f"{node_field}.")
            or field.startswith(f"{node_field}[")
        ):
            return node_id
    return ""


def _canvas_deterministic_validation_rejection(
    context: dict[str, Any],
    mutation_result: CommandResult,
    receipt: dict[str, Any],
    *,
    dispatch_status: str,
    dispatched_node_ids: set[str],
    new_task_ids: set[str],
    new_history_ids: set[str],
    rerun: bool | None,
) -> bool:
    """Prove that every selected node was rejected before paid generation started."""

    if (
        mutation_result.ok
        or mutation_result.timed_out
        or dispatch_status not in {"failed", "rejected", "invalid", "invalid_param"}
        or dispatched_node_ids
        or new_task_ids
        or new_history_ids
        or rerun is True
    ):
        return False
    target_ids = {
        str(node_id).strip()
        for node_id in context.get("node_ids", [])
        if isinstance(node_id, (str, int))
        and not isinstance(node_id, bool)
        and str(node_id).strip()
    }
    if not target_ids:
        return False
    errors = _canvas_receipt_errors(receipt)
    rejected_targets: set[str] = set()
    for error in errors:
        normalized = " ".join(
            str(error.get(key) or "") for key in ("code", "error", "message")
        ).strip().lower().replace("-", "_")
        if not any(
            marker in normalized
            for marker in (
                "invalid param",
                "invalid_param",
                "invalid parameter",
                "validation error",
                "validation_error",
            )
        ):
            continue
        node_id = _canvas_receipt_error_node_id(error, target_ids)
        if node_id:
            rejected_targets.add(node_id)
    return rejected_targets == target_ids


def _canvas_paid_submission_evidence(
    context: dict[str, Any],
    mutation_result: CommandResult,
) -> dict[str, Any]:
    receipt, receipt_source = _canvas_command_receipt(mutation_result)
    dispatched_node_ids, dispatched_field_present = _canvas_receipt_values(
        receipt, {"dispatched_node_ids"}
    )
    deferred_node_ids, _ = _canvas_receipt_values(receipt, {"deferred_node_ids"})
    skipped_node_ids, _ = _canvas_receipt_values(receipt, {"skipped_node_ids"})
    receipt_task_ids = _canvas_task_ids(receipt)
    receipt_history_ids = _canvas_history_ids(receipt)
    baseline_task_ids = {
        str(task_id)
        for target in context.get("targets", [])
        if isinstance(target, dict)
        for task_id in target.get("task_ids", [])
    }
    baseline_history_ids = {
        str(history_id)
        for target in context.get("targets", [])
        if isinstance(target, dict)
        for history_id in target.get("history_ids", [])
    }
    new_receipt_task_ids = receipt_task_ids - baseline_task_ids
    new_receipt_history_ids = receipt_history_ids - baseline_history_ids
    dispatch_status = _canvas_receipt_scalar(
        receipt, {"dispatch_status", "generation_status", "submission_status"}
    ).lower()
    rerun = _canvas_receipt_boolean(receipt, {"rerun", "generation_started", "dispatched"})
    operation = str(context.get("operation") or "")
    deterministic_rejection = _canvas_deterministic_validation_rejection(
        context,
        mutation_result,
        receipt,
        dispatch_status=dispatch_status,
        dispatched_node_ids=dispatched_node_ids,
        new_task_ids=new_receipt_task_ids,
        new_history_ids=new_receipt_history_ids,
        rerun=rerun,
    )
    if dispatched_node_ids or new_receipt_task_ids or new_receipt_history_ids:
        generation_state = "started"
    elif deterministic_rejection:
        generation_state = "not_started"
    elif dispatch_status in {"skipped", "no_ready_nodes", "no_ready", "not_dispatched"}:
        generation_state = "not_started"
    elif dispatched_field_present:
        generation_state = "not_started"
    elif rerun is True:
        generation_state = "started"
    elif rerun is False:
        generation_state = "not_started"
    elif dispatch_status in {"dispatched", "started", "submitted", "success", "succeeded"}:
        generation_state = "started"
    elif not mutation_result.ok:
        # A non-zero CLI result without explicit non-dispatch evidence can be a
        # transport failure after the server accepted the paid request. Keep it
        # reconcilable and never present it as safe to resubmit.
        generation_state = "unknown"
    elif operation.endswith("canvas node rerun"):
        generation_state = "unknown"
    else:
        generation_state = "unknown"
    reconcile_node_ids = (
        sorted(dispatched_node_ids)
        if dispatched_node_ids
        else []
        if generation_state in {"not_started", "submission_failed"}
        else list(context.get("node_ids") or [])
    )
    return {
        "returncode": mutation_result.returncode,
        "generation_state": generation_state,
        "generation_started": True
        if generation_state == "started"
        else False
        if generation_state in {"not_started", "submission_failed"}
        else None,
        "dispatch_status": dispatch_status,
        "receipt_source": receipt_source,
        "receipt_error_count": len(_canvas_receipt_errors(receipt)),
        "rejection_class": "deterministic_validation" if deterministic_rejection else "",
        "dispatched_node_ids": sorted(dispatched_node_ids),
        "deferred_node_ids": sorted(deferred_node_ids),
        "skipped_node_ids": sorted(skipped_node_ids),
        "reconcile_node_ids": reconcile_node_ids,
        "task_ids": sorted(receipt_task_ids),
        "new_task_ids": sorted(new_receipt_task_ids),
        "history_ids": sorted(receipt_history_ids),
        "new_history_ids": sorted(new_receipt_history_ids),
        "receipt_edit_version": _canvas_edit_version_from_output(json.dumps(receipt)),
    }


def _canvas_paid_status_attribution(
    context: dict[str, Any],
    status_details: dict[str, dict[str, Any]],
    node_ids: list[str],
) -> dict[str, Any]:
    baselines = {
        str(target.get("node_id") or ""): target
        for target in context.get("targets", [])
        if isinstance(target, dict) and str(target.get("node_id") or "")
    }
    submission = context.get("submission") if isinstance(context.get("submission"), dict) else {}
    receipt_task_ids = {str(item) for item in submission.get("new_task_ids", []) if str(item)}
    receipt_history_ids = {
        str(item) for item in submission.get("new_history_ids", []) if str(item)
    }
    nodes: dict[str, Any] = {}
    all_task_ids: set[str] = set()
    all_history_ids: set[str] = set()
    identifier_nodes = 0
    expected_cli_run_id = str(context.get("cli_run_id") or "").strip()
    complete = bool(node_ids)
    for node_id in node_ids:
        detail = status_details.get(node_id) if isinstance(status_details.get(node_id), dict) else {}
        baseline = baselines.get(node_id) if isinstance(baselines.get(node_id), dict) else {}
        task_baseline_complete = "task_ids" in baseline
        history_baseline_complete = "history_ids" in baseline
        baseline_task_ids = {str(item) for item in baseline.get("task_ids", []) if str(item)}
        baseline_history_ids = {str(item) for item in baseline.get("history_ids", []) if str(item)}
        current_task_ids = _canvas_task_ids(detail)
        current_history_ids = _canvas_history_ids(detail)
        identifiers_returned = bool(current_task_ids or current_history_ids)
        if identifiers_returned:
            identifier_nodes += 1
        new_task_ids = current_task_ids - baseline_task_ids if task_baseline_complete else set()
        new_history_ids = (
            current_history_ids - baseline_history_ids if history_baseline_complete else set()
        )
        matched_receipt_task_ids = current_task_ids & receipt_task_ids
        matched_receipt_history_ids = current_history_ids & receipt_history_ids
        current_cli_run_id = str(detail.get("run_id") or "").strip()
        matched_cli_run_id = bool(
            expected_cli_run_id and current_cli_run_id == expected_cli_run_id
        )
        run_id_conflict = bool(
            expected_cli_run_id
            and current_cli_run_id
            and current_cli_run_id != expected_cli_run_id
        )
        receipt_match = bool(matched_receipt_task_ids or matched_receipt_history_ids)
        if run_id_conflict:
            attributed = False
            attribution_source = "run_id_conflict"
        elif matched_cli_run_id:
            attributed = True
            attribution_source = "matching_cli_run_id"
        elif expected_cli_run_id:
            attributed = receipt_match
            attribution_source = "receipt_id_match" if receipt_match else "unattributed"
        else:
            # Legacy ledgers created before wrapper-owned CLI run ids can only use
            # baseline/receipt evidence. New submissions always take the stricter
            # branches above, so an unrelated concurrent task is not attributed.
            attributed = bool(receipt_match or new_task_ids or new_history_ids)
            attribution_source = "legacy_id_fallback" if attributed else "unattributed"
        complete = complete and attributed
        if attributed:
            if matched_cli_run_id:
                # Some CLI releases return a matching run_id but omit receipt IDs.
                # In that exact-match case, complete baseline deltas are owned by
                # this submission. Prefer explicit receipt intersections whenever
                # they exist so unrelated IDs are not widened unnecessarily.
                all_task_ids.update(
                    matched_receipt_task_ids
                    or (new_task_ids if task_baseline_complete else set())
                )
                all_history_ids.update(
                    matched_receipt_history_ids
                    or (new_history_ids if history_baseline_complete else set())
                )
            elif expected_cli_run_id:
                all_task_ids.update(matched_receipt_task_ids)
                all_history_ids.update(matched_receipt_history_ids)
            else:
                all_task_ids.update(matched_receipt_task_ids or new_task_ids)
                all_history_ids.update(matched_receipt_history_ids or new_history_ids)
        nodes[node_id] = {
            "attributed": attributed,
            "attribution_source": attribution_source,
            "task_baseline_complete": task_baseline_complete,
            "history_baseline_complete": history_baseline_complete,
            "expected_cli_run_id": expected_cli_run_id,
            "current_cli_run_id": current_cli_run_id,
            "matched_cli_run_id": matched_cli_run_id,
            "run_id_conflict": run_id_conflict,
            "baseline_task_ids": sorted(baseline_task_ids),
            "baseline_history_ids": sorted(baseline_history_ids),
            "current_task_ids": sorted(current_task_ids),
            "current_history_ids": sorted(current_history_ids),
            "new_task_ids": sorted(new_task_ids),
            "new_history_ids": sorted(new_history_ids),
            "matched_receipt_task_ids": sorted(matched_receipt_task_ids),
            "matched_receipt_history_ids": sorted(matched_receipt_history_ids),
            "canvas_identifiers_returned": identifiers_returned,
            "canvas_identifier_status": (
                "available" if identifiers_returned else "not_returned_by_canvas_status"
            ),
        }
    identifier_coverage = (
        "complete"
        if node_ids and identifier_nodes == len(node_ids)
        else "partial"
        if identifier_nodes
        else "none"
    )
    return {
        "complete": complete,
        "canvas_identifier_coverage": identifier_coverage,
        "nodes": nodes,
        "task_ids": sorted(all_task_ids),
        "history_ids": sorted(all_history_ids),
    }


def _canvas_asset_references(value: Any) -> dict[str, list[str]]:
    references: dict[str, set[str]] = {
        "asset_ids": set(),
        "history_ids": set(),
        "paths": set(),
        "urls": set(),
    }

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key, nested in item.items():
                if isinstance(nested, (str, int)) and not isinstance(nested, bool):
                    rendered = str(nested).strip()
                    if not rendered:
                        continue
                    if key in {"asset_id", "video_id", "image_id", "audio_id"}:
                        references["asset_ids"].add(rendered)
                    elif key == "history_id":
                        references["history_ids"].add(rendered)
                    elif key in {"path", "file_path", "media_path", "provider_path", "thumbnail_path"}:
                        references["paths"].add(rendered[:1000])
                    elif key in {
                        "url",
                        "cover_url",
                        "download_url",
                        "thumbnail_url",
                        "h264_hls_720p_url",
                        "h264_mp4_720p_url",
                    }:
                        references["urls"].add(rendered[:1000])
                elif isinstance(nested, (dict, list, tuple)):
                    visit(nested)
        elif isinstance(item, (list, tuple)):
            for nested in item:
                visit(nested)

    visit(value)
    return {key: sorted(values) for key, values in references.items()}


def _append_canvas_paid_event(
    context: dict[str, Any],
    event: str,
    **payload: Any,
) -> None:
    path = Path(str(context["ledger_path"]))
    record = {
        "schema_version": CANVAS_PAID_RUN_SCHEMA_VERSION,
        "event": f"canvas.paid.{event}",
        "at": utc_now(),
        "run_id": context["run_id"],
        "project_id": context["project_id"],
        "operation": context["operation"],
        "node_ids": context["node_ids"],
        **payload,
    }
    if context.get("confirmation_plan_id"):
        record["confirmation_plan_id"] = context["confirmation_plan_id"]
    if event == "submission_started":
        record["preflight"] = {
            key: value
            for key, value in context.items()
            if key not in {"run_id", "ledger_path"}
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def _record_canvas_paid_submission(
    context: dict[str, Any],
    mutation_result: CommandResult,
) -> dict[str, Any]:
    evidence = _canvas_paid_submission_evidence(context, mutation_result)
    context["submission"] = evidence
    try:
        _append_canvas_paid_event(
            context,
            "submission_result",
            mutation_executed=True,
            **evidence,
            timings=dict(context.get("timings") or {}),
            stdout_sha256=hashlib.sha256(mutation_result.stdout.encode("utf-8")).hexdigest(),
            stderr_sha256=hashlib.sha256(mutation_result.stderr.encode("utf-8")).hexdigest(),
        )
    except OSError as exc:
        print(
            f"[pixverse-agent canvas-paid] Could not append submission result to {context['ledger_path']}: {exc}",
            file=sys.stderr,
            flush=True,
        )
    if evidence["generation_state"] == "unknown":
        print(
            "[pixverse-agent canvas-paid] Submission outcome is unknown and may already be billed. "
            f"Do not resubmit; reconcile durable run {context['run_id']} instead.",
            file=sys.stderr,
            flush=True,
        )
    elif evidence.get("rejection_class") == "deterministic_validation":
        print(
            "[pixverse-agent canvas-paid] Every selected node was rejected by parameter validation "
            "before generation started. Do not wait for attribution; fix the reported fields and run "
            "a fresh paid preflight.",
            file=sys.stderr,
            flush=True,
        )
    return evidence


def _finalize_canvas_paid_run(
    context: dict[str, Any],
    *,
    mutation_result: CommandResult,
    post_snapshot: dict[str, Any] | None,
    verification_status: str,
    status_details: dict[str, dict[str, Any]] | None = None,
    observe_credits: bool = False,
) -> dict[str, Any]:
    try:
        receipt = json.loads(mutation_result.stdout) if mutation_result.stdout.strip() else {}
    except json.JSONDecodeError:
        receipt = {}
    submission = context.get("submission") if isinstance(context.get("submission"), dict) else {}
    generation_state = str(submission.get("generation_state") or "unknown")
    baseline_task_ids = {
        str(task_id)
        for target in context.get("targets", [])
        if isinstance(target, dict)
        for task_id in target.get("task_ids", [])
    }
    task_ids = set(str(item) for item in submission.get("new_task_ids", []) if str(item))
    task_ids.update(_canvas_task_ids(receipt) - baseline_task_ids)
    nodes = (
        post_snapshot.get("nodes")
        if post_snapshot is not None and isinstance(post_snapshot.get("nodes"), dict)
        else {}
    )
    effective_status_details = dict(status_details or {})
    raw_attribution = effective_status_details.get("_attribution", {})
    if not isinstance(raw_attribution, dict):
        raw_attribution = {}
    if not raw_attribution and nodes:
        raw_attribution = _canvas_paid_status_attribution(
            context,
            {str(node_id): node for node_id, node in nodes.items() if isinstance(node, dict)},
            [str(node_id) for node_id in context.get("node_ids", [])],
        )
        effective_status_details["_attribution"] = raw_attribution
    attributed_task_ids = {
        str(item)
        for item in raw_attribution.get("task_ids", [])
        if str(item)
    }
    task_ids.update(attributed_task_ids)
    asset_ledger: list[dict[str, Any]] = []
    if post_snapshot is not None:
        for node_id in context.get("node_ids", []):
            node = nodes.get(node_id)
            if not isinstance(node, dict):
                asset_ledger.append(
                    {"node_id": node_id, "status": "missing", "task_ids": [], "assets": {}}
                )
                continue
            node_task_ids = _canvas_task_ids(node)
            candidate_node_task_ids = node_task_ids - baseline_task_ids
            new_node_task_ids = candidate_node_task_ids & attributed_task_ids
            task_ids.update(new_node_task_ids)
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            params = data.get("params") if isinstance(data.get("params"), dict) else {}
            info = node.get("info") if isinstance(node.get("info"), dict) else {}
            asset_ledger.append(
                {
                    "node_id": node_id,
                    "status": _canvas_node_status(node),
                    "content_type": data.get("content_type") or "",
                    "node_type": info.get("node_type") or "",
                    "model": data.get("model") or params.get("model") or "",
                    "task_ids": sorted(node_task_ids),
                    "new_task_ids": sorted(new_node_task_ids),
                    "assets": _canvas_asset_references(node),
                }
            )

    pre_account = context.get("account") if isinstance(context.get("account"), dict) else {}
    pre_credits = pre_account.get("credits_total")
    billing_started = time.monotonic()
    if observe_credits:
        # Canvas only needs the run-level credit delta for ordinary reporting.
        # Do not query account usage or match usage rows to task ids here: that
        # extra endpoint is slower, can settle late, and is unnecessary when the
        # user only needs the credits consumed by the isolated Canvas run.
        post_billing = billing_snapshot(
            usage_limit=0,
            include_slots=False,
            include_model_catalogs=False,
        )
        post_account = post_billing.get("account") if isinstance(post_billing.get("account"), dict) else {}
        billing_context = _canvas_billing_context(pre_account, post_account)
        post_credits = post_account.get("credits_total")
        observed_delta = (
            pre_credits - post_credits
            if billing_context["state"] != "mismatch"
            and isinstance(pre_credits, int)
            and isinstance(post_credits, int)
            else None
        )
        credits_consumed = (
            observed_delta
            if isinstance(observed_delta, int) and observed_delta > 0
            else 0
            if generation_state in {"not_started", "submission_failed"}
            and observed_delta == 0
            else None
        )
        credits_source = (
            "account_balance_delta" if credits_consumed is not None else "unavailable"
        )
        settlement_state = (
            "not_started"
            if generation_state == "not_started"
            else "submission_failed"
            if generation_state == "submission_failed"
            else "billing_context_mismatch"
            if billing_context["state"] == "mismatch"
            else "credits_observed"
            if credits_consumed is not None
            else "pending_credit_observation"
        )
    else:
        post_billing = {"checked_at": "", "issues": []}
        billing_context = {
            "state": "not_observed",
            "mismatches": [],
            "expected_account_fingerprint": str(pre_account.get("account_fingerprint") or ""),
            "observed_account_fingerprint": "",
            "expected_workspace_id": str(pre_account.get("workspace_id") or ""),
            "observed_workspace_id": "",
        }
        post_credits = None
        observed_delta = None
        credits_consumed = None
        credits_source = "deferred_until_terminal" if context.get("credits_requested") else "not_requested"
        settlement_state = "pending_generation" if context.get("credits_requested") else "not_requested"
    billing_wall_seconds = round(time.monotonic() - billing_started, 3)
    context_timings = dict(context.get("timings") or {})
    context_timings["billing_seconds"] = billing_wall_seconds
    billing_summary = {
        "snapshot_at": post_billing.get("checked_at") or "",
        "pre_credits_total": pre_credits,
        "post_credits_total": post_credits,
        "observed_credit_delta": observed_delta,
        "credits_consumed": credits_consumed,
        "credits_source": credits_source,
        # Retained as an empty compatibility field for existing ledger readers.
        "usage_credits_by_task_id": {},
        "context": billing_context,
        "snapshot_issues": post_billing.get("issues", []),
        "settlement_state": settlement_state,
        "observation_deferred": bool(context.get("credits_requested")) and not observe_credits,
    }
    cloud_outputs = canvas_cloud_nodes(post_snapshot or {}, node_ids=list(context.get("node_ids") or []))
    for output in cloud_outputs:
        detail = effective_status_details.get(output["node_id"])
        if isinstance(detail, dict) and detail.get("derived_state"):
            output["status"] = detail["derived_state"]
    try:
        _append_canvas_paid_event(
            context,
            "reconciliation",
            verification_status=verification_status,
            generation_state=generation_state,
            generation_status=context.get("generation_status") or _canvas_paid_snapshot_generation_status(context, post_snapshot),
            observed_edit_version=post_snapshot.get("edit_version") if post_snapshot else None,
            cloud_outputs=cloud_outputs,
            download_status=context.get("download_status", "not_requested"),
            task_ids=sorted(task_ids),
            status_details=effective_status_details,
            status_counts=dict(context.get("status_counts") or {}),
            succeeded_node_ids=list(context.get("succeeded_node_ids") or []),
            failed_node_ids=list(context.get("failed_node_ids") or []),
            downstream_ready_node_ids=list(context.get("succeeded_node_ids") or []),
            asset_ledger=asset_ledger,
            localized_assets=list(context.get("localized_assets") or []),
            billing=billing_summary,
            timings=context_timings,
        )
        recovery_message = (
            "The full target batch was rejected before generation; fix the reported parameters, sync, "
            "and run a fresh paid preflight. No attribution wait is required."
            if generation_state == "not_started"
            and submission.get("rejection_class") == "deterministic_validation"
            else (
                "Use `"
                f"{pvx_command()} canvas paid reconcile --run-id {context['run_id']}` "
                "for status recovery; add --credits only when credit reporting is requested."
            )
        )
        print(
            "[pixverse-agent canvas-paid] Durable run recorded: "
            f"{context['run_id']} ({settlement_state}) at {context['ledger_path']}. "
            f"{recovery_message}",
            file=sys.stderr,
            flush=True,
        )
    except OSError as exc:
        print(
            f"[pixverse-agent canvas-paid] Reconciliation could not be recorded at {context['ledger_path']}: {exc}",
            file=sys.stderr,
            flush=True,
        )
    return billing_summary


def _canvas_billing_context(
    pre_account: dict[str, Any],
    post_account: dict[str, Any],
) -> dict[str, Any]:
    def identifier(value: Any) -> str:
        return "" if value is None else str(value).strip()

    pre_fingerprint = identifier(pre_account.get("account_fingerprint"))
    post_fingerprint = identifier(post_account.get("account_fingerprint"))
    pre_workspace_id = identifier(pre_account.get("workspace_id"))
    post_workspace_id = identifier(post_account.get("workspace_id"))
    mismatches: list[str] = []
    if pre_fingerprint and post_fingerprint != pre_fingerprint:
        mismatches.append("account_fingerprint")
    if pre_workspace_id and post_workspace_id != pre_workspace_id:
        mismatches.append("workspace_id")
    state = "mismatch" if mismatches else "verified" if pre_fingerprint or pre_workspace_id else "legacy_unverified"
    return {
        "state": state,
        "mismatches": mismatches,
        "expected_account_fingerprint": pre_fingerprint,
        "observed_account_fingerprint": post_fingerprint,
        "expected_workspace_id": pre_workspace_id,
        "observed_workspace_id": post_workspace_id,
    }


def _requests_json_output(args: list[str]) -> bool:
    return "--json" in args or "-p" in args


def _option_value(args: list[str], option: str) -> str:
    value = ""
    for index, arg in enumerate(args):
        if arg == "--":
            break
        if arg == option and index + 1 < len(args) and args[index + 1] != "--":
            value = args[index + 1]
        elif arg.startswith(f"{option}="):
            value = arg.partition("=")[2]
    return value


def _option_is_present(args: list[str], option: str) -> bool:
    return any(arg == option or arg.startswith(f"{option}=") for arg in args)


def _replace_option_value(
    args: list[str],
    option: str,
    value: str | None,
) -> list[str]:
    """Remove every caller-provided option occurrence and optionally append one owned value."""

    replaced: list[str] = []
    index = 0
    while index < len(args):
        arg = args[index]
        if arg == option:
            index += 1
            if index < len(args) and not args[index].startswith("-"):
                index += 1
            continue
        if arg.startswith(f"{option}="):
            index += 1
            continue
        replaced.append(arg)
        index += 1
    if value is not None:
        replaced.extend([option, value])
    return replaced


def _integer_option(args: list[str], option: str) -> int | None:
    value = _option_value(args, option)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _emit_canvas_version_error(
    *,
    project_id: str,
    current_edit_version: int,
    supplied_edit_version: int | None,
    source: str,
    json_output: bool,
) -> int:
    error = "canvas_edit_version_required" if supplied_edit_version is None else "canvas_edit_conflict"
    message = (
        f"{source} must equal the current Canvas edit_version ({current_edit_version}). "
        "Read and review the latest graph, then rebuild the patch or command. Do not replace only the version "
        "on a mutation built from an older graph."
    )
    return _emit_canvas_guard_error(
        {
            "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
            "error": error,
            "message": message,
            "project_id": project_id,
            "version_source": source,
            "supplied_edit_version": supplied_edit_version,
            "current_edit_version": current_edit_version,
            "mutation_executed": False,
            "next_steps": [
                f"{pvx_command()} canvas sync --project-id {shlex.quote(project_id)} --format markdown",
                "Rebuild the mutation from the accepted graph snapshot.",
            ],
        },
        json_output=json_output,
    )


def _emit_canvas_guard_error(
    payload: dict[str, Any],
    *,
    json_output: bool,
    returncode: int = 2,
) -> int:
    if json_output:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(f"[pixverse-agent canvas-sync] {payload.get('message', payload.get('error'))}", file=sys.stderr)
        if payload.get("subscription_link"):
            print(f"- {payload['subscription_link']}", file=sys.stderr)
            print(f"- {payload.get('quality_notice', '')}", file=sys.stderr)
        for step in payload.get("next_steps", []):
            print(f"- {step}", file=sys.stderr)
    return returncode


def _canvas_post_read_warning(project_id: str, message: str) -> None:
    print(
        f"[pixverse-agent canvas-sync] mutation_applied_verification_unknown for project {project_id}: {message}",
        file=sys.stderr,
        flush=True,
    )


def _canvas_project_id_from_output(stdout: str, stderr: str = "") -> str:
    rendered = stdout.strip()
    if rendered:
        try:
            payload = json.loads(rendered)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            candidates = [payload.get("project_id")]
            for key in ("data", "result"):
                nested = payload.get(key)
                if isinstance(nested, dict):
                    candidates.append(nested.get("project_id"))
            for project_id in candidates:
                if isinstance(project_id, (str, int)) and not isinstance(project_id, bool):
                    normalized = str(project_id).strip()
                    if normalized:
                        return normalized
    match = re.search(
        r"(?im)^\s*(?:project[_ ]?id|project)\s*[:=]\s*([^\s]+)\s*$",
        "\n".join(part for part in (stdout, stderr) if part),
    )
    return match.group(1).strip() if match else ""


def _relay_command_result(result: CommandResult) -> None:
    if result.stdout:
        sys.stdout.write(result.stdout)
        sys.stdout.flush()
    if result.stderr:
        sys.stderr.write(result.stderr)
        sys.stderr.flush()


def _run_canvas_project_create(args: list[str]) -> int:
    binding_path = canvas_project_binding_path()
    state_path = canvas_sync_state_path(binding_path=binding_path)
    try:
        with canvas_sync_lock(state_path):
            return _run_canvas_project_create_locked(args, binding_path=binding_path)
    except CanvasSyncLockError as exc:
        return _emit_canvas_guard_error(
            {
                "schema_version": CANVAS_SYNC_GUARD_SCHEMA_VERSION,
                "error": "canvas_sync_lock_timeout",
                "message": str(exc),
                "project_id": "",
                "state_path": str(state_path),
                "mutation_executed": False,
            },
            json_output=_requests_json_output(args),
        )


def _run_canvas_project_create_locked(args: list[str], *, binding_path: Path) -> int:
    creation_attempt_id = uuid.uuid4().hex
    if not _remember_canvas_project_creation_started(
        creation_attempt_id,
        binding_path=binding_path,
    ):
        print(
            "[pixverse-agent] Explicit Canvas project creation was stopped before contacting PixVerse "
            "because its durable creation intent could not be saved.",
            file=sys.stderr,
            flush=True,
        )
        return 2
    result = run_captured(
        ["pixverse", *args],
        timeout=CANVAS_MUTATION_TIMEOUT_SECONDS,
    )
    _relay_command_result(result)
    if not result.ok:
        _remember_canvas_project_creation_unresolved(binding_path=binding_path)
        return result.returncode
    project_id = _canvas_project_id_from_output(result.stdout, result.stderr)
    if not project_id:
        _remember_canvas_project_creation_unresolved(binding_path=binding_path)
        print(
            "[pixverse-agent] Canvas project was created, but its project_id could not be read; "
            "the local binding was marked unresolved to prevent a duplicate automatic create. "
            "Do not retry project creation; recover the created project id first.",
            file=sys.stderr,
            flush=True,
        )
        return 2
    if not _remember_canvas_project_id(project_id, binding_path=binding_path):
        _canvas_project_binding_update_failed(
            project_id,
            message=(
                "Canvas project creation already returned success, but the durable local binding could not "
                "be saved. Do not retry project creation; repair the local binding with this project id."
            ),
        )
        return 2
    return result.returncode


def _canvas_project_binding_update_failed(project_id: str, *, message: str) -> None:
    print(
        "[pixverse-agent] canvas_project_binding_update_failed for project "
        f"{project_id}: {message}",
        file=sys.stderr,
        flush=True,
    )


def _bind_explicit_canvas_project_before_remote(
    project_id: str,
    *,
    binding_path: Path,
) -> bool:
    if _remember_canvas_project_id(project_id, binding_path=binding_path):
        return True
    _canvas_project_binding_update_failed(
        project_id,
        message=(
            "The explicit Canvas project could not be persisted locally, so the command was stopped "
            "before contacting PixVerse. Repair local storage, then select this project again."
        ),
    )
    return False


def _remember_canvas_project_id(project_id: str, *, binding_path: Path) -> bool:
    try:
        remember_canvas_project_id(project_id, path=binding_path)
    except OSError as exc:
        print(
            f"[pixverse-agent] Could not save Canvas project binding: {exc}",
            file=sys.stderr,
            flush=True,
        )
        return False
    return True


def _remember_canvas_project_creation_started(
    attempt_id: str,
    *,
    binding_path: Path,
) -> bool:
    try:
        remember_canvas_project_creation_started(attempt_id=attempt_id, path=binding_path)
    except OSError as exc:
        print(
            f"[pixverse-agent] Could not save Canvas creation intent: {exc}",
            file=sys.stderr,
            flush=True,
        )
        return False
    return True


def _remember_canvas_project_creation_unresolved(*, binding_path: Path) -> bool:
    try:
        remember_canvas_project_creation_unresolved(path=binding_path)
    except OSError as exc:
        print(
            f"[pixverse-agent] Could not save unresolved Canvas creation state: {exc}",
            file=sys.stderr,
            flush=True,
        )
        return False
    return True


def _default_canvas_project_name(*, binding_path: Path | None = None) -> str:
    binding = binding_path or canvas_project_binding_path()
    projects_root = repo_root() / "projects"
    if binding.parent != projects_root:
        return binding.parent.name
    return "Agent Project"


def _canvas_project_url(project_id: str) -> str:
    return f"{CANVAS_PROJECT_WEB_BASE_URL}/{quote(str(project_id).strip(), safe='')}"


def _open_web_url(url: str, *, label: str) -> bool:
    try:
        opened = webbrowser.open(url, new=0, autoraise=True)
    except (OSError, webbrowser.Error):
        opened = False
    if not opened:
        print(
            f"[pixverse-agent] Could not open {label} in the system browser; open {url}",
            file=sys.stderr,
            flush=True,
        )
    return opened


def _is_direct_paid_create(args: list[str]) -> bool:
    if args[:1] != ["create"]:
        return False
    if len(args) < 2 or args[1] == "help":
        return False
    return args[1] in PAID_CREATE_COMMANDS and not _is_direct_paid_create_help(args)


def _direct_create_queue_steps(args: list[str]) -> list[str]:
    queue_path = "projects/<slug>/queue.json"
    task_id = "<task-id>"
    command = shlex.join(["pixverse", *args])
    pvx = pvx_command()
    return [
        f"{pvx} queue write {queue_path} --project <slug> --id {task_id} -- {command}",
        f"{pvx} quote queue {queue_path} --format markdown",
        f"{pvx} queue run {queue_path}",
    ]


def _bootstrap(yes: bool) -> int:
    if not pillow_status()["ok"]:
        if not yes:
            print("Missing: Pillow. Run `pvx bootstrap --yes` to install dependencies.")
            return 1
        try:
            ensure_pillow()
        except PythonDependencyError as exc:
            print(json.dumps({"error": "dependency_install_failed", "component": "Pillow",
                              "message": str(exc)}, indent=2))
            return 1
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        return _bootstrap_internal(yes)
    return _bootstrap_online(yes)


def _bootstrap_internal(yes: bool) -> int:
    try:
        artifact = pixverse_cli_internal_artifact()
    except InternalCliError as exc:
        print(
            json.dumps(
                {
                    "error": "internal_cli_artifact_invalid",
                    "channel": INTERNAL_CLI_CHANNEL,
                    "source": "bundled-zip",
                    "message": str(exc),
                    "runtime": str(pixverse_cli_runtime_root()),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    if artifact is None:
        print(
            json.dumps(
                {
                    "error": "internal_cli_artifact_missing",
                    "channel": INTERNAL_CLI_CHANNEL,
                    "message": "The local plugin does not contain an internal CLI ZIP.",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1

    node = which("node")
    npm = which("npm")
    missing: list[str] = []
    node_version = ""
    if not node:
        missing.append(f"node{artifact.node_requirement}")
    else:
        try:
            node_result = run(["node", "--version"], timeout=20)
        except subprocess.TimeoutExpired:
            node_result = None
        node_version = "" if node_result is None else (node_result.stdout or node_result.stderr)
        if node_result is None or not node_result.ok or not node_version_satisfies(
            node_version, artifact.node_requirement
        ):
            missing.append(f"node{artifact.node_requirement} (found {node_version or 'unknown'})")
    if not npm:
        missing.append("npm")
    for binary in ("ffmpeg", "ffprobe"):
        if not which(binary):
            missing.append(binary)

    cli_path = which("pixverse")
    cli_version = pixverse_cli_installed_version()
    if not cli_path:
        label = f"pixverse-internal@{artifact.version}"
        if cli_version:
            label += f" (found {cli_version})"
        missing.append(label)

    if not missing and not yes:
        print(
            f"PixVerse Agent Plugin dependencies are present, including internal CLI {cli_version}. "
            "Verifying login and writing the internal setup state.",
            file=sys.stderr,
        )
        return _doctor()
    if missing:
        print("Missing: " + ", ".join(missing))
    elif yes:
        print(f"Dependencies are ready; activating bundled internal CLI {artifact.version}.")
    if not yes:
        print("Run `pvx bootstrap --yes` to install the bundled internal CLI and safe dependencies.")
        print(
            f"Required: Node.js {artifact.node_requirement}, npm, "
            f"PixVerse internal CLI {artifact.version}, ffmpeg."
        )
        return 1
    if not node or not npm or not node_version_satisfies(node_version, artifact.node_requirement):
        print(
            json.dumps(
                {
                    "error": "internal_cli_requirements_missing",
                    "channel": INTERNAL_CLI_CHANNEL,
                    "node_requirement": artifact.node_requirement,
                    "node_version": node_version,
                    "npm_found": bool(npm),
                    "message": "Install the required Node.js/npm version, then rerun bootstrap.",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1

    print(
        f"Installing plugin-managed internal PixVerse CLI {artifact.version} from bundled ZIP "
        f"{artifact.archive_sha256[:12]}...",
        file=sys.stderr,
    )
    try:
        installed = install_internal_cli(
            artifact,
            pixverse_cli_runtime_root(),
            node=node,
            npm=npm,
            timeout=600,
        )
    except subprocess.TimeoutExpired:
        print(
            json.dumps(
                {
                    "error": "bootstrap_timeout",
                    "component": "pixverse-internal",
                    "channel": INTERNAL_CLI_CHANNEL,
                    "version": artifact.version,
                    "artifact_sha256": artifact.archive_sha256,
                    "runtime": str(pixverse_cli_runtime_root()),
                    "message": "Internal CLI dependency installation exceeded 600 seconds.",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 124
    except InternalCliInstallError as exc:
        print(
            json.dumps(
                {
                    "error": "internal_cli_install_failed",
                    "channel": INTERNAL_CLI_CHANNEL,
                    "version": artifact.version,
                    "artifact_sha256": artifact.archive_sha256,
                    "runtime": str(pixverse_cli_runtime_root()),
                    "message": str(exc),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    print(json.dumps(installed, indent=2, ensure_ascii=False, sort_keys=True))

    if ("ffmpeg" in missing or "ffprobe" in missing) and platform.system() == "Darwin" and which("brew"):
        try:
            result = run(["brew", "install", "ffmpeg"], timeout=1200)
        except subprocess.TimeoutExpired:
            print(
                json.dumps(
                    {
                        "error": "bootstrap_timeout",
                        "component": "ffmpeg",
                        "message": "Homebrew ffmpeg install exceeded 1200 seconds.",
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 124
        print(result.stdout)
        if not result.ok:
            print(result.stderr, file=sys.stderr)
            return result.returncode
    return _doctor()


def _bootstrap_online(yes: bool) -> int:
    node = which("node")
    node_requirement = pixverse_cli_node_requirement()
    node_version = ""
    node_ready = False
    if node:
        try:
            node_result = run(["node", "--version"], timeout=20)
        except subprocess.TimeoutExpired:
            node_result = None
        if node_result is not None:
            node_version = node_result.stdout or node_result.stderr
            node_ready = node_result.ok and node_version_satisfies(
                node_version,
                node_requirement,
            )

    cli_path = which("pixverse")
    cli_version = pixverse_cli_installed_version()
    cli_needs_install = not cli_path
    if cli_path:
        try:
            version_result = run(["pixverse", "--version"], timeout=20)
            reported_version = version_result.stdout or version_result.stderr
            cli_version = reported_version or cli_version
            cli_needs_install = not version_result.ok or not pixverse_cli_version_supported(reported_version)
        except subprocess.TimeoutExpired:
            cli_needs_install = True

    missing: list[str] = []
    if not node:
        missing.append("node")
    elif not node_ready:
        missing.append(
            f"node{node_requirement} (found {node_version.strip() or 'unknown'})"
        )
    missing.extend(
        binary for binary in ("npm", "ffmpeg", "ffprobe") if not which(binary)
    )
    if cli_needs_install:
        label = f"pixverse>={PIXVERSE_CLI_MINIMUM_VERSION}"
        if cli_version:
            label += f" (found {cli_version})"
        missing.append(label)
    if not missing and not yes:
        print(
            f"PixVerse Agent Plugin dependencies are present, including CLI {cli_version} "
            f"(minimum {PIXVERSE_CLI_MINIMUM_VERSION}). "
            "Verifying login and writing setup state.",
            file=sys.stderr,
        )
        return _doctor()
    if missing:
        print("Missing: " + ", ".join(missing))
    elif yes:
        print(
            f"Dependencies are ready; refreshing the managed PixVerse CLI to npm {PIXVERSE_CLI_INSTALL_SPEC}."
        )
    if not yes:
        print("Run `pvx bootstrap --yes` to attempt safe installs, or install them manually.")
        print(
            f"Required: Node.js {node_requirement}, PixVerse CLI "
            f">={PIXVERSE_CLI_MINIMUM_VERSION}, ffmpeg."
        )
        return 1
    if not node_ready:
        print(
            json.dumps(
                {
                    "error": "pixverse_cli_requirements_missing",
                    "channel": pixverse_cli_channel(),
                    "node_requirement": node_requirement,
                    "node_version": node_version.strip(),
                    "message": (
                        f"PixVerse CLI requires Node.js {node_requirement} on both managed channels. "
                        "Install a compatible Node.js version, then rerun bootstrap."
                    ),
                    "next_steps": [
                        f"Install Node.js {node_requirement} with your package manager",
                        f"{pvx_command()} bootstrap --yes",
                        f"{pvx_command()} doctor",
                    ],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 1
    if which("npm"):
        print(
            f"Refreshing plugin-managed PixVerse CLI to npm {PIXVERSE_CLI_INSTALL_SPEC} "
            f"(minimum supported {PIXVERSE_CLI_MINIMUM_VERSION}).",
            file=sys.stderr,
        )
        pixverse_cli_runtime_root().mkdir(parents=True, exist_ok=True)
        try:
            result = run(pixverse_cli_install_argv(), timeout=600)
        except subprocess.TimeoutExpired:
            print(
                json.dumps(
                    {
                        "error": "bootstrap_timeout",
                        "component": "pixverse",
                        "minimum_version": PIXVERSE_CLI_MINIMUM_VERSION,
                        "install_spec": PIXVERSE_CLI_INSTALL_SPEC,
                        "runtime": str(pixverse_cli_runtime_root()),
                        "message": "Managed PixVerse CLI refresh exceeded 600 seconds. Check network/package-manager state, then rerun bootstrap.",
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 124
        print(result.stdout)
        if not result.ok:
            print(result.stderr, file=sys.stderr)
            return result.returncode
        try:
            verified = run(["pixverse", "--version"], timeout=20)
        except subprocess.TimeoutExpired:
            verified = None
        if verified is None or not verified.ok or not pixverse_cli_version_supported(verified.stdout or verified.stderr):
            print(
                json.dumps(
                    {
                        "error": "bootstrap_version_mismatch",
                        "minimum_version": PIXVERSE_CLI_MINIMUM_VERSION,
                        "install_spec": PIXVERSE_CLI_INSTALL_SPEC,
                        "runtime": str(pixverse_cli_runtime_root()),
                        "actual_version": "" if verified is None else (verified.stdout or verified.stderr),
                        "message": "npm completed, but the plugin-managed PixVerse CLI runtime is below the required minimum version.",
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 1
    if ("ffmpeg" in missing or "ffprobe" in missing) and platform.system() == "Darwin" and which("brew"):
        try:
            result = run(["brew", "install", "ffmpeg"], timeout=1200)
        except subprocess.TimeoutExpired:
            print(
                json.dumps(
                    {
                        "error": "bootstrap_timeout",
                        "component": "ffmpeg",
                        "message": "Homebrew ffmpeg install exceeded 1200 seconds. Check Homebrew/network state, then rerun bootstrap or install ffmpeg manually.",
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 124
        print(result.stdout)
        if not result.ok:
            print(result.stderr, file=sys.stderr)
            return result.returncode
    return _doctor()


def _resolve_membership_tier(args: argparse.Namespace) -> str:
    requested = str(getattr(args, "membership_tier", "auto") or "auto")
    if requested in {"basic", "premium"}:
        return requested
    routing_record = membership_routing_record()
    if (
        routing_record.get("mode") == MEMBERSHIP_ROUTING_UNRESTRICTED_TEST
        and not routing_record.get("account_fingerprint")
    ):
        return "premium"
    snapshot = billing_snapshot(
        usage_limit=0,
        include_slots=False,
        include_model_catalogs=False,
    )
    # route queue/story queue reuse this read-only account result during their
    # combined preflight, avoiding a second account/auth network round trip.
    setattr(args, "_preflight_billing_snapshot", snapshot)
    account = snapshot.get("account") if isinstance(snapshot.get("account"), dict) else {}
    if membership_routing_mode(
        account_fingerprint=str(account.get("account_fingerprint") or "")
    ) == MEMBERSHIP_ROUTING_UNRESTRICTED_TEST:
        return "premium"
    tier = str(account.get("membership_tier") or "unknown")
    return tier if tier in {"basic", "premium"} else "unknown"


def _route_queue(args: argparse.Namespace) -> int:
    output = Path(args.output)
    references = [str(value).strip() for value in args.reference if str(value).strip()]
    membership_tier = _resolve_membership_tier(args)
    if args.kind == "video" and str(args.board_prompt).strip() and args.mode != "board-to-video":
        print(
            json.dumps(
                {
                    "error": "board_mode_required",
                    "message": (
                        "--board-prompt opts into an extra paid control image. "
                        "Pass --mode board-to-video explicitly, or remove --board-prompt for direct video generation."
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if args.kind == "image" and args.audio:
        print(
            json.dumps(
                {
                    "error": "image_audio_not_supported",
                    "message": (
                        "Still images cannot generate audio. Remove --audio, or use --kind video "
                        "when the deliverable needs synchronized sound."
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    route = recommend_route(
        kind=args.kind,
        intent=args.intent,
        mode=args.mode,
        references=len(references),
        image_family=args.image_family,
        aspect_ratio=args.aspect_ratio,
        duration=args.duration,
        quality=args.quality,
        membership_tier=membership_tier,
        accept_basic_fallback=args.accept_basic_fallback,
    )
    if not route.get("valid"):
        print(
            json.dumps(
                {
                    "error": "invalid_recommended_route",
                    "message": "Resolve the capability notes before writing or spending on this queue.",
                    "route": route,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if args.audio and route.get("generated_audio_supported") is False:
        print(
            json.dumps(
                {
                    "error": "route_audio_not_supported",
                    "message": (
                        f"{route.get('model')} has a confirmed native-audio limitation. "
                        "Choose a route that can deliver the requested sound."
                    ),
                    "route": route,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    _record_route_audio_intent(route, audio=args.audio, no_audio=args.no_audio)
    chain = route.get("chain") if isinstance(route.get("chain"), list) else []
    if len(chain) > 1 and not str(args.board_prompt).strip():
        print(
            json.dumps(
                {
                    "error": "board_prompt_required",
                    "message": "The explicit board-to-video route needs --board-prompt for its paid control image.",
                    "route": route,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if output.exists() and not args.force:
        print(
            json.dumps(
                {
                    "error": "output_exists",
                    "message": "Queue spec already exists. Pass --force to overwrite it.",
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    tasks: list[dict[str, object]] = []
    has_generated_board = len(chain) > 1
    for index, step in enumerate(chain):
        if not isinstance(step, dict) or not step.get("command_template"):
            continue
        command = str(step["command_template"])
        command = command.replace("<board-prompt>", shlex.quote(str(args.board_prompt)))
        command = command.replace("<prompt>", shlex.quote(str(args.prompt)))
        resolved_references = ["{{board.path}}", *references] if has_generated_board and index > 0 else references
        command = _replace_route_references(command, resolved_references)
        if (
            (index > 0 or not command.startswith("pixverse create image"))
            and route.get("audio_flag_supported") is not False
        ):
            audio_flag = "--audio" if args.audio else "--no-audio" if args.no_audio else ""
            if audio_flag:
                command = command.replace(" --prompt ", f" {audio_flag} --prompt ", 1)
                if " --prompt " not in command and audio_flag not in command:
                    command += f" {audio_flag}"
        task_id = "board" if has_generated_board and index == 0 else "image" if args.kind == "image" else "film"
        task: dict[str, object] = {
            "id": task_id,
            "label": str(step.get("role") or task_id),
            "cmd": command,
        }
        if has_generated_board and index > 0:
            task["depends_on"] = ["board"]
        tasks.append(task)

    if not tasks:
        print(
            json.dumps(
                {
                    "error": "empty_recommended_chain",
                    "message": "The selected route produced no executable generation tasks; inspect the route details or choose another mode.",
                    "route": route,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    project = args.project or _default_project_for_queue_path(output)
    try:
        normalize_project_slug(project)
    except InvalidProjectSlug as exc:
        print(json.dumps({"error": "invalid_project_slug", "message": str(exc)}, indent=2, ensure_ascii=False))
        return 2
    payload = {"project": project, "route": route, "tasks": tasks,
               "basic_fallback_accepted": args.accept_basic_fallback}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return _queue_mutation_result(
        output,
        {"path": str(output), "route": route, "queue": payload},
        args,
    )


def _record_route_audio_intent(route: dict[str, Any], *, audio: bool, no_audio: bool) -> None:
    """Keep delivery intent even when the provider exposes no audio switch."""
    if route.get("kind") == "image" or not (audio or no_audio):
        return
    route["audio_requirement"] = "audible" if audio else "silent"
    if route.get("audio_flag_supported") is False:
        note = (
            "Native sound is requested. The CLI omits the audio switch and uses provider defaults; "
            "keep sound directions in the prompt and inspect the returned audio."
            if audio else
            "A silent deliverable is requested. This model has no CLI audio switch; "
            "remove the returned audio track during local export and verify the silent file."
        )
        route.setdefault("issues", []).append(note)
        if no_audio:
            route["required_postprocess"] = ["remove_audio_track"]


def _replace_route_references(command: str, references: list[str]) -> str:
    rendered = [value if value.startswith("{{") and value.endswith("}}") else shlex.quote(value) for value in references]
    joined = " ".join(rendered)
    replacements = {
        "<reference-image>": rendered[0] if rendered else "<reference-image>",
        "<reference-images...>": joined or "<reference-images...>",
        "<locked-opening-frame>": rendered[0] if rendered else "<locked-opening-frame>",
        "<first-frame> <last-frame>": joined or "<first-frame> <last-frame>",
        "<keyframe-images...>": joined or "<keyframe-images...>",
    }
    for placeholder, value in replacements.items():
        command = command.replace(placeholder, value)
    return command


def _story(args: argparse.Namespace) -> int:
    if args.story_command == "queue":
        return _story_queue(args)
    if args.story_command == "assemble":
        return _story_assemble(args)
    return 2


def _story_queue(args: argparse.Namespace) -> int:
    output = Path(args.output)
    shots = [str(value).strip() for value in args.shot if str(value).strip()]
    references = [str(value).strip() for value in args.reference if str(value).strip()]
    per_shot_references = [str(value).strip() for value in args.shot_reference if str(value).strip()]
    membership_tier = _resolve_membership_tier(args)
    if len(shots) < 2:
        return _print_story_error(
            "story_needs_multiple_shots",
            "A story queue needs at least two ordered --shot prompts. Use route queue for a one-shot clip.",
        )
    if per_shot_references and len(per_shot_references) != len(shots):
        return _print_story_error(
            "story_shot_reference_count_mismatch",
            "Pass --shot-reference once per --shot, or omit it. Each shot-specific board controls only its matching video task.",
        )
    if not references and not per_shot_references and not str(args.board_prompt).strip():
        return _print_story_error(
            "story_control_reference_required",
            "Pass per-shot storyboard images with --shot-reference, a shared --reference, or an explicit compact --board-prompt.",
        )
    durations = list(args.duration)
    if not durations:
        durations = _balanced_story_durations(args.target_duration, len(shots))
    elif len(durations) == 1:
        durations *= len(shots)
    elif len(durations) != len(shots):
        return _print_story_error(
            "story_duration_count_mismatch",
            "Pass --duration once for every shot, once to reuse it, or omit it to split --target-duration evenly.",
        )
    if any(duration < 4 or duration > 30 for duration in durations):
        return _print_story_error(
            "story_shot_duration_out_of_range",
            "Story video shots must each be between 4 and 30 seconds; the selected account/model route may impose a lower limit.",
            durations=durations,
        )

    board_prompt = str(args.board_prompt).strip()
    music_prompt = str(args.music_prompt).strip()
    has_board = bool(board_prompt)
    shot_reference_count = len(references) + (1 if has_board else 0) + (1 if per_shot_references else 0)
    routes = [
        recommend_route(
            kind="video",
            intent="final",
            mode="reference",
            references=shot_reference_count,
            aspect_ratio=args.aspect_ratio,
            duration=duration,
            quality=args.quality,
            membership_tier=membership_tier,
            accept_basic_fallback=args.accept_basic_fallback,
        )
        for duration in durations
    ]
    invalid = [route for route in routes if not route.get("valid")]
    if invalid:
        return _print_story_error(
            "story_route_incompatible",
            "This helper protects the account-compatible serious story spine. Resolve the capability or membership notes before spending.",
            routes=invalid,
        )
    audio_incompatible = [
        route for route in routes if args.audio and route.get("generated_audio_supported") is False
    ]
    if audio_incompatible:
        return _print_story_error(
            "story_audio_not_supported",
            "A selected model has a confirmed native-audio limitation. Choose a route that can deliver the requested sound.",
            routes=audio_incompatible,
        )
    for shot_route in routes:
        _record_route_audio_intent(shot_route, audio=args.audio, no_audio=args.no_audio)
    video_models = sorted({str(route.get("model") or "") for route in routes})
    story_video_model = video_models[0] if len(video_models) == 1 else "mixed"
    if output.exists() and not args.force:
        return _print_story_error(
            "output_exists",
            "Story queue already exists. Pass --force to overwrite it.",
            path=str(output),
        )
    project = args.project or _default_project_for_queue_path(output)
    try:
        normalize_project_slug(project)
    except InvalidProjectSlug as exc:
        return _print_story_error("invalid_project_slug", str(exc))

    tasks: list[dict[str, object]] = []
    if has_board:
        board_route = recommend_route(
            kind="image",
            # Control images retain the same 2K/high profile as final stills.
            intent="draft",
            references=len(references),
            image_family=args.image_family,
            aspect_ratio=args.aspect_ratio,
            membership_tier=membership_tier,
            accept_basic_fallback=args.accept_basic_fallback,
        )
        board_command = str(board_route["command_template"]).replace("<prompt>", shlex.quote(board_prompt))
        board_command = _replace_route_references(board_command, references)
        tasks.append(
            {
                "id": "story-board",
                "label": "Story identity and world lock",
                "cmd": board_command,
            }
        )

    audio_flag = "--audio" if args.audio else "--no-audio" if args.no_audio else ""
    for index, (shot, duration, shot_route) in enumerate(zip(shots, durations, routes), start=1):
        shot_references = (
            ([per_shot_references[index - 1]] if per_shot_references else [])
            + (["{{story-board.path}}"] if has_board else [])
            + references
        )
        rendered_refs = " ".join(
            value if value.startswith("{{") else shlex.quote(value)
            for value in shot_references
        )
        command = (
            f"pixverse create reference --model {shot_route['model']} --quality {shot_route['quality']} "
            f"--duration {duration:g} --aspect-ratio {args.aspect_ratio} --images {rendered_refs}"
        )
        if audio_flag and shot_route.get("audio_flag_supported") is not False:
            command += f" {audio_flag}"
        command += f" --prompt {shlex.quote(shot)}"
        task: dict[str, object] = {
            "id": f"shot-{index:02d}",
            "label": f"Story shot {index} of {len(shots)}",
            "cmd": command,
        }
        if has_board:
            task["depends_on"] = ["story-board"]
        tasks.append(task)

    if music_prompt:
        tasks.append(
            {
                "id": "story-music",
                "label": "Original instrumental story score",
                "cmd": (
                    f"pixverse create music --model {shlex.quote(str(args.music_model))} "
                    f"--prompt {shlex.quote(music_prompt)} --instrumental"
                ),
            }
        )

    total_duration = round(sum(durations), 3)
    route = {
        "valid": True,
        "kind": "story",
        "intent": "final",
        "control_layer": "multi-shot-reference",
        "model": story_video_model,
        "quality": routes[0]["quality"],
        "aspect_ratio": args.aspect_ratio,
        "duration": total_duration,
        "shot_count": len(shots),
        "reference_count_per_shot": shot_reference_count,
        "membership_tier": membership_tier,
        "reasons": [
            "A designed story is split into bounded 4–30 second shots, with each shot checked against its selected model.",
            "Every shot preserves the same identity/world references and uses the selected quality route.",
        ],
    }
    if "seedance-2.5" in video_models:
        route["prompt_enhance_skill"] = PROMPT_ENHANCE_SKILL
    route["basic_fallback_accepted"] = args.accept_basic_fallback
    if per_shot_references:
        route["reasons"].append(
            "Each shot has its own approved storyboard/control frame instead of sharing one composition across the whole film."
        )
        route["shot_specific_reference_count"] = len(per_shot_references)
    if args.audio or args.no_audio:
        route["audio_requirement"] = "audible" if args.audio else "silent"
        audio_notes = list(dict.fromkeys(
            note for shot_route in routes
            if shot_route.get("audio_flag_supported") is False
            for note in shot_route.get("issues", [])
        ))
        if audio_notes:
            route["issues"] = audio_notes
        if any(shot_route.get("required_postprocess") for shot_route in routes):
            route["required_postprocess"] = ["remove_audio_track"]
    if music_prompt:
        route["music_task_count"] = 1
        route["music_model"] = str(args.music_model)
    payload = {"project": project, "route": route, "tasks": tasks,
               "basic_fallback_accepted": args.accept_basic_fallback}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return _queue_mutation_result(output, {"path": str(output), "route": route, "queue": payload}, args)


def _balanced_story_durations(target_duration: float, shot_count: int) -> list[float]:
    """Split whole-second stories into safe whole-second Seedance shots.

    The selected model's duration limits are checked by routing; do not assume
    fractional-second generation. For the normal integer target, keep every
    command integral and place remainder seconds on later beats so the climax
    and resolution get slightly more breathing room. Explicit per-shot values
    bypass this helper and remain untouched.
    """
    if float(target_duration).is_integer():
        base, remainder = divmod(int(target_duration), shot_count)
        return [float(base)] * (shot_count - remainder) + [float(base + 1)] * remainder
    return [target_duration / shot_count] * shot_count


def _story_assemble(args: argparse.Namespace) -> int:
    try:
        slug = normalize_project_slug(args.project)
    except InvalidProjectSlug as exc:
        return _print_story_error("invalid_project_slug", str(exc))
    path = project_dir(slug)
    if not path.exists():
        return _print_story_error("project_not_found", "The story project does not exist.", project=slug)
    if args.clip and args.asset_id:
        return _print_story_error(
            "mixed_story_inputs",
            "Use ordered --clip paths or ordered --asset-id values, not both; mixing the two would make cut order ambiguous.",
        )
    output = Path(args.output).expanduser() if args.output else path / "deliverables" / "story-final.mp4"
    if not output.is_absolute():
        output = Path.cwd() / output
    if output.exists() and not args.force:
        return _print_story_error("output_exists", "Final story already exists. Pass --force to replace it.", path=str(output))
    if not which("ffmpeg") or not which("ffprobe"):
        return _print_story_error("ffmpeg_required", "story assemble requires ffmpeg and ffprobe.")

    clips = [Path(value).expanduser().resolve() for value in args.clip]
    selected_assets: list[dict[str, object]] = []
    if not clips:
        selected_assets = _story_assets(path, args.asset_id)
        if not selected_assets:
            return _print_story_error(
                "story_assets_not_found",
                "No ordered story shot assets were found. Pass --asset-id shot-01 --asset-id shot-02 or explicit --clip paths.",
            )
        if args.asset_id and len(selected_assets) != len(args.asset_id):
            found = {str(item.get("id") or "") for item in selected_assets}
            return _print_story_error(
                "story_asset_ids_missing",
                "One or more requested story asset ids are not present in project billing history.",
                missing=[item_id for item_id in args.asset_id if item_id not in found],
            )
        incomplete = [item for item in selected_assets if item.get("status") != "success"]
        if incomplete:
            return _print_story_error(
                "story_shots_incomplete",
                "Refusing to assemble a partial story; every selected shot must finish successfully first.",
                shots=[
                    {"id": item.get("id"), "task_id": item.get("task_id"), "status": item.get("status")}
                    for item in incomplete
                ],
            )
        for index, item in enumerate(selected_assets, start=1):
            clip = _resolve_or_download_story_clip(path, item, index=index, total=len(selected_assets))
            if clip is None:
                return 2
            clips.append(clip)
    missing = [str(clip) for clip in clips if not clip.is_file()]
    if missing:
        return _print_story_error("story_clip_missing", "One or more story clips do not exist.", paths=missing)
    if len(clips) < 2:
        return _print_story_error("story_needs_multiple_clips", "At least two clips are required for story assembly.")

    durations = [_story_clip_duration(clip) for clip in clips]
    if any(duration <= 0 for duration in durations):
        return _print_story_error(
            "story_clip_duration_unreadable",
            "ffprobe could not read every input clip duration; refusing to create an unverifiable final timeline.",
            clips=[str(clip) for clip, duration in zip(clips, durations) if duration <= 0],
        )
    planned_duration = _story_planned_duration(path, selected_assets) if selected_assets else 0.0
    expected_duration = (
        args.expect_duration
        if args.expect_duration is not None
        else planned_duration
        if planned_duration > 0
        else sum(durations)
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    print(
        f"[pixverse-agent] Assembling {len(clips)} ordered story shots into {output}; expected duration {expected_duration:.2f}s.",
        file=sys.stderr,
        flush=True,
    )
    with tempfile.TemporaryDirectory(prefix="pvx-story-") as temp_dir:
        concat_path = Path(temp_dir) / "concat.txt"
        concat_path.write_text(
            "\n".join(f"file '{_ffconcat_escape(clip.resolve())}'" for clip in clips) + "\n",
            encoding="utf-8",
        )
        try:
            result = run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(concat_path),
                    "-c:v",
                    "libx264",
                    "-preset",
                    "medium",
                    "-crf",
                    "18",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(output),
                ],
                timeout=15 * 60,
            )
        except subprocess.TimeoutExpired:
            return _print_story_error(
                "story_assembly_timeout",
                "FFmpeg exceeded the 15-minute local assembly budget; no paid generation was retried.",
                output=str(output),
            )
    if not result.ok or not output.is_file():
        return _print_story_error(
            "story_assembly_failed",
            "FFmpeg could not assemble the story clips.",
            stderr=result.stderr[-2000:],
        )

    report = inspect_media(
        str(output),
        output_dir=path / "quality",
        expect_duration=expected_duration,
        duration_tolerance=args.duration_tolerance,
    )
    if args.sample_frames and report.get("kind") == "video":
        report["sample_frames"] = sample_frames(
            output,
            path / "quality" / f"frames-{_target_slug(str(output))}",
            duration_seconds=_float_or_none((report.get("metadata") or {}).get("duration_seconds")),
        )
        _rewrite_qa_report(report)
    memory_recorded = _remember_story_deliverable(
        path,
        output=output,
        clip_count=len(clips),
        expected_duration=expected_duration,
        qa_passed=not report.get("issues"),
    )
    payload = {
        "project": slug,
        "output": str(output.resolve()),
        "clips": [str(clip) for clip in clips],
        "asset_ids": [str(item.get("id") or "") for item in selected_assets],
        "expected_duration_seconds": round(expected_duration, 3),
        "qa": report,
        "memory_recorded": memory_recorded,
        "ok": not report.get("issues"),
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0 if payload["ok"] else 1


def _story_assets(path: Path, requested_ids: list[str]) -> list[dict[str, object]]:
    runs = _project_ledgers(path, limit=None)
    if requested_ids:
        by_id: dict[str, dict[str, object]] = {}
        for run_record in runs:
            ledger = run_record.get("asset_ledger") if isinstance(run_record.get("asset_ledger"), list) else []
            for item in ledger:
                if isinstance(item, dict) and str(item.get("id") or "") not in by_id:
                    by_id[str(item.get("id") or "")] = item
        return [by_id[item_id] for item_id in requested_ids if item_id in by_id]
    if not runs:
        return []
    ledger = runs[0].get("asset_ledger") if isinstance(runs[0].get("asset_ledger"), list) else []
    return [
        item
        for item in ledger
        if isinstance(item, dict)
        and (item.get("media_type") == "video" or item.get("kind") in {"video", "reference", "transition"})
        and str(item.get("id") or "").replace("_", "-").startswith(("shot-", "story-shot-"))
    ]


def _story_planned_duration(path: Path, assets: list[dict[str, object]]) -> float:
    ids = {str(item.get("id") or "") for item in assets}
    if not ids:
        return 0.0
    durations: dict[str, float] = {}
    for run_record in _project_ledgers(path, limit=None):
        quote = run_record.get("quote") if isinstance(run_record.get("quote"), dict) else {}
        lines = quote.get("lines") if isinstance(quote.get("lines"), list) else []
        for item in lines:
            if not isinstance(item, dict):
                continue
            asset_id = str(item.get("id") or "")
            params = item.get("params") if isinstance(item.get("params"), dict) else {}
            duration = _float_or_none(params.get("duration"))
            if asset_id in ids and asset_id not in durations and duration and duration > 0:
                durations[asset_id] = duration
    return sum(durations.values()) if len(durations) == len(ids) else 0.0


def _remember_story_deliverable(
    path: Path,
    *,
    output: Path,
    clip_count: int,
    expected_duration: float,
    qa_passed: bool,
) -> bool:
    prefix = f"Final assembled story: {output.resolve()};"
    notebook = path / "notebook.jsonl"
    if any(
        item.get("kind") == "asset" and str(item.get("text") or "").startswith(prefix)
        for item in read_jsonl(notebook)
    ):
        return False
    append_jsonl(
        notebook,
        MemoryEntry(
            kind="asset",
            text=(
                f"{prefix} {clip_count} ordered shots; expected duration {expected_duration:.2f}s; "
                f"technical QA {'passed' if qa_passed else 'needs attention'}."
            ),
            source="story assemble",
        ).to_record(),
    )
    return True


def _resolve_or_download_story_clip(
    path: Path, item: dict[str, object], *, index: int, total: int
) -> Path | None:
    raw_path = str(item.get("path") or "")
    if raw_path:
        candidate = Path(raw_path).expanduser()
        if candidate.is_file():
            return candidate.resolve()
    task_id = str(item.get("task_id") or "")
    if task_id:
        existing = sorted((path / "assets" / "videos").glob(f"*{task_id}*.mp4"))
        if existing:
            return existing[-1].resolve()
    if not task_id:
        _print_story_error("story_task_id_missing", "Cannot download a story asset without its PixVerse task id.", asset=item)
        return None
    destination = path / "assets" / "videos"
    destination.mkdir(parents=True, exist_ok=True)
    print(
        f"[pixverse-agent] Downloading story shot {index}/{total}: {item.get('id') or task_id} (task {task_id}).",
        file=sys.stderr,
        flush=True,
    )
    try:
        result = run(
            ["pixverse", "asset", "download", task_id, "--type", "video", "--dest", str(destination), "--json"],
            timeout=5 * 60,
        )
    except subprocess.TimeoutExpired:
        _print_story_error(
            "story_download_timeout",
            "Downloading the generated story shot timed out; the paid asset is unchanged and can be downloaded later.",
            asset_id=item.get("id"),
            task_id=task_id,
        )
        return None
    try:
        payload = json.loads(result.stdout) if result.stdout else {}
    except json.JSONDecodeError:
        payload = {}
    downloaded = Path(str(payload.get("file") or "")).expanduser()
    if result.ok and downloaded.is_file():
        return downloaded.resolve()
    _print_story_error(
        "story_download_failed",
        "Could not download a generated story shot for local assembly.",
        asset_id=item.get("id"),
        task_id=task_id,
        stderr=result.stderr,
    )
    return None


def _story_clip_duration(path: Path) -> float:
    try:
        result = run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return 0.0
    return _float_or_none(result.stdout) or 0.0


def _ffconcat_escape(path: Path) -> str:
    return str(path).replace("'", "'\\''")


def _print_story_error(error: str, message: str, **details: object) -> int:
    print(json.dumps({"error": error, "message": message, **details}, indent=2, ensure_ascii=False))
    return 2


def _project(args: argparse.Namespace) -> int:
    if args.project_command == "list":
        print(json.dumps({"projects": list_projects(limit=args.limit)}, indent=2, ensure_ascii=False))
        return 0
    if args.project_command == "portfolio":
        payload = project_portfolio(limit=args.limit, surface=args.surface)
        print(
            render_project_portfolio_markdown(payload)
            if args.format == "markdown"
            else json.dumps(payload, indent=2, ensure_ascii=False)
        )
        return 0
    if args.project_command == "resume":
        payload = resolve_project_resume(args.selector, limit=args.limit, surface=args.surface)
        print(
            render_project_resume_markdown(payload)
            if args.format == "markdown"
            else json.dumps(payload, indent=2, ensure_ascii=False)
        )
        return 0 if payload.get("ok") else 2
    if args.project_command == "init":
        blocked = _print_setup_blocker("project init")
        if blocked:
            return blocked
        path = ensure_project(args.slug, title=args.title or args.slug)
        print(str(path))
        return 0
    path = project_dir(args.slug)
    if args.project_command == "summary":
        exists = path.exists()
        payload = {
            "project": str(path),
            "slug": slugify(args.slug),
            "exists": exists,
            "project_md": (path / "project.md").read_text(encoding="utf-8") if (path / "project.md").exists() else "",
            "notebook": read_jsonl(path / "notebook.jsonl")[-20:],
            "preferences": read_jsonl(path / "preferences.jsonl")[-20:],
            "manifest_tail": read_jsonl(path / "manifest.jsonl")[-20:],
        }
        if not exists:
            payload["message"] = "Project workspace does not exist."
            payload["next_steps"] = _missing_project_next_steps(args.slug)
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.project_command == "search":
        exists = path.exists()
        print(
            json.dumps(
                {
                    "project": str(path),
                    "slug": slugify(args.slug),
                    "exists": exists,
                    "query": args.query,
                    "matches": search_project(args.slug, args.query, limit=args.limit),
                    **(
                        {
                            "message": "Project workspace does not exist.",
                            "next_steps": _missing_project_next_steps(args.slug),
                        }
                        if not exists
                        else {}
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 0
    if args.project_command == "ledger":
        exists = path.exists()
        runs = _project_ledgers(path, limit=args.limit)
        if args.format == "markdown":
            print(_project_ledger_markdown(args.slug, runs, exists=exists))
        else:
            payload = {"project": str(path), "slug": slugify(args.slug), "exists": exists, "runs": runs}
            if not exists:
                payload["message"] = "Project workspace does not exist."
                payload["next_steps"] = _missing_project_next_steps(args.slug)
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.project_command == "handoff":
        surface = "canvas" if _canvas_stage_metadata_requested(args) else args.surface
        payload = project_handoff(args.slug, stage=args.stage, surface=surface)
        if surface == "canvas" and not payload.get("canvas", {}).get("bound"):
            print(json.dumps({"error": "canvas_project_binding_required", "message": "Resolve the intended Canvas target before handoff."}))
            return 2
        stage_record, stage_error = _canvas_stage_handoff_record(args, payload)
        if stage_error:
            print(json.dumps(stage_error, indent=2, ensure_ascii=False))
            return 2
        if stage_record is not None:
            append_jsonl(path / "manifest.jsonl", stage_record)
            payload = project_handoff(args.slug, stage=args.stage, surface=surface)
        print(
            _project_handoff_markdown(payload)
            if args.format == "markdown"
            else json.dumps(payload, indent=2, ensure_ascii=False)
        )
        return 0 if payload.get("exists") else 2
    if args.project_command == "prompt":
        payload = _project_prompt(args)
        if payload.get("error"):
            print(json.dumps(payload, indent=2, ensure_ascii=False))
            return 2
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.project_command == "scaffold":
        payload = scaffold_project_artifact(args.slug, args.artifact, force=args.force)
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    ensure_project(args.slug)
    if args.project_command == "remember":
        entry = MemoryEntry(kind=args.kind, text=args.text, source=args.source).to_record()
        append_jsonl(path / "notebook.jsonl", entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 0
    if args.project_command == "prefer":
        entry = {
            "at": utc_now(),
            "category": args.category,
            "polarity": args.polarity,
            "preference": args.text,
            "source": "agent",
        }
        append_jsonl(path / "preferences.jsonl", entry)
        print(json.dumps(entry, ensure_ascii=False))
        return 0
    return 2


def _canvas_stage_metadata_requested(args: argparse.Namespace) -> bool:
    return bool(
        str(args.stage_position).strip()
        or str(args.final_deliverable_status).strip()
        or args.remaining_stage
        or args.next_paid_task_count is not None
        or str(args.next_paid_task).strip()
        or str(args.approval_gate).strip()
        or args.delivery_mode == "local"
        or args.deliverable_path
    )


def _canvas_stage_handoff_record(
    args: argparse.Namespace,
    payload: dict[str, Any],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    remaining_stages = [str(item).strip() for item in args.remaining_stage if str(item).strip()]
    if not _canvas_stage_metadata_requested(args):
        return None, None
    canvas = payload.get("canvas") if isinstance(payload.get("canvas"), dict) else {}
    if not canvas.get("bound"):
        return None, {
            "error": "canvas_stage_handoff_requires_binding",
            "message": "Structured Canvas stage metadata can only be recorded for a bound Canvas project.",
        }
    position = str(args.stage_position).strip()
    position_match = re.fullmatch(r"([1-9][0-9]*)/([1-9][0-9]*)", position)
    required_missing = [
        option
        for option, value in (
            ("--stage-position", position),
            ("--final-deliverable-status", str(args.final_deliverable_status).strip()),
            ("--next-paid-task-count", args.next_paid_task_count),
            ("--approval-gate", str(args.approval_gate).strip()),
        )
        if value in {None, ""}
    ]
    if required_missing:
        return None, {
            "error": "canvas_stage_handoff_incomplete",
            "message": "Structured Canvas handoff metadata must be supplied as one complete record.",
            "missing": required_missing,
        }
    if position_match is None or int(position_match.group(1)) > int(position_match.group(2)):
        return None, {
            "error": "canvas_stage_position_invalid",
            "message": "--stage-position must use N/M with 1 <= N <= M.",
            "stage_position": position,
        }
    next_paid_count = int(args.next_paid_task_count)
    if next_paid_count < 0:
        return None, {
            "error": "canvas_next_paid_task_count_invalid",
            "message": "--next-paid-task-count must be zero or greater.",
        }
    final_status = str(args.final_deliverable_status)
    deliverable_paths = [str(Path(item).expanduser().resolve()) for item in args.deliverable_path]
    if final_status == "complete" and args.delivery_mode == "local" and (
        not deliverable_paths or not all(Path(item).is_file() for item in deliverable_paths)
    ):
        return None, {"error": "canvas_local_deliverable_missing", "message": "Local completion requires existing --deliverable-path files; a cloud preview is not an exported file."}
    approval_gate = str(args.approval_gate)
    next_paid_description = str(args.next_paid_task).strip()
    if final_status == "complete" and (
        remaining_stages or next_paid_count != 0 or approval_gate != "complete"
    ):
        return None, {
            "error": "canvas_complete_stage_inconsistent",
            "message": (
                "A complete final deliverable must have no remaining stages, zero next paid tasks, "
                "and approval gate complete."
            ),
        }
    if final_status == "incomplete" and next_paid_count > 0 and not next_paid_description:
        return None, {
            "error": "canvas_next_paid_task_description_required",
            "message": "Describe the next paid batch when its task count is greater than zero.",
        }
    if next_paid_count > 0 and approval_gate not in {"required", "not_required"}:
        return None, {
            "error": "canvas_paid_approval_gate_invalid",
            "message": "An upcoming Canvas batch must record required or not_required according to its effective confirmation policy; it is not complete yet.",
        }
    return (
        {
            "event": "canvas.stage.handoff",
            "at": utc_now(),
            "stage": str(args.stage).strip() or "current",
            "stage_position": position,
            "final_deliverable_status": final_status,
            "delivery_mode": args.delivery_mode,
            "deliverable_paths": deliverable_paths,
            "remaining_stages": remaining_stages,
            "next_paid_task": {
                "description": next_paid_description,
                "count": next_paid_count,
                "approval_gate": approval_gate,
            },
        },
        None,
    )


def _project_ledgers(path: Path, *, limit: int | None = 20) -> list[dict[str, object]]:
    rows = [
        item
        for item in read_jsonl(path / "manifest.jsonl")
        if isinstance(item, dict) and item.get("event") == "queue.billing"
    ]
    rows.reverse()
    return rows if limit is None else rows[: max(0, limit)]


def _project_handoff_markdown(payload: dict[str, object]) -> str:
    out = [
        "# PixVerse Project Handoff",
        "",
        f"- Project: `{payload.get('project') or ''}`",
        f"- Stage: `{payload.get('stage') or 'current'}`",
        f"- Workspace: `{payload.get('project_path') or ''}`",
        f"- Recorded files: `{payload.get('file_count') or 0}`",
    ]
    if not payload.get("exists"):
        out.extend(["", "Project workspace does not exist."])
        return "\n".join(out)
    canvas = payload.get("canvas") if isinstance(payload.get("canvas"), dict) else {}
    labels = {
        "editable": "Editable plans, prompts, and queue specs",
        "memory": "Learned memory and preferences",
        "audit": "QA, logs, and billing audit",
        "media": "Requested local media and deliverables" if canvas.get("active") else "Generated media and deliverables",
    }
    groups = payload.get("groups") if isinstance(payload.get("groups"), dict) else {}
    if canvas.get("active") and canvas.get("bound"):
        out.extend(
            [
                "",
                "## Canvas cloud graph",
                "",
                f"- Preview: [Open Canvas]({canvas.get('editor_url') or ''})",
                f"- Project ID: `{canvas.get('project_id') or ''}`",
                f"- Accepted edit version: `{canvas.get('accepted_edit_version') if canvas.get('accepted_edit_version') is not None else 'unknown'}`",
                f"- Sync captured at: `{canvas.get('sync_captured_at') or 'unknown'}`",
                f"- Cloud nodes: `{canvas.get('cloud_node_count') or 0}`",
            ]
        )
        cloud_nodes = canvas.get("cloud_nodes") if isinstance(canvas.get("cloud_nodes"), list) else []
        for item in cloud_nodes:
            if not isinstance(item, dict):
                continue
            out.append(
                "- `"
                f"{item.get('node_id') or ''}` — {item.get('title') or item.get('node_type') or 'untitled'} "
                f"(`{item.get('status') or 'unknown'}`)"
            )
        out.extend(["", "## Local-only Canvas planning files", ""])
        local_only = canvas.get("local_only_plans") if isinstance(canvas.get("local_only_plans"), list) else []
        if local_only:
            for raw_path in local_only:
                path = Path(str(raw_path))
                out.append(f"- [{path.name}]({path})")
        else:
            out.append("- None yet")
        localized_copies = (
            canvas.get("localized_preview_copies")
            if isinstance(canvas.get("localized_preview_copies"), list)
            else []
        )
        if localized_copies:
            out.extend(["", "## Requested Canvas downloads", ""])
            for raw_path in localized_copies:
                path = Path(str(raw_path))
                out.append(f"- [{path.name}]({path})")
        out.append(
            f"- Downloads: `{canvas.get('download_status', 'not_requested')}`; "
            f"credits: `{canvas.get('credits_status', 'not_requested')}`; technical QA: `not_checked`"
        )
        stage_status = (
            canvas.get("stage_status") if isinstance(canvas.get("stage_status"), dict) else {}
        )
        next_paid = (
            stage_status.get("next_paid_task")
            if isinstance(stage_status.get("next_paid_task"), dict)
            else {}
        )
        out.extend(
            [
                "",
                "## Canvas production status",
                "",
                f"- Stage position: `{stage_status.get('position') or 'not recorded'}`",
                "- Final deliverable: `"
                f"{stage_status.get('final_deliverable_status') or 'unknown'}`",
            ]
        )
        remaining_stages = (
            stage_status.get("remaining_stages")
            if isinstance(stage_status.get("remaining_stages"), list)
            else []
        )
        if remaining_stages:
            out.append(f"- Remaining stages: `{', '.join(str(item) for item in remaining_stages)}`")
        else:
            out.append("- Remaining stages: `none recorded`")
        out.extend(
            [
                "",
                "## Next paid Canvas stage",
                "",
                f"- Task: `{next_paid.get('description') or 'not recorded'}`",
                "- Planned generation tasks: `"
                f"{next_paid.get('count') if isinstance(next_paid.get('count'), int) else 'not recorded'}`",
                f"- Approval gate: `{next_paid.get('approval_gate') or 'unknown'}`",
            ]
        )
    for key, label in labels.items():
        if canvas.get("active") and (key == "editable" or not groups.get(key)):
            continue
        paths = groups.get(key) if isinstance(groups.get(key), list) else []
        out.extend(["", f"## {label}", ""])
        if not paths:
            out.append("- None yet")
        for raw_path in paths:
            path = Path(str(raw_path))
            out.append(f"- [{path.name}]({path})")
    if payload.get("guidance"):
        out.extend(["", str(payload["guidance"])])
    return "\n".join(out)


def _project_ledger_markdown(slug: str, runs: list[dict[str, object]], *, exists: bool = True) -> str:
    out = [
        "# PixVerse Project Ledger",
        "",
        f"- Project: `{slug}`",
        f"- Exists: `{exists}`",
        f"- Runs shown: `{len(runs)}`",
    ]
    if not exists:
        out.extend(
            [
                "",
                "Project workspace does not exist.",
                "",
                "Next steps:",
                "",
                f"- `{pvx_command()} project list`",
                f"- `{pvx_command()} project init {shlex.quote(slug)}`",
            ]
        )
        return "\n".join(out)
    if not runs:
        out.extend(["", "No queue billing records found."])
        return "\n".join(out)
    totals = project_run_totals(runs)
    credits = totals["total_attributable_credits"]
    unknown_credits = int(totals["assets_with_unknown_credits"])
    credit_text = str(credits) if not unknown_credits else f"{credits or 0}; {unknown_credits} asset(s) not itemized"
    out.extend(
        [
            f"- Unique generated assets across shown runs: `{totals['generated_assets']}`",
            f"- Attributable credits across shown runs: `{credit_text}`",
        ]
    )
    for idx, run_record in enumerate(runs, start=1):
        invoice = run_record.get("invoice") if isinstance(run_record.get("invoice"), dict) else {}
        ledger = run_record.get("asset_ledger") if isinstance(run_record.get("asset_ledger"), list) else []
        out.extend(
            [
                "",
                f"## Run {idx}",
                "",
                f"- At: `{run_record.get('at') or ''}`",
                f"- Queue wall time: `{_format_seconds((run_record.get('timing') or {}).get('wall_seconds') if isinstance(run_record.get('timing'), dict) else None)}`",
                f"- Generated assets: `{invoice.get('generated_assets', len(ledger))}`",
                f"- Total actual credits: `{invoice.get('total_actual_credits', 'unknown')}`",
                f"- Observed credit delta: `{invoice.get('observed_credit_delta', 'unknown')}`",
                "",
                "| Asset | Role | Kind | Model | Status | Task id | Local preview | Provider URL | Credits |",
                "|---|---|---|---|---|---|---|---|---:|",
            ]
        )
        for item in ledger:
            if not isinstance(item, dict):
                continue
            out.append(
                "| "
                + " | ".join(
                    [
                        _md_cell(item.get("id")),
                        _md_cell(item.get("role")),
                        _md_cell(item.get("kind") or item.get("media_type")),
                        _md_cell(item.get("model")),
                        _md_cell(item.get("status")),
                        _md_cell(item.get("task_id")),
                        _md_cell(item.get("local_path")),
                        _md_cell(item.get("url") or item.get("cover_url")),
                        _md_cell(item.get("actual_credits")),
                    ]
                )
                + " |"
            )
    return "\n".join(out)


def _format_seconds(value: object) -> str:
    if value in (None, ""):
        return "unknown"
    return f"{value}s"


def _project_prompt(args: argparse.Namespace) -> dict[str, object]:
    path = ensure_project(args.slug)
    try:
        text = _prompt_input_text(args)
    except OSError as exc:
        return {
            "error": "prompt_input_failed",
            "message": str(exc),
            "input": args.input,
        }
    if text is None:
        return {
            "error": "missing_prompt_text",
            "message": "Pass --text, --input <file>, or --stdin.",
        }
    if not text.strip():
        return {
            "error": "empty_prompt_text",
            "message": "Prompt text is empty.",
        }
    prompt_dir = path / "prompts"
    prompt_dir.mkdir(parents=True, exist_ok=True)
    output = prompt_dir / f"{slugify(args.name, fallback='prompt')}.txt"
    if output.exists() and not args.force:
        return {
            "error": "output_exists",
            "message": "Prompt file already exists. Pass --force to overwrite it.",
            "path": str(output),
        }
    stored_text = text.rstrip() + "\n"
    output.write_text(stored_text, encoding="utf-8")
    digest = hashlib.sha256(stored_text.encode("utf-8")).hexdigest()
    record = {
        "at": utc_now(),
        "kind": "prompt",
        "prompt_kind": args.kind,
        "name": args.name,
        "path": str(output),
        "chars": len(stored_text),
        "sha256": digest,
        "source": "agent",
    }
    append_jsonl(path / "notebook.jsonl", record)
    return {
        "project": str(path),
        "path": str(output),
        "prompt_kind": args.kind,
        "chars": len(stored_text),
        "sha256": digest,
        "notebook_record": record,
    }


def _prompt_input_text(args: argparse.Namespace) -> str | None:
    if args.text:
        return str(args.text)
    if args.input:
        return Path(args.input).expanduser().read_text(encoding="utf-8")
    if args.stdin:
        return sys.stdin.read()
    return None


def _missing_project_next_steps(slug: str) -> list[str]:
    return [
        f"{pvx_command()} project list",
        f"{pvx_command()} project init {shlex.quote(slug)}",
    ]


def _skills(args: argparse.Namespace) -> int:
    if args.skills_command == "list":
        rows = [
            {
                "name": info.name,
                "path": str(info.path),
                "description": info.description,
                "visibility": info.visibility,
            }
            for info in list_skills(include_internal=args.all)
        ]
        if args.compact:
            for row in rows:
                description = str(row["description"]).strip()
                if len(description) > 110:
                    description = description[:107].rstrip() + "..."
                visibility = f" [{row['visibility']}]" if args.all else ""
                print(f"{row['name']:<34}{visibility:<12} {description}")
            return 0
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return 0
    issues = validate_skills()
    print(json.dumps({"ok": not issues, "issues": issues}, indent=2, ensure_ascii=False))
    return 0 if not issues else 1


def _queue(args: argparse.Namespace) -> int:
    if args.queue_command == "write":
        return _queue_write(args)
    if args.queue_command == "append":
        return _queue_append(args)
    if args.queue_command == "reconcile":
        return _queue_reconcile(args)
    spec_path = Path(args.spec)
    loaded = _load_queue_specs_or_print(spec_path, args.queue_command)
    if loaded is None:
        return 2
    project, tasks = loaded
    if args.queue_command == "plan":
        print(
            json.dumps(
                {
                    "project": project,
                    "tasks": [
                        _planned_task_row(task)
                        for task in tasks
                    ],
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 0
    if args.queue_command == "graph":
        graph = _queue_graph(project, tasks)
        if args.format == "json":
            print(json.dumps(graph, indent=2, ensure_ascii=False))
        else:
            print(_queue_graph_mermaid(graph))
        return 0
    if not args.dry_run:
        blocked = _print_setup_blocker("queue run")
        if blocked:
            return blocked
    # `queue write` / `queue append` have always guarded against a --project that
    # disagrees with the spec. `queue run` -- the only path that spends money --
    # did not: the CLI flag silently won. That is how a correct spec was written
    # into `projects/projects-<slug>/` and four billed videos were stranded.
    requested_project = str(args.project or "").strip()
    spec_project = str(project or "").strip()
    if requested_project and spec_project and requested_project != spec_project:
        print(
            json.dumps(
                {
                    "error": "project_mismatch",
                    "message": (
                        "Queue spec project differs from --project. Refusing to run paid generation "
                        "against an ambiguous project directory. Drop --project to use the spec's own "
                        "project, or fix one of them so they agree."
                    ),
                    "path": str(spec_path),
                    "existing_project": spec_project,
                    "requested_project": requested_project,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    try:
        project_slug = normalize_project_slug(requested_project or spec_project or spec_path.stem)
    except InvalidProjectSlug as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_project_slug",
                    "message": str(exc),
                    "path": str(spec_path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    path = project_dir(project_slug) if args.dry_run else ensure_project(project_slug)
    quote: dict[str, object] | None = None
    if not args.dry_run:
        quote = quote_queue(spec_path)
        access_blocker = insufficient_balance_blocker(quote)
        if access_blocker:
            print(json.dumps(_preflight_blocker_payload(access_blocker, quote, spec_path), indent=2, ensure_ascii=False))
            return 4
        if quote.get("requires_confirmation") and not args.confirmed:
            confirmation_options = [
                f"Run this batch only: {pvx_command()} queue run {shlex.quote(str(spec_path))} --confirmed",
                "When the user requests automatic generation for this project: "
                f"{pvx_command()} preferences quote-confirmation skip --project {shlex.quote(str(project_slug))}",
            ]
            print(
                json.dumps(
                    {
                        "error": "quote_confirmation_required",
                        "message": (
                            "Per-batch confirmation is enabled for this project. "
                            "Show planned tasks, model/key parameters, and balance state; do not promise exact credits before creation. "
                            "Then rerun with --confirmed. Offer project-scoped continuation with the phrase "
                            "'Allow future generation'; store it only after the user chooses it."
                        ),
                        "confirmation_options": confirmation_options,
                        "quote": quote,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
    run_started_at = utc_now()
    run_started_monotonic = time.monotonic()
    results = run_queue(
        spec_path=spec_path,
        project_path=path,
        dry_run=args.dry_run,
        poll_interval=args.poll_interval,
        status_interval=args.status_interval,
        deadline_seconds=args.deadline_seconds,
    )
    run_finished_at = utc_now()
    timing = {
        "started_at": run_started_at,
        "finished_at": run_finished_at,
        "wall_seconds": round(time.monotonic() - run_started_monotonic, 3),
        "poll_interval_seconds": args.poll_interval,
        "status_interval_seconds": args.status_interval,
        "deadline_seconds": args.deadline_seconds,
    }
    # Echo where this actually landed. `repo_root()` walks up from the CWD, so the
    # same slug run from a different directory writes to a different projects/ tree.
    # Make that visible instead of leaving the caller to assume.
    payload: dict[str, object] = {
        "project": str(path),
        "project_slug": project_slug,
        "project_path": str(path.resolve()),
        "repo_root": str(repo_root()),
        "results": results,
        "timing": timing,
    }
    if not args.dry_run:
        print(
            "[pixverse-agent] Generation tasks finished; reconciling attributable credits and the final asset ledger.",
            file=sys.stderr,
            flush=True,
        )
        billing = _queue_billing_summary(quote, results)
        _apply_usage_credits(results, billing)
        asset_ledger = _queue_asset_ledger(results, quote)
        invoice = _queue_invoice_summary(asset_ledger, billing)
        append_jsonl(
            path / "manifest.jsonl",
            {
                "event": "queue.billing",
                "at": utc_now(),
                "quote": quote,
                "billing": billing,
                "invoice": invoice,
                "timing": timing,
                "asset_ledger": asset_ledger,
                "results": [
                    {
                        "id": item.get("id"),
                        "task_id": item.get("task_id"),
                        "status": item.get("status"),
                        "cost_credits": item.get("cost_credits"),
                        "cost_source": item.get("cost_source"),
                        "usage_credits": item.get("usage_credits"),
                    }
                    for item in results
                ],
            },
        )
        payload["results"] = results
        payload["quote"] = quote
        payload["billing"] = billing
        payload["asset_ledger"] = asset_ledger
        payload["invoice"] = invoice
        failure_guidance = _queue_failure_guidance(results)
        if failure_guidance:
            payload["failure_guidance"] = failure_guidance
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0 if all(r.get("status") in {"success", "dry_run"} for r in results) else 1


def _queue_reconcile(args: argparse.Namespace) -> int:
    """Recover billed tasks the queue lost track of. Free, read-only, append-only."""
    try:
        slug = normalize_project_slug(args.project)
    except InvalidProjectSlug as exc:
        print(json.dumps({"error": "invalid_project_slug", "message": str(exc)}, indent=2, ensure_ascii=False))
        return 2
    path = project_dir(slug)
    if not (path / "manifest.jsonl").exists():
        print(
            json.dumps(
                {
                    "error": "project_not_found",
                    "message": (
                        "No manifest.jsonl under this project slug. Check the slug, and check that you "
                        "are running from the same directory the queue ran from -- the projects/ tree is "
                        "resolved from the current working directory."
                    ),
                    "project_path": str(path),
                    "repo_root": str(repo_root()),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    report = reconcile_project(project_path=path, dry_run=args.dry_run)
    print(
        json.dumps(
            {
                "project": str(path),
                "project_slug": slug,
                "repo_root": str(repo_root()),
                **report,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def _queue_write(args: argparse.Namespace) -> int:
    output = Path(args.output)
    command_args = list(args.pixverse_command)
    if command_args and command_args[0] == "--":
        command_args = command_args[1:]
    if not command_args:
        print(
            json.dumps(
                {
                    "error": "missing_command",
                    "message": f"Pass a PixVerse create command after `--`, for example: {pvx_command()} queue write queue.json -- pixverse create image --prompt x",
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    command = canonicalize_internal_asset_placeholders(shlex.join(apply_generation_defaults(command_args)))
    try:
        validate_create_argv(split_command(command))
    except ValueError as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_queue_command",
                    "message": str(exc),
                    "command": command,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    if output.exists() and not args.force:
        print(
            json.dumps(
                {
                    "error": "output_exists",
                    "message": "Queue spec already exists. Pass --force to overwrite it.",
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "project": args.project or _default_project_for_queue_path(output),
        "basic_fallback_accepted": args.accept_basic_fallback,
        "tasks": [
            {
                "id": args.id,
                "label": args.label or args.id,
                "cmd": command,
            }
        ],
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return _queue_mutation_result(
        output,
        {"path": str(output), "queue": payload},
        args,
    )


def _queue_append(args: argparse.Namespace) -> int:
    output = Path(args.output)
    command_args = list(args.pixverse_command)
    if command_args and command_args[0] == "--":
        command_args = command_args[1:]
    reuse_ref = str(getattr(args, "reuse", "") or "").strip()
    reuse_record: dict[str, object] | None = None
    if reuse_ref:
        if command_args:
            print(json.dumps({"error": "reuse_with_command", "message": "--reuse carries an existing asset; do not pass a create command with it."}, indent=2))
            return 2
        resolved = _resolve_reuse_reference(reuse_ref)
        if "error" in resolved:
            print(json.dumps(resolved, indent=2, ensure_ascii=False))
            return 2
        reuse_record = resolved
        command_args = split_command(str(resolved["command"]))
    if not command_args:
        print(
            json.dumps(
                {
                    "error": "missing_command",
                    "message": (
                        "Pass a PixVerse create command after `--`, for example: "
                        f"{pvx_command()} queue append queue.json --id film -- "
                        "pixverse create reference --images {{board.path}} --prompt x"
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    command = canonicalize_internal_asset_placeholders(shlex.join(apply_generation_defaults(command_args)))
    try:
        validate_create_argv(split_command(command))
    except ValueError as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_queue_command",
                    "message": str(exc),
                    "command": command,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    payload = _queue_payload_for_append(output, args.project)
    if payload is None:
        return 2
    tasks = payload.setdefault("tasks", [])
    if not isinstance(tasks, list):
        print(
            json.dumps(
                {
                    "error": "invalid_queue_spec",
                    "message": "Queue spec `tasks` must be a list.",
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    existing_ids = {str(item.get("id")) for item in tasks if isinstance(item, dict) and item.get("id")}
    if args.id in existing_ids:
        print(
            json.dumps(
                {
                    "error": "duplicate_task_id",
                    "message": f"Queue spec already contains task id {args.id}.",
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    depends_on = _normalized_depends_on(args.depends_on)
    if reuse_record is None:
        for ref in placeholder_refs(command):
            if ref not in depends_on:
                depends_on.append(ref)
    unknown = [dep for dep in depends_on if dep not in existing_ids]
    if unknown:
        print(
            json.dumps(
                {
                    "error": "unknown_dependency",
                    "message": "Append tasks after the tasks they reference, or fix the placeholder/dependency id.",
                    "path": str(output),
                    "unknown": unknown,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    task: dict[str, object] = {
        "id": args.id,
        "label": args.label or args.id,
        "cmd": command,
    }
    if reuse_record is not None:
        task["reuse"] = {
            key: reuse_record[key]
            for key in ("project", "source_task", "task_id", "path", "url", "cover_url", "local_path", "completed_at")
            if reuse_record.get(key)
        }
        depends_on = []
    if depends_on:
        task["depends_on"] = depends_on
    tasks.append(task)
    if args.accept_basic_fallback:
        payload["basic_fallback_accepted"] = True
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return _queue_mutation_result(
        output,
        {"path": str(output), "appended": task, "queue": payload},
        args,
    )


def _resolve_reuse_reference(reference: str) -> dict[str, object]:
    """Resolve `<slug>:<task-id>` or `<manifest.jsonl>:<task-id>` to a reusable asset record."""
    source, sep, task_id = reference.rpartition(":")
    if not sep or not source or not task_id:
        return {"error": "invalid_reuse_reference", "message": "Use --reuse <project-slug>:<task-id> or <manifest.jsonl>:<task-id>.", "reference": reference}
    candidate = Path(source).expanduser()
    if candidate.suffix == ".jsonl" and candidate.is_file():
        manifest = candidate
        project = candidate.parent.name
    else:
        try:
            project_path = project_dir(source)
        except InvalidProjectSlug as exc:
            return {"error": "invalid_project_slug", "message": str(exc), "reference": reference}
        manifest = project_path / "manifest.jsonl"
        project = project_path.name
    if not manifest.is_file():
        return {"error": "manifest_not_found", "message": f"No manifest at {manifest}.", "reference": reference}
    record = reuse_record_from_manifest(manifest, task_id)
    if record is None:
        return {"error": "reuse_task_not_found", "message": f"No successful task {task_id!r} with an asset in {manifest}.", "reference": reference}
    if not record.get("command"):
        return {"error": "reuse_command_missing", "message": f"Task {task_id!r} has no recorded command in {manifest}.", "reference": reference}
    record["project"] = project
    return record


def _queue_mutation_result(
    output: Path,
    mutation: dict[str, object],
    args: argparse.Namespace,
) -> int:
    """Print a queue mutation, optionally including its paid-work preflight.

    The combined form is the latency-sensitive path: an agent can save the queue
    and receive the user-facing generation confirmation without paying for a
    second host-tool round trip.
    """
    run_if_allowed = bool(getattr(args, "run_if_allowed", False))
    if not bool(getattr(args, "preflight", False)) and not run_if_allowed:
        print(json.dumps(mutation, indent=2, ensure_ascii=False))
        return 0
    blocked = _print_setup_blocker("queue preflight")
    if blocked:
        return blocked
    snapshot = getattr(args, "_preflight_billing_snapshot", None)
    quote = _quote_queue_or_print(output, 0, snapshot=snapshot if isinstance(snapshot, dict) else None)
    if quote is None:
        return 2
    access_blocker = insufficient_balance_blocker(quote)
    if run_if_allowed and not access_blocker and not quote.get("requires_confirmation"):
        if getattr(args, "format", "json") == "markdown":
            print(_quote_markdown(quote), file=sys.stderr, flush=True)
        else:
            print(json.dumps(quote, indent=2, ensure_ascii=False), file=sys.stderr, flush=True)
        print(
            "[pixverse-agent] Preflight passed and the effective policy allows this batch; starting generation in the same host-tool call.",
            file=sys.stderr,
            flush=True,
        )
        return _run_prepared_queue(output, args)
    if getattr(args, "format", "json") == "markdown":
        print(_quote_markdown(quote))
    else:
        print(
            json.dumps(
                {
                    **mutation,
                    "preflight": quote,
                    "journey": {
                        "phase": (
                            "blocked"
                            if access_blocker
                            else "awaiting_confirmation"
                            if quote.get("requires_confirmation")
                            else "ready_to_run"
                        ),
                        "prepared_in_one_call": True,
                    },
                    **(
                        {"blocker": _preflight_blocker_payload(access_blocker, quote, output)}
                        if access_blocker
                        else {}
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
    if access_blocker:
        return 4
    return 2 if run_if_allowed and quote.get("requires_confirmation") else 0


def _run_prepared_queue(output: Path, args: argparse.Namespace) -> int:
    """Enter the normal queue-run gate without another host-tool round trip."""
    return main(
        [
            "queue",
            "run",
            str(output),
            "--poll-interval",
            f"{args.poll_interval:g}",
            "--status-interval",
            f"{args.status_interval:g}",
            "--deadline-seconds",
            f"{args.deadline_seconds:g}",
        ]
    )


def _queue_payload_for_append(output: Path, project: str) -> dict[str, object] | None:
    if not output.exists():
        return {"project": project or _default_project_for_queue_path(output), "tasks": []}
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_queue_spec",
                    "message": str(exc),
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return None
    if not isinstance(payload, dict):
        print(
            json.dumps(
                {
                    "error": "invalid_queue_spec",
                    "message": "Queue spec must be a JSON object.",
                    "path": str(output),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return None
    current_project = str(payload.get("project") or "")
    if project and current_project and project != current_project:
        print(
            json.dumps(
                {
                    "error": "project_mismatch",
                    "message": "Existing queue spec project differs from --project.",
                    "path": str(output),
                    "existing_project": current_project,
                    "requested_project": project,
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return None
    if project and not current_project:
        payload["project"] = project
    elif not current_project:
        payload["project"] = _default_project_for_queue_path(output)
    return payload


def _default_project_for_queue_path(output: Path) -> str:
    parts = output.parts
    for idx in range(len(parts) - 2, -1, -1):
        if parts[idx] == "projects" and idx + 1 < len(parts) - 1:
            return slugify(parts[idx + 1])
    return output.stem


def _normalized_depends_on(values: list[str]) -> list[str]:
    deps: list[str] = []
    for value in values:
        for raw in value.split(","):
            dep = raw.strip()
            if dep and dep not in deps:
                deps.append(dep)
    return deps


def _planned_task_row(task: TaskSpec) -> dict[str, object]:
    command = task.command
    kind = create_kind(split_command(command))
    row: dict[str, object] = {
        "id": task.id,
        "label": task.label,
        "depends_on": task.depends_on,
        "kind": kind,
        "media_type": media_type_for_kind(kind),
        "command": command,
    }
    if task.reuse:
        row["reuse"] = task.reuse
    return row


def _queue_graph(project: str, tasks: list[TaskSpec]) -> dict[str, object]:
    nodes: list[dict[str, object]] = []
    edges: list[dict[str, str]] = []
    for idx, task in enumerate(tasks):
        argv = split_command(task.command)
        kind = create_kind(argv)
        nodes.append(
            {
                "node_id": f"n{idx}",
                "id": task.id,
                "label": task.label,
                "kind": kind,
                "media_type": media_type_for_kind(kind),
                "model": _queue_command_option(argv, "--model", "-m") or "",
            }
        )
    node_by_id = {str(node["id"]): str(node["node_id"]) for node in nodes}
    for task in tasks:
        target = node_by_id.get(task.id)
        if not target:
            continue
        for dep in task.depends_on:
            source = node_by_id.get(dep)
            if source:
                edges.append({"source": source, "target": target, "dependency": dep})
    return {"project": project, "nodes": nodes, "edges": edges}


def _queue_graph_mermaid(graph: dict[str, object]) -> str:
    nodes = graph.get("nodes") if isinstance(graph.get("nodes"), list) else []
    edges = graph.get("edges") if isinstance(graph.get("edges"), list) else []
    out = ["flowchart LR"]
    for node in nodes:
        if not isinstance(node, dict):
            continue
        parts = [str(node.get("id") or ""), str(node.get("kind") or "")]
        if node.get("model"):
            parts.append(str(node.get("model")))
        label = "<br/>".join(_mermaid_label(part) for part in parts if part)
        out.append(f'  {node.get("node_id")}["{label}"]')
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        out.append(f'  {edge.get("source")} --> {edge.get("target")}')
    return "\n".join(out)


def _queue_command_option(argv: list[str], *names: str) -> str | None:
    for idx, value in enumerate(argv):
        if value in names and idx + 1 < len(argv):
            return argv[idx + 1]
        for name in names:
            prefix = f"{name}="
            if value.startswith(prefix):
                return value[len(prefix) :]
    return None


def _mermaid_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def _load_queue_specs_or_print(spec_path: Path, action: str) -> tuple[str, object] | None:
    try:
        return load_task_specs(spec_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_queue_spec",
                    "action": f"queue {action}",
                    "spec": str(spec_path),
                    "message": str(exc),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return None


def _queue_write_from_argv(argv: list[str]) -> int:
    if "--" in argv:
        separator = argv.index("--")
    elif "pixverse" in argv:
        separator = argv.index("pixverse")
    else:
        separator = len(argv)
    meta_args = argv[:separator]
    command_args = argv[separator + 1 :] if separator < len(argv) and argv[separator] == "--" else argv[separator:]
    parser = _queue_write_parser()
    try:
        args = parser.parse_args(meta_args)
    except SystemExit as exc:
        return int(exc.code) if isinstance(exc.code, int) else 2
    args.pixverse_command = command_args
    return _queue_write(args)


def _queue_append_from_argv(argv: list[str]) -> int:
    if "--" in argv:
        separator = argv.index("--")
    elif "pixverse" in argv:
        separator = argv.index("pixverse")
    else:
        separator = len(argv)
    meta_args = argv[:separator]
    command_args = argv[separator + 1 :] if separator < len(argv) and argv[separator] == "--" else argv[separator:]
    parser = _queue_append_parser()
    try:
        args = parser.parse_args(meta_args)
    except SystemExit as exc:
        return int(exc.code) if isinstance(exc.code, int) else 2
    args.pixverse_command = command_args
    return _queue_append(args)


def _queue_write_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pvx queue write",
        description="Write a one-task PixVerse queue spec from a create command.",
    )
    parser.add_argument("output")
    parser.add_argument("--project", default="", help="Project slug stored in the queue spec.")
    parser.add_argument("--id", default="task", help="Task id for the generated queue item.")
    parser.add_argument("--label", default="", help="Human-readable task label.")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing queue spec.")
    parser.add_argument("--preflight", action="store_true", help="Write and preflight in one CLI call.")
    parser.add_argument("--accept-basic-fallback", action="store_true", help="Record the user's explicit choice of the fallback route; does not bypass preflight or confirmation.")
    parser.add_argument(
        "--run-if-allowed",
        action="store_true",
        help="Run in the same call when the effective confirmation policy permits automatic generation.",
    )
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(parser)
    return parser


def _queue_append_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pvx queue append",
        description="Append one PixVerse create task to a queue spec.",
    )
    parser.add_argument("output")
    parser.add_argument("--project", default="", help="Project slug for a new queue spec.")
    parser.add_argument("--id", required=True, help="Task id for the appended queue item.")
    parser.add_argument("--label", default="", help="Human-readable task label.")
    parser.add_argument(
        "--depends-on",
        action="append",
        default=[],
        help="Existing task id dependency; repeatable.",
    )
    parser.add_argument("--preflight", action="store_true", help="Append and preflight in one CLI call.")
    parser.add_argument("--accept-basic-fallback", action="store_true", help="Record the user's explicit choice of the fallback route; does not bypass preflight or confirmation.")
    parser.add_argument(
        "--run-if-allowed",
        action="store_true",
        help="Run in the same call when the effective confirmation policy permits automatic generation.",
    )
    parser.add_argument("--reuse", default="", help="Carry an accepted asset: <project-slug>:<task-id> or <manifest.jsonl>:<task-id>.")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    _add_combined_run_timing_args(parser)
    return parser


def _queue_billing_summary(quote: dict[str, object] | None, results: list[dict[str, object]]) -> dict[str, object]:
    pre_account = quote.get("account") if isinstance(quote, dict) and isinstance(quote.get("account"), dict) else {}
    pre_credits = pre_account.get("credits_total") if isinstance(pre_account, dict) else None
    post_snapshot = billing_snapshot(usage_limit=100, include_slots=False, include_model_catalogs=False)
    post_account = post_snapshot.get("account") if isinstance(post_snapshot.get("account"), dict) else {}
    post_credits = post_account.get("credits_total") if isinstance(post_account, dict) else None
    task_ids = {str(item.get("task_id")) for item in results if item.get("task_id")}
    usage_by_task_id = _usage_credits_by_task_id(post_snapshot.get("usage"), task_ids)
    summary: dict[str, object] = {
        "pre_credits_total": pre_credits,
        "post_credits_total": post_credits,
        "observed_credit_delta": None,
        "usage_credits_by_task_id": usage_by_task_id,
        "source": "pixverse account info before/after queue run",
        "note": "Per-task credits are filled from PixVerse create/task/asset responses when exposed, then from `pixverse account usage` records keyed by task id; otherwise use observed run-level delta.",
    }
    if isinstance(pre_credits, int) and isinstance(post_credits, int):
        summary["observed_credit_delta"] = pre_credits - post_credits
    return summary


def _queue_asset_ledger(results: list[dict[str, object]], quote: dict[str, object] | None) -> list[dict[str, object]]:
    lines = quote.get("lines") if isinstance(quote, dict) else []
    quote_by_id = {
        str(line.get("id")): line
        for line in lines
        if isinstance(line, dict) and line.get("id") is not None
    }
    ledger: list[dict[str, object]] = []
    for item in results:
        task_id = str(item.get("id") or "")
        quote_line = quote_by_id.get(task_id, {})
        ledger.append(
            {
                "id": task_id,
                "role": item.get("label") or quote_line.get("label") or task_id,
                "kind": item.get("kind") or quote_line.get("kind") or "",
                "media_type": item.get("media_type") or quote_line.get("media_type") or "",
                "model": quote_line.get("model") or "",
                "status": item.get("status") or "",
                "task_id": item.get("task_id") or "",
                "url": item.get("url") or "",
                "cover_url": item.get("cover_url") or "",
                "path": item.get("path") or "",
                "local_path": item.get("local_path") or "",
                "local_preview_status": item.get("local_preview_status") or "",
                "local_preview_error": item.get("local_preview_error") or "",
                "actual_credits": item.get("cost_credits"),
                "actual_credit_source": item.get("cost_source") or "",
            }
        )
    return ledger


def _queue_invoice_summary(
    asset_ledger: list[dict[str, object]], billing: dict[str, object]
) -> dict[str, object]:
    actual_credits = [
        item.get("actual_credits")
        for item in asset_ledger
        if isinstance(item.get("actual_credits"), int)
    ]
    total_actual = sum(actual_credits)
    matched_count = len(actual_credits)
    return {
        "generated_assets": len(asset_ledger),
        "matched_actual_credit_items": matched_count,
        "total_actual_credits": total_actual if matched_count else None,
        "observed_credit_delta": billing.get("observed_credit_delta"),
        "pre_credits_total": billing.get("pre_credits_total"),
        "post_credits_total": billing.get("post_credits_total"),
        "source": "asset_ledger actual_credits from create/status/asset info/account usage; observed delta from account balance snapshots",
    }


def _usage_credits_by_task_id(usage_payload: object, task_ids: set[str]) -> dict[str, object]:
    items = usage_payload.get("items") if isinstance(usage_payload, dict) else []
    grouped: dict[str, dict[str, object]] = {}
    if not isinstance(items, list):
        return grouped
    for item in items:
        if not isinstance(item, dict):
            continue
        task_id = str(item.get("video_id") or "")
        if task_id not in task_ids:
            continue
        credits = item.get("credits")
        if not isinstance(credits, int):
            continue
        entry = grouped.setdefault(task_id, {"credits": 0, "records": []})
        entry["credits"] = int(entry.get("credits") or 0) + credits
        records = entry.get("records")
        if isinstance(records, list):
            records.append(
                {
                    "create_time": item.get("create_time"),
                    "credits": credits,
                    "video_source": item.get("video_source"),
                    "source": item.get("source"),
                    "type": item.get("type"),
                }
            )
    return grouped


def _apply_usage_credits(results: list[dict[str, object]], billing: dict[str, object]) -> None:
    usage = billing.get("usage_credits_by_task_id")
    if not isinstance(usage, dict):
        return
    for item in results:
        task_id = str(item.get("task_id") or "")
        entry = usage.get(task_id)
        if not isinstance(entry, dict):
            continue
        credits = entry.get("credits")
        if not isinstance(credits, int):
            continue
        item["usage_credits"] = credits
        item["usage_credit_records"] = entry.get("records", [])
        if item.get("cost_credits") is None:
            item["cost_credits"] = credits
            item["cost_source"] = "account_usage"


def _membership_recovery() -> dict[str, Any]:
    try:
        url = f"{_pixverse_web_app_base_url()}/subscribe"
    except ValueError:
        url = f"{PIXVERSE_WEB_APP_BASE_URLS['production']}/subscribe"
    return {
        "subscription_url": url,
        "subscription_link": f"[PixVerse subscription / recharge]({url})",
        "subscribe_command": f"{pvx_command()} pixverse subscribe",
        "user_choice_required": True,
        "choices": ["upgrade_then_recheck", "accept_basic_fallback"],
        "basic_safe_route": fallback_route(),
        "quality_notice": "The fallback can realize the same idea, with more limited fine detail, motion fidelity and consistency.",
        "upgrade_next_step": "After the user upgrades, refresh live account/entitlement and balance, then preflight the original premium batch again. A top-up alone may not grant model access.",
        "fallback_next_step": "Only after an explicit fallback choice, compose v6 540p / Nano Banana 2 Lite 1080p with --accept-basic-fallback and show a fresh preflight. Preserve references and check capability limits.",
        "retry_queue_policy": "If a run recorded terminal failures, create a replacement queue with new task IDs for only failed/unsubmitted work. An unchanged failed queue restores its failure. Reuse successful provider paths and retain old receipts; recover unknown submissions by ID before any new paid attempt.",
        "fresh_quote_required": True,
    }


def _preflight_blocker_payload(
    blocker: str,
    quote: dict[str, object],
    spec_path: Path,
) -> dict[str, object]:
    account = quote.get("account") if isinstance(quote.get("account"), dict) else {}
    common: dict[str, object] = {
        "error": blocker,
        "generation_started": False,
        "spec": str(spec_path),
        "detected_membership": account.get("member_label") or "unknown",
        "membership_tier": account.get("membership_tier") or quote.get("membership_tier") or "unknown",
        "quote": quote,
    }
    if blocker == "authentication_required":
        return {
            **common,
            "message": (
                "PixVerse CLI is not logged in, so no paid generation was attempted. "
                "Run the login command; the CLI opens PixVerse's browser OAuth flow. "
                "After browser authorization, run doctor and preflight this queue again."
            ),
            "login_command": f"{pvx_command()} pixverse auth login",
            "auth_status_command": f"{pvx_command()} pixverse auth status --json",
            "doctor_command": f"{pvx_command()} doctor",
        }
    if blocker == "membership_route_required":
        return {
            **common, **_membership_recovery(),
            "message": (
                "Generation is paused because this Free/Basic account needs an upgrade or an explicit fallback choice. "
                "Show the subscription link and explain that premium access offers the intended quality. "
                "Wait for the user's choice; do not silently downgrade or retry."
            ),
            "entitlement_issues": quote.get("entitlement_issues", []),
        }
    if blocker == "membership_unknown":
        return {
            **common,
            "message": (
                "PixVerse is logged in, but the membership tier could not be verified. No paid generation was attempted. "
                "Refresh auth/account status, run doctor, and preflight again; keep the premium plan pending until account status is verified."
            ),
            "auth_status_command": f"{pvx_command()} pixverse auth status --json",
            "account_command": f"{pvx_command()} pixverse account info --json",
            "doctor_command": f"{pvx_command()} doctor",
            "basic_safe_route": fallback_route(),
        }
    if blocker == "insufficient_balance":
        return {
            **common,
            **_membership_recovery(),
            "message": (
                "The account reports no available credits, so no paid generation was attempted. "
                "The subscription command opens PixVerse's main-site subscription page; preflight again after the balance changes."
            ),
            "subscribe_command": f"{pvx_command()} pixverse subscribe",
            # Backward-compatible alias for integrations that already surface it.
            "recharge_command": f"{pvx_command()} pixverse subscribe",
        }
    return {
        **common,
        "message": (
            "PixVerse account or balance status could not be verified, so no paid generation was attempted. "
            "Check login/account state, run doctor, and preflight again."
        ),
        "auth_status_command": f"{pvx_command()} pixverse auth status --json",
        "account_command": f"{pvx_command()} pixverse account info --json",
        "doctor_command": f"{pvx_command()} doctor",
    }


def _queue_failure_guidance(results: list[dict[str, object]]) -> list[dict[str, object]]:
    error_classes = {
        str(item.get("error_class") or "")
        for item in results
        if isinstance(item, dict) and item.get("status") == "failed"
    }
    guidance: list[dict[str, object]] = []
    if "membership_required" in error_classes:
        guidance.append(
            {
                **_membership_recovery(),
                "error_class": "membership_required",
                "message": (
                    "PixVerse rejected this account's access to the selected model. Stop new submissions. "
                    "This is an entitlement failure; keep completed assets and unresolved task IDs. "
                    "Show the subscription link and wait for upgrade or explicit fallback choice."
                ),
            }
        )
    if "auth" in error_classes:
        guidance.append(
            {
                "error_class": "auth",
                "message": "PixVerse login expired or is missing. Reauthorize in the browser, run doctor, then quote again before retrying.",
                "login_command": f"{pvx_command()} pixverse auth login",
                "doctor_command": f"{pvx_command()} doctor",
                "fresh_quote_required": True,
            }
        )
    if "insufficient_balance" in error_classes:
        guidance.append(
            {
                "error_class": "insufficient_balance",
                "message": "PixVerse reported insufficient credits. Do not auto-retry; preflight again after the account balance changes.",
                "subscribe_command": f"{pvx_command()} pixverse subscribe",
                "fresh_quote_required": True,
            }
        )
    return guidance


def _quote(args: argparse.Namespace) -> int:
    if args.quote_command == "queue":
        blocked = _print_setup_blocker("quote queue")
        if blocked:
            return blocked
        quote = _quote_queue_or_print(Path(args.spec), args.usage_limit)
        if quote is None:
            return 2
        if args.format == "markdown":
            print(_quote_markdown(quote))
        else:
            blocker = insufficient_balance_blocker(quote)
            if blocker:
                quote["blocker"] = _preflight_blocker_payload(blocker, dict(quote), Path(args.spec))
            print(json.dumps(quote, indent=2, ensure_ascii=False))
        return 0 if not insufficient_balance_blocker(quote) else 4
    return 2


def _quote_queue_or_print(
    spec_path: Path,
    usage_limit: int,
    *,
    snapshot: dict[str, object] | None = None,
) -> dict[str, object] | None:
    try:
        if snapshot is None:
            return quote_queue(spec_path, usage_limit=usage_limit)
        return quote_queue(spec_path, usage_limit=usage_limit, snapshot=snapshot)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(
            json.dumps(
                {
                    "error": "invalid_queue_spec",
                    "action": "quote queue",
                    "spec": str(spec_path),
                    "message": str(exc),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return None


def _quote_markdown(quote: dict[str, object]) -> str:
    lines = quote.get("lines") if isinstance(quote.get("lines"), list) else []
    notes = quote.get("notes") if isinstance(quote.get("notes"), list) else []
    account = quote.get("account") if isinstance(quote.get("account"), dict) else {}
    counts_by_media = quote.get("counts_by_media") if isinstance(quote.get("counts_by_media"), dict) else {}
    media_summary = ", ".join(f"{key} × {value}" for key, value in counts_by_media.items()) or "none"
    spec = str(quote.get("spec") or "")
    requires_confirmation = bool(quote.get("requires_confirmation"))
    access_blocker = insufficient_balance_blocker(quote)
    out = [
        "# PixVerse Generation Preflight",
        "",
        "> **Status: preflight blocked. No paid generation has started.**"
        if access_blocker
        else "> **Status: waiting for your approval. No paid generation has started.**"
        if requires_confirmation
        else "> **Status: preflight passed; continuing automatically. No confirmation reply is needed.**",
        "",
        "## Batch summary",
        "",
        f"- Project: `{quote.get('project') or ''}`",
        f"- Editable queue: `{spec}`",
        f"- Planned generation tasks: `{quote.get('planned_generation_tasks') or 0}`",
        f"- Planned media: `{media_summary}`",
        f"- Signed in: `{account.get('authenticated', 'unknown')}`",
        f"- Membership shown by PixVerse: `{account.get('member_label') or 'unknown'}`",
        f"- Effective membership route: `{quote.get('membership_tier') or 'unknown'}`",
        f"- Balance state: `{quote.get('balance_state') or 'unknown'}`",
        f"- Credits total: `{account.get('credits_total', 'unknown')}`",
        f"- Confirmation required now: `{requires_confirmation}`",
        "",
        "## Planned generation",
        "",
        "| Task | Label | Kind | Media | Model | Count | Key params | Prompt preview |",
        "|---|---|---|---|---|---:|---|---|",
    ]
    for item in lines:
        if not isinstance(item, dict):
            continue
        params = item.get("params") if isinstance(item.get("params"), dict) else {}
        params_text = ", ".join(f"{key}={value}" for key, value in params.items()) or "-"
        out.append(
            "| "
            + " | ".join(
                [
                    _md_cell(item.get("id")),
                    _md_cell(item.get("label")),
                    _md_cell(item.get("kind")),
                    _md_cell(item.get("media_type")),
                    _md_cell(item.get("model")),
                    _md_cell(item.get("count")),
                    _md_cell(params_text),
                    _md_cell(item.get("prompt_preview")),
                ]
            )
            + " |"
        )
    out.extend(
        [
            "",
            "## Generation and control",
            "",
            "- Planned task count and current account balance are shown above; actual usage is recorded after generation.",
            "- This batch contains only the tasks listed above.",
            "- Later batches and retries are checked again and follow your project's continuation choice.",
            "- Successful previews should be shown immediately; technical QA may continue afterward.",
        ]
    )
    if access_blocker and spec:
        recovery = _preflight_blocker_payload(access_blocker, quote, Path(spec))
        out.extend(["", "## Required before generation", "", f"- {recovery.get('message')}"])
        if recovery.get("subscription_link"):
            out.append(f"- {recovery['subscription_link']}")
            out.append(f"- {recovery['quality_notice']}")
        command_labels = {
            "login_command": "Log in",
            "auth_status_command": "Check login",
            "account_command": "Check account",
            "doctor_command": "Run doctor",
            "subscribe_command": "Open PixVerse subscription page",
        }
        for key, label in command_labels.items():
            if recovery.get(key):
                out.append(f"- {label}: `{recovery[key]}`")
    if requires_confirmation and spec and not access_blocker:
        out.extend(
            [
                "",
                "## Approval action",
                "",
                "Reply 'Confirm' to start this generation batch.",
                "To continue future batches in this project automatically, reply 'Allow future generation'.",
            ]
        )
    if notes:
        out.extend(["", "## Notes", ""])
        for note in notes:
            out.append(f"- {note}")
    return "\n".join(out)


def _md_cell(value: object) -> str:
    text = str(value if value is not None else "")
    return text.replace("|", "\\|").replace("\n", " ")


def _billing(args: argparse.Namespace) -> int:
    if args.billing_command == "snapshot":
        snapshot = billing_snapshot(usage_limit=args.usage_limit)
        print(json.dumps(snapshot, indent=2, ensure_ascii=False))
        return 0 if not snapshot.get("issues") else 1
    return 2


def _preferences(args: argparse.Namespace) -> int:
    if args.preferences_command == "show":
        print(json.dumps(preferences_snapshot(project=args.project), indent=2, ensure_ascii=False))
        return 0
    if args.preferences_command == "quote-confirmation":
        if not args.project:
            payload = set_quote_confirmation_mode(args.mode)
            payload["scope"] = "global"
            payload["note"] = (
                "Automatic generation is restored globally. A later project choice can enable confirmation for that project."
                if args.mode == "skip"
                else "Paid batches now require confirmation globally. A later project choice can restore automatic generation for that project."
            )
            print(json.dumps(payload, indent=2, ensure_ascii=False))
            return 0
        payload = set_project_quote_confirmation_mode(args.project, args.mode)
        payload["scope"] = "project"
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.preferences_command == "membership-routing":
        account_fingerprint = ""
        if args.mode == "unrestricted-test":
            snapshot = billing_snapshot(
                usage_limit=0,
                include_slots=False,
                include_model_catalogs=False,
            )
            account = snapshot.get("account") if isinstance(snapshot.get("account"), dict) else {}
            account_fingerprint = str(account.get("account_fingerprint") or "")
            if account.get("authenticated") is not True or not account_fingerprint:
                print(
                    json.dumps(
                        {
                            "error": "authentication_required",
                            "message": (
                                "Log in to the specific unrestricted test account before storing this account-bound exception. "
                                "The login command opens PixVerse browser OAuth."
                            ),
                            "login_command": f"{pvx_command()} pixverse auth login",
                            "doctor_command": f"{pvx_command()} doctor",
                        },
                        indent=2,
                        ensure_ascii=False,
                    )
                )
                return 2
        payload = set_membership_routing_mode(
            args.mode,
            account_fingerprint=account_fingerprint,
        )
        payload["scope"] = "local-user"
        payload["safety"] = (
            "Displayed Free/Basic membership will not restrict model selection for this explicitly confirmed test account. "
            "Authentication, balance checks, quote display, and approval remain required."
            if args.mode == "unrestricted-test"
            else "Membership routing follows the live PixVerse account label again."
        )
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.preferences_command == "reset":
        if not args.all_project_memory or not args.yes:
            print(
                json.dumps(
                    {
                        "error": "reset_confirmation_required",
                        "message": (
                            "This clears learned creative memory across all projects. "
                            "Rerun with --all-project-memory --yes; generated media, manifests, login, and setup state are preserved."
                        ),
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        print(json.dumps(reset_plugin_memory(), indent=2, ensure_ascii=False))
        return 0
    return 2


def _subtitles(args: argparse.Namespace) -> int:
    if args.subtitles_command == "style":
        overrides = {}
        if args.font_size:
            overrides["Fontsize"] = args.font_size
        if args.margin_v:
            overrides["MarginV"] = args.margin_v
        style = {**DEFAULT_SUBTITLE_STYLE, **overrides}
        force_style = subtitle_force_style(overrides)
        if args.format == "force-style":
            print(force_style)
        else:
            print(json.dumps({"style": style, "force_style": force_style}, indent=2, ensure_ascii=False))
        return 0
    path = Path(args.srt)
    if args.subtitles_command == "text":
        text = srt_to_tts_text(path, separator=args.separator)
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(text + "\n", encoding="utf-8")
            print(json.dumps({"path": str(output), "characters": len(text)}, indent=2, ensure_ascii=False))
        else:
            print(text)
        return 0
    if args.subtitles_command == "inspect":
        report = inspect_srt(
            path,
            max_lines=args.max_lines,
            max_chars_per_line=args.max_chars_per_line,
            allow_terminal_punctuation=args.allow_terminal_punctuation,
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if report.get("ok") else 1
    if args.subtitles_command == "clean":
        try:
            payload = write_clean_srt(path, Path(args.output), force=args.force)
        except FileExistsError as exc:
            print(
                json.dumps(
                    {
                        "error": "output_exists",
                        "message": str(exc),
                        "path": args.output,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if args.subtitles_command == "split":
        rows = write_srt_segments(path, Path(args.output_dir), prefix=args.prefix)
        print(json.dumps({"path": str(path), "output_dir": args.output_dir, "segments": rows}, indent=2, ensure_ascii=False))
        return 0
    if args.subtitles_command == "voice-queue":
        report = inspect_srt(
            path,
            max_lines=args.max_lines,
            max_chars_per_line=args.max_chars_per_line,
            allow_terminal_punctuation=args.allow_terminal_punctuation,
        )
        if report.get("issues") and not args.allow_issues:
            print(
                json.dumps(
                    {
                        "error": "subtitle_contract_failed",
                        "message": (
                            "Fix the SRT before paid TTS: use one short subtitle line per caption "
                            "without display-line terminal punctuation, then generate one voice task per caption."
                        ),
                        "inspection": report,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        try:
            payload = build_voice_queue_from_srt(
                path,
                Path(args.output),
                project=args.project,
                segments_dir=Path(args.segments_dir) if args.segments_dir else None,
                text_prefix=args.text_prefix,
                task_prefix=args.task_prefix,
                label_prefix=args.label_prefix,
                model=args.model,
                voice_id=args.voice_id,
                language=args.language,
                speed=args.speed,
                force=args.force,
            )
        except FileExistsError as exc:
            print(
                json.dumps(
                    {
                        "error": "output_exists",
                        "message": str(exc),
                        "path": args.output,
                    },
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 2
        payload["inspection"] = report
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    return 2


def _qa(args: argparse.Namespace) -> int:
    if args.qa_command == "project":
        return _qa_project(args)
    output_dir = None
    if args.project:
        output_dir = ensure_project(args.project) / "quality"
    expect_audio = True if args.expect_audio else False if args.expect_no_audio else None
    report = inspect_media(
        args.target,
        output_dir=output_dir,
        expect_audio=expect_audio,
        expect_duration=args.expect_duration,
        duration_tolerance=args.duration_tolerance,
        expect_aspect_ratio=args.expect_aspect_ratio,
    )
    if args.sample_frames and report.get("kind") == "video" and not args.target.startswith(("http://", "https://")):
        frame_dir = (output_dir or Path.cwd()) / f"frames-{_target_slug(args.target)}"
        metadata = report.get("metadata") if isinstance(report.get("metadata"), dict) else {}
        duration_seconds = _float_or_none(metadata.get("duration_seconds"))
        report["sample_frames"] = sample_frames(
            Path(args.target),
            frame_dir,
            duration_seconds=duration_seconds,
        )
        _rewrite_qa_report(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not report.get("issues") else 1


def _qa_project(args: argparse.Namespace) -> int:
    qa_started_monotonic = time.monotonic()
    try:
        slug = normalize_project_slug(args.project)
    except InvalidProjectSlug as exc:
        print(json.dumps({"error": "invalid_project_slug", "message": str(exc)}, indent=2, ensure_ascii=False))
        return 2
    path = project_dir(slug)
    runs = _project_ledgers(path, limit=None if args.all_runs else 1)
    if not runs:
        print(
            json.dumps(
                {
                    "error": "project_run_not_found",
                    "message": "No completed queue billing run is available for project QA.",
                    "project": slug,
                    "project_path": str(path),
                },
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2

    run = runs[0]
    assets = _qa_assets_for_runs(runs)
    ledger = [entry["asset"] for entry in assets]
    quality_dir = path / "quality"
    quality_dir.mkdir(parents=True, exist_ok=True)
    reports: list[dict[str, object]] = []

    total_assets = len(assets)
    for index, entry in enumerate(assets, start=1):
        item = entry["asset"]
        asset_id = str(item.get("id") or "")
        status = str(item.get("status") or "")
        context = {
            "id": asset_id,
            "role": item.get("role") or asset_id,
            "task_id": item.get("task_id") or "",
            "model": item.get("model") or "",
            "generation_status": status,
            "run_at": entry["run_at"],
        }
        print(
            f"[pixverse-agent] QA {index}/{total_assets}: {context['role']} ({status or 'unknown'}).",
            file=sys.stderr,
            flush=True,
        )
        if status != "success":
            reports.append(
                {
                    **context,
                    "checked": False,
                    "issues": [f"generation_status_{status or 'unknown'}"],
                }
            )
            continue

        raw_local_path = str(item.get("local_path") or "")
        legacy_path = str(item.get("path") or "")
        if not raw_local_path and legacy_path and Path(legacy_path).expanduser().is_file():
            raw_local_path = legacy_path
        local_path = Path(raw_local_path).expanduser() if raw_local_path else None
        if local_path is None or not local_path.is_file():
            kind = str(item.get("kind") or "")
            media_type = str(item.get("media_type") or "")
            if not media_type and kind:
                media_type = media_type_for_kind(kind)
            localized = ensure_local_asset(
                task_id=str(item.get("task_id") or ""),
                media_type=media_type,
                project_path=path,
                existing_path=raw_local_path,
                progress=True,
                label=str(context["role"]),
            )
            item["local_path"] = localized["local_path"]
            item["local_preview_status"] = localized["status"]
            item["local_preview_error"] = localized["error"]
            raw_local_path = localized["local_path"]
            local_path = Path(raw_local_path) if raw_local_path else None
            append_jsonl(
                path / "manifest.jsonl",
                {
                    "event": "task.localized",
                    "at": utc_now(),
                    "id": asset_id,
                    "task_id": item.get("task_id") or "",
                    "kind": kind,
                    "media_type": media_type,
                    "status": status,
                    "local_path": localized["local_path"],
                    "local_preview_status": localized["status"],
                    "local_preview_error": localized["error"],
                    "source": "qa project",
                },
            )
        elif local_path is not None:
            item["local_path"] = str(local_path.resolve())
            item["local_preview_status"] = "ready"
            item["local_preview_error"] = ""
        target = str(local_path.resolve()) if local_path is not None and local_path.is_file() else ""
        if not target:
            reports.append(
                {
                    **context,
                    "checked": False,
                    "issues": ["local_asset_unavailable"],
                    "local_preview_status": item.get("local_preview_status") or "missing",
                    "local_preview_error": item.get("local_preview_error") or "",
                }
            )
            continue

        quote_line = entry["quote_line"]
        params = quote_line.get("params") if isinstance(quote_line.get("params"), dict) else {}
        expect_audio = True if params.get("audio") else False if params.get("no_audio") else None
        expect_duration = _float_or_none(params.get("duration"))
        expect_aspect_ratio = str(params.get("aspect_ratio") or "")
        report = inspect_media(
            target,
            output_dir=quality_dir,
            expect_audio=expect_audio,
            expect_duration=expect_duration,
            duration_tolerance=args.duration_tolerance,
            expect_aspect_ratio=expect_aspect_ratio,
        )
        report.update(context)
        report["checked"] = True
        if args.sample_frames and report.get("kind") == "video" and not target.startswith(("http://", "https://")):
            frame_dir = quality_dir / f"frames-{_target_slug(target)}"
            metadata = report.get("metadata") if isinstance(report.get("metadata"), dict) else {}
            duration_seconds = _float_or_none(metadata.get("duration_seconds"))
            report["sample_frames"] = sample_frames(
                Path(target),
                frame_dir,
                duration_seconds=duration_seconds,
            )
        _rewrite_qa_report(report)
        reports.append(report)

    issue_assets = [item for item in reports if item.get("issues")]
    checked = [item for item in reports if item.get("checked")]
    project_totals = project_run_totals(list(reversed(runs)))
    project_totals.pop("assets", None)
    aggregate: dict[str, object] = {
        "project": slug,
        "project_path": str(path.resolve()),
        "checked_at": utc_now(),
        "scope": "all_runs" if args.all_runs else "latest_run",
        "runs_in_scope": len(runs),
        "ok": not issue_assets and bool(reports),
        "summary": {
            "assets_in_scope": len(ledger),
            "assets_checked": len(checked),
            "assets_passed": sum(1 for item in checked if not item.get("issues")),
            "assets_with_issues": len(issue_assets),
        },
        "reports": reports,
        "asset_ledger": ledger,
        "invoice": run.get("invoice") if isinstance(run.get("invoice"), dict) else {},
        "project_totals": project_totals,
        "generation_timing": run.get("timing") if isinstance(run.get("timing"), dict) else {},
        "qa_wall_seconds": round(time.monotonic() - qa_started_monotonic, 3),
    }
    report_path = quality_dir / ("all-runs-qa.json" if args.all_runs else "latest-run-qa.json")
    latest_path = quality_dir / "qa-report.json"
    aggregate["report_path"] = str(report_path)
    aggregate["latest_report_path"] = str(latest_path)
    rendered = json.dumps(aggregate, indent=2, ensure_ascii=False)
    report_path.write_text(rendered, encoding="utf-8")
    latest_path.write_text(rendered, encoding="utf-8")
    print(
        "[pixverse-agent] QA finished: "
        f"{aggregate['summary']['assets_passed']}/{aggregate['summary']['assets_in_scope']} passed technical checks; "
        f"{aggregate['summary']['assets_with_issues']} asset(s) need attention.",
        file=sys.stderr,
        flush=True,
    )
    print(rendered)
    return 0 if aggregate["ok"] else 1


def _qa_assets_for_runs(runs: list[dict[str, object]]) -> list[dict[str, object]]:
    """Return newest-first QA work items, deduplicating idempotent billing records."""
    assets: list[dict[str, object]] = []
    seen: set[str] = set()
    anonymous_index = 0
    for run_record in runs:
        quote = run_record.get("quote") if isinstance(run_record.get("quote"), dict) else {}
        quote_lines = quote.get("lines") if isinstance(quote.get("lines"), list) else []
        quote_by_id = {
            str(item.get("id")): item
            for item in quote_lines
            if isinstance(item, dict) and item.get("id") is not None
        }
        run_ledger = (
            run_record.get("asset_ledger") if isinstance(run_record.get("asset_ledger"), list) else []
        )
        for item in run_ledger:
            if not isinstance(item, dict):
                continue
            stable = item.get("task_id") or item.get("url") or item.get("path") or item.get("cover_url")
            if stable:
                key = str(stable)
                if key in seen:
                    continue
                seen.add(key)
            else:
                anonymous_index += 1
                key = f"anonymous:{anonymous_index}:{item.get('id') or ''}"
            assets.append(
                {
                    "key": key,
                    "asset": item,
                    "quote_line": quote_by_id.get(str(item.get("id") or ""), {}),
                    "run_at": run_record.get("at") or "",
                }
            )
    return assets


def _float_or_none(value: object) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _print_setup_blocker(action: str) -> int:
    blocker = setup_blocker(action)
    if not blocker:
        return 0
    print(json.dumps(blocker, indent=2, ensure_ascii=False))
    return SETUP_GATE_EXIT


def _target_slug(value: str) -> str:
    stem = Path(value).stem or "target"
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in stem)[:80]


def _rewrite_qa_report(report: dict[str, object]) -> None:
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    for key in ("report_path", "latest_report_path"):
        raw = report.get(key)
        if isinstance(raw, str) and raw:
            Path(raw).write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
