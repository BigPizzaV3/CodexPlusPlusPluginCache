---
name: project-os
description: Use this when Codex engineering work must survive multiple sessions, preserve verified repository state or transfer reviewed failure lessons between the user's own projects. Explain, inspect, bootstrap, adopt, validate, upgrade or maintain the repository-local control plane. ChatGPT is a companion for explanations, supplied project files and portable knowledge bundles. Do not use for ordinary one-session coding, generic project management or automatic global knowledge sharing.
---

# Project OS

Engineering Project OS was built for Codex. Create and maintain a small repository control plane that lets Codex resume real engineering work from visible state without changing application behavior unless the user separately asks for application work. ChatGPT can use the same skill as a companion over project material supplied in the conversation.

## Invocation boundary

In Codex, `$project-os` explicitly selects the bundled skill. In ChatGPT, `@Engineering Project OS` explicitly selects the plugin or bundled skill. The request text is ordinary natural language in any language. It is not a shell command, environment variable, rigid command grammar or persistent mode.

Installing the plugin makes the skill available in Codex and exposes its companion workflow in ChatGPT. It does not modify a repository. Once Project OS is connected, ordinary Codex engineering requests follow applicable `AGENTS.md` instructions without requiring `$project-os`.

Use this skill only for Project OS requests. The host may expose it automatically when the installed plugin is selected or the request clearly matches, but do not apply it to unrelated coding work.

Before inspecting or changing a repository, identify the available project input. In Codex, use the repository workspace selected for the current task and accept an explicit path to another schema 5 repository as a read-only knowledge source. In ChatGPT, setup advice and a new starter package may begin from the user's project description, selected project files or an archive provided in the current chat. Ask only for the missing details required to choose a safe setup and mark conclusions that are not backed by files as unverified. Reviewing, validating, repairing, adopting or upgrading an existing Project OS setup requires the relevant repository files, normally `AGENTS.md` and `.agents/`; ask for them when they are missing. Knowledge import requires an approved reusable bundle plus the destination Project OS context. Knowledge export requires the source reusable registry. Never inspect an empty host workspace or claim that the plugin is unavailable. Installation alone does not attach or connect a repository on either surface.

## Interpret short requests

Treat the following as canonical, memorable prompts rather than parser tokens:

- `overview`: read-only product explanation. No argument or repository input.
- `help`: read-only menu. No argument.
- `inspect`: read-only repository and setup inspection. No argument.
- `bootstrap`: create Standard. No argument.
- `adopt`: map compatible existing records. No argument.
- `check`: read-only deterministic validation. No argument.
- `repair`: repair verified Project OS errors. Require an error or scope if it is not already clear.
- `upgrade`: upgrade to the installed release. No argument.
- `program start: <initiative>`: require the initiative.
- `program status`: read-only status. No argument.
- `program close completed`: require complete exit evidence.
- `program close stopped: <reason>`: require a reason.
- `plan open: <outcome>`: require one observable outcome.
- `plan checkpoint`, `plan complete`: require an active plan. Completion uses the guarded helper.
- `plan status[: <plan-id>]`: read-only gate and request report; require an ID when no single active plan exists.
- `plan resume[: <plan-id>]`: continue the active plan or reactivate a selected blocked plan after verifying its blocker is resolved. Require a plan ID when the selection is ambiguous.
- `plan block: <reason>`, `plan supersede: <reason>`: require a reason.
- `finding add: <observation>`: require a concrete observation.
- `knowledge capture: <finding-id>`: require a confirmed finding.
- `knowledge list: project|reusable`: list the selected user-owned knowledge without writing.
- `knowledge prepare: <lesson-id|all>`: prepare a sanitized proposal outside the repository and remain read-only.
- `knowledge approve: <proposal> <lesson-id|all>`: write only the reviewed proposal entries selected by the user.
- `knowledge revise: <lesson-id>`: prepare a reviewed replacement revision rather than silently overwriting an entry.
- `knowledge retire: <lesson-id> because <reason>`: retire a reusable lesson while preserving its lifecycle.
- `knowledge remove: <lesson-id>`: require a separate destructive preview and explicit confirmation, then refuse removal when the lesson belongs to a replacement chain.
- `knowledge export: <destination>`: export approved reusable lessons and complete lifecycle chains to a deterministic portable bundle.
- `knowledge import: <repo-or-bundle>`: preview active lessons applicable to the target plus lifecycle tombstones, then include every linked entry needed to keep selected replacement chains complete.
- `knowledge import all: <repo-or-bundle>`: explicitly preview every non-draft lesson and lifecycle tombstone before importing.
- `knowledge propose-shared: <lesson-id>`: deprecated read-only alias for `knowledge prepare` during the 2.1.0 transition.

Additional text, synonyms, punctuation and another language may refine the same intent. Prefer the clear intended operation over exact wording. A user constraint such as `do not change files` always keeps the request read-only.

For `overview`, never inspect a repository, ask for files or write anything. Explain that Engineering Project OS was built for Codex and is for developers whose AI-assisted engineering work spans sessions. Lead with the practical benefits: resume from verified repository state, preserve decisions and evidence, preview control-plane changes and turn confirmed failures into user-owned reusable knowledge. Explain that project knowledge stays local while a sanitized lesson moves directly from one user-controlled repository to another or through a portable bundle, always after human review and an explicit import. Do not imply a central database, publication requirement, hidden service or automatic learning. End with the next useful Codex workflow, then mention the ChatGPT companion for supplied files and portable bundles.

For `help`, never write files or run an applying helper operation. Return a concise menu of every supported short request above, its purpose, required argument and one or two examples. Explicitly separate requests typed in Codex chat from Python helper commands run in Terminal.

If a request is ambiguous, show the relevant part of help or ask one focused question before any write. If the requested work is unrelated to Project OS, handle it as ordinary repository work and do not create control-plane records merely because the user included the prefix.

## Standard and Program

Standard is the complete default system. Bootstrap always creates Standard and never creates `PROGRAM.md`.

Program is a temporary umbrella contract for one explicitly started multi-phase initiative. A long task or durable plan alone does not justify Program. Start one only through a clear `program start: <initiative>` request and only after initiative, overall outcome, authority, at least two phases with phase outcomes and exit conditions, evidence requirements, cost boundaries, exclusions and overall exit conditions are complete.

Starting Program does not open a plan. Closing requires no active plan. A completed close requires exit evidence. A stopped close requires a reason. Close archives the exact contract and returns the repository to Standard.

Program archives are SHA-256 checked and tamper-evident, not technically immutable, signed or remotely protected.

When upgrading a closed legacy Program, require its actual closure date in canonical `YYYY-MM-DD` form from repository evidence. Never substitute the upgrade date.

## Route to focused instructions

- For `inspect`, `bootstrap` or `adopt`, read [bootstrap.md](references/bootstrap.md).
- For `check`, `repair`, `upgrade`, Program lifecycle, request intake or plan lifecycle, read [maintenance.md](references/maintenance.md).
- For findings or failure knowledge, read [knowledge.md](references/knowledge.md).
- `overview` and `help` are fully specified above and do not require loading every reference.

## Mutation protocol

For every operation that may change Project OS files:

1. Inspect the target repository, Git status, applicable instructions and current record owners.
2. Prepare the intended change and use the matching helper `--dry-run` when available.
3. Review the complete preview. Stop on ambiguity, unsafe ownership, stale state or conflict.
4. Apply only the same clean operation.
5. Run the deterministic checker and report changed files and remaining unverified boundaries.

For reasoned plan, finding or knowledge edits without a dedicated helper subcommand, produce the equivalent read-only preview before writing and run the checker afterward.

## Shared constraints

- Existing user and repository instructions take precedence.
- Never overwrite `AGENTS.md`, context, state, a Program, plan, finding, evidence or knowledge blindly.
- Keep application code, production configuration, credentials, personal data and runtime artifacts outside Project OS operations unless the user's request independently authorizes them.
- Follow the connected repository WORKFLOW for immediate durable user-request intake, canonical JSON, validation after each intake or cancellation, contract revisions and compaction recovery. Authorized clarifications require no separate permission to record or integrate.
- Before final checkpoints, readiness claims or publication recommendations, run plan status --require-ready. Lead with NOT_READY when required acceptance is open; never present source checks or a ZIP as a verified release candidate.
- Record only verified repository facts. Mark unresolved claims as unverified.
- Keep project incidents separate from portable lessons. Approve only confirmed, sanitized mechanisms and never require a Project OS release to transfer user knowledge.
- Do not imply a daemon, watcher, hook, MCP server, hidden database, automatic upload or automatic cross-repository synchronization.
- Project OS does not grant authority to install dependencies, delete files, commit, push, deploy, publish or contact external systems.

The helper entrypoint is `scripts/project_os.py` relative to the installed skill directory. Resolve that path from the installed skill, not from the target repository, except when explicitly testing the candidate helper while developing Project OS itself.
