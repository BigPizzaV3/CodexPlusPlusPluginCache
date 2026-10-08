import { describe, expect, it } from "vitest";

import { parseMsa } from "./msa/parser";
import { parseSequenceDocument } from "./sequence/parser";
import { parseAnnotationTrack, parseSequenceTrack } from "./sequence/tracks";
import {
  exportAlignmentWorkbench,
  exportSequenceWorkbench,
} from "./workbench-exports";

describe("round-trippable workbench exports", () => {
  it("omits unmapped source traces from subsequence exports and preserves the full source", () => {
    // Synthetic trace control, not an experimental chromatogram.
    const document = parseSequenceDocument({
      contents: ">QA-SYNTHETIC-TRACE\nATGC\n",
      fileName: "synthetic-trace.fasta",
    });
    const record = document.records[0]!;
    record.chromatogram = {
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
    const source = structuredClone(document);
    const selected = JSON.parse(
      exportSequenceWorkbench({
        document,
        format: "json",
        recordId: record.id,
        scope: "selection",
        selection: { end: 3, recordId: record.id, start: 2 },
      }).content,
    ) as { document: typeof document };

    expect(selected.document.records[0]?.sequence).toBe("TG");
    expect(selected.document.records[0]?.chromatogram).toBeUndefined();
    expect(selected.document.records[0]?.quality).toBeUndefined();
    expect(selected.document.warnings).toContainEqual(
      expect.objectContaining({ code: "source-trace-not-carried" }),
    );
    const full = JSON.parse(
      exportSequenceWorkbench({
        document,
        format: "json",
        recordId: record.id,
        scope: "all",
      }).content,
    ) as { document: typeof document };
    expect(full.document.records[0]?.chromatogram).toEqual(record.chromatogram);
    expect(document).toEqual(source);
    expect(() =>
      exportSequenceWorkbench({
        document,
        format: "fastq",
        recordId: record.id,
        scope: "selection",
        selection: { end: 3, recordId: record.id, start: 2 },
      }),
    ).toThrow();
  });

  it.each(["genbank", "embl"] as const)(
    "preserves compound feature segments and qualifiers in %s",
    (format) => {
      const document = annotatedDocument();
      const record = document.records[0];
      const exported = exportSequenceWorkbench({
        document,
        format,
        recordId: record?.id ?? "",
        scope: "all",
      });
      const reparsed = parseSequenceDocument({
        contents: exported.content,
        fileName: exported.name,
      });

      expect(reparsed.records[0]?.sequence).toBe(record?.sequence);
      expect(reparsed.records[0]?.features[0]).toMatchObject({
        qualifiers: expect.objectContaining({ note: "important" }),
        segments: [
          expect.objectContaining({ start: 1, end: 3 }),
          expect.objectContaining({ start: 7, end: 9 }),
        ],
        strand: "-",
      });
    },
  );

  it("exports selected sequence and exact one-based annotations", () => {
    const document = annotatedDocument();
    const record = document.records[0];
    const selection = { end: 8, recordId: record?.id ?? "", start: 4 };
    const fasta = exportSequenceWorkbench({
      document,
      format: "fasta",
      recordId: record?.id ?? "",
      scope: "selection",
      selection,
    });
    const gff = exportSequenceWorkbench({
      document,
      format: "gff3",
      recordId: record?.id ?? "",
      scope: "all",
    });
    const bed = exportSequenceWorkbench({
      document,
      format: "bed",
      recordId: record?.id ?? "",
      scope: "all",
    });

    expect(fasta.content).toContain("demo:4-8\nTACGT");
    expect(gff.content).toContain("demo\tsequence-viewer\tmisc_feature\t1\t3");
    expect(bed.content).toContain("demo\t0\t3");
  });

  it("exports standards-compliant GTF with exact compound coordinates", () => {
    const document = annotatedDocument();
    const exported = exportSequenceWorkbench({
      document,
      format: "gtf",
      recordId: document.records[0]?.id ?? "",
      scope: "all",
    });
    const features = parseAnnotationTrack(exported.content, "gtf");

    expect(exported.mediaType).toBe("text/x-gtf");
    expect(exported.name).toMatch(/\.gtf$/u);
    expect(features).toHaveLength(2);
    expect(features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          end: 3,
          reference: "demo",
          start: 1,
          strand: "-",
        }),
        expect.objectContaining({
          end: 9,
          reference: "demo",
          start: 7,
          strand: "-",
        }),
      ]),
    );
    expect(exported.content).toContain('gene_id "');
    expect(exported.content).toContain('transcript_id "');
  });

  it.each(["sequence", "alignment"] as const)(
    "writes a valid, self-contained %s PDF with accurate cross-references",
    (kind) => {
      const sequence = annotatedDocument();
      const alignment = alignmentDocument();
      const exported =
        kind === "sequence"
          ? exportSequenceWorkbench({
              document: sequence,
              format: "pdf",
              recordId: sequence.records[0]?.id ?? "",
              scope: "all",
            })
          : exportAlignmentWorkbench({
              document: alignment,
              format: "pdf",
              scope: "all",
              visibleRows: alignment.rows,
            });
      const crossReference = exported.content.match(
        /startxref\n(\d+)\n%%EOF\n$/u,
      );

      expect(exported.mediaType).toBe("application/pdf");
      expect(exported.name).toMatch(/\.pdf$/u);
      expect(exported.content).toMatch(/^%PDF-1\.4\n/u);
      expect(crossReference).not.toBeNull();
      expect(exported.content.slice(Number(crossReference?.[1]))).toMatch(
        /^xref\n/u,
      );
    },
  );

  it("exports loaded variants as valid VCF rows", () => {
    const document = annotatedDocument();
    const exported = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: document.records[0]?.id ?? "",
      scope: "all",
      tracks: [
        {
          format: "vcf",
          id: "variants",
          kind: "variants",
          mapping: {
            matchedReference: "demo",
            requestedReference: "demo",
            status: "matched",
            unmatchedReferences: [],
          },
          name: "variants.vcf",
          source: { displayName: "variants.vcf" },
          summary: {
            itemCount: 1,
            references: ["demo"],
            truncated: false,
          },
          variants: [
            {
              alternateAlleles: ["G"],
              filters: [],
              id: "v1",
              info: { DP: "10" },
              position: 4,
              quality: 50,
              reference: "demo",
              referenceAllele: "T",
              samples: {},
            },
          ],
        },
      ],
    });
    expect(exported.content).toContain("demo\t4\tv1\tT\tG\t50\tPASS\tDP=10");
  });

  it("limits selected and visible VCF exports to their exact active reference and interval", () => {
    const document = parseSequenceDocument({
      contents: ">chr1\nAAAAAAAAAAAA\n",
      fileName: "reference.fasta",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected chromosome 1.");
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
        "1\t2\tselected\tA\tG\t50\tPASS\t.",
        "1\t8\tunselected\tA\tT\t50\tPASS\t.",
        "chr2\t3\tother-chromosome\tA\tC\t50\tPASS\t.",
      ].join("\n"),
      displayName: "variants.vcf",
      format: "vcf",
      id: "variants",
      requestedReference: record.sourceLabel,
    });

    const selected = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: record.id,
      scope: "selection",
      selection: { end: 4, recordId: record.id, start: 1 },
      tracks: [track],
    });
    const visible = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: record.id,
      scope: "visible",
      tracks: [track],
    });
    const all = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: record.id,
      scope: "all",
      tracks: [track],
    });

    expect(selected.content).toContain("\tselected\t");
    expect(selected.content).not.toContain("\tunselected\t");
    expect(selected.content).not.toContain("\tother-chromosome\t");
    expect(visible.content).toContain("\tselected\t");
    expect(visible.content).toContain("\tunselected\t");
    expect(visible.content).not.toContain("\tother-chromosome\t");
    expect(all.content).toContain("\tother-chromosome\t");
  });

  it("preserves VCF metadata, FORMAT, all 100 genotypes, and unassessed FILTER values", () => {
    const document = parseSequenceDocument({
      contents: ">1\nAAAAAAAAAAAA\n",
      fileName: "reference.fasta",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected chromosome 1.");
    const sampleNames = Array.from(
      { length: 100 },
      (_, index) => `HG${String(index + 96).padStart(5, "0")}`,
    );
    const sampleValues = sampleNames.map(
      (_, index) => `${index % 2}|${(index + 1) % 2}:0.200:-0.18,-0.47,-2.42`,
    );
    const metadata = [
      "##fileformat=VCFv4.3",
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      '##FORMAT=<ID=DS,Number=1,Type=Float,Description="Dosage">',
      '##FILTER=<ID=q10,Description="Quality below 10">',
      ...Array.from(
        { length: 42 },
        (_, index) =>
          `##INFO=<ID=I${index},Number=1,Type=String,Description="Annotation ${index}">`,
      ),
    ];
    const originalRow = [
      "1",
      "2",
      ".",
      "A",
      "G",
      "10.500",
      ".",
      "I0=retained;I1=exact",
      "GT:DS:GL",
      ...sampleValues,
    ].join("\t");
    const content = [
      ...metadata,
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
      originalRow,
    ].join("\n");
    const track = parseSequenceTrack({
      content,
      displayName: "one-hundred-samples.vcf",
      format: "vcf",
      id: "variants",
      requestedReference: record.sourceLabel,
    });

    const exported = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: record.id,
      scope: "all",
      tracks: [track],
    });
    const lines = exported.content.trimEnd().split("\n");
    const exportedHeader = lines.find((line) => line.startsWith("#CHROM"));

    expect(lines.filter((line) => line.startsWith("##"))).toEqual(metadata);
    expect(exportedHeader?.split("\t")).toHaveLength(109);
    expect(exportedHeader?.split("\t").slice(9)).toEqual(sampleNames);
    expect(lines.at(-1)).toBe(originalRow);
    expect(lines.at(-1)?.split("\t")[6]).toBe(".");
    expect(lines.at(-1)?.split("\t").slice(9)).toEqual(sampleValues);
  });

  it("excludes unrelated sample identities and metadata from selection-scoped VCF exports", () => {
    const document = parseSequenceDocument({
      contents: ">chr1\nAAAAAAAAAAAA\n",
      fileName: "reference.fasta",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected chromosome 1.");
    const selectedTrack = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##contig=<ID=1,length=12>",
        "##contig=<ID=2,length=12>",
        '##INFO=<ID=USED,Number=1,Type=String,Description="Used">',
        '##INFO=<ID=UNUSED,Number=1,Type=String,Description="Not selected">',
        '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
        '##FORMAT=<ID=DS,Number=1,Type=Float,Description="Unused dosage">',
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSELECTED_SAMPLE",
        "1\t2\tselected\tA\tG\t50\tPASS\tUSED=yes\tGT\t0|1",
        "2\t2\toff-target\tA\tT\t50\tPASS\tUNUSED=no\tGT:DS\t0|0:0.1",
      ].join("\n"),
      displayName: "selected.vcf",
      format: "vcf",
      id: "selected",
      requestedReference: record.sourceLabel,
    });
    const unrelatedTrack = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##source=unrelated-private-study",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tUNRELATED_PRIVATE_SAMPLE",
        "1\t9\tunrelated\tA\tC\t50\tPASS\t.\tGT\t1|1",
      ].join("\n"),
      displayName: "unrelated.vcf",
      format: "vcf",
      id: "unrelated",
      requestedReference: record.sourceLabel,
    });

    const exported = exportSequenceWorkbench({
      document,
      format: "vcf",
      recordId: record.id,
      scope: "selection",
      selection: { end: 2, recordId: record.id, start: 2 },
      tracks: [selectedTrack, unrelatedTrack],
    });

    expect(exported.content).toContain("SELECTED_SAMPLE");
    expect(exported.content).toContain("##contig=<ID=1");
    expect(exported.content).toContain("##INFO=<ID=USED");
    expect(exported.content).toContain("##FORMAT=<ID=GT");
    expect(exported.content).not.toContain("UNRELATED_PRIVATE_SAMPLE");
    expect(exported.content).not.toContain("unrelated-private-study");
    expect(exported.content).not.toContain("##contig=<ID=2");
    expect(exported.content).not.toContain("##INFO=<ID=UNUSED");
    expect(exported.content).not.toContain("##FORMAT=<ID=DS");
  });

  it("preserves all three authentic public FASTQ reads when exporting every record", () => {
    // Immutable public Biopython Tests/Quality/example.fastq, SHA-256
    // 10bc5b39327a363b0019193c9823bc424a6d5706197688fdbdd45023a1481a0c.
    const contents = [
      "@EAS54_6_R1_2_1_413_324",
      "CCCTTCTTGTCTTCAGCGTTTCTCC",
      ";;3;;;;;;;;;;;;7;;;;;;;88",
    ];
    const source = [
      contents[0],
      contents[1],
      "+",
      contents[2],
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
    const document = parseSequenceDocument({
      contents: source,
      fileName: "example.fastq",
    });
    const selectedRecord = document.records[1];
    if (selectedRecord == null) throw new Error("Expected a second FASTQ read.");

    const all = exportSequenceWorkbench({
      document,
      format: "fastq",
      recordId: selectedRecord.id,
      scope: "all",
    });
    const visible = exportSequenceWorkbench({
      document,
      format: "fastq",
      recordId: selectedRecord.id,
      scope: "visible",
    });
    const reparsed = parseSequenceDocument({
      contents: all.content,
      fileName: "roundtrip.fastq",
    });

    expect(reparsed.records).toHaveLength(3);
    expect(reparsed.records.map(({ quality }) => quality?.ascii)).toEqual(
      document.records.map(({ quality }) => quality?.ascii),
    );
    expect(visible.content).toContain(`@${selectedRecord.sourceLabel}`);
    expect(visible.content.match(/^@/gmu)).toHaveLength(1);
  });

  it.each(["genbank", "embl"] as const)(
    "round-trips every sequence record in an all-scope %s export",
    (format) => {
      const document = parseSequenceDocument({
        contents: ">first\nACGTACGT\n>second\nAACC\n>third\nGGTTAA\n",
        fileName: "records.fasta",
      });
      const selectedRecord = document.records[1];
      if (selectedRecord == null) throw new Error("Expected multiple records.");

      const all = exportSequenceWorkbench({
        document,
        format,
        recordId: selectedRecord.id,
        scope: "all",
      });
      const visible = exportSequenceWorkbench({
        document,
        format,
        recordId: selectedRecord.id,
        scope: "visible",
      });
      const reparsed = parseSequenceDocument({
        contents: all.content,
        fileName: all.name,
      });

      expect(reparsed.records.map(({ sourceLabel }) => sourceLabel)).toEqual([
        "first",
        "second",
        "third",
      ]);
      expect(
        parseSequenceDocument({ contents: visible.content, fileName: visible.name })
          .records,
      ).toHaveLength(1);
    },
  );

  it("exports RNA as RNA and protein EMBL records in amino-acid units", () => {
    const rna = parseSequenceDocument({
      contents: ">URS0000D6941A\nAUGCUUAGCAUUGCAU\n",
      fileName: "accessioned-rna.fasta",
    });
    const protein = parseSequenceDocument({
      contents: ">A00022\nMQWPEPTIDEFKWY\n",
      fileName: "protein.faa",
    });
    const rnaRecord = rna.records[0];
    const proteinRecord = protein.records[0];
    if (rnaRecord == null || proteinRecord == null) {
      throw new Error("Expected RNA and protein records.");
    }

    const rnaGenBank = exportSequenceWorkbench({
      document: rna,
      format: "genbank",
      recordId: rnaRecord.id,
      scope: "all",
    });
    const rnaEmbl = exportSequenceWorkbench({
      document: rna,
      format: "embl",
      recordId: rnaRecord.id,
      scope: "all",
    });
    const proteinEmbl = exportSequenceWorkbench({
      document: protein,
      format: "embl",
      recordId: proteinRecord.id,
      scope: "all",
    });

    expect(rnaGenBank.content).toMatch(/^LOCUS\s+URS0000D6941A\s+16 bp RNA/mu);
    expect(rnaEmbl.content).toContain("; RNA; UNC; 16 BP.");
    expect(proteinEmbl.content).toContain("; PROTEIN; UNC; 14 AA.");
    expect(proteinEmbl.content).toContain("SQ   Sequence 14 AA;");
    expect(proteinEmbl.content).not.toContain("14 BP");
  });

  it("computes strand-aware compound CDS phases and preserves codon_start", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       FRAMES      40 bp    DNA     linear
ACCESSION   FRAMES
FEATURES             Location/Qualifiers
     CDS             join(1..4,11..17,21..26)
                     /gene="forward"
                     /codon_start=1
     CDS             complement(join(2..5,12..17,22..29))
                     /gene="reverse"
                     /codon_start=2
     misc_feature    30..35
ORIGIN
        1 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
//`,
      fileName: "compound-cds.gb",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected coding features.");

    const exported = exportSequenceWorkbench({
      document,
      format: "gtf",
      recordId: record.id,
      scope: "all",
    });
    const rows = exported.content
      .trimEnd()
      .split("\n")
      .map((line) => line.split("\t"));

    expect(
      rows
        .filter((fields) => fields[8]?.includes('gene_id "forward"'))
        .map((fields) => [fields[3], fields[4], fields[7]]),
    ).toEqual([
      ["1", "4", "0"],
      ["11", "17", "2"],
      ["21", "26", "1"],
    ]);
    expect(
      rows
        .filter((fields) => fields[8]?.includes('gene_id "reverse"'))
        .map((fields) => [fields[3], fields[4], fields[7]]),
    ).toEqual([
      ["22", "29", "1"],
      ["12", "17", "2"],
      ["2", "5", "2"],
    ]);
    expect(rows.find((fields) => fields[2] === "misc_feature")?.[7]).toBe(".");
  });

  it("preserves Stockholm GF, repeated GS, GR, GC, and RNA secondary structure", () => {
    const document = annotatedStockholmDocument();
    const exported = exportAlignmentWorkbench({
      document,
      format: "stockholm",
      scope: "all",
      visibleRows: document.rows,
    });
    const reparsed = parseMsa(exported.content, exported.name);

    expect(exported.content).toContain("#=GF AC RF04178");
    expect(exported.content.match(/^#=GF AU /gmu)).toHaveLength(2);
    expect(exported.content.match(/^#=GS AE015928\.1 DR /gmu)).toHaveLength(2);
    expect(exported.content).toContain("#=GR AE015928.1 PP 999887766555");
    expect(exported.content).toContain("#=GC SS_cons <<<<<..>>>>>");
    expect(reparsed.status).toBe("success");
    if (reparsed.status !== "success") throw new Error(reparsed.message);
    expect(reparsed.document.formatMetadata).toEqual(document.formatMetadata);
    expect(reparsed.document.rows[0]?.metadata).toEqual(document.rows[0]?.metadata);
    expect(reparsed.document.annotations).toHaveLength(document.annotations.length);
    expect(reparsed.document.rnaStructure?.pairs).toHaveLength(5);
  });

  it("limits Stockholm row annotations and slices every selected annotation column", () => {
    const document = annotatedStockholmDocument();
    const selectedRow = document.rows[1];
    if (selectedRow == null) throw new Error("Expected a selected RNA row.");

    const exported = exportAlignmentWorkbench({
      document,
      format: "stockholm",
      scope: "selection",
      selectedColumns: { end: 10, start: 2 },
      selectedRows: [selectedRow.id],
      visibleRows: document.rows,
    });
    const reparsed = parseMsa(exported.content, exported.name);

    expect(exported.content).not.toContain("AE015928.1");
    expect(exported.content).toContain("#=GS CP000139.1 DE Second public RNA");
    expect(exported.content).toContain("#=GR CP000139.1 PP 11122233");
    expect(exported.content).toContain("#=GC SS_cons <<<..>>>");
    expect(exported.content).toContain("#=GC RF AAGUAAaa");
    expect(reparsed.status).toBe("success");
    if (reparsed.status !== "success") throw new Error(reparsed.message);
    expect(reparsed.document.rows).toHaveLength(1);
    expect(reparsed.document.alignedLength).toBe(8);
    expect(reparsed.document.annotations.every(({ values }) => values.length === 8)).toBe(
      true,
    );
  });

  it.each(["csv", "tsv"] as const)(
    "neutralizes spreadsheet formulas in %s feature export fields",
    (format) => {
      const original = annotatedDocument();
      const record = original.records[0];
      if (record == null) throw new Error("Expected a sequence record.");
      const document = {
        ...original,
        records: [
          {
            ...record,
            features: [
              {
                ...record.features[0]!,
                id: "@SUM(1,2)",
                label: "=HYPERLINK(\"https://invalid.example\")",
                type: "+cmd",
              },
            ],
            sourceLabel: "\uFEFF-2+3",
          },
        ],
      };

      const exported = exportSequenceWorkbench({
        document,
        format,
        recordId: record.id,
        scope: "all",
      });

      expect(exported.content).toContain("'\uFEFF-2+3");
      expect(exported.content).toContain("'@SUM(1,2)");
      expect(exported.content).toContain("'+cmd");
      expect(exported.content).toContain("'=HYPERLINK(");
      expect(exported.content).not.toMatch(/(?:^|\t),?=HYPERLINK/mu);
    },
  );

  it("neutralizes spreadsheet formulas in alignment TSV row IDs, labels, and residues", () => {
    const original = alignmentDocument();
    const document = {
      ...original,
      rows: [
        {
          ...original.rows[0]!,
          alignedSequence: "-ACG",
          id: "\t=CMD()",
          label: "\uFF1D2+2",
        },
      ],
    };

    const exported = exportAlignmentWorkbench({
      document,
      format: "tsv",
      scope: "all",
      visibleRows: document.rows,
    });

    expect(exported.content).toContain("' =CMD()");
    expect(exported.content).toContain("'\uFF1D2+2");
    expect(exported.content).toContain("'-ACG");
  });

  it("exports alignment scopes, SVG, JSON, and Newick", () => {
    const document = alignmentDocument();
    const visibleRows = document.rows.slice(0, 1);
    const fasta = exportAlignmentWorkbench({
      document,
      format: "aligned-fasta",
      scope: "selection",
      selectedColumns: { end: 2, start: 0 },
      visibleRows,
    });
    const svg = exportAlignmentWorkbench({
      document,
      format: "svg",
      scope: "visible",
      visibleRows,
    });
    const newick = exportAlignmentWorkbench({
      document,
      format: "newick",
      newick: "('a':0.1,'b':0.1)",
      scope: "all",
      visibleRows,
    });
    const reparsed = parseMsa(fasta.content, fasta.name);

    expect(reparsed.status).toBe("success");
    expect(fasta.content).toContain("AC");
    expect(svg.content).toContain("<svg");
    expect(newick.content).toBe("('a':0.1,'b':0.1);\n");
  });

  it("exports selected alignment rows instead of every visible row", () => {
    const document = alignmentDocument();
    const selectedRow = document.rows[1];
    if (selectedRow == null) throw new Error("Expected a selected row.");

    const fasta = exportAlignmentWorkbench({
      document,
      format: "aligned-fasta",
      scope: "selection",
      selectedRows: [selectedRow.id],
      visibleRows: document.rows,
    });

    expect(fasta.content).toContain(`>${selectedRow.label}\n`);
    expect(fasta.content).not.toContain(`>${document.rows[0]?.label}\n`);
  });

  it.each([
    ["clustal", "text/x-clustal", /^CLUSTAL W/u, ".aln"],
    ["stockholm", "text/x-stockholm", /^# STOCKHOLM 1\.0/u, ".sto"],
  ] as const)(
    "round-trips exact selected alignment rows through %s",
    (format, mediaType, header, extension) => {
      const document = alignmentDocument();
      const exported = exportAlignmentWorkbench({
        document,
        format,
        scope: "all",
        visibleRows: document.rows,
      });
      const reparsed = parseMsa(exported.content, exported.name);

      expect(exported.mediaType).toBe(mediaType);
      expect(exported.name.endsWith(extension)).toBe(true);
      expect(exported.content).toMatch(header);
      expect(reparsed.status).toBe("success");
      if (reparsed.status !== "success") throw new Error(reparsed.message);
      expect(
        reparsed.document.rows.map(({ alignedSequence }) => alignedSequence),
      ).toEqual(document.rows.map(({ alignedSequence }) => alignedSequence));
    },
  );

  it("round-trips A3M match columns and lowercase insertion provenance", () => {
    const parsed = parseMsa(">alpha\nACgtGT\n>beta\nA-GT\n", "profile.a3m");
    if (parsed.status !== "success") throw new Error(parsed.message);
    const exported = exportAlignmentWorkbench({
      document: parsed.document,
      format: "a3m",
      scope: "all",
      visibleRows: parsed.document.rows,
    });
    const reparsed = parseMsa(exported.content, exported.name);

    expect(exported.mediaType).toBe("text/x-a3m");
    expect(exported.name).toMatch(/\.a3m$/u);
    expect(exported.content).toContain("ACgtGT");
    expect(reparsed.status).toBe("success");
    if (reparsed.status !== "success") throw new Error(reparsed.message);
    expect(
      reparsed.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(
      parsed.document.rows.map(({ alignedSequence }) => alignedSequence),
    );
    expect(reparsed.document.insertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          afterAlignmentColumn: 1,
          residues: "gt",
        }),
      ]),
    );
  });

  it("restricts selected JSON to one public VCF variant while retaining all 100 authorized genotypes", () => {
    // HG00096 and chr1:10583 rs58108140 are from the immutable public
    // hts-specs VCFv4.3 100-sample fixture; 27 rows exercise the same shape.
    const original = parseSequenceDocument({
      contents: `>1\n${"A".repeat(10_582)}G${"A".repeat(100)}\n>OFF_RECORD_ACCESSION\nCCCCCCCCCCCC\n`,
      fileName: "public-reference.fa",
    });
    const active = original.records[0];
    if (active == null) throw new Error("Expected a public chr1 record.");
    const document = {
      ...original,
      records: [
        {
          ...active,
          features: [
            {
              end: 10_590,
              id: "selected-cds",
              qualifiers: { translation: "OFF_SELECTION_PRIVATE_PROTEIN" },
              start: 10_580,
              strand: "+" as const,
              translation: "OFF_SELECTION_PRIVATE_PROTEIN",
              type: "CDS",
            },
          ],
        },
        ...original.records.slice(1),
      ],
      recordInventory: {
        materializedCount: 2,
        totalCount: 2,
        truncated: false,
      },
    };
    const sampleNames = [
      "HG00096",
      ...Array.from({ length: 99 }, (_, index) => `HG${String(index + 97).padStart(5, "0")}`),
    ];
    const selectedGenotypes = sampleNames.map((_, index) =>
      index === 0 ? "0|1:0.48" : "0|0:0.01",
    );
    const rows = Array.from({ length: 27 }, (_, index) => {
      const reference = index === 26 ? "<1>" : "1";
      const position = index === 0 || index === 26 ? 10_583 : 10_583 + index;
      const id =
        index === 0
          ? "rs58108140"
          : index === 1
            ? "rs189107123"
            : `rs1403379${String(index).padStart(2, "0")}`;
      const genotypes =
        index === 0
          ? selectedGenotypes
          : sampleNames.map(() => "1|1:OFF_RANGE_PRIVATE_GENOTYPE");
      return [reference, position, id, "G", "A", ".", ".", "AC=1", "GT:DS", ...genotypes].join("\t");
    });
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##contig=<ID=1,length=10800>",
        "##contig=<ID=<1>,length=10800>",
        "##INFO=<ID=AC,Number=A,Type=Integer,Description=Allele count>",
        "##INFO=<ID=OFF_RANGE_PRIVATE_INFO,Number=1,Type=String,Description=Private>",
        "##FORMAT=<ID=GT,Number=1,Type=String,Description=Genotype>",
        "##FORMAT=<ID=DS,Number=1,Type=Float,Description=Dosage>",
        ["#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO", "FORMAT", ...sampleNames].join("\t"),
        ...rows,
      ].join("\n"),
      displayName: "100-public-samples.vcf",
      format: "vcf",
      id: "public-100-samples",
      requestedReference: active.sourceLabel,
    });
    const unrelated = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        "##source=UNRELATED_PRIVATE_STUDY",
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tUNRELATED_PRIVATE_SAMPLE",
        "1\t10584\tunrelated-private-variant\tA\tC\t.\t.\t.\tGT\t1|1",
      ].join("\n"),
      displayName: "unrelated.vcf",
      format: "vcf",
      id: "unrelated-private-track",
      requestedReference: active.sourceLabel,
    });
    const selected = exportSequenceWorkbench({
      document,
      format: "json",
      recordId: active.id,
      scope: "selection",
      selection: { end: 10_583, recordId: active.id, start: 10_583 },
      tracks: [track, unrelated],
    });
    const payload = JSON.parse(selected.content) as {
      document: typeof document;
      tracks: Array<typeof track>;
    };

    expect(payload.document.records).toHaveLength(1);
    expect(payload.document.records[0]).toMatchObject({
      length: 1,
      sequence: "G",
      sourceLabel: "1",
      features: [{ end: 1, qualifiers: {}, start: 1 }],
    });
    expect(payload.document.recordInventory).toEqual({
      materializedCount: 1,
      totalCount: 1,
      truncated: false,
    });
    expect(payload.tracks).toHaveLength(1);
    expect(payload.tracks[0]?.mapping.unmatchedReferences).toEqual([]);
    expect(payload.tracks[0]?.summary).toMatchObject({
      itemCount: 1,
      materializedItemCount: 1,
      references: ["1"],
    });
    expect(payload.tracks[0]?.variants).toHaveLength(1);
    expect(payload.tracks[0]?.variants?.[0]).toMatchObject({
      id: "rs58108140",
      position: 10_583,
      rawFilter: ".",
      reference: "1",
      samples: { HG00096: "0|1:0.48" },
    });
    expect(payload.tracks[0]?.variants?.[0]?.sampleValues).toHaveLength(100);
    expect(payload.tracks[0]?.vcfHeader?.sampleNames).toHaveLength(100);
    for (const forbidden of [
      "OFF_RECORD_ACCESSION",
      "OFF_SELECTION_PRIVATE_PROTEIN",
      "OFF_RANGE_PRIVATE_GENOTYPE",
      "OFF_RANGE_PRIVATE_INFO",
      "UNRELATED_PRIVATE_STUDY",
      "UNRELATED_PRIVATE_SAMPLE",
      "rs189107123",
      "rs140337953",
      "<1>",
    ]) {
      expect(selected.content).not.toContain(forbidden);
    }

    const all = JSON.parse(
      exportSequenceWorkbench({
        document,
        format: "json",
        recordId: active.id,
        scope: "all",
        tracks: [track, unrelated],
      }).content,
    ) as { document: typeof document; tracks: Array<typeof track> };
    expect(all.document).toEqual(document);
    expect(all.tracks[0]?.variants).toHaveLength(27);
    expect(all.tracks[1]?.vcfHeader?.sampleNames).toEqual([
      "UNRELATED_PRIVATE_SAMPLE",
    ]);
  });

  it.each(["fastq", "genbank", "embl", "pdf", "svg"] as const)(
    "never exposes unselected sequence or quality in selected %s exports",
    (format) => {
      const document = parseSequenceDocument({
        contents: "@selected-read\nACGTACGT\n+\n!\"#$%&'(\n@private-read\nTTTTAAAA\n+\nIIIIIIII\n",
        fileName: "selection.fastq",
      });
      const record = document.records[0];
      if (record == null) throw new Error("Expected a public FASTQ record.");
      const exported = exportSequenceWorkbench({
        document,
        format,
        recordId: record.id,
        scope: "selection",
        selection: { end: 4, recordId: record.id, start: 3 },
      });

      expect(exported.content).not.toContain("ACGTACGT");
      expect(exported.content).not.toContain("TTTTAAAA");
      expect(exported.content).not.toContain("private-read");
      expect(exported.content).not.toContain("!\"#$%&'(");
      if (format === "fastq") {
        expect(exported.content).toContain("\nGT\n+\n#$");
      }
      if (format === "genbank" || format === "embl") {
        expect(
          parseSequenceDocument({
            contents: exported.content,
            fileName: exported.name,
          }).records[0]?.sequence,
        ).toBe("GT");
      }
      if (format === "pdf") expect(exported.content).toContain("Sequence: GT");
      if (format === "svg") expect(exported.content).toContain("2 residues");
    },
  );

  it("fails closed when a selected sequence export has no active-record selection", () => {
    const document = annotatedDocument();
    expect(() =>
      exportSequenceWorkbench({
        document,
        format: "json",
        recordId: document.records[0]?.id ?? "",
        scope: "selection",
      }),
    ).toThrow(/selection on the active record/u);
  });

  it("projects selected Stockholm JSON rows, annotations, insertions, and RNA pairs", () => {
    const original = annotatedStockholmDocument();
    const hiddenRow = original.rows[0];
    const selectedRow = original.rows[1];
    if (hiddenRow == null || selectedRow == null) {
      throw new Error("Expected two public Rfam RNA rows.");
    }
    const document = {
      ...original,
      insertions: [
        {
          afterAlignmentColumn: 4,
          residues: "SELECTED_INSERTION",
          rowId: selectedRow.id,
          sourceKind: "other" as const,
          sourceRowIndex: 1,
        },
        {
          afterAlignmentColumn: 4,
          residues: "HIDDEN_ROW_PRIVATE_INSERTION",
          rowId: hiddenRow.id,
          sourceKind: "other" as const,
        },
        {
          afterAlignmentColumn: 11,
          residues: "OFF_COLUMN_PRIVATE_INSERTION",
          rowId: selectedRow.id,
          sourceKind: "other" as const,
        },
      ],
    };
    const exported = exportAlignmentWorkbench({
      document,
      format: "json",
      scope: "selection",
      selectedColumns: { end: 10, start: 2 },
      selectedRows: [selectedRow.id],
      visibleRows: document.rows,
    });
    const payload = JSON.parse(exported.content) as {
      document: typeof document;
    };

    expect(payload.document.rows).toHaveLength(1);
    expect(payload.document.rows[0]).toMatchObject({
      alignedSequence: "AAGUAAAA",
      id: selectedRow.id,
      ungappedLength: 8,
    });
    expect(payload.document.alignedLength).toBe(8);
    expect(payload.document.rawSummary).toMatchObject({
      maxLabelLength: selectedRow.label.length,
      sequenceCount: 1,
      visibleSequenceCount: 1,
    });
    expect(payload.document.insertions).toEqual([
      expect.objectContaining({
        afterAlignmentColumn: 2,
        residues: "SELECTED_INSERTION",
        sourceRowIndex: 0,
      }),
    ]);
    expect(payload.document.annotations.every(({ values }) => values.length === 8)).toBe(true);
    expect(payload.document.rnaStructure?.rawStructure).toBe("<<<..>>>");
    expect(payload.document.rnaStructure?.referenceTrack).toBe("AAGUAAaa");
    expect(payload.document.rnaStructure?.pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ leftColumn: 0, rightColumn: 7 }),
        expect.objectContaining({ leftColumn: 1, rightColumn: 6 }),
        expect.objectContaining({ leftColumn: 2, rightColumn: 5 }),
      ]),
    );
    expect(exported.content).not.toContain(hiddenRow.id);
    expect(exported.content).not.toContain("HIDDEN_ROW_PRIVATE_INSERTION");
    expect(exported.content).not.toContain("OFF_COLUMN_PRIVATE_INSERTION");
    expect(exported.content).not.toContain("999887766555");
    expect(exported.content).not.toContain("<<<<<..>>>>>");

    const all = JSON.parse(
      exportAlignmentWorkbench({
        document,
        format: "json",
        scope: "all",
        visibleRows: document.rows,
      }).content,
    ) as { document: typeof document };
    expect(all.document).toEqual(document);
  });

  it.each(["selection", "visible"] as const)(
    "rejects %s Newick exports that would disclose unselected guide-tree labels",
    (scope) => {
      const document = alignmentDocument();
      expect(() =>
        exportAlignmentWorkbench({
          document,
          format: "newick",
          newick: "('a':0.1,'PRIVATE_HIDDEN_SAMPLE':0.1)",
          scope,
          selectedRows: [document.rows[0]?.id ?? ""],
          visibleRows: document.rows.slice(0, 1),
        }),
      ).toThrow(/requires all scope/u);
    },
  );
});

function annotatedDocument() {
  return parseSequenceDocument({
    contents: `LOCUS       demo        12 bp    DNA     circular
ACCESSION   demo
FEATURES             Location/Qualifiers
     misc_feature    complement(join(1..3,7..9))
                     /note="important"
ORIGIN
        1 acgtacgtacgt
//`,
    fileName: "demo.gb",
  });
}

function alignmentDocument() {
  const result = parseMsa(">a\nACGT\n>b\nA-GT\n", "demo.aln-fasta");
  if (result.status !== "success") throw new Error(result.message);
  return result.document;
}

function annotatedStockholmDocument() {
  const result = parseMsa(
    [
      "# STOCKHOLM 1.0",
      "#=GF AC RF04178",
      "#=GF AU Prezza, G",
      "#=GF AU Ryan, D",
      "#=GS AE015928.1 DE First public RNA",
      "#=GS AE015928.1 DR PDB; FIRST;",
      "#=GS AE015928.1 DR PDB; SECOND;",
      "#=GS CP000139.1 DE Second public RNA",
      "AE015928.1 GUAAGUAAAAGU",
      "CP000139.1 GUAAGUAAAAGU",
      "#=GR AE015928.1 PP 999887766555",
      "#=GR CP000139.1 PP 001112223344",
      "#=GC SS_cons <<<<<..>>>>>",
      "#=GC RF guAAGUAAaaGU",
      "//",
      "",
    ].join("\n"),
    "rfam-rna-selection.sto",
  );
  if (result.status !== "success") throw new Error(result.message);
  return result.document;
}
