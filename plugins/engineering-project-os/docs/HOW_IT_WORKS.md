# How Project OS works

Engineering Project OS was built for Codex because the most useful engineering context is already inside the repository, except for the part that usually disappears when a conversation ends.

The code survives. The working state often does not. A new task can see the implementation, but it may not know which decision is current, why the obvious approach failed, which acceptance gate remains open or where the previous task intended to continue. Reconstructing that state from old chats works until the work becomes complicated enough to need the state in the first place.

Project OS gives the repository a small, visible control plane. Codex reads only the records relevant to the current job and keeps durable engineering truth beside the code. The plugin provides the workflow and deterministic helper. The repository owns the context, plans, findings, evidence and knowledge.

This is not a second issue tracker or a ceremonial folder of Markdown. It is a handoff that the next Codex task can verify.

## Scene one: resume tomorrow

Imagine a task that outlives one conversation. The first task has traced a data-loss bug, rejected one tempting fix and reached a point where the next useful action is a focused device reproduction. Without durable state, the next task sees the code and starts investigating again.

With Project OS, the active plan owns the intended outcome and acceptance conditions. `STATE.md` holds the current checkpoint and exact next action. Findings preserve what was observed without promoting a hypothesis into fact. Evidence records which commands or external checks actually ran.

The next Codex task starts from those files. It does not need the old conversation to be available, current or even trustworthy.

That is the basic loop:

`inspect repository truth -> do the work -> reconcile the checkpoint -> preserve proof -> resume from the repository`

## Scene two: track the proof that is still missing

A frontend change passes lint, types and unit tests. CI is green. The bug, however, only appeared on a physical iPhone after returning from a native camera screen.

Green CI proves that CI passed. It does not prove that the physical failure is fixed. Project OS keeps those gates separate. The plan can record source verification as complete while physical acceptance remains open. A later task does not need to guess whether "done" meant merged, deployed or observed on the affected device.

The helper validates structure and internal consistency. It cannot decide that a screenshot proves the product outcome or that a source build is equivalent to production. Codex and the user make those judgments from current evidence. Project OS preserves the distinction so the judgment survives the session.

## Preserve a requirement before the conversation forgets it

Halfway through a task, the user adds an offline case or corrects an audience rule. Codex saves that material instruction while processing the message, without requiring a separate request to write it down. The requests registry retains the source formulation, interpretation and route. Compatible additions join the active contract. Independent outcomes get a planned slice; conflicts stay visible until a decision resolves them.

After context compaction, Codex reads unresolved requests with the plan and checkpoint. Integrated means assigned, not delivered. Implemented requires linked verified gates. This is an agent workflow over files, not a background chat recorder, so the agent must perform the capture on each material turn.

A feature may pass local tests while its remote schema is still old. The active contract keeps that required migration pending and plan complete refuses closure. A separate planned slice cannot hide a prerequisite of the original outcome. Source-only preparation may close only when it was the actual agreed result.

## Scene three: coordinate a real multi-phase migration

Most work belongs in Standard mode. One bug fix may not need a plan at all. A long implementation may need one resumable plan, but length alone does not make it a Program.

A Program is useful when one initiative genuinely contains several outcome-sized phases. Consider an authentication migration across an API, workers, web and mobile. Each phase can have its own plan and evidence while one temporary Program contract owns the shared outcome, authority, sequence, cost boundary, exclusions and exit conditions.

Starting a Program does not silently create work. Codex first defines the complete contract, previews the transition and runs the helper only after the boundary is clear. Closing requires no active plan and either verified completion evidence or an explicit stopped reason. The exact Program contract is archived with a SHA-256 digest, then the repository returns to Standard.

The archive is tamper-evident repository content. It is not immutable storage, a signature or a remote audit service. Git remains the review and distribution mechanism.

## Scene four: reuse a failure without importing the old product

Now imagine a React Native repository that has accumulated two months of confirmed failures: lifecycle races, image-memory problems and native handoff mistakes. A new repository begins. Repeating every investigation would not make the new codebase independent. It would only make the developer pay twice.

Project OS separates the local story from the reusable mechanism. A project lesson may mention private paths, product names and exact evidence. A reusable lesson must stand on its own: what triggers the failure, why it happens, how to prevent it, how to verify the prevention and where the lesson does not apply.

The transfer has deliberate gates:

1. A finding records the observed failure and the next decisive check.
2. After the mechanism is confirmed, `knowledge capture` creates project-specific failure knowledge.
3. `knowledge prepare` produces a read-only sanitized proposal.
4. A person reviews the proposal and explicitly approves the lessons that remain safe and accurate without project history.
5. Codex exports the approved library or reads it directly from another repository.
6. The destination previews applicable lessons, explains skips and imports only after confirmation.

`failure -> finding -> project lesson -> sanitized proposal -> approval -> user-owned reusable library -> explicit import`

There is no Project OS-owned shared database. The plugin author does not receive or curate these lessons. Nothing uploads or synchronizes in the background. "Shared" means shared by the user between repositories they control, not globally published.

For two repositories visible to Codex on the same machine, the destination can import directly from the source repository. For another machine or the ChatGPT companion, the user can export a deterministic JSON bundle and supply it explicitly. Destination-owned changes win, lifecycle tombstones remain explicit and repeated imports are idempotent.

The first repository records the lesson. The next one does not need to repeat that failure. Software will kindly provide different failures for future research.

## The repository model

Project OS uses ordinary files with narrow ownership:

- `AGENTS.md` owns startup routing, authority and working rules.
- `.agents/SYSTEM.json` owns the Project OS release, schema, mode, paths and managed guidance baselines.
- `.agents/WORKFLOW.md` owns managed intake, recovery and closure rules.
- `.agents/requests.json` owns material user additions and their routes.
- `.agents/CONTEXT.md` owns durable verified facts and exact commands.
- `.agents/STATE.md` owns the current checkpoint and exact next action.
- `.agents/plans/` contains the status registry, Markdown implementation narratives and adjacent JSON acceptance contracts. Completion receipts bind the contract, proof and scoped requests without making later independent slices part of the old result.
- `.agents/findings/` owns concrete defects, candidates and accepted risks.
- `.agents/evidence/` stores sanitized proof referenced by an owning record.
- `.agents/knowledge/project/` owns repository-specific lessons.
- `.agents/knowledge/reusable/` owns sanitized, reviewed and user-controlled portable lessons.
- `.agents/packs/` contains managed capability and ecosystem guidance.
- `.agents/PROGRAM.md` exists only while one Program is active.
- `.agents/history/` contains closed Program snapshots and their index when they exist.

One fact should have one owner. `STATE.md` is a compact handoff, not a diary. `CONTEXT.md` is durable context, not an active task list. The full `.agents` tree is not inserted into every prompt. `AGENTS.md` routes Codex to the smallest relevant records.

## Installing the plugin is not connecting a repository

Installation makes the reusable skill available. It does not create files, attach a repository or turn Project OS into a permanent mode.

In Codex, open the repository and run `$project-os inspect`. Project OS reads Git state, instructions and engineering configuration without writing. It then recommends a clean bootstrap, a bootstrap that preserves existing authority or adoption of compatible records. Every mutating route follows the same sequence:

`inspect -> preview or helper dry-run -> review -> apply -> check`

After setup, ordinary engineering requests remain ordinary. Applicable `AGENTS.md` files enter the instruction chain when a new Codex task starts. Use `$project-os` again when the request is about the control plane itself.

Bootstrap always creates Standard mode. It never creates a Program. Adoption maps compatible existing records without quietly replacing project-owned authority.

## What the helper can and cannot do

The Python helper performs deterministic operations such as `detect`, `init`, `adopt`, `check`, `upgrade`, Program transitions and reusable knowledge transfer. It validates paths, registries, state invariants, archive hashes, version alignment and managed guidance baselines. Mutating commands support previews where appropriate and refuse stale or conflicting state.

The helper does not infer product requirements, write application code, confirm a failure mechanism, decide whether evidence proves an outcome or grant authority for Git, deployment, publication, dependency installation or external communication.

Project OS 2.2.1 introduces schema 5 while preserving the existing knowledge bundle formats. Updating the plugin does not update connected repositories. `$project-os upgrade` previews managed changes, preserves project-owned records and knowledge, applies only a clean result and runs the checker.

## ChatGPT is the companion surface

ChatGPT can explain Project OS, reason about supplied project files and work with portable knowledge bundles. It does not see a live local checkout merely because the plugin is installed. An overview needs no files, but a claim about an existing repository needs the relevant files or a supplied snapshot.

This makes ChatGPT useful for understanding the model, preparing setup artifacts from supplied material and carrying a reviewed bundle across machines. The full repository-native benefit appears in Codex, where the agent can read current Git state, follow `AGENTS.md`, run the helper and keep the control plane reconciled with the code.

## Safety boundary

Project OS narrows where engineering state lives. It does not broaden what Codex or ChatGPT may do. There is no daemon, watcher, MCP server, hidden database, automatic upload, automatic Git operation or automatic cross-project synchronization.

Application edits, deletion, dependency installation, Git operations, deployment, publication and external communication still require user authority and must follow repository instructions.

For exact request syntax, record schemas and helper commands, continue with [Reference](REFERENCE.md). For installation and upgrades, use [Setup](SETUP.md). For job-based examples, use [Usage](USAGE.md).

## Readiness before delivery

The agent checks recorded outcome readiness before each final checkpoint or publication recommendation. plan status --require-ready returns NOT_READY and a failing exit status until required gates and requests are resolved. A valid record layout, passing source tests or a ZIP cannot substitute for host acceptance. Ordinary intake and cancellation use canonical examples delivered in managed WORKFLOW and are checked immediately, so fresh sessions can detect invalid records rather than trust only their narrative.
