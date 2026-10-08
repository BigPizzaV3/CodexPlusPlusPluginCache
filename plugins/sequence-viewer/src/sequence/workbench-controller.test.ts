import { describe, expect, it } from "vitest";

import { parseSequenceDocument } from "./parser";
import {
  applySequenceAnnotationRequest,
  applySequenceEditRequest,
  inferGeneticCodeId,
  runSequenceAnalysis,
} from "./workbench-controller";
import { parseSequenceTrack, type SequenceTrack } from "./tracks";

describe("sequence workbench controller", () => {
  it("uses record genetic-code provenance when the request omits a code", () => {
    const document = fixture();
    const record = document.records[0];
    expect(inferGeneticCodeId(record!, undefined, 1)).toMatchObject({
      id: 2,
      source: "feature",
    });

    const result = runSequenceAnalysis({
      document,
      request: { analysis: "translate", frame: 1 },
      selectedRecordId: record?.id ?? "",
      viewerGeneticCodeId: 1,
    });
    expect(result.provenance).toMatchObject({
      geneticCodeId: 2,
      geneticCodeName: "Vertebrate Mitochondrial",
    });
    expect(result.result.geneticCodeSource).toBe("feature");
  });

  it("runs bounded ORF, digest, and selection-aware primer analyses", () => {
    const document = fixture();
    const recordId = document.records[0]?.id ?? "";
    const orfs = runSequenceAnalysis({
      document,
      request: {
        analysis: "find-orfs",
        includePartial: true,
        minAminoAcids: 2,
        strands: "both",
      },
      selectedRecordId: recordId,
      viewerGeneticCodeId: 1,
    });
    expect(Array.isArray(orfs.result.items)).toBe(true);

    const digest = runSequenceAnalysis({
      document,
      request: { analysis: "restriction-analysis", enzymes: ["EcoRI"] },
      selectedRecordId: recordId,
    });
    expect(digest.result).toMatchObject({ circular: true });

    const primers = runSequenceAnalysis({
      document,
      request: {
        analysis: "design-primers",
        maxPairs: 3,
        maxProductLength: 120,
        minProductLength: 20,
      },
      selectedRecordId: recordId,
      selection: { end: 70, recordId, start: 40 },
    });
    expect(primers.result).toMatchObject({ targetEnd: 70, targetStart: 40 });
    expect(primers.provenance.limitations).toContain("Exploratory");
  });

  it("creates immutable edit copies and delegates undo/redo to history", () => {
    const document = fixture();
    const record = document.records[0];
    const originalLength = record?.length ?? 0;
    const change = applySequenceEditRequest({
      document,
      request: {
        coordinate: 2,
        operation: "insert-sequence",
        sequence: "AAA",
      },
      selectedRecordId: record?.id ?? "",
    });
    expect("document" in change && change.document.records[0]?.length).toBe(
      (record?.length ?? 0) + 3,
    );
    expect(record?.length).toBe(originalLength);
    expect(
      applySequenceEditRequest({
        document,
        request: { operation: "undo" },
        selectedRecordId: record?.id ?? "",
      }),
    ).toEqual({ historyOperation: "undo" });
  });

  it("imports only reference-matched annotations and avoids ID collisions", () => {
    const document = fixture();
    const record = document.records[0]!;
    const track: SequenceTrack = {
      features: [
        {
          attributes: { note: "matched" },
          end: 12,
          id: record.features[0]?.id ?? "feature",
          reference: record.sourceLabel,
          start: 5,
          strand: "+",
          type: "region",
        },
        {
          attributes: {},
          end: 5,
          id: "other",
          reference: "other-reference",
          start: 1,
          strand: ".",
          type: "region",
        },
      ],
      format: "gff3",
      id: "track-1",
      kind: "annotations",
      mapping: {
        matchedReference: record.sourceLabel,
        requestedReference: record.sourceLabel,
        status: "matched",
        unmatchedReferences: [],
      },
      name: "annotations.gff3",
      source: { displayName: "annotations.gff3" },
      summary: {
        itemCount: 2,
        references: [record.sourceLabel, "other-reference"],
        truncated: false,
      },
    };
    const change = applySequenceAnnotationRequest({
      document,
      request: {
        action: "import",
        trackId: track.id,
      },
      selectedRecordId: record.id,
      tracks: [track],
    });
    const imported = change.document.records[0]?.features.filter(
      ({ qualifiers }) => qualifiers.imported_from_track != null,
    );
    expect(imported).toHaveLength(1);
    expect(imported?.[0]?.id).not.toBe(record.features[0]?.id);
  });

  it("refuses to import original-coordinate annotations into an edited reference", () => {
    const document = fixture();
    const record = document.records[0]!;
    const track = parseSequenceTrack({
      content: `${record.sourceLabel}\t0\t4\toriginal-coordinate-feature\n`,
      displayName: "source-annotations.bed",
      format: "bed",
      id: "source-annotations",
      requestedReference: record.sourceLabel,
    });
    const originalFeatures = structuredClone(track.features);
    const edited = {
      ...document,
      records: document.records.map((item) => ({
        ...item,
        evidenceCoordinatesStale: true,
      })),
    };

    expect(() =>
      applySequenceAnnotationRequest({
        document: edited,
        request: { action: "import", trackId: track.id },
        selectedRecordId: record.id,
        tracks: [track],
      }),
    ).toThrow(/reference sequence was edited/);
    expect(track.features).toEqual(originalFeatures);
    expect(record.evidenceCoordinatesStale).not.toBe(true);
  });

  it("imports genuine BED12 exons without their introns and creates a compound coding feature", () => {
    // Only the chromosome coordinate scaffold is synthetic; the BED12 row is
    // copied unchanged from the public Biopython Tests/Blat/bed12.bed fixture.
    const document = parseSequenceDocument({
      contents: `>chr22 clearly-labeled-QA-only-coordinate-scaffold\n${"A".repeat(6_000)}`,
      fileName: "QA-SYNTHETIC-CHROMOSOME-COORDINATE-SCAFFOLD.fasta",
    });
    const record = document.records[0]!;
    const track = parseSequenceTrack({
      content: [
        "chr22\t1000\t5000\tmRNA1\t960\t+\t1200\t4900\t255,0,0\t2\t567,488,\t0,3512,",
        "chr22\t2000\t6000\tmRNA2\t900\t-\t2300\t5960\t0,255,0\t2\t433,399,\t0,3601,",
      ].join("\n"),
      displayName: "public-ucsc-chr22.bed",
      format: "bed",
      id: "ucsc-public-bed12",
      requestedReference: record.sourceLabel,
    });

    const change = applySequenceAnnotationRequest({
      document,
      request: { action: "import", trackId: track.id },
      selectedRecordId: record.id,
      tracks: [track],
    });
    const imported = change.document.records[0]?.features ?? [];
    const transcript = imported.find(({ type }) => type === "region");
    const coding = imported.find(({ type }) => type === "CDS");

    expect(transcript).toMatchObject({
      label: "mRNA1",
      qualifiers: {
        imported_from_track: "public-ucsc-chr22.bed",
        item_rgb: "255,0,0",
        score: "960",
      },
      segments: [
        { end: 1567, start: 1001 },
        { end: 5000, start: 4513 },
      ],
      strand: "+",
    });
    expect(coding).toMatchObject({
      codonStart: 1,
      end: 4900,
      segments: [
        { end: 1567, start: 1201 },
        { end: 4900, start: 4513 },
      ],
      start: 1201,
      strand: "+",
    });
    expect(
      transcript?.segments?.some(
        ({ end, start }) => start <= 3000 && end >= 3000,
      ),
    ).toBe(false);
    expect(
      imported.find(({ label }) => label === "mRNA2"),
    ).toMatchObject({
      segments: [
        { end: 6000, start: 5602 },
        { end: 2433, start: 2001 },
      ],
      strand: "-",
    });
    expect(
      imported.find(({ label }) => label === "mRNA2 CDS"),
    ).toMatchObject({
      segments: [
        { end: 5960, start: 5602 },
        { end: 2433, start: 2301 },
      ],
      strand: "-",
    });
  });

  it("preserves imported GTF CDS phase and accepts equivalent chr-prefixed references", () => {
    const document = fixture();
    const sourceRecord = document.records[0]!;
    const record = { ...sourceRecord, id: "22", sourceLabel: "22" };
    const normalizedDocument = { ...document, records: [record] };
    const track = parseSequenceTrack({
      content:
        'chr22\tNCBI\tCDS\t5\t15\t.\t+\t2\tgene_id "public-gene"; transcript_id "public-transcript";\n',
      displayName: "phase-preserving.gtf",
      format: "gtf",
      id: "phase-track",
      requestedReference: "22",
    });

    const change = applySequenceAnnotationRequest({
      document: normalizedDocument,
      request: { action: "import", trackId: track.id },
      selectedRecordId: record.id,
      tracks: [track],
    });

    expect(
      change.document.records[0]?.features.find(
        ({ qualifiers }) => qualifiers.gtf_phase != null,
      ),
    ).toMatchObject({
      codonStart: 3,
      qualifiers: {
        gene_id: "public-gene",
        gtf_phase: "2",
        transcript_id: "public-transcript",
      },
      type: "CDS",
    });
  });

  it("rejects mode-incompatible analysis and unknown enzymes", () => {
    const document = fixture();
    const selectedRecordId = document.records[0]?.id ?? "";
    expect(() =>
      runSequenceAnalysis({
        document,
        request: { algorithm: "neighbor-joining", analysis: "build-tree" },
        selectedRecordId,
      }),
    ).toThrow("Alignment mode");
    expect(() =>
      runSequenceAnalysis({
        document,
        request: {
          analysis: "restriction-analysis",
          enzymes: ["DefinitelyNotAnEnzyme"],
        },
        selectedRecordId,
      }),
    ).toThrow("built-in catalog");
  });
});

function fixture() {
  const sequence =
    "ATGGAATTCCGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCGGCTAA";
  return parseSequenceDocument({
    contents: `LOCUS       WORKBENCH  ${sequence.length} bp    DNA     circular
ACCESSION   WB1
FEATURES             Location/Qualifiers
     CDS             1..${sequence.length}
                     /gene="demo"
                     /transl_table=2
ORIGIN
        1 ${sequence.toLowerCase()}
//`,
    fileName: "workbench.gb",
  });
}
