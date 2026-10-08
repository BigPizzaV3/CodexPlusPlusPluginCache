import { z } from "zod";

export const SEQUENCE_VIEWER_QUERY_TOOL_NAME = "sequence.query_viewer";
export const SEQUENCE_VIEWER_ANALYSIS_TOOL_NAME = "sequence.run_analysis";
export const SEQUENCE_VIEWER_ALIGN_TOOL_NAME = "sequence.align";
export const SEQUENCE_VIEWER_EDIT_TOOL_NAME = "sequence.edit_copy";
export const SEQUENCE_VIEWER_ANNOTATIONS_TOOL_NAME =
  "sequence.manage_annotations";
export const SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME = "sequence.load_track";
export const SEQUENCE_VIEWER_EXPORT_TOOL_NAME = "sequence.export_artifact";
export const SEQUENCE_VIEWER_SAVE_SESSION_TOOL_NAME = "sequence.save_session";
export const SEQUENCE_VIEWER_RESTORE_SESSION_TOOL_NAME =
  "sequence.restore_session";
export const SEQUENCE_VIEWER_CANCEL_JOB_TOOL_NAME = "sequence.cancel_job";

export function isSafeWorkbenchFileName(value: string): boolean {
  return (
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[\0\r\n]/u.test(value)
  );
}

export function isSafeWorkspaceExportRelativePath(value: string): boolean {
  const normalized = value.trim();
  if (
    normalized !== value ||
    normalized.length === 0 ||
    normalized.length > 4_096 ||
    /[\0\r\n\\:]/u.test(normalized) ||
    normalized.startsWith("/") ||
    /^[a-z]:/iu.test(normalized) ||
    /^[a-z][a-z0-9+.-]*:/iu.test(normalized) ||
    normalized.endsWith("/")
  ) {
    return false;
  }
  const segments = normalized.split("/");
  return segments.every((segment) => {
    if (segment === "..") return true;
    const windowsBase = segment.split(".")[0]?.toUpperCase() ?? "";
    return (
      segment.length > 0 &&
      segment !== "." &&
      !segment.endsWith(".") &&
      !segment.endsWith(" ") &&
      !/^(?:AUX|CON|NUL|PRN|COM[1-9]|LPT[1-9])$/u.test(windowsBase)
    );
  });
}

export function isSafeWorkspaceProvenancePath(value: string): boolean {
  return (
    value === "." ||
    (isSafeWorkspaceExportRelativePath(value) &&
      !value.split("/").includes(".."))
  );
}

export const sequenceWorkspaceExportDestinationSchema = z
  .object({
    base: z.literal("opened-source"),
    kind: z.literal("workspace"),
    relativePath: z
      .string()
      .trim()
      .min(1)
      .max(4_096)
      .refine(
        isSafeWorkspaceExportRelativePath,
        "relativePath must be a safe path relative to the opened source directory.",
      )
      .describe(
        "Destination relative to the opened source directory. Parent segments are allowed only when the server confirms containment in the same workspace root.",
      ),
  })
  .strict();

export const sequenceWorkspacePersistenceDestinationSchema =
  sequenceWorkspaceExportDestinationSchema
    .extend({
      collisionPolicy: z.enum(["exact", "next-version"]).optional(),
    })
    .strict();

export const sequenceExportDestinationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("private") }).strict(),
  sequenceWorkspaceExportDestinationSchema,
]);

export const sequencePersistenceDestinationSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("private") }).strict(),
    sequenceWorkspacePersistenceDestinationSchema,
  ],
);

const sessionIdSchema = z
  .string()
  .uuid()
  .describe("Active viewer session ID from the live viewer context.");
const pageSchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_024).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  })
  .strict();

export const sequenceWorkbenchPanelGroupSchema = z.enum([
  "alignment-tools",
  "sequence-display",
  "sequence-tools",
]);

export const sequenceViewerQueryRequestSchema = z.discriminatedUnion("target", [
  z
    .object({
      group: sequenceWorkbenchPanelGroupSchema.optional(),
      target: z.literal("workbench-panels"),
    })
    .strict(),
  pageSchema.extend({
    limit: z.number().int().min(1).max(100).default(100),
    mode: z.enum(["alignment", "sequence"]).optional(),
    target: z.literal("workbench-disclosures"),
  }),
  pageSchema.extend({
    limit: z.number().int().min(1).max(100).default(100),
    mode: z.enum(["alignment", "sequence"]).optional(),
    target: z.literal("workbench-feedback"),
  }),
  z.object({ target: z.literal("sequence-ui-state") }).strict(),
  z.object({ target: z.literal("read-pileup-state") }).strict(),
  z.object({ target: z.literal("quality-report") }).strict(),
  pageSchema
    .extend({
      end: z.number().int().positive(),
      record: z.string().trim().min(1).max(500).optional(),
      start: z.number().int().positive(),
      target: z.literal("chromatogram"),
    })
    .refine(
      ({ start, end }) => end >= start && end - start < 100,
      "Chromatogram queries require a forward window of at most 100 source bases.",
    ),
  pageSchema.extend({
    end: z.number().int().positive().optional(),
    sourceReadIndex: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Zero-based index returned by a reads query for the currently materialized loaded track; not a source-file ordinal, line number, or byte offset.",
      ),
    start: z.number().int().positive().optional(),
    target: z.literal("read-detail"),
    trackId: z.string().trim().min(1).max(500),
  }),
  pageSchema.extend({ target: z.literal("records") }),
  pageSchema.extend({
    query: z.string().trim().min(1).max(500).optional(),
    record: z.string().trim().min(1).max(500).optional(),
    target: z.literal("features"),
  }),
  z
    .object({
      end: z.number().int().positive(),
      record: z.string().trim().min(1).max(500).optional(),
      start: z.number().int().positive(),
      target: z.literal("sequence-range"),
    })
    .strict(),
  z
    .object({
      end: z.number().int().positive(),
      record: z.string().trim().min(1).max(500).optional(),
      start: z.number().int().positive(),
      target: z.literal("quality"),
    })
    .strict(),
  pageSchema.extend({ target: z.literal("rows") }),
  z
    .object({
      end: z.number().int().positive(),
      row: z.string().trim().min(1).max(500).optional(),
      start: z.number().int().positive(),
      target: z.literal("columns"),
    })
    .strict(),
  pageSchema.extend({ target: z.literal("metrics") }),
  pageSchema.extend({ target: z.literal("search-hits") }),
  pageSchema.extend({ target: z.literal("annotations") }),
  pageSchema.extend({ target: z.literal("tracks") }),
  pageSchema.extend({ target: z.literal("tree-nodes") }),
  pageSchema.extend({ target: z.literal("jobs") }),
  pageSchema.extend({ target: z.literal("artifacts") }),
  pageSchema.extend({
    end: z.number().int().positive(),
    reference: z.string().trim().min(1).max(500),
    start: z.number().int().positive(),
    target: z.literal("variants"),
  }),
  pageSchema.extend({
    end: z.number().int().positive(),
    reference: z.string().trim().min(1).max(500),
    start: z.number().int().positive(),
    target: z.literal("coverage"),
  }),
  pageSchema.extend({
    end: z.number().int().positive(),
    reference: z.string().trim().min(1).max(500),
    start: z.number().int().positive(),
    target: z.literal("reads"),
  }),
]);

export const sequenceViewerQueryInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_024).optional(),
    end: z.number().int().positive().optional(),
    group: sequenceWorkbenchPanelGroupSchema.optional(),
    limit: z.number().int().min(1).max(500).optional(),
    mode: z.enum(["alignment", "sequence"]).optional(),
    query: z.string().trim().min(1).max(500).optional(),
    record: z.string().trim().min(1).max(500).optional(),
    reference: z.string().trim().min(1).max(500).optional(),
    row: z.string().trim().min(1).max(500).optional(),
    sessionId: sessionIdSchema,
    sourceReadIndex: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Zero-based index in the loaded track.reads array, as returned by target reads; not a file position.",
      )
      .optional(),
    start: z.number().int().positive().optional(),
    target: z.enum([
      "annotations",
      "artifacts",
      "columns",
      "chromatogram",
      "coverage",
      "features",
      "jobs",
      "metrics",
      "quality",
      "quality-report",
      "read-detail",
      "read-pileup-state",
      "reads",
      "records",
      "rows",
      "search-hits",
      "sequence-range",
      "sequence-ui-state",
      "tracks",
      "tree-nodes",
      "variants",
      "workbench-panels",
      "workbench-disclosures",
      "workbench-feedback",
    ]),
    trackId: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const analysisBaseSchema = z.object({
  record: z.string().trim().min(1).max(500).optional(),
});

export const sequenceViewerAnalysisRequestSchema = z.discriminatedUnion(
  "analysis",
  [
    z
      .object({
        adapterSequence: z
          .string()
          .trim()
          .min(8)
          .max(64)
          .regex(
            /^[ACGT]+$/iu,
            "Adapter sequence must contain 8–64 A, C, G, or T bases.",
          )
          .optional(),
        analysis: z.literal("quality-report"),
      })
      .strict(),
    analysisBaseSchema.extend({ analysis: z.literal("statistics") }).strict(),
    analysisBaseSchema
      .extend({
        analysis: z.literal("translate"),
        end: z.number().int().positive().optional(),
        frame: z
          .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(-1),
            z.literal(-2),
            z.literal(-3),
          ])
          .optional(),
        geneticCodeId: z.number().int().positive().optional(),
        start: z.number().int().positive().optional(),
      })
      .strict(),
    analysisBaseSchema
      .extend({
        analysis: z.literal("find-orfs"),
        geneticCodeId: z.number().int().positive().optional(),
        includePartial: z.boolean().default(false),
        minAminoAcids: z.number().int().min(1).max(100_000).default(30),
        strands: z.enum(["+", "-", "both"]).default("both"),
      })
      .strict(),
    analysisBaseSchema
      .extend({
        analysis: z.literal("restriction-analysis"),
        circular: z.boolean().optional(),
        enzymes: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
      })
      .strict(),
    analysisBaseSchema
      .extend({
        analysis: z.literal("design-primers"),
        maxPairs: z.number().int().min(1).max(50).default(10),
        maxProductLength: z.number().int().min(20).max(100_000).default(1_500),
        minProductLength: z.number().int().min(20).max(100_000).default(80),
        targetEnd: z.number().int().positive().optional(),
        targetStart: z.number().int().positive().optional(),
      })
      .strict(),
    z
      .object({
        algorithm: z
          .enum(["neighbor-joining", "upgma"])
          .default("neighbor-joining"),
        analysis: z.literal("build-tree"),
        rowIds: z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(100)
          .optional(),
      })
      .strict(),
    z
      .object({
        analysis: z.literal("distance-matrix"),
        rowIds: z
          .array(z.string().trim().min(1).max(500))
          .min(1)
          .max(500)
          .optional(),
      })
      .strict(),
  ],
);

export const sequenceViewerAnalysisInputSchema = z
  .object({
    adapterSequence: z
      .string()
      .trim()
      .min(8)
      .max(64)
      .regex(
        /^[ACGT]+$/iu,
        "Adapter sequence must contain 8–64 A, C, G, or T bases.",
      )
      .optional(),
    algorithm: z.enum(["neighbor-joining", "upgma"]).optional(),
    analysis: z.enum([
      "build-tree",
      "design-primers",
      "distance-matrix",
      "find-orfs",
      "quality-report",
      "restriction-analysis",
      "statistics",
      "translate",
    ]),
    circular: z.boolean().optional(),
    end: z.number().int().positive().optional(),
    enzymes: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
    frame: z
      .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(-1),
        z.literal(-2),
        z.literal(-3),
      ])
      .optional(),
    geneticCodeId: z.number().int().positive().optional(),
    includePartial: z.boolean().optional(),
    maxPairs: z.number().int().min(1).max(50).optional(),
    maxProductLength: z.number().int().min(20).max(100_000).optional(),
    minAminoAcids: z.number().int().min(1).max(100_000).optional(),
    minProductLength: z.number().int().min(20).max(100_000).optional(),
    record: z.string().trim().min(1).max(500).optional(),
    rowIds: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(500)
      .optional(),
    sessionId: sessionIdSchema,
    start: z.number().int().positive().optional(),
    strands: z.enum(["+", "-", "both"]).optional(),
    targetEnd: z.number().int().positive().optional(),
    targetStart: z.number().int().positive().optional(),
  })
  .strict();

export const sequenceViewerAlignInputSchema = z
  .object({
    algorithm: z.enum(["builtin-center-star", "builtin-pairwise"]).optional(),
    recordIds: z
      .array(z.string().trim().min(1).max(500))
      .min(2)
      .max(100)
      .optional(),
    rowIds: z
      .array(z.string().trim().min(1).max(500))
      .min(2)
      .max(100)
      .optional(),
    sessionId: sessionIdSchema,
  })
  .strict()
  .superRefine(({ algorithm, recordIds, rowIds }, context) => {
    if (recordIds != null && rowIds != null) {
      context.addIssue({
        code: "custom",
        message: "Pass recordIds or rowIds, not both.",
      });
    }
    const selectedCount = recordIds?.length ?? rowIds?.length;
    if (
      algorithm === "builtin-pairwise" &&
      selectedCount != null &&
      selectedCount !== 2
    ) {
      context.addIssue({
        code: "custom",
        message: "builtin-pairwise requires exactly two selected sequences.",
      });
    }
  });

export const sequenceViewerEditRequestSchema = z.discriminatedUnion(
  "operation",
  [
    z.object({ operation: z.literal("undo") }).strict(),
    z.object({ operation: z.literal("redo") }).strict(),
    z
      .object({
        coordinate: z.number().int().positive(),
        operation: z.literal("insert-sequence"),
        record: z.string().trim().min(1).max(500).optional(),
        sequence: z.string().min(1).max(1_000_000),
      })
      .strict(),
    z
      .object({
        end: z.number().int().positive(),
        operation: z.literal("delete-sequence-range"),
        record: z.string().trim().min(1).max(500).optional(),
        start: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        end: z.number().int().positive(),
        operation: z.literal("replace-sequence-range"),
        record: z.string().trim().min(1).max(500).optional(),
        sequence: z.string().min(1).max(1_000_000),
        start: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        end: z.number().int().positive(),
        operation: z.literal("reverse-complement-range"),
        record: z.string().trim().min(1).max(500).optional(),
        start: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        newOrigin: z.number().int().positive(),
        operation: z.literal("rotate-sequence"),
        record: z.string().trim().min(1).max(500).optional(),
      })
      .strict(),
    z
      .object({
        column: z.number().int().positive(),
        operation: z.literal("add-alignment-gap"),
        row: z.string().trim().min(1).max(500),
      })
      .strict(),
    z
      .object({
        column: z.number().int().positive(),
        operation: z.literal("delete-alignment-gap"),
        row: z.string().trim().min(1).max(500),
      })
      .strict(),
    z
      .object({
        end: z.number().int().positive(),
        operation: z.literal("remove-alignment-columns"),
        start: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        minimumGapFraction: z.number().min(0).max(1),
        operation: z.literal("remove-gappy-columns"),
      })
      .strict(),
    z
      .object({
        group: z.string().trim().min(1).max(100).nullable(),
        operation: z.literal("assign-alignment-row-group"),
        rowIds: z.array(z.string().trim().min(1).max(500)).min(1).max(500),
      })
      .strict(),
    z
      .object({
        operation: z.literal("remove-alignment-rows"),
        rowIds: z.array(z.string().trim().min(1).max(500)).min(1).max(500),
      })
      .strict(),
    z
      .object({
        operation: z.literal("reorder-alignment-rows"),
        rowIds: z.array(z.string().trim().min(1).max(500)).min(1).max(500),
      })
      .strict(),
    z
      .object({
        mode: z.enum(["group", "identity-to-reference", "label", "tree"]),
        operation: z.literal("sort-alignment-rows"),
        referenceRowId: z.string().trim().min(1).max(500).optional(),
      })
      .strict(),
  ],
);

export const sequenceViewerEditInputSchema = z
  .object({
    column: z.number().int().positive().optional(),
    coordinate: z.number().int().positive().optional(),
    end: z.number().int().positive().optional(),
    group: z.string().trim().min(1).max(100).nullable().optional(),
    minimumGapFraction: z.number().min(0).max(1).optional(),
    mode: z
      .enum(["group", "identity-to-reference", "label", "tree"])
      .optional(),
    newOrigin: z.number().int().positive().optional(),
    operation: z.enum([
      "add-alignment-gap",
      "assign-alignment-row-group",
      "delete-alignment-gap",
      "delete-sequence-range",
      "insert-sequence",
      "redo",
      "remove-alignment-columns",
      "remove-alignment-rows",
      "remove-gappy-columns",
      "reorder-alignment-rows",
      "replace-sequence-range",
      "reverse-complement-range",
      "rotate-sequence",
      "sort-alignment-rows",
      "undo",
    ]),
    record: z.string().trim().min(1).max(500).optional(),
    referenceRowId: z.string().trim().min(1).max(500).optional(),
    row: z.string().trim().min(1).max(500).optional(),
    rowIds: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(500)
      .optional(),
    sequence: z.string().min(1).max(1_000_000).optional(),
    sessionId: sessionIdSchema,
    start: z.number().int().positive().optional(),
  })
  .strict();

const featureInputSchema = z
  .object({
    end: z.number().int().positive(),
    id: z.string().trim().min(1).max(500),
    label: z.string().trim().min(1).max(500).optional(),
    qualifiers: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .default({}),
    start: z.number().int().positive(),
    strand: z.enum(["+", "-", ".", "?"]).default("."),
    type: z.string().trim().min(1).max(200),
  })
  .strict();

export const sequenceViewerAnnotationsInputSchema = z
  .object({
    action: z.enum(["add", "delete", "import", "update"]),
    feature: featureInputSchema.optional(),
    featureId: z.string().trim().min(1).max(500).optional(),
    record: z.string().trim().min(1).max(500).optional(),
    sessionId: sessionIdSchema,
    trackId: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const sequenceViewerLoadTrackInputSchema = z
  .object({
    end: z
      .number()
      .int()
      .positive()
      .describe("Indexed BAM/CRAM regional end coordinate, 1-based inclusive.")
      .optional(),
    format: z.enum(["bam", "bed", "cram", "gff3", "gtf", "sam", "vcf"]),
    indexPath: z
      .string()
      .trim()
      .min(1)
      .max(4_096)
      .describe(
        "BAM BAI/CSI or CRAM CRAI path; defaults to path + .bai for BAM and path + .crai for CRAM.",
      )
      .optional(),
    path: z
      .string()
      .trim()
      .min(1)
      .max(4_096)
      .describe("Workspace evidence-track path."),
    reference: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("Exact or uniquely normalized reference/contig name.")
      .optional(),
    referencePath: z
      .string()
      .trim()
      .min(1)
      .max(4_096)
      .describe("Matching FASTA reference path required by most CRAM files.")
      .optional(),
    sessionId: sessionIdSchema,
    start: z
      .number()
      .int()
      .positive()
      .describe(
        "Indexed BAM/CRAM regional start coordinate, 1-based inclusive.",
      )
      .optional(),
  })
  .strict()
  .superRefine(({ end, format, indexPath, referencePath, start }, context) => {
    if (
      format !== "bam" &&
      format !== "cram" &&
      (indexPath != null || start != null || end != null)
    ) {
      context.addIssue({
        code: "custom",
        message: "indexPath, start, and end are indexed BAM/CRAM-only options.",
      });
    }
    if (format !== "cram" && referencePath != null) {
      context.addIssue({
        code: "custom",
        message: "referencePath is a CRAM-only option.",
      });
    }
    if (end != null && start != null && end < start) {
      context.addIssue({
        code: "custom",
        message: "Indexed evidence end must be at or after start.",
      });
    }
    if (end != null && start != null && end - start + 1 > 100_000) {
      context.addIssue({
        code: "custom",
        message: "BAM/CRAM windows are limited to 100,000 bases.",
      });
    }
  });

export const sequenceViewerExportInputSchema = z
  .object({
    destination: sequenceExportDestinationSchema
      .default({ kind: "private" })
      .describe(
        "Keep the default private artifact, or request create-new publication relative to a trusted opened workspace source.",
      ),
    format: z.enum([
      "a3m",
      "aligned-fasta",
      "bed",
      "clustal",
      "csv",
      "embl",
      "fasta",
      "fastq",
      "genbank",
      "gff3",
      "gtf",
      "json",
      "newick",
      "pdf",
      "stockholm",
      "svg",
      "tsv",
      "vcf",
    ]),
    name: z.string().trim().min(1).max(255).optional(),
    scope: z.enum(["all", "selection", "visible"]).default("all"),
    sessionId: sessionIdSchema,
  })
  .strict();

export function isWorkspaceExportNameForFormat(
  format: z.infer<typeof sequenceViewerExportInputSchema>["format"],
  name: string,
): boolean {
  const extensions: Record<
    z.infer<typeof sequenceViewerExportInputSchema>["format"],
    ReadonlyArray<string>
  > = {
    a3m: [".a3m"],
    "aligned-fasta": [".afa", ".aln", ".aln-fasta", ".fa", ".fas", ".fasta"],
    bed: [".bed"],
    clustal: [".aln", ".clustal", ".clw"],
    csv: [".csv"],
    embl: [".embl"],
    fasta: [".fa", ".faa", ".fas", ".fasta", ".fna"],
    fastq: [".fastq", ".fq"],
    genbank: [".gb", ".gbk", ".genbank"],
    gff3: [".gff", ".gff3"],
    gtf: [".gtf"],
    json: [".json"],
    newick: [".newick", ".nwk", ".tree"],
    pdf: [".pdf"],
    stockholm: [".sto", ".stk", ".stockholm"],
    svg: [".svg"],
    tsv: [".tsv"],
    vcf: [".vcf"],
  };
  const lowerName = name.toLowerCase();
  return extensions[format].some(
    (extension) =>
      lowerName.length > extension.length && lowerName.endsWith(extension),
  );
}

export const sequenceViewerSaveSessionInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(isSafeWorkbenchFileName, "name must be a basename.")
      .optional(),
    sessionId: sessionIdSchema,
  })
  .strict();

export const sequenceViewerRestoreSessionInputSchema = z
  .object({
    savedSessionId: z.string().uuid(),
    sessionId: sessionIdSchema,
  })
  .strict();

export const sequenceViewerCancelJobInputSchema = z
  .object({
    jobId: z.string().uuid(),
    sessionId: sessionIdSchema,
  })
  .strict();

export const sequenceViewerOperationCommandSchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("query_viewer"),
        request: sequenceViewerQueryRequestSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("run_analysis"),
        jobId: z.string().uuid(),
        request: sequenceViewerAnalysisRequestSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("align_sequences"),
        algorithm: z
          .enum(["builtin-center-star", "builtin-pairwise"])
          .optional(),
        jobId: z.string().uuid(),
        recordIds: z.array(z.string()).optional(),
        rowIds: z.array(z.string()).optional(),
      })
      .strict(),
    z
      .object({
        action: z.literal("edit_copy"),
        request: sequenceViewerEditRequestSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("manage_annotations"),
        request: sequenceViewerAnnotationsInputSchema.omit({ sessionId: true }),
      })
      .strict(),
    z
      .object({
        action: z.literal("load_track"),
        content: z.string().max(16 * 1_024 * 1_024),
        displayName: z.string().trim().min(1).max(1_024),
        encoding: z.enum(["base64", "utf8"]),
        format: z.enum(["bam", "bed", "cram", "gff3", "gtf", "sam", "vcf"]),
        reference: z.string().trim().min(1).max(500).optional(),
        sourceContentHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/u)
          .optional(),
        sourceItemCount: z.number().int().nonnegative().optional(),
        sourceTruncated: z.boolean().optional(),
        sourceWorkspacePath: z
          .string()
          .refine(isSafeWorkspaceProvenancePath)
          .optional(),
        trackId: z.string().uuid(),
      })
      .strict(),
    z
      .object({
        action: z.literal("export_artifact"),
        destination: sequenceExportDestinationSchema.default({
          kind: "private",
        }),
        format: sequenceViewerExportInputSchema.shape.format,
        name: z.string().trim().min(1).max(255).optional(),
        scope: sequenceViewerExportInputSchema.shape.scope,
      })
      .strict(),
    z
      .object({
        action: z.literal("save_session"),
        name: z.string().trim().min(1).max(255),
      })
      .strict(),
    z
      .object({
        action: z.literal("restore_session"),
        mode: z.enum(["alignment", "sequence"]).optional(),
        session: z.string().max(512 * 1_024),
      })
      .strict(),
    z
      .object({ action: z.literal("cancel_job"), jobId: z.string().uuid() })
      .strict(),
  ],
);

export type SequenceViewerQueryRequest = z.infer<
  typeof sequenceViewerQueryRequestSchema
>;
export type SequenceViewerAnalysisRequest = z.infer<
  typeof sequenceViewerAnalysisRequestSchema
>;
export type SequenceViewerEditRequest = z.infer<
  typeof sequenceViewerEditRequestSchema
>;
export type SequenceViewerAnnotationsInput = z.infer<
  typeof sequenceViewerAnnotationsInputSchema
>;
export type SequenceViewerAnnotationRequest = Omit<
  SequenceViewerAnnotationsInput,
  "sessionId"
>;
export type SequenceViewerOperationCommand = z.infer<
  typeof sequenceViewerOperationCommandSchema
>;
