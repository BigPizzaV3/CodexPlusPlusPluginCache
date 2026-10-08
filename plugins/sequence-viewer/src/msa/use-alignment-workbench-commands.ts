import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
} from "react";

import { parseSequenceTrack } from "../sequence/tracks";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import { queryAlignmentViewer } from "../viewer-query";
import { exportAlignmentWorkbench } from "../workbench-exports";
import {
  parseWorkbenchSession,
  serializeWorkbenchSession,
  settleRestoredJobs,
  summarizeWorkbenchArtifact,
  type AlignmentWorkbenchAction,
  type AlignmentWorkbenchState,
  type WorkbenchArtifact,
  type WorkbenchJob,
  type WorkbenchSession,
  type WorkbenchViewState,
} from "../workbench-state";
import { exportAlignedFasta } from "./alignment-editing";
import { createAlignmentExportParameters } from "./alignment-export-provenance";
import type { MsaDerivedAnalysis } from "./analysis";
import { isGuideTreeResult, type GuideTreeResult } from "./phylogenetic-tree";
import type { MsaMotifSearchHit } from "./search";
import type { MsaColumnRange, MsaDocument, MsaSequenceRow } from "./types";
import {
  applyAlignmentEditRequest,
  realignRows,
  runAlignmentAnalysis,
} from "./workbench-controller";

export type AlignmentWorkbenchView = NonNullable<
  WorkbenchViewState["alignment"]
>;

export function useAlignmentWorkbenchCommands({
  analysis,
  cancelledJobsRef,
  command,
  dispatch,
  documentFileName,
  handledCommandIdRef,
  hits,
  onCommandResult,
  onRestoreView,
  onSetTree,
  selectedColumns,
  sourceStateKey,
  state,
  tree,
  view,
  visibleRows,
}: {
  analysis: MsaDerivedAnalysis | null;
  cancelledJobsRef: MutableRefObject<Set<string>>;
  command?: QueuedSequenceViewerCommand;
  dispatch: Dispatch<AlignmentWorkbenchAction>;
  documentFileName?: string;
  handledCommandIdRef: MutableRefObject<string | undefined>;
  hits: Array<MsaMotifSearchHit>;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void | Promise<SequenceViewerCommandResult>;
  onRestoreView: (view: AlignmentWorkbenchView) => void;
  onSetTree: (
    tree: GuideTreeResult | null,
    sourceDocument?: MsaDocument,
  ) => void;
  selectedColumns: MsaColumnRange | null;
  sourceStateKey: string;
  state: AlignmentWorkbenchState;
  tree: GuideTreeResult | null;
  view: AlignmentWorkbenchView;
  visibleRows: Array<MsaSequenceRow>;
}): void {
  const stateRef = useRef(state);
  stateRef.current = state;
  const complete = useCallback(
    (
      result: SequenceViewerCommandResult,
    ): void | Promise<SequenceViewerCommandResult> => {
      if (command == null) return;
      handledCommandIdRef.current = command.commandId;
      return onCommandResult?.(command, result);
    },
    [command, handledCommandIdRef, onCommandResult],
  );
  useEffect(() => {
    if (
      command == null ||
      !isAlignmentOperation(command) ||
      handledCommandIdRef.current === command.commandId
    ) {
      return;
    }
    try {
      switch (command.action) {
        case "query_viewer": {
          const query = queryAlignmentViewer({
            analysis,
            artifacts: state.artifacts,
            document: state.document,
            hits,
            jobs: state.jobs,
            request: command.request,
            tracks: state.tracks,
            tree,
          });
          complete({
            applied: true,
            message: `Returned ${command.request.target} from the live Alignment viewer.`,
            state: { query },
          });
          return;
        }
        case "run_analysis": {
          const sourceDocument = state.document;
          const job = createJob(
            command.jobId,
            command.request.analysis === "build-tree"
              ? "guide-tree"
              : "distance-matrix",
            command.request,
          );
          cancelledJobsRef.current.delete(job.id);
          dispatch({ job, type: "start-job" });
          window.setTimeout(() => {
            if (cancelledJobsRef.current.has(job.id)) return;
            if (stateRef.current.document !== sourceDocument) {
              failStaleJob(dispatch, job.id);
              return;
            }
            try {
              const result = runAlignmentAnalysis({
                document: sourceDocument,
                request: command.request,
              });
              if (cancelledJobsRef.current.has(job.id)) return;
              if (stateRef.current.document !== sourceDocument) {
                failStaleJob(dispatch, job.id);
                return;
              }
              if (command.request.analysis === "build-tree") {
                onSetTree(result.tree as GuideTreeResult, sourceDocument);
              }
              dispatch({
                completedAt: Date.now(),
                id: job.id,
                message: `${job.kind} completed.`,
                result,
                type: "complete-job",
              });
            } catch (error) {
              dispatch({
                completedAt: Date.now(),
                error:
                  error instanceof Error ? error.message : "Analysis failed.",
                id: job.id,
                type: "fail-job",
              });
            }
          }, 0);
          complete({
            applied: true,
            message: `Started ${command.request.analysis} as job ${job.id}.`,
            state: { job },
          });
          return;
        }
        case "align_sequences": {
          const sourceDocument = state.document;
          const job = createJob(command.jobId, "align", {
            algorithm: command.algorithm ?? null,
            rowIds: command.rowIds ?? null,
          });
          cancelledJobsRef.current.delete(job.id);
          dispatch({ job, type: "start-job" });
          window.setTimeout(() => {
            if (cancelledJobsRef.current.has(job.id)) return;
            if (stateRef.current.document !== sourceDocument) {
              failStaleJob(dispatch, job.id);
              return;
            }
            try {
              const result = realignRows({
                algorithm: command.algorithm,
                document: sourceDocument,
                rowIds: command.rowIds,
              });
              if (cancelledJobsRef.current.has(job.id)) return;
              if (stateRef.current.document !== sourceDocument) {
                failStaleJob(dispatch, job.id);
                return;
              }
              const artifact = createArtifact({
                content: exportAlignedFasta(result.document.rows),
                engine: result.engine,
                format: "aligned-fasta",
                mediaType: "text/x-fasta",
                name: `${baseName(documentFileName)}.realigned.fasta`,
                parameters: result.parameters,
                sourceRevision: state.revision,
              });
              dispatch({
                description: "Realigned selected rows in an editable copy.",
                document: result.document,
                type: "apply-alignment-document",
              });
              dispatch({ artifact, type: "add-artifact" });
              dispatch({
                completedAt: Date.now(),
                id: job.id,
                message: "Alignment completed.",
                result: {
                  alignedLength: result.document.alignedLength,
                  artifact: summarizeWorkbenchArtifact(artifact),
                  rowCount: result.document.rows.length,
                  warning: result.warning,
                },
                type: "complete-job",
              });
            } catch (error) {
              dispatch({
                completedAt: Date.now(),
                error:
                  error instanceof Error ? error.message : "Alignment failed.",
                id: job.id,
                type: "fail-job",
              });
            }
          }, 0);
          complete({
            applied: true,
            message: `Started exploratory realignment as job ${job.id}.`,
            state: { job },
          });
          return;
        }
        case "edit_copy": {
          const change = applyAlignmentEditRequest({
            document: state.document,
            request: command.request,
            tree,
          });
          if ("historyOperation" in change) {
            dispatch({
              type:
                change.historyOperation === "undo"
                  ? "undo-alignment-document"
                  : "redo-alignment-document",
            });
          } else {
            dispatch({
              description: change.description,
              document: change.document,
              type: "apply-alignment-document",
            });
          }
          complete({
            applied: true,
            message:
              "historyOperation" in change
                ? `${change.historyOperation === "undo" ? "Undid" : "Redid"} the most recent alignment-copy edit.`
                : change.description,
            state: { dirty: true, sourceFileOverwritten: false },
          });
          return;
        }
        case "load_track": {
          const content =
            command.encoding === "utf8"
              ? command.content
              : Uint8Array.from(atob(command.content), (symbol) =>
                  symbol.charCodeAt(0),
                );
          const track = parseSequenceTrack({
            content,
            displayName: command.displayName,
            format: command.format,
            id: command.trackId,
            requestedReference: command.reference,
            sourceItemCount: command.sourceItemCount,
            sourceTruncated: command.sourceTruncated,
          });
          dispatch({ track, type: "add-track" });
          complete({
            applied: true,
            message: `Loaded ${track.name} with ${track.summary.itemCount.toLocaleString()} items.`,
            state: { track },
          });
          return;
        }
        case "export_artifact": {
          if (
            command.format !== "a3m" &&
            command.format !== "aligned-fasta" &&
            command.format !== "clustal" &&
            command.format !== "json" &&
            command.format !== "newick" &&
            command.format !== "pdf" &&
            command.format !== "stockholm" &&
            command.format !== "svg" &&
            command.format !== "tsv"
          ) {
            throw new Error(
              `${command.format} is available only while the viewer is in Sequence mode.`,
            );
          }
          const output = exportAlignmentWorkbench({
            document: state.document,
            format: command.format,
            name: command.name,
            newick: tree?.newick,
            scope: command.scope,
            selectedColumns,
            selectedRows: state.selectedRows,
            visibleRows,
          });
          const artifact = createArtifact({
            ...output,
            engine: "sequence-viewer-alignment-export-v1",
            parameters: createAlignmentExportParameters({
              format: command.format,
              scope: command.scope,
              tree,
            }),
            sourceRevision: state.revision,
          });
          const completion = complete({
            applied: true,
            message: `Prepared ${output.name} for download.`,
            state: { artifact: output, provenance: artifact.provenance },
          });
          if (completion == null) {
            dispatch({ artifact, type: "add-artifact" });
          } else {
            void completion.then(
              ({ applied }) => {
                if (applied) dispatch({ artifact, type: "add-artifact" });
              },
              () => undefined,
            );
          }
          return;
        }
        case "save_session": {
          complete({
            applied: true,
            message: "Serialized the current Alignment workbench session.",
            state: {
              session: serializeWorkbenchSession(
                createAlignmentWorkbenchSession(
                  state,
                  view,
                  documentFileName,
                  sourceStateKey,
                ),
              ),
            },
          });
          return;
        }
        case "restore_session": {
          const session = parseWorkbenchSession(command.session);
          if (
            session.view.mode !== "alignment" ||
            session.view.alignment == null
          ) {
            throw new Error(
              "The saved session is not an Alignment-mode workbench session.",
            );
          }
          if (
            session.source.fileName !== (documentFileName ?? null) ||
            session.source.format !== state.document.format ||
            session.source.stateKey !== sourceStateKey
          ) {
            throw new Error(
              "The saved session belongs to a different source artifact and was not applied.",
            );
          }
          if (session.snapshot?.alignmentDocument != null) {
            dispatch({
              description: "Restored saved alignment-copy state.",
              document: session.snapshot.alignmentDocument,
              type: "apply-alignment-document",
            });
          }
          dispatch({
            state: {
              artifacts: session.artifacts,
              dirty: session.dirty,
              jobs: settleRestoredJobs(session.jobs),
              revision: state.revision,
              tracks: session.tracks,
            },
            type: "restore-shared",
          });
          onRestoreView(session.view.alignment);
          const restoredTree = [...session.jobs]
            .reverse()
            .find(
              ({ kind, status }) =>
                kind === "guide-tree" && status === "completed",
            )?.result?.tree;
          if (isGuideTreeResult(restoredTree)) {
            onSetTree(restoredTree, session.snapshot?.alignmentDocument);
          }
          complete({
            applied: true,
            message: "Restored the saved Alignment workbench session.",
            state: { restoredRevision: session.revision },
          });
          return;
        }
        case "cancel_job": {
          const job = state.jobs.find(({ id }) => id === command.jobId);
          if (job == null)
            throw new Error(`No workbench job matched ${command.jobId}.`);
          if (job.status !== "running") {
            complete({
              applied: false,
              message: `Job ${job.id} is already ${job.status}.`,
              state: { job },
            });
            return;
          }
          cancelledJobsRef.current.add(job.id);
          dispatch({ id: job.id, type: "cancel-job" });
          complete({
            applied: true,
            message: `Cancelled ${job.kind} job ${job.id}.`,
            state: { jobId: job.id, status: "cancelled" },
          });
          return;
        }
        case "manage_annotations":
          throw new Error(
            "Sequence feature annotation editing is available in Sequence mode; alignment column tracks remain preserved as alignment metadata.",
          );
      }
    } catch (error) {
      complete({
        applied: false,
        message:
          error instanceof Error
            ? error.message
            : "The Alignment workbench command could not be completed.",
      });
    }
  }, [
    analysis,
    cancelledJobsRef,
    command,
    complete,
    dispatch,
    documentFileName,
    handledCommandIdRef,
    hits,
    onRestoreView,
    onSetTree,
    selectedColumns,
    sourceStateKey,
    state,
    tree,
    view,
    visibleRows,
  ]);
}

export function isAlignmentOperation(
  command: QueuedSequenceViewerCommand | undefined,
): boolean {
  return (
    command?.action === "query_viewer" ||
    command?.action === "run_analysis" ||
    command?.action === "align_sequences" ||
    command?.action === "edit_copy" ||
    command?.action === "manage_annotations" ||
    command?.action === "load_track" ||
    command?.action === "export_artifact" ||
    command?.action === "save_session" ||
    command?.action === "restore_session" ||
    command?.action === "cancel_job"
  );
}

function createJob(
  id: string,
  kind: WorkbenchJob["kind"],
  parameters: Record<string, unknown>,
): WorkbenchJob {
  return {
    id,
    kind,
    message: "Queued in the viewer",
    parameters,
    progress: 0,
    startedAt: Date.now(),
    status: "running",
  };
}

function failStaleJob(
  dispatch: Dispatch<AlignmentWorkbenchAction>,
  id: string,
): void {
  dispatch({
    completedAt: Date.now(),
    error:
      "The source alignment changed before this job completed. Run it again on the current copy.",
    id,
    type: "fail-job",
  });
}

export function createAlignmentWorkbenchSession(
  state: AlignmentWorkbenchState,
  view: AlignmentWorkbenchView,
  fileName: string | undefined,
  sourceStateKey: string,
): WorkbenchSession {
  return {
    artifacts: state.artifacts.filter(
      ({ format }) => format !== "sequence-viewer-session",
    ),
    createdAt: Date.now(),
    dirty: state.dirty,
    jobs: state.jobs,
    revision: state.revision,
    schemaVersion: 1,
    snapshot: { alignmentDocument: state.document },
    source: {
      fileName: fileName ?? null,
      format: state.document.format,
      stateKey: sourceStateKey,
    },
    tracks: state.tracks,
    view: { alignment: view, mode: "alignment" },
  };
}

function createArtifact({
  content,
  engine,
  format,
  mediaType,
  name,
  parameters,
  sourceRevision,
}: {
  content: string;
  engine: string;
  format: string;
  mediaType: string;
  name: string;
  parameters: Record<string, unknown>;
  sourceRevision: number;
}): WorkbenchArtifact {
  return {
    content,
    createdAt: Date.now(),
    format,
    id: crypto.randomUUID(),
    mediaType,
    name,
    provenance: { engine, parameters, sourceRevision },
  };
}

function baseName(fileName: string | undefined): string {
  const leaf = fileName?.split(/[\\/]/u).at(-1) ?? "alignment";
  return leaf.replace(/\.[^.]+$/u, "") || "alignment";
}
