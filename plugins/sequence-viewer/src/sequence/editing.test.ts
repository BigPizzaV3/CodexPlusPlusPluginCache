import { describe, expect, it } from "vitest";

import {
  addSequenceFeature,
  deleteSequenceFeature,
  deleteSequenceRange,
  insertSequence,
  replaceSequenceRange,
  reverseComplementSequenceRange,
  rotateCircularSequence,
  updateSequenceFeature,
} from "./editing";
import { buildFastqExport } from "./exports";
import { parseSequenceDocument } from "./parser";

// Public RNAcentral accession URS0000D6941A, SHA-256
// f78fe5ffca0051bc8b8b62cbf753dc5b9465a24e51a9dadea0bfaadb454840e7:
// https://raw.githubusercontent.com/r2dt-bio/R2DT/a1ca674f245e4dc13838e346b8e03295c2130d0c/examples/RF02976.fasta
const PUBLIC_RNACENTRAL_FASTA = `>URS0000D6941A
CCGAGAUAGGGGUACAAAUCCUGCCAAUGGCGUUUCCCUGGACCUUAGCGAUGAAGGCAUUUCAAAGCCUGAGCAACGAC
UCUCGGCGUCAGAUGGGGAGAGUGCCAGACGUGGUGUCCCCGCUGAC`;

// Genuine public Biopython sequencing reads and measured Phred+33 qualities,
// SHA-256 10bc5b39327a363b0019193c9823bc424a6d5706197688fdbdd45023a1481a0c:
// https://raw.githubusercontent.com/biopython/biopython/c9489604d1d9607602ca9199a3852c1219ed330f/Tests/Quality/example.fastq
const PUBLIC_SANGER_FASTQ = `@EAS54_6_R1_2_1_413_324
CCCTTCTTGTCTTCAGCGTTTCTCC
+
;;3;;;;;;;;;;;;7;;;;;;;88
@EAS54_6_R1_2_1_540_792
TTGGCAGGCCAAGGCCGATGGATCA
+
;;;;;;;;;;;7;;;;;-;;;3;83
@EAS54_6_R1_2_1_443_348
GTTGCTTCTGGCGTGGGTGGGGGGG
+
;;;;;;;;;;;9;7;;.7;393333
`;

describe("safe sequence edit copies", () => {
  it.each([
    "insert",
    "delete",
    "replace",
    "reverse-complement",
    "rotate",
  ] as const)(
    "drops source-bound chromatograms from %s copies without altering the source trace",
    (operation) => {
      const document = chromatogramFixture();
      const record = document.records[0]!;
      const source = structuredClone(document);
      const edits = {
        delete: () => deleteSequenceRange(document, record.id, 2, 3),
        insert: () => insertSequence(document, record.id, 2, "GA"),
        replace: () => replaceSequenceRange(document, record.id, 2, 3, "GA"),
        "reverse-complement": () =>
          reverseComplementSequenceRange(document, record.id, 1, record.length),
        rotate: () => rotateCircularSequence(document, record.id, 3),
      };
      const result = edits[operation]();

      expect(Object.hasOwn(result.record, "chromatogram")).toBe(false);
      expect(result.record.quality).toBeUndefined();
      expect(result.document.records[0]).toBe(result.record);
      expect(result.document.warnings).toContainEqual(
        expect.objectContaining({ code: "source-trace-not-carried" }),
      );
      expect(document).toEqual(source);
    },
  );

  it("retains source traces through annotation-only edits", () => {
    const document = chromatogramFixture();
    const record = document.records[0]!;
    const feature = {
      end: 5,
      id: "trace-annotation",
      qualifiers: {},
      start: 2,
      strand: "+" as const,
      type: "misc_feature",
    };
    const added = addSequenceFeature(document, record.id, feature);
    const updated = updateSequenceFeature(added, record.id, feature.id, {
      label: "reviewed base calls",
    });
    const removed = deleteSequenceFeature(updated, record.id, feature.id);

    expect(added.records[0]?.chromatogram).toBe(record.chromatogram);
    expect(updated.records[0]?.chromatogram).toBe(record.chromatogram);
    expect(removed.records[0]?.chromatogram).toBe(record.chromatogram);
    expect(removed.records[0]?.sequence).toBe(record.sequence);
  });

  it.each([
    ["reverse-complement", "ACGT"],
    ["rotate", "ACAC"],
  ] as const)(
    "invalidates original evidence after a symmetric %s even when the residue text is unchanged",
    (operation, sequence) => {
      const parsed = parseSequenceDocument({
        contents: `>ref\n${sequence}\n`,
        fileName: "symmetric-reference.fasta",
      });
      const document = {
        ...parsed,
        records: parsed.records.map((record) => ({
          ...record,
          topology: "circular" as const,
        })),
      };
      const record = document.records[0]!;
      const result =
        operation === "rotate"
          ? rotateCircularSequence(document, record.id, 3)
          : reverseComplementSequenceRange(
              document,
              record.id,
              1,
              record.length,
            );

      expect(result.record.sequence).toBe(record.sequence);
      expect(result.record.evidenceCoordinatesStale).toBe(true);
      expect(record.evidenceCoordinatesStale).not.toBe(true);
    },
  );

  it("keeps source-coordinate evidence valid for an exact no-op residue replacement", () => {
    const document = parseSequenceDocument({
      contents: ">ref\nACGT\n",
      fileName: "no-op-reference.fasta",
    });
    const record = document.records[0]!;
    const result = replaceSequenceRange(
      document,
      record.id,
      1,
      4,
      record.sequence,
    );

    expect(result.record.sequence).toBe(record.sequence);
    expect(result.record.evidenceCoordinatesStale).not.toBe(true);
  });

  it("inserts residues and shifts downstream feature coordinates exactly", () => {
    const document = fixture();
    const record = document.records[0];
    const result = insertSequence(document, record?.id ?? "", 10, "AAA");

    expect(result.record.sequence.slice(9, 12)).toBe("AAA");
    expect(result.record.features.find(({ id }) => id.includes("gene"))).toMatchObject({
      start: 13,
      end: 21,
    });
    expect(result.record.quality).toBeUndefined();
    expect(Object.hasOwn(result.record, "quality")).toBe(false);
    expect(result.document.warnings.at(-1)?.code).toBe("edited-copy");
  });

  it("deletes ranges while preserving exact remaining compound segments", () => {
    const document = fixture();
    const record = document.records[0];
    const result = deleteSequenceRange(document, record?.id ?? "", 4, 6);
    const compound = result.record.features.find(
      ({ type }) => type === "misc_feature",
    );

    expect(result.record.length).toBe((record?.length ?? 0) - 3);
    expect(compound).toMatchObject({
      segments: [
        { start: 1, end: 3 },
        { start: 6, end: 9 },
      ],
      translationTrackReliable: false,
    });
  });

  it("refuses partial feature replacement instead of fabricating remapped coordinates", () => {
    const document = fixture();
    const record = document.records[0];
    expect(() =>
      replaceSequenceRange(document, record?.id ?? "", 8, 12, "AAAAA"),
    ).toThrow("partially overlaps");
  });

  it("reverse-complements a bounded feature and flips strand/segments", () => {
    const document = fixture();
    const record = document.records[0];
    const withoutCompound = deleteSequenceFeature(
      document,
      record?.id ?? "",
      record?.features.find(({ type }) => type === "misc_feature")?.id ?? "",
    );
    const result = reverseComplementSequenceRange(
      withoutCompound,
      record?.id ?? "",
      10,
      18,
    );
    expect(result.record.features.find(({ id }) => id.includes("gene"))).toMatchObject({
      start: 10,
      end: 18,
      strand: "-",
      translationTrackReliable: false,
    });
  });

  it("rotates circular records and represents origin-spanning features with exact segments", () => {
    const document = fixture(true);
    const record = document.records[0];
    const result = rotateCircularSequence(document, record?.id ?? "", 15);
    const gene = result.record.features.find(({ id }) => id.includes("gene"));

    expect(result.record.sequence).toBe(
      `${record?.sequence.slice(14)}${record?.sequence.slice(0, 14)}`,
    );
    expect(gene?.segments).toEqual([
      expect.objectContaining({ start: 14, end: 18 }),
      expect.objectContaining({ start: 1, end: 4 }),
    ]);
  });

  it("adds, updates, and deletes annotations without changing sequence quality", () => {
    const document = fixture();
    const record = document.records[0];
    const feature = {
      end: 5,
      id: "user-note",
      label: "candidate motif",
      qualifiers: { note: "created in workbench" },
      start: 2,
      strand: "+" as const,
      type: "misc_feature",
    };
    const added = addSequenceFeature(document, record?.id ?? "", feature);
    const updated = updateSequenceFeature(
      added,
      record?.id ?? "",
      feature.id,
      { label: "confirmed motif" },
    );
    const deleted = deleteSequenceFeature(updated, record?.id ?? "", feature.id);

    expect(updated.records[0]?.features.find(({ id }) => id === feature.id)?.label).toBe(
      "confirmed motif",
    );
    expect(deleted.records[0]?.features.some(({ id }) => id === feature.id)).toBe(
      false,
    );
    expect(updated.records[0]?.sequence).toBe(record?.sequence);
    expect(Object.hasOwn(added.records[0]!, "quality")).toBe(false);
    expect(Object.hasOwn(updated.records[0]!, "quality")).toBe(false);
    expect(Object.hasOwn(deleted.records[0]!, "quality")).toBe(false);
  });

  it("reverse-complements genuine RNAcentral RNA without introducing DNA thymine", () => {
    const document = parseSequenceDocument({
      contents: PUBLIC_RNACENTRAL_FASTA,
      fileName: "RF02976.fasta",
    });
    const record = document.records[0]!;

    expect(record.molecule).toBe("rna");
    const edited = reverseComplementSequenceRange(document, record.id, 1, 12);

    expect(edited.record.sequence.slice(0, 12)).toBe("CCCCUAUCUCGG");
    expect(edited.record.sequence).not.toContain("T");
    expect(edited.record.molecule).toBe("rna");
    expect(record.sequence.slice(0, 12)).toBe("CCGAGAUAGGGG");
  });

  it("preserves RNA IUPAC ambiguity symbols and molecule-aware complements", () => {
    const document = parseSequenceDocument({
      contents: ">RNA-AMBIGUOUS\nAUGCRYN\n",
      fileName: "rna.fasta",
    });
    const record = document.records[0]!;

    expect(record.molecule).toBe("rna");
    expect(
      reverseComplementSequenceRange(document, record.id, 1, record.length)
        .record.sequence,
    ).toBe("NRYGCAU");
  });

  it.each([
    "U",
    "😈",
    "é",
    "ı",
    "ſ",
    "Ａ",
    "A\nC",
    "A\tC",
    "A\u0000C",
    "A\u007fC",
    "A0",
    "A;",
    "A-",
  ])(
    "rejects invalid DNA edit residues %j without modifying the source",
    (sequence) => {
      const document = fixture();
      const record = document.records[0]!;
      const source = structuredClone(document);

      expect(() => insertSequence(document, record.id, 1, sequence)).toThrow(
        /not valid for the dna molecular alphabet/,
      );
      expect(document).toEqual(source);
    },
  );

  it("accepts DNA IUPAC ambiguity residues but rejects RNA uracil", () => {
    const document = fixture();
    const record = document.records[0]!;

    expect(insertSequence(document, record.id, 1, "ryswkmbdhvn").record.sequence)
      .toMatch(/^RYSWKMBDHVN/);
    expect(() => replaceSequenceRange(document, record.id, 1, 1, "U")).toThrow(
      /not valid for the dna molecular alphabet/,
    );
  });

  it("accepts RNA IUPAC residues and rejects DNA thymine", () => {
    const document = parseSequenceDocument({
      contents: PUBLIC_RNACENTRAL_FASTA,
      fileName: "RF02976.fasta",
    });
    const record = document.records[0]!;

    expect(insertSequence(document, record.id, 1, "u r y n").record.sequence)
      .toMatch(/^URYN/);
    expect(() => insertSequence(document, record.id, 1, "T")).toThrow(
      /not valid for the rna molecular alphabet/,
    );
    expect(() => replaceSequenceRange(document, record.id, 1, 1, "T")).toThrow(
      /not valid for the rna molecular alphabet/,
    );
  });

  it("validates protein symbols without accepting punctuation, digits, or Unicode", () => {
    const document = parseSequenceDocument({
      contents: ">KRAS-PROTEIN\nMTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYR\n",
      fileName: "kras.faa",
    });
    const record = document.records[0]!;

    expect(record.molecule).toBe("protein");
    expect(insertSequence(document, record.id, 1, "bxzjuo*").record.sequence)
      .toMatch(/^BXZJUO\*/);
    for (const invalid of ["1", ".", "-", "🧬", "ß", "ı", "ſ"]) {
      expect(() => insertSequence(document, record.id, 1, invalid)).toThrow(
        /not valid for the protein molecular alphabet/,
      );
    }
  });

  it("rejects unknown alphabets and mixed thymine/uracil ambiguity safely", () => {
    const ambiguous = parseSequenceDocument({
      contents: ">QA-AMBIGUOUS-NUCLEOTIDE-CONTROL\nACGN\n",
      fileName: "ambiguous.fasta",
    });
    const record = ambiguous.records[0]!;

    expect(record.molecule).toBe("nucleic-acid-ambiguous");
    expect(() => insertSequence(ambiguous, record.id, 1, "TU")).toThrow(
      /cannot mix DNA thymine and RNA uracil/,
    );

    const unknown = {
      ...ambiguous,
      records: [{ ...record, molecule: "unknown" as const }],
    };
    expect(() => insertSequence(unknown, record.id, 1, "A")).toThrow(
      /molecular alphabet is unknown/,
    );
  });

  it("retains actual FASTQ qualities for equal-length edits and refreshes real QC", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const edited = replaceSequenceRange(document, record.id, 1, 5, "GGGGG");

    expect(edited.record.sequence.slice(0, 5)).toBe("GGGGG");
    expect(edited.record.quality).toEqual(record.quality);
    expect(edited.record.quality?.ascii).toBe(";;3;;;;;;;;;;;;7;;;;;;;88");
    expect(edited.record.quality?.phred).toHaveLength(edited.record.length);
    expect(buildFastqExport(edited.record)).toBe(
      `@EAS54_6_R1_2_1_413_324\n${edited.record.sequence}\n+\n;;3;;;;;;;;;;;;7;;;;;;;88`,
    );
    expect(edited.document.fastqSummary?.readCount).toBe(3);
    expect(edited.document.fastqSummary?.totalBases).toBe(
      document.fastqSummary?.totalBases,
    );
    expect(edited.document.fastqSummary?.meanQuality).toBe(
      document.fastqSummary?.meanQuality,
    );
    expect(edited.document.fastqSummary?.gcFraction).toBeGreaterThan(
      document.fastqSummary?.gcFraction ?? 0,
    );
    expect(record.sequence).toBe("CCCTTCTTGTCTTCAGCGTTTCTCC");
  });

  it("deletes measured FASTQ qualities at exactly the deleted base positions", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const originalQuality = record.quality!;
    const edited = deleteSequenceRange(document, record.id, 2, 4);

    expect(edited.record.quality?.ascii).toBe(
      `${originalQuality.ascii.slice(0, 1)}${originalQuality.ascii.slice(4)}`,
    );
    expect(edited.record.quality?.phred).toEqual([
      ...originalQuality.phred.slice(0, 1),
      ...originalQuality.phred.slice(4),
    ]);
    expect(edited.record.quality?.ascii).toHaveLength(edited.record.length);
    expect(edited.document.fastqSummary?.totalBases).toBe(
      (document.fastqSummary?.totalBases ?? 0) - 3,
    );
    expect(record.quality).toEqual(originalQuality);
  });

  it("reverses only the quality scores of reverse-complemented FASTQ bases", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const originalQuality = record.quality!;
    const edited = reverseComplementSequenceRange(document, record.id, 2, 9);

    expect(edited.record.quality?.ascii).toBe(
      `${originalQuality.ascii.slice(0, 1)}${[...originalQuality.ascii.slice(1, 9)].reverse().join("")}${originalQuality.ascii.slice(9)}`,
    );
    expect(edited.record.quality?.phred).toEqual([
      ...originalQuality.phred.slice(0, 1),
      ...originalQuality.phred.slice(1, 9).reverse(),
      ...originalQuality.phred.slice(9),
    ]);
    expect(edited.document.fastqSummary?.meanQuality).toBe(
      document.fastqSummary?.meanQuality,
    );
  });

  it("rejects FASTQ operations that would invent or discard measured qualities", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const source = structuredClone(document);

    expect(() => insertSequence(document, record.id, 2, "A")).toThrow(
      /without measured quality scores/,
    );
    expect(() => replaceSequenceRange(document, record.id, 2, 3, "A")).toThrow(
      /without measured quality scores/,
    );
    expect(() => replaceSequenceRange(document, record.id, 2, 3, "AAA")).toThrow(
      /without measured quality scores/,
    );
    expect(document).toEqual(source);
  });

  it("rejects edits of oversized FASTQ reads without retained base qualities", () => {
    const document = fastqFixture();
    const { quality: _quality, ...unscored } = document.records[0]!;
    const oversized = {
      ...document,
      records: [unscored, ...document.records.slice(1)],
    };

    expect(() => replaceSequenceRange(oversized, unscored.id, 1, 1, "A"))
      .toThrow(/quality scores were not retained/);
  });

  it("rejects mismatched sequence and quality positions before changing a FASTQ read", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const corrupted = {
      ...document,
      records: [
        {
          ...record,
          quality: {
            ascii: record.quality!.ascii.slice(1),
            phred: record.quality!.phred.slice(1),
          },
        },
        ...document.records.slice(1),
      ],
    };

    expect(() => deleteSequenceRange(corrupted, record.id, 1, 1)).toThrow(
      /quality scores do not align/,
    );
  });

  it("preserves exact whole-file QC when editing a partially retained FASTQ collection", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const partial = {
      ...document,
      recordInventory: {
        materializedCount: 1,
        totalCount: 3,
        truncated: true,
      },
      records: [record],
    };
    const edited = replaceSequenceRange(partial, record.id, 1, 5, "GGGGG");
    const complete = replaceSequenceRange(document, record.id, 1, 5, "GGGGG");

    expect(edited.document.fastqSummary).toEqual(complete.document.fastqSummary);
    expect(() => deleteSequenceRange(partial, record.id, 2, 3)).toThrow(
      /partially materialized FASTQ collection/,
    );
  });

  it("rotates actual quality positions with a quality-scored circular sequence", () => {
    const source = fastqFixture();
    const record = { ...source.records[0]!, topology: "circular" as const };
    const document = {
      ...source,
      records: [record, ...source.records.slice(1)],
    };
    const edited = rotateCircularSequence(document, record.id, 4);

    expect(edited.record.quality?.ascii).toBe(
      `${record.quality!.ascii.slice(3)}${record.quality!.ascii.slice(0, 3)}`,
    );
    expect(edited.record.quality?.phred).toEqual([
      ...record.quality!.phred.slice(3),
      ...record.quality!.phred.slice(0, 3),
    ]);
    expect(edited.document.fastqSummary).toEqual(source.fastqSummary);
  });

  it("omits absent feature and quality fields from durable annotation edits", () => {
    const document = fixture();
    const record = document.records[0]!;
    const annotated = addSequenceFeature(document, record.id, {
      end: 5,
      id: "undefined-optional-fields",
      label: undefined,
      qualifiers: {},
      segments: undefined,
      start: 2,
      strand: "+",
      translationCoordinateMap: undefined,
      type: "misc_feature",
    });
    const feature = annotated.records[0]!.features.find(
      ({ id }) => id === "undefined-optional-fields",
    )!;

    expect(Object.hasOwn(annotated.records[0]!, "quality")).toBe(false);
    expect(Object.hasOwn(feature, "label")).toBe(false);
    expect(Object.hasOwn(feature, "segments")).toBe(false);
    expect(Object.hasOwn(feature, "translationCoordinateMap")).toBe(false);
    expect(JSON.parse(JSON.stringify(annotated.records[0]!))).toEqual(
      annotated.records[0],
    );
  });

  it("keeps measured qualities when only annotations are added, updated, or deleted", () => {
    const document = fastqFixture();
    const record = document.records[0]!;
    const feature = {
      end: 5,
      id: "fastq-annotation",
      qualifiers: {},
      start: 2,
      strand: "+" as const,
      type: "misc_feature",
    };
    const added = addSequenceFeature(document, record.id, feature);
    const updated = updateSequenceFeature(added, record.id, feature.id, {
      label: "validated",
    });
    const removed = deleteSequenceFeature(updated, record.id, feature.id);

    expect(added.records[0]?.quality).toEqual(record.quality);
    expect(updated.records[0]?.quality).toEqual(record.quality);
    expect(removed.records[0]?.quality).toEqual(record.quality);
    expect(removed.fastqSummary).toEqual(document.fastqSummary);
  });
});

function fastqFixture() {
  return parseSequenceDocument({
    contents: PUBLIC_SANGER_FASTQ,
    fileName: "example.fastq",
  });
}

function chromatogramFixture() {
  // Synthetic trace control for coordinate integrity, not an experimental read.
  const document = parseSequenceDocument({
    contents: ">QA-SYNTHETIC-TRACE\nATGCATGA\n",
    fileName: "synthetic-trace.fasta",
  });
  const record = document.records[0]!;
  document.format = "abif";
  document.kind = "chromatogram";
  record.topology = "circular";
  record.chromatogram = {
    channels: {
      A: [0, 10, 0, 0, 0, 20, 0, 0],
      C: [0, 0, 0, 30, 0, 0, 0, 0],
      G: [0, 0, 40, 0, 0, 0, 50, 0],
      T: [0, 0, 0, 0, 60, 0, 0, 70],
    },
    format: "abif",
    peakLocations: [0, 1, 2, 3, 4, 5, 6, 7],
    quality: [20, 21, 22, 23, 24, 25, 26, 27],
    qualityEncoding: "phred",
    sampleCount: 8,
  };
  return document;
}

function fixture(circular = false) {
  return parseSequenceDocument({
    contents: `LOCUS       EDIT       18 bp    DNA     ${
      circular ? "circular" : "linear"
    }
ACCESSION   EDIT1
FEATURES             Location/Qualifiers
     misc_feature    join(1..6,9..12)
                     /label="compound"
     gene            10..18
                     /gene="example"
ORIGIN
        1 atgcgtacgttagcctaa
//`,
    fileName: "edit.gb",
  });
}
