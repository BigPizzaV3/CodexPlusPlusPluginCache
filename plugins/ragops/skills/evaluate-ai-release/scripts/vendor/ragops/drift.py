from __future__ import annotations

import math
from statistics import fmean

from ragops.loader import ContractError
from ragops.models import (
    EvaluatorDriftMetricResult,
    EvaluatorDriftPolicy,
    EvaluatorDriftReport,
    ReplayBundle,
)
from ragops.statistical import _bootstrap_metric, _group_values, _quantile

METHOD = "paired_hierarchical_bootstrap_two_sided_equivalence"


def detect_evaluator_drift(
    reference: ReplayBundle,
    current: ReplayBundle,
    policy: EvaluatorDriftPolicy,
) -> EvaluatorDriftReport:
    _validate_policy(policy)
    _validate_evaluator_pair(reference, current, policy)
    reference_values = _group_values(reference)
    current_values = _group_values(current)
    case_ids = tuple(sorted(reference_values))
    insufficient = len(case_ids) < policy.minimum_cases
    failed: list[str] = ["insufficient_cases"] if insufficient else []
    results: dict[str, EvaluatorDriftMetricResult] = {}
    alpha = 1.0 - policy.confidence

    for metric_name, gate in policy.metric_gates.items():
        reference_mean = fmean(
            fmean(item[metric_name] for item in reference_values[case_id])
            for case_id in case_ids
        )
        current_mean = fmean(
            fmean(item[metric_name] for item in current_values[case_id])
            for case_id in case_ids
        )
        delta = current_mean - reference_mean
        lower_bound: float | None = None
        upper_bound: float | None = None
        passed = False
        if not insufficient:
            _, delta_samples = _bootstrap_metric(
                case_ids,
                reference_values,
                current_values,
                metric_name,
                resamples=policy.resamples,
                seed=policy.seed,
            )
            lower_bound = _quantile(delta_samples, alpha / 2.0)
            upper_bound = _quantile(delta_samples, 1.0 - alpha / 2.0)
            passed = (
                lower_bound >= -gate.max_absolute_change
                and upper_bound <= gate.max_absolute_change
            )
            if not passed:
                failed.append(f"evaluator_drift:{metric_name}")
        results[metric_name] = EvaluatorDriftMetricResult(
            reference_mean=reference_mean,
            current_mean=current_mean,
            delta=delta,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
            max_absolute_change=gate.max_absolute_change,
            passed=passed,
        )

    return EvaluatorDriftReport(
        report_version="0.1",
        scenario_id=reference.scenario_id,
        passed=not failed,
        confidence=policy.confidence,
        case_count=len(case_ids),
        reference_observations=len(reference.records),
        current_observations=len(current.records),
        method=METHOD,
        resamples=policy.resamples,
        seed=policy.seed,
        failed_gates=tuple(failed),
        metrics=results,
        provenance={
            "scenario_digest": reference.scenario_digest,
            "dataset": reference.provenance.dataset,
            "evidence": reference.provenance.evidence,
            "reference_evaluator": reference.provenance.evaluator,
            "current_evaluator": current.provenance.evaluator,
            "application": reference.provenance.application,
            "model": reference.provenance.model,
            "model_config": reference.provenance.model_config,
            "environment": reference.provenance.environment,
        },
    )


def _validate_evaluator_pair(
    reference: ReplayBundle,
    current: ReplayBundle,
    policy: EvaluatorDriftPolicy,
) -> None:
    matching = (
        ("scenario ID", reference.scenario_id, current.scenario_id),
        ("scenario digest", reference.scenario_digest, current.scenario_digest),
        ("dataset", reference.provenance.dataset, current.provenance.dataset),
        ("evidence", reference.provenance.evidence, current.provenance.evidence),
        ("application", reference.provenance.application, current.provenance.application),
        ("model", reference.provenance.model, current.provenance.model),
        ("model config", reference.provenance.model_config, current.provenance.model_config),
        ("environment", reference.provenance.environment, current.provenance.environment),
    )
    changed = [name for name, old, new in matching if old != new]
    if changed:
        raise ContractError(
            "Evaluator drift anchors must match outside the evaluator axis; "
            f"changed={changed}"
        )
    if reference.provenance.evaluator == current.provenance.evaluator:
        raise ContractError("Evaluator drift comparison requires different evaluator provenance")
    reference_cases = {record.case_id for record in reference.records}
    current_cases = {record.case_id for record in current.records}
    if reference_cases != current_cases:
        raise ContractError("Evaluator drift anchor case coverage must match")
    reference_metrics = set(reference.records[0].metrics)
    current_metrics = set(current.records[0].metrics)
    if reference_metrics != current_metrics:
        raise ContractError("Evaluator drift metric names must match")
    unavailable = sorted(set(policy.metric_gates) - reference_metrics)
    if unavailable:
        raise ContractError(f"Evaluator drift policy metrics are unavailable: {unavailable}")


def _validate_policy(policy: EvaluatorDriftPolicy) -> None:
    if not math.isfinite(policy.confidence) or not 0.5 < policy.confidence < 1.0:
        raise ContractError("Evaluator drift confidence must be between 0.5 and 1")
    if isinstance(policy.minimum_cases, bool) or not isinstance(policy.minimum_cases, int):
        raise ContractError("Evaluator drift minimum_cases must be an integer")
    if policy.minimum_cases < 1:
        raise ContractError("Evaluator drift minimum_cases must be positive")
    if isinstance(policy.resamples, bool) or not isinstance(policy.resamples, int):
        raise ContractError("Evaluator drift resamples must be an integer")
    if policy.resamples < 100:
        raise ContractError("Evaluator drift resamples must be at least 100")
    if isinstance(policy.seed, bool) or not isinstance(policy.seed, int):
        raise ContractError("Evaluator drift seed must be an integer")
    if not policy.metric_gates:
        raise ContractError("Evaluator drift policy needs at least one metric gate")
    for name, gate in policy.metric_gates.items():
        if not isinstance(name, str) or not name:
            raise ContractError("Evaluator drift metric names must be non-empty strings")
        if not math.isfinite(gate.max_absolute_change) or gate.max_absolute_change < 0:
            raise ContractError(
                f"Evaluator drift metric {name!r} tolerance must be finite and non-negative"
            )
