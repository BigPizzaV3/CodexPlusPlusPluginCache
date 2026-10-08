# Service capability pack

Apply this pack to APIs, workers, queues, scheduled work, authentication and external integrations.

- Trace interface changes through every caller and consumer, including retries, timeouts, caches, queues, terminal errors and backward compatibility.
- Treat authorization scope, ownership, idempotency, transactions, leases and canonical reconciliation as explicit boundaries when affected.
- Do not equate an HTTP success, accepted job, missing response or provider acknowledgement with the intended canonical outcome.
- Use real service or database behavior when mocks cannot establish concurrency, provider or security boundaries.
- Record exact commands from repository configuration or CI. Never infer a framework, transport or deployment workflow from this pack.
