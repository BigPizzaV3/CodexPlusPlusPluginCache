---
name: next-best-safe-action
description: Chooses the safest next dry-run diagnostic or experiment from candidate actions.
---

# Next Best Safe Action

## Use when
- Multiple actions are available and the operator must choose the safest next step.

## Governance
- Never select apply-mode actions as autonomous next steps.
- Prefer low-risk dry-run diagnostics and simulations.

## Output
- `safeNextAction`, `rejectedActions`, `decision`, `confidence`
