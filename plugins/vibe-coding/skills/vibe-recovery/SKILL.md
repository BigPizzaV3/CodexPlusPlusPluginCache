---
name: vibe-recovery
description: "Audit, fix or verify artifact provenance, release promotion, rollback compatibility, backup integrity and disaster recovery. Restore and failure drills require an appropriate authorized environment."
---

# Delivery & recovery

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Release Artifact Trust Check](references/release-artifact-trust-check.md) | check |
| [Delivery Recovery Audit](references/delivery-recovery-audit.md) | audit |
| [Delivery Recovery Polish](references/delivery-recovery-polish.md) | implement |
| [Delivery Restore & Rollback Check](references/delivery-restore-rollback-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Use Release Artifact Trust Check for source/build/published-byte identity. Repair of CI trust or dependency execution belongs to [Security](../vibe-security/SKILL.md).
