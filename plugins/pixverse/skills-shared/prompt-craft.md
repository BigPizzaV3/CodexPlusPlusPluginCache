# Prompt Craft

PixVerse prompts should be obedient, concrete, and production-aware. They should not read like generic mood-board prose.

## First Principle

Listen first, then add taste. The user's desired aesthetic may be polished, ugly, historical, amateur, shaky, overexposed, badly composed, low-budget, or deliberately wrong. Treat that as the target, not as a defect to fix.

High quality means faithful production grammar for the requested target, not repeating the same prestige-film filter. A 1970s road film, a rough phone UGC clip, a glossy product macro, a children's 3D animation trailer, and a deliberately miscomposed test shot should produce different prompt mechanics.

## Extract The Visual Grammar

Before writing the prompt, identify:

- era and medium: decade, region, camera technology, stock/sensor, broadcast/social format
- genre: product film, road movie, UGC, short drama, documentary, MV, game trailer, UI reveal
- subject locks: face, wardrobe, product silhouette, logo/label, prop, layout, vehicle details
- composition: angle, distance, framing, crop, negative space, screen orientation
- motion: handheld, locked-off, dolly, car-mounted, snap zoom, focus breathing, pan/tilt
- light/color/texture: natural light, tungsten, fluorescent, grain, compression, haze, sharpness
- audio: dialogue, room tone, Foley, music, silence, caption needs
- audio mode: clean picture, synchronized SFX/ambience, fused native audio, standalone voice, standalone music, or local post mix
- anti-goals: what the model must not beautify, invent, stabilize, sharpen, or modernize

## Strong Prompt Shape

For video:

```text
Subject and identity anchors. Scene and setting. Action over time. Camera movement.
Lighting, texture, and medium. Genre/aesthetic target. Audio/dialogue/SFX if relevant.
Constraints: keep references stable, no fake readable text, no extra faces, no unintended cuts.
Ending frame or final beat.
```

For video audio, decide the audio mode before writing prompt text:

```text
Audio plan: clean picture / synchronized SFX and ambience / fused native audio / standalone voice / standalone music / local post mix.
```

When the video model should generate SFX and ambience but not music, write it as plain natural language: this video should not generate any music, background music, score, melody, rhythmic bed, or trailer-style musical hit; it should only generate synchronized sound effects and environmental ambience for visible actions. Avoid music-shaped words in audio sections, including `swell`, `chime`, `stinger`, `orchestral`, `heroic`, `trailer hit`, and `uplifting bed`.

For images:

```text
Subject. Composition. Materials. Lighting. Lens/angle. Medium/style constraints.
If a board: panel count and what each panel must show.
If a product: lock packaging, label area, silhouette, color, logo placement.
If a plate: exact layout/text/logo placement and what must remain clean.
```

## Identity Anchors

Use repeated, concrete anchors:

- face shape, hair, outfit, accessory, posture
- product silhouette, label area, material, color, logo placement
- UI layout zones, typography hierarchy, button/icon positions
- vehicle grille, light signature, wheel design, body proportion
- world rules: signage language, weather, era props, social platform framing

## Avoid Generic Taste

Do not use these as substitutes for direction:

- "cinematic" alone
- long abstract adjective chains
- premium/beautiful/luxury without visible mechanisms
- famous IP names or director names without translating them into visual grammar
- contradictory camera directions
- exact readable video text unless using a locked image plate
- letting the model invent interfaces, labels, claims, or brand copy that must be exact

## Controlled Imperfection

When the user wants a flawed look, write the flaw deliberately:

- intentional off-balance framing
- shaky handheld capture
- imperfect focus breathing
- overexposed roadside sunlight
- low-bitrate phone video texture
- awkward crop that cuts part of the subject
- amateur zoom hesitation
- harsh fluorescent office light

The goal is controlled imperfection, not random failure.

## Historical Style

For historical requests, specify the production grammar of that era rather than a vague "vintage" label.

Example: 1970s American road film should imply natural light, New Hollywood realism, period cars and roadside signage, restrained performances, film grain, warm but not glossy color, car-mounted or handheld camera, heat shimmer, practical locations, and lonely highway pacing.

## Make It Agentic

Before paid generation, often produce 2-4 prompt routes when the user asks for "cool", "creative", "not generic", or gives a broad aesthetic:

- safe polished version
- weird memorable version
- minimal premium version
- platform-native/social version

Choose the strongest route yourself when urgency is clear. Ask only if the choice changes cost, format, or creative direction materially.
