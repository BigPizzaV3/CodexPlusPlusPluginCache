import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SequenceViewerCommandResult } from "../viewer-commands";
import { createAlignmentWorkbenchState } from "../workbench-state";
import { parseMsa } from "./parser";
import { useAlignmentWorkbenchCommands } from "./use-alignment-workbench-commands";

describe("persisted Alignment artifact visibility", () => {
  it("waits for authenticated persistence before displaying Stockholm", async () => {
    let resolvePersistence:
      | ((result: SequenceViewerCommandResult) => void)
      | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>((resolve) => {
      resolvePersistence = resolve;
    });
    const onCommandResult = vi.fn(() => persistence);
    const dispatch = renderAlignmentArtifactExport(onCommandResult);

    expect(onCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export_artifact" }),
      expect.objectContaining({ applied: true }),
    );
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersistence?.({ applied: true, message: "Persisted Stockholm." });
      await persistence;
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({ format: "stockholm" }),
        type: "add-artifact",
      }),
    );
  });

  it("never displays Stockholm when authenticated persistence fails", async () => {
    let resolvePersistence:
      | ((result: SequenceViewerCommandResult) => void)
      | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>((resolve) => {
      resolvePersistence = resolve;
    });
    const dispatch = renderAlignmentArtifactExport(() => persistence);

    await act(async () => {
      resolvePersistence?.({ applied: false, message: "Persistence rejected." });
      await persistence;
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("never displays Stockholm when the persistence acknowledgment rejects", async () => {
    let rejectPersistence: ((reason: Error) => void) | undefined;
    const persistence = new Promise<SequenceViewerCommandResult>(
      (_resolve, reject) => {
        rejectPersistence = reject;
      },
    );
    const dispatch = renderAlignmentArtifactExport(() => persistence);

    await act(async () => {
      rejectPersistence?.(new Error("The authenticated viewer session expired."));
      await persistence.catch(() => undefined);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves immediate artifact visibility for legacy direct UI callbacks", () => {
    const dispatch = renderAlignmentArtifactExport(() => undefined);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "add-artifact" }),
    );
  });
});

function renderAlignmentArtifactExport(
  onCommandResult: NonNullable<
    Parameters<typeof useAlignmentWorkbenchCommands>[0]["onCommandResult"]
  >,
) {
  const parsed = parseMsa(
    ">accessioned-rna-1\nACGU\n>accessioned-rna-2\nA-GU\n",
    "public-rna.afa",
  );
  if (parsed.status !== "success") {
    throw new Error(parsed.message);
  }
  const state = createAlignmentWorkbenchState(parsed.document);
  const dispatch = vi.fn();

  renderHook(() =>
    useAlignmentWorkbenchCommands({
      analysis: null,
      cancelledJobsRef: { current: new Set<string>() },
      command: {
        action: "export_artifact",
        commandId: "00000000-0000-4000-8000-000000000002",
        destination: { kind: "private" },
        format: "stockholm",
        revision: 1,
        scope: "all",
      },
      dispatch,
      documentFileName: "public-rna.afa",
      handledCommandIdRef: { current: undefined },
      hits: [],
      onCommandResult,
      onRestoreView: vi.fn(),
      onSetTree: vi.fn(),
      selectedColumns: null,
      sourceStateKey: "public-alignment-source",
      state,
      tree: null,
      view: {
        analysisScope: "all-unhidden-rows",
        cellWidth: 20,
        colorMode: "residue",
        referenceMode: "consensus",
        residuePalette: null,
        rowFilter: "",
        searchScope: "all",
        selectedColumns: null,
        selectedRows: [],
        showAnnotationTracks: true,
        showIdenticalAsDots: false,
        showRnaStructureOverlays: true,
      },
      visibleRows: parsed.document.rows,
    }),
  );

  return dispatch;
}
