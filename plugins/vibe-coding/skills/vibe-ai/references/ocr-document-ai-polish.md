# OCR Document AI Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve one coherent document-processing surface across intake, extraction contract, confidence handling, human review, export, and validation. The diff should make the selected document workflow safer and more complete, not merely rename a label or tweak one parser branch.

## Scope selection

- If the user named a document type, field, table, upload flow, correction UI, export, or extraction bug, polish that surface and directly affected states.
- If the request is broad, inspect current document-AI surfaces and choose the highest-confidence improvement with meaningful user/operator impact.
- Include related fixtures, evals, copy, telemetry, and downstream contract fixes when they belong to the same document workflow.
- Avoid provider/model swaps, large data migrations, and unrelated ingestion redesign unless required by the task or repo evidence.

## Polish targets

- File validation, upload constraints, preprocessing, page ordering, extraction schema, locale parsing, confidence thresholds, and typed field states.
- Low-confidence, unsupported-format, partial-extraction, retry, duplicate-job, correction, export, deletion, and permission states.
- Human review UX: clear labels, editable vs generated fields, validation messages, audit trail, and safe diagnostics.
- Downstream API/DB/export alignment and directly affected tests/evals/fixtures.
- Privacy boundaries: no unnecessary document/PII logging, no public internal error details.

## Implementation principles

- Apply changes at the owning pipeline or schema boundary rather than duplicating parser fixes downstream.
- Preserve existing storage, queue, OCR provider, and export architecture unless the task explicitly requires changing it.
- Keep extracted-data claims honest: distinguish missing, unknown, low-confidence, corrected, and verified values when the product model supports it.
- Update directly affected tests, eval fixtures, docs, and generated maps when the repo uses them.

## Validation

Run relevant repository-native checks and any document/OCR eval or fixture test that protects the changed path. If real document fixtures, provider keys, or queues are unavailable, run deterministic tests and state the exact gap.
