# Poison messages and redrive

A dead-letter queue is a quarantine boundary, not a terminal business state. Moving a message can alter broker identity, enqueue time, retention, and relative order while leaving the underlying business command unresolved.

## Classify before consuming the retry budget

Record a stable failure class:

- transient infrastructure failure that can succeed unchanged;
- systemic dependency outage or overload requiring admission reduction;
- permanent syntax, schema, or validation failure;
- business rejection that should become a terminal domain outcome;
- ambiguous external effect requiring reconciliation;
- consumer defect or unsupported generation requiring a deployment decision.

Receive count is evidence of deliveries, not proof of identical processing attempts or permanent input failure. A short visibility timeout, crash, or slow dependency can exhaust it without any deterministic poison payload. Do not DLQ every ambiguity and then issue a new external operation during replay.

## Preserve a quarantine envelope

Keep the original application event or operation identity, semantic fingerprint, event type and schema version, ordering key and sequence, source stream/partition/offset or broker reference, producer generation, first-seen time, delivery and processing attempts, failure class, sanitized diagnostic reference, and quarantine policy version.

Separate the immutable original payload from operator annotations and repaired replacements. Protect sensitive payloads with narrower access, retention, and audit than ordinary queue metadata. Do not copy secrets or financial data into alerts, tickets, or ad hoc replay files.

Broker message IDs are insufficient durable identity. For example, a redrive implementation can assign a new message ID and enqueue time. Deduplication retention must cover the quarantine and replay horizon, or the consumer must use a durable business identity whose meaning survives broker movement.

## Protect ordering and progress

Quarantining one item can let later items overtake it. Redriven traffic can interleave with new producer traffic even when each queue has ordering features. Decide per ordering key whether to:

- block later events and expose head-of-line impact;
- park the whole key or aggregate while unrelated keys progress;
- continue only when sequence/version checks make the gap explicit;
- rebuild the aggregate from an authoritative history.

Never claim FIFO business recovery merely because the DLQ is FIFO. Preserve missing-sequence evidence so a later update cannot silently apply to the wrong predecessor state.

## Redrive as a controlled release

Before replay, identify the fix or policy change and prove the destination consumer, schema, authorization, downstream capacity, and deduplication state. Revalidate under the current contract; do not bypass normal validation or authorization just to empty the queue.

Create an immutable redrive generation with selected message IDs or predicates, source and destination, code/config/schema generation, operator approval, rate and concurrency limits, pause/abort thresholds, and expected terminal outcomes. Start with a bounded cohort. Redrive velocity must fit destination and dependency capacity; maximum-speed replay can reproduce the incident.

Preserve the original application identity by default. If a correction is a genuinely new business command, link its new identity to the quarantined original and require explicit authority; never mutate the original and pretend it was the same event.

Track selected, moved, admitted, deduplicated, succeeded, rejected, requarantined, ambiguous, and missing messages. Reconcile counts and business effects, not only queue depth. Cancellation is partial: messages already moved remain destination work.

Test retention expiry, identity changes, concurrent new traffic, per-key order gaps, duplicate replay after the inbox expires, partial redrive cancellation, poison recurrence, downstream overload, and sensitive-data access. The output must state what remains quarantined and who owns its business resolution.
