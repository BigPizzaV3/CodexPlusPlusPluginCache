# Restyle Routes

Verify the offline contract before composing: `"${PVX}" pixverse capabilities create
reference --model seedance-2.5 --json`, `... create motion-control --json`,
`... create modify --model v5.5 --json`.

| Need | Route | Keeps | Does not keep |
|---|---|---|---|
| New look, world, wardrobe, medium on the same footage | Seedance 2.5 `create reference --task-type edit --videos <source> --duration auto --aspect-ratio auto` | motion, cuts, framing, timing (model-dependent) | exact audio (restore at export), pixel-exact untargeted areas |
| Same performance, different person | same edit route with the person reference in `--images`, prompt replaces every appearance | motion, cuts, timing | original face; speech reuse if lips change |
| Motion onto a new character | `create motion-control --image <character> --video <motion>` | motion path | scene, voice, edit |
| Small localized change at a frame | `create modify --video <source> --prompt ... --keyframe-time <ms>` (v5.5, ≤720p) | most pixels | resolution above 720p |
| Colour, crop, speed, letterbox, titles | FFmpeg through the editing workflow | everything | nothing generative |

## Prompt shape for an edit

1. Reference declarations: "Video 1 is the source. Image 1 is the wardrobe reference."
2. Preservation block: every movement, gesture, gaze, camera move, cut and its timing; all
   untargeted captions, labels, UI and props; the full duration.
3. The single change, stated as a rendering instruction: "render the entire clip as stop-motion
   claymation with visible fingerprints and 12 fps stepping" or "replace only the jacket with
   the denim jacket from Image 1 under the same light".
4. Continuity: identity, geometry, exposure, motion direction unchanged.

Keep one change per output. Two changes are two outputs or one explicitly combined change.

## Checks that catch the usual failures

- Duration within 0.25 s of the source; otherwise the model re-timed the performance.
- Cut count equal (compare `media boundaries` on both at the same threshold).
- Hands and props at the same frame positions on three sampled beats.
- Text overlays unchanged where untargeted.
- Audio: restored original track aligned within 0.1 s, or an explicit new soundtrack.
