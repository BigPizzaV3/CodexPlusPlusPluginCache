# Board Recipe

Vertical 1080×1920, host on the right, board lower-left, inserts upper-left, captions at the
bottom. Adjust the geometry for 16:9 (board bottom-left, host centre-right, inserts top-left).

These coordinates are a starting sketch, not a safe-area guarantee. Before the final render,
sample the selected host at every insert/verdict anchor and move or shrink any layer that
crosses the face, product or gesture. A host swap needs this geometry check again even when
the script and word anchors stay the same. Keep reaction cards clear of both faces and captions.

## Script skeleton

```text
[verdicts]
HOST: Tea is @{tea-verdict!}D tier. || Bro has more @{leaves}leaves || than flavor.@{/leaves} || @{coffee}Coffee? @{coffee-verdict!}S@{/coffee} tier. || @{case-closed}Case closed.@{/case-closed}
```

## Board spec

```json
{"component": "tier-board", "id": "board", "canvas": {"width": 1080, "height": 1920},
 "icons": {"tea": "<accepted tea still>", "coffee": "<accepted coffee still>"},
 "x": 44, "y": 1010, "width": 470, "row_height": 96,
 "states": [{"id": "empty"}, {"id": "tea", "placed": {"D": ["tea"]}}, {"id": "both", "placed": {"D": ["tea"], "S": ["coffee"]}}]}
```

## Plan skeleton

```json
{"format": "pvx.plan@1", "canvas": {"width": 1080, "height": 1920, "fps": 24}, "base": {"takes": true},
 "layers": [
  {"type": "image", "source": "<leaves still>", "during": "leaves", "frame": {"x": 40, "y": 300, "w": 620, "h": 620}, "fade_in": 0.15},
  {"type": "image", "source": "<coffee still>", "during": {"start": "coffee.start", "end": "coffee-verdict"}, "frame": {"x": 40, "y": 300, "w": 620, "h": 620}, "fade_in": 0.15},
  {"type": "states", "frame": {"x": 0, "y": 0}, "states": [
    {"source": "gfx/board-empty.png", "until": "tea-verdict"},
    {"source": "gfx/board-tea.png", "from": "tea-verdict", "until": "coffee-verdict"},
    {"source": "gfx/board-both.png", "from": "coffee-verdict"}]},
  {"type": "captions", "style": "karaoke"},
  {"type": "text", "text": "CASE CLOSED!", "style": "stamp", "during": "case-closed", "x": "50%", "y": "20%"},
  {"type": "music", "source": "<bed>", "gain": 0.16, "fade_in": 0.3, "fade_out": 0.8},
  {"type": "sfx", "builtin": "pop", "at": "tea-verdict"},
  {"type": "sfx", "builtin": "pop", "at": "coffee-verdict"}
 ]}
```

## Commands

```bash
"${PVX}" script measure projects/<slug>/script.txt --segment verdicts --pace fast --rounding ceil
"${PVX}" timeline build --script projects/<slug>/script.txt --take verdicts=<take.mp4>@verdicts --language en --to projects/<slug>/timeline.json
"${PVX}" graphics render projects/<slug>/gfx/board.json --to projects/<slug>/gfx
"${PVX}" timeline render projects/<slug>/timeline.json --plan projects/<slug>/plan.json --to projects/<slug>/deliverables/ranking.mp4
"${PVX}" media tile projects/<slug>/deliverables/ranking.mp4 --every 1 --columns 8 --cell 240 --to projects/<slug>/evidence/grid.jpg
```

## Variations

- **Top three**: `ranked-column` with three rows revealed on three moments, terminal state on the last.
- **Two-host debate**: build takes through the podcast workflow; the board still binds to the verdict words.
- **Longer lists**: one take per subject pair; the board persists across takes because states bind to program-clock anchors.
