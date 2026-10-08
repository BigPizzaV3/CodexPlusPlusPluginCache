# Runtime Flow Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/runtime_flow_map.md` as a map of request, event, job, workflow, realtime, and recovery flows that later reliability and patch checks can use for navigation.

## Inspect

Routes/API handlers, services, transactions, queues, workers, workflow definitions, cron jobs, event producers/consumers, realtime/SSE/WebSocket code, object storage, cache, database writes, locks/leases, retry policies, idempotency keys, observability, deployment config, and tests.

## Map content

### Evidence and IDs

- Write or update `docs/runtime_flow_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: flow `FLOW-*`, step `STEP-*`, side effect `SIDE-*`, failure mode `FAIL-*`, recovery path `REC-*`, timing constraint `TIME-*`.
- Anchor every step to owner files/symbols. Separate direct evidence from inferred ordering or runtime behavior.

### Coverage

Cover entrypoint → validation/auth → state read/write → transaction/commit boundary → event/job/workflow → external side effect → notification/webhook → observability → failure/recovery. Include ordering, idempotency, retries, cancellation, deadlines, locks, duplicate handling, replay, cleanup, backpressure, and rollback/forward-fix notes when discoverable.

### Entry details

For each flow, capture trigger, actors, data/contracts, authoritative owners, sync/async steps, state transitions, side effects, retry/recovery semantics, tests/checks, observability, and residual unknowns.

## Markdown structure

Use summary, conventions, flow index, per-flow sequence tables, failure/recovery matrix, idempotency and concurrency notes, observability anchors, tests/checks, unknowns, assumptions.
