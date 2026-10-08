# Usage

Engineering Project OS is built for Codex. Use it when engineering work must survive multiple tasks, preserve evidence or carry reviewed failure lessons into another repository you own. ChatGPT is a companion for explanations, supplied files and portable bundles.

After a repository is connected, ordinary product work does not need a Project OS prefix. Use `$project-os` when the request itself concerns inspection, durable work state, findings, knowledge, upgrades or Program lifecycle.

## Compact request table

| Developer job | Codex request | Writes |
| --- | --- | --- |
| Understand the system | `$project-os overview` | No |
| Inspect repository state | `$project-os inspect` | No |
| Create or adopt the control plane | `$project-os bootstrap` or `$project-os adopt` | After a clean preview |
| Validate the control plane | `$project-os check` | No |
| Read remaining work | `$project-os plan status[: <plan-id>]` | No |
| Resume or manage durable work | `$project-os plan open: <outcome>`, `plan checkpoint`, `plan resume`, `plan complete`, `plan block: <reason>` or `plan supersede: <reason>` | Record changes after review |
| Coordinate a multi-phase initiative | `$project-os program start: <initiative>`, `program status` or `program close <disposition>` | Start and close after a clean preview; status is read-only |
| Record and reuse failures | `$project-os finding add: <observation>` or `$project-os knowledge <operation>` | Capture, approval, lifecycle and import operations may write |
| Upgrade a connected repository | `$project-os upgrade` | Managed files after a clean dry-run |

Use [Reference](REFERENCE.md) for every request variant, exact helper syntax and record schema.

## Return to work in a new Codex task

Open the repository and ask Codex to continue the actual engineering job. Applicable `AGENTS.md` files route it to the current Project OS state automatically.

~~~text
Continue the offline retry work from the current repository state. Verify the recorded blocker before changing code.
~~~

Codex should inspect WORKFLOW, unresolved requests, the active plan with its contract, STATE, relevant findings and referenced evidence. It should distinguish facts that remain current from acceptance gates that still need verification, then continue from the recorded next action.

Use `$project-os plan resume` only when the Project OS plan transition itself is required, such as reactivating a blocked plan after its blocker is proven resolved. A new task does not require a ceremonial resume command when an active plan already routes the work.

## Open and checkpoint a long task

Open a plan when an outcome is likely to outlive the current task or needs explicit acceptance conditions:

~~~text
$project-os plan open: make password reset idempotent across API retries and worker redelivery
~~~

Codex inspects current authority, checks that no other plan is active and prepares one outcome-sized plan. The Markdown plan records scope, exclusions, implementation and decisions. Its adjacent JSON contract owns acceptance conditions, required proof and next actions; the index owns status. It does not implement the feature merely because the plan was opened.

Checkpoint after repository truth changes materially or before a handoff:

~~~text
$project-os plan checkpoint
~~~

A checkpoint reconciles the plan and `STATE.md` with actual work, findings and evidence. It is not a transcript. The result should state what is complete, what remains unverified and the exact next action.

Complete only when the plan's required evidence exists:

~~~text
$project-os plan complete
~~~

The request invokes the helper plan complete with a checkpoint draft and reviewed dry run. It cannot close a plan with a pending prerequisite, invalid proof or unresolved scoped request. Following slices remain planned. Source checks, deployment, public availability and physical acceptance remain separate gates. A passing CI job cannot satisfy a device-specific acceptance condition unless the plan explicitly defines that equivalence.

## Add a requirement during work

Send an ordinary instruction, without a Project OS prefix or a separate save command:

~~~text
Also handle reconnecting after the app has been offline. Keep the existing retry behavior.
~~~

Codex captures the requirement immediately and integrates it into the same outcome's contract. A material outcome change raises contract revision and requires reassessing proof. Captured means saved; integrated means assigned; implemented requires verified linked gates.

For an independent request such as a new diagnostics screen, Codex creates a planned slice with a contract and recorded sequence. It keeps one active plan. If the addition conflicts with an earlier rule, Codex records needs_clarification, asks for the required decision and continues independent authorized work. An explicit cancellation is recorded as withdrawn with the user's decision; nothing is silently dropped.

After context compaction or in a fresh task, unresolved requests are read from repository files, even when no plan is active. The next task can recover the requirement, destination and next action without the previous chat.

## See what prevents closure

~~~text
$project-os plan status
~~~

The agent runs plan status --require-ready before reporting readiness or suggesting publication. A blocked report starts with "NOT_READY: the outcome is not ready" and the missing acceptance, even when source tests and package checks passed.

A useful response states what was implemented, what was verified and in which target, what remains for closure, which decisions or permissions are needed and where additions were routed. For example: source tests passed; the plan remains open because the remote migration and post-migration scenario are pending; the next step is inspecting the target schema. It must not call the whole feature complete.

A deliberately source-only preparation plan may close without deployment when that was the agreed outcome. A required production migration cannot be relabelled as a following independent slice. A structural PASS does not prove live behavior.

For example, a release ZIP is built and unit tests pass, but fresh-session addition/cancellation recovery has not been checked. The release remains NOT_READY. Run those checks on the isolated candidate before publication; publication is never a prerequisite for discovering whether the promised behavior works.

## Run a Program for a multi-phase initiative

Use a Program only when several plans need one shared contract. A long task by itself belongs in Standard mode.

~~~text
$project-os program start: migrate authentication across the API, workers, web and mobile without downtime
~~~

Codex prepares a definition with an observable outcome, explicit authority, at least two phases, evidence requirements, cost boundaries, exclusions and exit conditions. The helper dry-runs the transition before `.agents/PROGRAM.md` is created. Starting a Program does not create a plan automatically.

Report current status without writing:

~~~text
$project-os program status
~~~

Close a Program only when no plan is active:

~~~text
$project-os program close completed
$project-os program close stopped: the migration was replaced by a vendor-managed rollout
~~~

`completed` requires exit evidence. `stopped` requires a precise reason. Closure archives the exact contract with a SHA-256 digest and returns the repository to Standard.

## Record a confirmed failure

Start with an observation, not an invented mechanism:

~~~text
$project-os finding add: returning from the native camera leaves the preview frozen on the affected iPhone
~~~

The finding records observed behavior, impact, available evidence and the next decisive check. It may contain hypotheses, but it must label them as unverified.

After evidence confirms the mechanism, capture project knowledge:

~~~text
$project-os knowledge capture: FIND-012
~~~

The project lesson can retain local paths, repository names and evidence because it stays in the source repository. It should include applicability, trigger, mechanism, prevention, decisive verification and boundaries.

Prepare reusable knowledge without writing:

~~~text
$project-os knowledge prepare: all
~~~

Codex sanitizes the proposal by removing project names, credentials, personal data, absolute machine paths, URLs, deployment identifiers, evidence paths and copied product history. Review the proposal, then approve only entries that remain accurate and useful without the source project:

~~~text
$project-os knowledge approve: /path/to/proposal.json all
~~~

Approval adds reviewed entries to the source repository's user-owned reusable library. It does not publish them, upload them or send them to the Project OS author.

## Transfer lessons directly to a new repository

When Codex can access both repositories on the same machine, open the destination repository and provide the source path:

~~~text
$project-os knowledge import: /path/to/earlier-repository
~~~

The destination helper reads only the source reusable registry and its approved entries. The dry-run filters active lessons by declared applicability, considers lifecycle tombstones, explains skipped entries and previews target-local changes. The source repository does not change.

Apply only the reviewed result, then run `$project-os check` in the destination. Destination-owned content wins on conflict and repeated imports are idempotent.

This is the primary Codex path for moving verified failure knowledge between repositories you own. There is no background synchronization and no Project OS-managed shared database.

## Transfer a portable bundle

Use a bundle when the destination is on another machine or when ChatGPT is the companion interface.

Export from the source repository:

~~~text
$project-os knowledge export: /path/to/failure-knowledge.json
~~~

The helper previews first, then writes a deterministic JSON bundle containing approved reusable entries and complete lifecycle chains. Inspect the output location and SHA-256 before moving it.

In the destination repository, import the supplied bundle:

~~~text
$project-os knowledge import: /path/to/failure-knowledge.json
~~~

In ChatGPT, attach the bundle and select the plugin:

~~~text
@Engineering Project OS Help me reuse verified failure knowledge from an earlier project in this one.
~~~

ChatGPT works against the supplied bundle and project material. It cannot write to a live local checkout. Apply returned artifacts deliberately, then validate the real destination in Codex.

## Upgrade Project OS

Updating the installed plugin does not update repository-local records. In each connected repository, start a new Codex task and request:

~~~text
$project-os upgrade
~~~

Codex uses the installed helper to inspect the current release, dry-run the upgrade, review conflicts, apply the same clean operation and run `check`. For the schema-preserving 2.2.1 upgrade, application code and project-owned knowledge must not change.

If a managed file has diverged from its recorded baseline, the helper reports a conflict instead of overwriting it. Resolve ownership deliberately and repeat the dry-run. Do not hand-edit `SYSTEM.release` or schema fields to simulate an upgrade.

## ChatGPT companion boundaries

ChatGPT can explain the system without files. It can advise on setup from a project description, inspect supplied Project OS records and work with a portable knowledge bundle.

If a request asks about an existing repository and the required files are not attached, ChatGPT must ask for them. It must not inspect an empty host workspace or present a generic audit as Project OS output.

Use Codex for the full repository-native workflow: current Git state, applicable instructions, deterministic helper operations, exact diffs and repository checks.

## Safety rules

- A clear `do not change files` constraint keeps the whole request read-only.
- Ambiguous mutation requests require one focused clarification before writing.
- Every helper mutation uses the same reviewed dry-run and apply arguments.
- Project OS authority never implies permission to edit application code, install dependencies, delete data, commit, push, deploy, publish or contact external services.
- A passing helper check proves Project OS structural consistency, not the truth of product claims or external evidence.
