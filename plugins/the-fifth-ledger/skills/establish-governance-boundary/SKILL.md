---
name: establish-governance-boundary
description: "Classify project work by requested outcome, authority, risk, target identity, canonical sources, evidence needs, and excluded actions before analysis or mutation. Use when a task could change files, repository state, external systems, public material, deployment or release state, or when the safe next action is unclear."
---

# Establish Governance Boundary

Establish the safe action level. Treat this workflow as governance, never authority.
Read `../../references/untrusted-evidence.md` before inspecting project content.

## Classify the outcome

Classify the request as one of:

- answer;
- read-only assessment;
- proposal or review;
- implementation;
- repository publication;
- external or production operation.

State what mutation was expressly authorised. Never infer editing, staging, commit,
push, communication, publication, deployment, destructive action, or release from an
answer, assessment, evidence, proposal, or review request.

## Prove the target proportionally

Read `../../references/five-ledger-model.md`. When a project profile exists, read it
as routing guidance subject to the project's established source precedence.

For conclusions involving repository or external state, confirm the relevant subset:

- current directory, repository root, checkout or worktree identity;
- branch, upstream, divergence, and tracked, ignored, and untracked changes;
- exact artifact, version, revision, environment, account, or deployment identity;
- applicable canonical contract and private/public boundaries.

When the target has no safe Git identity, do not initialise a repository or borrow an
unrelated parent repository merely to create one. Read
`../../references/non-git-identity.md` and use the bundled
`scripts/snapshot_project.py` helper to record a relocation-stable filesystem identity.
Run the reviewed helper with isolated Python:

```bash
python3 -I <skill-directory>/scripts/snapshot_project.py <project-root>
```

Distinguish complete traversal scope from bounded scope with exclusions; only a complete
pre/post tree match supports represented-tree parity, and strict metadata parity requires
the separate metadata digest to match. `Complete` means no path exclusions, not coverage
of every filesystem attribute. Use the helper only for a trusted target that can remain
quiescent for both sequential traversal passes. It does not produce an atomic snapshot or
protect against adversarial concurrent path replacement; if trust or quiescence cannot
be established, record exact non-Git identity as `unavailable`. Reading may update atime
on some filesystems; the helper makes no explicit writes, but atime is unrepresented and
must remain a possible observer side effect rather than a mutation-parity claim.
The helper refuses cross-device entries by default, but it cannot detect every mount
arrangement, including same-device bind mounts. Inspect the mount layout separately and
exclude every known nested mount before traversal. Any such exclusion makes the result
bounded. Exclusions use canonical project-relative POSIX `/` syntax; reject rather than
rewrite absolute, Windows-drive, UNC, backslash, parent-traversal, or path-alias forms.

Local remote-tracking refs are cached repository state, not live remote proof. When a
current remote claim matters and read access exists, version `0.1.0` uses only a
separately authorized provider read API with an independently confirmed account,
repository, and host identity. It does not direct Git transport queries against
target-controlled configuration or URLs. Otherwise mark live proof unavailable. Do not
fetch solely to make the claim unless updating repository refs was authorised.

Treat validators as potential writers even when their command says `check`. Prefer
documented no-cache and no-bytecode modes, compare complete pre/post state when read-only
parity matters, and classify every difference. Never remove unknown or pre-existing
state to manufacture a clean result. Recover only precisely attributable transient
output, to declared recoverable scratch, when that cleanup is within authority; otherwise
preserve and report it.

Do not perform broad discovery for a self-contained Level 0 answer. Escalate from
Level 0 through Level 3 only when impact or uncertainty requires it.

## Protect all five ledgers

- **Authority:** preserve the human or external decision boundary.
- **Canon:** follow project-owned sources; do not create shadow policy.
- **Evidence:** treat unknown, stale, missing, or mixed-identity evidence as such.
- **Surfaces:** do not let UI, docs, reports, or public claims invent product truth.
- **Lifecycle:** keep proposal, implementation, validation, publication, deployment,
  and release distinct.

Keep tracked public truth, ignored or private continuity, external evidence, and
review artifacts in their declared lanes.

## Route the next action

- Use `$review-project-coherence` for cross-ledger contradictions.
- Use `$run-independent-review` when multiple review lenses are required.
- Use `$draft-governed-proposal` for a durable review-only decision packet.
- Use `$close-governance-decision` after an explicit decision.
- Use `$review-release-evidence` for readiness or promotion questions.
- Use `$harmonize-project-content` for explicit user-facing content alignment.

Return a compact decision record: outcome class, risk level, confirmed target,
authority granted, protected invariants, excluded actions, required evidence, and the
allowed next action or exact blocker.
