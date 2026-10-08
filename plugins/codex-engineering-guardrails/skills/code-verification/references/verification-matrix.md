# Verification decision matrix

Read only the sections needed for the current verification target.

## Contents

- Requirement and risk mapping
- Review axes
- Test-quality checks
- Execution selection
- Parallel safety
- Failure classification
- Finding severity and confidence

## Requirement and risk mapping

Build one row for every explicit requirement and material risk:

| Requirement or risk | Observable behavior | Evidence source | Result | Gap |
| --- | --- | --- | --- | --- |
| Exact user requirement | Public output or state transition | Focused test or reproduction | Pass/Partial/Fail/Inconclusive | Missing layer or environment |

Use independent evidence sources in this priority order when applicable:

1. Direct observation in the required environment.
2. Executed behavior at a public boundary.
3. Contract or integration evidence.
4. Unit or property evidence.
5. Static analysis and source inspection.
6. Documentation or assertions without execution.

Lower-ranked evidence can still be appropriate for risks that cannot safely be executed. State the limitation instead of overstating certainty.

## Review axes

| Axis | Primary question | Typical evidence |
| --- | --- | --- |
| Specification | Does every required behavior match the request? | Acceptance examples and boundary tests |
| Correctness | Can valid or invalid inputs produce a wrong state? | Invariants, negative tests, error-path tracing |
| Readability | Can maintainers understand intent and failure behavior? | Focused source review |
| Architecture | Are responsibilities and dependencies coherent? | Caller-consumer and contract analysis |
| Security | Can trust boundaries, secrets, permissions, or inputs be abused? | Threat cases and negative tests |
| Performance | Does relevant workload stay within required limits? | Repeatable benchmarks and profiles |
| Operability | Can failures be detected, contained, and recovered? | Logging, retry, restart, migration, rollback checks |
| Test quality | Would the suite catch meaningful regressions? | Requirement coverage and failure sensitivity |

Do not average these axes into a pass. A material failure on one axis remains visible.

## Test-quality checks

A strong test should have:

- a clear requirement or risk that justifies it;
- a public or stable seam;
- an oracle independent from the implementation;
- meaningful positive, boundary, and failure cases;
- controlled time, randomness, network, and concurrency;
- deterministic cleanup and isolation;
- a failure message that identifies the broken behavior.

Flag these patterns:

- repeating the production algorithm to compute the expected value;
- asserting private calls instead of observable behavior without necessity;
- mocking the exact interaction that needs verification;
- snapshots with no reviewed semantic intent;
- broad end-to-end tests where a smaller deterministic test proves the risk;
- high coverage with missing critical branches or invariants;
- retries that hide nondeterminism;
- tests that pass before the purported fix because they never expose the defect.

## Execution selection

| Risk surface | Minimum useful evidence | Broader evidence when material |
| --- | --- | --- |
| Calculation | Unit or property test | Boundary and randomized cases |
| API or event contract | Contract test | Consumer integration |
| Database or migration | Real storage integration | Restart, partial failure, rollback |
| User workflow | End-to-end behavior | Browser, accessibility, or platform variants |
| Concurrency | Deterministic scheduling test | Repeated stress after deterministic coverage |
| Security boundary | Negative and authorization tests | Dependency or configuration analysis |
| Performance requirement | Controlled benchmark | Profile, variance, and resource ceiling |
| Recovery behavior | Fault injection or controlled failure | Restart and data-integrity checks |

Run only checks that are safe and proportionate to the approved scope. Do not invent stack-specific commands when the repository already defines them.

## Parallel safety

Parallelize a check only if all answers are yes:

1. Does it have no ordering dependency on another check?
2. Does it avoid shared mutable state or use proven isolation?
3. Does it avoid racing on build outputs, caches, fixtures, snapshots, and generated files?
4. Can its result be attributed to one command and environment?
5. Is a coordinator responsible for aggregation and contradiction resolution?

Safe examples often include orthogonal static review and isolated read-only analysis. Unsafe examples often include migrations, live operations, shared integration environments, and multiple test processes targeting the same persistent state.

## Failure classification

Classify a failing check before drawing a product conclusion:

- **Implementation defect:** The target violates the requirement or invariant.
- **Test defect:** The test has an invalid oracle, setup, isolation, or assertion.
- **Environment limitation:** Required dependency, permission, platform, or service is unavailable.
- **Flaky result:** Repeated identical runs disagree without an understood cause.
- **Pre-existing failure:** Reliable baseline evidence shows the failure predates the target change.
- **Unresolved:** Available evidence does not distinguish the causes.

Do not call a failure pre-existing without baseline evidence. Do not call it flaky merely because a retry passed.

## Finding severity and confidence

Estimate severity from:

- impact if triggered;
- likelihood under supported use;
- number of users, systems, or data paths affected;
- difficulty of detection;
- difficulty of recovery.

Use practical levels:

- **Critical:** Immediate severe compromise, irreversible loss, or unsafe release condition.
- **High:** Major requirement failure, security exposure, corruption, or widespread outage risk.
- **Medium:** Material but bounded malfunction or maintainability risk with a realistic trigger.
- **Low:** Limited issue with low impact or an uncommon trigger.

State confidence separately:

- **High confidence:** Directly reproduced or proven by strong evidence.
- **Medium confidence:** Multiple indicators support the finding, but direct execution is incomplete.
- **Low confidence:** Plausible inference requiring further verification.

Do not report harmless preferences as findings. Put non-blocking observations after material findings.
