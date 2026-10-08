---
name: tdd
description: "Implement features and bug fixes test-first using red-green-refactor cycles. Use when writing new functionality, adding regression tests, fixing bugs with test coverage, or designing behavior through test assertions — even if the user says \"write tests for this\". Do NOT use for throwaway exploratory prototypes."
---

# Test-Driven Development (TDD)

Implement robust, maintainable functionality through disciplined red → green → verify cycles. Verify behavior through public seams rather than private implementation details.

## Core Principle

> **Write the failing test first, witness it fail for the right reason, and write only the minimal code needed to make it green.**

---

## Core Invariants

1. **Strict Red-First Execution**: Never write production implementation code before seeing an automated test fail against a pre-agreed seam.
2. **Behavioral Testing Over Implementation Inspection**: Tests must assert observable input/output behavior and public contracts, never private variables or internal call chains.
3. **Independent Expected Values**: Assertions must compare against independent ground truth (fixtures, domain specs, known literals), never recomputed mirror logic.
4. **Vertical Tracer Slicing**: Deliver one vertical slice at a time (one test → minimal code → green) rather than batching horizontal test suites upfront.
5. **Deterministic & Isolated Fixtures**: Tests must execute in milliseconds without cross-test state leakage, unseeded random seeds, or unpinned clocks.

---

## Architecture & Map of Content (MOC)

```
[ Agree Public Seam ] ──► [ Red: Write Failing Test ] ──► [ Green: Minimal Code ] ──► [ Refactor & Verify ]
```

| Component | Responsibility | Reference |
|---|---|---|
| **Public Seams** | Identify module boundaries and observable behaviors | `codebase-design` |
| **Test Examples** | Concrete patterns for unit and integration assertions | `tests.md` |
| **Mocking Guidelines** | Safe boundary isolation rules without over-mocking | `mocking.md` |
| **Review & Refactor** | Clean code review after reaching green | `code-review` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Identify & Confirm the Public Seam
- **Action**: State the public interface and observable contract you intend to test, and confirm alignment with domain conventions.
- **Key Point**: Anchor assertions at public boundaries; do not reach into internal private state.
- **Why**: Testing through private internals creates brittle tests that break during harmless refactoring.

### Step 2: Write the Failing Test (RED)
- **Action**: Author a single focused test specifying the expected behavior and run the test runner to observe failure.
- **Key Point**: Verify the test fails specifically because the new behavior is absent, not due to syntax or setup errors.
- **Inline Checklist**:
  - [ ] Test names the exact business capability (e.g. `returns_discounted_total_for_premium_member`)
  - [ ] Test fails with expected assertion error
  - [ ] Expected values derived from independent domain constants
- **Why**: A test that doesn't fail properly cannot be trusted to protect against regressions.

### Step 3: Implement Minimal Code (GREEN)
- **Action**: Write the simplest, most direct code that makes the failing test pass.
- **Key Point**: Do not anticipate speculative requirements or write unexercised branches.
- **Why**: Minimal code keeps the change set tight and prevents unverified dead logic.

### Step 4: Verify Suite & Cycle
- **Action**: Run the full test suite to guarantee zero regressions.
- **Key Point**: All tests must be green before proceeding to the next vertical tracer slice.
- **Why**: Catching regressions immediately keeps debugging costs near zero.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll write the implementation first, then add tests."* | **Forbidden: test must be written and observed failing first.** | Tests written after code tend to mirror implementation bias and miss edge-case failures. |
| *"I can mock this internal helper to test the private method."* | **Test only through public seams.** | Mocks on private internals cement architectural rigidity and hide real integration bugs. |
| *"I will write all 15 test cases before writing any code."* | **Vertical tracer slicing: one test at a time.** | Bulk tests lock in premature interface assumptions before real implementation learnings. |
| *"The test passed on the first run without changes."* | **Investigate immediately: tautological or wrong test.** | A test that passes without implementation changes is asserting something already true. |
