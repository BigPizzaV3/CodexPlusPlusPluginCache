# Financial finding standard

Every finding names:

1. monetary or evidence invariant;
2. exact identity, amount, currency, state, and authority involved;
3. concurrent, retry, crash, provider, or reconciliation schedule;
4. whether the outcome is known, failed, or ambiguous;
5. durable state and customer/accounting impact;
6. smallest repair and required backfill/reconciliation.

For a replay or payment identity, the finding is incomplete unless it distinguishes equivalent replay, canonical-payload mismatch, and wrong-authority disclosure. Require an explicit mismatch rejection before any provider or ledger effect; do not award a design merely for storing a fingerprint.

Severity is driven by possible money creation/loss, misstatement, unauthorized movement, data exposure, audit failure, and recovery difficulty.
