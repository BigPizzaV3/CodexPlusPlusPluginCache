---
name: post-writer
description: Draft a LinkedIn or social post in the user's voice from an idea, source, observation, story, or argument. Use when the user asks to write a post, turn notes into a post, or repurpose a source into a social post.
---

# Post Writer

## Inputs

Establish:

- core idea
- target reader
- purpose
- source evidence
- desired action
- voice rules from `about-me.md` and `voice.md` when available

Do not force a CTA if the post works better without one.

## Drafting sequence

1. Write the one-sentence claim.
2. List the strongest evidence or concrete detail.
3. Choose the most natural opening.
4. Build the body so each paragraph earns the next.
5. Remove repeated explanation.
6. End on the implication, action, or unresolved thought.

## Voice fidelity

When a voice profile exists, treat it as a constraint set rather than inspiration. Match cadence, vocabulary, hook behavior, punctuation habits, and closing style.

When no voice profile exists, use the user's current examples and instructions. Do not pretend a persistent voice was loaded.

## Output

Default to one finished post. Provide alternatives only when the user asks or the opening is genuinely uncertain.

## Quality checks

- one primary message
- no invented proof
- concrete language
- no filler setup
- no fake quote marks
- no generic motivational ending
- platform length is appropriate for the request

## Creator Workspace integration

When the user asks to use their notes, research, or second brain, retrieve the relevant context through `create-from-brain` rather than browsing the entire workspace.

When the source is a spoken transcript and the user wants literal authorship, hand off to `voiceprint` instead of imitating the transcript.

Do not persist new preferences automatically. Use `save-progress` only when explicitly invoked.

## Creator Workspace handoff

When the post depends on stored knowledge, consume a narrow context packet from `workspace-recall` or `create-from-brain`. Apply `voice-builder` rules when available.
