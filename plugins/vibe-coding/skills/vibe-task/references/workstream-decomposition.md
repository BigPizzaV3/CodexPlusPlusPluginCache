# Workstream Decomposition

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Decompose one large, evidence-backed objective into the smallest dependency-ordered workstreams that can be implemented and validated independently without splitting a shared invariant across tasks.

## Preconditions

The objective is already evidence-backed but cannot be completed as one coherent patch. Do not use decomposition to disguise uncertainty. If the target or ownership is unresolved, report the missing decision and stop. Use maps such as Project Atlas, Ownership & Invariant, Traceability, Runtime Flow, Auth Entitlements, Test Coverage, and Risk & Release only as discovery aids; preserve direct owner evidence in every workstream.

## Decomposition rules

- Split on authoritative owner, product requirement/acceptance owner, policy decision owner, public/data contract, state migration, rollout/rollback, or independent validation boundaries.
- Keep one invariant and its directly affected producers/consumers in the same slice unless a compatible intermediate contract is explicit.
- Mark work parallel only when it does not write the same contract, migration sequence, generated artifact, or deployment gate.
- Define integration checkpoints before downstream work that depends on a new schema/API/event/config contract.
- Each workstream must be independently reviewable, testable, and stoppable; avoid a final catch-all integration task.
- Preserve exact `path:line[-line]` evidence and separate repository facts from assumptions; map IDs may be included only alongside direct owner evidence.
- Do not create coordination-only tasks, broad cleanup buckets, or artificial slices that cannot reach a meaningful acceptance boundary.
