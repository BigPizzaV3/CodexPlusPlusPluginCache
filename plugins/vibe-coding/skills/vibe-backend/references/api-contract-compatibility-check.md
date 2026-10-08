# API Contract Compatibility Check

## Operation

Verify a named contract change against its supported consumer window without product edits. Read [API and schema evolution](../../../references/contract-evolution.md). A green schema validator is one piece of evidence, not the compatibility conclusion.

## Required input

The changed schema/operation, encoding, authoritative source, old/new producer and consumer versions, supported compatibility window and rollout constraints. Identify a concrete payload or operation and the consumers that must keep working.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Every supported producer/consumer combination preserves the documented business meaning as well as wire acceptance.
- Request acceptance and response guarantees remain consistent across requiredness, nullability, enums, defaults and errors.
- Schema identities and generated artifacts derive from their authoritative source; retained messages and field identities cannot be silently reinterpreted.
- Mixed-version rollout, retained-data replay and supported rollback maintain the contract throughout the transition.
- Compatibility adapters have a concrete owner and removal condition supported by consumer evidence.

## Establish the matrix

Record old/new schema revisions, generator/runtime versions, wire formats, supported clients and rollout order. Identify representative request/response or event fixtures and the code that interprets them. Mark unsupported combinations separately from untested supported combinations; do not silently drop difficult consumers from the scope.

## Cases to select

- Old producer with new consumer and new producer with old consumer, including concurrent deployment stages.
- Required, optional, absent and explicit-null fields; defaults and coercion; boundary numbers, timestamp precision and unknown enum values.
- Error/status envelopes, pagination/cursor behavior, sorting and units when their meaning changed.
- Real generated client parsing/serialization, GraphQL persisted operations, or Protobuf binary and ProtoJSON paths actually used.
- Retained event replay, consumer restart and rollback to an older binary when those states remain supported.
- Authorization and tenant visibility for newly exposed or restructured fields.

## Execution

1. Run the native schema validator/diff tool and preserve its reported direction and compatibility mode.
2. Generate or load both supported client versions with locked tooling. Use the same deterministic fixtures across combinations.
3. Send or decode the fixtures through the real contract boundary available locally. Assert interpreted business values and side effects, not just parse success.
4. Pair negative cases with valid controls. A client that rejects every response cannot prove that invalid responses are handled correctly.
5. Compare runtime output with generated schema/client artifacts and examples. Diagnose the authoritative mismatch before suggesting a repair.

## Failure evidence

For each failure retain the minimal payload or operation, version/encoding pair, owning source and consumer, expected guarantee and observed outcome. Classify compile/generation failure, wire rejection and semantic misinterpretation separately because they need different repairs. Do not label an entire API incompatible because one optional unsupported path differs.

## Evidence and limitations

Report each required combination as passed, failed or not exercised, with exact commands and fixture identities. State the tested compatibility window and any missing mobile, external partner, registry, deployment or retained-data checks. Recommend the smallest adapter, staged rollout or source correction supported by the evidence. Do not edit production contracts or publish a new version during a verification-only request.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
