import { describe, expect, it } from "vitest";

import { parseMsa } from "./msa/parser";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  SYNTHETIC_TRACE_CHANNELS,
} from "./sequence/__fixtures__/chromatogram";
import { parseBinarySequenceDocument } from "./sequence/binary-parser";
import { CHROMATOGRAM_LIMITS } from "./sequence/formats/chromatogram";
import { createFastqQualityViewState } from "./sequence/fastq-quality-analysis";
import {
  createSequenceInterfaceSettings,
  type SequenceInterfaceSettings,
} from "./sequence/interface-state";
import { parseSequenceDocument } from "./sequence/parser";
import { DEFAULT_READ_PILEUP_STATE } from "./sequence/read-pileup";
import { parseSequenceTrack } from "./sequence/tracks";
import type {
  SequenceChromatogram,
  SequenceDocument,
  SequenceSelection,
} from "./sequence/types";
import { parseAndValidateWorkbenchSession } from "./workbench-session-validation";

describe("workbench session hardening", () => {
  it("accepts a bounded sequence snapshot with an exact source/view contract", () => {
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    const parsed = parseAndValidateWorkbenchSession(
      JSON.stringify({
        artifacts: [],
        createdAt: 1,
        dirty: true,
        jobs: [],
        revision: 2,
        schemaVersion: 1,
        snapshot: { sequenceDocument: document },
        source: { fileName: "demo.fasta", format: "fasta" },
        tracks: [],
        view: {
          mode: "sequence",
          sequence: {
            geneticCodeId: 1,
            layout: "linear",
            orientation: "forward",
            paletteId: "neutral",
            selectedFeatureId: null,
            selectedRecordId: document.records[0]?.id ?? "",
            selection: null,
            showFeatures: true,
            showQuality: false,
            showTranslation: false,
            synchronizedViews: true,
            viewport: null,
            wrapWidth: 60,
          },
        },
      }),
    );
    expect(parsed.snapshot?.sequenceDocument?.records[0]?.sequence).toBe("ACGT");
    expect(parsed.view.sequence?.interface).toBeUndefined();
  });

  it("rejects unknown top-level and snapshot fields", () => {
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify({
          artifacts: [],
          createdAt: 1,
          dirty: false,
          injected: true,
          jobs: [],
          revision: 0,
          schemaVersion: 1,
          source: { fileName: null, format: "fasta" },
          tracks: [],
          view: {
            mode: "sequence",
            sequence: sequenceView(),
          },
        }),
      ),
    ).toThrow();

    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify({
          artifacts: [],
          createdAt: 1,
          dirty: true,
          jobs: [],
          revision: 1,
          schemaVersion: 1,
          snapshot: {
            sequenceDocument: { ...document, unexpected: "payload" },
          },
          source: { fileName: "demo.fasta", format: "fasta" },
          tracks: [],
          view: { mode: "sequence", sequence: sequenceView() },
        }),
      ),
    ).toThrow("unsupported fields");
  });

  it("rejects inconsistent sequence and alignment snapshot coordinates", () => {
    const sequence = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    sequence.records[0]!.length = 99;
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify({
          artifacts: [], createdAt: 1, dirty: true, jobs: [], revision: 1,
          schemaVersion: 1, snapshot: { sequenceDocument: sequence },
          source: { fileName: "demo.fasta", format: "fasta" }, tracks: [],
          view: { mode: "sequence", sequence: sequenceView() },
        }),
      ),
    ).toThrow("length is inconsistent");

    const parsed = parseMsa(">a\nAAAA\n>b\nAAAT\n", "demo.aln-fasta");
    if (parsed.status !== "success") throw new Error(parsed.message);
    parsed.document.rows[0]!.alignedSequence = "AAA";
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify({
          artifacts: [], createdAt: 1, dirty: true, jobs: [], revision: 1,
          schemaVersion: 1, snapshot: { alignmentDocument: parsed.document },
          source: { fileName: "demo.aln-fasta", format: "aligned-fasta" }, tracks: [],
          view: { alignment: alignmentView(), mode: "alignment" },
        }),
      ),
    ).toThrow("unequal row widths");
  });

  it("round-trips canonical origin-spanning selections on circular records", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       demo        12 bp    DNA     circular
ACCESSION   demo
ORIGIN
        1 acgtacgtacgt
//`,
      fileName: "demo.gb",
    });
    const recordId = document.records[0]?.id ?? "";
    const session = {
      artifacts: [],
      createdAt: 1,
      dirty: false,
      jobs: [],
      revision: 0,
      schemaVersion: 1,
      snapshot: { sequenceDocument: document },
      source: { fileName: "demo.gb", format: "genbank" },
      tracks: [],
      view: {
        mode: "sequence",
        sequence: {
          ...sequenceView(),
          selectedRecordId: recordId,
          selection: {
            end: 3,
            recordId,
            segments: [
              { end: 12, start: 10 },
              { end: 3, start: 1 },
            ],
            start: 10,
          },
        },
      },
    };

    expect(
      parseAndValidateWorkbenchSession(JSON.stringify(session)).view,
    ).toMatchObject({
      sequence: {
        selection: {
          end: 3,
          segments: [
            { end: 12, start: 10 },
            { end: 3, start: 1 },
          ],
          start: 10,
        },
      },
    });
    session.view.sequence.selection.segments[0]!.start = 11;
    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow("selection segments are inconsistent");
  });

  it.each([
    {
      order: "ascending",
      segments: [
        { start: 1, end: 2 },
        { start: 5, end: 6 },
        { start: 9, end: 12 },
      ],
    },
    {
      order: "descending",
      segments: [
        { start: 9, end: 12 },
        { start: 5, end: 6 },
        { start: 1, end: 2 },
      ],
    },
    {
      order: "wrapping",
      segments: [
        { start: 5, end: 6 },
        { start: 9, end: 12 },
        { start: 1, end: 2 },
      ],
    },
  ])("round-trips compound source segments in $order order", ({ segments }) => {
    const document = parseSequenceDocument({
      contents: ">QA-COMPOUND-CONTROL\nATGCATGCATGC\n",
      fileName: "compound.fasta",
    });
    const selection = {
      end: segments.at(-1)!.end,
      recordId: document.records[0]!.id,
      segments,
      start: segments[0]!.start,
    };
    const session = sequenceSnapshotSession(document, selection);

    expect(
      parseAndValidateWorkbenchSession(JSON.stringify(session)).view,
    ).toMatchObject({ sequence: { selection } });
  });

  it.each([
    { problem: "empty segments", segments: [] },
    {
      problem: "overlapping segments",
      segments: [
        { start: 2, end: 4 },
        { start: 4, end: 6 },
      ],
    },
    {
      problem: "out-of-record coordinates",
      segments: [
        { start: 2, end: 4 },
        { start: 6, end: 1_201 },
      ],
    },
    {
      problem: "zero-based endpoints",
      segments: [
        { start: 2, end: 4 },
        { start: 0, end: 1 },
      ],
    },
    {
      problem: "reversed segments",
      segments: [
        { start: 2, end: 4 },
        { start: 6, end: 5 },
      ],
    },
    {
      problem: "fractional endpoints",
      segments: [
        { start: 2, end: 4 },
        { start: 6.5, end: 7 },
      ],
    },
    {
      problem: "more than 1,000 segments",
      segments: Array.from({ length: 1_001 }, (_, index) => ({
        start: index + 1,
        end: index + 1,
      })),
    },
  ])("rejects compound selections with $problem", ({ segments }) => {
    const document = parseSequenceDocument({
      contents: `>QA-COMPOUND-CONTROL\n${"ATGC".repeat(300)}\n`,
      fileName: "compound.fasta",
    });
    const selection = {
      end: segments.at(-1)?.end ?? 1,
      recordId: document.records[0]!.id,
      segments,
      start: segments[0]?.start ?? 1,
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSnapshotSession(document, selection)),
      ),
    ).toThrow();
  });

  it("restores bounded original ABIF traces without converting source confidences to FASTQ", () => {
    const trace = syntheticTrace();
    trace.channels.A[0] = -32_768;
    trace.channels.T[3] = 65_535;
    trace.peakLocations = [0, 1, 1, 3];
    const restored = parseAndValidateWorkbenchSession(
      JSON.stringify(chromatogramSession(trace)),
    );

    expect(
      restored.snapshot?.sequenceDocument?.records[0]?.chromatogram,
    ).toEqual(trace);
    expect(
      restored.snapshot?.sequenceDocument?.records[0]?.quality,
    ).toBeUndefined();
    const {
      quality: _quality,
      qualityEncoding: _qualityEncoding,
      ...withoutQuality
    } = trace;
    const unscored = parseAndValidateWorkbenchSession(
      JSON.stringify(chromatogramSession(withoutQuality)),
    );
    expect(
      unscored.snapshot?.sequenceDocument?.records[0]?.chromatogram?.quality,
    ).toBeUndefined();
  });

  it.each([
    ["null trace", null],
    ["unknown format", { format: "fastq" }],
    ["unknown field", { unexpected: "payload" }],
    ["zero sample count", { sampleCount: 0 }],
    [
      "oversized sample count",
      { sampleCount: CHROMATOGRAM_LIMITS.maxSamples + 1 },
    ],
    [
      "noninteger signal",
      { channels: { ...syntheticTrace().channels, A: [0, 1, 2, 3.5] } },
    ],
    [
      "nonfinite signal",
      {
        channels: {
          ...syntheticTrace().channels,
          A: [0, 1, 2, Number.POSITIVE_INFINITY],
        },
      },
    ],
    [
      "out-of-range signal",
      { channels: { ...syntheticTrace().channels, A: [0, 1, 2, 65_536] } },
    ],
    [
      "negative signal overflow",
      { channels: { ...syntheticTrace().channels, A: [0, 1, 2, -32_769] } },
    ],
    ["missing channel", { channels: { A: [0, 1, 2, 3] } }],
    [
      "extra channel",
      { channels: { ...syntheticTrace().channels, U: [0, 1, 2, 3] } },
    ],
    [
      "unequal channel lengths",
      { channels: { ...syntheticTrace().channels, A: [0, 1, 2] } },
    ],
    ["wrong base-call count", { peakLocations: [0, 1, 2] }],
    ["negative peak", { peakLocations: [-1, 1, 2, 3] }],
    ["reversed peaks", { peakLocations: [0, 2, 1, 3] }],
    ["peak outside signal", { peakLocations: [0, 1, 2, 4] }],
    ["noninteger peak", { peakLocations: [0, 1, 2, 2.5] }],
    ["wrong quality length", { quality: [20, 30, 40] }],
    ["quality overflow", { quality: [20, 30, 40, 256] }],
    ["null Phred quality", { quality: [20, 30, 40, null] }],
    ["missing quality encoding", { qualityEncoding: undefined }],
    ["wrong quality encoding", { qualityEncoding: "source-confidence" }],
    [
      "SCF confidences on ABIF",
      {
        baseConfidences: {
          A: [1, 2, 3, 4],
          C: [1, 2, 3, 4],
          G: [1, 2, 3, 4],
          T: [1, 2, 3, 4],
        },
      },
    ],
  ])("rejects malformed source chromatograms: %s", (_label, update) => {
    const trace = update === null ? null : { ...syntheticTrace(), ...update };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(chromatogramSession(trace)),
      ),
    ).toThrow();
  });

  it("rejects oversized signal arrays before accepting a restored trace", () => {
    const trace = syntheticTrace();
    trace.channels.A = Array.from(
      { length: CHROMATOGRAM_LIMITS.maxSamples + 1 },
      () => 0,
    );
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(chromatogramSession(trace)),
      ),
    ).toThrow();
  });

  it("preserves separate SCF confidences and unknown quality for ambiguous calls", () => {
    const trace = syntheticScfTrace();
    const restored = parseAndValidateWorkbenchSession(
      JSON.stringify(chromatogramSession(trace, "ANGT")),
    );
    expect(
      restored.snapshot?.sequenceDocument?.records[0]?.chromatogram,
    ).toEqual(trace);
  });

  it.each(["abif", "scf"] as const)(
    "round-trips decoded %s bytes through a durable session without changing source evidence",
    (format) => {
      const bytes =
        format === "abif"
          ? makeSyntheticAbif({
              channels: {
                ...SYNTHETIC_TRACE_CHANNELS,
                A: [-3, -1, ...SYNTHETIC_TRACE_CHANNELS.A.slice(2)],
              },
            })
          : makeSyntheticScf();
      const document = parseBinarySequenceDocument({
        bytes,
        fileName:
          format === "abif" ? "synthetic-trace.ab1" : "synthetic-trace.scf",
      });
      const restored = parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSnapshotSession(document)),
      );

      expect(restored.snapshot?.sequenceDocument).toEqual(document);
      const trace =
        restored.snapshot?.sequenceDocument?.records[0]?.chromatogram;
      if (format === "abif") {
        expect(trace?.channels.A.slice(0, 2)).toEqual([-3, -1]);
      } else {
        expect(trace?.quality?.at(-1)).toBeNull();
        expect(trace?.baseConfidences?.A).toEqual([31, 1, 1, 1, 1]);
      }
    },
  );

  it.each([
    [
      "signed SCF signal",
      { channels: { ...syntheticScfTrace().channels, A: [-1, 1, 2, 3] } },
    ],
    [
      "nonbyte confidence",
      {
        baseConfidences: {
          ...syntheticScfTrace().baseConfidences,
          A: [256, 1, 2, 3],
        },
      },
    ],
    [
      "short confidence channel",
      { baseConfidences: { ...syntheticScfTrace().baseConfidences, A: [20] } },
    ],
    ["missing confidence channel", { baseConfidences: { A: [20, 1, 2, 3] } }],
    [
      "unknown confidence channel",
      {
        baseConfidences: {
          ...syntheticScfTrace().baseConfidences,
          N: [0, 0, 0, 0],
        },
      },
    ],
    ["null canonical-base confidence", { quality: [null, null, 40, 50] }],
    ["invented ambiguity confidence", { quality: [20, 30, 40, 50] }],
    ["inconsistent source confidence", { quality: [21, null, 40, 50] }],
    ["Phred claim for source confidence", { qualityEncoding: "phred" }],
  ])("rejects invalid SCF confidence mapping: %s", (_label, update) => {
    const trace = { ...syntheticScfTrace(), ...update };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(chromatogramSession(trace, "ANGT")),
      ),
    ).toThrow();
  });

  it("round-trips genuine BED12 exon/coding blocks and nonzero GTF CDS phases", () => {
    const bed = parseSequenceTrack({
      content: "chr22\t1000\t5000\tmRNA1\t0\t+\t1200\t4900\t0\t2\t567,488\t0,3512\n",
      displayName: "ucsc-bed12-track.bed",
      format: "bed",
      id: "public-chr22-bed12",
      requestedReference: "chr22",
    });
    const gtf = parseSequenceTrack({
      content:
        'chr22\tpublic\tCDS\t3698\t3978\t.\t+\t2\tgene_id "AC007323.5"; transcript_id "public-cds";\n',
      displayName: "public-compound-cds.gtf",
      format: "gtf",
      id: "public-nonzero-phase",
      requestedReference: "chr22",
    });

    const restored = parseAndValidateWorkbenchSession(
      JSON.stringify(sequenceSessionWithTracks([bed, gtf])),
    );

    expect(restored.tracks[0]?.features?.[0]).toMatchObject({
      codingSegments: [
        { end: 1567, start: 1201 },
        { end: 4900, start: 4513 },
      ],
      segments: [
        { end: 1567, start: 1001 },
        { end: 5000, start: 4513 },
      ],
    });
    expect(restored.tracks[1]?.features?.[0]?.phase).toBe(2);
  });

  it("round-trips complete 100-sample VCF metadata and unmodified FILTER semantics", () => {
    const sampleNames = Array.from({ length: 100 }, (_, index) => `PUBLIC_${index + 1}`);
    const sampleValues = sampleNames.map((_, index) => `0/1:${index + 1}`);
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##FORMAT=<ID=GT,Number=1,Type=String,Description=Genotype>",
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
        ["1", "10583", ".", "G", "A", ".", ".", "AC=1", "GT:DP", ...sampleValues].join("\t"),
      ].join("\n"),
      displayName: "official-100-sample-conformance.vcf",
      format: "vcf",
      id: "public-100-sample-vcf",
      requestedReference: "1",
    });

    const restored = parseAndValidateWorkbenchSession(
      JSON.stringify(sequenceSessionWithTracks([track])),
    );

    expect(restored.tracks[0]?.vcfHeader).toMatchObject({
      metaLines: [
        "##fileformat=VCFv4.3",
        "##FORMAT=<ID=GT,Number=1,Type=String,Description=Genotype>",
      ],
      sampleNames,
    });
    expect(restored.tracks[0]?.variants?.[0]).toMatchObject({
      rawFilter: ".",
      rawId: ".",
      rawQuality: ".",
      sampleValues,
    });
  });

  it("rejects escaped exon blocks, invalid CDS phases, and mismatched VCF sample columns", () => {
    const bed = parseSequenceTrack({
      content: "chr22\t1000\t5000\tmRNA1\t0\t+\t1200\t4900\t0\t2\t567,488\t0,3512\n",
      displayName: "ucsc-bed12-track.bed",
      format: "bed",
      id: "public-chr22-bed12",
      requestedReference: "chr22",
    });
    const escaped = {
      ...bed,
      features: bed.features?.map((feature) => ({
        ...feature,
        segments: [{ end: feature.end + 1, start: feature.start }],
      })),
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSessionWithTracks([escaped])),
      ),
    ).toThrow("Track feature segment extends outside its feature");

    const invalidPhase = {
      ...bed,
      features: bed.features?.map((feature) => ({ ...feature, phase: 3 })),
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSessionWithTracks([invalidPhase])),
      ),
    ).toThrow();

    const vcf = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tPUBLIC_A",
        "1\t5\t.\tA\tG\t.\t.\tAC=1\tGT\t0/1",
      ].join("\n"),
      displayName: "public-spec.vcf",
      format: "vcf",
      id: "source-bound-public-vcf",
      requestedReference: "1",
    });
    const mismatched = {
      ...vcf,
      variants: vcf.variants?.map((variant) => ({
        ...variant,
        sampleValues: ["0/1", "1/1"],
      })),
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSessionWithTracks([mismatched])),
      ),
    ).toThrow("VCF sample values do not match their preserved header");
  });

  it("rejects oversized VCF metadata and preserves workspace provenance validation", () => {
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
        "1\t5\t.\tA\tG\t.\t.\tAC=1",
      ].join("\n"),
      displayName: "public-spec.vcf",
      format: "vcf",
      id: "bounded-vcf",
      requestedReference: "1",
    });
    const oversized = {
      ...track,
      vcfHeader: {
        ...track.vcfHeader!,
        metaLines: [`##${"A".repeat(256 * 1_024)}`],
      },
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSessionWithTracks([oversized])),
      ),
    ).toThrow();

    const unsafeSource = {
      ...track,
      source: { ...track.source, workspacePath: "../../private/credentials.vcf" },
    };
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify(sequenceSessionWithTracks([unsafeSource])),
      ),
    ).toThrow();
  });
});

describe("bounded sequence interface session settings", () => {
  it("creates independent settings with the current read and quality defaults", () => {
    const first = createSequenceInterfaceSettings();
    const second = createSequenceInterfaceSettings();
    first.readPileup.options.minimumMappingQuality = 60;
    first.quality.view.expandedTables.splice(0);

    expect(second.readPileup).toEqual(DEFAULT_READ_PILEUP_STATE);
    expect(second.quality.view).toEqual(createFastqQualityViewState());
  });

  it("round-trips nondefault controls and exact source read identity across reference aliases", () => {
    const session = interfaceSessionFixture();
    const settings = session.view.sequence.interface;
    const restored = parseAndValidateWorkbenchSession(JSON.stringify(session));

    expect(restored.view.sequence?.interface).toEqual(settings);
    expect(restored.view.sequence?.interface?.readPileup.selectedRead).toEqual({
      sourceReadIndex: 1,
      trackId: "synthetic-read-source",
    });
    expect(restored.view.sequence?.interface?.quality).not.toHaveProperty(
      "report",
    );
  });

  const defaults = createSequenceInterfaceSettings();
  it.each([
    [
      "oversized annotation query",
      {
        annotationIndex: {
          ...defaults.annotationIndex,
          query: "A".repeat(501),
        },
      },
    ],
    [
      "oversized browser query",
      { recordBrowser: { ...defaults.recordBrowser, query: "A".repeat(501) } },
    ],
    [
      "negative page",
      { recordBrowser: { ...defaults.recordBrowser, page: -1 } },
    ],
    [
      "unsafe page",
      {
        annotationIndex: {
          ...defaults.annotationIndex,
          page: Number.MAX_SAFE_INTEGER + 1,
        },
      },
    ],
    [
      "empty trace window",
      { chromatogram: { basesPerWindow: 0, firstBase: 1 } },
    ],
    [
      "oversized trace window",
      { chromatogram: { basesPerWindow: 101, firstBase: 1 } },
    ],
    [
      "zero-based trace start",
      { chromatogram: { basesPerWindow: 40, firstBase: 0 } },
    ],
    [
      "invalid MAPQ",
      {
        readPileup: {
          ...defaults.readPileup,
          options: {
            ...defaults.readPileup.options,
            minimumMappingQuality: 256,
          },
        },
      },
    ],
    [
      "short adapter",
      { quality: { ...defaults.quality, adapterSequence: "ACGTACG" } },
    ],
    [
      "oversized adapter",
      { quality: { ...defaults.quality, adapterSequence: "A".repeat(65) } },
    ],
    [
      "ambiguous adapter",
      { quality: { ...defaults.quality, adapterSequence: "ACGTACGN" } },
    ],
    [
      "duplicate quality tables",
      {
        quality: {
          ...defaults.quality,
          view: {
            ...defaults.quality.view,
            expandedTables: ["cycle-quality", "cycle-quality"],
          },
        },
      },
    ],
    [
      "unknown quality table",
      {
        quality: {
          ...defaults.quality,
          view: {
            ...defaults.quality.view,
            expandedTables: ["unknown-report"],
          },
        },
      },
    ],
    [
      "persisted report payload",
      {
        quality: {
          ...defaults.quality,
          report: { rawReads: "not presentation state" },
        },
      },
    ],
    [
      "negative source read index",
      {
        readPileup: {
          ...defaults.readPileup,
          selectedRead: {
            sourceReadIndex: -1,
            trackId: "synthetic-read-source",
          },
        },
      },
    ],
  ])("rejects %s", (_problem, update) => {
    const session = interfaceSessionFixture();
    expect(() =>
      parseAndValidateWorkbenchSession(
        JSON.stringify({
          ...session,
          view: {
            ...session.view,
            sequence: {
              ...session.view.sequence,
              interface: { ...session.view.sequence.interface, ...update },
            },
          },
        }),
      ),
    ).toThrow();
  });

  it("checks a saved trace window against the selected source record, not the first record", () => {
    const session = interfaceSessionFixture();
    const secondRecord = session.snapshot.sequenceDocument.records[1]!;
    session.view.sequence.selectedRecordId = secondRecord.id;
    session.view.sequence.interface.readPileup.selectedRead = null;

    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow("outside its selected source record");
    session.view.sequence.interface.chromatogram.firstBase = 3;
    const restored = parseAndValidateWorkbenchSession(JSON.stringify(session));
    expect(restored.view.sequence?.selectedRecordId).toBe(secondRecord.id);
    expect(restored.view.sequence?.interface?.chromatogram.firstBase).toBe(3);
  });

  it("rejects a selected read from a different reference after changing the saved record", () => {
    const session = interfaceSessionFixture();
    session.view.sequence.selectedRecordId =
      session.snapshot.sequenceDocument.records[1]!.id;
    session.view.sequence.interface.chromatogram.firstBase = 1;

    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow(/different.*source record/u);
  });

  it.each(["exact source name", "ambiguous track aliases"] as const)(
    "never resolves a persisted read through a conflicting alias: %s",
    (problem) => {
      const session = interfaceSessionFixture();
      if (problem === "exact source name") {
        const source = session.snapshot.sequenceDocument.records[0]!;
        session.snapshot.sequenceDocument.records.push({
          ...source,
          id: "exact-reference-one",
          sequence: "TTTTTTTTTTTT",
          sourceLabel: "1",
        });
      } else {
        session.tracks[0]!.summary.references = ["1", "chr1"];
      }
      expect(() =>
        parseAndValidateWorkbenchSession(JSON.stringify(session)),
      ).toThrow("ambiguous");
    },
  );

  it("retains original tracks but refuses a selected read on an edited reference", () => {
    const session = interfaceSessionFixture();
    session.snapshot.sequenceDocument.records[0]!.evidenceCoordinatesStale = true;

    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow("reference sequence was edited");
    session.view.sequence.interface.readPileup.selectedRead = null;
    const restored = parseAndValidateWorkbenchSession(JSON.stringify(session));
    expect(restored.tracks).toEqual(session.tracks);
    expect(
      restored.view.sequence?.interface?.readPileup.selectedRead,
    ).toBeNull();
  });

  it.each([
    "missing track",
    "missing read",
    "duplicate track identity",
  ] as const)("rejects unresolved persisted read selection: %s", (problem) => {
    const session = interfaceSessionFixture();
    if (problem === "missing track") session.tracks = [];
    else if (problem === "missing read") {
      session.view.sequence.interface.readPileup.selectedRead!.sourceReadIndex = 2;
    } else session.tracks.push({ ...session.tracks[0]! });

    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow(/saved read selection|selected source read/u);
  });

  it("validates retained-read identity even in a source-relative session without a snapshot", () => {
    const { snapshot: _snapshot, ...session } = interfaceSessionFixture();
    expect(
      parseAndValidateWorkbenchSession(JSON.stringify(session)).view.sequence
        ?.interface,
    ).toEqual(session.view.sequence.interface);
    session.view.sequence.interface.readPileup.selectedRead!.sourceReadIndex = 99;
    expect(() =>
      parseAndValidateWorkbenchSession(JSON.stringify(session)),
    ).toThrow("selected source read");
  });
});

function interfaceSessionFixture() {
  // Synthetic source/index control, not a biological alignment result.
  const document = parseSequenceDocument({
    contents: ">cHr1\nACGTACGTACGT\n>chr2\nACGT\n",
    fileName: "synthetic-interface.fasta",
  });
  const track = parseSequenceTrack({
    content: [
      "@HD\tVN:1.6\tSO:coordinate",
      "@SQ\tSN:1\tLN:12",
      "low-mapq\t0\t1\t1\t5\t4M\t*\t0\t0\tACGT\tIIII",
      "selected\t16\t1\t5\t60\t4M\t*\t0\t0\tACGT\tIIII",
    ].join("\n"),
    displayName: "synthetic-reads.sam",
    format: "sam",
    id: "synthetic-read-source",
    requestedReference: "cHr1",
  });
  const settings: SequenceInterfaceSettings = {
    annotationIndex: { expanded: true, page: 2, query: "coding" },
    chromatogram: { basesPerWindow: 25, firstBase: 9 },
    originRangeExpanded: true,
    quality: {
      adapterSequence: "ACGTACGT",
      view: {
        distributionsExpanded: true,
        expandedTables: ["cycle-quality", "read-length"],
        methodsExpanded: true,
      },
    },
    readPileup: {
      options: {
        includeDuplicates: false,
        includeQcFailed: false,
        includeSecondary: false,
        includeSupplementary: false,
        includeUnknownMappingQuality: false,
        minimumMappingQuality: 40,
        showAllBases: true,
        showSoftClips: false,
        sortBy: "mapping-quality",
        strand: "-",
      },
      selectedRead: { sourceReadIndex: 1, trackId: track.id },
    },
    recordBrowser: { expanded: true, page: 3, query: "chr", sortBy: "length" },
  };
  const session = sequenceSnapshotSession(document);
  return {
    ...session,
    tracks: [track],
    view: {
      ...session.view,
      sequence: { ...session.view.sequence, interface: settings },
    },
  };
}

function sequenceSessionWithTracks(tracks: Array<unknown>) {
  return {
    artifacts: [],
    createdAt: 1,
    dirty: true,
    jobs: [],
    revision: 1,
    schemaVersion: 1,
    source: { fileName: "public-reference.fasta", format: "fasta" },
    tracks,
    view: { mode: "sequence", sequence: sequenceView() },
  };
}

function sequenceSnapshotSession(
  document: SequenceDocument,
  selection: SequenceSelection | null = null,
) {
  return {
    ...sequenceSessionWithTracks([]),
    snapshot: { sequenceDocument: document },
    source: { fileName: document.fileName, format: document.format },
    view: {
      mode: "sequence",
      sequence: {
        ...sequenceView(),
        selectedRecordId: document.records[0]!.id,
        selection,
      },
    },
  };
}

function chromatogramSession(chromatogram: unknown, sequence = "ACGT") {
  const document = parseSequenceDocument({
    contents: `>QA-SYNTHETIC-TRACE\n${sequence}\n`,
    fileName: "synthetic-trace.fasta",
  });
  return {
    ...sequenceSnapshotSession(document),
    snapshot: {
      sequenceDocument: {
        ...document,
        kind: "chromatogram",
        records: [{ ...document.records[0], chromatogram }],
      },
    },
  };
}

// Synthetic controls for restore validation; these are not experimental reads.
function syntheticTrace(): SequenceChromatogram {
  return {
    channels: {
      A: [1, 2, 3, 4],
      C: [2, 3, 4, 5],
      G: [3, 4, 5, 6],
      T: [4, 5, 6, 7],
    },
    format: "abif",
    peakLocations: [0, 1, 2, 3],
    quality: [20, 30, 40, 50],
    qualityEncoding: "phred",
    sampleCount: 4,
  };
}

function syntheticScfTrace(): SequenceChromatogram {
  return {
    ...syntheticTrace(),
    baseConfidences: {
      A: [20, 1, 2, 3],
      C: [4, 5, 6, 7],
      G: [8, 9, 40, 11],
      T: [12, 13, 14, 50],
    },
    format: "scf",
    quality: [20, null, 40, 50],
    qualityEncoding: "source-confidence",
  };
}

function sequenceView() {
  return {
    geneticCodeId: 1,
    layout: "linear",
    orientation: "forward",
    paletteId: "neutral",
    selectedFeatureId: null,
    selectedRecordId: "demo",
    selection: null,
    showFeatures: true,
    showQuality: false,
    showTranslation: false,
    synchronizedViews: true,
    viewport: null,
    wrapWidth: 60,
  };
}

function alignmentView() {
  return {
    analysisScope: "all-unhidden-rows",
    cellWidth: 24,
    colorMode: "identity",
    referenceMode: "none",
    residuePalette: null,
    rowFilter: "",
    searchScope: "currently-displayed-rows",
    selectedColumns: null,
    selectedRows: [],
    showAnnotationTracks: true,
    showIdenticalAsDots: false,
    showRnaStructureOverlays: true,
  };
}
