import { describe, expect, it } from "vitest";

import { createMsaViewerModelContext } from "./msa/model-context";
import { parseMsa } from "./msa/parser";
import { createSequenceViewerModelContext } from "./sequence/model-context";
import { parseSequenceDocument } from "./sequence/parser";
import type { SequenceFeature } from "./sequence/types";

describe("scientific viewer model context limits", () => {
  it("bounds long sequence selections and overlapping feature details", () => {
    const document = parseSequenceDocument({
      contents: `>long\n${"ACGT".repeat(1_000)}\n`,
      fileName: "long.fasta",
    });
    const features: SequenceFeature[] = Array.from(
      { length: 60 },
      (_, index) => ({
        end: 3_000,
        id: `feature-${index + 1}`,
        qualifiers: {},
        start: 1,
        strand: "+",
        type: "misc_feature",
      }),
    );
    const record = { ...document.records[0]!, features };
    const context = createSequenceViewerModelContext({
      activeSearchHitIndex: 0,
      document: { ...document, records: [record] },
      hits: [],
      paletteId: "ncbi-nucleic-acid",
      query: "",
      record,
      selection: { end: 3_000, recordId: record.id, start: 1 },
      showFeatures: true,
      showQuality: false,
      showTranslation: true,
      wrapWidth: 80,
    }).structuredContent as {
      displayedRecord: { sequence: string; sequenceTruncated: boolean };
      features: { items: unknown[]; totalCount: number; truncated: boolean };
      selection: {
        featuresTruncated: boolean;
        overlappingFeatures: unknown[];
        residues: unknown[];
        sequence: string;
        sequenceTruncated: boolean;
        truncatedResidueCount: number;
      };
    };

    expect(context.displayedRecord.sequence).toHaveLength(1_024);
    expect(context.displayedRecord.sequenceTruncated).toBe(true);
    expect(context.features.items).toHaveLength(50);
    expect(context.features.totalCount).toBe(60);
    expect(context.features.truncated).toBe(true);
    expect(context.selection.sequence).toHaveLength(2_048);
    expect(context.selection.sequenceTruncated).toBe(true);
    expect(context.selection.residues).toHaveLength(50);
    expect(context.selection.truncatedResidueCount).toBe(2_950);
    expect(context.selection.overlappingFeatures).toHaveLength(50);
    expect(context.selection.featuresTruncated).toBe(true);
  });

  it("bounds alignment rows, selected columns, and coordinate maps", () => {
    const contents = Array.from({ length: 60 }, (_, index) =>
      [`>row-${index + 1}`, "ACGT".repeat(10)].join("\n"),
    ).join("\n");
    const parsed = parseMsa(contents, "/tmp/large.afa");
    if (parsed.status !== "success") {
      throw new Error(parsed.message);
    }
    const context = createMsaViewerModelContext({
      analysis: null,
      analysisScope: "all-unhidden-rows",
      anchorRowId: null,
      cellWidth: 24,
      colorMode: "residue",
      document: parsed.document,
      focusedCell: null,
      motifHits: [],
      motifQuery: "",
      referenceLabel: "Consensus",
      referenceMode: "consensus",
      residuePalette: null,
      rowFilter: "",
      searchScope: "all-unhidden-rows",
      selectedColumnRange: { end: 20, start: 0 },
      selectedHit: null,
      showAnnotationTracks: true,
      showIdenticalAsDots: false,
      showRnaStructureOverlays: true,
      slice: {
        columnEnd: 40,
        columnStart: 0,
        rowEnd: 60,
        rowStart: 0,
        visibleColumnCount: 40,
        visibleColumnEnd: 40,
        visibleColumnStart: 0,
        visibleRowEnd: 60,
        visibleRowStart: 0,
      },
      visibleRows: parsed.document.rows,
    }).structuredContent as {
      display: { visibleRowIds: string[]; visibleRowIdsTruncated: boolean };
      rowCoordinateMaps: unknown[];
      selection: {
        columns: Array<{ rows: unknown[] }>;
        truncatedColumnCount: number;
        truncatedRowCount: number;
      };
    };

    expect(context.display.visibleRowIds).toHaveLength(50);
    expect(context.display.visibleRowIdsTruncated).toBe(true);
    expect(context.selection.columns).toHaveLength(12);
    expect(context.selection.columns[0]?.rows).toHaveLength(50);
    expect(context.selection.truncatedColumnCount).toBe(8);
    expect(context.selection.truncatedRowCount).toBe(10);
    expect(context.rowCoordinateMaps).toHaveLength(12);
  });

  it("distinguishes summarized FASTQ records from retained inspectable records", () => {
    const document = parseSequenceDocument({
      contents: "@read\nACGT\n+\nIIII\n",
      fileName: "reads.fastq",
    });
    const record = document.records[0]!;
    const context = createSequenceViewerModelContext({
      activeSearchHitIndex: 0,
      document: {
        ...document,
        recordInventory: {
          materializedCount: 1,
          totalCount: 6_000,
          truncated: true,
        },
      },
      hits: [],
      paletteId: "ncbi-nucleic-acid",
      query: "",
      record,
      showFeatures: true,
      showQuality: true,
      showTranslation: false,
      wrapWidth: 60,
    }).structuredContent as {
      displayedRecord: { materializedRecordCount: number; recordCount: number };
      sequenceRecords: {
        materializedCount: number;
        totalCount: number;
        truncated: boolean;
      };
    };

    expect(context.displayedRecord).toMatchObject({
      materializedRecordCount: 1,
      recordCount: 6_000,
    });
    expect(context.sequenceRecords).toMatchObject({
      materializedCount: 1,
      totalCount: 6_000,
      truncated: true,
    });
  });
});
