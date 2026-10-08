# Optional interoperability

The core proofreading workflow is self-contained. Companion skills can improve
specialized reviews when the host already exposes them, but none is required.
Never install, download, search the user's filesystem for, or claim to have run
a companion skill merely because it appears below.

## Capability detection

Inspect the skills or tools surfaced by the current agent host. Treat a
companion as available only when its instructions can actually be loaded or its
documented command can be executed. Namespaces may differ by host; match the
skill's declared `name`, not an assumed installation path.

If a requested companion is unavailable, continue with the core workflow and
briefly disclose the fallback. Do not make availability of another skill a
condition for ordinary proofreading.

## Enhanced style mode

Use this mode only when the user asks to humanize, remove formulaic AI-writing
patterns, clean reader-facing text, or explicitly requests these companions.
For a standard or grammar-only proofread, keep the built-in conservative style
pass.

When available, apply each requested pass at most once and in this order:

1. `stop-slop`: identify filler and formulaic structures. Ignore absolute bans
   on adverbs, passive voice, dashes, or other legitimate choices when they
   would alter meaning, voice, accessibility, or domain accuracy.
2. `humanizer` (sometimes namespaced `anthropic-skills:humanizer`): improve
   naturalness without adding facts, opinions, personal experience, citations,
   or a voice absent from the source.
3. `clean-user-facing-text` (sometimes namespaced
   `watermarks-remover:clean-user-facing-text`): use only for authorized
   reader-facing prose and final text hygiene. Preserve legitimate Unicode and
   required disclosures. Do not invoke the broader `remove-ai-marks` workflow,
   strip provenance metadata, or promise detector evasion as part of
   proofreading.

Proofread's meaning, language, voice, protected-span, and authorization rules
override every companion. After the last pass, re-run Harper when applicable,
then run `scan`, `guard`, and `diff` on the final draft. Reject or revert any
companion edit that changes a claim, qualification, name, number, quotation,
citation, code span, or required disclosure.

## Translation review mode

Use this mode for an existing translation. Identify the source and target
languages and ask for the source text when it was not supplied.

- With both source and translation: compare them for fabrication, omission,
  terminology, accuracy, structure, and register before polishing the target.
- Without the source: review grammar, fluency, consistency, and target-language
  register only. State that translation accuracy and completeness were not
  verified.
- Preserve paragraph, heading, list, table, citation, number, name, and
  formatting correspondence unless the user authorizes restructuring.
- Do not silently retranslate the document. Separate source-accuracy fixes from
  optional target-language style changes.

When the host exposes `translation-quality` from
<https://github.com/senshinji/claude-translation-skill>, and the user requests a
rigorous or professional review, use its source-comparison review capability.
Request review-only behavior: do not start a new translation, Agent Team,
typesetting pass, or `.docx`/PDF generation unless the user separately asks for
those operations. Apply its critical accuracy fixes before any optional style
companions. Proofread remains responsible for the final protected-span guard
and approval-gated diff.

The translation skill may perform web terminology research. Do so only when the
user requested terminology verification or professional translation review and
network research is permitted. Cite evidence for externally verified terms; do
not present an unsupported translation choice as verified.

## Recommended order

For an explicitly requested enhanced translation review:

1. Harper baseline for English target text, when available.
2. Source-versus-translation review, optionally through `translation-quality`.
3. Minimal grammar and accuracy corrections.
4. Requested `stop-slop`, `humanizer`, and `clean-user-facing-text` passes.
5. Final Harper check, Unicode scan, protected-span guard, and word diff.

Skip unavailable or unrequested companions without changing the order of the
remaining passes.
