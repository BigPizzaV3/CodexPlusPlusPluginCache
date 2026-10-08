# Graphics Components

Deterministic Pillow graphics rendered as transparent PNG states at the full canvas size, so a
plan can overlay them at `(0,0)` and switch states on script anchors. No browser runtime is
involved; icons come from accepted generated images or supplied files.

```bash
"${PVX}" graphics components                       # catalog and spec shape
"${PVX}" graphics render projects/<slug>/gfx/board.json --to projects/<slug>/gfx
```

A spec selects one component, the canvas and a list of states:

```json
{"component": "tier-board", "id": "board", "canvas": {"width": 1080, "height": 1920},
 "icons": {"tea": "assets/leaves.png", "coffee": "assets/espresso.png"},
 "x": 44, "y": 1010, "width": 470, "row_height": 96,
 "states": [{"id": "empty"}, {"id": "tea", "placed": {"D": ["tea"]}}, {"id": "both", "placed": {"D": ["tea"], "S": ["coffee"]}}]}
```

| Component | Use | Spec | State |
|---|---|---|---|
| `tier-board` | ranking rows that keep earlier verdicts while the next is argued | `tiers`, `icons`, `tier_colors`, geometry, `font` | `placed` map tier → icon keys (icons missing from the map render as text) |
| `ranked-column` | numbered list revealed rank by rank | `rows[{id, rank, label, preset}]`, geometry | `revealed` ids |
| `comment-card` | social comment with avatar, text, likes (emoji and CJK supported) | `x`, `y`, `width`, `plate_color` | `name`, `text`, `likes`, `avatar` |
| `reveal-strip` | slots revealed left to right (emoji, icon or text answers) | `slots[{text|icon}]`, `y`, `slot_size`, `gap` | `revealed` count |
| `lower-third` | name plate with subtitle | `x`, `y`, `accent_color`, `plate_color` | `name`, `subtitle` |
| `split-frame` | divider and active-speaker outline for a two-host split | `orientation`, `at`, `thickness`, `color`, `highlight_color` | `active` top/bottom/left/right |
| `highlight-box` | rounded outline over a screen region, optional dim outside | `radius`, `color`, `thickness`, `dim_outside` | `x`, `y`, `w`, `h` |
| `label` | one text plate: verdict word, sticker, title | `font_size`, `color`, `stroke`, `plate_color`, `rotate` | `text`, `x`, `y` |
| `kinetic-text` | variety-show / meme / neon / handmade lettering from a style pack (`"${PVX}" graphics styles`) | `pack`, `overrides` (size, fill, strokes, plate, rotate, jitter) | `text`, `x`, `y` (px or %), `seed`, `animate` |
| `sticker` | cut-out of a flat-background sticker image with white outline and shadow | `source`, `key_color`, `tolerance`, `outline`, `size` | `x`, `y`, `rotate`, `flip`, `animate` |
| `emoji-sticker` | large colour emoji with a die-cut border | `size`, `outline` | `text`, `x`, `y`, `rotate`, `animate` |

Each state becomes `<id>-<state>.png`. Bind states to anchors with a `states` layer, or place
a single state with an `image` layer (`./anchored-composition.md`).

## Style packs and animation

`"${PVX}" graphics styles [--family f] [--pick n --seed s]` lists the kinetic-text packs
(variety-title/shout/laugh/action/surprise, manga-burst, speech-bubble, meme-impact,
kawaii-pastel, neon-sign, newsflash, sports-broadcast, marker-note, paper-cutout, retro-vhs,
gold-luxury, clean-minimal), each with its default entrance, sound, mood tags and a prose
description. `"${PVX}" graphics sheet --to sheet.jpg --text "..."` previews them all.
CJK text switches to rounded/heavy CJK faces per language automatically.

Any state may carry `"animate": {"entrance": "pop|stamp|bounce|drop|slide-left|slide-right|slide-up|wobble|flicker|fade", "loop": "shake|pulse|sway|none", "seconds": 0.35, "loop_seconds": 0.5, "fps": 24}`.
The render then also writes `<id>-<state>-seq/f%04d.png` and `sequence.json`; bind it with a
`sequence` plan layer (entrance plays on the anchor, then the last frame holds or the loop
frames repeat). `"${PVX}" graphics animate <png> ...` does the same for any transparent PNG.

## Design rules

- Reserve space in the generated picture first: prompt the host toward one side and keep the
  board's region calm. A graphic that hides the face or the product is a composition error.
- Settle states tell the story: after a reveal the board must still read at delivery size.
- Keep palette and type consistent across components of one video; pass the same `font`.
- Chinese and mixed text use the system CJK face automatically; check glyph coverage on Linux
  (`./local-tools.md`).
- Motion is a plan choice (`fade_in`, state switches on words, `pop` text style), not baked
  into the PNG. A new state PNG is cheaper than a new generation.
