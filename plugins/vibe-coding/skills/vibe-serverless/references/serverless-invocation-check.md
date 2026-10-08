# Serverless Invocation Check

## Operation

Verify the selected invocation lifecycle and delivery guarantee without product edits. Read [serverless runtime boundaries](../../../references/serverless-runtime.md). Use cases matching the provider, runtime, trigger and business operation present in the repository.

## Required input

The selected handler, provider/runtime and compatibility configuration, trigger, success/acknowledgment promise, authoritative effect and retry owner. Identify the concrete invocation state and permitted local/provider environment.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Success or acknowledgment is emitted only when work required by the business contract has reached its promised durability boundary.
- Deferred work uses the actual provider lifetime mechanism; best-effort continuation is not represented as durable delivery.
- Invocation-specific identity and mutable user state cannot survive into another invocation; reusable infrastructure clients remain separately owned.
- Duplicate, concurrent and partial-batch delivery preserve stable operation identity and cannot repeat a non-repeatable committed effect.
- Runtime API use, resource cleanup, fan-out and downstream admission respect the deployed configuration and supported provider semantics.

## Establish acceptance criteria

Identify the handler, input/identity source, trigger delivery semantics, authoritative state, response or acknowledgment, required/deferred work and configured limits. Name the durable success condition and the component responsible for retries. Distinguish a local function contract from a provider guarantee and record which test environment is available.

## Lifetime and failure cases

- Normal completion with the correct response and authoritative effect.
- A required downstream operation held pending: response/acknowledgment must not falsely claim completed durable work.
- Rejected, timed-out or cancelled required work: observe the returned outcome and stored state separately.
- Intentionally deferred work: verify the configured lifetime/handoff mechanism and its failure visibility without assuming deferral guarantees durable delivery.
- Client disconnect or invocation termination where the available provider harness supports it; do not infer these from an ordinary local promise test.

## Reuse and delivery cases

Use two invocations with different principals or inputs in the same process/environment. Check that reusable client state does not retain the previous identity and temporary/in-memory data is not the only authoritative copy.

Replay a stable event identity, send concurrent duplicates and retry after an ambiguous downstream success when relevant. For batch triggers, combine succeeded and failed records and assert the provider-specific retry acknowledgment selects the intended records. Inspect business effect counts and deduplication/transaction state, not only the number of handler calls. Retention and restart cases matter when an identity record may disappear before a permitted replay.

## Limits and compatibility

Exercise bounded fan-out and resource cleanup under the relevant local harness. Inspect configured CPU/wall-time/memory/concurrency or API limits and compatible runtime APIs. A local emulator cannot establish real provider quotas, scheduling or isolation; report those as unexercised unless measured in an authorized provider environment.

## Evidence and limitations

Pair every negative case with a valid control so a permanently failing handler cannot pass. Record event/request identity, fault injection point, response/acknowledgment, durable state, command and pass/fail/not exercised status. Tie a failure to the handler or configuration owner with `path:line` and one correction direction.

Conclude only for the tested invocation contract. Keep production credentials, destructive events and external side effects outside a local verification request. State remaining provider, downstream idempotency or deployment checks rather than claiming cloud correctness from a mock storage binding.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
