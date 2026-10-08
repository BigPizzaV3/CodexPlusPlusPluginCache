# Go Rust Microservices Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit Go and Rust services across request contracts, cancellation, task/goroutine ownership, connection pools, backpressure, errors, unsafe code, and graceful shutdown.

## Domain invariants

- Request/message identity, validation, deadlines, status/error mapping, idempotency, and observability are consistent across HTTP/gRPC/queue boundaries.
- Go goroutines have an owner, bounded creation, cancellation path, result/error join, channel-close owner, and race-safe shared state; Context is propagated and not stored as durable state.
- Rust async tasks have an owner and awaited/joined/cancelled lifecycle; blocking work leaves the async executor, cancellation safety is understood, and shared state obeys Send/Sync and lock-order constraints.
- HTTP/gRPC/database/broker clients reuse bounded pools and have connect/request/idle/keepalive timeouts aligned with end-to-end deadlines and retry budgets.
- Admission, queue bounds, semaphores, stream flow control, and downstream limits prevent unbounded memory/task growth and retry amplification.
- Errors retain causal context and stable public mapping without leaking secrets; panic/unwrap/expect, process exit, and Rust unsafe boundaries are justified and contained.
- SIGTERM/shutdown stops admission, marks readiness appropriately, cancels or drains owned work within a deadline, flushes bounded telemetry, and closes dependencies in order.
- Dependency and build changes preserve supported toolchain, reproducibility, vulnerability policy, and FFI/unsafe assumptions.

## Audit method

1. Trace one request/message through admission, spawned work, downstream clients, state mutation, response/ack, cancellation, and shutdown.
2. Inventory goroutine/task spawn sites, ownership/join paths, channels/locks, blocking operations, and unbounded queues or streams.
3. Inspect effective transport/client timeout, pool, keepalive, retry, and connection settings across every deployment replica.
4. Run or inspect race/deadlock/leak evidence and identify cancellation-unsafe critical sections or stale work after caller timeout.
5. Map startup/readiness/SIGTERM/drain/forced termination and verify operator-visible state at each boundary.

## Priority model

- **P0:** memory-safety or race-driven corruption, request collapse, leaked critical resources, deadlock, or unsafe shutdown.
- **P1:** a material cancellation, ownership, backpressure, concurrency, protocol, or lifecycle defect.
- **P2:** a lower-risk but concrete efficiency, diagnostics, or maintainability issue.
