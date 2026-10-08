---
name: go-money-and-ledgers
description: "Use for Go money, rounding, allocation, journal, balance, and reversal invariants. Do not use for provider state."
license: Apache-2.0
compatibility: "Go 1.24 or newer; currency and accounting rules require current product and jurisdiction evidence."
---

# Go money and ledgers

Money is a typed exact value. A ledger is immutable evidence, not a mutable balance table with an audit log added later.

## Represent money

Carry amount and currency together. Use integer minor units when the product contract fits one exponent; use exact decimal with explicit scale when it does not. Never use binary floating point for postings or settlement amounts. Validate currency, scale, range, and sign at the boundary.

Rounding is a named business operation: specify mode, scale, stage, and residual allocation. ISO/CLDR metadata alone cannot choose half-even versus half-up, cash rounding, or the legally correct tax stage; obtain product, contract, and jurisdiction evidence. Do not round intermediate values merely for display. Allocate remainders with a stable tie-break independent of map iteration so parts sum exactly to the source amount. Persist the per-part allocation and policy version; refunds and reversals use the original allocation rather than recomputing it under a new order or policy.

For FX, persist the booked quote identity, source and time, base/quote direction, exact rate and scale, rounding stage, resulting amounts, residual disposition, and policy version. Balance journals per currency; connect the two currency legs through explicit FX position or clearing accounts rather than netting unlike units. A reversal uses the original booking evidence unless the product contract creates a new conversion.

## Post a journal

Persist immutable entries with journal ID, account, currency, signed side/amount, effective and recorded time, operation identity, and source evidence. Enforce per-journal, per-currency balance in the same transaction. Use reversal or adjustment journals rather than editing history.

Distinguish pending, posted, and available balances if the product needs them. Derive balances from entries or maintain a projection transactionally coupled to entries and rebuildable from them.

## Concurrency and audit

Where overdraft, limits, reservations, or sequence matter, the decision read, authoritative balance/reservation mutation, journal posting, and operation claim share one atomic boundary. Name the anomaly and use a locked authoritative row, conditional balance/version update, or serializable transaction with whole-transaction retry. Enforce logical posting identity with a database uniqueness constraint. A balanced journal can still be unauthorized or economically wrong; preserve the business command and approval evidence. Avoid sensitive payloads while keeping immutable actor, time, reason, and correlation.

When the product exposes available balance, authorizations, or internal holds, read [references/reservations-and-balances.md](references/reservations-and-balances.md). Define which pending and posted entries affect availability, then make the decision and reservation one conditional durable transition.

Use `go-data-consistency` for the database anomaly and `go-financial-idempotency` for operation identity and replay.

Read [references/money-ledger-invariants.md](references/money-ledger-invariants.md) for arithmetic and schema checks, [references/fx-booking.md](references/fx-booking.md) for conversion evidence, and [references/corrections-and-effective-time.md](references/corrections-and-effective-time.md) for reversals, backdating, closed periods, and as-of replay.

## Output contract

State exact representation, rounding, journal balance, mutation policy, and concurrency invariant. Zero tolerance for silent precision loss or unbalanced committed entries.
