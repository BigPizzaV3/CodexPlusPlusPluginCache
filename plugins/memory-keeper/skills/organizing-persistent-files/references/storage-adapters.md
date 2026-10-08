# Storage adapters

## ChatGPT Library / Files

1. Search/list the persistent Library, not only conversation attachments.
2. Resolve exact file/folder identity before mutation.
3. Detect a destination conflict before move/rename/upload when the result matters.
4. Treat move/rename/upload as potentially deduplicating: capture the operation's **returned final identity** and final path/name instead of assuming the requested name.
5. Make retries **idempotent**: fresh-list first; if the target invariant already holds, do not repeat the write.
6. Never infer a `sandbox:` path from a display name.
7. After mutation, list/read the exact final persistent item again.
8. If write tools are unavailable, report that environment-specific limitation.

## Local filesystem / coding agents

Resolve real path/inode-like identity when useful, inspect version-control state, mutate canonical files, and verify path/content/hash after mutation. Technical project tests remain independent.

## Connected storage

Use provider-native actions for real mutation. Respect read-only mounts. A local export is not an update to the cloud original unless provider workflow explicitly supports it. Capture provider-returned ids/paths after writes.

## Multiple surfaces

Identify the authoritative surface per artifact. Do not silently synchronize every copy. Two surfaces both claiming canonical ownership is a conflict for `repairing-memory-state`.
