# Deterministic concurrent tests

Use `testing/synctest` on Go 1.25 and 1.26 when the invariant depends on goroutine quiescence, timers, deadlines, or cancellation. Keep the Go 1.24 experimental `synctest.Run` API confined to an explicitly opted-in Go 1.24 compatibility path.

## Know what the bubble owns

`synctest.Test` owns the root function and goroutines started transitively within it. Channels, timers, tickers, and associated `sync.WaitGroup` values must remain on the bubble side of the boundary. Work started before the bubble, external processes, real network I/O, system calls, and mutex acquisition can be released by outside events and are not durably blocked.

Replace external dependencies with an in-memory protocol fake created inside the bubble when their behavior is not the claim. Keep a separate real integration test when kernel, database, broker, or network semantics are the claim; `synctest` cannot prove those semantics.

## Separate settling from time advancement

`synctest.Wait` returns when every other goroutine in the bubble has exited or is durably blocked. An outstanding `Wait` takes precedence over advancing the fake clock, so it is a settling barrier—not “run every future timer.” To cross a deadline, sleep the bubble clock to the intended boundary, call `Wait` to settle resulting work, and then assert state.

Do not infer a specified order between independent events scheduled for the same fake instant. If ordering matters, expose a causal synchronization edge or assert the set of legal outcomes.

## Preserve lifecycle and test contracts

`synctest.Test` waits for every bubbled goroutine to exit and reports a deadlock when no internal event or time advance can make progress. Cancel background loops and close their owned fakes before the root returns. Inside the `*testing.T` passed to the bubble, do not call `T.Run`, `T.Parallel`, or `T.Deadline`; structure outer subtests around separate bubbles instead.

A deterministic schedule is still only one modeled environment. Retain race-enabled, leak, integration, and failure-injection evidence when those failure modes remain possible.
