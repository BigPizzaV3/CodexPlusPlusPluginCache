from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ragops.loader import ContractError
from ragops.models import EvalCase, RecordedResponse, Scenario
from ragops.plugins import PluginResult

ALLOWED_PROVIDERS = {
    "custom", "deepeval", "langfuse", "langsmith", "mlflow", "phoenix", "promptfoo", "ragas"
}


@dataclass(frozen=True)
class ExternalMetricEnvelope:
    provider: str
    metrics_by_case: dict[str, dict[str, float]]
    metric_names: frozenset[str]


class ExternalMetricEvaluator:
    """Expose a portable external metric envelope through the evaluator protocol."""

    def __init__(self, envelope: ExternalMetricEnvelope) -> None:
        self.name = envelope.provider
        self._metrics_by_case = envelope.metrics_by_case
        self.metric_names = envelope.metric_names

    def evaluate(self, case: EvalCase, response: RecordedResponse) -> PluginResult:
        try:
            metrics = self._metrics_by_case[case.id]
        except KeyError as exc:
            raise ContractError(f"External metrics are missing case {case.id!r}") from exc
        return PluginResult(metrics=metrics)


def load_external_metric_evaluator(
    path: str | Path,
    scenario: Scenario,
) -> ExternalMetricEvaluator:
    try:
        data: Any = json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load external metrics from {path}: {exc}") from exc
    envelope = external_metric_envelope_from_dict(data)
    expected = {case.id for case in scenario.cases}
    supplied = set(envelope.metrics_by_case)
    if supplied != expected:
        missing = sorted(expected - supplied)
        unknown = sorted(supplied - expected)
        raise ContractError(
            f"External metric coverage mismatch; missing={missing}, unknown={unknown}"
        )
    return ExternalMetricEvaluator(envelope)


def external_metric_envelope_from_dict(data: Any) -> ExternalMetricEnvelope:
    if not isinstance(data, dict) or data.get("schema_version") != "0.1":
        raise ContractError("External metrics must use schema version 0.1")
    unknown_fields = set(data) - {"schema_version", "provider", "records", "provenance", "warnings"}
    if unknown_fields:
        raise ContractError(f"External metrics have unknown fields: {sorted(unknown_fields)}")
    provider = data.get("provider")
    if provider not in ALLOWED_PROVIDERS:
        raise ContractError(f"External metric provider is unsupported: {provider!r}")
    records = data.get("records")
    if not isinstance(records, list) or not records:
        raise ContractError("External metrics need at least one record")
    metrics_by_case: dict[str, dict[str, float]] = {}
    expected_metric_names: frozenset[str] | None = None
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ContractError(f"External metric record {index} must be an object")
        unknown_record_fields = set(record) - {"case_id", "metrics"}
        if unknown_record_fields:
            raise ContractError(
                f"External metric record {index} has unknown fields: "
                f"{sorted(unknown_record_fields)}"
            )
        case_id = record.get("case_id")
        if not isinstance(case_id, str) or not case_id:
            raise ContractError(f"External metric record {index} needs a non-empty case_id")
        if case_id in metrics_by_case:
            raise ContractError(f"External metric case IDs must be unique: {case_id!r}")
        raw_metrics = record.get("metrics")
        if not isinstance(raw_metrics, dict) or not raw_metrics:
            raise ContractError(f"External metric record {case_id!r} needs metrics")
        metrics: dict[str, float] = {}
        for name, value in raw_metrics.items():
            if not isinstance(name, str) or not name:
                raise ContractError(f"External metric names must be non-empty for case {case_id!r}")
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ContractError(f"External metric {provider}.{name} must be numeric")
            number = float(value)
            if not math.isfinite(number):
                raise ContractError(f"External metric {provider}.{name} must be finite")
            metrics[name] = number
        metric_names = frozenset(metrics)
        if expected_metric_names is None:
            expected_metric_names = metric_names
        elif metric_names != expected_metric_names:
            raise ContractError(
                f"External metric names differ for case {case_id!r}; "
                f"expected={sorted(expected_metric_names)}, actual={sorted(metric_names)}"
            )
        metrics_by_case[case_id] = metrics
    return ExternalMetricEnvelope(
        provider=provider,
        metrics_by_case=metrics_by_case,
        metric_names=expected_metric_names or frozenset(),
    )


def validate_external_metric_pair(
    baseline: ExternalMetricEvaluator,
    candidate: ExternalMetricEvaluator,
) -> None:
    if baseline.name != candidate.name:
        raise ContractError(
            f"External metric providers differ: {baseline.name!r} != {candidate.name!r}"
        )
    if baseline.metric_names != candidate.metric_names:
        raise ContractError(
            "External baseline and candidate metric names differ; "
            f"baseline={sorted(baseline.metric_names)}, "
            f"candidate={sorted(candidate.metric_names)}"
        )
