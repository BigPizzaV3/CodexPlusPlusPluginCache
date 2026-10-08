---
name: create-from-brain
description: Create a post, newsletter, script, carousel, infographic outline, or other content grounded in the user's second-brain context. Use when the user says create from my brain, use my notes, use my research, or wants content that draws on stored knowledge.
---

# Create From Brain

## 1. Retrieve narrowly

Find the smallest set of relevant wiki pages, source notes, project state, and voice files. Do not dump the entire brain into context.

## 2. Separate evidence from interpretation

List the claims that are directly supported and the claims that are the user's interpretation. Preserve uncertainty.

## 3. Choose the authorship path

- If the user supplied spoken material and wants the piece to remain literally theirs, use `voiceprint`.
- If they want normal drafting in a learned style, use `voice-builder` profile plus the relevant writing skill.
- If no voice profile exists, use current instructions and examples only.

## 4. Choose the format

Route to the specific social or writing skill, not a generic catch-all.

## 5. Visual handoff

If the output includes a comparison, plan, design directions, or dashboard, use `show-me` after the content is correct.

## 6. Provenance

Do not invent facts to fill gaps. When a source claim matters, keep enough provenance that the user can trace it back.

## 7. End state

Deliver the requested content. Do not automatically save new memory unless the user invokes `save-progress`.

## Creator Workspace handoff

Use `workspace-recall` first when the relevant workspace context has not already been retrieved. Then route to the narrowest production skill and apply voice rules when available.
