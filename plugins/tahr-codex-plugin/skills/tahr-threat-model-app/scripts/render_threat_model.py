#!/usr/bin/env python3
"""Render a validated canonical Tahr threat model into deterministic artifacts."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

from validate_threat_model import Diagnostic, load_model, record_identifier, records_for_section, validate_model


RISK_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _claim(value: Any) -> str:
    if isinstance(value, dict) and isinstance(value.get("statement"), str):
        return " ".join(value["statement"].split())
    if isinstance(value, str):
        return " ".join(value.split())
    return ""


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
        return _claim(value) or json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _md(value: Any) -> str:
    return _text(value).replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def _table(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> str:
    materialized = [[_md(cell) or "—" for cell in row] for row in rows]
    if not materialized:
        return "_No records._\n"
    output = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    output.extend("| " + " | ".join(row) + " |" for row in materialized)
    return "\n".join(output) + "\n"


def _records(data: dict[str, Any], section: str) -> list[dict[str, Any]]:
    return sorted(records_for_section(section, data[section]), key=lambda row: record_identifier(section, row) or "")


def _risk(record: dict[str, Any], field: str = "risk") -> str:
    risk = record.get(field)
    return str(risk.get("rating", "")) if isinstance(risk, dict) else ""


def _confidence(record: dict[str, Any]) -> str:
    confidence = record.get("confidence")
    return str(confidence.get("level", "")) if isinstance(confidence, dict) else ""


def _ids(record: dict[str, Any], field: str) -> str:
    value = record.get(field, [])
    if isinstance(value, str):
        return value
    return ", ".join(item for item in value if isinstance(item, str)) if isinstance(value, list) else ""


def _signal_text(signals: Any) -> str:
    if isinstance(signals, dict):
        return str(signals.get("observation", ""))
    if not isinstance(signals, list):
        return ""
    return "; ".join(str(signal.get("observation", "")) for signal in signals if isinstance(signal, dict))


def render_markdown(data: dict[str, Any]) -> str:
    metadata = data["metadata"]
    repository = metadata["repository"]
    evidence = _records(data, "evidence"); entities = _records(data, "entities")
    boundaries = _records(data, "boundaries"); flows = _records(data, "flows")
    invariants = _records(data, "invariants"); controls = _records(data, "controls")
    threats = _records(data, "threats"); paths = _records(data, "attack_paths")
    decisions = _records(data, "decisions"); tests = _records(data, "validation_tests")
    coverage = _records(data, "coverage"); questions = _records(data, "questions")
    top_threats = sorted(threats, key=lambda row: (RISK_ORDER.get(_risk(row), 99), row["threat_id"]))[:5]
    top_decision_ids = list(data["executive_summary"]["priority_decision_ids"])
    top_decisions = [row for row in decisions if row["decision_id"] in top_decision_ids][:5]
    if len(top_decisions) < 5:
        top_decisions += [row for row in decisions if row not in top_decisions][: 5 - len(top_decisions)]
    wanted_tests: list[str] = []
    for threat in top_threats:
        for test_id in threat["validation_test_ids"]:
            if test_id not in wanted_tests:
                wanted_tests.append(test_id)
    top_tests = [row for test_id in wanted_tests for row in tests if row["test_id"] == test_id][:5]
    gaps = sorted(
        [row for row in coverage if row["status"] in {"pending", "deferred_with_specific_reason", "out_of_scope"}],
        key=lambda row: (RISK_ORDER.get(row["risk_if_unreviewed"], 99), row["coverage_id"]),
    )
    unresolved_questions = sorted(
        [row for row in questions if row["status"] != "answered"],
        key=lambda row: ({"p0": 0, "p1": 1, "p2": 2, "p3": 3}.get(row["priority"], 99), row["question_id"]),
    )
    coverage_inventory = data["coverage"]["inventory"]
    coverage_manifest = coverage_inventory["manifest"]

    summary = data["executive_summary"]
    lines = [
        f"# {metadata['title']}", "",
        f"- **Model status:** `{metadata['model_status']}`",
        f"- **Assurance status:** `{metadata['assurance_status']}`",
        f"- **Runtime authorization:** `{metadata['runtime_authorization']['status']}`",
        f"- **Repository revision:** `{repository['revision']}`",
        f"- **Updated:** `{metadata['updated_at']}`",
        f"- **Next review:** `{metadata['next_review_at']}`", "",
        "## Executive summary", "",
        _claim(summary["system_purpose"]), "", _claim(summary["overall_assessment"]), "",
        f"Status rationale: {_claim(summary['model_status_rationale'])}", "",
        f"Assurance limitations: {_text(summary.get('assurance_limitations', [])) or 'None recorded.'}", "",
        "## Top risks", "",
        _table(
            ("Threat", "Risk", "Confidence", "Impact", "Response", "Owner", "Residual risk", "Decision", "Test"),
            ((row["threat_id"] + " — " + row["title"], _risk(row), _confidence(row), _claim(row["business_impact"]), row["response"]["strategy"], row["response"]["owner"], _risk(row["response"], "residual_risk"), _ids(row["response"], "decision_ids"), _ids(row, "validation_test_ids")) for row in top_threats),
        ), "",
        "## Top connected attack paths", "",
        _table(
            ("Path", "Risk", "Confidence", "Actor", "Hops", "Final assets", "Impact", "Status"),
            ((row["attack_path_id"] + " — " + row["title"], _risk(row), _confidence(row), row["actor_id"], len(row["hops"]), _ids(row, "final_asset_ids"), _claim(row["final_impact"]), row["status"]) for row in sorted(paths, key=lambda row: (RISK_ORDER.get(_risk(row), 99), row["attack_path_id"]))[:5]),
        ), "",
        "## Priority decisions", "",
        _table(
            ("Decision", "Status", "Owner", "Question", "Recommendation", "Threats", "Tests"),
            ((row["decision_id"] + " — " + row["title"], row["status"], row["owner"], _claim(row["question"]), _claim(row["recommendation"]), _ids(row, "threat_ids"), _ids(row, "validation_test_ids")) for row in top_decisions),
        ), "",
        "## First validation tests", "",
        _table(
            ("Test", "Status", "Outcome", "Target skill", "Hypothesis", "Action", "Attacker success", "Expected denial", "Control success", "Control failure", "Safe target"),
            ((row["test_id"] + " — " + row["title"], row["execution_status"], row.get("result", {}).get("outcome", ""), row["target_skill"], _claim(row["hypothesis"]), row["attacker_case"]["steps"], _signal_text(row["attacker_case"]["attacker_success_signal"]), _signal_text(row["attacker_case"]["expected_denial_signal"]), _signal_text(row["control_case"]["control_success_signal"]), _signal_text(row["control_case"]["control_failure_signal"]), row["safety"]["authorized_target"]) for row in top_tests),
        ), "",
        "## Coverage and assurance gaps", "",
        f"Frozen inventory: **{len(coverage_inventory['expected_subject_ids'])} expected subjects** from `{coverage_manifest['evidence_id']}` at `{coverage_manifest['revision']}`; **{len({row['subject_id'] for row in coverage})} subjects** have coverage records.", "",
        f"Declared unread high-risk count: **{data['coverage']['unread_high_risk_count']}**.", "",
        f"Pending, deferred, or explicitly out-of-scope coverage records: **{len(gaps)}**. Critical/high records in any of those states force incomplete coverage; lower-risk declared exclusions still limit assurance.", "",
        _table(
            ("Coverage", "Category", "Subject", "Status", "Risk if unread", "Scope exclusion", "Reason", "Owner", "Next action"),
            ((row["coverage_id"], row["category"], row["subject_id"], row["status"], row["risk_if_unreviewed"], row.get("scope_exclusion", ""), _claim(row["reason"]), row["owner"], _claim(row["next_action"])) for row in gaps[:10]),
        ), "",
        f"Open or deferred security questions: **{len(unresolved_questions)}**. Showing up to five by priority; the complete ledger is below.", "",
        _table(
            ("Question", "Priority", "Status", "Blocking", "Owner", "Resolution criteria"),
            ((row["question_id"] + " — " + _claim(row["question"]), row["priority"], row["status"], row["blocking"], row["owner"], _claim(row["resolution_criteria"])) for row in unresolved_questions[:5]),
        ), "",
        "# Ledger appendices", "",
        "## Evidence", "",
        _table(
            ("ID", "Class", "Source type", "Title", "Summary", "Locator", "Reliability"),
            ((row["evidence_id"], row["evidence_class"], row["source_type"], row["title"], row["summary"], f"{row['locator']['repository_path']}@{row['locator']['revision']}:{row['locator']['location']}", row["reliability"]) for row in evidence),
        ), "",
        "## Entities", "",
        _table(
            ("ID", "Type", "Name", "Criticality", "Classification", "Owner", "External", "Description"),
            ((row["entity_id"], row["type"], row["name"], row["criticality"], row["data_classification"], row["owner"], row["external"], _claim(row["description"])) for row in entities),
        ), "",
        "## Boundaries", "",
        _table(
            ("ID", "Name", "From", "To", "Direction", "Assets", "Trust change"),
            ((row["boundary_id"], row["name"], row["from_zone_id"], row["to_zone_id"], row["direction"], _ids(row, "asset_ids"), _claim(row["trust_change"])) for row in boundaries),
        ), "",
        "## Flows", "",
        _table(
            ("ID", "Name", "Actors", "Assets", "Entrypoints", "Hops", "Sink/final state"),
            ((row["flow_id"], row["name"], _ids(row, "actor_ids"), _ids(row, "asset_ids"), _ids(row, "entrypoint_entity_ids"), len(row["hops"]), _claim(row["sink_or_final_state"])) for row in flows),
        ), "",
        "## Invariants", "",
        _table(
            ("ID", "Statement", "Status", "Owner", "Assets", "Flows", "Threats", "Tests"),
            ((row["invariant_id"], _claim(row["statement"]), row["status"], row["owner"], _ids(row, "asset_ids"), _ids(row, "flow_ids"), _ids(row, "threat_ids"), _ids(row, "validation_test_ids")) for row in invariants),
        ), "",
        "## Controls", "",
        _table(
            ("ID", "Name", "Category", "Status", "Owner", "Effectiveness", "Flows", "Threats", "Tests"),
            ((row["control_id"], row["name"], row["category"], row["implementation_status"], row["owner"], row["effectiveness"]["level"], _ids(row, "flow_ids"), _ids(row, "threat_ids"), _ids(row, "validation_test_ids")) for row in controls),
        ), "",
        "## Threat register", "",
        _table(
            ("ID", "Threat", "Status", "Risk", "Confidence", "Actors", "Assets", "Flows", "Boundaries", "Response", "Owner", "Tests"),
            ((row["threat_id"], row["title"], row["status"], _risk(row), _confidence(row), _ids(row, "actor_ids"), _ids(row, "asset_ids"), _ids(row, "flow_ids"), _ids(row, "boundary_ids"), row["response"]["strategy"], row["response"]["owner"], _ids(row, "validation_test_ids")) for row in sorted(threats, key=lambda row: (RISK_ORDER.get(_risk(row), 99), row["threat_id"]))),
        ), "",
        "## Attack-path ledger", "",
        _table(
            ("ID", "Title", "Status", "Risk", "Actor", "Hop chain", "Final assets", "Impact", "Decisions", "Tests"),
            ((row["attack_path_id"], row["title"], row["status"], _risk(row), row["actor_id"], " → ".join(f"{hop['from_entity_id']}→{hop['to_entity_id']}" for hop in row["hops"]), _ids(row, "final_asset_ids"), _claim(row["final_impact"]), _ids(row, "decision_ids"), _ids(row, "validation_test_ids")) for row in paths),
        ), "",
        "## Decision ledger", "",
        _table(
            ("ID", "Title", "Status", "Owner", "Recommendation", "Threats", "Controls", "Tests"),
            ((row["decision_id"], row["title"], row["status"], row["owner"], _claim(row["recommendation"]), _ids(row, "threat_ids"), _ids(row, "control_ids"), _ids(row, "validation_test_ids")) for row in decisions),
        ), "",
        "## Validation plan summary", "",
        _table(
            ("ID", "Title", "Status", "Outcome", "Threats", "Baseline", "Attacker action", "Attacker success", "Expected denial", "Control success", "Control failure", "Authorization", "Target", "Cleanup owner"),
            ((row["test_id"], row["title"], row["execution_status"], row.get("result", {}).get("outcome", ""), _ids(row, "threat_ids"), _claim(row["baseline"]["description"]), row["attacker_case"]["steps"], _signal_text(row["attacker_case"]["attacker_success_signal"]), _signal_text(row["attacker_case"]["expected_denial_signal"]), _signal_text(row["control_case"]["control_success_signal"]), _signal_text(row["control_case"]["control_failure_signal"]), row["safety"]["authorization_status"], row["safety"]["authorized_target"], row["cleanup"]["owner"]) for row in tests),
        ), "",
        "## Coverage ledger", "",
        _table(
            ("ID", "Category", "Subject", "Status", "Risk if unread", "Scope exclusion", "Description", "Reason", "Owner", "Next action"),
            ((row["coverage_id"], row["category"], row["subject_id"], row["status"], row["risk_if_unreviewed"], row.get("scope_exclusion", ""), _claim(row["description"]), _claim(row["reason"]), row["owner"], _claim(row["next_action"])) for row in coverage),
        ), "",
        "## Questions", "",
        _table(
            ("ID", "Question", "Priority", "Status", "Blocking", "Owner", "Related", "Resolution criteria"),
            ((row["question_id"], _claim(row["question"]), row["priority"], row["status"], row["blocking"], row["owner"], _ids(row, "related_ids"), _claim(row["resolution_criteria"])) for row in questions),
        ), "",
    ]
    for heading, analysis in (("Privacy analysis", data["privacy_analysis"]), ("AI analysis", data["ai_analysis"])):
        lines += [f"## {heading}", "", f"Applicable: `{str(analysis['applicable']).lower()}`. {_claim(analysis['rationale'])}", "",
                  _table(("Finding", "Topic", "Status", "Analysis", "Assets", "Threats", "Decisions"), ((row["analysis_id"], row["topic"], row["status"], _claim(row["analysis"]), _ids(row, "asset_ids"), _ids(row, "threat_ids"), _ids(row, "decision_ids")) for row in analysis["findings"])), ""]
    quality = data["quality_review"]
    lines += ["## Quality review", "", f"Overall status: `{quality['overall_status']}`. {_claim(quality['final_assessment'])}", "",
              _table(("Challenge finding", "Severity", "Status", "Owner", "Description", "Disposition", "Related"), ((row["finding_id"] + " — " + row["title"], row["severity"], row["status"], row["owner"], _claim(row["description"]), _claim(row["disposition"]), _ids(row, "related_ids")) for row in quality["challenge_findings"])), "",
              _table(("Gate", "Status", "Findings"), ((row["gate"] + " (" + row["gate_id"] + ")", row["status"], [_claim(item) for item in row["findings"]]) for row in quality["gates"])), "",
              "Consistency: " + ", ".join(f"{key}={str(value).lower()}" for key, value in sorted(quality["consistency_checks"].items())) + ".", "",
              "Unresolved high-severity challenge findings: " + (", ".join(quality["unresolved_high_severity_finding_ids"]) or "none") + ".", ""]
    return "\n".join(lines).rstrip() + "\n"


def validation_plan_payload(data: dict[str, Any]) -> dict[str, Any]:
    metadata = data["metadata"]; repository = metadata["repository"]
    threats = _records(data, "threats")
    return {
        "schema_version": data["schema_version"],
        "model": {"title": metadata["title"], "model_status": metadata["model_status"], "assurance_status": metadata["assurance_status"], "runtime_authorization": metadata["runtime_authorization"], "repository": repository["name"], "revision": repository["revision"]},
        "threat_index": [{"threat_id": row["threat_id"], "title": row["title"], "risk": _risk(row), "confidence": _confidence(row), "response_owner": row["response"]["owner"], "validation_test_ids": row["validation_test_ids"]} for row in sorted(threats, key=lambda row: (RISK_ORDER.get(_risk(row), 99), row["threat_id"]))],
        "validation_tests": _records(data, "validation_tests"),
    }


def coverage_payload(data: dict[str, Any]) -> dict[str, Any]:
    metadata = data["metadata"]; repository = metadata["repository"]
    return {"schema_version": data["schema_version"], "model": {"title": metadata["title"], "model_status": metadata["model_status"], "assurance_status": metadata["assurance_status"], "runtime_authorization": metadata["runtime_authorization"], "repository": repository["name"], "revision": repository["revision"]}, "coverage": data["coverage"], "questions": _records(data, "questions"), "quality_review": data["quality_review"]}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _write(output_dir: Path, artifacts: dict[str, str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    staged: list[tuple[Path, Path]] = []
    try:
        for name in sorted(artifacts):
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output_dir, prefix=f".{name}.", delete=False, newline="\n") as handle:
                handle.write(artifacts[name]); handle.flush(); os.fsync(handle.fileno())
                staged.append((Path(handle.name), output_dir / name))
        for temporary, destination in staged:
            os.replace(temporary, destination)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


def _diagnostics(errors: Sequence[Diagnostic], warnings: Sequence[Diagnostic]) -> None:
    for item in warnings: print(item.format("WARNING"), file=sys.stderr)
    for item in errors: print(item.format("ERROR"), file=sys.stderr)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv)
    try:
        data = load_model(args.model)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, RecursionError) as exc:
        print(f"ERROR: invalid input: {exc}", file=sys.stderr); return 2
    try:
        errors, warnings = validate_model(data)
    except RecursionError as exc:
        print(f"ERROR: invalid input: {exc}", file=sys.stderr); return 2
    if errors or (args.strict and warnings):
        _diagnostics(errors, warnings); print("ERROR: refusing to render an invalid threat model", file=sys.stderr); return 1
    if warnings: _diagnostics([], warnings)
    artifacts = {"threat-model.md": render_markdown(data), "validation-plan.json": _json(validation_plan_payload(data)), "coverage.json": _json(coverage_payload(data))}
    try:
        _write(args.output_dir, artifacts)
    except OSError as exc:
        print(f"ERROR: could not write artifacts: {exc}", file=sys.stderr); return 2
    for name in sorted(artifacts): print(args.output_dir / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
