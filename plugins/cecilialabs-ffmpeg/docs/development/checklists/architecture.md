# Milestone 0 — Completion Checklist

**Target:** `v0.0.x`  
**Status:** ✅ Complete

| Requirement | Status | Evidence |
|---|---:|---|
| Define package naming and plugin identity | ✅ | `specs/project-identity.json` |
| Establish repository structure | ✅ | `docs/development/architecture.md` |
| Define supported Node.js version | ✅ | `docs/development/platform-runtime-policy.md` |
| Define minimum supported FFmpeg version | ✅ | `docs/development/platform-runtime-policy.md` |
| Define CLI command hierarchy | ✅ | `docs/development/cli-specification.md`, `specs/command-tree.json` |
| Define TypeScript public interfaces | ✅ | `specs/contracts.ts` |
| Define error taxonomy | ✅ | `docs/development/errors-exit-codes-logging.md`, `specs/error-codes.json` |
| Define JSON output contract | ✅ | `specs/output-envelope.schema.json`, `specs/contracts.ts` |
| Define logging conventions | ✅ | `docs/development/errors-exit-codes-logging.md` |
| Define command exit codes | ✅ | `docs/development/errors-exit-codes-logging.md` |
| Define overwrite behavior | ✅ | `docs/development/io-overwrite-temp-policy.md` |
| Define temporary-file lifecycle | ✅ | `docs/development/io-overwrite-temp-policy.md` |
| Define batch execution semantics | ✅ | `docs/development/batch-semantics.md` |
| Define supported operating systems | ✅ | `docs/development/platform-runtime-policy.md` |
| Catalog all existing Bash scripts | ✅ | `docs/migration-from-bash.md` |
| Map each Bash script to its semantic command | ✅ | `docs/migration-from-bash.md` |
| Identify incorrect/misleading legacy names | ✅ | `docs/migration-from-bash.md` |
| Identify legacy behavior that must not be reproduced literally | ✅ | `docs/development/migration-rules.md` |

## Milestone 0 acceptance criterion

> The architecture must support adding a new FFmpeg operation without requiring changes to the CLI infrastructure or execution layer.

**Satisfied by design:** commands are adapters over typed domain operations; domain operations emit structured FFmpeg invocations consumed by a shared runtime. New operations register under a domain without changing process execution, JSON output, logging, overwrite handling, or error semantics.

## Gate to Milestone 1

Milestone 1 may start when implementation conforms to the frozen decisions here. Any incompatible change requires an ADR/update to this package rather than an implicit deviation.
