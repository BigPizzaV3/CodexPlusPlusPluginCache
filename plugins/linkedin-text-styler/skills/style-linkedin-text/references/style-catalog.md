# Style catalog

Use `python3 scripts/linkedin_text_styler.py --list-styles` as the authoritative machine-readable list.

## Emphasis and alphabets

- `serif-bold`, `serif-italic`, `serif-bold-italic`
- `sans`, `sans-bold`, `sans-italic`, `sans-bold-italic`
- `script`, `script-bold`
- `fraktur`, `fraktur-bold`
- `double-struck`
- `monospace`
- `fullwidth`
- `circled`, `parenthesized`
- `small-caps`
- `superscript`, `subscript`

## Decorations

- `underline` uses combining low line.
- `double-underline` uses combining double low line.
- `strikethrough` uses combining long stroke overlay.
- `slash` uses combining short solidus overlay.
- Combined styles: `sans-bold-underline`, `sans-bold-strikethrough`.

Combining marks can render inconsistently. Prefer alphabet styles for a hook and decorations only for short deliberate effects.

## Structural presets

`--list` supports `bullet`, `arrow`, `check`, `number`, `ascending`, and `descending`. It treats each non-empty input line as one item and preserves blank lines.

## Coverage behavior

Mathematical alphabets contain irregular legacy code points. The converter includes those exceptions rather than assuming every alphabet is a contiguous range. Styles convert the characters they support and preserve everything else. `--unstyled` reverses characters emitted by the converter and removes its supported combining decorations.
