---
name: code-work
description: Implement, modify, refactor, debug, and maintain software with strict scope control, repository-aware planning, root-cause analysis, incremental test-backed changes, adaptive parallelism, and fresh verification evidence. Use when Codex is asked to write or change production code, fix a defect, implement a feature, refactor a component, perform a migration, or complete another coding task that authorizes source changes. Use code-verification instead when the primary request is read-only review, testing, diagnosis, audit, or validation.
---

# Code Work

Implement the requested behavior in the smallest reliable increments. Preserve the user's authority, the repository's conventions, and all unrelated work. Treat tests and verification as evidence, not ceremony.

## Preserve the contract

- Treat the user's explicit request and decisions as the controlling specification.
- Work only inside the approved target and outcome. Report adjacent defects or improvements without acting on them.
- Read applicable repository instructions before changing files. Inspect the current status and diff so user-owned changes are not overwritten or reformatted accidentally.
- Do not infer permission to deploy, publish, push, commit, modify live systems, rotate credentials, delete data, or make other external or destructive changes.
- Ask only when missing information would materially change behavior, public interfaces, data, safety, or scope. Otherwise state a narrow assumption and proceed.
- Stop before substituting a workaround, partial implementation, or different design for a binding user decision.

## Establish the change contract

Before editing, identify:

1. The observable outcome and acceptance criteria.
2. The files, modules, interfaces, data, and environments in scope.
3. Invariants and compatibility requirements that must remain unchanged.
4. The highest-risk failure modes.
5. The evidence required to call the task complete.

Inspect the repository's own entry points, manifests, test configuration, CI workflow, and nearby code. Prefer its documented commands and patterns over generic defaults.

For complex work, form a short dependency-ordered plan. Keep only one integration step active at a time, even when independent work runs concurrently.

## Choose the change strategy

- **Defect:** Reproduce the failure, reduce it to a specific mechanism, and trace the responsible data or control flow before editing. Add or identify a regression check that fails for the intended reason when practical.
- **Feature:** Identify the public seam and deliver a thin vertical slice through real behavior before adding breadth.
- **Refactor:** Characterize current behavior first. Separate behavior preservation from intentional behavior change.
- **Migration:** Map producers, consumers, compatibility windows, data transitions, and rollback conditions before changing the contract.
- **Risky boundary:** Identify security, concurrency, persistence, time, network, and failure-recovery behavior explicitly.

Read [references/engineering-decisions.md](references/engineering-decisions.md) when selecting test levels, diagnosing an uncertain failure, designing a risky change, or splitting work across parallel executors.

## Implement in evidence-backed slices

For each observable behavior:

1. **Demonstrate the gap.** Prefer a focused failing test or deterministic reproduction. Confirm that it fails because the behavior is absent or wrong, not because the test or environment is broken.
2. **Make the smallest coherent change.** Modify only what is needed for that slice. Avoid speculative abstractions and adjacent cleanup.
3. **Prove the behavior.** Run the focused check and inspect its full result and exit status.
4. **Improve structure only while green.** Refactor only inside scope and rerun the focused check after structural changes.
5. **Inspect the slice.** Review the diff for accidental API changes, copied secrets, generated noise, weak error handling, and unrelated edits.

Test through public behavior or stable seams where possible. Derive expected values from requirements, invariants, standards, or an independent calculation rather than reproducing the implementation inside the test. Prefer real collaborators over fakes, fakes over stubs, and stubs over mocks when cost and isolation allow.

Do not delete valid pre-existing work merely because it was not developed test-first. If a useful failing test cannot be created safely, use the nearest reliable evidence and disclose the limitation.

## Use adaptive parallelism

Treat parallelism as an optimization, never as a requirement or a source of additional authority.

1. Detect the available agents, processes, test workers, CPU, memory, and isolation mechanisms. Provide a sequential fallback with the same intended result.
2. Build a dependency graph and parallelize only independent nodes. Start with a bounded budget of two to four workers and reduce it when contention appears.
3. Parallelize read-only repository exploration, independent components with stable interfaces, and independent verification commands when safe.
4. Assign one owner to each write surface. Do not let multiple executors edit the same file, schema, lockfile, generated output, or shared interface concurrently.
5. Isolate concurrent writers with supported worktrees or equivalent environments only when their integration path is clear and creation of that isolation is in scope.
6. Serialize root-cause discovery when hypotheses depend on one another, contract changes, ordered migrations, and operations sharing a database, port, service, account, device, or live environment.
7. Use one coordinator to reconcile outputs, resolve overlap, inspect the combined diff, and run fresh post-integration verification.

Never claim combined success by merely collecting worker summaries. Verify the integrated state directly.

## Verify from narrow to broad

Select checks from repository documentation and configuration. Run the smallest relevant check after each slice, then the broadest proportionate set before completion:

- regression and affected unit tests;
- affected integration or contract tests;
- type checking, linting, and formatting checks;
- build or package validation;
- end-to-end or runtime behavior at meaningful boundaries;
- security, performance, migration, or recovery checks when the change creates those risks.

Record fresh commands, exit statuses, and material results. Investigate failures enough to distinguish a product defect, test defect, environment problem, flaky result, and unrelated pre-existing failure. Do not hide or silently reclassify failures.

Before reporting completion, map each acceptance criterion to a code change and verification result. Classify anything not freshly demonstrated as unverified.

## Hand off the result

Lead with the implemented outcome. Then report:

- changed files and observable behavior;
- verification commands and results;
- assumptions and compatibility decisions;
- remaining risks or checks that could not run;
- related findings that were deliberately not changed.

Do not claim completion from reasoning alone, a previous run, a worker's assertion, or a successful command that did not exercise the changed behavior.
