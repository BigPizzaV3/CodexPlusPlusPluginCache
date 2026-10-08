import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
} from "react";

import { alignSequences, exportAlignedFasta } from "../msa/alignment-editing";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import { querySequenceViewer } from "../viewer-query";
import { exportSequenceWorkbench } from "../workbench-exports";
import {
  createSequenceWorkbenchState,
  parseWorkbenchSession,
  sequenceWorkbenchReducer,
  serializeWorkbenchSession,
  settleRestoredJobs,
  summarizeWorkbenchArtifact,
  type SequenceWorkbenchAction,
  type SequenceWorkbenchState,
  type WorkbenchArtifact,
  type WorkbenchJob,
  type WorkbenchSession,
  type WorkbenchViewState,
} from "../workbench-state";
import { parseSequenceTrack } from "./tracks";
import type {
  SequenceDocument,
  SequenceSearchHit,
  SequenceSelection,
} from "./types";
import {
  analyzeFastqQualityReport,
  parseFastqAdapterSequence,
  summarizeFastqQualityReport,
  type FastqQualityReportState,
} from "./fastq-quality-analysis";
import {
  applySequenceAnnotationRequest,
  applySequenceEditRequest,
  resolveSequenceRecord,
  runSequenceAnalysis,
} from "./workbench-controller";

const OPERATION_ACTIONS = new Set([
  "align_sequences",
  "cancel_job",
  "edit_copy",
  "export_artifact",
  "load_track",
  "manage_annotations",
  "query_viewer",
  "restore_session",
  "run_analysis",
  "save_session",
]);

export type SequenceWorkbenchView = NonNullable<WorkbenchViewState["sequence"]>;
export type SequenceWorkbenchRestoreSource = Pick<
  SequenceWorkbenchState,
  "document" | "tracks"
>;

export function isWorkbenchOperationCommand(
  command: QueuedSequenceViewerCommand | undefined,
): boolean {
  return command != null && OPERATION_ACTIONS.has(command.action);
}

export function useSequenceWorkbenchCommands({
  cancelledJobsRef,
  command,
  dispatch,
  handledCommandIdRef,
  hits,
  onCommandResult,
  onOpenAlignment,
  onQualityReportChange,
  onRestoreView,
  selectedRecordId,
  selection,
  sourceStateKey,
  state,
  view,
}: {
  cancelledJobsRef: MutableRefObject<Set<string>>;
  command?: QueuedSequenceViewerCommand;
  dispatch: Dispatch<SequenceWorkbenchAction>;
  handledCommandIdRef: MutableRefObject<string | undefined>;
  hits: Array<SequenceSearchHit>;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void | Promise<SequenceViewerCommandResult>;
  onOpenAlignment?: (alignedFasta: string, name: string) => void;
  onQualityReportChange?: (state: FastqQualityReportState) => void;
  onRestoreView: (
    view: SequenceWorkbenchView,
    source: SequenceWorkbenchRestoreSource,
  ) => void;
  selectedRecordId: string;
  selection?: SequenceSelection;
  sourceStateKey: string;
  state: SequenceWorkbenchState;
  view: SequenceWorkbenchView;
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
      !isWorkbenchOperationCommand(command) ||
      handledCommandIdRef.current === command.commandId
    ) {
      return;
    }
    try {
      switch (command.action) {
        case "query_viewer": {
          const query = querySequenceViewer({
            artifacts: state.artifacts,
            document: state.document,
            hits,
            jobs: state.jobs,
            request: command.request,
            selectedRecordId,
            tracks: state.tracks,
          });
          complete({
            applied: true,
            message: `Returned ${command.request.target} from the live Sequence viewer.`,
            state: { query },
          });
          return;
        }
        case "run_analysis": {
          const sourceDocument = state.document;
          if (command.request.analysis === "quality-report") {
            const job = scheduleQualityReportJob({
              adapterSequence: command.request.adapterSequence,
              cancelledJobsRef,
              dispatch,
              document: sourceDocument,
              id: command.jobId,
              isSourceCurrent: () =>
                stateRef.current.document === sourceDocument,
              onQualityReportChange,
            });
            complete({
              applied: true,
              message: `Started quality-report as job ${job.id}.`,
              state: { job },
            });
            return;
          }
          const job = createJob(
            command.jobId,
            analysisJobKind(command.request.analysis),
            command.request,
          );
          cancelledJobsRef.current.delete(job.id);
          dispatch({ job, type: "start-job" });
          scheduleJob({
            cancelledJobsRef,
            dispatch,
            isSourceCurrent: () => stateRef.current.document === sourceDocument,
            job,
            run: () =>
              runSequenceAnalysis({
                document: state.document,
                request: command.request,
                selectedRecordId,
                selection,
                viewerGeneticCodeId: view.geneticCodeId,
              }),
          });
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
            recordIds: command.recordIds ?? null,
          });
          cancelledJobsRef.current.delete(job.id);
          dispatch({ job, type: "start-job" });
          scheduleJob({
            cancelledJobsRef,
            dispatch,
            isSourceCurrent: () => stateRef.current.document === sourceDocument,
            job,
            onCompleted: (result) => {
              const artifact = result.artifact as WorkbenchArtifact | undefined;
              if (artifact == null) return result;
              dispatch({ artifact, type: "add-artifact" });
              onOpenAlignment?.(artifact.content, artifact.name);
              return {
                ...result,
                artifact: summarizeWorkbenchArtifact(artifact),
              };
            },
            run: () => {
              const requested =
                command.recordIds ?? state.document.records.map(({ id }) => id);
              const records = requested.map((selector) =>
                resolveSequenceRecord(state.document, selector),
              );
              if (records.length < 2) {
                throw new Error(
                  "Alignment generation requires at least two sequence records.",
                );
              }
              const alignment = alignSequences(
                records.map((record) => ({
                  description: record.description,
                  id: record.id,
                  label: record.sourceLabel,
                  sequence: record.sequence,
                })),
                undefined,
                command.algorithm,
              );
              const content = `${exportAlignedFasta(alignment.rows)}\n`;
              return {
                alignedLength: alignment.alignedLength,
                artifact: createArtifact({
                  content,
                  engine: alignment.engine,
                  format: "aligned-fasta",
                  mediaType: "text/x-fasta",
                  name: `${baseName(state.document.fileName)}.aligned.fasta`,
                  parameters: alignment.parameters,
                  sourceRevision: state.revision,
                }),
                engine: alignment.engine,
                rowCount: alignment.rows.length,
                warning: alignment.warning,
              };
            },
          });
          complete({
            applied: true,
            message: `Started exploratory alignment as job ${job.id}.`,
            state: { job },
          });
          return;
        }
        case "edit_copy": {
          const change = applySequenceEditRequest({
            document: state.document,
            request: command.request,
            selectedRecordId,
          });
          if ("historyOperation" in change) {
            dispatch({
              type:
                change.historyOperation === "undo"
                  ? "undo-sequence-document"
                  : "redo-sequence-document",
            });
          } else {
            dispatch({
              description: change.description,
              document: change.document,
              type: "apply-sequence-document",
            });
          }
          complete({
            applied: true,
            message:
              "historyOperation" in change
                ? `${change.historyOperation === "undo" ? "Undid" : "Redid"} the most recent sequence-copy edit.`
                : change.description,
            state: {
              dirty: true,
              operation:
                "historyOperation" in change
                  ? change.historyOperation
                  : change.operation,
              sourceFileOverwritten: false,
            },
          });
          return;
        }
        case "manage_annotations": {
          const change = applySequenceAnnotationRequest({
            document: state.document,
            request: command.request,
            selectedRecordId,
            tracks: state.tracks,
          });
          dispatch({
            description: change.description,
            document: change.document,
            type: "apply-sequence-document",
          });
          complete({
            applied: true,
            message: change.description,
            state: { dirty: true, sourceFileOverwritten: false },
          });
          return;
        }
        case "load_track": {
          const content = decodeTrackContent(command.content, command.encoding);
          const track = parseSequenceTrack({
            content,
            displayName: command.displayName,
            format: command.format,
            id: command.trackId,
            requestedReference: command.reference,
            sourceContentHash: command.sourceContentHash,
            sourceItemCount: command.sourceItemCount,
            sourceTruncated: command.sourceTruncated,
            sourceWorkspacePath: command.sourceWorkspacePath,
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
            command.format === "a3m" ||
            command.format === "aligned-fasta" ||
            command.format === "clustal" ||
            command.format === "newick" ||
            command.format === "stockholm"
          ) {
            throw new Error(
              `${command.format} is available only while the viewer is in Alignment mode.`,
            );
          }
          const output = exportSequenceWorkbench({
            document: state.document,
            format: command.format,
            name: command.name,
            recordId: selectedRecordId,
            scope: command.scope,
            selection,
            tracks: state.tracks,
          });
          const artifact = createArtifact({
            ...output,
            engine: "sequence-viewer-export-v1",
            parameters: { scope: command.scope },
            sourceRevision: state.revision,
          });
          const completion = complete({
            applied: true,
            message: `Prepared ${artifact.name} for download.`,
            state: {
              artifact: output,
              provenance: artifact.provenance,
            },
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
          const session = createSequenceWorkbenchSession(
            state,
            view,
            sourceStateKey,
          );
          complete({
            applied: true,
            message: "Serialized the current Sequence workbench session.",
            state: { session: serializeWorkbenchSession(session) },
          });
          return;
        }
        case "restore_session": {
          const session = parseWorkbenchSession(command.session);
          if (
            session.view.mode !== "sequence" ||
            session.view.sequence == null
          ) {
            throw new Error(
              "The saved session is not a Sequence-mode workbench session.",
            );
          }
          if (
            session.source.format !== state.document.format ||
            session.source.fileName !== (state.document.fileName ?? null) ||
            session.source.stateKey !== sourceStateKey
          ) {
            throw new Error(
              "The saved session belongs to a different source artifact and was not applied.",
            );
          }
          const snapshot = session.snapshot?.sequenceDocument;
          const restoredDocument =
            snapshot == null
              ? state.document
              : createSequenceWorkbenchState(snapshot, state.sourceDocument)
                  .document;
          // Validate source-bound presentation settings before changing the copy.
          onRestoreView(session.view.sequence, {
            document: restoredDocument,
            tracks: session.tracks,
          });
          if (snapshot != null) {
            dispatch({
              description: "Restored saved sequence-copy state.",
              document: restoredDocument,
              type: "restore-sequence-document",
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
          complete({
            applied: true,
            message: "Restored the saved Sequence workbench session.",
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
      }
    } catch (error) {
      complete({
        applied: false,
        message:
          error instanceof Error
            ? error.message
            : "The Sequence workbench command could not be completed.",
      });
    }
  }, [
    cancelledJobsRef,
    command,
    complete,
    dispatch,
    handledCommandIdRef,
    hits,
    onOpenAlignment,
    onQualityReportChange,
    onRestoreView,
    selectedRecordId,
    selection,
    sourceStateKey,
    state,
    view,
  ]);
}

export function runSequenceWorkbenchJob({
  analysis,
  cancelledJobsRef,
  dispatch,
  onQualityReportChange,
  selectedRecordId,
  selection,
  state,
  isSourceCurrent = () => true,
  viewerGeneticCodeId,
}: {
  analysis: Parameters<typeof runSequenceAnalysis>[0]["request"];
  cancelledJobsRef?: MutableRefObject<Set<string>>;
  dispatch: Dispatch<SequenceWorkbenchAction>;
  onQualityReportChange?: (state: FastqQualityReportState) => void;
  selectedRecordId: string;
  selection?: SequenceSelection;
  state: SequenceWorkbenchState;
  isSourceCurrent?: () => boolean;
  viewerGeneticCodeId: number;
}): string {
  const id = crypto.randomUUID();
  if (analysis.analysis === "quality-report") {
    scheduleQualityReportJob({
      adapterSequence: analysis.adapterSequence,
      cancelledJobsRef,
      dispatch,
      document: state.document,
      id,
      isSourceCurrent,
      onQualityReportChange,
    });
    return id;
  }
  const job = createJob(id, analysisJobKind(analysis.analysis), analysis);
  dispatch({ job, type: "start-job" });
  window.setTimeout(() => {
    if (!isSourceCurrent()) {
      failStaleJob(dispatch, id);
      return;
    }
    try {
      const result = runSequenceAnalysis({
        document: state.document,
        request: analysis,
        selectedRecordId,
        selection,
        viewerGeneticCodeId,
      });
      if (!isSourceCurrent()) {
        failStaleJob(dispatch, id);
        return;
      }
      dispatch({
        completedAt: Date.now(),
        id,
        message: `${analysis.analysis} completed.`,
        result: result as unknown as Record<string, unknown>,
        type: "complete-job",
      });
    } catch (error) {
      dispatch({
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : "Analysis failed.",
        id,
        type: "fail-job",
      });
    }
  }, 0);
  return id;
}

function scheduleQualityReportJob({
  adapterSequence: inputAdapter,
  cancelledJobsRef,
  dispatch,
  document,
  id,
  isSourceCurrent,
  onQualityReportChange,
}: {
  adapterSequence?: string;
  cancelledJobsRef?: MutableRefObject<Set<string>>;
  dispatch: Dispatch<SequenceWorkbenchAction>;
  document: SequenceDocument;
  id: string;
  isSourceCurrent: () => boolean;
  onQualityReportChange?: (state: FastqQualityReportState) => void;
}): WorkbenchJob {
  const adapterSequence = parseFastqAdapterSequence(inputAdapter);
  const job = createJob(id, "quality-report", {
    analysis: "quality-report",
    ...(adapterSequence == null ? {} : { adapterSequence }),
  });
  const pending: FastqQualityReportState = {
    adapterSequence,
    jobId: id,
    pending: true,
    report: null,
  };
  const isCancelled = (): boolean => cancelledJobsRef?.current.has(id) === true;
  const publishFailure = (message: string): void => {
    if (isSourceCurrent()) {
      onQualityReportChange?.({ ...pending, error: message, pending: false });
    }
  };
  cancelledJobsRef?.current.delete(id);
  dispatch({ job, type: "start-job" });
  if (isSourceCurrent()) onQualityReportChange?.(pending);
  window.setTimeout(() => {
    void (async () => {
      if (!isSourceCurrent()) {
        failStaleJob(dispatch, id);
        return;
      }
      if (isCancelled()) {
        publishFailure("Quality report cancelled.");
        return;
      }
      try {
        const report = summarizeFastqQualityReport(
          await analyzeFastqQualityReport(document, {
            adapterSequence: adapterSequence ?? undefined,
            isCancelled: () => isCancelled() || !isSourceCurrent(),
          }),
        );
        if (!isSourceCurrent()) {
          failStaleJob(dispatch, id);
          return;
        }
        if (isCancelled()) {
          publishFailure("Quality report cancelled.");
          return;
        }
        onQualityReportChange?.({ ...pending, pending: false, report });
        dispatch({
          completedAt: Date.now(),
          id,
          message: "quality-report completed.",
          result: report,
          type: "complete-job",
        });
      } catch (error) {
        if (!isSourceCurrent()) {
          failStaleJob(dispatch, id);
          return;
        }
        if (isCancelled()) {
          publishFailure("Quality report cancelled.");
          return;
        }
        const message =
          error instanceof Error ? error.message : "Quality analysis failed.";
        publishFailure(message);
        dispatch({
          completedAt: Date.now(),
          error: message,
          id,
          type: "fail-job",
        });
      }
    })();
  }, 0);
  return job;
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

function scheduleJob({
  cancelledJobsRef,
  dispatch,
  isSourceCurrent,
  job,
  onCompleted,
  run,
}: {
  cancelledJobsRef: MutableRefObject<Set<string>>;
  dispatch: Dispatch<SequenceWorkbenchAction>;
  isSourceCurrent: () => boolean;
  job: WorkbenchJob;
  onCompleted?: (
    result: Record<string, unknown>,
  ) => Record<string, unknown> | void;
  run: () => Record<string, unknown>;
}): void {
  window.setTimeout(() => {
    if (cancelledJobsRef.current.has(job.id)) return;
    if (!isSourceCurrent()) {
      failStaleJob(dispatch, job.id);
      return;
    }
    try {
      const result = run();
      if (cancelledJobsRef.current.has(job.id)) return;
      if (!isSourceCurrent()) {
        failStaleJob(dispatch, job.id);
        return;
      }
      const completedResult = onCompleted?.(result) ?? result;
      dispatch({
        completedAt: Date.now(),
        id: job.id,
        message: `${job.kind} completed.`,
        result: completedResult,
        type: "complete-job",
      });
    } catch (error) {
      if (cancelledJobsRef.current.has(job.id)) return;
      dispatch({
        completedAt: Date.now(),
        error:
          error instanceof Error
            ? error.message
            : `${job.kind} could not be completed.`,
        id: job.id,
        type: "fail-job",
      });
    }
  }, 0);
}

function failStaleJob(
  dispatch: Dispatch<SequenceWorkbenchAction>,
  id: string,
): void {
  dispatch({
    completedAt: Date.now(),
    error:
      "The source sequence changed before this job completed. Run it again on the current copy.",
    id,
    type: "fail-job",
  });
}

function analysisJobKind(
  analysis:
    | "build-tree"
    | "design-primers"
    | "distance-matrix"
    | "find-orfs"
    | "quality-report"
    | "restriction-analysis"
    | "statistics"
    | "translate",
): WorkbenchJob["kind"] {
  switch (analysis) {
    case "build-tree":
      return "guide-tree";
    case "design-primers":
      return "primers";
    case "distance-matrix":
      return "distance-matrix";
    case "find-orfs":
      return "orfs";
    case "quality-report":
      return "quality-report";
    case "restriction-analysis":
      return "restriction-analysis";
    case "statistics":
      return "statistics";
    case "translate":
      return "translation";
  }
}

export function createSequenceWorkbenchSession(
  state: SequenceWorkbenchState,
  view: SequenceWorkbenchView,
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
    snapshot: { sequenceDocument: state.document },
    source: {
      fileName: state.document.fileName ?? null,
      format: state.document.format,
      stateKey: sourceStateKey,
    },
    tracks: state.tracks,
    view: { mode: "sequence", sequence: view },
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

function decodeTrackContent(
  content: string,
  encoding: "base64" | "utf8",
): string | Uint8Array {
  if (encoding === "utf8") return content;
  const decoded = atob(content);
  return Uint8Array.from(decoded, (symbol) => symbol.charCodeAt(0));
}

function baseName(fileName: string | undefined): string {
  const leaf = fileName?.split(/[\\/]/u).at(-1) ?? "sequences";
  return leaf.replace(/\.[^.]+$/u, "") || "sequences";
}

// Keep the reducer import live in this module's type surface so bundlers and
// tests exercise the exact reducer used by the hook rather than a parallel
// state implementation.
void sequenceWorkbenchReducer;
