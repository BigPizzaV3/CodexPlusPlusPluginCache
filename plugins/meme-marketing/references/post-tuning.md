# Post tuning: learn from feedback without inventing a taste profile

Tuning changes choices for a specific creator, audience, brand and platform. It never rewrites the person's voice from a single sample and does not imply the agent remembers across sessions.

## Feedback record

For each example capture:

- id and content or a user-provided reference, plus provenance: authored, edited, third-party or unknown
- context: audience, platform, topic, dialect, brand, publish date if known
- creative: moment, mechanism, voice, form, image-text relationship, caption and visual description
- decision: accepted, rejected, revised, neutral or published
- reason in the user's own words, with any supplied before/after edit
- observed outcomes only when supplied: shares, qualified comments, saves, sends, impressions and dates

Do not scrape private chat groups or use someone else's style sample as proof of the user's voice. For third-party examples, learn principles only; no distinctive copied lines or anecdote leakage.

## Process

1. Normalize duplicate and near-duplicate examples by concept and source. Ten reposts of one meme are one example.
2. Separate explicit rules ("never use this trope for our brand") from contextual feedback ("this one is dated") and guesses about performance.
3. Attribute a rejection to the smallest supported cause: weak moment, wrong audience, forced dialect, stale template, repeated mechanism, redundant image text, brand intrusion, tone or execution.
4. Compare at least one approved and one rejected or revised example in similar contexts when available. With only positive examples, mark hypotheses as tentative.
5. Propose a compact profile with: confirmed preferences, context-specific preferences, tentative hypotheses, rejected constructions, unknowns and recent corrections. Each item links to example ids.
6. Keep output diverse. A preference for deadpan does not prohibit affectionate memes, screenshots or sincere surprise in every future context.
7. Ask for confirmation before making a tentative profile rule permanent or overwriting a reusable profile. If the user asked you to update a profile file, preserve existing data and append confirmed changes with provenance.
8. Evaluate three new ideas against the profile plus a no-profile baseline when possible. Keep results as examples and user reactions, never estimated viral probabilities.

## Small portable template

A reusable profile can be JSON with profile_version, scope, confirmed, contextual, tentative, rejected and history fields. See assets/taste-profile.json. An empty default file contains no invented preferences. File storage, remote sync and cross-session recall must be verified before claiming they happened.

## A useful rejection taxonomy

generic_situation, wrong_culture, forced_slang, fake_humanity, template_stale, humor_repeat, wording_repeat, image_repeats_caption, too_promotional, source_rights_unclear, invented_receipt, punchline_explained, low_visual_legibility, wrong_platform and other_with_user_reason.

Do not infer a cause from "مش حلوة" alone. Return two distinct repair directions and ask for the user's preferred one if the distinction matters.

## Measurement

Share-to-impression, DM sends, tags between friends, saves and high-intent replies may each matter for different aims. Compare only comparable windows and audience sizes. Reach, engagement and revenue are different outcomes. If no comparable post data is available, report creative assessments without scores or performance forecasts.
