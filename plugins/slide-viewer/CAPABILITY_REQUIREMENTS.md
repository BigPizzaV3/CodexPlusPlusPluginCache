# Slide Viewer capability requirements

Status: product requirements; comprehensive follow-up implementation in progress. Source review: 2026-08-22. Unchecked requirements are not claims of accepted support. See the [feature-level specialist comparison](PEER_FEATURE_COMPARISON.md), [implementation and remaining acceptance gaps](IMPLEMENTATION_STATUS.md), and the [machine-readable evidence manifest](scripts/slide-acceptance-manifest.json).

## Target and release boundary

The long-term target is a functional superset of the relevant viewing and exploratory-analysis workflows in QuPath, ASAP, Slim, Cytomine, Squidpy, Giotto, Cytosplore Viewer, Xenium Explorer, and CosMx/GeoMx analysis tools, with a modern UI and complete tool access. **UI operations ⊆ agent operations.** Agent tools may be a strict superset and need not fit into the UI. This includes presentation controls (theme, panels, mode), not only scientific analysis operations. Maintain a versioned, feature-level comparison; the ten groups below organize that work, not an exhaustive inventory or permission to mark a whole product covered by one example.

PR #1337471 was the opening, real-data, and tissue-first stage. The 0.1.53 follow-up added scientific workflows and a shared UI/tool contract; 0.1.54 excludes the native full-assay and reference-labeling engine under its permissive-only profile. These releases do not establish a completed superset or state-of-the-art performance. Instrument operation and raw acquisition decoding are not implemented; processed-output support does not close those gaps. This research viewer does not establish clinical or assay equivalence.

## Capability requirements

### 1. Whole-slide navigation

- [ ] Open real pyramidal slides with tissue visible; navigate actual resolution levels with correct orientation and coordinates.
- [ ] Identify embedded previews, missing microscopy, unsupported codecs, and partial loading explicitly.

Acceptance: real whole-slide fixtures exercise cold opening, fit/pan/zoom, tile changes, refresh, and recovery without blank or stale tissue. Benchmarks: [ASAP](https://www.computationalpathologygroup.eu/software/asap/), [QuPath](https://qupath.readthedocs.io/en/stable/index.html).

### 2. Multichannel and registered images

- [ ] Independently control channel visibility, color, intensity window, contrast, and opacity; expose applicable Z planes or projections.
- [ ] Inspect and preserve image-to-overlay registration, coordinate systems, and physical units.

Acceptance: known landmarks align across layers; channel values, transforms, and saved settings round-trip on real multichannel data. Benchmarks: [Xenium images](https://www.10xgenomics.com/support/software/xenium-explorer/latest/tutorials/nav-images), [Slim](https://github.com/ImagingDataCommons/slim).

### 3. Annotation and measurement

- [ ] Create, edit, label, delete, undo, and restore supported ROI geometries; measure calibrated distances, areas, and region summaries.
- [ ] Preserve stable annotation IDs, source coordinates, labels, and provenance through supported imports and exports.

Acceptance: geometry and measurements survive save/reload and format round trips; stale edits and unauthorized writes fail safely. Benchmarks: [ASAP](https://www.computationalpathologygroup.eu/software/asap/), [Cytomine annotations](https://doc.uliege.cytomine.org/user-guide/).

### 4. Quantitative pathology

- [ ] Distinguish imported masks from computed tissue/cell detection, feature extraction, and trained pixel/object classifiers.
- [ ] Retain algorithms/models, versions, parameters, measurements, and reviewable errors for every computed result.

Acceptance: validate applicable workflows against annotated real specimens; display predictions as predictions, with documented accuracy limitations. Benchmarks: [QuPath cell classification](https://qupath.readthedocs.io/en/stable/docs/tutorials/cell_classification.html), [pixel classification](https://qupath.readthedocs.io/en/stable/docs/tutorials/pixel_classification.html).

### 5. Spatial molecular exploration

- [ ] Provide distinct tissue, capture-spot/bin, cell-boundary, transcript-point/density, expression, and QC layers when the data supports them.
- [ ] Search genes/markers; inspect entity IDs, values, and available quality metrics; expose quantitative legends and filtering effects.

Acceptance: visible entities and region counts agree with source data; missing, zero, filtered, and inferred values remain distinguishable. Benchmarks: [Xenium transcripts](https://www.10xgenomics.com/support/software/xenium-explorer/latest/tutorials/nav-transcripts), [CosMx plotting](https://nanostring-biostats.github.io/CosMx-Analysis-Scratch-Space/posts/spatial-plotting/).

### 6. Linked exploration and atlas navigation

- [ ] Link tissue, embeddings, metadata, and cell-type hierarchies through stable entity IDs; support subset selection and comparison.
- [ ] Support inspectable differential-expression results and declared atlas mappings without treating transferred labels as ground truth.

Acceptance: selections identify the same entities across views; comparison inputs, methods, statistics, and exports are reproducible. Benchmarks: [Cytosplore Viewer](https://viewer.cytosplore.org/), [linked selection and differential expression](https://viewer.cytosplore.org/documentation/generaloverview).

### 7. Spatial analysis

- [ ] Support explicit neighborhood graphs, enrichment, spatial statistics, clustering, and applicable interaction analyses.
- [ ] Record normalization, graph construction, parameters, seeds, correction methods, and source subsets.

Acceptance: numerical reference tests and real-specimen workflows verify results; proximity or ligand–receptor scores do not imply proven communication. Benchmarks: [Squidpy API](https://squidpy.readthedocs.io/en/stable/api.html), [Giotto reference](https://giottosuite.com/reference/index.html).

### 8. Region-based profiling

- [ ] Join morphology, ROI/AOI masks, assay counts, metadata, and QC for region-based assays; support declared normalization and region comparisons.
- [ ] Preserve the distinction between region-level measurements and cell- or molecule-localization data.

Acceptance: region IDs, masks, counts, and summaries reconcile with supported processed exports; do not infer transcript coordinates from aggregate counts. Benchmarks: [GeoMx analysis inputs](https://brukerspatialbiology.com/support/knowledgebase/geomx-data-analysis/), [GeoScript Hub overlays](https://brukerspatialbiology.com/products/geomx-digital-spatial-profiler/geoscript-hub/).

### 9. Interoperability and collaboration

- [ ] Publish supported format/version/codec combinations, including separate acceptance for DICOMweb and DICOM SR/SEG/ANN/parametric-map workflows.
- [ ] Support durable shared projects, linked images, annotations, permissions, and explicit conflict handling.

Acceptance: authorized round trips preserve geometry and metadata; cross-user, read-only, expired-access, and concurrent-edit tests enforce permissions. Benchmarks: [Slim interoperability](https://github.com/ImagingDataCommons/slim), [Cytomine projects and roles](https://doc.uliege.cytomine.org/user-guide/).

### 10. UI/tool correspondence and automation

- [ ] Expose every semantic UI operation through a typed tool-accessible command/query contract with the same authorization and state effects.
- [ ] Add useful beyond-UI operations for bounded batch ROI, gene, QC, and neighborhood jobs, with provenance and resumable results.

Acceptance: each action has both UI-path and tool-path tests; acknowledged changes appear in the mounted viewer and survive supported replay/restore. Benchmarks: [Cytomine's shared secured API](https://doc.uliege.cytomine.org/dev-guide/), [QuPath workflow scripting and its coverage limitations](https://qupath.readthedocs.io/en/stable/docs/scripting/workflows_to_scripts.html).

## Proposed shared command/query contract

This is a design requirement, not a declaration of the current protocol.

- Queries return bounded metadata: permitted capabilities, authoritative revision, opaque source identity, viewport, layers, selection, and analysis/job state.
- Expose the same inspectable information as UI hover/inspection through entity queries; require semantic equivalence, not literal OS pickers or hover gestures.
- Commands use a shared discriminated action schema, for example `{ commandId, viewerSessionId, expectedRevision, action, args }`.
- Validate the same typed parameters at UI and server boundaries; bind source/session capabilities to the authenticated caller.
- Recheck permissions and capabilities for each operation. A path, model argument, cached state, or thread ID cannot create authority.
- Reject stale revisions explicitly; define idempotent retries and duplicate-command behavior without overwriting newer user actions.
- Keep source-content revisions, command identity/sequence, backend instance/generation, and viewer-state revisions distinct; validate each for its own purpose.
- Separate accepted/enqueued receipts from applied results. Return the resulting authoritative revision and mounted-UI acknowledgement.
- For data or viewport changes, acceptance checks the rendered result, not only an RPC success; closed or disconnected viewers cannot acknowledge application.
- Parsed/applied state fragments are not render readiness: verify required data/layers are loaded and the corresponding frame is actually presented.
- Keep queries source-preserving. Writes, exports, and shared-project mutations require the applicable grants and approved destinations.
- Tool implementations use the contract directly, never simulated clicks, hidden DOM manipulation, or consent bypass.
- Model-created regions remain coordinate selections. They do not count as user-drawn regions or authorize fresh image capture.
- Host-owned operations require real host capabilities; unavailable operations return an explicit unsupported/denied result, not simulated success.
- A UI-available operation without an authorized agent equivalent fails parity. Host ownership, presentation-only behavior, or optional scope is not an exemption.
- Record operation identity, source/revision, parameters, results, and errors without recording credentials or unnecessary specimen pixels.

## UI and interaction requirements

- [ ] Start with available tissue and an understandable layer summary; disclose missing images and preview resolution.
- [ ] Use progressive disclosure: basic navigation and inspection first, advanced analysis and channel controls when relevant.
- [ ] Search genes, layers, annotations, and commands; avoid long unsearchable lists.
- [ ] Provide keyboard access, visible focus, accessible labels, readable legends, and redundant cues beyond color.
- [ ] Make selection, filtering, and editing reversible; offer reset/undo with clear scope and protect unsaved work.
- [ ] Preserve state across supported inline/side-pane movement, refresh, and interrupted jobs; distinguish loading, empty, denied, and failed states.
- [ ] Evaluate task completion with representative researchers; visual polish alone is not usability or scientific correctness.

## UI action coverage required in CI

The table is the required inventory structure, not a report of existing coverage. Expand each family into every actual control, shortcut, and semantic gesture discovered by the action audit. Tests may automate browser interaction; runtime tools must not implement operations by simulated clicks. Each row needs a command/query identifier, real test identifiers, and observed results before acceptance. Maintain a machine-readable UI-action → agent-command/query coverage registry; CI must reject unmapped UI actions and missing or non-passing required evidence.

| Action family                                                        | Required UI/tool evidence                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Open/replace dataset and restore session                             | Same authorized source and visible result; denied/missing/unsupported source cases         |
| Pan, zoom, fit, focus, reset, display mode, supported host placement | Same final viewport/state and revision; no stale replay or fabricated host acknowledgement |
| Theme, panels/toolbars, presentation modes, and hover inspection     | Same presentation state; inspection queries return the same permitted entity information   |
| Image channels, intensity, contrast, opacity, and registration       | Same actual pixels/settings and transforms; unavailable channels are not synthesized       |
| Gene, cluster, molecule, density, and QC controls                    | Same selection/filter/domain, quantitative values, and visible entities                    |
| ROI/annotation creation, editing, selection, labels, delete, undo    | Same geometry/measurements/history; tool selection cannot grant image consent              |
| Segmentation classes, masks, and other layer controls                | Same visibility, style, class membership, and source provenance                            |
| Linked plots, populations, comparisons, and analysis settings        | Same entity IDs, subsets, parameters, and numerical results                                |
| Job start, progress, cancel, retry, and resume                       | Correct lifecycle, bounded work, no duplicate effects or success after failure             |
| Save/restore project and source-preserving exports                   | Same persisted result; approved destinations, conflicts, and denied grants tested          |

## Beyond-UI jobs and scientific safeguards

- [ ] Batch ROI summaries, marker panels, QC reports, and neighborhood analyses return structured tables and inspectable derived layers.
- [ ] Record specimen hashes/IDs, selected entities, method/version, parameters, normalization, seed, and output hashes as applicable.
- [ ] Declare limits on input size, entities, radius/neighbors, gene count, concurrency, output size, and runtime before starting work.
- [ ] Support progress, cancellation, safe retry, and provenance-checked resume; enforce limits while streaming and computing.
- [ ] Never invent cells, transcript coordinates, image channels, calibration, missing tissue, or registration.
- [ ] Distinguish measured values, computed clusters, predicted segmentation, transferred labels, and user annotations.
- [ ] Label units, transforms, normalization, color domains, missingness, and statistical uncertainty; do not equate expression with a diagnosis.
- [ ] Preserve source specimens and image-consent rules for all jobs; batch computation does not authorize sending new image pixels to a model.
- [ ] Image-bearing analysis/export uses explicitly approved regions and applicable host grants; model-specified geometry is not a consent event.

Classic Visium spots may contain multiple cells; bins and inferred cell segmentations are different representations. See [10x spot deconvolution](https://www.10xgenomics.com/support/software/loupe-browser/latest/analysis/assay-analysis/space-ranger-spot-deconvolution). A flattened tissue preview does not establish original-channel or full-resolution support.

## Evidence and release gates

- [ ] Use real, authorized specimens for every claimed modality/workflow; record provenance, license/access basis, exact size, and cryptographic pins.
- [ ] Fetch verified specimens into ignored caches; do not commit specimen binaries. Small fixtures supplement, not replace, realistic acceptance.
- [ ] Exercise the packaged runtime and actual host normalization/transport, then verify user-visible behavior on supported hosts.
- [ ] Measure p95 timings and peak memory for opening, navigation, layer changes, and representative jobs before choosing or releasing limits.
- [ ] Document specimen dimensions/entities/channels, machine, RAM, OS, browser/host, GPU/render mode, run count, and cold/warm conditions.
- [ ] Report process RSS, relevant heap/GPU memory, bytes read/transferred, and cancellation behavior against the same documented baseline.
- [ ] Release only measured capacity/performance claims; do not extrapolate a crop or single specimen to all whole slides or platforms.
- [ ] Run mandatory action/contract/browser checks with actual-result guards; missing, skipped, failed, or list-only cases cannot count as acceptance.
- [ ] Test denied grants, stale revisions, missing microscopy, uncalibrated coordinates, corrupt/truncated data, exceeded bounds, and interrupted work.
- [ ] Keep code checks, packaged tests, host acceptance, and peer-feature coverage separate; record remaining limitations in release wording.

Still-unqualified large-data targets: real 5–20 GiB WSIs with offsets beyond 4 GiB; 100,000/1,000,000 observations with 20,000 genes; million-cell/molecule datasets. These sizes are proposed tests, not supported-capacity claims or latency SLAs. Select appropriate authorized specimens before execution.

## Baseline gaps — audited 0.1.52 snapshot

Historical baseline: 2026-08-21. The table records the gaps this follow-up must address, not the current implementation state. Consult [the current status](IMPLEMENTATION_STATUS.md) before making a capability or release claim.

| Area                           | Current restriction or unproven behavior                                                                                                                                                                                                                                                                                                                                   | Source pointers                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime selection              | The shared MCP launcher prefers Codex-managed Node, starting with the host's `CODEX_MCP_NODE_PATH`, and falls back to an existing Node on `PATH` only if no managed runtime is found. Slide rejects runtimes below Node 22.23.2 before scientific imports. No runtime is downloaded or globally configured; installed-host runtime selection still needs qualification. | [launcher](.mcp.json), [platform runtime contract](../scientific-viewer-platform/package.json), [CI runtime setup](buildkite/pipeline.yml) |
| Image formats and registration | No DICOM or OME-Zarr opening; some OME-TIFFs use a representative plane, with no C/Z/T controls. H5AD supports one library and scalar registration, not general affine transforms or external high-resolution association.                                                                                                                                                 | [formats](src/slide/file-kind.ts), [TIFF](src/slide/browser-tiff-slide.ts), [H5AD](src/slide/h5ad-overlay.ts)                                     |
| I/O and memory                 | TIFF/SVS uses authorized range reads with a 32 MiB range/tile cap. Local H5AD buffers sources up to 64 MiB and eagerly reads whole sparse arrays; the file cap is not an expanded-memory bound. Native H5AD pages input but the frontend accumulates all observations before ready.                                                                                        | [server](src/server.ts), [H5AD](src/slide/h5ad-overlay.ts), [app](src/views/app.tsx)                                                              |
| Tissue preview                 | Embedded images are capped at 4,194,304 pixels. The registered 600-pixel mouse preview is not original-channel or full-resolution microscopy parity.                                                                                                                                                                                                                       | [image reader](src/slide/h5ad-tissue-image.ts), [fixture provenance](README.md#verified-public-sample-data)                                       |
| Geometry and analysis          | GeoJSON is parsed whole, without level-of-detail or entity joins; polygon-component counts are not cell counts. Clustering is bounded to 8,000 observations, 16 gene vectors, and 1,000,000 values, not the full transcriptome. Spatial CSV exports one gene and at most 10,000 observations; ROI measurements are rectangular pixel geometry, not cell/density analytics. | [GeoJSON](src/slide/geojson-overlay.ts), [clustering](src/slide/spatial-clustering.ts), [viewer](src/slide/slide-viewer.tsx)                      |
| Model-visible tool surface     | Default entrypoint exposes `slide.open_from_chat` and `slide.control_viewer` with 10 actions. No inspect/state/capabilities/catalog/entity-query/render-wait tool. Missing UI equivalents include four layer opacities, GeoJSON color/removal, spatial/segmentation removal, clustering choice/rerun, off-slide spots, theme, and direct viewport setting.                 | [server](src/server.ts), [actions](src/viewer-commands.ts), [controls](src/slide/viewer-controls.tsx)                                             |
| Host and export parity         | `slide.export_artifact` requires injected `artifactRuntime`, absent from the default entrypoint; host UI export is a separate authenticated capability. Native-session command consumption is unproven: a native session disables the fallback command-polling loop.                                                                                                       | [server](src/server.ts), [app](src/views/app.tsx), [artifact tools](src/persistent/slide-artifact-tools.ts)                                       |
| Large-data and peer acceptance | The 132.6 MB WSI and 704-spot/600-pixel crop do not establish the large-data candidates or peer-feature coverage. Feature-level UI/tool and native-host evidence remains required.                                                                                                                                                                                         | [real fixtures](README.md#verified-public-sample-data), action and release gates above                                                            |
