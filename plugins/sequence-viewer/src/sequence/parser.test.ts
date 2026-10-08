import { describe, expect, it } from "vitest";

import { parseFastqDocument } from "./formats/fastq";
import { parseSequenceDocument, parseSequenceDocumentResult } from "./parser";

// Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/NBRF/DMB_prot.pir, complete HLA:HLA00490 and HLA:HLA00492 records.
const publicHlaPirProteinRecords = [
  ">P1;HLA:HLA00490",
  "HLA:HLA00490 DMB*0102, 94 bases, 73D5CC44 checksum.",
  " PPSVQVAKTT PFNTREPVML ACYVWGFYPA EVTITWRKNG KLVMPHSSEH",
  " KTAQPNGDWT YQTLSHLALT PSYGDTYTCV VEHIGAPEPI LRDW*",
  ">P1;HLA:HLA00492",
  "HLA:HLA00492 DMB*0104, 80 bases, 453718BE checksum.",
  " KTTPFNTREP VMLACYVWGF YPAEVTITWR KNGKLVMPHS SVHKTAQPNG",
  " DWTYQTLSHL ALTPSYGDTY TCVVEHTGAP*",
].join("\n");

// Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/Quality/error_diff_ids.fastq; intentionally malformed negative control.
// SHA-256: fb28be12cda772adc2ca0d29c7b1159b439472ad8383406b2be512249bda347e.
const publicMismatchedFastq = [
  "@SLXA-B3_649_FC8437_R1_1_1_610_79",
  "GATGTGCAATACCTTTGTAGAGGAA",
  "+SLXA-B3_649_FC8437_R1_1_1_610_79",
  "YYYYYYYYYYYYYYYYYYWYWYYSU",
  "@SLXA-B3_649_FC8437_R1_1_1_397_389",
  "GGTTTGAGAAAGAGAAATGAGATAA",
  "+SLXA-B3_649_FC8437_R1_1_1_397_389",
  "YYYYYYYYYWYYYYWWYYYWYWYWW",
  "@SLXA-B3_649_FC8437_R1_1_1_850_123",
  "GAGGGTGTTGATCATGATGATGGCG",
  "+SLXA-B3_649_FC8437_R1_1_1_850_124",
  "YYYYYYYYYYYYYWYYWYYSYYYSY",
  "@SLXA-B3_649_FC8437_R1_1_1_362_549",
  "GGAAACAAAGTTTTTCTCAACATAG",
  "+SLXA-B3_649_FC8437_R1_1_1_362_549",
  "YYYYYYYYYYYYYYYYYYWWWWYWY",
  "@SLXA-B3_649_FC8437_R1_1_1_183_714",
  "GTATTATTTAATGGCATACACTCAA",
  "+SLXA-B3_649_FC8437_R1_1_1_183_714",
  "YYYYYYYYYYWYYYYWYWWUWWWQQ",
  "",
].join("\n");

// Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/Quality/example.fastq.
// SHA-256: 10bc5b39327a363b0019193c9823bc424a6d5706197688fdbdd45023a1481a0c.
const publicValidFastq = [
  "@EAS54_6_R1_2_1_413_324",
  "CCCTTCTTGTCTTCAGCGTTTCTCC",
  "+",
  ";;3;;;;;;;;;;;;7;;;;;;;88",
  "@EAS54_6_R1_2_1_540_792",
  "TTGGCAGGCCAAGGCCGATGGATCA",
  "+",
  ";;;;;;;;;;;7;;;;;-;;;3;83",
  "@EAS54_6_R1_2_1_443_348",
  "GTTGCTTCTGGCGTGGGTGGGGGGG",
  "+",
  ";;;;;;;;;;;9;7;;.7;393333",
  "",
].join("\n");

describe("parseSequenceDocument", () => {
  it("parses FASTA sequences and flags likely aligned FASTA", () => {
    const document = parseSequenceDocument({
      contents: ">a\nAC-GT\n>b\nACTGT\n",
      fileName: "family.fasta",
    });

    expect(document.format).toBe("fasta");
    expect(document.records).toHaveLength(2);
    expect(document.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "likely-msa" })]),
    );
  });

  it("parses complete public HLA PIR records without ingesting descriptions or terminators", () => {
    const document = parseSequenceDocument({
      contents: publicHlaPirProteinRecords,
      fileName: "DMB_prot.pir",
    });

    expect(document.kind).toBe("sequence-collection");
    expect(document.classification.suggestedViewer).toBe("sequence");
    expect(document.records).toEqual([
      expect.objectContaining({
        description: "HLA:HLA00490 DMB*0102, 94 bases, 73D5CC44 checksum.",
        length: 94,
        molecule: "protein",
        sourceLabel: "HLA:HLA00490",
      }),
      expect.objectContaining({
        description: "HLA:HLA00492 DMB*0104, 80 bases, 453718BE checksum.",
        length: 80,
        molecule: "protein",
        sourceLabel: "HLA:HLA00492",
      }),
    ]);
    expect(document.records.every(({ sequence }) => !sequence.includes("*"))).toBe(
      true,
    );
  });

  it("preserves fatal diagnostics for PIR records missing their terminators", () => {
    expect(
      parseSequenceDocumentResult({
        contents: ">P1;HLA:HLA00490\nHLA:HLA00490 DMB*0102\nPPSVQVAKTT\n",
        fileName: "truncated.pir",
      }),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "pir-terminator-missing",
          severity: "error",
        }),
      ]),
      status: "error",
    });
  });

  it("excludes the real RF00360 dot-bracket annotation from its 117 RNA residues", () => {
    // R2DT a1ca674f245e4dc13838e346b8e03295c2130d0c,
    // data/rfam/RF00360/RF00360-traveler.fasta.
    const rna =
      "NNUNGCRGUGAYGACUYGGNRANAUUCAAGCUCAACAGACCRNANYRYAGNNYUUUYUYNNNNNNNNYYNRNNGGAUYGNUUUGNNNRNNNNGAUNNYYCCGCUGANCYGAGCNRNN";
    const structure =
      "((((((.........................................................................................................))))))";
    const document = parseSequenceDocument({
      contents: [">RF00360", rna, structure].join("\n"),
      fileName: "RF00360-traveler.fasta",
    });

    expect(document.records[0]).toEqual(
      expect.objectContaining({
        length: 117,
        molecule: "rna",
        sequence: rna,
        sourceLabel: "RF00360",
      }),
    );
  });

  it("does not turn a structure-only FASTA record into a biological sequence", () => {
    expect(
      parseSequenceDocumentResult({
        contents: ">empty\n((..))\n>valid\nACGU\n",
        fileName: "structure-only.fasta",
      }),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "fasta-record-empty" }),
      ]),
      status: "error",
    });
  });

  it("preserves malformed empty FASTA headers while ignoring structure annotations", () => {
    expect(
      parseSequenceDocumentResult({
        contents: ">\nACGU\n",
        fileName: "empty-header.fasta",
      }),
    ).toMatchObject({ status: "error" });
  });

  it("parses GenBank metadata, sequence, and CDS translation", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
VERSION     DEMO1.1
SOURCE      synthetic
FEATURES             Location/Qualifiers
     gene            1..12
                     /gene="foo"
     CDS             1..12
                     /product="Foo protein"
                     /translation="MKTW"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "demo.gb",
    });

    expect(document.format).toBe("genbank");
    expect(document.records[0]).toEqual(
      expect.objectContaining({
        sourceLabel: "DEMO1",
        sequence: "ATGAAAACGTGG",
      }),
    );
    expect(document.records[0]?.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "gene" }),
        expect.objectContaining({ translation: "MKTW", type: "CDS" }),
      ]),
    );
  });

  it("labels the public Arabidopsis cor6.6 mRNA as RNA without rewriting source thymine", () => {
    // Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
    // Tests/GenBank/cor6_6.gb, accession X55053.1.
    const document = parseSequenceDocument({
      contents: `LOCUS       ATCOR66M      513 bp    mRNA            PLN       02-MAR-1992
DEFINITION  A.thaliana cor6.6 mRNA.
ACCESSION   X55053
VERSION     X55053.1  GI:16229
ORIGIN
        1 aacaaaacac acatcaaaaa cgattttaca agaaaaaaat atctgaaaaa tgtcagagac
       61 caacaagaat gccttccaag ccggtcaggc cgctggcaaa gctgaggaga agagcaatgt
      121 tctgctggac aaggccaagg atgctgctgc tgcagctgga gcttccgcgc aacaggcggg
      181 aaagagtata tcggatgcgg cagtgggagg tgttaacttc gtgaaggaca agaccggcct
      241 gaacaagtag cgatccgagt caactttggg agttataatt tcccttttct aattaattgt
      301 tgggattttc aaataaaatt tgggagtcat aattgattct cgtactcatc gtacttgttg
      361 ttgtttttag tgttgtaatg ttttaatgtt tcttctccct ttagatgtac tacgtttgga
      421 actttaagtt taatcaacaa aatctagttt aagttctaaa aaaaaaaaaa aaaaaaaaaa
      481 aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaa
//`,
      fileName: "cor6_6.gb",
    });

    expect(document.classification.molecule).toBe("rna");
    expect(document.records[0]).toMatchObject({
      length: 513,
      molecule: "rna",
      sourceLabel: "X55053",
    });
    expect(document.records[0]?.sequence).toContain("T");
    expect(document.records[0]?.sequence).not.toContain("U");
  });

  it("preserves distinct RNA and DNA molecule declarations across GenBank records", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       ATCOR66M      513 bp    mRNA            PLN       02-MAR-1992
ACCESSION   X55053
ORIGIN
        1 aacaaaacac acatcaaaaa cgattttaca
//
LOCUS       ARU237582     206 bp    DNA             PLN       24-MAR-1999
ACCESSION   AJ237582
FEATURES             Location/Qualifiers
     mRNA            1..10
ORIGIN
        1 ggacaaggcc aaggatgctg ctgctgcagc
//`,
      fileName: "cor6_6.gb",
    });

    expect(document.classification.molecule).toBe("nucleic-acid-ambiguous");
    expect(document.records.map(({ molecule }) => molecule)).toEqual([
      "rna",
      "dna",
    ]);
  });

  it("preserves wrapped GenBank metadata, wrapped qualifiers, and multiple records", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO1      12 bp    DNA     linear
DEFINITION  demo sequence with a wrapped
            description.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             1..12
                     /product="Demo
                     protein"
                     /translation="MKT
                     W"
ORIGIN
        1 atgaaaacgtgg
//
LOCUS       DEMO2       6 bp    DNA     linear
DEFINITION  second record.
ACCESSION   DEMO2
ORIGIN
        1 atgaaa
//`,
      fileName: "demo.gbff",
    });

    expect(document.kind).toBe("sequence-collection");
    expect(document.records.map((record) => record.sourceLabel)).toEqual([
      "DEMO1",
      "DEMO2",
    ]);
    expect(document.records[0]).toEqual(
      expect.objectContaining({
        description: "demo sequence with a wrapped description.",
      }),
    );
    expect(document.records[0]?.features[0]).toEqual(
      expect.objectContaining({
        label: "Demo protein",
        translation: "MKTW",
      }),
    );
  });

  it("parses EMBL sequence records", () => {
    const document = parseSequenceDocument({
      contents: `ID   DEMO; SV 1; linear; genomic DNA; STD; UNC; 12 BP.
AC   DEMO1;
DE   demo EMBL sequence
OS   synthetic construct
FT   CDS             complement(1..12)
FT                   /product="Demo protein"
FT                   /translation="MKTW"
SQ   Sequence 12 BP; 3 A; 3 C; 3 G; 3 T; 0 other;
     atgaaaacgtgg        12
//`,
      fileName: "demo.embl",
    });

    expect(document.format).toBe("embl");
    expect(document.records[0]?.sequence).toBe("ATGAAAACGTGG");
    expect(document.records[0]?.features[0]).toEqual(
      expect.objectContaining({
        label: "Demo protein",
        strand: "-",
        translation: "MKTW",
        translationTrackReliable: true,
        type: "CDS",
      }),
    );
  });

  it("preserves wrapped EMBL qualifiers and multiple entries", () => {
    const document = parseSequenceDocument({
      contents: `ID   DEMO1; SV 1; linear; genomic DNA; STD; UNC; 12 BP.
AC   DEMO1;
DE   demo EMBL
DE   sequence
FT   CDS             1..12
FT                   /product="Demo
FT                   protein"
FT                   /translation="MKT
FT                   W"
SQ   Sequence 12 BP; 3 A; 3 C; 3 G; 3 T; 0 other;
     atgaaaacgtgg        12
//
ID   DEMO2; SV 1; linear; genomic DNA; STD; UNC; 6 BP.
AC   DEMO2;
DE   second EMBL sequence
SQ   Sequence 6 BP; 3 A; 0 C; 1 G; 2 T; 0 other;
     atgaaa         6
//`,
      fileName: "demo.embl",
    });

    expect(document.kind).toBe("sequence-collection");
    expect(document.records.map((record) => record.sourceLabel)).toEqual([
      "DEMO1",
      "DEMO2",
    ]);
    expect(document.records[0]).toEqual(
      expect.objectContaining({
        description: "demo EMBL sequence",
      }),
    );
    expect(document.records[0]?.features[0]).toEqual(
      expect.objectContaining({
        label: "Demo protein",
        translation: "MKTW",
      }),
    );
  });

  it("maps exact compound GenBank CDS translations across exon boundaries", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             join(1..3,7..9)
                     /product="Joined protein"
                     /translation="MK"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "joined.gb",
    });

    expect(document.records[0]?.features[0]).toEqual(
      expect.objectContaining({
        end: 9,
        segments: [
          expect.objectContaining({ end: 3, start: 1 }),
          expect.objectContaining({ end: 9, start: 7 }),
        ],
        sourceLocation: "join(1..3,7..9)",
        start: 1,
        translation: "MK",
        translationCoordinateMap: [
          expect.objectContaining({
            aminoAcidIndex: 1,
            codonCoordinates: [1, 2, 3],
          }),
          expect.objectContaining({
            aminoAcidIndex: 2,
            codonCoordinates: [7, 8, 9],
          }),
        ],
        translationTrackReliable: true,
        type: "CDS",
      }),
    );
    expect(document.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ambiguous-genbank-location" }),
      ]),
    );
  });

  it("parses wrapped feature locations and honors codon_start", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       WRAPPED    10 bp    DNA     linear
ACCESSION   WRAPPED1
FEATURES             Location/Qualifiers
     CDS             join(1..4,
                     5..10)
                     /codon_start=2
                     /product="wrapped CDS"
ORIGIN
        1 aatgaaatag
//`,
      fileName: "wrapped.gb",
    });

    expect(document.records[0]?.features[0]).toMatchObject({
      codonStart: 2,
      sourceLocation: "join(1..4,5..10)",
      translation: "MK",
      translationCoordinateMap: [
        {
          aminoAcidIndex: 1,
          codonCoordinates: [2, 3, 4],
          displayCoordinate: 2,
        },
        {
          aminoAcidIndex: 2,
          codonCoordinates: [5, 6, 7],
          displayCoordinate: 5,
        },
      ],
      translationSource: "computed",
    });
  });

  it("maps reverse-strand joins in biological order and honors transl_table", () => {
    const reverse = parseSequenceDocument({
      contents: `LOCUS       REVERSE    12 bp    DNA     linear
ACCESSION   REVERSE1
FEATURES             Location/Qualifiers
     CDS             complement(join(1..3,10..12))
ORIGIN
        1 aaacccgggcat
//`,
      fileName: "reverse.gb",
    });
    expect(reverse.records[0]?.features[0]).toMatchObject({
      strand: "-",
      translation: "MF",
      translationCoordinateMap: [
        expect.objectContaining({ codonCoordinates: [12, 11, 10] }),
        expect.objectContaining({ codonCoordinates: [3, 2, 1] }),
      ],
    });

    const mitochondrial = parseSequenceDocument({
      contents: `LOCUS       MITO        9 bp    DNA     linear
ACCESSION   MITO1
FEATURES             Location/Qualifiers
     CDS             1..9
                     /transl_table=2
ORIGIN
        1 atatgaaga
//`,
      fileName: "mito.gb",
    });
    expect(mitochondrial.records[0]?.features[0]).toMatchObject({
      geneticCodeId: 2,
      translation: "MW",
      translationSource: "computed",
    });

    const bacterial = parseSequenceDocument({
      contents: `LOCUS       BACTERIAL   6 bp    DNA     linear
ACCESSION   BACTERIAL1
FEATURES             Location/Qualifiers
     CDS             1..6
                     /transl_table=11
ORIGIN
        1 gtggtg
//`,
      fileName: "bacterial.gb",
    });
    expect(bacterial.records[0]?.features[0]).toMatchObject({
      geneticCodeId: 11,
      translation: "MV",
      translationSource: "computed",
    });
  });

  it("preserves and computes exact CDS mappings across supported NCBI genetic codes", () => {
    const sourceTranslated = parseSequenceDocument({
      contents: `LOCUS       MITO        9 bp    DNA     linear
ACCESSION   MITO5
FEATURES             Location/Qualifiers
     CDS             1..9
                     /transl_table=5
                     /translation="MKW"
ORIGIN
        1 atgaaatgg
//`,
      fileName: "mito-source.gb",
    });

    expect(sourceTranslated.records[0]?.features[0]).toMatchObject({
      geneticCodeId: 5,
      translation: "MKW",
      translationCoordinateMap: [
        expect.objectContaining({ codonCoordinates: [1, 2, 3] }),
        expect.objectContaining({ codonCoordinates: [4, 5, 6] }),
        expect.objectContaining({ codonCoordinates: [7, 8, 9] }),
      ],
      translationMappingUnavailableReason: undefined,
      translationSource: "qualifier",
      translationTrackReliable: true,
    });
    expect(sourceTranslated.warnings).toEqual([]);

    const computedOnly = parseSequenceDocument({
      contents: `LOCUS       MITO        9 bp    DNA     linear
ACCESSION   MITO5
FEATURES             Location/Qualifiers
     CDS             1..9
                     /transl_table=5
ORIGIN
        1 atgaaatgg
//`,
      fileName: "mito-computed.gb",
    });
    expect(computedOnly.records[0]?.features[0]).toMatchObject({
      geneticCodeId: 5,
      translation: "MKW",
      translationCoordinateMap: [
        expect.objectContaining({ codonCoordinates: [1, 2, 3] }),
        expect.objectContaining({ codonCoordinates: [4, 5, 6] }),
        expect.objectContaining({ codonCoordinates: [7, 8, 9] }),
      ],
      translationSource: "computed",
      translationTrackReliable: true,
    });
  });

  it("reports why remote or ordered CDS locations cannot be mapped", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       REMOTE      9 bp    DNA     linear
ACCESSION   REMOTE1
FEATURES             Location/Qualifiers
     CDS             order(1..3,OTHER.1:4..6)
                     /translation="MK"
ORIGIN
        1 atgaaataa
//`,
      fileName: "remote.gb",
    });

    expect(document.records[0]?.features[0]).toMatchObject({
      translationCoordinateMap: undefined,
      translationMappingUnavailableReason: "remote segment",
      translationTrackReliable: false,
    });
    expect(document.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ambiguous-genbank-location" }),
      ]),
    );
  });

  it("parses FASTQ quality strings", () => {
    const document = parseSequenceDocument({
      contents: "@read1\nACGT\n+\nIIII\n",
      fileName: "reads.fastq",
    });

    expect(document.format).toBe("fastq");
    expect(document.records[0]?.quality?.phred).toEqual([40, 40, 40, 40]);
    expect(document.fastqSummary).toEqual(
      expect.objectContaining({
        gcFraction: 0.5,
        meanQuality: 40,
        q30Fraction: 1,
        readCount: 1,
        totalBases: 4,
      }),
    );
  });

  it("rejects the public Biopython FASTQ whose third repeated identifier differs", () => {
    const document = parseFastqDocument({
      contents: publicMismatchedFastq,
      fileName: "error_diff_ids.fastq",
    });

    expect(document.fastqSummary?.readCount).toBe(2);
    expect(document.records).toHaveLength(2);
    expect(document.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "fastq-separator-label-mismatch",
          line: 11,
          severity: "error",
        }),
      ]),
    );

    const result = parseSequenceDocumentResult({
      contents: publicMismatchedFastq,
      fileName: "error_diff_ids.fastq",
    });

    expect(result).toMatchObject({
      message: expect.stringContaining("850_124"),
      status: "error",
    });
    expect(result).not.toHaveProperty("document");
  });

  it("preserves valid public Biopython FASTQ bare separators and punctuation qualities", () => {
    const document = parseSequenceDocument({
      contents: publicValidFastq,
      fileName: "example.fastq",
    });

    expect(document.fastqSummary?.readCount).toBe(3);
    expect(document.records.map(({ quality }) => quality?.ascii)).toEqual([
      ";;3;;;;;;;;;;;;7;;;;;;;88",
      ";;;;;;;;;;;7;;;;;-;;;3;83",
      ";;;;;;;;;;;9;7;;.7;393333",
    ]);
  });

  it("matches repeated FASTQ full titles while ignoring trailing whitespace", () => {
    const document = parseSequenceDocument({
      contents: [
        "@read sample description  ",
        "AC",
        "GT",
        "+read sample description\t",
        "()",
        "[]",
        "@bare",
        "AC",
        "+ \t",
        "{}",
        "@  leading title  ",
        "AC",
        "+  leading title\t",
        "<>",
      ].join("\n"),
      fileName: "titled.fastq",
    });

    expect(document.records.map(({ quality }) => quality?.ascii)).toEqual([
      "()[]",
      "{}",
      "<>",
    ]);
  });

  it("rejects repeated FASTQ titles with additional leading whitespace", () => {
    expect(
      parseSequenceDocumentResult({
        contents: "@read title\nACGT\n+ read title\nIIII\n",
        fileName: "different-leading-space.fastq",
      }),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "fastq-separator-label-mismatch",
          message:
            "FASTQ + label ' read title' does not match header 'read title'.",
          severity: "error",
        }),
      ]),
      status: "error",
    });
  });

  it("rejects repeated FASTQ titles that differ after a shared first identifier", () => {
    expect(
      parseSequenceDocumentResult({
        contents: "@read first title\nACGT\n+read second title\nIIII\n",
        fileName: "different-title.fastq",
      }),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "fastq-separator-label-mismatch",
          severity: "error",
        }),
      ]),
      status: "error",
    });
  });

  it("aggregates multi-read FASTQ length, composition, and quality metrics", () => {
    const document = parseSequenceDocument({
      contents: ["@read1", "ACGN", "+", "I5+!", "@read2", "GG", "+", "??"].join(
        "\n",
      ),
      fileName: "reads.fastq",
    });

    expect(document.fastqSummary).toEqual({
      gcFraction: 4 / 6,
      meanQuality: 130 / 6,
      meanReadLength: 3,
      nFraction: 1 / 6,
      q20Fraction: 4 / 6,
      q30Fraction: 3 / 6,
      qualityEncoding: "phred+33-assumed",
      readCount: 2,
      readLengthMax: 4,
      readLengthMin: 2,
      totalBases: 6,
    });
  });

  it("parses wrapped FASTQ sequence and quality lines as one logical record", () => {
    const document = parseSequenceDocument({
      contents: "@wrapped\nACGT\nNN\n+wrapped\nIIII\n!!\n",
      fileName: "wrapped.fastq",
    });

    expect(document.records[0]).toMatchObject({
      sequence: "ACGTNN",
      sourceLabel: "wrapped",
    });
    expect(document.records[0]?.quality?.phred).toEqual([40, 40, 40, 40, 0, 0]);
    expect(document.recordInventory).toEqual({
      materializedCount: 1,
      totalCount: 1,
      truncated: false,
    });
  });

  it("streams mixed CRLF and CR FASTQ line endings without materializing a line array", () => {
    const document = parseSequenceDocument({
      contents: "@mixed\r\nAC\rGT\r\n+\r\nII\rII",
      fileName: "mixed.fastq",
    });

    expect(document.records[0]).toMatchObject({
      quality: { ascii: "IIII", phred: [40, 40, 40, 40] },
      sequence: "ACGT",
      sourceLabel: "mixed",
    });
  });

  it("reports truncated FASTQ as an explicit parse error", async () => {
    const { parseSequenceDocumentResult } = await import("./parser");
    const result = parseSequenceDocumentResult({
      contents: "@truncated\nACGT\n+\nII\n",
      fileName: "truncated.fastq",
    });

    expect(result).toMatchObject({
      diagnostics: [
        expect.objectContaining({
          code: "truncated-fastq-quality",
          severity: "error",
        }),
      ],
      status: "error",
    });
  });

  it("summarizes every FASTQ read while bounding retained interactive records", () => {
    const readCount = 5_001;
    const document = parseSequenceDocument({
      contents: Array.from(
        { length: readCount },
        (_, index) => `@read-${index + 1}\nACGT\n+\nIIII`,
      ).join("\n"),
      fileName: "many.fastq",
    });

    expect(document.fastqSummary).toMatchObject({
      readCount,
      totalBases: readCount * 4,
    });
    expect(document.records).toHaveLength(5_000);
    expect(document.recordInventory).toEqual({
      materializedCount: 5_000,
      totalCount: readCount,
      truncated: true,
    });
  });

  it("does not allocate an unbounded decoded-quality array for an oversized read", () => {
    const sequence = "A".repeat(1_000_001);
    const document = parseSequenceDocument({
      contents: `@long-read\n${sequence}\n+\n${"I".repeat(sequence.length)}\n`,
      fileName: "long.fastq",
    });

    expect(document.fastqSummary).toMatchObject({
      readCount: 1,
      totalBases: sequence.length,
    });
    expect(document.records[0]?.sequence).toBe(sequence);
    expect(document.records[0]?.quality).toBeUndefined();
    expect(document.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "fastq-inspection-retention-limit",
          severity: "info",
        }),
      ]),
    );
  });

  it("recognizes featureless GenBank and EMBL records", () => {
    expect(
      parseSequenceDocument({
        contents:
          "LOCUS       NOFEATURE 4 bp DNA linear\nORIGIN\n        1 acgt\n//\n",
        fileName: "featureless.gb",
      }).records[0]?.sequence,
    ).toBe("ACGT");
    expect(
      parseSequenceDocument({
        contents:
          "ID   NOFEATURE; SV 1; linear; DNA; STD; UNC; 4 BP.\nSQ   Sequence 4 BP;\n     acgt 4\n//\n",
        fileName: "featureless.embl",
      }).records[0]?.sequence,
    ).toBe("ACGT");
  });

  it("rejects an otherwise valid FASTA collection that contains an empty record", () => {
    expect(
      parseSequenceDocumentResult({
        contents: ">empty\n>valid\nACGT\n",
        fileName: "mixed.fasta",
      }),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "fasta-record-empty" }),
      ]),
      status: "error",
    });
  });
});
