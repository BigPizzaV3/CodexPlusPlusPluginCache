# ADR 0002 — Use Node.js `spawn` as the process runtime boundary

- **Status:** Accepted
- **Milestone:** 2
- **Date:** 2026-09-18

## Context

Milestone 1 provisionally selected `execa` as the process runner. Milestone 2 requires stricter control over FFmpeg/FFprobe process lifecycle, incremental stdout/stderr capture, bounded buffers, cancellation, signal forwarding, dry-run behavior, and shell avoidance.

## Decision

Use Node.js `node:child_process.spawn` directly inside exactly one runtime boundary: `src/core/command-result.ts`.

All other source modules must call the core runtime and must not import `child_process`, call `spawn`, or construct shell command strings for execution.

The runtime always uses:

```ts
shell: false
```

and passes arguments as `string[]`.

## Consequences

### Positive

- no shell interpolation;
- deterministic argument boundaries;
- native streaming access;
- explicit cancellation semantics;
- no process-runner dependency;
- easier audit of the only process-execution boundary.

### Negative

- the toolkit owns more lifecycle code than it would with a wrapper library;
- cross-platform process termination must be tested explicitly.

## Supersedes

The provisional Milestone 1 statement that `execa` was the selected Milestone 2 process runner.
