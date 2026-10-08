<p align="center"><img src="assets/logo.png" width="160" alt="LinkedIn Text Styler icon"></p>

# LinkedIn Text Styler

A shareable Codex plugin for formatting LinkedIn posts, comments, headlines, and profile copy with copy-paste-safe Unicode styles.

It combines the useful formats scattered across popular LinkedIn text tools, including serif and sans bold/italic, script, Fraktur, double-struck, monospace, fullwidth, circled, parenthesized, small caps, superscript, subscript, underline, double underline, strikethrough, and list presets.

If the user specifies which parts to format and how, the plugin follows those instructions exactly. If they provide a post without formatting directions, it immediately returns three complete, paste-ready treatments with `#1 Recommended` first. Only after showing the options does it ask what they want changed.

Formatting responses contain the options and a concise action menu only. The plugin does not praise, critique, interpret, or characterize the supplied writing.

The recommended behavior is intentionally restrained: emphasize one short hook and a few existing key phrases, preserve searchable keywords, mentions, links, and hashtags as plain text, and warn about accessibility and device-rendering tradeoffs.

## Example prompts

- “Style this LinkedIn post with a bold hook.”
- “Give me script, Fraktur, and double-struck versions of this headline.”
- “Turn these lines into a LinkedIn checklist.”
- “Remove the Unicode formatting from this copy.”

## Local development

The deterministic converter is at `skills/style-linkedin-text/scripts/linkedin_text_styler.py`. It requires Python 3 and no third-party packages.

Validate before publishing:

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/style-linkedin-text
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

## Notes

LinkedIn does not receive native bold or italic formatting. These are different Unicode characters that resemble styled letters. Use them sparingly because search, screen readers, character counters, and rendering can behave differently.

## Public information

- [Product page](docs/index.html)
- [Privacy policy](docs/privacy.html)
- [Terms of use](docs/terms.html)
- [Support](docs/support.html)

LinkedIn is a trademark of LinkedIn Corporation. This independent project is not affiliated with or endorsed by LinkedIn.
