---
name: proofread
description: Proofread and conservatively copy-edit prose, files, or translations with optional Harper linting and protected-span checks. Use for grammar, clarity, polish, or translation review.
license: MIT. See LICENSE for the full license text.
---

# Proofread

Improve prose without changing what it says. Preserve the writer's language,
voice, claims, names, numbers, citations, quotations, formatting, and protected
technical spans. Never claim that edited text proves human authorship or evades
a detector.

All relative paths below resolve from this `SKILL.md` directory, regardless of
the agent's current working directory.

Local helper commands require Node.js 20+ and Git. Harper CLI 2.x is optional
for English linting. OpenAI-facing interface settings live in
`agents/openai.yaml`, not this file's frontmatter.

## Workflow

1. Confirm the requested depth: grammar-only/light, standard proofreading,
   translation review, or direct application. When editing a file, work on a
   temporary copy.
2. For English, run `node scripts/proofread.mjs lint COPY --dialect DIALECT` when
   Harper is available. For other languages or a missing Harper installation,
   disclose the skipped baseline and continue with human review.
3. Correct grammar and spelling with the smallest meaning-preserving edits.
4. Unless the user requested grammar-only work, make a conservative clarity and
   style pass. Keep deliberate voice and rough edges; do not impose universal
   bans on passive voice, adverbs, dashes, or other legitimate choices.
5. Re-run the lint baseline, then run
   `node scripts/proofread.mjs guard ORIGINAL COPY`. Resolve every protected-span
   mismatch before delivery.
6. Show a word diff with `node scripts/proofread.mjs diff ORIGINAL COPY` and a
   short categorized change summary. Modify the original only after approval,
   unless the user explicitly requested direct application.

Read [references/workflow.md](references/workflow.md) for pass criteria and
acceptance checks. Read [references/protected-content.md](references/protected-content.md)
when prose is mixed with code, commands, citations, quotations, or structured
content. Read [references/compatibility.md](references/compatibility.md) only for
installation or agent-discovery troubleshooting. Read
[references/interoperability.md](references/interoperability.md) only when the
user requests translated-text review, humanization, AI-pattern cleanup, or an
optional companion skill.

## Commands

```bash
node scripts/proofread.mjs doctor
node scripts/proofread.mjs lint PATH --dialect us
node scripts/proofread.mjs scan PATH
node scripts/proofread.mjs guard ORIGINAL DRAFT
node scripts/proofread.mjs diff ORIGINAL DRAFT
```

`guard` is a backstop, not proof that meaning was preserved. Review claims,
names, domain terms, and context manually before delivering.
