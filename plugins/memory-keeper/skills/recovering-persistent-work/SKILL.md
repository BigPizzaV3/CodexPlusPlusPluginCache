---
name: recovering-persistent-work
description: Use when a persistent read, write, move, rename, delete, upload, or verification times out, is interrupted, partially succeeds, returns ambiguous status, repeatedly mismatches, or resumes after a mid-transaction stop.
---

# Recovering Persistent Work

## Core principle

**Recovery is bounded at both operation and transaction level. Failure never creates an infinite repair loop and never weakens verification.**

## Observe before recovery

After timeout/interruption/ambiguous result/failed post-write verification:

1. stop mutation;
2. fresh re-read/re-list the actual persistent surface;
3. compare observed state with pre-state and target;
4. classify failed, succeeded-despite-timeout, or partial success;
5. never repeat an ambiguous write if target state already holds.

## Stable operation fingerprint

Before an automatic recovery mutation, define an **operation fingerprint** from logical operation kind + canonical source identity + intended destination/target identity + intended postcondition. **renaming or subdividing a step does not reset** this fingerprint or its retry history.

## Bounded budgets

A **transaction** is one naturally atomic user-requested persistent target state. Independent operations may be separate transactions only when they have independent success criteria; never split or rename one failing transaction merely to refresh the budget.


- per operation fingerprint: at most **one automatic recovery attempt**;
- **transaction recovery budget:** **maximum 2 automatic recovery mutations** across the whole persistent transaction, even when fingerprints differ;
- observation/re-read does not consume mutation budget.

A recovery mutation is allowed only when unambiguous, safe, and it preserves the last known-good canon.

## Progress rule

After each recovery mutation, re-observe. Require **monotonic progress** toward the target: the set/severity of mismatches must strictly decrease. **no progress** (unchanged state), regression, or a state that **oscillates** A↔B stops automatic recovery immediately.

Also stop when the **same failing step** / fingerprint fails again, the global budget is exhausted, capability is missing, or the next action is destructive/ambiguous.

## Terminal state

Preserve last known-good truth where possible, report observed mismatch and smallest next decision/action, and mark **BLOCKED / NOT COMPLETE**. Never recursively rename repair steps to gain retries. Never relax a completion gate.

A later user action or newly available capability starts from a fresh audit; it does not retroactively make the failed transaction complete.
