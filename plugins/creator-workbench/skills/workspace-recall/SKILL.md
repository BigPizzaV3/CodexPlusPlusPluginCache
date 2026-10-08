---
name: workspace-recall
description: Retrieve the smallest relevant set of facts, notes, project state, lessons, and voice context from a Creator Workspace second brain. Use when the user asks what the workspace remembers, wants to resume prior work, needs context before creating, or asks to find something across stored workspace files.
---

# Workspace Recall

Retrieve before generating when the user's request depends on stored context.

## Search order

1. Identify the user’s target question, project, person, topic, or deliverable.
2. Check `projects/<project>/state.md` first when the request is project-specific.
3. Check `memory/rules.md` and `memory/lessons.md` only when durable preferences or prior mistakes matter.
4. Check `profile/` only when voice, positioning, audience, or author identity matters.
5. Search `brain/wiki/` for synthesized knowledge.
6. Read `brain/raw/` or `brain/imports/` only when the wiki lacks enough evidence or provenance is required.

## Retrieval discipline

- retrieve the smallest useful context set
- prefer current project state over stale global notes
- preserve source boundaries and contradictions
- never imply a file was read unless the host actually read it
- do not rewrite memory during recall
- do not dump the whole workspace into context

## Output

Return either:
- the requested answer grounded in retrieved workspace evidence, or
- a compact context packet for the next Creator Workspace skill

A context packet should contain:
- relevant facts and decisions
- source paths or provenance when available
- current project state
- applicable voice or durable rules
- conflicts, gaps, or stale information

## Handoffs

- content creation -> `create-from-brain`
- daily or idea synthesis -> `brain-briefs`
- wiki repair or synthesis -> `living-wiki`
- explicit persistence of new learning -> `save-progress`
