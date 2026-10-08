---
title: Daily Project Memory Workflow
---

# Daily workflow

## Start work

Open a new task inside the configured Codex local project. With automatic orientation enabled, Codex reads `Project Home.md`, the compact project index, and current state, then creates a small task-relevant context pack before substantive work. It explains why additional notes were selected.

If context cannot be loaded, Codex should say so rather than silently pretending the vault was read.

## During work

Work normally. Use a marker only when you want to make classification explicit:

```text
Decision: Use one queue per tenant.
Constraint: The service must work without public internet access.
Session only: This benchmark used synthetic data.
```

Project Memory should not interrupt every discussion with note-taking questions.

Natural requests such as `@PMC remember this`, `@PMC update the project status`, and `@PMC what do we already know about deployment?` work without special syntax.

When a task names or changes a source file, Project Memory checks for decisions linked through repository-relative code paths. On a feature branch, implementation-derived candidates remain branch-scoped until merge or release evidence exists.

## Finish work

Ask to wrap up when the session produced meaningful knowledge. Project Memory returns:

- objective and outcome;
- work completed;
- decisions and discoveries;
- repository-relative files changed;
- open questions;
- next actions;
- proposed durable creates or updates;
- information intentionally kept session-only.

Unmarked durable candidates enter the Promotion Inbox and are reviewed before writing. Approval records a fingerprint of the reviewed proposal. Codex verifies that fingerprint and fresh evidence before moving the candidate through `applying` to `applied`; conflicts or failures are recorded without claiming success. Rejected candidates never become durable truth. The handoff brief is then refreshed when useful. Optional session summaries remain separate from the vault.

## Maintain the vault

Periodically ask Project Memory to check one project for:

- stale current-state information;
- conflicting decisions;
- duplicate notes;
- broken Obsidian links;
- completed next actions;
- unowned or unclear project references.

The bundled health checker is run by Codex and is read-only. Normal users do not need to use a terminal.

For projects with stable configuration or architecture claims, periodically ask Codex to run evidence drift checks against the repository. Review every failure before changing either code or notes.

Ask Codex to refresh the knowledge coverage map after adding a workstream or making substantial documentation changes. Use uncovered and thin areas to decide where a short current-state or decision note would most improve future handoffs.

In a shared vault, use contributor-specific inboxes and request review explicitly. Regenerate derived Handoff and Coverage notes after resolving Git merges.

Before sharing a brief externally, ask Codex to create the appropriate export. Review the resulting snapshot under the project's confidentiality rules; it will not track later vault corrections.

Do not run broad restructuring across the entire vault without reviewing the proposed scope.
