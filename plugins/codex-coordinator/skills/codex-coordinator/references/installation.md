# Installation and project enablement

Read this file completely only when the user asks to install, enable, disable, or initialise Codex Coordinator.

## Boundaries

- The plugin installs one global skill and one small read-only SessionStart hook.
- Python 3.10 or newer must already be available. Installation never installs Python, changes PATH, invokes an OS package manager, or asks for administrator access.
- SessionStart reads only the bounded project marker and launches no child process or optional tool.
- No optional observer is started or installed as part of project enablement.
- Project state contains a trackable marker, ignored active claims and cold receipts, plus a generated active-only `CURRENT.md` view after the first claim. That view is never authority. There is no always-on Coordinator, heartbeat, inbox, or task transcript store.

## Enablement preflight

Before writing project files:

1. Resolve the Git root and primary worktree.
2. Inspect the root `AGENTS.md`, root `.gitignore`, marker, Git status, and active native tasks that could own those exact files.
3. Preserve unrelated bytes and existing dirty work.
4. Stop before all writes if the marker or exact insertion cannot be changed safely.

## Marker schema 2

```yaml
schema_version: 2
coordination_enabled: true
project_id: <stable-lowercase-project-id>
project_name: <project-name>
task_prefix: <short-uppercase-prefix>
canonical_paths:
  active: .codex/coordination/active
  archive: .codex/coordination/archive
access:
  cross_project_task_access: false
  cross_project_state_changes: false
```

Keep the marker trackable. Ignore all other coordination state with:

```gitignore
.codex/coordination/*
!.codex/coordination/project.yaml
```

Do not ignore all of `.codex`, the root `AGENTS.md`, or project configuration.

## Root discovery block

Add only this exact block and preserve every unrelated instruction:

```markdown
## Codex task-boundary board

- This repository uses the opt-in Codex task-boundary board in `.codex/coordination/project.yaml`.
- Before substantial writes, load the installed `codex-coordinator` skill, list active claims from the primary worktree, and publish only this task's bounded claim.
- Native Codex tasks remain the execution, messaging, and transcript authority; an explicitly requested goal Coordinator is on demand, with no heartbeat or mandatory pull-request workflow.
- Reject cross-project notices and never store transcripts, reasoning, prompts, or tool output in Coordinator state.
```

## Enable

For a new project, first review the no-write plan:

```powershell
python scripts/codex_coordinator_project.py `
  project init --project-root C:\Projects\example `
  --project-id example --project-name "Example" --task-prefix EX
```

Repeat with `--apply` only after the plan is approved. The helper rejects an existing marker or any unmarked coordination state instead of guessing ownership.

1. Create or migrate the marker only under direct user authority or the explicit repository trigger in the main skill.
2. Add the exact ignore and discovery blocks.
3. Do not create a Codex task, `CURRENT.md`, task contract, inbox, heartbeat, observer process, Doctor schedule, or placeholder record.
4. Validate the marker and run the state helper's empty `list` command.
5. Keep the project single-task until each real writer can publish its own exact native claim.

Schema-1 mutable history is preserved and ignored. Do not infer active schema-2 claims from old task or inbox files.

## Disable

Disabling is reversible and not a purge:

1. Let active writers reach a safe boundary and release or preserve their exact claims.
2. Dry-run the packaged lifecycle helper.
3. Set only `coordination_enabled: false` and remove only the exact discovery block.
4. Preserve the marker, active or archived records, legacy history, native tasks, transcripts, Git history, project config, and application files.

Re-enable only when the marker uses schema 2 and the user explicitly requests it. No background process or task must be restored.
