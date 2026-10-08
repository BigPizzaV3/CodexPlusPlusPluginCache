import { describe, expect, it } from "vitest";

import {
  queuedSequenceViewerCommandSchema,
  sequenceViewerControlInputSchema,
  sequenceViewerControlToolInputSchema,
} from "./viewer-commands";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("sequence viewer command schemas", () => {
  it.each([
    { action: "clear_alignment_selection", sessionId },
    { action: "clear_sequence_selection", sessionId },
    { action: "compute_alignment_guide_tree", sessionId },
    { action: "filter_alignment_rows", query: "KRAS", sessionId },
    { action: "focus_alignment_cell", column: 4, row: "KRAS", sessionId },
    {
      action: "focus_alignment_reference_coordinate",
      coordinate: 12,
      sessionId,
    },
    {
      action: "focus_sequence_coordinate",
      coordinate: 12,
      record: "query",
      sessionId,
    },
    { action: "navigate_alignment_search_hit", direction: "next", sessionId },
    {
      action: "navigate_sequence_search_hit",
      direction: "previous",
      sessionId,
    },
    { action: "reset_alignment_view", sessionId },
    { action: "search_alignment", query: "GxxxxGKS", sessionId },
    { action: "search_sequence", query: "GGT", sessionId },
    { action: "select_alignment_columns", end: 25, sessionId, start: 20 },
    {
      action: "select_sequence_range",
      end: 18,
      sessionId,
      start: 12,
      wraparound: false,
    },
    {
      action: "select_sequence_feature",
      featureId: "cds-1",
      record: "query",
      sessionId,
    },
    {
      action: "set_alignment_row_visibility",
      rows: ["KRAS", "NRAS"],
      sessionId,
      visible: false,
    },
    { action: "set_alignment_reference", reference: "consensus", sessionId },
    {
      action: "set_alignment_view_options",
      cellWidth: 24,
      colorMode: "protein-similarity",
      sessionId,
    },
    { action: "set_display_mode", displayMode: "fullscreen", sessionId },
    { action: "set_mode", mode: "alignment", sessionId },
    { action: "set_sequence_record", record: "query", sessionId },
    {
      action: "set_sequence_view_options",
      geneticCodeId: 11,
      layout: "split",
      orientation: "reverse-complement",
      palette: "rasmol",
      sessionId,
      synchronizedViews: false,
      wrapWidth: 80,
    },
    { action: "set_toolbar_visibility", sessionId, visible: false },
    { action: "show_all_alignment_rows", sessionId },
  ])("accepts the complete $action contract", (command) => {
    expect(sequenceViewerControlInputSchema.safeParse(command).success).toBe(
      true,
    );
  });

  it.each([
    "muted-amino-acid",
    "muted-nucleic-acid",
    "neutral",
    "ncbi-nucleic-acid",
    "jalview-nucleotide",
  ])(
    "preserves the %s palette through MCP and queued command validation",
    (palette) => {
      const input = {
        action: "set_sequence_view_options",
        palette,
        sessionId,
      };
      const parsed = sequenceViewerControlToolInputSchema.strict().parse(input);
      expect(sequenceViewerControlInputSchema.parse(parsed)).toEqual(input);
      expect(
        queuedSequenceViewerCommandSchema.parse({
          action: input.action,
          commandId: sessionId,
          palette,
          revision: 1,
        }),
      ).toMatchObject({ action: input.action, palette });
    },
  );

  it.each(["muted-nucleic-acid", "muted-amino-acid", "neutral"])(
    "preserves the %s alignment palette through MCP and queued command validation",
    (residuePalette) => {
      const input = {
        action: "set_alignment_view_options",
        residuePalette,
        sessionId,
      };
      const parsed = sequenceViewerControlToolInputSchema.strict().parse(input);
      expect(sequenceViewerControlInputSchema.parse(parsed)).toEqual(input);
      expect(
        queuedSequenceViewerCommandSchema.parse({
          action: input.action,
          commandId: sessionId,
          residuePalette,
          revision: 1,
        }),
      ).toMatchObject({ action: input.action, residuePalette });
    },
  );

  it("rejects unknown sequence and alignment palettes", () => {
    expect(
      sequenceViewerControlToolInputSchema.safeParse({
        action: "set_sequence_view_options",
        palette: "retired-palette",
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerControlInputSchema.safeParse({
        action: "set_sequence_view_options",
        palette: "retired-palette",
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerControlToolInputSchema.safeParse({
        action: "set_alignment_view_options",
        residuePalette: "retired-palette",
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerControlInputSchema.safeParse({
        action: "set_alignment_view_options",
        residuePalette: "retired-palette",
        sessionId,
      }).success,
    ).toBe(false);
  });

  it.each([
    { action: "filter_alignment_rows", query: "x".repeat(501), sessionId },
    { action: "focus_alignment_cell", row: "KRAS", sessionId },
    { action: "focus_alignment_reference_coordinate", sessionId },
    { action: "focus_sequence_coordinate", sessionId },
    { action: "navigate_alignment_search_hit", sessionId },
    { action: "navigate_sequence_search_hit", direction: "later", sessionId },
    { action: "search_sequence", sessionId },
    { action: "select_alignment_columns", start: 3, sessionId },
    { action: "select_sequence_range", end: 3, sessionId },
    { action: "select_sequence_feature", featureId: "", sessionId },
    {
      action: "set_alignment_row_visibility",
      rows: [],
      sessionId,
      visible: true,
    },
    { action: "set_alignment_reference", reference: "", sessionId },
    { action: "set_alignment_view_options", sessionId },
    { action: "set_display_mode", sessionId },
    { action: "set_mode", sessionId },
    { action: "set_sequence_record", record: "", sessionId },
    { action: "set_sequence_view_options", sessionId },
    { action: "set_toolbar_visibility", sessionId },
    { action: "set_toolbar_visibility", sessionId, visible: "false" },
    {
      action: "set_toolbar_visibility",
      sessionId: "wrong-session",
      visible: false,
    },
  ])("rejects an incomplete $action contract", (command) => {
    expect(sequenceViewerControlInputSchema.safeParse(command).success).toBe(
      false,
    );
  });

  it("requires valid queue identity and revision metadata", () => {
    expect(
      queuedSequenceViewerCommandSchema.safeParse({
        action: "search_sequence",
        commandId: sessionId,
        query: "ACGT",
        revision: 1,
      }).success,
    ).toBe(true);
    expect(
      queuedSequenceViewerCommandSchema.safeParse({
        action: "search_sequence",
        commandId: "not-a-uuid",
        query: "ACGT",
        revision: 0,
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      action: "set_workbench_panel",
      group: "sequence-tools",
      panel: "quality",
    },
    { action: "set_workbench_panel", group: "alignment-tools", panel: null },
    { action: "set_workbench_panel", group: "sequence-display", panel: "copy" },
    {
      action: "set_workbench_disclosure",
      disclosureId: "sequence.record-metadata",
      expanded: true,
    },
    {
      action: "dismiss_workbench_feedback",
      feedbackId: "sequence.copy-feedback",
    },
    {
      action: "set_read_pileup_options",
      minimumMappingQuality: 0,
      strand: "-",
      includeDuplicates: false,
      includeQcFailed: false,
      includeSecondary: false,
      includeSupplementary: true,
      includeUnknownMappingQuality: false,
      showAllBases: true,
      showSoftClips: false,
      sortBy: "mapping-quality",
    },
    { action: "select_read", trackId: "track-a", sourceReadIndex: 0 },
    { action: "clear_read_selection" },
    {
      action: "set_quality_view_options",
      distributionsExpanded: true,
      methodsExpanded: false,
      expandedTables: ["cycle-quality", "cycle-composition"],
    },
    { action: "set_quality_view_options", expandedTables: [] },
    {
      action: "set_chromatogram_view_options",
      firstBase: 11,
      basesPerWindow: 100,
    },
    {
      action: "set_sequence_record_browser",
      query: "record-a",
      page: 0,
      sortBy: "length",
      expanded: true,
    },
    {
      action: "set_sequence_annotation_index",
      query: "CDS",
      page: 1,
      expanded: true,
    },
    { action: "set_sequence_view_options", originRangeExpanded: false },
    { action: "navigate_sequence_feature", direction: "previous" },
    { action: "select_alignment_rows", rows: [] },
    { action: "select_alignment_rows", rows: ["row-a", "row-b"] },
    {
      action: "set_alignment_view_options",
      enabledMetricTracks: [],
      showSequenceLogoHelp: false,
      rowSortKey: "coverage",
      rowSortDirection: "desc",
    },
  ])(
    "preserves every new UI operation through the model-facing $action schema",
    (command) => {
      const input = { ...command, sessionId };
      const modelInput = sequenceViewerControlToolInputSchema.parse(input);
      expect(sequenceViewerControlInputSchema.parse(modelInput)).toEqual(input);
    },
  );

  it.each([
    { action: "set_workbench_panel", group: "sequence-tools" },
    { action: "set_workbench_panel", group: "unknown", panel: "inspect" },
    { action: "set_workbench_panel", group: "sequence-tools", panel: "" },
    {
      action: "set_workbench_disclosure",
      disclosureId: "sequence.record-metadata",
    },
    {
      action: "set_workbench_disclosure",
      disclosureId: "unscoped",
      expanded: true,
    },
    { action: "dismiss_workbench_feedback" },
    { action: "dismiss_workbench_feedback", feedbackId: "approve-source" },
    {
      action: "dismiss_workbench_feedback",
      feedbackId: "sequence.copy-feedback",
      approve: true,
    },
    {
      action: "set_workbench_disclosure",
      disclosureId: "sequence.record-metadata",
      expanded: false,
      approve: true,
    },
    { action: "set_read_pileup_options" },
    { action: "set_quality_view_options" },
    { action: "set_quality_view_options", expandedTables: ["unknown"] },
    { action: "set_read_pileup_options", minimumMappingQuality: 256 },
    { action: "set_read_pileup_options", sortBy: "source" },
    { action: "set_read_pileup_options", includeDuplicates: "false" },
    { action: "select_read", trackId: "track-a", sourceReadIndex: -1 },
    { action: "select_read", trackId: "track-a" },
    { action: "set_chromatogram_view_options" },
    { action: "set_chromatogram_view_options", firstBase: 0 },
    { action: "set_chromatogram_view_options", basesPerWindow: 101 },
    { action: "set_sequence_record_browser" },
    { action: "set_sequence_record_browser", page: -1 },
    { action: "set_sequence_record_browser", query: "x".repeat(501) },
    { action: "set_sequence_annotation_index" },
    { action: "set_sequence_annotation_index", page: 0.5 },
    { action: "select_alignment_rows", rows: [""] },
    {
      action: "select_alignment_rows",
      rows: Array.from({ length: 501 }, (_, index) => `row-${index}`),
    },
    {
      action: "set_alignment_view_options",
      enabledMetricTracks: ["unsupported"],
    },
    { action: "set_alignment_view_options", rowSortDirection: "reverse" },
  ])("rejects invalid or unbounded new $action options", (command) => {
    expect(
      sequenceViewerControlInputSchema.safeParse({ ...command, sessionId })
        .success,
    ).toBe(false);
  });
});
