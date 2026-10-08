# Changelog

## 0.3.3 - Final publishable runtime/discovery build

- Kept the existing Marketplace package identity as `creator-workbench` while preserving `Creator Workspace` as the public display name.
- Confirmed `workspace-recall` is physically bundled under `skills/workspace-recall/` with valid `SKILL.md` and Marketplace-compatible `agents/openai.yaml`.
- Kept `workspace-recall` wired into `creator-router`, the routing graph, discovery fixtures, and the dummy workspace recall workflow.
- Strengthened tests so release version bumps no longer require a hardcoded test edit and so `workspace-recall` presence/routing is asserted explicitly.
- Revalidated all 29 skills against the current `agents/openai.yaml` policy contract: `policy` contains only boolean `allow_implicit_invocation`.

## 0.3.2 - Marketplace identity compatibility

- Restored the package identifier to `creator-workbench` so uploads match the existing Marketplace plugin identity.
- Kept the public display name as **Creator Workspace**.
- Updated local validation, tests, and reviewer metadata to enforce the compatibility identifier.


## 0.3.1 - Marketplace metadata hotfix

- Removed `policy.products` from every `skills/*/agents/openai.yaml`.
- Restricted skill metadata `policy` to `allow_implicit_invocation` only.
- Updated the local validator to reject unsupported policy keys and non-boolean invocation values.
- Updated tests to enforce the Marketplace-compatible policy contract.

## 0.3.1

- Renamed the package identifier from `creator-workbench` to `creator-workspace`.
- Fixed invalid OpenAI skill product metadata by replacing `CHAT` with valid `chatgpt` targeting.
- Updated every skill default prompt to explicitly invoke its `$skill-name`.
- Added `workspace-recall` for narrow retrieval and project resume workflows.
- Strengthened creator-router handoffs so memory, voice, creation, visuals, analytics, and persistence form one directed workflow.
- Added runtime-oriented metadata validation and a dummy workspace smoke test.
- Bumped the package to 0.3.1.

## 0.3.1

- Aligned the package identifier with the installed `creator-workspace` plugin reference while keeping `Creator Workspace` as the public display name.
- Moved manifest branding references to root `assets/` so `.codex-plugin/` contains only `plugin.json`.
- Removed transient Python bytecode and local marketplace metadata from the public package.
- Strengthened direct `@Creator Workspace` routing and second-brain discovery metadata.
- Expanded package validation to reject transient caches, misplaced manifest files, unsafe declared paths, malformed skill agent metadata, and inconsistent package identity.
- Added routing regression checks for direct plugin invocation and core starter prompts.

## 0.1.0

- Combined five upstream repositories into one curated ChatGPT/Codex plugin.
- Added a top-level cross-domain router and shared workspace ownership contract.
- Split AI Second Brain into portable setup, import, wiki, briefs, and creation workflows.
- Preserved Voiceprint's subtractive authorship logic with deterministic provenance tooling.
- Adapted Show Me to host-neutral HTML artifact delivery.
- Integrated Save Progress with voice, wiki, project-state, and durable-memory ownership.
- Ported 17 social-media workflows without mandatory Claude, Gemini, or Apify dependencies.
- Added local marketplace metadata, validation, tests, and deterministic packaging.
