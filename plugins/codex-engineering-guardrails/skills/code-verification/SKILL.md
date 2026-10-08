---
name: code-verification
description: Independently review, test, diagnose, and verify software against explicit requirements, repository standards, and material risks using traceable fresh evidence. Use when Codex is asked to review code or a diff, inspect a pull request, diagnose a failing check without changing code, run or assess tests, validate a bug fix or feature, audit code quality, identify coverage gaps, judge release readiness, or report whether an implementation is correct. Default to read-only source inspection and existing checks; create or change tests only when explicitly requested, and do not modify production code unless the user separately authorizes a fix.
---

# Code Verification

Determine what the evidence actually establishes. Keep verification independent from implementation assumptions, distinguish requirements from general quality, and do not repair findings under a review-only request.

## Preserve verification independence

- Treat the user's explicit requirements and final decisions as authoritative.
- Default to read-only source inspection. Running existing checks is allowed, including normal temporary build or cache output, but do not edit source, tests, configuration, lockfiles, or infrastructure without explicit authorization.
- Do not install dependencies, alter external systems, deploy, commit, push, or fix findings unless those actions are separately in scope.
- Inspect applicable repository instructions, the current status, and the exact diff or target before drawing conclusions. Preserve all user-owned changes.
- Evaluate the implementation against requirements and independent invariants, not against its own structure or comments.
- Report adjacent findings without expanding the audit target.

If the user asks to add tests, enter a bounded test-writing mode: change only authorized tests, fixtures, and indispensable test infrastructure. A failing test that exposes a production defect is a valid result. Do not alter production code merely to make the new test pass without a separate command.

## Define the verification contract

Establish:

1. The target: files, diff, commit range, component, API, artifact, or running behavior.
2. The baseline to compare against.
3. Explicit requirements and acceptance criteria.
4. Repository standards and supported environments.
5. Material failure modes and risk boundaries.
6. Allowed actions and available resources.
7. The evidence necessary for a pass decision.

When the specification is incomplete, separate confirmed requirements from assumptions. Ask only when an ambiguity would change the verdict or make a check unsafe.

## Build traceability before execution

Create a compact working matrix:

`requirement or risk -> observable behavior -> best evidence -> result`

Keep two independent review axes:

- **Specification:** Does the implementation do exactly what was requested, including edge and failure behavior?
- **Engineering quality:** Is it correct, understandable, maintainable, secure, efficient enough, and consistent with repository conventions?

Passing one axis must not conceal failure on the other. Read [references/verification-matrix.md](references/verification-matrix.md) when selecting checks, evaluating test quality, assigning severity, or coordinating parallel verification.

## Review in evidence-producing passes

### 1. Establish the changed surface

- Resolve the exact baseline and final state.
- Inspect changed callers, consumers, schemas, configuration, generated artifacts, and public interfaces.
- Identify behavior that may change indirectly, including error paths and state transitions.

### 2. Inspect tests before trusting them

- Map tests to requirements and important risks.
- Prefer tests through public behavior or stable seams.
- Verify that expected values come from a specification, invariant, standard, known example, or independent calculation.
- Look for tautological assertions, excessive mocking, missing negative cases, ignored failures, and tests that only mirror the implementation.
- For regression tests, seek evidence that the test detects the prior defect when a safe baseline or deterministic reproduction exists.

### 3. Review implementation quality

Check correctness first, then readability, maintainability, architecture, security, performance, operability, and repository consistency. Focus on observable consequences. Do not inflate personal style preferences into findings.

### 4. Execute proportionate checks

Discover commands from repository documentation, manifests, CI configuration, and nearby conventions. Prefer this order:

1. Focused reproduction or affected test.
2. Affected unit, integration, and contract suites.
3. Type checking, linting, formatting, and build validation.
4. End-to-end or runtime checks at real boundaries.
5. Security, performance, migration, concurrency, and recovery checks when those risks are present.

Capture each command, environment, exit status, and material result. A green command proves only what it exercised.

Investigate failures enough to classify them as an implementation defect, test defect, environment limitation, flaky result, unrelated pre-existing failure, or unresolved. Do not silently retry until green or automatically fix the cause.

## Use adaptive parallelism

Use parallel execution only when it preserves independence and evidence quality.

1. Detect available agents, processes, test workers, CPU, memory, and isolated environments. Keep a sequential fallback.
2. Start with two to four workers and adapt to measured contention and project guidance.
3. Parallelize orthogonal read-only review passes and checks that have independent state, such as linting, type analysis, isolated unit suites, or separate platform reviews.
4. Give each reviewer a distinct question and raw target context. Do not leak another reviewer's conclusion as the expected answer.
5. Serialize checks sharing a database, port, service, filesystem fixture, rate-limited API, device, account, or live environment unless the project provides proven isolation.
6. Do not run concurrent commands when their build outputs, caches, snapshots, or generated files can race.
7. Aggregate results centrally, deduplicate findings, resolve contradictions against primary evidence, and run any required integrated check on the final state.

Parallel agreement is not proof. One direct, reproducible result outweighs several unsupported summaries.

## Grade evidence and findings

Use these result states:

- **Pass:** Fresh direct evidence covers every required criterion and no material unresolved finding remains.
- **Partial:** Relevant evidence passes, but an important criterion, environment, or test layer is missing.
- **Fail:** Direct evidence shows a material requirement or risk is not satisfied.
- **Inconclusive:** Conflicting or insufficient evidence prevents a defensible decision.

For each finding, provide:

- severity and confidence;
- precise location or affected behavior;
- violated requirement, invariant, or material risk;
- reproduction or supporting evidence;
- consequence and affected users or systems;
- the smallest direction for remediation, without implementing it.

Order findings by severity. Use severity from impact, likelihood, reach, detectability, and recoverability rather than code style. Label inference as inference and distinguish confirmed, likely, historical, and unverified information.

## Report the verdict

Lead with material findings. If none exist, say so plainly while still naming residual gaps. Then report:

- specification verdict and engineering-quality verdict;
- requirement-to-evidence summary;
- commands executed with results;
- coverage gaps, environment limitations, and flaky or pre-existing failures;
- actions deliberately not performed because they were outside scope.

Do not issue a pass based on code reading alone when executable verification was available, an old test run, coverage percentage without behavioral mapping, or another worker's unsupported conclusion.
