---
name: go-testing-and-verification
description: "Use when asked to design or debug Go tests, fuzzing, race/leak checks, or deterministic verification. Do not use for profiling."
license: Apache-2.0
compatibility: "Go 1.24 or newer; testing/synctest guidance targets Go 1.25 and 1.26."
---

# Go testing and verification

Start with the invariant and the cheapest environment that can falsify it. A test shape is not a quality goal by itself.

## Select evidence by failure mode

- Direct unit tests for pure decisions and edge cases.
- Integration tests with the real database, broker, filesystem, or protocol when their semantics are the claim.
- Contract tests for public request, response, schema, and compatibility behavior.
- Fuzz tests for parsers, decoders, canonicalization, state transitions, and algebraic properties.
- Race-enabled tests for executed concurrent paths; they are not proof over unexecuted schedules.
- Leak checks for owned goroutines after cancellation and shutdown.
- Deterministic time and synchronization rather than sleeps; use `testing/synctest` where supported.

## Build a strong oracle

Assert externally meaningful state, output, side effects, and errors. Prefer invariant checks over call choreography. Make fixtures expose the failure: concurrent starts, crash windows, duplicate identities, partial reads, invalid encodings, and boundary sizes.

Parallel tests must not share mutable globals, environment, ports, clocks, random sources, or fixtures without explicit isolation. Call `t.Helper()` in helpers and preserve useful failure context.

## Fuzz responsibly

Seed representative valid and invalid values. Keep targets deterministic, fast, and independent across calls. Persist minimized failures as regressions. A fuzz target without a semantic property often discovers only panics, not wrong results.

Read [references/oracle-design.md](references/oracle-design.md) for distributed and financial oracles.

For timer, deadline, or asynchronous goroutine tests on Go 1.25 or 1.26, read [references/deterministic-concurrency.md](references/deterministic-concurrency.md). A `synctest` bubble virtualizes only work it owns; external I/O and goroutines are not made deterministic merely because the assertion runs inside `synctest.Test`.

## Output contract

Name the invariant, chosen test layer, and remaining blind spots. Do not inflate coverage metrics or mock interactions into claims of system correctness.
