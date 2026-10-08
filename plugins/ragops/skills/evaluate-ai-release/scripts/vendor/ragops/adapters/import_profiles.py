from __future__ import annotations

import math
from collections.abc import Iterable
from typing import Any

from ragops.adapter_sdk import BUILTIN_ADAPTERS, AdapterContext, AdapterOutput, discover_adapters
from ragops.loader import ContractError


def convert_import(profile: str, payload: Any, context: AdapterContext) -> AdapterOutput:
    if profile not in BUILTIN_ADAPTERS:
        descriptor = next((item for item in discover_adapters() if item.name == profile), None)
        if descriptor is None or descriptor.adapter is None:
            raise ContractError(f"Unknown adapter profile: {profile}")
        return descriptor.adapter.convert(payload, context)
    rows = _rows(profile, payload)
    by_case: dict[str, dict[str, float]] = {}
    unmapped: set[str] = set()
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ContractError(f"{profile} record {index} must be an object")
        case_id = _case_id(profile, row, index)
        if context.case_ids and case_id not in context.case_ids:
            raise ContractError(f"{profile} record {index} has unknown case ID {case_id!r}")
        metrics, ignored = _metrics(profile, row, index)
        unmapped.update(ignored)
        target = by_case.setdefault(case_id, {})
        conflicts = set(target) & set(metrics)
        if conflicts:
            raise ContractError(f"{profile} has duplicate metrics for case {case_id!r}: {sorted(conflicts)}")
        target.update(metrics)
    warnings = []
    if context.case_ids:
        missing = [case_id for case_id in context.case_ids if case_id not in by_case]
        if missing:
            warnings.append(f"missing case IDs: {', '.join(missing)}")
    records = tuple(
        {"case_id": case_id, "metrics": dict(sorted(metrics.items()))}
        for case_id, metrics in sorted(by_case.items())
    )
    return AdapterOutput(
        provider=profile,
        records=records,
        provenance={
            "producer": profile,
            "adapter_version": "1.0",
            "unmapped_fields": sorted(unmapped),
        },
        warnings=tuple(warnings),
    )


def _rows(profile: str, payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        raise ContractError(f"{profile} import must be a JSON object or array")
    keys = {
        "ragas": ("records", "data"),
        "deepeval": ("test_results", "results"),
        "phoenix": ("evaluations", "records"),
        "langsmith": ("runs", "results"),
        "mlflow": ("results", "evaluations"),
        "promptfoo": ("results",),
        "custom": ("records",),
    }[profile]
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
    raise ContractError(f"{profile} import has no supported record collection: {', '.join(keys)}")


def _case_id(profile: str, row: dict[str, Any], index: int) -> str:
    candidates: Iterable[Any]
    if profile == "promptfoo":
        variables = row.get("vars")
        candidates = (
            variables.get("case_id") if isinstance(variables, dict) else None,
            row.get("case_id"),
            row.get("id"),
        )
    else:
        candidates = (
            row.get("case_id"), row.get("reference_example_id"), row.get("request_id"),
            row.get("span_id"), row.get("name") if profile == "deepeval" else None, row.get("id"),
        )
    case_id = next((item for item in candidates if isinstance(item, str) and item), None)
    if case_id is None:
        raise ContractError(f"{profile} record {index} has no case ID")
    return case_id


def _metrics(profile: str, row: dict[str, Any], index: int) -> tuple[dict[str, float], set[str]]:
    identifier_fields = {
        "case_id", "reference_example_id", "request_id", "span_id", "id", "vars"
    }
    if profile == "deepeval":
        identifier_fields.add("name")
        raw = row.get("metrics")
        if isinstance(raw, list):
            metrics = {
                str(item.get("name")): _score(item.get("score"), profile, index)
                for item in raw
                if isinstance(item, dict) and isinstance(item.get("name"), str)
            }
            ignored = set(row) - identifier_fields - {"metrics"}
            return _nonempty(metrics, profile, index), ignored
    if profile == "phoenix" and isinstance(row.get("name"), str) and "score" in row:
        metrics = {row["name"]: _score(row["score"], profile, index)}
        ignored = set(row) - identifier_fields - {"name", "score"}
        return metrics, ignored
    if profile == "langsmith" and isinstance(row.get("feedback"), list):
        metrics = {
            str(item.get("key")): _score(item.get("score"), profile, index)
            for item in row["feedback"]
            if isinstance(item, dict) and isinstance(item.get("key"), str)
        }
        ignored = set(row) - identifier_fields - {"feedback"}
        return _nonempty(metrics, profile, index), ignored
    for container in ("metrics", "scores"):
        raw = row.get(container)
        if isinstance(raw, dict):
            metrics = {name: _score(value, profile, index) for name, value in raw.items()}
            ignored = set(row) - identifier_fields - {container}
            return _nonempty(metrics, profile, index), ignored
    metrics = {
        name: _score(value, profile, index)
        for name, value in row.items()
        if name not in identifier_fields and isinstance(value, (int, float)) and not isinstance(value, bool)
    }
    ignored = set(row) - identifier_fields - set(metrics)
    return _nonempty(metrics, profile, index), ignored


def _score(value: object, profile: str, index: int) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ContractError(f"{profile} record {index} metrics must be finite numeric values")
    return float(value)


def _nonempty(metrics: dict[str, float], profile: str, index: int) -> dict[str, float]:
    if not metrics:
        raise ContractError(f"{profile} record {index} has no metrics")
    return metrics
