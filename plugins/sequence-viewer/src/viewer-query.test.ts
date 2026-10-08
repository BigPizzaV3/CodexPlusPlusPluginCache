import { describe, expect, it } from "vitest";

import { computeMsaDerivedAnalysis } from "./msa/analysis";
import { parseMsa } from "./msa/parser";
import { buildGuideTree } from "./msa/phylogenetic-tree";
import { parseSequenceDocument } from "./sequence/parser";
import { parseSequenceTrack } from "./sequence/tracks";
import { DEFAULT_READ_PILEUP_STATE } from "./sequence/read-pileup";
import { insertSequence } from "./sequence/editing";
import {
  createSequenceWorkbenchState,
  sequenceWorkbenchReducer,
} from "./workbench-state";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { queryAlignmentViewer, querySequenceViewer } from "./viewer-query";

describe("paged viewer query contract", () => {
  it("pages records and keeps cursors target-specific", () => {
    const document = parseSequenceDocument({
      contents: ">a\nAAAA\n>b\nCCCC\n>c\nGGGG\n",
      fileName: "records.fasta",
    });
    const first = querySequenceViewer({
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      request: { limit: 2, target: "records" },
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [],
    });
    expect(first).toMatchObject({
      nextCursor: "q1.records.2",
      page: { count: 2, offset: 0, totalCount: 3 },
      truncated: true,
    });
    expect(() =>
      querySequenceViewer({
        artifacts: [],
        document,
        hits: [],
        jobs: [],
        request: {
          cursor: first.nextCursor ?? undefined,
          limit: 2,
          target: "features",
        },
        selectedRecordId: document.records[0]?.id ?? "",
        tracks: [],
      }),
    ).toThrow("invalid for this target");
  });

  it("returns exact coordinate semantics with sequence and quality windows", () => {
    const document = parseSequenceDocument({
      contents: "@read\nACGT\n+\nIIII\n",
      fileName: "read.fastq",
    });
    const selectedRecordId = document.records[0]?.id ?? "";
    const sequence = querySequenceViewer({
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      request: { end: 3, start: 2, target: "sequence-range" },
      selectedRecordId,
      tracks: [],
    });
    const quality = querySequenceViewer({
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      request: { end: 4, start: 1, target: "quality" },
      selectedRecordId,
      tracks: [],
    });
    expect(sequence).toMatchObject({
      coordinateSystem: { basis: 1, end: "inclusive", space: "sequence" },
      result: { sequence: "CG", start: 2, end: 3 },
    });
    expect(quality.result).toMatchObject({ min: 40, max: 40, mean: 40 });
  });

  it("returns the mounted FASTQ aggregate as one bounded live metrics page", () => {
    const document = parseSequenceDocument({
      contents: "@read-1\nACGT\n+\nIIII\n@read-2\nGC\n+\nI!\n",
      fileName: "reads.fastq",
    });
    const result = querySequenceViewer({
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      request: { limit: 100, target: "metrics" },
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [],
    });

    expect(result).toMatchObject({
      items: [
        {
          gcPercent: (2 / 3) * 100,
          q30Percent: (5 / 6) * 100,
          qualityEncoding: "phred+33-assumed",
          readCount: 2,
          readLengthMax: 4,
          readLengthMin: 2,
          totalBases: 6,
          type: "fastq-summary",
        },
      ],
      nextCursor: null,
      page: { count: 1, offset: 0, totalCount: 1 },
      target: "metrics",
      truncated: false,
    });
  });

  it("filters feature pages by identifiers, locations, and qualifier values", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       TEST                     12 bp    DNA     linear
FEATURES             Location/Qualifiers
     source          1..12
     CDS             complement(1..9)
                     /gene="cI"
                     /protein_id="NP_040628.1"
     regulatory      10..12
                     /note="operator-r1"
ORIGIN
        1 atgcatgcat gc
//
`,
      fileName: "features.gb",
    });
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [],
    };

    expect(
      querySequenceViewer({
        ...shared,
        request: {
          limit: 10,
          query: "NP_040628.1",
          target: "features",
        },
      }),
    ).toMatchObject({
      items: [expect.objectContaining({ sourceLocation: "complement(1..9)" })],
      page: { count: 1, totalCount: 1 },
    });
    expect(
      querySequenceViewer({
        ...shared,
        request: { limit: 10, query: "operator-r1", target: "features" },
      }),
    ).toMatchObject({
      items: [expect.objectContaining({ start: 10, end: 12 })],
      page: { count: 1, totalCount: 1 },
    });
  });

  it("shrinks large feature pages beneath the installed-host completion envelope", () => {
    const featureCount = 50;
    const features = Array.from(
      { length: featureCount },
      (_, index) => `     misc_feature    ${index + 1}..${index + 1}
                     /gene="cI"
                     /note="feature-${index}-${"x".repeat(6_000)}"`,
    ).join("\n");
    const document = parseSequenceDocument({
      contents: `LOCUS       LARGE                    100 bp    DNA     linear
FEATURES             Location/Qualifiers
     source          1..100
${features}
ORIGIN
        1 ${"a".repeat(100)}
//
`,
      fileName: "large-features.gb",
    });
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [],
    };
    const first = querySequenceViewer({
      ...shared,
      request: { limit: featureCount, query: "cI", target: "features" },
    });

    expect(first.page?.count).toBeGreaterThan(0);
    expect(first.page?.count).toBeLessThan(featureCount);
    expect(first.nextCursor).toBe(`q1.features.${first.page?.count}`);
    expect(first).toMatchObject({
      page: { totalCount: featureCount },
      truncated: true,
    });
    const completionRequest = {
      arguments: {
        applied: true,
        commandId: "11111111-1111-4111-8111-111111111111",
        message: "Returned features from the live Sequence viewer.",
        sessionId: "22222222-2222-4222-8222-222222222222",
        state: { query: first },
      },
      name: "sequence.complete_viewer_command",
    };
    const completionRequestBytes = new TextEncoder().encode(
      JSON.stringify({
        id: "sequence-viewer-completion",
        jsonrpc: "2.0",
        method: "tools/call",
        params: completionRequest,
      }),
    ).byteLength;
    expect(completionRequestBytes).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
    expect(
      new TextEncoder().encode(
        JSON.stringify(completionRequest.arguments.state),
      ).byteLength,
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.command.maxCompletionStateBytes,
    );

    const second = querySequenceViewer({
      ...shared,
      request: {
        cursor: first.nextCursor ?? undefined,
        limit: featureCount,
        query: "cI",
        target: "features",
      },
    });
    expect((first.page?.count ?? 0) + (second.page?.count ?? 0)).toBe(
      featureCount,
    );
    expect(second.nextCursor).toBeNull();
    const returnedIds = [...(first.items ?? []), ...(second.items ?? [])].map(
      (item) => (item as { id: string }).id,
    );
    const expectedIds = document.records[0]?.features
      .filter((feature) => feature.qualifiers.gene === "cI")
      .map(({ id }) => id);
    expect(returnedIds).toEqual(expectedIds);
    expect(new Set(returnedIds).size).toBe(featureCount);
  });

  it("rejects a single feature that cannot fit without returning a stuck cursor", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       OVERSIZED                  10 bp    DNA     linear
FEATURES             Location/Qualifiers
     source          1..10
     misc_feature    1..10
                     /gene="cI"
                     /note="${"x".repeat(250 * 1_024)}"
ORIGIN
        1 aaaaaaaaaa
//
`,
      fileName: "oversized-feature.gb",
    });

    expect(() =>
      querySequenceViewer({
        artifacts: [],
        document,
        hits: [],
        jobs: [],
        request: { limit: 1, query: "cI", target: "features" },
        selectedRecordId: document.records[0]?.id ?? "",
        tracks: [],
      }),
    ).toThrow("Narrow the query or coordinate window");
  });

  it("queries variants, coverage, and reads beyond model-context truncation", () => {
    const document = parseSequenceDocument({
      contents: ">chr1\nACGTACGTACGT\n",
      fileName: "chr1.fasta",
    });
    const tracks = [
      parseSequenceTrack({
        content: "chr1\t3\tv1\tG\tA\t50\tPASS\tDP=2\n",
        displayName: "variants.vcf",
        format: "vcf",
        id: "variants",
        requestedReference: "chr1",
      }),
      parseSequenceTrack({
        content: "r1\t0\tchr1\t2\t60\t4M\t*\t0\t0\tCGTA\tIIII\n",
        displayName: "reads.sam",
        format: "sam",
        id: "reads",
        requestedReference: "chr1",
        sourceItemCount: 20,
        sourceTruncated: true,
      }),
    ];
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks,
    };
    expect(
      querySequenceViewer({
        ...shared,
        request: {
          end: 8,
          limit: 100,
          reference: "chr1",
          start: 1,
          target: "variants",
        },
      }).items,
    ).toHaveLength(1);
    const coverageQuery = querySequenceViewer({
      ...shared,
      request: {
        end: 8,
        limit: 100,
        reference: "chr1",
        start: 1,
        target: "coverage",
      },
    });
    expect(coverageQuery.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ coordinate: 3, depth: 1 }),
      ]),
    );
    expect(coverageQuery.result).toMatchObject({
      coverageComplete: false,
      coverageOmittedReadCount: 0,
      coverageReadCount: 1,
      coverageScope: "filtered-loaded-reads-before-display-sampling",
      sourceTruncated: true,
      sourceReadCount: 20,
    });
    expect(
      querySequenceViewer({
        ...shared,
        request: {
          end: 8,
          limit: 100,
          reference: "chr1",
          start: 1,
          target: "reads",
        },
      }).result,
    ).toMatchObject({
      downsampled: true,
      sourceReadCount: 20,
      sourceTruncated: true,
      totalReadCount: 1,
    });
  });

  it("exposes canonical read options, stable source identity, filtered coverage and paged base events to agents", () => {
    const document = parseSequenceDocument({
      contents: ">ref\nACGT\n",
      fileName: "reference.fasta",
    });
    const track = parseSequenceTrack({
      content: [
        "same-name\t0\tref\t1\t60\t4M\t*\t0\t0\tACGT\tIIII",
        "same-name\t16\tref\t1\t255\t4M\t*\t0\t0\tATGT\t*",
      ].join("\n"),
      displayName: "reads.sam",
      format: "sam",
      id: "source",
      requestedReference: "ref",
    });
    const readPileupState = {
      options: {
        ...DEFAULT_READ_PILEUP_STATE.options,
        minimumMappingQuality: 30,
        includeUnknownMappingQuality: false,
        showSoftClips: false,
      },
      selectedRead: { sourceReadIndex: 0, trackId: "source" },
    };
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      readPileupRange: { start: 1, end: 4 },
      readPileupState,
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [track],
    };
    expect(
      querySequenceViewer({
        ...shared,
        request: { target: "read-pileup-state" },
      }).result,
    ).toMatchObject({ ...readPileupState, range: { start: 1, end: 4 } });
    const reads = querySequenceViewer({
      ...shared,
      request: {
        target: "reads",
        start: 1,
        end: 4,
        reference: "ref",
        limit: 100,
      },
    });
    expect(reads.items).toEqual([
      expect.objectContaining({ sourceReadIndex: 0, trackId: "source" }),
    ]);
    expect(reads.result).toMatchObject({
      totalReadCount: 2,
      filteredReadCount: 1,
    });
    const coverage = querySequenceViewer({
      ...shared,
      request: {
        target: "coverage",
        start: 1,
        end: 4,
        reference: "ref",
        limit: 100,
      },
    });
    expect(coverage.items).toEqual(
      [1, 2, 3, 4].map((coordinate) => ({ coordinate, depth: 1 })),
    );
    const first = querySequenceViewer({
      ...shared,
      request: {
        target: "read-detail",
        trackId: "source",
        sourceReadIndex: 1,
        limit: 2,
      },
    });
    expect(first).toMatchObject({
      nextCursor: "q1.read-detail.2",
      page: { count: 2, offset: 0, totalCount: 5 },
      result: {
        mappingQuality: null,
        mappingQualityRaw: 255,
        inDisplayedSample: false,
        sourceReadIndex: 1,
        trackId: "source",
        strand: "-",
        referenceRecordId: document.records[0]?.id,
      },
    });
    const next = querySequenceViewer({
      ...shared,
      request: {
        target: "read-detail",
        trackId: "source",
        sourceReadIndex: 1,
        limit: 500,
        cursor: first.nextCursor ?? undefined,
      },
    });
    expect(next.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "base-call",
          base: "T",
          referenceBase: "C",
          comparison: "mismatch",
          coordinate: 2,
          quality: null,
        }),
      ]),
    );
    expect(next.nextCursor).toBeNull();
    expect(() =>
      querySequenceViewer({
        ...shared,
        request: {
          target: "read-detail",
          trackId: "source",
          sourceReadIndex: 2,
          limit: 100,
        },
      }),
    ).toThrow(/not present/);
  });

  it("bounds read-detail sequence previews and discloses omitted base calls for wide windows", () => {
    const document = parseSequenceDocument({
      contents: `>ref\n${"A".repeat(1_000)}\n`,
      fileName: "reference.fasta",
    });
    const track = parseSequenceTrack({
      content: `long\t0\tref\t1\t60\t1000M\t*\t0\t0\t${"A".repeat(1_000)}\t*`,
      displayName: "long.sam",
      format: "sam",
      id: "long",
      requestedReference: "ref",
    });
    const result = querySequenceViewer({
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [track],
      request: {
        target: "read-detail",
        trackId: "long",
        sourceReadIndex: 0,
        start: 1,
        end: 1_000,
        limit: 500,
      },
    });
    expect(result.items).toEqual([
      {
        type: "alignment-block",
        operation: "M",
        coordinate: 1,
        start: 1,
        end: 1_000,
      },
    ]);
    expect(result.result).toMatchObject({
      baseCallsOmitted: true,
      sequenceTruncated: true,
      sequence: "A".repeat(500),
      sequenceLength: 1_000,
      windowPartial: false,
    });
  });

  it("retains original read metadata but blocks all mapped evidence on edited copies until undo", () => {
    const original = parseSequenceDocument({
      contents: ">ref\nACGT\n",
      fileName: "ref.fasta",
    });
    const recordId = original.records[0]?.id ?? "";
    const track = parseSequenceTrack({
      content: "r1\t0\tref\t1\t60\t4M\t*\t0\t0\tACGT\tIIII",
      displayName: "reads.sam",
      format: "sam",
      id: "reads",
      requestedReference: "ref",
    });
    let state = sequenceWorkbenchReducer(
      createSequenceWorkbenchState(original),
      { type: "add-track", track },
    );
    const edit = insertSequence(state.document, recordId, 1, "T");
    state = sequenceWorkbenchReducer(state, {
      type: "apply-sequence-document",
      document: edit.document,
      description: edit.change.description,
    });
    const shared = {
      artifacts: [],
      document: state.document,
      hits: [],
      jobs: [],
      selectedRecordId: recordId,
      tracks: state.tracks,
    };
    for (const target of ["reads", "coverage", "variants"] as const) {
      expect(
        querySequenceViewer({
          ...shared,
          request: { target, reference: "ref", start: 1, end: 4, limit: 100 },
        }),
      ).toMatchObject({
        items: [],
        result: {
          available: false,
          coverageComplete: false,
          originalSourceTracksRetained: true,
          unavailableReason: expect.stringMatching(
            /reference sequence was edited/,
          ),
        },
      });
    }
    const detail = querySequenceViewer({
      ...shared,
      request: {
        target: "read-detail",
        trackId: "reads",
        sourceReadIndex: 0,
        limit: 100,
      },
    });
    expect(detail).toMatchObject({
      items: [],
      result: {
        position: 1,
        end: 4,
        sequence: "ACGT",
        evidenceCoordinatesStale: true,
        originalSourceCoordinatesRetained: true,
        projectionUnavailableReason: expect.stringMatching(
          /reference sequence was edited/,
        ),
      },
    });
    expect(
      querySequenceViewer({
        ...shared,
        request: { target: "read-pileup-state" },
      }).result,
    ).toMatchObject({
      evidenceCoordinatesStale: true,
      unavailableReason: expect.any(String),
    });
    state = sequenceWorkbenchReducer(state, { type: "undo-sequence-document" });
    const restored = querySequenceViewer({
      ...shared,
      document: state.document,
      request: {
        target: "read-detail",
        trackId: "reads",
        sourceReadIndex: 0,
        limit: 100,
      },
    });
    expect(restored.result?.projectionUnavailableReason).toBeNull();
    expect(restored.items).toHaveLength(5);
    expect(state.tracks[0]?.reads?.[0]).toMatchObject({
      position: 1,
      cigar: "4M",
      sequence: "ACGT",
    });
  });

  it("reports sample visibility from the selected reference and mounted range, not the detail request", () => {
    const document = parseSequenceDocument({
      contents: ">chr1\nAAAAAAAA\n>1\nTTTTTTTT\n",
      fileName: "references.fasta",
    });
    const track = parseSequenceTrack({
      content:
        "a\t0\tchr1\t1\t60\t4M\t*\t0\t0\tAAAA\tIIII\nb\t0\t1\t1\t60\t4M\t*\t0\t0\tTTTT\tIIII",
      displayName: "reads.sam",
      format: "sam",
      id: "reads",
      requestedReference: "chr1",
    });
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [track],
    };
    const hidden = querySequenceViewer({
      ...shared,
      readPileupRange: { start: 1, end: 4 },
      request: {
        target: "read-detail",
        trackId: "reads",
        sourceReadIndex: 1,
        start: 1,
        end: 4,
        limit: 100,
      },
    });
    expect(hidden.result).toMatchObject({
      inDisplayedSample: false,
      projectionUnavailableReason: null,
    });
    const outside = querySequenceViewer({
      ...shared,
      readPileupRange: { start: 5, end: 8 },
      request: {
        target: "read-detail",
        trackId: "reads",
        sourceReadIndex: 0,
        start: 1,
        end: 4,
        limit: 100,
      },
    });
    expect(outside.result?.inDisplayedSample).toBe(false);
    const unknown = querySequenceViewer({
      ...shared,
      request: {
        target: "read-detail",
        trackId: "reads",
        sourceReadIndex: 0,
        limit: 100,
      },
    });
    expect(unknown.result?.inDisplayedSample).toBeNull();
  });

  it("never returns 100 private VCF sample names or genotypes from Sequence queries", () => {
    const document = parseSequenceDocument({
      contents: ">1\nACGTACGTACGT\n",
      fileName: "public-chromosome-1.fasta",
    });
    const track = privateHundredSampleVcfTrack();
    const shared = {
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      selectedRecordId: document.records[0]?.id ?? "",
      tracks: [track],
    };
    const first = querySequenceViewer({
      ...shared,
      request: {
        end: 10,
        limit: 1,
        reference: "1",
        start: 1,
        target: "variants",
      },
    });

    expect(first).toMatchObject({
      items: [
        {
          alternateAlleles: ["G"],
          filters: [],
          id: "rs-public-1",
          infoCount: 1,
          position: 5,
          quality: 60,
          reference: "1",
          referenceAllele: "A",
          sampleCount: 100,
        },
      ],
      nextCursor: "q1.variants.1",
      page: { count: 1, totalCount: 2 },
    });
    assertNoPrivateVcfData(first);

    const second = querySequenceViewer({
      ...shared,
      request: {
        cursor: first.nextCursor ?? undefined,
        end: 10,
        limit: 1,
        reference: "1",
        start: 1,
        target: "variants",
      },
    });
    expect(second).toMatchObject({
      items: [{ position: 6, sampleCount: 100 }],
      nextCursor: null,
    });
    assertNoPrivateVcfData(second);

    const summary = querySequenceViewer({
      ...shared,
      request: { limit: 10, target: "tracks" },
    });
    expect(summary.items).toEqual([
      expect.objectContaining({
        format: "vcf",
        id: "public-100-sample-vcf",
        variantCount: 2,
      }),
    ]);
    assertNoPrivateVcfData(summary);
    expect(track.vcfHeader?.sampleNames).toHaveLength(100);
    expect(track.variants?.[0]?.sampleValues).toHaveLength(100);
  });

  it("never returns 100 private VCF sample names or genotypes from Alignment queries", () => {
    const document = alignmentDocument(">1\nAACCGGTTAACC\n>2\nAATCGGTTAACC\n");
    const track = privateHundredSampleVcfTrack();
    const shared = {
      analysis: null,
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      tracks: [track],
      tree: null,
    };

    const variants = queryAlignmentViewer({
      ...shared,
      request: {
        end: 10,
        limit: 10,
        reference: "1",
        start: 1,
        target: "variants",
      },
    });
    expect(variants.items).toEqual([
      expect.objectContaining({
        infoCount: 1,
        position: 5,
        sampleCount: 100,
      }),
      expect.objectContaining({ position: 6, sampleCount: 100 }),
    ]);
    assertNoPrivateVcfData(variants);

    const summary = queryAlignmentViewer({
      ...shared,
      request: { limit: 10, target: "tracks" },
    });
    expect(summary.items).toEqual([
      expect.objectContaining({
        id: "public-100-sample-vcf",
        variantCount: 2,
      }),
    ]);
    assertNoPrivateVcfData(summary);
    expect(track.variants?.[1]?.sampleValues).toHaveLength(100);
  });

  it("pages alignment rows and returns bounded column metrics and tree nodes", () => {
    const document = alignmentDocument(">a\nAAAA\n>b\nAAAT\n>c\nTTTT\n");
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "analysis",
      analysisRowIds: document.rows.map(({ id }) => id),
      document,
    });
    const tree = buildGuideTree(document.rows);
    const shared = {
      analysis,
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      tracks: [],
      tree,
    };
    expect(
      queryAlignmentViewer({
        ...shared,
        request: { limit: 2, target: "rows" },
      }),
    ).toMatchObject({ page: { count: 2, totalCount: 3 }, truncated: true });
    expect(
      queryAlignmentViewer({
        ...shared,
        request: { end: 2, start: 1, target: "columns" },
      }).items,
    ).toEqual([
      expect.objectContaining({ column: 1, consensus: expect.any(String) }),
      expect.objectContaining({ column: 2, identity: expect.any(Number) }),
    ]);
    expect(
      queryAlignmentViewer({
        ...shared,
        request: { limit: 2, target: "metrics" },
      }).items,
    ).toEqual([
      expect.objectContaining({
        column: 1,
        consensus: expect.any(String),
        conservation: expect.any(Number),
        gapFraction: expect.any(Number),
        identity: expect.any(Number),
      }),
      expect.objectContaining({
        column: 2,
        consensus: expect.any(String),
        conservation: expect.any(Number),
        gapFraction: expect.any(Number),
        identity: expect.any(Number),
      }),
    ]);
    expect(
      queryAlignmentViewer({
        ...shared,
        request: { limit: 100, target: "tree-nodes" },
      }).items?.length,
    ).toBeGreaterThan(document.rows.length);
  });

  it("returns bounded track summaries from alignment mode", () => {
    const document = alignmentDocument(">a\nAAAA\n>b\nAAAT\n");
    const track = parseSequenceTrack({
      content: "r1\t0\ta\t1\t60\t4M\t*\t0\t0\tAAAA\tIIII\n",
      displayName: "reads.sam",
      format: "sam",
      id: "reads",
    });
    const result = queryAlignmentViewer({
      analysis: null,
      artifacts: [],
      document,
      hits: [],
      jobs: [],
      request: { limit: 100, target: "tracks" },
      tracks: [track],
      tree: null,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "reads",
        readCount: 1,
      }),
    ]);
    expect(result.items?.[0]).not.toHaveProperty("reads");
  });

  it("rejects oversized coordinate windows rather than returning partial unlabeled data", () => {
    const document = parseSequenceDocument({
      contents: `>long\n${"A".repeat(100_001)}\n`,
      fileName: "long.fasta",
    });
    expect(() =>
      querySequenceViewer({
        artifacts: [],
        document,
        hits: [],
        jobs: [],
        request: { end: 100_001, start: 1, target: "sequence-range" },
        selectedRecordId: document.records[0]?.id ?? "",
        tracks: [],
      }),
    ).toThrow("100,000 residues");
  });
});

function alignmentDocument(contents: string) {
  const result = parseMsa(contents, "demo.aln-fasta");
  if (result.status !== "success") throw new Error(result.message);
  return result.document;
}

function privateHundredSampleVcfTrack() {
  const sampleNames = Array.from(
    { length: 100 },
    (_, index) => `QA_PRIVATE_SAMPLE_${index + 1}`,
  );
  const sampleValues = sampleNames.map(
    (_, index) => `0/1:PRIVATE_GENOTYPE_${index + 1}`,
  );
  return Object.assign(
    parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##SAMPLE=<ID=QA_PRIVATE_SAMPLE_1,Description=PRIVATE_HEADER_METADATA>",
        [
          "#CHROM",
          "POS",
          "ID",
          "REF",
          "ALT",
          "QUAL",
          "FILTER",
          "INFO",
          "FORMAT",
          ...sampleNames,
        ].join("\t"),
        [
          "1",
          "5",
          "rs-public-1",
          "A",
          "G",
          "60",
          ".",
          "PRIVATE_INFO_KEY=PRIVATE_INFO_VALUE",
          "GT:PRIVATE_FORMAT",
          ...sampleValues,
        ].join("\t"),
        [
          "1",
          "6",
          "rs-public-2",
          "C",
          "T",
          ".",
          "PASS",
          "PRIVATE_INFO_KEY=PRIVATE_INFO_VALUE",
          "GT:PRIVATE_FORMAT",
          ...sampleValues,
        ].join("\t"),
      ].join("\n"),
      displayName: "official-100-sample-conformance.vcf",
      format: "vcf",
      id: "public-100-sample-vcf",
      requestedReference: "1",
    }),
    { futurePrivateSamplePayload: "PRIVATE_FUTURE_METADATA" },
  );
}

function assertNoPrivateVcfData(result: unknown): void {
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain("QA_PRIVATE_SAMPLE_");
  expect(serialized).not.toContain("PRIVATE_GENOTYPE_");
  expect(serialized).not.toContain("PRIVATE_HEADER_METADATA");
  expect(serialized).not.toContain("PRIVATE_INFO_KEY");
  expect(serialized).not.toContain("PRIVATE_INFO_VALUE");
  expect(serialized).not.toContain("PRIVATE_FORMAT");
  expect(serialized).not.toContain("PRIVATE_FUTURE_METADATA");
  expect(serialized).not.toContain("vcfHeader");
  expect(serialized).not.toContain("sampleValues");
}
