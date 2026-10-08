# Ledger corrections and effective time

A correction changes the economic view without erasing the evidence that produced the earlier view. Preserve the original posted journal and create linked reversing, replacement, or adjusting journals under an explicit accounting policy. A database update that makes the current balance look right can make historical balances, reconciliations, statements, and audits irreproducible.

## Separate the clocks

Persist distinct meanings rather than one overloaded timestamp:

- **occurred or effective time:** when the economic event belongs for product and reporting purposes;
- **posted time:** when the journal became immutable and affected the ledger's selected balance view;
- **recorded time:** when this system accepted the evidence;
- **source time and identity:** when and where the external evidence was produced.

These names are a model, not a universal accounting vocabulary. Bind them to the product's accounting policy and preserve timezone, business-date, and source-generation semantics. Never sort by timestamps alone when equal times, late arrivals, or backfills can reorder entries; retain a durable journal sequence or database commit position where ordered replay is required.

## Correct without rewriting history

Link every correction to the original journal and reason, actor or approval, source evidence, policy version, and correction generation. Reverse the original booked amounts, currencies, accounts, FX rate, and allocation when undoing that booking; do not recompute at today's rate or silently apply today's policy. Then post any replacement economics as a separate journal so reversal and rebooking remain distinguishable.

Make correction identity unique and replay-safe. Concurrent operators or retries must not reverse the same journal twice. A reversal may be partial only when the product and accounting policy define the remaining amount and allocation; persist cumulative corrected amount and enforce the bound atomically.

## Govern backdating and closed periods

An effective date in a prior period is not permission to mutate that period. Check period state, authorization, materiality workflow, and jurisdiction or reporting policy before posting. If the period is open, the correcting journal may carry the original effective period while retaining its later posted and recorded times. If the period is closed, route to the approved reopening, retrospective-restatement, or current-period adjustment procedure; the software must not invent that accounting decision.

IAS 8 distinguishes corrections of prior-period errors from changes in estimates and generally requires material prior-period errors to be corrected retrospectively unless impracticable. That financial-reporting rule does not by itself select an application's journal schema, materiality threshold, tax treatment, or approval workflow. Obtain the applicable accounting policy.

## Answer both as-of questions

Support the views the product actually promises:

- **effective as of T, using knowledge now:** include corrections assigned to periods at or before T;
- **known as of K:** include only journals recorded or posted by K, preserving what the system could have reported then.

One current balance cannot answer both. A rebuild must use immutable journals, correction links, policy versions, and the selected temporal axes; a projection repair must not collapse later knowledge into earlier audit views. Reconcile the reversal, replacement, affected statements, external source, and current projection as one correction outcome.
