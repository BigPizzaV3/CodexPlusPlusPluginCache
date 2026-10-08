from __future__ import annotations

from typing import Any, Iterable, Mapping

from ragops.loader import ContractError
from ragops.trace_graph import TraceGraph, trace_graph_from_dict


def otel_spans_to_trace_graph(spans: Iterable[Mapping[str, Any]]) -> TraceGraph:
    items = list(spans)
    if not items:
        raise ContractError("OpenTelemetry export contains no spans")
    trace_ids = {item.get("trace_id") for item in items}
    if len(trace_ids) != 1 or not next(iter(trace_ids)):
        raise ContractError("OpenTelemetry spans must share one non-empty trace_id")
    normalized = []
    for index, item in enumerate(items):
        if not isinstance(item, Mapping):
            raise ContractError(f"OpenTelemetry span {index} must be an object")
        attributes = item.get("attributes", {})
        if not isinstance(attributes, Mapping):
            raise ContractError(f"OpenTelemetry span {index} attributes must be an object")
        attributes = dict(attributes)
        operation_name = attributes.get("gen_ai.operation.name", "")
        kind = _kind(operation_name)
        operation = (
            attributes.get("gen_ai.tool.name")
            or attributes.get("gen_ai.agent.name")
            or item.get("name")
        )
        if not isinstance(operation, str) or not operation:
            raise ContractError(f"OpenTelemetry span {index} operation is missing")
        start = _nanoseconds(item.get("start_time_unix_nano"), index, "start")
        end = _nanoseconds(item.get("end_time_unix_nano"), index, "end")
        normalized.append(
            {
                "id": item.get("span_id"),
                "parent_id": item.get("parent_span_id") or None,
                "kind": kind,
                "operation": operation,
                "started_at_ms": start,
                "ended_at_ms": end,
                "status": _status(item.get("status")),
                "input": _input(attributes, kind),
                "output": _output(attributes, kind),
                "attributes": attributes,
            }
        )
    return trace_graph_from_dict(
        {
            "schema_version": "1.0",
            "trace_id": next(iter(trace_ids)),
            "spans": normalized,
            "metadata": {
                "adapter": "otel-genai",
                "adapter_version": "1.0",
                "semantic_convention_stability": "development",
            },
        }
    )


def _kind(operation: object) -> str:
    if operation == "execute_tool":
        return "tool"
    if operation == "retrieval":
        return "retrieval"
    if operation == "invoke_agent":
        return "agent"
    if operation == "invoke_workflow":
        return "workflow"
    return "llm" if operation in {"chat", "text_completion", "generate_content"} else "other"


def _input(attributes: dict[str, Any], kind: str) -> dict[str, Any]:
    result = {}
    if "gen_ai.input.messages" in attributes:
        result["messages"] = attributes["gen_ai.input.messages"]
    if kind == "tool" and "gen_ai.tool.call.arguments" in attributes:
        result["arguments"] = attributes["gen_ai.tool.call.arguments"]
    if kind == "retrieval" and "gen_ai.retrieval.query" in attributes:
        result["query"] = attributes["gen_ai.retrieval.query"]
    return result


def _output(attributes: dict[str, Any], kind: str) -> dict[str, Any]:
    result = {}
    if "gen_ai.output.messages" in attributes:
        result["messages"] = attributes["gen_ai.output.messages"]
    if kind == "tool" and "gen_ai.tool.call.result" in attributes:
        result["result"] = attributes["gen_ai.tool.call.result"]
    documents = attributes.get("gen_ai.retrieval.documents")
    if kind == "retrieval" and isinstance(documents, list):
        result["document_ids"] = documents
    return result


def _status(value: object) -> str:
    if isinstance(value, Mapping):
        value = value.get("code")
    normalized = str(value or "").casefold()
    if "error" in normalized:
        return "error"
    if "ok" in normalized:
        return "ok"
    return "unset"


def _nanoseconds(value: object, index: int, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        raise ContractError(f"OpenTelemetry span {index} {label} timestamp is invalid")
    return float(value) / 1_000_000
