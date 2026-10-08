import { describe, expect, it } from "vitest";

import { parseMsa } from "./msa/parser";
import { parseSequenceDocument } from "./sequence/parser";
import {
  alignmentWorkbenchReducer,
  createAlignmentWorkbenchState,
  createSequenceWorkbenchState,
  parseWorkbenchSession,
  sequenceWorkbenchReducer,
  serializeWorkbenchSession,
  settleRestoredJobs,
  summarizeWorkbenchArtifact,
  type WorkbenchSession,
} from "./workbench-state";

describe("shared workbench state", () => {
  it("keeps artifact bytes out of bounded live job results", () => {
    const summary = summarizeWorkbenchArtifact({
      content: "A".repeat(600 * 1_024),
      createdAt: 1,
      format: "aligned-fasta",
      id: "artifact",
      mediaType: "text/x-fasta",
      name: "large.aln-fasta",
      provenance: {
        engine: "test",
        parameters: {},
        sourceRevision: 1,
      },
    });

    expect(summary).not.toHaveProperty("content");
    expect(summary).toMatchObject({
      format: "aligned-fasta",
      name: "large.aln-fasta",
    });
  });

  it("applies sequence edits through bounded undo/redo history", () => {
    const original = sequenceDocument("ACGT");
    const edited = sequenceDocument("AAGT");
    let state = createSequenceWorkbenchState(original);
    state = sequenceWorkbenchReducer(state, {
      description: "replace residue 2",
      document: edited,
      type: "apply-sequence-document",
    });
    expect(state).toMatchObject({ dirty: true, revision: 1 });
    expect(state.document.records[0]?.sequence).toBe("AAGT");
    expect(state.document.records[0]?.evidenceCoordinatesStale).toBe(true);

    state = sequenceWorkbenchReducer(state, { type: "undo-sequence-document" });
    expect(state.document.records[0]?.sequence).toBe("ACGT");
    expect(state.document.records[0]?.evidenceCoordinatesStale).not.toBe(true);
    state = sequenceWorkbenchReducer(state, { type: "redo-sequence-document" });
    expect(state.document.records[0]?.sequence).toBe("AAGT");
    expect(state.document.records[0]?.evidenceCoordinatesStale).toBe(true);
  });

  it("preserves valid evidence on annotation-only/no-op edits and verifies restored records against the opened source", () => {
    const original = sequenceDocument("ACGT");
    const annotated = {
      ...original,
      records: original.records.map((record) => ({
        ...record,
        description: "An annotation-only change",
      })),
    };
    let state = sequenceWorkbenchReducer(
      createSequenceWorkbenchState(original),
      {
        type: "apply-sequence-document",
        document: annotated,
        description: "annotations",
      },
    );
    expect(state.document.records[0]?.evidenceCoordinatesStale).not.toBe(true);
    state = sequenceWorkbenchReducer(state, {
      type: "apply-sequence-document",
      document: state.document,
      description: "exact no-op",
    });
    expect(state.document.records[0]?.evidenceCoordinatesStale).not.toBe(true);
    state = sequenceWorkbenchReducer(state, {
      type: "apply-sequence-document",
      document: sequenceDocument("TACGT"),
      description: "insert",
    });
    expect(state.document.records[0]?.evidenceCoordinatesStale).toBe(true);
    state = sequenceWorkbenchReducer(state, {
      type: "restore-sequence-document",
      document: original,
      description: "restore original",
    });
    expect(state.sourceDocument).toBe(original);
    expect(state.document.records[0]?.evidenceCoordinatesStale).not.toBe(true);
    const changedSnapshot = sequenceDocument("TACGT");
    changedSnapshot.records = changedSnapshot.records.map((record) => ({
      ...record,
      evidenceCoordinatesStale: false,
    }));
    state = sequenceWorkbenchReducer(state, {
      type: "restore-sequence-document",
      document: changedSnapshot,
      description: "restore edited snapshot",
    });
    expect(state.document.records[0]?.evidenceCoordinatesStale).toBe(true);
    const reconstructed = sequenceWorkbenchReducer(state, {
      type: "reset-sequence-document",
      document: changedSnapshot,
      sourceDocument: original,
    });
    expect(reconstructed.sourceDocument).toBe(original);
    expect(reconstructed.history).toHaveLength(0);
    expect(reconstructed.document.records[0]?.evidenceCoordinatesStale).toBe(
      true,
    );
  });

  it("invalidates selected alignment rows that disappear in an edit", () => {
    const original = alignmentDocument(`>a\nAAAA\n>b\nAAAT\n`);
    const edited = {
      ...original,
      rows: [original.rows[0] as (typeof original.rows)[number]],
    };
    let state = createAlignmentWorkbenchState(original);
    state = alignmentWorkbenchReducer(state, {
      rowIds: original.rows.map(({ id }) => id),
      type: "select-alignment-rows",
    });
    state = alignmentWorkbenchReducer(state, {
      description: "remove b",
      document: edited,
      type: "apply-alignment-document",
    });
    expect(state.selectedRows).toEqual([original.rows[0]?.id]);
  });

  it("tracks cancellable jobs and ignores unknown stale completions", () => {
    let state = createSequenceWorkbenchState(sequenceDocument("ACGT"));
    state = sequenceWorkbenchReducer(state, {
      job: {
        id: "job-1",
        kind: "statistics",
        message: "Running",
        parameters: {},
        progress: 0,
        startedAt: 1,
        status: "running",
      },
      type: "start-job",
    });
    state = sequenceWorkbenchReducer(state, {
      completedAt: 2,
      id: "stale-job",
      message: "stale",
      result: {},
      type: "complete-job",
    });
    expect(state.jobs[0]?.status).toBe("running");
    state = sequenceWorkbenchReducer(state, {
      id: "job-1",
      type: "cancel-job",
    });
    expect(state.jobs[0]?.status).toBe("cancelled");
  });

  it("round-trips a versioned bounded session contract", () => {
    const session: WorkbenchSession = {
      artifacts: [
        {
          content: ">derived\nACGT\n",
          createdAt: 1,
          format: "fasta",
          id: "11111111-1111-4111-8111-111111111111",
          mediaType: "text/x-fasta",
          name: "derived.fasta",
          provenance: {
            engine: "test",
            parameters: {},
            sourceRevision: 2,
          },
        },
      ],
      createdAt: 1,
      dirty: false,
      jobs: [],
      revision: 3,
      schemaVersion: 1,
      source: { fileName: "demo.fasta", format: "fasta" },
      tracks: [],
      view: {
        mode: "sequence",
        sequence: {
          geneticCodeId: 1,
          layout: "linear",
          orientation: "forward",
          paletteId: "neutral",
          selectedFeatureId: null,
          selectedRecordId: "record-1",
          selection: null,
          showFeatures: true,
          showQuality: true,
          showTranslation: true,
          synchronizedViews: true,
          viewport: null,
          wrapWidth: 60,
        },
      },
    };
    expect(parseWorkbenchSession(serializeWorkbenchSession(session))).toEqual(
      session,
    );
    const snapshot = sequenceDocument("ACGT");
    snapshot.records = snapshot.records.map((record) => ({
      ...record,
      evidenceCoordinatesStale: true,
    }));
    const snapshotSession = {
      ...session,
      snapshot: { sequenceDocument: snapshot },
      view: {
        ...session.view,
        sequence: {
          ...session.view.sequence!,
          selectedRecordId: snapshot.records[0]?.id ?? "",
        },
      },
    };
    expect(
      parseWorkbenchSession(serializeWorkbenchSession(snapshotSession)).snapshot
        ?.sequenceDocument?.records[0]?.evidenceCoordinatesStale,
    ).toBe(true);
    expect(() =>
      parseWorkbenchSession(
        JSON.stringify({
          ...snapshotSession,
          snapshot: {
            sequenceDocument: {
              ...snapshot,
              records: snapshot.records.map((record) => ({
                ...record,
                evidenceCoordinatesStale: "false",
              })),
            },
          },
        }),
      ),
    ).toThrow(/stale status must be boolean/);
    const qualitySession: WorkbenchSession = {
      ...session,
      jobs: [{
        completedAt: 2,
        id: "22222222-2222-4222-8222-222222222222",
        kind: "quality-report",
        message: "quality-report completed.",
        parameters: { analysis: "quality-report" },
        progress: 1,
        result: { analysis: "quality-report", scope: { analyzedReads: 2, populationReads: 2 } },
        startedAt: 1,
        status: "completed",
      }],
      source: { fileName: "synthetic-quality-session.fastq", format: "fastq" },
    };
    expect(parseWorkbenchSession(serializeWorkbenchSession(qualitySession))).toEqual(qualitySession);
    expect(() => parseWorkbenchSession('{"schemaVersion":2}')).toThrow(
      "not a compatible",
    );
  });
});

describe("restored workbench jobs", () => {
  it("does not revive jobs that no longer have a running executor", () => {
    expect(
      settleRestoredJobs(
        [
          {
            id: "11111111-1111-4111-8111-111111111111",
            kind: "statistics",
            message: "Running",
            parameters: {},
            progress: 0.5,
            startedAt: 1,
            status: "running",
          },
        ],
        10,
      ),
    ).toEqual([
      expect.objectContaining({
        completedAt: 10,
        message: expect.stringContaining("restored"),
        status: "cancelled",
      }),
    ]);
  });
});

function sequenceDocument(sequence: string) {
  return parseSequenceDocument({
    contents: `>demo\n${sequence}\n`,
    fileName: "demo.fasta",
  });
}

function alignmentDocument(contents: string) {
  const result = parseMsa(contents, "demo.aln-fasta");
  if (result.status !== "success") throw new Error(result.message);
  return result.document;
}
