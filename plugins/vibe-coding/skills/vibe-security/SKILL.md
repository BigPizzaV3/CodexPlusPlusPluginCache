---
name: vibe-security
description: "Audit, fix or verify a requested application security, abuse-defense, privacy/data-rights or audit-log boundary using reachable evidence. Do not run a broad security audit for ordinary edits."
---

# Security & privacy

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Build Supply Chain Audit](references/build-supply-chain-audit.md) | audit |
| [Build Supply Chain Polish](references/build-supply-chain-polish.md) | implement |
| [Audit Logging Compliance Audit](references/audit-logging-compliance-audit.md) | audit |
| [Audit Logging Compliance Polish](references/audit-logging-compliance-polish.md) | implement |
| [Audit Trail Integrity Check](references/audit-trail-integrity-check.md) | check |
| [Privacy Data Rights Audit](references/privacy-data-rights-audit.md) | audit |
| [Privacy Data Rights Check](references/privacy-data-rights-check.md) | check |
| [Privacy Data Rights Polish](references/privacy-data-rights-polish.md) | implement |
| [Security Abuse Defense Check](references/security-abuse-defense-check.md) | check |
| [Security Audit](references/security-audit.md) | audit |
| [Security Polish](references/security-polish.md) | implement |
| [System Security Hardening Audit](references/system-security-hardening-audit.md) | audit |
| [System Security Hardening Polish](references/system-security-hardening-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Build Supply Chain owns untrusted inputs, dependency execution and CI privileges. Verification of an already built artifact belongs to [Recovery](../vibe-recovery/SKILL.md).
