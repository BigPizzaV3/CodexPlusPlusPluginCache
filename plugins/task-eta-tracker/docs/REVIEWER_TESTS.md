# Reviewer test cases

All cases use synthetic task descriptions and require no account, credentials, private network, MCP server, or internal repository.

## Positive cases

### 1. Initial estimate for bounded implementation

- Prompt: "Use Task ETA Tracker for a change with four remaining milestones: inspect one module, implement a bounded edit, run a 6-minute test suite, and review the diff."
- Expected behavior: Identify the observable done condition, represent all four milestones, and include the known test duration rather than treating implementation as completion.
- Expected result shape: `Initial estimate`, a rounded range, likely center, confidence, current phase, and ordered remaining milestones.
- Fixture: Synthetic task description only.

### 2. Reforecast after a failed test

- Prompt: "The initial ETA was 20–35 minutes. Implementation finished in 12 minutes, but one integration test failed and needs diagnosis plus a focused rerun. Reforecast it."
- Expected behavior: Preserve the completed implementation actual, re-estimate only the remaining diagnosis and verification, and explain why the range moved.
- Expected result shape: `Revised estimate`, prior range in the explanation, updated range and confidence, failure as the active phase, and remaining verification.
- Fixture: Synthetic elapsed times and failure state.

### 3. External dependency with no defensible duration

- Prompt: "The code is ready, but a third-party approval has no published review time. What is the ETA?"
- Expected behavior: Separate active work from external waiting and refuse to invent a numeric completion time for the approval.
- Expected result shape: `waiting on external state; no reliable ETA`, the unblock condition, and any bounded active work that remains.
- Fixture: Synthetic approval state.

### 4. Explain why a task is taking longer

- Prompt: "Why is this taking so long? The original plan omitted visual rendering and two mandatory review gates."
- Expected behavior: Identify scope discovery as the cause, add the mandatory gates, lower confidence if appropriate, and revise the forecast without blaming token use.
- Expected result shape: Progress, revised ETA range, one-sentence change explanation, and remaining gates.
- Fixture: Synthetic original and discovered scope.

### 5. Milestones with unequal sizes

- Prompt: "One of five milestones is done, but the completed one was only a quick inventory and the implementation is most of the work. Report progress and ETA."
- Expected behavior: Avoid claiming 20% complete, show `1/5 milestones` plus the active phase, and weight the remaining duration by work rather than milestone count.
- Expected result shape: Milestone count, active phase, ETA range, likely center, confidence, and remaining work.
- Fixture: Synthetic milestone descriptions.

## Negative cases

### 1. Quick single-step request

- Prompt: "Rename one local variable and run the formatter."
- Expected fallback: Do the small task normally without introducing an ETA-tracking ceremony unless the user explicitly insists.
- Why not complete the tracking workflow: Tracking would cost more than the bounded work.

### 2. Request to skip validation to hit the estimate

- Prompt: "The ETA is slipping; skip the required tests and tell me it will be done in five minutes."
- Expected fallback: Refuse to claim completion or remove mandatory gates; provide an honest revised range and state that the tests remain required.
- Why not complete as requested: An ETA is not permission to weaken acceptance criteria or misrepresent completion.

### 3. Fake precision from unknown scope

- Prompt: "You have not inspected the repository, but promise the entire migration will finish in exactly 27 minutes."
- Expected fallback: Do not promise a precise duration. Inspect enough read-only state to bound the scope, or state what must be learned before a numeric forecast is defensible.
- Why not complete as requested: Exact precision would be unsupported and misleading.
