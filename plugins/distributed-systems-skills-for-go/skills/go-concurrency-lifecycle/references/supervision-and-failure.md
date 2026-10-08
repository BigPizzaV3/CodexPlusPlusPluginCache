# Goroutine supervision and failure

Starting a goroutine discards its return values. Before every `go`, `WaitGroup.Go`, callback, or worker submission, define who observes failure, which work is canceled, which resources remain trustworthy, and when the owner may return.

## Choose the failure contract

- **Joined operation:** return the first material error, cancel dependent siblings, and wait for all owned work before returning.
- **Long-lived component:** retain and expose the terminal cause, stop admission, and make restart versus process termination an explicit policy.
- **Isolated untrusted task:** recover only inside that goroutine at the deliberate isolation boundary, capture the stack and task identity, convert the failure into the boundary's result protocol, and discard state that may be corrupted.
- **Fatal invariant failure:** allow the panic to terminate the process when safe continuation cannot be established.

Logging is not supervision. A recovered panic that merely logs and continues can publish partial state, leak capacity, or hide a dead worker.

## Keep panic policy version-aware

An unrecovered panic unwinds only the panicking goroutine's stack and then terminates the program. Another goroutine cannot recover it. Recovery must be called directly by a deferred function in the same goroutine.

`sync.WaitGroup.Go`, available from Go 1.25, couples task creation with accounting, but its documented contract says the function must not panic. It also carries no error result or cancellation policy. Use it for tasks whose failure contract is otherwise handled and whose function cannot panic under the chosen boundary. Use an error group or explicit result protocol when the owner must propagate errors; add recovery only when isolation is a real requirement, not to make arbitrary functions fit `WaitGroup.Go`.

For Go 1.24, preserve correct `Add`/start/`Done` ordering. Do not perform a positive `Add` against an empty group concurrently with `Wait`.

## Preserve the primary cause

Sibling cancellation is usually a consequence, not the original failure. Record the first material failure before canceling siblings, join all owned tasks, and return that failure instead of a later `context.Canceled`. When cause-aware cancellation is useful, `context.WithCancelCause` records the first cancellation cause visible through `context.Cause`; later calls do not replace it. This does not collect multiple failures or decide which failure is primary—make that policy explicit.

Do not report a deadline as the primary cause if an earlier worker error triggered cancellation. Conversely, if the parent deadline happened first, do not overwrite it with cleanup noise. Preserve secondary cleanup failures separately when they are operationally important.

## Supervise capacity and shutdown

A supervisor owns more than an error channel. It must bound admission before spawning, ensure every possible failure path releases tokens and closes or drains only owned resources, and wait before freeing memory used by workers. During shutdown, stop admission, signal cancellation, wait within the caller's budget, then close dependencies after their last user. If the deadline expires, report which owners remain; never imply that returning abandoned a goroutine safely.
