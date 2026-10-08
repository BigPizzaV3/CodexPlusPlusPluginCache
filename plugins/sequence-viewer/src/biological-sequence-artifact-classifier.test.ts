import { describe, expect, it } from "vitest";

import {
  assessFastaAlignment,
  classifySequenceArtifact,
  inferMoleculeFromSequences,
  parseFastaRecords,
} from "./biological-sequence-artifact-classifier";

// Complete public HLA records from Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/NBRF/DMB_prot.pir (source SHA-256 6d9dbca1b1f27ab3b701f7b2d68fd97cbd273313bd13b76e11c402161a529d7d).
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

// Complete public DNA records from the same Biopython revision,
// Tests/NBRF/DMA_nuc.pir (source SHA-256 6f11f2e8769a17369d63e7ff4d1f4836de3904aa663f8a82c96b6fdb695d778e).
const publicHlaPirDnaRecords = [
  ">DL;HLA:HLA00486",
  "HLA:HLA00486 DMA*0102, 564 bases, C0FF538E checksum.",
  " CTCCTACTCC AATGTGGCCA GATGACCTGC AAAACCACAC ATTCCTGCAC",
  " ACAGTGTACT GCCAGGATGG GAGTCCCAGT GTGGGACTCT CTGAGGCCTA",
  " CGACGAGGAC CAGCTTTTCT TCTTCGACTT TTCCCAGAAC ACTCGGGTGC",
  " CTCGCCTGCC CGAATTTGCT GACTGGGCTC AGGAACAGGG AGATGCTCCT",
  " GCCATTTTAT TTGACAAAGA GTTCTGCGAG TGGATGATCC AGCAAATAGG",
  " GCCAAAACTT GATGGGAAAA TCCCGGTGTC CAGAGGGTTT CCTATCGCTG",
  " AAGTGTTCAC GCTGAAGCCC CTGGAGTTTG GCAAGCCCAA CACTTTGGTC",
  " TGTTTTGTCA GTAATCTCTT CCCACCCATG CTGACAGTGA ACTGGCAGCA",
  " TCATTCCATC CCTGTGGAAG GATTTGGGCC TACTTTTGTC TCAGCTGTCG",
  " ATGGACTCAG CTTCCAGGCC TTTTCTTACT TAAACTTCAC ACCAGAACCT",
  " TCTGACATTT TCTCCTGCAT TGTGACTCAC GAAATTGACC GCTACACAGC",
  " AATTGCCTAT TGGG*",
  ">DL;HLA:HLA00487",
  "HLA:HLA00487 DMA*0103, 279 bases, ADE3279D checksum.",
  " GGGTTTCCTA TCGCTGAAGT GTTCACGCTG AAGCCCCTGG AGTTTGGCAA",
  " GCCCAACACT TTGGTCTGTT TTGTCAGTAA TCTCTTCCCA CCCATGCTGA",
  " CAGTGAACTG GCAGCATCAT TCCGTCCCTG TGGAAGGATT TGGGCCTACT",
  " TTTGTCTCAG CTGTCGATGC ACTCAGCTTC CAGGCCTTTT CTTACTTAAA",
  " CTTCACACCA GAACCTTCTG ACATTTTCTC CTGCATTGTG ACTCACGAAA",
  " TTGACCACTA CACAGCAATT GCCTATTGG*",
].join("\n");

describe("classifySequenceArtifact", () => {
  it("classifies single FASTA records as sequence-first", () => {
    expect(
      classifySequenceArtifact({
        contents: ">dna\nACGTTGCA",
        fileName: "dna.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "single-sequence",
        molecule: "dna",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("infers RNA and protein single FASTA molecules", () => {
    expect(
      classifySequenceArtifact({
        contents: ">rna\nACGUN\n",
        fileName: "rna.fasta",
      }),
    ).toEqual(expect.objectContaining({ molecule: "rna" }));
    expect(
      classifySequenceArtifact({
        contents: ">protein\nMKWVTFISLLFLFSSAYS\n",
        fileName: "protein.faa",
      }),
    ).toEqual(expect.objectContaining({ molecule: "protein" }));
  });

  it("classifies unaligned multi-record FASTA as a collection", () => {
    expect(
      classifySequenceArtifact({
        contents: ">a\nACGT\n>b\nACGTT",
        fileName: "collection.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "sequence-collection",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("classifies genuine unequal-width HLA PIR proteins by their actual residues", () => {
    expect(
      classifySequenceArtifact({
        contents: publicHlaPirProteinRecords,
        fileName: "DMB_prot.pir",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          displayWidths: [94, 80],
          disposition: "not-alignment",
          equalWidth: false,
          likelyMsa: false,
        }),
        evidence: expect.arrayContaining(["Parsed 2 PIR/NBRF record(s)."]),
        kind: "sequence-collection",
        molecule: "protein",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("infers genuine unequal-width HLA PIR nucleotide records as DNA", () => {
    expect(
      classifySequenceArtifact({
        contents: publicHlaPirDnaRecords,
        fileName: "DMA_nuc.pir",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          displayWidths: [564, 279],
          disposition: "not-alignment",
        }),
        kind: "sequence-collection",
        molecule: "dna",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("keeps rectangular gapped PIR records on the alignment-first path", () => {
    expect(
      classifySequenceArtifact({
        contents: [
          ">P1;alpha",
          "Alpha protein",
          "AC-G*",
          ">P1;beta",
          "Beta protein",
          "ACAG*",
        ].join("\n"),
        fileName: "aligned-family.pir",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          displayWidths: [4, 4],
          disposition: "explicit-alignment",
          likelyMsa: true,
        }),
        kind: "multiple-sequence-alignment",
        suggestedViewer: "msa",
      }),
    );
  });

  it("ignores genuine Rfam dot-bracket annotations when classifying RNA FASTA", () => {
    // R2DT a1ca674f245e4dc13838e346b8e03295c2130d0c,
    // data/rfam/RF00360/RF00360-traveler.fasta.
    const rna =
      "NNUNGCRGUGAYGACUYGGNRANAUUCAAGCUCAACAGACCRNANYRYAGNNYUUUYUYNNNNNNNNYYNRNNGGAUYGNUUUGNNNRNNNNGAUNNYYCCGCUGANCYGAGCNRNN";
    const structure =
      "((((((.........................................................................................................))))))";

    expect(parseFastaRecords([">RF00360", rna, structure].join("\n"))).toEqual([
      { header: "RF00360", sequence: rna },
    ]);
    expect(
      classifySequenceArtifact({
        contents: [">RF00360", rna, structure].join("\n"),
        fileName: "RF00360-traveler.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "single-sequence",
        molecule: "rna",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("preserves legitimate all-gap FASTA alignment rows", () => {
    expect(parseFastaRecords(">gaps\n..--\n>rna\nACGU\n")).toEqual([
      { header: "gaps", sequence: "..--" },
      { header: "rna", sequence: "ACGU" },
    ]);
  });

  it("classifies equal-width gapped FASTA as an MSA", () => {
    expect(
      classifySequenceArtifact({
        contents: ">a\nAC-GT\n>b\nACTGT",
        fileName: "family.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "multiple-sequence-alignment",
        suggestedViewer: "msa",
      }),
    );
  });

  it("classifies explicit MSA suffixes as MSAs even without visible gaps", () => {
    for (const fileName of [
      "family.aln-fasta",
      "family.afa",
      "family.afasta",
      "family.mfa",
    ]) {
      expect(
        classifySequenceArtifact({
          contents: ">a\nACGT\n>b\nTGCA",
          fileName,
        }),
      ).toEqual(
        expect.objectContaining({
          alignment: expect.objectContaining({
            disposition: "explicit-alignment",
            likelyMsa: true,
          }),
          kind: "multiple-sequence-alignment",
          suggestedViewer: "msa",
        }),
      );
    }
  });

  it("classifies A3M as an explicit MSA even when raw FASTA row widths differ because of insertions", () => {
    expect(
      classifySequenceArtifact({
        contents: ">query\nACde-FG\n>hit\nAC--FG\n",
        fileName: "protein-profile.a3m",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          disposition: "explicit-alignment",
          explicitAlignmentFileName: true,
          likelyMsa: true,
        }),
        kind: "multiple-sequence-alignment",
        suggestedViewer: "msa",
      }),
    );
  });

  it("keeps equal-width ungapped FASTA sequence-first without an aligned hint", () => {
    expect(
      classifySequenceArtifact({
        contents: ">a\nACGT\n>b\nTGCA",
        fileName: "collection.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          disposition: "ambiguous-equal-width",
          likelyMsa: false,
        }),
        kind: "sequence-collection",
        suggestedViewer: "sequence",
      }),
    );
  });

  it("defaults larger equal-width ungapped FASTA matrices to alignment while keeping sequence mode available", () => {
    expect(
      classifySequenceArtifact({
        contents: ">a\nACGT\n>b\nTGCA\n>c\nAGCT\n",
        fileName: "family.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        alignment: expect.objectContaining({
          disposition: "probable-alignment",
          likelyMsa: true,
        }),
        kind: "multiple-sequence-alignment",
        suggestedViewer: "msa",
      }),
    );
  });

  it("recognizes GenBank, EMBL, and FASTQ signatures", () => {
    expect(
      classifySequenceArtifact({
        contents:
          "LOCUS       demo 4 bp DNA\nFEATURES             Location/Qualifiers\nORIGIN\n        1 acgt\n//",
        fileName: "demo.gb",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "annotated-sequence",
        molecule: "dna",
      }),
    );
    expect(
      classifySequenceArtifact({
        contents:
          "ID   DEMO; SV 1; linear; genomic DNA; STD; UNC; 4 BP.\nFT   source          1..4\nSQ   Sequence 4 BP;\n     acgt        4\n//",
        fileName: "demo.embl",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "annotated-sequence",
        molecule: "dna",
      }),
    );
    expect(
      classifySequenceArtifact({
        contents: "@read1\nACGT\n+\nIIII\n",
        fileName: "reads.fastq",
      }),
    ).toEqual(expect.objectContaining({ kind: "fastq" }));
    expect(
      classifySequenceArtifact({
        contents: "@read1\nACGU\nNN\n+read1\nIIII\nII\n",
        fileName: "wrapped.fastq",
      }),
    ).toEqual(expect.objectContaining({ kind: "fastq", molecule: "rna" }));
  });

  it("honors explicit GenBank mRNA LOCUS declarations despite thymine serialization", () => {
    const rna = [
      "LOCUS       ATCOR66M      513 bp    mRNA            PLN       02-MAR-1992",
      "ACCESSION   X55053",
      "ORIGIN",
      "        1 aacaaaacac acatcaaaaa cgattttaca",
      "//",
    ].join("\n");
    const dna = [
      "LOCUS       ARU237582     206 bp    DNA             PLN       24-MAR-1999",
      "ACCESSION   AJ237582",
      "ORIGIN",
      "        1 ggacaaggcc aaggatgctg ctgctgcagc",
      "//",
    ].join("\n");

    expect(
      classifySequenceArtifact({ contents: rna, fileName: "cor6_6.gb" }),
    ).toEqual(expect.objectContaining({ molecule: "rna" }));
    expect(
      classifySequenceArtifact({
        contents: `${rna}\n${dna}`,
        fileName: "cor6_6.gb",
      }),
    ).toEqual(expect.objectContaining({ molecule: "nucleic-acid-ambiguous" }));
  });

  it("records malformed FASTA evidence without pretending it parsed sequences", () => {
    expect(
      classifySequenceArtifact({
        contents: ">empty\n",
        fileName: "empty.fasta",
      }),
    ).toEqual(
      expect.objectContaining({
        evidence: expect.arrayContaining([
          "FASTA header detected but no non-empty sequence rows parsed.",
        ]),
        kind: "unknown",
        suggestedViewer: "raw",
      }),
    );
  });

  it("records evidence strings that explain sequence-vs-MSA decisions", () => {
    expect(
      classifySequenceArtifact({
        contents: ">a\nAC-GT\n>b\nACTGT\n",
        fileName: "family.fasta",
      }).evidence,
    ).toEqual(
      expect.arrayContaining([
        "At least one FASTA row contains alignment gap characters.",
        "FASTA rows share a common display width.",
      ]),
    );
    expect(
      classifySequenceArtifact({
        contents: ">a\nACGT\n>b\nTGCA\n",
        fileName: "collection.fasta",
      }).evidence,
    ).toEqual(
      expect.arrayContaining([
        "Equal-width ungapped FASTA is ambiguous; keep sequence view first while leaving MSA as an alternate.",
      ]),
    );
    expect(
      classifySequenceArtifact({
        contents: ">a\nACGT\n>b\nTGCA\n>c\nAGCT\n",
        fileName: "family.fasta",
      }).evidence,
    ).toEqual(
      expect.arrayContaining([
        "Three or more equal-width FASTA rows make an aligned matrix more likely; default to Alignment while leaving Sequence available.",
      ]),
    );
  });
});

describe("assessFastaAlignment", () => {
  it("keeps unequal-width FASTA collections out of the MSA-first path", () => {
    expect(
      assessFastaAlignment({
        fileName: "collection.fasta",
        records: parseFastaRecords(">a\nACGT\n>b\nACGTT"),
      }),
    ).toEqual(
      expect.objectContaining({
        confidence: "high",
        disposition: "not-alignment",
        equalWidth: false,
        likelyMsa: false,
      }),
    );
  });

  it("counts gap evidence for strong aligned FASTA", () => {
    expect(
      assessFastaAlignment({
        fileName: "family.fasta",
        records: parseFastaRecords(">a\nAC-GT\n>b\nAC.GT"),
      }),
    ).toEqual(
      expect.objectContaining({
        disposition: "strong-alignment",
        evidence: expect.arrayContaining([
          "2 FASTA record(s) parsed for alignment assessment.",
          "1 unique display width observed.",
          "At least one FASTA row contains alignment gap characters.",
        ]),
        gapCharacterCount: 2,
        hasAlignmentGap: true,
        hasGapCharacters: true,
        isRectangular: true,
        likelyMsa: true,
        widthCount: 1,
      }),
    );
  });
});

describe("inferMoleculeFromSequences", () => {
  it("distinguishes DNA, RNA, protein, and ambiguous nucleic acid alphabets", () => {
    expect(inferMoleculeFromSequences(["ACGTN"])).toBe("dna");
    expect(inferMoleculeFromSequences(["ACGUN"])).toBe("rna");
    expect(inferMoleculeFromSequences(["ACGTUN"])).toBe(
      "nucleic-acid-ambiguous",
    );
    expect(inferMoleculeFromSequences(["MKWVTFISLLFLFSSAYS"])).toBe("protein");
  });

  it("ignores alignment gaps for molecule inference", () => {
    expect(inferMoleculeFromSequences(["AC-GT", "A.CGT"])).toBe("dna");
  });
});
