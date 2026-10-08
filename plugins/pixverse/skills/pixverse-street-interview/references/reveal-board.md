# Reveal Board

## Strip component

```json
{"component": "reveal-strip", "id": "rules", "canvas": {"width": 1080, "height": 1920},
 "y": 140, "slot_size": 150, "gap": 24,
 "slots": [{"text": "<emoji-1>"}, {"text": "<emoji-2>"}, {"text": "<emoji-3>"}],
 "states": [{"id": "0", "revealed": 0}, {"id": "1", "revealed": 1}, {"id": "2", "revealed": 2}, {"id": "3", "revealed": 3}]}
```

Slots can be emoji, short words or icons cropped from accepted stills. Keep the strip at the
top so captions and the guest stay clear. Bind states to the answer moments:

```json
{"type": "states", "frame": {"x": 0, "y": 0}, "states": [
  {"source": "gfx/rules-0.png", "until": "rule-one"},
  {"source": "gfx/rules-1.png", "from": "rule-one", "until": "rule-two"},
  {"source": "gfx/rules-2.png", "from": "rule-two", "until": "rule-three"},
  {"source": "gfx/rules-3.png", "from": "rule-three"}]}
```

Add `{"type": "sfx", "builtin": "ding", "at": "rule-one"}` per reveal, and a brief colour
flash with a `label` plate if the reference uses one.

## Reaction and coverage timing

- Cut to the interviewer's reaction during the guest's explanation selection, and return at
  least half a second before the next answer word so the reveal lands on the guest.
- The environment insert (the car, the shop, the trophy) covers the motivating line near the
  start and is not repeated.
- Keep the last answer's settled strip visible through the closing line.

## Caption treatment

Speaker colours through `role_colors`; the karaoke highlight isolates the answer word because
the script gives it its own cue. For a reference that tracks captions near the speaker's head,
use a fixed per-speaker `margin_v`/position rather than face tracking, and say so.
