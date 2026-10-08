---
name: save-progress
description: Capture useful end-of-session corrections, decisions, project state, and lessons without turning one-off choices into permanent rules. Use when the user says save progress, bank what we learned, capture the learnings, save this for next time, or lock in our corrections.
---

# Save Progress

## Four buckets

Every candidate learning belongs in one bucket:

1. durable rule: should apply across future work
2. one-off override: true only for this deliverable or moment
3. project state: shipped, open, waiting, chosen, or blocked
4. lesson: a mistake that should not repeat

## Safeguard

Before making anything durable, ask internally:

"Would the user want this applied to every future job?"

If not clearly yes, keep it out of durable memory.

## Ownership

- voice-specific durable corrections belong in the voice profile owner
- knowledge from sources belongs in the wiki
- project-only choices belong in project state
- general preferences belong in durable rules
- warnings from mistakes belong in lessons

## No-clobber protocol

Before writing:
1. read the target
2. find an existing entry on the same topic
3. update in place when the new learning refines it
4. do not create a duplicate
5. never silently overwrite a contradiction
6. mark superseded rules retired rather than deleting them
7. keep explicit scope on durable rules

## ChatGPT and Codex portability

Use the current host's supported persistence mechanism when available and appropriate.

If persistent memory is not available, write or return explicit files or patches instead. Never claim memory was saved when it was not.

One-off overrides must not be promoted to shared memory.

## Receipt

Finish with a compact receipt listing:
- rules added, updated, retired, or conflicted
- project state added or updated
- lessons added
- items deliberately kept temporary
- anything still open

Do not re-summarize the whole session.

## Creator Workspace handoff

Write through `host-workspace-operator` only when mutation is authorized and available. Project-only changes stay in project state; durable voice corrections stay with the voice owner.
