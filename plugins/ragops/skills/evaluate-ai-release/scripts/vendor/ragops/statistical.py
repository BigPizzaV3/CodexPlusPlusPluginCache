from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import fmean
from typing import Any

from ragops.loader import ContractError
from ragops.models import (
    MetricObservation,
    ReplayBundle,
    ReplayProvenance,
    StatisticalComparisonReport,
    StatisticalMetricResult,
    StatisticalPolicy,
)

METHOD = "paired_hierarchical_bootstrap_one_sided"


def load_replay_bundle(path: str | Path) -> ReplayBundle:
    try:
        data = json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load replay bundle from {path}: {exc}") from exc
    return replay_bundle_from_dict(data)


def replay_bundle_from_dict(data: dict[str, Any]) -> ReplayBundle:
    if not isinstance(data, dict):
        raise ContractError("Replay bundle must be an object")
    unknown = set(data) - {
        "schema_version",
        "scenario_id",
        "scenario_digest",
        "provenance",
        "records",
    }
    if unknown:
        raise ContractError(f"Unknown replay bundle fields: {sorted(unknown)}")
    try:
        raw_provenance = data["provenance"]
        if not isinstance(raw_provenance, dict):
            raise TypeError("provenance must be an object")
        unknown_provenance = set(raw_provenance) - {
            "dataset",
            "evidence",
            "evaluator",
            "application",
            "model",
            "model_config",
            "environment",
        }
        if unknown_provenance:
            raise ValueError(f"unknown provenance fields: {sorted(unknown_provenance)}")
        provenance = ReplayProvenance(
            dataset=raw_provenance["dataset"],
            evidence=raw_provenance["evidence"],
            evaluator=raw_provenance["evaluator"],
            application=raw_provenance["application"],
            model=raw_provenance["model"],
            model_config=raw_provenance["model_config"],
            environment=raw_provenance["environment"],
        )
        raw_records = data["records"]
        if not isinstance(raw_records, list):
            raise TypeError("records must be an array")
        records = tuple(_observation(item, index) for index, item in enumerate(raw_records))
        bundle = ReplayBundle(
            schema_version=data["schema_version"],
            scenario_id=data["scenario_id"],
            scenario_digest=data["scenario_digest"],
            provenance=provenance,
            records=records,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid replay bundle contract: {exc}") from exc

    if bundle.schema_version != "0.1":
        raise ContractError(f"Unsupported replay bundle schema: {bundle.schema_version}")
    for name, value in (
        ("scenario_id", bundle.scenario_id),
        ("scenario_digest", bundle.scenario_digest),
        ("provenance.dataset", bundle.provenance.dataset),
        ("provenance.evidence", bundle.provenance.evidence),
        ("provenance.evaluator", bundle.provenance.evaluator),
        ("provenance.application", bundle.provenance.application),
        ("provenance.model", bundle.provenance.model),
        ("provenance.model_config", bundle.provenance.model_config),
        ("provenance.environment", bundle.provenance.environment),
    ):
        if not isinstance(value, str) or not value:
            raise ContractError(f"{name} must be a non-empty string")
    if not bundle.records:
        raise ContractError("Replay bundle needs at least one record")
    identities = [(record.case_id, record.repeat_id) for record in bundle.records]
    if len(set(identities)) != len(identities):
        raise ContractError("Replay bundle case/repeat identities must be unique")
    metric_sets = {tuple(sorted(record.metrics)) for record in bundle.records}
    if len(metric_sets) != 1:
        raise ContractError("Every replay record must contain the same metric names")
    return bundle


def compare_replay_bundles(
    baseline: ReplayBundle,
    candidate: ReplayBundle,
    policy: StatisticalPolicy,
) -> StatisticalComparisonReport:
    _validate_policy(policy)
    _validate_pair(baseline, candidate, policy)
    baseline_values = _group_values(baseline)
    candidate_values = _group_values(candidate)
    case_ids = tuple(sorted(baseline_values))
    insufficient = len(case_ids) < policy.minimum_cases
    metric_results: dict[str, StatisticalMetricResult] = {}
    failed: list[str] = []
    if insufficient:
        failed.append("insufficient_cases")

    for metric_name, gate in policy.metric_gates.items():
        baseline_case_means = {
            case_id: fmean(item[metric_name] for item in baseline_values[case_id])
            for case_id in case_ids
        }
        candidate_case_means = {
            case_id: fmean(item[metric_name] for item in candidate_values[case_id])
            for case_id in case_ids
        }
        baseline_mean = fmean(baseline_case_means.values())
        candidate_mean = fmean(candidate_case_means.values())
        delta = candidate_mean - baseline_mean
        metric_failed: list[str] = []
        candidate_bound: float | None = None
        regression_bound: float | None = None

        if insufficient:
            metric_failed.append("insufficient_cases")
        else:
            candidate_samples, delta_samples = _bootstrap_metric(
                case_ids,
                baseline_values,
                candidate_values,
                metric_name,
                resamples=policy.resamples,
                seed=policy.seed,
            )
            if gate.direction == "higher":
                candidate_bound = _quantile(candidate_samples, 1.0 - policy.confidence)
                regression_bound = _quantile(delta_samples, 1.0 - policy.confidence)
                if candidate_bound < gate.minimum:
                    metric_failed.append("absolute")
                    failed.append(f"metric_absolute:{metric_name}")
                if regression_bound < -gate.max_regression:
                    metric_failed.append("regression")
                    failed.append(f"metric_regression:{metric_name}")
                threshold = gate.minimum
            else:
                candidate_bound = _quantile(candidate_samples, policy.confidence)
                regression_bound = _quantile(delta_samples, policy.confidence)
                if candidate_bound > gate.maximum:
                    metric_failed.append("absolute")
                    failed.append(f"metric_absolute:{metric_name}")
                if regression_bound > gate.max_regression:
                    metric_failed.append("regression")
                    failed.append(f"metric_regression:{metric_name}")
                threshold = gate.maximum

        if insufficient:
            threshold = gate.minimum if gate.direction == "higher" else gate.maximum
        metric_results[metric_name] = StatisticalMetricResult(
            direction=gate.direction,
            baseline_mean=baseline_mean,
            candidate_mean=candidate_mean,
            delta=delta,
            candidate_bound=candidate_bound,
            regression_bound=regression_bound,
            absolute_threshold=threshold,
            max_regression=gate.max_regression,
            passed=not metric_failed,
            failed_gates=tuple(metric_failed),
        )

    return StatisticalComparisonReport(
        report_version="0.1",
        scenario_id=baseline.scenario_id,
        passed=not failed,
        confidence=policy.confidence,
        case_count=len(case_ids),
        baseline_observations=len(baseline.records),
        candidate_observations=len(candidate.records),
        method=METHOD,
        resamples=policy.resamples,
        seed=policy.seed,
        failed_gates=tuple(failed),
        metrics=metric_results,
        provenance={
            "scenario_digest": baseline.scenario_digest,
            "changed_axes": list(classify_provenance_changes(baseline, candidate)),
            "baseline": _provenance_dict(baseline.provenance),
            "candidate": _provenance_dict(candidate.provenance),
        },
    )


def _observation(item: object, index: int) -> MetricObservation:
    if not isinstance(item, dict):
        raise TypeError(f"records[{index}] must be an object")
    unknown = set(item) - {"case_id", "repeat_id", "metrics"}
    if unknown:
        raise ValueError(f"records[{index}] has unknown fields: {sorted(unknown)}")
    case_id = item["case_id"]
    repeat_id = item["repeat_id"]
    raw_metrics = item["metrics"]
    if not isinstance(case_id, str) or not case_id:
        raise ValueError(f"records[{index}].case_id must be a non-empty string")
    if not isinstance(repeat_id, str) or not repeat_id:
        raise ValueError(f"records[{index}].repeat_id must be a non-empty string")
    if not isinstance(raw_metrics, dict) or not raw_metrics:
        raise ValueError(f"records[{index}].metrics must be a non-empty object")
    metrics: dict[str, float] = {}
    for name, value in raw_metrics.items():
        if not isinstance(name, str) or not name:
            raise ValueError(f"records[{index}] metric names must be non-empty strings")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"records[{index}].metrics.{name} must be numeric")
        numeric = float(value)
        if not math.isfinite(numeric):
            raise ValueError(f"records[{index}].metrics.{name} must be finite")
        metrics[name] = numeric
    return MetricObservation(case_id=case_id, repeat_id=repeat_id, metrics=metrics)


def _validate_pair(
    baseline: ReplayBundle,
    candidate: ReplayBundle,
    policy: StatisticalPolicy,
) -> None:
    if baseline.scenario_id != candidate.scenario_id:
        raise ContractError("Baseline and candidate replay scenario IDs must match")
    if baseline.scenario_digest != candidate.scenario_digest:
        raise ContractError("Baseline and candidate replay scenario digests must match")
    if baseline.provenance.dataset != candidate.provenance.dataset:
        raise ContractError("Baseline and candidate replay dataset provenance must match")
    if baseline.provenance.evaluator != candidate.provenance.evaluator:
        raise ContractError("Baseline and candidate replay evaluator provenance must match")
    if baseline.provenance.environment != candidate.provenance.environment:
        raise ContractError(
            "Baseline and candidate replay environment provenance must match; "
            "model regression would be confounded with infrastructure noise"
        )
    baseline_cases = {record.case_id for record in baseline.records}
    candidate_cases = {record.case_id for record in candidate.records}
    if baseline_cases != candidate_cases:
        missing = sorted(baseline_cases - candidate_cases)
        unknown = sorted(candidate_cases - baseline_cases)
        raise ContractError(f"Replay case coverage mismatch; missing={missing}, unknown={unknown}")
    baseline_metrics = set(baseline.records[0].metrics)
    candidate_metrics = set(candidate.records[0].metrics)
    if baseline_metrics != candidate_metrics:
        raise ContractError("Baseline and candidate replay metric names must match")
    unavailable = sorted(set(policy.metric_gates) - baseline_metrics)
    if unavailable:
        raise ContractError(f"Statistical policy metrics are unavailable: {unavailable}")


def _validate_policy(policy: StatisticalPolicy) -> None:
    if not math.isfinite(policy.confidence) or not 0.5 < policy.confidence < 1.0:
        raise ContractError("Statistical confidence must be greater than 0.5 and less than 1")
    if isinstance(policy.minimum_cases, bool) or not isinstance(policy.minimum_cases, int):
        raise ContractError("Statistical minimum_cases must be an integer")
    if policy.minimum_cases < 1:
        raise ContractError("Statistical minimum_cases must be positive")
    if isinstance(policy.resamples, bool) or not isinstance(policy.resamples, int):
        raise ContractError("Statistical resamples must be an integer")
    if policy.resamples < 100:
        raise ContractError("Statistical resamples must be at least 100")
    if isinstance(policy.seed, bool) or not isinstance(policy.seed, int):
        raise ContractError("Statistical seed must be an integer")
    if not policy.metric_gates:
        raise ContractError("Statistical policy needs at least one metric gate")
    for name, gate in policy.metric_gates.items():
        if not isinstance(name, str) or not name:
            raise ContractError("Statistical policy metric names must be non-empty strings")
        if gate.direction not in {"higher", "lower"}:
            raise ContractError(f"Statistical metric {name!r} direction must be higher or lower")
        if gate.direction == "higher":
            if gate.minimum is None or gate.maximum is not None:
                raise ContractError(
                    f"Higher statistical metric {name!r} requires only a minimum"
                )
            threshold = gate.minimum
        else:
            if gate.maximum is None or gate.minimum is not None:
                raise ContractError(
                    f"Lower statistical metric {name!r} requires only a maximum"
                )
            threshold = gate.maximum
        if not math.isfinite(threshold):
            raise ContractError(f"Statistical metric {name!r} threshold must be finite")
        if not math.isfinite(gate.max_regression) or gate.max_regression < 0:
            raise ContractError(
                f"Statistical metric {name!r} max_regression must be finite and non-negative"
            )


def _group_values(bundle: ReplayBundle) -> dict[str, list[dict[str, float]]]:
    grouped: dict[str, list[dict[str, float]]] = defaultdict(list)
    for record in bundle.records:
        grouped[record.case_id].append(record.metrics)
    return dict(grouped)


def classify_provenance_changes(
    baseline: ReplayBundle, candidate: ReplayBundle
) -> tuple[str, ...]:
    changes: list[str] = []
    if (
        baseline.scenario_id != candidate.scenario_id
        or baseline.scenario_digest != candidate.scenario_digest
    ):
        changes.append("scenario")
    if baseline.provenance.dataset != candidate.provenance.dataset:
        changes.append("dataset")
    if baseline.provenance.evidence != candidate.provenance.evidence:
        changes.append("evidence")
    if baseline.provenance.evaluator != candidate.provenance.evaluator:
        changes.append("evaluator")
    if baseline.provenance.application != candidate.provenance.application:
        changes.append("application")
    if baseline.provenance.model != candidate.provenance.model:
        changes.append("model")
    if baseline.provenance.model_config != candidate.provenance.model_config:
        changes.append("model_config")
    if baseline.provenance.environment != candidate.provenance.environment:
        changes.append("infrastructure")
    return tuple(changes)


def _provenance_dict(provenance: ReplayProvenance) -> dict[str, str]:
    return {
        "dataset": provenance.dataset,
        "evidence": provenance.evidence,
        "evaluator": provenance.evaluator,
        "application": provenance.application,
        "model": provenance.model,
        "model_config": provenance.model_config,
        "environment": provenance.environment,
    }


def _bootstrap_metric(
    case_ids: tuple[str, ...],
    baseline: dict[str, list[dict[str, float]]],
    candidate: dict[str, list[dict[str, float]]],
    metric_name: str,
    *,
    resamples: int,
    seed: int,
) -> tuple[list[float], list[float]]:
    candidate_samples: list[float] = []
    delta_samples: list[float] = []
    for replicate in range(resamples):
        baseline_case_means: list[float] = []
        candidate_case_means: list[float] = []
        for case_draw in range(len(case_ids)):
            case_id = case_ids[
                _index(seed, metric_name, replicate, "case", case_draw, len(case_ids))
            ]
            baseline_items = baseline[case_id]
            candidate_items = candidate[case_id]
            baseline_case_means.append(
                fmean(
                    baseline_items[
                        _index(
                            seed,
                            metric_name,
                            replicate,
                            "baseline",
                            case_draw,
                            repeat_draw,
                            len(baseline_items),
                        )
                    ][metric_name]
                    for repeat_draw in range(len(baseline_items))
                )
            )
            candidate_case_means.append(
                fmean(
                    candidate_items[
                        _index(
                            seed,
                            metric_name,
                            replicate,
                            "candidate",
                            case_draw,
                            repeat_draw,
                            len(candidate_items),
                        )
                    ][metric_name]
                    for repeat_draw in range(len(candidate_items))
                )
            )
        baseline_sample = fmean(baseline_case_means)
        candidate_sample = fmean(candidate_case_means)
        candidate_samples.append(candidate_sample)
        delta_samples.append(candidate_sample - baseline_sample)
    return candidate_samples, delta_samples


def _index(seed: int, *parts: object) -> int:
    size = parts[-1]
    if not isinstance(size, int) or size < 1:
        raise ValueError("Bootstrap sample size must be positive")
    payload = ":".join(str(part) for part in (seed, *parts[:-1])).encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big") % size


def _quantile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight
