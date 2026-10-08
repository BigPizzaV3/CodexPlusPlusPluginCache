import { describe, expect, it } from "vitest";

import { createSequenceViewerModelContext } from "./model-context";
import { parseSequenceDocument } from "./parser";
import { parseSequenceTrack } from "./tracks";

describe("sequence evidence model-context privacy", () => {
  it.each([
    {
      name: "forward exons",
      segments: [
        { start: 1, end: 3 },
        { start: 7, end: 9 },
      ],
      sequence: "ACGGTA",
      topology: "linear" as const,
      wraparound: false,
    },
    {
      name: "reverse-ordered exons",
      segments: [
        { start: 7, end: 9 },
        { start: 1, end: 3 },
      ],
      sequence: "GTAACG",
      topology: "linear" as const,
      wraparound: false,
    },
    {
      name: "circular origin-spanning range",
      segments: [
        { start: 10, end: 12 },
        { start: 1, end: 3 },
      ],
      sequence: "CGTACG",
      topology: "circular" as const,
      wraparound: true,
    },
  ])(
    "keeps $name distinct from a continuous interval",
    ({ segments, sequence, topology, wraparound }) => {
      const document = parseSequenceDocument({
        contents: ">QA_SEGMENT_GEOMETRY\nACGTACGTACGT\n",
        fileName: "QA_SEGMENT_GEOMETRY.fasta",
      });
      const source = document.records[0];
      const first = segments[0];
      const last = segments.at(-1);
      if (source == null || first == null || last == null)
        throw new Error("Expected bounded segment fixture.");
      const record = { ...source, topology };
      const update = createSequenceViewerModelContext({
        activeSearchHitIndex: 0,
        document: { ...document, records: [record] },
        hits: [],
        paletteId: "ncbi-nucleic-acid",
        query: "",
        record,
        selection: {
          recordId: record.id,
          start: first.start,
          end: last.end,
          segments,
        },
        showFeatures: true,
        showQuality: false,
        showTranslation: false,
        wrapWidth: 60,
      });

      expect(update.structuredContent).toMatchObject({
        selection: {
          discontinuous: true,
          length: 6,
          segments,
          sequence,
          wraparound,
        },
      });
      expect(update.text).toContain(
        wraparound ? "origin-spanning" : "discontinuous",
      );
      if (!wraparound) expect(update.text).not.toContain("origin-spanning");
    },
  );

  it("keeps 100 VCF sample identifiers, genotypes, and headers out of model context", () => {
    const document = parseSequenceDocument({
      contents: ">1\nACGTACGTACGT\n",
      fileName: "public-chromosome-1.fasta",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected a public chromosome record.");

    const sampleNames = Array.from(
      { length: 100 },
      (_, index) => `QA_PRIVATE_SAMPLE_${index + 1}`,
    );
    const sampleValues = sampleNames.map(
      (_, index) => `0/1:${index + 20}:PRIVATE_GENOTYPE_${index + 1}`,
    );
    const track = parseSequenceTrack({
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
          "rs-public",
          "A",
          "G",
          ".",
          ".",
          "AC=1",
          "GT:DP:QA",
          ...sampleValues,
        ].join("\t"),
      ].join("\n"),
      displayName: "official-100-sample-conformance.vcf",
      format: "vcf",
      id: "public-vcf-track",
      requestedReference: "1",
    });

    expect(track.vcfHeader?.sampleNames).toHaveLength(100);
    expect(track.variants?.[0]?.sampleValues).toEqual(sampleValues);

    const update = createSequenceViewerModelContext({
      activeSearchHitIndex: 0,
      document,
      hits: [],
      paletteId: "ncbi-nucleic-acid",
      query: "",
      record,
      showFeatures: true,
      showQuality: false,
      showTranslation: false,
      tracks: [
        Object.assign(track, {
          futurePrivateSamplePayload: "PRIVATE_FUTURE_METADATA",
        }),
      ],
      wrapWidth: 60,
    });
    const context = JSON.stringify(update.structuredContent);

    expect(context).not.toContain("QA_PRIVATE_SAMPLE_");
    expect(context).not.toContain("PRIVATE_GENOTYPE_");
    expect(context).not.toContain("PRIVATE_HEADER_METADATA");
    expect(context).not.toContain("PRIVATE_FUTURE_METADATA");
    expect(context).not.toContain("vcfHeader");
    expect(context).not.toContain("sampleValues");
    expect(update.text).not.toContain("QA_PRIVATE_SAMPLE_");
    expect(update.structuredContent).toMatchObject({
      workbench: {
        trackCount: 1,
        tracks: [
          {
            featureCount: 0,
            format: "vcf",
            id: "public-vcf-track",
            kind: "variants",
            readCount: 0,
            variantCount: 1,
          },
        ],
      },
    });
  });
});
