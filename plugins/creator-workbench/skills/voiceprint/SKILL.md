---
name: voiceprint
description: Turn the user's own spoken transcript into a finished long-form piece primarily by cutting, ordering, and lightly joining their literal wording. Use when the user asks to turn a recording or transcript into an article, newsletter, blog post, or long social post that must genuinely remain their own wording.
---

# Voiceprint

## Core rule

The transcript is the source text. The workflow is subtractive.

The model may structure, research, fact-check, title, and add minimal bridges. It should not replace the user's sentences with prettier model-written sentences.

## Input threshold

For a long piece, aim for roughly 1.3 times the target word count in spoken material. If the source is clearly too short, ask for more spoken material rather than filling the gap.

## Workflow

1. Keep the raw transcript. Do not run a generic cleanup rewrite.
2. Plan sections and map transcript regions to them.
3. Identify missing information as up to five specific questions.
4. Prefer spoken answers for missing sections when authorship fidelity matters.
5. Build the draft by cutting, reordering, paragraphing, correcting transcription errors, and adding headings.
6. Add only minimal bridges where unavoidable and flag them.
7. Verify provenance.

## Provenance check

When Python is available:

```bash
python3 scripts/voiceprint_trace.py draft.md transcript.txt --gate 85
```

Treat the score as a provenance heuristic, not proof of detector behavior or a guarantee of any classifier result.

Below the gate, remove or replace model-composed sentences with the user's own wording rather than "humanizing" them.

## Optional voice profile

With multiple transcripts, the bundled profile tools can measure repeated spoken-register features. These metrics describe the user's own speech; they are not a license to impersonate another person.

## Output

Return:
1. finished draft
2. any model-composed bridge sentences
3. missing details that would strengthen the piece
4. provenance result when actually executed

## Creator Workspace handoff

Use `sandbox-python-executor` for provenance tracing when available. Use `workspace-recall` only for supporting context that does not replace the user’s literal spoken wording.
