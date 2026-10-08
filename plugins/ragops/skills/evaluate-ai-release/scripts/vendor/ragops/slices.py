from __future__ import annotations

from dataclasses import asdict, dataclass
from statistics import fmean
from typing import Any

from ragops.loader import ContractError
from ragops.models import CaseResult, EvalCase, EvaluationReport, Scenario


@dataclass(frozen=True)
class SliceSelector:
    name: str
    category: str | None = None
    severity: str | None = None
    language: str | None = None
    tags: tuple[str, ...] = ()

    def matches(self, case: EvalCase) -> bool:
        return (
            (self.category is None or case.category == self.category)
            and (self.severity is None or case.severity == self.severity)
            and (self.language is None or case.language == self.language)
            and all(tag in case.tags for tag in self.tags)
        )


@dataclass(frozen=True)
class SliceSummary:
    name: str
    count: int
    case_ids: tuple[str, ...]
    metrics: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def summarize_slices(
    scenario: Scenario,
    report: EvaluationReport,
    selectors: tuple[SliceSelector, ...],
) -> tuple[SliceSummary, ...]:
    if report.scenario_id != scenario.id:
        raise ContractError(
            f"Slice report scenario mismatch: {report.scenario_id!r} != {scenario.id!r}"
        )
    result_by_id = {result.case_id: result for result in report.cases}
    expected_ids = {case.id for case in scenario.cases}
    if set(result_by_id) != expected_ids:
        raise ContractError("Slice aggregation requires complete scenario case coverage")
    names = [selector.name for selector in selectors]
    if any(not name for name in names) or len(set(names)) != len(names):
        raise ContractError("Slice selector names must be non-empty and unique")
    summaries = []
    for selector in selectors:
        matched_cases = tuple(case for case in scenario.cases if selector.matches(case))
        matched_results = tuple(result_by_id[case.id] for case in matched_cases)
        metrics = _mean_metrics(matched_results) if matched_results else {}
        summaries.append(
            SliceSummary(
                name=selector.name,
                count=len(matched_cases),
                case_ids=tuple(case.id for case in matched_cases),
                metrics=metrics,
            )
        )
    return tuple(summaries)


def _mean_metrics(results: tuple[CaseResult, ...]) -> dict[str, float]:
    standard = {
        "citation_coverage": lambda item: item.citation_coverage,
        "citation_precision": lambda item: item.citation_precision,
        "lexical_groundedness": lambda item: item.lexical_groundedness,
        "latency_ms": lambda item: float(item.latency_ms),
        "cost_usd": lambda item: item.cost_usd,
        "finding_count": lambda item: float(len(item.findings)),
    }
    metrics = {name: fmean(accessor(item) for item in results) for name, accessor in standard.items()}
    custom_names = set.intersection(*(set(item.custom_metrics) for item in results))
    metrics.update(
        {
            name: fmean(item.custom_metrics[name] for item in results)
            for name in sorted(custom_names)
        }
    )
    return metrics
