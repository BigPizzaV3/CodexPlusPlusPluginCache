# Execution and claims

Read this file completely before creating durable tasks or changing an active claim.

## Start or join work

1. Resolve the primary worktree from the first `worktree` record in `git worktree list --porcelain`. The primary worktree owns the board even when product work runs in a linked worktree.
2. Read the marker there. A disabled marker means continue normally without reading board state. An enabled marker must use schema 2 and the exact current project ID.
3. Run the state helper's `list` command before substantial writes:

   ```text
   python <installed-skill>/scripts/coordination_state.py list --project-root <primary-worktree>
   ```

4. Read only the compact active records returned by that command. Legacy schema-1 `CURRENT.md`, task files, inbox records, archives, transcripts, and rollout logs are not active input.

Generated schema-2 `CURRENT.md` is a non-authoritative, active-only view backed by these claims and atomically rebuilt after state mutations. A Coordinator may read it when invoked, but all conflict checks and mutations still use the individual claims.

## Keep task count small

One task is the default. Investigation, implementation, tests, documentation, and follow-up fixes for one coherent outcome stay in that task.

A second or third durable task is justified only when all of these are true:

- the user explicitly asked for separate task windows, decomposition, or a Coordinator;
- its goal is a substantial, complete vertical with a useful bounded outcome;
- its path and exclusive-action boundary is exact;
- it can make progress without a stream of messages;
- parallel work is likely to save more time than the extra task costs;
- the complete assignment can be placed in the native creation prompt; and
- the host can place it in the same primary checkout, current worktree, and current branch.

Do not create a durable task for one test command, a small lookup, formatting, a narrow review follow-up, a mechanical document edit, or a low-risk one-or-two-file fix. Keep that work in the current task or use a parent-owned subagent when allowed by the host.

Three active durable tasks is the default maximum. A direct user decision is required to pass `--user-approved-over-limit`; twelve is the hard limit. The flag records that authority was supplied but does not create authority by itself.

Before creating a durable task, use the native task list to look for a related local task from the same repository and primary checkout. Reuse it when its existing context is useful, it is not actively handling unrelated work, and it has no unresolved user decision. Send one bounded `GOAL_ASSIGNMENT` as described in [messaging.md](messaging.md). If no suitable task exists, create the smallest useful number of local tasks in the current checkout. Never create a worktree merely to isolate a task.

## Goal-scoped Coordinator

When the user explicitly asks one task to coordinate a goal, that task may assign the smallest useful set of two or three durable verticals. Give every task its full goal, exact paths and actions, dependencies, verification, and completion condition in the first assignment. The Coordinator stays available for that goal when the user invokes it again; it is not a permanent lead and repository enablement does not create it.

Claim the exclusive `goal-coordination` action for that Coordinator. Use its bounded claim goal as the shared goal in generated `CURRENT.md`. The Coordinator does not need a source-path claim unless it will edit that path.

After assignment, yield normally. Do not poll task status, wait a few minutes and check again, request periodic reports, create a heartbeat, or promise automatic fan-in. Native task completion does not wake the Coordinator automatically. When invoked again, read current active state and use supported native task status or results only as needed. Combine results only then, or let each completed vertical report directly.

Short dependent checks may still use parent-owned subagents when the host supports them. This does not forbid complete durable verticals assigned by an explicit Coordinator.

## Shared checkout and Git

All coordinated task windows use the same primary checkout, current worktree, and current branch so they share the repository's untracked settings, offline runners, and local runtime context. Do not create or switch branches or worktrees. If the task-creation path would create another worktree, do not use it for coordinated work.

Establish the one shared branch before parallel writers start. After that, do not create or switch branches or worktrees. There is no durable Git owner. Each task may commit its own reviewed changes by staging only explicit files, checking the staged diff, and using an exact commit pathspec so unrelated staged work cannot enter the commit. Never use `git add .`, `git add -A`, force-push, pull, rebase, merge, reset, restore, stash, or clean while other writers are active. A normal non-force push is allowed when the user or repository workflow authorises it.

Git's index lock serializes the actual command, not an entire task. If an index lock, changed `HEAD`, foreign staged path, or remote update is found, stop that Git command, refresh the evidence, and continue after the immediate collision is gone. Do not convert it into permanent `git-integration` ownership.

Generated system maps, lockfiles, schemas, shared indexes, formatter-wide output, and full gates are integration surfaces rather than durable task property. Read-only gates may run at any time. Run a writer only after its required source changes are present; if another writer command is known to be running, let that command finish, then regenerate against the complete shared working tree and review the exact output.

## Create or update a claim

Use the exact native thread UUID. If the host does not expose an exact UUID, do not begin parallel writes; continue single-task work or report that safe board identity is unavailable.

Create revision 1 with `--expected-revision 0`:

```text
python <installed-skill>/scripts/coordination_state.py claim \
  --project-root <primary-worktree> \
  --thread-id <exact-native-thread-uuid> \
  --title <short-native-title> \
  --goal <one-bounded-goal> \
  --path <repository-relative-path> \
  --action <exclusive-action-if-any> \
  --expected-revision 0
```

For an update, pass the exact current revision. A revision mismatch means another turn changed the claim; list the board again before writing. The helper rejects exact exclusive-action overlap and rechecks after the atomic write. Path overlap is returned in `warnings` so agents can see possible shared-file work without turning a whole directory into a lock.

Two path claims overlap when they are equal or when one is an ancestor of the other. Matching is case-insensitive across common Windows and macOS filesystems. This is a warning, not a claim failure. Re-read the exact file before applying a narrow patch. If the patch context no longer matches or the same hunk changed, pause only that edit and coordinate; compatible hunks may continue.

Use `.` only when the task genuinely needs the whole repository. Prefer the narrowest useful file or directory boundary. Concrete paths only: no absolute paths, traversal, drive prefixes, or globs.

Exclusive action names are short lowercase slugs. Use the narrowest truthful action for an operation that really can have only one active executor, such as `goal-coordination`, `release-product`, `deployment-production`, or `database-migration-customer`. Do not use a broad action as a substitute for task scope. `git-integration` is a legacy advisory action and must not be used for new claims. An action never grants authority the task does not already have.

Set `--status blocked --blocked-by <thread-uuid>` only for a real dependency. A status is visibility, not a command to the other task.

Update the claim only when work starts, scope materially changes, blocked state changes, or work completes or stops. Do not write periodic progress, commentary, findings, or a heartbeat into the claim.

## Work and cooperative Git

- Preserve existing dirty work. Claims show planned scope but do not authorize overwriting another task's changes.
- Re-read a file before changing it, use narrow patches, and inspect the resulting diff. Stop only when the same hunk is actually incompatible.
- Before staging, inspect the current index. Stage only explicit files the task reviewed. Verify the staged names and patch, then commit only those exact paths. Leave foreign staged work untouched.
- Direct commits and pushes remain the normal path. Use a pull request only when the user or repository policy asks for one, or independent review materially benefits from an immutable remote diff.
- Pull requests are optional; the board never requires one.
- Another active path claim is visibility, not a task-level blocker. An exact exclusive-action conflict remains blocked until its active owner releases it.

## Complete and release

At a safe terminal boundary, move the claim out of the hot board before the task's final answer:

```text
python <installed-skill>/scripts/coordination_state.py release \
  --project-root <primary-worktree> \
  --thread-id <exact-native-thread-uuid> \
  --expected-revision <current-revision> \
  --status completed
```

Allowed final states are `completed`, `stopped`, `superseded`, and `stale-owner-confirmed`. The helper writes one compact cold receipt, then removes the active claim. It never archives or deletes the native Codex task.

The task reports its own result, changed files, checks, commit or diff when relevant, remaining risk, and blocker. No completion acknowledgement, inbox entry, full-turn ledger, transcript mirror, or permanent Coordinator summary is required.

The packaged Stop guard is a last-resort reminder, not a normal extra workflow. It reads only this task's exact active claim. If it requests a continuation, release finished work immediately. When work genuinely must remain owned across turns, retain or update only this task's claim and state that fact briefly. The guard does not inspect another task, infer completion from transcript text, or run more than once for the same stop attempt.
