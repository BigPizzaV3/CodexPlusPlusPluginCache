# Patch Checking

## Target and operation

Honor the explicit diff, PR, snapshot, branch, range or commit supplied by the user. A single commit limits scope only when explicitly requested. Otherwise use the current branch and its evidenced integration target; use their merge base and include the full branch delta plus staged, unstaged and untracked changes. If no integration target can be established, inspect available working-tree changes and state that branch integration remains unverified. Do not invent a remote or compare an unrelated branch.

If no changes or target are visible, report `Patch not found: no changed files or review target visible.` and stop. Do not create a sample patch.

Review means inspect and report. Apply fixes only for a request to fix or an already-authorized implementation. Preparing or reviewing a PR does not authorize merging it.

## Review the resulting state

Recover intended behavior and acceptance criteria. Inventory additions, renames, deletions, code, schemas, migrations, manifests, lockfiles, generated files, config and deployment assets. For each changed contract identify its owner and inspect direct callers, consumers and operational paths. Check target-side changes after the merge base when available; use a non-destructive merge simulation if it adds relevant evidence.

Check ownership and architectural layer, producer/consumer compatibility, API/event/error semantics, permissions and tenancy, serialization, state transitions, concurrency, retries, cancellation, cleanup, migration and rollout/rollback only where the actual change makes them relevant. Check that verification exercises the real changed path rather than an unrelated or fully mocked path.

A defect must be introduced by the change, represent required behavior that is missing, or be a pre-existing condition that directly prevents the changed contract from working or integrating correctly. Exclude style preferences, speculative redesign and unrelated existing defects. Cite the governing expectation and a reachable violation with path, line, symbol and impact. Separate direct evidence from inference.

## Correction and validation

When authorized, correct each concrete in-scope defect at its authoritative owner and synchronize only directly affected contracts. Reinspect the complete resulting state after a correction. Do not keep changing architecture after the required behavior is satisfied.

Discover relevant commands from the actual repository and run focused applicable checks. Record exact commands and outcomes. Required failed, missing or unavailable validation prevents a fully clean verdict; optional unrun checks are reported proportionally. Preserve unrelated work. Inspect final changes, including untracked and generated files, and use `git diff --check` when Git is available.

End when the requested review/fix is complete, a concrete external gate remains or further attempts add no evidence. A repeated command without a meaningful change is not progress.

## Result

Use a concise verdict: clean, fixes applied and verified, findings remain, or verification blocked. Then give material findings/changes, reviewed target, validation and residual limits in the user's language. Never report an unavailable check as passed or a local result as production readiness.
