---
name: conversational-narrative-router
description: Use when the user wants a technical or practitioner social post written, continued, explained, audited, or rewritten in a conversational diagnostic deep-dive style without flattening their demonstrated voice.
---

# Conversational Narrative Router

Route authored deep-dive work to the narrowest Skill that owns the job.

## Classify the request

- New post or notes-to-post -> `diagnostic-deep-dive-writer`
- Technical idea needs to become readable without losing rigor -> `technical-concept-storyteller`
- Continue an existing multi-part series -> `series-continuity-writer`
- Audit, de-slop, or rewrite an existing draft while preserving voice -> `voice-fidelity-reviewer`

If the request combines drafting and review, draft with the content owner first, then run the reviewer.

## Shared contract

Before writing, apply the shared references in this Skill's `references/` directory:

- `voice-profile.md`
- `pattern-engine.md`
- `anti-patterns.md`
- `quality-rubric.md`
- `routing-map.json`

Current user instructions and current-turn samples outrank the shared profile.

## Negative routing

Do not force this Plugin onto:

- pure factual lookup
- formal academic prose when the user wants neutral scholarly style
- verbatim transcription
- short conversion copy whose primary job is offer, objection, and CTA mechanics rather than a diagnostic narrative

## Completion

Return the authored content requested. Do not expose internal routing unless the user asks for an explanation of the workflow.
