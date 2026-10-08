# Capability packs

Project OS core owns resumable state, plans, findings, evidence and knowledge lifecycle. Capability packs add only boundary-specific guidance that changes engineering or verification decisions.

Read only packs selected in `.agents/SYSTEM.json` and relevant to the current task. Toolchain names, frameworks and commands remain verified repository facts in `.agents/CONTEXT.md`; they are not packs.

- `service`: APIs, workers, queues, external commands, authorization and distributed outcomes.
- `web`: browser interfaces, accessibility, responsive behavior, routing and client query state.
- `mobile`: application lifecycle, native handoffs, permissions, persistence and device evidence.
- `data`: schema, migrations, transactions, storage, deletion and restore.
- `delivery`: builds, artifacts, deployment, runtime compatibility and release evidence.

Ecosystem overlays refine an enabled capability pack. They never replace the project's pinned source, official documentation or current runtime evidence.
