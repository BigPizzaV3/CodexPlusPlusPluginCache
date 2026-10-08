import { useMemo, useState, type ChangeEvent } from "react";

import { useWorkbenchFeedback } from "../ui/workbench-feedback";
import type { SequenceViewerEditRequest } from "../viewer-operations";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import type { SequenceWorkspaceSessionClient } from "../views/workspace-sessions";
import type {
  AlignmentWorkbenchState,
  WorkbenchArtifact,
} from "../workbench-state";
import { WorkspacePublishButton } from "../workspace-publish-button";
import { WorkspaceSessionSaveButton } from "../workspace-session-controls";
import type { GuideTreeAlgorithm, GuideTreeResult } from "./phylogenetic-tree";
import { PhylogeneticTreePanel } from "./phylogenetic-tree-panel";
import type { MsaColumnRange, MsaSequenceRow } from "./types";

export type AlignmentWorkbenchTab = "analyze" | "edit" | "export" | "tasks";

export function AlignmentWorkbenchPanel({
  focusedCell,
  onBuildTree,
  onCancelJob,
  onDistanceMatrix,
  onEdit,
  onExport,
  onRealign,
  onRedo,
  onRestoreSession,
  onSaveSession,
  prepareWorkspaceSession,
  publishWorkspaceArtifact,
  onSelectRows,
  onUndo,
  panel,
  selectedColumns,
  state,
  tree,
  workspaceSessionName,
  workspaceSessions,
}: {
  focusedCell: { column: number; rowId: string } | null;
  onBuildTree: (algorithm: GuideTreeAlgorithm) => void;
  onCancelJob: (jobId: string) => void;
  onDistanceMatrix: () => void;
  onEdit: (request: SequenceViewerEditRequest) => void;
  onExport: (
    format:
      | "a3m"
      | "aligned-fasta"
      | "clustal"
      | "json"
      | "newick"
      | "pdf"
      | "stockholm"
      | "svg"
      | "tsv",
    scope: "all" | "selection" | "visible",
  ) => void;
  onRealign: (rowIds?: Array<string>) => void;
  onRedo: () => void;
  onRestoreSession: (content: string) => void;
  onSaveSession: () => void;
  prepareWorkspaceSession?: () => string;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  onSelectRows: (rowIds: Array<string>) => void;
  onUndo: () => void;
  panel?: AlignmentWorkbenchTab;
  selectedColumns: MsaColumnRange | null;
  state: AlignmentWorkbenchState;
  tree: GuideTreeResult | null;
  workspaceSessionName?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const [selectedTab, setActiveTab] = useState<AlignmentWorkbenchTab | null>(
    null,
  );
  const activeTab = panel ?? selectedTab;
  const [gapThreshold, setGapThreshold] = useState(0.8);
  const [groupName, setGroupName] = useState("");
  const [sessionError, setSessionError] = useState<string>();
  const dismissSessionError = useWorkbenchFeedback({
    id: `alignment.session-error.${panel ?? "standalone"}`,
    kind: "session-error",
    label: "Alignment session error",
    message: sessionError,
    onDismiss: () => setSessionError(undefined),
    visible: sessionError != null && activeTab === "export",
  });
  const selected = new Set(state.selectedRows);
  const runningJobs = state.jobs.filter(({ status }) => status === "running");
  const tabs = useMemo(
    () =>
      [
        ["analyze", tree == null ? "Analyze" : "Tree •"],
        ["edit", state.dirty ? "Edit copy •" : "Edit copy"],
        ["export", "Export"],
        [
          "tasks",
          `Tasks${runningJobs.length === 0 ? "" : ` ${runningJobs.length}`}`,
        ],
      ] as Array<[AlignmentWorkbenchTab, string]>,
    [runningJobs.length, state.dirty, tree],
  );
  async function restoreSession(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file == null) return;
    try {
      if (file.size > 512 * 1_024) {
        throw new Error("Session files are limited to 512 KiB.");
      }
      setSessionError(undefined);
      onRestoreSession(await file.text());
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "The session could not be restored.",
      );
    }
  }
  return (
    <section
      aria-label="Alignment workbench"
      className={panel == null ? "border-b border-token-border" : "space-y-3"}
      data-testid="alignment-workbench"
    >
      {(panel != null && panel !== "edit" && panel !== "export") ||
      (selectedColumns == null && state.selectedRows.length === 0) ? null : (
        <div className="flex flex-wrap items-center gap-2 border-b border-token-border bg-emerald-500/5 px-3 py-2 text-xs">
          <span className="font-medium text-token-text-primary">
            {state.selectedRows.length > 0
              ? `${state.selectedRows.length} row${state.selectedRows.length === 1 ? "" : "s"}`
              : ""}
            {state.selectedRows.length > 0 && selectedColumns != null
              ? " · "
              : ""}
            {selectedColumns == null
              ? ""
              : `columns ${selectedColumns.start + 1}–${selectedColumns.end}`}
          </span>
          <button
            className={actionClass}
            onClick={() => onExport("aligned-fasta", "selection")}
            type="button"
          >
            Export selection
          </button>
          <button
            className={actionClass}
            disabled={state.selectedRows.length < 2}
            onClick={() => onRealign(state.selectedRows)}
            type="button"
          >
            Realign selected rows
          </button>
        </div>
      )}
      {panel == null ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          {tabs.map(([tab, label]) => (
            <button
              aria-expanded={activeTab === tab}
              className={activeTab === tab ? activeActionClass : actionClass}
              key={tab}
              onClick={() =>
                setActiveTab((current) => (current === tab ? null : tab))
              }
              type="button"
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-token-text-secondary">
            Edits are reversible and never overwrite the source alignment.
          </span>
        </div>
      ) : null}
      {activeTab == null ? null : (
        <div
          className={
            panel == null
              ? "bg-token-main-surface-secondary/30 border-t border-token-border p-3"
              : "space-y-3"
          }
        >
          {activeTab === "analyze" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  className={actionClass}
                  onClick={() => onBuildTree("neighbor-joining")}
                  type="button"
                >
                  Neighbor-joining tree
                </button>
                <button
                  className={actionClass}
                  onClick={() => onBuildTree("upgma")}
                  type="button"
                >
                  UPGMA tree
                </button>
                <button
                  className={actionClass}
                  onClick={onDistanceMatrix}
                  type="button"
                >
                  Distance matrix
                </button>
              </div>
              <RowSelector
                onSelectRows={onSelectRows}
                rows={state.document.rows}
                selected={selected}
              />
              {tree == null ? (
                <p className="text-xs text-token-text-secondary">
                  Build a guide tree to see a synchronized graphical phylogram
                  and enable tree-order sorting.
                </p>
              ) : (
                <PhylogeneticTreePanel
                  onSelectRows={onSelectRows}
                  selectedRowIds={state.selectedRows}
                  tree={tree}
                />
              )}
            </div>
          ) : null}
          {activeTab === "edit" ? (
            <div className="grid gap-4">
              <p className="text-xs text-token-text-secondary">
                Edits are reversible and never overwrite the source alignment.
              </p>
              <RowSelector
                onSelectRows={onSelectRows}
                rows={state.document.rows}
                selected={selected}
              />
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-token-text-primary">
                  Columns and gaps
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={actionClass}
                    disabled={selectedColumns == null}
                    onClick={() => {
                      if (selectedColumns != null)
                        onEdit({
                          end: selectedColumns.end,
                          operation: "remove-alignment-columns",
                          start: selectedColumns.start + 1,
                        });
                    }}
                    type="button"
                  >
                    Remove selected columns
                  </button>
                  <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                    Gap fraction{" "}
                    <input
                      aria-label="Minimum gap fraction"
                      className={inputClass}
                      max="1"
                      min="0"
                      onChange={(event) =>
                        setGapThreshold(Number(event.target.value))
                      }
                      step="0.05"
                      type="number"
                      value={gapThreshold}
                    />
                  </label>
                  <button
                    className={actionClass}
                    onClick={() =>
                      onEdit({
                        minimumGapFraction: gapThreshold,
                        operation: "remove-gappy-columns",
                      })
                    }
                    type="button"
                  >
                    Remove gappy columns
                  </button>
                  <button
                    className={actionClass}
                    disabled={focusedCell == null}
                    onClick={() => {
                      if (focusedCell != null)
                        onEdit({
                          column: focusedCell.column + 1,
                          operation: "add-alignment-gap",
                          row: focusedCell.rowId,
                        });
                    }}
                    type="button"
                  >
                    Add gap at focused cell
                  </button>
                  <button
                    className={actionClass}
                    disabled={focusedCell == null}
                    onClick={() => {
                      if (focusedCell != null)
                        onEdit({
                          column: focusedCell.column + 1,
                          operation: "delete-alignment-gap",
                          row: focusedCell.rowId,
                        });
                    }}
                    type="button"
                  >
                    Delete focused gap
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-token-text-primary">
                  Rows and order
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={actionClass}
                    disabled={state.selectedRows.length === 0}
                    onClick={() =>
                      onEdit({
                        operation: "remove-alignment-rows",
                        rowIds: state.selectedRows,
                      })
                    }
                    type="button"
                  >
                    Remove selected rows
                  </button>
                  <button
                    className={actionClass}
                    onClick={() =>
                      onEdit({
                        mode: "label",
                        operation: "sort-alignment-rows",
                      })
                    }
                    type="button"
                  >
                    Sort by label
                  </button>
                  <button
                    className={actionClass}
                    onClick={() =>
                      onEdit({
                        mode: "group",
                        operation: "sort-alignment-rows",
                      })
                    }
                    type="button"
                  >
                    Sort by group
                  </button>
                  <button
                    className={actionClass}
                    disabled={tree == null}
                    onClick={() =>
                      onEdit({ mode: "tree", operation: "sort-alignment-rows" })
                    }
                    type="button"
                  >
                    Sort by tree
                  </button>
                  <button
                    className={actionClass}
                    onClick={() =>
                      onRealign(
                        state.selectedRows.length >= 2
                          ? state.selectedRows
                          : undefined,
                      )
                    }
                    type="button"
                  >
                    Realign{" "}
                    {state.selectedRows.length >= 2 ? "selected" : "all rows"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Alignment row group name"
                    className={`${inputClass} w-32`}
                    maxLength={100}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Group name"
                    value={groupName}
                  />
                  <button
                    className={actionClass}
                    disabled={
                      state.selectedRows.length === 0 ||
                      groupName.trim().length === 0
                    }
                    onClick={() =>
                      onEdit({
                        group: groupName.trim(),
                        operation: "assign-alignment-row-group",
                        rowIds: state.selectedRows,
                      })
                    }
                    type="button"
                  >
                    Group selected
                  </button>
                  <button
                    className={actionClass}
                    disabled={state.selectedRows.length === 0}
                    onClick={() =>
                      onEdit({
                        group: null,
                        operation: "assign-alignment-row-group",
                        rowIds: state.selectedRows,
                      })
                    }
                    type="button"
                  >
                    Clear group
                  </button>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    className={actionClass}
                    disabled={state.history.length === 0}
                    onClick={onUndo}
                    type="button"
                  >
                    Undo
                  </button>
                  <button
                    className={actionClass}
                    disabled={state.future.length === 0}
                    onClick={onRedo}
                    type="button"
                  >
                    Redo
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {activeTab === "export" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "aligned-fasta",
                    "a3m",
                    "clustal",
                    "stockholm",
                    "tsv",
                    "svg",
                    "pdf",
                    "newick",
                    "json",
                  ] as const
                ).map((format) => (
                  <button
                    className={actionClass}
                    disabled={format === "newick" && tree == null}
                    key={format}
                    onClick={() =>
                      onExport(
                        format,
                        format === "newick" ||
                          (selectedColumns == null &&
                            state.selectedRows.length === 0)
                          ? "all"
                          : "selection",
                      )
                    }
                    type="button"
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
                <button
                  className={actionClass}
                  onClick={onSaveSession}
                  type="button"
                >
                  Save session
                </button>
                {workspaceSessions == null ||
                prepareWorkspaceSession == null ||
                workspaceSessionName == null ? null : (
                  <WorkspaceSessionSaveButton
                    className={actionClass}
                    client={workspaceSessions}
                    defaultName={workspaceSessionName}
                    prepare={prepareWorkspaceSession}
                  />
                )}
                <label className={actionClass}>
                  Restore session
                  <input
                    accept=".json"
                    className="sr-only"
                    onChange={(event) => void restoreSession(event)}
                    type="file"
                  />
                </label>
              </div>
              {sessionError == null ? null : (
                <div className="space-y-2 text-xs text-red-500" role="alert">
                  <p>{sessionError}</p>
                  <button
                    className={actionClass}
                    onClick={dismissSessionError}
                    type="button"
                  >
                    Dismiss session error
                  </button>
                </div>
              )}
              <ArtifactList
                artifacts={state.artifacts}
                nativeSourceSafe={
                  !state.dirty &&
                  state.history.length === 0 &&
                  state.tracks.length === 0
                }
                publisher={publishWorkspaceArtifact}
              />
            </div>
          ) : null}
          {activeTab === "tasks" ? (
            <div className="grid gap-3">
              {state.jobs
                .slice(-12)
                .reverse()
                .map((job) => (
                  <div
                    className="rounded border border-token-border bg-token-main-surface-primary p-2 text-xs"
                    key={job.id}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{job.kind}</span>
                      <span className="text-token-text-secondary">
                        {job.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-token-text-secondary">
                      {job.message}
                    </p>
                    {job.status === "running" ? (
                      <button
                        className={`${actionClass} mt-2`}
                        onClick={() => onCancelJob(job.id)}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ))}
              {state.jobs.length === 0 ? (
                <p className="text-xs text-token-text-secondary">
                  No alignment jobs have run yet.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RowSelector({
  onSelectRows,
  rows,
  selected,
}: {
  onSelectRows: (ids: Array<string>) => void;
  rows: Array<MsaSequenceRow>;
  selected: Set<string>;
}): React.ReactElement {
  const visible = rows.slice(0, 100);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-token-text-primary">
          Rows for analysis/editing
        </span>
        <button
          className={actionClass}
          onClick={() => onSelectRows(rows.map(({ id }) => id))}
          type="button"
        >
          All
        </button>
        <button
          className={actionClass}
          onClick={() => onSelectRows([])}
          type="button"
        >
          None
        </button>
      </div>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto">
        {visible.map((row) => (
          <label
            className="inline-flex items-center gap-1 rounded border border-token-border bg-token-main-surface-primary px-2 py-1 text-[10px] text-token-text-secondary"
            key={row.id}
          >
            <input
              checked={selected.has(row.id)}
              onChange={(event) =>
                onSelectRows(
                  event.target.checked
                    ? [...selected, row.id]
                    : [...selected].filter((id) => id !== row.id),
                )
              }
              type="checkbox"
            />
            {row.label}
          </label>
        ))}
      </div>
      {rows.length > visible.length ? (
        <p className="mt-1 text-[10px] text-token-text-secondary">
          Showing the first {visible.length} rows; the model can target exact
          row IDs beyond this list.
        </p>
      ) : null}
    </div>
  );
}

function ArtifactList({
  artifacts,
  nativeSourceSafe,
  publisher,
}: {
  artifacts: Array<WorkbenchArtifact>;
  nativeSourceSafe: boolean;
  publisher?: SequenceWorkspaceArtifactPublisher;
}): React.ReactElement {
  if (artifacts.length === 0)
    return (
      <p className="text-xs text-token-text-secondary">
        Generated alignments, trees, and exports appear here.
      </p>
    );
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {artifacts
        .slice(-10)
        .reverse()
        .map((artifact) => (
          <div
            className="flex items-center justify-between gap-2 rounded border border-token-border bg-token-main-surface-primary p-2"
            key={artifact.id}
          >
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">
                {artifact.name}
              </div>
              <div className="text-[10px] text-token-text-secondary">
                {artifact.provenance.engine}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {publisher == null ? (
                <span
                  className="text-[10px] text-token-text-secondary"
                  role="status"
                >
                  Workspace export is unavailable for this viewer.
                </span>
              ) : (
                <WorkspacePublishButton
                  artifact={preparedWorkspaceArtifact(
                    artifact,
                    publisher,
                    nativeSourceSafe,
                  )}
                  className={actionClass}
                  publisher={publisher}
                />
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function preparedWorkspaceArtifact(
  artifact: WorkbenchArtifact,
  publisher: SequenceWorkspaceArtifactPublisher,
  nativeSourceSafe: boolean,
): PreparedSequenceWorkspaceArtifact {
  const useNativeRichGeneration =
    publisher.supportsNativeRichGeneration === true &&
    nativeSourceSafe &&
    artifact.provenance.sourceRevision === 0 &&
    artifact.provenance.parameters.scope === "all" &&
    artifact.format !== "newick" &&
    artifact.format !== "json";
  return {
    ...(useNativeRichGeneration
      ? {
          serverGeneration: {
            compression: "none" as const,
            kind: "native-rich" as const,
          },
        }
      : { content: artifact.content }),
    format: artifact.format as PreparedSequenceWorkspaceArtifact["format"],
    mediaType: artifact.mediaType,
    name: artifact.name,
    provenance: artifact.provenance,
  };
}

const actionClass =
  "rounded-md border border-token-border bg-token-main-surface-primary px-2.5 py-1 text-xs font-medium text-token-text-secondary hover:bg-token-main-surface-secondary hover:text-token-text-primary disabled:cursor-not-allowed disabled:opacity-40";
const activeActionClass =
  "rounded-md border border-token-border bg-token-main-surface-secondary px-2.5 py-1 text-xs font-medium text-token-text-primary shadow-sm";
const inputClass =
  "w-20 rounded-md border border-token-border bg-token-input-background px-2 py-1 text-xs text-token-text-primary outline-none focus:border-token-focus-border";
