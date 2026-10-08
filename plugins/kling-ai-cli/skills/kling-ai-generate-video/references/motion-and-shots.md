# Motion and shot planning

## Motion-prompt principles

- Lock user facts, opening state, identity, and product structure before defining allowed change.
- Write in time order: opening state → subject action → observable ending state. Separate subject motion, camera motion, and environmental motion.
- Keep only actions that fit the selected duration. Default to one primary subject action and one camera path; add environmental motion only when it explains wind, rain, dust, liquid, cloth, light, or physical feedback.
- For image-to-video, treat the first frame as the factual baseline. Describe what stays fixed, what may move, its amplitude, and where the camera ends; do not reimagine the opening appearance.
- Keep ratio, resolution, result count, model, and shot-control flags out of the creative prompt.

## Delivery-quality motion profiles

Choose one primary profile; add a secondary profile only when the request truly spans contexts. Do not mix every camera grammar into one prompt.

### Cinematic continuous shot

- **Prompt focus:** one narrative instant, subject blocking, one camera path, physical feedback, and a final landing composition around one reveal or emotional turn.
- **Acceptance gate:** action has preparation, force, and settle; camera starts and stops smoothly; screen direction, focus, exposure, and visible light sources remain continuous; the ending frame stands on its own.
- **Avoid:** push, pull, pan, orbit, and crane all within five seconds, abrupt location changes, or using slow motion, handheld shake, and flare instead of narrative staging.

### Image animation

- **Prompt focus:** the first frame is fact. Define allowed local motion, amplitude, parallax, camera endpoint, and locked identity, product structure, background, and composition.
- **Acceptance gate:** no jump between first frame and first motion; faces, hands, logos, and rigid structures do not melt; background parallax matches camera displacement; unauthorized regions stay stable.
- **Avoid:** large subject action, aggressive camera motion, and scene transformation simultaneously, or redescribing the first frame with new appearance facts.

### Product advertisement and demonstration

- **Prompt focus:** each beat does one job—reveal, structure, function, use, or close. Plan highlight travel, mechanical movement, hand contact, and brand exposure.
- **Acceptance gate:** dimensions, ports, labels, and moving parts remain consistent; highlights move continuously across materials; contacts and mechanisms follow physics; the end holds a usable hero frame.
- **Avoid:** unsupported features, fast orbits that distort geometry, and particles that obscure evidence.

### UGC and social short

- **Prompt focus:** credible phone placement, natural performance, real environment, one immediate hook, restrained body-inertia handheld motion, and subtle autofocus/exposure behavior.
- **Acceptance gate:** it feels creator-shot while the subject remains readable; reactions are not overacted; platform-safe areas remain clear; no invented testimonial or before/after proof.
- **Avoid:** equating UGC with poor quality, violent shake, defocus, or random exposure.

### Multi-shot narrative or ad

- **Prompt focus:** for each shot state its communication task, duration, scale, action, camera path, continuity anchor, and entry/exit behavior. Build cuts through action, gaze, composition, or screen direction.
- **Acceptance gate:** total duration closes; every shot adds information; identity, clothing, product, location, palette, and light direction continue; spatial relationships cut cleanly.
- **Avoid:** repeated “better angles” or regenerating people, products, and locations as new facts in every shot.

Read [scene patterns](scene-patterns.md) when the destination needs additional structure.

## Motion-prompt order

1. Opening composition and subject position.
2. Primary subject action with beginning, development, and observable settle.
3. One camera path, speed, and final landing.
4. Necessary environmental motion and physical feedback.
5. Motion-relevant lighting, color, depth, and time atmosphere.
6. Continuity locks: identity, clothing, product structure, logo, architecture, and screen direction.
7. Only constraints that prevent likely errors, such as no extra subject, deformation, or unrequested text.

If actions, camera paths, or start/end states conflict, ask the smallest question needed rather than merging them silently.

## Camera vocabulary

- `locked-off`: observation, product detail, graphic composition
- `slow push-in`: emphasis, intimacy, detail reveal
- `pull-back reveal`: environment or scale expansion
- `lateral tracking`: follow movement while preserving side relationship
- `restrained orbit`: dimensional product or character reveal
- `crane rise/drop`: establish or close spatial scale
- `handheld follow`: urgency or UGC realism with specified restraint
- `whip pan`: impact or transition with a defined landing subject

Do not stack camera-move verbs in a short shot. Replace “fast movement” with who or what moves, direction, speed, physical response, and endpoint.

## Timing and multi-shot template

- About 5 seconds: one action and one camera movement.
- About 10 seconds: one setup-and-result action or two simple connected beats.
- About 15 seconds: a compact three-beat sequence only when live-supported.

These are planning heuristics, not provider capability claims. Use only values returned by the selected model.

```text
Shot 1 — <duration>: <framing>; <single narrative task>; <subject action>; <camera path>.
Continuity: <identity/product/location anchors>.

Shot 2 — <duration>: <framing>; <new narrative task>; <subject action>; <camera path>.
Continuity: preserve <anchors>; cut through <action/gaze/composition/screen direction>.
```

The total duration must close and each shot must add information.

## Reference continuity and advertising

- First frame: preserve composition and generate motion from it.
- Multiple references: label roles; they are not interchangeable style inputs.
- Identity: lock face, age presentation, hair, clothing, proportions, and distinguishing features.
- Product: lock dimensions, materials, label copy, logo position, and how moving parts operate.
- Advertising beats should each serve hook, context, evidence, or close. Never invent performance claims, testimonials, statistics, prices, awards, certifications, or regulatory statements.

Before submission, internally check duration, resolution, ratio, shot structure, protected facts, parameter/prompt separation, motion conflicts, and an observable ending. Do not show a generic credit warning or redundant confirmation.
