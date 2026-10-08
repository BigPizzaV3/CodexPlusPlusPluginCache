# Architecture

## Product idea

Creator Workspace is one skills-only plugin with one top-level router.

The user-facing name is `Creator Workspace`; the package identifier is
`creator-workbench` for Marketplace compatibility, while the public display name remains **Creator Workspace**. The identifier is kept consistent across the manifest,
marketplace metadata, build report, and validation fixtures.

It is not five plugins hidden in one ZIP.

The integrated loop is:

```text
remember -> retrieve -> create -> show -> learn -> remember
```

## Source-to-product mapping

| Source repo | Public result | Decision |
|---|---|---|
| social-media-skills | focused social creation and analytics skills | compiled and made host-neutral |
| ai-second-brain | setup, import, wiki, briefs, create-from-brain | split by user job |
| voiceprint | voiceprint skill plus deterministic provenance helpers | core logic preserved |
| show-me | visual handoff skill | browser-specific claims removed |
| save-progress | durability-based end-of-session learning | ownership integrated with brain and voice |

## Architecture class

`skills-only`

No MCP server or app mapping is required for the core product.

External sources such as Gmail, calendar, meeting notes, or NotebookLM are optional host connectors. A skill may use them only when the current host actually exposes them.

## Why no hooks

`save-progress` is intentionally invoked by the user. It does not silently run at every session boundary.

## Why no iMessage channel

The upstream second-brain workflow includes a Claude-specific iMessage channel. That is not a portable ChatGPT/Codex capability and is excluded from the packaged public behavior.

## Skill ownership

The shared workspace contract prevents memory duplication and cross-skill clobbering. See `skills/creator-router/references/workspace-contract.md`.
