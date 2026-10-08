#!/usr/bin/env python3
"""Render a validated Tahr access-control review into deterministic artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence


ARTIFACT_NAMES = (
    "access-control-review.md",
    "validation-plan.json",
    "findings.json",
    "coverage.json",
)
RISK_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
ID_FIELDS = {
    "evidence": "evidence_id",
    "surfaces": "surface_id",
    "identities": "identity_id",
    "resources": "resource_id",
    "policy_rules": "policy_id",
    "enforcement_points": "enforcement_point_id",
    "carriers": "carrier_id",
    "variants": "variant_id",
    "operations": "operation_id",
    "obligations": "obligation_id",
    "source_traces": "source_trace_id",
    "matrix_requirements": "matrix_requirement_id",
    "matrix": "matrix_cell_id",
    "candidates": "candidate_id",
    "findings": "finding_id",
    "validation_tests": "validation_test_id",
    "questions": "question_id",
}


def _artifact_context(data: dict[str, Any], canonical_input_sha256: str) -> dict[str, Any]:
    inventory = data.get("coverage", {}).get("inventory", {})
    manifest = inventory.get("source_manifest") if isinstance(inventory, dict) else None
    source_manifest = None
    if isinstance(manifest, dict):
        source_manifest = {
            "evidence_id": manifest.get("evidence_id"),
            "revision": manifest.get("revision"),
            "content_hash": manifest.get("content_hash"),
        }
    return {
        "canonical_input_sha256": canonical_input_sha256,
        "source_manifest": source_manifest,
    }


def _claim(value: Any) -> str:
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


def _id_text(value: Any) -> str:
    return ", ".join(_ids(value))


def _claim_trace(value: Any) -> str:
    statement = _claim(value)
    if not isinstance(value, dict):
        return statement
    trace = []
    if isinstance(value.get("claim_id"), str):
        trace.append(value["claim_id"])
    evidence = _ids(value.get("evidence_ids"))
    if evidence:
        trace.append("evidence: " + ", ".join(evidence))
    return statement + (" [" + "; ".join(trace) + "]" if trace else "")


def _claims(values: Any) -> str:
    if not isinstance(values, list):
        return _claim_trace(values)
    return "; ".join(filter(None, (_claim_trace(value) for value in values)))


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, list):
        return "; ".join(filter(None, (_text(item) for item in value)))
    if isinstance(value, dict):
        return _claim_trace(value) or json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
    return str(value)


def _md(value: Any) -> str:
    return _text(value).replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def _table(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> str:
    materialized = [[_md(cell) or "—" for cell in row] for row in rows]
    if not materialized:
        return "_No records._\n"
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in materialized)
    return "\n".join(lines) + "\n"


def _records(data: dict[str, Any], section: str) -> list[dict[str, Any]]:
    value = data.get(section, [])
    rows = [row for row in value if isinstance(row, dict)] if isinstance(value, list) else []
    identifier = ID_FIELDS[section]
    return sorted(rows, key=lambda row: str(row.get(identifier, "")))


def _finding_order(row: dict[str, Any]) -> tuple[int, str]:
    return RISK_ORDER.get(str(row.get("severity", "")), 99), str(row.get("finding_id", ""))


def _candidate_order(row: dict[str, Any]) -> tuple[int, str]:
    return RISK_ORDER.get(str(row.get("risk", "")), 99), str(row.get("candidate_id", ""))


def _coverage_order(row: dict[str, Any]) -> tuple[int, str]:
    return RISK_ORDER.get(str(row.get("risk_if_unreviewed", "")), 99), str(row.get("coverage_id", ""))


def _proof_gates(row: dict[str, Any]) -> str:
    gates = row.get("proof_gates", [])
    if not isinstance(gates, list):
        return ""
    parts = []
    for gate in sorted((item for item in gates if isinstance(item, dict)), key=lambda item: str(item.get("gate", ""))):
        parts.append(
            f"{gate.get('gate', '')}={gate.get('status', '')} "
            f"(related: {_id_text(gate.get('related_ids'))}): {_claim_trace(gate.get('statement'))}"
        )
    return "; ".join(parts)


def _signals(row: dict[str, Any]) -> str:
    signals = row.get("signals", [])
    if not isinstance(signals, list):
        return ""
    return "; ".join(
        f"{signal.get('signal_id', '')} ({signal.get('purpose', '')}): "
        f"{_claim_trace(signal.get('description'))}"
        for signal in sorted(
            (item for item in signals if isinstance(item, dict)),
            key=lambda item: str(item.get("signal_id", "")),
        )
    )


def _result(row: dict[str, Any]) -> str:
    result = row.get("result")
    if not isinstance(result, dict):
        return ""
    signal_evidence = "; ".join(
        f"{item.get('signal_id', '')}=>{_id_text(item.get('evidence_ids'))}"
        for item in result.get("signal_evidence", [])
        if isinstance(item, dict)
    )
    return (
        f"outcome={result.get('outcome', '')}; run={result.get('run_id', '')}; "
        f"observed={_id_text(result.get('observed_signal_ids'))}; "
        f"evidence={_id_text(result.get('evidence_ids'))}; cleanup={result.get('cleanup_status', '')}; "
        f"attempts={result.get('attempt_count', '')}; requests={result.get('request_count', '')}; "
        f"preflight={_id_text(result.get('identity_preflight_evidence_ids'))}; "
        f"signal_evidence={signal_evidence}; "
        f"fresh_control_repeated={_text(result.get('fresh_control_repeated'))}; "
        f"{_claim_trace(result.get('summary'))}"
    )


def _safety(row: dict[str, Any]) -> str:
    safety = row.get("safety", {})
    if not isinstance(safety, dict):
        return ""
    return (
        f"state_change={_text(safety.get('state_change'))}; synthetic={_text(safety.get('synthetic_data'))}; "
        f"destructive_risk={_text(safety.get('destructive_risk'))}; "
        f"disposable={_id_text(safety.get('disposable_resource_ids'))}; "
        f"before={_text(safety.get('before_state_steps'))}; "
        f"readback={_text(safety.get('readback_steps'))}; cleanup={_text(safety.get('cleanup_steps'))}"
    )


def _plan_controls(row: dict[str, Any]) -> str:
    return (
        f"max_attempts={_text(row.get('max_attempts'))}; "
        f"stop={_text(row.get('stop_conditions'))}; "
        f"limitations={_claims(row.get('limitations')) or 'none'}"
    )


def _locator(row: dict[str, Any]) -> str:
    locator = row.get("locator", {})
    if not isinstance(locator, dict):
        return ""
    parts = []
    repository_path = locator.get("repository_path")
    revision = locator.get("revision")
    if repository_path:
        parts.append(str(repository_path) + ("@" + str(revision) if revision else ""))
    elif revision:
        parts.append("revision=" + str(revision))
    for key in (
        "location",
        "target",
        "environment",
        "transport",
        "run_id",
        "content_hash",
        "request_fingerprint",
    ):
        if locator.get(key):
            parts.append(f"{key}={locator[key]}")
    return "; ".join(parts)


def _source_hops(row: dict[str, Any]) -> str:
    hops = row.get("hops", [])
    if not isinstance(hops, list):
        return ""
    return " → ".join(
        f"{hop.get('hop_id', '')}:{hop.get('kind', '')}/{hop.get('restriction_state', '')} "
        f"({_claim_trace(hop.get('location'))}; evidence={_id_text(hop.get('evidence_ids'))})"
        for hop in hops
        if isinstance(hop, dict)
    )


def _review_context(data: dict[str, Any]) -> dict[str, Any]:
    metadata = data["metadata"]
    repository = metadata.get("repository")
    repository_view = None
    if isinstance(repository, dict):
        repository_view = {
            "name": repository.get("name"),
            "revision": repository.get("revision"),
            "included_paths": repository.get("included_paths", []),
            "excluded_paths": repository.get("excluded_paths", []),
        }
    return {
        "title": metadata["title"],
        "review_mode": metadata["review_mode"],
        "analysis_basis": metadata["analysis_basis"],
        "review_status": metadata["review_status"],
        "assurance_status": metadata["assurance_status"],
        "runtime_authorization": metadata["runtime_authorization"],
        "repository": repository_view,
        "updated_at": metadata["updated_at"],
        "next_review_at": metadata["next_review_at"],
    }


def _collect_evidence_ids(value: Any) -> set[str]:
    result: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "evidence_ids":
                result.update(identifier for identifier in _ids(child) if identifier.startswith("EVD-"))
            elif key == "evidence_id" and isinstance(child, str) and child.startswith("EVD-"):
                result.add(child)
            else:
                result.update(_collect_evidence_ids(child))
    elif isinstance(value, list):
        for child in value:
            result.update(_collect_evidence_ids(child))
    return result


def _evidence_subset(data: dict[str, Any], *values: Any) -> list[dict[str, Any]]:
    wanted: set[str] = set()
    for value in values:
        wanted.update(_collect_evidence_ids(value))
    return [row for row in _records(data, "evidence") if row.get("evidence_id") in wanted]


def _subject_index(data: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for section, id_field in ID_FIELDS.items():
        if section in {"evidence", "questions"}:
            continue
        for row in _records(data, section):
            label = row.get("title") or row.get("name") or row.get("label") or row.get("type") or ""
            status = (
                row.get("disposition")
                or row.get("review_status")
                or row.get("execution_status")
                or row.get("status")
                or row.get("proof_basis")
                or ""
            )
            result.append(
                {
                    "id": row.get(id_field),
                    "section": section,
                    "label": label,
                    "status": status,
                    "evidence_ids": sorted(_collect_evidence_ids(row)),
                }
            )
    return sorted(result, key=lambda item: (str(item["id"]), item["section"]))


def _zero_finding_statement(data: dict[str, Any]) -> str:
    scope = "focused targets" if data["metadata"]["review_mode"] == "focused" else "declared scope"
    assurance = data["metadata"]["assurance_status"]
    return (
        f"No proof-gated access-control findings are recorded for the {scope} at {assurance} assurance. "
        "This means only that no candidate met all five proof gates within the completed evidence scope; "
        "it does not establish that access control or the application is secure."
    )


def render_markdown(data: dict[str, Any], artifact_context: dict[str, Any]) -> str:
    metadata = data["metadata"]
    summary = data["executive_summary"]
    scope = data["scope"]
    repository = metadata.get("repository") if isinstance(metadata.get("repository"), dict) else {}
    runtime_auth = metadata["runtime_authorization"]

    evidence = _records(data, "evidence")
    surfaces = _records(data, "surfaces")
    identities = _records(data, "identities")
    resources = _records(data, "resources")
    policies = _records(data, "policy_rules")
    enforcement = _records(data, "enforcement_points")
    carriers = _records(data, "carriers")
    variants = _records(data, "variants")
    operations = _records(data, "operations")
    obligations = _records(data, "obligations")
    traces = _records(data, "source_traces")
    requirements = _records(data, "matrix_requirements")
    matrix = _records(data, "matrix")
    candidates = _records(data, "candidates")
    findings = _records(data, "findings")
    tests = _records(data, "validation_tests")
    questions = _records(data, "questions")
    coverage = sorted(
        [row for row in data["coverage"].get("items", []) if isinstance(row, dict)],
        key=lambda row: str(row.get("coverage_id", "")),
    )

    source_findings = sorted([row for row in findings if row.get("proof_basis") == "source"], key=_finding_order)
    runtime_findings = sorted([row for row in findings if row.get("proof_basis") == "runtime"], key=_finding_order)
    unresolved = sorted(
        [row for row in candidates if row.get("disposition") in {"lead", "needs_followup"}],
        key=_candidate_order,
    )
    rejected = sorted([row for row in candidates if row.get("disposition") == "rejected"], key=_candidate_order)
    gaps = sorted(
        [row for row in coverage if row.get("status") in {"pending", "deferred_with_specific_reason", "out_of_scope"}],
        key=_coverage_order,
    )
    matrix_gaps = [row for row in matrix if row.get("review_status") in {"blocked", "deferred", "out_of_scope"}]
    planned_tests = [row for row in tests if row.get("execution_status") == "planned"]
    blocked_tests = [row for row in tests if row.get("execution_status") == "blocked"]
    executed_tests = [row for row in tests if row.get("execution_status") in {"passed", "failed", "inconclusive"}]

    repository_line = "not supplied for this analysis basis"
    if repository:
        repository_line = f"{repository.get('name', '')} at `{repository.get('revision', '')}`"
    source_manifest = artifact_context.get("source_manifest")
    source_revision = "not applicable"
    source_content_hash = "not applicable"
    source_evidence = "not applicable"
    if isinstance(source_manifest, dict):
        source_revision = str(source_manifest.get("revision", ""))
        source_content_hash = str(source_manifest.get("content_hash", ""))
        source_evidence = str(source_manifest.get("evidence_id", ""))

    lines = [
        f"# {metadata['title']}",
        "",
        f"- **Review mode:** `{metadata['review_mode']}`",
        f"- **Analysis basis:** `{metadata['analysis_basis']}`",
        f"- **Review status:** `{metadata['review_status']}`",
        f"- **Assurance status:** `{metadata['assurance_status']}`",
        f"- **Runtime authorization:** `{runtime_auth['status']}`",
        f"- **Repository/revision:** {repository_line}",
        f"- **Canonical input SHA-256:** `{artifact_context['canonical_input_sha256']}`",
        f"- **Source manifest revision:** `{source_revision}`",
        f"- **Source manifest content hash:** `{source_content_hash}`",
        f"- **Source manifest evidence:** `{source_evidence}`",
        f"- **Updated:** `{metadata['updated_at']}`",
        f"- **Next review:** `{metadata['next_review_at']}`",
        f"- **Quality review:** `{data['quality_review']['status']}`",
        "",
        "## Executive summary",
        "",
        _claim_trace(summary["overall_assessment"]),
        "",
        f"Status rationale: {_claim_trace(summary['review_status_rationale'])}",
        "",
        f"Assurance limitations: {_claims(summary.get('assurance_limitations')) or 'None recorded.'}",
        "",
        f"Declared objective: {_claim_trace(scope['objective'])}",
        "",
        f"Scope limitations: {_claims(scope.get('limitations')) or 'None recorded.'}",
        "",
        (
            _zero_finding_statement(data)
            if not findings
            else f"Recorded proof-gated findings: {len(source_findings)} source-confirmed and "
            f"{len(runtime_findings)} runtime-confirmed."
        ),
        "",
        "## Source-confirmed findings",
        "",
        "These findings prove a shipped source path at the frozen revision; they do not claim an attack ran.",
        "",
        _table(
            ("Finding", "Severity", "Type", "Confidence", "Description", "Impact", "Operations", "Resources", "Evidence"),
            (
                (
                    row["finding_id"] + " — " + row["title"], row["severity"], row["classification"],
                    row["confidence"], _claim_trace(row["description"]), _claim_trace(row["impact"]),
                    _id_text(row["operation_ids"]), _id_text(row["resource_ids"]), _id_text(row["evidence_ids"]),
                )
                for row in source_findings
            ),
        ),
        "",
        "## Runtime-confirmed findings",
        "",
        "These findings require conclusive, authorized runtime evidence and a linked failed control test.",
        "",
        _table(
            ("Finding", "Severity", "Type", "Confidence", "Description", "Impact", "Operations", "Resources", "Evidence"),
            (
                (
                    row["finding_id"] + " — " + row["title"], row["severity"], row["classification"],
                    row["confidence"], _claim_trace(row["description"]), _claim_trace(row["impact"]),
                    _id_text(row["operation_ids"]), _id_text(row["resource_ids"]), _id_text(row["evidence_ids"]),
                )
                for row in runtime_findings
            ),
        ),
        "",
        "## Finding actions",
        "",
        _table(
            ("Finding", "Proof basis", "Preconditions", "Remediation", "Regression test", "Candidate"),
            (
                (
                    row["finding_id"], row["proof_basis"], _claims(row["preconditions"]),
                    _claim_trace(row["remediation"]), _claim_trace(row["regression_test"]), row["candidate_id"],
                )
                for row in sorted(findings, key=_finding_order)
            ),
        ),
        "",
        "## Unresolved candidates",
        "",
        _table(
            ("Candidate", "Disposition", "Risk", "Confidence", "Type", "Operation", "Proof gates", "Contradiction", "Tests", "Evidence"),
            (
                (
                    row["candidate_id"] + " — " + row["title"], row["disposition"], row["risk"],
                    row["confidence"], row["classification"], row["operation_id"], _proof_gates(row),
                    _claim_trace(row["contradiction"]), _id_text(row["validation_test_ids"]), _id_text(row["evidence_ids"]),
                )
                for row in unresolved
            ),
        ),
        "",
        "## Rejected leads",
        "",
        "Rejected leads remain visible because their contradiction evidence prevents status-only or guessed-target anomalies from being promoted later.",
        "",
        _table(
            ("Candidate", "Risk", "Type", "Operation", "Contradiction", "Proof gates", "Evidence"),
            (
                (
                    row["candidate_id"] + " — " + row["title"], row["risk"], row["classification"],
                    row["operation_id"], _claim_trace(row["contradiction"]), _proof_gates(row), _id_text(row["evidence_ids"]),
                )
                for row in rejected
            ),
        ),
        "",
        "## Coverage and assurance gaps",
        "",
        f"Frozen inventory: **{len(data['coverage']['inventory']['expected_subject_ids'])} expected subjects**; "
        f"declared unread high-risk count: **{data['coverage']['unread_high_risk_count']}**.",
        "",
        _table(
            ("Coverage", "Category", "Subjects", "Status", "Risk", "Reason", "Owner", "Next action", "Evidence"),
            (
                (
                    row["coverage_id"], row["category"], _id_text(row["subject_ids"]), row["status"],
                    row["risk_if_unreviewed"], _claim_trace(row["reason"]), row["owner"],
                    _claim_trace(row["next_action"]), _id_text(row["evidence_ids"]),
                )
                for row in gaps
            ),
        ),
        "",
        "### Matrix blockers and exclusions",
        "",
        _table(
            ("Cell", "Operation", "Relationship", "Status", "Expected", "Observed", "Reason", "Tests", "Evidence"),
            (
                (
                    row["matrix_cell_id"], row["operation_id"], row["relationship"], row["review_status"],
                    row["expected_decision"], row["observed_decision"], _claim_trace(row["reason"]),
                    _id_text(row["validation_test_ids"]), _id_text(row["evidence_ids"]),
                )
                for row in matrix_gaps
            ),
        ),
        "",
        "## Planned validation tests",
        "",
        _table(
            ("Test", "Operation", "Caller", "Target", "Baseline", "Attack case", "Signals", "Safety", "Plan controls", "Evidence"),
            (
                (
                    row["validation_test_id"] + " — " + row["title"], row["operation_id"], row["caller_identity_id"],
                    f"{row['target']['origin']} ({row['target']['environment']}; {row['target']['transport']}; {row['target']['action_class']})",
                    _claim_trace(row["baseline"]["action"]), _claim_trace(row["attack_case"]["action"]),
                    _signals(row), _safety(row), _plan_controls(row), _id_text(row["evidence_ids"]),
                )
                for row in planned_tests
            ),
        ),
        "",
        "## Blocked validation tests",
        "",
        _table(
            ("Test", "Operation", "Target", "Blocker", "Safety", "Evidence"),
            (
                (
                    row["validation_test_id"] + " — " + row["title"], row["operation_id"],
                    f"{row['target']['origin']} ({row['target']['environment']})", _claim_trace(row.get("blocker")),
                    _safety(row), _id_text(row["evidence_ids"]),
                )
                for row in blocked_tests
            ),
        ),
        "",
        "## Executed validation tests",
        "",
        _table(
            ("Test", "Status", "Operation", "Caller", "Target", "Result", "Signals", "Evidence"),
            (
                (
                    row["validation_test_id"] + " — " + row["title"], row["execution_status"], row["operation_id"],
                    row["caller_identity_id"], f"{row['target']['origin']} ({row['target']['environment']})",
                    _result(row), _signals(row), _id_text(row["evidence_ids"]),
                )
                for row in executed_tests
            ),
        ),
        "",
        "# Ledger appendices",
        "",
        "## Surface inventory",
        "",
        _table(
            ("Surface", "Kind", "Disposition", "Operations", "Reason", "Evidence"),
            ((row["surface_id"] + " — " + row["name"], row["kind"], row["disposition"], _id_text(row["operation_ids"]), _claim_trace(row["reason"]), _id_text(row["evidence_ids"])) for row in surfaces),
        ),
        "",
        "## Identities",
        "",
        _table(
            ("Identity", "Kind", "Role", "Tenant/domain", "Verification", "Transports", "Protected", "Freshness", "Evidence"),
            ((row["identity_id"] + " — " + row["label"], row["kind"], row["role"], f"{row['tenant']} / {row['authorization_domain']}", row["verification_status"], _id_text(row["transports"]), row["protected_account"], _claim_trace(row["freshness"]), _id_text(row["evidence_ids"])) for row in identities),
        ),
        "",
        "## Resources",
        "",
        _table(
            ("Resource", "Type", "Identifier fingerprint", "Carriers", "Owner", "Tenant/domain", "Sensitivity", "Provenance", "Safety", "Lifecycle", "Evidence"),
            ((row["resource_id"] + " — " + row["label"], row["type"], row["identifier_fingerprint"], _id_text(row["carrier_ids"]), row.get("owner_identity_id", ""), f"{row['tenant']} / {row['authorization_domain']}", row["sensitivity"], row["provenance"], row["safety"], row["lifecycle"], _id_text(row["evidence_ids"])) for row in resources),
        ),
        "",
        "## Policy rules",
        "",
        _table(
            ("Policy", "Decision", "Authority", "Relationship", "Actions", "Subjects", "Resources", "Enforcement", "Conditions", "Evidence"),
            ((row["policy_id"] + " — " + row["name"], row["decision"], row["authority"], row["relationship"], _id_text(row["actions"]), _id_text(row["subject_identity_ids"]), _id_text(row["resource_ids"]), _id_text(row["enforcement_point_ids"]), _claims(row["conditions"]), _id_text(row["evidence_ids"])) for row in policies),
        ),
        "",
        "## Enforcement points",
        "",
        _table(
            ("Enforcement", "Kind", "Status", "Location", "Policies", "Operations", "Resources", "Evidence"),
            ((row["enforcement_point_id"] + " — " + row["name"], row["kind"], row["status"], _claim_trace(row["location"]), _id_text(row["policy_rule_ids"]), _id_text(row["operation_ids"]), _id_text(row["resource_ids"]), _id_text(row["evidence_ids"])) for row in enforcement),
        ),
        "",
        "## Operations",
        "",
        _table(
            ("Operation", "Kind", "Entrypoint", "State change", "Sensitive response", "Carriers", "Variants", "Obligations", "Continuations", "Evidence"),
            ((row["operation_id"] + " — " + row["name"], f"{row['kind']} / {row['method_or_kind']}", _claim_trace(row["entrypoint"]), row["state_change"], row["sensitive_response"], _id_text(row["carrier_ids"]), _id_text(row["variant_ids"]), _id_text(row["obligation_ids"]), _id_text(row["continuation_operation_ids"]), _id_text(row["evidence_ids"])) for row in operations),
        ),
        "",
        "## Authorization obligations",
        "",
        _table(
            ("Obligation", "Operation", "Action", "Resource", "Properties", "Status", "Policies", "Enforcement", "Final sink", "Downstream check", "Evidence"),
            ((row["obligation_id"], row["operation_id"], row["action"], row["resource_id"], _id_text(row["property_names"]), row["status"], _id_text(row["policy_rule_ids"]), _id_text(row["enforcement_point_ids"]), _claim_trace(row["final_sink"]), _claim_trace(row["downstream_control_checked"]), _id_text(row["evidence_ids"])) for row in obligations),
        ),
        "",
        "## Carriers and variants",
        "",
        _table(
            ("ID", "Type", "Name", "Location/operations", "Authorization-sensitive", "Evidence"),
            list((row["carrier_id"], "carrier:" + row["kind"], row["name"], row["location"], row["authorization_sensitive"], _id_text(row["evidence_ids"])) for row in carriers)
            + list((row["variant_id"], "variant:" + row["kind"], row["name"], _id_text(row["operation_ids"]), "", _id_text(row["evidence_ids"])) for row in variants),
        ),
        "",
        "## Source traces",
        "",
        _table(
            ("Trace", "Operation", "Reachability", "Conclusion", "Obligations", "Hop chain", "Contradiction search", "Evidence"),
            ((row["source_trace_id"], row["operation_id"], row["reachability"], row["control_conclusion"], _id_text(row["obligation_ids"]), _source_hops(row), _claim_trace(row["contradiction_search"]), _id_text(row["evidence_ids"])) for row in traces),
        ),
        "",
        "## Matrix requirements",
        "",
        _table(
            ("Requirement", "Operation", "Risk", "Identities", "Relationships", "Obligations", "Carriers", "Variants", "Source required", "Runtime required", "Evidence"),
            ((row["matrix_requirement_id"], row["operation_id"], row["risk_if_unreviewed"], _id_text(row["required_identity_ids"]), _id_text(row["required_relationships"]), _id_text(row["required_obligation_ids"]), _id_text(row["required_carrier_ids"]), _id_text(row["required_variant_ids"]), row["source_review_required"], row["runtime_test_required"], _id_text(row["evidence_ids"])) for row in requirements),
        ),
        "",
        "## Authorization matrix",
        "",
        _table(
            ("Cell", "Requirement", "Operation", "Caller", "Targets", "Relationship", "Expected", "Observed", "Status", "Baseline", "Obligations", "Carriers", "Variants", "Tests", "Reason", "Evidence"),
            ((row["matrix_cell_id"], row["matrix_requirement_id"], row["operation_id"], row["caller_identity_id"], _id_text(row["target_resource_ids"]), row["relationship"], row["expected_decision"], row["observed_decision"], row["review_status"], row.get("baseline_cell_id", ""), _id_text(row["covered_obligation_ids"]), _id_text(row["covered_carrier_ids"]), _id_text(row["covered_variant_ids"]), _id_text(row["validation_test_ids"]), _claim_trace(row["reason"]), _id_text(row["evidence_ids"])) for row in matrix),
        ),
        "",
        "## Candidate proof ledger",
        "",
        _table(
            ("Candidate", "Disposition", "Risk", "Confidence", "Type", "Operation", "Caller", "Resources", "Gates", "Contradiction", "Finding", "Tests", "Evidence"),
            ((row["candidate_id"] + " — " + row["title"], row["disposition"], row["risk"], row["confidence"], row["classification"], row["operation_id"], row["caller_identity_id"], _id_text(row["resource_ids"]), _proof_gates(row), _claim_trace(row["contradiction"]), row.get("finding_id", ""), _id_text(row["validation_test_ids"]), _id_text(row["evidence_ids"])) for row in candidates),
        ),
        "",
        "## Validation-test ledger",
        "",
        _table(
            ("Test", "Status", "Outcome", "Operation", "Caller", "Resources", "Matrix", "Target", "Baseline", "Attack case", "Signals", "Safety", "Plan controls", "Blocker", "Result", "Evidence"),
            ((row["validation_test_id"] + " — " + row["title"], row["execution_status"], row.get("result", {}).get("outcome", "") if isinstance(row.get("result"), dict) else "", row["operation_id"], row["caller_identity_id"], _id_text(row["target_resource_ids"]), _id_text(row["matrix_cell_ids"]), f"{row['target']['origin']} / {row['target']['environment']} / {row['target']['transport']} / {row['target']['action_class']}", _claim_trace(row["baseline"]["action"]), _claim_trace(row["attack_case"]["action"]), _signals(row), _safety(row), _plan_controls(row), _claim_trace(row.get("blocker")), _result(row), _id_text(row["evidence_ids"])) for row in tests),
        ),
        "",
        "## Evidence ledger",
        "",
        _table(
            ("Evidence", "Class", "Source", "Title", "Summary", "Locator", "Reliability", "Collected"),
            ((row["evidence_id"], row["evidence_class"], row["source_type"], row["title"], row["summary"], _locator(row), row["reliability"], row["collected_at"]) for row in evidence),
        ),
        "",
        "## Coverage ledger",
        "",
        _table(
            ("Coverage", "Category", "Subjects", "Status", "Risk", "Reason", "Owner", "Next action", "Scope exclusion", "Evidence"),
            ((row["coverage_id"], row["category"], _id_text(row["subject_ids"]), row["status"], row["risk_if_unreviewed"], _claim_trace(row["reason"]), row["owner"], _claim_trace(row["next_action"]), row.get("scope_exclusion", ""), _id_text(row["evidence_ids"])) for row in coverage),
        ),
        "",
        "## Questions",
        "",
        _table(
            ("Question", "Priority", "Status", "Blocking", "Owner", "Related", "Resolution criteria", "Answer"),
            ((row["question_id"] + " — " + _claim_trace(row["question"]), row["priority"], row["status"], row["blocking"], row["owner"], _id_text(row["related_ids"]), _claim_trace(row["resolution_criteria"]), _claim_trace(row.get("answer"))) for row in questions),
        ),
        "",
        "## Quality review",
        "",
        f"Challenger: {data['quality_review']['challenger']}; challenged at `{data['quality_review']['challenged_at']}`; "
        f"status: `{data['quality_review']['status']}`.",
        "",
        _table(
            ("Gate", "Status", "Rationale"),
            ((row["gate_id"] + " — " + row["gate"], row["status"], _claim_trace(row["rationale"])) for row in sorted(data["quality_review"]["gates"], key=lambda row: row["gate_id"])),
        ),
        "",
        _table(
            ("Challenge", "Severity", "Status", "Blocker", "Title", "Disposition", "Owner", "Related"),
            ((row["finding_id"], row["severity"], row["status"], row["blocker"], _claim_trace(row["title"]), _claim_trace(row["disposition"]), row["owner"], _id_text(row["related_ids"])) for row in sorted(data["quality_review"]["challenge_findings"], key=lambda row: row["finding_id"])),
        ),
        "",
        "Quality checks: " + ", ".join(f"{key}={_text(value)}" for key, value in sorted(data["quality_review"]["checks"].items())) + ".",
        "",
        "Unresolved high-severity challenge findings: "
        + (_id_text(data["quality_review"]["unresolved_high_severity_finding_ids"]) or "none")
        + ".",
        "",
    ]
    return "\n".join(lines).rstrip() + "\n"


def validation_plan_payload(data: dict[str, Any], artifact_context: dict[str, Any]) -> dict[str, Any]:
    tests = _records(data, "validation_tests")
    test_ids = {str(row.get("validation_test_id")) for row in tests}
    candidates = [
        row for row in _records(data, "candidates")
        if test_ids.intersection(_ids(row.get("validation_test_ids")))
    ]
    matrix = [
        row for row in _records(data, "matrix")
        if test_ids.intersection(_ids(row.get("validation_test_ids")))
    ]
    return {
        "schema_version": data["schema_version"],
        "artifact_context": artifact_context,
        "review": _review_context(data),
        "summary": {
            "planned": sum(row.get("execution_status") == "planned" for row in tests),
            "blocked": sum(row.get("execution_status") == "blocked" for row in tests),
            "executed": sum(row.get("execution_status") in {"passed", "failed", "inconclusive"} for row in tests),
        },
        "planned_tests": [row for row in tests if row.get("execution_status") == "planned"],
        "blocked_tests": [row for row in tests if row.get("execution_status") == "blocked"],
        "executed_tests": [row for row in tests if row.get("execution_status") in {"passed", "failed", "inconclusive"}],
        "linked_candidates": candidates,
        "linked_matrix_cells": matrix,
        "evidence": _evidence_subset(data, tests, candidates, matrix),
    }


def findings_payload(data: dict[str, Any], artifact_context: dict[str, Any]) -> dict[str, Any]:
    findings = _records(data, "findings")
    candidates = _records(data, "candidates")
    source = sorted([row for row in findings if row.get("proof_basis") == "source"], key=_finding_order)
    runtime = sorted([row for row in findings if row.get("proof_basis") == "runtime"], key=_finding_order)
    confirmed = [row for row in candidates if row.get("disposition") in {"source_confirmed", "runtime_confirmed"}]
    unresolved = sorted([row for row in candidates if row.get("disposition") in {"lead", "needs_followup"}], key=_candidate_order)
    rejected = sorted([row for row in candidates if row.get("disposition") == "rejected"], key=_candidate_order)
    candidate_by_id = {str(row.get("candidate_id")): row for row in candidates}
    evidence_rows = _records(data, "evidence")
    evidence_by_id = {str(row.get("evidence_id")): row for row in evidence_rows}
    source_manifest = artifact_context.get("source_manifest")
    manifest_evidence_id = source_manifest.get("evidence_id") if isinstance(source_manifest, dict) else None
    bindings = []
    for finding in sorted(findings, key=_finding_order):
        candidate = candidate_by_id.get(str(finding.get("candidate_id")))
        evidence_ids = _collect_evidence_ids(finding)
        if candidate is not None:
            evidence_ids.update(_collect_evidence_ids(candidate))
        if isinstance(manifest_evidence_id, str):
            evidence_ids.add(manifest_evidence_id)
        ordered_ids = sorted(identifier for identifier in evidence_ids if identifier in evidence_by_id)
        bindings.append(
            {
                "finding_id": finding.get("finding_id"),
                "candidate_id": finding.get("candidate_id"),
                "artifact_context": artifact_context,
                "evidence_ids": ordered_ids,
                "evidence": [evidence_by_id[identifier] for identifier in ordered_ids],
            }
        )
    return {
        "schema_version": data["schema_version"],
        "artifact_context": artifact_context,
        "review": _review_context(data),
        "summary": {
            "source_confirmed": len(source),
            "runtime_confirmed": len(runtime),
            "unresolved_candidates": len(unresolved),
            "rejected_leads": len(rejected),
            "severity_counts": dict(sorted(Counter(str(row.get("severity")) for row in findings).items())),
            "zero_finding_statement": _zero_finding_statement(data) if not findings else None,
        },
        "source_findings": source,
        "runtime_findings": runtime,
        "confirmed_candidate_proofs": sorted(confirmed, key=_candidate_order),
        "unresolved_candidates": unresolved,
        "rejected_leads": rejected,
        "finding_evidence_bindings": bindings,
        "evidence": _evidence_subset(data, findings, candidates, source_manifest),
    }


def coverage_payload(data: dict[str, Any], artifact_context: dict[str, Any]) -> dict[str, Any]:
    items = sorted(
        [row for row in data["coverage"].get("items", []) if isinstance(row, dict)],
        key=lambda row: str(row.get("coverage_id", "")),
    )
    matrix = _records(data, "matrix")
    gaps = [
        row for row in items
        if row.get("status") in {"pending", "deferred_with_specific_reason", "out_of_scope"}
    ]
    matrix_gaps = [
        row for row in matrix
        if row.get("review_status") in {"blocked", "deferred", "out_of_scope"}
    ]
    return {
        "schema_version": data["schema_version"],
        "artifact_context": artifact_context,
        "review": _review_context(data),
        "scope": data["scope"],
        "summary": {
            "expected_subjects": len(data["coverage"]["inventory"]["expected_subject_ids"]),
            "coverage_status_counts": dict(sorted(Counter(str(row.get("status")) for row in items).items())),
            "coverage_category_counts": dict(sorted(Counter(str(row.get("category")) for row in items).items())),
            "matrix_status_counts": dict(sorted(Counter(str(row.get("review_status")) for row in matrix).items())),
            "unread_high_risk_count": data["coverage"]["unread_high_risk_count"],
        },
        "surface_inventory": _records(data, "surfaces"),
        "matrix_requirements": _records(data, "matrix_requirements"),
        "matrix": matrix,
        "coverage_gaps": gaps,
        "matrix_gaps": matrix_gaps,
        "coverage": {
            "summary": data["coverage"]["summary"],
            "inventory": data["coverage"]["inventory"],
            "items": items,
            "unread_high_risk_count": data["coverage"]["unread_high_risk_count"],
        },
        "subject_index": _subject_index(data),
        "questions": _records(data, "questions"),
        "quality_review": data["quality_review"],
        "evidence": _evidence_subset(
            data,
            data["scope"],
            data["coverage"],
            data["quality_review"],
            _records(data, "surfaces"),
            _records(data, "matrix_requirements"),
            matrix,
            _records(data, "questions"),
        ),
    }


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(path.expanduser()))


def _path_identity(path: Path) -> tuple[frozenset[str], Optional[tuple[int, int]]]:
    lexical = _absolute(path)
    resolved = lexical.resolve(strict=False)
    inode = None
    try:
        status = lexical.stat()
        inode = (status.st_dev, status.st_ino)
    except OSError:
        pass
    return frozenset((str(lexical), str(resolved))), inode


def _paths_collide(left: Path, right: Path) -> bool:
    left_names, left_inode = _path_identity(left)
    right_names, right_inode = _path_identity(right)
    return bool(left_names.intersection(right_names)) or (
        left_inode is not None and right_inode is not None and left_inode == right_inode
    )


def _authoritative_paths(data: dict[str, Any], review: Path) -> list[tuple[str, Path]]:
    protected: list[tuple[str, Path]] = [("canonical review", review)]
    repository = data.get("metadata", {}).get("repository")
    if not isinstance(repository, dict):
        return protected
    root_value = repository.get("root")
    if not isinstance(root_value, str) or not root_value:
        return protected
    repository_root = Path(root_value).expanduser()
    if not repository_root.is_absolute():
        repository_root = _absolute(review).parent / repository_root
    for evidence in _records(data, "evidence"):
        locator = evidence.get("locator")
        repository_path = locator.get("repository_path") if isinstance(locator, dict) else None
        if not isinstance(repository_path, str) or not repository_path:
            continue
        evidence_path = Path(repository_path).expanduser()
        if not evidence_path.is_absolute():
            evidence_path = repository_root / evidence_path
        protected.append((f"evidence {evidence.get('evidence_id', '')}", evidence_path))
    return protected


def _preflight_output_collisions(output_dir: Path, data: dict[str, Any], review: Path) -> None:
    directory = _absolute(output_dir)
    if os.path.lexists(directory) and not directory.is_dir():
        raise ValueError(f"output directory is not a directory: {directory}")
    destinations = [(name, directory / name) for name in ARTIFACT_NAMES]
    for index, (left_name, left_path) in enumerate(destinations):
        for right_name, right_path in destinations[index + 1:]:
            if _paths_collide(left_path, right_path):
                raise ValueError(
                    f"artifact outputs alias each other: {left_name} and {right_name}"
                )
    for name, destination in destinations:
        for protected_label, protected_path in _authoritative_paths(data, review):
            if _paths_collide(destination, protected_path):
                raise ValueError(
                    f"artifact output {name} aliases protected {protected_label}: {protected_path}"
                )


def _run_validator(review: Path, strict: bool) -> bool:
    validator = Path(__file__).resolve().with_name("validate_access_control_review.py")
    if not validator.is_file():
        print(f"ERROR: validator not found: {validator}", file=sys.stderr)
        return False
    command = [sys.executable, str(validator), str(review)]
    if strict:
        command.append("--strict")
    try:
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
    except OSError as exc:
        print(f"ERROR: could not invoke validator: {exc}", file=sys.stderr)
        return False
    if completed.returncode:
        if completed.stdout:
            print(completed.stdout.rstrip(), file=sys.stderr)
        if completed.stderr:
            print(completed.stderr.rstrip(), file=sys.stderr)
        print("ERROR: refusing to render an invalid access-control review", file=sys.stderr)
        return False
    if completed.stderr:
        print(completed.stderr.rstrip(), file=sys.stderr)
    return True


def _write_artifacts(output_dir: Path, artifacts: dict[str, str]) -> None:
    if set(artifacts) != set(ARTIFACT_NAMES):
        raise ValueError("renderer must produce exactly the four declared artifacts")
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in ARTIFACT_NAMES:
        destination = output_dir / name
        if destination.exists() and not destination.is_file():
            raise OSError(f"artifact destination is not a regular file: {destination}")
    with tempfile.TemporaryDirectory(prefix=".access-control-render-", dir=output_dir) as temporary:
        stage = Path(temporary)
        for name in ARTIFACT_NAMES:
            path = stage / name
            with path.open("w", encoding="utf-8", newline="\n") as handle:
                handle.write(artifacts[name])
                handle.flush()
                os.fsync(handle.fileno())
        for name in ARTIFACT_NAMES:
            os.replace(stage / name, output_dir / name)
    try:
        descriptor = os.open(output_dir, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    except OSError:
        return
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("review", type=Path, help="canonical access-control-review.json")
    parser.add_argument("--output-dir", type=Path, required=True, help="directory for derived artifacts")
    parser.add_argument("--strict", action="store_true", help="treat validator warnings as failures")
    args = parser.parse_args(argv)

    try:
        before = args.review.read_bytes()
    except OSError as exc:
        print(f"ERROR: could not read input: {exc}", file=sys.stderr)
        return 2

    if not _run_validator(args.review, args.strict):
        return 1

    try:
        after = args.review.read_bytes()
        if after != before:
            print("ERROR: canonical input changed during validation; refusing to render", file=sys.stderr)
            return 1
        data = json.loads(after.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("canonical review must be a JSON object")
        artifact_context = _artifact_context(
            data, "sha256:" + hashlib.sha256(after).hexdigest()
        )
        _preflight_output_collisions(args.output_dir, data, args.review)
        artifacts = {
            "access-control-review.md": render_markdown(data, artifact_context),
            "validation-plan.json": _json(validation_plan_payload(data, artifact_context)),
            "findings.json": _json(findings_payload(data, artifact_context)),
            "coverage.json": _json(coverage_payload(data, artifact_context)),
        }
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError, RecursionError) as exc:
        print(f"ERROR: could not render validated review: {exc}", file=sys.stderr)
        return 2

    try:
        _preflight_output_collisions(args.output_dir, data, args.review)
        _write_artifacts(args.output_dir, artifacts)
    except (OSError, ValueError) as exc:
        print(f"ERROR: could not write artifacts: {exc}", file=sys.stderr)
        return 2

    for name in ARTIFACT_NAMES:
        print(args.output_dir / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
