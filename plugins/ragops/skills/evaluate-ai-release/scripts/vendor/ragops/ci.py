from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from typing import Any

from ragops.policy_v2 import GateEvidence, ReleaseDecision


def junit_xml(decision: ReleaseDecision) -> str:
    failures = sum(not gate.passed and not gate.waived and gate.severity == "block" for gate in decision.gates)
    skipped = sum(not gate.passed and (gate.waived or gate.severity == "warn") for gate in decision.gates)
    suite = ET.Element(
        "testsuite",
        {
            "name": f"ragops: {decision.scenario_id}",
            "tests": str(len(decision.gates)),
            "failures": str(failures),
            "skipped": str(skipped),
        },
    )
    for gate in decision.gates:
        case = ET.SubElement(suite, "testcase", {"name": gate.id, "classname": "ragops.release_gate"})
        message = _message(gate)
        if not gate.passed and gate.waived:
            ET.SubElement(case, "skipped", {"message": f"waived: {message}"})
        elif not gate.passed and gate.severity == "warn":
            ET.SubElement(case, "skipped", {"message": f"warning: {message}"})
        elif not gate.passed:
            ET.SubElement(case, "failure", {"message": message, "type": gate.policy_path}).text = message
    ET.indent(suite)
    return ET.tostring(suite, encoding="unicode", xml_declaration=True) + "\n"


def github_summary(decision: ReleaseDecision, *, max_gates: int = 50) -> str:
    max_gates = max(1, min(max_gates, 100))
    lines = [
        f"## RAGOps release gate: {_markdown(decision.decision)}",
        "",
        f"Scenario: `{_markdown(decision.scenario_id)}`",
        "",
        "| Gate | Scope | Observed | Threshold | Result |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for gate in decision.gates[:max_gates]:
        result = "PASS" if gate.passed else "WAIVED" if gate.waived else gate.severity.upper()
        lines.append(
            f"| `{_markdown(gate.id)}` | `{_markdown(gate.scope)}` | {gate.observed:.6g} | "
            f"{gate.comparator} {gate.threshold:.6g} | {result} |"
        )
    omitted = len(decision.gates) - max_gates
    if omitted > 0:
        lines.extend(["", f"{omitted} additional gates omitted."])
    return "\n".join(lines) + "\n"


def sarif_report(decision: ReleaseDecision) -> dict[str, Any]:
    failed = tuple(gate for gate in decision.gates if not gate.passed)
    rules = [
        {
            "id": gate.id,
            "name": _sarif_name(gate.id),
            "shortDescription": {"text": gate.policy_path},
            "properties": {"severity": gate.severity, "scope": gate.scope},
        }
        for gate in failed
    ]
    results = [
        {
            "ruleId": gate.id,
            "level": "note" if gate.waived else "error" if gate.severity == "block" else "warning",
            "message": {"text": _message(gate)},
            "properties": {
                "policyPath": gate.policy_path,
                "caseIds": list(gate.case_ids),
                "waived": gate.waived,
            },
        }
        for gate in failed
    ]
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {"driver": {"name": "RAGOps", "informationUri": "https://github.com/thangldw/ragops", "rules": rules}},
                "results": results,
            }
        ],
    }


def render_ci(decision: ReleaseDecision, output_format: str) -> str:
    if output_format == "junit":
        return junit_xml(decision)
    if output_format == "github":
        return github_summary(decision)
    if output_format == "sarif":
        return json.dumps(sarif_report(decision), ensure_ascii=False, indent=2) + "\n"
    raise ValueError(f"Unsupported CI format: {output_format}")


def _message(gate: GateEvidence) -> str:
    return (
        f"{gate.policy_path}: observed {gate.observed:.6g} "
        f"must be {gate.comparator} {gate.threshold:.6g}; cases={','.join(gate.case_ids) or 'none'}"
    )


def _markdown(value: str) -> str:
    return value.replace("\\", "\\\\").replace("|", "\\|").replace("`", "\\`").replace("\n", " ")


def _sarif_name(value: str) -> str:
    result = "".join(character if character.isalnum() else "_" for character in value)
    return result[:128] or "ragops_gate"
