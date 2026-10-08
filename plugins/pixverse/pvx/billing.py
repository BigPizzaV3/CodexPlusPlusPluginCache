from __future__ import annotations

import hashlib
import json
import shlex
import subprocess
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from .model_defaults import FALLBACK_IMAGE_MODEL, PROMPT_ENHANCE_SKILL
from .capabilities import load_create_capabilities
from .compatibility import PIXVERSE_CLI_BASELINE_VERSION
from .pixverse import create_kind, load_task_specs, split_command
from .preferences import (
    MEMBERSHIP_ROUTING_UNRESTRICTED_TEST,
    membership_routing_mode,
    project_quote_confirmation_state,
)
from .shell import CommandResult, run_json, which
from .state import pvx_command, utc_now


GENERATION_CONFIRMATION_NOTE = "Confirm the planned task count, models/key parameters and account balance under the effective approval policy. Actual credit usage is recorded after generation when reported."
BILLING_QUERY_TIMEOUT_SECONDS = 30
BASIC_MEMBERSHIP_LABELS = {"free", "basic", "starter", "guest"}


def billing_snapshot(
    *,
    usage_limit: int = 100,
    include_slots: bool = True,
    include_model_catalogs: bool = True,
) -> dict[str, Any]:
    snapshot: dict[str, Any] = {
        "checked_at": utc_now(),
        "pixverse_found": bool(which("pixverse")),
        "account_info": {},
        "auth": {},
        "slots": {},
        "usage": {},
        "voice_models": {},
        "music_models": {},
        "issues": [],
    }
    if not snapshot["pixverse_found"]:
        snapshot["issues"].append("pixverse_cli_missing")
        return snapshot

    commands = {
        "account_info": ["pixverse", "account", "info", "--json"],
        "auth": ["pixverse", "auth", "status", "--json"],
    }
    if include_slots:
        commands["slots"] = ["pixverse", "account", "slots", "--json"]
    if include_model_catalogs:
        commands["voice_models"] = ["pixverse", "voice", "models", "--json"]
        commands["music_models"] = ["pixverse", "music", "models", "--json"]
    if usage_limit > 0:
        commands["usage"] = ["pixverse", "account", "usage", "--type", "used", "--limit", str(usage_limit), "--json"]
    # Account, capacity, catalogs, and usage are independent read-only calls.
    # Run them together so post-generation reconciliation takes the duration of
    # the slowest endpoint instead of accumulating up to six network waits.
    with ThreadPoolExecutor(max_workers=len(commands), thread_name_prefix="pvx-billing") as executor:
        outcomes = list(executor.map(_billing_query, commands.items()))
    for key, argv, result, payload, issue in outcomes:
        if issue:
            snapshot["issues"].append(issue)
            continue
        assert result is not None
        if result.ok and isinstance(payload, dict):
            snapshot[key] = payload
        else:
            snapshot["issues"].append(
                {
                    "command": " ".join(argv),
                    "stderr": _truncate(result.stderr, 500),
                    "stdout": _truncate(result.stdout, 500),
                }
            )
    account_info = snapshot.get("account_info")
    auth_info = snapshot.get("auth")
    snapshot["account"] = _account_summary(account_info, auth_info)
    snapshot["account_info"] = _redact_account_info(account_info)
    snapshot["auth"] = _redact_auth_info(auth_info)
    snapshot["observed_prices"] = observed_price_index(snapshot.get("usage"))
    return snapshot


def _billing_query(
    item: tuple[str, list[str]],
) -> tuple[str, list[str], CommandResult | None, dict[str, Any], dict[str, Any] | None]:
    key, argv = item
    try:
        result, payload = run_json(argv, timeout=BILLING_QUERY_TIMEOUT_SECONDS)
        return key, argv, result, payload, None
    except subprocess.TimeoutExpired as exc:
        return (
            key,
            argv,
            None,
            {},
            {
                "command": " ".join(argv),
                "error": "timeout",
                "timeout_seconds": exc.timeout,
            },
        )


def quote_queue(
    spec_path: Path,
    *,
    usage_limit: int = 0,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    started_monotonic = time.monotonic()
    project, tasks = load_task_specs(spec_path)
    snapshot = snapshot or billing_snapshot(
        usage_limit=usage_limit,
        include_slots=False,
        include_model_catalogs=False,
    )
    lines: list[dict[str, Any]] = []
    notes: list[str] = []
    counts_by_kind: dict[str, int] = defaultdict(int)
    counts_by_media: dict[str, int] = defaultdict(int)
    total_count = 0

    reused_count = 0
    for task in tasks:
        argv = split_command(task.command)
        kind = create_kind(argv)
        line = quote_argv(
            argv,
            task_id=task.id,
            label=task.label,
            snapshot=snapshot,
        )
        if task.reuse:
            # An accepted asset carried into this queue: no submission, no charge.
            reused_count += 1
            line["count"] = 0
            line["reused"] = True
            line["reused_task_id"] = str(task.reuse.get("task_id") or "")
            notes.append(
                f"{task.id}: reuses accepted asset {task.reuse.get('task_id') or ''} "
                f"from {task.reuse.get('project') or 'an earlier run'}; not generated again, no charge."
            )
            lines.append(line)
            continue
        count = int(line.get("count") or 1)
        counts_by_kind[kind] += count
        counts_by_media[_media_type(kind)] += count
        total_count += count
        notes.extend(_capability_notes(task.id, kind, argv, str(line.get("model") or "")))
        notes.extend(_video_audio_notes(task.id, kind, argv))
        lines.append(line)

    raw_account = snapshot.get("account") if isinstance(snapshot.get("account"), dict) else {}
    account = dict(raw_account)
    detected_membership_tier = str(account.get("membership_tier") or "unknown")
    membership_override = membership_routing_mode(
        account_fingerprint=str(account.get("account_fingerprint") or "")
    )
    if membership_override == MEMBERSHIP_ROUTING_UNRESTRICTED_TEST:
        account["detected_membership_tier"] = detected_membership_tier
        account["membership_tier"] = "premium"
        account["membership_override"] = membership_override
    membership_tier = str(account.get("membership_tier") or "unknown")
    queue_payload = json.loads(spec_path.read_text(encoding="utf-8"))
    fallback_accepted = queue_payload.get("basic_fallback_accepted") is True
    membership_choice_required = membership_tier == "basic" and not fallback_accepted
    entitlement_issues = _entitlement_issues(lines, membership_tier)
    balance = account.get("credits_total")
    balance_state = "unknown"
    if isinstance(balance, int):
        balance_state = "has_credits" if balance > 0 else "empty"
    if balance_state == "empty":
        notes.append("Account reports 0 available credits. Ask the user to recharge with `pixverse subscribe` before running.")
    if balance_state == "unknown":
        notes.append("Could not read an exact credit balance. Do not run paid work until account status is clear.")
    if account.get("authenticated") is False:
        notes.append(
            f"PixVerse CLI is not logged in. Run `{pvx_command()} pixverse auth login`; it opens the browser OAuth flow. Then run `{pvx_command()} doctor`."
        )
    if membership_override == MEMBERSHIP_ROUTING_UNRESTRICTED_TEST:
        notes.append(
            "User preference marks this local account as an unrestricted test account. "
            "Its displayed Free/Basic label does not restrict model routing; login, balance, quote, and approval checks still apply."
        )
    elif membership_tier == "basic":
        if fallback_accepted:
            notes.append("The user accepted this queue's fallback route. Check model compatibility and follow the existing generation confirmation policy; do not ask for the same fallback choice again.")
        else:
            notes.append(
                "Basic/Free membership detected. Stop and ask whether to upgrade or explicitly accept v6 540p / Nano Banana 2 Lite 1080p. "
                f"For advanced models and higher-end effects, open the PixVerse subscription page with `{pvx_command()} pixverse subscribe`."
            )
    elif membership_tier == "unknown" and account.get("authenticated") is True:
        notes.append("Account is logged in, but membership could not be identified. Keep the premium plan pending and refresh account status before spending.")
    if entitlement_issues:
        notes.append(
            "This queue does not match the detected Basic/Free entitlement route. Keep the premium plan pending until upgrade, or rebuild with v6 540p and Nano Banana 2 Lite 1080p only after explicit fallback consent."
        )
    notes.append(GENERATION_CONFIRMATION_NOTE)
    confirmation = project_quote_confirmation_state(project)
    requires_confirmation = bool(confirmation["requires_confirmation"])
    confirmation_mode = str(confirmation["effective_mode"])
    if confirmation.get("issues"):
        notes.append("Confirmation preferences could not be read; repair them before relying on automatic generation.")
    if requires_confirmation:
        notes.append(
            "Per-batch confirmation is enabled. If the user asks to resume automatic generation, use "
            f"`{pvx_command()} preferences quote-confirmation skip --project {shlex.quote(project)}`."
        )
    else:
        notes.append(
            "Generation proceeds automatically after preflight; no confirmation reply is needed."
        )

    return {
        "project": project,
        "spec": str(spec_path),
        "quoted_at": utc_now(),
        "account": account,
        "balance_state": balance_state,
        "membership_tier": membership_tier,
        "detected_membership_tier": detected_membership_tier,
        "membership_override": membership_override,
        "basic_fallback_accepted": fallback_accepted,
        "membership_choice_required": membership_choice_required,
        "entitlement_state": "incompatible" if entitlement_issues else "compatible",
        "entitlement_issues": entitlement_issues,
        "planned_generation_tasks": total_count,
        "reused_tasks": reused_count,
        "counts_by_kind": dict(sorted(counts_by_kind.items())),
        "counts_by_media": dict(sorted(counts_by_media.items())),
        "requires_confirmation": requires_confirmation,
        "confirmation_mode": confirmation_mode,
        "confirmation": confirmation,
        "lines": lines,
        "notes": notes,
        "snapshot_issues": snapshot.get("issues", []),
        "pricing_sources": {
            "official_readme": "PixVerse CLI uses account credits; completed tasks report actual credit usage when available.",
            "live_commands": [
                "pixverse account info --json",
            ],
        },
        "preflight_mode": "fast",
        "preflight_wall_seconds": round(time.monotonic() - started_monotonic, 3),
    }


def quote_argv(
    argv: list[str],
    *,
    task_id: str = "",
    label: str = "",
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    kind = create_kind(argv)
    model = _option_value(argv, "--model", "-m") or _default_model(kind, snapshot)
    count = _int_option(argv, "--count", default=1)
    params = _generation_params(argv)
    return {
        "id": task_id,
        "label": label or task_id,
        "kind": kind,
        "media_type": _media_type(kind),
        "model": model,
        "params": params,
        "count": count,
        "pre_generation_credits": "not_available",
        "note": GENERATION_CONFIRMATION_NOTE,
        "prompt_preview": _prompt_preview(argv),
        **({"prompt_enhance_skill": PROMPT_ENHANCE_SKILL} if model == "seedance-2.5" else {}),
        "command": " ".join(argv),
    }


def observed_price_index(usage_payload: Any) -> dict[str, Any]:
    items = usage_payload.get("items") if isinstance(usage_payload, dict) else []
    buckets: dict[str, list[int]] = defaultdict(list)
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            model = _normalize_model(str(item.get("video_source") or ""))
            credits = item.get("credits")
            if not model or not isinstance(credits, int) or credits < 0:
                continue
            buckets[model].append(credits)
    return {
        model: {
            "max_observed_credits": max(values),
            "latest_observed_credits": values[0],
            "sample_count": len(values),
        }
        for model, values in buckets.items()
        if values
    }


def confirmation_blocker(quote: dict[str, Any]) -> str:
    if not quote.get("requires_confirmation"):
        return ""
    return "quote_confirmation_required"


def insufficient_balance_blocker(quote: dict[str, Any]) -> str:
    account = quote.get("account") if isinstance(quote.get("account"), dict) else {}
    if "authenticated" in account and account.get("authenticated") is False:
        return "authentication_required"
    if quote.get("entitlement_issues") or quote.get("membership_choice_required"):
        return "membership_route_required"
    if account.get("authenticated") is True and account.get("membership_tier") == "unknown":
        return "membership_unknown"
    balance = account.get("credits_total")
    if isinstance(balance, int) and balance <= 0:
        return "insufficient_balance"
    if balance is None:
        return "balance_unknown"
    return ""


def _default_model(kind: str, snapshot: dict[str, Any]) -> str:
    if kind == "image":
        return str(load_create_capabilities().get("modes", {}).get("image", {}).get("default_model") or "unknown")
    if kind == "voice":
        voice_models = snapshot.get("voice_models")
        if isinstance(voice_models, dict) and voice_models.get("default_model"):
            return str(voice_models["default_model"])
        return "speech-2.8-hd"
    if kind == "music":
        music_models = snapshot.get("music_models")
        if isinstance(music_models, dict) and music_models.get("default_model"):
            return str(music_models["default_model"])
        return "music-2.6"
    return "v6"


def _account_summary(payload: Any, auth_payload: Any = None) -> dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    auth_payload = auth_payload if isinstance(auth_payload, dict) else {}
    credits = payload.get("credits")
    credit_total = None
    if isinstance(credits, dict) and isinstance(credits.get("total"), int):
        credit_total = credits["total"]
    elif isinstance(payload.get("credits"), int):
        credit_total = payload["credits"]
    workspace = payload.get("workspace") if isinstance(payload.get("workspace"), dict) else {}
    member_label = (
        workspace.get("memberLabel")
        or payload.get("memberLabel")
        or auth_payload.get("memberType")
        or ""
    )
    member_type = workspace.get("memberType") if workspace.get("memberType") is not None else payload.get("memberType")
    authenticated: bool | None
    if "authenticated" in auth_payload:
        authenticated = bool(auth_payload.get("authenticated"))
    elif payload:
        authenticated = True
    else:
        authenticated = None
    return {
        "authenticated": authenticated,
        "account_fingerprint": _account_fingerprint(payload),
        "member_type": member_type,
        "member_label": member_label,
        "membership_tier": membership_tier(member_label, member_type),
        "credits_total": credit_total,
        "workspace_id": workspace.get("workspaceId"),
        "workspace_name": workspace.get("name"),
    }


def membership_tier(member_label: object, member_type: object = None) -> str:
    label = str(member_label or "").strip().lower()
    normalized_label = label.replace("-", " ").replace("_", " ")
    first_label_token = normalized_label.split(maxsplit=1)[0] if normalized_label else ""
    if label in {"0", "10"} or first_label_token in BASIC_MEMBERSHIP_LABELS:
        return "basic"
    if label:
        return "premium"
    if member_type in {0, 10, "0", "10"}:
        return "basic"
    return "unknown"


def _account_fingerprint(payload: dict[str, Any]) -> str:
    stable_value = payload.get("accountId") or payload.get("userId") or payload.get("email")
    if stable_value in (None, ""):
        return ""
    return hashlib.sha256(f"pixverse-account:{stable_value}".encode("utf-8")).hexdigest()[:20]


def _entitlement_issues(lines: list[dict[str, Any]], membership: str) -> list[dict[str, str]]:
    if membership != "basic":
        return []
    issues: list[dict[str, str]] = []
    for item in lines:
        kind = str(item.get("kind") or "")
        model = str(item.get("model") or "")
        if kind == "image" and model != FALLBACK_IMAGE_MODEL:
            issues.append(
                {
                    "task": str(item.get("id") or ""),
                    "kind": kind,
                    "model": model,
                    "required_model": FALLBACK_IMAGE_MODEL,
                    "message": "Basic/Free image fallback uses Nano Banana 2 Lite at 1080p after explicit consent.",
                }
            )
        elif kind in {"video", "reference", "transition", "extend", "modify", "motion-control"} and model != "v6":
            issues.append(
                {
                    "task": str(item.get("id") or ""),
                    "kind": kind,
                    "model": model,
                    "required_model": "v6",
                    "message": "Basic/Free video generation should use PixVerse v6.",
                }
            )
    return issues


def _redact_account_info(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    redacted = dict(payload)
    for key in ("email", "nickname", "username", "accountId"):
        if key in redacted:
            redacted[key] = "<redacted>"
    return redacted


def _redact_auth_info(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    redacted = dict(payload)
    for key in ("email", "nickname", "username", "accountId", "userId", "accessToken", "refreshToken"):
        if key in redacted:
            redacted[key] = "<redacted>"
    return redacted


def _option_value(argv: list[str], *names: str) -> str | None:
    for idx, value in enumerate(argv):
        if value in names and idx + 1 < len(argv):
            return argv[idx + 1]
        for name in names:
            prefix = f"{name}="
            if value.startswith(prefix):
                return value[len(prefix) :]
    return None


def _option_values(argv: list[str], *names: str) -> list[str]:
    values: list[str] = []
    for idx, value in enumerate(argv):
        if value in names:
            cursor = idx + 1
            while cursor < len(argv) and not argv[cursor].startswith("-"):
                values.append(argv[cursor])
                cursor += 1
            continue
        for name in names:
            prefix = f"{name}="
            if value.startswith(prefix):
                values.append(value[len(prefix) :])
    return values


def _has_flag(argv: list[str], name: str) -> bool:
    return name in argv


def _generation_params(argv: list[str]) -> dict[str, Any]:
    names = (
        "--quality",
        "--detail-level",
        "--duration",
        "--aspect-ratio",
        "--seed",
        "--image",
        "--voice-id",
        "--provider-voice-id",
        "--language",
        "--speed",
        "--stability",
        "--similarity-boost",
        "--style",
        "--volume",
        "--pitch",
        "--emotion",
        "--duration-seconds",
    )
    params: dict[str, Any] = {}
    for name in names:
        value = _option_value(argv, name)
        if value is not None:
            params[name.lstrip("-").replace("-", "_")] = value
    for flag in ("--audio", "--no-audio", "--multi-shot", "--no-multi-shot", "--instrumental", "--off-peak"):
        if _has_flag(argv, flag):
            params[flag.lstrip("-").replace("-", "_")] = True
    return params


def _prompt_text(argv: list[str]) -> str:
    raw = _option_value(argv, "--prompt", "--text") or ""
    if not raw:
        return ""
    path = Path(raw)
    try:
        if len(raw) < 240 and path.exists() and path.is_file():
            raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        raw = str(raw)
    return raw


def _prompt_preview(argv: list[str], *, limit: int = 180) -> str:
    raw = _prompt_text(argv)
    if not raw:
        return ""
    return _truncate(raw.replace("\n", " "), limit)


def _int_option(argv: list[str], name: str, *, default: int) -> int:
    raw = _option_value(argv, name)
    try:
        value = int(raw) if raw is not None else default
    except ValueError:
        return default
    return max(1, value)


def _float_option(argv: list[str], name: str) -> float | None:
    raw = _option_value(argv, name)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _capability_notes(task_id: str, kind: str, argv: list[str], model: str) -> list[str]:
    notes: list[str] = []
    model_key = _normalize_model(model)
    aspect = _option_value(argv, "--aspect-ratio")
    duration = _float_option(argv, "--duration")
    if model_key.startswith("seedance-2.0") and aspect in {"2:3", "3:2"}:
        notes.append(f"{task_id}: Seedance 2.0 does not cover {aspect}; use v6 when that aspect ratio is required.")
    if model_key.startswith("seedance-2.0") and duration is not None and duration < 4:
        notes.append(f"{task_id}: Seedance 2.0 duration starts at 4s; adjust to 4s or use v6 if the exact shorter duration matters.")
    if kind == "extend" and model_key.startswith("seedance-2.0"):
        notes.append(f"{task_id}: extend is not a Seedance route; use v6 or another supported extend model.")
    if kind == "modify" and model_key != "v5.5":
        notes.append(f"{task_id}: modify is a v5.5 route; specify --model v5.5 before quoting/running.")
    if kind == "motion-control" and model_key != "v5.6":
        notes.append(f"{task_id}: motion-control is a v5.6 route; specify --model v5.6 before quoting/running.")
    if kind == "transition" and len(_option_values(argv, "--images", "--image")) >= 3 and model_key != "v5":
        notes.append(f"{task_id}: transition with 3+ frames is a v5 route; specify --model v5 before quoting/running.")
    if kind == "upscale":
        quality = _option_value(argv, "--quality") or _option_value(argv, "-q")
        if quality and quality != "2160p":
            notes.append(
                f"{task_id}: PixVerse CLI {PIXVERSE_CLI_BASELINE_VERSION}+ video upscale supports only 2160p."
            )
    return notes


def _video_audio_notes(task_id: str, kind: str, argv: list[str]) -> list[str]:
    if _media_type(kind) != "video" or not _has_flag(argv, "--audio") or _has_flag(argv, "--no-audio"):
        return []
    prompt = _prompt_text(argv).lower()
    no_music_phrases = (
        "no music",
        "without music",
        "not generate music",
        "not generate any music",
        "do not generate music",
        "do not add music",
        "no background music",
        "no bgm",
        "no score",
        "no soundtrack",
        "no melody",
    )
    if any(phrase in prompt for phrase in no_music_phrases):
        return []
    music_terms = (
        "music",
        "bgm",
        "background music",
        "score",
        "melody",
        "orchestral",
        "trailer hit",
        "swell",
        "chime",
        "stinger",
        "uplifting bed",
    )
    if any(term in prompt for term in music_terms):
        return [
            f"{task_id}: advisory only: --audio prompt uses music-shaped language. If the goal is SFX/ambience without music, consider adding plain no-music language; do not change the requested audio mode only to silence this note."
        ]
    return []


def _normalize_model(value: str) -> str:
    return value.strip().lower().replace("standar", "standard")


def _media_type(kind: str) -> str:
    if kind == "image":
        return "image"
    if kind in {"voice", "music"}:
        return "audio"
    return "video"


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 3] + "..."
