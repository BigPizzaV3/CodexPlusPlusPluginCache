---
name: build-3d-game-rooms
description: Conceive props, generate mesh-ready reference images, create guarded Meshy Image-to-3D assets, compose Blender rooms, and audit or ship interactive 3D spaces through blocking gates. Use for prop ideation, room layouts, Meshy asset generation, Blender construction, Boolean openings, review renders, runtime exports, and durable room-design lessons.
---

# Build 3D Game Rooms

Carry one authored design from room concept through prop images, Meshy meshes, Blender construction, and runtime. Treat each gate as blocking: do not submit paid Meshy work before Function approval, export before Form approval, or publish before Runtime approval.

## Start every task

1. Read `references/design-doctrine.md` and `references/lessons.json` completely.
2. Read `references/pipeline.md` for the full workflow. Read `references/asset-pipeline.md` before creating prop images or using Meshy.
3. Read exactly one adapter: `references/families/display-gallery.md`, `gameplay-room.md`, `social-hub.md`, or `custom.md`.
4. Locate or create the room brief, opening schedule, review record, and final report from `assets/templates/`.
5. Run `scripts/validate_room.py` before crossing a gate. A warning never satisfies a required field or approval.

## Function gate

- Define purpose, runtime surface, bounds, hero object, circulation, production camera, performance budget, and paid-service budget.
- Conceive a restrained prop family in `props.json`. Give every asset a function, dimensions, attachment face, semantic front, reuse/hero class, image prompt, polygon target, and objective rejection criteria. Prefer fewer multipurpose assets to visual clutter.
- Generate isolated reference images that show the whole object, readable depth, construction, materials, and a clean silhouette. Reject room scenes, cropped forms, fused neighboring props, dramatic occlusion, impossible supports, text, and ambiguous fronts. Record the generator and prompt; require explicit image approval per asset.
- Declare symmetry and where it binds architecture, barriers, circulation, and repeated props. Record every exception; radial and bilateral rooms may not drift into accidental asymmetry.
- Approve a monochrome engineering floor plan, wall elevations, and visual target. Derive object marks from top-down orthographic projections of the actual geometry, with separate lower-room and reflected-ceiling layers. Cover entrance signs, exterior aprons, ingress props, floor markers, barriers, columns, and openings; never substitute generic rectangles for object silhouettes. Keep labels in accessible UI or metadata, and omit AI-inspiration panels unless the user explicitly requests one.
- Declare every opening as `door`, `window`, or `deep_alcove`; record dimensions, wall, destination, sill or threshold, and depth.
- Default the primary arrival to an open hallway or a clear aperture at least 2.4 m wide, with visible passage depth and a readable destination. Record a functional exception when the runtime requires a smaller or closed entrance.
- Generate a labeled black-and-white opening-mask contact sheet. Use `scripts/trace_opening_mask.py` for reproducible cutter data.
- Require explicit human approval of the room layout and reference contact sheet. Stop before paid Meshy generation or final composition when Function fails.

## Asset-generation gate

- Use an available image-generation tool to execute the approved prop prompts; do not silently replace the requested visual direction. Preserve source images and provenance.
- Never ask for or accept an API key in chat, prompts, manifests, project files, or evidence. The user configures `MESHY_API_KEY` outside the conversation in their execution environment; inspect only whether it exists and never reveal its value.
- Before any Meshy call, read `references/asset-pipeline.md`, disclose that the approved image and declared generation settings will leave the local environment for Meshy, confirm current official pricing in `props.json`, verify `MESHY_API_KEY` exists without printing it, and require `--confirm-spend` or equivalent explicit authorization.
- Pin Image-to-3D submissions to `ai_model: "meshy-5"`, `model_type: "standard"`, triangle topology, remeshing to the declared polygon target, textures enabled, PBR enabled, 2K textures, and GLB output.
- Persist immutable attempt metadata and the task ID immediately. Never automatically repeat an unresolved submission. Permit at most two charged attempts per asset; require an objective rejection reason before a charged retry. After the second charged rejection, repair in Blender or revise the room—do not submit a third charged generation.
- Poll existing task IDs and use Meshy's returned `consumed_credits`; failed tasks with zero consumed credits do not count toward the charged-attempt ceiling. Stop before the declared room credit ceiling.

## Form gate

- Build procedural walls, floors, and ceilings as a sealed substrate with thickness.
- Boolean every approved arch, door, and window opening into its wall before placing decorative surrounds. An arch must frame a passage or an unmistakably deep, backed alcove.
- Mount floor and wall objects with their declared attachment face against the support. Default to the largest suitable planar face; point the semantic front upward from floors or inward from walls.
- Mount surface-applied ceiling decoration flat to the nearest visible ceiling underside. Measure evaluated world-space mesh bounds after transforms; align the shortest dimension to the support normal and the largest face parallel to it. Require the broad face to be unobstructed in a straight-up render. Pendant fixtures are explicit exceptions and need visible suspension.
- Treat freestanding column rows as open colonnades with a visible exterior. If an opaque wall continues through the bay, use pilasters instead of implying an open span.
- Express high-order radial symmetry with the sparsest legible composition. Complementary lower-order sets may combine into the declared order—for example, two fourfold sets offset by one eighth-turn—so similar-scale objects alternate instead of crowding every bay.
- Aim seating toward its declared focus, conversation group, or circulation use. Match focal-feature placement to feature count and keep secondary features outside the hero reserve.
- Build the room from `room-layout.json`: create the procedural shell, apply approved Boolean openings, import accepted GLBs, normalize to declared dimensions, orient attachment/front axes, place instances, create the production camera, and save a proxy-free `.blend` source.
- Use imported or generated assets additively for architecture, fixtures, furniture, and props; do not let them replace the structural shell.
- Render four 120-degree corner views plus a center-up ceiling view and two opposed ceiling obliques. When an equirectangular environment is assigned, pin it by room identity and also render environment-only front, right, rear, left, up, and down directions. Run floor-plan parity, primary-arrival, symmetry, shell, manifold, Boolean, BVH, support/orientation, ceiling-attachment, seating, focal-distribution, hero-clearance, colonnade, screen-space, scale, framing, ceiling-coverage, environment-coverage, and provenance checks.
- Record explicit human Form approval. Stop before progressive export when Form fails.

## Runtime gate

- Export the geometry and texture tiers required by the target runtime.
- Bake from the same fixture manifest consumed by runtime lights or effects.
- Validate hashes, tier topology, lightmaps, performance budgets, and the real production camera.
- Capture the loaded application only after room, textures, lighting, environment, and interactions report ready.
- Record explicit human Runtime approval. Stop before deployment when Runtime fails.

## Learn after delivery

1. Write a postmortem with observations, evidence, corrections, and proposed lessons.
2. Add proposed lessons as `pending`; never edit them directly to `approved`.
3. After explicit approval, run `scripts/manage_lessons.py decide --id ... --decision approved --approved-by ...`.
4. Keep rejected and superseded lessons. Do not re-propose a rejected lesson without new evidence.
5. Apply only approved lessons as binding doctrine.

## Deterministic tools

- `scripts/create_room.py`: create a portable room evidence package.
- `scripts/meshy_image_to_3d.py`: submit, track, and download budget-guarded Meshy 5 assets without storing the API key.
- `scripts/blender_compose_room.py`: construct a Blender room from the shell, prop, and placement manifests.
- `scripts/trace_opening_mask.py`: trace a binary opening PNG into cutter JSON and an annotated preview.
- `scripts/compose_opening_contact_sheet.py`: compose labeled opening evidence.
- `scripts/validate_room.py`: validate schemas and gate evidence.
- `scripts/manage_lessons.py`: propose, approve, reject, or supersede durable lessons.
- `scripts/audit_blender_room.py`: inspect Blender geometry and object metadata.
- `scripts/blender_boolean_fixture.py`: build and validate an Exact-Boolean wall fixture from cutter JSON.

Never infer approval from a successful render or test. Never let a proxy render prove final runtime fit. Never mutate a published room during a diagnostic audit.
