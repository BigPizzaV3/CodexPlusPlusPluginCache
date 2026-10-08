# Language Notes

| Language | Alignment | Caption grouping | Typography |
|---|---|---|---|
| English, Spanish, German, French | word units | 3–6 words per cue, break at clauses | Arial Black / Helvetica; German words are long, lower `--size` |
| Chinese (zh) | one unit per character | 6–12 characters by meaning, no spaces; `<compound\|>` dual text groups a compound word for karaoke | PingFang SC / Noto Sans CJK; avoid all-caps styles |
| Japanese (ja) | one unit per kana/kanji | short bunsetsu groups, particles attached | Hiragino / Noto Sans CJK JP |
| Korean (ko) | one unit per syllable block | eojeol (space-separated) groups, 2–5 per cue | Apple SD Gothic / Noto Sans CJK KR |

## Timing

- Expect Spanish to run 15–25% longer than English and Chinese to run shorter; re-measure and
  re-choose durations per language instead of forcing the English take length.
- Keep anchor names identical across languages; only the words inside change.
- A joke that depends on an English pun gets a new joke with the same job at the same anchor.

## Voice

Pick a target-language preset from `pixverse voice presets --model <id> --json` and generate
the reference line in that language. Pass `--language` on `create voice`. Keep register
(formal/informal) consistent with the original's relationship to the audience.

## Captions

Karaoke highlighting works per unit: in Chinese it highlights characters, so prefer the
`bold` or `clean` style unless the reference visibly uses per-character emphasis. Check the
longest cue at delivery size; shorten cues before shrinking the font below readability.
