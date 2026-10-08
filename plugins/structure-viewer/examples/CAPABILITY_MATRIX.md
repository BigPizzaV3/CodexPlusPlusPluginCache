# Molecular Structure Viewer starter capability matrix

These three examples form a deliberately small portfolio: one quantitative interface analysis, one single-viewer structural comparison, and one provenance-bearing publication image. The machine-readable source and expected result contract is [`starter-examples.json`](starter-examples.json).

Status: **pending clean-host qualification**. The prompts and expected results are pinned, but this document does not claim final clean-installed-host coverage.

## Machine-checked contract identity

Contract SHA-256: `8c1a18e13d39faa5b4bb6ace30c49d50138ad9b49ab036fee2d6a12c12061376`

- `mdm2-p53-interface` capabilities: `public acquisition`, `single chat viewer`, `contact analysis`, `buried-area analysis`, `selection-scoped styling`, `selection labels`, `analysis provenance`.
- `adenylate-kinase-open-closed` capabilities: `public acquisition`, `single chat viewer`, `multiple structure objects`, `structural alignment`, `independent object styling`, `ligand styling`, `alignment diagnostics`.
- `gfp-publication-image` capabilities: `public acquisition`, `single chat viewer`, `selection-scoped styling`, `molecular annotation`, `publication PNG`, `workspace destination versioning`, `artifact integrity provenance`.

The digest covers the complete JSON contract, including source snapshots, budgets, exact numeric values and tolerances, executable tool requests, artifact invariants, allowed nondeterminism, and the downstream qualification runbook. The bundle validator recomputes it; this matrix cannot silently drift from the machine-readable contract.

## Final starter portfolio

### 1. Quantify the MDM2-p53 interface

> Open RCSB 1YCR once; analyze 4 Å MDM2–p53 contacts and buried area, label p53 Phe19/Trp23/Leu26, and report methods.

This example uses a 94,041-byte, 818-atom complex and demonstrates contacts, atom-disjoint buried-area analysis, method provenance, and selection-scoped styling of deposited author residues B:19, B:23, and B:26. The fixed checks are 105 atom contacts at 4 Å and 735.864963 Å² buried area with a 1.4 Å probe and 240 samples. The reported buried area is half the coordinate-derived Shrake–Rupley SASA loss, not the doubled interface loss, an affinity, or a binding-energy estimate. The pinned component SASAs are 5287.675647 Å² for chain A (705 atoms), 1613.478497 Å² for chain B (113 atoms), and 5429.424218 Å² for their complex. The total two-sided SASA loss is 1471.729925 Å²; the conventional mean interface area is 735.864963 Å², calculated as [SASA(A) + SASA(B) − SASA(A+B)] / 2. Independently rounded six-decimal component values can differ from the directly rounded total by 0.000001 Å². The executable absolute tolerances are 0 contacts and 0.01 Å² buried area. The final scene explicitly frames the complete primary complex at zoom 1.3 so the labeled interface remains prominent without clipping.

### 2. Compare open and AP5A-bound adenylate kinase

> Open RCSB 4AKE once; add 1AKE to the same viewer, align chain A, color teal/magenta, show AP5, and report RMSD/TM-scores.

<!-- prettier-ignore -->
The two inputs total 667,116 bytes and 7,275 atoms. The fixed alignment checks are 214 positions, 8.043719662 Å RMSD, and reference/mobile TM-scores of 0.683847026. Their executable absolute tolerances are 0 positions, 0.00001 Å RMSD, and 0.000001 for each TM-score. The plugin-pinned implementation is Mol* 5.11.0 `tmAlign`: one C-alpha coordinate per selected atomic protein residue is supplied to `tmAlign`, which determines the aligned correspondence. `structure.add_structure` must add 1AKE to the original viewer as `ap5a_bound`; a second chat open is not an acceptable implementation. The final scene explicitly frames the two represented chain-A objects from the left at zoom 1.15, excluding unrepresented chain-B atoms. The pinned projection keeps both conformers clear of the card edges while using the host-owned inline width more effectively, so styling cannot leave the shared viewer cropped or surrounded by artificial dead space from a transient active-site camera.

### 3. Render an annotated GFP chromophore image

> Open RCSB 1EMA once; style and label its chromophore; save a versioned 1600×1200 PNG to structure-viewer/gfp.png with sidecar.

This 190,188-byte, 1,866-atom structure exercises exact styling, a selection-anchored annotation, bounded PNG rendering, collision-safe workspace publication, and artifact integrity. The CRO chromophore has 22 heavy atoms; the expected closest-heavy-atom distances to Arg96, His148, Thr203, and Glu222 are 2.730334, 2.849985, 2.665839, and 2.813101 Å respectively. The PNG digest is intentionally not fixed across renderer environments. Every fixed distance uses an executable absolute tolerance of 0.00001 Å. Its canonical front camera frames the complete primary structure at zoom 1.15; the reported digest, file bytes, and provenance sidecar must agree exactly.

## Coverage

<!-- prettier-ignore -->
| User-visible capability | 1YCR | 4AKE + 1AKE | 1EMA | Portfolio decision |
| --- | --- | --- | --- | --- |
| Public, source-pinned acquisition | Yes | Yes | Yes | Every starter is self-contained. |
| Exactly one viewer card and active session | Yes | Yes | Yes | Required for every starter. |
| Contacts and buried interface area | Primary | — | — | Mechanistic analysis example. |
| Multi-object structural alignment | — | Primary | — | Both structures stay in one viewer. |
| Independent styling and molecular labels | Hot-spot residues | Object and AP5 styling | Primary | Purposeful state, not decoration alone. |
| Publication PNG | — | — | Primary | 1600×1200 within the advertised pixel budget. |
| Versioned workspace destination | — | — | Primary | Create-new, no-overwrite behavior. |
| Artifact and sidecar provenance | Analysis provenance | Alignment provenance | PNG plus `.render.json` | All reported methods or files retain provenance. |
| Movie/storyboard rendering | — | — | — | Documented capability; omitted to keep starters focused and fast. |
| Density maps and map statistics | — | — | — | Documented capability; requires a compatible map input. |
| Topology/trajectory playback | — | — | — | Documented capability; requires a compatible file pair. |
| Related-data browser | — | — | — | Documented capability; requires trusted source binding and colocated companions. |
| Project save/open | — | — | — | Documented persistence workflow; not an immediate starter payoff. |
| Scene, result, and coordinate exports | — | — | — | Documented follow-up workflows. |

## RCSB workspace capabilities

This table maps implemented inspector actions to their registered model tools and input paths. All routes use the mounted `sessionId`; scene mutations use the current `expectedRevision`. The source catalog contains exactly 41 model-visible tools, with separate app-only transport helpers. This is not additional coverage from the three starter examples and does not change their **pending clean-host qualification** status. The [workspace guide](../README.md#rcsb-style-inspection-and-export) explains the controls and source admission; the [action guide](MOLECULAR_WORKSPACE.md) lists the complete representation and preset vocabulary.

<!-- prettier-ignore -->
| Inspector action | Canonical model route and input | Material scope and limits |
| --- | --- | --- |
| Sequence selection and picking | `structure.query` and `structure.set_selection` with exact `expression` and `mode` | Set/add/subtract/intersect multiple residues without inferring author numbers from sequence positions. Query pages retain model, chain, residue, and assembly-copy identity. |
| Focus selection | `structure.set_selection` with the exact selected `expression`, `mode: "set"`, and `focus: true` | Preserves the selected atoms and records genuine molecular focus, including assembly-copy identity. The workspace `focus` action only frames the camera. |
| Inspector, ribbon, and drawer visibility | `structure.molecular_action` with `action.kind: "workspace"` | The same seven visibility/picking fields as the UI; closing a panel never deletes molecular data. Workbench and Render remain mutually exclusive. |
| Ribbon Structure, Mode, Entity, Chain, Layout, and known-sequence shortcut | `structure.molecular_action.action.sequenceView` for `kind: "workspace"`; compatibility `structure.control_viewer` with `action: "set_workspace_options"` | Shared live preferences: `objectId`, `mode`, `entityId`, exact `chain`, `layout`, or `showKnownSequence: true`. Atom/residue query pages provide actual author/label chain, entity, model, and instance IDs. No molecular selection changes; stale or ambiguous identities fail closed. These filters are session-only, not persisted in project manifests. |
| Structure model, assembly, dynamic bonds | `structure.apply_scene` with `activeObjectId` or `objectUpdates[].construction` | Select source-backed `kind`, `modelIndex`, `assemblyId`, and `dynamicBonds`; source replacement preserves identity checks and invalidates stale selections/guides. |
| Component presets | `structure.molecular_action` with `action.kind: "preset"`, `preset`, `target`, `presentation` | All 14 presets. `presentation: "workbench"` requires unscoped `{ kind: "all" }`; `"scoped"` applies to an exact component target. There is no model tool named `structure.apply_preset`. |
| Component add, style, color, visibility | `structure.apply_scene.layers[]`; scoped `structure.molecular_action` show/hide/color/label actions | All 18 canonical representations, typed `representationOptions`, and source-backed colors. A component `plane` is a molecular slice; component `orientation` uses per-unit ellipsoids, not selection guides. |
| Shared component options and computed interactions | `structure.apply_scene.representationOptions` or `null` to reset | Typed hydrogen/quality/material/clip options and bounded computed-contact settings; `interaction_type` colors actual interaction representations. Computation is limited to 200,000 atoms per loaded object. |
| View settings | `structure.apply_scene` with `camera`, `lighting`, `background`, and `viewSettings` | Camera helper, stereo, occlusion, shadows, outline, depth of field, fog, clipping, illumination, sampling, Hi-Z, sharpening, bloom, and resolution use the same typed fields. Stereo is live-perspective only; exported images/movies are monoscopic. |
| Local image and skybox background | `structure.browse_related_data`, then `structure.load_background` with returned image token(s) | Retain the fresh `callerId`/`commandId` pair. Admit one PNG/JPEG or six matching square faces, never paths/URLs/raw bytes. Durable SHA-bound descriptors are reauthorized for history/restore/rendering. Per-document native lifetime limits: 32 MiB encoded, 128 MiB RGBA/mip storage, 128 faces, including failures/reloads; native hosts need explicit image-purpose admission. |
| Measurements and selection guides | `structure.measure`; `structure.manage_guides.operation` create/update/delete/clear | Distance/angle/dihedral plus styled labels, principal axes, and best-fit planes. At most 128 guides and 100,000 exact atoms per guide; orientation/plane requires three non-collinear atoms. Removed/replaced sources invalidate rather than retarget guides. |
| Structure Motif Search | `structure.search_motif` with public accession, residues/operators, tolerances/exchanges, and paging | 2–10 public residue identities; at most 20 hits/page and 10 matches/hit, bound to `queryHash`. Selection prefill uses `structure.query`. No local coordinate upload or functional-equivalence claim. |
| Public density discovery and loading | `structure.discover_density`, `structure.load_public_density` | Actual RCSB/EMDB association and PDBe channels/precisions. Load requires an active workspace-read root before fetching; at most 16 MiB and 2,097,152 voxels/channel. New BCIF/provenance publication is separate from scene application. |
| Density appearance, zoning, and analysis | `structure.apply_scene.volumes[]`; `structure.analyze` | Contour level/type, color, opacity, style, visibility, and selection zone; genuine `density_fit`/`map_correlation` analyses. Local maps use `structure.load_data`. |
| Density in image/movie endpoints and export provenance | `structure.render_image.scene.density`, `structure.render_movie.scene.density` and scene keyframes; `structure.get_state.renderEndpoint` | At most 32 admitted channel appearances with exact source proof. Omission snapshots current density; `[]` hides all. Named endpoints carry explicit proof and movie transitions switch density at phase 0.5; rendering never fetches. `complete-source` hashes the admitted bytes, including a bounded public BCIF; `native-window` hashes displayed DX bytes, never the whole original map. Geometry provenance records visible nonzero-opacity channels. |
| Quality metrics, clashes, and PAE selection | `structure.quality_assessment` load/query/select; `structure.set_quality_assessment` | Query `metricId`, exact `residueIndices` or bounded `residueRegion`, and paging; select with the returned `selectionFingerprint`. Set metric/null, `displayClashes`, and `ignoreIssues`. Retained totals/truncation are explicit; absent PAE cells are not zero. Only load fetches public data. |
| Assembly symmetry | `structure.assembly_symmetry` load/query; `structure.set_assembly_symmetry` | Explicit public entry/assembly checked against the loaded source. Set `selectedIndex` (or null), `axes`, `cage`, and `clusterColors`. At most 64 records/16,384 members; asymmetric, missing, and failed responses remain distinct. |
| Export Models | `structure.export` with `format: "models-mmcif"` or `"models-bcif"` | All loaded atoms or `selection`; at most 128 object/model/instance members plus an identity manifest. Source categories accompany regenerated coordinates; unsafe identity remapping fails. Archive output is at most 16 MiB. |
| Export Geometry | `structure.export` with `geometry-glb`, `geometry-stl`, `geometry-obj`, or `geometry-usdz` | Actual visible render objects and instance transforms. GLB/OBJ/USDZ retain supported colors; STL does not. No selection parameter. Unsupported geometry/materials, clipping, or budget overruns fail before publication: **64 MiB expansion** and **16 MiB artifact** limits. Whole complexes can exceed the expansion bound; a deliberately smaller visible scope is not full-complex export qualification. |
| Advanced scene, coordinate, and table exports | `structure.export` with `scene-json`, `selection-pdb`, `selection-mmcif`, `selection-bcif`, or `results-csv` | Scene state, selected coordinates, or retained analysis rows with identity/coverage provenance. PDB fixed-width limits fail closed; mmCIF/BinaryCIF preserve richer identifiers. CSV carries reversible spreadsheet-safety metadata. |
| Screenshot generation | `structure.render_image` with `format`, `quality`, `autoCrop`, `cropPadding`, dimensions, and `destination` | PNG (default), JPEG, or host-supported WebP; JPEG rejects transparency. Crop and source/output dimensions are recorded. At most 4096² pixels and 64 MiB encoded; unsupported encoders fail explicitly. |
| Animation generation | `structure.render_movie.timeline` plus FPS, dimensions, quality/quantization, and `destination` | Typed camera spin/rock, molecular spin/unwind, trajectory animation, renderer time, and scene transitions, alongside existing ordered steps. Unwind requires an actual assembly; quantization maps to bounded bitrate, not constant-QP encoding. |
| Render validation, progress, and cancellation | `structure.validate_render`, `structure.get_render_status`, `structure.cancel_render` | Same target/workload validation and bounded artifact lifecycle as the UI. Generating an artifact and publishing it successfully are separate states. |
| Named scenes and history | `structure.save_scene`, `structure.list_scenes`, `structure.load_scene`, `structure.delete_scene`, `structure.undo`, `structure.redo` | Complete revisioned scene mutations and read-only inventory, not separate UI state. |
| Saved or live render endpoints | `structure.get_state` with `renderEndpoint: {}` or `{ sceneName }` | Returns `state.renderEndpoint.renderScene`, source revision, and opaque scientific references without loading/mutating a scene or disclosing raw science/measurement coordinates. Pass the complete render scene into image/movie requests or scene keyframes. Endpoints above 64 KiB or render cardinality limits fail without truncation; omission preserves ordinary state reads. |

Public-data/annotation tools, background loading, and related-data browsing are visible to both app and model. `structure.get_annotation_resource_info`, `structure.read_annotation_resource_range`, and `structure.background_assets` remain app-only, owner/session-bound transfer helpers; high-level model tools perform the corresponding complete operation. Public motif/annotation queries send explicit public identities, not local files. A user-requested density box sends its Cartesian box bounds to PDBe and must not be inferred from private coordinates without consent.

Clipboard and browser-download buttons are host delivery gestures, not separate scientific or export-generation capabilities. The model generates the same requested image format/crop and returns its authorized artifact or workspace destination; it cannot claim a browser gesture or clipboard permission. Geometry export errors likewise are not partial success. Source/unit/catalog checks establish the contracts above; native rendering, final built-catalog loading, and clean-host qualification have their own verification gates.

## Pinned public inputs

<!-- prettier-ignore -->
| Accession | RCSB revision | Bytes | Atoms | SHA-256 |
| --- | --: | --: | --: | --- |
| 1YCR | 1.5 (2024-02-14) | 94,041 | 818 | `d8f23749da9ec22da2e17bb31c33803e3db6123233cd0404bdc005111196e7a3` |
| 4AKE | 1.3 (2024-02-28) | 309,339 | 3,459 | `ff798ee8791878eb58bac1c6bed32042f51b455512ac93b50bda8fa0ff0e7f78` |
| 1AKE | 1.4 (2024-12-25) | 357,777 | 3,816 | `651e952f55f1317f50f4e82b7f0e99053397032cd8da5b2896f79d0af9f619a9` |
| 1EMA | 2.0 (2026-03-18) | 190,188 | 1,866 | `f1b9fdc2b871cc41f21f645a21b4948ce12d79b29197256330b108c9b503b088` |

The pinned 1EMA snapshot is also bundled as `examples/1EMA.pdb` for offline generic example requests. A changed revision, length, or digest is source drift and must be reviewed; it must not silently rewrite the expected scientific results.

## Qualification boundary

The dedicated qualification follow-up must run each exact prompt from the visible starter entry point on a clean installed host. Each run must preserve the public acquisition trace, prove one chat-open call/card/session, verify that downstream tools reuse the original session, capture the actual viewer, and compare every fixed numeric result with its declared tolerance. The qualification must also exercise the negative paths declared in the JSON contract.

For the GFP artifact, qualification additionally verifies versioned no-overwrite behavior, workspace-relative disclosure only, PNG dimensions and hash, matching sidecar integrity, and all-or-nothing publication. Screenshots, redacted traces, source and artifact hashes, logs, and the reproducible harness belong in the downstream qualification report, not in this pre-qualification matrix. The raw authorized source-open request may contain the absolute workspace path required by the tool; that argument must be removed from the published redacted trace and must never appear in UI, results, or provenance.
