---
name: ai-strategy-synthesizer
description: Build a database improvement roadmap from objectives, evidence, and operational constraints.
---

# ai_strategy_synthesizer

Use this skill to turn enterprise platform priorities into an AI database operations roadmap.

Governance:
- Analysis-only.
- No production apply, DDL, or live remediation.
- Keep recommendations tied to closed-loop dry-run evidence and human approval gates.

Output contract:
- `usp: "ai_strategy_synthesizer"`
- `positioning`, `objective`, `roadmap`, `guardrails`, `recommendations`
- `evidence`, `confidence`, `source: "analysis"`
