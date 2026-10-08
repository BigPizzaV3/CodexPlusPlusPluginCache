# UGC Production Rules

Use this with the selected product, creator, try-on, unboxing, or tutorial recipe.
Read that recipe first: its slot count, opening state, audio and caption rules differ.
Website UGC has its own continuous-host/screenshot workflow; do not give it these boards.
An explicit user shot list, language, tone or text choice overrides recipe defaults.

## Lock Inputs Once

Keep a compact production record: requested duration and framing; language and exact
script; product reference and provider path; canonical visual/mechanical description;
known visible sides; creator reference when required; board order; each prop's state;
selected tone; approved claims; optional text and deliverables. Reuse accepted assets.

Normalize a product from its image or actual product page once. Describe shape, material,
color, hand-relative scale, opening/usage mechanism, visible labels, absent features and
an observed ordinary imperfection. Never invent dimensions, price, efficacy or an unseen
component. Preserve real label text from a supplied photo; do not replace it with generic
branding or call it unreadable by default. For a description-only concept, identify that
status. A blocked real product source is an input gap, not permission to substitute stock.
When claims are supplied as an allowlist, reuse those exact strings; no strengthening,
combining or deriving extra claims. Observable details supply specificity without claims.

For creator-led modes, use one accepted identity for every board and clip. An attached
identity does not need a replacement character generation. A new character reference is
product-free unless the recipe specifically needs a held product; record face, hair,
wardrobe and environment before dependent work. Respect an already authorized likeness
and the user's actual context; never fabricate a customer's real experience. Product-only
mode has no hero identity: auxiliary people stay cropped, silent and secondary.

## Duration And Sequential Boards

These UGC recipes use 4–15 second clips. For longer requested work let N=ceil(D/15),
fill earlier clips to 15 seconds, then borrow from the preceding clip if the final
remainder is under 4 seconds. Examples: 16 → 12+4; 18 → 14+4; 30 → 15+15;
31 → 15+12+4; 46 → 15+15+12+4. Preserve total duration exactly. A <4s or exact
director constraint requires an explicit adapted plan; do not silently lengthen it.
Do not exploit a model's larger maximum duration to collapse this shot structure.

Each board has the selected recipe's 4 or 8 active portrait slots, in one horizontal
row, thin gutters, no empty panels. Use 21:9 for the board canvas. Eight exact 9:16
panels cannot fill a 21:9 sheet without unused vertical area: contain the row without
stretching, permit plain outer space, and inspect the actual geometry. Never silently
switch to two rows or claim mathematically incompatible dimensions all fill the canvas.
Tutorial step headings are the only default generated text exception.

Write the whole sequence, then make board K from product + creator (when required)
+ the cleaned previous board for K>1. Declare Image indices in that exact order.
Productless creator work omits and renumbers the product input. Generate boards in
sequence; board K+1 uses the accepted cleaned K. Each panel must visibly encode a
different event, prop state, distance or viewpoint. A row of almost identical poses
encourages morphing instead of cuts. Keep all required steps and target features visible.

## Required Board Refinement

For these named UGC recipes, every generated board gets one image-to-image realism
refinement before video. This is a required control stage, not an optional polish
suggestion. It also applies to a newly generated website creator seed under that recipe;
an existing user portrait is reused without this pass.

Both the base and refinement use `gpt-image-2.5-sunburst`, `--quality 1440p`,
`--detail-level high`. Bind the raw board's provider image path as the refinement's
image reference and keep its aspect. Verify the supported image-edit inputs and count
the refinement in the paid plan. Preserve the specialized refinement objective while
using the same image model throughout; apply `./quality-policy.md` for membership.

The refinement prompt must say, concretely:

> Preserve the entire sheet's framing, panel count and order, camera distances, poses,
> identity, face proportions, body, clothing, product structure and all existing required
> text. Do not crop, reframe, relayout, zoom, narrow faces or change the scene. Change
> only photographic microtexture: natural pores and fine facial hair, material detail,
> even daylight with gentle highlight roll-off, faint sensor noise and deep-focus phone
> capture. Remove waxy smoothing, oversaturation, HDR halos, oversharpening, cinematic
> grading and artificial bokeh. Add no text, logo or watermark; preserve a supplied
> product's real branding rather than erasing it. In productless work, introduce no
> product, package or sales prop. For tutorial boards, preserve every exact step heading.

If refinement fails, preserve the successful raw board and report the actual failure.
Resolve the input or service issue before another attempt on the same image route;
do not switch image families automatically. Re-preflight any new paid attempt and
follow existing authorization. An unfinished refinement remains unfinished.

## Write The Motion, Not A Caption For The Board

Read [prompt budgets](./prompt-budgets.md) before submission. Keep the complete board
and shot plan in the project, then write a route-sized executable prompt: share identity,
look and global constraints once, while retaining every numbered slot, fractional time,
hand assignment, action mechanism and exact spoken line. A character limit never permits
reducing eight shots to one, omitting a macro, skipping refinement or flattening the story.

One video prompt per board, with all prompts ready before the video batch. Use this
order: `Style & Mood`, `Narrative Summary`, `Dynamic Description`, numbered `Cut`
sections with cumulative time ranges, `Static Description`, `Audio`, optional requested
`Music`, and continuity/quality constraints. An explicitly requested persona may precede
the structure. Plain prompt text contains creative instructions; keep CLI flags and asset
IDs outside it. Declare actual reference roles without inventing a missing board ID.

Each cut must provide:

- Framing distance and camera POV, consistent with its panel; a different main event
  from adjacent cuts. Describe changes inside the shot rather than re-listing its props.
- One achievable main interaction, normally at most one product state change. Explain
  cause before effect and exact mechanism; removal happens before dispensing or use.
- Four to ten useful sentences with at least five concrete micro-observations of body,
  expression, contact, material or mechanism, integrated into the main action. These are
  not five large stunts. Sequence movements, name body parts/objects, and keep the main
  action readable. Hand-free macros obey their more specific single passive-motion rule.
- An explicit role for each hand: one active task plus one parked hand, or both serving
  a single two-hand action. Selfie reserves one hand for the unseen camera. Heavy objects
  need two-hand support and credible effort; bulky light objects need support without
  strain; small light objects use a relaxed grip; tiny objects can use a careful pinch.
- A real-time performance and exact words or VO allocation. Do not add a slow push,
  languid gestures, drawn-out vowels or long closing holds as generic quality language.

Static means an immobile camera, not an immobile person. Write weight transfers, posture
changes, turns, breaths, mouth movement and product response inside that fixed frame.
Keep handheld/shake/drift/wobble language out of static cut descriptions. For selfie,
the camera is the creator's viewpoint: the device/screen is out of frame, never a shot
of the creator looking at their phone. No mirror or reflected duplicate body.

Write `Hard cut to.` between neighboring sections (7 markers for an ordinary 8-cut
board; 3 for a 4-cut board), never after the last. A recipe's explicit Pick-Up/Set-Down
exception replaces only its named boundary. Never use a continuous move across an
implicit outfit or package state jump. Do not invent camera movement in every shot.

## Voice And Human Timing

Default to English only when the user's project language is unspecified. Target
12–20 spoken English words at ≤10s, 20–28 at 11–12s and 28–35 at 13–15s; estimate
Chinese and other unspaced languages by their actual spoken duration, not whitespace
tokens. These are planning estimates, not measured speech. Website UGC has its own
higher density. Split exact copy at phrase boundaries, never pad with filler to hit a
count. Distribute words where the chosen recipe allows VO rather than overloading lips.

Start the creator's first word or a short natural nonverbal sound within 0–0.4s, already
in the event. A deliberately staged freeze hook can delay to at most 0.7s. Product-only
INTRO can establish the object with environmental movement and immediate VO, without
prematurely performing its demo. A user-requested quiet version starts with a named
meaningful sound. No generic greeting or recording warm-up. Later boards continue
mid-thought; do not reintroduce the person/product at every 15-second boundary.

Natural engaged delivery is the default. Hype, sustained calm, a regional accent, a
physical quirk or a cinematic treatment require a brief signal; do not infer accent
from appearance. Keep a chosen performance persona consistent. Stage one or two
product-motivated reaction peaks at most, each with one body event. Include one small
unguarded recovery and, where the chosen creator recipe calls for it, one restrained
playful beat, outside the peak; omit these when they violate the requested sustained
tone. Product-only uses mechanism/environmental changes instead of face reactions.
Give the densest visible speech at least one brief closed-mouth recovery between phrases.

Native Seedance speech/VO is the voice source for these recipes. Do not activate a
separate narrator or paste unrelated TTS over visible lips. Use `create reference`
with clean board, creator, product in that order (omit inapplicable roles). Current
Seedance 2.5 CLI has no audio toggle; express native sound in the prompt and preserve
the audio requirement without inventing `--audio`. Product-only uses board + product.
Apply Seedance prompt enhancement without replacing this recipe's cut timing/structure.

No music by default. Add named ambience/foley to the Audio section when its action is
visible; an unmentioned click may render mute. Keep voice continuous through allowed
camera transitions. Keep approved dialogue intact, remove empty praise and repeated
ideas, and never turn a supplied example into evidence of product performance.

## Finish The Requested Film

Expose each usable local preview immediately. These specialized workflows also require
their specific frame/audio checks: inspect evenly spaced frames, every detail shot,
and 2–3 mid-word frames where speech is visible; check product count, hand count,
mechanism/state, scale, identity, lip artifacts, branding and required/forbidden text.
Check the actual speech when an ASR/listening route exists. State unchecked aspects;
non-silent AAC or a valid MP4 alone is not successful creative QA.

Use accepted clips in stable story order. Concat compatible sources without re-encoding;
normalize differing formats only when needed. Word-timed optional captions/hook text
come from actual final audio. Default to no extra text when unspecified, except the
tutorial's step headings and website workflow's default captions. A requested post
package stays separate from the video. Preserve a clean master and deliver actual files.

Repair only the affected clip, text layer or dependency. Changing exact dialogue,
regenerating a board, retries and variants are paid work governed by
`./cli-workflow.md`. No new approval mechanism and no hidden extra batch.
