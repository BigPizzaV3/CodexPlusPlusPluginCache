import { describe, expect, it } from "vitest";

import { createBiologicalSequenceViewerModel } from "./biological-sequence-viewer-model";

describe("createBiologicalSequenceViewerModel", () => {
  it("offers sequence and alignment modes for likely aligned FASTA", () => {
    const model = createBiologicalSequenceViewerModel({
      contents: ">a\nAC-GT\n>b\nACTGT\n",
      fileName: "family.fasta",
    });

    expect(model.availableModes).toEqual(["sequence", "alignment"]);
    expect(model.defaultMode).toBe("alignment");
    expect(model.sequenceDocument?.records[0]?.sequence).toBe("AC-GT");
  });

  it("defaults larger equal-width ungapped FASTA matrices to alignment", () => {
    const model = createBiologicalSequenceViewerModel({
      contents: ">a\nACGT\n>b\nTGCA\n>c\nAGCT\n",
      fileName: "family.fasta",
    });

    expect(model.availableModes).toEqual(["sequence", "alignment"]);
    expect(model.defaultMode).toBe("alignment");
  });

  it("defaults explicit A3M alignments to alignment even when raw row widths differ", () => {
    const model = createBiologicalSequenceViewerModel({
      contents: ">query\nACde-FG\n>hit\nAC--FG\n",
      fileName: "protein-profile.a3m",
    });

    expect(model.availableModes).toEqual(["sequence", "alignment"]);
    expect(model.defaultMode).toBe("alignment");
  });

  it("opens genuine unequal-width HLA PIR records only in usable Sequence mode", () => {
    // Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
    // Tests/NBRF/DMB_prot.pir, complete HLA00490/HLA00492 entries.
    const model = createBiologicalSequenceViewerModel({
      contents: [
        ">P1;HLA:HLA00490",
        "HLA:HLA00490 DMB*0102, 94 bases, 73D5CC44 checksum.",
        " PPSVQVAKTT PFNTREPVML ACYVWGFYPA EVTITWRKNG KLVMPHSSEH",
        " KTAQPNGDWT YQTLSHLALT PSYGDTYTCV VEHIGAPEPI LRDW*",
        ">P1;HLA:HLA00492",
        "HLA:HLA00492 DMB*0104, 80 bases, 453718BE checksum.",
        " KTTPFNTREP VMLACYVWGF YPAEVTITWR KNGKLVMPHS SVHKTAQPNG",
        " DWTYQTLSHL ALTPSYGDTY TCVVEHTGAP*",
      ].join("\n"),
      fileName: "DMB_prot.pir",
    });

    expect(model.classification.molecule).toBe("protein");
    expect(model.sequenceDocument?.records.map(({ length }) => length)).toEqual([
      94, 80,
    ]);
    expect(model.alignmentAvailable).toBe(false);
    expect(model.availableModes).toEqual(["sequence"]);
    expect(model.defaultMode).toBe("sequence");
  });

  it("preserves Alignment mode for genuinely rectangular PIR records", () => {
    const model = createBiologicalSequenceViewerModel({
      contents: [
        ">P1;alpha",
        "Alpha protein",
        "AC-G*",
        ">P1;beta",
        "Beta protein",
        "ACAG*",
      ].join("\n"),
      fileName: "aligned-family.pir",
    });

    expect(model.alignmentAvailable).toBe(true);
    expect(model.availableModes).toEqual(["sequence", "alignment"]);
    expect(model.defaultMode).toBe("alignment");
  });

  it("makes explicit non-FASTA alignments toggleable without eagerly parsing them on load", () => {
    const model = createBiologicalSequenceViewerModel({
      contents: "CLUSTAL W\n\nseq1  AC-GT\nseq2  ACTGT\n",
      fileName: "family.aln",
    });

    expect(model.availableModes).toEqual(["sequence", "alignment"]);
    expect(model.defaultMode).toBe("alignment");
    expect(model.sequenceDocument).toBeNull();
  });
});
