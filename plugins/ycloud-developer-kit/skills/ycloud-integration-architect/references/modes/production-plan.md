# Production-plan mode

Produce a production-readiness architecture and rollout plan for the selected
scope. Do not generate a test dashboard unless separately requested.

Cover confirmed project seams for trust boundaries, secret injection, provider
adapter behavior, deployment environments, observability and request-ID
correlation, rate limits, ambiguous outcomes, queues/outbox where project-owned,
Webhook durable acceptance, data retention, migration, rollback, runbooks, and
ownership.

Keep provider guarantees separate from Developer Kit policy and project
decisions. Unknown idempotency, replay safety, secret-overlap, delivery, and
payload contracts remain explicit gaps. A plan is read-only by default; local
artifact implementation requires separate user intent, and real external or
production actions require independent authorization outside that local write.
