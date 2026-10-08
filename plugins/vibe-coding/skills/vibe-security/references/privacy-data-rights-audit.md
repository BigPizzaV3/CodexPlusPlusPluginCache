# Privacy Data Rights Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one privacy/data-rights boundary such as PII collection, consent, retention, deletion, export, account closure, data sharing, telemetry, or sensitive logging. This is repository correctness work, not legal advice.

## Domain invariants

- PII/sensitive data has explicit collection, storage, access, retention, deletion/export, and logging behavior.
- Consent, opt-out, privacy settings, and communication preferences are enforced at owner layers.
- Deletion/export jobs cover primary stores and directly affected indexes, caches, object storage, analytics, and provider integrations.
- Logs, traces, analytics, and error reports avoid unnecessary sensitive payloads.
- Tests or operational gates verify the selected data-right behavior.

## Audit method

Trace selected data fields from collection through persistence, derived stores, external providers, logs, exports, deletion/retention jobs, backups/runbooks when visible, and user/admin UI. Separate repository facts from legal/business assumptions.
