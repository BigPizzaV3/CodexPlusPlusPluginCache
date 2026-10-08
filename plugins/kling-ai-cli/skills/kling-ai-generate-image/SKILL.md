---
name: kling-ai-generate-image
description: Generate or edit Kling images through the Global CLI, including references, product images, portraits, posters, variants, and reusable Elements.
---

# Kling image generation

Follow [the core workflow](../kling-ai/SKILL.md) and [CLI contract](../kling-ai/references/cli-contract.md); submit each authorized step at most once. Read [Element rules](../kling-ai/references/elements-motion-feedback.md) only when using reusable subjects.

- Use `text_to_image` for a new image; use `image_to_image` when source media controls identity, structure, composition, or style. Assign each reference a role and preserve the order of repeatable `--image` arguments.
- For editing, state what changes and what stays fixed. Preserve identity, product geometry, logos, and exact supplied copy. Write concrete composition, lighting, and material choices; avoid unnecessary prompt embellishment.
- Choose a live `--model`; use `--omni` only when explicitly requested and supported. Preserve the model's declared resolution default. Use only live-supported ratio and count values; default to one image unless more were requested.
- For Element binding, inspect the subject type and both live tool restrictions and model parameters. Use `<<<id>>>` plus `--elements`; stop if declarations conflict. Do not probe compatibility with a paid task.
- Resolve references, check credits, submit, poll, and return results using the core workflow. Status requests use `query_tasks` and create no generation.

## Quality workflow

Before every image generation, read [prompt construction](references/prompt-construction.md). For product, advertising, portrait, cover, or reference-edit requests, also read the relevant section of [scene patterns](references/scene-patterns.md). User facts and requested changes take precedence over these profiles.

1. Identify the subject, destination, required copy, reference roles, and protected identity/product facts. Ask only for missing information that materially changes the result.
2. Select one primary quality profile: product/ecommerce, advertising/poster, portrait/fashion, cinematic concept, or reference edit. Add another only when the request crosses contexts; profiles guide visible quality, not model cost.
3. Build one coherent prompt covering the subject and allowed change, composition, lighting, color, and material response. Translate “premium” or “cinematic” into observable choices. Keep model, ratio, resolution, and count in flags.
4. For references, separate identity/product structure from style/composition. Preserve source perspective, geometry, labels, and supplied text; define which areas may change. Do not redescribe a source so broadly that locked facts drift.
5. Before submission, check focal hierarchy, crop/copy-safe space, reference order, protected details, exact spelling, and the chosen profile's acceptance criteria. Prefer clean artwork with reserved text space unless generated copy is required; include required copy exactly once.
6. Inspect the result when available before claiming visual QA. Report visible mismatches honestly; a quality defect does not authorize automatic regeneration.

## Minimal calls

These show arguments after the npm command prefix in the CLI contract. Replace `<model>` with the selected live model; resolve real paths before calling. Append the shared telemetry flags.

```bash
kling text_to_image --model <model> "A red panda in a vintage spacesuit, lit by Earth's blue glow"
kling image_to_image --model <model> --image ./reference.png "Restyle in watercolor; preserve the subject and composition"
```

For multiple references, repeat `--image` in the intended order. Add `--imageCount`, `--imgResolution`, or `--aspectRatio` only when declared by the selected model and required by the request; preserve defaults otherwise. Choose a product's factual reference over a style reference for identity and structure.

Before execution: resolve references → `who_am_i` → choose model and flags → `account` → submit once → `query_tasks <generationId>` → return selected `works[]` with task number and work index. An upload failure does not authorize text-to-image fallback.
