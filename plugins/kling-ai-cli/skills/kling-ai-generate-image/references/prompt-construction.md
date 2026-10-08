# Image prompt construction

## Minimal sufficiency

Separate the request into:

1. **Hard constraints:** user-supplied subject, identity, product structure, copy, count, destination, and protected facts. Preserve each one.
2. **Creative choices:** requested action, environment, composition, lighting, color, material, and style.
3. **Necessary completion:** add a reasonable default only when the omission would make the composition ambiguous or materially less useful. Ask when it cannot be inferred reliably.

Write one coherent visual description. Every added phrase should create an observable difference. Keep model, resolution, ratio, and result count in CLI flags rather than repeating them in the prompt.

## Delivery-quality profiles

Choose one primary profile; add a secondary profile only when the request truly crosses contexts. A profile determines visible prompt facts and pre-submit checks, not model or cost.

### Commercial product and ecommerce

- **Prompt focus:** lock geometry, proportion, label placement, brand color, primary view, material response, controlled reflections, contact shadow, and background separation.
- **Acceptance gate:** caps, soles, buttons, ports, labels, and accessories remain structurally correct; glass, metal, plastic, and textile surfaces have distinct roughness and highlight behavior; the silhouette supports cropping or layout.
- **Avoid:** smoke, splashes, fragments, or wide-angle distortion that hides evidence or changes product shape.

### Advertising key visual and poster

- **Prompt focus:** one communication focus, foreground/midground/background hierarchy, a deliberate color mechanism, and safe space for title, logo, or action copy.
- **Acceptance gate:** the subject reads first at thumbnail size; the visual metaphor supports product facts; negative space is genuinely usable rather than filled with texture.
- **Avoid:** competing heroes, decorative atmosphere without a communication purpose, or model-invented campaign copy.

### Portrait, identity, and fashion

- **Prompt focus:** lock facial structure, age presentation, skin tone, hairline, distinguishing features, gaze, expression, pose, garment cut, key light, and catchlight.
- **Acceptance gate:** identity is not averaged into another person; skin retains natural volume and texture; hands and anatomy are credible; fabric tension, patterns, closures, and logos stay accurate.
- **Avoid:** unsupported changes to age, body, or ethnicity, over-smoothed skin, plastic highlights, and unjustified rim lighting.

### Narrative concept and cinematic still

- **Prompt focus:** define the narrative instant first, then blocking, spatial relationships, visible light sources, depth layers, and a color script that serves the reveal or emotion.
- **Acceptance gate:** the image answers who is where doing what; light traces to windows, fixtures, fire, neon, or sky; details share one time period, place, and art direction.
- **Avoid:** stacking grain, darkness, anamorphic flare, shallow depth, and haze as a substitute for scene design.

### Reference edit and brand variant

- **Prompt focus:** use the source as the factual baseline and define one change budget. List identity, product structure, camera position, perspective, logo, copy, and background facts that must remain fixed.
- **Acceptance gate:** unauthorized regions do not drift; new lighting, season, color, or environment respects original perspective, occlusion, and material response; variants differ only on the approved dimension.
- **Avoid:** redescribing the entire source and accidentally rewriting it, or treating style references as identity or structure references.

Read [scene patterns](scene-patterns.md) when the destination needs more specific choices.

## Prompt order

Use only relevant categories:

1. Destination and medium.
2. Subject and locked facts.
3. Action or visual concept.
4. Environment, time, weather, and mood.
5. Composition: framing, camera height, lens feel, focus hierarchy, negative space, and safe areas. Keep exact ratio in flags.
6. Lighting and color.
7. Materials, texture, surface detail, and realism or stylization.
8. Constraints that prevent a likely error: subject count, protected facts, no extra text or watermark.

If hard constraints conflict, ask the smallest question needed to resolve them. User facts outrank profiles, scene templates, and model defaults.

## References and exact text

Assign roles before writing the creative prompt, for example identity, product structure, official logo, composition, or transferable style traits. Do not treat a style image as identity. For image-to-image, emphasize what may change and what must remain rather than reimagining facts already present.

Preserve supplied copy character-for-character. Prefer a clean background with reserved text space when deterministic typography can be added later. When text must be generated in-image, include it once, prohibit other readable text, and plan to verify spelling and layout.

## Avoid

- Empty praise such as “beautiful,” “masterpiece,” “best quality,” “8K,” or “ultra HD” without visible design decisions.
- Conflicting directions such as minimalist plus densely layered, or macro plus full environmental wide shot.
- Long negative lists that merely repeat positive requirements.
- Tool parameters inside the creative prompt.
- Unsupported product, medical, pricing, award, certification, or statistical claims.
