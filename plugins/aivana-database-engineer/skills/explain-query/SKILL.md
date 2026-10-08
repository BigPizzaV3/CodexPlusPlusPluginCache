---
name: explain-query
description: "Run structured explain/explain-analyze workflows and convert plan output into explainable optimization insights."
---

# Explain Query

## Use when
- User asks why query is slow.
- Planner needs operator-level bottleneck explanation.

## Workflow
1. Parse query intent and classify risk (read-only preferred mode).
2. Collect `EXPLAIN` and `EXPLAIN ANALYZE` output in deterministic form.
3. Annotate scan patterns, joins, sort/hash/temp spills, and lock indicators.
4. Produce rewrite hypotheses with confidence scores.

## Governance
- Default to dry-run style if query could mutate data.
- Provide "why" and "impact estimate" before any recommendation.

## Output
- `plan`, `bottlenecks`, `rewriteHints`, `estimatedCost`, `confidence`
