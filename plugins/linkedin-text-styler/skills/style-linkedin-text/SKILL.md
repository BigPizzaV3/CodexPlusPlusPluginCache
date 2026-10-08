---
name: style-linkedin-text
description: Style, format, or clean LinkedIn posts, comments, profile headlines, About sections, and company-page copy using copy-paste-safe Unicode emphasis, decorative alphabets, bullets, checklists, and numbered lists. Use when the user asks for LinkedIn bold, italics, underline, strikethrough, special fonts, a text formatter, a styled post, Unicode conversion, formatting removal, or variants to compare before posting.
---

# Style LinkedIn Text

Preserve the user's wording unless they also ask for editing. Treat every whitespace character as immutable source content. Produce copy-ready text; never post it without explicit approval.

## Whitespace invariant

- Never add, remove, collapse, trim, or normalize spaces, tabs, blank lines, or line breaks.
- Never reflow lines or insert a blank line between adjacent input lines. If the source has one newline, the corresponding output has one newline—not two.
- Preserve leading and trailing whitespace and the source's final-newline state.
- After styling, remove supported styling and compare the result with the original character for character. Return nothing that fails this check.

## Workflow

1. Identify the destination: post, comment, headline, About section, or company page.
2. Produce useful output on the first response:
   - If the user named exact spans, structural elements, or styles, follow those instructions exactly and do not ask again.
   - If the user supplied text without formatting instructions, immediately return three complete treatments: `#1 Recommended`, a lighter option, and a more-emphasized option. Do not ask a question before showing them.
   - After the treatments, ask whether they want changes and offer concrete formatting actions.
3. For recommended selective emphasis, use the restrained preset:
   - bold sans for one short hook or heading;
   - plain Unicode text for the body, keywords, hashtags, handles, links, and accessibility-critical content;
   - bullets only when they improve scanning.
4. Run `scripts/linkedin_text_styler.py` for deterministic conversion. Never manually invent a mapping.
5. Verify each output with `--verify-original` and require exact equality with the original input, including wording, capitalization, punctuation, whitespace, line breaks, emoji, hashtags, mentions, and links. Do not return a version that fails.
6. Return each treatment as the complete post in its own plain text code block so every option can be copied and pasted without assembly. Put `#1 Recommended` first when showing multiple treatments.
7. End with the post-formatting question specified below. Do not add commentary about the quality, tone, humor, punchline, voice, or meaning of the user's writing.

## Commands

Run from this skill directory:

```bash
python3 scripts/linkedin_text_styler.py --list-styles
python3 scripts/linkedin_text_styler.py --style sans-bold --text 'A short hook'
printf '%s' 'A short hook' | python3 scripts/linkedin_text_styler.py --style sans-bold
python3 scripts/linkedin_text_styler.py --markup --text '**Bold** *italic* __underline__ ~~strike~~ `mono`'
python3 scripts/linkedin_text_styler.py --unstyled --text '𝗦𝘁𝘆𝗹𝗲𝗱'
printf '%s' '𝗦𝘁𝘆𝗹𝗲𝗱' | python3 scripts/linkedin_text_styler.py --verify-original 'Styled'
python3 scripts/linkedin_text_styler.py --list bullet --text $'First\nSecond'
```

For mixed formatting, convert each requested span separately and assemble it without altering surrounding plain text. `--markup` supports non-nested markers and is convenient when the input is unambiguous.

Read `references/style-catalog.md` when choosing among decorative styles or explaining coverage. Read `references/linkedin-guidance.md` when advising on accessibility, search, character limits, or placement.

## Output rules

- Obey user-specified formatting spans and styles without changing any other characters.
- When multiple options are requested, show the full post for every option, not only the altered fragment. Label each option by treatment and put `#1 Recommended` first.
- Keep the number of options useful rather than exhaustive by default; show the full catalog only when requested.
- Start directly with `#1 Recommended`. Do not preface the options with analysis, praise, explanation, or a question.
- After all options, ask: `Any changes? I can:` followed by a short menu such as `bold different parts`, `change a style`, `make the formatting lighter or stronger`, or `put your chosen version into the LinkedIn composer` when browser control is available.
- Keep labels factual and short, such as `Bold hook`, `Lighter`, or `More emphasis`.
- Never evaluate or characterize the supplied writing. Do not say that a treatment preserves, improves, sharpens, strengthens, or keeps intact the user's tone, voice, humor, punchline, message, or intent.
- Do not include process notes, memory notes, or unrelated status language in the formatting response.
- Keep hashtags, @mentions, URLs, names that must be searchable, and important keywords plain.
- Do not claim these are fonts or native rich-text formatting; they are Unicode look-alike characters and combining marks.
- Preserve unsupported characters, emoji, punctuation, line breaks, and non-Latin scripts unchanged.
- Preserve the exact number of line breaks. Do not add visual breathing room or blank lines that were not present in the source.
- Mention that rendering can vary when using decorative styles, combining underline/strike, or rare characters.
- If the user asks to publish, share, or post, stop at a draft until they approve the exact final copy.
- When operating an open LinkedIn composer, preserve @mentions as plain, untouched spans. Filling or replacing the draft is allowed only after the user chooses a treatment; clicking `Post` requires separate explicit approval.

## Required first-response shape

```text
#1 Recommended — [short factual treatment label]

[complete paste-ready post]

#2 [short factual treatment label]

[complete paste-ready post]

#3 [short factual treatment label]

[complete paste-ready post]

Any changes? I can:
- bold different parts
- change a style
- make the formatting lighter or stronger
- put your chosen version into the LinkedIn composer
```

Omit the composer action when browser control is unavailable. When the user gave exact formatting instructions, return one complete treatment unless they asked for alternatives, then ask the same follow-up question.
