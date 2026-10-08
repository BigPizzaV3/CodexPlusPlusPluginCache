import { describe, expect, it } from "vitest";

import { queuedSequenceViewerCommandSchema } from "./viewer-commands";
import {
  isSafeWorkspaceExportRelativePath,
  isWorkspaceExportNameForFormat,
  sequenceViewerAnalysisInputSchema,
  sequenceViewerAnalysisRequestSchema,
  sequenceViewerAlignInputSchema,
  sequenceViewerEditInputSchema,
  sequenceViewerEditRequestSchema,
  sequenceViewerExportInputSchema,
  sequenceViewerLoadTrackInputSchema,
  sequenceViewerOperationCommandSchema,
  sequenceViewerQueryInputSchema,
  sequenceViewerQueryRequestSchema,
  sequenceViewerSaveSessionInputSchema,
} from "./viewer-operations";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("workbench operation protocol", () => {
  it.each([
    ["a3m", ["family.a3m"], ["family.aln", "family.a3m.exe"]],
    ["clustal", ["family.aln", "family.clustal", "family.clw"], ["family.sto"]],
    ["gtf", ["annotations.gtf", "ANNOTATIONS.GTF"], ["annotations.gff3"]],
    ["pdf", ["report.pdf", "REPORT.PDF"], ["report.svg", "report.pdf.exe"]],
    [
      "stockholm",
      ["family.sto", "family.stk", "family.stockholm"],
      ["family.a3m"],
    ],
  ] as const)(
    "exposes real %s exports with exact safe format extensions",
    (format, validNames, invalidNames) => {
      expect(
        sequenceViewerExportInputSchema.parse({
          format,
          sessionId,
        }).format,
      ).toBe(format);
      for (const name of validNames) {
        expect(isWorkspaceExportNameForFormat(format, name)).toBe(true);
      }
      for (const name of invalidNames) {
        expect(isWorkspaceExportNameForFormat(format, name)).toBe(false);
      }
    },
  );

  it("defaults exports to private persistence and accepts only safe relative workspace syntax", () => {
    expect(
      sequenceViewerExportInputSchema.parse({
        format: "fasta",
        sessionId,
      }),
    ).toMatchObject({ destination: { kind: "private" } });
    expect(
      sequenceViewerExportInputSchema.parse({
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: "derived.fasta",
        },
        format: "fasta",
        sessionId,
      }).destination,
    ).not.toHaveProperty("collisionPolicy");
    expect(
      sequenceViewerExportInputSchema.safeParse({
        destination: {
          base: "opened-source",
          collisionPolicy: "next-version",
          kind: "workspace",
          relativePath: "../results/derived.fasta",
        },
        format: "fasta",
        sessionId,
      }).success,
    ).toBe(false);
    for (const relativePath of [
      "",
      "/tmp/derived.fasta",
      "C:/tmp/derived.fasta",
      "\\\\server\\share\\derived.fasta",
      "file:///tmp/derived.fasta",
      "exports/derived.fasta:stream",
      "exports/CON.fasta",
      "exports/derived.fasta.",
      "exports\\derived.fasta",
      "exports//derived.fasta",
      "./derived.fasta",
      "derived.fasta\nignored",
    ]) {
      expect(
        sequenceViewerExportInputSchema.safeParse({
          destination: {
            base: "opened-source",
            kind: "workspace",
            relativePath,
          },
          format: "fasta",
          sessionId,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects Windows drives, UNC paths, device names and aliasing whitespace", () => {
    for (const relativePath of [
      "C:/Windows/derived.fasta",
      "C:\\Windows\\derived.fasta",
      "\\\\server\\share\\derived.fasta",
      "\\\\?\\C:\\Windows\\derived.fasta",
      "exports/derived.fasta:hidden",
      "exports/CON.fasta",
      "exports/AUX.fasta",
      "exports/COM1.fasta",
      "exports/LPT9.fasta",
      "exports/derived.fasta ",
      " exports/derived.fasta",
      "exports/trailing./derived.fasta",
    ]) {
      expect(isSafeWorkspaceExportRelativePath(relativePath)).toBe(false);
    }
    expect(isSafeWorkspaceExportRelativePath("../results/derived.fasta")).toBe(
      true,
    );
  });
  it("validates paged query targets and rejects target-specific field drift", () => {
    expect(
      sequenceViewerQueryInputSchema.parse({
        limit: 25,
        sessionId,
        target: "records",
      }),
    ).toMatchObject({ limit: 25, target: "records" });
    expect(
      sequenceViewerQueryRequestSchema.safeParse({
        end: 20,
        limit: 100,
        reference: "chr1",
        start: 1,
        target: "variants",
      }).success,
    ).toBe(true);
    expect(
      sequenceViewerQueryRequestSchema.safeParse({
        row: "not-valid-for-records",
        limit: 100,
        target: "records",
      }).success,
    ).toBe(false);
    const unpagedInput = sequenceViewerQueryInputSchema.parse({
      end: 4,
      sessionId,
      start: 1,
      target: "sequence-range",
    });
    expect(unpagedInput).not.toHaveProperty("limit");
    const { sessionId: _sessionId, ...unpagedRequest } = unpagedInput;
    expect(sequenceViewerQueryRequestSchema.parse(unpagedRequest)).toEqual({
      end: 4,
      start: 1,
      target: "sequence-range",
    });
    expect(
      sequenceViewerQueryRequestSchema.parse({ target: "records" }),
    ).toMatchObject({ limit: 100, target: "records" });
  });

  it("uses discriminated analysis and edit request contracts", () => {
    expect(
      sequenceViewerAnalysisRequestSchema.parse({
        analysis: "find-orfs",
      }),
    ).toMatchObject({
      includePartial: false,
      minAminoAcids: 30,
      strands: "both",
    });
    expect(
      sequenceViewerEditRequestSchema.safeParse({
        operation: "replace-sequence-range",
        end: 20,
        sequence: "ACGT",
        start: 10,
      }).success,
    ).toBe(true);
    expect(
      sequenceViewerEditRequestSchema.safeParse({
        operation: "replace-sequence-range",
        end: 20,
        start: 10,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerEditRequestSchema.safeParse({
        group: "responders",
        operation: "assign-alignment-row-group",
        rowIds: ["row-a", "row-b"],
      }).success,
    ).toBe(true);
  });

  it("keeps model-facing tool objects strict", () => {
    expect(
      sequenceViewerAnalysisInputSchema.safeParse({
        analysis: "statistics",
        command: "legacy",
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerEditInputSchema.safeParse({
        operation: "undo",
        sessionId,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerLoadTrackInputSchema.safeParse({
        format: "cram",
        path: "/workspace/evidence.cram",
        sessionId,
      }).success,
    ).toBe(true);
    expect(
      sequenceViewerLoadTrackInputSchema.safeParse({
        end: 40_000,
        format: "bam",
        indexPath: "/workspace/evidence.bam.csi",
        path: "/workspace/evidence.bam",
        reference: "chr1",
        sessionId,
        start: 1,
      }).success,
    ).toBe(true);
    expect(
      sequenceViewerLoadTrackInputSchema.safeParse({
        format: "bed",
        indexPath: "/workspace/evidence.bed.tbi",
        path: "/workspace/evidence.bed",
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerLoadTrackInputSchema.safeParse({
        end: 100_001,
        format: "bam",
        path: "/workspace/evidence.bam",
        sessionId,
        start: 1,
      }).success,
    ).toBe(false);
  });

  it("keeps alignment engine selection unambiguous", () => {
    expect(
      sequenceViewerAlignInputSchema.safeParse({
        algorithm: "builtin-pairwise",
        recordIds: ["a", "b"],
        sessionId,
      }).success,
    ).toBe(true);
    expect(
      sequenceViewerAlignInputSchema.safeParse({
        algorithm: "builtin-pairwise",
        recordIds: ["a", "b", "c"],
        sessionId,
      }).success,
    ).toBe(false);
    expect(
      sequenceViewerAlignInputSchema.safeParse({
        recordIds: ["a", "b"],
        rowIds: ["row-a", "row-b"],
        sessionId,
      }).success,
    ).toBe(false);
  });

  it("requires saved-session names to be basenames", () => {
    expect(
      sequenceViewerSaveSessionInputSchema.parse({
        name: "analysis.session.json",
        sessionId,
      }),
    ).toMatchObject({ name: "analysis.session.json" });
    for (const name of [
      "results/session.json",
      "results\\session.json",
      ".",
      "..",
    ]) {
      expect(
        sequenceViewerSaveSessionInputSchema.safeParse({ name, sessionId })
          .success,
      ).toBe(false);
    }
  });

  it("includes operations in the same versioned queued-command transport", () => {
    const command = {
      action: "query_viewer" as const,
      commandId: "22222222-2222-4222-8222-222222222222",
      request: { limit: 10, target: "records" as const },
      revision: 4,
    };
    expect(
      sequenceViewerOperationCommandSchema.safeParse(command).success,
    ).toBe(false);
    expect(queuedSequenceViewerCommandSchema.parse(command)).toEqual(command);
  });

  it.each([
    { target: "workbench-panels", group: "sequence-tools" },
    { target: "workbench-disclosures", mode: "sequence", limit: 10 },
    { target: "workbench-feedback", mode: "sequence", limit: 10 },
    { target: "sequence-ui-state" },
    { target: "read-pileup-state" },
    { target: "quality-report" },
    { target: "chromatogram", start: 1, end: 100, limit: 500 },
    {
      target: "read-detail",
      trackId: "track-a",
      sourceReadIndex: 0,
      start: 10,
      end: 80,
      limit: 25,
    },
  ])(
    "exposes bounded structured $target queries through both schema layers",
    (request) => {
      const { sessionId: _session, ...modelRequest } =
        sequenceViewerQueryInputSchema.parse({ ...request, sessionId });
      expect(
        sequenceViewerQueryRequestSchema.parse(modelRequest),
      ).toMatchObject(request);
    },
  );

  it.each([
    { target: "workbench-panels", group: "unknown" },
    { target: "workbench-disclosures", mode: "both" },
    { target: "workbench-disclosures", limit: 101 },
    { target: "workbench-feedback", limit: 101 },
    { target: "quality-report", record: "individual-read" },
    { target: "chromatogram", start: 1, end: 101 },
    { target: "chromatogram", start: 10, end: 2 },
    { target: "chromatogram", start: 1, end: 10, limit: 501 },
    { target: "read-detail", sourceReadIndex: 0 },
    { target: "read-detail", trackId: "track-a", sourceReadIndex: -1 },
    {
      target: "read-detail",
      trackId: "track-a",
      sourceReadIndex: 0,
      cursor: "x".repeat(1025),
    },
    { target: "sequence-ui-state", includeSourceBytes: true },
  ])("rejects ambiguous or unbounded $target queries", (request) => {
    expect(sequenceViewerQueryRequestSchema.safeParse(request).success).toBe(
      false,
    );
  });

  it("exposes document-scope quality reports and a bounded explicit adapter screen", () => {
    for (const adapterSequence of [
      undefined,
      "ACGTACGT",
      "acgtacgt",
      "A".repeat(64),
    ]) {
      const { sessionId: _session, ...request } =
        sequenceViewerAnalysisInputSchema.parse({
          analysis: "quality-report",
          adapterSequence,
          sessionId,
        });
      expect(sequenceViewerAnalysisRequestSchema.parse(request)).toEqual({
        analysis: "quality-report",
        adapterSequence,
      });
    }
    for (const request of [
      { analysis: "quality-report", adapterSequence: "ACGT" },
      { analysis: "quality-report", adapterSequence: "A".repeat(65) },
      { analysis: "quality-report", adapterSequence: "ACGTNCGT" },
      { analysis: "quality-report", record: "one-read" },
    ]) {
      expect(
        sequenceViewerAnalysisRequestSchema.safeParse(request).success,
      ).toBe(false);
    }
  });
});
