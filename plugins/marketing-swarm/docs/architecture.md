# Plugin architecture

## Product boundary

Marketing Swarm is an analytical and decision-support Plugin for paid media. It coordinates specialist reasoning but keeps external actions outside the package boundary unless the host separately exposes an authorized app.

## Core flow

```text
request
  -> router
  -> evidence inventory
  -> one or more specialist Skills
  -> decision-quality-gate
  -> answer with evidence / inference / action separation
```

## Multi-Skill examples

### Account performance dropped

`campaign-diagnostics` -> `marketing-memory` -> `scenario-simulation` -> `decision-quality-gate`

### Creative performance is decaying

`creative-genome-analysis` -> `creative-fatigue-mutation` -> `scenario-simulation` -> `decision-quality-gate`

### Platform budget shift

`campaign-diagnostics` -> `budget-media-allocation` -> `scenario-simulation` -> `causal-attribution` when attribution quality is material -> `decision-quality-gate`

### Attribution dispute

`causal-attribution` -> `marketing-memory` if prior experiments exist -> `decision-quality-gate`

## Mutation boundary

Analytical output may include a proposed action plan. Live campaign mutation is a separate operation. When a compatible write-capable app is available, the model must restate the exact material changes, apply only what the user authorized, and report the resulting action evidence. Without such an app, stop at a ready-to-execute plan.
