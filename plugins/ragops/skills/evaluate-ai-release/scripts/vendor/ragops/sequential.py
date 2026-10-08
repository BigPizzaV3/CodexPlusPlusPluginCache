from __future__ import annotations

import math
from collections import Counter, defaultdict
from statistics import fmean

from ragops.loader import ContractError
from ragops.models import (
    ReplayBundle,
    SequentialComparisonReport,
    SequentialLookResult,
    SequentialMetricResult,
    SequentialPolicy,
)
from ragops.statistical import (
    _bootstrap_metric,
    _group_values,
    _provenance_dict,
    _quantile,
    _validate_pair,
    classify_provenance_changes,
)

METHOD = "predeclared_group_sequential_bonferroni_bootstrap"


def compare_replay_bundles_sequentially(
    baseline: ReplayBundle,
    candidate: ReplayBundle,
    policy: SequentialPolicy,
) -> SequentialComparisonReport:
    _validate_policy(policy)
    _validate_pair(baseline, candidate, policy)  # type: ignore[arg-type]
    case_ids = tuple(sorted({record.case_id for record in baseline.records}))
    provenance = {
        "scenario_digest": baseline.scenario_digest,
        "changed_axes": list(classify_provenance_changes(baseline, candidate)),
        "baseline": _provenance_dict(baseline.provenance),
        "candidate": _provenance_dict(candidate.provenance),
    }
    if len(case_ids) < policy.minimum_cases:
        return _report(
            baseline,
            policy,
            case_count=len(case_ids),
            available_repeats=_available_repeats(baseline, candidate, case_ids),
            decision="block",
            failed_gates=("insufficient_cases",),
            looks=(),
            provenance=provenance,
        )

    available = _available_repeats(baseline, candidate, case_ids)
    scheduled_looks = _scheduled_looks(policy)
    max_looks = len(scheduled_looks)
    tail_alpha = (1.0 - policy.confidence) / (
        2.0 * max_looks * len(policy.metric_gates)
    )
    completed_looks: list[SequentialLookResult] = []
    for repeat_count in scheduled_looks:
        if repeat_count > available:
            break
        final = repeat_count == policy.maximum_repeats
        look = _evaluate_look(
            _slice_bundle(baseline, repeat_count),
            _slice_bundle(candidate, repeat_count),
            policy,
            repeat_count=repeat_count,
            tail_alpha=tail_alpha,
            final=final,
        )
        completed_looks.append(look)
        if look.decision in {"pass", "block"}:
            return _report(
                baseline,
                policy,
                case_count=len(case_ids),
                available_repeats=available,
                decision=look.decision,
                failed_gates=look.failed_gates,
                looks=tuple(completed_looks),
                provenance=provenance,
            )

    return _report(
        baseline,
        policy,
        case_count=len(case_ids),
        available_repeats=available,
        decision="continue",
        failed_gates=("sequential_incomplete",),
        looks=tuple(completed_looks),
        provenance=provenance,
    )


def _evaluate_look(
    baseline: ReplayBundle,
    candidate: ReplayBundle,
    policy: SequentialPolicy,
    *,
    repeat_count: int,
    tail_alpha: float,
    final: bool,
) -> SequentialLookResult:
    baseline_values = _group_values(baseline)
    candidate_values = _group_values(candidate)
    case_ids = tuple(sorted(baseline_values))
    metrics: dict[str, SequentialMetricResult] = {}
    failed: list[str] = []
    decisions: list[str] = []
    for metric_name, gate in policy.metric_gates.items():
        baseline_mean = fmean(
            fmean(item[metric_name] for item in baseline_values[case_id])
            for case_id in case_ids
        )
        candidate_mean = fmean(
            fmean(item[metric_name] for item in candidate_values[case_id])
            for case_id in case_ids
        )
        candidate_samples, delta_samples = _bootstrap_metric(
            case_ids,
            baseline_values,
            candidate_values,
            metric_name,
            resamples=policy.resamples,
            seed=policy.seed + repeat_count,
        )
        candidate_lower = _quantile(candidate_samples, tail_alpha)
        candidate_upper = _quantile(candidate_samples, 1.0 - tail_alpha)
        regression_lower = _quantile(delta_samples, tail_alpha)
        regression_upper = _quantile(delta_samples, 1.0 - tail_alpha)
        reasons: list[str] = []
        if gate.direction == "higher":
            absolute_pass = candidate_lower >= gate.minimum
            regression_pass = regression_lower >= -gate.max_regression
            absolute_harm = candidate_upper < gate.minimum
            regression_harm = regression_upper < -gate.max_regression
            threshold = gate.minimum
        else:
            absolute_pass = candidate_upper <= gate.maximum
            regression_pass = regression_upper <= gate.max_regression
            absolute_harm = candidate_lower > gate.maximum
            regression_harm = regression_lower > gate.max_regression
            threshold = gate.maximum
        if absolute_pass and regression_pass:
            decision = "pass"
        elif absolute_harm or regression_harm or final:
            decision = "block"
            if not absolute_pass:
                reasons.append("absolute")
                failed.append(f"metric_absolute:{metric_name}")
            if not regression_pass:
                reasons.append("regression")
                failed.append(f"metric_regression:{metric_name}")
        else:
            decision = "continue"
        decisions.append(decision)
        metrics[metric_name] = SequentialMetricResult(
            direction=gate.direction,
            baseline_mean=baseline_mean,
            candidate_mean=candidate_mean,
            delta=candidate_mean - baseline_mean,
            candidate_lower=candidate_lower,
            candidate_upper=candidate_upper,
            regression_lower=regression_lower,
            regression_upper=regression_upper,
            absolute_threshold=threshold,
            max_regression=gate.max_regression,
            decision=decision,
            reasons=tuple(reasons),
        )
    if "block" in decisions:
        decision = "block"
    elif all(item == "pass" for item in decisions):
        decision = "pass"
    else:
        decision = "continue"
    return SequentialLookResult(
        repeat_count=repeat_count,
        boundary_confidence=1.0 - tail_alpha,
        decision=decision,
        failed_gates=tuple(dict.fromkeys(failed)),
        metrics=metrics,
    )


def _scheduled_looks(policy: SequentialPolicy) -> tuple[int, ...]:
    looks = list(
        range(policy.minimum_repeats, policy.maximum_repeats + 1, policy.look_every)
    )
    if looks[-1] != policy.maximum_repeats:
        looks.append(policy.maximum_repeats)
    return tuple(looks)


def _available_repeats(
    baseline: ReplayBundle, candidate: ReplayBundle, case_ids: tuple[str, ...]
) -> int:
    baseline_counts = Counter(record.case_id for record in baseline.records)
    candidate_counts = Counter(record.case_id for record in candidate.records)
    return min(
        *(baseline_counts[case_id] for case_id in case_ids),
        *(candidate_counts[case_id] for case_id in case_ids),
    )


def _slice_bundle(bundle: ReplayBundle, repeats: int) -> ReplayBundle:
    grouped: dict[str, list] = defaultdict(list)
    for record in bundle.records:
        grouped[record.case_id].append(record)
    selected = []
    for case_id in sorted(grouped):
        selected.extend(sorted(grouped[case_id], key=lambda item: item.repeat_id)[:repeats])
    return ReplayBundle(
        schema_version=bundle.schema_version,
        scenario_id=bundle.scenario_id,
        scenario_digest=bundle.scenario_digest,
        provenance=bundle.provenance,
        records=tuple(selected),
    )


def _validate_policy(policy: SequentialPolicy) -> None:
    if not math.isfinite(policy.confidence) or not 0.5 < policy.confidence < 1.0:
        raise ContractError("Sequential confidence must be between 0.5 and 1")
    for name, value in (
        ("minimum_cases", policy.minimum_cases),
        ("minimum_repeats", policy.minimum_repeats),
        ("maximum_repeats", policy.maximum_repeats),
        ("look_every", policy.look_every),
        ("resamples", policy.resamples),
    ):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ContractError(f"Sequential {name} must be a positive integer")
    if policy.minimum_repeats > policy.maximum_repeats:
        raise ContractError("Sequential minimum_repeats cannot exceed maximum_repeats")
    if policy.resamples < 100:
        raise ContractError("Sequential resamples must be at least 100")
    if isinstance(policy.seed, bool) or not isinstance(policy.seed, int):
        raise ContractError("Sequential seed must be an integer")
    if not policy.metric_gates:
        raise ContractError("Sequential policy needs at least one metric gate")
    for name, gate in policy.metric_gates.items():
        if gate.direction == "higher":
            threshold = gate.minimum
            valid_threshold = gate.minimum is not None and gate.maximum is None
        elif gate.direction == "lower":
            threshold = gate.maximum
            valid_threshold = gate.maximum is not None and gate.minimum is None
        else:
            raise ContractError(f"Sequential metric {name!r} direction must be higher or lower")
        if not valid_threshold or threshold is None or not math.isfinite(threshold):
            raise ContractError(f"Sequential metric {name!r} has an invalid threshold")
        if not math.isfinite(gate.max_regression) or gate.max_regression < 0:
            raise ContractError(f"Sequential metric {name!r} has invalid max_regression")


def _report(
    baseline: ReplayBundle,
    policy: SequentialPolicy,
    *,
    case_count: int,
    available_repeats: int,
    decision: str,
    failed_gates: tuple[str, ...],
    looks: tuple[SequentialLookResult, ...],
    provenance: dict,
) -> SequentialComparisonReport:
    stopped_at = looks[-1].repeat_count if decision in {"pass", "block"} and looks else None
    return SequentialComparisonReport(
        report_version="0.1",
        scenario_id=baseline.scenario_id,
        passed=decision == "pass",
        decision=decision,
        case_count=case_count,
        available_repeats=available_repeats,
        stopped_at_repeat=stopped_at,
        maximum_repeats=policy.maximum_repeats,
        method=METHOD,
        resamples=policy.resamples,
        seed=policy.seed,
        failed_gates=failed_gates,
        looks=looks,
        provenance=provenance,
    )
