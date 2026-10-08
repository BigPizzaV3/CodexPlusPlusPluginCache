---
name: review-release-evidence
description: "Assess deployment health, validation coverage, observation or soak completion, documentation, rollback, approval, and release readiness from exact identity-bound project evidence. Use when asked whether a build, package, service, migration, deployment, promotion, or release is ready, healthy, or blocked. This workflow is read-only and never authorises deployment, publication, promotion, tagging, or release."
---

# Review Release Evidence

Read `../../references/untrusted-evidence.md` before inspecting release artifacts or provider output.

Assess evidence, not intent. Keep readiness separate from authority to release.

## Establish identity

Confirm the relevant source revision, version, artifact or package hash, build,
environment, deployment, installed or active identity, evidence timestamps, and target
release channel. Reject mixed, stale, ambiguous, or superseded identities.

Record these lifecycle facts separately:

- candidate version declared by source or metadata;
- published artifact identity and publication evidence;
- provider validation identity, observation time, and result;
- explicit human release decision and decision owner.

None substitutes for another. A matching candidate version, configured provider
workflow, or changelog entry does not prove publication, provider success, or release
approval.

Read the project profile and canonical release contract. If either is absent, state
which gates can still be assessed and which remain project-defined.

## Evaluate gates independently

Report each applicable gate as `pass`, `fail`, `incomplete`, or `unavailable`:

- source and artifact integrity;
- deployment transport and activation;
- runtime or production health;
- required test, migration, compatibility, security, privacy, and rollback coverage;
- observation window, cadence, sample completeness, and identity continuity;
- changed-surface coverage across APIs, schemas, UI, generated artifacts, docs, and
  support material;
- publication, approval, promotion, and release authority.

Do not repair a missed checkpoint with a later healthy sample. Do not treat a passing
test, merged commit, healthy deployment, generated report, or reviewer recommendation
as human release approval unless the release contract explicitly says so.

Use `$run-independent-review` when Level 3 or project rules require multiple review
lenses. External security, compliance, or operational controls remain external.

## Return the gate report

Return exact identity and freshness, per-gate results, contradictions, observation
progress, changed-surface coverage, approval status, missing evidence, residual risk,
and the next read-only action or exact human decision required.

Do not deploy, restart, promote, tag, publish, or release from this skill. Route a
requested mutation through `$establish-governance-boundary` as a separate action.
