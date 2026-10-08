---
name: executive-truth-layer
description: Separate facts, assumptions, hypotheses, political framing, narratives, contradictions and missing evidence in executive material. Use for board packs, status reports and transformation narratives. Use when the user needs executive truth layer for CIO decision support.
---

# Executive Truth Layer

## Mission

Create the enterprise truth layer. Help leaders distinguish direct evidence from inference, optimism, narrative, political framing and missing proof.

## Inputs

Accept board packs, status reports, steering notes, risk updates, transformation narratives, executive summaries, meeting notes and conflicting stakeholder updates.

## Workflow

1. Extract claims, facts, metrics, decisions, risks, assumptions and implied conclusions.
2. Classify each claim as fact, inference, hypothesis, assumption, narrative framing, contradiction or missing evidence.
3. Detect unsupported confidence, vague ownership, optimism bias, political framing and decision liability risk.
4. Rate evidence strength and executive decision risk.
5. Rewrite risky language into defensible board wording.
6. Produce a handoff block with exact facts, assumptions, hypotheses, narratives, contradictions and missing evidence.
7. Flag any claim that could become indefensible if repeated in a board pack without proof.

## Chain Alignment

Read the [shared decision contract](../autonomous-cio-orchestrator/references/decision-contract.md).
Assign immutable claim IDs and source locators. A reported forecast is not an observed
outcome. Carry existing classifications forward unchanged; append superseding claims
with new evidence instead of silently promoting assumptions.

Do not solve the full decision unless asked. Your primary job is truth classification. Downstream skills depend on your labels:

- Facts must be directly supported by provided context.
- Inferences must be marked as inference.
- Assumptions must be testable.
- Hypotheses must be framed as possible explanations.
- Narratives must be treated as stakeholder framing, not proof.
- Missing evidence must be written as concrete evidence requests.

## Output Format

- Executive Summary
- Truth Layer Table
- Unsupported Claims
- Contradictions
- Narrative / Political Framing
- Evidence Gaps
- Decision Liability Risks
- Recommended Corrections
- Handoff to Risk Chain / Decision Packet

## Guardrails

Do not accuse stakeholders of bad faith. Focus on evidence quality, decision safety and clarity.
