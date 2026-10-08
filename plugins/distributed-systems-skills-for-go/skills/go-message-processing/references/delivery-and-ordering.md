# Delivery and ordering

## Scope guarantees precisely

Record guarantees as a tuple:

```text
(producer, broker/region, topic or subscription, partition or key, consumer transaction, external effects)
```

A product may call a feature “exactly-once” while guaranteeing only no redelivery after a successful acknowledgment, or atomic offset and record updates within its own log. Both are useful but narrower than “the business effect happens once.”

## Acknowledgment timing

- Before effect: duplicates are less likely, loss is possible.
- After effect: loss is less likely, duplicates are expected after a crash.
- In one broker-native transaction: atomic only for resources participating in that transaction.

For a non-transactional external API, use a stable idempotency key accepted by that API or reconcile its durable outcome. A local “sent” flag written before the call can lose the effect; written after the call can duplicate it.

## Ordering

Partition ordering is not global ordering. Consumer rebalances, retries, parallel processing, and multiple topics can alter observation order. Model aggregate transitions with a sequence/version when stale application would be harmful.

If one message for a key fails, choose whether to block that key, quarantine it and continue, or apply compensating logic. Continuing blindly can violate causal order; blocking an entire partition can create unrelated head-of-line blocking.

## Retention window

Deduplication lifetime must cover the maximum plausible replay/redelivery window plus operational recovery. Expiring records earlier turns old duplicates into new work. Keeping them forever has storage and privacy costs. Document the chosen bound and replay procedure.
