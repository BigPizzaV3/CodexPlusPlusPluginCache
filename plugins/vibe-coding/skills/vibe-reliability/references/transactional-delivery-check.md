# Transactional Delivery Check

## Operation

Verify the selected database-to-event-to-consumer invariant without product edits. Follow one business operation through its authoritative transaction, publication intent, broker delivery, consumer identity and final effect. Keep broker-specific protocol mechanics with the corresponding queue skill.

## Required input

The selected business invariant, authoritative transaction, outbox/publisher, broker, consumer/inbox and final effect, with stable operation identity, recovery bounds and an authorized fault-injection environment.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- The domain change and durable publication intent commit together, or the design provides an evidenced equivalent delivery guarantee.
- A committed unpublished intent remains discoverable and retryable until delivery is established.
- Replay after ambiguous publication or acknowledgment cannot repeat a non-repeatable final effect.
- Deduplication identity and the consumer effect commit atomically where possible; an external effect has its own proven idempotency or reconciliation owner.
- Concurrent delivery, reordering, retention and restart converge to the required business state within the selected recovery contract.

## Goal and scope

Establish that a committed business change is eventually delivered without losing required work or repeating a non-repeatable effect. Name the operation identity, transaction boundaries, authoritative state and promised convergence time. Do not infer end-to-end exactly-once behavior from a broker option or a deduplication table alone.

## Inspect

Database transactions and constraints, outbox rows, publisher claim/lease logic, publication confirmation, consumer offsets/acknowledgments, inbox records, handler effects, external idempotency keys, reconciliation jobs and retention. Include retry limits, poison-message handling, version ordering, repair access and evidence used to detect divergence.

## Failure-window matrix

- Failure before the domain commit: neither the business change nor its publication intent may survive independently.
- Commit succeeds but publish is delayed or interrupted: the durable intent remains discoverable and retryable.
- Broker accepts the event but publication confirmation or outbox marking is lost: republishing must not repeat the final non-repeatable effect.
- Consumer performs work but crashes before acknowledgment: replay must preserve the business invariant.
- Inbox identity is written before a separately committed effect: verify that a crash cannot suppress work forever. Conversely, an effect committed before deduplication must not be repeated unchecked.
- Two consumers handle the same identity concurrently, an older version arrives after a newer one, or retention removes deduplication state before a legitimate replay.

## Verification method

Use the repository's transaction/broker test harness or deterministic fault injection at the selected boundaries. Pair each injected failure with a normal control. Assert durable rows, event identity, business effect count and eventual convergence after restart, rather than only the handler's return value.

For an external non-transactional effect, identify the actual idempotency or reconciliation owner. Prove the same stable key reaches the external boundary on retry, or show how ambiguous success is reconciled. Do not claim that a local inbox can atomically protect an unrelated provider write. Examine retry backoff and retention only insofar as they affect delivery or duplicate safety.

## Evidence and limitations

Record the invariant, fault point, observed state before/after recovery, owner `path:line`, exact commands and pass/fail/not exercised outcome. A mocked publish failure does not establish real broker confirmation or database isolation behavior; name those gaps. Failures should lead to one coherent transaction, idempotency or repair correction rather than a blanket infrastructure replacement.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
