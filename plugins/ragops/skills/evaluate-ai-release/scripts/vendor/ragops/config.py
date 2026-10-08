from __future__ import annotations

import math
import tomllib
from pathlib import Path

from ragops.models import (
    EvaluationPolicy,
    EvaluatorDriftMetricGate,
    EvaluatorDriftPolicy,
    MetricGate,
    RegressionPolicy,
    SequentialPolicy,
    StatisticalMetricGate,
    StatisticalPolicy,
)


def load_regression_policy(path: str | Path) -> RegressionPolicy:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        policy = RegressionPolicy(**data["regression"])
        for name, value in (
            ("max_citation_coverage_drop", policy.max_citation_coverage_drop),
            ("max_citation_precision_drop", policy.max_citation_precision_drop),
            ("max_groundedness_drop", policy.max_groundedness_drop),
            ("max_latency_increase_ms", policy.max_latency_increase_ms),
            ("max_cost_increase_usd", policy.max_cost_increase_usd),
        ):
            if _finite_number(value, f"regression.{name}") < 0:
                raise ValueError(f"regression.{name} must be non-negative")
        return policy
    except (OSError, tomllib.TOMLDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid regression policy {path}: {exc}") from exc


def load_evaluation_policy(path: str | Path) -> EvaluationPolicy:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        raw_metrics = data.get("metrics", {})
        if not isinstance(raw_metrics, dict):
            raise TypeError("metrics must be a table")
        metric_gates: dict[str, MetricGate] = {}
        for name, raw_gate in raw_metrics.items():
            if not isinstance(name, str) or not name:
                raise ValueError("metric names must be non-empty strings")
            if not isinstance(raw_gate, dict):
                raise TypeError(f"metric gate {name!r} must be a table")
            unknown = set(raw_gate) - {"minimum", "maximum"}
            if unknown:
                raise ValueError(f"metric gate {name!r} has unknown fields: {sorted(unknown)}")
            if ("minimum" in raw_gate) == ("maximum" in raw_gate):
                raise ValueError(
                    f"metric gate {name!r} must define exactly one of minimum or maximum"
                )
            minimum = _finite_number(raw_gate["minimum"], f"metrics.{name}.minimum") if "minimum" in raw_gate else None
            maximum = _finite_number(raw_gate["maximum"], f"metrics.{name}.maximum") if "maximum" in raw_gate else None
            metric_gates[name] = MetricGate(minimum=minimum, maximum=maximum)
        raw_findings = data.get("findings", {})
        if not isinstance(raw_findings, dict):
            raise TypeError("findings must be a table")
        unknown_findings = set(raw_findings) - {"fail_on_severity"}
        if unknown_findings:
            raise ValueError(f"findings has unknown fields: {sorted(unknown_findings)}")
        severity = raw_findings.get("fail_on_severity", "critical")
        if severity not in {"low", "medium", "high", "critical"}:
            raise ValueError("findings.fail_on_severity must be low, medium, high, or critical")
        return EvaluationPolicy(metric_gates=metric_gates, fail_on_severity=severity)
    except (OSError, tomllib.TOMLDecodeError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid evaluation policy {path}: {exc}") from exc


def load_statistical_policy(path: str | Path) -> StatisticalPolicy:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        raw_statistical = data["statistical"]
        if not isinstance(raw_statistical, dict):
            raise TypeError("statistical must be a table")
        unknown_statistical = set(raw_statistical) - {
            "confidence",
            "minimum_cases",
            "resamples",
            "seed",
            "metrics",
        }
        if unknown_statistical:
            raise ValueError(
                f"statistical has unknown fields: {sorted(unknown_statistical)}"
            )
        confidence = _finite_number(raw_statistical["confidence"], "statistical.confidence")
        if not 0.5 < confidence < 1.0:
            raise ValueError("statistical.confidence must be greater than 0.5 and less than 1")
        minimum_cases = _positive_integer(
            raw_statistical["minimum_cases"], "statistical.minimum_cases"
        )
        resamples = _positive_integer(raw_statistical["resamples"], "statistical.resamples")
        if resamples < 100:
            raise ValueError("statistical.resamples must be at least 100")
        seed = raw_statistical["seed"]
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise TypeError("statistical.seed must be an integer")
        raw_metrics = raw_statistical["metrics"]
        if not isinstance(raw_metrics, dict) or not raw_metrics:
            raise ValueError("statistical.metrics must be a non-empty table")
        metric_gates = {
            name: _statistical_metric_gate(name, raw_gate)
            for name, raw_gate in raw_metrics.items()
        }
        return StatisticalPolicy(
            confidence=confidence,
            minimum_cases=minimum_cases,
            resamples=resamples,
            seed=seed,
            metric_gates=metric_gates,
        )
    except (OSError, tomllib.TOMLDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid statistical policy {path}: {exc}") from exc


def load_evaluator_drift_policy(path: str | Path) -> EvaluatorDriftPolicy:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        raw_drift = data["drift"]
        if not isinstance(raw_drift, dict):
            raise TypeError("drift must be a table")
        unknown = set(raw_drift) - {
            "confidence",
            "minimum_cases",
            "resamples",
            "seed",
            "metrics",
        }
        if unknown:
            raise ValueError(f"drift has unknown fields: {sorted(unknown)}")
        confidence = _finite_number(raw_drift["confidence"], "drift.confidence")
        if not 0.5 < confidence < 1.0:
            raise ValueError("drift.confidence must be greater than 0.5 and less than 1")
        minimum_cases = _positive_integer(raw_drift["minimum_cases"], "drift.minimum_cases")
        resamples = _positive_integer(raw_drift["resamples"], "drift.resamples")
        if resamples < 100:
            raise ValueError("drift.resamples must be at least 100")
        seed = raw_drift["seed"]
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise TypeError("drift.seed must be an integer")
        raw_metrics = raw_drift["metrics"]
        if not isinstance(raw_metrics, dict) or not raw_metrics:
            raise ValueError("drift.metrics must be a non-empty table")
        metric_gates: dict[str, EvaluatorDriftMetricGate] = {}
        for name, raw_gate in raw_metrics.items():
            if not isinstance(name, str) or not name:
                raise ValueError("drift metric names must be non-empty strings")
            if not isinstance(raw_gate, dict) or set(raw_gate) != {"max_absolute_change"}:
                raise ValueError(
                    f"drift metric gate {name!r} must define only max_absolute_change"
                )
            tolerance = _finite_number(
                raw_gate["max_absolute_change"],
                f"drift.metrics.{name}.max_absolute_change",
            )
            if tolerance < 0:
                raise ValueError(
                    f"drift.metrics.{name}.max_absolute_change must be non-negative"
                )
            metric_gates[name] = EvaluatorDriftMetricGate(tolerance)
        return EvaluatorDriftPolicy(
            confidence=confidence,
            minimum_cases=minimum_cases,
            resamples=resamples,
            seed=seed,
            metric_gates=metric_gates,
        )
    except (OSError, tomllib.TOMLDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid evaluator drift policy {path}: {exc}") from exc


def load_sequential_policy(path: str | Path) -> SequentialPolicy:
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        raw = data["sequential"]
        if not isinstance(raw, dict):
            raise TypeError("sequential must be a table")
        expected = {
            "confidence",
            "minimum_cases",
            "minimum_repeats",
            "maximum_repeats",
            "look_every",
            "resamples",
            "seed",
            "metrics",
        }
        unknown = set(raw) - expected
        if unknown:
            raise ValueError(f"sequential has unknown fields: {sorted(unknown)}")
        confidence = _finite_number(raw["confidence"], "sequential.confidence")
        if not 0.5 < confidence < 1.0:
            raise ValueError("sequential.confidence must be greater than 0.5 and less than 1")
        minimum_cases = _positive_integer(raw["minimum_cases"], "sequential.minimum_cases")
        minimum_repeats = _positive_integer(
            raw["minimum_repeats"], "sequential.minimum_repeats"
        )
        maximum_repeats = _positive_integer(
            raw["maximum_repeats"], "sequential.maximum_repeats"
        )
        if minimum_repeats > maximum_repeats:
            raise ValueError("sequential.minimum_repeats cannot exceed maximum_repeats")
        look_every = _positive_integer(raw["look_every"], "sequential.look_every")
        resamples = _positive_integer(raw["resamples"], "sequential.resamples")
        if resamples < 100:
            raise ValueError("sequential.resamples must be at least 100")
        seed = raw["seed"]
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise TypeError("sequential.seed must be an integer")
        raw_metrics = raw["metrics"]
        if not isinstance(raw_metrics, dict) or not raw_metrics:
            raise ValueError("sequential.metrics must be a non-empty table")
        metric_gates = {
            name: _statistical_metric_gate(name, gate) for name, gate in raw_metrics.items()
        }
        return SequentialPolicy(
            confidence=confidence,
            minimum_cases=minimum_cases,
            minimum_repeats=minimum_repeats,
            maximum_repeats=maximum_repeats,
            look_every=look_every,
            resamples=resamples,
            seed=seed,
            metric_gates=metric_gates,
        )
    except (OSError, tomllib.TOMLDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid sequential policy {path}: {exc}") from exc


def _finite_number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{name} must be a number")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _positive_integer(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer")
    if value < 1:
        raise ValueError(f"{name} must be positive")
    return value


def _statistical_metric_gate(name: object, raw_gate: object) -> StatisticalMetricGate:
    if not isinstance(name, str) or not name:
        raise ValueError("statistical metric names must be non-empty strings")
    if not isinstance(raw_gate, dict):
        raise TypeError(f"statistical metric gate {name!r} must be a table")
    unknown = set(raw_gate) - {"direction", "minimum", "maximum", "max_regression"}
    if unknown:
        raise ValueError(f"statistical metric gate {name!r} has unknown fields: {sorted(unknown)}")
    direction = raw_gate["direction"]
    if direction not in {"higher", "lower"}:
        raise ValueError(f"statistical metric gate {name!r} direction must be higher or lower")
    if ("minimum" in raw_gate) == ("maximum" in raw_gate):
        raise ValueError(
            f"statistical metric gate {name!r} must define exactly one of minimum or maximum"
        )
    if direction == "higher" and "minimum" not in raw_gate:
        raise ValueError(f"higher statistical metric gate {name!r} requires minimum")
    if direction == "lower" and "maximum" not in raw_gate:
        raise ValueError(f"lower statistical metric gate {name!r} requires maximum")
    minimum = (
        _finite_number(raw_gate["minimum"], f"statistical.metrics.{name}.minimum")
        if "minimum" in raw_gate
        else None
    )
    maximum = (
        _finite_number(raw_gate["maximum"], f"statistical.metrics.{name}.maximum")
        if "maximum" in raw_gate
        else None
    )
    max_regression = _finite_number(
        raw_gate["max_regression"], f"statistical.metrics.{name}.max_regression"
    )
    if max_regression < 0:
        raise ValueError(f"statistical.metrics.{name}.max_regression must be non-negative")
    return StatisticalMetricGate(
        direction=direction,
        minimum=minimum,
        maximum=maximum,
        max_regression=max_regression,
    )
