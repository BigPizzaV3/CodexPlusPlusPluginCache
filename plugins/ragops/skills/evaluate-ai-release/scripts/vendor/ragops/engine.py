from __future__ import annotations

import math
from statistics import fmean

from ragops.evaluators import (
    citation_coverage,
    citation_precision,
    lexical_groundedness,
    redteam_findings,
)
from ragops.loader import ContractError
from ragops.models import (
    CaseResult,
    ComparisonReport,
    EvaluationPolicy,
    EvaluationReport,
    RecordedResponse,
    RegressionPolicy,
    Scenario,
)
from ragops.plugins import CaseEvaluator


def evaluate(
    scenario: Scenario,
    responses: tuple[RecordedResponse, ...],
    evaluators: tuple[CaseEvaluator, ...] = (),
    policy: EvaluationPolicy | None = None,
) -> EvaluationReport:
    policy = policy or EvaluationPolicy()
    _validate_evaluation_policy(policy)
    evaluator_names = [evaluator.name for evaluator in evaluators]
    if any(not name for name in evaluator_names) or len(set(evaluator_names)) != len(evaluator_names):
        raise ContractError("Evaluator names must be non-empty and unique")
    response_by_id = {response.case_id: response for response in responses}
    expected_ids = {case.id for case in scenario.cases}
    if set(response_by_id) != expected_ids:
        missing = sorted(expected_ids - set(response_by_id))
        unknown = sorted(set(response_by_id) - expected_ids)
        raise ContractError(f"Response coverage mismatch; missing={missing}, unknown={unknown}")

    result_items: list[CaseResult] = []
    for case in scenario.cases:
        response = response_by_id[case.id]
        custom_metrics: dict[str, float] = {}
        plugin_findings = []
        for evaluator in evaluators:
            plugin_result = evaluator.evaluate(case, response)
            for metric_name, value in plugin_result.metrics.items():
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise ContractError(
                        f"Evaluator metric {evaluator.name}.{metric_name} must be numeric"
                    )
                if not math.isfinite(value):
                    raise ContractError(
                        f"Evaluator metric {evaluator.name}.{metric_name} must be finite"
                    )
                key = f"{evaluator.name}.{metric_name}"
                if key in custom_metrics:
                    raise ValueError(f"Duplicate plugin metric: {key}")
                custom_metrics[key] = value
                if metric_name == "score":
                    custom_metrics[evaluator.name] = value
            invalid_severities = sorted(
                {
                    finding.severity
                    for finding in plugin_result.findings
                    if finding.severity not in {"low", "medium", "high", "critical"}
                }
            )
            if invalid_severities:
                raise ContractError(
                    f"Evaluator {evaluator.name} returned invalid finding severities: "
                    f"{invalid_severities}"
                )
            plugin_findings.extend(plugin_result.findings)
        result_items.append(CaseResult(
            case_id=case.id,
            citation_coverage=citation_coverage(case, response),
            citation_precision=citation_precision(case, response),
            lexical_groundedness=lexical_groundedness(case, response),
            latency_ms=response.latency_ms,
            cost_usd=response.cost_usd,
            findings=redteam_findings(scenario.redteam, response) + tuple(plugin_findings),
            custom_metrics=custom_metrics,
        ))
    results = tuple(result_items)
    metrics = {
        "citation_coverage": fmean(result.citation_coverage for result in results),
        "citation_precision": fmean(result.citation_precision for result in results),
        "lexical_groundedness": fmean(result.lexical_groundedness for result in results),
        "avg_latency_ms": fmean(result.latency_ms for result in results),
        "avg_cost_usd": fmean(result.cost_usd for result in results),
        "critical_findings": float(
            sum(finding.severity == "critical" for result in results for finding in result.findings)
        ),
    }
    custom_metric_names = sorted({name for result in results for name in result.custom_metrics})
    for name in custom_metric_names:
        values = [result.custom_metrics[name] for result in results if name in result.custom_metrics]
        metrics[name] = fmean(values)
    thresholds = scenario.thresholds
    failed: list[str] = []
    if metrics["citation_coverage"] < thresholds.citation_coverage:
        failed.append("citation_coverage")
    if metrics["citation_precision"] < thresholds.citation_precision:
        failed.append("citation_precision")
    if metrics["lexical_groundedness"] < thresholds.lexical_groundedness:
        failed.append("lexical_groundedness")
    if metrics["avg_latency_ms"] > thresholds.max_latency_ms:
        failed.append("latency_budget")
    if metrics["avg_cost_usd"] > thresholds.max_cost_usd:
        failed.append("cost_budget")
    if metrics["critical_findings"] > 0:
        failed.append("critical_redteam_finding")
    for metric_name, gate in policy.metric_gates.items():
        if metric_name not in metrics:
            raise ContractError(f"Evaluation policy metric is unavailable: {metric_name}")
        value = metrics[metric_name]
        if gate.minimum is not None and value < gate.minimum:
            failed.append(f"metric_minimum:{metric_name}")
        if gate.maximum is not None and value > gate.maximum:
            failed.append(f"metric_maximum:{metric_name}")
    if policy.fail_on_severity != "critical":
        severity_rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        floor = severity_rank[policy.fail_on_severity]
        if any(
            severity_rank.get(finding.severity, -1) >= floor
            for result in results
            for finding in result.findings
        ):
            failed.append(f"finding_severity:{policy.fail_on_severity}")

    return EvaluationReport(
        report_version="0.1",
        scenario_id=scenario.id,
        passed=not failed,
        metrics=metrics,
        failed_gates=tuple(failed),
        cases=results,
        metadata={"scenario_schema_version": scenario.schema_version},
    )


def compare(
    scenario: Scenario,
    baseline_responses: tuple[RecordedResponse, ...],
    candidate_responses: tuple[RecordedResponse, ...],
    policy: RegressionPolicy | None = None,
    evaluators: tuple[CaseEvaluator, ...] = (),
    evaluation_policy: EvaluationPolicy | None = None,
    baseline_evaluators: tuple[CaseEvaluator, ...] | None = None,
    candidate_evaluators: tuple[CaseEvaluator, ...] | None = None,
) -> ComparisonReport:
    """Compare a candidate build with a known baseline and apply regression gates."""
    policy = policy or RegressionPolicy()
    if (baseline_evaluators is None) != (candidate_evaluators is None):
        raise ContractError("Compare requires both baseline and candidate evaluator sets")
    baseline_evaluators = baseline_evaluators or evaluators
    candidate_evaluators = candidate_evaluators or evaluators
    baseline_names = tuple(evaluator.name for evaluator in baseline_evaluators)
    candidate_names = tuple(evaluator.name for evaluator in candidate_evaluators)
    if baseline_names != candidate_names:
        raise ContractError(
            "Baseline and candidate evaluator names must match; "
            f"baseline={baseline_names}, candidate={candidate_names}"
        )
    baseline = evaluate(
        scenario, baseline_responses, evaluators=baseline_evaluators, policy=evaluation_policy
    )
    candidate = evaluate(
        scenario, candidate_responses, evaluators=candidate_evaluators, policy=evaluation_policy
    )
    shared_metrics = baseline.metrics.keys() & candidate.metrics.keys()
    deltas = {
        name: candidate.metrics[name] - baseline.metrics[name]
        for name in baseline.metrics
        if name in shared_metrics
    }
    failed: list[str] = []
    if not candidate.passed:
        failed.append("candidate_release_gate")
    if deltas["citation_coverage"] < -policy.max_citation_coverage_drop:
        failed.append("citation_coverage_regression")
    if deltas["citation_precision"] < -policy.max_citation_precision_drop:
        failed.append("citation_precision_regression")
    if deltas["lexical_groundedness"] < -policy.max_groundedness_drop:
        failed.append("groundedness_regression")
    if deltas["avg_latency_ms"] > policy.max_latency_increase_ms:
        failed.append("latency_regression")
    if deltas["avg_cost_usd"] > policy.max_cost_increase_usd:
        failed.append("cost_regression")
    if deltas["critical_findings"] > 0:
        failed.append("new_critical_findings")

    return ComparisonReport(
        report_version="0.2",
        scenario_id=scenario.id,
        passed=not failed,
        baseline_passed=baseline.passed,
        candidate_passed=candidate.passed,
        deltas=deltas,
        failed_gates=tuple(failed),
        baseline=baseline,
        candidate=candidate,
    )


def _validate_evaluation_policy(policy: EvaluationPolicy) -> None:
    allowed_severities = {"low", "medium", "high", "critical"}
    if policy.fail_on_severity not in allowed_severities:
        raise ContractError("Evaluation policy severity must be low, medium, high, or critical")
    for name, gate in policy.metric_gates.items():
        if not name:
            raise ContractError("Evaluation policy metric names must be non-empty")
        if (gate.minimum is None) == (gate.maximum is None):
            raise ContractError(
                f"Evaluation policy metric {name!r} must define exactly one threshold"
            )
        value = gate.minimum if gate.minimum is not None else gate.maximum
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ContractError(f"Evaluation policy metric {name!r} threshold must be numeric")
        if not math.isfinite(value):
            raise ContractError(f"Evaluation policy metric {name!r} threshold must be finite")
