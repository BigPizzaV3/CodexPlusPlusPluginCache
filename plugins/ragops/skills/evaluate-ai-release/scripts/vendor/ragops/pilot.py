from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from statistics import median
from typing import Any

PILOT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
USER_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$")
WEEK = re.compile(r"^(\d{4})-W(\d{2})$")


class PilotContractError(ValueError):
    """Raised when design-partner pilot evidence violates its public contract."""


@dataclass(frozen=True)
class PilotManifest:
    pilot_id: str
    label: str
    period_start: str
    period_end: str
    synthetic: bool
    consent_status: str
    eligible_user_ids: tuple[str, ...]
    min_repeat_usage_rate: float
    min_task_success_uplift: float
    min_time_saved_rate: float


@dataclass(frozen=True)
class PilotObservation:
    pilot_id: str
    task_id: str
    phase: str
    user_id: str
    week: str
    completed: bool
    successful: bool
    duration_seconds: float
    critical_incident: bool
    reviewer_disagreed: bool
    cost_usd: float


@dataclass(frozen=True)
class PilotEconomics:
    hourly_cost_usd: float
    pilot_investment_usd: float
    assumptions: tuple[str, ...]


@dataclass(frozen=True)
class PilotReport:
    report_version: str
    pilot_id: str
    label: str
    synthetic: bool
    decision: str
    metrics: dict[str, float]
    targets: dict[str, float]
    failed_conditions: tuple[str, ...]
    economic_estimates: dict[str, float]
    assumptions: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _mapping(path: str | Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PilotContractError(f"{label} must be valid UTF-8 JSON") from exc
    if not isinstance(value, dict):
        raise PilotContractError(f"{label} must be a JSON object")
    return value


def _exact_keys(data: dict[str, Any], expected: set[str], label: str) -> None:
    missing = expected - data.keys()
    unexpected = data.keys() - expected
    if missing:
        raise PilotContractError(f"{label} is missing fields: {', '.join(sorted(missing))}")
    if unexpected:
        raise PilotContractError(f"{label} has unexpected fields: {', '.join(sorted(unexpected))}")


def _number(value: Any, label: str, *, minimum: float = 0.0) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PilotContractError(f"{label} must be a number")
    value = float(value)
    if value < minimum:
        raise PilotContractError(f"{label} must be at least {minimum}")
    return value


def _rate(value: Any, label: str) -> float:
    number = _number(value, label)
    if number > 1:
        raise PilotContractError(f"{label} must be between 0 and 1")
    return number


def _date(value: Any, label: str) -> str:
    if not isinstance(value, str):
        raise PilotContractError(f"{label} must be an ISO date")
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise PilotContractError(f"{label} must be an ISO date") from exc
    return value


def load_pilot_manifest(path: str | Path) -> PilotManifest:
    data = _mapping(path, "pilot manifest")
    _exact_keys(
        data,
        {
            "schema_version",
            "pilot_id",
            "label",
            "period_start",
            "period_end",
            "synthetic",
            "consent_status",
            "eligible_user_ids",
            "targets",
        },
        "pilot manifest",
    )
    if data.get("schema_version") != "ragops-pilot-manifest-0.1":
        raise PilotContractError("unsupported pilot manifest schema_version")
    pilot_id = data.get("pilot_id")
    if not isinstance(pilot_id, str) or not PILOT_ID.fullmatch(pilot_id):
        raise PilotContractError("pilot_id must be a lowercase slug")
    label = data.get("label")
    if not isinstance(label, str) or not label.strip() or len(label) > 120:
        raise PilotContractError("label must be a non-empty string up to 120 characters")
    start = _date(data.get("period_start"), "period_start")
    end = _date(data.get("period_end"), "period_end")
    if end < start:
        raise PilotContractError("period_end must not be before period_start")
    synthetic = data.get("synthetic")
    if not isinstance(synthetic, bool):
        raise PilotContractError("synthetic must be a boolean")
    consent_status = data.get("consent_status")
    allowed_consent = {"synthetic"} if synthetic else {"approved"}
    if consent_status not in allowed_consent:
        raise PilotContractError("consent_status must be synthetic or approved as applicable")
    eligible = data.get("eligible_user_ids")
    if not isinstance(eligible, list) or not eligible:
        raise PilotContractError("eligible_user_ids must be a non-empty list")
    if any(not isinstance(user, str) or not USER_ID.fullmatch(user) for user in eligible):
        raise PilotContractError("eligible_user_ids must contain pseudonymous identifiers")
    if len(eligible) != len(set(eligible)):
        raise PilotContractError("eligible_user_ids must be unique")
    targets = data.get("targets")
    if not isinstance(targets, dict):
        raise PilotContractError("targets must be an object")
    return PilotManifest(
        pilot_id=pilot_id,
        label=label.strip(),
        period_start=start,
        period_end=end,
        synthetic=synthetic,
        consent_status=consent_status,
        eligible_user_ids=tuple(eligible),
        min_repeat_usage_rate=_rate(
            targets.get("min_repeat_usage_rate"), "min_repeat_usage_rate"
        ),
        min_task_success_uplift=_rate(
            targets.get("min_task_success_uplift"), "min_task_success_uplift"
        ),
        min_time_saved_rate=_rate(targets.get("min_time_saved_rate"), "min_time_saved_rate"),
    )


def _observation(data: Any, line_number: int) -> PilotObservation:
    if not isinstance(data, dict):
        raise PilotContractError(f"observation line {line_number} must be an object")
    _exact_keys(
        data,
        {
            "schema_version",
            "pilot_id",
            "task_id",
            "phase",
            "user_id",
            "week",
            "completed",
            "successful",
            "duration_seconds",
            "critical_incident",
            "reviewer_disagreed",
            "cost_usd",
        },
        f"observation line {line_number}",
    )
    if data.get("schema_version") != "ragops-pilot-observation-0.1":
        raise PilotContractError(f"observation line {line_number} has unsupported schema_version")
    phase = data.get("phase")
    if phase not in {"baseline", "pilot"}:
        raise PilotContractError(f"observation line {line_number} phase is invalid")
    completed = data.get("completed")
    successful = data.get("successful")
    bool_values = (completed, successful, data.get("critical_incident"), data.get("reviewer_disagreed"))
    if any(not isinstance(value, bool) for value in bool_values):
        raise PilotContractError(f"observation line {line_number} boolean field is invalid")
    if successful and not completed:
        raise PilotContractError(f"observation line {line_number} cannot succeed without completion")
    week = data.get("week")
    match = WEEK.fullmatch(week) if isinstance(week, str) else None
    if not match:
        raise PilotContractError(f"observation line {line_number} week must be YYYY-Www")
    try:
        date.fromisocalendar(int(match.group(1)), int(match.group(2)), 1)
    except ValueError as exc:
        raise PilotContractError(f"observation line {line_number} week is invalid") from exc
    task_id = data.get("task_id")
    user_id = data.get("user_id")
    pilot_id = data.get("pilot_id")
    for value, label, pattern in (
        (pilot_id, "pilot_id", PILOT_ID),
        (task_id, "task_id", USER_ID),
        (user_id, "user_id", USER_ID),
    ):
        if not isinstance(value, str) or not pattern.fullmatch(value):
            raise PilotContractError(f"observation line {line_number} {label} is invalid")
    return PilotObservation(
        pilot_id=pilot_id,
        task_id=task_id,
        phase=phase,
        user_id=user_id,
        week=week,
        completed=completed,
        successful=successful,
        duration_seconds=_number(
            data.get("duration_seconds"), f"observation line {line_number} duration_seconds"
        ),
        critical_incident=data["critical_incident"],
        reviewer_disagreed=data["reviewer_disagreed"],
        cost_usd=_number(data.get("cost_usd"), f"observation line {line_number} cost_usd"),
    )


def load_pilot_observations(path: str | Path) -> tuple[PilotObservation, ...]:
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        raise PilotContractError("pilot observations must be UTF-8 JSONL") from exc
    observations = []
    for line_number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            observations.append(_observation(json.loads(line), line_number))
        except json.JSONDecodeError as exc:
            raise PilotContractError(f"observation line {line_number} is not valid JSON") from exc
    if not observations:
        raise PilotContractError("pilot observations must not be empty")
    if len({item.task_id for item in observations}) != len(observations):
        raise PilotContractError("pilot task_id values must be unique")
    return tuple(observations)


def load_pilot_economics(path: str | Path) -> PilotEconomics:
    data = _mapping(path, "pilot economics")
    _exact_keys(
        data,
        {"schema_version", "hourly_cost_usd", "pilot_investment_usd", "assumptions"},
        "pilot economics",
    )
    if data.get("schema_version") != "ragops-pilot-economics-0.1":
        raise PilotContractError("unsupported pilot economics schema_version")
    assumptions = data.get("assumptions")
    if not isinstance(assumptions, list) or any(
        not isinstance(item, str) or not item.strip() for item in assumptions
    ):
        raise PilotContractError("economics assumptions must be a list of non-empty strings")
    return PilotEconomics(
        hourly_cost_usd=_number(data.get("hourly_cost_usd"), "hourly_cost_usd", minimum=0.01),
        pilot_investment_usd=_number(
            data.get("pilot_investment_usd"), "pilot_investment_usd", minimum=0.01
        ),
        assumptions=tuple(item.strip() for item in assumptions),
    )


def summarize_pilot(
    manifest: PilotManifest,
    observations: tuple[PilotObservation, ...],
    economics: PilotEconomics | None = None,
) -> PilotReport:
    if {item.pilot_id for item in observations} != {manifest.pilot_id}:
        raise PilotContractError("all observations must match the manifest pilot_id")
    eligible = set(manifest.eligible_user_ids)
    if any(item.user_id not in eligible for item in observations):
        raise PilotContractError("observation user_id is not in the eligible cohort")
    baseline = [item for item in observations if item.phase == "baseline" and item.completed]
    pilot = [item for item in observations if item.phase == "pilot" and item.completed]
    if not baseline or not pilot:
        raise PilotContractError("baseline and pilot each require at least one completed task")

    activated = {item.user_id for item in pilot}
    user_weeks: dict[str, set[str]] = {}
    for item in pilot:
        user_weeks.setdefault(item.user_id, set()).add(item.week)
    repeat_users = {user for user, weeks in user_weeks.items() if len(weeks) >= 2}
    baseline_success = sum(item.successful for item in baseline) / len(baseline)
    pilot_success = sum(item.successful for item in pilot) / len(pilot)
    baseline_duration = float(median(item.duration_seconds for item in baseline))
    pilot_duration = float(median(item.duration_seconds for item in pilot))
    time_saved_rate = (
        max(0.0, baseline_duration - pilot_duration) / baseline_duration
        if baseline_duration
        else 0.0
    )
    estimated_time_saved_hours = (
        max(0.0, baseline_duration - pilot_duration) * len(pilot) / 3600
    )
    pilot_cost = sum(item.cost_usd for item in pilot)
    metrics = {
        "eligible_users": float(len(eligible)),
        "activated_users": float(len(activated)),
        "activation_rate": len(activated) / len(eligible),
        "repeat_users": float(len(repeat_users)),
        "repeat_usage_rate": len(repeat_users) / len(activated),
        "baseline_completed_tasks": float(len(baseline)),
        "pilot_completed_tasks": float(len(pilot)),
        "baseline_task_success_rate": baseline_success,
        "pilot_task_success_rate": pilot_success,
        "task_success_uplift": pilot_success - baseline_success,
        "baseline_median_duration_seconds": baseline_duration,
        "pilot_median_duration_seconds": pilot_duration,
        "time_saved_rate": time_saved_rate,
        "estimated_time_saved_hours": estimated_time_saved_hours,
        "pilot_critical_incidents": float(sum(item.critical_incident for item in pilot)),
        "pilot_reviewer_disagreement_rate": sum(item.reviewer_disagreed for item in pilot)
        / len(pilot),
        "pilot_observed_cost_usd": pilot_cost,
    }
    targets = {
        "min_repeat_usage_rate": manifest.min_repeat_usage_rate,
        "min_task_success_uplift": manifest.min_task_success_uplift,
        "min_time_saved_rate": manifest.min_time_saved_rate,
        "max_critical_incidents": 0.0,
    }
    failed = []
    if metrics["repeat_usage_rate"] < manifest.min_repeat_usage_rate:
        failed.append("repeat_usage_rate")
    if metrics["task_success_uplift"] < manifest.min_task_success_uplift:
        failed.append("task_success_uplift")
    if metrics["time_saved_rate"] < manifest.min_time_saved_rate:
        failed.append("time_saved_rate")
    if metrics["pilot_critical_incidents"] > 0:
        failed.append("critical_incidents")

    estimates: dict[str, float] = {}
    assumptions: tuple[str, ...] = ()
    if economics is not None:
        gross = estimated_time_saved_hours * economics.hourly_cost_usd
        investment = economics.pilot_investment_usd + pilot_cost
        net = gross - investment
        estimates = {
            "estimated_gross_value_usd": gross,
            "estimated_net_value_usd": net,
            "estimated_roi": net / investment,
        }
        assumptions = economics.assumptions
    return PilotReport(
        report_version="ragops-pilot-report-0.1",
        pilot_id=manifest.pilot_id,
        label=manifest.label,
        synthetic=manifest.synthetic,
        decision="SCALE" if not failed else "HOLD",
        metrics=metrics,
        targets=targets,
        failed_conditions=tuple(failed),
        economic_estimates=estimates,
        assumptions=assumptions,
    )


def pilot_markdown(report: PilotReport) -> str:
    evidence_label = "SYNTHETIC EXAMPLE — NOT CUSTOMER EVIDENCE" if report.synthetic else "MEASURED PILOT EVIDENCE"
    lines = [
        f"# Design-partner pilot: {report.label}",
        "",
        f"**{evidence_label}**",
        "",
        f"## Decision: {report.decision}",
        "",
        "## Measured observations",
        "",
        "| Metric | Value |",
        "| --- | ---: |",
    ]
    for key, value in report.metrics.items():
        lines.append(f"| `{key}` | {value:.4f} |")
    lines.extend(["", "## Decision targets", "", "| Target | Value |", "| --- | ---: |"]) 
    for key, value in report.targets.items():
        lines.append(f"| `{key}` | {value:.4f} |")
    lines.extend(["", "Failed conditions: " + (", ".join(report.failed_conditions) or "None")])
    if report.economic_estimates:
        lines.extend(
            ["", "## Economic estimates", "", "These values are estimates, not measured revenue.", ""]
        )
        for key, value in report.economic_estimates.items():
            lines.append(f"- `{key}`: {value:.4f}")
        lines.extend(["", "Assumptions:"])
        lines.extend(f"- {item}" for item in report.assumptions)
    lines.extend(
        [
            "",
            "## Interpretation limits",
            "",
            "This observational before/after report does not establish causality. Review cohort, period, "
            "denominators, exclusions, consent, and operational context before making a public claim.",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"
