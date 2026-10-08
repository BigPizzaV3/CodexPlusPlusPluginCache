#!/usr/bin/env python3
"""Validate a canonical Tahr access-control review.

The JSON Schema enforces shape and vocabulary.  This validator adds the
cross-record, provenance, runtime-safety, proof, coverage, and quality rules
that JSON Schema alone cannot express.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Optional, Sequence
from urllib.parse import urlparse


SCHEMA_PATH = Path(__file__).resolve().parent.parent / "assets" / "access-control-review.schema.json"

SECTION_IDS: dict[str, tuple[str, str]] = {
    "evidence": ("evidence_id", "EVD-"),
    "surfaces": ("surface_id", "SURFACE-"),
    "carriers": ("carrier_id", "CARRIER-"),
    "variants": ("variant_id", "VARIANT-"),
    "identities": ("identity_id", "IDENTITY-"),
    "resources": ("resource_id", "RESOURCE-"),
    "policy_rules": ("policy_id", "POLICY-"),
    "enforcement_points": ("enforcement_point_id", "ENFORCEMENT-"),
    "operations": ("operation_id", "OP-"),
    "obligations": ("obligation_id", "OBLIGATION-"),
    "source_traces": ("source_trace_id", "TRACE-"),
    "matrix_requirements": ("matrix_requirement_id", "REQUIREMENT-"),
    "matrix": ("matrix_cell_id", "MATRIX-"),
    "candidates": ("candidate_id", "CANDIDATE-"),
    "findings": ("finding_id", "FINDING-"),
    "validation_tests": ("validation_test_id", "TEST-"),
    "questions": ("question_id", "Q-"),
}

OBSERVED_SOURCE_TYPES = {
    "source_code", "configuration", "repository_manifest", "api_specification",
    "graphql_schema", "traffic_capture", "runtime_identity_check", "runtime_request",
    "runtime_response", "object_readback", "audit_event", "test_result",
}
INTENDED_SOURCE_TYPES = {"design_document", "role_matrix", "policy", "interview"}
RUNTIME_SOURCE_TYPES = {
    "traffic_capture", "runtime_identity_check", "runtime_request", "runtime_response",
    "object_readback", "audit_event", "test_result",
}
DIRECT_RUNTIME_SOURCE_TYPES = {"runtime_response", "object_readback", "audit_event", "test_result"}
EXECUTED_STATES = {"passed", "failed", "inconclusive"}
CONFIRMED_DISPOSITIONS = {"source_confirmed", "runtime_confirmed"}
PROOF_GATES = {"caller", "target", "ownership_or_tenant", "expected_denial", "unauthorized_impact"}
QUALITY_GATES = {
    "scope_and_evidence", "identity_integrity", "resource_provenance",
    "operation_inventory", "policy_model", "source_trace", "matrix_completeness",
    "runtime_safety", "proof_gates", "false_positive_challenge", "coverage",
}
RISK_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
CORE_SIGNAL_PURPOSES = {
    "caller_identity", "owner_target_attribution", "authorized_baseline",
    "expected_denial", "unauthorized_impact", "control_success", "control_failure",
}
FLOATING_REVISIONS = {"", "head", "main", "master", "latest", "unknown", "tbd", "todo"}
IMMUTABLE_REVISION_PATTERNS = (
    re.compile(r"snapshot-sha256:[0-9a-f]{64}"),
    re.compile(r"sha256:[0-9a-f]{64}"),
    re.compile(r"(?:git:)?[0-9a-f]{7,64}", re.I),
    re.compile(r"v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?"),
    re.compile(r"r[1-9][0-9]*", re.I),
)
FORBIDDEN_WORDING = (
    re.compile(r"\b(?:the\s+)?(?:application|system|service|product)\s+is\s+secure\b", re.I),
    re.compile(r"\bno\s+(?:authorization\s+|access[- ]control\s+|security\s+)?vulnerabilit(?:y|ies)\b", re.I),
    re.compile(r"\bconfirmed\s+(?:exploit|exploitation)\b", re.I),
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
        location = f" at {self.path}" if self.path else ""
        return f"{level}: [{self.code}]{location}: {self.message}"


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


def _rows(value: Any) -> list[dict[str, Any]]:
    return [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []


def _ids(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _claim_text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("statement", "")
    return " ".join(value.split()) if isinstance(value, str) else ""


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
    if not isinstance(node, dict):
        raise ValueError(f"schema reference is not an object: {ref}")
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


def _schema_probe(value: Any, schema: dict[str, Any], root: dict[str, Any]) -> list[Diagnostic]:
    result: list[Diagnostic] = []
    _schema_check(value, schema, root, "", result)
    return result


def _schema_check(value: Any, schema: dict[str, Any], root: dict[str, Any], path: str,
                  errors: list[Diagnostic]) -> None:
    if "$ref" in schema:
        _schema_check(value, _resolve_ref(root, schema["$ref"]), root, path, errors)
        return
    for child in schema.get("allOf", []):
        _schema_check(value, child, root, path, errors)
    if "oneOf" in schema:
        matches = sum(not _schema_probe(value, child, root) for child in schema["oneOf"])
        if matches != 1:
            _add(errors, "schema.one_of", path, f"must match exactly one alternative, matched {matches}")
    if "if" in schema:
        branch = schema.get("then") if not _schema_probe(value, schema["if"], root) else schema.get("else")
        if isinstance(branch, dict):
            _schema_check(value, branch, root, path, errors)
    expected = schema.get("type")
    if isinstance(expected, list):
        matches_type = any(_type_matches(value, item) for item in expected)
    else:
        matches_type = not expected or _type_matches(value, expected)
    if not matches_type:
        _add(errors, "schema.type", path, f"must be {expected}")
        return
    if "const" in schema and value != schema["const"]:
        _add(errors, "schema.const", path, f"must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        _add(errors, "schema.enum", path, "must be one of: " + ", ".join(map(str, schema["enum"])))
    if isinstance(value, dict):
        for key in schema.get("required", []):
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
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            _add(errors, "schema.max_items", path, f"allows at most {schema['maxItems']} item(s)")
        if schema.get("uniqueItems"):
            canonical = [json.dumps(item, sort_keys=True, separators=(",", ":")) for item in value]
            if len(canonical) != len(set(canonical)):
                _add(errors, "schema.unique_items", path, "must not contain duplicates")
        child = schema.get("items")
        if isinstance(child, dict):
            for index, item in enumerate(value):
                _schema_check(item, child, root, f"{path}[{index}]", errors)
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
                _add(errors, "schema.format", path, "must be an RFC 3339 date-time with timezone")
        elif schema.get("format") == "uri" and not urlparse(value).scheme:
            _add(errors, "schema.format", path, "must be an absolute URI")
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            _add(errors, "schema.minimum", path, f"must be at least {schema['minimum']}")


def _check_ref(errors: list[Diagnostic], path: str, value: Any, valid: set[str], label: str) -> None:
    for identifier in _ids(value):
        if identifier not in valid:
            _add(errors, "reference.unknown", path, f"unknown {label} id {identifier}")


def _fingerprint(value: Any) -> bool:
    return isinstance(value, str) and bool(re.fullmatch(r"sha256:[0-9a-f]{64}", value))


def _immutable_revision(value: Any) -> bool:
    if not isinstance(value, str) or value.strip().lower() in FLOATING_REVISIONS:
        return False
    return any(pattern.fullmatch(value.strip()) for pattern in IMMUTABLE_REVISION_PATTERNS)


def _claim_sources(claim: Any, evidence: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(claim, dict):
        return []
    return [evidence[item] for item in _ids(claim.get("evidence_ids")) if item in evidence]


def _has_source_evidence(ids: Any, evidence: dict[str, dict[str, Any]]) -> bool:
    return any(
        ref in evidence
        and evidence[ref].get("evidence_class") == "observed"
        and evidence[ref].get("source_type") in {"source_code", "configuration"}
        for ref in _ids(ids)
    )


def _direct_runtime_ids(ids: Any, evidence: dict[str, dict[str, Any]]) -> set[str]:
    return {
        ref for ref in _ids(ids)
        if ref in evidence
        and evidence[ref].get("evidence_class") == "observed"
        and evidence[ref].get("source_type") in DIRECT_RUNTIME_SOURCE_TYPES
    }


def _has_forbidden_wording(value: str) -> bool:
    for index, pattern in enumerate(FORBIDDEN_WORDING):
        for match in pattern.finditer(value):
            if index == 0:
                prefix = value[max(0, match.start() - 80):match.start()]
                if re.search(r"\b(?:does\s+not|doesn't|do\s+not|cannot|can't|never|not\s+mean)\b.{0,60}$", prefix, re.I):
                    continue
            return True
    return False


def _source_runtime_overclaim(value: str) -> bool:
    """Return true when source-only prose asserts a positive runtime result."""
    patterns = (
        re.compile(
            r"\b(?:sent\s+(?:the\s+)?request|(?:executed|ran)\s+(?:the\s+)?(?:attack|exploit|mutation|request)|observed\s+(?:unauthorized\s+impact|the\s+response|the\s+state\s+change|the\s+mutation\s+persist))\b",
            re.I,
        ),
        re.compile(
            r"\b(?:attack|exploit|mutation|request|response|runtime|staging|live(?:\s+environment)?|endpoint|server|service|backend|application)\b.{0,60}\b(?:successfully\s+)?(?:succeeded|worked|retrieved|returned|demonstrated|accepted|stored|persisted|exposed|allowed|bypassed)\b",
            re.I,
        ),
        re.compile(
            r"\b(?:successfully\s+)?(?:retrieved|returned|demonstrated|accepted|stored|persisted|exposed|allowed|bypassed)\b.{0,60}\b(?:at\s+runtime|in\s+staging|on\s+(?:the\s+)?live|by\s+the\s+(?:endpoint|service|application))\b",
            re.I,
        ),
    )
    for pattern in patterns:
        for match in pattern.finditer(value):
            context = value[max(0, match.start() - 48):match.end()]
            if re.search(
                r"\b(?:never|not|no)\b(?:\s+\w+){0,5}\s+(?:sent|executed|ran|observed|succeeded|worked|retrieved|returned|demonstrated|accepted|stored|persisted|exposed|allowed|bypassed)\b",
                context,
                re.I,
            ):
                continue
            return True
    return False


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
    if errors:
        errors.sort(key=lambda item: (item.path, item.code, item.message))
        return errors, warnings

    rows = {section: _rows(data.get(section)) for section in SECTION_IDS}
    maps: dict[str, dict[str, dict[str, Any]]] = {section: {} for section in SECTION_IDS}
    seen: dict[str, str] = {}

    def define(identifier: Any, path: str, prefix: str) -> None:
        if not isinstance(identifier, str) or not identifier:
            return
        if not identifier.startswith(prefix):
            _add(errors, "id.prefix", path, f"must start with {prefix}")
        if identifier in seen:
            _add(errors, "id.duplicate", path, f"duplicates id first defined at {seen[identifier]}")
        else:
            seen[identifier] = path

    for section, section_rows in rows.items():
        field, prefix = SECTION_IDS[section]
        for index, row in enumerate(section_rows):
            path = f"{section}[{index}]"
            identifier = row.get(field)
            define(identifier, f"{path}.{field}", prefix)
            if isinstance(identifier, str):
                maps[section][identifier] = row

    coverage = data.get("coverage") if isinstance(data.get("coverage"), dict) else {}
    coverage_rows = _rows(coverage.get("items"))
    for index, row in enumerate(coverage_rows):
        define(row.get("coverage_id"), f"coverage.items[{index}].coverage_id", "COV-")
    quality = data.get("quality_review") if isinstance(data.get("quality_review"), dict) else {}
    for index, row in enumerate(_rows(quality.get("challenge_findings"))):
        define(row.get("finding_id"), f"quality_review.challenge_findings[{index}].finding_id", "QF-")
    for index, row in enumerate(_rows(quality.get("gates"))):
        define(row.get("gate_id"), f"quality_review.gates[{index}].gate_id", "GATE-")
    for trace_index, trace in enumerate(rows["source_traces"]):
        for hop_index, hop in enumerate(_rows(trace.get("hops"))):
            define(hop.get("hop_id"), f"source_traces[{trace_index}].hops[{hop_index}].hop_id", "HOP-")
    for test_index, test in enumerate(rows["validation_tests"]):
        for signal_index, signal in enumerate(_rows(test.get("signals"))):
            define(signal.get("signal_id"), f"validation_tests[{test_index}].signals[{signal_index}].signal_id", "SIGNAL-")
    for path, node in _iter(data):
        if isinstance(node, dict) and "claim_id" in node:
            define(node.get("claim_id"), f"{path}.claim_id", "CLAIM-")

    evidence = maps["evidence"]
    evidence_ids = set(evidence)
    for path, node in _iter(data):
        if not isinstance(node, dict) or "claim_id" not in node:
            continue
        _check_ref(errors, f"{path}.evidence_ids", node.get("evidence_ids"), evidence_ids, "evidence")
        cited = _claim_sources(node, evidence)
        evidence_class = node.get("evidence_class")
        if evidence_class in {"observed", "intended", "unknown"} and not cited:
            _add(errors, "evidence.claim_unproven", path, f"{evidence_class} claim requires cited evidence")
        if evidence_class == "observed" and cited and not any(
            item.get("evidence_class") == "observed" and item.get("source_type") in OBSERVED_SOURCE_TYPES
            for item in cited
        ):
            _add(errors, "evidence.observed_mismatch", path, "observed claim must cite observed implementation or runtime evidence")
        if evidence_class == "intended" and cited and not any(
            item.get("evidence_class") == "intended" and item.get("source_type") in INTENDED_SOURCE_TYPES
            for item in cited
        ):
            _add(errors, "evidence.intended_mismatch", path, "intended claim must cite intended policy, role, design, or interview evidence")
        if evidence_class == "unknown" and cited and not any(item.get("evidence_class") == "unknown" for item in cited):
            _add(errors, "evidence.unknown_mismatch", path, "unknown claim must cite an unknown evidence record naming the gap")

    for index, item in enumerate(rows["evidence"]):
        path = f"evidence[{index}]"
        locator = item.get("locator") if isinstance(item.get("locator"), dict) else {}
        source_type = item.get("source_type")
        if source_type in RUNTIME_SOURCE_TYPES:
            if (
                not locator.get("run_id")
                or not locator.get("target")
                or not locator.get("environment")
                or not locator.get("transport")
            ):
                _add(
                    errors,
                    "evidence.runtime_provenance",
                    f"{path}.locator",
                    "runtime evidence requires run_id, exact target, environment, and transport",
                )
        if source_type == "repository_manifest" and not _fingerprint(locator.get("content_hash")):
            _add(errors, "evidence.manifest_hash", f"{path}.locator.content_hash", "repository manifest requires lowercase sha256:<64-hex>")

    all_top_ids = set().union(*(set(section_map) for section_map in maps.values()))
    surfaces = set(maps["surfaces"]); carriers = set(maps["carriers"]); variants = set(maps["variants"])
    identities = set(maps["identities"]); resources = set(maps["resources"])
    policies = set(maps["policy_rules"]); enforcement = set(maps["enforcement_points"])
    operations = set(maps["operations"]); obligations = set(maps["obligations"])
    traces = set(maps["source_traces"]); requirements = set(maps["matrix_requirements"])
    matrix_cells = set(maps["matrix"]); candidates = set(maps["candidates"])
    findings = set(maps["findings"]); tests = set(maps["validation_tests"])

    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    scope = data.get("scope") if isinstance(data.get("scope"), dict) else {}
    summary = data.get("executive_summary") if isinstance(data.get("executive_summary"), dict) else {}
    repository = metadata.get("repository") if isinstance(metadata.get("repository"), dict) else {}
    runtime_auth = metadata.get("runtime_authorization") if isinstance(metadata.get("runtime_authorization"), dict) else {}
    basis = metadata.get("analysis_basis")
    review_mode = metadata.get("review_mode")
    review_status = metadata.get("review_status")
    assurance = metadata.get("assurance_status")

    global_authorization_expiry: Optional[datetime] = None
    if runtime_auth.get("status") == "authorized":
        try:
            global_authorization_expiry = datetime.fromisoformat(
                str(runtime_auth.get("expires_at", "")).replace("Z", "+00:00")
            )
        except (TypeError, ValueError):
            pass

    authorization_target_ids: set[str] = set()
    for index, grant in enumerate(_rows(runtime_auth.get("targets"))):
        path = f"metadata.runtime_authorization.targets[{index}]"
        grant_id = grant.get("authorization_target_id")
        if isinstance(grant_id, str):
            if not grant_id.startswith("AUTHZ-"):
                _add(errors, "authorization.id_prefix", f"{path}.authorization_target_id", "must start with AUTHZ-")
            if grant_id in authorization_target_ids:
                _add(errors, "authorization.id_duplicate", f"{path}.authorization_target_id", "authorization target IDs must be unique")
            authorization_target_ids.add(grant_id)
        for field, valid, label in (
            ("surface_ids", surfaces, "surface"),
            ("operation_ids", operations, "operation"),
            ("resource_ids", resources, "resource"),
            ("allowed_identity_ids", identities, "identity"),
        ):
            _check_ref(errors, f"{path}.{field}", grant.get(field), valid, label)
        mutation_scope = grant.get("mutation_scope") if isinstance(grant.get("mutation_scope"), dict) else {}
        _check_ref(errors, f"{path}.mutation_scope.allowed_resource_ids", mutation_scope.get("allowed_resource_ids"), resources, "resource")
        _check_ref(errors, f"{path}.mutation_scope.allowed_carrier_ids", mutation_scope.get("allowed_carrier_ids"), carriers, "carrier")
        if not _ids(grant.get("allowed_tenants")) and not _ids(grant.get("allowed_authorization_domains")):
            _add(errors, "authorization.domain_scope", path, "authorization target must bind at least one tenant or authorization domain")
        if any(action != "read_only" for action in _ids(grant.get("allowed_action_classes"))):
            if mutation_scope.get("state_change_allowed") is not True:
                _add(errors, "authorization.mutation_scope", f"{path}.mutation_scope.state_change_allowed", "state-changing action classes require explicit mutation authority")
            if not _ids(mutation_scope.get("allowed_resource_ids")):
                _add(errors, "authorization.mutation_resources", f"{path}.mutation_scope.allowed_resource_ids", "state-changing authority requires exact mutable resource IDs")
            if not _ids(mutation_scope.get("allowed_carrier_ids")):
                _add(errors, "authorization.mutation_carriers", f"{path}.mutation_scope.allowed_carrier_ids", "state-changing authority requires exact mutable identifier/property carriers")
            if not set(_ids(mutation_scope.get("allowed_resource_ids"))).issubset(set(_ids(grant.get("resource_ids")))):
                _add(errors, "authorization.mutation_resource_scope", f"{path}.mutation_scope.allowed_resource_ids", "mutable resources must be inside the authorization target resource scope")
        try:
            valid_from = datetime.fromisoformat(str(grant.get("valid_from", "")).replace("Z", "+00:00"))
            expires_at = datetime.fromisoformat(str(grant.get("expires_at", "")).replace("Z", "+00:00"))
            if expires_at <= valid_from:
                _add(errors, "authorization.time_window", f"{path}.expires_at", "must follow valid_from")
            if global_authorization_expiry is not None and expires_at > global_authorization_expiry:
                _add(
                    errors,
                    "authorization.global_expiry",
                    f"{path}.expires_at",
                    "target authorization cannot outlive metadata.runtime_authorization.expires_at",
                )
        except (TypeError, ValueError):
            pass

    _check_ref(errors, "executive_summary.highest_priority_finding_ids", summary.get("highest_priority_finding_ids"), findings, "finding")
    _check_ref(errors, "executive_summary.highest_priority_candidate_ids", summary.get("highest_priority_candidate_ids"), candidates, "candidate")
    _check_ref(errors, "scope.focused_target_ids", scope.get("focused_target_ids"), all_top_ids, "review subject")

    try:
        created = datetime.fromisoformat(str(metadata.get("created_at", "")).replace("Z", "+00:00"))
        updated = datetime.fromisoformat(str(metadata.get("updated_at", "")).replace("Z", "+00:00"))
        next_review = datetime.fromisoformat(str(metadata.get("next_review_at", "")).replace("Z", "+00:00"))
        if updated < created:
            _add(errors, "metadata.time_order", "metadata.updated_at", "must not precede created_at")
        if next_review <= updated:
            _add(errors, "metadata.review_order", "metadata.next_review_at", "must follow updated_at")
    except (TypeError, ValueError):
        pass

    if basis in {"source_only", "hybrid"}:
        if not repository:
            _add(errors, "metadata.repository_required", "metadata.repository", "source and hybrid reviews require a frozen repository record")
        revision = repository.get("revision")
        if not _immutable_revision(revision):
            _add(errors, "metadata.mutable_revision", "metadata.repository.revision", "must be a commit hash, content digest, or explicitly versioned release—not a branch-like label")
        coverage_inventory = coverage.get("inventory") if isinstance(coverage.get("inventory"), dict) else {}
        if not coverage_inventory.get("source_manifest"):
            _add(errors, "coverage.source_manifest_required", "coverage.inventory.source_manifest", "source and hybrid reviews require a deterministic source manifest")
    elif basis == "runtime_only" and isinstance(coverage.get("inventory"), dict) and coverage["inventory"].get("source_manifest") is not None:
        _add(errors, "coverage.runtime_only_manifest", "coverage.inventory.source_manifest", "runtime-only review must set source_manifest to null")

    limitations = [_claim_text(item).lower() for item in _rows(scope.get("limitations"))]
    if review_mode == "focused":
        if not _ids(scope.get("focused_target_ids")):
            _add(errors, "scope.focused_targets", "scope.focused_target_ids", "focused review requires named target IDs")
        if not any("focused" in text and ("not" in text or "limit" in text) for text in limitations):
            _add(errors, "scope.focused_limitation", "scope.limitations", "focused review requires a visible non-application-wide limitation")
    elif review_mode == "full" and _ids(scope.get("focused_target_ids")):
        _add(errors, "scope.full_targets", "scope.focused_target_ids", "full review must use an empty focused target list")

    if basis in {"source_only", "hybrid"} and repository:
        repository_revision = repository.get("revision")
        for index, item in enumerate(rows["evidence"]):
            if item.get("source_type") not in {"source_code", "configuration", "repository_manifest", "api_specification", "graphql_schema"}:
                continue
            locator = item.get("locator") if isinstance(item.get("locator"), dict) else {}
            if locator.get("revision") != repository_revision:
                _add(errors, "evidence.revision_mismatch", f"evidence[{index}].locator.revision", "source evidence revision must equal metadata.repository.revision")

    manifest = coverage.get("inventory", {}).get("source_manifest") if isinstance(coverage.get("inventory"), dict) else None
    if isinstance(manifest, dict):
        manifest_ref = manifest.get("evidence_id")
        _check_ref(errors, "coverage.inventory.source_manifest.evidence_id", manifest_ref, evidence_ids, "evidence")
        manifest_evidence = evidence.get(manifest_ref, {}) if isinstance(manifest_ref, str) else {}
        locator = manifest_evidence.get("locator") if isinstance(manifest_evidence.get("locator"), dict) else {}
        if manifest_evidence.get("evidence_class") != "observed" or manifest_evidence.get("source_type") != "repository_manifest":
            _add(errors, "coverage.manifest_evidence", "coverage.inventory.source_manifest.evidence_id", "must reference observed repository_manifest evidence")
        if manifest.get("content_hash") != locator.get("content_hash"):
            _add(errors, "coverage.manifest_hash_mismatch", "coverage.inventory.source_manifest.content_hash", "must match repository-manifest evidence content_hash")
        if manifest.get("revision") != repository.get("revision") or locator.get("revision") != repository.get("revision"):
            _add(errors, "coverage.manifest_revision", "coverage.inventory.source_manifest.revision", "manifest and evidence revision must equal metadata.repository.revision")
        for field in ("included_paths", "included_packages", "supplied_documents", "excluded_paths"):
            if manifest.get(field) != repository.get(field):
                _add(errors, "coverage.manifest_scope", f"coverage.inventory.source_manifest.{field}", f"must exactly match metadata.repository.{field}")
        revision = str(manifest.get("revision", ""))
        content_hash = str(manifest.get("content_hash", ""))
        if revision.startswith("snapshot-sha256:") and revision != "snapshot-" + content_hash:
            _add(errors, "coverage.snapshot_mismatch", "coverage.inventory.source_manifest.revision", "snapshot revision must equal snapshot-<content_hash>")

    # Cross-record reference integrity and bidirectional operation links.
    for index, row in enumerate(rows["surfaces"]):
        path = f"surfaces[{index}]"
        _check_ref(errors, f"{path}.operation_ids", row.get("operation_ids"), operations, "operation")
        _check_ref(errors, f"{path}.evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        has_ops = bool(_ids(row.get("operation_ids")))
        if row.get("disposition") == "operation" and not has_ops:
            _add(errors, "surface.operation_required", f"{path}.operation_ids", "operation disposition requires at least one operation")
        if row.get("disposition") != "operation" and has_ops:
            _add(errors, "surface.unexpected_operation", f"{path}.operation_ids", "non-operation disposition cannot link operations")
        for operation_id in _ids(row.get("operation_ids")):
            if row.get("surface_id") not in _ids(maps["operations"].get(operation_id, {}).get("surface_ids")):
                _add(errors, "surface.operation_backlink", f"{path}.operation_ids", f"operation {operation_id} does not link back to {row.get('surface_id')}")
    for index, row in enumerate(rows["carriers"]):
        _check_ref(errors, f"carriers[{index}].evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
    for index, row in enumerate(rows["variants"]):
        _check_ref(errors, f"variants[{index}].operation_ids", row.get("operation_ids"), operations, "operation")
        _check_ref(errors, f"variants[{index}].evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        for operation_id in _ids(row.get("operation_ids")):
            if row.get("variant_id") not in _ids(maps["operations"].get(operation_id, {}).get("variant_ids")):
                _add(errors, "variant.operation_backlink", f"variants[{index}].operation_ids", f"operation {operation_id} does not link back to {row.get('variant_id')}")

    unauthenticated = []
    for index, row in enumerate(rows["identities"]):
        path = f"identities[{index}]"
        _check_ref(errors, f"{path}.evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        if row.get("kind") == "unauthenticated":
            unauthenticated.append(row.get("identity_id"))
            if row.get("verification_status") != "source_modeled" or row.get("protected_account") is not False:
                _add(errors, "identity.unauthenticated_semantics", path, "unauthenticated identity must be source_modeled and not a protected account")
        verification = row.get("verification_status")
        if verification == "source_modeled" and "source" not in set(_ids(row.get("transports"))):
            _add(errors, "identity.source_transport", f"{path}.transports", "source-modeled identity must include source transport")
        if verification in {"runtime_verified_portable", "runtime_verified_browser_bound"}:
            if not _fingerprint(row.get("artifact_fingerprint")):
                _add(errors, "identity.artifact_fingerprint", f"{path}.artifact_fingerprint", "runtime-verified identity requires a redacted sha256 fingerprint")
            cited = [evidence.get(ref, {}) for ref in _ids(row.get("evidence_ids"))]
            if not any(item.get("evidence_class") == "observed" and item.get("source_type") == "runtime_identity_check" for item in cited):
                _add(errors, "identity.runtime_proof", f"{path}.evidence_ids", "runtime-verified identity requires observed runtime_identity_check evidence")
            transports = set(_ids(row.get("transports")))
            if verification == "runtime_verified_browser_bound" and transports != {"browser"}:
                _add(errors, "identity.browser_binding", f"{path}.transports", "browser-bound identity must be usable only through browser transport")
            if verification == "runtime_verified_portable" and transports == {"source"}:
                _add(errors, "identity.portable_transport", f"{path}.transports", "portable runtime identity requires a runtime transport")
    if len(unauthenticated) != 1:
        _add(errors, "identity.unauthenticated_count", "identities", "model exactly one unauthenticated identity")

    for index, row in enumerate(rows["resources"]):
        _check_ref(errors, f"resources[{index}].owner_identity_id", row.get("owner_identity_id"), identities, "identity")
        _check_ref(errors, f"resources[{index}].carrier_ids", row.get("carrier_ids"), carriers, "carrier")
        _check_ref(errors, f"resources[{index}].evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        cited = [evidence.get(ref, {}) for ref in _ids(row.get("evidence_ids"))]
        if row.get("provenance") == "source_attributed" and not _has_source_evidence(row.get("evidence_ids"), evidence):
            _add(errors, "resource.source_provenance", f"resources[{index}].evidence_ids", "source_attributed resource requires observed source evidence")
        if row.get("provenance") == "runtime_created" and not any(item.get("evidence_class") == "observed" and item.get("source_type") in {"runtime_response", "test_result"} for item in cited):
            _add(errors, "resource.creation_provenance", f"resources[{index}].evidence_ids", "runtime_created resource requires observed creation response/test evidence")
        if row.get("provenance") == "runtime_readback" and not any(item.get("evidence_class") == "observed" and item.get("source_type") in {"object_readback", "audit_event"} for item in cited):
            _add(errors, "resource.readback_provenance", f"resources[{index}].evidence_ids", "runtime_readback resource requires observed readback/audit evidence")
    for index, row in enumerate(rows["policy_rules"]):
        path = f"policy_rules[{index}]"
        for field, valid, label in (
            ("subject_identity_ids", identities, "identity"), ("resource_ids", resources, "resource"),
            ("enforcement_point_ids", enforcement, "enforcement point"), ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        for enforcement_id in _ids(row.get("enforcement_point_ids")):
            if row.get("policy_id") not in _ids(maps["enforcement_points"].get(enforcement_id, {}).get("policy_rule_ids")):
                _add(errors, "policy.enforcement_backlink", f"{path}.enforcement_point_ids", f"enforcement point {enforcement_id} does not link back to {row.get('policy_id')}")
    for index, row in enumerate(rows["enforcement_points"]):
        path = f"enforcement_points[{index}]"
        _check_ref(errors, f"{path}.policy_rule_ids", row.get("policy_rule_ids"), policies, "policy")
        _check_ref(errors, f"{path}.operation_ids", row.get("operation_ids"), operations, "operation")
        _check_ref(errors, f"{path}.resource_ids", row.get("resource_ids"), resources, "resource")
        _check_ref(errors, f"{path}.evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
    for index, row in enumerate(rows["operations"]):
        path = f"operations[{index}]"; operation_id = row.get("operation_id")
        for field, valid, label in (
            ("surface_ids", surfaces, "surface"), ("carrier_ids", carriers, "carrier"),
            ("variant_ids", variants, "variant"), ("obligation_ids", obligations, "obligation"),
            ("variant_operation_ids", operations, "operation"), ("continuation_operation_ids", operations, "operation"),
            ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        for surface_id in _ids(row.get("surface_ids")):
            if operation_id not in _ids(maps["surfaces"].get(surface_id, {}).get("operation_ids")):
                _add(errors, "operation.surface_backlink", f"{path}.surface_ids", f"surface {surface_id} does not link back to {operation_id}")
        for variant_id in _ids(row.get("variant_ids")):
            if operation_id not in _ids(maps["variants"].get(variant_id, {}).get("operation_ids")):
                _add(errors, "operation.variant_backlink", f"{path}.variant_ids", f"variant {variant_id} does not link back to {operation_id}")

    for index, row in enumerate(rows["obligations"]):
        path = f"obligations[{index}]"; obligation_id = row.get("obligation_id")
        for field, valid, label in (
            ("operation_id", operations, "operation"), ("resource_id", resources, "resource"),
            ("carrier_ids", carriers, "carrier"), ("policy_rule_ids", policies, "policy"),
            ("enforcement_point_ids", enforcement, "enforcement point"), ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        operation = maps["operations"].get(str(row.get("operation_id")), {})
        if obligation_id not in _ids(operation.get("obligation_ids")):
            _add(errors, "obligation.operation_backlink", f"{path}.operation_id", "owning operation must list this obligation")
        if not set(_ids(row.get("carrier_ids"))).issubset(set(_ids(operation.get("carrier_ids")))):
            _add(errors, "obligation.carrier_scope", f"{path}.carrier_ids", "obligation carriers must be listed on its operation")

    for index, row in enumerate(rows["source_traces"]):
        path = f"source_traces[{index}]"; operation_id = row.get("operation_id")
        _check_ref(errors, f"{path}.operation_id", operation_id, operations, "operation")
        _check_ref(errors, f"{path}.obligation_ids", row.get("obligation_ids"), obligations, "obligation")
        _check_ref(errors, f"{path}.evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        operation_obligations = set(_ids(maps["operations"].get(str(operation_id), {}).get("obligation_ids")))
        if not set(_ids(row.get("obligation_ids"))).issubset(operation_obligations):
            _add(errors, "trace.obligation_scope", f"{path}.obligation_ids", "trace obligations must belong to its operation")
        for hop_index, hop in enumerate(_rows(row.get("hops"))):
            _check_ref(errors, f"{path}.hops[{hop_index}].evidence_ids", hop.get("evidence_ids"), evidence_ids, "evidence")
        hop_rows = _rows(row.get("hops"))
        if row.get("reachability") == "shipped" and hop_rows:
            if hop_rows[0].get("kind") != "entrypoint":
                _add(errors, "trace.entrypoint", f"{path}.hops[0].kind", "shipped trace must start at an entrypoint")
            if hop_rows[-1].get("kind") not in {"repository", "serializer", "worker", "integration", "sink", "other"}:
                _add(errors, "trace.sink", f"{path}.hops[{len(hop_rows)-1}].kind", "shipped trace must end at a protected data/action sink")
        if row.get("reachability") == "shipped" and not _has_source_evidence(row.get("evidence_ids"), evidence):
            _add(errors, "trace.shipped_evidence", f"{path}.evidence_ids", "shipped trace requires observed source/config/schema evidence")
        traced_obligations = [maps["obligations"].get(ref, {}) for ref in _ids(row.get("obligation_ids"))]
        if row.get("control_conclusion") == "gap" and not any(item.get("status") in {"partial", "missing", "bypassable"} for item in traced_obligations):
            _add(errors, "trace.gap_consistency", f"{path}.control_conclusion", "gap trace requires a partial, missing, or bypassable obligation")
        if row.get("control_conclusion") == "enforced" and any(item.get("status") != "enforced" for item in traced_obligations):
            _add(errors, "trace.enforced_consistency", f"{path}.control_conclusion", "enforced trace requires every traced obligation to be enforced")
        if row.get("control_conclusion") == "enforced" and hop_rows and not any(hop.get("restriction_state") == "consumed" for hop in hop_rows):
            _add(errors, "trace.control_consumption", f"{path}.hops", "enforced trace must show the restriction consumed before the sink")

    requirement_cells: dict[str, list[dict[str, Any]]] = {identifier: [] for identifier in requirements}
    for index, row in enumerate(rows["matrix_requirements"]):
        path = f"matrix_requirements[{index}]"; operation_id = row.get("operation_id")
        for field, valid, label in (
            ("operation_id", operations, "operation"), ("required_identity_ids", identities, "identity"),
            ("required_obligation_ids", obligations, "obligation"), ("required_carrier_ids", carriers, "carrier"),
            ("required_variant_ids", variants, "variant"), ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        operation = maps["operations"].get(str(operation_id), {})
        if not set(_ids(row.get("required_obligation_ids"))).issubset(set(_ids(operation.get("obligation_ids")))):
            _add(errors, "matrix_requirement.obligation_scope", f"{path}.required_obligation_ids", "required obligations must belong to the operation")
        if not set(_ids(row.get("required_carrier_ids"))).issubset(set(_ids(operation.get("carrier_ids")))):
            _add(errors, "matrix_requirement.carrier_scope", f"{path}.required_carrier_ids", "required carriers must belong to the operation")
        if not set(_ids(row.get("required_variant_ids"))).issubset(set(_ids(operation.get("variant_ids")))):
            _add(errors, "matrix_requirement.variant_scope", f"{path}.required_variant_ids", "required variants must belong to the operation")

    for index, row in enumerate(rows["matrix"]):
        path = f"matrix[{index}]"; requirement_id = row.get("matrix_requirement_id")
        for field, valid, label in (
            ("matrix_requirement_id", requirements, "matrix requirement"), ("operation_id", operations, "operation"),
            ("caller_identity_id", identities, "identity"), ("target_resource_ids", resources, "resource"),
            ("policy_rule_ids", policies, "policy"), ("covered_obligation_ids", obligations, "obligation"),
            ("covered_carrier_ids", carriers, "carrier"), ("covered_variant_ids", variants, "variant"),
            ("baseline_cell_id", matrix_cells, "matrix cell"), ("source_trace_ids", traces, "source trace"),
            ("validation_test_ids", tests, "validation test"), ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        requirement = maps["matrix_requirements"].get(str(requirement_id), {})
        if isinstance(requirement_id, str):
            requirement_cells.setdefault(requirement_id, []).append(row)
        if requirement and row.get("operation_id") != requirement.get("operation_id"):
            _add(errors, "matrix.requirement_operation", f"{path}.operation_id", "must equal the referenced requirement operation")
        operation = maps["operations"].get(str(row.get("operation_id")), {})
        if not set(_ids(row.get("covered_obligation_ids"))).issubset(set(_ids(operation.get("obligation_ids")))):
            _add(errors, "matrix.obligation_scope", f"{path}.covered_obligation_ids", "covered obligations must belong to the operation")
        if row.get("review_status") == "source_reviewed" and not _ids(row.get("source_trace_ids")):
            _add(errors, "matrix.source_trace_required", f"{path}.source_trace_ids", "source-reviewed cell requires a source trace")
        if row.get("review_status") == "runtime_tested":
            linked = [maps["validation_tests"].get(ref, {}) for ref in _ids(row.get("validation_test_ids"))]
            if not any(test.get("execution_status") in EXECUTED_STATES for test in linked):
                _add(errors, "matrix.executed_test_required", f"{path}.validation_test_ids", "runtime-tested cell requires an executed test")
        if row.get("observed_decision") != "not_observed" and row.get("review_status") != "runtime_tested":
            _add(errors, "matrix.observation_without_test", f"{path}.observed_decision", "runtime-observed decision requires review_status=runtime_tested")
        if basis == "source_only" and row.get("observed_decision") != "not_observed":
            _add(errors, "matrix.source_observation", f"{path}.observed_decision", "source-only review cannot claim a runtime-observed decision")
        if row.get("expected_decision") in {"deny", "conditional"}:
            baseline_id = row.get("baseline_cell_id")
            baseline = maps["matrix"].get(str(baseline_id), {})
            if not baseline:
                _add(errors, "matrix.baseline_required", f"{path}.baseline_cell_id", "deny/conditional case requires an authorized baseline cell")
            elif baseline.get("operation_id") != row.get("operation_id") or baseline.get("expected_decision") not in {"allow", "conditional"}:
                _add(errors, "matrix.baseline_shape", f"{path}.baseline_cell_id", "baseline must use the same operation and expect allow/conditional")
        relationship = row.get("relationship")
        caller = maps["identities"].get(str(row.get("caller_identity_id")), {})
        target_rows = [maps["resources"].get(ref, {}) for ref in _ids(row.get("target_resource_ids"))]
        if relationship == "cross_tenant":
            if not caller.get("tenant") or str(caller.get("tenant")).lower() == "unknown":
                _add(errors, "matrix.cross_tenant_caller", f"{path}.caller_identity_id", "cross-tenant case requires an attributed caller tenant")
            if not target_rows or any(not target.get("tenant") or str(target.get("tenant")).lower() == "unknown" or target.get("tenant") == caller.get("tenant") for target in target_rows):
                _add(errors, "matrix.cross_tenant_target", f"{path}.target_resource_ids", "cross-tenant targets must have attributed tenants different from the caller")
        if relationship == "same_tenant_peer":
            owner_ids = {target.get("owner_identity_id") for target in target_rows}
            if row.get("caller_identity_id") in owner_ids:
                _add(errors, "matrix.peer_ownership", f"{path}.target_resource_ids", "same-tenant peer target cannot be caller-owned")
        if relationship == "own":
            owned_targets = [target for target in target_rows if target.get("owner_identity_id")]
            if owned_targets and any(target.get("owner_identity_id") != row.get("caller_identity_id") for target in owned_targets):
                _add(errors, "matrix.own_ownership", f"{path}.target_resource_ids", "own relationship requires every owner-attributed target resource owner to equal the caller")
            if not owned_targets and (
                not target_rows
                or any(
                    target.get("tenant") != caller.get("tenant")
                    or target.get("authorization_domain") != caller.get("authorization_domain")
                    for target in target_rows
                )
            ):
                _add(errors, "matrix.own_domain", f"{path}.target_resource_ids", "ownerless tenant/domain collections labeled own must match the caller tenant and authorization domain")

    for requirement_id, requirement in maps["matrix_requirements"].items():
        cells = requirement_cells.get(requirement_id, [])
        path = f"matrix_requirements[{list(maps['matrix_requirements']).index(requirement_id)}]"
        represented_identities = {cell.get("caller_identity_id") for cell in cells}
        represented_relationships = {cell.get("relationship") for cell in cells}
        represented_obligations = set().union(*(set(_ids(cell.get("covered_obligation_ids"))) for cell in cells)) if cells else set()
        represented_carriers = set().union(*(set(_ids(cell.get("covered_carrier_ids"))) for cell in cells)) if cells else set()
        represented_variants = set().union(*(set(_ids(cell.get("covered_variant_ids"))) for cell in cells)) if cells else set()
        for field, represented in (
            ("required_identity_ids", represented_identities), ("required_relationships", represented_relationships),
            ("required_obligation_ids", represented_obligations), ("required_carrier_ids", represented_carriers),
            ("required_variant_ids", represented_variants),
        ):
            missing = set(_ids(requirement.get(field))) - represented
            if missing:
                _add(errors, "matrix.requirement_uncovered", f"{path}.{field}", "uncovered required values: " + ", ".join(sorted(missing)))
        if requirement.get("source_review_required") and not any(
            cell.get("review_status") in {"source_reviewed", "runtime_tested"} and _ids(cell.get("source_trace_ids"))
            for cell in cells
        ):
            _add(errors, "matrix.source_review_missing", path, "source-review-required requirement has no source-reviewed cell")
        if requirement.get("runtime_test_required") and not any(cell.get("review_status") == "runtime_tested" for cell in cells):
            _add(errors, "matrix.runtime_test_missing", path, "runtime-test-required requirement has no runtime-tested cell")

    for operation_id, operation in maps["operations"].items():
        if operation.get("intentionally_public") is True:
            continue
        operation_requirements = [row for row in rows["matrix_requirements"] if row.get("operation_id") == operation_id]
        if not operation_requirements:
            _add(errors, "operation.matrix_requirement", "matrix_requirements", f"protected operation {operation_id} requires a matrix requirement")
        if not _ids(operation.get("obligation_ids")):
            _add(errors, "operation.obligation_required", "operations", f"protected operation {operation_id} requires at least one authorization obligation")
        required_obligations = set().union(*(set(_ids(row.get("required_obligation_ids"))) for row in operation_requirements)) if operation_requirements else set()
        missing_obligations = set(_ids(operation.get("obligation_ids"))) - required_obligations
        if missing_obligations:
            _add(errors, "operation.matrix_obligation", "matrix_requirements", f"operation {operation_id} obligations absent from its requirements: " + ", ".join(sorted(missing_obligations)))
        if basis in {"source_only", "hybrid"}:
            operation_traces = [row for row in rows["source_traces"] if row.get("operation_id") == operation_id and row.get("reachability") == "shipped"]
            if not operation_traces:
                _add(errors, "operation.source_trace", "source_traces", f"protected source operation {operation_id} requires a shipped trace")
            traced_obligations = set().union(*(set(_ids(row.get("obligation_ids"))) for row in operation_traces)) if operation_traces else set()
            untraced = set(_ids(operation.get("obligation_ids"))) - traced_obligations
            if untraced:
                _add(errors, "operation.untraced_obligation", "source_traces", f"operation {operation_id} obligations absent from shipped traces: " + ", ".join(sorted(untraced)))

    # Candidate gates and finding linkage.
    candidate_by_finding: dict[str, str] = {}
    for index, row in enumerate(rows["candidates"]):
        path = f"candidates[{index}]"; candidate_id = row.get("candidate_id")
        for field, valid, label in (
            ("operation_id", operations, "operation"), ("caller_identity_id", identities, "identity"),
            ("resource_ids", resources, "resource"), ("obligation_ids", obligations, "obligation"),
            ("matrix_cell_ids", matrix_cells, "matrix cell"), ("policy_rule_ids", policies, "policy"),
            ("enforcement_point_ids", enforcement, "enforcement point"), ("source_trace_ids", traces, "source trace"),
            ("validation_test_ids", tests, "validation test"), ("finding_id", findings, "finding"),
            ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        operation_id = row.get("operation_id")
        if any(maps["obligations"].get(ref, {}).get("operation_id") != operation_id for ref in _ids(row.get("obligation_ids"))):
            _add(errors, "candidate.obligation_scope", f"{path}.obligation_ids", "candidate obligations must belong to its operation")
        if any(maps["matrix"].get(ref, {}).get("operation_id") != operation_id for ref in _ids(row.get("matrix_cell_ids"))):
            _add(errors, "candidate.matrix_scope", f"{path}.matrix_cell_ids", "candidate matrix cells must belong to its operation")
        if any(maps["source_traces"].get(ref, {}).get("operation_id") != operation_id for ref in _ids(row.get("source_trace_ids"))):
            _add(errors, "candidate.trace_scope", f"{path}.source_trace_ids", "candidate source traces must belong to its operation")
        if any(maps["validation_tests"].get(ref, {}).get("operation_id") != operation_id for ref in _ids(row.get("validation_test_ids"))):
            _add(errors, "candidate.test_scope", f"{path}.validation_test_ids", "candidate validation tests must belong to its operation")
        linked_callers = {maps["matrix"].get(ref, {}).get("caller_identity_id") for ref in _ids(row.get("matrix_cell_ids"))}
        if linked_callers and row.get("caller_identity_id") not in linked_callers:
            _add(errors, "candidate.caller_scope", f"{path}.caller_identity_id", "candidate caller must appear in at least one linked matrix cell")
        gate_rows = _rows(row.get("proof_gates")); names = [gate.get("gate") for gate in gate_rows]
        if set(names) != PROOF_GATES or len(names) != len(PROOF_GATES):
            _add(errors, "candidate.proof_gates", f"{path}.proof_gates", "must contain each of the five proof gates exactly once")
        statuses = {gate.get("gate"): gate.get("status") for gate in gate_rows}
        for gate_index, gate in enumerate(gate_rows):
            gate_name = gate.get("gate"); related = set(_ids(gate.get("related_ids")))
            _check_ref(errors, f"{path}.proof_gates[{gate_index}].related_ids", related, all_top_ids, "review subject")
            required_related: set[str] = set()
            if gate_name == "caller":
                required_related = {str(row.get("caller_identity_id"))}
            elif gate_name in {"target", "ownership_or_tenant"}:
                required_related = set(_ids(row.get("resource_ids")))
            elif gate_name == "expected_denial":
                required_related = set(_ids(row.get("policy_rule_ids")))
            elif gate_name == "unauthorized_impact":
                required_related = set(_ids(row.get("obligation_ids"))) | set(_ids(row.get("source_trace_ids"))) | set(_ids(row.get("enforcement_point_ids")))
            if required_related and not related.intersection(required_related):
                _add(errors, "candidate.gate_traceability", f"{path}.proof_gates[{gate_index}].related_ids", f"{gate_name} gate must link an applicable candidate subject")
        disposition = row.get("disposition")
        if disposition in CONFIRMED_DISPOSITIONS and any(statuses.get(gate) != "proven" for gate in PROOF_GATES):
            _add(errors, "candidate.confirmed_gates", f"{path}.proof_gates", "confirmed candidate requires all five gates proven")
        if disposition == "rejected" and "contradicted" not in statuses.values():
            _add(errors, "candidate.rejected_gate", f"{path}.proof_gates", "rejected candidate requires at least one contradicted proof gate")
        if disposition in {"lead", "needs_followup"} and "missing" not in statuses.values():
            _add(errors, "candidate.followup_gate", f"{path}.proof_gates", "lead/follow-up requires at least one missing proof gate")
        if disposition in CONFIRMED_DISPOSITIONS and not row.get("finding_id"):
            _add(errors, "candidate.finding_required", f"{path}.finding_id", "confirmed candidate requires a finding")
        if disposition in CONFIRMED_DISPOSITIONS:
            unattributed = [
                ref for ref in _ids(row.get("resource_ids"))
                if maps["resources"].get(ref, {}).get("provenance") in {"shared_unattributed", "guessed", "unknown"}
            ]
            if unattributed:
                _add(errors, "candidate.unattributed_target", f"{path}.resource_ids", "confirmed candidate cannot rely on unattributed targets: " + ", ".join(sorted(unattributed)))
            linked_policy_rows = [maps["policy_rules"].get(ref, {}) for ref in _ids(row.get("policy_rule_ids"))]
            if not any(policy.get("decision") in {"deny", "conditional"} for policy in linked_policy_rows):
                _add(errors, "candidate.denial_decision", f"{path}.policy_rule_ids", "confirmed expected denial requires a linked deny or conditional policy decision")
        if disposition not in CONFIRMED_DISPOSITIONS and row.get("finding_id") is not None:
            _add(errors, "candidate.unconfirmed_finding", f"{path}.finding_id", "unconfirmed candidate cannot publish a finding")
        if isinstance(row.get("finding_id"), str):
            if row["finding_id"] in candidate_by_finding:
                _add(errors, "candidate.duplicate_finding", f"{path}.finding_id", f"finding is already linked from {candidate_by_finding[row['finding_id']]}")
            else:
                candidate_by_finding[row["finding_id"]] = str(candidate_id)
        if disposition == "source_confirmed":
            linked_traces = [maps["source_traces"].get(ref, {}) for ref in _ids(row.get("source_trace_ids"))]
            linked_obligations = [maps["obligations"].get(ref, {}) for ref in _ids(row.get("obligation_ids"))]
            if not any(trace.get("reachability") == "shipped" and trace.get("control_conclusion") == "gap" for trace in linked_traces):
                _add(errors, "candidate.source_trace_gap", f"{path}.source_trace_ids", "source-confirmed candidate requires a shipped trace with control_conclusion=gap")
            if not any(item.get("status") in {"partial", "missing", "bypassable"} for item in linked_obligations):
                _add(errors, "candidate.source_obligation_gap", f"{path}.obligation_ids", "source-confirmed candidate requires a partial, missing, or bypassable obligation")
            if not _has_source_evidence(row.get("evidence_ids"), evidence):
                _add(errors, "candidate.source_evidence", f"{path}.evidence_ids", "source-confirmed candidate requires observed source evidence")
            linked_policies = [maps["policy_rules"].get(ref, {}) for ref in _ids(row.get("policy_rule_ids"))]
            if not any(policy.get("authority") in {"source_policy", "role_matrix", "documented_requirement", "explicit_context"} for policy in linked_policies):
                _add(errors, "candidate.denial_authority", f"{path}.policy_rule_ids", "confirmed expected denial requires application-specific policy authority, not inference/baseline alone")
            linked_cells = [maps["matrix"].get(ref, {}) for ref in _ids(row.get("matrix_cell_ids"))]
            if any(cell.get("expected_decision") == "unknown" for cell in linked_cells):
                _add(errors, "candidate.unknown_expected_decision", f"{path}.matrix_cell_ids", "confirmed candidate cannot rely on an unknown expected decision")
            for gate_index, gate in enumerate(gate_rows):
                statement = gate.get("statement") if isinstance(gate.get("statement"), dict) else {}
                cited = _claim_sources(statement, evidence)
                supported = _has_source_evidence(statement.get("evidence_ids"), evidence)
                if gate.get("gate") == "expected_denial":
                    supported = supported or any(item.get("evidence_class") == "intended" and item.get("source_type") in INTENDED_SOURCE_TYPES for item in cited)
                if not supported:
                    _add(errors, "candidate.source_gate_evidence", f"{path}.proof_gates[{gate_index}].statement.evidence_ids", "source-confirmed proof gate requires applicable observed source or intended-policy evidence")
            caller = maps["identities"].get(str(row.get("caller_identity_id")), {})
            if caller.get("verification_status") in {"coverage_only", "unusable"}:
                _add(errors, "candidate.unusable_caller", f"{path}.caller_identity_id", "coverage-only/unusable identity cannot prove a confirmed candidate")
        if disposition == "runtime_confirmed":
            executed = [maps["validation_tests"].get(ref, {}) for ref in _ids(row.get("validation_test_ids"))]
            if not any(test.get("execution_status") == "failed" and isinstance(test.get("result"), dict) and test["result"].get("outcome") == "control_failed" for test in executed):
                _add(errors, "candidate.runtime_test", f"{path}.validation_test_ids", "runtime-confirmed candidate requires a failed control_failed test")
            if maps["identities"].get(str(row.get("caller_identity_id")), {}).get("verification_status") not in {"runtime_verified_portable", "runtime_verified_browser_bound"}:
                _add(errors, "candidate.runtime_caller", f"{path}.caller_identity_id", "runtime-confirmed candidate requires a runtime-verified caller")
            for gate_index, gate in enumerate(gate_rows):
                statement = gate.get("statement") if isinstance(gate.get("statement"), dict) else {}
                cited = _claim_sources(statement, evidence)
                if gate.get("gate") == "expected_denial":
                    supported = _has_source_evidence(statement.get("evidence_ids"), evidence) or any(
                        item.get("evidence_class") == "intended" and item.get("source_type") in INTENDED_SOURCE_TYPES for item in cited
                    )
                else:
                    supported = any(
                        item.get("evidence_class") == "observed" and item.get("source_type") in RUNTIME_SOURCE_TYPES
                        for item in cited
                    )
                if not supported:
                    _add(errors, "candidate.runtime_gate_evidence", f"{path}.proof_gates[{gate_index}].statement.evidence_ids", "runtime-confirmed proof gate requires applicable runtime evidence, except expected denial may use application policy")

    for index, row in enumerate(rows["findings"]):
        path = f"findings[{index}]"; finding_id = row.get("finding_id"); candidate_id = row.get("candidate_id")
        for field, valid, label in (
            ("candidate_id", candidates, "candidate"), ("operation_ids", operations, "operation"),
            ("resource_ids", resources, "resource"), ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        candidate = maps["candidates"].get(str(candidate_id), {})
        if candidate.get("finding_id") != finding_id or candidate_by_finding.get(str(finding_id)) != candidate_id:
            _add(errors, "finding.candidate_backlink", f"{path}.candidate_id", "finding and candidate must link to one another exactly")
        expected_basis = {"source_confirmed": "source", "runtime_confirmed": "runtime"}.get(candidate.get("disposition"))
        if row.get("proof_basis") != expected_basis:
            _add(errors, "finding.proof_basis", f"{path}.proof_basis", f"must be {expected_basis or 'absent because candidate is unconfirmed'}")
        if row.get("classification") != candidate.get("classification"):
            _add(errors, "finding.classification", f"{path}.classification", "must equal candidate classification")
        if row.get("severity") != candidate.get("risk"):
            _add(errors, "finding.severity", f"{path}.severity", "must equal the originating candidate risk")
        if row.get("confidence") != candidate.get("confidence"):
            _add(errors, "finding.confidence", f"{path}.confidence", "must equal the originating candidate confidence")
        if not set(_ids(row.get("operation_ids"))).issubset({str(candidate.get("operation_id"))}):
            _add(errors, "finding.operation_scope", f"{path}.operation_ids", "finding operations must match its candidate operation")
        if not set(_ids(row.get("resource_ids"))).issubset(set(_ids(candidate.get("resource_ids")))):
            _add(errors, "finding.resource_scope", f"{path}.resource_ids", "finding resources must be included on its candidate")
        if row.get("proof_basis") == "source" and not _has_source_evidence(row.get("evidence_ids"), evidence):
            _add(errors, "finding.source_evidence", f"{path}.evidence_ids", "source finding requires observed source evidence")
        if row.get("proof_basis") == "runtime" and not _direct_runtime_ids(row.get("evidence_ids"), evidence):
            _add(errors, "finding.runtime_evidence", f"{path}.evidence_ids", "runtime finding requires observed direct runtime evidence")

    # Runtime plans and executed authorization proof.
    target_grants = _rows(runtime_auth.get("targets"))
    grant_request_totals: dict[str, int] = {}
    cleanup_failure_test_ids: set[str] = set()
    for index, row in enumerate(rows["validation_tests"]):
        path = f"validation_tests[{index}]"; test_id = row.get("validation_test_id")
        operation = maps["operations"].get(str(row.get("operation_id")), {})
        caller = maps["identities"].get(str(row.get("caller_identity_id")), {})
        for field, valid, label in (
            ("operation_id", operations, "operation"), ("caller_identity_id", identities, "identity"),
            ("target_resource_ids", resources, "resource"), ("matrix_cell_ids", matrix_cells, "matrix cell"),
            ("evidence_ids", evidence_ids, "evidence"),
        ):
            _check_ref(errors, f"{path}.{field}", row.get(field), valid, label)
        for matrix_id in _ids(row.get("matrix_cell_ids")):
            cell = maps["matrix"].get(matrix_id, {})
            if test_id not in _ids(cell.get("validation_test_ids")):
                _add(errors, "test.matrix_backlink", f"{path}.matrix_cell_ids", f"matrix cell {matrix_id} does not link back to {test_id}")
            if cell.get("operation_id") != row.get("operation_id"):
                _add(errors, "test.matrix_operation", f"{path}.matrix_cell_ids", f"matrix cell {matrix_id} belongs to another operation")
        linked_target_resources = set().union(*(
            set(_ids(maps["matrix"].get(matrix_id, {}).get("target_resource_ids")))
            for matrix_id in _ids(row.get("matrix_cell_ids"))
        )) if _ids(row.get("matrix_cell_ids")) else set()
        if not set(_ids(row.get("target_resource_ids"))).issubset(linked_target_resources):
            _add(errors, "test.target_matrix", f"{path}.target_resource_ids", "test targets must appear in its linked matrix cells")
        for case_name in ("baseline", "attack_case"):
            case = row.get(case_name) if isinstance(row.get(case_name), dict) else {}
            _check_ref(errors, f"{path}.{case_name}.caller_identity_id", case.get("caller_identity_id"), identities, "identity")
        attack_case = row.get("attack_case") if isinstance(row.get("attack_case"), dict) else {}
        if row.get("caller_identity_id") != attack_case.get("caller_identity_id"):
            _add(errors, "test.attack_caller", f"{path}.caller_identity_id", "must equal attack_case.caller_identity_id")
        signals = _rows(row.get("signals")); signal_map = {
            str(signal.get("signal_id")): signal for signal in signals if isinstance(signal.get("signal_id"), str)
        }
        purposes = {signal.get("purpose") for signal in signals}
        missing_purposes = CORE_SIGNAL_PURPOSES - purposes
        if missing_purposes:
            _add(errors, "test.signal_contract", f"{path}.signals", "missing signal purposes: " + ", ".join(sorted(missing_purposes)))
        if len(signal_map) != len(signals):
            _add(errors, "test.signal_duplicate", f"{path}.signals", "signal IDs must be unique within the test")
        for signal_index, signal in enumerate(signals):
            _check_ref(errors, f"{path}.signals[{signal_index}].description.evidence_ids", signal.get("description", {}).get("evidence_ids") if isinstance(signal.get("description"), dict) else None, evidence_ids, "evidence")
        for case_name in ("baseline", "attack_case"):
            case = row.get(case_name) if isinstance(row.get(case_name), dict) else {}
            _check_ref(errors, f"{path}.{case_name}.expected_signal_ids", case.get("expected_signal_ids"), set(signal_map), "test signal")
        purpose_ids = {
            purpose: {sid for sid, signal in signal_map.items() if signal.get("purpose") == purpose}
            for purpose in purposes if isinstance(purpose, str)
        }
        baseline_expected = set(_ids(row.get("baseline", {}).get("expected_signal_ids"))) if isinstance(row.get("baseline"), dict) else set()
        attack_expected = set(_ids(attack_case.get("expected_signal_ids")))
        required_baseline_purposes = {"caller_identity", "owner_target_attribution", "authorized_baseline"}
        required_attack_purposes = CORE_SIGNAL_PURPOSES - {"authorized_baseline"}
        if any(not purpose_ids.get(purpose, set()).intersection(baseline_expected) for purpose in required_baseline_purposes):
            _add(errors, "test.baseline_signal_plan", f"{path}.baseline.expected_signal_ids", "baseline must expect caller, owner/target, and authorized-baseline signals")
        if any(not purpose_ids.get(purpose, set()).intersection(attack_expected) for purpose in required_attack_purposes):
            _add(errors, "test.attack_signal_plan", f"{path}.attack_case.expected_signal_ids", "attack case must expect caller, owner/target, denial, impact, control-success, and control-failure signals")
        safety = row.get("safety") if isinstance(row.get("safety"), dict) else {}
        target = row.get("target") if isinstance(row.get("target"), dict) else {}
        is_state_change = bool(operation.get("state_change"))
        if safety.get("state_change") != is_state_change:
            _add(errors, "test.state_change_mismatch", f"{path}.safety.state_change", "must equal the operation state_change classification")
        allowed_action_classes = {"state_change", "account_lifecycle", "destructive"} if is_state_change else {"read_only"}
        if target.get("action_class") not in allowed_action_classes:
            _add(errors, "test.action_class", f"{path}.target.action_class", "action class does not match the operation's state-change classification")
        disposable = _ids(safety.get("disposable_resource_ids"))
        protected = _ids(safety.get("protected_identity_ids"))
        _check_ref(errors, f"{path}.safety.disposable_resource_ids", disposable, resources, "resource")
        _check_ref(errors, f"{path}.safety.protected_identity_ids", protected, identities, "identity")
        if is_state_change:
            required_state_purposes = {"state_readback", "cleanup"}
            if not required_state_purposes.issubset(purposes):
                _add(errors, "test.state_signals", f"{path}.signals", "state-changing test requires state_readback and cleanup signals")
            if not purpose_ids.get("state_readback", set()).intersection(baseline_expected):
                _add(errors, "test.baseline_readback_plan", f"{path}.baseline.expected_signal_ids", "state-changing baseline must expect authoritative readback")
            if not all(purpose_ids.get(purpose, set()).intersection(attack_expected) for purpose in required_state_purposes):
                _add(errors, "test.attack_state_plan", f"{path}.attack_case.expected_signal_ids", "state-changing attack case must expect readback and cleanup")
            if not disposable or safety.get("synthetic_data") is not True:
                _add(errors, "test.disposable_fixture", f"{path}.safety", "state-changing test requires synthetic disposable resources")
            if not set(_ids(row.get("target_resource_ids"))).issubset(set(disposable)):
                _add(errors, "test.mutable_target_scope", f"{path}.safety.disposable_resource_ids", "every state-changing target resource must be listed as disposable")
            if any(maps["resources"].get(ref, {}).get("safety") != "disposable" for ref in disposable):
                _add(errors, "test.protected_resource", f"{path}.safety.disposable_resource_ids", "every mutable fixture must be marked disposable")
            for steps_field in ("before_state_steps", "readback_steps", "cleanup_steps"):
                if not _ids(safety.get(steps_field)):
                    _add(errors, "test.state_steps", f"{path}.safety.{steps_field}", "state-changing test requires explicit steps")
        execution = row.get("execution_status"); result = row.get("result")
        case_identity_ids = {
            row.get("caller_identity_id"),
            row.get("baseline", {}).get("caller_identity_id") if isinstance(row.get("baseline"), dict) else None,
            attack_case.get("caller_identity_id"),
        } - {None}
        if execution in {"planned", "blocked"} and isinstance(result, dict):
            _add(errors, "test.unexecuted_result", f"{path}.result", f"{execution} test cannot include a result")
        if execution == "blocked" and not isinstance(row.get("blocker"), dict):
            _add(errors, "test.blocker_required", f"{path}.blocker", "blocked test requires a claim-level blocker")
        if execution in EXECUTED_STATES:
            for matrix_id in _ids(row.get("matrix_cell_ids")):
                if maps["matrix"].get(matrix_id, {}).get("review_status") != "runtime_tested":
                    _add(errors, "test.matrix_runtime_status", f"{path}.matrix_cell_ids", f"executed test requires matrix cell {matrix_id} to be runtime_tested")
            if runtime_auth.get("status") != "authorized":
                _add(errors, "test.global_authorization", path, "executed test requires global runtime_authorization.status=authorized")
            protected_case_identities = {
                identity_id for identity_id in case_identity_ids
                if maps["identities"].get(str(identity_id), {}).get("protected_account") is True
            }
            if not protected_case_identities.issubset(set(protected)):
                _add(errors, "test.protected_callers", f"{path}.safety.protected_identity_ids", "every protected assessment identity used as a caller must be listed")
            environment = str(target.get("environment", "")).lower()
            if re.search(r"\b(?:production|prod|live)\b", environment) or not any(word in environment for word in ("local", "staging", "sandbox", "disposable", "isolated", "test")):
                _add(errors, "test.unsafe_environment", f"{path}.target.environment", "executed runtime target must be explicitly local, staging, sandbox, disposable, isolated, or test—not production")
            for case_identity_id in sorted(case_identity_ids):
                case_identity = maps["identities"].get(str(case_identity_id), {})
                if case_identity.get("verification_status") not in {"runtime_verified_portable", "runtime_verified_browser_bound"}:
                    _add(errors, "test.caller_unverified", f"{path}.caller_identity_id", f"executed test identity {case_identity_id} is not runtime verified")
                if target.get("transport") not in set(_ids(case_identity.get("transports"))):
                    _add(errors, "test.transport_identity", f"{path}.target.transport", f"transport is incompatible with identity {case_identity_id}")
                caller_checks = [
                    evidence.get(ref, {}) for ref in _ids(case_identity.get("evidence_ids"))
                    if evidence.get(ref, {}).get("source_type") == "runtime_identity_check"
                ]
                if not any(
                    isinstance(item.get("locator"), dict)
                    and item["locator"].get("target") == target.get("origin")
                    and item["locator"].get("environment") == target.get("environment")
                    and item["locator"].get("transport") == target.get("transport")
                    for item in caller_checks
                ):
                    _add(
                        errors,
                        "test.identity_target",
                        f"{path}.caller_identity_id",
                        f"identity {case_identity_id} lacks a same-target, same-environment, same-transport runtime identity check",
                    )
            matching_grants = [
                grant for grant in target_grants
                if grant.get("origin") == target.get("origin")
                and grant.get("environment") == target.get("environment")
                and target.get("transport") in _ids(grant.get("transports"))
                and target.get("action_class") in _ids(grant.get("allowed_action_classes"))
                and bool(_ids(grant.get("allowed_identity_ids")))
                and case_identity_ids.issubset(set(_ids(grant.get("allowed_identity_ids"))))
                and row.get("operation_id") in _ids(grant.get("operation_ids"))
                and set(_ids(operation.get("surface_ids"))).issubset(set(_ids(grant.get("surface_ids"))))
                and set(_ids(row.get("target_resource_ids"))).issubset(set(_ids(grant.get("resource_ids"))))
            ]
            scoped_grants: list[dict[str, Any]] = []
            identity_rows = [maps["identities"].get(str(item), {}) for item in case_identity_ids]
            target_rows = [maps["resources"].get(ref, {}) for ref in _ids(row.get("target_resource_ids"))]
            used_tenants = {str(item.get("tenant")) for item in identity_rows + target_rows if item.get("tenant")}
            used_domains = {str(item.get("authorization_domain")) for item in identity_rows + target_rows if item.get("authorization_domain")}
            for grant in matching_grants:
                allowed_tenants = set(_ids(grant.get("allowed_tenants")))
                allowed_domains = set(_ids(grant.get("allowed_authorization_domains")))
                if allowed_tenants and not used_tenants.issubset(allowed_tenants):
                    continue
                if allowed_domains and not used_domains.issubset(allowed_domains):
                    continue
                mutation_scope = grant.get("mutation_scope") if isinstance(grant.get("mutation_scope"), dict) else {}
                if is_state_change:
                    if mutation_scope.get("state_change_allowed") is not True:
                        continue
                    if not set(_ids(row.get("target_resource_ids"))).issubset(set(_ids(mutation_scope.get("allowed_resource_ids")))):
                        continue
                    allowed_carriers = set(_ids(mutation_scope.get("allowed_carrier_ids")))
                    if allowed_carriers and not set(_ids(operation.get("carrier_ids"))).issubset(allowed_carriers):
                        continue
                if row.get("max_attempts", 0) > grant.get("max_attempts_per_test", 0):
                    continue
                scoped_grants.append(grant)
            if len(scoped_grants) != 1:
                _add(errors, "test.target_authorization", f"{path}.target", "executed test requires exactly one authorization target covering operation, interface, resources, tenant/domain, mutation scope, identities, transport, and limits")
            matching_grant = scoped_grants[0] if len(scoped_grants) == 1 else None
            if isinstance(result, dict) and matching_grant:
                try:
                    valid_from = datetime.fromisoformat(str(matching_grant.get("valid_from", "")).replace("Z", "+00:00"))
                    expiry = datetime.fromisoformat(str(matching_grant.get("expires_at", "")).replace("Z", "+00:00"))
                    executed_at = datetime.fromisoformat(str(result.get("executed_at", "")).replace("Z", "+00:00"))
                    if executed_at < valid_from or executed_at > expiry:
                        _add(errors, "test.authorization_window", f"{path}.result.executed_at", "test executed outside the authorization target's validity window")
                    if global_authorization_expiry is not None and executed_at > global_authorization_expiry:
                        _add(errors, "test.global_authorization_expired", f"{path}.result.executed_at", "test executed after the global runtime authorization expired")
                except (TypeError, ValueError):
                    pass
                if result.get("attempt_count", 0) > matching_grant.get("max_attempts_per_test", 0):
                    _add(errors, "test.authorization_attempt_limit", f"{path}.result.attempt_count", "exceeds the authorization target's attempt limit")
                if result.get("request_count", 0) > matching_grant.get("max_requests", 0):
                    _add(errors, "test.authorization_request_limit", f"{path}.result.request_count", "exceeds the authorization target's request limit")
                grant_id = str(matching_grant.get("authorization_target_id", ""))
                request_count = result.get("request_count")
                if grant_id and isinstance(request_count, int):
                    grant_request_totals[grant_id] = grant_request_totals.get(grant_id, 0) + request_count
                    if grant_request_totals[grant_id] > matching_grant.get("max_requests", 0):
                        _add(
                            errors,
                            "test.authorization_request_budget",
                            f"{path}.result.request_count",
                            f"cumulative requests for authorization target {grant_id} exceed its max_requests budget",
                        )
        if isinstance(result, dict):
            _check_ref(errors, f"{path}.result.observed_signal_ids", result.get("observed_signal_ids"), set(signal_map), "test signal")
            _check_ref(errors, f"{path}.result.evidence_ids", result.get("evidence_ids"), evidence_ids, "evidence")
            observed = set(_ids(result.get("observed_signal_ids")))
            foundational = {
                sid for sid, signal in signal_map.items()
                if signal.get("purpose") in {"caller_identity", "owner_target_attribution", "authorized_baseline"}
            }
            held = {sid for sid, signal in signal_map.items() if signal.get("purpose") in {"expected_denial", "control_success"}}
            failed = {sid for sid, signal in signal_map.items() if signal.get("purpose") in {"unauthorized_impact", "control_failure"}}
            expected_outcome = {"passed": "control_held", "failed": "control_failed", "inconclusive": "inconclusive"}.get(execution)
            if isinstance(result.get("attempt_count"), int) and result.get("attempt_count", 0) > row.get("max_attempts", 0):
                _add(errors, "test.attempt_limit", f"{path}.result.attempt_count", "cannot exceed the planned max_attempts")
            if expected_outcome and result.get("outcome") != expected_outcome:
                _add(errors, "test.result_outcome", f"{path}.result.outcome", f"{execution} execution requires outcome={expected_outcome}")
            if execution == "passed":
                if not foundational.issubset(observed) or not held.issubset(observed) or observed & failed:
                    _add(errors, "test.outcome_signals", f"{path}.result.observed_signal_ids", "passed result requires denial/control-success and forbids impact/control-failure signals")
            elif execution == "failed":
                if not foundational.issubset(observed) or not failed.issubset(observed) or observed & held:
                    _add(errors, "test.outcome_signals", f"{path}.result.observed_signal_ids", "failed result requires impact/control-failure and forbids denial/control-success signals")
            elif execution == "inconclusive" and (held.issubset(observed) or failed.issubset(observed)):
                _add(errors, "test.inconclusive_signals", f"{path}.result.observed_signal_ids", "inconclusive result cannot carry a complete conclusive signal pair")
            direct = _direct_runtime_ids(result.get("evidence_ids"), evidence)
            if execution in EXECUTED_STATES and not direct:
                _add(errors, "test.direct_evidence", f"{path}.result.evidence_ids", "executed result requires observed direct runtime evidence")
            mismatched_direct = [
                ref for ref in direct
                if not isinstance(evidence[ref].get("locator"), dict)
                or evidence[ref]["locator"].get("target") != target.get("origin")
                or evidence[ref]["locator"].get("environment") != target.get("environment")
                or evidence[ref]["locator"].get("transport") != target.get("transport")
            ]
            if mismatched_direct:
                _add(
                    errors,
                    "test.evidence_target",
                    f"{path}.result.evidence_ids",
                    "direct evidence must equal the exact test origin, environment, and transport: "
                    + ", ".join(sorted(mismatched_direct)),
                )
            result_evidence = set(_ids(result.get("evidence_ids")))
            result_run_id = result.get("run_id")
            try:
                executed_at = datetime.fromisoformat(str(result.get("executed_at", "")).replace("Z", "+00:00"))
            except (TypeError, ValueError):
                executed_at = None
            runtime_result_ids = {
                ref for ref in result_evidence if evidence.get(ref, {}).get("source_type") in RUNTIME_SOURCE_TYPES
            }
            for ref in sorted(runtime_result_ids):
                item = evidence.get(ref, {})
                locator = item.get("locator") if isinstance(item.get("locator"), dict) else {}
                if locator.get("run_id") != result_run_id:
                    _add(errors, "test.evidence_run", f"{path}.result.evidence_ids", f"runtime evidence {ref} is not from result run {result_run_id}")
                if (
                    locator.get("target") != target.get("origin")
                    or locator.get("environment") != target.get("environment")
                    or locator.get("transport") != target.get("transport")
                ):
                    _add(
                        errors,
                        "test.evidence_scope",
                        f"{path}.result.evidence_ids",
                        f"runtime evidence {ref} does not match the result target, environment, and transport",
                    )
                if executed_at is not None:
                    try:
                        collected_at = datetime.fromisoformat(str(item.get("collected_at", "")).replace("Z", "+00:00"))
                        if abs((collected_at - executed_at).total_seconds()) > 1800:
                            _add(errors, "test.evidence_freshness", f"{path}.result.evidence_ids", f"runtime evidence {ref} is more than 30 minutes from execution")
                    except (TypeError, ValueError):
                        pass
            preflight_ids = set(_ids(result.get("identity_preflight_evidence_ids")))
            if not preflight_ids.issubset(result_evidence):
                _add(errors, "test.preflight_result_evidence", f"{path}.result.identity_preflight_evidence_ids", "identity preflight evidence must also be listed on the result")
            for ref in sorted(preflight_ids):
                item = evidence.get(ref, {})
                locator = item.get("locator") if isinstance(item.get("locator"), dict) else {}
                if item.get("evidence_class") != "observed" or item.get("source_type") != "runtime_identity_check":
                    _add(errors, "test.preflight_type", f"{path}.result.identity_preflight_evidence_ids", f"{ref} must be observed runtime_identity_check evidence")
                if (
                    locator.get("run_id") != result_run_id
                    or locator.get("target") != target.get("origin")
                    or locator.get("environment") != target.get("environment")
                    or locator.get("transport") != target.get("transport")
                ):
                    _add(
                        errors,
                        "test.preflight_run",
                        f"{path}.result.identity_preflight_evidence_ids",
                        f"{ref} must use the result run and exact target, environment, and transport",
                    )
                if executed_at is not None:
                    try:
                        collected_at = datetime.fromisoformat(str(item.get("collected_at", "")).replace("Z", "+00:00"))
                        age = (executed_at - collected_at).total_seconds()
                        if age < 0 or age > 900:
                            _add(errors, "test.preflight_freshness", f"{path}.result.identity_preflight_evidence_ids", f"{ref} must be collected during the 15 minutes immediately before execution")
                    except (TypeError, ValueError):
                        pass
            if execution in EXECUTED_STATES:
                for case_identity_id in sorted(case_identity_ids):
                    identity_evidence = set(_ids(maps["identities"].get(str(case_identity_id), {}).get("evidence_ids")))
                    if not preflight_ids.intersection(identity_evidence):
                        _add(errors, "test.identity_preflight", f"{path}.result.identity_preflight_evidence_ids", f"no same-run preflight evidence is bound to identity {case_identity_id}")
            signal_evidence_rows = _rows(result.get("signal_evidence"))
            signal_evidence_map: dict[str, set[str]] = {}
            for item in signal_evidence_rows:
                signal_id = item.get("signal_id")
                if isinstance(signal_id, str):
                    if signal_id in signal_evidence_map:
                        _add(errors, "test.signal_evidence_duplicate", f"{path}.result.signal_evidence", f"duplicate evidence mapping for {signal_id}")
                    signal_evidence_map[signal_id] = set(_ids(item.get("evidence_ids")))
                _check_ref(errors, f"{path}.result.signal_evidence", item.get("evidence_ids"), evidence_ids, "evidence")
            if set(signal_evidence_map) != observed:
                _add(errors, "test.signal_evidence_coverage", f"{path}.result.signal_evidence", "must map every and only observed signal ID")
            for signal_id, mapped_ids in signal_evidence_map.items():
                if not mapped_ids or not mapped_ids.issubset(result_evidence):
                    _add(errors, "test.signal_evidence_result", f"{path}.result.signal_evidence", f"{signal_id} evidence must be non-empty and included on the result")
                runtime_mapped = {
                    ref for ref in mapped_ids
                    if evidence.get(ref, {}).get("evidence_class") == "observed"
                    and evidence.get(ref, {}).get("source_type") in RUNTIME_SOURCE_TYPES
                }
                if not runtime_mapped:
                    _add(errors, "test.signal_evidence_runtime", f"{path}.result.signal_evidence", f"{signal_id} requires observed runtime evidence")
                other_ids = set().union(*(ids for other, ids in signal_evidence_map.items() if other != signal_id)) if len(signal_evidence_map) > 1 else set()
                if not runtime_mapped - other_ids:
                    _add(errors, "test.signal_evidence_specific", f"{path}.result.signal_evidence", f"{signal_id} needs at least one purpose-specific evidence record not reused by another observed signal")
            for signal_id in sorted(observed):
                description = signal_map.get(signal_id, {}).get("description", {})
                cited_ids = set(_ids(description.get("evidence_ids"))) if isinstance(description, dict) else set()
                cited_runtime = {
                    ref for ref in cited_ids
                    if evidence.get(ref, {}).get("evidence_class") == "observed"
                    and evidence.get(ref, {}).get("source_type") in RUNTIME_SOURCE_TYPES
                }
                if description.get("evidence_class") != "observed" or not cited_runtime:
                    _add(errors, "test.observed_signal_evidence", f"{path}.signals", f"observed signal {signal_id} requires an observed runtime-evidence description")
                if not cited_runtime.issubset(result_evidence):
                    _add(errors, "test.signal_result_evidence", f"{path}.result.evidence_ids", f"result must include runtime evidence cited by observed signal {signal_id}")
            summary_evidence = set(_ids(result.get("summary", {}).get("evidence_ids"))) if isinstance(result.get("summary"), dict) else set()
            if not summary_evidence or not summary_evidence.issubset(set(_ids(result.get("evidence_ids")))) or not summary_evidence.intersection(direct):
                _add(errors, "test.summary_evidence", f"{path}.result.summary.evidence_ids", "result summary must cite direct evidence also listed on the result")
            if is_state_change:
                readback_ids = {sid for sid, signal in signal_map.items() if signal.get("purpose") == "state_readback"}
                cleanup_ids = {sid for sid, signal in signal_map.items() if signal.get("purpose") == "cleanup"}
                if not readback_ids.intersection(observed) or not cleanup_ids.intersection(observed):
                    _add(errors, "test.state_result", f"{path}.result.observed_signal_ids", "executed state change requires observed readback and cleanup signals")
                if result.get("cleanup_status") == "not_required":
                    _add(errors, "test.cleanup_required", f"{path}.result.cleanup_status", "state-changing result cannot mark cleanup not_required")
                elif result.get("cleanup_status") in {"incomplete", "failed"} and isinstance(test_id, str):
                    cleanup_failure_test_ids.add(test_id)
            elif result.get("cleanup_status") not in {"not_required", "complete"}:
                if isinstance(test_id, str):
                    cleanup_failure_test_ids.add(test_id)
        # Runtime-confirmed failures must be repeatable with a fresh control.
        linked_runtime_candidate = any(
            candidate.get("disposition") == "runtime_confirmed" and test_id in _ids(candidate.get("validation_test_ids"))
            for candidate in rows["candidates"]
        )
        if linked_runtime_candidate and isinstance(result, dict):
            if result.get("attempt_count", 0) < 2 or result.get("fresh_control_repeated") is not True:
                _add(errors, "test.runtime_repetition", f"{path}.result", "runtime-confirmed failure requires at least two attempts and a repeated fresh authorized control")

    execution_states = [row.get("execution_status") for row in rows["validation_tests"]]
    if any(state in EXECUTED_STATES for state in execution_states) and scope.get("runtime_in_scope") is not True:
        _add(errors, "scope.runtime_execution", "scope.runtime_in_scope", "executed tests require runtime_in_scope=true")
    if basis == "source_only":
        if assurance != "source_observed":
            _add(errors, "assurance.source_only", "metadata.assurance_status", "source-only review requires source_observed assurance")
        if any(state in EXECUTED_STATES for state in execution_states) or any(row.get("proof_basis") == "runtime" for row in rows["findings"]):
            _add(errors, "assurance.source_runtime_claim", "metadata.analysis_basis", "source-only review cannot contain executed tests or runtime findings")
    if basis == "runtime_only" and not any(state in EXECUTED_STATES for state in execution_states):
        _add(errors, "assurance.runtime_only_execution", "metadata.analysis_basis", "runtime-only review requires at least one executed test")
    if assurance in {"partially_runtime_validated", "runtime_validated"} and not any(state in EXECUTED_STATES for state in execution_states):
        _add(errors, "assurance.runtime_evidence", "metadata.assurance_status", "runtime assurance requires an executed test")
    if assurance == "source_observed" and any(state in EXECUTED_STATES for state in execution_states):
        _add(errors, "assurance.understated", "metadata.assurance_status", "executed tests require partial or full runtime assurance")
    if assurance == "runtime_validated" and (not execution_states or any(state not in {"passed", "failed"} for state in execution_states)):
        _add(errors, "assurance.not_conclusive", "metadata.assurance_status", "runtime_validated requires every validation test to be conclusive")

    # Coverage inventory must be exact; absence cannot masquerade as completion.
    inventory = coverage.get("inventory") if isinstance(coverage.get("inventory"), dict) else {}
    operation_inventory_ref = inventory.get("operation_inventory_evidence_id")
    _check_ref(errors, "coverage.inventory.operation_inventory_evidence_id", operation_inventory_ref, evidence_ids, "evidence")
    inventory_evidence = evidence.get(operation_inventory_ref, {}) if isinstance(operation_inventory_ref, str) else {}
    if inventory_evidence.get("evidence_class") != "observed" or inventory_evidence.get("source_type") not in {"source_code", "api_specification", "graphql_schema", "configuration", "traffic_capture"}:
        _add(errors, "coverage.operation_inventory_evidence", "coverage.inventory.operation_inventory_evidence_id", "operation inventory must cite observed route/schema/config/traffic evidence")
    required_sections = (
        "surfaces", "carriers", "variants", "identities", "resources", "policy_rules",
        "enforcement_points", "operations", "obligations", "source_traces",
        "matrix_requirements", "matrix", "candidates", "findings", "validation_tests",
    )
    automatically_required = set().union(*(set(maps[section]) for section in required_sections))
    expected_subjects = set(_ids(inventory.get("expected_subject_ids")))
    if expected_subjects != automatically_required:
        missing = sorted(automatically_required - expected_subjects); extra = sorted(expected_subjects - automatically_required)
        details = []
        if missing: details.append("missing " + ", ".join(missing))
        if extra: details.append("unexpected " + ", ".join(extra))
        _add(errors, "coverage.inventory_exact", "coverage.inventory.expected_subject_ids", "; ".join(details) or "must exactly match modeled subjects")
    covered: list[str] = []
    coverage_by_subject: dict[str, dict[str, Any]] = {}
    declared_exclusions = set(_ids(repository.get("excluded_paths"))) | set(_ids(scope.get("excluded_interfaces")))
    for index, row in enumerate(coverage_rows):
        path = f"coverage.items[{index}]"
        _check_ref(errors, f"{path}.subject_ids", row.get("subject_ids"), automatically_required, "coverage subject")
        _check_ref(errors, f"{path}.evidence_ids", row.get("evidence_ids"), evidence_ids, "evidence")
        for subject_id in _ids(row.get("subject_ids")):
            covered.append(subject_id); coverage_by_subject[subject_id] = row
        if row.get("status") in {"deferred_with_specific_reason", "out_of_scope"} and len(_claim_text(row.get("reason"))) < 20:
            _add(errors, "coverage.generic_reason", f"{path}.reason", "deferred/out-of-scope coverage requires a concrete specific reason")
        if row.get("status") == "out_of_scope" and row.get("scope_exclusion") not in declared_exclusions:
            _add(errors, "coverage.undeclared_exclusion", f"{path}.scope_exclusion", "must exactly match a declared repository path or interface exclusion")
        if row.get("status") != "out_of_scope" and row.get("scope_exclusion") is not None:
            _add(errors, "coverage.unused_exclusion", f"{path}.scope_exclusion", "is only valid for out_of_scope coverage")
    duplicate_coverage = sorted({identifier for identifier in covered if covered.count(identifier) > 1})
    if duplicate_coverage:
        _add(errors, "coverage.duplicate_subject", "coverage.items", "subject appears in multiple rows: " + ", ".join(duplicate_coverage))
    if set(covered) != expected_subjects:
        missing = sorted(expected_subjects - set(covered)); extra = sorted(set(covered) - expected_subjects)
        details = []
        if missing: details.append("missing " + ", ".join(missing))
        if extra: details.append("unexpected " + ", ".join(extra))
        _add(errors, "coverage.reconciliation", "coverage.items", "; ".join(details))
    calculated_unread = sum(
        1 for row in coverage_rows
        if row.get("status") in {"pending", "deferred_with_specific_reason", "out_of_scope"}
        and row.get("risk_if_unreviewed") in {"critical", "high"}
    )
    if coverage.get("unread_high_risk_count") != calculated_unread:
        _add(errors, "coverage.count", "coverage.unread_high_risk_count", f"must equal calculated value {calculated_unread}")
    for candidate_id, candidate in maps["candidates"].items():
        if candidate.get("disposition") in {"lead", "needs_followup"} and candidate.get("risk") in {"critical", "high"}:
            row = coverage_by_subject.get(candidate_id, {})
            if row.get("status") not in {"pending", "deferred_with_specific_reason", "out_of_scope"}:
                _add(errors, "coverage.open_candidate", "coverage.items", f"unresolved high-risk candidate {candidate_id} must remain pending/deferred/out-of-scope")
    for test_id in sorted(cleanup_failure_test_ids):
        row = coverage_by_subject.get(test_id, {})
        if row.get("status") not in {"pending", "deferred_with_specific_reason"} or row.get("risk_if_unreviewed") not in {"critical", "high"}:
            _add(errors, "coverage.cleanup_failure", "coverage.items", f"cleanup failure for {test_id} requires pending/deferred critical/high coverage")
    coverage_status_for_matrix = {
        "blocked": {"pending"},
        "deferred": {"deferred_with_specific_reason"},
        "out_of_scope": {"out_of_scope"},
        "not_applicable": {"not_applicable"},
    }
    for matrix_id, cell in maps["matrix"].items():
        allowed_statuses = coverage_status_for_matrix.get(str(cell.get("review_status")))
        coverage_row = coverage_by_subject.get(matrix_id, {})
        if allowed_statuses and coverage_row.get("status") not in allowed_statuses:
            _add(errors, "coverage.matrix_status", "coverage.items", f"matrix cell {matrix_id} with review_status={cell.get('review_status')} requires coverage status {', '.join(sorted(allowed_statuses))}")
        if cell.get("review_status") in {"blocked", "deferred", "out_of_scope"}:
            requirement_risk = maps["matrix_requirements"].get(str(cell.get("matrix_requirement_id")), {}).get("risk_if_unreviewed")
            if RISK_RANK.get(str(coverage_row.get("risk_if_unreviewed")), -1) < RISK_RANK.get(str(requirement_risk), -1):
                _add(errors, "coverage.matrix_risk", "coverage.items", f"coverage for {matrix_id} cannot downgrade requirement risk {requirement_risk}")
    coverage_status_for_surface = {
        "deferred": {"pending", "deferred_with_specific_reason"},
        "excluded": {"out_of_scope"},
    }
    for surface_id, surface in maps["surfaces"].items():
        allowed_statuses = coverage_status_for_surface.get(str(surface.get("disposition")))
        if allowed_statuses and coverage_by_subject.get(surface_id, {}).get("status") not in allowed_statuses:
            _add(errors, "coverage.surface_status", "coverage.items", f"surface {surface_id} disposition requires coverage status {', '.join(sorted(allowed_statuses))}")
    if review_status == "complete" and calculated_unread:
        _add(errors, "coverage.complete_conflict", "metadata.review_status", "complete review cannot retain high-risk pending/deferred/out-of-scope coverage")
    if review_status == "incomplete_high_risk_coverage" and calculated_unread == 0:
        _add(warnings, "coverage.incomplete_without_gap", "metadata.review_status", "no high-risk coverage row explains the incomplete status")

    # Questions and independent challenge/quality release gate.
    for index, row in enumerate(rows["questions"]):
        path = f"questions[{index}]"
        _check_ref(errors, f"{path}.related_ids", row.get("related_ids"), all_top_ids, "review subject")
        if row.get("status") == "answered" and not isinstance(row.get("answer"), dict):
            _add(errors, "question.answer_required", f"{path}.answer", "answered question requires a claim-level answer")
        if review_status == "complete" and row.get("blocking") is True and row.get("status") != "answered":
            _add(errors, "question.complete_conflict", path, "complete review cannot retain an unanswered blocking question")
    for test_id in sorted(cleanup_failure_test_ids):
        if not any(row.get("blocking") is True and row.get("status") != "answered" and test_id in _ids(row.get("related_ids")) for row in rows["questions"]):
            _add(errors, "question.cleanup_residual", "questions", f"cleanup failure for {test_id} requires an open blocking residual-state question")

    challenge_rows = _rows(quality.get("challenge_findings"))
    challenge_ids = {row.get("finding_id") for row in challenge_rows if isinstance(row.get("finding_id"), str)}
    for index, row in enumerate(challenge_rows):
        _check_ref(errors, f"quality_review.challenge_findings[{index}].related_ids", row.get("related_ids"), all_top_ids, "review subject")
    calculated_unresolved = {
        str(row.get("finding_id")) for row in challenge_rows
        if row.get("status") == "open" and row.get("severity") in {"critical", "high"}
    }
    declared_unresolved = set(_ids(quality.get("unresolved_high_severity_finding_ids")))
    _check_ref(errors, "quality_review.unresolved_high_severity_finding_ids", declared_unresolved, set(filter(None, challenge_ids)), "challenge finding")
    if declared_unresolved != calculated_unresolved:
        _add(errors, "quality.unresolved_reconciliation", "quality_review.unresolved_high_severity_finding_ids", "must exactly equal open critical/high challenge findings")
    gates = _rows(quality.get("gates")); gate_names = [gate.get("gate") for gate in gates]
    if set(gate_names) != QUALITY_GATES or len(gate_names) != len(QUALITY_GATES):
        _add(errors, "quality.gate_set", "quality_review.gates", "must contain each of the eleven quality gates exactly once")
    valid_not_applicable: set[str] = set()
    for index, gate in enumerate(gates):
        if gate.get("status") != "not_applicable":
            continue
        if gate.get("gate") == "source_trace" and basis == "runtime_only":
            valid_not_applicable.add("source_trace")
        else:
            _add(errors, "quality.invalid_not_applicable", f"quality_review.gates[{index}].status", "only source_trace may be not_applicable, and only for runtime-only review")
    checks = quality.get("checks") if isinstance(quality.get("checks"), dict) else {}
    if quality.get("status") == "pass":
        if cleanup_failure_test_ids:
            _add(errors, "quality.cleanup_failure", "quality_review.status", "quality cannot pass while runtime cleanup is incomplete or failed")
        if declared_unresolved:
            _add(errors, "quality.pass_unresolved", "quality_review.unresolved_high_severity_finding_ids", "passing challenge cannot retain unresolved critical/high findings")
        for key, value in checks.items():
            if value is not True:
                _add(errors, "quality.check", f"quality_review.checks.{key}", "must be true for a passing quality review")
        for index, gate in enumerate(gates):
            if gate.get("status") != "passed" and gate.get("gate") not in valid_not_applicable:
                _add(errors, "quality.gate", f"quality_review.gates[{index}].status", "must pass before quality status can be pass")
    if review_status == "complete" and quality.get("status") != "pass":
        _add(errors, "quality.complete_conflict", "quality_review.status", "complete review requires a passing independent quality review")
    if cleanup_failure_test_ids and review_status != "incomplete_high_risk_coverage":
        _add(errors, "review.cleanup_failure", "metadata.review_status", "cleanup failure requires incomplete_high_risk_coverage status")

    # No source-only language may imply deployed exploitation; no output may retain secrets.
    for path, value in _iter(data):
        if not isinstance(value, str):
            continue
        if _has_forbidden_wording(value):
            _add(errors, "language.overclaim", path, "uses forbidden secure/no-vulnerabilities/exploit-confirmation wording")
        if any(pattern.search(value) for pattern in SECRET_PATTERNS):
            _add(errors, "secret.unredacted", path, "appears to contain an unredacted key, token, or credential")
        if basis == "source_only" and _source_runtime_overclaim(value):
            _add(errors, "language.source_runtime_overclaim", path, "source-only review language implies that runtime validation occurred")

    errors.sort(key=lambda item: (item.path, item.code, item.message))
    warnings.sort(key=lambda item: (item.path, item.code, item.message))
    return errors, warnings


def validate(data: Any, strict: bool = False) -> tuple[list[str], list[str]]:
    """Return formatted errors and warnings for callers such as the renderer."""
    errors, warnings = validate_model(data)
    if strict and warnings:
        return [item.format("ERROR") for item in errors], [item.format("WARNING") for item in warnings]
    return [item.format("ERROR") for item in errors], [item.format("WARNING") for item in warnings]


def load_review(path: Path | str) -> Any:
    if str(path) == "-":
        return json.load(sys.stdin)
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("review", type=Path, help="canonical access-control review JSON")
    parser.add_argument("--strict", action="store_true", help="treat warnings as validation failures")
    parser.add_argument("--json", action="store_true", dest="json_output", help="emit machine-readable diagnostics")
    args = parser.parse_args(argv)
    try:
        review = load_review(args.review)
        errors, warnings = validate_model(review)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, RecursionError, ValueError, TypeError, AttributeError, KeyError) as exc:
        errors, warnings = [Diagnostic("input.invalid", "", str(exc))], []
    failed = bool(errors) or (args.strict and bool(warnings))
    if args.json_output:
        print(json.dumps({
            "valid": not failed,
            "strict": args.strict,
            "errors": [item.to_dict() for item in errors],
            "warnings": [item.to_dict() for item in warnings],
        }, indent=2, sort_keys=True))
    else:
        for item in warnings:
            print(item.format("WARNING"), file=sys.stderr)
        for item in errors:
            print(item.format("ERROR"), file=sys.stderr)
        stream = sys.stderr if failed else sys.stdout
        print(f"{'FAIL' if failed else 'PASS'}: {len(errors)} error(s), {len(warnings)} warning(s)", file=stream)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
