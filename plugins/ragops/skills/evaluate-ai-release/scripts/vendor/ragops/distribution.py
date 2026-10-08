from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import NormalDist, fmean, median, stdev
from typing import Mapping, Sequence


@dataclass(frozen=True)
class PairedEffect:
    count: int
    mean_delta: float
    median_delta: float
    standardized_effect: float | None


def quantile(values: Sequence[float], probability: float) -> float:
    data = _finite_values(values, "quantile values")
    if isinstance(probability, bool) or not isinstance(probability, (int, float)):
        raise ValueError("quantile probability must be numeric")
    probability = float(probability)
    if not math.isfinite(probability) or not 0.0 <= probability <= 1.0:
        raise ValueError("quantile probability must be between 0 and 1")
    ordered = sorted(data)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def paired_effect(baseline: Sequence[float], candidate: Sequence[float]) -> PairedEffect:
    baseline_values = _finite_values(baseline, "baseline")
    candidate_values = _finite_values(candidate, "candidate")
    if len(baseline_values) != len(candidate_values):
        raise ValueError("Paired samples must have equal lengths")
    deltas = tuple(after - before for before, after in zip(baseline_values, candidate_values))
    mean_delta = fmean(deltas)
    standard_deviation = stdev(deltas) if len(deltas) > 1 else 0.0
    standardized = mean_delta / standard_deviation if standard_deviation > 0 else None
    return PairedEffect(len(deltas), mean_delta, median(deltas), standardized)


def holm_adjust(p_values: Mapping[str, float]) -> dict[str, float]:
    if not p_values:
        raise ValueError("Holm adjustment requires at least one p-value")
    validated = {}
    for name, value in p_values.items():
        if not isinstance(name, str) or not name:
            raise ValueError("Holm p-value names must be non-empty strings")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Holm p-value {name!r} must be numeric")
        number = float(value)
        if not math.isfinite(number) or not 0.0 <= number <= 1.0:
            raise ValueError(f"Holm p-value {name!r} must be between 0 and 1")
        validated[name] = number
    ordered = sorted(validated.items(), key=lambda item: (item[1], item[0]))
    adjusted: dict[str, float] = {}
    previous = 0.0
    count = len(ordered)
    for index, (name, value) in enumerate(ordered):
        correction = min(1.0, (count - index) * value)
        previous = max(previous, correction)
        adjusted[name] = previous
    return {name: adjusted[name] for name in p_values}


def minimum_paired_sample(effect: float, alpha: float = 0.05, power: float = 0.8) -> int:
    effect = _positive_probability_input(effect, "effect", bounded=False)
    alpha = _positive_probability_input(alpha, "alpha")
    power = _positive_probability_input(power, "power")
    z_alpha = NormalDist().inv_cdf(1.0 - alpha / 2.0)
    z_power = NormalDist().inv_cdf(power)
    return max(2, math.ceil(((z_alpha + z_power) / effect) ** 2))


def _finite_values(values: Sequence[float], label: str) -> tuple[float, ...]:
    if not values:
        raise ValueError(f"{label} must not be empty")
    result = []
    for value in values:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{label} must be numeric")
        number = float(value)
        if not math.isfinite(number):
            raise ValueError(f"{label} must be finite")
        result.append(number)
    return tuple(result)


def _positive_probability_input(value: float, label: str, *, bounded: bool = True) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be numeric")
    number = float(value)
    maximum_ok = number < 1.0 if bounded else True
    if not math.isfinite(number) or number <= 0.0 or not maximum_ok:
        suffix = " between 0 and 1" if bounded else " positive"
        raise ValueError(f"{label} must be{suffix}")
    return number
