# Go Rust Microservices Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Go Rust Microservices improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Use structured ownership (`errgroup`/task groups/join sets or existing equivalents) and propagate deadlines/cancellation to all child work.
- Bound queues, tasks, streams, pools, and retries before increasing parallelism; reject work or shed load explicitly at saturation.
- Keep blocking I/O/CPU off async executors and minimize lock scope; establish one lock order where multiple locks are unavoidable.
- Preserve stable API/error contracts and attach causal context internally without exposing implementation or secrets.
- Implement graceful shutdown as an ordered state transition with readiness change, admission stop, drain/cancel deadline, and final resource closure.

## Validation

- Run repository tests plus Go race/vet/static checks or Rust clippy/test/loom/miri/sanitizer checks where already supported and applicable.
- Exercise cancellation, deadline, downstream stall, connection loss, concurrent shutdown, panic/error propagation, and repeated start/stop.
- Measure live goroutines/tasks, queue depth, memory, connections, latency, and drain completion under representative concurrency.
