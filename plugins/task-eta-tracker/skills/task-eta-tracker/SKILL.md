---
name: task-eta-tracker
description: Estimate and track honest completion-time ranges for long-running or uncertain Codex tasks using milestones, observed elapsed time, required verification, blockers, and confidence. Use when the user asks for an ETA, remaining time, progress forecast, periodic status, or why a task is taking so long; when a task is expected to require several material phases; or when an active task materially exceeds its earlier estimate. Do not use for quick single-step requests where tracking would cost more than the work.
---

# Task ETA Tracker

Track progress without implying precision that the available evidence cannot support. Preserve the task's acceptance criteria and required verification; an ETA is a forecast, never a deadline or permission to skip work.

## Establish the forecast

1. Identify the observable done condition and every mandatory gate.
2. Inspect enough current state to distinguish completed work from assumptions. Do not estimate from the prompt alone when a brief read-only check can expose the scope.
3. Divide the remaining work into 3–7 outcome-based milestones. Keep tool waiting, external waiting, implementation, and verification distinguishable.
4. For each milestone, assign a three-point duration estimate:
   - optimistic: known path succeeds without rework;
   - likely: normal execution plus ordinary correction;
   - pessimistic: plausible failure or rerun, not an extreme disaster.
5. Sum the milestone estimates. Report a rounded range from the optimistic total to the pessimistic total, with the likely total as the center. Avoid minute-level precision unless durations are directly measured and deterministic.
6. Set confidence:
   - `high`: scope is inspected, steps are deterministic, and no material unknown remains;
   - `medium`: scope is bounded but one or two implementation or test uncertainties remain;
   - `low`: scope, environment, external dependency, or required rework is not yet bounded.

Use elapsed time, active goal telemetry, plan state, command output, and test history when available. Never infer progress from token consumption alone.

## Maintain the estimate

Update the forecast after a material milestone, a scope or blocker change, a user request, or when actual elapsed time makes the previous range implausible. Do not perform extra expensive work solely to make the ETA look precise.

At each update:

1. Mark milestones as complete, active, pending, or blocked.
2. Replace estimates with actual elapsed time for completed milestones.
3. Re-estimate only the remaining milestones using newly observed rates and failures.
4. Include all still-required review, tests, rendering, or handoff work.
5. Explain material movement in one sentence: scope discovery, tool wait, failed check, rework, or faster-than-expected completion.
6. Escalate uncertainty instead of silently extending the clock.

Reforecast immediately when the likely finish moves beyond the previous pessimistic bound or the remaining work grows by roughly 50 percent. If an external wait has no defensible duration, report `waiting on external state; no reliable ETA` and give the next check or unblock condition.

## Report compactly

Use this shape for normal commentary updates:

```text
Progress: 2/5 milestones complete; tests are running.
ETA: 20–40 min (likely ~30 min, medium confidence).
Changed because: one integration failure added a focused rerun.
Remaining: fix failure → rerun affected tests → final review.
```

For a first estimate, explicitly label it `Initial estimate`. For a revision, label it `Revised estimate` and retain the prior range in the explanation when useful. If no numeric estimate is defensible, provide the known next milestone and the condition needed before estimating.

## Guardrails

- Treat ranges as active working time unless explicitly including an external wait.
- Do not claim a percentage complete when milestones vary greatly in size; prefer completed/total milestones plus the active phase.
- Do not treat compilation, a static preview, or a partial test as completion when stronger evidence is required.
- Do not omit recovery paths, user-requested scope, repository gates, or validation to meet an estimate.
- Do not interrupt a mutation or test just to report status; update at the next safe boundary.
- Stop tracking when the task is complete, cancelled, or genuinely blocked.
