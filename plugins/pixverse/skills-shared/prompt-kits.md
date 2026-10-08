# Prompt Kits

Reusable prompt structures for the material these workflows generate most: phone-realistic
portraits, speaking takes, conversational takes, and B-roll montages. A kit is a fixed order
of blocks plus a few choice axes; fill the blocks with this project's facts and pick one value
per axis. Kits organize wording; `../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md`
and `./quality-policy.md` still govern the final prompt and parameters.

## Image kit: phone capture (Sunburst 2K/high)

Four blocks in this order, one paragraph each:

1. **Capture** — a single frame from real phone video: natural light, visible background with
   deep focus, fine natural skin texture, no oily over-processed finish, no artifacts, no text.
2. **Person** — age range, one striking distinguishing feature, hair, wardrobe with colours
   and materials, posture and attitude. For a supplied identity, describe only what the
   reference must keep; do not re-imagine a real face.
3. **Shot** — camera distance, where the person sits in the frame (leave the side and lower
   region calm when graphics will live there), eye line, props that belong to the story.
4. **Setting** — place, palette anchors, light direction, background objects that give scale.

For a complementary second view (co-host, reverse angle), start from the first image as a
reference and describe the new camera relationship, matching distance and scale, and what
naturally changes on the other side of the room. For a product, describe shape, label, working
parts and scale; never invent features.

## Video kit: speaking take (Seedance 2.5, 1080p)

Blocks: reference roles → exact dialogue → composition stability → camera motion → edit
rhythm → performance → gesture → sound. Axes:

| Axis | Values |
|---|---|
| composition stability | `flexible` (lively creator framing) · `soft-locked` (same region, natural posture breathing) · `strict-locked` (placement, orientation and background relationship preserved) |
| camera motion | `none` · `subtle punch-in and return on the key phrase` · `slow drift` |
| edit rhythm | `continuous take` · `pause-trim jump cuts at phrase boundaries` |
| performance | `natural explainer` · `dry confident sass` · `warm intimate` · `hype` · `calm ASMR` |
| gesture | `natural` · `minimal` · `one deliberate gesture per beat` |

Always: "speaks these exact words and no other speech", the words themselves from the script's
`dialogue` projection, and "no captions, on-screen text or music" unless wanted. Give beats
contiguous time ranges that cover the request duration; leave room for a natural landing.

## Video kit: two-host conversation

Add: who is Host A and Host B with their image and voice reference indexes; "only the current
speaker speaks, the listener reacts silently" (a glance, a posture shift, a nod); where the cut
between views happens and what crosses it (a handed-over prop stays in the receiving hand);
whose view returns at the end.

## Video kit: B-roll montage (silent)

Order the scenes by their reference index, give each a readable action and internal
continuity, cut cleanly between scenes, keep identity and outfit faithful to each reference,
ordinary real-time motion, no sound. Use it for lifestyle coverage that a performance's voice
continues over.

## Voice consistency

Generate one short TTS reference line per recurring speaker (`create voice`), then pass it as
an `--audios` reference on every Seedance take of that speaker together with their image.
Write the intended delivery in the prompt; a voice reference conditions timbre, it does not
guarantee identical reproduction. Keep reference audio short and clean.
