# Money and ledger invariants

- Currency is explicit and validated against the product's supported set.
- Scale and rounding mode are named at every lossy boundary.
- Allocation parts sum exactly to the input; residual assignment uses a stable tie-break, and the chosen allocation plus policy version is persisted for later reversal.
- A committed journal nets to zero per currency under the ledger's sign convention.
- Posted history is immutable; corrections are new linked entries.
- Operation identity and source evidence permit replay detection and audit.
- Balance projections reconcile to journals and can be rebuilt.
- Limit/reservation decision, authoritative projection mutation, journal, and operation claim commit atomically; logical posting identity is unique.

ISO 4217 and CLDR metadata are necessary but cannot select product, contract, tax, or jurisdiction rounding policy by themselves.
