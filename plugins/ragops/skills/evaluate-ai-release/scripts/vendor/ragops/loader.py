from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from ragops.models import (
    AttackCase,
    AttackPack,
    EvalCase,
    RecordedResponse,
    RedTeamPolicy,
    Scenario,
    Thresholds,
)


class ContractError(ValueError):
    """Raised when a scenario or response file violates the v0.1 contract."""


def _read_json(path: str | Path) -> Any:
    try:
        return json.loads(
            Path(path).read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(
                ValueError(f"non-finite JSON number {value}")
            ),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ContractError(f"Cannot load JSON from {path}: {exc}") from exc


def load_scenario(path: str | Path) -> Scenario:
    return scenario_from_dict(_read_json(path))


def scenario_from_dict(data: dict[str, Any]) -> Scenario:
    try:
        threshold_data = data["thresholds"]
        thresholds = Thresholds(
            citation_coverage=threshold_data["citation_coverage"],
            lexical_groundedness=threshold_data["lexical_groundedness"],
            max_latency_ms=threshold_data["max_latency_ms"],
            max_cost_usd=threshold_data["max_cost_usd"],
            citation_precision=threshold_data.get("citation_precision", 0.0),
        )
        redteam = RedTeamPolicy(
            forbidden_output_terms=tuple(data.get("redteam", {}).get("forbidden_output_terms", [])),
            require_human_approval_for_external_actions=data.get("redteam", {}).get(
                "require_human_approval_for_external_actions", True
            ),
            external_action_markers=tuple(
                data.get("redteam", {}).get(
                    "external_action_markers", ["sent email", "created ticket", "deleted"]
                )
            ),
        )
        cases = tuple(
            EvalCase(
                id=item["id"],
                question=item["question"],
                evidence=tuple(item["evidence"]),
                required_citation_ids=tuple(item["required_citation_ids"]),
                category=item.get("category", "unspecified"),
                severity=item.get("severity", "medium"),
                language=item.get("language", "und"),
                tags=tuple(item.get("tags", [])),
                attack_category=item.get("attack_category"),
            )
            for item in data["cases"]
        )
        scenario = Scenario(
            schema_version=data["schema_version"],
            id=data["id"],
            name=data["name"],
            thresholds=thresholds,
            redteam=redteam,
            cases=cases,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid scenario contract: {exc}") from exc

    if scenario.schema_version not in {"0.1", "0.2"}:
        raise ContractError(f"Unsupported scenario schema: {scenario.schema_version}")
    if not scenario.cases or len({case.id for case in scenario.cases}) != len(scenario.cases):
        raise ContractError("Scenario needs at least one case and case IDs must be unique")
    _ratio(scenario.thresholds.citation_coverage, "thresholds.citation_coverage")
    _ratio(scenario.thresholds.citation_precision, "thresholds.citation_precision")
    _ratio(scenario.thresholds.lexical_groundedness, "thresholds.lexical_groundedness")
    _nonnegative_integer(scenario.thresholds.max_latency_ms, "thresholds.max_latency_ms")
    _nonnegative_number(scenario.thresholds.max_cost_usd, "thresholds.max_cost_usd")
    return scenario


def load_responses(path: str | Path) -> tuple[RecordedResponse, ...]:
    responses = _load_response_fixture(Path(path), seen=set())
    _validate_response_numbers(responses)
    return responses


def _load_response_fixture(path: Path, *, seen: set[Path]) -> tuple[RecordedResponse, ...]:
    resolved = path.resolve()
    if resolved in seen:
        raise ContractError(f"Response fixture cycle detected at {path}")
    data = _read_json(path)
    if isinstance(data, list):
        return responses_from_data(data)
    if not isinstance(data, dict) or data.get("schema_version") != "0.2":
        raise ContractError("Response fixture must be a response list or schema version 0.2")
    try:
        base_path = path.parent / data["extends"]
        base = _load_response_fixture(base_path, seen=seen | {resolved})
        override_items = data.get("overrides", [])
        overrides = {item["case_id"]: item for item in override_items}
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid response fixture contract: {exc}") from exc
    if len(overrides) != len(override_items):
        raise ContractError("Response fixture override case IDs must be unique")
    base_ids = {response.case_id for response in base}
    unknown = sorted(set(overrides) - base_ids)
    if unknown:
        raise ContractError(f"Response fixture has unknown override case IDs: {unknown}")
    return tuple(_apply_response_override(response, overrides.get(response.case_id)) for response in base)


def _apply_response_override(
    response: RecordedResponse, override: dict[str, Any] | None
) -> RecordedResponse:
    if override is None:
        return response
    allowed = {
        "case_id",
        "answer",
        "citation_ids",
        "latency_ms",
        "cost_usd",
        "human_approved",
        "retrieved_ids",
        "metadata",
    }
    unknown = set(override) - allowed
    if unknown:
        raise ContractError(f"Unknown response override fields: {sorted(unknown)}")
    return RecordedResponse(
        case_id=response.case_id,
        answer=override.get("answer", response.answer),
        citation_ids=tuple(override.get("citation_ids", response.citation_ids)),
        latency_ms=override.get("latency_ms", response.latency_ms),
        cost_usd=override.get("cost_usd", response.cost_usd),
        human_approved=override.get("human_approved", response.human_approved),
        retrieved_ids=tuple(override.get("retrieved_ids", response.retrieved_ids)),
        metadata=override.get("metadata", response.metadata),
    )


def load_attack_pack(path: str | Path) -> AttackPack:
    data = _read_json(path)
    try:
        attacks = tuple(
            AttackCase(
                id=item["id"],
                category=item["category"],
                input_text=item["input_text"],
                expected_rule=item["expected_rule"],
                severity=item["severity"],
                tags=tuple(item.get("tags", [])),
            )
            for item in data["attacks"]
        )
        pack = AttackPack(
            schema_version=data["schema_version"],
            id=data["id"],
            name=data["name"],
            attacks=attacks,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid attack-pack contract: {exc}") from exc
    if pack.schema_version != "0.1":
        raise ContractError(f"Unsupported attack-pack schema: {pack.schema_version}")
    if not pack.attacks or len({attack.id for attack in pack.attacks}) != len(pack.attacks):
        raise ContractError("Attack pack needs at least one attack and IDs must be unique")
    allowed_severities = {"low", "medium", "high", "critical"}
    if any(attack.severity not in allowed_severities for attack in pack.attacks):
        raise ContractError("Attack severity must be low, medium, high, or critical")
    return pack


def responses_from_data(data: list[dict[str, Any]]) -> tuple[RecordedResponse, ...]:
    try:
        responses = tuple(
            RecordedResponse(
                case_id=item["case_id"],
                answer=item["answer"],
                citation_ids=tuple(item.get("citation_ids", [])),
                latency_ms=item["latency_ms"],
                cost_usd=item["cost_usd"],
                human_approved=item.get("human_approved", False),
                retrieved_ids=tuple(item.get("retrieved_ids", [])),
                metadata=item.get("metadata", {}),
            )
            for item in data
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid response contract: {exc}") from exc
    if len({response.case_id for response in responses}) != len(responses):
        raise ContractError("Response case IDs must be unique")
    _validate_response_numbers(responses)
    return responses


def _validate_response_numbers(responses: tuple[RecordedResponse, ...]) -> None:
    for index, response in enumerate(responses):
        _nonnegative_integer(response.latency_ms, f"responses[{index}].latency_ms")
        _nonnegative_number(response.cost_usd, f"responses[{index}].cost_usd")


def _finite_number(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{name} must be a number")
    result = float(value)
    if not math.isfinite(result):
        raise ContractError(f"{name} must be finite")
    return result


def _ratio(value: object, name: str) -> None:
    result = _finite_number(value, name)
    if not 0 <= result <= 1:
        raise ContractError(f"{name} must be between 0 and 1")


def _nonnegative_number(value: object, name: str) -> None:
    if _finite_number(value, name) < 0:
        raise ContractError(f"{name} must be non-negative")


def _nonnegative_integer(value: object, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ContractError(f"{name} must be an integer")
    if value < 0:
        raise ContractError(f"{name} must be non-negative")
