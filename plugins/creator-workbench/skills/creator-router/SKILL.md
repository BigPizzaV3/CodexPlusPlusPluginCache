---
name: creator-router
description: Route requests across Creator Workspace to the smallest useful set of bundled skills. Use whenever the user explicitly invokes Creator Workspace, asks for a multi-step creator workflow, or the right second-brain, recall, writing, social-media, visualization, analytics, or session-learning skill is unclear.
---

# Creator Router

Treat an explicit `@Creator Workspace` mention as a direct invocation of this router. Continue into the most specific bundled skill instead of merely describing what the plugin could do.

## Principle

Route by the user's finished outcome, not by upstream repository names. Use the fewest skills needed, but preserve required handoffs between memory, voice, creation, visuals, analytics, and explicit persistence.

## Primary routes

Knowledge and context:
- create or adapt a second brain -> `second-brain-setup`
- import AI conversation exports -> `conversation-importer`
- retrieve existing workspace knowledge or resume prior work -> `workspace-recall`
- synthesize or repair linked knowledge -> `living-wiki`
- daily context or idea brief -> `brain-briefs`
- create content grounded in stored context -> `create-from-brain`

Voice and authorship:
- learn style from written samples -> `voice-builder`
- preserve literal spoken authorship -> `voiceprint`
- newsletter-specific style -> `newsletter-voice`

Social creation:
- draft -> `post-writer`
- structure -> `post-formatter`
- hooks -> `hook-generator`
- idea bank -> `content-matrix`
- current topic research -> `niche-research`
- LinkedIn profile -> `profile-optimizer`
- graphic -> `graphic-designer`
- infographic -> `infographic-generator`
- carousel -> `carousel-generator`
- quote post -> `quote-post`
- pinned comment -> `pinned-comment`
- short-form video -> `reels-scripting`
- YouTube thumbnail -> `youtube-thumbnail`
- draft scoring -> `post-scorer`
- LinkedIn analytics -> `analytics-dashboard`

Visual handoff and persistence:
- visual plans, comparisons, reports, or option boards -> `show-me`
- save explicit corrections, durable preferences, project state, or lessons -> `save-progress`

Execution support:
- workspace discovery, reads, writes, patches, shell, or repository state -> `host-workspace-operator`
- deterministic parsing, indexing, provenance, analytics, hashing, or validation -> `sandbox-python-executor`

## Neural handoff rules

1. If a request depends on stored context, run `workspace-recall` before creation unless the required source is already supplied in the current turn.
2. If imported material is raw, use `conversation-importer` or `living-wiki` before treating it as synthesized knowledge.
3. If voice fidelity matters, apply `voice-builder` after recall and before drafting. Use `voiceprint` instead when the user wants literal spoken wording preserved.
4. Route creation to the narrowest production skill after context and voice are resolved.
5. Add `show-me` only when a visual decision surface or artifact is useful.
6. Use `sandbox-python-executor` when correctness depends on real computation rather than prose reasoning.
7. Use `host-workspace-operator` for actual workspace I/O and never claim an operation occurred without host evidence.
8. Never invoke `save-progress` merely because work finished. Persist only when the user explicitly asks to retain learning or project state.

## Composite examples

"Use my notes to write a LinkedIn post in my voice":
`workspace-recall -> voice-builder profile -> post-writer`

"Turn these exports into a second brain and tell me what you know about topic X":
`second-brain-setup -> conversation-importer -> living-wiki -> workspace-recall`

"Analyze my LinkedIn data and show me what is working":
`analytics-dashboard -> sandbox-python-executor -> show-me`

"Create a post from my research, then save the correction I made to my tone":
`workspace-recall -> create-from-brain -> post-writer -> save-progress`

## Context precedence

Prefer, in order when relevant:
1. current-turn user material
2. current project state
3. applicable durable rules and voice profile
4. synthesized wiki knowledge
5. raw/imported source material for provenance or missing details

Do not silently turn one-off instructions into global rules.

## Evidence rule

Never say a file was read, the web was searched, Python ran, an image rendered, a browser opened, memory changed, or a connector was queried unless the current host produced evidence.

## References

Read `references/workspace-contract.md` for storage ownership and `references/routing-graph.md` for cross-skill handoffs.
