# Build 3D Game Rooms

An open, reusable agent skill for conceiving, generating, constructing, reviewing, and shipping interactive 3D rooms. Its end-to-end workflow is:

1. Conceive a coherent room, its architecture, and a purposeful prop family.
2. Generate isolated, mesh-ready reference images and approve them before paid 3D generation.
3. Convert approved references into textured Meshy 5 GLBs with persisted task IDs, explicit credit ceilings, and controlled retries.
4. Lay out the room from a shared manifest and compose its procedural shell plus generated assets in Blender.
5. Audit, render, revise, export, and verify the room in its runtime.

The workflow is governed by three blocking gates:

1. **Function** — purpose, floor plan, openings, symmetry, circulation, camera, and budgets are explicit and approved.
2. **Form** — the room has a sealed structural shell, honest Boolean openings, correct object contact/orientation, complete review views, and audited geometry.
3. **Runtime** — the real application camera, assets, lighting, performance, and interactions are verified before deployment.

The package includes a Codex skill, plugin metadata, portable JSON contracts, prop and image briefs, a guarded Meshy Image-to-3D client, a manifest-driven Blender composer, geometry audit and Boolean-opening tools, tests, and an anonymized lesson ledger. Its room workflow is project-neutral and contains no private project assets, account details, or API credentials. The packaged interface artwork is governed separately by [BRAND_ASSETS.md](BRAND_ASSETS.md).

## Install the skill

Ask Codex's built-in installer to install the skill directly from GitHub:

```text
$skill-installer install https://github.com/tabutyn/build-3d-game-rooms/tree/main/skills/build-3d-game-rooms
```

Or clone the repository and link it locally:

Clone the repository, then copy or link `skills/build-3d-game-rooms` into your Codex skills directory:

```bash
git clone https://github.com/tabutyn/build-3d-game-rooms.git
mkdir -p ~/.codex/skills
ln -s "$PWD/build-3d-game-rooms/skills/build-3d-game-rooms" ~/.codex/skills/build-3d-game-rooms
```

Restart Codex and invoke `$build-3d-game-rooms`, or describe a task that matches the skill description.

The repository also contains a validated `.codex-plugin/plugin.json` for distribution through the universal OpenAI plugin directory. The skill directory remains the portable source of truth.

## Quick start

Create a blocked-by-default evidence package:

```bash
python3 skills/build-3d-game-rooms/scripts/create_room.py example-gallery \
  --family display-gallery \
  --output room-evidence/example-gallery
```

Fill the generated contracts and add referenced evidence, then validate a gate:

```bash
python3 skills/build-3d-game-rooms/scripts/validate_room.py \
  room-evidence/example-gallery --gate function
```

Available adapters are `display-gallery`, `gameplay-room`, `social-hub`, and `custom`.

## Prop image to Meshy pipeline

Fill `props.json`, generate each approved reference image as PNG or JPEG, and confirm current Meshy pricing in the manifest. Never paste the API key into ChatGPT or a project file; configure it only in the local environment:

```bash
export MESHY_API_KEY="<your-key>"
python3 skills/build-3d-game-rooms/scripts/meshy_image_to_3d.py submit \
  room-evidence/example-gallery --asset column-a --confirm-spend
python3 skills/build-3d-game-rooms/scripts/meshy_image_to_3d.py status \
  room-evidence/example-gallery --asset column-a
python3 skills/build-3d-game-rooms/scripts/meshy_image_to_3d.py download \
  room-evidence/example-gallery --asset column-a
```

The script pins `ai_model: meshy-5`, standard triangle topology, PBR textures, 2K texture resolution, and the manifest's polygon target. It writes a `SUBMITTING` record before the request and persists the returned task ID atomically. An unresolved submission blocks another charge. No key is written or printed.

## Blender construction

Fill `room-layout.json`, then run the composer through Blender:

```bash
blender --background --python \
  skills/build-3d-game-rooms/scripts/blender_compose_room.py -- \
  --package room-evidence/example-gallery \
  --output room-evidence/example-gallery/runtime/example-gallery.blend
```

The composer builds the procedural shell from declared surfaces, imports accepted GLBs, applies manifest transforms, creates the production camera, and saves a deterministic `.blend` source. Use the Boolean-opening and audit helpers before Form approval.

## Opening-mask workflow

Opening masks use white for removed wall and black for retained wall. Trace a mask into deterministic cutter data:

```bash
python3 skills/build-3d-game-rooms/scripts/trace_opening_mask.py doorway.png \
  --id entry-door --kind door --width-m 1.8 --height-m 2.7 \
  --out entry-door.json --preview entry-door.preview.png
```

Run `blender_boolean_fixture.py` inside Blender to verify the cutter against a real wall fixture.

## Validate and package

```bash
python3 -m unittest skills/build-3d-game-rooms/scripts/test_room_system.py
python3 tools/check_release.py
python3 tools/package_skill.py
```

The final command creates a portal-ready plugin ZIP under `dist/`. The archive has one
top-level `build-3d-game-rooms/` directory containing `.codex-plugin/plugin.json`, the
bundled skill under `skills/`, square interface artwork under `assets/`, and the public
documentation and legal files.

## Philosophy

- Plans are contracts, not mood boards.
- Plans are monochrome engineering views derived from actual geometry, with separate lower-room and reflected-ceiling layers.
- Architecture must communicate real function.
- Structural shells are procedural; imported assets are dressing.
- Symmetry binds the whole composition, not only the walls.
- Review suites show ceilings, support contact, openings, and the production camera.
- Explicit human approval is required at every gate.
- Paid Meshy generation is explicit, budgeted, and never runs without confirmation.

## Public distribution

This repository is public. The software and documentation are MIT licensed, so anyone can inspect, fork, install, or redistribute the skill. The BallRoller Games identity and interface artwork are subject to [separate brand terms](BRAND_ASSETS.md). `SUBMISSION.md` contains the prepared listing copy, test cases, and checklist for submitting the skills-only plugin to OpenAI's universal plugin directory.

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and releases.

## License

MIT for the software and documentation. See [LICENSE](LICENSE). The BallRoller Games name and interface artwork are excluded; see [BRAND_ASSETS.md](BRAND_ASSETS.md).
