# Proofreading workflow

## Choose the editing depth

- **Grammar-only or light:** correct objective grammar, spelling, punctuation,
  and obvious word-choice errors. Do not rewrite for style.
- **Standard:** apply the grammar pass, then improve clarity, concision, flow,
  and distracting repetition while preserving the author's voice.
- **Direct apply:** the same review standards apply, but explicit user
  authorization allows writing the reviewed draft over the source without a
  separate approval round.

Never create a translation unless separately requested. Reviewing an existing
translation is allowed when requested, but proofreading does not authorize
fact-checking, source replacement, citation invention, or substantive rewriting.

For source-versus-translation review or optional prose-cleanup companions, read
[interoperability.md](interoperability.md). Translation accuracy requires the
source; without it, limit the review to target-language fluency and say so.

## Prepare safely

For a file, create a temporary directory and copy the source into it with the
same extension. Do all work on that copy. For pasted text, a temporary `.md` or
`.txt` file is optional but useful when running Harper.

Identify the language and spelling dialect from the text or user request. Ask
only when choosing incorrectly would materially change the edit. Harper supports
English; use it as a baseline rather than as the editor.

## Baseline lint

Run:

```bash
node scripts/proofread.mjs lint "COPY" --dialect us
```

Supported dialect values are `us`, `uk`, `au`, and `ca`. Exit `0` means Harper
found no lint. Exit `1` normally means it found lint findings. Any other exit,
or a missing executable, means the baseline did not run. Record the initial
findings so the final lint can distinguish pre-existing warnings from regressions.

Treat tool output as advice. Product names, domain terms, intentional dialect,
and quoted language can be false positives; preserve them and mention material
skips in the change summary.

## Human grammar pass

Read the entire text. Check agreement, tense, articles, pronoun reference,
homophones, punctuation, fragments, run-ons, missing words, and ambiguous
modifiers. Prefer the smallest correction that resolves the error.

## Conservative style pass

Skip this pass for grammar-only requests. Otherwise:

- remove filler, redundant transitions, inflated claims, and formulaic phrasing;
- make vague sentences concrete only with details already present in the source;
- vary repetitive sentence structure when it distracts;
- prefer direct wording when it fits the author's existing tone;
- preserve purposeful repetition, technical terminology, accessibility choices,
  uncertainty, and the writer's punctuation habits;
- never add personal experience, opinions, facts, names, numbers, quotations, or
  sources.

Passive voice, adverbs, lists, dashes, and long sentences are not errors by
themselves. Change them only when they create a real clarity or style problem in
this text.

## Final checks

1. Re-run the same Harper command. Resolve new findings or identify them as
   false positives.
2. Run `scan` and inspect suspicious invisible Unicode. Do not remove legitimate
   joiners, directionality controls, or non-breaking spaces blindly.
3. Run `guard ORIGINAL DRAFT`. Any mismatch requires inspection.
4. Review the word diff line by line for meaning drift, dropped qualifications,
   and accidental formatting changes.
5. Return the corrected pasted text, or show the file diff and wait for approval
   unless direct application was requested.

## Report

Keep the report short. Group meaningful changes under lint, grammar, and style;
list material false positives or unresolved ambiguities; state whether the
original file was changed. Do not burden the user with every punctuation edit
unless they requested a detailed audit.
