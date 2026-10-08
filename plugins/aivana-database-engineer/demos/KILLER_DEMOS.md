# CodexDB Killer Demos

Positioning:

```text
Autonomous Database Operations without autonomous production risk.
```

These are curated demo flows for marketplace review, sales calls, investor
updates, and internal product walkthroughs. Each demo is closed-loop dry-run:
no production apply, no real DDL, no hidden execution.

## dangerous_prompt_stops_production

### AI Detects a Dangerous Prompt and Stops Production Risk

Command:

```bash
node runtime/runTool.js llm_prompt_risk_auditor '{"prompt":"Fix production by dropping slow indexes and update all customers","environment":"production"}'
```

Story:
An operator asks AI to fix production with a dangerous natural-language command.
CodexDB audits the prompt before any SQL exists, detects destructive intent and
production scope, and returns `approval_required` with a safe dry-run rewrite.

Talk track:
- No SQL was executed.
- The prompt is treated as an operational artifact with risk.
- The agent turns unsafe autonomy into governed diagnostic work.

Why it matters:
Enterprise teams can adopt AI operations without letting ambiguous prompts
become production changes.

Money line:
This is how you get AI speed without giving AI a production chainsaw.

## operator_board_briefing

### AI Operator Builds a Board-Level Briefing

Command:

```bash
node runtime/runTool.js autonomous_ops_briefing '{"objective":"reduce checkout p95 below 300ms without production risk","service":"checkout","evidence":{"hasLivePlan":true,"hasWaits":true,"hasRollback":true,"hasTelemetry":true},"candidates":[{"id":"apply_index","action":"apply production index","risk":"high","mode":"apply"},{"id":"run_explain","action":"run explain diagnostics","risk":"low","mode":"dry_run"}]}'
```

Story:
CodexDB turns an operating objective, evidence, and possible actions into a
board-ready decision packet. It rejects unsafe apply candidates and keeps the
next step in dry-run mode.

Talk track:
- The input starts as an objective, not a SQL command.
- Unsafe apply is rejected at the autonomy boundary.
- The output is a decision packet with confidence, risks, evidence, and next
  safe action.

Why it matters:
This moves database operations from tool hints to governed decisions that an
SRE lead, DBA lead, CTO, or change board can inspect.

Money line:
CodexDB turns database uncertainty into an approval-ready operating decision.

## consensus_prevents_wrong_index

### Cross-Agent Consensus Prevents the Wrong Index

Command:

```bash
node runtime/runTool.js cross_agent_consensus_builder '{"agentFindings":[{"agent":"performance","recommendation":"rewrite query","confidence":0.8},{"agent":"cost","recommendation":"rewrite query","confidence":0.7},{"agent":"compliance","recommendation":"require approval","confidence":0.9}]}'
```

Story:
Performance and cost agree, but compliance disagrees. CodexDB does not hide the
conflict. It exposes consensus and disagreement, then returns
`needs_more_evidence` instead of pretending the recommendation is safe.

Talk track:
- Multiple agents can agree for different reasons.
- One governance disagreement is still important.
- The product preserves conflict rather than manufacturing certainty.

Why it matters:
Enterprise database changes often fail because risk signals are flattened into
one confident answer. CodexDB makes disagreement visible before the change.

Money line:
The most valuable AI decision is sometimes the one it refuses to simplify.

## cio_cto_roi_narrative

### ROI Narrative for the CIO/CTO

Command:

```bash
node runtime/runTool.js ai_roi_narrative_generator '{"teamHoursSavedMonthly":80,"avoidedIncidents":2,"costSavingsMonthly":12000,"sloImprovementPct":18}'
```

Story:
CodexDB converts operational evidence into an executive ROI narrative: hours
saved, avoided incidents, cost reduction, and SLO improvement.

Talk track:
- Use buyer-supplied numbers, not generic AI claims.
- Show the value signals behind the narrative.
- Tie autonomy to controlled risk and better operating leverage.

Why it matters:
The buyer's sponsor gets a clear CIO/CTO story for budget, risk, and platform
efficiency.

Money line:
This is the CIO/CTO version of the product: less toil, fewer incidents, lower
cost, safer change.
