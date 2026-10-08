# FX booking invariants

An FX result is reproducible only when the booked rate contract is evidence, not an ephemeral input.

Persist the quote or rate identity, source, observed and expiry times, base and quote currencies, direction, exact rate representation and scale, input amount, output amount, rounding rule, residual disposition, and policy version. A provider display rate or later market rate cannot reconstruct the booked economics.

Do not add unlike currencies to prove a journal balances. Balance each currency independently under the ledger's sign convention and represent the economic exchange through explicit FX position, clearing, receivable/payable, revenue, or expense accounts chosen by the accounting policy. A numerical `100 USD - 100 EUR == 0` is not an accounting invariant.

When one conversion is allocated across items, calculate from the contractual total and distribute the indivisible residual with a stable tie-break. Persist the allocation. Refunds, reversals, disputes, and corrections reference the original booked rate and allocation unless the product explicitly creates a new FX event; silently applying the latest rate creates unexplained gain or loss.

ISO 4217 or CLDR currency metadata can constrain codes, standard digits, and cash rounding metadata. It cannot select the commercial rate, spread, quote lifetime, accounting accounts, tax stage, or legally required rounding rule.
