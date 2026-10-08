# OCR Document AI Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit OCR and document-AI behavior from upload/intake to extracted data, correction, export, storage, and downstream use. Keep only reachable issues that affect extraction correctness, safety, privacy, workflow completion, or regression resistance.

## Inspect

Upload/intake routes, file validators, storage, preprocessing, OCR engines, document classifiers, page/region/table extraction, field schemas, confidence handling, human correction UI, export serializers, downstream consumers, async jobs, retries/idempotency, audit logs, PII handling, tests/evals/fixtures, telemetry, docs, and `docs/ai_map.md` when present.

## Issue classes

- Intake and preprocessing: unsupported formats accepted as valid, unsafe file handling, page order drift, rotation/skew not handled where current docs imply it, image/PDF conversion failures, and unbounded file/page size.
- Extraction contracts: field/table/checkbox/signature schema drift, missing required fields, weak confidence thresholds, locale/date/number parsing bugs, and ambiguous null vs unknown behavior.
- Human review and correction: low-confidence data presented as final, correction UI not persisted/exported, no audit trail for edits, and inaccessible or unclear validation states.
- Async/idempotency: duplicate jobs, lost partial results, retries creating conflicting exports, stale status, and user-visible completion before extraction is durable.
- Privacy/security: PII or document contents logged unnecessarily, cross-tenant document exposure, unsafe temporary files, and public error leakage.
- Downstream sync: extracted data shape mismatches API/DB/export/contracts, stale docs/maps, and tests that assert fixtures but not observable behavior.
- Evaluation: missing fixtures for representative document types, low-confidence cases, table extraction, locale parsing, and known regressions.

## Priority model

Cross-tenant document/data leakage, unsafe file handling with reachable exploitability, corrupted extraction feeding payments/legal/destructive decisions, PII/secret exposure, or broken critical document flow.

Important extraction/correction/export defect, misleading confidence/status behavior, non-idempotent async processing, missing critical document eval, or downstream schema drift with user/operator impact.

Lower-risk but concrete quality issue: unclear copy, incomplete low-confidence state, minor fixture gap, stale docs/map, or maintainability coupling that blocks safe document-pipeline changes.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the document pipeline owner and affected user/system surface, plus symbol when possible.
- Include document type, pipeline step, expected output/validation behavior, acceptance criteria, and eval/test direction when discoverable.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same document-pipeline owner unless fixes, rollout units, fixtures, or validation strategy differ.
- Do not recommend changing OCR providers/models unless current repo evidence proves the existing owner cannot satisfy the behavior.
