from __future__ import annotations

import math
from collections import defaultdict

from ragops.loader import ContractError
from ragops.models import MetricObservation

OTEL_EVALUATION_NAME = "gen_ai.evaluation.name"
OTEL_EVALUATION_SCORE = "gen_ai.evaluation.score.value"
RAGOPS_CASE_ID = "ragops.case.id"
RAGOPS_REPEAT_ID = "ragops.repeat.id"


def ragas_scores_to_observations(
    scores: list[dict],
    case_ids: list[str],
    *,
    repeat_id: str,
    metric_names: tuple[str, ...],
) -> tuple[MetricObservation, ...]:
    """Map ordered Ragas EvaluationResult.scores rows into replay observations."""
    _identifiers(case_ids, repeat_id, metric_names)
    if len(scores) != len(case_ids):
        raise ContractError("Ragas score rows must match the ordered case IDs")
    observations = []
    for index, (case_id, score_row) in enumerate(zip(case_ids, scores, strict=True)):
        if not isinstance(score_row, dict):
            raise ContractError(f"Ragas score row {index} must be an object")
        observations.append(
            MetricObservation(
                case_id=case_id,
                repeat_id=repeat_id,
                metrics=_selected_metrics(score_row, metric_names, f"Ragas row {index}"),
            )
        )
    return tuple(observations)


def deepeval_scores_to_observations(
    records: list[dict],
    *,
    metric_names: tuple[str, ...],
) -> tuple[MetricObservation, ...]:
    """Map recorded DeepEval metric.score values into replay observations."""
    if not metric_names or len(set(metric_names)) != len(metric_names):
        raise ContractError("DeepEval metric names must be non-empty and unique")
    observations = []
    identities = set()
    for index, record in enumerate(records):
        if not isinstance(record, dict) or set(record) != {"case_id", "repeat_id", "metrics"}:
            raise ContractError(
                f"DeepEval record {index} must contain case_id, repeat_id, and metrics"
            )
        case_id = record["case_id"]
        repeat_id = record["repeat_id"]
        _identifiers([case_id], repeat_id, metric_names)
        identity = (case_id, repeat_id)
        if identity in identities:
            raise ContractError("DeepEval case/repeat identities must be unique")
        identities.add(identity)
        observations.append(
            MetricObservation(
                case_id=case_id,
                repeat_id=repeat_id,
                metrics=_selected_metrics(
                    record["metrics"], metric_names, f"DeepEval record {index}"
                ),
            )
        )
    if not observations:
        raise ContractError("DeepEval records must not be empty")
    return tuple(observations)


def otel_evaluation_events_to_observations(
    events: list[dict],
) -> tuple[MetricObservation, ...]:
    """Group recorded OpenTelemetry GenAI evaluation events by replay identity."""
    grouped: dict[tuple[str, str], dict[str, float]] = defaultdict(dict)
    if not events:
        raise ContractError("OpenTelemetry evaluation events must not be empty")
    for index, event in enumerate(events):
        if not isinstance(event, dict) or not isinstance(event.get("attributes"), dict):
            raise ContractError(f"OpenTelemetry event {index} needs an attributes object")
        attributes = event["attributes"]
        try:
            case_id = attributes[RAGOPS_CASE_ID]
            repeat_id = attributes[RAGOPS_REPEAT_ID]
            metric_name = attributes[OTEL_EVALUATION_NAME]
            score = attributes[OTEL_EVALUATION_SCORE]
        except KeyError as exc:
            raise ContractError(
                f"OpenTelemetry event {index} is missing required attribute {exc.args[0]}"
            ) from exc
        _identifiers([case_id], repeat_id, (metric_name,))
        numeric = _finite(score, f"OpenTelemetry event {index} score")
        identity = (case_id, repeat_id)
        if metric_name in grouped[identity]:
            raise ContractError(
                f"Duplicate OpenTelemetry evaluation metric {metric_name!r} for {identity}"
            )
        grouped[identity][metric_name] = numeric
    metric_sets = {tuple(sorted(metrics)) for metrics in grouped.values()}
    if len(metric_sets) != 1:
        raise ContractError(
            "Every OpenTelemetry replay identity must contain the same evaluation metrics"
        )
    return tuple(
        MetricObservation(case_id, repeat_id, metrics)
        for (case_id, repeat_id), metrics in sorted(grouped.items())
    )


def _selected_metrics(
    raw: object, metric_names: tuple[str, ...], label: str
) -> dict[str, float]:
    if not isinstance(raw, dict):
        raise ContractError(f"{label} metrics must be an object")
    missing = sorted(set(metric_names) - set(raw))
    if missing:
        raise ContractError(f"{label} is missing metrics: {missing}")
    return {name: _finite(raw[name], f"{label}.{name}") for name in metric_names}


def _identifiers(
    case_ids: list[str], repeat_id: str, metric_names: tuple[str, ...]
) -> None:
    if not case_ids or any(not isinstance(case_id, str) or not case_id for case_id in case_ids):
        raise ContractError("Case IDs must be non-empty strings")
    if len(set(case_ids)) != len(case_ids):
        raise ContractError("Case IDs must be unique")
    if not isinstance(repeat_id, str) or not repeat_id:
        raise ContractError("Repeat ID must be a non-empty string")
    if (
        not metric_names
        or len(set(metric_names)) != len(metric_names)
        or any(not isinstance(name, str) or not name for name in metric_names)
    ):
        raise ContractError("Metric names must be non-empty and unique")


def _finite(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{name} must be numeric")
    numeric = float(value)
    if not math.isfinite(numeric):
        raise ContractError(f"{name} must be finite")
    return numeric
