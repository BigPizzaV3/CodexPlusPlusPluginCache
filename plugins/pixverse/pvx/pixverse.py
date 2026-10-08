from __future__ import annotations

import hashlib
import json
import re
import shlex
import subprocess
import sys
import time
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .capabilities import load_create_capabilities
from .compatibility import PIXVERSE_CLI_BASELINE_VERSION
from .model_defaults import IMAGE_MODEL, IMAGE_QUALITY, IMAGE_DETAIL, VIDEO_MODEL, VIDEO_QUALITY
from .region import effective_pixverse_region
from .shell import CommandResult, run_json, which
from .state import append_jsonl, read_jsonl, utc_now


# A task in one of these classes was submitted to PixVerse and therefore billed,
# but pvx never saw a terminal status for it. Its outcome is UNKNOWN, not failed.
# `queue reconcile` re-checks exactly these over free, read-only endpoints.
UNRESOLVED_ERROR_CLASSES = {"deadline", "deadline_unresolved"}

CREATE_KINDS = {
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

CONCURRENCY_CODES = {429, 500041, 500042, 500044}
INSUFFICIENT_BALANCE_CODES = {500043}
PROMPT_CODES = {400018, 400038}
PARAM_CODES = {400017}
MEMBERSHIP_CODES = {500323, 500342}
SUBMISSION_FEEDBACK_MIN_SECONDS = 1.0
DOWNLOAD_INITIAL_FEEDBACK_SECONDS = 2.0
DOWNLOAD_MAX_FEEDBACK_SECONDS = 30.0
QUEUE_DOWNLOAD_WORKERS = 2


def media_type_for_kind(kind: str) -> str:
    if kind == "image":
        return "image"
    if kind in {"voice", "music"}:
        return "audio"
    return "video"


def poll_type_for_kind(kind: str) -> str:
    return media_type_for_kind(kind)


def stable_key(project: str, task_id: str, command: str) -> str:
    raw = f"{project}:{task_id}:{command}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:32]


def split_command(command: str) -> list[str]:
    argv = shlex.split(command)
    if not argv:
        raise ValueError("empty command")
    if Path(argv[0]).name != "pixverse":
        raise ValueError("PixVerse Agent Plugin queue only runs pixverse commands")
    return argv


def create_kind(argv: list[str]) -> str:
    normalized = _normalize_pixverse_create_globals(argv)
    if len(normalized) >= 3 and normalized[1] == "create":
        kind = normalized[2]
        if kind in CREATE_KINDS:
            return kind
    if argv[1:3] == ["miniapps", "create"]:
        raise ValueError(
            "MiniApps creation is not supported by the pvx paid queue yet; "
            "pixverse miniapps list/info remain available for read-only inspection"
        )
    raise ValueError("queued command must be `pixverse create <kind> ...`")


def apply_generation_defaults(argv: list[str]) -> list[str]:
    """Materialize defaults when authoring a new queue, preserving explicit choices.

    Do not rewrite saved queues at load/run time: their commands may already have
    paid receipts or approval, and changing them would change idempotency keys.
    """
    args = list(argv)
    try:
        kind = create_kind(args)
    except ValueError:
        return args
    model = _argv_option_value(args, "--model", "-m")
    if not model:
        if kind == "image":
            model = IMAGE_MODEL
        elif kind in {"video", "reference"}:
            model = VIDEO_MODEL
        elif kind == "transition" and len(_argv_list_option_values(args, "--images")) == 2:
            model = VIDEO_MODEL
        if model:
            args.extend(["--model", model])
    if model in {IMAGE_MODEL, VIDEO_MODEL} and not _argv_option_value(args, "--quality", "-q"):
        args.extend(["--quality", IMAGE_QUALITY if model == IMAGE_MODEL else VIDEO_QUALITY])
    if model == IMAGE_MODEL and not _argv_option_value(args, "--detail-level"):
        args.extend(["--detail-level", IMAGE_DETAIL])
    return args


def validate_create_argv(argv: list[str]) -> str:
    """Validate release-pinned capability walls that would otherwise spend a failed task."""
    effective_pixverse_region(argv[1:])
    argv = _normalize_pixverse_create_globals(argv)
    kind = create_kind(argv)
    workspace_id = _argv_option_value(argv, "--workspace-id")
    if workspace_id:
        raise ValueError(
            "queued paid generation does not accept --workspace-id; select the intended active "
            "workspace before preflight so account, balance, submission, and reconciliation stay aligned"
        )
    if kind == "upscale":
        quality = _argv_option_value(argv, "--quality", "-q")
        if quality and quality != "2160p":
            raise ValueError(
                f"PixVerse CLI {PIXVERSE_CLI_BASELINE_VERSION}+ video upscale supports only --quality 2160p"
            )
    model = _argv_option_value(argv, "--model", "-m")
    if model == "seedance-2.5":
        if kind not in {"video", "reference", "transition"}:
            raise ValueError(
                "Seedance 2.5 is supported only for video, reference, and two-frame transition generation"
            )
        for flag, message in (
            ("--audio", "Seedance 2.5 does not expose an audio toggle; omit --audio and describe the desired sound in the prompt. This does not mean the model cannot generate audio"),
            ("--no-audio", "Seedance 2.5 does not expose an audio toggle; omit --no-audio and remove the audio track during local export if a silent deliverable is required"),
            ("--multi-shot", "Seedance 2.5 does not support generated multi-shot mode"),
            ("--off-peak", "Seedance 2.5 does not support off-peak generation"),
        ):
            if _argv_has_option(argv, flag):
                raise ValueError(message)
        quality = _argv_option_value(argv, "--quality", "-q")
        if quality and quality not in {"480p", "720p", "1080p"}:
            raise ValueError("Seedance 2.5 quality must be 480p, 720p, or 1080p")
        aspect_ratio = _argv_option_value(argv, "--aspect-ratio")
        if aspect_ratio and kind in {"video", "reference"} and aspect_ratio not in {
            "auto",
            "21:9",
            "16:9",
            "4:3",
            "1:1",
            "3:4",
            "9:16",
        }:
            raise ValueError(f"Seedance 2.5 does not support aspect ratio {aspect_ratio}")
        duration = _argv_option_value(argv, "--duration", "-d")
        if duration and not (kind == "reference" and duration == "auto"):
            try:
                duration_value = float(duration)
            except ValueError as exc:
                raise ValueError("Seedance 2.5 duration must be an integer from 4 to 30") from exc
            if not duration_value.is_integer() or duration_value < 4 or duration_value > 30:
                raise ValueError("Seedance 2.5 duration must be an integer from 4 to 30")
        task_type = _argv_option_value(argv, "--task-type")
        if task_type:
            if kind != "reference":
                raise ValueError("--task-type is available only for Seedance 2.5 reference generation")
            if task_type not in {"auto", "reference", "edit", "extend"}:
                raise ValueError("Seedance 2.5 --task-type must be auto, reference, edit, or extend")
        if kind == "transition" and len(_argv_list_option_values(argv, "--images")) != 2:
            raise ValueError("Seedance 2.5 transition requires exactly two keyframe images")
        if kind == "reference":
            reference_limits = {"--images": 30, "--videos": 10, "--audios": 10}
            reference_counts = {
                option: len(_argv_list_option_values(argv, option))
                for option in reference_limits
            }
            for option, limit in reference_limits.items():
                if reference_counts[option] > limit:
                    raise ValueError(
                        f"Seedance 2.5 reference accepts at most {limit} values for {option}"
                    )
            if sum(reference_counts.values()) > 50:
                raise ValueError("Seedance 2.5 reference accepts at most 50 total media references")
    if kind == "music" and (
        _argv_has_option(argv, "--no-duration-auto") or _argv_option_value(argv, "--duration-seconds")
    ):
        # PixVerse music routes generate at automatic duration; the live service rejects
        # a fixed target (400017 "duration_seconds is reserved"). Trim, loop or fade locally.
        raise ValueError(
            "PixVerse music generation uses automatic duration; drop --duration-seconds / "
            "--no-duration-auto and trim, loop or fade the returned audio locally to the picture"
        )
    _validate_create_capability_argv(argv, kind=kind, model=model)
    return kind


def _normalize_pixverse_create_globals(argv: list[str]) -> list[str]:
    if not argv:
        return []
    command_args = [argv[0]]
    deferred: list[str] = []
    index = 1
    while index < len(argv):
        argument = argv[index]
        if argument == "--":
            command_args.extend(argv[index:])
            break
        if argument in {"--json", "-p"}:
            deferred.append(argument)
            index += 1
            continue
        if argument in {"--workspace-id", "--trace-id", "--region"}:
            deferred.append(argument)
            if index + 1 < len(argv):
                deferred.append(argv[index + 1])
            index += 2
            continue
        if any(
            argument.startswith(f"{name}=")
            for name in ("--workspace-id", "--trace-id", "--region")
        ):
            deferred.append(argument)
            index += 1
            continue
        command_args.append(argument)
        index += 1
    return [*command_args, *deferred]


def _parameter_flags(parameter: dict[str, Any]) -> list[str]:
    declaration = str(parameter.get("flag") or "")
    flags: list[str] = []
    for part in declaration.replace(",", "/").split("/"):
        token = part.strip().split(maxsplit=1)[0] if part.strip() else ""
        if token.startswith("-"):
            flags.append(token)
    return flags


def _parameter_is_present(argv: list[str], parameter: dict[str, Any]) -> bool:
    return any(_argv_has_option(argv, flag) for flag in _parameter_flags(parameter))


def _parameter_value(argv: list[str], parameter: dict[str, Any]) -> str:
    flags = _parameter_flags(parameter)
    return _argv_option_value(argv, *flags) if flags else ""


def _parameter_list_values(argv: list[str], parameter: dict[str, Any]) -> list[str]:
    flags = _parameter_flags(parameter)
    return _argv_list_option_values(argv, flags[0]) if flags else []


def _positive_boolean_requested(argv: list[str], parameter: dict[str, Any]) -> bool:
    flags = _parameter_flags(parameter)
    positive = next((flag for flag in flags if not flag.startswith("--no-")), "")
    return bool(positive and _argv_has_option(argv, positive))


def _validate_integer_parameter(name: str, value: str, contract: dict[str, Any]) -> None:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"--{name.replace('_', '-')} must be an integer") from exc
    minimum = contract.get("min")
    maximum = contract.get("max")
    if isinstance(minimum, int) and parsed < minimum:
        raise ValueError(f"--{name.replace('_', '-')} must be at least {minimum}")
    if isinstance(maximum, int) and parsed > maximum:
        raise ValueError(f"--{name.replace('_', '-')} must be at most {maximum}")


def _validate_create_capability_argv(argv: list[str], *, kind: str, model: str) -> None:
    create = load_create_capabilities()
    modes = create.get("modes") if isinstance(create.get("modes"), dict) else {}
    mode = modes.get(kind) if isinstance(modes, dict) else None
    if not isinstance(mode, dict):
        return
    parameters = mode.get("parameters") if isinstance(mode.get("parameters"), dict) else {}
    shared = (
        create.get("shared_parameters")
        if isinstance(create.get("shared_parameters"), dict)
        else {}
    )
    selected_model = model or str(mode.get("default_model") or "")
    model_ids = mode.get("model_ids")
    if model and isinstance(model_ids, list) and model not in model_ids:
        raise ValueError(f"model {model!r} is not supported by pixverse create {kind}")

    # The offline video enum combines T2V and I2V ratios. The CLI's H3
    # builders reject T2V auto and silently force I2V auto, so validate the
    # selected input mode before a paid plan can promise different framing.
    if selected_model in {"minimax-h3", "minimax-h3-max"} and kind == "video":
        aspect = _argv_option_value(argv, "--aspect-ratio")
        image = _argv_option_value(argv, "--image")
        if not image and aspect == "auto":
            raise ValueError(f"{selected_model} text-to-video does not support --aspect-ratio auto")
        if image and aspect and aspect != "auto":
            raise ValueError(
                f"{selected_model} image-to-video forces automatic framing; "
                "omit --aspect-ratio or use auto, or choose reference mode for a fixed ratio"
            )

    for name, parameter in parameters.items():
        if not isinstance(parameter, dict):
            continue
        parameter_type = str(parameter.get("type") or "")
        present = _parameter_is_present(argv, parameter)
        values = _parameter_list_values(argv, parameter) if parameter_type == "media_list" else []
        value = _parameter_value(argv, parameter) if parameter_type not in {"boolean", "media_list"} else ""
        if parameter.get("required") is True and not (present and (values or value or parameter_type == "boolean")):
            flag = _parameter_flags(parameter)[0] if _parameter_flags(parameter) else name
            raise ValueError(f"pixverse create {kind} requires {flag}")
        minimum_count = parameter.get("min_count")
        if isinstance(minimum_count, int) and present and len(values) < minimum_count:
            flag = _parameter_flags(parameter)[0] if _parameter_flags(parameter) else name
            raise ValueError(f"{flag} requires at least {minimum_count} values")
        if present and parameter_type == "integer":
            _validate_integer_parameter(name, value, parameter)

    model_parameters = mode.get("model_parameters")
    for name, by_model in (
        model_parameters.items() if isinstance(model_parameters, dict) else []
    ):
        contract = by_model.get(selected_model) if isinstance(by_model, dict) else None
        parameter = parameters.get(name) if isinstance(parameters.get(name), dict) else shared.get(name)
        if not isinstance(contract, dict) or not isinstance(parameter, dict):
            continue
        present = _parameter_is_present(argv, parameter)
        parameter_type = str(parameter.get("type") or "")
        if contract.get("supported") is False and (
            _positive_boolean_requested(argv, parameter) if parameter_type == "boolean" else present
        ):
            flag = _parameter_flags(parameter)[0] if _parameter_flags(parameter) else name
            raise ValueError(f"{selected_model} does not support {flag} for pixverse create {kind}")
        if not present:
            continue
        values = _parameter_list_values(argv, parameter) if parameter_type == "media_list" else []
        value = _parameter_value(argv, parameter) if parameter_type not in {"boolean", "media_list"} else ""
        if parameter_type == "integer":
            _validate_integer_parameter(name, value, contract)
        allowed = contract.get("enum")
        if isinstance(allowed, list) and value and str(value) not in {str(item) for item in allowed}:
            flag = _parameter_flags(parameter)[0] if _parameter_flags(parameter) else name
            raise ValueError(f"{flag}={value!r} is not supported by {selected_model}")
        maximum_count = contract.get("max_count")
        if isinstance(maximum_count, int) and len(values) > maximum_count:
            flag = _parameter_flags(parameter)[0] if _parameter_flags(parameter) else name
            raise ValueError(f"{selected_model} accepts at most {maximum_count} values for {flag}")

    for name, parameter in shared.items():
        if not isinstance(parameter, dict) or not _parameter_is_present(argv, parameter):
            continue
        if parameter.get("type") == "integer":
            _validate_integer_parameter(name, _parameter_value(argv, parameter), parameter)


    if kind == "reference":
        reference_counts = {
            name: len(_parameter_list_values(argv, parameters[name]))
            for name in ("images", "videos", "audios")
            if isinstance(parameters.get(name), dict)
        }
        if sum(reference_counts.values()) == 0:
            raise ValueError("pixverse create reference requires at least one image, video, or audio reference")
        if reference_counts.get("audios", 0) and not (
            reference_counts.get("images", 0) or reference_counts.get("videos", 0)
        ) and selected_model != "wan-3.0":
            raise ValueError("audio references require an image or video reference for this model")
        metadata = mode.get("model_metadata")
        model_metadata = metadata.get(selected_model) if isinstance(metadata, dict) else None
        total_limit = model_metadata.get("max_reference_items") if isinstance(model_metadata, dict) else None
        if isinstance(total_limit, int) and sum(reference_counts.values()) > total_limit:
            raise ValueError(f"{selected_model} accepts at most {total_limit} total media references")

    if kind == "transition":
        image_parameter = parameters.get("images") if isinstance(parameters.get("images"), dict) else {}
        image_count = len(_parameter_list_values(argv, image_parameter))
        variants = mode.get("variants") if isinstance(mode.get("variants"), dict) else {}
        variant_name = "two_frames" if image_count == 2 else "multi_frame" if image_count >= 3 else ""
        variant = variants.get(variant_name) if isinstance(variants, dict) else None
        allowed_models = variant.get("allowed_models") if isinstance(variant, dict) else None
        if selected_model and isinstance(allowed_models, list) and selected_model not in allowed_models:
            raise ValueError(
                f"{selected_model} is not supported for a {image_count}-frame transition"
            )
        rules = mode.get("rules")
        for rule in rules if isinstance(rules, list) else []:
            if not isinstance(rule, dict) or rule.get("id") != "transition-prompt-required":
                continue
            required_models = rule.get("when", {}).get("model", {}).get("in", [])
            if selected_model in required_models:
                prompt = parameters.get("prompt") if isinstance(parameters.get("prompt"), dict) else {}
                if not _parameter_value(argv, prompt):
                    raise ValueError(f"{selected_model} transition requires --prompt")


def _argv_option_value(argv: list[str], *names: str) -> str:
    for index, value in enumerate(argv):
        if value in names:
            return argv[index + 1] if index + 1 < len(argv) else ""
        for name in names:
            if value.startswith(f"{name}="):
                return value.split("=", 1)[1]
    return ""


def _argv_has_option(argv: list[str], name: str) -> bool:
    return any(value == name or value.startswith(f"{name}=") for value in argv)


def _argv_list_option_values(argv: list[str], name: str) -> list[str]:
    try:
        index = argv.index(name) + 1
    except ValueError:
        return []
    values: list[str] = []
    while index < len(argv) and not argv[index].startswith("-"):
        values.append(argv[index])
        index += 1
    return values


def ensure_async_json_args(argv: list[str], key: str) -> list[str]:
    out = list(argv)
    if "--json" not in out and "-p" not in out:
        out.append("--json")
    if "--no-wait" not in out:
        out.append("--no-wait")
    try:
        kind = create_kind(out)
    except ValueError:
        kind = ""
    if kind in {"voice", "music"}:
        if "--client-request-id" not in out:
            out.extend(["--client-request-id", key])
    elif "--idempotency-key" not in out:
        out.extend(["--idempotency-key", key])
    return out


def extract_task_id(payload: dict[str, Any], kind: str) -> str | None:
    media = media_type_for_kind(kind)
    candidates = [
        f"{media}_id",
        "video_id",
        "image_id",
        "audio_id",
        "voice_id",
        "music_id",
        "id",
    ]
    for key in candidates:
        value = payload.get(key)
        if value:
            return str(value)
    for key in ("video_ids", "image_ids", "audio_ids", "ids"):
        value = payload.get(key)
        if isinstance(value, list) and value:
            return str(value[0])
    return None


def classify_error(result: CommandResult, payload: dict[str, Any] | None = None) -> str:
    if result.returncode == 7:
        return "concurrency"
    payload = payload or {}
    if not payload:
        payload = _parse_error_payload(result)
    text = f"{result.stderr}\n{result.stdout}\n{json.dumps(payload, ensure_ascii=False)}".lower()
    # PixVerse media paths avoid the CLI's URL re-upload ceiling, but a
    # provider-generated image can still exceed a downstream model's dimension
    # wall (for example a 6336 px-wide 21:9 board against a 6000 px maximum).
    # Keep this more specific than the provider's generic 400017 parameter code
    # so the queue can localize the internal asset and let the CLI's existing
    # local-image resize path repair it once, after the server reports the issue.
    if (
        "width and height between 300 and 6000" in text
        or "no larger than 30mb" in text
        or "image dimensions" in text and "6000" in text
    ):
        return "reference_input_invalid"
    if "file too large" in text or "payload too large" in text or "max: 10mb" in text:
        return "input_too_large"
    code = payload.get("code")
    if isinstance(code, str) and code.isdigit():
        code = int(code)
    if code in CONCURRENCY_CODES:
        return "concurrency"
    if code in INSUFFICIENT_BALANCE_CODES:
        return "insufficient_balance"
    if code in PROMPT_CODES:
        return "prompt_invalid"
    if code in PARAM_CODES:
        return "param_invalid"
    if code in MEMBERSHIP_CODES:
        return "membership_required"
    if any(
        phrase in text
        for phrase in (
            "membership required",
            "subscription required",
            "upgrade your plan",
            "upgrade plan",
            "not available for current plan",
            "not available on your plan",
            "insufficient entitlement",
            "user rights insufficient",
            "\u6743\u76ca\u4e0d\u8db3",
            "\u4f1a\u5458\u6743\u76ca",
            "\u9700\u8981\u4f1a\u5458",
        )
    ):
        return "membership_required"
    if "auth" in text or "login" in text:
        return "auth"
    if "quota" in text or "concurrent" in text or "over limit" in text:
        return "concurrency"
    if "credit" in text or "balance" in text:
        return "insufficient_balance"
    if "voice is required" in text or "duration_seconds is reserved" in text:
        return "param_invalid"
    if "timeout" in text:
        return "timeout"
    return "unknown"


def _parse_error_payload(result: CommandResult) -> dict[str, Any]:
    for raw in (result.stdout, result.stderr):
        text = raw.strip()
        if not text.startswith("{"):
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    return {}


@dataclass
class TaskSpec:
    id: str
    command: str
    label: str = ""
    depends_on: list[str] = field(default_factory=list)
    # A reused task carries an already generated asset from an earlier run. It is
    # never submitted again; dependents resolve `{{id.path}}` from these values.
    reuse: dict[str, Any] | None = None


REUSE_FIELDS = ("task_id", "path", "url", "cover_url", "local_path")


def reuse_record_from_manifest(manifest: Path, task_id: str) -> dict[str, Any] | None:
    """Find the latest successful manifest row for a queue task id (free, read-only)."""
    latest: dict[str, Any] | None = None
    for row in read_jsonl(manifest):
        if str(row.get("event") or "") != "task.success" or str(row.get("id") or "") != task_id:
            continue
        if not (row.get("path") or row.get("local_path") or row.get("url")):
            continue
        latest = row
    if latest is None:
        return None
    record = {field_name: str(latest.get(field_name) or "") for field_name in REUSE_FIELDS}
    record["command"] = str(latest.get("command") or "")
    record["source_task"] = task_id
    record["completed_at"] = str(latest.get("completed_at") or latest.get("at") or "")
    record["cost_credits"] = latest.get("cost_credits")
    return record


@dataclass
class TaskState:
    spec: TaskSpec
    kind: str
    media_type: str
    command: str
    idempotency_key: str
    task_id: str = ""
    status: str = "pending"
    url: str = ""
    cover_url: str = ""
    path: str = ""
    local_path: str = ""
    local_preview_status: str = ""
    local_preview_error: str = ""
    error_class: str = ""
    error_message: str = ""
    submitted_at: str = ""
    completed_at: str = ""
    cost_credits: int | None = None
    cost_source: str = ""
    status_code: Any = None
    provider_info: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    def record(self) -> dict[str, Any]:
        record: dict[str, Any] = {
            "id": self.spec.id,
            "label": self.spec.label,
            "kind": self.kind,
            "media_type": self.media_type,
            "command": self.command,
            "task_id": self.task_id,
            "status": self.status,
            "url": self.url,
            "cover_url": self.cover_url,
            "path": self.path,
            "local_path": self.local_path,
            "local_preview_status": self.local_preview_status,
            "local_preview_error": self.local_preview_error,
            "error_class": self.error_class,
            "error_message": self.error_message,
            "submitted_at": self.submitted_at,
            "completed_at": self.completed_at,
        }
        if self.cost_credits is not None:
            record["cost_credits"] = self.cost_credits
            record["cost_source"] = self.cost_source
        if self.status_code is not None:
            record["status_code"] = self.status_code
        return record


def _terminal_event(event: str, state: TaskState, **extra: Any) -> dict[str, Any]:
    """Build a terminal manifest event that keeps the server's own words.

    pvx used to drop `status_code` and the provider payload on `task.failed`,
    so a terminal event recorded *less* than the `task.progress` events that
    preceded it. When v04 produced nine silent `generation_failed` results there
    was nothing on disk to autopsy. Terminal events now carry the raw payload.
    """
    payload: dict[str, Any] = {"event": event, "at": utc_now(), **state.record()}
    if state.provider_info:
        payload["provider_info"] = state.provider_info
    payload.update(extra)
    return payload


def _apply_terminal(
    state: TaskState,
    info: dict[str, Any],
    terminal: str,
    error_class: str,
    error_message: str,
) -> None:
    """Fold a terminal PixVerse status payload into a task state."""
    state.status = terminal
    state.error_class = error_class
    state.error_message = error_message
    state.status_code = info.get("status_code")
    state.provider_info = dict(info)
    state.completed_at = utc_now()
    if terminal != "success":
        return
    state.url, state.cover_url = result_urls(info)
    poll_cost, poll_source = extract_credit_cost(info)
    if poll_cost is not None and state.cost_credits is None:
        state.cost_credits = poll_cost
        state.cost_source = f"task_status.{poll_source}"
    asset_payload = asset_info(state.task_id, state.kind)
    state.path = asset_path_from_info(asset_payload)
    asset_cost, asset_source = extract_credit_cost(asset_payload)
    if asset_cost is not None and state.cost_credits is None:
        state.cost_credits = asset_cost
        state.cost_source = f"asset_info.{asset_source}"
    if asset_payload:
        state.provider_info = {**state.provider_info, "asset_info": asset_payload}


PLACEHOLDER_RE = re.compile(r"\{\{([\w-]+)\.(url|cover_url|path|task_id)\}\}")


def canonicalize_internal_asset_placeholders(command: str) -> str:
    """Keep PixVerse-generated dependencies inside PixVerse's media store.

    A generated image URL can point at a PNG larger than the CLI's 10 MB
    upload ceiling. Feeding that URL back into another create command makes the
    CLI download and re-upload its own asset, which is both unnecessary and can
    fail after the paid upstream task has completed. Internal queue references
    therefore use the provider media path. Existing queue specs that still use
    ``{{task.url}}`` are normalized at load time for backward compatibility.
    User-supplied local paths and external URLs are unaffected because they are
    not placeholders.
    """
    return re.sub(r"\{\{([\w-]+)\.url\}\}", r"{{\1.path}}", command)


def placeholder_refs(command: str) -> list[str]:
    refs: list[str] = []
    for match in PLACEHOLDER_RE.finditer(command):
        ref = match.group(1)
        if ref not in refs:
            refs.append(ref)
    return refs


def substitute_placeholders(command: str, states: dict[str, TaskState]) -> str:
    def replace(match: re.Match[str]) -> str:
        task_name, field = match.group(1), match.group(2)
        state = states.get(task_name)
        if state is None or state.status != "success":
            raise ValueError(f"cannot resolve placeholder {match.group(0)}")
        value = getattr(state, field)
        if not value:
            raise ValueError(f"placeholder {match.group(0)} resolved empty")
        return value

    return PLACEHOLDER_RE.sub(replace, command)


def _localized_internal_image_command(
    *,
    state: TaskState,
    states: dict[str, TaskState],
    project_path: Path,
) -> tuple[str, list[dict[str, str]]] | None:
    """Localize generated image dependencies only after a provider limit error.

    The normal route stays fast and server-side: ``{{image.path}}`` is sent as a
    PixVerse media path. If the downstream endpoint rejects that generated image
    for dimensions or payload size before returning a task id, this helper
    downloads only the affected internal image(s). PixVerse CLI already resizes
    oversized *local* image inputs to its safe 1920x1920 envelope, so the retry
    reuses that established path instead of duplicating image inspection logic in
    pvx. Direct user paths and external URLs are deliberately untouched.
    """
    replacements: list[tuple[str, TaskState]] = []
    for match in PLACEHOLDER_RE.finditer(state.command):
        dependency_id, field = match.group(1), match.group(2)
        upstream = states.get(dependency_id)
        if field != "path" or upstream is None or upstream.kind != "image" or not upstream.task_id:
            continue
        if all(existing_id != dependency_id for existing_id, _ in replacements):
            replacements.append((dependency_id, upstream))
    if not replacements:
        return None

    localized = state.command
    records: list[dict[str, str]] = []
    cache_root = project_path / "assets" / "reference-fallbacks" / state.spec.id
    cache_root.mkdir(parents=True, exist_ok=True)
    for dependency_id, upstream in replacements:
        destination = cache_root / dependency_id
        destination.mkdir(parents=True, exist_ok=True)
        candidates = sorted(
            (
                item
                for item in destination.iterdir()
                if item.is_file() and item.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            ),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        )
        local_file = candidates[0].resolve() if candidates else None
        if local_file is None:
            try:
                result, payload = run_json(
                    [
                        "pixverse",
                        "asset",
                        "download",
                        upstream.task_id,
                        "--type",
                        "image",
                        "--dest",
                        str(destination),
                        "--json",
                    ],
                    timeout=180,
                )
            except subprocess.TimeoutExpired:
                return None
            downloaded = Path(str(payload.get("file") or "")).expanduser()
            if result.ok and downloaded.is_file():
                local_file = downloaded.resolve()
            else:
                candidates = sorted(
                    (
                        item
                        for item in destination.iterdir()
                        if item.is_file()
                        and item.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
                    ),
                    key=lambda item: item.stat().st_mtime,
                    reverse=True,
                )
                local_file = candidates[0].resolve() if candidates else None
        if local_file is None:
            return None
        token = f"{{{{{dependency_id}.path}}}}"
        localized = localized.replace(token, shlex.quote(str(local_file)))
        records.append(
            {
                "dependency_id": dependency_id,
                "task_id": upstream.task_id,
                "provider_path": upstream.path,
                "local_file": str(local_file),
            }
        )

    return substitute_placeholders(localized, states), records


def read_slots() -> dict[str, int]:
    fallback = {"image": 1, "video": 1, "audio": 1, "shared_pool": 1, "shared_limit": 1}
    if not which("pixverse"):
        return fallback
    try:
        result, payload = run_json(["pixverse", "account", "slots", "--json"], timeout=20)
    except subprocess.TimeoutExpired:
        return fallback
    if not result.ok or not isinstance(payload, dict):
        return fallback
    out: dict[str, int] = {}
    shared = bool(payload.get("shared_pool"))
    out["shared_pool"] = int(shared)
    for kind in ("image", "video"):
        info = payload.get(kind)
        if isinstance(info, dict):
            if info.get("unlimited"):
                out[kind] = 4
                out[f"{kind}_limit"] = 4
            else:
                out[kind] = max(0, int(info.get("remaining", 0) or 0))
        else:
            out[kind] = 1
    out["audio"] = min(out.get("video", 1), 2) if shared else 1
    out["audio_limit"] = 2 if shared else 1
    if shared and any(f"{kind}_limit" in out for kind in ("image", "video")):
        out["shared_limit"] = 4
    return out


def terminal_from_status(info: dict[str, Any]) -> tuple[str | None, str, str]:
    status = str(info.get("status") or "").lower()
    status_code = info.get("status_code")
    if status in {"completed", "success", "succeeded"}:
        return "success", "", ""
    if status_code in {7, 8} or status in {"failed", "error", "rejected", "not approved"}:
        blob = " ".join(
            str(info.get(key) or "")
            for key in ("error", "error_message", "message", "code", "status")
        )
        if status_code == 7:
            return "failed", "audit_reject", blob.strip()
        code = info.get("code")
        if isinstance(code, str) and code.isdigit():
            code = int(code)
        lowered = blob.lower()
        if code in MEMBERSHIP_CODES or any(
            phrase in lowered
            for phrase in (
                "membership required",
                "subscription required",
                "upgrade your plan",
                "upgrade plan",
                "not available for current plan",
                "not available on your plan",
                "insufficient entitlement",
                "\u6743\u76ca\u4e0d\u8db3",
                "\u4f1a\u5458\u6743\u76ca",
                "\u9700\u8981\u4f1a\u5458",
            )
        ):
            return "failed", "membership_required", blob.strip()
        if "not approved" in lowered:
            return "failed", "audit_reject", blob.strip()
        if code in INSUFFICIENT_BALANCE_CODES or "insufficient balance" in lowered or "insufficient credit" in lowered:
            return "failed", "insufficient_balance", blob.strip()
        if "auth" in lowered or "login" in lowered or "\u767b\u5f55" in lowered:
            return "failed", "auth", blob.strip()
        return "failed", "generation_failed", blob.strip()
    return None, "", ""


def result_urls(info: dict[str, Any]) -> tuple[str, str]:
    url = str(
        info.get("video_url")
        or info.get("image_url")
        or info.get("audio_url")
        or info.get("url")
        or ""
    )
    cover = str(info.get("cover_url") or info.get("thumbnail_url") or "")
    return url, cover


def asset_info(task_id: str, kind: str) -> dict[str, Any]:
    try:
        result, payload = run_json(
            ["pixverse", "asset", "info", task_id, "--type", poll_type_for_kind(kind), "--json"],
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return {}
    if not result.ok or not isinstance(payload, dict):
        return {}
    return payload


def asset_path_from_info(info: dict[str, Any]) -> str:
    return str(info.get("video_path") or info.get("image_path") or info.get("audio_path") or "")


def ensure_local_asset(
    *,
    task_id: str,
    media_type: str,
    project_path: Path,
    existing_path: str = "",
    progress: bool = False,
    label: str = "",
    expected_bytes: int | None = None,
) -> dict[str, str]:
    """Download a generated asset to a stable project-local preview path.

    PixVerse status and asset-info payloads expose public URLs and provider media
    paths, neither of which Codex can reliably render inline. Keep those provider
    values for audit and queue dependencies, but always give user-facing preview
    and project QA a real local file. A task-specific directory also makes this
    operation idempotent when a queue is resumed or reconciled.
    """
    if existing_path:
        existing = Path(existing_path).expanduser()
        if _usable_local_file(existing):
            return {
                "local_path": str(existing.resolve()),
                "status": "ready",
                "error": "",
            }

    normalized_type = media_type if media_type in {"image", "video", "audio"} else ""
    directory_name = {"image": "images", "video": "videos", "audio": "audio"}.get(
        normalized_type,
        "media",
    )
    safe_task_id = re.sub(r"[^A-Za-z0-9._-]+", "-", task_id).strip("-.") or "unknown-task"
    destination = (project_path / "assets" / directory_name / safe_task_id).resolve()

    cached = _latest_local_asset(destination, normalized_type)
    if cached is not None:
        return {"local_path": str(cached), "status": "ready", "error": ""}
    if not task_id:
        return {
            "local_path": "",
            "status": "task_id_missing",
            "error": "Cannot download a generated asset without its PixVerse task id.",
        }

    destination.mkdir(parents=True, exist_ok=True)
    argv = ["pixverse", "asset", "download", task_id]
    if normalized_type:
        argv.extend(["--type", normalized_type])
    argv.extend(["--dest", str(destination), "--json"])
    try:
        result, payload = _run_json_with_download_feedback(
            argv,
            timeout=5 * 60,
            progress=progress,
            destination=destination,
            label=label or task_id,
            expected_bytes=expected_bytes,
        )
    except subprocess.TimeoutExpired:
        return {
            "local_path": "",
            "status": "download_timeout",
            "error": "Local preview download timed out; the generated provider asset is unchanged.",
        }

    raw_file = str(payload.get("file") or "") if isinstance(payload, dict) else ""
    candidates: list[Path] = []
    if raw_file:
        reported = Path(raw_file).expanduser()
        candidates.append(reported)
        if not reported.is_absolute():
            candidates.append(destination / reported)
    candidates.extend(
        path
        for path in [_latest_local_asset(destination, normalized_type)]
        if path is not None
    )
    downloaded = next((path.resolve() for path in candidates if _usable_local_file(path)), None)
    if result.ok and downloaded is not None:
        return {"local_path": str(downloaded), "status": "ready", "error": ""}
    return {
        "local_path": "",
        "status": "download_failed",
        "error": result.stderr or result.stdout or "PixVerse asset download returned no local file.",
    }


def _latest_local_asset(destination: Path, media_type: str = "") -> Path | None:
    if not destination.is_dir():
        return None
    suffixes = {
        "image": {".gif", ".jpeg", ".jpg", ".png", ".webp"},
        "video": {".m4v", ".mov", ".mp4", ".webm"},
        "audio": {".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"},
    }.get(media_type, set())
    candidates = sorted(
        (
            path
            for path in destination.rglob("*")
            if not path.name.startswith(".")
            and (not suffixes or path.suffix.lower() in suffixes)
            and _usable_local_file(path)
        ),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0].resolve() if candidates else None


def _usable_local_file(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def asset_size_from_info(info: dict[str, Any]) -> int | None:
    for key in ("file_size_bytes", "size_bytes", "content_length", "file_size", "size"):
        value = info.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value > 0:
            return value
        if isinstance(value, str) and value.isdigit() and int(value) > 0:
            return int(value)
    return None


def _localize_successful_state(
    state: TaskState,
    *,
    project_path: Path,
    progress: bool,
) -> None:
    if state.status != "success":
        return
    _emit_progress(
        progress,
        f"{state.spec.id} generated successfully; downloading the {state.media_type} for a local Codex preview.",
    )
    localized = ensure_local_asset(
        task_id=state.task_id,
        media_type=state.media_type,
        project_path=project_path,
        existing_path=state.local_path,
        progress=progress,
        label=state.spec.label or state.spec.id,
        expected_bytes=asset_size_from_info(
            state.provider_info.get("asset_info")
            if isinstance(state.provider_info.get("asset_info"), dict)
            else {}
        ),
    )
    state.local_path = localized["local_path"]
    state.local_preview_status = localized["status"]
    state.local_preview_error = localized["error"]
    if state.local_path:
        _emit_progress(
            progress,
            f"Local preview ready for {state.spec.label or state.spec.id}: {state.local_path}",
        )
    else:
        _emit_progress(
            progress,
            f"{state.spec.id} succeeded, but its local preview is unavailable "
            f"({state.local_preview_status}). The provider asset was not regenerated.",
        )


def extract_credit_cost(payload: dict[str, Any]) -> tuple[int | None, str]:
    candidates = (
        ("cost_credits", "cost_credits"),
        ("credits", "credits"),
        ("credit", "credit"),
        ("consume_credits", "consume_credits"),
        ("used_credits", "used_credits"),
    )
    for key, source in candidates:
        value = payload.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value >= 0:
            return value, source
        if isinstance(value, float) and value >= 0 and value.is_integer():
            return int(value), source
        if isinstance(value, str) and value.isdigit():
            return int(value), source
    return None, ""


def load_task_specs(path: Path) -> tuple[str, list[TaskSpec]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    project = str(payload.get("project") or path.stem)
    tasks_raw = payload.get("tasks")
    if not isinstance(tasks_raw, list) or not tasks_raw:
        raise ValueError("queue spec must contain a non-empty `tasks` list")
    tasks: list[TaskSpec] = []
    seen: set[str] = set()
    for idx, item in enumerate(tasks_raw, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"tasks[{idx}] must be an object")
        task_id = str(item.get("id") or f"task-{idx}")
        if task_id in seen:
            raise ValueError(f"duplicate task id: {task_id}")
        seen.add(task_id)
        reuse_raw = item.get("reuse")
        reuse: dict[str, Any] | None = None
        if reuse_raw is not None:
            if not isinstance(reuse_raw, dict):
                raise ValueError(f"task {task_id} reuse must be an object")
            reuse = {key: str(reuse_raw.get(key) or "") for key in REUSE_FIELDS}
            reuse["source_task"] = str(reuse_raw.get("source_task") or task_id)
            reuse["project"] = str(reuse_raw.get("project") or "")
            if not reuse["task_id"] or not (reuse["path"] or reuse["local_path"] or reuse["url"]):
                raise ValueError(
                    f"task {task_id} reuse needs task_id and one of path/local_path/url "
                    "(use `queue append --reuse <project>:<task-id>` to fill them from a manifest)"
                )
        command = canonicalize_internal_asset_placeholders(
            str(item.get("cmd") or item.get("command") or (reuse_raw or {}).get("command") or "").strip()
        )
        if not command:
            raise ValueError(f"task {task_id} missing command")
        try:
            validate_create_argv(split_command(command))
        except ValueError as exc:
            raise ValueError(f"task {task_id} invalid command: {exc}") from exc
        deps = item.get("depends_on") or []
        if isinstance(deps, str):
            deps = [deps]
        deps = [str(dep) for dep in deps]
        if reuse is None:
            for ref in placeholder_refs(command):
                if ref not in deps:
                    deps.append(ref)
        tasks.append(
            TaskSpec(
                id=task_id,
                command=command,
                label=str(item.get("label") or task_id),
                depends_on=deps,
                reuse=reuse,
            )
        )
    for task in tasks:
        for dep in task.depends_on:
            if dep not in seen:
                raise ValueError(f"task {task.id} depends on unknown task {dep}")
    return project, tasks


def _restore_queue_states_from_manifest(
    states: dict[str, TaskState], manifest: Path
) -> dict[str, int]:
    """Resume an unchanged queue without recreating completed audio or media.

    Video and image commands have provider idempotency keys, but current voice
    and music commands only expose a client request id. A host crash followed by
    an unchanged queue rerun could therefore create duplicate paid audio. Reuse
    exact successful commands and resume exact in-flight commands from the
    append-only manifest before considering any new submission.
    """
    counts = {"success": 0, "running": 0, "unresolved": 0, "failed": 0}
    restored_ids: set[str] = set()
    for row in read_jsonl(manifest):
        event = str(row.get("event") or "")
        spec_id = str(row.get("id") or "")
        state = states.get(spec_id)
        if state is None or not event.startswith("task."):
            continue
        row_command = str(row.get("command") or "").strip()
        canonical_row_command = canonicalize_internal_asset_placeholders(row_command)
        command_matches = bool(row_command) and canonical_row_command == state.command
        exact_command_matches = bool(row_command) and row_command == state.command

        if (
            event == "task.localized"
            and state.status == "success"
            and str(row.get("task_id") or "") == state.task_id
        ):
            state.local_path = str(row.get("local_path") or state.local_path)
            state.local_preview_status = str(
                row.get("local_preview_status") or state.local_preview_status
            )
            state.local_preview_error = str(
                row.get("local_preview_error") or state.local_preview_error
            )
            continue
        if not command_matches:
            continue

        if event == "task.success":
            state.status = "success"
            state.task_id = str(row.get("task_id") or "")
            state.url = str(row.get("url") or "")
            state.cover_url = str(row.get("cover_url") or "")
            state.path = str(row.get("path") or "")
            state.local_path = str(row.get("local_path") or "")
            state.local_preview_status = str(row.get("local_preview_status") or "")
            state.local_preview_error = str(row.get("local_preview_error") or "")
            state.submitted_at = str(row.get("submitted_at") or "")
            state.completed_at = str(row.get("completed_at") or "")
            state.status_code = row.get("status_code")
            if isinstance(row.get("cost_credits"), int):
                state.cost_credits = int(row["cost_credits"])
                state.cost_source = str(row.get("cost_source") or "manifest")
            restored_ids.add(spec_id)
            continue

        if state.status == "success":
            continue
        task_id = str(row.get("task_id") or "")
        if event == "task.submitted" and task_id:
            state.status = "running"
            state.task_id = task_id
            state.submitted_at = str(row.get("submitted_at") or row.get("at") or "")
            restored_ids.add(spec_id)
        elif event == "task.unresolved":
            state.task_id = task_id
            state.error_class = str(row.get("error_class") or "")
            state.error_message = str(row.get("error_message") or "")
            state.status = "running" if task_id else "unresolved"
            restored_ids.add(spec_id)
        elif event == "task.failed":
            if exact_command_matches:
                # A genuine failure for the exact command is terminal.
                state.status = "failed"
                state.task_id = task_id
                state.error_class = str(row.get("error_class") or "")
                state.error_message = str(row.get("error_message") or "")
                state.completed_at = str(row.get("completed_at") or row.get("at") or "")
                restored_ids.add(spec_id)
            else:
                # Historic URL transport was canonicalized to media path. That
                # is a materially repaired command, so do not keep an earlier
                # URL submission or failure alive in the new run.
                state.status = "pending"
                state.task_id = ""
                state.error_class = ""
                state.error_message = ""
                restored_ids.discard(spec_id)

    for spec_id in restored_ids:
        status = states[spec_id].status
        if status in counts:
            counts[status] += 1
    return counts


def _apply_reused_states(states: dict[str, TaskState], manifest: Path) -> list[str]:
    """Mark reused tasks successful from their recorded asset instead of submitting them."""
    applied: list[str] = []
    for state in states.values():
        reuse = state.spec.reuse
        if not reuse or state.status == "success":
            continue
        state.status = "success"
        state.task_id = str(reuse.get("task_id") or "")
        state.url = str(reuse.get("url") or "")
        state.cover_url = str(reuse.get("cover_url") or "")
        state.path = str(reuse.get("path") or "")
        local_path = str(reuse.get("local_path") or "")
        if local_path and Path(local_path).is_file():
            state.local_path = local_path
            state.local_preview_status = "ready"
        state.cost_credits = 0
        state.cost_source = "reused"
        state.completed_at = utc_now()
        state.provider_info = {"reused_from": {k: v for k, v in reuse.items() if v}}
        append_jsonl(manifest, _terminal_event("task.success", state, reused=True))
        applied.append(state.spec.id)
    return applied


def _emit_progress(enabled: bool, message: str) -> None:
    if enabled:
        print(f"[pixverse-agent] {message}", file=sys.stderr, flush=True)


def _run_json_with_wait_feedback(
    argv: list[str],
    *,
    timeout: float,
    progress: bool,
    feedback_interval: float,
    message: str,
) -> tuple[CommandResult, dict[str, Any]]:
    """Keep a slow provider submission conversational without retrying it."""
    interval = max(SUBMISSION_FEEDBACK_MIN_SECONDS, min(feedback_interval, 30.0))
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="pvx-submit") as executor:
        future = executor.submit(run_json, argv, timeout)
        while True:
            try:
                return future.result(timeout=interval)
            except FutureTimeoutError:
                _emit_progress(progress, message)


def _run_json_with_download_feedback(
    argv: list[str],
    *,
    timeout: float,
    progress: bool,
    destination: Path,
    label: str,
    expected_bytes: int | None = None,
) -> tuple[CommandResult, dict[str, Any]]:
    """Keep local delivery responsive without spamming long downloads.

    Fast downloads return immediately. For slower ones, sample byte growth in
    the task-specific destination, estimate recent throughput, and adapt the
    next heartbeat from a quick initial response to a 30-second large-file cap.
    """
    started = time.monotonic()
    last_sample_at = started
    last_bytes = _downloaded_bytes(destination)
    smoothed_rate = 0.0
    feedback_interval = DOWNLOAD_INITIAL_FEEDBACK_SECONDS
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="pvx-download") as executor:
        future = executor.submit(run_json, argv, timeout)
        while True:
            try:
                return future.result(timeout=feedback_interval)
            except FutureTimeoutError:
                now = time.monotonic()
                downloaded = _downloaded_bytes(destination)
                sample_seconds = max(0.001, now - last_sample_at)
                instant_rate = max(0, downloaded - last_bytes) / sample_seconds
                if instant_rate > 0:
                    smoothed_rate = (
                        instant_rate
                        if smoothed_rate <= 0
                        else smoothed_rate * 0.4 + instant_rate * 0.6
                    )
                elif smoothed_rate > 0:
                    smoothed_rate *= 0.5
                elapsed = now - started
                _emit_progress(
                    progress,
                    _download_feedback_message(
                        label=label,
                        downloaded_bytes=downloaded,
                        bytes_per_second=smoothed_rate,
                        expected_bytes=expected_bytes,
                        elapsed_seconds=elapsed,
                    ),
                )
                feedback_interval = _next_download_feedback_interval(
                    elapsed_seconds=elapsed,
                    downloaded_bytes=downloaded,
                    bytes_per_second=smoothed_rate,
                )
                last_sample_at = now
                last_bytes = downloaded


def _downloaded_bytes(destination: Path) -> int:
    if not destination.is_dir():
        return 0
    total = 0
    for path in destination.rglob("*"):
        try:
            if path.is_file():
                total += path.stat().st_size
        except OSError:
            continue
    return total


def _next_download_feedback_interval(
    *,
    elapsed_seconds: float,
    downloaded_bytes: int,
    bytes_per_second: float,
) -> float:
    mib = 1024 * 1024
    if downloaded_bytes >= 256 * mib:
        return DOWNLOAD_MAX_FEEDBACK_SECONDS
    if downloaded_bytes >= 64 * mib:
        return 20.0
    if bytes_per_second >= 8 * mib:
        return 15.0
    if bytes_per_second >= 1 * mib:
        return 10.0
    if bytes_per_second > 0:
        return 5.0
    if elapsed_seconds < 5:
        return 3.0
    if elapsed_seconds < 15:
        return 5.0
    if elapsed_seconds < 35:
        return 10.0
    return DOWNLOAD_MAX_FEEDBACK_SECONDS


def _download_feedback_message(
    *,
    label: str,
    downloaded_bytes: int,
    bytes_per_second: float,
    expected_bytes: int | None,
    elapsed_seconds: float,
) -> str:
    details: list[str] = []
    if downloaded_bytes > 0:
        details.append(f"downloaded {_format_bytes(downloaded_bytes)}")
    if expected_bytes and expected_bytes > 0:
        percent = min(100.0, downloaded_bytes / expected_bytes * 100)
        details.append(f"{percent:.0f}%")
    if bytes_per_second > 0:
        details.append(f"recent speed {_format_bytes(bytes_per_second)}/s")
    if (
        expected_bytes
        and expected_bytes > downloaded_bytes
        and bytes_per_second > 0
    ):
        eta = (expected_bytes - downloaded_bytes) / bytes_per_second
        details.append(f"ETA {_format_elapsed(eta)}")
    progress_text = ", ".join(details) if details else "waiting for local file data"
    return (
        f"Still downloading the local preview for {label}: {progress_text}; "
        f"elapsed {_format_elapsed(elapsed_seconds)}. Generation is complete and no regeneration was submitted."
    )


def _format_bytes(value: float | int) -> str:
    amount = float(max(0, value))
    for unit in ("B", "KiB", "MiB", "GiB"):
        if amount < 1024 or unit == "GiB":
            return f"{amount:.1f} {unit}" if unit != "B" else f"{amount:.0f} {unit}"
        amount /= 1024
    return f"{amount:.1f} GiB"


def _resolve_states(
    states: list[TaskState],
    *,
    manifest: Path,
    project_path: Path,
    progress: bool = False,
) -> list[TaskState]:
    """Re-check already-submitted tasks once, over free read-only endpoints.

    A submitted task has already been billed. Whatever pvx thinks, its outcome is
    unknown -- never "failed" -- until PixVerse itself reports a terminal status.
    Every recovered result is APPENDED to the manifest; no existing line is ever
    rewritten. Tasks still running are listed in `pending-reconcile.jsonl`.

    Returns the states that are still not terminal.
    """
    still_open: list[TaskState] = []
    by_type: dict[str, list[TaskState]] = {}
    for state in states:
        if state.task_id:
            by_type.setdefault(poll_type_for_kind(state.kind), []).append(state)

    for poll_type, group in by_type.items():
        ids = ",".join(state.task_id for state in group)
        try:
            result, payload = run_json(
                ["pixverse", "task", "status", "--ids", ids, "--type", poll_type, "--json"],
                timeout=40,
            )
        except subprocess.TimeoutExpired:
            _emit_progress(
                progress,
                f"Status re-check timed out for {ids}; keeping the billed task(s) unresolved for later reconcile.",
            )
            still_open.extend(group)
            continue
        if not result.ok or not isinstance(payload, dict):
            still_open.extend(group)
            continue
        by_id = {state.task_id: state for state in group}
        for task_id, info in payload.items():
            state = by_id.get(str(task_id))
            if state is None or not isinstance(info, dict):
                continue
            terminal, error_class, error_message = terminal_from_status(info)
            if terminal is None:
                continue
            previous = state.error_class or "orphan"
            _apply_terminal(state, info, terminal, error_class, error_message)
            if terminal == "success":
                _localize_successful_state(
                    state,
                    project_path=project_path,
                    progress=progress,
                )
            append_jsonl(
                manifest,
                _terminal_event(
                    f"task.{terminal}",
                    state,
                    reconciled=True,
                    reconciled_from=previous,
                ),
            )
            _emit_progress(
                progress,
                f"{state.spec.id} re-checked after the deadline: PixVerse reports {terminal} "
                f"(task {state.task_id}).",
            )
        still_open.extend(state for state in group if state.status not in {"success", "failed"})

    for state in still_open:
        append_jsonl(
            project_path / "pending-reconcile.jsonl",
            {
                "at": utc_now(),
                "id": state.spec.id,
                "task_id": state.task_id,
                "kind": state.kind,
                "media_type": state.media_type,
                "status": "unresolved",
                "error_class": state.error_class or "deadline_unresolved",
                "note": (
                    "Submitted and billed; PixVerse had not reached a terminal status at re-check "
                    "time. This is not a failure. Re-check later with `pvx queue reconcile "
                    "<project-slug>`, which is free and read-only."
                ),
            },
        )
    return still_open


def _state_from_manifest_row(row: dict[str, Any]) -> TaskState:
    """Rebuild a minimal TaskState from an append-only manifest event."""
    kind = str(row.get("kind") or "")
    if kind not in CREATE_KINDS:
        kind = "video"
    command = str(row.get("command") or "")
    return TaskState(
        spec=TaskSpec(
            id=str(row.get("id") or ""),
            command=command,
            label=str(row.get("label") or ""),
        ),
        kind=kind,
        media_type=str(row.get("media_type") or media_type_for_kind(kind)),
        command=command,
        idempotency_key="",
        task_id=str(row.get("task_id") or ""),
        status="unresolved",
        error_class=str(row.get("error_class") or ""),
        submitted_at=str(row.get("submitted_at") or ""),
    )


def unresolved_manifest_entries(manifest: Path) -> list[dict[str, Any]]:
    """Find submitted-but-unresolved tasks in an append-only manifest.

    Two ways a paid task ends up stranded:

    1. No terminal event at all -- the process died mid-poll. This is the v05
       ghost-directory case: 4 x `task.submitted`, 112 x `task.progress`, zero
       terminal events, four completed videos nobody ever downloaded.
    2. A terminal event whose `error_class` is in the deadline family -- the
       queue gave up on a task PixVerse was still working on.

    A task that PixVerse itself reported as failed (`generation_failed`,
    `audit_reject`, ...) is genuinely finished and is NOT re-checked.
    """
    latest: dict[str, dict[str, Any]] = {}
    resolved: set[str] = set()
    genuinely_failed: set[str] = set()
    for row in read_jsonl(manifest):
        event = str(row.get("event") or "")
        spec_id = str(row.get("id") or "")
        if not spec_id or not event.startswith("task."):
            continue
        if str(row.get("task_id") or ""):
            latest[spec_id] = row
        if event == "task.success":
            resolved.add(spec_id)
        elif event == "task.failed" and str(row.get("error_class") or "") not in UNRESOLVED_ERROR_CLASSES:
            genuinely_failed.add(spec_id)
    return [
        row
        for spec_id, row in latest.items()
        if spec_id not in resolved and spec_id not in genuinely_failed
    ]


def reconcile_project(*, project_path: Path, dry_run: bool = False) -> dict[str, Any]:
    """Recover billed-but-unrecorded tasks for a project. Free and read-only.

    Fixes both the deadline mis-accounting and the orphaned-task path (a queue
    process that died before its tasks finished).
    """
    manifest = project_path / "manifest.jsonl"
    candidates = [_state_from_manifest_row(row) for row in unresolved_manifest_entries(manifest)]
    checked = [
        {"id": state.spec.id, "task_id": state.task_id, "error_class": state.error_class or "orphan"}
        for state in candidates
    ]
    if dry_run or not candidates:
        return {
            "dry_run": dry_run,
            "checked": checked,
            "recovered": [],
            "confirmed_failed": [],
            "still_pending": checked if dry_run else [],
        }

    _resolve_states(candidates, manifest=manifest, project_path=project_path)
    return {
        "dry_run": False,
        "checked": checked,
        "recovered": [
            {
                "id": state.spec.id,
                "task_id": state.task_id,
                "url": state.url,
                "path": state.path,
                "local_path": state.local_path,
                "local_preview_status": state.local_preview_status,
            }
            for state in candidates
            if state.status == "success"
        ],
        "confirmed_failed": [
            {"id": state.spec.id, "task_id": state.task_id, "error_class": state.error_class}
            for state in candidates
            if state.status == "failed"
        ],
        "still_pending": [
            {"id": state.spec.id, "task_id": state.task_id}
            for state in candidates
            if state.status not in {"success", "failed"}
        ],
    }


def run_queue(
    *,
    spec_path: Path,
    project_path: Path,
    dry_run: bool = False,
    poll_interval: float = 15.0,
    status_interval: float = 30.0,
    deadline_seconds: float = 25 * 60,
    progress: bool = True,
) -> list[dict[str, Any]]:
    # Downloading completed media must not prevent filling free generation
    # slots or checking other paid tasks. Keep local delivery bounded and let
    # the queue's main thread own manifest writes and the final result.
    with ThreadPoolExecutor(
        max_workers=QUEUE_DOWNLOAD_WORKERS, thread_name_prefix="pvx-local-preview"
    ) as download_executor:
        return _run_queue(
            spec_path=spec_path,
            project_path=project_path,
            download_executor=download_executor,
            dry_run=dry_run,
            poll_interval=poll_interval,
            status_interval=status_interval,
            deadline_seconds=deadline_seconds,
            progress=progress,
        )


def _run_queue(
    *,
    spec_path: Path,
    project_path: Path,
    download_executor: ThreadPoolExecutor,
    dry_run: bool = False,
    poll_interval: float = 15.0,
    status_interval: float = 30.0,
    deadline_seconds: float = 25 * 60,
    progress: bool = True,
) -> list[dict[str, Any]]:
    project, specs = load_task_specs(spec_path)
    manifest = project_path / "manifest.jsonl"
    states: dict[str, TaskState] = {}
    for spec in specs:
        command = spec.command
        for ref in placeholder_refs(command):
            if ref not in spec.depends_on:
                spec.depends_on.append(ref)
        argv = split_command(command)
        kind = create_kind(argv)
        key = stable_key(project, spec.id, command)
        states[spec.id] = TaskState(
            spec=spec,
            kind=kind,
            media_type=media_type_for_kind(kind),
            command=command,
            idempotency_key=key,
        )
    if dry_run:
        return [state.record() | {"status": "dry_run"} for state in states.values()]

    restored = _restore_queue_states_from_manifest(states, manifest)
    reused_ids = _apply_reused_states(states, manifest)
    if reused_ids:
        _emit_progress(
            progress,
            f"Reusing {len(reused_ids)} accepted asset(s) without new generation: {', '.join(reused_ids)}.",
        )

    for state in states.values():
        if state.status != "success":
            continue
        previous_localization = (
            state.local_path,
            state.local_preview_status,
            state.local_preview_error,
        )
        _localize_successful_state(
            state,
            project_path=project_path,
            progress=progress,
        )
        if (
            state.local_path,
            state.local_preview_status,
            state.local_preview_error,
        ) != previous_localization:
            append_jsonl(
                manifest,
                {"event": "task.localized", "at": utc_now(), **state.record()},
            )

    _emit_progress(
        progress,
        f"Queue ready: {len(states)} task(s), polling every {poll_interval:g}s, deadline {deadline_seconds:g}s.",
    )
    restored_total = sum(restored.values())
    if restored_total:
        _emit_progress(
            progress,
            "Recovered unchanged queue state from the project manifest: "
            f"{restored['success']} ready, {restored['running']} still running, "
            f"{restored['unresolved']} unresolved, {restored['failed']} failed; "
            "no duplicate submissions were made for those tasks.",
        )
    progress_cache: dict[str, str] = {}
    periodic_cache: dict[str, tuple[str, float]] = {}
    task_progress_signatures: dict[str, str] = {}
    submitted_monotonic: dict[str, float] = {}

    def progress_once(key: str, message: str) -> None:
        if progress_cache.get(key) == message:
            return
        progress_cache[key] = message
        _emit_progress(progress, message)

    def progress_periodic(key: str, signature: str, message: str) -> None:
        now = time.monotonic()
        previous = periodic_cache.get(key)
        interval = max(status_interval, poll_interval, 1.0)
        if previous is None or previous[0] != signature or now - previous[1] >= interval:
            periodic_cache[key] = (signature, now)
            _emit_progress(progress, message)

    download_jobs: dict[str, Future[None]] = {}

    def collect_downloads(*, wait: bool = False) -> None:
        for spec_id, future in list(download_jobs.items()):
            if not wait and not future.done():
                continue
            state = states[spec_id]
            try:
                future.result()
            except Exception as exc:
                # Delivery failures never change the provider's successful
                # generation or authorize a new paid attempt.
                state.local_preview_status = "download_failed"
                state.local_preview_error = str(exc)
                _emit_progress(progress, f"{spec_id} generated successfully, but local delivery failed: {exc}")
            append_jsonl(manifest, _terminal_event("task.success", state))
            del download_jobs[spec_id]
            finished = sum(
                item.status in {"success", "failed", "unresolved"} for item in states.values()
            )
            preview = "is ready" if state.local_path else "has no usable local preview yet"
            progress_once(
                f"success:{spec_id}",
                f"{spec_id} completed successfully — {state.spec.label or spec_id} {preview} "
                f"({finished}/{len(states)} generated or terminal).",
            )

    def stop_pending_for_account_failure() -> None:
        blocker = next((item for item in states.values()
                        if item.error_class in {"membership_required", "auth", "insufficient_balance"}), None)
        if blocker is None:
            return
        for pending in states.values():
            if pending.status != "pending":
                continue
            pending.status = "failed"
            pending.error_class = "account_blocked"
            pending.error_message = f"Not submitted: {blocker.spec.id} reported {blocker.error_class}. Wait for the user's account/route choice and a fresh preflight."
            pending.completed_at = utc_now()
            append_jsonl(manifest, _terminal_event("task.failed", pending))
        progress_once("account-blocked", "Account access stopped new submissions. Keep existing task IDs; show the subscription link and wait for upgrade or explicit fallback choice.")

    deadline = time.monotonic() + deadline_seconds
    while True:
        collect_downloads()
        stop_pending_for_account_failure()
        progressed = False
        # Capacity only affects new submissions. Polling an existing paid task
        # (or waiting for its dependent input) needs no account-slots request.
        ready_to_submit = any(
            state.status == "pending"
            and all(states[dep].status == "success" for dep in state.spec.depends_on)
            for state in states.values()
        )
        slots = read_slots() if ready_to_submit else {}
        inflight_by_type: dict[str, int] = {"image": 0, "video": 0, "audio": 0}
        for state in states.values():
            if state.status == "running":
                inflight_by_type[state.media_type] = inflight_by_type.get(state.media_type, 0) + 1

        # `remaining` already excludes work occupying the account's slots.
        # Treat it as a budget for NEW submissions, not a total inflight limit.
        # Only the explicit local safeguards (unknown/unlimited capacity and
        # audio) need to subtract this queue's known inflight tasks.
        submission_budget = {
            kind: max(0, slots.get(kind, 0)) for kind in ("image", "video", "audio")
        }
        for kind in submission_budget:
            local_limit = slots.get(f"{kind}_limit")
            if local_limit is not None:
                submission_budget[kind] = min(
                    submission_budget[kind], max(0, local_limit - inflight_by_type[kind])
                )
        shared_pool = bool(slots.get("shared_pool"))
        shared_budget = min(slots.get("image", 0), slots.get("video", 0))
        if "shared_limit" in slots:
            shared_budget = min(
                shared_budget, max(0, slots["shared_limit"] - sum(inflight_by_type.values()))
            )

        for state in states.values():
            if state.status != "pending":
                continue
            if any(states[dep].status != "success" for dep in state.spec.depends_on):
                blocking_statuses = {states[dep].status for dep in state.spec.depends_on}
                if blocking_statuses & {"failed", "unresolved"}:
                    state.status = "failed"
                    state.error_class = (
                        "upstream_unresolved" if "unresolved" in blocking_statuses else "upstream_failed"
                    )
                    state.completed_at = utc_now()
                    append_jsonl(manifest, _terminal_event("task.failed", state))
                    progress_once(
                        f"failed:{state.spec.id}",
                        f"{state.spec.id} was not submitted because an upstream task did not finish safely.",
                    )
                    progressed = True
                continue
            available = submission_budget[state.media_type]
            if shared_pool:
                available = min(available, shared_budget)
            if available <= 0:
                progress_once(
                    f"slot:{state.spec.id}",
                    f"{state.spec.id} is waiting for a {state.media_type} slot "
                    f"({inflight_by_type.get(state.media_type, 0)} awaiting status, {available} available"
                    f"{' in the shared pool' if shared_pool else ''}).",
                )
                continue
            try:
                resolved = substitute_placeholders(state.command, states)
            except ValueError as exc:
                state.status = "failed"
                state.error_class = "upstream_asset_unavailable"
                state.error_message = str(exc)
                state.completed_at = utc_now()
                append_jsonl(manifest, _terminal_event("task.failed", state))
                progress_once(
                    f"failed:{state.spec.id}",
                    f"{state.spec.id} was not submitted because its upstream PixVerse media path is unavailable.",
                )
                progressed = True
                continue
            argv = ensure_async_json_args(split_command(resolved), state.idempotency_key)
            progress_once(
                f"submit:{state.spec.id}",
                f"Submitting {state.spec.id} ({state.media_type}): {state.spec.label or state.spec.id}.",
            )
            try:
                result, payload = _run_json_with_wait_feedback(
                    argv,
                    timeout=90,
                    progress=progress,
                    feedback_interval=status_interval,
                    message=(
                        f"Still submitting {state.spec.id}; PixVerse has not returned a task id yet. "
                        "The request is still in flight and no duplicate retry has been sent."
                    ),
                )
            except subprocess.TimeoutExpired:
                state.status = "unresolved"
                state.error_class = "submit_timeout_unknown"
                state.error_message = (
                    "PixVerse CLI did not return a task id before the submission timeout. "
                    "The request may have reached the provider, so pvx did not retry or claim that no credits were spent."
                )
                state.completed_at = utc_now()
                append_jsonl(manifest, _terminal_event("task.unresolved", state))
                progress_once(
                    f"unresolved:{state.spec.id}",
                    f"{state.spec.id} submission outcome is unknown; no task id returned and no duplicate retry was sent.",
                )
                progressed = True
                continue
            if not result.ok:
                state.error_class = classify_error(result, payload)
                # Do not inspect every reference up front. Only a definite
                # pre-submission image-limit rejection activates this fallback,
                # and only for generated image placeholders with a known task id.
                # The retry is safe because the rejected response contained no
                # provider task id; a distinct key prevents a cached rejection
                # from shadowing the repaired local-input request.
                if (
                    state.error_class in {"reference_input_invalid", "input_too_large"}
                    and not extract_task_id(payload, state.kind)
                ):
                    localized = _localized_internal_image_command(
                        state=state,
                        states=states,
                        project_path=project_path,
                    )
                    if localized is not None:
                        localized_command, localized_assets = localized
                        append_jsonl(
                            manifest,
                            {
                                "event": "task.reference_fallback",
                                "at": utc_now(),
                                **state.record(),
                                "trigger_error_class": state.error_class,
                                "localized_assets": localized_assets,
                                "note": (
                                    "The provider rejected an internal media path before task submission. "
                                    "pvx localized the generated image and retried once through PixVerse "
                                    "CLI's built-in local-image resize path."
                                ),
                            },
                        )
                        progress_once(
                            f"reference-fallback:{state.spec.id}",
                            f"{state.spec.id} hit a reference-image limit before submission; "
                            "localized the internal image and retrying once through the CLI's safe resize path.",
                        )
                        retry_key = stable_key(
                            project,
                            state.spec.id,
                            f"{state.command}:localized-reference-fallback:v1",
                        )
                        retry_argv = ensure_async_json_args(
                            split_command(localized_command),
                            retry_key,
                        )
                        try:
                            result, payload = _run_json_with_wait_feedback(
                                retry_argv,
                                timeout=90,
                                progress=progress,
                                feedback_interval=status_interval,
                                message=(
                                    f"Still submitting the repaired {state.spec.id} request; "
                                    "no further retry will be sent without a provider result."
                                ),
                            )
                        except subprocess.TimeoutExpired:
                            state.status = "unresolved"
                            state.error_class = "submit_timeout_unknown"
                            state.error_message = (
                                "The one-time localized-reference retry did not return a task id before "
                                "the submission timeout. It may have reached PixVerse, so pvx did not retry again."
                            )
                            state.completed_at = utc_now()
                            append_jsonl(manifest, _terminal_event("task.unresolved", state))
                            progress_once(
                                f"unresolved:{state.spec.id}",
                                f"{state.spec.id} localized-reference retry outcome is unknown; no duplicate retry was sent.",
                            )
                            progressed = True
                            continue
                        state.error_class = "" if result.ok else classify_error(result, payload)
                if not result.ok:
                    if state.error_class == "concurrency":
                        # A definite full-pool response invalidates this pass's
                        # capacity snapshot. Do not probe every pending task;
                        # poll existing work, then obtain fresh capacity.
                        submission_budget[state.media_type] = 0
                        progress_once(
                            f"concurrency:{state.spec.id}",
                            f"{state.spec.id} hit a PixVerse concurrency response; waiting instead of resubmitting.",
                        )
                        if shared_pool:
                            shared_budget = 0
                            break
                        continue
                    state.status = "failed"
                    state.error_message = result.stderr or result.stdout
                    state.completed_at = utc_now()
                    state.provider_info = payload if isinstance(payload, dict) else {}
                    state.status_code = state.provider_info.get("code")
                    append_jsonl(manifest, _terminal_event("task.failed", state))
                    progress_once(f"failed:{state.spec.id}", f"{state.spec.id} failed: {state.error_class}.")
                    stop_pending_for_account_failure()
                    progressed = True
                    continue
            task_id = extract_task_id(payload, state.kind)
            if not task_id:
                state.status = "failed"
                state.error_class = "missing_task_id"
                state.error_message = json.dumps(payload, ensure_ascii=False)
                state.completed_at = utc_now()
                state.provider_info = payload if isinstance(payload, dict) else {}
                append_jsonl(manifest, _terminal_event("task.failed", state))
                progress_once(f"failed:{state.spec.id}", f"{state.spec.id} failed: missing PixVerse task id.")
                progressed = True
                continue
            state.task_id = task_id
            state.status = "running"
            state.submitted_at = utc_now()
            submitted_monotonic[state.spec.id] = time.monotonic()
            state.raw = payload
            state.cost_credits, source = extract_credit_cost(payload)
            state.cost_source = f"submit.{source}" if source else ""
            inflight_by_type[state.media_type] = inflight_by_type.get(state.media_type, 0) + 1
            submission_budget[state.media_type] -= 1
            if shared_pool:
                shared_budget -= 1
            append_jsonl(manifest, {"event": "task.submitted", "at": utc_now(), **state.record()})
            progress_once(f"submitted:{state.spec.id}", f"Submitted {state.spec.id}: task {state.task_id}.")
            progressed = True

        running = [state for state in states.values() if state.status == "running"]
        if running:
            by_type: dict[str, list[TaskState]] = {}
            for state in running:
                by_type.setdefault(poll_type_for_kind(state.kind), []).append(state)
            for poll_type, group in by_type.items():
                ids = ",".join(state.task_id for state in group)
                progress_once(f"poll:{poll_type}:{ids}", f"Polling {len(group)} {poll_type} task(s): {ids}.")
                try:
                    result, payload = run_json(
                        ["pixverse", "task", "status", "--ids", ids, "--type", poll_type, "--json"],
                        timeout=40,
                    )
                except subprocess.TimeoutExpired:
                    progress_once(
                        f"poll-timeout:{poll_type}:{ids}",
                        f"Status check timed out for {ids}; the paid task stays running and will be checked again.",
                    )
                    continue
                if not result.ok or not isinstance(payload, dict):
                    continue
                by_id = {state.task_id: state for state in group}
                for task_id, info in payload.items():
                    if not isinstance(info, dict):
                        continue
                    state = by_id.get(str(task_id))
                    if state is None:
                        continue
                    terminal, error_class, error_message = terminal_from_status(info)
                    if terminal is None:
                        status_text = str(info.get("status") or info.get("status_code") or "running")
                        percent = info.get("progress_percent")
                        percent_suffix = f", {percent}%" if percent not in (None, "") else ""
                        code = info.get("status_code")
                        code_suffix = f", code {code}" if code not in (None, "") else ""
                        elapsed = _format_elapsed(time.monotonic() - submitted_monotonic.get(state.spec.id, time.monotonic()))
                        signature = f"{status_text}:{code}:{percent}"
                        # Provider state is often unchanged across dozens of polls.
                        # Emit and persist only real state/percent changes; the aggregate
                        # studio heartbeat owns elapsed-time reassurance.
                        if task_progress_signatures.get(state.spec.id) != signature:
                            task_progress_signatures[state.spec.id] = signature
                            _emit_progress(
                                progress,
                                f"{state.spec.id} still {status_text}{percent_suffix}{code_suffix}; "
                                f"elapsed {elapsed}; task {state.task_id}.",
                            )
                            append_jsonl(
                                manifest,
                                {
                                    "event": "task.progress",
                                    "at": utc_now(),
                                    "id": state.spec.id,
                                    "task_id": state.task_id,
                                    "status": info.get("status"),
                                    "status_code": info.get("status_code"),
                                    "progress_percent": info.get("progress_percent"),
                                },
                            )
                        continue
                    _apply_terminal(state, info, terminal, error_class, error_message)
                    if terminal == "success":
                        state.local_preview_status = "downloading"
                        download_jobs[state.spec.id] = download_executor.submit(
                            _localize_successful_state,
                            state,
                            project_path=project_path,
                            progress=progress,
                        )
                    else:
                        progress_once(f"failed:{state.spec.id}", f"{state.spec.id} failed: {error_class}.")
                        append_jsonl(manifest, _terminal_event(f"task.{terminal}", state))
                    progressed = True

        collect_downloads()
        status_counts = {
            status: sum(state.status == status for state in states.values())
            for status in ("success", "failed", "unresolved", "running", "pending")
        }
        active_labels = [
            state.spec.label or state.spec.id
            for state in states.values()
            if state.status == "running"
        ][:3]
        local_ready = sum(state.local_preview_status == "ready" for state in states.values())
        heartbeat_signature = ":".join(
            f"{task_id}={state.status}:{state.local_preview_status}" for task_id, state in states.items()
        )
        active_text = ", ".join(active_labels) if active_labels else "none"
        progress_periodic(
            "queue-heartbeat",
            heartbeat_signature,
            "Studio heartbeat: "
            f"{status_counts['success']}/{len(states)} generated, {local_ready} local previews ready, "
            f"{len(download_jobs)} downloading or queued for download, "
            f"{status_counts['running']} awaiting provider status, {status_counts['pending']} waiting, "
            f"{status_counts['failed']} failed, {status_counts['unresolved']} unresolved; active: {active_text}.",
        )

        if all(state.status in {"success", "failed", "unresolved"} for state in states.values()):
            collect_downloads(wait=True)
            _emit_progress(
                progress,
                f"Queue finished — {status_counts['success']}/{len(states)} asset task(s) ready, "
                f"{status_counts['failed']} failed, {status_counts['unresolved']} unresolved.",
            )
            return [state.record() for state in states.values()]
        if time.monotonic() >= deadline:
            # The deadline is one wall-clock budget shared by the whole queue, not a
            # per-task timeout. Reaching it says nothing about any individual task.
            # It used to mark every non-terminal task `failed / deadline` with no
            # final poll -- including tasks PixVerse had already completed and
            # billed. Split by whether a task was ever submitted, then re-check.
            unresolved: list[TaskState] = []
            for state in states.values():
                if state.status in {"success", "failed", "unresolved"}:
                    continue
                state.completed_at = utc_now()
                if not state.task_id:
                    # Never submitted: no PixVerse task exists and nothing was billed.
                    state.status = "failed"
                    state.error_class = "deadline_not_submitted"
                    state.error_message = (
                        "Queue deadline reached before this task was submitted. "
                        "No PixVerse task was created and no credits were spent."
                    )
                    append_jsonl(manifest, _terminal_event("task.failed", state))
                    progress_once(
                        f"deadline:{state.spec.id}",
                        f"{state.spec.id} was never submitted before the queue deadline; no credits were spent.",
                    )
                    continue
                # Submitted means billed. Outcome unknown, not failed.
                state.status = "unresolved"
                state.error_class = "deadline_unresolved"
                state.error_message = (
                    "Queue deadline reached while PixVerse was still working on this task. "
                    "It was submitted and billed; its outcome is unknown, not failed."
                )
                append_jsonl(manifest, _terminal_event("task.unresolved", state))
                unresolved.append(state)
            if unresolved:
                _emit_progress(
                    progress,
                    f"Deadline reached with {len(unresolved)} submitted task(s) still running. "
                    "They are already billed, so re-checking them once before reporting.",
                )
                _resolve_states(
                    unresolved,
                    manifest=manifest,
                    project_path=project_path,
                    progress=progress,
                )
            collect_downloads(wait=True)
            _emit_progress(progress, "Queue finished at deadline.")
            return [state.record() for state in states.values()]
        # A submission is progress, but does not justify immediately polling
        # the same still-running job again. Advance ready dependencies now;
        # otherwise let the normal polling interval elapse.
        can_advance_pending = any(
            state.status == "pending"
            and all(states[dep].status not in {"pending", "running"} for dep in state.spec.depends_on)
            for state in states.values()
        )
        if not progressed or not can_advance_pending:
            time.sleep(min(max(poll_interval, 1.0), max(1.0, deadline - time.monotonic())))


def _format_elapsed(seconds: float) -> str:
    seconds = max(0, int(seconds))
    minutes, remainder = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{remainder:02d}s"
    if minutes:
        return f"{minutes}m{remainder:02d}s"
    return f"{remainder}s"
