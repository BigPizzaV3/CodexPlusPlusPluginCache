---
name: go-clearing-settlement-reconciliation
description: "Use after capture for Go settlement, reconciliation, exceptions, and repair. Do not use for initial authorization."
license: Apache-2.0
compatibility: "Go 1.24 or newer; rail cutoffs, calendars, reports, and finality come from current provider and scheme contracts."
---

# Go clearing, settlement, and reconciliation

Do not collapse payment acceptance, clearing, settlement, payout, and bank movement into one success flag. They are separate evidence domains with different timing and finality.

## Preserve evidence

Ingest external reports and statements immutably with artifact identity, source version, checksum, retrieval time, business date, completeness/sequence evidence, and parser version. A corrected artifact does not overwrite its predecessor: record `supersedes` lineage and create explicit rematching or reversal work. Make re-ingestion idempotent. Preserve raw evidence under access and retention policy; derive versioned normalized items separately.

## Match at item level

Match stable external/internal identity first, then amount, currency, lifecycle, account, and time window. Support 1:1, 1:N, and N:1 match groups when the source economics require them. Every normalized economic component belongs to exactly one explained match group or one explicit exception; never reuse an item across groups. Each group must satisfy a currency-preserving equation over captures, refunds, fees, reserves, adjustments, and bank movement.

Exceptions include missing internal, missing external, duplicate, amount/currency mismatch, status mismatch, timing break, and incomplete or superseded evidence. Persist the rule and source versions behind every match decision.

Aggregate totals are controls, not sufficient reconciliation. Equal and opposite item errors can net to zero.

## Adjust deliberately

Age timing breaks by rail calendars and cutoffs. Separate automated detection from authorized remediation. Adjust with linked immutable ledger entries; never rewrite the original payment or report. Reruns must not duplicate adjustments or erase prior decisions.

## Recovery and operations

Use restartable batches, checkpoints, deterministic matching, bounded concurrency, and work queues with ownership. Publish completeness, unmatched amount/count, age, duplicate count, and source freshness without leaking sensitive data.

Read [references/reconciliation-model.md](references/reconciliation-model.md) for stages and controls. For Fedwire acceptance, cancellation, outage, and resend semantics, read [references/fedwire-finality-and-contingency.md](references/fedwire-finality-and-contingency.md) and verify the deployed circular version.

For FedACH post-origination processing, read [references/ach-returns-and-corrections.md](references/ach-returns-and-corrections.md). Keep returns, Notifications of Change, reversals, and disputed returns distinct; their value effects, roles, and permitted timing are not interchangeable.

For rail business days, holidays, processing windows, cutoff extensions, and schedule changes, read [references/business-time-and-cutoffs.md](references/business-time-and-cutoffs.md). Persist the governing schedule and timezone version with each decision; a UTC calendar date, fixed offset, or `Add(24*time.Hour)` is not a rail calendar.

## Output contract

State source evidence, matching key, timing policy, exception taxonomy, adjustment authorization, and replay behavior. Missing or silently auto-matched money is a critical defect.
