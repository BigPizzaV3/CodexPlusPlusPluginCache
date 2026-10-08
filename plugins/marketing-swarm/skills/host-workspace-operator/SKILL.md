---
name: host-workspace-operator
description: Use when a Marketing Swarm workflow needs to inspect, search, modify, or verify files in the host workspace using the safest native tools available.
---

# Host Workspace Operator

Use workspace tools supplied by the current ChatGPT/Codex host instead of pretending the Plugin owns a filesystem API.

Tool names differ by surface. Route by capability, not by a hard-coded tool name. Typical capabilities include read, list, search, grep, write, patch, shell, and python.

## Capability order

Prefer the narrowest operation that can answer the task:

1. **read**: open a known file or exact range when the path is known.
2. **list**: enumerate a directory or workspace scope when filenames are unknown.
3. **search**: use semantic/content search when the user asks a broad question or exact wording is uncertain.
4. **grep**: use exact text or regex search when the term, symbol, field, or pattern is known.
5. **patch**: make a focused edit to an existing file when a patch-capable host tool exists.
6. **write**: create or replace a file only when the requested workflow requires a mutation.
7. **shell**: run repository commands when file tools are insufficient and command execution is appropriate.
8. **python**: use host-native Python for deterministic parsing, transformations, hashing, package inspection, or verification.

Do not use shell or Python just to imitate a safer read/search/file operation that the host already provides.

## Read-only first

Treat read, list, search, and grep as the default discovery phase. Inspect enough evidence to understand the current state before mutation.

For campaign-export or report work:

- inspect the file shape before transforming it
- preserve original files unless the user requested an edit
- prefer exact reads after search locates the relevant material
- distinguish raw source data from generated analysis artifacts

## Mutation boundary

Write, patch, delete, move, rename, format, or command-based modification are mutation operations.

Before mutation:

- confirm the user requested or clearly authorized the change
- preserve unrelated work
- prefer a focused patch over full-file replacement
- never write secrets into reports, examples, manifests, or release artifacts

After mutation, read the changed area back when practical, run the relevant verifier when available, and report the exact files changed.

## If a tool is unavailable

Do not invent a replacement tool name, claim an operation occurred, or imply the Plugin grants filesystem permissions. Use another available capability only when it preserves the task semantics; otherwise mark the dependent result unverified.
