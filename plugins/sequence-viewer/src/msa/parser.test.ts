import { describe, expect, it } from "vitest";

import {
  inferCdsContext,
  isNonsynonymousCodonDifference,
  translateStandardCodon,
} from "./codon";
import {
  computeNucleotideConsensus,
  computeProteinRepresentative,
} from "./consensus";
import {
  computeColumnSummaries,
  getMeanIdentity,
  getMeanNormalizedConservation,
} from "./conservation";
import { buildUngappedProjection, getUngappedPosition } from "./coordinate-map";
import { parseMsa } from "./parser";
import {
  classifyResidue,
  complementNucleotideSymbol,
  countUngappedResidues,
  reverseComplement,
} from "./residue-alphabet";
import { parseRnaPairs } from "./rna-structure";
import { searchMsaMotif } from "./search";
import type { MsaDocument } from "./types";

function expectDocument(contents: string, path: string): MsaDocument {
  const result = parseMsa(contents, path);
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(result.message);
  }
  return result.document;
}

describe("parseMsa", () => {
  it("parses aligned FASTA DNA and preserves aligned rows", () => {
    const document = expectDocument(
      [">dna-a", "ACGT-R", ">dna-b", "ACGT-A"].join("\n"),
      "/tmp/example.afa",
    );
    expect(document.format).toBe("aligned-fasta");
    expect(document.molecule.moleculeType).toBe("dna");
    expect(document.rows).toHaveLength(2);
    expect(document.alignedLength).toBe(6);
    expect(document.rawSummary.gapFraction).toBeGreaterThan(0);
    expect(document.cdsContext.applicability).toBe("unknown");
  });

  it("parses CLUSTAL and retains consensus annotations", () => {
    const document = expectDocument(
      ["CLUSTAL W", "", "seq1    AC-G", "seq2    ACAG", "        ** *"].join(
        "\n",
      ),
      "/tmp/example.aln",
    );
    expect(document.format).toBe("clustal");
    expect(document.annotations[0]).toMatchObject({
      kind: "conservation",
      values: "** *",
    });
  });

  it("preserves leading blank CLUSTAL annotation columns", () => {
    const document = expectDocument(
      ["CLUSTAL W", "", "seq1    AC-G", "seq2    ACAG", "         * *"].join(
        "\n",
      ),
      "/tmp/leading-consensus.aln",
    );
    expect(document.annotations[0]?.values).toBe(" * *");
  });

  it("pads a stripped blank CLUSTAL consensus block when another block has consensus", () => {
    const document = expectDocument(
      [
        "CLUSTAL W",
        "",
        "seq1    AC",
        "seq2    AC",
        "",
        "seq1    GT",
        "seq2    GT",
        "        **",
      ].join("\n"),
      "/tmp/blank-consensus-block.aln",
    );

    expect(document.rows.map(({ alignedSequence }) => alignedSequence)).toEqual([
      "ACGT",
      "ACGT",
    ]);
    expect(document.annotations[0]).toMatchObject({
      kind: "conservation",
      values: "  **",
    });
  });

  it("treats FASTA-record `.aln` exports as aligned FASTA rather than forcing CLUSTAL parsing", () => {
    const document = expectDocument(
      [">alpha", "AC-G", ">beta", "ACAG"].join("\n"),
      "/tmp/exported-alignment.aln",
    );
    expect(document.format).toBe("aligned-fasta");
    expect(document.rows).toHaveLength(2);
    expect(document.alignedLength).toBe(4);
  });

  it("parses Stockholm RNA annotations into structure data", () => {
    const document = expectDocument(
      [
        "# STOCKHOLM 1.0",
        "rna1 AC-G",
        "rna2 AU-G",
        "#=GC SS_cons <<>>",
        "#=GC RF xxxx",
        "//",
      ].join("\n"),
      "/tmp/rfam.sto",
    );
    expect(document.molecule.moleculeType).toBe("rna");
    expect(document.rnaStructure?.pairs).toHaveLength(2);
    expect(document.rnaStructure?.referenceTrack).toBe("xxxx");
    expect(document.rawSummary.structureTrackCount).toBe(2);
  });

  it("retains Stockholm GF, GS, and GR metadata as inspectable document, row, and annotation data", () => {
    const document = expectDocument(
      [
        "# STOCKHOLM 1.0",
        "#=GF ID RF00001",
        "#=GS rna1 DE Example sequence",
        "rna1 AC",
        "rna2 AU",
        "#=GR rna1 SS <<",
        "#=GC SS_cons <>",
        "//",
      ].join("\n"),
      "/tmp/stockholm-metadata.sto",
    );
    expect(document.formatMetadata).toMatchObject({ "GF:ID": "RF00001" });
    expect(document.rows[0]?.metadata).toMatchObject({
      "GS:DE": "Example sequence",
    });
    expect(
      document.annotations.some(
        (track) =>
          track.id === "stockholm-gr-rna1-SS" && track.label === "rna1 SS",
      ),
    ).toBe(true);
  });

  it("parses A3M lowercase insertions without flattening them", () => {
    const document = expectDocument(
      [">query", "AC-DE", ">hit", "ACaa-DE"].join("\n"),
      "/tmp/profile.a3m",
    );
    expect(document.format).toBe("a3m");
    expect(document.molecule.moleculeType).toBe("protein");
    expect(document.rows.map((row) => row.alignedSequence)).toEqual([
      "AC-DE",
      "AC-DE",
    ]);
    expect(document.insertions).toEqual([
      {
        afterAlignmentColumn: 1,
        residues: "aa",
        rowId: "hit",
        sourceKind: "a2m-a3m-lowercase",
        sourceRowIndex: 1,
      },
    ]);
  });

  it("parses aligned A2M insertion columns without turning periods into deletions", () => {
    const document = expectDocument(
      [">query", "AC.-DEFGH", ">hit", "ACaD-E-GH"].join("\n"),
      "/tmp/profile.a2m",
    );
    expect(document.format).toBe("a2m");
    expect(document.rows.map((row) => row.alignedSequence)).toEqual([
      "AC-DEFGH",
      "ACD-E-GH",
    ]);
    expect(document.insertions).toEqual([
      {
        afterAlignmentColumn: 1,
        residues: "a",
        rowId: "hit",
        sourceKind: "a2m-a3m-lowercase",
        sourceRowIndex: 1,
      },
    ]);
  });

  it("rejects malformed A2M columns and A3M insertion-gap periods", () => {
    expect(
      parseMsa([">query", "AC.DE", ">hit", "AC-DE"].join("\n"), "/tmp/bad.a2m"),
    ).toMatchObject({
      message: expect.stringContaining("mixes insertion symbols"),
      status: "error",
    });
    expect(
      parseMsa([">query", "AC.DE", ">hit", "ACaDE"].join("\n"), "/tmp/bad.a3m"),
    ).toMatchObject({
      message: expect.stringContaining("A3M omits insertion-gap columns"),
      status: "error",
    });
  });

  it("rejects empty FASTA rows and content before the first FASTA header", () => {
    expect(parseMsa(">empty\n", "/tmp/empty.afa")).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "fasta-record-empty" }),
      ]),
    });
    expect(parseMsa("ACGT\n>row\nACGT", "/tmp/prefix.afa")).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "fasta-content-before-header" }),
      ]),
    });
  });

  it("parses MSF, PHYLIP, NEXUS, and PIR compatibility formats", () => {
    const msf = expectDocument(
      [
        "PileUp",
        " Name: a Len: 4",
        " MSF: 4 Type: N",
        "//",
        "a AC-G",
        "b ACAG",
      ].join("\n"),
      "/tmp/example.msf",
    );
    expect(msf.format).toBe("msf");
    expect(msf.rows).toHaveLength(2);

    const phylip = expectDocument(
      ["2 4", "alpha AC-G", "beta ACAG"].join("\n"),
      "/tmp/example.phy",
    );
    expect(phylip.format).toBe("phylip");

    const nexus = expectDocument(
      [
        "#NEXUS",
        "BEGIN DATA;",
        "MATRIX",
        "'alpha one' AC-G",
        "beta ACAG",
        ";",
        "END;",
      ].join("\n"),
      "/tmp/example.nex",
    );
    expect(nexus.format).toBe("nexus");
    expect(nexus.rows[0]?.label).toBe("alpha one");

    const pir = expectDocument(
      [">P1;alpha", "Alpha", "AC-G*", ">P1;beta", "Beta", "ACAG*"].join("\n"),
      "/tmp/example.pir",
    );
    expect(pir.format).toBe("pir");
    expect(pir.rows[1]?.description).toBe("Beta");
  });

  it("handles repeated-label PHYLIP continuations and interleaved NEXUS continuation blocks", () => {
    const phylip = expectDocument(
      ["2 6", "alpha ACG", "beta ACG", "alpha TTT", "beta GGG"].join("\n"),
      "/tmp/repeated.phy",
    );
    expect(phylip.rows.map((row) => row.alignedSequence)).toEqual([
      "ACGTTT",
      "ACGGGG",
    ]);
    expect(phylip.formatMetadata).toMatchObject({ columns: "6", rows: "2" });

    const nexus = expectDocument(
      [
        "#NEXUS",
        "BEGIN DATA;",
        "FORMAT DATATYPE=DNA MISSING=? GAP=- INTERLEAVE=YES;",
        "MATRIX",
        "alpha AC",
        "beta A-",
        "GT",
        "G?",
        ";",
        "END;",
      ].join("\n"),
      "/tmp/interleaved.nex",
    );
    expect(nexus.rows.map((row) => row.alignedSequence)).toEqual([
      "ACGT",
      "A-G?",
    ]);
    expect(nexus.formatMetadata).toMatchObject({
      gap: "-",
      interleaved: "true",
      missing: "?",
    });
  });

  it("parses sequential PHYLIP and fixed-width names containing spaces", () => {
    const document = expectDocument(
      [
        "2 12",
        "H. SapiensACGTAC",
        "300 GTACGT",
        "Salmo gairACGTAC",
        "300 AAAAAA",
      ].join("\n"),
      "/tmp/sequential.phy",
    );

    expect(document.formatMetadata).toMatchObject({
      layout: "sequential",
      nameMode: "fixed",
    });
    expect(document.rows.map(({ label }) => label)).toEqual([
      "H. Sapiens",
      "Salmo gair",
    ]);
    expect(document.rows.map(({ alignedSequence }) => alignedSequence)).toEqual(
      ["ACGTACGTACGT", "ACGTACAAAAAA"],
    );
  });

  it("rejects declared PHYLIP, Stockholm, and NEXUS dimension mismatches", () => {
    expect(
      parseMsa("2 5\nalpha ACGT\nbeta ACGT", "/tmp/bad.phy"),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "phylip-column-count-mismatch" }),
      ]),
    });
    expect(
      parseMsa(
        "# STOCKHOLM 1.0\na ACGT\nb ACGT\n#=GR a SS <<<\n//",
        "/tmp/bad.sto",
      ),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "stockholm-gr-width-mismatch" }),
      ]),
    });
    expect(
      parseMsa(
        "#NEXUS\nBEGIN DATA;\nDIMENSIONS NTAX=2 NCHAR=5;\nMATRIX\na ACGT\nb ACGT\n;\nEND;",
        "/tmp/bad.nex",
      ),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "nexus-nchar-mismatch" }),
      ]),
    });
  });

  it("pads omitted MSF rows by block and reports recoverable header mismatches", () => {
    const result = parseMsa(
      [
        "!!AA_MULTIPLE_ALIGNMENT",
        " MSF: 2 Type: P Check: 0 ..",
        " Name: full Len: 6 Check: 0 Weight: 1.00",
        " Name: short Len: 2 Check: 0 Weight: 1.00",
        "//",
        "full ABCD",
        "short AB",
        "",
        "full EF",
      ].join("\n"),
      "/tmp/recoverable.msf",
    );

    expect(result).toMatchObject({
      document: {
        alignedLength: 6,
        rows: [
          { alignedSequence: "ABCDEF", id: "full" },
          { alignedSequence: "AB----", id: "short" },
        ],
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: "msf-width-mismatch" }),
        ]),
      },
      status: "success",
    });
  });

  it("rejects an MSF declaration with no sequence data", () => {
    expect(
      parseMsa(
        "PileUp\n MSF: 4 Type: N\n Name: a Len: 4\n Name: b Len: 4\n//\na ACGT",
        "/tmp/missing-row.msf",
      ),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "msf-declared-row-missing" }),
      ]),
    });
  });

  it("handles multiline NEXUS comments, dimensions, and MATCHCHAR", () => {
    const document = expectDocument(
      [
        "#NEXUS",
        "[comment begins",
        "and ends here]",
        "BEGIN DATA;",
        "DIMENSIONS NTAX=2 NCHAR=4;",
        "FORMAT DATATYPE=DNA GAP=- MISSING=? MATCHCHAR=.;",
        "MATRIX",
        "reference ACGT",
        "sample .C.T",
        ";",
        "END;",
      ].join("\n"),
      "/tmp/matchchar.nex",
    );
    expect(document.rows.map(({ alignedSequence }) => alignedSequence)).toEqual(
      ["ACGT", "ACGT"],
    );
  });

  it("does not treat a semicolon inside a quoted NEXUS taxon as the matrix terminator", () => {
    const document = expectDocument(
      [
        "#NEXUS",
        "BEGIN DATA;",
        "DIMENSIONS NTAX=2 NCHAR=4;",
        "MATRIX",
        "'alpha;one' ACGT",
        "beta AC-T",
        ";",
        "END;",
      ].join("\n"),
      "/tmp/quoted-semicolon.nex",
    );

    expect(document.rows.map(({ label }) => label)).toEqual([
      "alpha;one",
      "beta",
    ]);
  });

  it("rejects truncated containers and missing format headers", () => {
    expect(
      parseMsa("#NEXUS\nBEGIN DATA;\nMATRIX\na ACGT", "/tmp/truncated.nex"),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "nexus-matrix-terminator-missing" }),
      ]),
    });
    expect(
      parseMsa("#NEXUS\n[unclosed\nMATRIX\na ACGT\n;", "/tmp/comment.nex"),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "nexus-comment-unterminated" }),
      ]),
    });
    expect(parseMsa("a ACGT\nb ACGT", "/tmp/headerless.aln")).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "clustal-header-missing" }),
      ]),
    });
    expect(
      parseMsa(">P1;a\nA\nACGT\n>P1;b\nB\nACGT*", "/tmp/truncated.pir"),
    ).toMatchObject({
      status: "error",
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "pir-terminator-missing" }),
      ]),
    });
  });

  it("disambiguates duplicate source labels with unique internal row IDs", () => {
    const document = expectDocument(
      [">dup", "AA", ">dup", "AG"].join("\n"),
      "/tmp/duplicates.afa",
    );
    expect(document.rows.map((row) => row.id)).toEqual(["dup__1", "dup__2"]);
    expect(document.rows.map((row) => row.label)).toEqual(["dup", "dup"]);
    expect(document.rows[1]).toMatchObject({
      duplicateSourceLabelCount: 2,
      duplicateSourceLabelIndex: 2,
      sourceId: "dup",
    });
    expect(
      document.warnings.some(
        (warning) => warning.code === "duplicate-sequence-id",
      ),
    ).toBe(true);
  });

  it("returns fatal errors for unknown containers, empty alignments, and width mismatches", () => {
    expect(parseMsa("plain text", "/tmp/example.txt")).toMatchObject({
      status: "error",
    });
    expect(parseMsa("#NEXUS\nBEGIN DATA;", "/tmp/empty.nex")).toMatchObject({
      status: "error",
    });
    expect(
      parseMsa([">a", "ACG", ">b", "ACGT"].join("\n"), "/tmp/bad.afa"),
    ).toMatchObject({
      message: expect.stringContaining("common display width"),
      status: "error",
    });
  });

  it("carries low-confidence warnings for mixed or ambiguous nucleic-acid symbols", () => {
    const document = expectDocument(
      [">a", "ACGT", ">b", "ACGU"].join("\n"),
      "/tmp/mixed.afa",
    );
    expect(document.molecule.moleculeType).toBe("nucleic-acid-ambiguous");
    expect(
      document.warnings.some(
        (warning) => warning.code === "molecule-inference-warning",
      ),
    ).toBe(true);
  });
});

describe("MSA biological helpers", () => {
  it("computes IUPAC consensus and protein representative residues", () => {
    const dna = expectDocument([">a", "A", ">b", "G"].join("\n"), "/tmp/a.afa");
    expect(computeNucleotideConsensus(dna.rows, "dna")).toBe("R");

    const protein = expectDocument(
      [">p1", "MQ", ">p2", "ME", ">p3", "MQ"].join("\n"),
      "/tmp/p.faa",
    );
    expect(computeProteinRepresentative(protein.rows)).toBe("MQ");
  });

  it("searches nucleic acids in forward and reverse-complement orientations", () => {
    const document = expectDocument(
      [">a", "AAGT", ">b", "ACGT"].join("\n"),
      "/tmp/search.afa",
    );
    const hits = searchMsaMotif(document, "ACT");
    expect(hits.some((hit) => hit.orientation === "reverse-complement")).toBe(
      true,
    );
    expect(reverseComplement("ACT")).toBe("AGT");
    expect(complementNucleotideSymbol("R")).toBe("Y");
  });

  it("builds coordinate, conservation, codon, and RNA-pair summaries", () => {
    const projection = buildUngappedProjection("A-CG");
    expect(projection).toEqual({
      alignmentColumns: [0, 2, 3],
      sequence: "ACG",
    });
    expect(getUngappedPosition("A-CG", 2)).toBe(2);
    expect(getUngappedPosition("A-CG", -1)).toBeNull();

    const document = expectDocument(
      [">a", "ATGAAA", ">b", "ATGGAA"].join("\n"),
      "/tmp/cds.afa",
    );
    const summaries = computeColumnSummaries(document.rows, "dna");
    expect(getMeanIdentity(summaries)).toBeGreaterThan(0.8);
    expect(getMeanNormalizedConservation(summaries)).toBeGreaterThan(0.6);
    expect(
      inferCdsContext({
        alignedLength: document.alignedLength,
        moleculeType: "dna",
        rows: document.rows,
      }).applicability,
    ).toBe("eligible");
    expect(translateStandardCodon("AUG")).toBe("M");
    expect(
      isNonsynonymousCodonDifference({
        anchorCodon: "AAA",
        candidateCodon: "GAA",
      }),
    ).toBe(true);
    expect(parseRnaPairs("<A.a>")).toMatchObject({
      pairs: expect.any(Array),
    });
  });

  it("classifies standards-aware residues and gap accounting", () => {
    expect(classifyResidue("N", "dna")).toBe("ambiguous-nucleotide");
    expect(classifyResidue("J", "protein")).toBe("ambiguous-amino-acid");
    expect(classifyResidue("O", "protein")).toBe("special-amino-acid");
    expect(classifyResidue("*", "protein")).toBe("termination");
    expect(countUngappedResidues("A-C_")).toBe(2);
  });
});
