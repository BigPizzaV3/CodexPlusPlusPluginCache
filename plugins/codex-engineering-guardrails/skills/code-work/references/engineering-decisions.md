# Engineering decision guides

Read only the sections relevant to the current change.

## Contents

- Change strategy
- Test level selection
- Reliable test design
- Root-cause loop
- Parallel execution safety
- Completion evidence

## Change strategy

| Situation | First evidence | Smallest useful slice | Broad verification |
| --- | --- | --- | --- |
| Defect | Deterministic reproduction | Regression check plus root-cause fix | Affected suite plus neighboring behavior |
| Feature | Acceptance example at a public seam | One end-to-end behavior path | Contract, integration, and compatibility checks |
| Refactor | Characterization tests | One structural boundary | Behavior parity plus static checks |
| Migration | Producer-consumer and data map | Backward-compatible transition | Old/new compatibility and rollback rehearsal |
| Performance | Repeatable baseline | One measured bottleneck change | Same workload, variance, and resource profile |
| Security | Threat and trust-boundary model | One mitigated abuse path | Negative tests and regression of allowed behavior |

Do not combine unrelated strategies in one patch merely because they touch nearby code.

## Test level selection

Choose the lowest level that proves the required behavior without bypassing the risk:

| Risk | Prefer | Add when needed |
| --- | --- | --- |
| Pure calculation or invariant | Unit or property test | Boundary and randomized cases |
| Module collaboration | Integration test | Failure and retry paths |
| Public API or event contract | Contract test | Consumer compatibility |
| Storage or migration | Realistic integration test | Restart, rollback, and partial failure |
| User workflow | End-to-end test | Accessibility and browser/runtime variants |
| Race or timing behavior | Deterministic concurrency test | Repetition or stress after deterministic coverage |
| Performance budget | Benchmark with controlled input | Profiling and resource ceilings |

Do not pursue a coverage number as a substitute for behavior coverage. Cover important branches, boundaries, failures, and invariants.

## Reliable test design

- Assert externally meaningful outputs, state transitions, contracts, or side effects.
- Obtain expected values independently from the code under test.
- Keep one clear reason for failure where practical.
- Make time, randomness, network, and concurrency controllable without asserting private implementation details.
- Use test doubles only at genuine boundaries. Do not mock the exact behavior the test is meant to prove.
- For a regression, demonstrate that the check detects the prior defect when a safe baseline or reproduction is available.
- Treat a flaky test as an unresolved reliability problem, not as a passing result after retries.

## Root-cause loop

1. Capture the exact symptom, environment, input, and first bad boundary.
2. Reproduce consistently or state why reproduction is incomplete.
3. Trace backward from the observed failure through data and control flow.
4. Form one falsifiable hypothesis.
5. Run the smallest experiment that distinguishes that hypothesis from alternatives.
6. Change the root mechanism, not only the visible symptom.
7. Verify the original reproduction, adjacent behavior, and relevant failure paths.

After repeated failed hypotheses, stop adding patches. Reassess assumptions, architecture, and evidence.

## Parallel execution safety

Parallelize only when every candidate has:

- a clear input and expected output;
- no hidden dependency on another candidate;
- an exclusive write set or read-only operation;
- independent resources or an isolation mechanism;
- a defined integration owner and verification step.

Good candidates include separate read-only searches, tests using independent resources, and independent modules behind settled interfaces. Poor candidates include edits to shared contracts, lockfiles, schemas, generated trees, global configuration, or a common runtime.

Measure wall time and contention. More workers are not automatically faster or safer.

## Completion evidence

For each acceptance criterion, retain a compact chain:

`requirement -> changed seam -> focused evidence -> broader regression evidence -> status`

Use these statuses:

- **Confirmed:** Fresh evidence directly demonstrates the criterion.
- **Partial:** Some relevant evidence passed, but an important layer or environment was unavailable.
- **Unverified:** No adequate execution evidence exists.
- **Failed:** Evidence demonstrates that the criterion is not met.

Never upgrade partial or unverified evidence to confirmed based on confidence alone.
