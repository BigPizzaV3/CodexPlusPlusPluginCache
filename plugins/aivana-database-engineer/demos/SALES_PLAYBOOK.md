# CodexDB Agent Sales Playbook

## Sales Narrative

CodexDB Agent is for teams that want AI-speed database operations without giving
AI direct production authority. The strongest story is not "AI writes SQL." The
strongest story is "AI reasons through database operations, gathers evidence,
shows uncertainty, and stops before unsafe change."

Default positioning:

```text
Autonomous Database Operations without autonomous production risk.
```

## Discovery Questions

- How often do database changes block releases or incident response?
- Where does query, index, or migration evidence live today?
- What has to be true before a production database change is approved?
- Which database incidents are hardest to explain after the fact?
- Are developers already using AI to ask for database advice?
- What would make your compliance or security team comfortable with AI-assisted
  database operations?
- How do you currently connect DBA/SRE work to executive value?

## Qualification Signals

Strong fit:

- The team runs business-critical SQL Server or PostgreSQL workloads.
- Database incidents affect revenue, customer trust, or SLOs.
- There is an approval process for schema, index, migration, or production
  performance changes.
- The buyer wants AI assistance but does not want autonomous production apply.
- Evidence is scattered across tools, people, tickets, and dashboards.

Weak fit:

- No meaningful production database risk.
- The buyer only wants a SQL editor.
- The buyer expects fully autonomous production changes without controls.

## Demo Flow

### 1. AI Detects a Dangerous Prompt and Stops Production Risk

Goal:

Show that CodexDB treats natural-language AI prompts as operational risk before
SQL exists.

Command:

```bash
node runtime/runTool.js llm_prompt_risk_auditor '{"prompt":"Fix production by dropping slow indexes and update all customers","environment":"production"}'
```

What to show:

- `decision: "approval_required"`
- Risks such as destructive intent and production scope.
- The safe rewrite into governed dry-run diagnostic work.

Close:

"The first production safety boundary is not SQL parsing. It is intent parsing."

### 2. AI Operator Builds a Board-Level Briefing

Goal:

Show that CodexDB can turn an operating objective into a decision packet.

Command:

```bash
node runtime/runTool.js autonomous_ops_briefing '{"objective":"reduce checkout p95 below 300ms without production risk","service":"checkout","evidence":{"hasLivePlan":true,"hasWaits":true,"hasRollback":true,"hasTelemetry":true},"candidates":[{"id":"apply_index","action":"apply production index","risk":"high","mode":"apply"},{"id":"run_explain","action":"run explain diagnostics","risk":"low","mode":"dry_run"}]}'
```

What to show:

- Unsafe apply action is rejected.
- Safe next action remains dry-run.
- Board summary, risks, evidence, and confidence are available in one packet.

Close:

"This is not a tuning hint. This is an operating decision."

### 3. Cross-Agent Consensus Prevents the Wrong Index

Goal:

Show that CodexDB preserves disagreement instead of inventing certainty.

Command:

```bash
node runtime/runTool.js cross_agent_consensus_builder '{"agentFindings":[{"agent":"performance","recommendation":"rewrite query","confidence":0.8},{"agent":"cost","recommendation":"rewrite query","confidence":0.7},{"agent":"compliance","recommendation":"require approval","confidence":0.9}]}'
```

What to show:

- Performance and cost agree.
- Compliance disagrees.
- Decision remains `needs_more_evidence`.

Close:

"A responsible AI operator knows when agreement is not enough."

### 4. ROI Narrative for the CIO/CTO

Goal:

Translate technical database work into executive value.

Command:

```bash
node runtime/runTool.js ai_roi_narrative_generator '{"teamHoursSavedMonthly":80,"avoidedIncidents":2,"costSavingsMonthly":12000,"sloImprovementPct":18}'
```

What to show:

- Executive narrative.
- Evidence fields.
- Monthly value signal.

Close:

"This is how the platform team explains safer database operations in business
language."

## Objection Handling

"We already have monitoring."

Monitoring tells you what happened. CodexDB helps decide what to do next, what
evidence is missing, and whether an action should proceed, defer, or require
approval.

"We already have DBAs."

CodexDB is designed to amplify DBAs, not replace them. It handles repeatable
evidence collection, risk framing, and decision packaging so experts spend more
time on judgment.

"We cannot allow AI to make production changes."

That is the point. CodexDB's autonomous layer is closed-loop dry-run. It reasons,
simulates, and prepares evidence, but it does not perform unapproved production
apply.

"Generic AI can already generate SQL."

Generic AI can generate SQL, but it does not provide database-specific policy
gates, rollback evidence, production boundaries, confidence budgets, or
cross-agent disagreement handling.

"How do we trust the output?"

Trust comes from structured evidence, declared contracts, replay metadata,
policy decisions, missing-evidence reporting, and deterministic tool behavior.

## Follow-Up Email

Subject:

CodexDB Agent: governed AI operations for SQL Server and PostgreSQL

Body:

Thanks for taking the time today. The core takeaway is that CodexDB Agent gives
your platform team AI-speed database operations without granting AI direct
production authority.

The demos covered four operating moments:

- Dangerous production prompts are stopped before SQL exists.
- Database objectives become board-level decision briefings.
- Cross-agent disagreement prevents premature recommendations.
- Reliability and toil improvements become an executive ROI narrative.

The next useful step is to run the closed-loop dry-run workflows against one
representative staging service, using your query plans, telemetry, rollback
expectations, and approval rules.

## Close Plan

1. Pick one critical database service.
2. Run production readiness in staging.
3. Run one dangerous-prompt demo with the buyer's own operational language.
4. Run one board-level briefing against a real SLO or release objective.
5. Review evidence gaps with DBA, SRE, and compliance stakeholders.
6. Convert the result into a pilot success plan.

## Pilot Success Criteria

- At least one risky AI prompt is correctly blocked or escalated.
- At least one real performance objective produces an evidence packet.
- Missing evidence is reported instead of hidden.
- DBA/SRE stakeholders agree the dry-run boundary is safe.
- Executive sponsor can explain the ROI narrative in business terms.
