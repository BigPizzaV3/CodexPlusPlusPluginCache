# Backend Integrations Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Backend Integrations improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Use one end-to-end deadline/retry budget and propagate cancellation; make non-idempotent retry safe with operation keys or disable it.
- Bound pools, per-host concurrency, bodies, queues, stream buffers, and slow consumers before adding circuit breakers or concurrency.
- Verify webhook signature against raw bytes before parsing/side effects, store stable event identity, and separate receipt from asynchronous processing deliberately.
- Implement WebSocket/SSE resume with monotonic event/version IDs or full resync; never assume reconnect fills an unobserved gap.
- Stage certificate/credential/proxy changes with overlap and health evidence; preserve least privilege and trusted-hop boundaries.

## Validation

- Run contract/integration tests against provider fixtures or a controlled test endpoint, including exact signature/raw-body vectors.
- Exercise DNS/TLS/connect/read resets, slow/large responses, retry ambiguity, pool saturation, duplicate/out-of-order webhooks, stream gaps, slow consumers, and shutdown.
- Measure attempts, end-to-end latency, pool/connection/buffer usage, backlog, duplicate effects, and recovery.
