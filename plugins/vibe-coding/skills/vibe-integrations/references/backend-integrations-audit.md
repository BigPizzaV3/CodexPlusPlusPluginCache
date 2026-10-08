# Backend Integrations Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit external API, DNS/TLS/proxy, webhook, WebSocket, and SSE boundaries across identity, timeouts, retries, pooling, signatures, ordering, backpressure, and recovery.

## Domain invariants

- Every outbound call has normalized target, authentication, connect/request/idle timeout, cancellation, bounded response/body, and stable error mapping within an end-to-end deadline.
- Retries are limited to classified transient and semantically safe operations, use backoff/jitter and one retry budget, and do not multiply across proxy/client/job layers.
- Connection pools, DNS caching/refresh, TLS trust/SNI/hostname, keepalive, proxy limits, and circuit/admission behavior are bounded across replicas.
- Trusted proxy/header handling has an explicit hop boundary; forwarded identity/scheme/host/client IP cannot be spoofed from an untrusted peer.
- Webhook signatures cover exact raw bytes and required metadata, validate timestamp/nonce/replay window with constant-time comparison, and acknowledge only after the chosen durable boundary.
- Webhook delivery/replay is idempotent by provider event identity, preserves attempts/status, and separates permanent rejection from transient retry.
- WebSocket/SSE authentication, origin, lifecycle, heartbeat/idle timeout, message/event IDs, ordering, reconnect/resume, bounded buffers, slow-consumer policy, and shutdown are explicit.
- Network failures, dependency saturation, certificate/credential rotation, and degraded mode are observable without logging secrets or full sensitive payloads.

## Audit method

1. Trace request/event/connection from DNS/TLS/proxy/client through authentication, timeout/retry, pool, response/ack, persistence, reconnect, and shutdown.
2. Inspect effective retry/timeout/pool settings across all layers and calculate worst-case attempts, duration, concurrent connections, and payload memory.
3. Validate webhook raw-body capture, signature/version/clock/replay state, event identity, durable ack boundary, and re-drive tooling.
4. Trace WebSocket/SSE connect, auth refresh, heartbeat, message sequence, gap, slow consumer, reconnect/resume, and deploy termination.
5. Check DNS/TLS/proxy failure and rotation behavior, trusted headers, redirects/egress constraints, and dependency-specific quotas.

## Priority model

- **P0:** request forgery or smuggling, TLS/auth bypass, data exposure, duplicate irreversible external effects, or dependency-driven outage.
- **P1:** a material DNS, proxy, timeout, retry, webhook, connection-pool, protocol, or degradation defect.
- **P2:** a lower-risk but concrete observability, compatibility, or efficiency issue.
