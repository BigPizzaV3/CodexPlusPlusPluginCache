from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ragops.policy_v2 import ReleaseDecision


@dataclass(frozen=True)
class GateExplanation:
    gate_id: str
    policy_path: str
    scope: str
    case_ids: tuple[str, ...]
    observed: float
    threshold: float
    comparator: str
    required_change: float
    waived: bool
    waiver: dict[str, str | None] | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class DecisionExplanation:
    schema_version: str
    scenario_id: str
    decision: str
    items: tuple[GateExplanation, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "scenario_id": self.scenario_id,
            "decision": self.decision,
            "items": [item.to_dict() for item in self.items],
        }


def explain_decision(decision: ReleaseDecision) -> DecisionExplanation:
    items = []
    for gate in decision.gates:
        if gate.passed:
            continue
        required_change = (
            max(0.0, gate.threshold - gate.observed)
            if gate.comparator == ">="
            else max(0.0, gate.observed - gate.threshold)
        )
        waiver = None
        if gate.waived:
            waiver = {
                "owner": gate.waiver_owner,
                "reason": gate.waiver_reason,
                "expires_at": gate.waiver_expires_at,
            }
        items.append(
            GateExplanation(
                gate_id=gate.id,
                policy_path=gate.policy_path,
                scope=gate.scope,
                case_ids=gate.case_ids,
                observed=gate.observed,
                threshold=gate.threshold,
                comparator=gate.comparator,
                required_change=required_change,
                waived=gate.waived,
                waiver=waiver,
            )
        )
    return DecisionExplanation("1.0", decision.scenario_id, decision.decision, tuple(items))
