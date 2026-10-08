from __future__ import annotations

from typing import Any

from .capabilities import create_model_parameter, create_model_supported, load_create_capabilities
from .compatibility import PIXVERSE_CLI_BASELINE_VERSION
from .model_defaults import (
    IMAGE_MODEL, IMAGE_QUALITY, IMAGE_DETAIL, VIDEO_MODEL, VIDEO_QUALITY,
    FALLBACK_VIDEO_QUALITY, PROMPT_ENHANCE_SKILL,
)


SEEDANCE_ASPECTS = {"16:9", "4:3", "1:1", "3:4", "9:16", "21:9"}
SEEDANCE_25_ASPECTS = SEEDANCE_ASPECTS | {"auto"}
V6_ASPECTS = SEEDANCE_ASPECTS | {"3:2", "2:3"}
IMAGE_FAMILIES = ("gpt-image", "qwen-image", "nano-banana-2", "nano-banana-2-lite", "nano-banana-pro")


def _image_family_config(family: str, *, final: bool) -> dict[str, str]:
    selected = "gpt-image" if family == "auto" else family
    configs = {
        "gpt-image": {
            "model": IMAGE_MODEL,
            "quality": IMAGE_QUALITY,
            "detail_level": IMAGE_DETAIL,
            "label": "GPT Image 2.5 Sunburst",
        },
        "qwen-image": {
            "model": "qwen-image",
            "quality": "1080p",
            "detail_level": "",
            "label": "Qwen Image",
        },
        "nano-banana-2": {
            "model": "gemini-3.1-flash",
            "quality": "1440p" if final else "1080p",
            "detail_level": "",
            "label": "Nano Banana 2",
        },
        "nano-banana-2-lite": {
            "model": "gemini-3.1-flash-lite",
            "quality": "1080p",
            "detail_level": "",
            "label": "Nano Banana 2 Lite",
        },
        "nano-banana-pro": {
            "model": "gemini-3.0",
            "quality": "1440p" if final else "1080p",
            "detail_level": "",
            "label": "Nano Banana Pro",
        },
    }
    if selected not in configs:
        selected = "gpt-image"
    return {"family": selected, **configs[selected]}


def recommend_route(
    *,
    kind: str,
    intent: str = "final",
    mode: str = "auto",
    references: int = 0,
    image_family: str = "auto",
    aspect_ratio: str = "16:9",
    duration: float = 8,
    quality: str = "",
    membership_tier: str = "premium",
    accept_basic_fallback: bool = False,
) -> dict[str, Any]:
    membership_tier = membership_tier if membership_tier in {"basic", "premium", "unknown"} else "unknown"
    if accept_basic_fallback:
        image_family = "nano-banana-2-lite"
    if kind == "image":
        route = _recommend_image(
            intent=intent,
            image_family=image_family,
            aspect_ratio=aspect_ratio,
            quality=quality,
            references=max(0, references),
            membership_tier=membership_tier,
        )
    else:
        route = _recommend_video(
            intent=intent, mode=mode, references=max(0, references),
            aspect_ratio=aspect_ratio, duration=duration, quality=quality,
            image_family=image_family, membership_tier=membership_tier,
            accept_basic_fallback=accept_basic_fallback,
        )
    route["basic_fallback_accepted"] = accept_basic_fallback
    route["membership_choice_required"] = membership_tier == "basic" and not accept_basic_fallback
    if route["membership_choice_required"]:
        route["issues"].append(
            "Free/Basic account: stop before generation, show the PixVerse subscription link, "
            "and ask whether to upgrade or explicitly accept the lower-quality fallback."
        )
    if accept_basic_fallback:
        route["reasons"].append(
            "The user explicitly accepted the fallback. Detail, motion fidelity and consistency "
            "may be more limited than the premium route; preserve the creative brief and references."
        )
    if route.get("model") == VIDEO_MODEL:
        route["prompt_enhance_skill"] = PROMPT_ENHANCE_SKILL
    return route


def render_route_markdown(route: dict[str, Any]) -> str:
    lines = [
        "# PixVerse Route Recommendation",
        "",
        f"- Valid: `{route.get('valid')}`",
        f"- Intent: `{route.get('intent')}`",
        f"- Membership route: `{route.get('membership_tier') or 'unknown'}`",
        f"- Control layer: `{route.get('control_layer')}`",
        f"- Primary model: `{route.get('model')}`",
        f"- Quality: `{route.get('quality')}`",
    ]
    if route.get("detail_level"):
        lines.append(f"- GPT Image detail level: `{route.get('detail_level')}`")
    lines.extend(["", "## Why", ""])
    lines.extend(f"- {reason}" for reason in route.get("reasons", []))
    if route.get("issues"):
        lines.extend(["", "## Capability notes", ""])
        lines.extend(f"- {issue}" for issue in route["issues"])
    chain = route.get("chain") if isinstance(route.get("chain"), list) else []
    if chain:
        lines.extend(["", "## Recommended chain", ""])
        for index, step in enumerate(chain, start=1):
            lines.append(
                f"{index}. **{step.get('role')}** — `{step.get('model')}` via `{step.get('mode')}` ({step.get('quality')})"
            )
            if step.get("command_template"):
                lines.append(f"   `{step['command_template']}`")
    alternatives = route.get("alternatives") if isinstance(route.get("alternatives"), list) else []
    if alternatives:
        lines.extend(["", "## Useful alternative", ""])
        lines.extend(f"- `{item.get('model')}` — {item.get('when')}" for item in alternatives)
    if route.get("command_template"):
        lines.extend(["", "## Queue command template", "", "```bash", str(route["command_template"]), "```"])
    return "\n".join(lines)


def _recommend_image(
    *,
    intent: str,
    image_family: str,
    aspect_ratio: str,
    quality: str,
    references: int,
    membership_tier: str,
) -> dict[str, Any]:
    final = intent == "final"
    config = _image_family_config(image_family, final=final)
    family = config["family"]
    model = config["model"]
    selected_quality = quality or config["quality"]
    detail_level = config["detail_level"]
    allowed_qualities = {
        "gpt-image": {"1080p", "1440p", "2160p"},
        "qwen-image": {"720p", "1080p"},
        "nano-banana-2": {"512p", "1080p", "1440p", "2160p"},
        "nano-banana-2-lite": {"1080p"},
        "nano-banana-pro": {"1080p", "1440p", "2160p"},
    }
    issues: list[str] = []
    if load_create_capabilities().get("modes") and not create_model_supported("image", model):
        issues.append(f"The installed CLI does not expose {model}; refresh setup/capabilities before spending.")
    limits = create_model_parameter("image", model, "images")
    if isinstance(limits.get("max_count"), int) and references > limits["max_count"]:
        issues.append(f"{model} accepts at most {limits['max_count']} image references.")
    if selected_quality not in allowed_qualities[family]:
        supported = ", ".join(sorted(allowed_qualities[family]))
        issues.append(f"{model} does not support quality {selected_quality}; choose one of {supported}.")
    if family != "gpt-image":
        reasons = [
            f"The selected image route is {config['label']} ({model}).",
            "Keep supplied references attached; fallback generation requires the user's explicit choice.",
        ]
        alternatives = [
            {
                "model": IMAGE_MODEL,
                "when": "Use for the default locked board/plate route with explicit high detail control.",
            }
        ]
        detail_flag = ""
    else:
        model = IMAGE_MODEL
        selected_quality = quality or IMAGE_QUALITY
        detail_level = IMAGE_DETAIL
        reasons = [
            "GPT Image 2.5 Sunburst at 2K/high is the default for final stills and every control plate for boards, identity, products, UI/text, and storyboard frames.",
            f"{intent.capitalize()} intent maps to --detail-level {detail_level}; pixel quality and detail level are separate controls.",
        ]
        alternatives = [
            {
                "model": "gemini-3.1-flash",
                "when": "Use Nano Banana 2 for a current high-resolution alternate image route.",
            },
            {
                "model": "gemini-3.0",
                "when": "Use Nano Banana Pro when explicitly preferred for a premium comparison.",
            },
        ]
        detail_flag = f" --detail-level {detail_level}"
    reference_flag = ""
    if references == 1:
        reference_flag = " --image <reference-image>"
    elif references > 1:
        reference_flag = " --images <reference-images...>"
    if references:
        reasons.append(
            f"Keep the {references} supplied image reference(s) in the generation command so subject, product, character, or style control is not discarded."
        )
    return {
        "valid": not issues,
        "kind": "image",
        "intent": intent,
        "control_layer": "image-reference" if references else "image",
        "model": model,
        "quality": selected_quality,
        "detail_level": detail_level,
        "aspect_ratio": aspect_ratio,
        "reference_count": references,
        "membership_tier": membership_tier,
        "reasons": reasons,
        "issues": issues,
        "chain": [
            {
                "role": "locked visual board or final still",
                "mode": "create image",
                "model": model,
                "quality": selected_quality,
                "command_template": (
                    f"pixverse create image --model {model} --quality {selected_quality}"
                    f" --aspect-ratio {aspect_ratio}{detail_flag}{reference_flag} --prompt <prompt>"
                ),
            }
        ],
        "alternatives": alternatives,
        "command_template": (
            f"pixverse create image --model {model} --quality {selected_quality}"
            f" --aspect-ratio {aspect_ratio}{detail_flag}{reference_flag} --prompt <prompt>"
        ),
        "capability_source": "PixVerse CLI image help and supported-model table",
    }


def _recommend_video(
    *,
    intent: str,
    mode: str,
    references: int,
    aspect_ratio: str,
    duration: float,
    quality: str,
    image_family: str,
    membership_tier: str,
    accept_basic_fallback: bool,
) -> dict[str, Any]:
    final = intent == "final"
    requested_board = mode == "board-to-video"
    selected_mode = (
        "reference"
        if requested_board or (mode == "auto" and references)
        else "video"
        if mode == "auto"
        else mode
    )
    source_references = references
    effective_references = references + 1 if requested_board else references
    issues: list[str] = []
    blocking_issues: list[str] = []
    reasons: list[str] = []

    basic_membership = accept_basic_fallback
    if basic_membership and selected_mode in {"modify", "motion-control"}:
        model = "v6"
        blocking_issues.append(
            f"Basic/Free membership is routed through v6, but v6 does not support {selected_mode}. "
            "Use a v6-compatible video/reference/transition/extend route, or upgrade before using this mode."
        )
        reasons.append("The user explicitly selected the v6 fallback; this operation exceeds its capabilities.")
    elif basic_membership and selected_mode == "transition" and effective_references >= 3:
        model = "v6"
        blocking_issues.append(
            "Basic/Free membership is routed through v6, but a 3+ frame transition requires a different model. "
            "Reduce this to two keyframes or upgrade before using multi-frame transition."
        )
        reasons.append("The user explicitly selected the v6 fallback; this operation exceeds its capabilities.")
    elif basic_membership:
        model = "v6"
        reasons.append(
            "Explicitly accepted fallback uses PixVerse v6 at 540p."
        )
    elif selected_mode in {"extend", "modify", "motion-control"}:
        model = VIDEO_MODEL
        reasons.append("Use Seedance 2.5 reference input for this edit, extension or motion-reference brief.")
        if load_create_capabilities().get("modes") and not create_model_supported("reference", model):
            blocking_issues.append("The installed CLI does not expose Seedance 2.5 reference mode; refresh setup/capabilities before spending.")
    elif selected_mode == "transition" and references >= 3:
        model = "v5"
        reasons.append("Transitions with three or more keyframes require v5.")
    else:
        model = VIDEO_MODEL
        reasons.append("Seedance 2.5 at 1080p is the default for drafts and final video alike.")
        if load_create_capabilities().get("modes") and not create_model_supported(selected_mode, model):
            blocking_issues.append(
                "The installed CLI does not expose Seedance 2.5 for this mode. Refresh capabilities/setup; "
                "do not silently substitute an older model."
            )

    supported_seedance_aspects = SEEDANCE_25_ASPECTS if model == "seedance-2.5" else SEEDANCE_ASPECTS
    if aspect_ratio not in supported_seedance_aspects and model.startswith("seedance"):
        if aspect_ratio in V6_ASPECTS:
            model = "v6"
            issues.append(
                f"Seedance does not support {aspect_ratio}; route to v6 to preserve the requested aspect."
            )
        else:
            blocking_issues.append(
                f"Aspect ratio {aspect_ratio} is not in the reviewed Seedance or v6 capability set; verify live capabilities before spending."
            )
    if duration < 4 and model.startswith("seedance"):
        model = "v6"
        issues.append("Seedance starts at 4 seconds; route to v6 to preserve a shorter requested duration.")
    if duration > 30 or (duration > 15 and model != "seedance-2.5"):
        blocking_issues.append(
            "The selected model cannot produce this duration in one generation; Seedance 2.5 supports up to 30 seconds when its reviewed capability domain is available."
        )

    selected_quality = quality or (
        FALLBACK_VIDEO_QUALITY if basic_membership else VIDEO_QUALITY
    )
    known_qualities = {
        "seedance-2.5": {"480p", "720p", "1080p"},
        "v6": {"360p", "540p", "720p", "1080p"},
    }
    if model in known_qualities and selected_quality not in known_qualities[model]:
        blocking_issues.append(f"{model} does not support quality {selected_quality}; choose a supported quality.")
    if selected_mode == "reference" and effective_references < 1:
        blocking_issues.append("Reference mode needs at least one image, video, or audio reference.")
    if selected_mode == "reference":
        if model == "seedance-2.5":
            reference_capability = create_model_parameter("reference", model, "images")
            max_references = int(reference_capability.get("max_count") or 30)
        else:
            max_references = 9 if model.startswith("seedance") else 7
        if effective_references > max_references:
            blocking_issues.append(f"{model} reference mode accepts at most {max_references} image references.")
    if selected_mode == "video" and effective_references > 1:
        blocking_issues.append("Image-to-video accepts one opening-frame image; use reference mode for multiple images.")
    if selected_mode == "transition" and effective_references < 2:
        blocking_issues.append("Transition mode needs at least two keyframe images.")
    if model == VIDEO_MODEL and selected_mode in {"modify", "extend", "motion-control"}:
        reference_capability = create_model_parameter("reference", model, "images")
        max_references = int(reference_capability.get("max_count") or 30)
        if effective_references > max_references:
            blocking_issues.append(f"Seedance 2.5 accepts at most {max_references} image references for this task.")

    chain: list[dict[str, str]] = []
    if requested_board:
        # A control plate is paid work and must never be silently inserted into
        # a user's request for a video. It is available only through the
        # explicit board-to-video route.
        board_config = _image_family_config(image_family, final=False)
        board_model = board_config["model"]
        board_quality = board_config["quality"]
        detail_flag = f" --detail-level {board_config['detail_level']}" if board_config["detail_level"] else ""
        if source_references == 1:
            reference_flag = " --image <reference-image>"
        elif source_references > 1:
            reference_flag = " --images <reference-images...>"
        else:
            reference_flag = ""
        chain.append(
            {
                "role": "explicit user-approved visual control plate",
                "mode": (
                    f"create image --detail-level {board_config['detail_level']}"
                    if board_config["detail_level"]
                    else "create image"
                ),
                "model": board_model,
                "quality": board_quality,
                "command_template": (
                    f"pixverse create image --model {board_model} --quality {board_quality}"
                    f" --aspect-ratio {aspect_ratio}{detail_flag}{reference_flag} --prompt <board-prompt>"
                ),
            }
        )
        reasons.append(
            f"The user explicitly selected board-to-video, so create a {board_config['label']} control plate before motion."
        )
    elif selected_mode == "video" and effective_references == 0:
        reasons.append(
            "No image or storyboard step is added: a plain video request stays a single paid video task."
        )

    command = _video_command_template(
        mode=selected_mode, model=model, quality=selected_quality,
        duration=duration, aspect_ratio=aspect_ratio, references=effective_references,
    )
    if model == VIDEO_MODEL and selected_mode in {"modify", "extend", "motion-control"}:
        task_type = {"modify": "edit", "extend": "extend", "motion-control": "reference"}[selected_mode]
        command = f"pixverse create reference --model {model} --quality {selected_quality} --task-type {task_type}"
        command += f" --duration {'auto' if task_type == 'edit' else f'{duration:g}'}"
        command += f" --aspect-ratio {'auto' if task_type in {'edit', 'extend'} else aspect_ratio} --videos <source-video>"
        if effective_references:
            command += " --images <reference-image>" if effective_references == 1 else " --images <reference-images...>"
        command += " --prompt <prompt>"
        selected_mode = "reference"
    chain.append(
        {
            "role": "final motion render" if final else "motion draft",
            "mode": f"create {selected_mode}",
            "model": model,
            "quality": selected_quality,
            "command_template": command,
        }
    )
    issues.extend(blocking_issues)
    return {
        "valid": not blocking_issues,
        "kind": "video",
        "intent": intent,
        "control_layer": selected_mode,
        "model": model,
        "quality": selected_quality,
        "detail_level": "",
        "aspect_ratio": aspect_ratio,
        "duration": duration,
        "reference_count": effective_references,
        # CLI parameter availability does not describe the provider's native
        # output. Seedance 2.5 omits the toggle and uses provider defaults.
        "generated_audio_supported": None if model == "seedance-2.5" else True,
        "audio_flag_supported": model != "seedance-2.5",
        "audio_control": "provider_default" if model == "seedance-2.5" else "toggle",
        "membership_tier": membership_tier,
        "reasons": reasons,
        "issues": issues,
        "chain": chain,
        "alternatives": [],
        "command_template": command,
        "capability_source": (
            "PixVerse CLI normalized create capability domain"
            if model == "seedance-2.5"
            else "PixVerse CLI video/reference help and supported-model table"
        ),
    }


def _video_command_template(
    *,
    mode: str,
    model: str,
    quality: str,
    duration: float,
    aspect_ratio: str,
    references: int,
) -> str:
    seconds = f"{duration:g}"
    base = f"pixverse create {mode} --model {model} --quality {quality}"
    if mode not in {"modify", "motion-control"}:
        base += f" --duration {seconds}"
    if mode in {"video", "reference"}:
        base += f" --aspect-ratio {aspect_ratio}"
    if mode == "reference":
        base += " --images <reference-image>" if references <= 1 else " --images <reference-images...>"
    elif mode == "video" and references:
        base += " --image <locked-opening-frame>"
    elif mode == "transition":
        base += " --images <keyframe-images...>" if references >= 3 else " --images <first-frame> <last-frame>"
    elif mode in {"extend", "modify"}:
        base += " --video <source-video>"
        if mode == "modify" and references:
            base += " --images <reference-image>" if references == 1 else " --images <reference-images...>"
    elif mode == "motion-control":
        base += " --image <subject-image> --video <motion-reference>"
    if mode != "motion-control":
        base += " --prompt <prompt>"
    return base
