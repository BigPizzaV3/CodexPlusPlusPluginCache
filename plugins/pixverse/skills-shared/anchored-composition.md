# Anchored Composition

Compose captions, inserts, boards, stickers, titles, music and sound effects onto generated
takes in one FFmpeg render, with every event bound to a script anchor instead of a second.
Inputs: a `pvx.timeline@1` document (`./word-timing.md`) and a plan JSON.

Use absolute paths for every media source, caption source and graphic state in saved plans
and takes. Relative paths currently resolve against the command's working directory, not
the JSON file's directory. Keep reusable files under the project, never a temporary folder.

```bash
"${PVX}" timeline captions projects/<slug>/timeline.json --to projects/<slug>/captions.ass --style karaoke
"${PVX}" timeline render projects/<slug>/timeline.json --plan projects/<slug>/plan.json --to projects/<slug>/deliverables/final.mp4
"${PVX}" timeline render ... --dry-run     # prints the FFmpeg command without rendering
```

## Plan format (`pvx.plan@1`)

```json
{
  "format": "pvx.plan@1",
  "canvas": {"width": 1080, "height": 1920, "fps": 24},
  "base": {"takes": true},
  "layers": [
    {"type": "image", "source": "assets/broll-leaves.png", "during": "leaves",
     "frame": {"x": 40, "y": 300, "w": 620, "h": 620}, "fade_in": 0.15},
    {"type": "video", "source": "assets/montage.mp4", "during": {"start": "lifestyle.start", "end": "lifestyle.end"},
     "frame": {"x": 0, "y": 0, "w": "100%", "h": "100%"}, "mute": true},
    {"type": "states", "frame": {"x": 0, "y": 0}, "states": [
      {"source": "gfx/board-empty.png", "until": "tea-verdict"},
      {"source": "gfx/board-tea.png", "from": "tea-verdict", "until": "coffee-verdict"},
      {"source": "gfx/board-both.png", "from": "coffee-verdict"}]},
    {"type": "captions", "style": "karaoke", "role_colors": {"GUEST": "#FFE060"}},
    {"type": "text", "text": "CASE CLOSED!", "style": "stamp", "during": "case-closed", "x": "50%", "y": "20%"},
    {"type": "music", "source": "assets/bed.mp3", "gain": 0.16, "fade_in": 0.3, "fade_out": 0.8},
    {"type": "sfx", "builtin": "pop", "at": "tea-verdict"},
    {"type": "sfx", "source": "assets/whoosh.wav", "at": "reveal", "gain": 0.8}
  ]
}
```

| Field | Meaning |
|---|---|
| `base` | `{"takes": true}` concatenates the timeline's takes (gaps and audio-only takes use black picture); `{"media": path}` uses one file; `{"color": "#000000"}` renders pure graphics for `duration`. `mute`/`gain` control base audio. |
| Time refs | An anchor name (`leaves`, `tea-verdict`, `segment:hook`, `program`), a number of seconds, `word:<index>`, `phrase:<index>`, `take:<id>`, or `{"start": "leaves.end", "end": "coffee.start", "offset": 0.1}` / `{"start": ..., "for": 1.5}`; `start_offset`/`end_offset` shift one edge only. |
| `image` / `video` | `during` window or `at` + `for`; `frame` in px or `%`; `fit` `cover`/`contain`; `fade_in`/`fade_out`/`opacity`; video plays from its own start when the window opens; `mute: false` mixes its sound. |
| `states` | Ordered PNG states of one graphic (see `./graphics-components.md`); `from`/`until` anchors; a missing `from` continues from the previous state. `sfx` plays on every state change. |
| `sequence` | A PNG sequence directory (from `animate` or `graphics animate`); `during`/`at`+`for`; `loop: true` repeats the loop frames after the entrance, otherwise the last frame holds; `fps`/`frames` override `sequence.json`; `sfx` plays on entry. |
| `jitter` | On `image`, `states` or `sequence`: pixels of per-frame position noise (an excited or angry hold); `jitter_seed` for repeatability. |
| `sfx` on a picture layer | Shortcut for a `sfx` layer at the same start: `"sfx": "boing"` (builtin) plus optional `sfx_gain`. |
| `captions` | Styles `karaoke` (phrase up, active word highlighted), `bold`, `clean`, `ugc`, `pop` (one word at a time); `role_colors`, `font`, `size`, `margin_v`, `hold`; or `source` for a prepared ASS. |
| `text` | Styles `stamp`, `title`, `verdict`, `note`; `x`/`y` position; `fade`. Rendered through the same ASS as captions. |
| `music` / `audio` | `gain`, `fade_in`, `fade_out`, `loop`, `during`. |
| `sfx` | `builtin` `pop`/`ding`/`thud`/`whoosh`/`click`/`boing`/`tada`/`sparkle`/`bubble`/`swoosh`/`hit`/`tap`/`buzz`/`drumroll` (synthesized) or `source`; `at` anchor; `gain`. |

The render writes `ffmpeg-command.txt` and `overlay.ass` next to the output for revision.
Picture layers are painted in order. Captions and text are composited above all picture
layers, with text above captions; keep their regions separate. Use at most one caption layer.

## Review the picture

After rendering, sample the handoffs, not just the middle:

```bash
"${PVX}" media tile projects/<slug>/deliverables/final.mp4 --every 1 --columns 8 --cell 240 --to projects/<slug>/evidence/final-grid.jpg
"${PVX}" media frames projects/<slug>/deliverables/final.mp4 --at 2.2,5.3,7.1 --label-time --to projects/<slug>/evidence/frames
```

Check that a board changes on its word, a cover picture leaves before the next claim, the
caption is readable over the picture, the stamp does not cover a face, and the music yields to
speech. Fix the plan or the script, then re-render; accepted takes are never regenerated.
