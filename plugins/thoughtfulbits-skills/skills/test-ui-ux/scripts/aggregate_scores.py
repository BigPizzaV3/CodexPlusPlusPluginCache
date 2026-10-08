#!/usr/bin/env python3
"""Validate and aggregate the five test-ui-ux evaluator results."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, NoReturn


METHODS = (
    "spark",
    "nielsen",
    "cognitive_walkthrough",
    "pure",
    "wcag_2_2_aa",
)
SOURCE_KINDS = {"live_url", "screenshot", "spec", "mixed"}
CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}
SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
THRESHOLD = 8.0
IMPORTANCE = {"primary", "supporting", "recovery_safety"}
EVIDENCE_STATUS = {"observed", "specified", "visible_only", "inferred", "blocked"}
INTERACTIONS = {
    "click_tap",
    "field_entry",
    "selection",
    "keyboard",
    "navigation",
    "system_wait",
}
CURRENT_REQUIREMENTS = {"required", "optional"}
INPUT_RECOMMENDATIONS = {
    "keep_user_required",
    "make_optional",
    "prefill_known_data",
    "derive_automatically",
    "ai_draft_confirm",
    "remove",
}
COUNT_FIELDS = (
    "logical_steps",
    "clicks_taps",
    "required_fields",
    "optional_fields",
)


def fail(message: str) -> NoReturn:
    raise ValueError(message)


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        fail(f"{label} must be an object")
    return value


def require_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    return value


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{label} must be a non-empty string")
    return value


def require_boolean(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        fail(f"{label} must be a boolean")
    return value


def require_nonnegative_integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        fail(f"{label} must be a nonnegative integer")
    return value


def validate_counts(raw: Any, label: str, *, require_known: bool) -> dict[str, Any]:
    counts = require_object(raw, label)
    for field in COUNT_FIELDS:
        value = counts.get(field)
        if value is None:
            if require_known:
                fail(f"{label}.{field} must be known for observed or specified actions")
            continue
        require_nonnegative_integer(value, f"{label}.{field}")
    return counts


def validate_action_analysis(raw: Any, label: str) -> dict[str, Any]:
    analysis = require_object(raw, label)
    raw_screens = require_list(analysis.get("screens"), f"{label}.screens")
    raw_actions = require_list(analysis.get("actions"), f"{label}.actions")
    if not raw_screens:
        fail(f"{label}.screens must contain at least one item")
    if not raw_actions:
        fail(f"{label}.actions must contain at least one item")

    screen_ids: set[str] = set()
    action_refs: set[str] = set()
    screens: list[dict[str, Any]] = []
    for screen_index, raw_screen in enumerate(raw_screens):
        screen_label = f"{label}.screens[{screen_index}]"
        screen = require_object(raw_screen, screen_label)
        screen_id = require_string(screen.get("id"), f"{screen_label}.id")
        if screen_id in screen_ids:
            fail(f"{label}.screens contains duplicate id {screen_id!r}")
        screen_ids.add(screen_id)
        require_string(screen.get("evidence_ref"), f"{screen_label}.evidence_ref")
        require_string(screen.get("purpose"), f"{screen_label}.purpose")
        important_action_ids = require_list(
            screen.get("important_action_ids"), f"{screen_label}.important_action_ids"
        )
        if not important_action_ids:
            fail(f"{screen_label}.important_action_ids must contain at least one item")
        local_refs: set[str] = set()
        for ref_index, raw_ref in enumerate(important_action_ids):
            ref = require_string(
                raw_ref, f"{screen_label}.important_action_ids[{ref_index}]"
            )
            if ref in local_refs:
                fail(f"{screen_label}.important_action_ids contains duplicate {ref!r}")
            local_refs.add(ref)
            action_refs.add(ref)
        screens.append(screen)

    action_ids: set[str] = set()
    actions: list[dict[str, Any]] = []
    for action_index, raw_action in enumerate(raw_actions):
        action_label = f"{label}.actions[{action_index}]"
        action = require_object(raw_action, action_label)
        action_id = require_string(action.get("id"), f"{action_label}.id")
        if action_id in action_ids:
            fail(f"{label}.actions contains duplicate id {action_id!r}")
        action_ids.add(action_id)
        require_string(action.get("label"), f"{action_label}.label")
        importance = require_string(action.get("importance"), f"{action_label}.importance")
        if importance not in IMPORTANCE:
            fail(f"{action_label}.importance must be primary, supporting, or recovery_safety")
        require_string(action.get("outcome"), f"{action_label}.outcome")
        evidence_status = require_string(
            action.get("evidence_status"), f"{action_label}.evidence_status"
        )
        if evidence_status not in EVIDENCE_STATUS:
            fail(
                f"{action_label}.evidence_status must be observed, specified, "
                "visible_only, inferred, or blocked"
            )

        raw_steps = require_list(action.get("steps"), f"{action_label}.steps")
        if not raw_steps:
            fail(f"{action_label}.steps must contain at least one item")
        user_step_count = 0
        pointer_activations = 0
        for step_index, raw_step in enumerate(raw_steps):
            step_label = f"{action_label}.steps[{step_index}]"
            step = require_object(raw_step, step_label)
            order = step.get("order")
            if (
                isinstance(order, bool)
                or not isinstance(order, int)
                or order != step_index + 1
            ):
                fail(f"{step_label}.order must be {step_index + 1}")
            step_screen_id = require_string(
                step.get("screen_id"), f"{step_label}.screen_id"
            )
            if step_screen_id not in screen_ids:
                fail(f"{step_label}.screen_id references unknown screen {step_screen_id!r}")
            require_string(step.get("description"), f"{step_label}.description")
            interaction = require_string(
                step.get("interaction"), f"{step_label}.interaction"
            )
            if interaction not in INTERACTIONS:
                fail(
                    f"{step_label}.interaction must be click_tap, field_entry, "
                    "selection, keyboard, navigation, or system_wait"
                )
            if interaction != "system_wait":
                user_step_count += 1
            pointer_activations += require_nonnegative_integer(
                step.get("pointer_activations"), f"{step_label}.pointer_activations"
            )
            difficulty = step.get("difficulty")
            if (
                isinstance(difficulty, bool)
                or not isinstance(difficulty, int)
                or difficulty not in {1, 2, 3}
            ):
                fail(f"{step_label}.difficulty must be 1, 2, or 3")
            require_boolean(step.get("avoidable"), f"{step_label}.avoidable")

        raw_inputs = require_list(action.get("inputs"), f"{action_label}.inputs")
        required_fields = 0
        optional_fields = 0
        for input_index, raw_input in enumerate(raw_inputs):
            input_label = f"{action_label}.inputs[{input_index}]"
            input_item = require_object(raw_input, input_label)
            require_string(input_item.get("name"), f"{input_label}.name")
            current_requirement = require_string(
                input_item.get("current_requirement"),
                f"{input_label}.current_requirement",
            )
            if current_requirement not in CURRENT_REQUIREMENTS:
                fail(f"{input_label}.current_requirement must be required or optional")
            if current_requirement == "required":
                required_fields += 1
            else:
                optional_fields += 1
            recommendation = require_string(
                input_item.get("recommendation"), f"{input_label}.recommendation"
            )
            if recommendation not in INPUT_RECOMMENDATIONS:
                fail(
                    f"{input_label}.recommendation must be keep_user_required, "
                    "make_optional, prefill_known_data, derive_automatically, "
                    "ai_draft_confirm, or remove"
                )
            confirmation_required = require_boolean(
                input_item.get("confirmation_required"),
                f"{input_label}.confirmation_required",
            )
            sensitive = require_boolean(
                input_item.get("sensitive_or_consequential"),
                f"{input_label}.sensitive_or_consequential",
            )
            if recommendation == "ai_draft_confirm" and not confirmation_required:
                fail(f"{input_label} AI drafts must require confirmation")
            if recommendation == "ai_draft_confirm" and sensitive:
                fail(f"{input_label} sensitive or consequential input cannot use an AI draft")
            require_string(input_item.get("rationale"), f"{input_label}.rationale")

        require_known = evidence_status in {"observed", "specified"}
        current_counts = validate_counts(
            action.get("current_counts"),
            f"{action_label}.current_counts",
            require_known=require_known,
        )
        if all(current_counts.get(field) is not None for field in COUNT_FIELDS):
            if current_counts["logical_steps"] != user_step_count:
                fail(
                    f"{action_label}.current_counts.logical_steps must equal "
                    "the number of non-wait steps"
                )
            if current_counts["clicks_taps"] != pointer_activations:
                fail(
                    f"{action_label}.current_counts.clicks_taps must equal "
                    "summed pointer activations"
                )
            if current_counts["required_fields"] != required_fields:
                fail(
                    f"{action_label}.current_counts.required_fields must equal "
                    "the number of required inputs"
                )
            if current_counts["optional_fields"] != optional_fields:
                fail(
                    f"{action_label}.current_counts.optional_fields must equal "
                    "the number of optional inputs"
                )

        path_label = f"{action_label}.simplest_safe_path"
        simplest_safe_path = require_object(action.get("simplest_safe_path"), path_label)
        validate_counts(simplest_safe_path, path_label, require_known=False)
        for field in ("changes", "safeguards"):
            values = require_list(simplest_safe_path.get(field), f"{path_label}.{field}")
            if not values:
                fail(f"{path_label}.{field} must contain at least one item")
            for value_index, value in enumerate(values):
                require_string(value, f"{path_label}.{field}[{value_index}]")
        actions.append(action)

    unknown_action_refs = sorted(action_refs - action_ids)
    if unknown_action_refs:
        fail(f"{label}.screens reference unknown actions {unknown_action_refs}")
    unlisted_actions = sorted(action_ids - action_refs)
    if unlisted_actions:
        fail(f"{label}.actions are not listed on any screen {unlisted_actions}")

    return {"screens": screens, "actions": actions}


def validate_method(raw: Any, index: int) -> dict[str, Any]:
    method = require_object(raw, f"methods[{index}]")
    name = require_string(method.get("method"), f"methods[{index}].method")
    if name not in METHODS:
        fail(f"methods[{index}].method has unsupported value {name!r}")

    score = method.get("score")
    if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 10:
        fail(f"methods[{index}].score must be an integer from 1 through 10")

    confidence = require_string(
        method.get("confidence"), f"methods[{index}].confidence"
    )
    if confidence not in CONFIDENCE_RANK:
        fail(f"methods[{index}].confidence must be high, medium, or low")

    evidence = require_list(method.get("evidence"), f"methods[{index}].evidence")
    if not evidence:
        fail(f"methods[{index}].evidence must contain at least one item")
    for evidence_index, raw_item in enumerate(evidence):
        item = require_object(
            raw_item, f"methods[{index}].evidence[{evidence_index}]"
        )
        require_string(
            item.get("ref"), f"methods[{index}].evidence[{evidence_index}].ref"
        )
        require_string(
            item.get("claim"),
            f"methods[{index}].evidence[{evidence_index}].claim",
        )

    findings = require_list(method.get("findings"), f"methods[{index}].findings")
    for finding_index, raw_finding in enumerate(findings):
        finding = require_object(
            raw_finding, f"methods[{index}].findings[{finding_index}]"
        )
        severity = require_string(
            finding.get("severity"),
            f"methods[{index}].findings[{finding_index}].severity",
        )
        if severity not in SEVERITY_RANK:
            fail(
                f"methods[{index}].findings[{finding_index}].severity "
                "must be critical, high, medium, or low"
            )
        for field in ("title", "evidence_ref", "recommendation"):
            require_string(
                finding.get(field),
                f"methods[{index}].findings[{finding_index}].{field}",
            )

    critical_failures = require_list(
        method.get("critical_failures"), f"methods[{index}].critical_failures"
    )
    for critical_index, critical in enumerate(critical_failures):
        require_string(
            critical,
            f"methods[{index}].critical_failures[{critical_index}]",
        )

    limitations = require_list(
        method.get("limitations"), f"methods[{index}].limitations"
    )
    for limitation_index, limitation in enumerate(limitations):
        require_string(
            limitation, f"methods[{index}].limitations[{limitation_index}]"
        )

    methodology_data = require_object(
        method.get("methodology_data"), f"methods[{index}].methodology_data"
    )
    action_analysis = methodology_data.get("action_analysis")
    if name == "pure":
        validate_action_analysis(
            action_analysis,
            f"methods[{index}].methodology_data.action_analysis",
        )
    elif action_analysis is not None:
        fail(f"methods[{index}].methodology_data.action_analysis is allowed only for pure")
    return method


def validate_input(raw: Any) -> dict[str, Any]:
    data = require_object(raw, "input")
    if data.get("schema_version") != "2.0":
        fail("schema_version must be '2.0'")

    run_id = require_string(data.get("run_id"), "run_id")
    context = require_object(data.get("context"), "context")
    for field in ("target", "test_brief", "target_user", "viewport", "build_identity"):
        require_string(context.get(field), f"context.{field}")
    source_kind = require_string(context.get("source_kind"), "context.source_kind")
    if source_kind not in SOURCE_KINDS:
        fail("context.source_kind must be live_url, screenshot, spec, or mixed")
    tasks = require_list(context.get("tasks"), "context.tasks")
    if not tasks:
        fail("context.tasks must contain at least one task")
    for task_index, task in enumerate(tasks):
        require_string(task, f"context.tasks[{task_index}]")
    require_list(context.get("constraints"), "context.constraints")

    interactive = data.get("interactive_test_completed")
    comparable = data.get("comparable_to_previous")
    if not isinstance(interactive, bool):
        fail("interactive_test_completed must be a boolean")
    if not isinstance(comparable, bool):
        fail("comparable_to_previous must be a boolean")
    if interactive and source_kind not in {"live_url", "mixed"}:
        fail("interactive_test_completed can be true only for live_url or mixed input")

    raw_methods = require_list(data.get("methods"), "methods")
    if len(raw_methods) != len(METHODS):
        fail(f"methods must contain exactly {len(METHODS)} evaluator results")
    methods = [validate_method(method, index) for index, method in enumerate(raw_methods)]
    names = [method["method"] for method in methods]
    if len(set(names)) != len(names):
        fail("methods contains duplicate method identifiers")
    missing = sorted(set(METHODS) - set(names))
    extra = sorted(set(names) - set(METHODS))
    if missing or extra:
        fail(f"methods mismatch: missing={missing}, extra={extra}")

    return {
        "schema_version": "2.0",
        "run_id": run_id,
        "context": context,
        "interactive_test_completed": interactive,
        "comparable_to_previous": comparable,
        "methods": methods,
    }


def aggregate(data: dict[str, Any]) -> dict[str, Any]:
    methods_by_name = {method["method"]: method for method in data["methods"]}
    ordered_methods = [methods_by_name[name] for name in METHODS]
    scores = {method["method"]: method["score"] for method in ordered_methods}
    average = round(sum(scores.values()) / len(METHODS), 1)

    critical_failures = []
    for method in ordered_methods:
        for failure in method["critical_failures"]:
            critical_failures.append({"method": method["method"], "failure": failure})

    threshold_met = average >= THRESHOLD
    if critical_failures:
        verdict = "fail"
    elif not data["interactive_test_completed"]:
        verdict = "provisional"
    elif threshold_met:
        verdict = "pass"
    else:
        verdict = "fail"

    confidence = min(
        (method["confidence"] for method in ordered_methods),
        key=CONFIDENCE_RANK.__getitem__,
    )

    action_analysis = methods_by_name["pure"]["methodology_data"]["action_analysis"]

    ranked_findings = []
    for method_order, method in enumerate(ordered_methods):
        for finding_order, finding in enumerate(method["findings"]):
            ranked_findings.append(
                (
                    SEVERITY_RANK[finding["severity"]],
                    method_order,
                    finding_order,
                    method["method"],
                    finding,
                )
            )
    ranked_findings.sort(key=lambda item: item[:3])

    top_fixes = []
    seen_titles = set()
    for _, _, _, method_name, finding in ranked_findings:
        normalized_title = finding["title"].casefold().strip()
        if normalized_title in seen_titles:
            continue
        seen_titles.add(normalized_title)
        top_fixes.append(
            {
                "method": method_name,
                "severity": finding["severity"],
                "title": finding["title"],
                "evidence_ref": finding["evidence_ref"],
                "recommendation": finding["recommendation"],
            }
        )
        if len(top_fixes) == 3:
            break

    return {
        "schema_version": "2.0",
        "run_id": data["run_id"],
        "context": data["context"],
        "interactive_test_completed": data["interactive_test_completed"],
        "comparable_to_previous": data["comparable_to_previous"],
        "method_scores": scores,
        "average_score": average,
        "threshold": THRESHOLD,
        "threshold_met": threshold_met,
        "critical_failures": critical_failures,
        "verdict": verdict,
        "confidence": confidence,
        "action_analysis": action_analysis,
        "top_fixes": top_fixes,
        "methods": ordered_methods,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and aggregate five test-ui-ux evaluator results."
    )
    parser.add_argument("input", help="Input JSON file, or - for standard input")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.input == "-":
            raw = json.load(sys.stdin)
        else:
            with Path(args.input).open(encoding="utf-8") as input_file:
                raw = json.load(input_file)
        output = aggregate(validate_input(raw))
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"error": str(error)}, sort_keys=True), file=sys.stderr)
        return 2

    json.dump(output, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
