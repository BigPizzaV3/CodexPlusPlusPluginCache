# Output and validator contract

Normal chat outputs are concise, ready to use meme briefs in the requested language. Use JSON only when the user or an automated downstream tool requests it. In chat, omit internal test fields unless explicitly asked.

For JSON, use an object with skill set to meme-marketing, a memes array and optional batch_notes. Each meme contains the fields below. A field marked optional may be null or omitted; if there is no text in the picture, on_image_text is the empty string and image_text_relation is none or text_free.

Required:
- audience: object with role, context, market and send_to strings
- moment, emotion, humor_mechanism, form, image_text_relation and caption strings
- on_image_text string (may be empty for text-free visual)
- visual: object with primary, fallback, source, description and freshness
- design: object with ratio, text_position, palette and logo (placement and variant)
- brand_role: none, prop, character or product_forward
- evidence: object with provenance and receipt strings; optional source URL
- alternatives: array of other feasible visual directions
- risk_notes: array of strings

source is one of original, licensed, user_supplied or unverified_reference; do not pass an unverified reference as a finished production asset. provenance is observed, brief_supplied, researched or illustrative. freshness has status evergreen, verified_recent or unknown, plus verified_at ISO date only if verification actually happened.

Accepted form identifiers:
reaction_still, original_scene, template, screenshot, staged_chat, ui_mock, object_label, comparison, multi_panel, text_led, video or visual_only

Accepted image-text relationships:
reaction, dialogue, understatement, literalization, labeling, contrast, delayed_reveal, intentional_echo, none or text_free

The stdlib validator checks shape, allowed values, text-free consistency, repeated caption, URLs/hashtags/CTAs inside image text, optional real freshness dates and absent visual fallbacks. Its passing result is a structural check only; it cannot know whether a scene is funny or lawful to publish.

Example use from the repository root: python .claude/skills/meme-marketing/scripts/validate.py path/to/batch.json

Human review still checks original image rights, dialect and cultural familiarity, correct product portrayal, audience dignity, visual readability and distinct comedy mechanisms.
