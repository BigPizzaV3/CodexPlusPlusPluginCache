import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildEvidenceWindow,
  parseAnnotationTrack,
  parseSam,
  parseSequenceTrack,
  parseUncompressedBam,
  parseVcf,
} from "./tracks";
import {
  DEFAULT_READ_PILEUP_FILTERS,
  readPassesPileupFilters,
} from "./read-pileup";

describe("evidence and annotation tracks", () => {
  it("parses BED's zero-based half-open coordinates into explicit one-based intervals", () => {
    expect(
      parseAnnotationTrack("chr1\t9\t20\tfeature-a\t5\t-\n", "bed"),
    ).toEqual([
      expect.objectContaining({
        end: 20,
        label: "feature-a",
        reference: "chr1",
        score: 5,
        start: 10,
        strand: "-",
      }),
    ]);
  });

  it("preserves genuine UCSC BED12 exon blocks, coding bounds, strand, score, and RGB", () => {
    // Public Biopython UCSC fixture at immutable commit
    // c9489604d1d9607602ca9199a3852c1219ed330f, Tests/Blat/bed12.bed.
    const features = parseAnnotationTrack(
      [
        "chr22\t1000\t5000\tmRNA1\t960\t+\t1200\t4900\t255,0,0\t2\t567,488,\t0,3512,",
        "chr22\t2000\t6000\tmRNA2\t900\t-\t2300\t5960\t0,255,0\t2\t433,399,\t0,3601,",
      ].join("\n"),
      "bed",
    );

    expect(features).toEqual([
      expect.objectContaining({
        attributes: { item_rgb: "255,0,0" },
        codingSegments: [
          { end: 1567, start: 1201 },
          { end: 4900, start: 4513 },
        ],
        label: "mRNA1",
        score: 960,
        segments: [
          { end: 1567, start: 1001 },
          { end: 5000, start: 4513 },
        ],
        strand: "+",
      }),
      expect.objectContaining({
        attributes: { item_rgb: "0,255,0" },
        codingSegments: [
          { end: 2433, start: 2301 },
          { end: 5960, start: 5602 },
        ],
        label: "mRNA2",
        score: 900,
        segments: [
          { end: 2433, start: 2001 },
          { end: 6000, start: 5602 },
        ],
        strand: "-",
      }),
    ]);
    expect(
      features[0]?.segments?.some(
        ({ end, start }) => start <= 3000 && end >= 3000,
      ),
    ).toBe(false);
  });

  it("rejects incomplete, overlapping, and out-of-bounds BED12 block definitions", () => {
    expect(() =>
      parseAnnotationTrack(
        "chr22\t1000\t5000\tmRNA1\t960\t+\t1200\t4900\t255,0,0\t2\t567,488,\n",
        "bed",
      ),
    ).toThrow("blockCount, blockSizes, and blockStarts");
    expect(() =>
      parseAnnotationTrack(
        "chr22\t1000\t5000\tmRNA1\t960\t+\t1200\t4900\t255,0,0\t2\t567,488,\t0,200,\n",
        "bed",
      ),
    ).toThrow("overlapping or out-of-range");
    expect(() =>
      parseAnnotationTrack(
        "chr22\t1000\t5000\tmRNA1\t960\t+\t900\t4900\t255,0,0\t2\t567,488,\t0,3512,\n",
        "bed",
      ),
    ).toThrow("coding boundaries");
  });

  it("preserves GFF3 and GTF attributes without flattening coordinates", () => {
    expect(
      parseAnnotationTrack(
        "chr1\tsource\tgene\t4\t12\t.\t+\t.\tID=g1;Name=Gene%201\n",
        "gff3",
      )[0],
    ).toMatchObject({ id: "g1", label: "Gene 1", start: 4, end: 12 });
    expect(
      parseAnnotationTrack(
        'chr2\tsource\texon\t7\t19\t.\t-\t.\tgene_id "g2"; gene_name "Beta";\n',
        "gtf",
      )[0],
    ).toMatchObject({ id: "g2", label: "Beta", strand: "-" });
  });

  it("parses VCF alleles, filters, INFO, and samples", () => {
    const variants = parseVcf(
      "##fileformat=VCFv4.3\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\nchr1\t11\trs1\tA\tG,T\t50\tq10\tDP=12;SOMATIC\tGT\t0/1\n",
    );
    expect(variants[0]).toMatchObject({
      alternateAlleles: ["G", "T"],
      filters: ["q10"],
      format: "GT",
      id: "rs1",
      info: { DP: "12", SOMATIC: true },
      position: 11,
      quality: 50,
      rawFilter: "q10",
      rawId: "rs1",
      rawInfo: "DP=12;SOMATIC",
      rawQuality: "50",
      sampleValues: ["0/1"],
      samples: { S1: "0/1" },
    });
  });

  it("retains complete VCF metadata, declared sample order, and unknown FILTER semantics", () => {
    const track = parseSequenceTrack({
      content: [
        "##fileformat=VCFv4.3",
        '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
        '##INFO=<ID=DP,Number=1,Type=Integer,Description="Depth">',
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tHG00096\tHG00097",
        "1\t10583\trs58108140\tG\tA\t100\t.\tDP=12\tGT:DS:GL\t0|0:0.200:-0.18,-0.47,-2.42\t0|0:0.150:-0.24,-0.44,-1.16",
      ].join("\n"),
      displayName: "official-vcf-projection.vcf",
      format: "vcf",
      id: "vcf-projection",
      requestedReference: "chr1",
    });

    expect(track.vcfHeader).toEqual({
      columns: [
        "#CHROM",
        "POS",
        "ID",
        "REF",
        "ALT",
        "QUAL",
        "FILTER",
        "INFO",
        "FORMAT",
        "HG00096",
        "HG00097",
      ],
      metaLines: [
        "##fileformat=VCFv4.3",
        '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
        '##INFO=<ID=DP,Number=1,Type=Integer,Description="Depth">',
      ],
      sampleNames: ["HG00096", "HG00097"],
    });
    expect(track.variants?.[0]).toMatchObject({
      filters: [],
      format: "GT:DS:GL",
      rawFilter: ".",
      rawId: "rs58108140",
      rawInfo: "DP=12",
      rawQuality: "100",
      sampleValues: [
        "0|0:0.200:-0.18,-0.47,-2.42",
        "0|0:0.150:-0.24,-0.44,-1.16",
      ],
      samples: {
        HG00096: "0|0:0.200:-0.18,-0.47,-2.42",
        HG00097: "0|0:0.150:-0.24,-0.44,-1.16",
      },
    });
    expect(track.mapping.matchedReference).toBe("1");
  });

  it("retains all 46 headers and every exact sample genotype from the public 100-sample VCF", () => {
    // Exact first-record projection of the public HTS-specs VCF at immutable
    // commit 510c107ba89aa13113818c9e4fa3071283cb7f7b:
    // test/vcf/4.3/passed/complexfile_passed_000.vcf.
    // Complete upstream SHA-256:
    // f0618cfb67afdd6fc8ee594217824f34cb40d26b277392876984aa0a5211eadf.
    const publicFixture = readFileSync(
      "src/sequence/__fixtures__/official-vcf-4.3-first-100-sample-variant.vcf",
      "utf8",
    );
    expect(createHash("sha256").update(publicFixture).digest("hex")).toBe(
      "2841a817ca64295730ef905725a735b4a424bdcfd3e231304eeee8f44e76997b",
    );

    const track = parseSequenceTrack({
      content: publicFixture,
      displayName: "public-official-100-sample-vcf.vcf",
      format: "vcf",
      id: "official-vcf",
      requestedReference: "1",
    });
    const variant = track.variants?.[0];

    expect(track.vcfHeader?.metaLines).toHaveLength(46);
    expect(track.vcfHeader?.columns).toHaveLength(109);
    expect(track.vcfHeader?.sampleNames).toHaveLength(100);
    expect(track.vcfHeader?.sampleNames[0]).toBe("HG00096");
    expect(track.vcfHeader?.sampleNames[99]).toBe("HG00261");
    expect(variant?.format).toBe("GT:DS:GL");
    expect(variant?.sampleValues).toHaveLength(100);
    expect(Object.keys(variant?.samples ?? {})).toHaveLength(100);
    expect(variant?.samples.HG00096).toBe("0|0:0.200:-0.18,-0.47,-2.42");
    expect(variant?.samples.HG00261).toBe("0|1:1.300:-2.60,-0.46,-0.19");
  });

  it("rejects malformed VCF sample declarations before lossy materialization", () => {
    expect(() =>
      parseVcf(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\tS1\nchr1\t1\t.\tA\tG\t.\t.\t.\tGT\t0/0\t0/1\n",
      ),
    ).toThrow("sample identifiers must be unique");
    expect(() =>
      parseVcf(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\nchr1\t1\t.\tA\tG\t.\t.\t.\tGT\n",
      ),
    ).toThrow("header declares");
  });

  it("retains genuine CDS phases instead of converting them to implicit zero", () => {
    expect(
      parseAnnotationTrack(
        'chr22\tNCBI\tCDS\t3698\t3978\t.\t+\t2\tgene_id "AC007323.5"; transcript_id "AT1G01010";\n',
        "gtf",
      )[0],
    ).toMatchObject({
      end: 3978,
      phase: 2,
      start: 3698,
      type: "CDS",
    });
    expect(() =>
      parseAnnotationTrack(
        'chr22\tNCBI\tCDS\t3698\t3978\t.\t+\t3\tgene_id "AC007323.5";\n',
        "gtf",
      ),
    ).toThrow("invalid CDS phase");
  });

  it("parses SAM CIGAR, quality, mate, strand, and typed tags", () => {
    const reads = parseSam(
      "@SQ\tSN:chr1\tLN:100\nread1\t16\tchr1\t5\t42\t3M1D2M\t=\t20\t18\tAACGT\tIIIII\tNM:i:1\tRG:Z:sample\n",
    );
    expect(reads[0]).toMatchObject({
      cigar: "3M1D2M",
      end: 10,
      mappingQuality: 42,
      matePosition: 20,
      mateReference: "chr1",
      position: 5,
      quality: [40, 40, 40, 40, 40],
      strand: "-",
      tags: { NM: 1, RG: "sample" },
    });
  });

  it("rejects malformed SAM fields before they enter session state", () => {
    expect(() =>
      parseSam("read1\t0\tchr1\t5\t42\t3Mbad\t*\t0\t0\tACG\tIII\n"),
    ).toThrow("invalid CIGAR");
    expect(() =>
      parseSam("read1\t0\tchr1\t5\t42\t3M\t*\t0\t0\tACG\tII\n"),
    ).toThrow("quality symbols");
    expect(() =>
      parseSam("read1\t0\tchr1\t5\t256\t3M\t*\t0\t0\tACG\tIII\n"),
    ).toThrow("exceeds 255");
    expect(() =>
      parseSam(
        "read1\t0\tchr1\t5\t42\t3M\t*\t0\t0\tACG\tIII\tNM:i:not-a-number\n",
      ),
    ).toThrow("invalid numeric value");
  });

  it("decodes BGZF-decompressed BAM alignment blocks", () => {
    const reads = parseUncompressedBam(buildMinimalBam());
    expect(reads).toEqual([
      expect.objectContaining({
        cigar: "4M",
        end: 13,
        id: "read1",
        mappingQuality: 60,
        position: 10,
        quality: [30, 31, 32, 33],
        reference: "chr1",
        sequence: "ACGT",
        strand: "+",
      }),
    ]);
  });

  it("reports reference mapping diagnostics instead of silently attaching mismatched tracks", () => {
    const track = parseSequenceTrack({
      content: "chr2\t0\t10\n",
      displayName: "regions.bed",
      format: "bed",
      id: "track-1",
      requestedReference: "chr1",
    });
    expect(track.mapping).toEqual({
      matchedReference: null,
      requestedReference: "chr1",
      status: "unmatched",
      unmatchedReferences: ["chr2"],
    });
  });

  it("omits absent optional fields from strictly serializable evidence tracks", () => {
    const track = parseSequenceTrack({
      content:
        "@SQ\tSN:chr1\tLN:100\nread1\t0\tchr1\t1\t60\t5M\t*\t0\t0\tACGTA\t*\n",
      displayName: "reads.sam",
      format: "sam",
      id: "serializable-track",
      requestedReference: "chr1",
    });

    expect(track.source).toEqual({ displayName: "reads.sam" });
    expect(track.reads?.[0]).not.toHaveProperty("matePosition");
    expect(track.reads?.[0]).not.toHaveProperty("mateReference");
    expect(track.reads?.[0]).not.toHaveProperty("quality");
    expect(JSON.parse(JSON.stringify(track))).toEqual(track);
  });

  it("uses region-only loading, all-read coverage, and disclosed deterministic downsampling", () => {
    const track = parseSequenceTrack({
      content: Array.from(
        { length: 20 },
        (_, index) =>
          `read${index}\t0\tchr1\t${index + 1}\t60\t5M\t*\t0\t0\tACGTA\tIIIII`,
      ).join("\n"),
      displayName: "reads.sam",
      format: "sam",
      id: "reads",
      requestedReference: "1",
    });
    const window = buildEvidenceWindow({
      end: 20,
      maxReads: 5,
      reference: "chr1",
      start: 1,
      tracks: [track],
    });
    expect(window).toMatchObject({
      downsampled: true,
      sampledReadCount: 5,
      totalReadCount: 20,
    });
    expect(window.coverage[4]?.depth).toBe(5);
  });

  it("preserves indexed-read source downsampling in track and evidence summaries", () => {
    const track = parseSequenceTrack({
      content:
        "@SQ\tSN:chr1\tLN:100\nread1\t0\tchr1\t1\t60\t5M\t*\t0\t0\tACGTA\tIIIII\n",
      displayName: "regional.bam",
      format: "bam",
      id: "indexed-reads",
      requestedReference: "chr1",
      sourceItemCount: 25_000,
      sourceTruncated: true,
    });
    expect(track.summary).toMatchObject({
      itemCount: 25_000,
      materializedItemCount: 1,
      truncated: true,
    });
    const evidenceWindow = buildEvidenceWindow({
      end: 20,
      reference: "chr1",
      start: 1,
      tracks: [track],
    });
    expect(evidenceWindow).toMatchObject({
      coverageComplete: false,
      coverageOmittedReadCount: 0,
      coverageReadCount: 1,
      downsampled: true,
      sampledReadCount: 1,
      sourceReadCount: 25_000,
      sourceTruncated: true,
      totalReadCount: 1,
    });
    expect(evidenceWindow.coverage[4]?.depth).toBe(1);
    expect(evidenceWindow.coverage[5]?.depth).toBe(0);
  });

  it("does not infer a reference is absent from a truncated retained read sample", () => {
    const track = parseSequenceTrack({
      content:
        "@SQ\tSN:chr1\tLN:4\n@SQ\tSN:chr2\tLN:4\nr1\t0\tchr1\t1\t60\t4M\t*\t0\t0\tACGT\tIIII",
      displayName: "sampled.sam",
      format: "sam",
      id: "sampled",
      requestedReference: "chr2",
      sourceItemCount: 200_001,
      sourceTruncated: true,
    });
    const window = buildEvidenceWindow({
      start: 1,
      end: 4,
      reference: "chr2",
      tracks: [track],
    });
    expect(window).toMatchObject({
      coverageComplete: false,
      sourceReadCount: 200_001,
      sourceTruncated: true,
      sourceReferenceUncertain: true,
      totalReadCount: 0,
    });
    expect(window.coverage.map((point) => point.depth)).toEqual([0, 0, 0, 0]);
  });

  it("prefers exact reference names and treats ambiguous aliases as unknown rather than zero coverage", () => {
    const track = parseSequenceTrack({
      content:
        "alias\t0\t1\t1\t60\t2M\t*\t0\t0\tAA\tII\nexact\t0\tchr1\t1\t60\t2M\t*\t0\t0\tCC\tII",
      displayName: "aliases.sam",
      format: "sam",
      id: "aliases",
      requestedReference: "chr1",
    });
    expect(track.mapping.matchedReference).toBe("chr1");
    const exact = buildEvidenceWindow({
      start: 1,
      end: 2,
      reference: "chr1",
      tracks: [track],
    });
    expect(exact.reads.map((read) => read.id)).toEqual(["exact"]);
    expect(exact.coverageComplete).toBe(true);
    const ambiguous = buildEvidenceWindow({
      start: 1,
      end: 2,
      reference: "CHR1",
      tracks: [track],
    });
    expect(ambiguous).toMatchObject({
      coverageComplete: false,
      sourceReferenceUncertain: true,
      reads: [],
    });
    const aliasOnly = {
      ...track,
      reads: track.reads?.slice(0, 1),
      summary: { ...track.summary, references: ["1"] },
    };
    const wrongDocumentAlias = buildEvidenceWindow({
      start: 1,
      end: 2,
      reference: "chr1",
      referenceRecords: [{ sourceLabel: "1" }, { sourceLabel: "chr1" }],
      tracks: [aliasOnly],
    });
    expect(wrongDocumentAlias).toMatchObject({
      coverageComplete: false,
      sourceReferenceUncertain: true,
      reads: [],
    });
  });

  it("counts only CIGAR aligned bases, and reports unavailable CIGAR without inventing coverage", () => {
    const track = parseSequenceTrack({
      content: [
        "spliced\t0\tchr1\t1\t60\t2M1I1M1D2M2N1M1S\t*\t0\t0\tATGTCGAA\tIIIIIIII",
        "unknown\t0\tchr1\t1\t60\t*\t*\t0\t0\tACGT\tIIII",
      ].join("\n"),
      displayName: "cigar.sam",
      format: "sam",
      id: "cigar",
      requestedReference: "chr1",
    });
    const window = buildEvidenceWindow({
      start: 1,
      end: 10,
      reference: "chr1",
      tracks: [track],
    });
    expect(window.coverage.map((point) => point.depth)).toEqual([
      1, 1, 1, 0, 1, 1, 0, 0, 1, 0,
    ]);
    expect(window).toMatchObject({
      coverageComplete: false,
      coverageReadCount: 1,
      coverageOmittedReadCount: 1,
      totalReadCount: 2,
    });
  });

  it("applies filters before exact loaded-read coverage and display sampling", () => {
    const track = parseSequenceTrack({
      content: Array.from(
        { length: 20 },
        (_, index) =>
          `r${index}\t0\tchr1\t1\t${index < 10 ? 60 : 255}\t4M\t*\t0\t0\tACGT\tIIII`,
      ).join("\n"),
      displayName: "filtered.sam",
      format: "sam",
      id: "filtered",
      requestedReference: "chr1",
    });
    const filters = {
      ...DEFAULT_READ_PILEUP_FILTERS,
      minimumMappingQuality: 30,
      includeUnknownMappingQuality: false,
    };
    const window = buildEvidenceWindow({
      start: 1,
      end: 5,
      maxReads: 2,
      reference: "chr1",
      tracks: [track],
      readFilter: (read) => readPassesPileupFilters(read, filters),
    });
    expect(window).toMatchObject({
      coverageComplete: true,
      coverageReadCount: 10,
      filteredReadCount: 10,
      totalReadCount: 20,
      sampledReadCount: 2,
      downsampled: true,
    });
    expect(window.coverage.map((point) => point.depth)).toEqual([
      10, 10, 10, 10, 0,
    ]);
  });

  it("rejects malformed coordinate and oversized-window requests", () => {
    expect(() => parseAnnotationTrack("chr1\t10\t5\n", "bed")).toThrow(
      "empty or reversed",
    );
    expect(() =>
      buildEvidenceWindow({
        end: 100_001,
        reference: "chr1",
        start: 1,
        tracks: [],
      }),
    ).toThrow("100,000 bases");
  });

  it("reports partial coverage when cumulative CIGAR work exceeds the processing budget", () => {
    const track = parseSequenceTrack({
      content: `read\t0\tchr1\t1\t60\t${"1M".repeat(1_000)}\t*\t0\t0\t${"A".repeat(1_000)}\t*`,
      displayName: "complex.sam",
      format: "sam",
      id: "complex",
      requestedReference: "chr1",
    });
    const read = track.reads?.[0];
    if (read == null) throw new Error("Expected a read fixture.");
    track.reads = Array.from({ length: 1_001 }, (_, index) => ({
      ...read,
      id: `read${index}`,
    }));
    track.summary.itemCount = 1_001;
    const window = buildEvidenceWindow({
      start: 1,
      end: 2,
      reference: "chr1",
      tracks: [track],
    });
    expect(window).toMatchObject({
      coverageBudgetExceeded: true,
      coverageComplete: false,
      coverageOmittedReadCount: 1,
      coverageReadCount: 1_000,
      totalReadCount: 1_001,
    });
    expect(window.coverage).toEqual([
      { coordinate: 1, depth: 1_000 },
      { coordinate: 2, depth: 1_000 },
    ]);
  });
});

function buildMinimalBam(): Uint8Array {
  const headerText = "@HD\tVN:1.6\n@SQ\tSN:chr1\tLN:100\n";
  const referenceName = new TextEncoder().encode("chr1\0");
  const readName = new TextEncoder().encode("read1\0");
  const blockSize = 32 + readName.length + 4 + 2 + 4;
  const bytes = new Uint8Array(
    4 +
      4 +
      headerText.length +
      4 +
      4 +
      referenceName.length +
      4 +
      4 +
      blockSize,
  );
  const view = new DataView(bytes.buffer);
  let offset = 0;
  bytes.set([0x42, 0x41, 0x4d, 0x01], offset);
  offset += 4;
  view.setInt32(offset, headerText.length, true);
  offset += 4;
  bytes.set(new TextEncoder().encode(headerText), offset);
  offset += headerText.length;
  view.setInt32(offset, 1, true);
  offset += 4;
  view.setInt32(offset, referenceName.length, true);
  offset += 4;
  bytes.set(referenceName, offset);
  offset += referenceName.length;
  view.setInt32(offset, 100, true);
  offset += 4;
  view.setInt32(offset, blockSize, true);
  offset += 4;
  view.setInt32(offset, 0, true);
  view.setInt32(offset + 4, 9, true);
  view.setUint32(offset + 8, (60 << 8) | readName.length, true);
  view.setUint32(offset + 12, 1, true);
  view.setInt32(offset + 16, 4, true);
  view.setInt32(offset + 20, -1, true);
  view.setInt32(offset + 24, -1, true);
  view.setInt32(offset + 28, 0, true);
  offset += 32;
  bytes.set(readName, offset);
  offset += readName.length;
  view.setUint32(offset, (4 << 4) | 0, true);
  offset += 4;
  bytes.set([0x12, 0x48], offset);
  offset += 2;
  bytes.set([30, 31, 32, 33], offset);
  return bytes;
}
