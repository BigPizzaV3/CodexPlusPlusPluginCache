---
name: go-fintech-security-compliance
description: "Use for Go payment compliance, sanctions, tokenization, audit, and PCI. Do not use for generic exploits or legal advice."
license: Apache-2.0
compatibility: "Go 1.24 or newer; standards and regulatory obligations require current qualified interpretation for the actual system."
---

# Go fintech security and compliance

Minimize the systems and people that can store, process, transmit, or affect sensitive payment data. Compliance evidence must follow actual controls, not documentation theater.

## Scope the data

Classify account data, sensitive authentication data, PII, secrets, reusable payment/network tokens, detokenization handles, low-value opaque correlation IDs, derived identifiers, and audit records. Prefer hosted collection or tokenization that prevents raw data from entering the service. Map every store, log, queue, trace, backup, analytics stream, and support tool the data can reach.

Do not retain applicable sensitive authentication data after authorization, even when encrypted. This includes card verification codes, PIN/PIN blocks, and full track data. Confirm the exact classification and disposition against the current PCI DSS and qualified assessor guidance for the deployed flow; code inspection cannot establish compliance.

Tokenization narrows scope only when raw collection, detokenization authority, routing, failure queues, telemetry, support access, analytics, backups, and model/tool inputs remain separated in the real data flow. Classify reusable tokens and detokenization handles as authority-bearing values. Prove deletion and retention outcomes across derived stores rather than deleting only the primary row.

## Enforce authority

Authenticate users and services at an assurance level matching risk. Authorize by subject, tenant, action, resource, amount, and workflow state. Separate maker/checker or privileged approval where required. Rotate and revoke credentials; isolate cryptographic keys and record key version without logging secret material.

## Preserve auditability

Record actor, authority, operation, target, before/after state reference, reason, time, correlation, and approval in tamper-evident durable storage. Keep logs and traces free of PAN, authentication data, reusable credentials or payment tokens, detokenization handles, secrets, and unnecessary PII. Classify token-like values before logging; an approved low-value correlation ID is not interchangeable with a reusable credential. Restrict access and test evidence retrieval.

## Engineer change controls

Threat-model sensitive changes, review generated artifacts and dependencies, pin CI inputs, separate duties for releases, prove rollback/migration behavior, and keep retention/deletion schedules enforceable. A checklist does not certify PCI DSS or any regulation; involve qualified security, compliance, and legal owners.

Read [references/control-boundaries.md](references/control-boundaries.md) for tokenization, scope, retention, and audit failure cases.

For sanctions screening, holds, adjudication, list changes, and provider failure, read [references/sanctions-screening-controls.md](references/sanctions-screening-controls.md). Exact duties and dispositions come from the current risk-based compliance program and qualified legal/compliance owners, not from a match score or this skill.

For payment-provider callbacks, read [references/webhook-authenticity.md](references/webhook-authenticity.md). Verify the provider's exact signed representation and endpoint/account/environment key before trusting the payload, then separately enforce durable deduplication, ordering, authorization, and financial state invariants.

## Output contract

State data classification, trust boundary, authority decision, control owner, evidence, and residual compliance uncertainty. Never claim certification from code review.
