---
name: pixverse-podcast-clip
description: "Podcast clip: a two-host conversation with complementary camera views, split-screen opening, speaker-coloured captions, reactions, product handoffs and lifestyle B-roll that continues under the voice."
---

# Podcast Clip

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

Two people talk; the picture moves between their complementary views, a split-screen opening
and B-roll that covers a claim while the voice continues. Speaker identity is carried by
captions colour, seat side and voice, so the audience always knows who is talking.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Cast And Geometry

Establish the two hosts, their relationship (recommender and skeptic, expert and newcomer),
the seat sides and the shared place. The first host image defines the room and capture
language; the second is generated from it as the complementary view (opposite side, matching
distance and scale, its own background details). A supplied person is the identity reference
for their seat. Use the phone-capture kit in `../../skills-shared/prompt-kits.md`; read
`./references/conversation.md` for the view relationships and the handoff of a prop across a cut.

Give each host a short TTS voice reference (`create voice`, distinct presets) and pass it with
that host's image on every take, so the voice stays the same across the clip.

## Write The Exchange

Script with `../../skills-shared/semantic-script.md`: `HOST:` and `GUEST:` turns, cue breaks
by breath, a selection around the passage a lifestyle montage should cover (start it a beat
before the reply so the picture returns as a J-cut), a moment on the product reveal or the
punchline. Measure each segment; conversational takes of 5–8 seconds keep the exchange alive.

## Generate Takes

Compose Seedance 2.5 reference takes through the gateway with both host images and both
voice references, the two-host conversation kit, the segment's dialogue projection and the
listener's silent reactions. One take per segment; the split opening is its own short take
built from a generated split image. Lifestyle B-roll is one silent multi-scene reference
clip from three lifestyle stills of the same host, or separate stills.

## Compose

Align every take (`../../skills-shared/word-timing.md`), then render with a plan
(`../../skills-shared/anchored-composition.md`): `captions` with `role_colors` per host,
the montage as a `video` layer on its selection with `mute: true`, a `split-frame` state
that outlines the active speaker if the layout stays split, a lower-third on the first
appearance, a product reveal `label` or sticker on its moment, music bed under the voice.
Check the handoffs: the montage leaves before the next line lands, the prop is in the right
hand after the cut, and the caption colour matches the speaker.

Deliver the clip and the editable project. New topics, products or hosts are variants
(`../pixverse-video-variants/SKILL.md`).

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
