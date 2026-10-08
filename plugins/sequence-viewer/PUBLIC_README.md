# Biological Sequence & Alignment Viewer

Biological Sequence & Alignment Viewer is a progressively disclosed sequence workbench inside Codex: inspect first, then analyze, edit a safe copy, compare, attach evidence, and export reproducible artifacts without leaving the conversation.

The [capability matrix](CAPABILITY_MATRIX.md) describes the implemented features, exact agent controls, and remaining limits. This combines several inspection workflows; it is not a complete replacement for every feature in Jalview, IGV, SnapGene, Benchling or FastQC.

## Open A Sequence Or Alignment

- Click a supported file in the Codex workspace tree to open the native rich preview.
- Ask Codex to open a supported local sequence or alignment to render the viewer inline in chat.
- Choose a database-backed starter; Codex uses its authorized research and workspace tools to download an annotated NCBI record, reviewed UniProtKB RAS sequences, or a checksum-pinned ENA read subset, then opens the verified local file in the viewer.
- Use **Open in side pane** inside the viewer to move the same live view to the right pane.
- Use **Return to chat** to move it back without losing mode, focus, selection, or alignment state.
- Returning to a conversation can restore a newly opened chat or starter viewer's original session and bounded checkpoint after its unchanged workspace source is reauthorized. Saved workspace projects require separate explicit confirmation. If the source moved, changed, left the workspace, or cannot be authenticated, use **Reopen from chat**.

## Supported Files

- FASTA and plain biological sequence: `.fasta`, `.fa`, `.fas`, `.fna`, `.faa`, `.ffn`, `.frn`, `.mfa` (including `.gz` FASTA)
- Explicit aligned FASTA: `.aln-fasta`, `.afa`, `.afasta`
- GenBank and RefSeq flat files: `.gb`, `.gbk`, `.genbank`, `.gbff`
- EMBL and ENA flat files: `.embl`, `.emb`
- FASTQ: `.fastq`, `.fq` (including `.gz` FASTQ)
- Sanger chromatograms: ABIF `.ab1`/`.abi` and SCF `.scf`, within the supported version and size limits
- SnapGene DNA: `.dna`, with supported sequence, topology and annotations from verified file revisions
- Common alignment formats: CLUSTAL, Stockholm, A2M, A3M, MSF, PHYLIP, NEXUS, and PIR

Sequence mode includes distinct linear/circular/split maps with selectable directional annotations, a searchable annotation index, reverse-complement projection, genetic-code-aware translation and ORFs, restriction/digest and exploratory primer workflows, reversible sequence-copy edits, and GFF/GTF/BED/VCF/SAM/BAM/CRAM evidence tracks. Sanger traces show called bases and source signals; detailed FASTQ reports show bounded quality/composition distributions. Regional read pileups add CIGAR-aware coverage, mismatch/base-quality inspection, filters and read details. Alignment mode adds accessible keyboard navigation, row and column selection, row grouping and sorting, metric tracks, safe gap/trim/row edits, realignment, distance matrices, and synchronized graphical NJ/UPGMA guide trees.

The source stays read-only by default. Workbench edits live in an undoable in-memory copy; exports and generated alignments carry engine and parameter provenance. The compact **Analyze**, **Edit copy**, **Tracks**, **Export**, and **Tasks** surfaces appear only when needed. In a trusted source-bound workspace session, **Tracks → Add from workspace** can page related annotation, variant, read, index, and reference files using safe relative labels; it requires explicit review of inferred companions and a bounded contig window for indexed reads. Codex exposes the same state and operations through typed tools, including paginated live queries, cancellation, artifact export, and saved/restored sessions.

Codex can also open the same tool panels and nested sections, search/page record and annotation lists, set trace windows, filter/select reads, and change quality tables or alignment display tracks. It reads back applied state and can page scientific data beyond the visible rows. Pending approvals and publication confirmations remain user-controlled.

## Scope And Limits

- BAM/CRAM attach as indexed regional evidence to an opened sequence/reference; they are not standalone genome-browser documents. Coverage is computed from loaded, filtered reads and discloses missing data or sampling. Aggregate splice-junction arcs, paired-fragment packing, quality-weighted allele fractions and arbitrary tag coloring are not implemented.
- Detailed FASTQ reports use the first eligible retained reads, capped at 1,000 reads and 100,000 bases. They are descriptive analyses, not FastQC runs or whole-file contamination/pass/fail assessments.
- Binary imports are capped at 8 MiB: original-orientation processed ABIF 1.01, SCF 2.00/3.00, and verified SnapGene revision pairs. Unsupported binary content is rejected or explicitly reported. No native binary export is provided; a loaded trace may exceed the separate 512 KiB saved-session cap.
- Built-in alignments, trees and primer scores remain exploratory. MAFFT, full phylogenetic inference, complete native SnapGene document fidelity and ELN collaboration are outside this implementation.

## Exports And Saved Projects

Derived artifacts can be exported as FASTA, FASTQ, GenBank, EMBL, aligned FASTA, A3M, CLUSTAL, Stockholm, GFF3, GTF, BED, VCF, CSV, TSV, Newick, SVG, PDF, or JSON. Alignment exports preserve selected rows and A3M insertions; GTF retains compound feature coordinates, strand, and gene/transcript identifiers. Root-confined plugin publishing preserves the exact displayed selections, visible subsets, and user-added evidence. Copy actions confirm success; if clipboard access is unavailable, selections up to 128 KiB appear as exact, read-only text for manual **Command+C** or **Ctrl+C** copying. Larger selections must be saved to the workspace.

Generated model artifacts and saved sessions are written to the plugin's private bounded workbench store. Small payloads use a proxy-safe one-shot request; larger payloads use resumable, digest-checked chunks. When Codex supplies a trusted server-only source binding for a file inside an active workspace, derived exports offer **Publish to workspace**, and either workbench mode offers **Save project**. The accessible Save As browser starts beside the opened source, lists bounded pages with workspace-relative breadcrumbs, and can exclusively create one child folder at a time. Choose an exact create-new name or **Save next version** to select `name.ext`, then `name-2.ext`, within a bounded server-side search. Plugin publication atomically creates the output plus provenance sidecar and never overwrites the source, another file, or an alias. The embedded viewer receives no absolute filesystem path. When plugin workspace authorization is unavailable, its publication controls fail closed; Codex can still use its own authorized workspace tools to save a small, exact requested result already present in model-visible analysis output and an accurately attributed Codex-authored receipt. Private plugin artifacts and saved sessions remain separate.

Workspace projects use a strict versioned manifest containing the validated bounded workbench payload, server-authored source digest and relative locator, and digest-bound related evidence descriptors. Compatible saved-project manifests adjacent to the opened source are discovered read-only and require explicit review before being imported. Newly issued chat and starter handles securely bind the original viewer session, allowing compact plugin-owned checkpoints to recover after a remount or plugin-server restart only when the active workspace root, unchanged source, session, and source revision are revalidated. Legacy handles without that authenticated session binding cannot be silently promoted. The plugin does not install a separate desktop process or guarantee recovery across every app or machine restart.

## Data Handling

The plugin uses the existing MCP App interface and a scientific runtime shared by the Sequence, Structure, and Slide plugins. Its existing Node MCP server authorizes actual workspace roots, issues opaque source/session capabilities, and provides bounded app-only source ranges, record pages, residue windows, and checkpoints. No Codex desktop modification, separately supervised process, custom host capability, local web endpoint, or browser network permission is required. Hosts without an authorized server-visible source retain the existing bounded resource path.

File contents are shown in the embedded viewer, not returned to the model merely to open a file. Generic MCP resources retain their 32 MiB direct-text and 512 MiB indexed-source limits. Authorized workspace-backed FASTA and FASTQ sources up to 8 GiB instead use signed, opaque app-only handles; their bytes cannot be retrieved through the generic MCP resource endpoint. The shared plugin runtime serves bounded record pages and exact sequence/quality windows through physical reads of at most 64 KiB. Its source-test suite separately covers genuine BGZF/GZI/FAI indexing and optional physically allocated six-GiB compressed fixtures; that coverage does not imply all opaque host-managed or compressed resources can be promoted. FASTQ summaries, alignment cells, search, artifacts, sessions, and model context retain explicit independent budgets. Indexed BAM/CRAM workspace loading remains regional, and related-file handles stay bound to one viewer, source, root, and revision.

Opaque chat handles contain no file paths. Owner-only plugin state retains at most 256 signed recovery records for 30 days without copying sequence contents; authenticated chat and starter handles bind their original session, and source-bound checkpoints remain limited to 192 KiB. Recovery requires the normal MCP lifecycle, the same unchanged source inside an active workspace root, and the original authorized session; unavailable, expired, moved, changed, or unauthorized sources fail closed and can be explicitly reopened.

Marketplace starters use Codex's existing host-authorized research and workspace tools to retrieve only the documented official NCBI, UniProtKB, or ENA HTTPS endpoints into the active workspace. Codex verifies the exact accession, version, checksum, byte bounds, biological format, and declared subset or alignment, then records genuine source provenance without describing a Codex-authored receipt as plugin-signed. It opens the verified file once by passing its exact absolute workspace path to `sequence.open_from_chat`; this existing path remains available when the plugin host does not expose workspace roots. Network, rate-limit, malformed, drifted, oversized, cancelled, or workspace-failed retrievals leave no misleading viewer or bundled-data fallback. Legacy plugin-managed acquisition and plugin-managed workspace publication still require independently authenticated roots and otherwise fail closed.

## Real Database Starters

The shipped prompts are exact and open one viewer/session each:

1. `Fetch ENA DRR037765 first 500 reads to active workspace; open and report live length range, GC, Q30, and subset provenance`
2. `Fetch UniProt P01116/P01111/P01112 alignment; map conserved motifs to KRAS, compute distances/tree, publish Newick to workspace`
3. `Fetch NCBI NC_001416.1 to active workspace; open it, map cI to OR1–OR3, and translate cI with code 11`

The RAS workflow verifies three reviewed 189-aa sequence-version-1 records. Before opening a viewer, Codex uses its authorized local tools to build the same fixed-order, bounded center-star-compatible alignment and verifies its exact 3×191 dimensions, 786-byte length, and pinned SHA-256; provenance identifies the actual host implementation accurately. The single Alignment viewer session maps conserved GTPase motifs to KRAS, computes distances and an exploratory tree, and returns a verified Newick result that Codex saves with an accurately attributed provenance receipt using its ordinary authorized workspace tools. Plugin-managed workspace publication remains available only when independently authenticated roots exist. ENA reports deterministic live FASTQ metrics, and NCBI maps and translates the annotated reverse-strand cI switch. Full expected results and the [LSC-109 clean-host runbook](https://linear.app/openai/issue/LSC-109/sequence-and-alignment-viewer-qualify-every-refreshed-starter-example) ship in `STARTER_EXAMPLES.md` and `starter-examples.json`. The completed result in `LSC_109_QUALIFICATION.md` and `lsc-109-qualification.json` applies to version 0.1.26; qualification of the current version, 0.1.43, remains pending.

## Marketplace Package

This package is a generated, self-contained runtime bundle for the Codex official plugin marketplace. It includes the manifest, local MCP server runtime, viewer assets, and agent guidance. Synthetic conformance fixtures remain source-test-only and are not shipped.

## License

OpenAI-authored files are available under the [MIT License](LICENSE). Bundled third-party dependencies and their available license or notice texts are listed in `THIRD_PARTY_NOTICES.md`, which is included in the generated marketplace bundle.
