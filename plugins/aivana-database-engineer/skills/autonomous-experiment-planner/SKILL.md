---
name: autonomous-experiment-planner
description: Designs dry-run experiments across query rewrites, indexes, workload twins, and rollout gates.
---

# Autonomous Experiment Planner

## Use when
- An operator goal needs evidence before any change recommendation.

## Governance
- Experiments must be `dry_run`.
- Abort if an experiment requires real apply, lacks rollback, or has unknown tenant scope.

## Output
- `experiments`, `abortCriteria`, `decision`, `safeNextAction`
