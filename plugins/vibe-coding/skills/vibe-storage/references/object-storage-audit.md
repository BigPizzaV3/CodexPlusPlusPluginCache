# Object Storage Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit object identity, authorization, multipart integrity, overwrite/versioning, lifecycle/retention, events, and recovery for the selected object-store provider.

## Domain invariants

- Bucket/container, region/account, tenant prefix, object key, version/generation, metadata, and database ownership form one unambiguous identity contract.
- Presigned/delegated operations constrain method, bucket/key, expiry, content type/size/checksum and authorization context as supported; application authorization precedes URL issuance.
- Multipart/resumable uploads track upload identity and parts durably, validate provider-supported checksums, complete exactly the intended parts, and abort/expire orphan uploads.
- ETag is not assumed to be a universal content MD5; integrity uses documented checksum semantics and verifies downloaded/assembled content where required.
- Overwrite, conditional write, versioning, delete marker, retention/object lock, and concurrent writer semantics are explicit and compatible with database references.
- Lifecycle transitions/expiry, replication, backup/restore, legal retention, and deletion ownership do not silently remove referenced or recoverable data.
- Object event notifications are treated as duplicate, delayed, and potentially out-of-order unless the provider contract proves more; consumers reconcile against object/version state.
- Encryption/KMS permissions, logs/metadata redaction, range/streaming, payload limits, timeouts, retries, and egress/cost are bounded.

## Audit method

1. Map authorization → key/version allocation → upload/download/delete → database state → event consumer → lifecycle/replication/recovery.
2. Inspect provider/version-specific consistency, conditional request, checksum, multipart, versioning, retention, and event guarantees.
3. Trace retries and crashes around initiate/upload-part/complete, database commit, overwrite/delete, event delivery, and cleanup.
4. Check tenant-prefix/key normalization, presigned scope, content validation, SSRF-like fetch paths, and KMS/bucket policy boundaries.
5. Evaluate large-object streaming, connection/memory bounds, orphan multipart inventory, lifecycle age, and storage/egress cost signals.

## Priority model

- **P0:** object loss, unauthorized exposure, irreversible overwrite/delete, broken retention/legal hold, or unrecoverable multipart state.
- **P1:** a material integrity, versioning, lifecycle, consistency, signing, replication, or recovery defect.
- **P2:** a lower-risk but concrete cost, observability, or maintainability issue.
