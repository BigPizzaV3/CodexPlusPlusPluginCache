---
name: vibe-ops
description: "Audit or fix runtime configuration, background jobs and CI/CD in a repository. Bootstrap deployment files only for a requested and evidenced deployment target; do not choose a provider by default."
---

# Infrastructure & background jobs

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Incident Triage Audit](references/incident-triage-audit.md) | audit |
| [Incident Remediation Polish](references/incident-remediation-polish.md) | implement |
| [Incident Recovery Check](references/incident-recovery-check.md) | check |
| [Background Jobs Audit](references/background-jobs-audit.md) | audit |
| [Background Jobs Polish](references/background-jobs-polish.md) | implement |
| [Deploy Bootstrap](references/deploy-bootstrap.md) | implement |
| [Infra Ops Audit](references/infra-ops-audit.md) | audit |
| [Infra Ops Polish](references/infra-ops-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

For an observed outage or regression, use incident triage, remediation or recovery check according to the requested action. Alert semantics belong to [Observability](../vibe-observability/SKILL.md); restore/rollback machinery to [Recovery](../vibe-recovery/SKILL.md).
