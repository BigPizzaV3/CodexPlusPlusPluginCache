import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SequenceViewerCommandResult } from "../viewer-commands";
import { createSequenceWorkbenchState } from "../workbench-state";
import { parseSequenceDocument } from "./parser";
import type { FastqQualityReportState } from "./fastq-quality-analysis";
import {
  runSequenceWorkbenchJob,
  useSequenceWorkbenchCommands,
} from "./use-sequence-workbench-commands";

describe("scheduled sequence workbench jobs", () => {
  afterEach(() => vi.useRealTimers());

  it("fails a queued result when the source copy changes before execution", () => {
    vi.useFakeTimers();
    const document = parseSequenceDocument({
      contents: ">record\nACGTACGT\n",
      fileName: "record.fasta",
    });
    const state = createSequenceWorkbenchState(document);
    const dispatch = vi.fn();

    runSequenceWorkbenchJob({
      analysis: { analysis: "statistics" },
      dispatch,
      isSourceCurrent: () => false,
      selectedRecordId: document.records[0]?.id ?? "",
      state,
      viewerGeneticCodeId: 1,
    });
    vi.runAllTimers();

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start-job" }),
    );
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("source sequence changed"),
        type: "fail-job",
      }),
    );
  });

  it("runs identical bounded quality reports for UI and model operations", async () => {
    vi.useFakeTimers();
    const document = parseSequenceDocument({
      contents:
        "@synthetic-qc-1\nACGTACGT\n+\nIIIIIIII\n@synthetic-qc-2\nACGTACGT\n+\n55555555\n",
      fileName: "synthetic-quality-parity.fastq",
    });
    const state = createSequenceWorkbenchState(document);
    const selectedRecordId = document.records[0]!.id;
    const uiDispatch = vi.fn();
    const modelDispatch = vi.fn();
    const uiResult = vi.fn<(result: FastqQualityReportState) => void>();
    const modelResult = vi.fn<(result: FastqQualityReportState) => void>();
    runSequenceWorkbenchJob({
      analysis: { analysis: "quality-report", adapterSequence: "ACGTACGT" },
      dispatch: uiDispatch,
      onQualityReportChange: uiResult,
      selectedRecordId,
      state,
      viewerGeneticCodeId: 1,
    });
    renderHook(() =>
      useSequenceWorkbenchCommands({
        cancelledJobsRef: { current: new Set<string>() },
        command: {
          action: "run_analysis",
          commandId: "00000000-0000-4000-8000-000000000010",
          jobId: "00000000-0000-4000-8000-000000000011",
          request: { analysis: "quality-report", adapterSequence: "ACGTACGT" },
          revision: 1,
        },
        dispatch: modelDispatch,
        handledCommandIdRef: { current: undefined },
        hits: [],
        onCommandResult: vi.fn(),
        onQualityReportChange: modelResult,
        onRestoreView: vi.fn(),
        selectedRecordId,
        sourceStateKey: "synthetic-quality-parity",
        state,
        view: {
          geneticCodeId: 1,
          layout: "linear",
          orientation: "forward",
          paletteId: "neutral",
          selectedFeatureId: null,
          selectedRecordId,
          selection: null,
          showFeatures: true,
          showQuality: true,
          showTranslation: false,
          synchronizedViews: true,
          viewport: null,
          wrapWidth: 60,
        },
      }),
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const uiReport = uiResult.mock.calls.at(-1)?.[0].report;
    const modelReport = modelResult.mock.calls.at(-1)?.[0].report;
    expect(uiReport).toMatchObject({
      adapter: { records: 2 },
      analysis: "quality-report",
      scope: { analyzedReads: 2, isSubset: false, populationReads: 2 },
    });
    expect(modelReport).toEqual(uiReport);
    for (const dispatch of [uiDispatch, modelDispatch]) {
      expect(dispatch).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: uiReport, type: "complete-job" }),
      );
    }
  });

  it("does not publish cancelled QC jobs and settles the controlled UI state", async () => {
    vi.useFakeTimers();
    const document = parseSequenceDocument({
      contents: "@synthetic-read\nACGT\n+\nIIII\n",
      fileName: "cancel.fastq",
    });
    const state = createSequenceWorkbenchState(document);
    const dispatch = vi.fn();
    const onQualityReportChange =
      vi.fn<(result: FastqQualityReportState) => void>();
    const cancelledJobsRef = { current: new Set<string>() };
    const id = runSequenceWorkbenchJob({
      analysis: { analysis: "quality-report" },
      cancelledJobsRef,
      dispatch,
      onQualityReportChange,
      selectedRecordId: document.records[0]!.id,
      state,
      viewerGeneticCodeId: 1,
    });
    cancelledJobsRef.current.add(id);
    await vi.runAllTimersAsync();
    expect(onQualityReportChange).toHaveBeenLastCalledWith({
      adapterSequence: null,
      error: "Quality report cancelled.",
      jobId: id,
      pending: false,
      report: null,
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete-job" }),
    );
  });

  it("does not let a stale QC completion replace a new source’s controlled report", async () => {
    vi.useFakeTimers();
    const document = parseSequenceDocument({
      contents: "@synthetic-read\nACGT\n+\nIIII\n",
      fileName: "stale.fastq",
    });
    const dispatch = vi.fn();
    const onQualityReportChange =
      vi.fn<(result: FastqQualityReportState) => void>();
    let current = true;
    runSequenceWorkbenchJob({
      analysis: { analysis: "quality-report" },
      dispatch,
      isSourceCurrent: () => current,
      onQualityReportChange,
      selectedRecordId: document.records[0]!.id,
      state: createSequenceWorkbenchState(document),
      viewerGeneticCodeId: 1,
    });
    current = false;
    await vi.runAllTimersAsync();
    expect(onQualityReportChange).toHaveBeenCalledTimes(1);
    expect(onQualityReportChange).toHaveBeenCalledWith(
      expect.objectContaining({ pending: true, report: null }),
    );
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("source sequence changed"),
        type: "fail-job",
      }),
    );
  });
});

describe("persisted Sequence artifact visibility", () => {
  it("waits for authenticated persistence before displaying an artifact", async () => {
    let resolvePersistence:
      ((result: SequenceViewerCommandResult) => void) | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>((resolve) => {
      resolvePersistence = resolve;
    });
    const onCommandResult = vi.fn(() => persistence);
    const dispatch = renderSequenceArtifactExport(onCommandResult);

    expect(onCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export_artifact" }),
      expect.objectContaining({ applied: true }),
    );
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersistence?.({ applied: true, message: "Persisted artifact." });
      await persistence;
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({ format: "fasta" }),
        type: "add-artifact",
      }),
    );
  });

  it("never displays an artifact when authenticated persistence fails", async () => {
    let resolvePersistence:
      ((result: SequenceViewerCommandResult) => void) | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>((resolve) => {
      resolvePersistence = resolve;
    });
    const dispatch = renderSequenceArtifactExport(() => persistence);

    await act(async () => {
      resolvePersistence?.({
        applied: false,
        message: "Persistence rejected.",
      });
      await persistence;
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("never displays an artifact when the persistence acknowledgment rejects", async () => {
    let rejectPersistence: ((reason: Error) => void) | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>(
      (_resolve, reject) => {
        rejectPersistence = reject;
      },
    );
    const dispatch = renderSequenceArtifactExport(() => persistence);

    await act(async () => {
      rejectPersistence?.(
        new Error("The authenticated viewer session expired."),
      );
      await persistence.catch(() => undefined);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves immediate artifact visibility for legacy direct UI callbacks", () => {
    const dispatch = renderSequenceArtifactExport(() => undefined);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "add-artifact" }),
    );
  });
});

function renderSequenceArtifactExport(
  onCommandResult: NonNullable<
    Parameters<typeof useSequenceWorkbenchCommands>[0]["onCommandResult"]
  >,
) {
  const document = parseSequenceDocument({
    contents: ">record\nACGTACGT\n",
    fileName: "record.fasta",
  });
  const state = createSequenceWorkbenchState(document);
  const selectedRecordId = document.records[0]?.id;
  if (selectedRecordId == null) {
    throw new Error("Expected a parsed Sequence record.");
  }
  const dispatch = vi.fn();

  renderHook(() =>
    useSequenceWorkbenchCommands({
      cancelledJobsRef: { current: new Set<string>() },
      command: {
        action: "export_artifact",
        commandId: "00000000-0000-4000-8000-000000000001",
        destination: { kind: "private" },
        format: "fasta",
        revision: 1,
        scope: "all",
      },
      dispatch,
      handledCommandIdRef: { current: undefined },
      hits: [],
      onCommandResult,
      onRestoreView: vi.fn(),
      selectedRecordId,
      sourceStateKey: "public-sequence-source",
      state,
      view: {
        geneticCodeId: 1,
        layout: "linear",
        orientation: "forward",
        paletteId: "neutral",
        selectedFeatureId: null,
        selectedRecordId,
        selection: null,
        showFeatures: true,
        showQuality: true,
        showTranslation: true,
        synchronizedViews: true,
        viewport: null,
        wrapWidth: 60,
      },
    }),
  );

  return dispatch;
}
