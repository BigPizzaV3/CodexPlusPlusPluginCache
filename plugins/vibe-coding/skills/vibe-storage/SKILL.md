---
name: vibe-storage
description: "Audit, fix or verify object storage authorization, key/version identity, multipart uploads, checksums, presigned URLs, lifecycle and restore."
---

# Object storage

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Object Storage Audit](references/object-storage-audit.md) | audit |
| [Object Storage Integrity & Recovery Check](references/object-storage-integrity-recovery-check.md) | check |
| [Object Storage Polish](references/object-storage-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
