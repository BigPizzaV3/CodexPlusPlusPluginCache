# Prop conception, images, and Meshy assets

Read this reference whenever a task conceives props, generates reference images, submits Meshy work, evaluates a generated mesh, or downloads a result.

## Conceive the prop family

- Start with the room's purpose, circulation, hero reserve, shell rhythm, material language, and interaction needs.
- Give each prop one primary function and a reason to exist. Use reusable architectural pieces for rhythm and reserve hero-class assets for focal moments.
- Declare real-world dimensions, target polygon count, attachment face, semantic front, intended instances, and required clearances before image generation.
- Design coordinated variation rather than unrelated novelty. Reuse a small vocabulary of profiles, joints, motifs, materials, and edge treatments.
- Decide which geometry is better built procedurally in Blender. Floors, walls, ceilings, simple trim, collision, and Boolean openings should not consume generation credits.

## Make mesh-ready reference images

Use an available image-generation capability to produce one isolated object per image. The prompt should include:

- object type and functional construction;
- full uncropped silhouette and all supports;
- three-quarter view with enough depth to infer the back;
- neutral perspective, even studio light, and plain or transparent background;
- materials and restrained surface detail;
- symmetry or asymmetry requirements;
- explicit exclusions: no room scene, people, neighboring props, text, watermark, dramatic crop, floating parts, or fused background.

Generate variations before Meshy, not paid 3D retries after it. Approve an image only when the object could plausibly stand, mount, open, or repeat as declared. Preserve the source image, exact prompt, generator name/model when available, and approval record.

## Meshy Image-to-3D contract

The bundled client targets the official `POST /openapi/v1/image-to-3d` and `GET /openapi/v1/image-to-3d/:id` endpoints. It sends local PNG/JPEG references as data URIs and requests:

```json
{
  "model_type": "standard",
  "ai_model": "meshy-5",
  "should_texture": true,
  "enable_pbr": true,
  "texture_resolution": "2k",
  "should_remesh": true,
  "topology": "triangle",
  "target_formats": ["glb"]
}
```

The per-asset `target_polycount` and optional `texture_prompt` come from `props.json`. Meshy documents target counts as approximate. The API key must exist only as `MESHY_API_KEY` in the environment. Never ask the user to paste it into chat or place it in a prompt, manifest, project file, log, or evidence package. The client reads it transiently and sends it only to `api.meshy.ai` as the HTTPS authorization header.

## Spend and retry invariants

- Treat pricing as mutable. Verify https://docs.meshy.ai/en/api/pricing immediately before the first paid batch and record the check in `props.json`.
- Before every submission, state that the approved reference image and declared generation parameters will be transmitted directly to Meshy for processing.
- Require explicit spend confirmation on every submission. Never submit automatically while polling, downloading, importing, validating, or restarting a process.
- Write an immutable attempt placeholder before the request and atomically attach the returned task ID. A placeholder without a task ID is unresolved and blocks another submission until manually reconciled.
- Count Meshy's returned `consumed_credits`, not an estimate, toward actual spend. Reserve the verified estimate for pending work.
- Permit at most two charged attempts per asset. A charged retry requires an objective rejection reason on the previous attempt: unusable silhouette, fused geometry, missing back surface, broken support, irreparable topology, or materially wrong construction.
- After two charged rejections, repair the mesh in Blender, revise the composition, or replace the asset with procedural geometry.

## Mesh review and Blender intake

Before acceptance, inspect front, right, back, and left previews plus the downloaded GLB. Verify complete surfaces, separable parts, target-scale plausibility, support/contact faces, semantic front, UVs, PBR maps, material slots, normals, manifold expectations, and polygon count. Record accepted mesh path and SHA-256. Normalize and orient only in Blender; never conceal a rejected generation by merely scaling it into place.

Meshy is an independent third-party service. The skill includes no credits, subscription, endorsement, or guarantee of availability. Meshy terms, licensing, pricing, retention, and privacy apply to API use.
