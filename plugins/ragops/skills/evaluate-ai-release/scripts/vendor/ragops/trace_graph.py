from __future__ import annotations

import json
import math
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping

from ragops.loader import ContractError


@dataclass(frozen=True)
class TraceSpan:
    id: str
    parent_id: str | None
    kind: str
    operation: str
    started_at_ms: float
    ended_at_ms: float
    status: str
    input: dict[str, Any]
    output: dict[str, Any]
    attributes: dict[str, Any]


@dataclass(frozen=True)
class TraceGraph:
    schema_version: str
    trace_id: str
    spans: tuple[TraceSpan, ...]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ExpectedTool:
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class TraceExpectation:
    expected_tools: tuple[ExpectedTool, ...] = ()
    expected_document_ids: tuple[str, ...] = ()
    maximum_steps: int = 1


@dataclass(frozen=True)
class TraceGraphReport:
    schema_version: str
    trace_id: str
    decision: str
    metrics: dict[str, float]
    failed_gates: tuple[str, ...]
    failed_span_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def load_trace_graph(path: str | Path) -> TraceGraph:
    return trace_graph_from_dict(_read_json(path))


def load_trace_expectation(path: str | Path) -> TraceExpectation:
    data = _read_json(path)
    if not isinstance(data, dict) or set(data) != {
        "expected_tools",
        "expected_document_ids",
        "maximum_steps",
    }:
        raise ContractError("Trace expectation fields do not match the fixed contract")
    raw_tools = data["expected_tools"]
    if not isinstance(raw_tools, list):
        raise ContractError("Trace expected_tools must be an array")
    tools = []
    for index, item in enumerate(raw_tools):
        if not isinstance(item, dict) or set(item) != {"name", "arguments"}:
            raise ContractError(f"Trace expected tool {index} fields are invalid")
        if not isinstance(item["arguments"], dict):
            raise ContractError(f"Trace expected tool {index} arguments must be an object")
        tools.append(ExpectedTool(item["name"], _json_object(item["arguments"], "tool arguments")))
    document_ids = data["expected_document_ids"]
    if not isinstance(document_ids, list) or any(not isinstance(item, str) for item in document_ids):
        raise ContractError("Trace expected_document_ids must be a string array")
    expectation = TraceExpectation(tuple(tools), tuple(document_ids), data["maximum_steps"])
    _validate_expectation(expectation)
    return expectation


def trace_graph_from_dict(data: object) -> TraceGraph:
    if not isinstance(data, dict) or set(data) != {"schema_version", "trace_id", "spans", "metadata"}:
        raise ContractError("Trace graph fields do not match schema 1.0")
    if data["schema_version"] != "1.0":
        raise ContractError(f"Unsupported trace graph schema: {data['schema_version']}")
    trace_id = data["trace_id"]
    if not isinstance(trace_id, str) or not trace_id:
        raise ContractError("Trace graph trace_id must be a non-empty string")
    raw_spans = data["spans"]
    if not isinstance(raw_spans, list) or not raw_spans:
        raise ContractError("Trace graph spans must be a non-empty array")
    spans = tuple(_span_from_dict(item, index) for index, item in enumerate(raw_spans))
    identifiers = [span.id for span in spans]
    if len(set(identifiers)) != len(identifiers):
        raise ContractError("Trace span IDs must be unique")
    identifier_set = set(identifiers)
    for span in spans:
        if span.parent_id is not None and span.parent_id not in identifier_set:
            raise ContractError(f"Trace span {span.id!r} references missing parent {span.parent_id!r}")
    _reject_cycles(spans)
    roots = [span.id for span in spans if span.parent_id is None]
    if len(roots) != 1:
        raise ContractError(f"Trace graph requires exactly one root span; roots={roots}")
    return TraceGraph("1.0", trace_id, spans, _json_object(data["metadata"], "trace metadata"))


def evaluate_trace_graph(graph: TraceGraph, expectation: TraceExpectation) -> TraceGraphReport:
    _validate_expectation(expectation)
    tool_spans = tuple(span for span in graph.spans if span.kind == "tool")
    expected_names = tuple(item.name for item in expectation.expected_tools)
    actual_names = tuple(item.operation for item in tool_spans)
    expected_counts = Counter(expected_names)
    actual_counts = Counter(actual_names)
    matched_tools = sum(min(count, expected_counts[name]) for name, count in actual_counts.items())
    precision = matched_tools / len(actual_names) if actual_names else (1.0 if not expected_names else 0.0)
    recall = matched_tools / len(expected_names) if expected_names else 1.0
    argument_matches = 0
    wrong_argument_ids = []
    used_actual: set[int] = set()
    for expected in expectation.expected_tools:
        matching_index = next(
            (
                index
                for index, span in enumerate(tool_spans)
                if index not in used_actual and span.operation == expected.name
            ),
            None,
        )
        if matching_index is None:
            continue
        used_actual.add(matching_index)
        span = tool_spans[matching_index]
        arguments = span.input.get("arguments", {})
        if arguments == expected.arguments:
            argument_matches += 1
        else:
            wrong_argument_ids.append(span.id)
    argument_exactness = (
        argument_matches / len(expectation.expected_tools) if expectation.expected_tools else 1.0
    )
    ordering = 1.0 if actual_names == expected_names else 0.0
    success_rate = (
        sum(span.status == "ok" for span in tool_spans) / len(tool_spans)
        if tool_spans
        else (1.0 if not expectation.expected_tools else 0.0)
    )
    retrieved = {
        document_id
        for span in graph.spans
        if span.kind == "retrieval"
        for document_id in span.output.get("document_ids", [])
        if isinstance(document_id, str)
    }
    expected_documents = set(expectation.expected_document_ids)
    retrieval_recall = (
        len(retrieved & expected_documents) / len(expected_documents) if expected_documents else 1.0
    )
    ordered_spans = sorted(graph.spans, key=lambda span: (span.started_at_ms, span.id))
    failed_spans = [span for span in ordered_spans if span.status == "error"]
    recovered = []
    for failed in failed_spans:
        recovered.append(
            any(
                later.started_at_ms > failed.started_at_ms
                and later.operation == failed.operation
                and later.status == "ok"
                for later in ordered_spans
            )
        )
    error_recovery = sum(recovered) / len(recovered) if recovered else 1.0
    excess = max(0, len(graph.spans) - expectation.maximum_steps) / expectation.maximum_steps
    metrics = {
        "tool_name_precision": precision,
        "tool_name_recall": recall,
        "tool_argument_exactness": argument_exactness,
        "tool_ordering": ordering,
        "tool_success_rate": success_rate,
        "retrieval_document_recall": retrieval_recall,
        "error_recovery": error_recovery,
        "excess_step_ratio": float(excess),
    }
    gate_ids = {
        "tool_name_precision": "tool_names",
        "tool_name_recall": "tool_names",
        "tool_argument_exactness": "tool_arguments",
        "tool_ordering": "tool_order",
        "tool_success_rate": "tool_success",
        "retrieval_document_recall": "retrieval_documents",
        "error_recovery": "error_recovery",
        "excess_step_ratio": "excess_steps",
    }
    failed_gates = tuple(
        dict.fromkeys(
            gate_ids[name]
            for name, value in metrics.items()
            if (name == "excess_step_ratio" and value > 0.0)
            or (name != "excess_step_ratio" and value < 1.0)
        )
    )
    failed_span_ids = tuple(
        dict.fromkeys([*wrong_argument_ids, *(span.id for span in failed_spans)])
    )
    return TraceGraphReport(
        schema_version="1.0",
        trace_id=graph.trace_id,
        decision="PASS" if not failed_gates else "BLOCK",
        metrics=metrics,
        failed_gates=failed_gates,
        failed_span_ids=failed_span_ids,
    )


def _span_from_dict(value: object, index: int) -> TraceSpan:
    expected = {
        "id",
        "parent_id",
        "kind",
        "operation",
        "started_at_ms",
        "ended_at_ms",
        "status",
        "input",
        "output",
        "attributes",
    }
    if not isinstance(value, dict) or set(value) != expected:
        raise ContractError(f"Trace span {index} fields do not match schema 1.0")
    span_id = value["id"]
    if not isinstance(span_id, str) or not span_id:
        raise ContractError(f"Trace span {index} id must be non-empty")
    parent_id = value["parent_id"]
    if parent_id is not None and (not isinstance(parent_id, str) or not parent_id):
        raise ContractError(f"Trace span {span_id!r} parent_id is invalid")
    if value["kind"] not in {"agent", "llm", "tool", "retrieval", "workflow", "other"}:
        raise ContractError(f"Trace span {span_id!r} kind is invalid")
    if not isinstance(value["operation"], str) or not value["operation"]:
        raise ContractError(f"Trace span {span_id!r} operation must be non-empty")
    started = _finite(value["started_at_ms"], f"Trace span {span_id!r} started_at_ms")
    ended = _finite(value["ended_at_ms"], f"Trace span {span_id!r} ended_at_ms")
    if ended < started:
        raise ContractError(f"Trace span {span_id!r} cannot end before it starts")
    if value["status"] not in {"ok", "error", "unset"}:
        raise ContractError(f"Trace span {span_id!r} status is invalid")
    return TraceSpan(
        id=span_id,
        parent_id=parent_id,
        kind=value["kind"],
        operation=value["operation"],
        started_at_ms=started,
        ended_at_ms=ended,
        status=value["status"],
        input=_json_object(value["input"], f"Trace span {span_id!r} input"),
        output=_json_object(value["output"], f"Trace span {span_id!r} output"),
        attributes=_json_object(value["attributes"], f"Trace span {span_id!r} attributes"),
    )


def _reject_cycles(spans: tuple[TraceSpan, ...]) -> None:
    parents = {span.id: span.parent_id for span in spans}
    for identifier in parents:
        seen = set()
        current: str | None = identifier
        while current is not None:
            if current in seen:
                raise ContractError(f"Trace graph contains a parent cycle at {current!r}")
            seen.add(current)
            current = parents[current]


def _validate_expectation(expectation: TraceExpectation) -> None:
    if (
        isinstance(expectation.maximum_steps, bool)
        or not isinstance(expectation.maximum_steps, int)
        or expectation.maximum_steps <= 0
    ):
        raise ContractError("Trace maximum_steps must be a positive integer")
    if any(not item.name for item in expectation.expected_tools):
        raise ContractError("Trace expected tool names must be non-empty")
    if len(set(expectation.expected_document_ids)) != len(expectation.expected_document_ids):
        raise ContractError("Trace expected document IDs must be unique")


def _read_json(path: str | Path) -> Any:
    try:
        return json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load trace JSON from {path}: {exc}") from exc


def _json_object(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractError(f"{label} must be an object")
    try:
        return json.loads(json.dumps(dict(value), allow_nan=False))
    except (TypeError, ValueError) as exc:
        raise ContractError(f"{label} must contain finite JSON values") from exc


def _finite(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{label} must be numeric")
    number = float(value)
    if not math.isfinite(number):
        raise ContractError(f"{label} must be finite")
    return number
