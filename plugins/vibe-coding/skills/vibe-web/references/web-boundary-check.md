# Web Boundary Check

## Operation

Verify the selected server/browser boundary against concrete acceptance criteria without changing product code. Use [web rendering boundaries](../../../references/web-rendering.md). Select cases matching the actual route and framework rather than running an unrelated frontend checklist.

## Required input

The selected route/action, framework/runtime version, rendering mode, affected user state, trusted session/data owner and expected initial and post-interaction behavior. Recover available facts from the repository and supplied reproduction.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Server HTML and the first browser render use equivalent initial data; later preference updates preserve the product’s intended state.
- Serialized payloads and personalized caches expose only data authorized for the current request identity.
- Server mutations enforce validation and object/tenant authorization using trusted identity independently of browser controls.
- A committed mutation and its directly affected rendered/cached view agree under the selected freshness contract.
- Loading, failure, navigation and retry states preserve usable interaction and do not create unauthorized or duplicate durable effects.

## Establish evidence

Record the route, framework/runtime versions, SSR/static/streaming mode, expected initial data, trusted identity source and supported browser. Identify server render, serialized payload, first client render, later effects, mutation and cache owner. State which of these layers the available environment can exercise.

## Rendering matrix

- Fresh navigation with default state: server output is valid, first client render matches and the route becomes interactive without hydration recovery errors.
- Reload with a saved non-default preference, locale or timezone when used: initial agreement is preserved and the eventual preference is applied correctly.
- Client navigation and back/forward through the affected route: data and controls remain consistent with the current identity and route parameters.
- Loading, empty, rejected and unavailable data: the corresponding UI remains meaningful and retry behavior does not create duplicate durable effects.

Use a real browser with the application's actual server-rendered HTML for hydration claims. Inspect recoverable error callbacks or console output alongside content and interaction; a clean console with missing content is not a pass. Avoid masking errors with suppression flags or disabling SSR for the test.

## Mutation and data matrix

Exercise an authorized action, signed-out call, forged browser identity, another owner's object and invalid input where applicable. Verify both the returned error/result and persisted state. Inspect the trusted session and authorization owner when a request is denied unexpectedly. CSRF/origin and cookie transport require the framework's HTTP boundary, not only a direct function call.

For personalized caches, compare two identities and check the relevant post-write read. Confirm that a cache hit cannot expose another user's data and that invalidation restores the selected product promise. Distinguish server/framework cache behavior from client query reconciliation; use the owning skill if the defect is outside rendering.

## Evidence and limitations

For each criterion record the actual route/state, request or UI steps, expected output, observed output and pass/fail/not exercised status. Tie failures to `path:line` and the responsible contract when source evidence supports it. If the environment lacks the framework server, credentials, browser or deployment layer, keep those checks open instead of inferring success from static inspection.

End with the supported conclusion and the narrow next repair or integration check. Do not broaden a verification request into a redesign or unrequested deployment.

## Evidence and safety rules

Define the required scenario matrix before execution from the selected invariant and current repository commands. Respect active test restrictions. Use the authorized environment and bounded workload/fault conditions. Record expected and observed state, identity/order/effect evidence and exact commands; passing harness output alone cannot override the intended contract. Pair negative cases with a valid control. Do not perform destructive drills, broaden implementation or infer provider/production behavior from local fixtures. An unavailable required scenario remains unavailable.

## Verdict and completion

Return **passed** only when every required criterion is supported by actual evidence. Return **failed** when a named invariant is violated, with the minimal reproduction and owner. Return **blocked** when required evidence cannot be obtained because the target, environment or safe operation is unavailable; name the missing gate. If a defect is already proven and other checks are blocked, report failed with those unexercised gates. Stop when the bounded matrix is resolved or cannot safely progress; never convert skipped work into a pass.

## Output contract

Respond in the user’s language and begin with passed, failed or blocked. Include: checked invariant and exact boundary/version; required scenario matrix with expected/observed state and per-case result; actual commands and bounded measurements; evidence anchors or minimal reproduction; residual risks; unavailable gates and their effect on the verdict. Separate inspected source from executed runtime evidence. Omit empty sections. Recommend the narrow owner correction for a failure without performing unrequested edits.
