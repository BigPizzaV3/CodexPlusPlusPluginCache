# Network Integration Failure Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Inject DNS failure/change, certificate mismatch/rotation, connect reset, partial/slow/large response, and proxy timeout; verify bounded retries and error mapping.
- Replay duplicate/out-of-order/expired/invalidly signed webhooks and crash around receipt/side effect; verify idempotency, status, and re-drive.
- Open representative WebSocket/SSE clients, drop connections, create sequence gaps, refresh auth, and verify resume/full-resync behavior.
- Create slow consumers and saturated pools; verify bounded buffers/connections, backpressure/drop/close policy, fairness, and recovery.
- Terminate service during active requests/streams and verify admission stop, drain/close semantics, reconnect hints, and no orphan work.
