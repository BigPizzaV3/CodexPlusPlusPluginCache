# Object Storage Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Object Storage improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Allocate stable object/version identity before retryable upload and use conditional operations or database version checks for concurrent writers.
- Keep multipart state resumable, verify checksums using provider-supported algorithms, and ensure abort/lifecycle cleanup for abandoned uploads.
- Issue short-lived least-scope presigned operations only after application authorization and validate metadata/content again at completion.
- Treat events as hints and make consumers idempotent/reconciling; preserve object version in every downstream reference.
- Stage lifecycle/versioning/retention changes with inventory and restore evidence; do not equate replication with backup.

## Validation

- Run provider-compatible integration tests or an explicitly qualified emulator for request shape; do not infer managed-service behavior from an emulator alone.
- Exercise interrupted/resumed multipart, duplicate complete, checksum mismatch, concurrent overwrite/delete, expired presign, duplicate/out-of-order event, lifecycle, and restore.
- Measure memory/connections/throughput for representative object sizes and record provider-side gates not exercised.
