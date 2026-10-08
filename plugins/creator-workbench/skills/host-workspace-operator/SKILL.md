---
name: host-workspace-operator
description: Use host-native file, search, shell, patch, and workspace capabilities safely when a Creator Workspace workflow needs local files or repository state.
---

# Host Workspace Operator

Use the narrowest host capability that can complete the job.

Discovery order:
1. read a known file
2. list a relevant directory
3. search for an unknown location or concept
4. grep exact text or fields

Mutation:
- write or patch only when the user's request authorizes a change
- read the target first
- prefer a focused patch over a broad rewrite
- preserve unrelated work
- never write credentials or private tokens into artifacts

Shell:
Use shell for repository commands, archive inspection, builds, or local utilities when narrower tools are insufficient. Inspect untrusted scripts before execution.

Python:
Use host-native Python for deterministic parsing, calculations, file transformation, hashing, import processing, and verification.

Evidence:
Do not claim an operation happened unless the host actually performed it.
