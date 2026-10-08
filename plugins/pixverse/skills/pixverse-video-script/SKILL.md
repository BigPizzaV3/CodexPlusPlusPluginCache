---
name: pixverse-video-script
description: "Video script and YouTube copy: write the full spoken body with a clear hook, scene beats, visual cues and a usable ending. Script-only work needs no media generation."
---

# Video Scripts

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Deliver words someone can actually speak. An outline is useful preparation, not the finished script unless requested.

For a complete YouTube/hosted script, read `./references/genre-routing.md` first and then
exactly one selected genre guide in full. Deliver three hooks, a complete timestamped
spoken body with production cues, and a retention map. Route by viewer promise/evidence,
not topic nouns; preserve each genre's short-form rules. Ads and fictional scenes retain
their own specialized workflow instead of borrowing an unrelated YouTube beat map.

## Shape The Argument Or Story

Establish audience, desired duration, central question and available evidence. Infer the tone from the brief; a practical tutorial, personal commentary and historical documentary need different language.

Choose the structure that serves the subject:

- Explanation: question, concrete example, mechanism, implication.
- Review: use context, observed evidence, trade-offs, who it suits.
- Commentary: position, reasons, strongest objection, conclusion.
- Documentary/history: sourced event, cause, turning point, consequence; distinguish reconstruction from fact.
- Creator ad: need, visible product proof, practical demonstration, appropriate invitation.
- Narrative: a character wants something, faces an obstacle and makes a consequential choice.

Use sources for factual claims. Avoid fabricated quotations, testimonials, personal experience and unsupported health or performance claims. Keep provisional facts out of finished sales copy.

## Write The Full Body

Write the opening, all spoken sections and the ending. Use contractions or conversational phrasing appropriate to the requested language. Give transitions enough context to be spoken naturally. Maintain a pronunciation list for names, brands and mixed-language terms.

Separate spoken text from visual intentions and source notes. A visual intention states what the viewer must understand; it need not dictate a lens for every sentence. Estimate duration from language and delivery, then label the estimate; actual recording or TTS will set timing.

## Hand Off

For script-only work, deliver the complete editable text and unresolved factual questions. For production, the parent workflow uses this text as its canonical spoken source. Do not add image/video tasks or ask for account login to finish a script.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
