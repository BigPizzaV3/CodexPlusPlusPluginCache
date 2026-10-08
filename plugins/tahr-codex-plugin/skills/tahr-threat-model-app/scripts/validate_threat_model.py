#!/usr/bin/env python3
"""Validate a canonical full-mode Tahr application threat model."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Optional, Sequence, Union
from urllib.parse import urlparse


SCHEMA_PATH = Path(__file__).resolve().parent.parent / "assets" / "threat-model.schema.json"
SECTION_IDS = {
    "evidence": ("evidence_id", "EVD-"),
    "entities": ("entity_id", None),
    "boundaries": ("boundary_id", "BOUNDARY-"),
    "flows": ("flow_id", "FLOW-"),
    "invariants": ("invariant_id", "INV-"),
    "controls": ("control_id", "CONTROL-"),
    "threats": ("threat_id", "THREAT-"),
    "attack_paths": ("attack_path_id", "PATH-"),
    "decisions": ("decision_id", "DEC-"),
    "validation_tests": ("test_id", "TEST-"),
    "questions": ("question_id", "Q-"),
}
ENTITY_PREFIX = {
    "actor": "ACTOR-",
    "principal": "PRINCIPAL-",
    "asset": "ASSET-",
    "component": "COMP-",
    "entrypoint": "ENTRYPOINT-",
    "trust_zone": "ZONE-",
    "data_store": "STORE-",
    "integration": "INTEGRATION-",
}
NESTED_ID_PREFIX = {
    "claim_id": "CLAIM-",
    "hop_id": "HOP-",
    "option_id": "OPTION-",
    "signal_id": "SIGNAL-",
    "category_id": "DATA-",
    "analysis_id": "ANALYSIS-",
    "finding_id": "QF-",
    "gate_id": "GATE-",
}
RUNTIME_EVIDENCE = {"runtime_observation", "test_result"}
OBSERVED_EVIDENCE = {"source_code", "configuration", "infrastructure_as_code", "repository_manifest", *RUNTIME_EVIDENCE}
INTENDED_EVIDENCE = {"api_specification", "design_document", "diagram", "role_matrix", "policy", "interview"}
QUALITY_GATES = {"scope_and_evidence", "architecture_inventory", "flow_completeness", "contradiction", "material_threat", "attack_path", "risk_ranking", "privacy_applicability", "ai_applicability", "validation_safety", "coverage"}
TARGET_SKILLS = {
    "tahr-map-attack-surface",
    "tahr-test-authentication",
    "tahr-test-access-control",
    "tahr-trace-dangerous-inputs",
    "tahr-test-business-workflows",
    "tahr-audit-secrets-config",
    "tahr-test-ai-agents",
    "tahr-audit-android",
    "tahr-verify-security-fix",
}
PLACEHOLDER_OWNERS = {"", "unknown", "tbd", "todo", "unassigned", "none", "n/a"}
GENERIC_SIGNALS = {
    "pass",
    "fail",
    "success",
    "failure",
    "works",
    "does not work",
    "as expected",
    "expected behavior",
    "observe behavior",
    "observe result",
    "check result",
    "check whether it works",
    "check whether it worked",
    "verify whether it works",
    "verify whether it worked",
    "confirm it works",
    "confirm it worked",
}
FORBIDDEN_WORDING = (
    re.compile(r"\b(?:the\s+)?(?:application|system|service|product)\s+is\s+secure\b", re.I),
    re.compile(r"\bno\s+(?:security\s+)?vulnerabilit(?:y|ies)\b", re.I),
    re.compile(r"\bconfirmed\s+(?:vulnerability|exploit|exploitation)\b", re.I),
    re.compile(r"\bverified\s+(?:vulnerability|exploit|exploitation)\b", re.I),
    re.compile(r"\bwe\s+(?:successfully\s+)?exploited\b", re.I),
)
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bxox[abprs]-[0-9A-Za-z-]{20,}\b"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{20,}", re.I),
    re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b"),
)


@dataclass(frozen=True)
class Diagnostic:
    code: str
    path: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)

    def format(self, level: str) -> str:
        where = f" at {self.path}" if self.path else ""
        return f"{level}: [{self.code}]{where}: {self.message}"


def _add(items: list[Diagnostic], code: str, path: str, message: str) -> None:
    items.append(Diagnostic(code, path, message))


def _iter(value: Any, path: str = "") -> Iterator[tuple[str, Any]]:
    yield path, value
    if isinstance(value, dict):
        for key, child in value.items():
            yield from _iter(child, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _iter(child, f"{path}[{index}]")


def _claim_text(value: Any) -> str:
    if isinstance(value, dict) and isinstance(value.get("statement"), str):
        return " ".join(value["statement"].split())
    if isinstance(value, str):
        return " ".join(value.split())
    return ""


def _ids(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def _in(value: Any, allowed: set[str]) -> bool:
    return isinstance(value, str) and value in allowed


def _dict_rows(value: Any) -> list[dict[str, Any]]:
    return [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []


def reference_ids(record: dict[str, Any], fields: Sequence[str]) -> list[str]:
    result: list[str] = []
    for field in fields:
        for identifier in _ids(record.get(field)):
            if identifier not in result:
                result.append(identifier)
    return result


def record_identifier(section: str, record: dict[str, Any]) -> Optional[str]:
    if section == "coverage":
        value = record.get("coverage_id")
    else:
        field = SECTION_IDS.get(section, ("id", None))[0]
        value = record.get(field)
    return value if isinstance(value, str) and value else None


def records_for_section(section: str, value: Any) -> list[dict[str, Any]]:
    if section == "coverage" and isinstance(value, dict):
        value = value.get("items")
    return [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []


@lru_cache(maxsize=1)
def _schema() -> dict[str, Any]:
    with SCHEMA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _resolve_ref(root: dict[str, Any], ref: str) -> dict[str, Any]:
    if not ref.startswith("#/"):
        raise ValueError(f"unsupported schema reference {ref}")
    node: Any = root
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def _type_matches(value: Any, expected: str) -> bool:
    return {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "number": isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
        "null": value is None,
    }.get(expected, True)


def _schema_check(value: Any, schema: dict[str, Any], root: dict[str, Any], path: str, errors: list[Diagnostic]) -> None:
    if "$ref" in schema:
        _schema_check(value, _resolve_ref(root, schema["$ref"]), root, path, errors)
        return
    for child in schema.get("allOf", []):
        _schema_check(value, child, root, path, errors)
    if "if" in schema:
        probe: list[Diagnostic] = []
        _schema_check(value, schema["if"], root, path, probe)
        branch = schema.get("then") if not probe else schema.get("else")
        if branch:
            _schema_check(value, branch, root, path, errors)
    expected = schema.get("type")
    if expected and not _type_matches(value, expected):
        _add(errors, "schema.type", path, f"must be {expected}")
        return
    if "const" in schema and value != schema["const"]:
        _add(errors, "schema.const", path, f"must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        _add(errors, "schema.enum", path, f"must be one of: {', '.join(map(str, schema['enum']))}")
    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                _add(errors, "schema.required", f"{path}.{key}" if path else key, "is required")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    _add(errors, "schema.additional_property", f"{path}.{key}" if path else key, "is not allowed")
        for key, child in properties.items():
            if key in value:
                _schema_check(value[key], child, root, f"{path}.{key}" if path else key, errors)
    elif isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            _add(errors, "schema.min_items", path, f"requires at least {schema['minItems']} item(s)")
        if schema.get("uniqueItems"):
            canonical = [json.dumps(item, sort_keys=True, separators=(",", ":")) for item in value]
            if len(canonical) != len(set(canonical)):
                _add(errors, "schema.unique_items", path, "must not contain duplicates")
        if "items" in schema:
            for index, child in enumerate(value):
                _schema_check(child, schema["items"], root, f"{path}[{index}]", errors)
        if "contains" in schema:
            if not any(not _schema_probe(item, schema["contains"], root) for item in value):
                _add(errors, "schema.contains", path, "does not contain a required matching item")
        if "not" in schema and not _schema_probe(value, schema["not"], root):
            _add(errors, "schema.not", path, "matches a forbidden schema")
    elif isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            _add(errors, "schema.min_length", path, "must be non-empty")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            _add(errors, "schema.max_length", path, f"must be at most {schema['maxLength']} characters")
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            _add(errors, "schema.pattern", path, "has an invalid format")
        if schema.get("format") == "date-time":
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    raise ValueError("timezone required")
            except ValueError:
                _add(errors, "schema.format", path, "must be an RFC 3339 date-time")
        elif schema.get("format") == "date":
            try:
                date.fromisoformat(value)
            except ValueError:
                _add(errors, "schema.format", path, "must be an ISO date")
        elif schema.get("format") == "uri" and not urlparse(value).scheme:
            _add(errors, "schema.format", path, "must be an absolute URI")
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            _add(errors, "schema.minimum", path, f"must be at least {schema['minimum']}")
    if "not" in schema and not isinstance(value, list) and not _schema_probe(value, schema["not"], root):
        _add(errors, "schema.not", path, "matches a forbidden schema")


def _schema_probe(value: Any, schema: dict[str, Any], root: dict[str, Any]) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    _schema_check(value, schema, root, "", result)
    return result


def _check_ref(errors: list[Diagnostic], path: str, refs: Any, valid: set[str], label: str) -> None:
    for ref in _ids(refs):
        if ref not in valid:
            _add(errors, "reference.unknown", path, f"unknown {label} id {ref}")


def _owner_is_named(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() not in PLACEHOLDER_OWNERS


def _signal_is_clear(signal: dict[str, Any]) -> bool:
    observation = re.sub(r"[^a-z0-9]+", " ", str(signal.get("observation", "")).lower()).strip()
    interpretation = re.sub(r"[^a-z0-9]+", " ", str(signal.get("interpretation", "")).lower()).strip()
    return len(observation) >= 8 and len(interpretation) >= 8 and observation not in GENERIC_SIGNALS and interpretation not in GENERIC_SIGNALS


def _risk_rating(record: dict[str, Any]) -> str:
    risk = record.get("risk")
    return str(risk.get("rating", "")) if isinstance(risk, dict) else ""


def validate_model(data: Any) -> tuple[list[Diagnostic], list[Diagnostic]]:
    errors: list[Diagnostic] = []
    warnings: list[Diagnostic] = []
    if not isinstance(data, dict):
        return [Diagnostic("schema.type", "", "top level must be an object")], warnings
    try:
        schema = _schema()
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
        return [Diagnostic("schema.unavailable", str(SCHEMA_PATH), str(exc))], warnings
    _schema_check(data, schema, schema, "", errors)

    # Build canonical record maps even when schema errors exist so diagnostics remain useful.
    records = {section: records_for_section(section, data.get(section)) for section in SECTION_IDS}
    records["coverage"] = records_for_section("coverage", data.get("coverage"))
    maps: dict[str, dict[str, dict[str, Any]]] = {}
    seen: dict[str, str] = {}
    entity_types: dict[str, set[str]] = {kind: set() for kind in ENTITY_PREFIX}

    def define(identifier: Any, path: str, prefix: Optional[str] = None) -> None:
        if not isinstance(identifier, str) or not identifier:
            return
        if prefix and not identifier.startswith(prefix):
            _add(errors, "id.prefix", path, f"must start with {prefix}")
        if identifier in seen:
            _add(errors, "id.duplicate", path, f"duplicates id first defined at {seen[identifier]}")
        else:
            seen[identifier] = path

    for section, rows in records.items():
        maps[section] = {}
        id_field, prefix = ("coverage_id", "COV-") if section == "coverage" else SECTION_IDS[section]
        for index, row in enumerate(rows):
            path = f"coverage.items[{index}]" if section == "coverage" else f"{section}[{index}]"
            identifier = row.get(id_field)
            actual_prefix = prefix
            if section == "entities":
                actual_prefix = ENTITY_PREFIX.get(str(row.get("type")))
                if actual_prefix is None:
                    _add(errors, "entity.type", f"{path}.type", "has no canonical identifier prefix")
            define(identifier, f"{path}.{id_field}", actual_prefix)
            if isinstance(identifier, str):
                maps[section][identifier] = row
                if section == "entities" and _in(row.get("type"), set(entity_types)):
                    entity_types[row["type"]].add(identifier)

    for path, node in _iter(data):
        if not isinstance(node, dict):
            continue
        for key, prefix in NESTED_ID_PREFIX.items():
            if key in node:
                define(node[key], f"{path}.{key}", prefix)

    evidence_ids = set(maps.get("evidence", {}))
    evidence_by_id = maps.get("evidence", {})
    for path, node in _iter(data):
        if not isinstance(node, dict) or "claim_id" not in node:
            continue
        refs = node.get("evidence_ids", [])
        _check_ref(errors, f"{path}.evidence_ids", refs, evidence_ids, "evidence")
        evidence_class = node.get("evidence_class")
        cited = [evidence_by_id[ref] for ref in _ids(refs) if ref in evidence_by_id]
        if _in(evidence_class, {"observed", "intended"}) and not cited:
            _add(errors, "evidence.claim_unproven", path, f"{evidence_class} claim requires evidence")
        if evidence_class == "observed" and cited and not any(item.get("evidence_class") == "observed" and _in(item.get("source_type"), OBSERVED_EVIDENCE) for item in cited):
            _add(errors, "evidence.observed_mismatch", path, "observed claim must cite observed source/config/IaC/runtime evidence")
        if evidence_class == "intended" and cited and not any(item.get("evidence_class") == "intended" and _in(item.get("source_type"), INTENDED_EVIDENCE) for item in cited):
            _add(errors, "evidence.intended_mismatch", path, "intended claim must cite intended specification, design, diagram, role, policy, or interview evidence")
        if evidence_class == "unknown" and cited and not any(item.get("evidence_class") == "unknown" for item in cited):
            _add(errors, "evidence.unknown_mismatch", path, "unknown claim must cite an unknown evidence record naming the missing evidence")

    entities = set(maps.get("entities", {})); assets = entity_types["asset"]
    actors = entity_types["actor"] | entity_types["principal"]
    zones = entity_types["trust_zone"]; entrypoints = entity_types["entrypoint"]
    boundaries = set(maps.get("boundaries", {})); flows = set(maps.get("flows", {}))
    invariants = set(maps.get("invariants", {})); controls = set(maps.get("controls", {}))
    threats = set(maps.get("threats", {})); decisions = set(maps.get("decisions", {}))
    tests = set(maps.get("validation_tests", {})); questions = set(maps.get("questions", {}))
    all_top_ids = set().union(*(set(section_map) for section_map in maps.values()))
    coverage_subject_ids = all_top_ids - evidence_ids - set(maps.get("coverage", {}))
    metadata_record = data.get("metadata", {}) if isinstance(data.get("metadata"), dict) else {}
    runtime_authorization = metadata_record.get("runtime_authorization", {})
    global_runtime_status = runtime_authorization.get("status") if isinstance(runtime_authorization, dict) else None
    global_runtime_targets = set(_ids(runtime_authorization.get("targets"))) if isinstance(runtime_authorization, dict) else set()

    summary = data.get("executive_summary", {})
    if isinstance(summary, dict):
        _check_ref(errors, "executive_summary.highest_risk_threat_ids", summary.get("highest_risk_threat_ids"), threats, "threat")
        _check_ref(errors, "executive_summary.priority_decision_ids", summary.get("priority_decision_ids"), decisions, "decision")
    for index, row in enumerate(records.get("entities", [])):
        _check_ref(errors, f"entities[{index}].zone_id", row.get("zone_id"), zones, "zone")
        _check_ref(errors, f"entities[{index}].related_entity_ids", row.get("related_entity_ids"), entities, "entity")
    entity_zones = {identifier: row.get("zone_id") for identifier, row in maps.get("entities", {}).items() if isinstance(row.get("zone_id"), str)}
    boundary_zones: dict[str, tuple[str, str, str]] = {}
    for index, row in enumerate(records.get("boundaries", [])):
        path = f"boundaries[{index}]"
        _check_ref(errors, f"{path}.from_zone_id", row.get("from_zone_id"), zones, "zone")
        _check_ref(errors, f"{path}.to_zone_id", row.get("to_zone_id"), zones, "zone")
        _check_ref(errors, f"{path}.asset_ids", row.get("asset_ids"), assets, "asset")
        _check_ref(errors, f"{path}.control_ids", row.get("control_ids"), controls, "control")
        if isinstance(row.get("boundary_id"), str) and isinstance(row.get("from_zone_id"), str) and isinstance(row.get("to_zone_id"), str):
            boundary_zones[row["boundary_id"]] = (row["from_zone_id"], row["to_zone_id"], str(row.get("direction", "")))

    flow_hops: dict[str, tuple[str, str, str, str]] = {}
    flow_hop_assets: dict[str, set[str]] = {}
    flow_entrypoints: dict[str, set[str]] = {}
    flow_actors: dict[str, set[str]] = {}
    for index, row in enumerate(records.get("flows", [])):
        path = f"flows[{index}]"; flow_id = str(row.get("flow_id", ""))
        _check_ref(errors, f"{path}.actor_ids", row.get("actor_ids"), actors, "actor/principal")
        _check_ref(errors, f"{path}.asset_ids", row.get("asset_ids"), assets, "asset")
        _check_ref(errors, f"{path}.entrypoint_entity_ids", row.get("entrypoint_entity_ids"), entrypoints, "entrypoint")
        _check_ref(errors, f"{path}.unresolved_question_ids", row.get("unresolved_question_ids"), questions, "question")
        previous_to = None
        hop_rows = _dict_rows(row.get("hops"))
        chain_entities: set[str] = set()
        chain_assets: set[str] = set()
        for hop_index, hop in enumerate(hop_rows):
            hp = f"{path}.hops[{hop_index}]"
            _check_ref(errors, f"{hp}.from_entity_id", hop.get("from_entity_id"), entities, "entity")
            _check_ref(errors, f"{hp}.to_entity_id", hop.get("to_entity_id"), entities, "entity")
            _check_ref(errors, f"{hp}.boundary_id", hop.get("boundary_id"), boundaries, "boundary")
            _check_ref(errors, f"{hp}.data_asset_ids", hop.get("data_asset_ids"), assets, "asset")
            _check_ref(errors, f"{hp}.control_ids", hop.get("control_ids"), controls, "control")
            from_entity = hop.get("from_entity_id"); to_entity = hop.get("to_entity_id")
            if isinstance(from_entity, str):
                chain_entities.add(from_entity)
            if isinstance(to_entity, str):
                chain_entities.add(to_entity)
            chain_assets.update(_ids(hop.get("data_asset_ids")))
            endpoint_zones = (entity_zones.get(from_entity) if isinstance(from_entity, str) else None, entity_zones.get(to_entity) if isinstance(to_entity, str) else None)
            declared_zones = boundary_zones.get(hop.get("boundary_id")) if isinstance(hop.get("boundary_id"), str) else None
            if all(isinstance(zone, str) for zone in endpoint_zones) and declared_zones:
                direct = endpoint_zones == declared_zones[:2]
                reverse = declared_zones[2] == "bidirectional" and endpoint_zones == tuple(reversed(declared_zones[:2]))
                if not direct and not reverse:
                    _add(errors, "flow.boundary_mismatch", f"{hp}.boundary_id", f"boundary zones {declared_zones[0]}→{declared_zones[1]} do not match entity zones {endpoint_zones[0]}→{endpoint_zones[1]}")
            if hop.get("sequence") != hop_index + 1:
                _add(errors, "flow.sequence", f"{hp}.sequence", f"must equal {hop_index + 1}")
            if previous_to is not None and hop.get("from_entity_id") != previous_to:
                _add(errors, "flow.disconnected", hp, "does not continue from the previous flow hop")
            previous_to = hop.get("to_entity_id")
            if isinstance(hop.get("hop_id"), str):
                flow_hops[hop["hop_id"]] = (flow_id, str(hop.get("boundary_id", "")), str(hop.get("from_entity_id", "")), str(hop.get("to_entity_id", "")))
                flow_hop_assets[hop["hop_id"]] = set(_ids(hop.get("data_asset_ids")))
        declared_actors = set(_ids(row.get("actor_ids")))
        declared_entrypoints = set(_ids(row.get("entrypoint_entity_ids")))
        declared_assets = set(_ids(row.get("asset_ids")))
        chain_entrypoints = chain_entities & entrypoints
        first_source = hop_rows[0].get("from_entity_id") if hop_rows else None
        if first_source in actors and first_source not in declared_actors:
            _add(errors, "flow.initiating_actor", f"{path}.actor_ids", "must include the first hop's initiating actor or principal")
        if declared_entrypoints != chain_entrypoints:
            _add(errors, "flow.entrypoint_chain", f"{path}.entrypoint_entity_ids", f"must exactly match entrypoints in the hop chain: {', '.join(sorted(chain_entrypoints)) or 'none'}")
        if declared_assets != chain_assets:
            _add(errors, "flow.asset_chain", f"{path}.asset_ids", f"must exactly match assets carried by the hop chain: {', '.join(sorted(chain_assets)) or 'none'}")
        flow_entrypoints[flow_id] = declared_entrypoints
        flow_actors[flow_id] = declared_actors

    link_specs = {
        "invariants": (("asset_ids", assets), ("flow_ids", flows), ("threat_ids", threats), ("control_ids", controls), ("validation_test_ids", tests)),
        "controls": (("entity_ids", entities), ("flow_ids", flows), ("invariant_ids", invariants), ("threat_ids", threats), ("validation_test_ids", tests)),
        "decisions": (("threat_ids", threats), ("invariant_ids", invariants), ("control_ids", controls), ("flow_ids", flows), ("validation_test_ids", tests)),
    }
    for section, specs in link_specs.items():
        for index, row in enumerate(records.get(section, [])):
            for field, valid in specs:
                _check_ref(errors, f"{section}[{index}].{field}", row.get(field), valid, field[:-4])
            if section == "decisions" and row.get("selected_option_id") is not None:
                own_options = {item.get("option_id") for item in _dict_rows(row.get("options")) if isinstance(item.get("option_id"), str)}
                if not isinstance(row.get("selected_option_id"), str) or row.get("selected_option_id") not in own_options:
                    _add(errors, "decision.selected_option", f"{section}[{index}].selected_option_id", "must reference an option in this decision")
            if section == "decisions" and _in(row.get("status"), {"approved", "in_progress", "implemented", "accepted"}) and not isinstance(row.get("selected_option_id"), str):
                _add(errors, "decision.selection_required", f"{section}[{index}].selected_option_id", "approved or later decision requires a selected option")

    test_threats: dict[str, set[str]] = {}
    for index, row in enumerate(records.get("validation_tests", [])):
        path = f"validation_tests[{index}]"; test_id = str(row.get("test_id", ""))
        test_threats[test_id] = set(_ids(row.get("threat_ids")))
        for field, valid in (("threat_ids", threats), ("invariant_ids", invariants), ("actor_id", actors), ("asset_ids", assets), ("boundary_ids", boundaries), ("flow_ids", flows)):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, field.rstrip("_ids"))
        control_case = row.get("control_case", {})
        if isinstance(control_case, dict):
            _check_ref(errors, f"{path}.control_case.expected_control_ids", control_case.get("expected_control_ids"), controls, "control")
        signal_groups = []
        baseline = row.get("baseline", {}); attacker = row.get("attacker_case", {}); cleanup = row.get("cleanup", {})
        if isinstance(baseline, dict): signal_groups.append((f"{path}.baseline.expected_signals", baseline.get("expected_signals", [])))
        if isinstance(attacker, dict):
            signal_groups += [(f"{path}.attacker_case.attacker_success_signal", attacker.get("attacker_success_signal")), (f"{path}.attacker_case.expected_denial_signal", attacker.get("expected_denial_signal"))]
        if isinstance(control_case, dict):
            signal_groups += [(f"{path}.control_case.control_success_signal", control_case.get("control_success_signal")), (f"{path}.control_case.control_failure_signal", control_case.get("control_failure_signal"))]
        if isinstance(cleanup, dict): signal_groups.append((f"{path}.cleanup.verification_signals", cleanup.get("verification_signals", [])))
        for group_path, group in signal_groups:
            signals = [(f"{group_path}[{index}]", signal) for index, signal in enumerate(group)] if isinstance(group, list) else [(group_path, group)]
            for signal_path, signal in signals:
                if isinstance(signal, dict) and not _signal_is_clear(signal):
                    _add(errors, "test.ambiguous_signal", signal_path, "observation and interpretation must be specific and observable")
        if isinstance(attacker, dict) and isinstance(control_case, dict):
            success = " ".join(str(attacker.get("attacker_success_signal", {}).get("observation", "")).lower().split()) if isinstance(attacker.get("attacker_success_signal"), dict) else ""
            enforcement = " ".join(str(control_case.get("control_success_signal", {}).get("observation", "")).lower().split()) if isinstance(control_case.get("control_success_signal"), dict) else ""
            if success and success == enforcement:
                _add(errors, "test.signals_not_discriminating", path, "attacker-success and control-success observations must differ")
        execution_status = row.get("execution_status")
        result = row.get("result")
        signal_ids = {node["signal_id"] for _, node in _iter(row) if isinstance(node, dict) and isinstance(node.get("signal_id"), str)}
        if isinstance(result, dict):
            _check_ref(errors, f"{path}.result.observed_signal_ids", result.get("observed_signal_ids"), signal_ids, "test signal")
            _check_ref(errors, f"{path}.result.evidence_ids", result.get("evidence_ids"), evidence_ids, "evidence")
            direct_result_evidence = set(_ids(result.get("evidence_ids")))
            result_summary = result.get("summary", {})
            summary_evidence = set(_ids(result_summary.get("evidence_ids"))) if isinstance(result_summary, dict) else set()
            if not summary_evidence.issubset(direct_result_evidence):
                _add(errors, "test.result_evidence_mismatch", f"{path}.result.summary.evidence_ids", "must be a subset of result.evidence_ids")
        expected_outcome = {"passed": "control_held", "failed": "control_failed", "inconclusive": "inconclusive"}.get(execution_status)
        if expected_outcome and (not isinstance(result, dict) or result.get("outcome") != expected_outcome):
            _add(errors, "test.result_outcome", f"{path}.result.outcome", f"{execution_status} execution requires outcome={expected_outcome}")
        if isinstance(result, dict) and _in(execution_status, {"passed", "failed", "inconclusive"}):
            observed_signal_ids = set(_ids(result.get("observed_signal_ids")))
            attacker_success = attacker.get("attacker_success_signal", {}) if isinstance(attacker, dict) else {}
            expected_denial = attacker.get("expected_denial_signal", {}) if isinstance(attacker, dict) else {}
            control_success = control_case.get("control_success_signal", {}) if isinstance(control_case, dict) else {}
            control_failure = control_case.get("control_failure_signal", {}) if isinstance(control_case, dict) else {}
            held_signal_ids = {signal["signal_id"] for signal in (expected_denial, control_success) if isinstance(signal, dict) and isinstance(signal.get("signal_id"), str)}
            failed_signal_ids = {signal["signal_id"] for signal in (attacker_success, control_failure) if isinstance(signal, dict) and isinstance(signal.get("signal_id"), str)}
            if execution_status == "passed":
                if not held_signal_ids.issubset(observed_signal_ids):
                    _add(errors, "test.outcome_signals", f"{path}.result.observed_signal_ids", "passed result must include expected-denial and control-success signal IDs")
                if observed_signal_ids & failed_signal_ids:
                    _add(errors, "test.contradictory_signals", f"{path}.result.observed_signal_ids", "passed result cannot include attacker-success or control-failure signals")
            elif execution_status == "failed":
                if not failed_signal_ids.issubset(observed_signal_ids):
                    _add(errors, "test.outcome_signals", f"{path}.result.observed_signal_ids", "failed result must include attacker-success and control-failure signal IDs")
                if observed_signal_ids & held_signal_ids:
                    _add(errors, "test.contradictory_signals", f"{path}.result.observed_signal_ids", "failed result cannot include expected-denial or control-success signals")
            elif held_signal_ids.issubset(observed_signal_ids) or failed_signal_ids.issubset(observed_signal_ids):
                _add(errors, "test.inconclusive_signals", f"{path}.result.observed_signal_ids", "inconclusive result cannot contain a complete conclusive outcome pair")
        if execution_status == "blocked" and not isinstance(row.get("blocker"), dict):
            _add(errors, "test.blocker_required", f"{path}.blocker", "blocked test requires a claim-level blocker")
        if execution_status == "planned" and isinstance(result, dict):
            _add(errors, "test.planned_result", f"{path}.result", "planned test cannot contain an execution result")
        safety = row.get("safety", {})
        if isinstance(safety, dict):
            target = str(safety.get("authorized_target", "")).lower()
            if re.search(r"\b(?:production|prod|live)\b", target) or not any(word in target for word in ("local", "staging", "sandbox", "disposable", "isolated", "test")):
                _add(errors, "test.unsafe_target", f"{path}.safety.authorized_target", "must name a non-production local/staging/sandbox/disposable/isolated test target")
            if safety.get("synthetic_data_only") is not True or safety.get("destructive_actions_prohibited") is not True:
                _add(errors, "test.unsafe_fixture", f"{path}.safety", "must require synthetic data and prohibit destructive actions")
            if _in(execution_status, {"passed", "failed", "inconclusive"}) and safety.get("authorization_status") != "authorized":
                _add(errors, "test.execution_without_authorization", path, "executed result requires an authorized target")
            if safety.get("authorization_status") == "authorized" and global_runtime_status != "authorized":
                _add(errors, "test.authorization_conflict", f"{path}.safety.authorization_status", "test authorization cannot exceed metadata.runtime_authorization")
            if safety.get("authorization_status") == "authorized" and isinstance(safety.get("authorized_target"), str) and safety.get("authorized_target") not in global_runtime_targets:
                _add(errors, "test.target_authorization", f"{path}.safety.authorized_target", "must exactly match a target in metadata.runtime_authorization.targets")
        if _in(execution_status, {"passed", "failed", "inconclusive"}):
            if global_runtime_status != "authorized":
                _add(errors, "test.global_authorization", path, "executed result requires metadata.runtime_authorization.status=authorized")
            direct_result_evidence = set(_ids(result.get("evidence_ids"))) if isinstance(result, dict) else set()
            observed_runtime_evidence = {
                ref for ref in direct_result_evidence
                if evidence_by_id.get(ref, {}).get("evidence_class") == "observed"
                and _in(evidence_by_id.get(ref, {}).get("source_type"), RUNTIME_EVIDENCE)
            }
            if not observed_runtime_evidence:
                _add(errors, "test.execution_without_evidence", f"{path}.result.evidence_ids", "executed result requires direct runtime_observation or test_result evidence")
            result_summary = result.get("summary", {}) if isinstance(result, dict) else {}
            summary_evidence = set(_ids(result_summary.get("evidence_ids"))) if isinstance(result_summary, dict) else set()
            if observed_runtime_evidence and not summary_evidence.intersection(observed_runtime_evidence):
                _add(errors, "test.summary_without_runtime_evidence", f"{path}.result.summary.evidence_ids", "executed result summary must cite direct observed runtime/test-result evidence")
        if not _in(row.get("target_skill"), TARGET_SKILLS):
            _add(errors, "test.target_skill", f"{path}.target_skill", "must name a supported Tahr specialist skill")

    decision_threats = {identifier: set(_ids(row.get("threat_ids"))) for identifier, row in maps.get("decisions", {}).items()}
    path_threat_ids = {threat_id for row in records.get("attack_paths", []) for hop in _dict_rows(row.get("hops")) for threat_id in _ids(hop.get("threat_ids"))}
    for index, row in enumerate(records.get("threats", [])):
        path = f"threats[{index}]"; threat_id = str(row.get("threat_id", ""))
        for field, valid in (("actor_ids", actors), ("asset_ids", assets), ("flow_ids", flows), ("boundary_ids", boundaries), ("invariant_ids", invariants), ("control_ids", controls), ("validation_test_ids", tests)):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, field.rstrip("_ids"))
        for step_index, step in enumerate(_dict_rows(row.get("abuse_path"))):
            step_path = f"{path}.abuse_path[{step_index}]"
            if step.get("sequence") != step_index + 1:
                _add(errors, "threat.abuse_sequence", f"{step_path}.sequence", f"must equal {step_index + 1}")
            _check_ref(errors, f"{step_path}.entity_ids", step.get("entity_ids"), entities, "entity")
            _check_ref(errors, f"{step_path}.flow_id", step.get("flow_id"), flows, "flow")
            _check_ref(errors, f"{step_path}.boundary_id", step.get("boundary_id"), boundaries, "boundary")
        response = row.get("response", {})
        decision_refs = response.get("decision_ids", []) if isinstance(response, dict) else []
        _check_ref(errors, f"{path}.response.decision_ids", decision_refs, decisions, "decision")
        if not decision_refs:
            _add(errors, "threat.decision", path, "material threat must reference a response decision")
        for decision_id in _ids(decision_refs):
            if threat_id not in decision_threats.get(decision_id, set()):
                _add(errors, "reference.nonreciprocal", path, f"{decision_id} does not reference {threat_id}")
        if not row.get("validation_test_ids"):
            _add(errors, "threat.validation", path, "material threat must reference a validation test")
        for step_index, step in enumerate(_dict_rows(row.get("abuse_path"))):
            step_path = f"{path}.abuse_path[{step_index}]"
            if step.get("sequence") != step_index + 1:
                _add(errors, "threat.sequence", f"{step_path}.sequence", f"must equal {step_index + 1}")
            _check_ref(errors, f"{step_path}.entity_ids", step.get("entity_ids"), entities, "entity")
            _check_ref(errors, f"{step_path}.flow_id", step.get("flow_id"), flows, "flow")
            _check_ref(errors, f"{step_path}.boundary_id", step.get("boundary_id"), boundaries, "boundary")
        for test_id in _ids(row.get("validation_test_ids")):
            if threat_id not in test_threats.get(test_id, set()):
                _add(errors, "reference.nonreciprocal", path, f"{test_id} does not reference {threat_id}")
        if _risk_rating(row) in {"critical", "high"}:
            if threat_id not in path_threat_ids:
                _add(errors, "threat.attack_path", path, "high/critical threat must appear in a connected attack path")
            if not isinstance(response, dict) or not _owner_is_named(response.get("owner")):
                _add(errors, "threat.response_owner", f"{path}.response.owner", "high/critical threat requires a named response owner")
            if not isinstance(response, dict) or not isinstance(response.get("residual_risk"), dict):
                _add(errors, "threat.residual_risk", f"{path}.response.residual_risk", "high/critical threat requires residual risk")
            if isinstance(response, dict) and not isinstance(response.get("target_date"), str):
                _add(warnings, "threat.response_date", f"{path}.response.target_date", "high/critical threat should have a target date")

    for index, row in enumerate(records.get("attack_paths", [])):
        path = f"attack_paths[{index}]"
        _check_ref(errors, f"{path}.actor_id", row.get("actor_id"), actors, "actor")
        _check_ref(errors, f"{path}.final_asset_ids", row.get("final_asset_ids"), assets, "asset")
        _check_ref(errors, f"{path}.decision_ids", row.get("decision_ids"), decisions, "decision")
        _check_ref(errors, f"{path}.validation_test_ids", row.get("validation_test_ids"), tests, "test")
        previous_to = None
        hop_rows = _dict_rows(row.get("hops"))
        path_assets: set[str] = set()
        for hop_index, hop in enumerate(hop_rows):
            hp = f"{path}.hops[{hop_index}]"
            if hop.get("sequence") != hop_index + 1:
                _add(errors, "attack_path.sequence", f"{hp}.sequence", f"must equal {hop_index + 1}")
            for field, valid in (("from_entity_id", entities), ("to_entity_id", entities), ("flow_id", flows), ("boundary_id", boundaries), ("threat_ids", threats), ("control_ids", controls), ("intermediate_asset_ids", assets)):
                _check_ref(errors, f"{hp}.{field}", hop.get(field), valid, field.rstrip("_ids"))
            if hop.get("sequence") != hop_index + 1:
                _add(errors, "attack_path.sequence", f"{hp}.sequence", f"must equal {hop_index + 1}")
            flow_hop_id = hop.get("flow_hop_id")
            if not isinstance(flow_hop_id, str) or flow_hop_id not in flow_hops:
                _add(errors, "attack_path.flow_hop", f"{hp}.flow_hop_id", f"unknown flow hop id {flow_hop_id}")
            else:
                source = flow_hops[flow_hop_id]
                if (hop.get("flow_id"), hop.get("boundary_id"), hop.get("from_entity_id"), hop.get("to_entity_id")) != source:
                    _add(errors, "attack_path.hop_mismatch", hp, "must match the referenced flow hop")
                source_assets = flow_hop_assets.get(flow_hop_id, set())
                path_assets.update(source_assets)
                extra_assets = set(_ids(hop.get("intermediate_asset_ids"))) - source_assets
                if extra_assets:
                    _add(errors, "attack_path.intermediate_asset", f"{hp}.intermediate_asset_ids", f"assets are not carried by the referenced flow hop: {', '.join(sorted(extra_assets))}")
            if previous_to is not None and hop.get("from_entity_id") != previous_to:
                _add(errors, "attack_path.disconnected", hp, "does not continue from the previous hop")
            previous_to = hop.get("to_entity_id")
        if hop_rows and row.get("actor_id") != hop_rows[0].get("from_entity_id"):
            _add(errors, "attack_path.initiating_actor", f"{path}.actor_id", "must equal the first hop's initiating actor")
        if hop_rows:
            first_flow_id = hop_rows[0].get("flow_id")
            if row.get("actor_id") not in flow_actors.get(first_flow_id, set()):
                _add(errors, "attack_path.flow_actor", f"{path}.actor_id", "must be an initiating actor declared by the first referenced flow")
            if hop_rows[0].get("to_entity_id") not in flow_entrypoints.get(first_flow_id, set()):
                _add(errors, "attack_path.entrypoint", f"{path}.hops[0].to_entity_id", "first hop must enter an entrypoint declared by its referenced flow")
        final_assets = set(_ids(row.get("final_asset_ids")))
        if not final_assets.issubset(path_assets):
            _add(errors, "attack_path.final_asset_chain", f"{path}.final_asset_ids", f"assets are not carried by the referenced hop chain: {', '.join(sorted(final_assets - path_assets))}")

    for index, row in enumerate(records.get("questions", [])):
        _check_ref(errors, f"questions[{index}].related_ids", row.get("related_ids"), all_top_ids, "model")
        if row.get("status") == "answered" and not isinstance(row.get("answer"), dict):
            _add(errors, "question.answer_required", f"questions[{index}].answer", "answered question requires a claim-level answer")
        if metadata_record.get("model_status") == "complete" and row.get("blocking") is True and row.get("status") != "answered":
            _add(errors, "question.complete_conflict", f"questions[{index}]", "complete model cannot retain an unanswered blocking question")
    for lane in ("privacy_analysis", "ai_analysis"):
        analysis = data.get(lane, {})
        if not isinstance(analysis, dict): continue
        _check_ref(errors, f"{lane}.system_entity_ids", analysis.get("system_entity_ids"), entities, "entity")
        for index, finding in enumerate(analysis.get("findings", [])):
            if not isinstance(finding, dict): continue
            for field, valid in (("asset_ids", assets), ("threat_ids", threats), ("decision_ids", decisions), ("question_ids", questions)):
                _check_ref(errors, f"{lane}.findings[{index}].{field}", finding.get(field), valid, field.rstrip("_ids"))
        if lane == "privacy_analysis":
            for index, category in enumerate(analysis.get("data_categories", [])):
                if isinstance(category, dict): _check_ref(errors, f"{lane}.data_categories[{index}].asset_ids", category.get("asset_ids"), assets, "asset")

    metadata = data.get("metadata", {})
    model_status = metadata.get("model_status") if isinstance(metadata, dict) else None
    assurance = metadata.get("assurance_status") if isinstance(metadata, dict) else None
    if isinstance(metadata, dict):
        try:
            created_at = datetime.fromisoformat(str(metadata.get("created_at", "")).replace("Z", "+00:00"))
            updated_at = datetime.fromisoformat(str(metadata.get("updated_at", "")).replace("Z", "+00:00"))
            next_review_at = datetime.fromisoformat(str(metadata.get("next_review_at", "")).replace("Z", "+00:00"))
            if updated_at < created_at:
                _add(errors, "metadata.time_order", "metadata.updated_at", "must not precede created_at")
            if next_review_at <= updated_at:
                _add(errors, "metadata.review_order", "metadata.next_review_at", "must follow updated_at")
        except (TypeError, ValueError):
            pass  # The structural schema reports malformed or missing date-times.
        repository = metadata.get("repository", {})
        repository_revision = repository.get("revision") if isinstance(repository, dict) else None
        if isinstance(repository_revision, str) and repository_revision.strip().lower() in {"head", "main", "master", "latest", "unknown", "tbd"}:
            _add(warnings, "metadata.floating_revision", "metadata.repository.revision", "should identify an immutable revision or explicitly marked dirty working tree")
        for index, row in enumerate(records.get("evidence", [])):
            locator = row.get("locator", {})
            if isinstance(locator, dict) and isinstance(repository_revision, str) and not locator.get("external_uri") and locator.get("revision") != repository_revision:
                _add(warnings, "evidence.revision_mismatch", f"evidence[{index}].locator.revision", "does not match metadata.repository.revision")
    if _in(assurance, {"partially_runtime_validated", "runtime_validated"}) and not any(_in(row.get("source_type"), RUNTIME_EVIDENCE) for row in records.get("evidence", [])):
        _add(errors, "assurance.runtime_evidence", "metadata.assurance_status", "runtime assurance requires runtime/test evidence")
    execution_states = [row.get("execution_status") for row in records.get("validation_tests", [])]
    if assurance == "source_observed" and any(_in(state, {"passed", "failed", "inconclusive"}) for state in execution_states):
        _add(errors, "assurance.understated", "metadata.assurance_status", "executed validation requires partial or full runtime assurance")
    if assurance == "partially_runtime_validated" and not any(_in(state, {"passed", "failed", "inconclusive"}) for state in execution_states):
        _add(errors, "assurance.no_executed_test", "metadata.assurance_status", "partial runtime assurance requires at least one executed test")
    if assurance == "partially_runtime_validated" and execution_states and all(_in(state, {"passed", "failed"}) for state in execution_states):
        _add(warnings, "assurance.fully_conclusive", "metadata.assurance_status", "all validation tests are conclusive; use runtime_validated or explain the remaining assurance limitation")
    if assurance == "runtime_validated" and (not execution_states or any(not _in(state, {"passed", "failed"}) for state in execution_states)):
        _add(errors, "assurance.not_conclusive", "metadata.assurance_status", "runtime_validated requires every validation test to be passed or failed")
    # Planned tests are valid for source_observed and do not reduce model completeness.
    coverage = data.get("coverage", {}); coverage_rows = records.get("coverage", [])
    coverage_inventory = coverage.get("inventory", {}) if isinstance(coverage, dict) else {}
    coverage_manifest = coverage_inventory.get("manifest", {}) if isinstance(coverage_inventory, dict) else {}
    manifest_evidence_id = coverage_manifest.get("evidence_id") if isinstance(coverage_manifest, dict) else None
    _check_ref(errors, "coverage.inventory.manifest.evidence_id", manifest_evidence_id, evidence_ids, "evidence")
    manifest_evidence = evidence_by_id.get(manifest_evidence_id, {}) if isinstance(manifest_evidence_id, str) else {}
    manifest_evidence_hash: Any = None
    if manifest_evidence:
        if manifest_evidence.get("evidence_class") != "observed" or manifest_evidence.get("source_type") != "repository_manifest":
            _add(errors, "coverage.manifest_evidence", "coverage.inventory.manifest.evidence_id", "must reference observed repository_manifest evidence")
        manifest_locator = manifest_evidence.get("locator", {})
        manifest_evidence_hash = manifest_locator.get("content_hash") if isinstance(manifest_locator, dict) else None
        if not isinstance(manifest_evidence_hash, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", manifest_evidence_hash):
            _add(errors, "coverage.manifest_hash", f"evidence[{list(maps.get('evidence', {})).index(manifest_evidence_id)}].locator.content_hash", "repository manifest requires a lowercase sha256:<64-hex> content hash")
    repository_record = metadata_record.get("repository", {}) if isinstance(metadata_record, dict) else {}
    repository_scope = repository_record.get("scope", {}) if isinstance(repository_record, dict) and isinstance(repository_record.get("scope"), dict) else {}
    repository_revision = repository_record.get("revision") if isinstance(repository_record, dict) else None
    if isinstance(coverage_manifest, dict):
        inventory_content_hash = coverage_manifest.get("content_hash")
        if inventory_content_hash != manifest_evidence_hash:
            _add(errors, "coverage.manifest_hash_mismatch", "coverage.inventory.manifest.content_hash", "must exactly match the referenced repository_manifest evidence content hash")
        if coverage_manifest.get("revision") != repository_revision:
            _add(errors, "coverage.manifest_revision", "coverage.inventory.manifest.revision", "must equal metadata.repository.revision")
        if isinstance(repository_revision, str) and repository_revision.startswith("snapshot-sha256:") and repository_revision != "snapshot-" + str(inventory_content_hash):
            _add(errors, "coverage.snapshot_hash_mismatch", "metadata.repository.revision", "snapshot revision must be snapshot-<coverage.inventory.manifest.content_hash>")
        for field in ("included_paths", "included_packages", "deployment_environments", "supplied_documents", "excluded_paths", "excluded_environments"):
            manifest_values = set(_ids(coverage_manifest.get(field)))
            scope_values = set(_ids(repository_scope.get(field)))
            if manifest_values != scope_values:
                _add(errors, "coverage.manifest_scope", f"coverage.inventory.manifest.{field}", f"must exactly match metadata.repository.scope.{field}")
    expected_subjects = set(_ids(coverage_inventory.get("expected_subject_ids"))) if isinstance(coverage_inventory, dict) else set()
    _check_ref(errors, "coverage.inventory.expected_subject_ids", sorted(expected_subjects), coverage_subject_ids, "model subject")
    covered_subjects = [row.get("subject_id") for row in coverage_rows if isinstance(row.get("subject_id"), str)]
    coverage_pairs = [(row.get("subject_id"), row.get("category")) for row in coverage_rows if isinstance(row.get("subject_id"), str) and isinstance(row.get("category"), str)]
    duplicate_pairs = sorted({pair for pair in coverage_pairs if coverage_pairs.count(pair) > 1})
    if duplicate_pairs:
        _add(errors, "coverage.duplicate_subject_category", "coverage.items", "duplicate subject/category coverage rows: " + ", ".join(f"{subject}/{category}" for subject, category in duplicate_pairs))
    covered_subject_set = set(covered_subjects)
    missing_expected = sorted(expected_subjects - covered_subject_set)
    unexpected_coverage = sorted(covered_subject_set - expected_subjects)
    if missing_expected:
        _add(errors, "coverage.missing_subject", "coverage.items", f"missing expected inventory subjects: {', '.join(missing_expected)}")
    if unexpected_coverage:
        _add(errors, "coverage.uninventoried_subject", "coverage.items", f"coverage subjects absent from the frozen inventory: {', '.join(unexpected_coverage)}")
    automatically_required_subjects = (
        set(maps.get("entities", {}))
        | boundaries
        | flows
        | invariants
        | controls
        | decisions
    )
    missing_core_subjects = sorted(automatically_required_subjects - expected_subjects)
    if missing_core_subjects:
        _add(errors, "coverage.inventory_incomplete", "coverage.inventory.expected_subject_ids", f"missing mandatory high-signal model subjects: {', '.join(missing_core_subjects)}")
    calculated_unread = sum(1 for row in coverage_rows if _in(row.get("status"), {"pending", "deferred_with_specific_reason", "out_of_scope"}) and _in(row.get("risk_if_unreviewed"), {"critical", "high"}))
    if isinstance(coverage, dict) and coverage.get("unread_high_risk_count") != calculated_unread:
        _add(errors, "coverage.count", "coverage.unread_high_risk_count", f"must equal calculated high-risk pending/deferred/out-of-scope count {calculated_unread}")
    declared_exclusions = set(_ids(repository_scope.get("excluded_paths"))) | set(_ids(repository_scope.get("excluded_environments")))
    if declared_exclusions and not _dict_rows(repository_scope.get("limitations")):
        _add(errors, "coverage.exclusion_without_limitation", "metadata.repository.scope.limitations", "declared path/environment exclusions require at least one claim-level limitation")
    for index, row in enumerate(coverage_rows):
        _check_ref(errors, f"coverage.items[{index}].subject_id", row.get("subject_id"), coverage_subject_ids, "model subject")
        _check_ref(errors, f"coverage.items[{index}].evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        if _in(row.get("status"), {"deferred_with_specific_reason", "out_of_scope"}) and len(_claim_text(row.get("reason"))) < 16:
            _add(errors, "coverage.generic_disposition", f"coverage.items[{index}].reason", "must give a concrete specific reason")
        if row.get("status") == "out_of_scope" and row.get("scope_exclusion") not in declared_exclusions:
            _add(errors, "coverage.undeclared_exclusion", f"coverage.items[{index}].scope_exclusion", "must exactly match metadata.repository.scope.excluded_paths or excluded_environments")
        if row.get("status") != "out_of_scope" and row.get("scope_exclusion") is not None:
            _add(errors, "coverage.unused_exclusion", f"coverage.items[{index}].scope_exclusion", "is only valid for out_of_scope coverage")
    if model_status == "complete" and calculated_unread:
        _add(errors, "coverage.complete_conflict", "metadata.model_status", "complete model cannot retain high-risk pending/deferred coverage")
    if model_status == "incomplete_high_risk_coverage" and calculated_unread == 0:
        _add(warnings, "coverage.incomplete_without_gap", "metadata.model_status", "should identify the high-risk coverage/evidence gap forcing incompleteness")

    quality = data.get("quality_review", {})
    if isinstance(quality, dict):
        unresolved = quality.get("unresolved_high_severity_finding_ids", [])
        challenge_findings = _dict_rows(quality.get("challenge_findings"))
        finding_ids = {row.get("finding_id") for row in challenge_findings if isinstance(row.get("finding_id"), str)}
        _check_ref(errors, "quality_review.unresolved_high_severity_finding_ids", unresolved, finding_ids, "quality finding")
        for index, finding in enumerate(challenge_findings):
            _check_ref(errors, f"quality_review.challenge_findings[{index}].related_ids", finding.get("related_ids"), all_top_ids, "model")
        calculated_unresolved = {
            row["finding_id"]
            for row in challenge_findings
            if isinstance(row.get("finding_id"), str)
            and _in(row.get("severity"), {"critical", "high"})
            and row.get("status") == "open"
        }
        if set(_ids(unresolved)) != calculated_unresolved:
            _add(errors, "quality.unresolved_count", "quality_review.unresolved_high_severity_finding_ids", f"must equal open critical/high challenge findings: {', '.join(sorted(calculated_unresolved)) or 'none'}")
        checks = quality.get("consistency_checks", {})
        gate_rows = _dict_rows(quality.get("gates"))
        gate_names = [gate.get("gate") for gate in gate_rows if isinstance(gate.get("gate"), str)]
        missing_gates = sorted(QUALITY_GATES - set(gate_names)); duplicate_gates = sorted({gate for gate in gate_names if gate_names.count(gate) > 1})
        if missing_gates:
            _add(errors, "quality.missing_gates", "quality_review.gates", f"missing canonical gates: {', '.join(missing_gates)}")
        if duplicate_gates:
            _add(errors, "quality.duplicate_gates", "quality_review.gates", f"duplicate canonical gates: {', '.join(duplicate_gates)}")
        valid_not_applicable: set[str] = set()
        privacy_lane = data.get("privacy_analysis", {})
        ai_lane = data.get("ai_analysis", {})
        for index, gate in enumerate(gate_rows):
            if gate.get("status") != "not_applicable":
                continue
            gate_name = gate.get("gate")
            allowed = (
                (gate_name == "privacy_applicability" and isinstance(privacy_lane, dict) and privacy_lane.get("applicable") is False)
                or (gate_name == "ai_applicability" and isinstance(ai_lane, dict) and ai_lane.get("applicable") is False)
                or (gate_name == "attack_path" and not threats and not maps.get("attack_paths", {}))
                or (gate_name == "risk_ranking" and not threats)
                or (gate_name == "validation_safety" and not tests)
            )
            if allowed and isinstance(gate_name, str):
                valid_not_applicable.add(gate_name)
            else:
                _add(errors, "quality.invalid_not_applicable", f"quality_review.gates[{index}].status", "not_applicable is allowed only for an absent privacy/AI lane, an empty threat/path ledger, or no validation tests")
        if model_status == "complete":
            if quality.get("overall_status") != "pass":
                _add(errors, "quality.complete_conflict", "quality_review.overall_status", "complete model requires a passing quality review")
            if unresolved:
                _add(errors, "quality.unresolved_high", "quality_review.unresolved_high_severity_finding_ids", "passing complete review cannot retain unresolved high-severity challenge findings")
            if isinstance(checks, dict):
                for key, value in checks.items():
                    if value is not True:
                        _add(errors, "quality.consistency", f"quality_review.consistency_checks.{key}", "must be true for a complete model")
            for index, gate in enumerate(gate_rows):
                if gate.get("status") != "passed" and gate.get("gate") not in valid_not_applicable:
                    _add(errors, "quality.gate", f"quality_review.gates[{index}].status", "must pass for a complete model unless the validator confirms a conditional lane is absent")
            if quality.get("release_blockers"):
                _add(errors, "quality.release_blockers", "quality_review.release_blockers", "complete model cannot retain release blockers")

    for path, value in _iter(data):
        if not isinstance(value, str): continue
        if any(pattern.search(value) for pattern in FORBIDDEN_WORDING):
            _add(errors, "language.overclaim", path, "uses forbidden secure/no-vulnerabilities/exploit-confirmation wording")
        if any(pattern.search(value) for pattern in SECRET_PATTERNS):
            _add(errors, "secret.unredacted", path, "appears to contain an unredacted key or token")

    errors.sort(key=lambda item: (item.path, item.code, item.message))
    warnings.sort(key=lambda item: (item.path, item.code, item.message))
    return errors, warnings


def validate(data: Any, strict: bool = False) -> tuple[list[str], list[str]]:
    errors, warnings = validate_model(data)
    return [item.format("ERROR") for item in errors], [item.format("WARNING") for item in warnings]


def load_model(path: Union[Path, str]) -> Any:
    if str(path) == "-":
        return json.load(sys.stdin)
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="canonical JSON model or - for stdin")
    parser.add_argument("--json", action="store_true", dest="json_output")
    parser.add_argument("--strict", action="store_true", help="fail on warnings")
    args = parser.parse_args(argv)
    try:
        data = load_model(args.model)
        errors, warnings = validate_model(data)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, RecursionError) as exc:
        errors, warnings = [Diagnostic("input.invalid", "", str(exc))], []
    failed = bool(errors) or (args.strict and bool(warnings))
    if args.json_output:
        print(json.dumps({"valid": not failed, "strict": args.strict, "errors": [x.to_dict() for x in errors], "warnings": [x.to_dict() for x in warnings]}, indent=2, sort_keys=True))
    else:
        for item in warnings: print(item.format("WARNING"))
        for item in errors: print(item.format("ERROR"))
        print(f"{'FAIL' if failed else 'PASS'}: {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
