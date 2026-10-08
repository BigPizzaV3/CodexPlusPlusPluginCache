# Iteration Closure

## Operation

Assess completion only against the selected objective, acceptance evidence and remaining gates. Return done, next slice, replan or blocked without reopening unrelated work.

## Goal

Decide whether the selected implementation slice is complete, requires the next already-separated slice, must be replanned, or is blocked by an external gate. Do not reopen unrelated audit scope.

## Required evidence

Supply the selected task or audit result, the implementation summary, the patch verdict, any domain-check evidence, and any release or production gates. Read the evidence; do not re-audit unrelated repository areas.

## Decision rules

- `DONE`: every acceptance condition is evidenced, patch defects are resolved, and remaining gates are explicitly external/non-blocking for the requested stage.
- `NEXT_SLICE`: the current slice is correct and complete, but a previously separated dependent slice remains.
- `REPLAN`: evidence invalidates owner, invariant, compatibility, or rollout assumptions.
- `BLOCKED`: completion depends on unavailable access, environment, business decision, or unsafe operation that cannot be simulated.

Do not call work done because tests passed when the accepted behavior, migration, recovery, or operator path remains unproven.
