# Object Storage Integrity & Recovery Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Interrupt multipart upload at each boundary, resume it, submit wrong/duplicate parts, and verify checksum, exact completion, and orphan cleanup.
- Race two writers and delete/overwrite operations using conditional/versioned requests; verify database/object identity and recoverability.
- Replay duplicate/out-of-order/missing notifications and prove idempotent reconciliation against current object version.
- Expire/revoke presigned access and test wrong key/method/content constraints without unsafe broad credentials.
- Exercise version recovery/lifecycle/replication failure in a safe bucket and verify restore procedure, retention, encryption permissions, and observability.
