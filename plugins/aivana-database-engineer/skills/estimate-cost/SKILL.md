---
name: estimate-cost
description: "Estimate compute, IO, and runtime cost for a candidate query, migration, or schema operation."
---

# Estimate Cost

## Use when
- User needs execution cost estimate before confirmation.

## Workflow
1. Run dry estimates from plan/cost model plus historical baselines.
2. Convert to understandable unit economics (CPU, IO, storage, lock occupancy).
3. Provide confidence interval and alternative lower-cost variants.
4. Attach optimization preconditions.

## Governance
- Flag high-cost operations and require explicit human confirmation.
- Include environmental impact assumptions used in estimate.

## Output
- `estimatedCost`, `confidence`, `assumptions`, `optimizationLevers`
