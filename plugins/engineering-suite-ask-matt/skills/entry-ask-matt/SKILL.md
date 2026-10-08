---
name: entry-ask-matt
description: "Use whenever the AskMatt plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# AskMatt

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Always invoke the bundled ask-matt skill first. Follow its original decision tree and let it invoke the bundled Matt skills it selects. using-agent-skills is auxiliary only and must not replace Ask Matt unless explicitly requested.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `ask-matt`
- `code-review`
- `codebase-design`
- `diagnosing-bugs`
- `domain-modeling`
- `grill-with-docs`
- `implement`
- `improve-codebase-architecture`
- `prototype`
- `research`
- `resolving-merge-conflicts`
- `setup-matt-pocock-skills`
- `tdd`
- `to-spec`
- `to-tickets`
- `triage`
- `wayfinder`
- `wizard`
- `claude-handoff`
- `implement-spec`
- `loop-me`
- `retro`
- `setup-ts-deep-modules`
- `writing-beats`
- `writing-fragments`
- `writing-shape`
- `git-guardrails-claude-code`
- `migrate-to-shoehorn`
- `scaffold-exercises`
- `setup-pre-commit`
- `grill-me`
- `grilling`
- `handoff`
- `teach`
- `to-questionnaire`
- `wait-what`
- `writing-for-agents`
- `using-agent-skills`
