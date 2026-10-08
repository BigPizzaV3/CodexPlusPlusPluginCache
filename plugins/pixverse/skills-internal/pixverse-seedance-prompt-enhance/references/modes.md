# Mode-Specific Prompt Decisions

Use only the relevant section. Source: [BytePlus Seedance 2.5 guide](https://docs.byteplus.com/en/docs/ModelArk/2607689).
These are agent writing patterns, not generated-media guarantees.

## Text To Video

Supply the scene information that no image provides. Keep a short request proportionate.

Original 8-second example: “An observational documentary shot of a red fox crossing a
snowy clearing at dawn. Low medium-wide tracking view, cool skylight and warm light on the
fur. 0–3s: the fox walks steadily from left to right, paws sinking slightly into fresh snow.
3–6s: it pauses, ears turn toward the trees and its breath condenses. 6–8s: it resumes the
same path as the camera follows gently. Soft wind and snow crunch; no music or subtitles.”

## Locked Opening Frame / Two-Frame Transition

Treat the image as the composition and subject anchor; write the motion away from it.
For two frames, identify start and finish, the connecting action and the final hold.
Use compatible source aspect ratios. A locked first frame controls framing; a prompt-only
“first frame” designation in semantic reference mode provides weaker matching.

Original pattern: “Begin with the provided product frame. The camera arcs gently to the
right while the lid opens, revealing the interior. Finish in the supplied end-frame pose
and hold for the final second. Preserve the package shape, label and background light.”

## Semantic References: Subjects, Style, Motion, Voice

List assignments before the story. Separate appearance from motion and background style.
If a reference already gives exact choreography, retain it without a competing gesture list.

Original pattern: “Image 1 supplies the ceramic teapot's shape and glaze. Image 2 supplies
the kitchen and morning light. Video 1 supplies only the slow camera arc. Create a new shot
of the teapot pouring into a cup; preserve its spout geometry and blue glaze throughout.”

For dialogue, associate each speaking character with both their visual and voice reference.
Specify the exact line, language and visible delivery. Audio-only input is not supported
on this PixVerse Seedance reference route; retain the required visual source.

## Storyboards, Independent Keyframes And Clay Previs

A multi-panel board communicates story structure; it does not lock every frame. Prefer
simple, legible boards without text clutter. When precise shot images matter, upload them
individually in sequence and state their keyframe order; retain separate identity references.
Do not put 3+ keyframes into Seedance's two-frame `create transition` command: use reference.

For clay previs, assign simple proxy shapes to the intended subjects. State which motion,
camera, timing or lighting to inherit and what final materials/style to render. Ensure the
written action agrees with the source blocking rather than adding an incompatible move.

## Edit Video Or Its Audio

Name the source, edit region/time range, the existing element and its desired replacement.
Specify what stays unchanged. Distinguish audio-only changes from visual changes.
The source locks duration/framing; use `reference --task-type edit`, auto duration/framing
where the current CLI supports them. Never promise exact output duration from requested flags.

Original pattern: “Edit Video 1 only from 4–7s: replace the yellow umbrella with the striped
umbrella in Image 1. Keep the woman's motion, face, clothes, camera, lighting and soundtrack
unchanged. Outside that interval preserve the source.”

## Extend Forward Or Backward

Name the source and extension direction unambiguously. Explain the new action and how it
joins the source's boundary pose, camera motion, lighting and sound. Distinguish the added
duration from the complete deliverable; inspect returned metadata before assembly.

Original pattern: “Continue after the end of Video 1 for 6 seconds. The bicycle keeps moving
right at the same speed, then slows beside the gate. Match the ending camera height, late
afternoon light and tire sound at the join; keep the rider and wardrobe consistent.”

## Asset Montage / Bridge Between Two Videos

State the intended order, whether input content may change, what bridge to generate and
which sound should cross the join. A bridge from video references is a reference task,
not the CLI's image-keyframe transition mode. Deterministic stitching alone belongs to
the editing workflow and does not require a new generation.

## Reference Budget

Current reviewed limits are 30 images, 10 videos, 10 audio inputs, at most 50 total;
combined input video duration and combined input audio duration each stay within 30 seconds.
Prefer the smallest clear reference set. The guide recommends relatively short subject
clips, limited casts and simple boards; these are creative recommendations, not additional
paid-generation stages. A fallback route has different limits: remap only with user agreement.
