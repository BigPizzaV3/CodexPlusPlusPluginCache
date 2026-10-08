# Coordinator maintenance

Read this file completely only under an explicit user request to change, update, remove, or migrate Codex Coordinator.

## Authority and protected files

Coordinator maintenance does not authorise application code, environment, unrelated configuration, native task lifecycle, provider, release, or deployment changes.

Protected Coordinator files are the installed skill package, hook registration and script, exact project marker, exact discovery block, exact ignore block, active claims, and cold receipts. A task may update only its own claim through the state helper. Another task's claim requires the exact stale-owner recovery procedure.

Before writing outside the current Git common repository, tell the user the exact target and reason. Read-only inspection needs no write notice.

## Update and reinstall

Use the normal plugin manager for package updates and reinstall. Preserve project markers, claims, receipts, legacy state, application files, Git history, configuration, and environment.

Doctor never repairs an installation. A broken compatibility check reports update or reinstall and stops.

Do not leave manual and marketplace-managed copies active together. Removing a verified legacy copy requires a separate exact request and must preserve unrelated global hooks and skills.

## Schema migration

- A behavior-only package update changes no project files.
- A schema migration is a separate user-authorised project action.
- Preserve project ID, active ownership evidence, legacy state, native tasks, transcripts, and working files.
- Never guess live schema-2 claims from schema-1 history. Require a safe boundary and exact native task evidence.
- If migration cannot prove current ownership, keep the project disabled and report the blocker.

## Deactivation, uninstall, and purge

Keep these separate:

- deactivation sets the existing marker to false and removes the exact discovery block;
- global uninstall deactivates explicitly known projects and removes the plugin;
- purge deletes an exact project's Coordinator state only after a separate destructive request and project-ID confirmation.

Every filesystem operation is dry-run-first. Never scan a whole drive, delete native Codex tasks or transcripts, change Git branches or worktrees, or remove unrelated automation, configuration, application, or environment files.

The schema-2 lifecycle helper creates, pins, polls, or stops no Coordinator task and owns no heartbeat, observer lifecycle, or Doctor schedule. An explicitly user-invoked goal Coordinator is an ordinary native task, not a lifecycle-managed runtime.
