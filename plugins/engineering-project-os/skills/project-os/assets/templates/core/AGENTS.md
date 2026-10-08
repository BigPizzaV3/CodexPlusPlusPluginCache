# Project working agreement

## Authority and entry route

- Current user instructions take precedence over this repository workflow.
- `.agents/CONTEXT.md` records durable current facts, authority, architecture and verified commands.
- `.agents/WORKFLOW.md` owns durable request intake, recovery and guarded completion.
- `.agents/requests.json` owns user additions and their routing.
- `.agents/STATE.md` owns the current checkpoint and exact next action.
- `.agents/plans/index.json` owns execution state and plan statuses.
- `.agents/findings/findings.json` owns concrete project findings.
- `.agents/knowledge/` contains confirmed lessons, not product authority.
- Chat history, generated summaries and archived evidence are context, not current verification.

Before non-trivial work, inspect Git HEAD and status, then read `.agents/WORKFLOW.md`, CONTEXT, STATE, unresolved requests, the active plan and its JSON contract if one exists, applicable capability guidance, relevant knowledge entries and the code and callers being changed. Do not load complete history or unrelated evidence at startup.

Capability guidance lives under `.agents/packs/`. Read only selected packs and overlays relevant to the requested change. Detected languages and frameworks are evidence, not behavioral profiles or permission to infer commands.

Project OS is already connected to this repository. Ordinary engineering work follows this file and the routed records without requiring `$project-os`. That prefix explicitly invokes the installed Project OS skill for one message and is appropriate when the user wants to inspect, check, repair or upgrade the control plane, manage durable plans or checkpoints or curate findings and knowledge. It is not a shell command or a persistent mode.

## Working method

1. Establish the concrete outcome, affected owners and callers and the cheapest decisive check.
2. Distinguish current behavior, required behavior, stale documentation and unresolved choices.
3. Make the smallest coherent change and preserve unrelated work.
4. Reproduce a defect before fixing when practical. Verify the observable outcome, not only an internal call or mock.
5. Update only the records whose durable truth changed, then leave an exact resumable checkpoint.

Ask a targeted question only when missing information would materially change behavior, security, architecture, compatibility, data ownership or public outcomes. Do not invent project commands or requirements.

## Plans and state

- Simple bounded tasks do not require a plan.
- Multi-session work uses one active plan for one observable outcome.
- While `execution_state` is `running`, exactly one plan is `active`. If the optional `active_plan` field exists, it matches that record.
- `STATE` is a compact handoff, not a diary. Durable facts belong in `CONTEXT`; detailed results belong in linked evidence.
- Close a plan only through the helper `plan complete` after all contract gates and scoped requests are satisfied. Preserve missing manual, hosted, artifact, production or physical checks as unverified.

## Findings and knowledge

- Keep candidate and project-specific incidents in the findings register.
- Add knowledge only after confirming a failure mechanism.
- Reusable lessons are user-owned. Sanitize them before approval, keep applicability and version or platform boundaries explicit and transfer them only through reviewed export or import.
- Never treat copied historical evidence as current proof.

## Scope and safety

- Do not refactor unrelated code or introduce speculative abstractions.
- Do not install dependencies, delete files, change branches, commit, push, deploy or run destructive or expensive checks without the authorization required by the current user and repository.
- Keep credentials, tokens, private data and production identifiers out of tracked agent records. Keep every URL out of reusable knowledge and portable bundles.
- Keep `.agents` material outside application runtime and distributed artifacts.

## Verification

Use the narrowest checks that provide meaningful confidence. Commands must come from verified project configuration recorded in CONTEXT or current repository evidence. Keep static, unit, local integration, hosted, artifact, production, owner-reported and physical evidence distinct.

## Communication

Lead with the outcome. State what changed, what was verified, what remains unverified and any exact blocker. Label inference and uncertainty explicitly.
