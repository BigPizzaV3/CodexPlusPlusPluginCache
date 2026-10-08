import { z } from "zod";

import {
  sequenceViewerOperationCommandSchema,
  sequenceWorkbenchPanelGroupSchema,
} from "./viewer-operations";

export const SEQUENCE_VIEWER_CONTROL_TOOL_NAME = "sequence.control_viewer";
export const SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME =
  "sequence.register_viewer_session";
export const SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME =
  "sequence.wait_for_viewer_command";
export const SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME =
  "sequence.complete_viewer_command";

const sequenceViewerActionSchema = z.enum([
  "clear_alignment_selection",
  "clear_read_selection",
  "clear_sequence_selection",
  "compute_alignment_guide_tree",
  "dismiss_workbench_feedback",
  "filter_alignment_rows",
  "focus_alignment_cell",
  "focus_alignment_reference_coordinate",
  "focus_sequence_coordinate",
  "navigate_alignment_search_hit",
  "navigate_sequence_search_hit",
  "navigate_sequence_feature",
  "reset_alignment_view",
  "search_alignment",
  "search_sequence",
  "select_alignment_columns",
  "select_alignment_rows",
  "select_read",
  "select_sequence_feature",
  "select_sequence_range",
  "set_alignment_reference",
  "set_alignment_row_visibility",
  "set_alignment_view_options",
  "set_chromatogram_view_options",
  "set_display_mode",
  "set_mode",
  "set_quality_view_options",
  "set_read_pileup_options",
  "set_sequence_annotation_index",
  "set_sequence_record",
  "set_sequence_record_browser",
  "set_sequence_view_options",
  "set_toolbar_visibility",
  "set_workbench_panel",
  "set_workbench_disclosure",
  "show_all_alignment_rows",
]);

const metricTrackSchema = z.enum([
  "gap",
  "identity",
  "mismatch",
  "modality-conservation",
  "rna-structure",
  "sequence-logo",
]);
const alignmentRowSortKeySchema = z.enum([
  "coverage",
  "identity",
  "label",
  "length",
  "mismatches",
  "source",
]);
const qualityTableSchema = z.enum([
  "cycle-quality",
  "cycle-composition",
  "read-length",
  "read-gc",
  "read-mean-quality",
  "repeated-sequences",
  "frequent-kmers",
]);

function hasControlOption(command: Record<string, unknown>): boolean {
  return Object.entries(command).some(
    ([key, value]) => key !== "action" && value !== undefined,
  );
}

export const sequenceViewerControlCommandSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("clear_alignment_selection"),
    }),
    z.object({ action: z.literal("clear_read_selection") }).strict(),
    z.object({
      action: z.literal("clear_sequence_selection"),
    }),
    z.object({
      action: z.literal("compute_alignment_guide_tree"),
    }),
    z
      .object({
        action: z.literal("dismiss_workbench_feedback"),
        feedbackId: z
          .string()
          .max(128)
          .regex(/^(?:alignment|sequence)\.[a-z0-9][a-z0-9.-]*$/u),
      })
      .strict(),
    z.object({
      action: z.literal("filter_alignment_rows"),
      query: z.string().max(500),
    }),
    z.object({
      action: z.literal("focus_alignment_cell"),
      column: z.number().int().positive(),
      row: z.string().trim().min(1).max(500),
    }),
    z.object({
      action: z.literal("focus_alignment_reference_coordinate"),
      coordinate: z.number().int().positive(),
    }),
    z.object({
      action: z.literal("focus_sequence_coordinate"),
      coordinate: z.number().int().positive(),
      record: z.string().trim().min(1).max(500).optional(),
    }),
    z.object({
      action: z.literal("navigate_alignment_search_hit"),
      direction: z.enum(["next", "previous"]),
    }),
    z.object({
      action: z.literal("navigate_sequence_search_hit"),
      direction: z.enum(["next", "previous"]),
    }),
    z
      .object({
        action: z.literal("navigate_sequence_feature"),
        direction: z.enum(["next", "previous"]),
      })
      .strict(),
    z.object({
      action: z.literal("reset_alignment_view"),
    }),
    z.object({
      action: z.literal("search_alignment"),
      query: z.string().max(500),
    }),
    z.object({
      action: z.literal("search_sequence"),
      query: z.string().max(500),
      record: z.string().trim().min(1).max(500).optional(),
    }),
    z.object({
      action: z.literal("select_alignment_columns"),
      end: z.number().int().positive(),
      start: z.number().int().positive(),
    }),
    z
      .object({
        action: z.literal("select_alignment_rows"),
        rows: z.array(z.string().trim().min(1).max(500)).max(500),
      })
      .strict(),
    z
      .object({
        action: z.literal("select_read"),
        sourceReadIndex: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Zero-based index into the currently loaded track.reads array, not a SAM line or BAM/CRAM file ordinal. Use the identity returned by query_viewer reads.",
          ),
        trackId: z.string().trim().min(1).max(500),
      })
      .strict(),
    z.object({
      action: z.literal("select_sequence_range"),
      end: z.number().int().positive(),
      record: z.string().trim().min(1).max(500).optional(),
      start: z.number().int().positive(),
      wraparound: z.boolean().optional(),
    }),
    z.object({
      action: z.literal("select_sequence_feature"),
      featureId: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .describe(
          "Exact generated feature ID or a unique case-insensitive biological type, label, or qualifier value such as CDS or kinase domain.",
        ),
      record: z.string().trim().min(1).max(500).optional(),
    }),
    z.object({
      action: z.literal("set_alignment_row_visibility"),
      rows: z.array(z.string().trim().min(1).max(500)).min(1).max(200),
      visible: z.boolean(),
    }),
    z.object({
      action: z.literal("set_alignment_reference"),
      reference: z.string().trim().min(1).max(500),
    }),
    z
      .object({
        action: z.literal("set_alignment_view_options"),
        analysisScope: z
          .enum(["all-unhidden-rows", "currently-displayed-rows"])
          .optional(),
        cellWidth: z.number().int().min(16).max(42).optional(),
        enabledMetricTracks: z.array(metricTrackSchema).max(6).optional(),
        colorMode: z
          .enum([
            "coding-impact",
            "difference",
            "identity",
            "nucleotide-substitution",
            "protein-conservation",
            "protein-similarity",
            "residue",
          ])
          .optional(),
        moleculeType: z
          .enum([
            "dna",
            "mixed",
            "nucleic-acid-ambiguous",
            "protein",
            "rna",
            "unknown",
          ])
          .optional(),
        residuePalette: z
          .enum([
            "clustal-x",
            "hydrophobicity",
            "jalview-nucleotide",
            "muted-amino-acid",
            "muted-nucleic-acid",
            "ncbi-nucleic-acid",
            "neutral",
            "nucleotide-ambiguity",
            "purine-pyrimidine",
            "rasmol",
            "zappo",
          ])
          .optional(),
        rowSortDirection: z.enum(["asc", "desc"]).optional(),
        rowSortKey: alignmentRowSortKeySchema.optional(),
        searchScope: z
          .enum(["all-unhidden-rows", "currently-displayed-rows"])
          .optional(),
        showAnnotationTracks: z.boolean().optional(),
        showIdenticalAsDots: z.boolean().optional(),
        showRnaStructureOverlays: z.boolean().optional(),
        showSequenceLogoHelp: z.boolean().optional(),
      })
      .refine(
        ({
          analysisScope,
          cellWidth,
          colorMode,
          enabledMetricTracks,
          moleculeType,
          residuePalette,
          rowSortDirection,
          rowSortKey,
          searchScope,
          showAnnotationTracks,
          showIdenticalAsDots,
          showRnaStructureOverlays,
          showSequenceLogoHelp,
        }) =>
          [
            analysisScope,
            cellWidth,
            colorMode,
            enabledMetricTracks,
            moleculeType,
            residuePalette,
            rowSortDirection,
            rowSortKey,
            searchScope,
            showAnnotationTracks,
            showIdenticalAsDots,
            showRnaStructureOverlays,
            showSequenceLogoHelp,
          ].some((value) => value != null),
        "set_alignment_view_options requires at least one option.",
      ),
    z
      .object({
        action: z.literal("set_chromatogram_view_options"),
        basesPerWindow: z.number().int().min(1).max(100).optional(),
        firstBase: z.number().int().positive().optional(),
      })
      .strict()
      .refine(
        hasControlOption,
        "set_chromatogram_view_options requires at least one option.",
      ),
    z.object({
      action: z.literal("set_display_mode"),
      displayMode: z.enum(["fullscreen", "inline"]),
    }),
    z.object({
      action: z.literal("set_mode"),
      mode: z.enum(["alignment", "sequence"]),
    }),
    z
      .object({
        action: z.literal("set_quality_view_options"),
        distributionsExpanded: z.boolean().optional(),
        expandedTables: z.array(qualityTableSchema).max(7).optional(),
        methodsExpanded: z.boolean().optional(),
      })
      .strict()
      .refine(
        hasControlOption,
        "set_quality_view_options requires at least one option.",
      ),
    z
      .object({
        action: z.literal("set_read_pileup_options"),
        includeDuplicates: z.boolean().optional(),
        includeQcFailed: z.boolean().optional(),
        includeSecondary: z.boolean().optional(),
        includeSupplementary: z.boolean().optional(),
        includeUnknownMappingQuality: z.boolean().optional(),
        minimumMappingQuality: z.number().int().min(0).max(255).optional(),
        showAllBases: z.boolean().optional(),
        showSoftClips: z.boolean().optional(),
        sortBy: z.enum(["position", "mapping-quality", "strand"]).optional(),
        strand: z.enum(["all", "+", "-"]).optional(),
      })
      .strict()
      .refine(
        hasControlOption,
        "set_read_pileup_options requires at least one option.",
      ),
    z
      .object({
        action: z.literal("set_sequence_annotation_index"),
        expanded: z.boolean().optional(),
        page: z.number().int().nonnegative().optional(),
        query: z.string().max(500).optional(),
      })
      .strict()
      .refine(
        hasControlOption,
        "set_sequence_annotation_index requires at least one option.",
      ),
    z.object({
      action: z.literal("set_sequence_record"),
      record: z.string().trim().min(1).max(500),
    }),
    z
      .object({
        action: z.literal("set_sequence_record_browser"),
        expanded: z.boolean().optional(),
        page: z.number().int().nonnegative().optional(),
        query: z.string().max(500).optional(),
        sortBy: z.enum(["source", "label", "length", "molecule"]).optional(),
      })
      .strict()
      .refine(
        hasControlOption,
        "set_sequence_record_browser requires at least one option.",
      ),
    z
      .object({
        action: z.literal("set_sequence_view_options"),
        geneticCodeId: z.number().int().positive().optional(),
        layout: z.enum(["circular", "linear", "split"]).optional(),
        orientation: z.enum(["forward", "reverse-complement"]).optional(),
        originRangeExpanded: z.boolean().optional(),
        palette: z
          .enum([
            "clustal-x",
            "hydrophobicity",
            "jalview-nucleotide",
            "muted-amino-acid",
            "muted-nucleic-acid",
            "ncbi-nucleic-acid",
            "neutral",
            "nucleotide-ambiguity",
            "purine-pyrimidine",
            "rasmol",
            "zappo",
          ])
          .optional(),
        showFeatures: z.boolean().optional(),
        showQuality: z.boolean().optional(),
        showTranslation: z.boolean().optional(),
        synchronizedViews: z.boolean().optional(),
        wrapWidth: z
          .union([z.literal(40), z.literal(50), z.literal(60), z.literal(80)])
          .optional(),
      })
      .refine(
        ({
          geneticCodeId,
          layout,
          orientation,
          originRangeExpanded,
          palette,
          showFeatures,
          showQuality,
          showTranslation,
          synchronizedViews,
          wrapWidth,
        }) =>
          [
            geneticCodeId,
            layout,
            orientation,
            originRangeExpanded,
            palette,
            showFeatures,
            showQuality,
            showTranslation,
            synchronizedViews,
            wrapWidth,
          ].some((value) => value != null),
        "set_sequence_view_options requires at least one option.",
      ),
    z.object({
      action: z.literal("set_toolbar_visibility"),
      visible: z.boolean(),
    }),
    z
      .object({
        action: z.literal("set_workbench_panel"),
        group: sequenceWorkbenchPanelGroupSchema,
        panel: z.string().trim().min(1).max(100).nullable(),
      })
      .strict(),
    z
      .object({
        action: z.literal("set_workbench_disclosure"),
        disclosureId: z
          .string()
          .max(128)
          .regex(/^(?:alignment|sequence)\.[a-z0-9][a-z0-9.-]*$/u),
        expanded: z.boolean(),
      })
      .strict(),
    z.object({
      action: z.literal("show_all_alignment_rows"),
    }),
  ],
);

export const sequenceViewerCommandSchema = z.union([
  sequenceViewerControlCommandSchema,
  sequenceViewerOperationCommandSchema,
]);

export const sequenceViewerControlInputSchema = z
  .object({
    sessionId: z
      .string()
      .uuid()
      .describe("Active viewer session ID from the viewer's model context."),
  })
  .passthrough()
  .transform((input, context) => {
    const { sessionId, ...candidate } = input;
    const parsed = sequenceViewerControlCommandSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }
      return z.NEVER;
    }
    return { ...parsed.data, sessionId };
  });

// MCP tool registration accepts an object shape. Keep this discoverable shape
// broad, then apply the action-specific discriminated union in the handler.
export const sequenceViewerControlToolInputSchema = z.object({
  action: sequenceViewerActionSchema,
  analysisScope: z
    .enum(["all-unhidden-rows", "currently-displayed-rows"])
    .optional(),
  cellWidth: z.number().int().min(16).max(42).optional(),
  basesPerWindow: z.number().int().min(1).max(100).optional(),
  colorMode: z
    .enum([
      "coding-impact",
      "difference",
      "identity",
      "nucleotide-substitution",
      "protein-conservation",
      "protein-similarity",
      "residue",
    ])
    .optional(),
  column: z.number().int().positive().optional(),
  coordinate: z.number().int().positive().optional(),
  direction: z.enum(["next", "previous"]).optional(),
  displayMode: z.enum(["fullscreen", "inline"]).optional(),
  disclosureId: z
    .string()
    .max(128)
    .regex(/^(?:alignment|sequence)\.[a-z0-9][a-z0-9.-]*$/u)
    .describe(
      "Exact registered ID returned by query_viewer target workbench-disclosures; expanding reveals its parent tool and sections.",
    )
    .optional(),
  distributionsExpanded: z.boolean().optional(),
  end: z.number().int().positive().optional(),
  enabledMetricTracks: z.array(metricTrackSchema).max(6).optional(),
  expanded: z.boolean().optional(),
  expandedTables: z.array(qualityTableSchema).max(7).optional(),
  firstBase: z.number().int().positive().optional(),
  feedbackId: z
    .string()
    .max(128)
    .regex(/^(?:alignment|sequence)\.[a-z0-9][a-z0-9.-]*$/u)
    .describe(
      "Exact registered copy or session-error feedback ID from query target workbench-feedback. This cannot approve, cancel, or confirm source writes.",
    )
    .optional(),
  featureId: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "Exact generated feature ID or a unique case-insensitive biological type, label, or qualifier value such as CDS or kinase domain.",
    )
    .optional(),
  geneticCodeId: z.number().int().positive().optional(),
  group: sequenceWorkbenchPanelGroupSchema.optional(),
  includeDuplicates: z.boolean().optional(),
  includeQcFailed: z.boolean().optional(),
  includeSecondary: z.boolean().optional(),
  includeSupplementary: z.boolean().optional(),
  includeUnknownMappingQuality: z.boolean().optional(),
  layout: z.enum(["circular", "linear", "split"]).optional(),
  mode: z.enum(["alignment", "sequence"]).optional(),
  methodsExpanded: z.boolean().optional(),
  minimumMappingQuality: z.number().int().min(0).max(255).optional(),
  moleculeType: z
    .enum([
      "dna",
      "mixed",
      "nucleic-acid-ambiguous",
      "protein",
      "rna",
      "unknown",
    ])
    .optional(),
  orientation: z.enum(["forward", "reverse-complement"]).optional(),
  originRangeExpanded: z.boolean().optional(),
  page: z.number().int().nonnegative().optional(),
  panel: z.string().trim().min(1).max(100).nullable().optional(),
  palette: z
    .enum([
      "clustal-x",
      "hydrophobicity",
      "jalview-nucleotide",
      "muted-amino-acid",
      "muted-nucleic-acid",
      "ncbi-nucleic-acid",
      "neutral",
      "nucleotide-ambiguity",
      "purine-pyrimidine",
      "rasmol",
      "zappo",
    ])
    .describe(
      "Single-sequence palette ID. Defaults are muted-nucleic-acid (Soft nucleotide) for DNA/RNA and muted-amino-acid (Soft amino acid) for proteins; neutral selects Monochrome. Query sequence-ui-state for the active record's palette options. Use residuePalette for alignments.",
    )
    .optional(),
  query: z.string().max(500).optional(),
  record: z.string().trim().min(1).max(500).optional(),
  reference: z.string().trim().min(1).max(500).optional(),
  residuePalette: z
    .enum([
      "clustal-x",
      "hydrophobicity",
      "jalview-nucleotide",
      "muted-amino-acid",
      "muted-nucleic-acid",
      "ncbi-nucleic-acid",
      "neutral",
      "nucleotide-ambiguity",
      "purine-pyrimidine",
      "rasmol",
      "zappo",
    ])
    .describe(
      "Alignment residue palette ID: muted-nucleic-acid for DNA/RNA, muted-amino-acid for proteins, or neutral for Monochrome. Existing scientific palettes remain available; the mounted viewer validates molecule compatibility.",
    )
    .optional(),
  row: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "Single alignment row ID or label; use only with focus_alignment_cell.",
    )
    .optional(),
  rows: z
    .array(z.string().trim().min(1).max(500))
    .max(500)
    .describe(
      "Alignment row IDs or unique labels; required with set_alignment_row_visibility (1–200 rows), even for one row. select_alignment_rows accepts 0–500, where an empty list clears the selection.",
    )
    .optional(),
  rowSortDirection: z.enum(["asc", "desc"]).optional(),
  rowSortKey: alignmentRowSortKeySchema.optional(),
  searchScope: z
    .enum(["all-unhidden-rows", "currently-displayed-rows"])
    .optional(),
  sessionId: z
    .string()
    .uuid()
    .describe("Active viewer session ID returned by sequence.open_from_chat."),
  showAnnotationTracks: z.boolean().optional(),
  showAllBases: z.boolean().optional(),
  showFeatures: z.boolean().optional(),
  showIdenticalAsDots: z.boolean().optional(),
  showQuality: z.boolean().optional(),
  showRnaStructureOverlays: z.boolean().optional(),
  showSequenceLogoHelp: z.boolean().optional(),
  showSoftClips: z.boolean().optional(),
  showTranslation: z.boolean().optional(),
  start: z.number().int().positive().optional(),
  sortBy: z
    .enum([
      "source",
      "label",
      "length",
      "molecule",
      "position",
      "mapping-quality",
      "strand",
    ])
    .optional(),
  sourceReadIndex: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Zero-based index into the currently materialized loaded track.reads array; not a file ordinal, line number, or byte offset.",
    )
    .optional(),
  strand: z.enum(["all", "+", "-"]).optional(),
  synchronizedViews: z.boolean().optional(),
  visible: z.boolean().optional(),
  trackId: z.string().trim().min(1).max(500).optional(),
  wrapWidth: z
    .union([z.literal(40), z.literal(50), z.literal(60), z.literal(80)])
    .optional(),
  wraparound: z
    .boolean()
    .describe(
      "For select_sequence_range on a circular record, follow start through the origin to end. Start must be greater than end.",
    )
    .optional(),
});

export type SequenceViewerCommand = z.infer<typeof sequenceViewerCommandSchema>;
export type SequenceViewerControlCommand = z.infer<
  typeof sequenceViewerControlCommandSchema
>;
export type SequenceViewerCommandAction = SequenceViewerCommand["action"];
export type QueuedSequenceViewerCommand = SequenceViewerCommand & {
  commandId: string;
  revision: number;
};

export const queuedSequenceViewerCommandSchema: z.ZodType<QueuedSequenceViewerCommand> =
  z
    .object({
      action: z.string(),
      commandId: z.string().uuid(),
      revision: z.number().int().positive(),
    })
    .passthrough()
    .transform((value, context) => {
      const { commandId, revision, ...candidate } = value;
      const parsed = sequenceViewerCommandSchema.safeParse(candidate);
      if (!parsed.success) {
        context.addIssue({
          code: "custom",
          message: parsed.error.issues.map(({ message }) => message).join("; "),
        });
        return z.NEVER;
      }
      return { ...parsed.data, commandId, revision };
    });

export type SequenceViewerCommandResult = {
  applied: boolean;
  message: string;
  state?: Record<string, unknown>;
};
