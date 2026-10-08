# Semantic Script

Use one script file as the single source of what is said. Caption text, the performance
prompt, duration estimates and every word-anchored graphic all read from it. Timing is
never written into the script: it is measured from the actual performance later
(`./word-timing.md`), so a rewrite, a new host or a new language moves every layer with it.

## Syntax

```text
# comments start with a hash
[hook]                                   <- segment id; one performance take usually covers one segment
HOST: Tea is @{tea-verdict!}D tier. || Bro has more @{leaves}leaves || than flavor.@{/leaves}
GUEST: <API|A P I> is fine. || @{reveal}Case closed.@{/reveal}
```

| Form | Meaning |
|---|---|
| `[name]` on its own line | Start a segment. Ids match `[a-z][a-z0-9_-]*`; default is `main`. |
| `ROLE:` at line start | Speaker turn. The label routes dialogue and caption colours; it selects no voice by itself. |
| `\|\|` | Caption cue break between complete reading units. Choose by meaning and breath, not character count. |
| `<shown\|said>` | Display text and pronunciation differ: `<2012\|twenty twelve>`, `<CSS\|see ess ess>`. |
| `<shown\|>` | Same words, grouped as one caption unit (`<New York\|>`). |
| `<\|said>` | Spoken but not captioned; keeps timing anchors. |
| `@{name}` … `@{/name}` | Selection: a named range from the next word's start to the previous word's end. |
| `@{~name}` / `@{/name~}` | Open at the previous word's end / close at the next word's start (give the pause to the other side). |
| `@{name!}` / `@{~name!}` | Moment at the next word's start / the previous word's end. |
| `word{emphasis,size=2}` | Attributes on the preceding display word for a caption style to interpret. |

Markers may be glued to words (`flavor.@{/leaves}`). Selections may overlap or cross
turns. Names are unique across selections and moments. Chinese and Japanese prose needs no
spaces; each character becomes one timing unit, while `||` still decides the reading phrase.

## Commands

```bash
"${PVX}" script parse projects/<slug>/script.txt            # words, phrases, anchors, dialogue projection
"${PVX}" script parse projects/<slug>/script.txt --to projects/<slug>/script.json
"${PVX}" script measure projects/<slug>/script.txt --segment hook --pace normal --rounding ceil
"${PVX}" script measure --text "Tea is D tier. || Case closed." --language en --pace fast
```

`parse` prints `display_text` (captions), `spoken_text` (pronunciation), and `dialogue`
(`ROLE: line` per turn, ready to paste into a performance prompt). `measure` estimates
seconds from pronunciation units (English syllables, one unit per CJK character), pace
(`slow`/`normal`/`fast`), cue-break pauses and role turns. It is an estimate for a natural
read; generated performances add expressive pauses, so choose the request duration from the
estimate, the intended performance and the model's supported values, then measure the
returned take.

## Write for the performance

- Put the exact spoken line in the video prompt from `dialogue`; keep the role labels when a
  take has two speakers so the model knows who says what.
- Use `<shown|said>` for numbers, initialisms and coined names so captions stay clean while
  the performance pronounces them correctly.
- One segment per take keeps alignment simple. A long script splits into segments that each
  fit one supported request duration; measure each segment.
- Name anchors by what they mean (`proof`, `price-reveal`, `punchline`), not by seconds.
