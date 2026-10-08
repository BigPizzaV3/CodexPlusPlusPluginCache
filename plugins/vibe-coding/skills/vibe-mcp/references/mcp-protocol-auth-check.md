# MCP Protocol & Authorization Check

## Operation

Verify a selected MCP integration against explicit acceptance criteria without product edits. Use [MCP contract boundaries](../../../references/mcp-contract.md) to choose version-matched cases. Verification results may justify a later fix; they do not silently authorize one.

## Required input

The selected server/client, operation, supported protocol/SDK revisions, transport, affected principal/resource and expected result or effect. Establish these from the current repository and request; do not invent missing capabilities or a protocol migration.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Discovery, accepted input, executed handler and serialized result describe the same operation under the supported protocol revision.
- HTTP routing/version metadata agrees with the body before dispatch; stdio carries valid protocol framing without diagnostic contamination.
- Only verified identity and operation-level policy authorize resource access. Arguments, discovery visibility and annotations cannot grant authority.
- Protocol failure, authentication failure and tool execution failure retain their distinct observable result contracts.
- Cancellation, retry and reconnect do not imply rollback and cannot bypass the durable effect’s idempotency owner.

## Establish the boundary

Identify the server/client versions, supported protocol revisions, transport, enabled capabilities and credential model. Record which implementation layers are present. Build a bounded matrix of operation, principal, input, expected transport/envelope, expected tool result and allowed durable effects. Do not count excluded or unavailable layers as passing.

## Protocol checks

- Exercise advertised discovery and one representative operation using the supported client or raw transport. Check schema registration, pagination where used, accepted arguments and declared structured output.
- Distinguish initialization-era behavior from self-contained requests. On current HTTP, verify routing/version header agreement and rejection of absent or conflicting required metadata; on legacy paths, verify the negotiated initialization/session contract actually supported.
- Check malformed requests, unknown methods/tools, invalid arguments and tool execution errors at their respective layers. Assert request correlation, status/envelope and the consumer's displayed outcome, not only HTTP 200.
- For configured JSON/SSE or stdio paths, inspect framing and termination. Exercise disconnect/cancellation and bounded retry where the target owns those behaviors. Observe durable state separately from response delivery.

## Identity and authorization checks

Use synthetic principals or the existing test issuer. Compare a permitted operation with missing credentials, invalid/expired credentials, wrong audience/issuer where a real verifier is included, insufficient scope and another tenant's object. Denial must prevent protected reads or writes; an error message after an unauthorized effect is a failure.

Check direct calls independently of discovery filtering. Reuse a connection or discovery cache under a different principal where that path exists. Verify that untrusted tool arguments, resource contents and returned instructions cannot replace the trusted identity or expand authority. Do not send production tokens to unrelated hosts for testing.

## Evidence and limitations

Capture the minimal request, status, result/error classification and side-effect evidence with credentials redacted. Run a valid control request beside negative cases so a broken harness cannot masquerade as successful denial. State each criterion as passed, failed or not exercised, with command/output and owning source for failures.

Handler fixtures establish local dispatch and scope only. Loopback HTTP adds real serialization and header coverage; it does not prove production TLS/proxies, OAuth discovery, all SDKs or interoperability with the selected host (Codex or Claude Code). Report those missing checks explicitly and recommend the smallest next verification or repair for the observed gap.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
