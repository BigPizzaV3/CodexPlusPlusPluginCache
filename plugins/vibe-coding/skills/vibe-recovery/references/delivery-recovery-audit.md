# Delivery Recovery Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit commit-to-artifact-to-environment delivery plus rollback, feature controls, backup, restore, and disaster recovery as one executable release contract.

## Domain invariants

- Commit, dependencies/lockfiles, build inputs, toolchain, artifact digest/SBOM/provenance, deployment manifest, and runtime version are traceably linked.
- CI gates run on the exact merge/release inputs, fail closed for required checks, protect secrets, and do not reuse untrusted artifacts/caches across trust boundaries.
- Artifacts are immutable and promoted rather than rebuilt per environment; signatures/attestations and registry permissions follow the established supply-chain policy.
- Rollout strategy defines cohorts, health signals, pause/abort thresholds, capacity, migration compatibility, and who may advance or roll back.
- Feature flags/config changes have owner, default, targeting, fail behavior, observability, rollback role, expiry, and removal plan.
- Rollback is validated against data/schema/event/config compatibility; when rollback is unsafe, a bounded forward-fix or restore strategy is explicit.
- Backups identify all required state, consistency point, encryption/access, retention/immutability, region/failure-domain, and restore prerequisites.
- RPO/RTO are demonstrated by restore/DR exercises with integrity and application-level correctness, not inferred from backup job success.

## Audit method

1. Trace one release from commit and CI identity through artifact digest, promotion, deployment/config/flag, runtime health, rollback, and incident evidence.
2. Inspect cache/artifact/secret trust boundaries, reproducibility inputs, approval/concurrency, and environment-specific mutation.
3. Map rollout signals and abort decisions to directly affected service, schema, queue, client, and dependency contracts.
4. Inventory backup coverage and dependencies, then walk the actual restore order, credentials, DNS/config, schema/version, integrity, and application verification.
5. Compare stated RPO/RTO with observed backup frequency, replication lag, restore duration, data validation, and operator steps.

## Priority model

- **P0:** unrestorable data, destructive rollback, unavailable critical service, broken backup integrity, or unrecoverable deployment.
- **P1:** a material restore, rollback, forward-fix, replication, RPO/RTO, or operator-procedure defect.
- **P2:** a lower-risk but concrete recovery evidence, observability, or maintainability issue.
