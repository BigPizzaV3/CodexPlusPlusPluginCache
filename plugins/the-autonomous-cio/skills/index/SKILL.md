---
name: index
description: Use to discover and route The Autonomous CIO workflows. Route broad CIO, CISO, COO, CFO, Board, governance, transformation, crisis, operating review, decision-readiness, risk-chain, AI governance, value leakage, executive memory, and action-drafting requests to the right focused skill. Use when the user needs index for CIO decision support.
---

# The Autonomous CIO Index

## Skill Purpose

Route broad The Autonomous CIO requests to the right focused workflow. Treat invocation of this index as strong intent to use the plugin. Keep this skill as the router and orientation surface; load and follow the focused skill that owns the actual artifact.

## Mandatory User Context Gate

Before drafting a substantive CIO artifact, load `[$the-autonomous-cio:user-context](../user-context/SKILL.md)` and run its preflight script when local shell access is available:

```text
python skills/user-context/scripts/cio_preflight.py --workflow index
```

Use the returned `cio_preflight` envelope as authoritative for saved preferences, source-category mapping, output preferences, final obligations and context gaps. Do not look for a callable MCP tool named `user-context`.

If the preflight script is unavailable, continue with provided context and say that saved Autonomous CIO context was not loaded.

## Audience And Language

Write for executives and senior operators, not plugin maintainers. Translate workflow mechanics into practical executive value: what is being clarified, de-risked, prepared, challenged or made decision-ready.

Avoid implementation terms such as state file, cache, raw connector id, schema internals or runtime unless the user asks for debugging details.

## Broad Orientation Answer Shape

Use this shape for `what can you do?`, `help`, `how do I use this?`, `what should I try first?` and similar plugin-level requests:

```md
The Autonomous CIO can help with:
- Governed CIO autopilot reviews
- Executive Decision Packets for board, crisis, AI approval, portfolio and transformation decisions
- Evidence classification, risk chains, decision debt, board challenges and action drafts
- Executive Decision Defense: liability, blind spots, commitment integrity, value gates, decision SLA and kill-switches
- Local file/directory analysis and Visual Command Center data

Setup context:
- {Only include when useful: saved preferences or source-category gaps from `cio_preflight`}

Good first prompts:
- `@The Autonomous CIO run a governed CIO autopilot review from this context.`
- `@The Autonomous CIO build an Executive Decision Packet for this board decision.`
- `@The Autonomous CIO stress-test this board narrative and show decision liability.`
```

## Routing

If several focused skills apply, choose the best suite first, then sequence specialist modules inside that suite. Do not expose a long list of specialist skills unless the user asks for implementation detail. Do not perform focused workflow logic here.

## Skill Suites

Route through these eight suites first. Use specialist skills as internal modules unless the user explicitly asks for one.

1. Executive Operating System: `autonomous-cio-operating-review`
2. Executive Decision Intelligence: `executive-decision-packet`
3. Board And Narrative Defense: `board-challenger`
4. Risk, Resilience And Controls: `risk-chain-intelligence`
5. Transformation, Portfolio And Value: `transformation-value-tracker`
6. Industrial IT/OT, Quality And Manufacturing: `industrial-cio-operating-system`
7. Architecture, Data, AI And Vendor: `architecture-data-security-intelligence`
8. Organization, Operating Model And Knowledge: `organization-workforce-intelligence`

See `docs/skill-suites.md` for the specialist modules inside each suite.

## Primary Workflows

### autonomous-cio-operating-review

Use for broad CIO reviews, `run the CIO`, monthly operating reviews, mixed enterprise context, board in 48h scenarios, crisis-to-control reviews and enterprise decision-readiness work.

### executive-decision-packet

Use when context must become one decision-ready artifact with decision needed, facts vs assumptions, risk chain, options, board challenge questions, Executive Decision Defense, recommendation, missing evidence and draft next steps.

### autonomous-cio-orchestrator

Use when the user asks a broad or ambiguous executive question and needs a chain selected before the artifact is produced.

### industrial-cio-operating-system

Use when the context involves regulated manufacturing, production continuity, ERP/MES/QMS/PLM, IT/OT interfaces, shopfloor dependencies, audit evidence, digital order channels or supplier/platform exposure. Produce an integrated CIO operating view, not isolated IT tickets.

### executive-truth-layer

Use when the main task is separating facts, assumptions, hypotheses, narratives, contradictions and missing evidence.

### risk-chain-intelligence

Use when isolated risks need propagation mapping across project, architecture, security, finance, vendor, compliance and operations.

### decision-scenario-intelligence

Use when the user asks what to approve, defer, stop, fund, re-scope or decide.

### board-challenger

Use before board, steering, audit, CISO/CFO or investment approval to pressure-test narrative, evidence and liability.

### autonomous-action-framework

Use after insights exist and the user needs action drafts, approval requests, escalation drafts, decision logs or an action ledger.

### autonomous-executive-memory

Use when the user asks to carry decisions, assumptions, commitments, evidence or follow-ups forward.

## Source Categories

These are semantic source categories, not fixed connectors:

- `calendar`: executive meetings, board dates, steering forums, review cadence.
- `meeting_notes`: decisions, objections, commitments, risks and owner language.
- `document_store`: board packs, architecture notes, audit evidence, policies, strategy docs.
- `internal_messaging`: escalation texture, owner signals, blocker discussion and weak signals.
- `delivery_system`: project status, RAID, backlog, milestones, dependencies.
- `service_system`: incidents, outages, service health, operational risks.
- `security_system`: findings, access, controls, exceptions, remediation.
- `finance_system`: budget, forecast, spend, reserve, benefits and value evidence.
- `production_system`: MES, shopfloor, machine interface, production planning and line-impact signals.
- `quality_system`: QMS, CAPA, validation, audit, deviation and change-control evidence.
- `ot_system`: OT network, workstation, machine-connectivity and production-control dependency signals.
- `local_files`: user-provided files, exports, CSV, JSON, Markdown and text.

Use user-provided context and local files as valid fallback when live connectors are not available.

## Next Step Guidance

End substantive outputs with exactly one concrete next action unless the user asked for no follow-up or the workflow is blocked on a required clarification. Good continuations:

- ask whether to convert the output into an Executive Decision Packet
- offer to run Executive Decision Defense
- offer to generate the action ledger
- offer to update proposed executive memory
- offer to refresh Visual Command Center data from a local file

## Guardrails

Skills may use the Codex host LLM for semantic extraction and executive reasoning over provided context. Do not claim live connector access, automatic persistence or external execution unless a future explicit tool and user approval are available.
