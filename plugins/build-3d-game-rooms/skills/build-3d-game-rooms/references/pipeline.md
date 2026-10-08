# Room production pipeline

## Evidence package

Create a package with `create_room.py`. Keep `room-brief.json`, `props.json`, `room-layout.json`, `openings.json`, `milestone-reviews.json`, `final-report.json`, `images/`, `meshes/`, `masks/`, `plans/`, `renders/`, and `runtime/` together. Store paths relative to the package so it moves across operating systems.

## Function

1. Fill the brief and performance/paid-service budgets.
2. Declare symmetry mode/order, affected systems, and intentional exceptions.
3. Conceive the shell and prop family together. Fill `props.json` with functional roles, dimensions, attachment/front axes, reuse class, prompts, polygon targets, and objective rejection criteria.
4. Generate isolated mesh-ready reference images. Preserve prompts and generator provenance, assemble a contact sheet, and record explicit approval on each asset.
5. Produce the concept layout, monochrome orthographic engineering plans, wall elevations, visual target, and production-camera specification. Split lower-room and reflected-ceiling layers. Omit AI-inspiration panels unless requested.
6. Fill the opening schedule. Default the primary arrival to an open hallway or clear aperture at least 2.4 m wide, with visible depth and destination; record any justified exception. Trace every opening mask and compose the contact sheet.
7. Run `validate_room.py --gate function`; obtain explicit approval before Meshy calls.

## Asset generation

1. Recheck the official Meshy API schema and pricing. Record the source URL, UTC check time, and current per-task estimate in `props.json`; never silently reuse stale pricing.
2. Export `MESHY_API_KEY` in the execution environment. Never place it in commands, manifests, logs, or source control.
3. Use `meshy_image_to_3d.py submit ... --confirm-spend` for one approved asset at a time. The client records an unresolved submission before the network request and atomically saves the returned task ID.
4. Use `status` to update the same immutable attempt. Never resubmit an attempt left in `SUBMITTING`; reconcile it manually from the Meshy task list.
5. Inspect the Meshy previews for silhouette, back surface, part separation, support, and topology. Accept or record an objective rejection reason. Never exceed two charged attempts per asset or the room ceiling.
6. Use `download` promptly after success because result URLs expire. Preserve the task record, response metadata, GLB hash, and local relative path.

## Form

1. Build sealed procedural substrates with metre units and real thickness.
2. Run `blender_compose_room.py` to create the shell, import accepted prop GLBs, apply layout transforms, and create the production camera. Apply Exact Boolean cutters before decorative surrounds.
3. Normalize imported assets to manifest dimensions and named attachment faces/origins; instance reusable data. Default an undeclared mount to the largest suitable planar face and orient its front upward or inward. For surface-applied ceiling decoration, measure transformed world-space mesh bounds, align the shortest dimension to the nearest visible underside normal, keep the largest face parallel and wholly exposed, and verify straight-up plus oblique renders.
4. Verify declared symmetry across architecture, barriers, circulation, and repeated props. For high-order radial rooms, audit the combined pattern and offset lower-order sets. Verify seating direction, count-aware focal distribution, hero clearance, and open column bays.
5. Render production, wide, overhead, each opening oblique, floor, hero/contact, four 120-degree corners, one center-up ceiling view, and two opposed ceiling obliques. For an assigned equirectangular environment, add environment-only front, right, rear, left, up, and down views and record its stable identity.
6. Record floor-plan parity, primary-arrival, symmetry, shell, manifold, Boolean, BVH, contact/orientation, ceiling-attachment, seating, focal-distribution, hero-clearance, colonnade, screen-gap, scale, camera, ceiling-coverage, environment-coverage, and provenance results.
7. Run `validate_room.py --gate form`; obtain explicit approval before export.

## Runtime

1. Export the geometry and texture tiers required by the target runtime.
2. Bake from the shared fixture manifest. Validate receiver topology and source hashes.
3. Load the real runtime surface at its target viewport. Wait for textures, lighting, environment, canvas, reveal, and interactions.
4. Compare runtime hero bounds with the locked production-camera contract.
5. Run `validate_room.py --gate runtime`; obtain explicit approval before deployment.

## Postmortem

Record observations separately from lessons. Propose a pending lesson only when it is reusable beyond one transform. Approval must be explicit and applied with `manage_lessons.py`; retain rejected and superseded records.

## Project integration

Treat this skill as the contract layer around project-specific builders and exporters. Map each project command to a gate artifact in the room package instead of embedding repository paths in the skill. Keep adapters small and add a new one only when a room family has materially different hero, circulation, collision, or camera requirements.
