# Canvas video_compose Parameters

Use only for composition in an explicitly selected Canvas project. Ordinary queue and local editing rules remain unchanged.
This is an on-demand Canvas Skill parameter reference, not a new generation workflow or a default first-stage dependency.

## Contract Sources And Boundaries

- In the bundled `pixverse-internal-1.4.0-20260904-151209.zip`, `dist/capabilities.json` declares
  `capability_domains.canvas.source` as `runtime`. Discovery uses
  `pixverse capabilities canvas --json` and `pixverse canvas node schema --node-type <type> --json`.
- The constraints below come from the preview deployment's `video_compose.payload_schema`, capability version
  `sha256:f5d94523e50ac78c03809d074ae9bc4748cdd15f093143de246e52252bed4e51`.
  Prefer a newer runtime contract when returned and review its differences.
- Reuse the runtime `video_compose` contract already obtained for this task; do not query the schema again if it contains the required definitions.
  `payload_required_fields: ["tracks"]` alone does not define nested fields. Start with this reference; query the specific node schema only if necessary definitions remain missing.
  If the runtime contradicts this reference or required behavior remains undefined, stop and explain the gap. Do not discover parameters by trial-and-error dry runs or automatically fall back to local download/process/upload.

## Nodes And Tracks

Paths below are relative to `graph_patch.nodes[]`. CLI `--patch` receives the graph_patch object itself, without an additional `graph_patch` wrapper.
Replace example versions and node IDs with those from the currently accepted graph.

| Field | Type / requirement | Meaning and constraints |
|---|---|---|
| `node_id` | Nonempty string | Composition node ID. New nodes need an unused project ID, including no reuse of deleted IDs; updates use the target ID. |
| `node_type` | String | Always `video_compose`. |
| `title` | Optional string | Canvas display title, not subtitles or a generation prompt. |
| `position.x` / `position.y` | Explicit finite numbers recommended for new nodes | Canvas coordinates near the referenced materials' local bounding box. Not composition parameters or part of the paid content fingerprint. When omitted, the guarded wrapper assigns a nearby nonoverlapping position. |
| `style.width` / `style.height` | Optional positive numbers | Display dimensions. Automatic layout estimates `video_compose` as `360×240` when omitted; the server determines the final normalized values. |
| `payload.duration` | Optional positive integer, milliseconds | Total output duration; must cover the latest `timeline.to`. Canvas derives it from tracks when omitted. |
| `payload.tracks` | Required array of objects | Exactly one `video` track and zero or more `audio` tracks. |
| `payload.tracks[].type` | `video` or `audio` | Track type. Do not invent image, subtitle or other types. |
| `payload.tracks[].segments` | Array of objects | Actual segments for this track. Omit an unneeded audio track entirely instead of adding an empty placeholder. |
| `depends_on` | Required array of material IDs | Every `material.node_id` must also appear in the composition node's top-level `depends_on`; guarded apply adds missing dependencies. |

`payload.tracks` is the sole composition input. Do not copy generation fields such as `prompt`, `model`, `duration` or `quality`,
or copy the graph readback's entire `data.params` object into the patch payload.

## Segment Fields

Paths below are relative to `payload.tracks[].segments[]`.

| Field | Type / requirement | Meaning and constraints |
|---|---|---|
| `material` | Object | Source material for this segment. |
| `material.node_id` | Explicit nonempty string | A successful source node in the same project with usable media metadata; not a task ID, history ID or file address. |
| `material.type` | Optional `video` / `image` / `audio` | Video tracks accept video or image materials; audio tracks accept audio only. Set explicitly when possible. |
| `clip.from` | Required nonnegative integer, milliseconds | Start offset in the source. |
| `clip.to` | Positive integer, milliseconds | Required for images; optional for video/audio when Canvas can resolve source duration. If explicit, must exceed `from`. |
| `timeline.from` / `timeline.to` | Required integers, milliseconds | Segment start and end in the final composition; `to` must exceed `from`. When `clip.to` exists, clip and timeline lengths must match. |
| `volume` | Optional number, range `0..2`, default `1` | `0` is muted, `1` is original volume, `2` is maximum. |

Construction rules:

1. Order video segments by final playback. The first `timeline.from = 0`; each following start must equal the preceding `timeline.to`, with no overlap or gap.
   Equal lengths do not provide a speed-control interface; do not change clip/timeline lengths to create fast or slow motion.
2. Material `duration` / `video_info.duration` values are seconds; multiply by `1000` for these time fields.
   Use known source duration, not requested generation duration. Keep intervals nonnegative and within available media.
   Canvas composition time fields require integers; never round a clip endpoint beyond the source.
3. Every segment on every track needs positive length, matching clip/timeline lengths and valid volume.
   Video continuity validation does not establish arbitrary audio overlap, looping, padding or truncation support; obtain separate contract evidence for those behaviors.
4. Use `material.node_id` directly so Canvas resolves existing cloud media, and include the same ID in top-level `depends_on`.
   No need to copy `material.file_path` / `material.url`, download media or create upload nodes.
   Confirm source success and usable media metadata before rendering.
5. This contract does not define output codec/resolution/FPS, transitions, subtitles, scaling/cropping or advanced mixing.
   Do not invent fields, import Create parameters or claim support. Query the runtime contract as needed. Requested parameters are not output QA evidence.

## New Node Layout

Arrange composition nodes around their actual source materials and continue existing production-stage columns:

1. Anchor to the rectangular bounding box of all `material.node_id` source nodes.
2. If upstream videos form a vertical stage column, place the composition in the adjacent column, vertically centered on the group, with about 60 px spacing.
3. Align coordinates to a 20 px grid and keep about 40 px of visible clearance from existing nodes.
4. For multiple compositions using the same materials, stack them vertically in the same composition column rather than extending a horizontal chain.
5. Preserve explicit patch `position` values and existing node positions. The wrapper only fills positions for new nodes without a supplied position.

Layout is excluded from the semantic checkpoint by default but is saved with the patch.
For an explicit layout request, use the strict `canvas sync --include-layout` workflow; do not expand automatic placement into a whole-canvas rearrangement.

## Example: Two Videos And One Audio Track

Assume successful source nodes: `video_01` has at least 5 seconds, `video_02` at least 6 seconds, and `audio_01` at least 10 seconds.
Use seconds 0–5 of the first video and 1–6 of the second for a 10-second sequence, with optional audio covering seconds 0–10.
This example demonstrates structure only: `42` is not a fixed version and the material IDs are not runnable project data.
If extra audio is unnecessary, remove the entire audio track while preserving the video track.

```json
{
  "schema_version": "canvas_agent_graph.v1",
  "base_edit_version": 42,
  "nodes": [
    {
      "node_id": "final_compose",
      "node_type": "video_compose",
      "title": "Two-video composition",
      "position": { "x": 420, "y": 80 },
      "style": { "width": 360, "height": 240 },
      "depends_on": ["video_01", "video_02", "audio_01"],
      "payload": {
        "tracks": [
          {
            "type": "video",
            "segments": [
              {
                "material": { "type": "video", "node_id": "video_01" },
                "clip": { "from": 0, "to": 5000 },
                "timeline": { "from": 0, "to": 5000 },
                "volume": 1
              },
              {
                "material": { "type": "video", "node_id": "video_02" },
                "clip": { "from": 1000, "to": 6000 },
                "timeline": { "from": 5000, "to": 10000 },
                "volume": 1
              }
            ]
          },
          {
            "type": "audio",
            "segments": [
              {
                "material": { "type": "audio", "node_id": "audio_01" },
                "clip": { "from": 0, "to": 10000 },
                "timeline": { "from": 0, "to": 10000 },
                "volume": 0.5
              }
            ]
          }
        ]
      }
    }
  ]
}
```

The sample coordinates assume two vertically arranged source videos on the left. Compute actual patch coordinates from the current graph.
Do not use `(420, 80)` as a fixed template or ignore current node relationships because the wrapper can supply omitted positions.

## Configuration And Rendering Lifecycle

`patch apply` saves composition configuration without starting a render. Report explicit states:

- `configuration_saved`: composition node and tracks saved, not rendered;
- `first_render`: no historical task or output; this dispatch is the first paid render;
- `resume_existing`: already running or waiting on upstream work; follow/reconcile the existing run instead of creating a new plan;
- `retry_render`: a failed historical attempt exists and the user requested a retry; this is a new paid task;
- `rerender_existing`: a successful output or history exists and this creates a new version; preflight only when the user explicitly requests rerendering.

Native composition has no image/video generation model. The confirmation sheet must show `Canvas native compose (no generation model)`, not `unknown model`.
This does not make it free: first renders, retries and rerenders require separate paid preflight.
Do not dispatch to view or reuse existing results or continue downstream nodes.

## Dry Run Is Optional

Normal composition: verify sources and contract → accept the current checkpoint and construct the patch → guarded `patch apply`
→ separate `canvas paid preflight` → authorize and execute under the returned policy → cloud follow-up and preview.

CLI apply and dry-run both perform structural and contextual validation through `preparePatch`.
Apply directly invokes the save endpoint without first calling dry-run and requires both `valid: true` and `applied: true` in its receipt.
Do not add a dry run for routine composition with known fields. Use it only for an explicit validation-without-saving request or a concrete combination that still needs validation after reading the contract.
A successful dry run does not guarantee a later version remains valid or establish generation authorization.
Preserve the Canvas Skill's version-conflict, uncertain-submission recovery, single-submission, readback and paid-plan guards; never retry blindly.
