from __future__ import annotations

import json
import math
import tomllib
from dataclasses import asdict, dataclass, replace
from datetime import datetime
from pathlib import Path
from typing import Any

from ragops.distribution import quantile
from ragops.loader import ContractError
from ragops.models import CaseResult, EvaluationReport, Scenario
from ragops.slices import SliceSelector, summarize_slices


@dataclass(frozen=True)
class PolicyGate:
    metric: str
    direction: str
    minimum: float | None = None
    maximum: float | None = None
    max_regression: float | None = None
    severity: str = "block"


@dataclass(frozen=True)
class SlicePolicy:
    selector: SliceSelector
    minimum_cases: int = 1


@dataclass(frozen=True)
class TailGate:
    metric: str
    percentile: float
    minimum: float | None = None
    maximum: float | None = None
    severity: str = "block"


@dataclass(frozen=True)
class PolicyWaiver:
    gate_id: str
    owner: str
    reason: str
    issued_at: str
    expires_at: str
    scope: str | None = None


@dataclass(frozen=True)
class ReleasePolicyV2:
    minimum_cases: int
    insufficient_evidence: str
    metrics: tuple[PolicyGate, ...]
    slices: tuple[SlicePolicy, ...]
    tails: tuple[TailGate, ...]
    waivers: tuple[PolicyWaiver, ...]


@dataclass(frozen=True)
class GateEvidence:
    id: str
    metric: str
    scope: str
    observed: float
    threshold: float
    comparator: str
    passed: bool
    severity: str
    policy_path: str
    case_ids: tuple[str, ...] = ()
    waived: bool = False
    waiver_owner: str | None = None
    waiver_reason: str | None = None
    waiver_expires_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ReleaseDecision:
    schema_version: str
    scenario_id: str
    decision: str
    passed: bool
    gates: tuple[GateEvidence, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "scenario_id": self.scenario_id,
            "decision": self.decision,
            "passed": self.passed,
            "gates": [gate.to_dict() for gate in self.gates],
        }


def load_release_decision(path: str | Path) -> ReleaseDecision:
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"Cannot load release decision from {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ContractError("Release decision must be a JSON object")
    expected = {"schema_version", "scenario_id", "decision", "passed", "gates"}
    if set(raw) != expected or not isinstance(raw["gates"], list):
        raise ContractError(f"Release decision fields must be {sorted(expected)}")
    gates = tuple(_gate_evidence_from_dict(item, index) for index, item in enumerate(raw["gates"]))
    decision = raw["decision"]
    if decision not in {"PASS", "WARN", "BLOCK"}:
        raise ContractError("Release decision must be PASS, WARN, or BLOCK")
    if not isinstance(raw["passed"], bool) or raw["passed"] != (decision == "PASS"):
        raise ContractError("Release decision passed flag must match decision")
    if (
        raw["schema_version"] != "1.0"
        or not isinstance(raw["scenario_id"], str)
        or not raw["scenario_id"]
    ):
        raise ContractError("Unsupported release decision contract")
    unwaived_failures = [gate for gate in gates if not gate.passed and not gate.waived]
    if any(gate.severity == "block" for gate in unwaived_failures):
        expected_decision = "BLOCK"
    elif unwaived_failures or any(gate.waived for gate in gates):
        expected_decision = "WARN"
    else:
        expected_decision = "PASS"
    if decision != expected_decision:
        raise ContractError(
            f"Release decision {decision} does not match gate evidence {expected_decision}"
        )
    return ReleaseDecision("1.0", raw["scenario_id"], decision, raw["passed"], gates)


def _gate_evidence_from_dict(value: object, index: int) -> GateEvidence:
    if not isinstance(value, dict):
        raise ContractError(f"Release decision gate {index} must be an object")
    required = {
        "id", "metric", "scope", "observed", "threshold", "comparator", "passed",
        "severity", "policy_path", "case_ids", "waived", "waiver_owner", "waiver_reason",
        "waiver_expires_at",
    }
    if set(value) != required:
        raise ContractError(f"Release decision gate {index} fields must be {sorted(required)}")
    if value["comparator"] not in {">=", "<="} or value["severity"] not in {"warn", "block"}:
        raise ContractError(f"Release decision gate {index} has invalid comparator or severity")
    string_fields = ("id", "metric", "scope", "policy_path")
    if any(not isinstance(value[field], str) or not value[field] for field in string_fields):
        raise ContractError(f"Release decision gate {index} identifiers must be non-empty strings")
    if not isinstance(value["passed"], bool) or not isinstance(value["waived"], bool):
        raise ContractError(f"Release decision gate {index} passed and waived must be boolean")
    if not isinstance(value["case_ids"], list) or not all(
        isinstance(item, str) for item in value["case_ids"]
    ):
        raise ContractError(f"Release decision gate {index} case_ids must be strings")
    observed = _finite(value["observed"], f"gate {index} observed")
    threshold = _finite(value["threshold"], f"gate {index} threshold")
    expected_passed = observed >= threshold if value["comparator"] == ">=" else observed <= threshold
    if value["passed"] != expected_passed:
        raise ContractError(f"Release decision gate {index} passed flag contradicts evidence")
    waiver_fields = ("waiver_owner", "waiver_reason", "waiver_expires_at")
    if value["waived"]:
        if value["passed"] or any(
            not isinstance(value[field], str) or not value[field] for field in waiver_fields
        ):
            raise ContractError(f"Release decision gate {index} has invalid waiver evidence")
        _timestamp(value["waiver_expires_at"], f"gate {index} waiver expiry")
    elif any(value[field] is not None for field in waiver_fields):
        raise ContractError(f"Release decision gate {index} has undeclared waiver fields")
    return GateEvidence(
        id=value["id"],
        metric=value["metric"],
        scope=value["scope"],
        observed=observed,
        threshold=threshold,
        comparator=value["comparator"],
        passed=value["passed"],
        severity=value["severity"],
        policy_path=value["policy_path"],
        case_ids=tuple(value["case_ids"]),
        waived=value["waived"],
        waiver_owner=value["waiver_owner"],
        waiver_reason=value["waiver_reason"],
        waiver_expires_at=value["waiver_expires_at"],
    )


def load_release_policy_v2(path: str | Path) -> ReleasePolicyV2:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise ContractError(f"Cannot load release policy v2 from {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractError("Release policy v2 must be a TOML object")
    allowed_sections = {"release", "metrics", "slices", "tails", "waivers"}
    unknown_sections = sorted(set(data) - allowed_sections)
    if unknown_sections:
        raise ContractError(f"Release policy v2 has unknown sections: {unknown_sections}")
    release = _exact_mapping(
        data.get("release"), {"minimum_cases", "insufficient_evidence"}, "release"
    )
    raw_metrics = data.get("metrics", {})
    if not isinstance(raw_metrics, dict):
        raise ContractError("Release policy metrics must be a table")
    metrics = []
    for name, raw_gate in raw_metrics.items():
        gate = _subset_mapping(
            raw_gate,
            {"direction", "minimum", "maximum", "max_regression", "severity"},
            f"metrics.{name}",
        )
        metrics.append(
            PolicyGate(
                metric=name,
                direction=gate.get("direction"),
                minimum=gate.get("minimum"),
                maximum=gate.get("maximum"),
                max_regression=gate.get("max_regression"),
                severity=gate.get("severity", "block"),
            )
        )
    raw_slices = data.get("slices", [])
    if not isinstance(raw_slices, list):
        raise ContractError("Release policy slices must use array-of-table syntax")
    slices = []
    for index, raw_slice in enumerate(raw_slices):
        item = _subset_mapping(
            raw_slice,
            {"name", "category", "severity", "language", "tags", "minimum_cases"},
            f"slices[{index}]",
        )
        slices.append(
            SlicePolicy(
                selector=SliceSelector(
                    name=item.get("name"),
                    category=item.get("category"),
                    severity=item.get("severity"),
                    language=item.get("language"),
                    tags=tuple(item.get("tags", [])),
                ),
                minimum_cases=item.get("minimum_cases", release["minimum_cases"]),
            )
        )
    raw_tails = data.get("tails", {})
    if not isinstance(raw_tails, dict):
        raise ContractError("Release policy tails must be a table")
    tails = []
    for metric, raw_tail in raw_tails.items():
        item = _subset_mapping(
            raw_tail, {"percentile", "minimum", "maximum", "severity"}, f"tails.{metric}"
        )
        tails.append(
            TailGate(
                metric=metric,
                percentile=item.get("percentile"),
                minimum=item.get("minimum"),
                maximum=item.get("maximum"),
                severity=item.get("severity", "block"),
            )
        )
    raw_waivers = data.get("waivers", [])
    if not isinstance(raw_waivers, list):
        raise ContractError("Release policy waivers must use array-of-table syntax")
    waivers = []
    for index, raw_waiver in enumerate(raw_waivers):
        item = _subset_mapping(
            raw_waiver,
            {"gate_id", "owner", "reason", "issued_at", "expires_at", "scope"},
            f"waivers[{index}]",
        )
        required = {"gate_id", "owner", "reason", "issued_at", "expires_at"}
        missing = sorted(required - set(item))
        if missing:
            raise ContractError(f"waivers[{index}] missing fields: {missing}")
        waivers.append(
            PolicyWaiver(
                gate_id=item["gate_id"],
                owner=item["owner"],
                reason=item["reason"],
                issued_at=item["issued_at"],
                expires_at=item["expires_at"],
                scope=item.get("scope"),
            )
        )
    policy = ReleasePolicyV2(
        minimum_cases=release["minimum_cases"],
        insufficient_evidence=release["insufficient_evidence"],
        metrics=tuple(metrics),
        slices=tuple(slices),
        tails=tuple(tails),
        waivers=tuple(waivers),
    )
    _validate_policy(policy)
    return policy


def apply_release_policy(
    policy: ReleasePolicyV2,
    baseline: EvaluationReport,
    candidate: EvaluationReport,
    scenario: Scenario,
    *,
    now: str,
) -> ReleaseDecision:
    _validate_policy(policy)
    now_value = _timestamp(now, "policy evaluation time")
    if baseline.scenario_id != scenario.id or candidate.scenario_id != scenario.id:
        raise ContractError("Release policy scenario and reports must match")
    if len(candidate.cases) < policy.minimum_cases:
        raise ContractError(
            f"Release policy requires {policy.minimum_cases} cases; candidate has {len(candidate.cases)}"
        )
    gates: list[GateEvidence] = []
    all_case_ids = tuple(item.case_id for item in candidate.cases)
    for metric_policy in policy.metrics:
        gates.extend(
            _metric_gates(
                metric_policy,
                baseline.metrics,
                candidate.metrics,
                scope="global",
                case_ids=all_case_ids,
                policy_prefix=f"metrics.{metric_policy.metric}",
            )
        )
    if policy.slices:
        selectors = tuple(item.selector for item in policy.slices)
        baseline_slices = {item.name: item for item in summarize_slices(scenario, baseline, selectors)}
        candidate_slices = {
            item.name: item for item in summarize_slices(scenario, candidate, selectors)
        }
        for slice_policy in policy.slices:
            name = slice_policy.selector.name
            before = baseline_slices[name]
            after = candidate_slices[name]
            if after.count < slice_policy.minimum_cases:
                severity = policy.insufficient_evidence
                gates.append(
                    GateEvidence(
                        id=f"slice:{name}:minimum_cases",
                        metric="case_count",
                        scope=name,
                        observed=float(after.count),
                        threshold=float(slice_policy.minimum_cases),
                        comparator=">=",
                        passed=False,
                        severity=severity,
                        policy_path=f"slices.{name}.minimum_cases",
                        case_ids=after.case_ids,
                    )
                )
                continue
            for metric_policy in policy.metrics:
                gates.extend(
                    _metric_gates(
                        metric_policy,
                        before.metrics,
                        after.metrics,
                        scope=name,
                        case_ids=after.case_ids,
                        policy_prefix=f"slices.{name}.metrics.{metric_policy.metric}",
                    )
                )
    for tail in policy.tails:
        values = tuple(_case_metric(item, tail.metric) for item in candidate.cases)
        observed = quantile(values, tail.percentile)
        suffix = f"p{round(tail.percentile * 100)}"
        if tail.minimum is not None:
            gates.append(
                _absolute_gate(
                    f"tail:{tail.metric}:{suffix}:minimum",
                    tail.metric,
                    "global",
                    observed,
                    tail.minimum,
                    ">=",
                    tail.severity,
                    f"tails.{tail.metric}.minimum",
                    all_case_ids,
                )
            )
        if tail.maximum is not None:
            gates.append(
                _absolute_gate(
                    f"tail:{tail.metric}:{suffix}:maximum",
                    tail.metric,
                    "global",
                    observed,
                    tail.maximum,
                    "<=",
                    tail.severity,
                    f"tails.{tail.metric}.maximum",
                    all_case_ids,
                )
            )
    gated = tuple(_apply_waiver(item, policy.waivers, now_value) for item in gates)
    unwaived_failures = [item for item in gated if not item.passed and not item.waived]
    if any(item.severity == "block" for item in unwaived_failures):
        decision = "BLOCK"
    elif unwaived_failures or any(item.waived for item in gated):
        decision = "WARN"
    else:
        decision = "PASS"
    return ReleaseDecision("1.0", scenario.id, decision, decision == "PASS", gated)


def _metric_gates(
    policy: PolicyGate,
    baseline: dict[str, float],
    candidate: dict[str, float],
    *,
    scope: str,
    case_ids: tuple[str, ...],
    policy_prefix: str,
) -> list[GateEvidence]:
    if policy.metric not in baseline or policy.metric not in candidate:
        raise ContractError(f"Release metric {policy.metric!r} is unavailable")
    observed = candidate[policy.metric]
    result = []
    gate_prefix = "global" if scope == "global" else f"slice:{scope}"
    if policy.minimum is not None:
        result.append(
            _absolute_gate(
                f"{gate_prefix}:{policy.metric}:minimum",
                policy.metric,
                scope,
                observed,
                policy.minimum,
                ">=",
                policy.severity,
                f"{policy_prefix}.minimum",
                case_ids,
            )
        )
    if policy.maximum is not None:
        result.append(
            _absolute_gate(
                f"{gate_prefix}:{policy.metric}:maximum",
                policy.metric,
                scope,
                observed,
                policy.maximum,
                "<=",
                policy.severity,
                f"{policy_prefix}.maximum",
                case_ids,
            )
        )
    if policy.max_regression is not None:
        delta = observed - baseline[policy.metric]
        threshold = -policy.max_regression if policy.direction == "higher" else policy.max_regression
        comparator = ">=" if policy.direction == "higher" else "<="
        result.append(
            _absolute_gate(
                f"{gate_prefix}:{policy.metric}:regression",
                policy.metric,
                scope,
                delta,
                threshold,
                comparator,
                policy.severity,
                f"{policy_prefix}.max_regression",
                case_ids,
            )
        )
    return result


def _absolute_gate(
    gate_id: str,
    metric: str,
    scope: str,
    observed: float,
    threshold: float,
    comparator: str,
    severity: str,
    policy_path: str,
    case_ids: tuple[str, ...],
) -> GateEvidence:
    passed = observed >= threshold if comparator == ">=" else observed <= threshold
    return GateEvidence(
        id=gate_id,
        metric=metric,
        scope=scope,
        observed=float(observed),
        threshold=float(threshold),
        comparator=comparator,
        passed=passed,
        severity=severity,
        policy_path=policy_path,
        case_ids=case_ids,
    )


def _apply_waiver(
    gate: GateEvidence, waivers: tuple[PolicyWaiver, ...], now: datetime
) -> GateEvidence:
    if gate.passed:
        return gate
    for waiver in waivers:
        if waiver.gate_id != gate.id or (waiver.scope is not None and waiver.scope != gate.scope):
            continue
        issued = _timestamp(waiver.issued_at, f"waiver {waiver.gate_id} issued_at")
        expires = _timestamp(waiver.expires_at, f"waiver {waiver.gate_id} expires_at")
        if issued <= now < expires:
            return replace(
                gate,
                waived=True,
                waiver_owner=waiver.owner,
                waiver_reason=waiver.reason,
                waiver_expires_at=waiver.expires_at,
            )
    return gate


def _validate_policy(policy: ReleasePolicyV2) -> None:
    if isinstance(policy.minimum_cases, bool) or not isinstance(policy.minimum_cases, int) or policy.minimum_cases <= 0:
        raise ContractError("Release minimum_cases must be a positive integer")
    if policy.insufficient_evidence not in {"warn", "block"}:
        raise ContractError("insufficient_evidence must be warn or block")
    metric_names = [item.metric for item in policy.metrics]
    if any(not name for name in metric_names) or len(set(metric_names)) != len(metric_names):
        raise ContractError("Release metric names must be non-empty and unique")
    for gate in policy.metrics:
        if gate.direction not in {"higher", "lower"}:
            raise ContractError(f"Release metric {gate.metric!r} direction must be higher or lower")
        if (gate.minimum is None) == (gate.maximum is None):
            raise ContractError(
                f"Release metric {gate.metric!r} must define exactly one absolute threshold"
            )
        _finite(gate.minimum if gate.minimum is not None else gate.maximum, gate.metric)
        if gate.max_regression is not None and _finite(gate.max_regression, gate.metric) < 0:
            raise ContractError(f"Release metric {gate.metric!r} max_regression must be non-negative")
        _severity(gate.severity)
    slice_names = [item.selector.name for item in policy.slices]
    if any(not name for name in slice_names) or len(set(slice_names)) != len(slice_names):
        raise ContractError("Release slice names must be non-empty and unique")
    for item in policy.slices:
        selector = item.selector
        if not any((selector.category, selector.severity, selector.language, selector.tags)):
            raise ContractError(f"Release slice {selector.name!r} must select at least one field")
        if isinstance(item.minimum_cases, bool) or not isinstance(item.minimum_cases, int) or item.minimum_cases <= 0:
            raise ContractError(f"Release slice {selector.name!r} minimum_cases must be positive")
    for tail in policy.tails:
        if not tail.metric:
            raise ContractError("Release tail metric must be non-empty")
        if not 0 < _finite(tail.percentile, tail.metric) <= 1:
            raise ContractError(f"Release tail {tail.metric!r} percentile must be in (0, 1]")
        if (tail.minimum is None) == (tail.maximum is None):
            raise ContractError(f"Release tail {tail.metric!r} must define one threshold")
        _finite(tail.minimum if tail.minimum is not None else tail.maximum, tail.metric)
        _severity(tail.severity)
    waiver_keys = [(item.gate_id, item.scope) for item in policy.waivers]
    if len(set(waiver_keys)) != len(waiver_keys):
        raise ContractError("Release waivers must have unique gate_id and scope")
    for waiver in policy.waivers:
        if not all((waiver.gate_id, waiver.owner, waiver.reason)):
            raise ContractError("Release waiver gate_id, owner, and reason must be non-empty")
        issued = _timestamp(waiver.issued_at, f"waiver {waiver.gate_id} issued_at")
        expires = _timestamp(waiver.expires_at, f"waiver {waiver.gate_id} expires_at")
        if expires <= issued:
            raise ContractError(f"Release waiver {waiver.gate_id!r} must expire after issuance")


def _case_metric(result: CaseResult, name: str) -> float:
    standard = {
        "citation_coverage": result.citation_coverage,
        "citation_precision": result.citation_precision,
        "lexical_groundedness": result.lexical_groundedness,
        "latency_ms": float(result.latency_ms),
        "cost_usd": result.cost_usd,
        "finding_count": float(len(result.findings)),
    }
    if name in standard:
        return standard[name]
    if name in result.custom_metrics:
        return result.custom_metrics[name]
    raise ContractError(f"Release tail metric {name!r} is unavailable")


def _timestamp(value: object, label: str) -> datetime:
    if not isinstance(value, str):
        raise ContractError(f"{label} must be an ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError(f"{label} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ContractError(f"{label} must include a timezone")
    return parsed


def _finite(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{label} threshold must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise ContractError(f"{label} threshold must be finite")
    return result


def _severity(value: str) -> None:
    if value not in {"warn", "block"}:
        raise ContractError("Release gate severity must be warn or block")


def _exact_mapping(value: object, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise ContractError(f"Release policy {label} fields must be {sorted(expected)}")
    return value


def _subset_mapping(value: object, allowed: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"Release policy {label} must be a table")
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise ContractError(f"Release policy {label} has unknown fields: {unknown}")
    return value
