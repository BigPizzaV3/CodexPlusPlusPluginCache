# Biological Sequence & Alignment Viewer

`sequence-viewer` is an MCP App-backed biological sequence and multiple-sequence-alignment workbench for Codex. It contributes native file-preview entrypoints and a combined Sequence / Alignment surface whose source is read-only by default while analyses, annotations, edits, tracks, and derived artifacts live in a bounded reversible workbench. The [capability matrix](CAPABILITY_MATRIX.md) documents the implemented UI, UI-to-agent mappings, scientific limits, and remaining specialist-product gaps; this package does not claim a complete Jalview/IGV/SnapGene/Benchling/FastQC superset.

## Product model

The plugin is one biological artifact surface rather than two unrelated viewers. Biology-specific classification happens inside the plugin, so Codex core only needs to route a supported file to one rich viewer.

- **Sequence mode** supports record inspection, searchable/editable annotations, exact compound features, distinct origin-aware linear/circular/split maps, reverse-complement projection, genetic-code-aware translation/ORFs, bounded descriptive FASTQ quality reports, ABIF/SCF trace inspection, verified-revision SnapGene imports, primer/restriction exploration, reversible sequence-copy edits, regional read pileups, and persisted exports/sessions.
- **Alignment mode** supports virtualized rows/columns, references, differences, consensus/conservation, row/column selection, grouping, sorting and safe edits, realignment, distance matrices, and synchronized graphical exploratory NJ/UPGMA trees.

The sequence/alignment remains the primary surface. Compact tool panels reveal display settings, inspection, analysis, editing, evidence, export and history when requested; nested sections and bounded record/annotation browsers avoid an always-expanded control wall. Typed controls operate the same registered panels and disclosures, with guards against hiding pending approvals or active manual-copy feedback.

The default mode is chosen by the plugin-local artifact classifier:

- single-sequence FASTA, unaligned FASTA collections, GenBank, EMBL, FASTQ, supported ABIF/SCF traces and SnapGene DNA containers open in Sequence mode;
- explicit MSA containers and strongly aligned FASTA open in Alignment mode;
- ambiguous equal-width ungapped FASTA opens in Sequence mode while exposing Alignment as an in-view alternate.

The header also exposes **Open in side pane** and **Return to chat** controls that move the same live viewer between inline chat and Codex's right pane while preserving the current mode and selection state.

## Opening routes

When a user clicks a supported file in the Codex workspace tree, the generic Codex MCP file-viewer host matches the plugin's `openai/ui` file entrypoint and calls the app-only `sequence.open` tool.

Current hosts pass the opaque resource arguments below. The trusted file-viewer contract in [openai/openai#1071929](https://github.com/openai/openai/pull/1071929) additionally attaches `_meta["openai/resource"].path` to the initial server callback and later widget-originated tool calls. That path is host-owned, remains in the MCP-server filesystem namespace, cannot be overridden by widget arguments, and is never sent to the app.

```json
{
  "file": {
    "name": "family.aln-fasta",
    "resourceUri": "codex-resource://opaque-host-managed-handle"
  }
}
```

The viewer reads opaque resources through standard MCP App `resources/read` and uses private app-only MCP tools for bounded, root-authorized source ranges. Filesystem paths remain inside the plugin server; the app never receives, reconstructs, or reads one directly.

Workspace publication is capability-detected. Without trusted server-only source metadata, native previews continue to open normally but **Publish to workspace** fails closed with reopen guidance. The server never derives a path from the opaque resource URI, searches by basename, or selects the first root.

When a user asks to open a supported file from chat, the model calls the model-visible MCP App tool `sequence.open_from_chat` with the exact absolute local path whenever available:

```json
{
  "path": "/workspace/results/family.aln-fasta"
}
```

When the MCP host exposes active local roots, the plugin confines both relative and absolute paths to those roots. When the host does not expose roots, the plugin requires an exact absolute local path. It then creates an opaque plugin resource handle and opens the rich app inline beneath the tool-call row. File contents travel from the plugin resource to the app through standard MCP `resources/read`; they are not returned to the model. The model tells the user that **Open in side pane** moves the same live viewer to Codex's right pane.

The plugin stores bounded, source-revision-bound viewer checkpoints in owner-only local state and separately retains at most 256 signed opaque file records for 30 days. Newly issued chat and starter handles cryptographically bind the original viewer session, so a remounted card can resume that session and its checkpoint after the plugin server revalidates the active workspace root, unchanged source identity, and source revision. It can issue a fresh opaque source capability without replaying completed commands; repeated delivery of the same tool result does not reset live state. Checkpoints remain limited to 192 KiB and coalesce updates for 175 ms. Recovery requires the normal MCP plugin lifecycle and an authenticated session-bound handle; legacy handles, unavailable, changed, moved, or unauthorized sources fail closed and can be reopened explicitly. This plugin does not add an independently supervised desktop backend, guarantee recovery across every application or machine restart, or place paths or biological file contents in recovery handles.

For marketplace starters, Codex uses its own host-authorized research, network, and workspace tools to fetch the exact official NCBI, UniProtKB, Rfam, or ENA records into the user's actual authorized workspace. Before opening anything, it enforces the catalog's pinned accession/version/release/checksum, strict network and decoded-byte bounds, biological format, deterministic subset or alignment, and artifact digest. Codex writes an honestly attributed source/provenance pair without overwriting, then calls `sequence.open_from_chat` exactly once with the validated file's exact absolute local path. The human RAS example prepares the exact bounded, digest-pinned center-star alignment before its first render; after analysis, Codex can write the requested small Newick result and accurately Codex-authored provenance using its own workspace permission even when the plugin receives no MCP roots. Optional Life Science Research skills can help but are never required. The legacy `sequence.acquire_public_example` tool remains optional only when the plugin independently receives authenticated workspace roots; it is never a starter prerequisite or rootless fallback. Failures never fall back to a bundled fixture or mount a misleading viewer.

### Curated starter portfolio

The exact capability matrix, source/runtime bounds, scientific invariants, artifact contracts, acceptable variability, failure behavior, and [LSC-109](https://linear.app/openai/issue/LSC-109/sequence-and-alignment-viewer-qualify-every-refreshed-starter-example) runbook are checked in at [STARTER_EXAMPLES.md](STARTER_EXAMPLES.md); `starter-examples.json` is the validator-consumed source of truth. The historical clean-host qualification documented in [LSC_109_QUALIFICATION.md](LSC_109_QUALIFICATION.md) and [`lsc-109-qualification.json`](lsc-109-qualification.json) applies to version 0.1.26. Qualification of the current version, 0.1.43, remains pending.

1. `Fetch ENA DRR037765 first 500 reads to active workspace; open and report live length range, GC, Q30, and subset provenance`
2. `Fetch UniProt P01116/P01111/P01112 alignment; map conserved motifs to KRAS, compute distances/tree, publish Newick to workspace`
3. `Fetch NCBI NC_001416.1 to active workspace; open it, map cI to OR1–OR3, and translate cI with code 11`

The first prompt demonstrates deterministic real-read QC, the second opens a three-record reviewed protein alignment and saves provenance-bearing Newick to the authorized workspace, and the third maps and translates an annotated reverse-strand genetic switch. Codex prepares each source first and opens exactly one viewer/session with `sequence.open_from_chat`. The release-bound `RF00360@15.1:seed` route remains supported through the same Codex-managed retrieval and exact-path opening workflow, but it is not a default marketplace starter.

## Supported files

| File family                         | Extensions or signatures                                        | Default rich mode                                                              |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| FASTA and plain biological sequence | `.fasta`, `.fa`, `.fas`, `.fna`, `.faa`, `.ffn`, `.frn`, `.mfa` | Sequence for single or unaligned records; Alignment for strongly aligned FASTA |
| Explicit aligned FASTA              | `.aln-fasta`, `.afa`, `.afasta`                                 | Alignment                                                                      |
| GenBank and RefSeq flat file        | `.gb`, `.gbk`, `.genbank`, `.gbff`                              | Sequence                                                                       |
| EMBL and ENA flat file              | `.embl`, `.emb`                                                 | Sequence                                                                       |
| FASTQ                               | `.fastq`, `.fq`                                                 | Sequence                                                                       |
| ABIF chromatograms                  | `.ab1`, `.abi`; ABIF 1.01 processed traces only                  | Sequence with original-orientation trace inspection                             |
| SCF chromatograms                   | `.scf`; SCF 2.00/3.00                                           | Sequence with original source confidence and trace channels                     |
| SnapGene DNA                        | `.dna`; verified export/import revision pairs only             | Sequence with supported annotations and disclosed omissions                     |
| CLUSTAL and MUSCLE alignment        | `.aln`, `.clustal`, `.clw`                                      | Alignment                                                                      |
| Stockholm                           | `.sto`, `.stk`, `.stockholm`                                    | Alignment                                                                      |
| A2M and A3M                         | `.a2m`, `.a3m`                                                  | Alignment                                                                      |
| GCG and MSF                         | `.msf`                                                          | Alignment                                                                      |
| PHYLIP                              | `.phy`, `.phylip`                                               | Alignment                                                                      |
| NEXUS                               | `.nex`, `.nexus`                                                | Alignment                                                                      |
| PIR and NBRF                        | `.pir`                                                          | Alignment                                                                      |

Sequence mode on an explicit MSA projects ungapped row sequences. Use Alignment mode for column positions, gaps, insertions, consensus, conservation, and any semantics that depend on the aligned matrix.

BAM/CRAM are regional evidence sidecars loaded onto an opened sequence/reference, not primary genome-browser files. Binary sequence imports are limited to 8 MiB. Unsupported ABIF/SCF versions and SnapGene revisions fail closed; details and verification boundaries are in the [capability matrix](CAPABILITY_MATRIX.md#scientific-and-resource-limits).

## Derived exports and plugin-owned file access

The viewer exposes 18 real, validated derived-artifact formats:

- Sequence and read data: FASTA (`.fasta`), FASTQ (`.fastq`), GenBank (`.gb`), and EMBL (`.embl`).
- Alignment data: aligned FASTA (`.afa`), insertion-preserving A3M (`.a3m`), CLUSTAL (`.aln`, `.clustal`, `.clw`), and Stockholm (`.sto`, `.stk`, `.stockholm`).
- Genome annotations and variants: GFF3 (`.gff3`), GTF (`.gtf`), BED (`.bed`), and VCF (`.vcf`).
- Analysis, figures, and interchange: CSV (`.csv`), TSV (`.tsv`), Newick (`.nwk`), SVG (`.svg`), PDF (`.pdf`), and JSON (`.json`).

Model-visible schemas, filename validation, MIME types, renderer exports, and plugin-owned generators agree on those formats. Alignment exports retain selected rows, gap coordinates, and A3M lowercase insertions. GTF preserves exact one-based compound feature segments, strand, and available gene/transcript qualifiers. PDFs include valid document objects and cross-reference tables.

These are derived exports, not native ABIF, SCF, SnapGene, BAM or CRAM round trips. Keep the original binary for unsupported annotations, instrument data, history and application settings. Loaded chromatograms retain their signal arrays; the separate 512 KiB session cap can therefore prevent saving a large trace record.

The shared `@openai/scientific-viewer-platform` package runs inside the existing plugin MCP server. Its file service accepts only actual MCP-advertised workspace roots, issues opaque family/session/source-bound capabilities, rejects symbolic-link escapes, verifies source identity on each read, renews only active revalidated capabilities, and caps physical Sequence reads at 64 KiB. Its plugin-owned Sequence domain supplies persisted paged indexes, bounded FASTA/FASTQ residue and quality windows, gzip/BGZF indexing primitives, `.gzi`/`.fai` parsing, and exact unsigned 64-bit offsets. Ordinary gzip remains sequential; indexed compressed-source qualification is a property of the shared runtime tests and does not imply that every opaque host-managed file resource can be upgraded without a server-visible authorized source.

Workspace exports use the existing plugin-owned create-new, collision-safe artifact/provenance publisher and bounded chunk transport. Use the visible **Publish** actions and explicit workspace Save As confirmation; Codex blocks browser downloads from the embedded viewer, so no browser **Download** fallback is advertised. Edited selections, visible subsets, attached evidence, and frontend-only state retain their exact viewer-produced content instead of being silently regenerated from the original. Copy actions confirm successful clipboard access or, when access is unavailable, expose at most 128 KiB of exact UTF-8 text in a focused, read-only field for manual copying; larger selections must be published to the workspace. GTF forwards only validated, bounded, source-bound annotation segments and fails closed on incomplete inventories, remote coordinates, or ambiguous boundaries. The opened source remains immutable by default; this plugin does not claim a trusted desktop-host mutation-approval capability.

## Model context

The viewer calls `ui/update-model-context` with concise human-readable text plus structured state whenever the active mode, selection, focus, or relevant displayed metrics change. The text includes serialized structured JSON so hosts that currently preserve only text still provide the model with enough context for follow-up questions. Publications are revisioned and latest-only: at most one host update is in flight, one newer snapshot is coalesced behind it, and stale async completions cannot overwrite newer state. Every envelope carries `schemaVersion`, `contextRevision`, and its applied context budget.

Useful context includes:

- source identity, active mode, one authoritative `activeTarget`, and a separately labeled `transientFocus`;
- explicit coordinate basis, end semantics, orientation, and reference space;
- bounded record and feature inventories plus the selected record or sequence range;
- selected alignment column range;
- active row filter, hidden rows, display options, and analysis/search scopes;
- per-row residues for selected alignment columns;
- selected-column identity and conservation metrics;
- focused annotations, FASTQ quality, search results, reference-row mapping, tracks/downsampling, jobs, and derived artifacts.

The model can use `sequence.control_viewer` for immediate view state and narrow workbench tools for paginated queries, deterministic analyses, alignment, safe copy edits, annotation management, evidence loading, artifact export, session save/restore, and cancellation. Indexed BAM uses BAI/CSI and indexed CRAM uses CRAI plus an optional matching reference FASTA; both use explicit 1-based inclusive windows capped at 100,000 bases. The mounted app receives these requests through app-only long-poll tools and acknowledges the applied state; no Codex-private bridge is used.

New inspection controls cover record-browser and annotation-index search/pagination, chromatogram windows, read filters/selection, quality-report tables, alignment metrics/row sorting, registered tool panels/disclosures, and explicit dismissal of registered copy/session-error feedback. Query `sequence-ui-state`, `read-pileup-state`, `quality-report`, `chromatogram`, `read-detail`, `workbench-panels`, `workbench-disclosures`, or `workbench-feedback` for their actual state/data; query exact registered IDs instead of constructing them. The [UI-to-agent mapping](CAPABILITY_MATRIX.md#ui-to-agent-mapping) lists the corresponding actions. A started analysis is not a completed report, and a rejected or guarded action must not be reported as applied.

Sequence and alignment palette defaults are **Soft nucleotide** (`muted-nucleic-acid`) for DNA/RNA and **Soft amino acid** (`muted-amino-acid`) for proteins, with **Monochrome** (`neutral`) and existing scientific palettes available. Use `sequence.control_viewer` with `set_sequence_view_options.palette` for sequences or `set_alignment_view_options.residuePalette` for alignments. Query `sequence-ui-state` for `palette.id`, `defaultId`, and compatible `options`; alignment context exposes `display.residuePalette`, `defaultResiduePalette`, and `compatibleResiduePalettes`. Saved compatible choices are preserved. Unknown or incompatible single-sequence saved IDs fall back to the restored record's default, with a visible notice and `palette.restorationWarning` in the query. Alignment comparison and metric color modes remain separate from residue palettes.

## Correctness and resource contract

The app, server, parsers, workers, and tests share one versioned runtime contract in `src/runtime-contract.ts` and one strict MCP payload schema in `src/protocol.ts`. Limits are deliberately explicit so a valid-looking biological file cannot silently turn into unbounded DOM, memory, search, context, or command state.

| Surface            | Bound and behavior                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input text         | Generic MCP resources: 32 MiB direct text and up to 512 MiB indexed sources; authorized workspace FASTA/FASTQ up to 8 GiB use only bounded 64 KiB app-scoped ranges |
| Sequence documents | Generic materialization: 100,000 records and 25,000,000 residues; plugin-owned source indexes expose bounded pages without returning the entire source              |
| FASTQ              | Up to 1,000,000 reads feed streaming summaries; inspection retains at most 5,000 reads and 1,000,000 decoded quality bases                                          |
| Detailed FASTQ QC  | First eligible retained reads, not a random sample: at most 1,000 complete reads / 100,000 bases; 48 KiB structured report; descriptive, not FastQC                  |
| Binary sequences  | 8 MiB import; traces at most 200,000 calls / 500,000 samples per channel; independent 512 KiB saved-session cap                                                     |
| Map overview      | 200 annotations / six lanes / 1,200 processed segments; up to 12 compact linked labels; all loaded annotations remain accessible through 30-row index pages         |
| Read pileup       | 100 displayed reads; base-level detail at most 200 reference bases; filtered loaded-read coverage precedes display sampling and discloses incompleteness              |
| Trace queries     | Original-orientation windows of at most 100 called bases; sample pages at most 500 rows, with explicit quality encoding                                             |
| MSA                | 100,000 rows and 20,000,000 cells; workers visibly fail over after errors, aborts, or the 30-second watchdog                                                        |
| Search             | 5,000 hits and 50,000,000 symbol comparisons with explicit truncation; cooperative UI search; 100-hit pages                                                         |
| Record inventory   | UI pages 100 records at a time instead of mounting an unbounded selector or table                                                                                   |
| Model context      | 64 KiB serialized envelope, 8 KiB human-readable text, UTF-8 byte accounting, latest-only coalescing                                                                |
| Manual copy        | At most 128 KiB of exact UTF-8 text in a selectable read-only fallback when clipboard access is unavailable                                                         |
| Viewer commands    | Bounded sessions, queues, and waiters; strict coordinates and unambiguous IDs; idempotent duplicate completion                                                      |
| Jobs/artifacts     | 100 recent jobs, cancellable/stale-safe completion, 8 MiB per private artifact, 32 MiB artifact cache, 512 KiB saved session                                        |
| Persistence proxy  | 280 KiB installed-host request envelope; 180 KiB one-shot payloads and 192 KiB resumable chunks with SHA-256 and cleanup                                            |
| Workspace outputs  | Existing plugin publisher: 2 GiB default output, 4 GiB staging quota, bounded source-bound create-new publication and provenance                                    |
| Evidence           | 200,000 bounded items per track; CRAM/CRAI regional windows at most 100,000 bases and disclosed read downsampling                                                   |

Sequence and MSA interaction state is reducer-owned. Changing a record or row set deterministically clears or rehomes stale focus, selection, search, reference, pin, and derived-tree state. Pointer hover remains visual-only; keyboard or explicit activation publishes model-visible focus. Compound GenBank/EMBL CDS translations retain exact segment, strand, `codon_start`, and genetic-code provenance, and unsupported remote, ordered, or partial mappings report why translation coordinates are unavailable instead of fabricating a linear map.

## MCP App boundary

| Surface                                                                                                    | Visibility             | Purpose                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `sequence.open`                                                                                            | app-only               | Native workspace preview; eligible inputs above 32 MiB receive a bounded opaque indexed resource           |
| `sequence.open_from_chat`                                                                                  | model-visible app tool | Open a supported workspace sequence or alignment in the inline app                                         |
| `sequence.acquire_public_example`                                                                          | model-visible app tool | Optional legacy public acquisition only when the host supplies independently authenticated workspace roots |
| `sequence.control_viewer`                                                                                  | model-only             | Control the currently mounted viewer or request its display mode                                           |
| `sequence.query_viewer`                                                                                    | model-only             | Page records, features, ranges, alignment state, evidence, jobs, and artifacts                             |
| `sequence.run_analysis`, `sequence.align`                                                                  | model-only             | Run bounded deterministic analyses or create a derived exploratory alignment                               |
| `sequence.edit_copy`, `sequence.manage_annotations`                                                        | model-only             | Mutate only the reversible in-memory copy                                                                  |
| `sequence.load_track`                                                                                      | model-only             | Attach mapped annotation, variant, coverage, or regional read evidence                                     |
| `sequence.export_artifact`                                                                                 | model-only             | Persist biological data, annotations, tables, figures, and tree artifacts                                  |
| `sequence.save_session`, `sequence.restore_session`, `sequence.cancel_job`                                 | model-only             | Round-trip bounded workbench state or cancel an active job                                                 |
| `sequence.register_viewer_session`, `sequence.wait_for_viewer_command`, `sequence.complete_viewer_command` | app-only               | Portable MCP App session and command acknowledgement loop                                                  |
| `sequence.prepare_workspace_export`                                                                        | app-only               | Preflight a create-new destination relative to the bound opened source                                     |
| `sequence.list_workspace_export_directory`                                                                 | app-only               | List one bounded source-relative Save As page and inspect exact/next-version availability                  |
| `sequence.create_workspace_export_directory`                                                               | app-only               | Exclusively create one child folder within the bound workspace root                                        |
| `sequence.list_workspace_track_directory`                                                                  | app-only               | Page supported related evidence using relative labels and opaque candidate IDs                             |
| `sequence.resolve_workspace_track_bundle`                                                                  | app-only               | Resolve explicit or unambiguous index/reference companions into an expiring opaque bundle                  |
| `sequence.load_workspace_track`                                                                            | app-only               | Revalidate and load a confirmed bundle through the existing bounded track command pipeline                 |
| `sequence.list_workspace_sessions`, `sequence.restore_workspace_session`                                   | app-only               | Discover compatible adjacent projects and explicitly restore one after full revalidation                   |
| `sequence.persist_workbench_payload`, `sequence.*_workbench_payload_*`                                     | app-only               | Proxy-safe one-shot or resumable private/workspace artifact and session persistence                        |
| `sequence.generate_workspace_export`                                                                       | app-only               | Canonical FASTA/FASTQ/aligned-FASTA generation from the trusted opened source without widget transfer      |
| `ui://sequence-viewer/viewer`                                                                              | app resource           | Self-contained HTML shell that expands the compressed viewer bundle into a CSP-approved `blob:` module     |

The boundary is deliberate: `sequence.open` retains the existing opaque host resource. When trusted server-only source metadata and actual MCP workspace roots are present, the existing app-session registration additionally creates a plugin-owned, session-bound source capability and hidden source descriptor. Chat and authoritative-example openings use the same path. The iframe calls only app-scoped standard MCP source, range, record, window, and checkpoint tools. Without an authorized server-visible source, the unchanged bounded MCP resource fallback remains available; no route exposes an absolute path or requires a desktop-specific bridge.

For trusted source-bound sessions, **Tracks → Add from workspace** pages related GFF/GFF3/GTF, BED, VCF, SAM, BAM/BAI/CSI, CRAM/CRAI, and FASTA candidates without recursion. The app receives only relative labels plus opaque, expiring candidate and bundle IDs. Index and reference companions must be explicit or unambiguous and are shown for confirmation. Workspace BAM/CRAM loads require an explicit contig and an inclusive window of at most 100,000 bases. Every load revalidates the active root, opened source, candidate identities, and non-aliasing, then reuses the same BAM/CRAM decoders and `load_track` parser as local/model loading. Track provenance retains only the safe workspace-relative source and SHA-256 digest.

Model-triggered exports and saved sessions are new derived/private workbench data, not edits of the opened source. They therefore use app-only one-shot or begin/append/finish/abort persistence operations and report only compact metadata through `sequence.complete_viewer_command`. When a viewer session has a trusted, canonical source inside an active workspace root, exports and explicitly user-saved projects may instead select `{kind:"workspace",base:"opened-source",relativePath}`. Model requests remain exact create-new operations by default. The UI may explicitly add `collisionPolicy:"next-version"`, which tries `name.ext`, then `name-2.ext`, up to the bounded workspace limit and retries only collision races. The Save As browser exposes bounded, source-relative pages and creates at most one exclusive child folder per request. Parent traversal remains confined to the same deepest bound root. The output and provenance sidecar commit as a collision-safe pair without overwriting anything. Source/root/destination identities, format, length, and digest remain bound across retry and finish. No absolute path reaches the app, model result, manifest, or provenance.

Durable workspace projects default to `<source-stem>.sequence-viewer.session.json`. The app uploads only the validated session payload (at most 512 KiB); the server injects schema/plugin versions, creation time, mode, payload digest, authoritative source size/SHA-256 and safe source-relative locator, plus digest-bound descriptors for workspace-backed evidence tracks. Discovery is bounded to compatible adjacent manifests and returns opaque, session-bound candidates. It never applies a project automatically. After explicit confirmation, restore revalidates the active root, source binding, manifest identity, exact source digest, and each dependency; required drift blocks restore while optional drift is reported. The payload then follows the existing `restore_session` command and reducers, including cancelled settlement for formerly running jobs. Private save/restore remains unchanged.

`openai/resources/write` is not the derived-artifact publication mechanism: outputs are created or resumed by the existing root-confined plugin publisher with digest and provenance binding. The embedded app preserves the standard MCP App interaction and never learns a private backend address, filesystem path, companion token, or bearer secret. Source files remain unchanged by default. Private artifacts, plugin checkpoints, and private saved sessions remain available; derived files are saved through authorized workspace publication rather than blocked browser downloads.

## Code map

| Path                                             | Responsibility                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts`                                  | MCP server, app resource, native file entrypoint, and inline chat-open tool                                             |
| `src/chat-file-resource.ts`                      | Root-bound, identity-checked opaque resources and the shared bounded indexed reader for native/chat opens               |
| `src/views/app.tsx`                              | MCP App bootstrap, opaque-resource loading, load/error states, and display-mode bridge                                  |
| `src/views/workbench-persistence.ts`             | Proxy-safe one-shot/chunked app client, retry/resume, cancellation, and compact completion                              |
| `src/scientific-platform.ts`                     | Shared plugin-owned root authorization, opaque sources, bounded ranges, paged Sequence indexes, and durable checkpoints |
| `src/views/scientific-platform-client.ts`        | Standard app-only MCP source/window/checkpoint client for unchanged Codex hosts                                         |
| `src/persistent/scientific-data-client.ts`       | Optional backwards-compatible host-capability adapter; safely unused when the host does not provide that extension      |
| `src/persistent/native-workspace-publisher.ts`   | Optional compatibility publisher for hosts that independently provide its required capabilities                         |
| `src/server-workbench-upload.ts`                 | Bound, staged, digest-checked artifact/session upload lifecycle and cleanup                                             |
| `src/workspace-export-publisher.ts`              | Trusted source binding, deepest-root destination validation, atomic artifact/provenance publication, and replay checks  |
| `src/workspace-track-browser.ts`                 | Opaque related-file browsing, companion resolution, identity revalidation, and bounded bundle reads                     |
| `src/workspace-session-manager.ts`               | Strict durable manifests, adjacent discovery, opaque candidates, and source/dependency revalidation                     |
| `src/views/workspace-tracks.ts`                  | App-only browser client with retry-safe reads, non-replayed loads, cancellation, and strict result validation           |
| `src/biological-sequence-artifact-classifier.ts` | Plugin-local artifact classification and default-mode decision evidence                                                 |
| `src/biological-sequence-viewer-model.ts`        | Combined viewer model and mode availability                                                                             |
| `src/biological-sequence-viewer.tsx`             | Shared viewer shell and Sequence / Alignment mode switch                                                                |
| `src/runtime-contract.ts`, `src/protocol.ts`     | Shared safety budgets plus strict, versioned app/server payloads                                                        |
| `src/sequence/*`                                 | Sequence parsers, rendering, features, translation, quality, search, palettes, and exports                              |
| `src/msa/*`                                      | Alignment parsers, workerized analysis, virtualization, tracks, metrics, search, and exports                            |
| `e2e/*`                                          | Installed-host Playwright harness that runs the compressed production app bundle in Chromium                            |
| `skills/biological-sequence-viewer/SKILL.md`     | Agent guidance for the native workspace-file boundary and viewer-context follow-up questions                            |
| `scripts/build.mjs`                              | Compressed single-asset viewer app and MCP server build                                                                 |
| `scripts/bundle.mjs`                             | Build and validate the generated marketplace package                                                                    |
| `scripts/generate-third-party-notices.mjs`       | Generate dependency inventory and available license or notice texts for the marketplace package                         |
| `scripts/validate-public-bundle.mjs`             | Reject source-only files, private references, stale policy links, or incomplete marketplace payloads                    |
| `PUBLIC_README.md`                               | User-facing README installed with the generated marketplace package                                                     |

## Smoke fixtures

The committed fixtures under `smoke-fixtures/` are small, synthetic, reviewable conformance artifacts for deterministic QA:

- sequence-first examples: DNA FASTA, RNA FASTA, protein FASTA, multi-record FASTA, FASTQ, linear GenBank/EMBL, and an origin-spanning circular GenBank plasmid;
- alignment-first examples: aligned FASTA, Stockholm RNA, A2M/A3M protein profiles, CLUSTAL, interleaved PHYLIP, NEXUS, MSF, and PIR;
- a negative text fixture for graceful unsupported-input behavior.

These fixtures are source-test inputs only. They are excluded from the runtime marketplace bundle and are never exposed as a public starter or network fallback.

## Local validation

From this plugin directory:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run test
pnpm exec vitest run --root ../scientific-viewer-platform tests/sequence
pnpm run test:e2e
pnpm run test:large-workspace
pnpm run smoke:formats -- <local-path-or-https-url> [...]
pnpm run build
pnpm run bundle
python3 ../codex-plugin-skill-authoring/scripts/validate_plugin.py .
python3 ../codex-plugin-skill-authoring/scripts/validate_plugin.py bundle/sequence-viewer
```

`pnpm run test:e2e` builds the same compressed, self-contained HTML shipped by the plugin and opens it through a protocol-faithful installed-host harness in Chromium. It covers native and chat opening, same-session model control, lost completion responses, proxy-bounded workspace Save As navigation, durable project save/discovery/confirmed restore, confirmed text/indexed workspace evidence, child-folder creation, exact collisions, next-version selection, capability-unavailable failure, superseded resource reads, recoverable resource failures, fatal parse failures, keyboard focus, axe accessibility, large-sequence/FASTQ DOM bounds, and every advertised text format. This harness proves app transport and path non-disclosure; native source-path parity additionally requires an installed host that implements the trusted server-only file-viewer metadata contract. Install the Playwright Chromium runtime once with `pnpm exec playwright install chromium` if it is not already available.

`pnpm run test:large-workspace` is the opt-in disk/CPU qualification lane. It streams a 512 MiB + 1 browser-produced artifact with an exact digest and publishes a gzip-backed server-generated Alignment artifact above 1 GiB while asserting the 2 MiB widget and 4 MiB server retained-memory budgets. The ordinary unit and installed-host lanes cover the same protocol at CI-friendly sizes, including retry, cancellation, quota, collision, and request-envelope behavior.

The plugin-owned scientific package includes an always-on genuine six-GiB-logical BGZF indexing suite and an opt-in physical qualification at `../scientific-viewer-platform/tests/sequence/scientific-sequence-huge-physical.test.ts`. With `SCIENTIFIC_SEQUENCE_HUGE_FILE_E2E=1`, the latter writes and verifies more than 6 GiB of actually allocated BGZF data plus genuine `.gzi`/`.fai` files, exercises plugin-owned 64 KiB source reads beyond the 4 GiB and 6 GiB compressed-offset boundaries, verifies indexed sequence windows, and asserts a bounded resident-memory increase. Physical qualification requires sufficient disk space and must be executed explicitly; the presence of the test is not an execution receipt.

`pnpm run smoke:formats` bundles the production parsers in memory and validates local files or HTTPS fixtures without adding network access to the viewer itself. It emits one JSON line per artifact and exits nonzero if the artifact does not open in its required Sequence or Alignment mode.

`pnpm run bundle` creates the exact runtime-only payload intended for local bundle testing and the public `openai/plugins` repository. The bundle maps `PUBLIC_README.md` to its installed `README.md`, includes the MIT license, generates `THIRD_PARTY_NOTICES.md` from the installed production dependency graph, and validates that the payload is complete and contains no source-only or internal-only references.

Internal Testing continues to package the source plugin after `pnpm run build`, while the public repository receives the smaller runtime-only bundle. Both lanes execute the same generated `dist` entrypoints, but validate each lane independently.

This directory is the canonical source for both gated internal deployment and the curated alpha release. Build and publish both channels from the merged source here.

For desktop QA, run a Codex build containing the generic MCP file-viewer host and install the plugin from the relevant marketplace:

1. Ask chat to open a supported fixture and confirm the tool-call row expands to the inline rich viewer and the model mentions **Open in side pane**.
2. Click **Open in side pane**, confirm the same viewer and current state move to the right pane, then click **Return to chat**.
3. Click the same fixture in the workspace tree and confirm native rich preview plus raw fallback still works.
4. Ask Codex to focus a coordinate, search a motif, choose an alignment reference, compute the guide tree, and move the mounted viewer to the side pane.
5. Select a sequence range or alignment column and ask a follow-up question grounded only in the viewer context.

## Specialist handoffs

The viewer deliberately keeps a closed CSP and does not pretend that lightweight in-browser engines replace validated external science. Built-in primer scoring, pairwise/center-star alignment, and NJ/UPGMA trees are explicitly exploratory and provenance-bearing. Codex should orchestrate approved tools for BLAST/similarity search, genome-wide primer specificity, production MSA, publication-grade phylogenetics, structure linkage, RNA folding, CRISPR/cloning, chromatograms, or other specialist workflows, then reopen or load the traceable returned artifact. Source files are never overwritten by default.
