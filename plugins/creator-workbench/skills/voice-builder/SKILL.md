---
name: voice-builder
description: Build a reusable author profile and writing voice from a short interview plus 3 to 5 writing samples. Use when the user says build my voice, learn my voice, onboard my content style, train on my writing, or wants future content to sound like them.
---

# Voice Builder

## Outcome

Produce two reusable artifacts:

- `about-me.md`: audience, topics, point of view, brand promise, boundaries
- `voice.md`: observed writing patterns and anti-patterns

If the host provides authorized workspace write capability, save them to the project root. Otherwise return both as clearly named artifacts for the user to save.

## Step 1: interview

Collect these six answers. Ask in compact batches rather than using a host-specific form tool.

1. Name and role
2. Primary audience
3. Three to five topics they want to be known for
4. A belief they hold that is uncommon in their field
5. The thought they want readers to associate with their name
6. Subjects or angles they do not want to publish

Do not turn multiple-choice examples into assumptions. Free-text answers are preferred.

## Step 2: samples

Request 3 to 5 representative pieces of writing. Accept posts, newsletters, emails, essays, scripts, or transcripts. If the user already supplied at least 3 samples, continue without asking again.

## Step 3: analysis

Look for repeated patterns across the sample set:

- sentence length and cadence
- paragraph rhythm
- opening moves
- point of view
- tone
- recurring vocabulary
- transitions
- closing and CTA style
- list usage
- typical length range
- recurring topics and audience cues
- absence signals such as punctuation, hook types, or phrases consistently not used

Do not infer a rule from one isolated sample.

## Step 4: write `about-me.md`

Keep it under 300 words:

# About Me
## Name and role
## Audience
## Topic pillars
## Point of view
## Brand promise
## Off limits

## Step 5: write `voice.md`

Keep it under 600 words:

# Voice Profile
## Overall voice
## Tone
## Sentence rhythm
## Paragraph rhythm
## Hook patterns
## How I open
## How I close
## Signature language
## What this voice avoids
## Evidence notes

For every negative rule, tie it to a real absence or repeated preference in the samples. If evidence is mixed, say it is mixed.

## Quality gate

Before finishing, check:

- at least 3 samples were analyzed
- rules are observable rather than generic
- contradictions are preserved
- no invented personal details
- the profile is practical enough for another writing skill to apply

## Handoff

Tell the user which two artifacts were produced and route subsequent writing tasks through them.

## Creator Workspace handoff

The profile is an input to `create-from-brain`, `post-writer`, and other authored-content skills. Do not overwrite it during ordinary drafting; use `save-progress` only for explicit durable corrections.
