---
name: kling-ai-generate-video
description: Generate Kling videos through the Global CLI from text, images, reusable Elements, or a motion video/saved motion; supports live audio and multi-shot options.
---

# Kling video generation

Follow [the core workflow](../kling-ai/SKILL.md) and [CLI contract](../kling-ai/references/cli-contract.md); submit each authorized step at most once. For reusable subjects or motion transfer, read [Element and motion rules](../kling-ai/references/elements-motion-feedback.md).

- Use `text_to_video` without controlling source media; `image_to_video` for image-based animation; `motion_control` for a subject driven by a video or saved motion. A single image with “animate this” normally supplies the first frame. Clarify roles only when materially ambiguous.
- Pass image references with `--image` and a live-supported tail frame with `--tailImage`. Motion control needs a subject image and exactly one `--video` or `--motionId`; it always requires `--model`, never `--omni`.
- Write the opening state, subject action, camera movement, and ending. Preserve identity/product facts. Keep shots within the supported duration; do not submit a task per shot unless separate outputs were requested.
- Preserve the model's declared resolution default. Infer ratio/duration only from supported values and user intent. Omit it when undeclared; never reuse another model's flags.
- When declared, map `prefer_multi_shots` to the planned shot structure. Set `enable_audio` true only for requested sound and otherwise false; use `enable_asmr` only for requested ASMR. Pass `audio_prompt` and `music_prompt` only when declared and requested. For motion control, source-motion constraints take precedence over ordinary video defaults.
- Element binding requires both `<<<id>>>` and live-supported `--elements`; check tool-description restrictions as well as model parameters. Conflicting declarations stop submission.
- Resolve references, check credits, submit, poll, and return results using the core workflow. Do not invent dialogue, claims, or an extra paid generation step.

## Quality workflow

Before every video generation, read [motion and shot planning](references/motion-and-shots.md). For product, UGC, explainer, multi-shot, or social-format requests, also read the relevant section of [scene patterns](references/scene-patterns.md). A simple single-shot animation does not need every scenario guide.

1. Establish opening/ending states, duration, destination, reference roles, protected identity/product facts, and requested sound. Choose a live model that can support these requirements.
2. Write in time order. Separate subject action, camera motion, and environmental response; describe direction, speed, amplitude, and an observable endpoint. Default to one primary action and one camera path for a short shot.
3. For image animation, treat the first frame as the factual baseline. State what stays fixed and what moves. For motion control, preserve source-motion intent; do not invent conflicting choreography or camera moves.
4. Use multiple shots only when requested or needed for changes in place, time, scale, or information. Give each shot one purpose and a duration; total timing must close. Preserve faces, clothing, product geometry, lighting, screen direction, and location anchors across cuts.
5. Map dialogue, narration, music, ambience, or ASMR only when requested and supported. Never claim a completed voiced video when the model lacks the required sound controls, or invent testimonials, product claims, or copy.
6. Before submission, check that actions fit the duration, camera moves do not conflict, the ending is achievable, and profile-specific continuity checks pass. Inspect output before claiming visual QA; report defects without automatically submitting another paid task.

## Minimal calls

These show arguments after the npm command prefix in the CLI contract. Replace `<model>` with the selected live model and use actual media paths. Append the shared telemetry flags.

```bash
kling text_to_video --model <model> "Sunset over the sea; gentle waves, slow forward camera movement"
kling image_to_video --model <model> --image ./first-frame.png "Animate the waves; preserve the horizon and composition"
```

For a requested ending frame, add `--tailImage ./last-frame.png` only when supported. Add `--duration` or `--aspectRatio` only with live-supported values. Describe multi-shot timing in the prompt and use declared shot/audio flags; a storyboard does not imply one paid task per shot. Motion transfer uses the separate `motion_control` workflow, not ordinary image animation.

Before execution: resolve media roles → `who_am_i` → choose model and flags → `account` → submit once → `query_tasks <generationId>` → return selected `works[]` with task number and work index. A media failure does not authorize text-to-video fallback.
