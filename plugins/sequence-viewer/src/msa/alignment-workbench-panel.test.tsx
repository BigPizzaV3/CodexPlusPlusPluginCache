import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import {
  alignmentWorkbenchReducer,
  createAlignmentWorkbenchState,
  type WorkbenchArtifact,
} from "../workbench-state";
import { AlignmentWorkbenchPanel } from "./alignment-workbench-panel";
import { parseMsa } from "./parser";
import { buildGuideTree } from "./phylogenetic-tree";

afterEach(() => cleanup());

describe("AlignmentWorkbenchPanel", () => {
  it("uses selection scope for row-only exports", async () => {
    const parsed = parseMsa(">a\nAAAA\n>b\nAAAT\n", "pair.aln-fasta");
    if (parsed.status !== "success") throw new Error(parsed.message);
    const selectedRowId = parsed.document.rows[1]?.id;
    if (selectedRowId == null) throw new Error("Expected a second row.");
    const state = alignmentWorkbenchReducer(
      createAlignmentWorkbenchState(parsed.document),
      { rowIds: [selectedRowId], type: "select-alignment-rows" },
    );
    const onExport = vi.fn();

    render(
      <AlignmentWorkbenchPanel
        focusedCell={null}
        onBuildTree={vi.fn()}
        onCancelJob={vi.fn()}
        onDistanceMatrix={vi.fn()}
        onEdit={vi.fn()}
        onExport={onExport}
        onRealign={vi.fn()}
        onRedo={vi.fn()}
        onRestoreSession={vi.fn()}
        onSaveSession={vi.fn()}
        onSelectRows={vi.fn()}
        onUndo={vi.fn()}
        selectedColumns={null}
        state={state}
        tree={buildGuideTree(parsed.document.rows)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      screen.getByRole("button", { name: "ALIGNED-FASTA" }),
    );

    expect(onExport).toHaveBeenCalledWith("aligned-fasta", "selection");
    await userEvent.click(screen.getByRole("button", { name: "NEWICK" }));
    expect(onExport).toHaveBeenLastCalledWith("newick", "all");
  });

  it("publishes exact edited artifacts without presenting sandbox-blocked downloads", async () => {
    const artifact: WorkbenchArtifact = {
      content: ">edited\nAC-G\n",
      createdAt: 1,
      format: "aligned-fasta",
      id: "edited-alignment",
      mediaType: "text/x-fasta",
      name: "edited.afa",
      provenance: {
        engine: "sequence-viewer-alignment-edit-v1",
        parameters: { scope: "selection" },
        sourceRevision: 7,
      },
    };
    const publisher = createPublisher(artifact);
    publisher.supportsNativeRichGeneration = true;

    renderArtifactWorkbench(artifact, publisher);
    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Publish to workspace" }),
    );
    const save = await screen.findByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher).toHaveBeenCalledWith(
      {
        content: artifact.content,
        format: "aligned-fasta",
        mediaType: artifact.mediaType,
        name: artifact.name,
        provenance: artifact.provenance,
      },
      "edited.afa",
      "exact",
      expect.any(AbortSignal),
    );
    expect(
      await screen.findByText("Published exports/edited.afa"),
    ).toBeVisible();
  });

  it("explains when authorized workspace export is unavailable", async () => {
    const artifact: WorkbenchArtifact = {
      content: ">edited\nAC-G\n",
      createdAt: 1,
      format: "aligned-fasta",
      id: "edited-alignment",
      mediaType: "text/x-fasta",
      name: "edited.afa",
      provenance: {
        engine: "sequence-viewer-alignment-edit-v1",
        parameters: { scope: "selection" },
        sourceRevision: 7,
      },
    };

    renderArtifactWorkbench(artifact);
    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Workspace export is unavailable for this viewer.",
    );
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Publish to workspace" }),
    ).toBeNull();
  });
});

function renderArtifactWorkbench(
  artifact: WorkbenchArtifact,
  publisher?: SequenceWorkspaceArtifactPublisher,
): void {
  const parsed = parseMsa(">a\nAAAA\n>b\nAAAT\n", "pair.aln-fasta");
  if (parsed.status !== "success") throw new Error(parsed.message);
  const state = {
    ...createAlignmentWorkbenchState(parsed.document),
    artifacts: [artifact],
    dirty: true,
    revision: artifact.provenance.sourceRevision,
  };

  render(
    <AlignmentWorkbenchPanel
      focusedCell={null}
      onBuildTree={vi.fn()}
      onCancelJob={vi.fn()}
      onDistanceMatrix={vi.fn()}
      onEdit={vi.fn()}
      onExport={vi.fn()}
      onRealign={vi.fn()}
      onRedo={vi.fn()}
      onRestoreSession={vi.fn()}
      onSaveSession={vi.fn()}
      onSelectRows={vi.fn()}
      onUndo={vi.fn()}
      publishWorkspaceArtifact={publisher}
      selectedColumns={null}
      state={state}
      tree={null}
    />,
  );
}

function createPublisher(artifact: WorkbenchArtifact) {
  const publisher = vi.fn(
    async (
      _artifact: PreparedSequenceWorkspaceArtifact,
      _relativePath: string,
      _collisionPolicy?: "exact" | "next-version",
      _signal?: AbortSignal,
    ) => ({
      destination: {
        base: "opened-source" as const,
        kind: "workspace" as const,
      },
      format: "aligned-fasta" as const,
      kind: "artifact" as const,
      mediaType: artifact.mediaType,
      name: artifact.name,
      outputWorkspacePath: `exports/${artifact.name}`,
      provenanceWorkspacePath: `exports/${artifact.name}.provenance.json`,
      sha256: "a".repeat(64),
      size: artifact.content.length,
      version: 1 as const,
    }),
  );

  return Object.assign(publisher, {
    createDirectory: vi.fn(),
    listDirectory: vi.fn(async () => ({
      candidate: {
        exactAvailable: true,
        exactWorkspacePath: `exports/${artifact.name}`,
        name: artifact.name,
        nextVersionName: artifact.name,
        nextVersionWorkspacePath: `exports/${artifact.name}`,
      },
      directory: {
        breadcrumbs: [
          { label: "Workspace", relativePath: ".", workspacePath: "." },
        ],
        relativePath: ".",
        sourceDirectoryWorkspacePath: ".",
        workspacePath: ".",
      },
      entries: [],
      omittedEntries: 0,
    })),
  }) as typeof publisher & SequenceWorkspaceArtifactPublisher;
}
