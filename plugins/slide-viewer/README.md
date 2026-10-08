# Slide Viewer

Explore whole-slide microscopy and histology, digital pathology, spatial transcriptomics, spatial gene expression, and annotated tissue regions in an interactive research viewer inside Codex. Slide Viewer opens compatible pathology images (`.svs`, `.tif`, `.tiff`), supported DICOM slide series, spatial AnnData datasets (`.h5ad`) and OME-Zarr sources. It keeps the original specimen unchanged and grounds follow-up questions in the live viewer state.

Version 0.1.61 is a permissive-only release candidate with indexed molecular layers, microscopy and registration controls, supported quantitative research workflows, single-user projects and a shared UI/agent operation contract. It excludes the native scran runtime: new full-assay HVG/PCA/graph/UMAP/t-SNE and reference-labeling jobs are unavailable. Existing source embeddings and authenticated historical result artifacts remain inspectable. All changes live in this plugin or its shared scientific-viewer plugin, not the host. Consult the [implementation and acceptance matrix](IMPLEMENTATION_STATUS.md) for supported profiles and remaining gaps. This is not a claim of a completed QuPath/Squidpy/Xenium/Cytomine capability superset or of clinical validation.

## Start with a public example or your own slide

1. Choose a public-example prompt below, or add your own whole-slide image or spatial `.h5ad` file to the active Codex workspace.
2. Let Codex download and verify the requested public example in that workspace, or select an existing file and ask Codex to open it in Slide Viewer.
3. Start with the available tissue image or crop, then zoom, focus on an area, or select a region of interest.
4. Use **Open in side pane** to move the same live viewer beside your conversation without losing the current view.
5. Ask about what is actually visible, selected, or available in that viewer session.

Opening or interacting with the viewer does not automatically add slide context or tissue pixels to chat. Ask follow-up questions directly in chat. For manually opened native files, use **Ask about selection** or **Ask about this view**, and Codex calls `slide.get_context` for the referenced session and UI revision. The action shows sending, sent, or failed feedback and supports retry. **Return to chat** changes the viewer's placement. `slide.list_viewers` discovers previously referenced sessions successfully read in the conversation scope supplied by the host. It is not a list of every open viewer: a manually opened viewer first needs an explicit reference from one of its ask actions. If discovery is unavailable, use an explicit session reference; resolve ambiguous matches before interpreting a view or selection.

When a question needs pixels, Codex explicitly calls `slide.capture_image` for a fresh current viewport or a specified region. No previous manual region capture is required. A viewport image includes displayed overlays; a region image contains the current display-rendered source pixels within base-image pixel bounds. The response identifies the source, revision, capture time, bounds, dimensions, and pixel semantics. Metadata/document reads never capture images, and an earlier screenshot is not evidence of a later region or display state. If capture is unavailable, Codex can report verified coordinates and metadata without claiming to inspect tissue morphology.

A native preview uses its existing plugin command session for the same document and pure UI queries as a chat-opened view. Images stay tied to that exact native view instance/source revision or the current plugin source binding. Reading loaded documents or capturing a view does not create source-file grants, export permissions, or analysis authority; use the capabilities actually reported for the viewer.

The public examples require no external account or bundled specimen. If several supported files are present, specify the one you want rather than assuming that a particular dataset is available.

## Try these first

> Download OpenSlide’s full CMU-1 brightfield slide (132.6 MB), open it, and ask me to draw a region before inspecting tissue.

> Download Squidpy’s H&E mouse-brain crop, open its registered tissue image, and inspect the real spot and gene counts.

> Download Squidpy’s fluorescence mouse-brain crop and compare Slc17a7/Gad1 over its registered tissue preview, if present.

## Verified public sample data

Download samples on demand into the active authorized workspace, verify both the exact byte count and SHA-256 digest before opening them, and stop if either check fails. The plugin does not bundle slide or spatial-data binaries.

- **Full OpenSlide CMU-1 brightfield pathology slide:** [CMU-1-JP2K-33005.svs](https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1-JP2K-33005.svs) is a genuine whole-slide JPEG 2000 pyramid, not a small exported region. Its download is **132,565,343 bytes (132.6 MB)**; save it under that exact filename and allow for the larger transfer. SHA-256: `9a1923cd9bcb260ba4d99d64f8d6e32550648c332ba48817f920662f3a513420`. [OpenSlide's official metadata](https://openslide.cs.cmu.edu/download/openslide-testdata/index.json) publishes the same checksum and byte count and explicitly assigns CC0-1.0.
- **Squidpy mouse-brain H&E crop:** the [94,259,482-byte official H5AD mirror](https://exampledata.scverse.org/squidpy/visium_hne_adata_crop.h5ad) contains **684 Visium spots and 18,078 genes**, with its own registered **600×600 RGB H&E image** (plus a 180×180 preview). Save it as `squidpy-mouse-brain-hne.h5ad`. SHA-256: `9c9b277bde9f34a022df7f3e35b35ce7ecc80f006d6640b0786f4ace6f6eb5dd`, also published by the [official Squidpy registry](https://raw.githubusercontent.com/scverse/squidpy/main/src/squidpy/datasets/datasets.yaml). Attribute Giovanni Palla (2021), _Brain Coronal HnE Adata Crop_, [Figshare version 1](https://doi.org/10.6084/m9.figshare.13604177.v1), **CC BY 4.0**, and the original [10x Genomics mouse-brain coronal dataset](https://www.10xgenomics.com/datasets/mouse-brain-section-coronal-1-standard-1-1-0). The matching Figshare record identifies file `26098382`; its dataset license is independent of Squidpy's software license and the fluorescence record below. This is real, preprocessed spatial data with a cropped tissue preview; do not assume its `X` matrix is raw counts. Visium capture spots are not single-cell measurements, and the preview is not the full-resolution original section. Start with tissue visible and expression hidden; spots are an optional measured overlay, not a replacement for morphology.
- **Squidpy mouse-brain coronal fluorescence crop:** the [27,856,369-byte spatial H5AD](https://ndownloader.figshare.com/files/30639279) contains 704 spots, 16,562 genes, and its own registered 600-by-600-pixel tissue preview. Save it as `squidpy-mouse-brain-coronal.h5ad`. SHA-256: `c4caaa4b8708a46b0d4b4ae7390256034e78e02280da3ed16de1ca3a198cddf8`. Attribute Luke Zappia, Squidpy, and 10x Genomics. The [Figshare dataset record](https://figshare.com/articles/dataset/squidpy-visium_h5ad/16566057) explicitly licenses this dataset under CC BY 4.0; the underlying [10x mouse-brain section](https://www.10xgenomics.com/datasets/adult-mouse-brain-section-2-coronal-stains-dapi-anti-gfap-anti-neu-n-1-standard-1-1-0) was imaged with DAPI, anti-GFAP, and anti-NeuN fluorescence, not H&E. The H5AD's own spatial coordinates and scale factors place the spots over its embedded image. This is a cropped, 600-pixel preview, not the full original tissue section or full-resolution microscopy; it does not establish whole-slide performance. The viewer opens this registered tissue image first. Select a gene to enable its capture-spot overlay; use the independent image/spot visibility and opacity controls to compare it with morphology. The expression legend reports source values, the `log1p` color transform, and per-gene autoscaling, so equal colors across different genes do not imply equal abundance.

Use mouse gene symbols `Slc17a7` and `Gad1` with the mouse-brain example only when their exact names are present in the current dataset. Human markers such as `EPCAM`, `CD3D`, and `COL1A1` apply only to a compatible user-provided human spatial dataset that actually contains them. Expression-graph clusters are computed groups, not ground-truth cell types or validated tissue labels; show only clusters and spot counts available in the live viewer.

## Example research workflows

### Survey tissue architecture

> Open the H&E whole-slide image in my workspace, fit the entire tissue section, and show me how to select a region of interest.

> Focus on the region I selected, describe the observable tissue architecture, and distinguish what is directly visible from what remains uncertain.

### Explore spatial gene expression

> Open the public mouse-brain H&E .h5ad crop with its registered tissue image, show Slc17a7 and Gad1 when present, and report the available spot and gene counts.

> For a user-provided human spatial dataset, compare EPCAM, CD3D, and COL1A1 only when present and describe their visible patterns without assigning a diagnosis.

> Show the spatial domains or graph clusters available in the current viewer, focus on one existing cluster, and explain how it relates to my selected region.

### Inspect annotations and segmentation

> Help me add the matching GeoJSON annotation or CellViT-style segmentation overlay, then show which image, spatial, and annotation layers are visible.

> Isolate one segmentation class that is actually present and summarize where its annotated regions appear in the current view.

### Save an approved research output

> Report the base-level pixel coordinates of my selected region and tell me which source-preserving export options this session supports.

> If I have approved a destination and the host offers the capability, export the selected region or annotations without modifying the original slide.

GeoJSON and segmentation files are optional overlays added to an already-open slide; they are not standalone slide-opening entrypoints. Annotation drafts, project files and derived exports require the current source and destination capabilities. Saving a project never preserves image consent or grants permission to reopen its source paths.

## Capabilities

- Native file-tree previews through the app-only `slide.open` entrypoint.
- Chat opening through `slide.open_from_chat` with an exact root-confined workspace path, an opaque server-owned handle, and a returned `viewerSessionId`.
- Session-scoped typed control for viewport, presentation, panels/search, image/channel settings, layers/styles, annotation history, spatial selections and the scientific workbench. Capabilities are reported for the actual source and host.
- Bounded state, gene/layer/region/cluster/entity queries; expected UI revisions, idempotent command IDs and render-wait receipts. Opening a source returns `viewerReady: false` until a mounted viewer actually reports readiness.
- Same-instance movement between inline chat and the side pane, preserving viewport and viewer state.
- Pyramid-aware metadata, visible tile planning, and deck.gl rendering for TIFF and SVS slides.
- H5AD expression rendered over its own registered embedded tissue image when available, with the image's actual resolution and spot diameter; optional spatial transcriptomics, GeoJSON, and CellViT-style segmentation overlays.
- Compact on-demand context plus complete, revision-pinned document reads for loaded selections, layers, annotations, coordinates, microscopy, spatial expression, and existing results. Fresh viewport/region images use a separate explicit capture tool.
- Source-preserving annotation drafts and derived research artifacts when the current host explicitly authorizes those capabilities.
- Indexed dense/CSR/CSC H5AD observation and expression reads, explicit same-axis `X`/layer selection, source-provided embeddings and metadata, and explicit candidate/marker panels. Fresh indexed views open tissue and coordinates without reading a gene; an explicit selection loads a complete bounded vector and preserves the previous view on failure.
- Indexed cell/bin/molecule layers with stable IDs, source-backed QC/joins, exact filtered/ROI queries and a disclosed density overview; counts are not inferred from the currently rendered page.
- Source-backed ligand/receptor workflows and region-assay QC with bounded asynchronous execution, source identity, assumptions, durable recovery and inspectable artifacts. Independent exploratory PCA/Louvain remains limited to 8,000 loaded observations and 16 selected genes; it is not full-assay preprocessing. Native `hvg-cluster` and `reference-labels` requests and resumes fail explicitly in this release.
- Optional local StarDist nuclei, DNA/actin watershed regions and explicitly trained object/pixel classifiers. Models and references are separately provisioned; no job installs packages or downloads weights. See [PATHOLOGY.md](PATHOLOGY.md).
- Private single-user projects with compare-and-swap, source reauthorization, scientific-layer reimport and reversible annotations; source-preserving numeric TIFF/OME-TIFF outputs with explicit C/Z/T/ROI/projection semantics.

### Agent operations

Start with `slide.list_documents`, then use `slide.read_document` for an exact returned document ID or `slide.search_document` for a literal text query. Pass the returned document `revision` unchanged as `expectedRevision`; it tracks complete content independently from the numeric render revision. Reads cover a range or explicit `full: true`, which assembles revision-pinned chunks up to the response budget. If `eof` is false, repeat with `offset: nextOffset` and the same `expectedRevision`; there is no total-document truncation ceiling. The catalog includes overview, selections, layers, annotations, coordinate frames, microscopy, spatial data, analysis state, existing results, and per-gene expression documents. Gene reads preserve physical observation/column identity and the selected matrix without changing the displayed gene. Domain queries remain optional typed shortcuts; `slide.get_context` provides a compact metadata snapshot. Loaded documents do not claim whole-assay coverage or original binary-file bytes; complete-source tools keep their existing source grants and format/compute limits.

Mounted session references survive ordinary backgrounding and eight-hour sleep. Native teardown releases its exact bound presentation; ordinary chat sessions can be shared across replacement frames and expire after 24 hours without accepted renderer activity. The same inactivity deadline reclaims crashed native sessions and their source capabilities. Model reads do not extend it. A disconnected viewer that crosses it requires existing saved-access recovery or a fresh authorized open, followed by current source and render verification.

`slide.capture_image` accepts `sessionId`, optional numeric `expectedRevision`, and `target: "viewport" | "region"`. Region reads require `bounds: {x, y, width, height}` in base-image pixels; viewport reads use the current viewport and omit bounds. Captures leave camera, selection, and scientific state unchanged. Images are display renderings with bounded resolution, not raw quantitative samples. The legacy `slide.get_selected_region_image` reads a prior user-selected capture and explicitly reports `freshness: "existing_user_capture"`; it is not a substitute for a fresh capture. `slide.list_viewers` recalls previously read sessions only when the host supplies trusted conversation scope.

| Purpose                                  | Model operations                                                                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open and control                         | `slide.open_from_chat`, `slide.open_ome_zarr`, `slide.open_dicom_series`, `slide.open_dicomweb_wsi`, `slide.control_viewer`                                                                                                                              |
| Inspect and await a frame                | `slide.get_viewer_state`, `slide.get_capabilities`, `slide.query_viewer`, `slide.wait_for_render`                                                                                                                                                        |
| Read or search viewer data               | `slide.list_viewers`, `slide.list_documents`, `slide.read_document`, `slide.search_document`; optional compact `slide.get_context`                                                                                                                       |
| Capture current viewport or region       | `slide.capture_image`                                                                                                                                                                                                                                    |
| Command search and channel display       | `slide.control_viewer` actions `set_command_search` and `set_microscopy_selection`; the same palette state and channel settings used by the UI                                                                                                           |
| Indexed expression and spatial data      | `slide.spatial_indexed`, including its bounded `matrices` catalogue; `slide.control_viewer` action `set_spatial_matrix`                                                                                                                                  |
| Molecular layers and entities            | `slide.import_scientific_layer`, `slide.list_scientific_layers`, `slide.query_scientific_layer`, `slide.get_scientific_entity`, and import status/cancel/authorization renewal                                                                           |
| Exploratory spatial analysis             | `slide.import_analysis_source_from_chat`, `slide.run_analysis_from_chat`, `slide.get_analysis_from_chat`, `slide.cancel_analysis_from_chat`                                                                                                              |
| Source-backed durable workflows          | `slide.import_workflow_source`, `slide.run_workflow`, `slide.get_workflow`, `slide.cancel_workflow`, `slide.resume_workflow`, `slide.read_workflow_artifact`                                                                                             |
| Apply computed results                   | `slide.control_viewer` action `apply_workflow_artifact`; `slide.read_live_workflow_projection` reads an already verified, source-bound projection without restoring files or starting a job                                                              |
| Bounded research pathology               | `slide.run_pathology`, `slide.get_pathology`, `slide.cancel_pathology`, `slide.resume_pathology`                                                                                                                                                         |
| DICOM semantics and read transport       | `slide.import_dicom_object`, `slide.export_dicom_object`, `slide.query_dicomweb`, `slide.inspect_dicomweb_instance`, `slide.read_dicomweb_object`; `slide.import_scientific_layer` with `kind: "dicom-annotation"` requires an exact opened image target |
| Explicitly requested DICOM upload        | `slide.prepare_dicom_upload`, `slide.submit_dicom_upload`                                                                                                                                                                                                |
| Single-user projects and numeric exports | `slide.control_viewer` actions `save_project`, `load_project`, `recover_project`, `resume_project_save`, `export_microscopy_region`                                                                                                                      |
| Captured-view artifacts                  | `slide.control_viewer` actions `set_export_options` and `export_view`; source-bound GeoJSON/measurement/spatial tables, portable projects/bundles and eligible source PNG                                                                                |

The [semantic registry](https://github.com/openai/openai/blob/master/chatgpt/oai-maintained-plugins/plugins/slide-viewer/src/viewer-action-registry.ts) is shared by schemas and acceptance checks. Use current opaque session/source identifiers from actual tool results. An accepted source or queued command is not an applied, rendered result. Every semantic UI operation has a typed agent counterpart. The agent additionally has bounded queries and batch/workflow operations that need not occupy the toolbar. Actual availability depends on the current source, initialized host and grants. For privileged work, a UI gesture sends an explicit request through chat; only a subsequently authorized model call can admit a job or prepare the exact file write. Chat delivery, admission, application and rendering are distinct states. Native mount correlation never turns a native resource ID into a plugin file grant.

Use `slide.query_viewer` with `selected_observations` to read the complete ordered UI selection; the ordinary snapshot includes at most 250 IDs. `microscopy_scenes` returns one complete scene per page, including channel names and the exact `defaultSelection` used by the UI. Its source is the current image, which can differ from the analysis overlay. Start at `offset: 0`, then reuse the returned `nextCursor`, exact `nextOffset`, and the same limit/filter. A source, selection, matrix, or scene-catalogue change invalidates the relevant continuation; restart rather than combining pages from different lifetimes. A cursor grants neither source access nor image-capture consent. Omitted terminal nulls are accepted only when the counts prove the page is complete.

The four exploratory-analysis `*_from_chat` tools are the guarded model routes. Their older names without that suffix are app-only and cannot substitute for current model authorization. A requested run, retry or cancellation does not change a job's reported status until the server confirms it.

AnnData matrix choices are literal source data, not display normalizations. `X` and `layers/<name>` share the main feature axis; `{kind: "raw"}` selects `raw/X` with its independent `raw/var` axis and the same actual observations. Select from the source catalogue using its matrix revision. Expression reads, workflows, lazy vectors, portable projects and spatial CSV retain that choice; omitted legacy selections mean `X`, never the visible alternate matrix. Neither a layer name nor `raw/X` establishes count scale. Alternate-matrix normalization reads every selected-matrix feature rather than borrowing `obs/total_counts` or summing the displayed gene panel.

Gene selections can include the source-bound physical `column` returned by the current gene query. The UI and `set_spatial_gene` use the same reference, so duplicate symbols remain distinct. Name-only selection requires a unique source match; changing matrices clears a missing or ambiguous gene and hides its expression instead of choosing a default or intersecting features. Portable reopening verifies the saved matrix and physical column against the fresh source. A native transport that cannot verify the requested matrix preserves its recipe but marks restoration unavailable; it must not silently display `X` in its place.

Computed PCA, cluster and reference-label projections require a completed artifact's exact hash and an actual physical observation-index/ID join. Missing or excluded rows and uncertain predictions remain explicit; applying a result does not recompute it or turn it into source metadata.

The Commands button and viewer-scoped Cmd/Ctrl+K open a keyboard-searchable palette of existing typed commands, with current capability and export-scope checks. `set_command_search` changes its `visible` and/or `query` fields independently of gene/layer search; the current values are reported in `presentation.commandSearch`. The palette is transient and does not reopen from a saved project. Scrolling its results or the toolbar does not pan the tissue. Channel opacity is a separate `0..1` display weight for each microscopy channel (omitted means `1`), applied after intensity window/gamma conversion. It does not change numeric source samples. Change only the intended channel in the current `set_microscopy_selection` payload; no-op selections retain the current capture, while actual display changes invalidate it.

DICOM upload is a separate external-write operation, never a consequence of opening, analyzing or exporting a slide. It requires an explicit user request naming the original files and exact public HTTPS destination, current read/network authority, and a private one-use preparation bound to the body and source hashes. Original files are not de-identified. Partial or indeterminate receipts must not trigger automatic retries; controlled protocol tests do not establish live endpoint or human-consent acceptance.

## Scientific boundaries

Use this viewer for research and exploratory interpretation, not for clinical diagnosis, tumor grading, treatment decisions, or independent validation of segmentation labels. Distinguish observed tissue morphology, measured gene expression, computed spatial clusters, predicted segmentation classes, and user-authored annotations. Report gene markers, cell classes, specimen calibration, and image-to-overlay registration only when the current dataset or viewer state actually provides them.

## File access

Native file-tree opens keep the host resource URI opaque. During `slide.open`, the plugin uses the host-injected `openai/resource.path` when available, or resolves the safe basename to one unique canonical file inside active local MCP workspace roots. The canonical path remains in the server process; the iframe receives only the opaque resource URI. Native file input and host-owned path metadata follow the [OpenAI MCP Extensions file-handler contract](https://github.com/openai/mcp-extensions-internal/blob/82abe0ab6d76a43e377e9710403cf0b3d14a8b81/docs/spec.md#filesystem-access); this route still requires active roots.

Chat opens use the exact workspace path and prefer the standard [MCP roots capability](https://modelcontextprotocol.io/specification/2025-11-25/client/roots). The server requests `roots/list` only when the client advertises it; an empty or failed advertised-root response remains a denial. The server verifies canonical containment and returns an opaque viewer handle with a 30-minute sliding expiry. Paths outside active roots, symlink escapes, ambiguous names, and unsupported formats fail closed.

If a saved source or session is no longer available after expiry or a plugin restart, the viewer stops retrying the obsolete reference. When the original path is known, **Request fresh access in chat** asks for a new authorized open of the existing file; otherwise, reopen it from chat or the file picker. Historical paths and session IDs do not grant access, and a sent request does not establish recovery. A fresh open may create a new viewer card and must verify the current source and rendered frame.

Pane changes retain the last positive viewport while the frame is hidden and reconcile its canvas when it becomes visible. Presentation deadlines remain distinct from upload failures: a current timeout appears once and clears after the relevant frame recovers. Host acceptance of a pane move alone does not establish a ready image.

For Codex clients without roots, an audited adapter can consume current host-injected `codex/sandbox-state-meta` only inside a private guarded model request. It is not a standard MCP root or native-file grant. Widget metadata is not trusted. Scope remains the proven readable workspace, never a full-disk permission expansion. Unsupported policies fail closed. The initialized transport, descriptor exclusion, bounded read leases, revocation limits and anonymous HTTPS policy are documented in [SOURCE_AUTHORITY.md](SOURCE_AUTHORITY.md).

Optional protected-path entries may carry Codex's `missing_path_behavior: "skip"` annotation. The adapter accepts that annotation without treating missing paths as grants; unknown missing-path behaviors remain unsupported.

The chat-open tool is model-only, disables legacy widget accessibility, and declares `openai/fileParams: ["path"]`, which also blocks widget-originated calls on Codex hosts whose local-tool bridge does not yet enforce MCP Apps visibility. The viewer receives only the resulting source/session capability, never filesystem permission metadata. Thread IDs, tool arguments, and process working directories do not establish workspace authority.

The standalone development harness reads ignored fixtures under `manual-fixtures/`. Do not commit whole-slide specimens or H5AD matrices.

## Supported files

- `.svs`: Aperio-style whole-slide pathology images.
- `.tif` and `.tiff`: tiled whole-slide histology images.
- `.h5ad`: supported AnnData expression matrices, with spatial viewing when actual coordinates are present. Matrix-only files expose matrix/analysis controls, not invented tissue coordinates or images.
- `.dcm` and `.dicom`: supported Part 10 slide instances/series and separately inspected derived objects, not arbitrary medical DICOM.
- OME-Zarr/NGFF directories or explicitly authorized anonymous HTTPS roots, opened with `slide.open_ome_zarr`. An authorized `manifestPath` can supply explicit SHA-256 object pins for servers without strong validators.
- Explicit public DICOMweb WSI instance lists through `slide.open_dicomweb_wsi`, with bounded native frame-to-viewer tile assembly and either strong resource validators or a complete, representation-bound SHA-256 manifest. This is not automatic series discovery or authenticated clinical endpoint support.

OME-TIFF scene/channel/Z/T/projection controls require compatible metadata and a qualified pixel codec. `slide.open_ome_tiff_series` accepts up to 16 explicitly authorized TIFF/XML originals and 32 scenes, verifies UUID/member/plane mappings, and supports complete portable project recipes. It never searches for companion files or restores saved grants. Raw, Deflate, LZW, PackBits and supported baseline JPEG paths retain distinct read/decoded budgets; missing members and unqualified layouts/codecs fail explicitly. Numeric exports preserve selected source values, including lossless promotion of packed 1/2/4-bit samples to UInt8. Native PNG requires genuine grayscale or packed RGB samples, not three unrelated scalar planes. See [the format support inventory](FORMAT_SUPPORT.md) and [capacity boundaries](IMPLEMENTATION_STATUS.md#images-and-files).

Numeric TIFF/OME-TIFF export also supports metadata-qualified native Gray/RGB 8/16-bit local TIFF/SVS/DICOM planes. A selected reduced level must map inward to the same genuinely user-captured base rectangle; native dimensions, IFD/SOP/frame identity, declared or inferred calibration and any source color decoding are recorded. Unsupported sample profiles never become eligible solely from their file extension. Remote DICOMweb display pixels are not source-native quantitative export support.

Public DICOMweb project recipes require complete metadata/frame SHA pins for the explicitly selected instances. They preserve topology and resolved delivery representations and reopen under fresh authorization; they do not prove an atomic origin snapshot or publisher authentication. Metadata-only annotation/measurement exports also support strong-validator sources. Remote PNG and native numeric exports remain unavailable. Local ANN/SR objects can become indexed annotation layers only after the plugin verifies their actual image references and geometry against the opened target; an SOP UID supplied by a caller is not alignment or access authority.

Compatible `.geojson` or `.json` annotation and segmentation files can be loaded as overlays from inside the viewer after a supported slide is open.

## Development

Use the repository's exact Node pin for development and the frozen package-local workspace. The shared MCP launcher uses a Codex-managed Node runtime when available and falls back to an existing Node on `PATH` only if none is found; it does not download or globally configure Node. The Slide bootstrap still rejects runtimes older than Node 22.23.2 before loading scientific dependencies. Codex supplies its bundled runtime through `CODEX_MCP_NODE_PATH` on supported hosts.

```sh
corepack pnpm install --frozen-lockfile
node scripts/prepare-runtime-inputs.mjs hydrate
node scripts/prepare-runtime-inputs.mjs install-fixture
pnpm run dev
pnpm run check
pnpm test
pnpm run test:contracts
pnpm run build
pnpm run bundle
```

The preparation commands use the repository's authenticated blob API and its approved Unix-compatible Python tooling to verify and stage the rebuilt JPEG-2000 inputs and the pinned 16-observation HDF5 software control. Windows CI consumes these same source-pinned bytes from a short preparation job, independently of the Linux tests. Its authenticated source archive supplies the pins, and its build retains archive provenance; runtime inputs are content, not evidence that another test job passed. Ordinary builds remain offline and consume the verified cache. Rebuild inputs, SDK versions, notices and receipts are documented in `runtime/openjpeg-wasm/README.md` in the source checkout. CI prepares the inputs before building and installs the control before testing. To prepare only the lifecycle unit-test fixture on a local checkout:

```sh
node --input-type=module -e 'const { prepareCiControlledMatrixFixture } = await import("./scripts/prepare-ci-opening-fixture.mjs"); await prepareCiControlledMatrixFixture();'
```

Open the development harness at <http://127.0.0.1:5173/>. The preferred local fixture is `manual-fixtures/hest/TENX199/wsis/TENX199.tif`; when present, the harness opens it by default.

Direct fixture URLs:

```text
http://127.0.0.1:5173/?slide=hest/TENX199/wsis/TENX199.tif
http://127.0.0.1:5173/?slide=hest/TENX199/st/TENX199.h5ad
```

The TENX199 harness auto-pairs the TIFF or H5AD with `manual-fixtures/hest/TENX199/cellvit_seg/TENX199_cellvit_seg.geojson` when that fixture is available.

### Packaged opening regression gate

`pnpm run test:opening` builds `bundle/slide-viewer/`, verifies the pinned public datasets, runs packaged-server integration tests, then opens the packaged widget in Chromium. It uses the real stdio MCP server, `slide.open_from_chat`, the advertised HTML resource and MCP-app MIME type, and Codex's actual `normalizeCallToolResult`; the app bridge and renderer are not mocked.

The main cases open the real 132.6 MB CMU-1 whole-slide pyramid, the 684-spot mouse-brain H&E crop, and the 704-spot mouse-brain fluorescence crop. They require actual image tiles, registered expression, working image/expression layer toggles, marker selection, and computed clusters on the original session. Integration checks compare decoded pixels against the pinned specimens; the H&E case also checks independently calculated marker-expression hashes. Spatial cases must still show microscopy with the expression layer hidden; colored dots alone cannot pass. The pathology integration case also removes `Promise.withResolvers` in its isolated server process, so the packaged JPEG-2000 decoder must work without that newer host-runtime API.

Additional cases use a **49-spot software-test fixture** and a generated 2-by-2 TIFF for fast regressions: globals-only, notification-only, and combined startup delivery; input replay; incomplete pagination; missing readable-resource metadata; and exact decoder colors. Those fixtures are not scientific demos. All nine browser cases and five packaged integration cases must actually pass; a successful open-tool response alone is insufficient. The real spatial crops still do not establish full-resolution whole-brain performance.

CI requires this gate alongside the source profiles for Slide Viewer, shared-platform, and relevant host-normalizer changes. Missing fixtures, browser failures, or skipped required cases fail the gate. JSON reports and bounded failure diagnostics are written under `test-results/opening/`; optional large-file qualification flags do not disable it.

Fixtures are downloaded on demand, checked by byte count and SHA-256, and never committed or included in the plugin bundle. Set `SLIDE_VIEWER_OPEN_FIXTURE_ROOT` to reuse downloaded files under the names in `scripts/prepare-opening-tests.mjs`. This gate requires the actual host normalizer supplied by the authorized checkout/CI environment; preparation fails when it is absent. Do not substitute a local imitation or copy host files around an access restriction.

The source profiles are disjoint and their union is the complete ordinary source suite:

| Command                          | Purpose                                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run test:fast`             | Scientific algorithms, parsers, protocol state, and mounted UI; pure Node tests stay here.                                                                                                                      |
| `pnpm run test:native`           | Actual filesystem authority/persistence, SDK subprocesses, cancellation/drain, OS process guards, and sparse-directory reads. CI runs these OS contracts on Linux and in three native Vitest shards on Windows. |
| `pnpm run test:packaged`         | The five packaged-server integration cases against an already prepared bundle and pinned fixtures.                                                                                                              |
| `pnpm run test:opening`          | Builds/prepares that bundle, then packaged integration and the nine real opening browser cases. Source profiles are required separately.                                                                        |
| `pnpm run test:physical:bigtiff` | Direct Vitest execution of the actual ≥16-GiB physical case; requires `SCIENTIFIC_SLIDE_PHYSICAL_QUALIFICATION=1`.                                                                                              |

`vitest.profiles.ts` lists native contracts; the fast profile selects every other source test. Add new actual OS-boundary tests to that list. Node versus jsdom is an environment choice, not a proxy for this classification. Native workflow tests require OS process inspection (`ps` on macOS/Linux and trusted process queries on Windows). A restricted sandbox that blocks it fails the prerequisite explicitly; use a permitted native execution environment without disabling the production memory/orphan guards. Fixture-gated public-corpus and browser cases retain their explicit opt-in requirements; a default skipped case is not qualification evidence.

`pnpm test` and `pnpm run test:unit` remain source-only checks. Standalone browser execution on macOS or Windows requires explicit approval and `SLIDE_VIEWER_ALLOW_BROWSER_TESTS=1`; the suite uses one software-rendering worker with failure-only screenshots and no video or tracing. For a Codex Web View check, build the bundle, run `node scripts/prepare-opening-tests.mjs`, start `pnpm run test:opening:host`, and open its local URL through the in-app browser. This controlled host-contract check is separate from acceptance of an installed Codex task card.

### Comprehensive qualification

`pnpm run test:contracts` checks launcher behavior, emitted-input licensing, runtime-input integrity, archive bytes, and browser resource guards without starting a browser. `pnpm run test:contracts:opening` is an alias for that command. Scientific calculations, source authority, and persistence have dedicated source tests.

`pnpm run test:acceptance` builds and prepares the installed package, then runs the spec files discovered by `playwright.acceptance.config.ts`. `pnpm run test:e2e` invokes the same command. Retained scenarios exercise source, rendering, workflow, publication, and persistence behavior. Their private controlled driver supplies simulated fixture authority; installed-host authorization and human consent require separate evidence.

CI uses standard project selection and ten-minute jobs. Acceptance uses separate native Playwright projects for ordinary workflows, scientific analysis, and source/rendering/publication controls, with five, four, and ten shards respectively. Each shard uses one software-rendering worker and no retries. Each shard builds and verifies its own installed package; opening checks run separately. Playwright's exit status determines each browser job's result. Reports and failure diagnostics are written under `test-results/opening/`. The acceptance manifest supplies specimen pins and the declared clustering genes. Repeated cold/warm benchmarks and their sampled-memory gates have been removed; installed opening still verifies the genuine pathology slide, and ordinary acceptance exercises the pinned Visium source.

Use the source checkout's [browser test guide](https://github.com/openai/openai/blob/master/chatgpt/oai-maintained-plugins/plugins/slide-viewer/e2e/README.md) for discovery and focused commands. Independent specimen operations are separate tests; cosmetic tours and synthetic receipt-validator matrices have been removed. A passing run qualifies the behavior actually exercised, not every rendered control or scientific method.

Builds record the source revision/tree, dirty state, full packaged runtime digest, operation registry and individual payload digests in `dist/build-provenance.json`. The controlled host revalidates the actual package before starting it. A dirty build can support development diagnostics, not release acceptance. Functional CI does not qualify p95 performance or memory limits. Installed-host, scientific accuracy, usability and specialist-parity evidence are separate requirements in the [status matrix](IMPLEMENTATION_STATUS.md).

## JPEG 2000 attribution

JPEG 2000 whole-slide tiles are decoded locally with a reproducibly rebuilt OpenJPEG 2.5.4 WebAssembly runtime and the PDF.js 5.4.296 decoder integration. The source pins, Emscripten 4.0.13 toolchain closure, build recipes and qualification boundaries are documented in [the native runtime source record](https://github.com/openai/openai/blob/master/chatgpt/oai-maintained-plugins/plugins/slide-viewer/runtime/openjpeg-wasm/README.md). The installed plugin retains the build receipts under `dist/vendor/openjpeg-wasm/` and the complete collected notices in `dist/THIRD_PARTY_LICENSES.txt`, including:

- `dist/vendor/openjpeg-wasm/LICENSE` contains the PDF.js Apache License 2.0.
- `dist/vendor/openjpeg-wasm/wasm/LICENSE_OPENJPEG` contains the OpenJPEG BSD license and copyright notices.
- `dist/vendor/openjpeg-wasm/wasm/LICENSE_PDFJS_OPENJPEG` contains the Mozilla Foundation OpenJPEG integration license.

## Distribution

`pnpm run bundle` writes the ignored bundle to `bundle/slide-viewer/`. Packaged payload changes require a plugin version increase so existing installations refresh the complete bundle.

The plugin is developed and released through the maintained plugin catalog under its existing alpha-access policy. A source PR, local bundle and approved publication are separate operations.

The license-qualified payload is the exact `bundle/slide-viewer/` directory, not the development source tree. Human publication must select that verified directory explicitly with the existing plugin identity. The registered-source publishing path recursively packages development files and is not covered by this runtime license report. Source patches and test/dependency directories are deliberately absent from the portable bundle.

**The 0.1.61 bundle excludes scran.js and its compiled native runtime, lz4js, ml-matrix and ml-pca.** Bounded first-party LZ4 decoding, small-panel PCA and classifier Cholesky solving preserve the independent features that previously used the latter three packages. Builds collect contributing JavaScript/CSS modules, inline-worker modules and copied runtime files, reject excluded or unreviewed licensing, and retain hash-bound embedded/native reviews and exact notices in `dist/shipped-licenses.json` and `dist/THIRD_PARTY_LICENSES.txt`. Bundle validation rechecks the final runtime and notices after copying. The allowlist and source-review boundaries are documented in [third-party notices](THIRD_PARTY_NOTICES.md); these technical checks are not a legal opinion or publication approval. Optional pathology runtimes and public specimens are not bundled or silently installed.
