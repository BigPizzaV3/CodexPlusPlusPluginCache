---
name: executive-decision-packet
description: Convert mixed enterprise context into the signature Executive Decision Packet with decision needed, facts vs assumptions, risk chain, options, board challenge questions, recommendation, missing evidence and draft next steps. Use when the user needs executive decision packet for CIO decision support.
---

# Executive Decision Packet

## Mission

Create the signature decision artifact for The Autonomous CIO. Turn meeting notes, risk registers, budget updates, project status, architecture context, security findings, AI proposals or crisis signals into one governed executive decision packet.

## Inputs

Accept mixed enterprise context, including meeting notes, risk registers, budget updates, portfolio status, audit findings, security concerns, AI use cases, vendor updates, architecture constraints, crisis notes and explicit decision requests.

## Workflow

For expiry, minimum evidence, changed recommendations, stakeholder disagreements,
reversible experiments, or outcome checks, read [Decision Lifecycle](references/decision-lifecycle.md).

Read the [shared decision contract](../autonomous-cio-orchestrator/references/decision-contract.md).
Preserve immutable claim IDs and source lineage even when invoked directly.
Apply its scoring gate: insufficient inputs mean qualitative analysis or abstention,
not invented percentages. Legacy runtime heuristic scores are not calibrated probabilities.

1. Identify the request type: Board Prep, Crisis Command, AI Approval, Transformation Value, Portfolio Decision, Operating Review, Risk Escalation or General Executive Decision.
2. State the selected reasoning chain and why it fits.
3. Use the Codex host LLM as the primary semantic extraction layer: classify facts, inferences, assumptions, hypotheses, narratives, contradictions, entities, dependencies and missing evidence.
4. Rank weak and strong signals by executive relevance, impact, urgency, dependency reach and uncertainty.
5. Map the risk chain from signal to dependency, amplifier, business impact and decision pressure.
6. Identify decision debt, contradictions, value leakage and governance gaps.
7. Compare options by benefit, risk, dependency, reversibility and confidence.
8. Simulate board pressure from CEO, CFO, CISO, Audit, regulator, customer or employee perspectives as relevant.
9. Add Executive Decision Defense when approval, board exposure, risk acceptance, transformation value, audit/security controls or material commitment is involved.
10. Recommend the action, safeguards, owner and first move.
11. Prepare draft next steps for 24h, 7d and 30d without claiming external execution.

## Executive Decision Defense

Include these sections when relevant:

- Decision Liability Shield
- Executive Blind Spot Radar
- Commitment Integrity Score
- Board Narrative Stress Test
- Autonomous Decision Memory Diff
- Value Realization Firewall
- Risk-to-Cash Translator
- Decision SLA Monitor
- Control Evidence Readiness
- Executive Attention Allocator
- Scenario Kill-Switch
- CIO Operating System Loop

## Local Engine Support

When working in the local repository, `engine/cli.py` can generate reproducible outputs for this format. The Codex skill layer may provide an `llm_extraction` object to the local engine; the engine then uses that structured LLM extraction for deterministic scoring, risk mapping and dashboard generation. If no `llm_extraction` is provided, the engine falls back to local heuristics.

Treat the engine as a local support artifact only; do not imply live data access, automatic persistence or external action execution.

## LLM Extraction Contract

### Adaptive Decision Model

For changed evidence, option thresholds, uncertainty or constrained portfolio choices, prepare an optional `decision_model` for the local `adaptive-review` command. Preserve stable IDs across reviews.

- Extract evidence with `id`, `claim`, `origin_id` and `derived_from` IDs. A repeated message is not independent corroboration. Unknown origins remain unknown.
- Extract variables with `id`, numeric `value`, `min`, `max` and `evidence_ids`. Separate observed values from proposed ranges; do not invent numbers to complete the model.
- Describe at least two options using `id`, `intercept` and a `weights` map keyed by variable ID. State a common `utility_unit`. Coefficients express explicit preferences or assumptions, not facts inferred from prose. Ask for material missing trade-offs or show a clearly labeled illustrative model.
- Pass the prior model as `previous_decision_model`. Never silently replace historical input with current knowledge.
- Run `python engine/cli.py adaptive-review --input <local-context.json>` only when the source runtime is available. Otherwise reason qualitatively without claiming computed results.
- Preserve `abstain_pending_evidence` in the final recommendation. Report the candidate, switch thresholds, joint-range robustness, ranked evidence questions and source clusters. A candidate is not an approval.
- Outcome feedback may populate `outcomes` with source references and observation dates. User approval is not outcome verification; forecast reliability is not decision-success probability.
- Optional `portfolio` inputs require explicit capacities, resource usage, additive comparable values and dependencies. The exact solver supports at most 18 projects.
- Offer the returned snapshot as an explicit local artifact. Replay verifies the model and analysis hashes, not source authenticity or reproduction of LLM reasoning.

The lean marketplace package contains skill instructions; runtime commands require the full source checkout. The complete field contract and example are in the repository's `docs/decision-intelligence-engine.md` and `engine/examples/adaptive_decision.json`.

When preparing engine-ready context, populate this optional object:

```json
{
  "llm_extraction": {
    "facts": [],
    "inferences": [],
    "assumptions": [],
    "hypotheses": [],
    "narratives": [],
    "contradictions": [],
    "entities": [],
    "dependencies": [],
    "missing_evidence": []
  }
}
```

## Handoff Rules

- From `executive-truth-layer`, preserve facts, assumptions, narratives, contradictions and missing evidence exactly.
- From `risk-chain-intelligence`, preserve: signal -> dependency -> amplifier -> business impact -> decision pressure.
- From `decision-scenario-intelligence`, preserve options, reversibility, sensitivities and kill criteria.
- From `board-challenger`, preserve hardest questions and weak-answer risks.
- To `autonomous-action-framework`, pass only draft actions with owner, approval and evidence gates.
- To `autonomous-executive-memory`, pass decisions, assumptions, commitments and unresolved evidence gaps.

## Output Format

Default: the shared contract's first-page brief, at most 450 words. Include the
decision, recommendation/abstention, options, decisive evidence, blockers, owner,
approval gate, and next action. Detailed formats below belong in an appendix when
requested or necessary. Include only relevant Executive Decision Defense elements.

- Request Type
- Selected Skill Chain
- Why This Chain
- Decision Needed
- Situation
- Facts vs Assumptions
- Risk Chain
- Options
- Board Challenge Questions
- Executive Decision Defense
- Recommended Action
- Missing Evidence
- Draft Next Steps: Next 24h / 7d / 30d

## Guardrails

Do not claim live system access, automatic persistence or executed external actions. Treat legal, regulatory, HR, security and financial conclusions as decision support, not final specialist determinations. Make confidence and missing evidence visible.
