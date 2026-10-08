import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import type {
  MsaDocument,
  MsaMetricTrackKey,
  MsaRowSortDirection,
  MsaRowSortKey,
} from "./msa/types";
import type { SequenceInterfaceSettings } from "./sequence/interface-state";
import type { SequenceDocument, SequenceSelection } from "./sequence/types";
import type { SequenceTrack } from "./sequence/tracks";
import { parseAndValidateWorkbenchSession } from "./workbench-session-validation";

export type WorkbenchMode = "alignment" | "sequence";

export type WorkbenchJobKind =
  | "align"
  | "distance-matrix"
  | "guide-tree"
  | "orfs"
  | "primers"
  | "quality-report"
  | "restriction-analysis"
  | "statistics"
  | "translation";

export type WorkbenchJob = {
  completedAt?: number;
  error?: string;
  id: string;
  kind: WorkbenchJobKind;
  message: string;
  parameters: Record<string, unknown>;
  progress: number;
  result?: Record<string, unknown>;
  startedAt: number;
  status: "cancelled" | "completed" | "failed" | "running";
};

export type WorkbenchArtifact = {
  content: string;
  createdAt: number;
  format: string;
  id: string;
  mediaType: string;
  name: string;
  provenance: {
    engine: string;
    parameters: Record<string, unknown>;
    sourceRevision: number;
  };
};

export type WorkbenchArtifactSummary = Omit<WorkbenchArtifact, "content">;

export function summarizeWorkbenchArtifact({
  content: _content,
  ...artifact
}: WorkbenchArtifact): WorkbenchArtifactSummary {
  return artifact;
}

export type WorkbenchViewState = {
  alignment?: {
    analysisScope: string;
    cellWidth: number;
    colorMode: string;
    enabledMetricTracks?: Array<MsaMetricTrackKey>;
    referenceMode: string;
    residuePalette: string | null;
    rowFilter: string;
    rowSortDirection?: MsaRowSortDirection;
    rowSortKey?: MsaRowSortKey;
    searchScope: string;
    selectedColumns: { end: number; start: number } | null;
    selectedRows: Array<string>;
    showAnnotationTracks: boolean;
    showIdenticalAsDots: boolean;
    showRnaStructureOverlays: boolean;
    showSequenceLogoHelp?: boolean;
  };
  mode: WorkbenchMode;
  sequence?: {
    geneticCodeId: number;
    interface?: SequenceInterfaceSettings;
    layout: "circular" | "linear" | "split";
    orientation: "forward" | "reverse-complement";
    paletteId: string;
    selectedFeatureId: string | null;
    selectedRecordId: string;
    selection: SequenceSelection | null;
    showFeatures: boolean;
    showQuality: boolean;
    showTranslation: boolean;
    synchronizedViews: boolean;
    viewport: { end: number; start: number } | null;
    wrapWidth: number;
  };
};

export type WorkbenchSession = {
  artifacts: Array<WorkbenchArtifact>;
  createdAt: number;
  dirty: boolean;
  jobs: Array<WorkbenchJob>;
  revision: number;
  schemaVersion: 1;
  snapshot?: {
    alignmentDocument?: MsaDocument;
    sequenceDocument?: SequenceDocument;
  };
  source: {
    fileName: string | null;
    format: string;
    stateKey?: string | null;
  };
  tracks: Array<SequenceTrack>;
  view: WorkbenchViewState;
};

export type WorkbenchSharedState = {
  artifacts: Array<WorkbenchArtifact>;
  dirty: boolean;
  jobs: Array<WorkbenchJob>;
  revision: number;
  tracks: Array<SequenceTrack>;
};

export type WorkbenchSharedAction =
  | { artifact: WorkbenchArtifact; type: "add-artifact" }
  | { id: string; type: "cancel-job" }
  | { job: WorkbenchJob; type: "start-job" }
  | {
      completedAt: number;
      id: string;
      message: string;
      result: Record<string, unknown>;
      type: "complete-job";
    }
  | {
      completedAt: number;
      error: string;
      id: string;
      type: "fail-job";
    }
  | { track: SequenceTrack; type: "add-track" }
  | { id: string; type: "remove-track" }
  | { state: WorkbenchSharedState; type: "restore-shared" }
  | { dirty: boolean; type: "set-dirty" };

export type SequenceWorkbenchState = WorkbenchSharedState & {
  document: SequenceDocument;
  /** Immutable opened source; histories and saved edit copies do not replace it. */
  sourceDocument: SequenceDocument;
  future: Array<{ document: SequenceDocument; description: string }>;
  history: Array<{ document: SequenceDocument; description: string }>;
};

export type SequenceWorkbenchAction =
  | WorkbenchSharedAction
  | {
      document: SequenceDocument;
      sourceDocument?: SequenceDocument;
      type: "reset-sequence-document";
    }
  | {
      description: string;
      document: SequenceDocument;
      type: "apply-sequence-document";
    }
  | {
      description: string;
      document: SequenceDocument;
      type: "restore-sequence-document";
    }
  | { type: "redo-sequence-document" }
  | { type: "undo-sequence-document" };

export type AlignmentWorkbenchState = WorkbenchSharedState & {
  document: MsaDocument;
  future: Array<{ document: MsaDocument; description: string }>;
  history: Array<{ document: MsaDocument; description: string }>;
  selectedRows: Array<string>;
};

export type AlignmentWorkbenchAction =
  | WorkbenchSharedAction
  | { document: MsaDocument; type: "reset-alignment-document" }
  | { document: MsaDocument; type: "replace-alignment-view-document" }
  | {
      description: string;
      document: MsaDocument;
      type: "apply-alignment-document";
    }
  | { rowIds: Array<string>; type: "select-alignment-rows" }
  | { type: "redo-alignment-document" }
  | { type: "undo-alignment-document" };

export function createSequenceWorkbenchState(
  document: SequenceDocument,
  sourceDocument: SequenceDocument = document,
): SequenceWorkbenchState {
  return {
    ...createSharedState(),
    document: markChangedEvidenceCoordinates(document, sourceDocument, false),
    sourceDocument,
    future: [],
    history: [],
  };
}

export function createAlignmentWorkbenchState(
  document: MsaDocument,
): AlignmentWorkbenchState {
  return {
    ...createSharedState(),
    document,
    future: [],
    history: [],
    selectedRows: [],
  };
}

export function sequenceWorkbenchReducer(
  state: SequenceWorkbenchState,
  action: SequenceWorkbenchAction,
): SequenceWorkbenchState {
  if (action.type === "reset-sequence-document") {
    return createSequenceWorkbenchState(
      action.document,
      action.sourceDocument ?? action.document,
    );
  }
  if (
    action.type === "apply-sequence-document" ||
    action.type === "restore-sequence-document"
  ) {
    const restoring = action.type === "restore-sequence-document";
    const document = markChangedEvidenceCoordinates(
      action.document,
      restoring ? state.sourceDocument : state.document,
      !restoring,
    );
    return {
      ...state,
      dirty: true,
      document,
      future: [],
      history: pushBoundedHistory(state.history, {
        description: action.description,
        document: state.document,
      }),
      revision: state.revision + 1,
    };
  }
  if (action.type === "undo-sequence-document") {
    const previous = state.history.at(-1);
    if (previous == null) return state;
    return {
      ...state,
      document: previous.document,
      future: pushBoundedHistory(state.future, {
        description: previous.description,
        document: state.document,
      }),
      history: state.history.slice(0, -1),
      revision: state.revision + 1,
    };
  }
  if (action.type === "redo-sequence-document") {
    const next = state.future.at(-1);
    if (next == null) return state;
    return {
      ...state,
      document: next.document,
      future: state.future.slice(0, -1),
      history: pushBoundedHistory(state.history, {
        description: next.description,
        document: state.document,
      }),
      revision: state.revision + 1,
    };
  }
  return applySharedAction(state, action);
}

function markChangedEvidenceCoordinates(
  document: SequenceDocument,
  comparison: SequenceDocument,
  preserveComparisonStale: boolean,
): SequenceDocument {
  const previousRecords = new Map(
    comparison.records.map((record) => [record.id, record]),
  );
  const records = document.records.map((record) => {
    const previous = previousRecords.get(record.id);
    const sourceChanged =
      previous == null ||
      previous.sequence !== record.sequence ||
      previous.length !== record.length ||
      previous.sourceLabel !== record.sourceLabel;
    return record.evidenceCoordinatesStale !== true &&
      (sourceChanged ||
        (preserveComparisonStale &&
          previous?.evidenceCoordinatesStale === true))
      ? { ...record, evidenceCoordinatesStale: true }
      : record;
  });
  return records.some((record, index) => record !== document.records[index])
    ? { ...document, records }
    : document;
}

export function alignmentWorkbenchReducer(
  state: AlignmentWorkbenchState,
  action: AlignmentWorkbenchAction,
): AlignmentWorkbenchState {
  if (action.type === "reset-alignment-document") {
    return createAlignmentWorkbenchState(action.document);
  }
  if (action.type === "replace-alignment-view-document") {
    return { ...state, document: action.document };
  }
  if (action.type === "apply-alignment-document") {
    const available = new Set(action.document.rows.map(({ id }) => id));
    return {
      ...state,
      dirty: true,
      document: action.document,
      future: [],
      history: pushBoundedHistory(state.history, {
        description: action.description,
        document: state.document,
      }),
      revision: state.revision + 1,
      selectedRows: state.selectedRows.filter((id) => available.has(id)),
    };
  }
  if (action.type === "select-alignment-rows") {
    const available = new Set(state.document.rows.map(({ id }) => id));
    return {
      ...state,
      selectedRows: [...new Set(action.rowIds)].filter((id) =>
        available.has(id),
      ),
    };
  }
  if (action.type === "undo-alignment-document") {
    const previous = state.history.at(-1);
    if (previous == null) return state;
    return {
      ...state,
      document: previous.document,
      future: pushBoundedHistory(state.future, {
        description: previous.description,
        document: state.document,
      }),
      history: state.history.slice(0, -1),
      revision: state.revision + 1,
    };
  }
  if (action.type === "redo-alignment-document") {
    const next = state.future.at(-1);
    if (next == null) return state;
    return {
      ...state,
      document: next.document,
      future: state.future.slice(0, -1),
      history: pushBoundedHistory(state.history, {
        description: next.description,
        document: state.document,
      }),
      revision: state.revision + 1,
    };
  }
  return applySharedAction(state, action);
}

export function serializeWorkbenchSession(session: WorkbenchSession): string {
  const serialized = JSON.stringify(session, null, 2);
  if (
    utf8ByteLength(serialized) > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes
  ) {
    throw new Error(
      `Workbench session exceeds the ${SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes.toLocaleString()}-byte session budget. Remove large tracks or results before saving.`,
    );
  }
  return serialized;
}

export function parseWorkbenchSession(value: string): WorkbenchSession {
  try {
    return parseAndValidateWorkbenchSession(value);
  } catch (error) {
    throw new Error(
      `This is not a compatible Biological Sequence Viewer session: ${error instanceof Error ? error.message : "validation failed"}`,
    );
  }
}

export function settleRestoredJobs(
  jobs: Array<WorkbenchJob>,
  restoredAt = Date.now(),
): Array<WorkbenchJob> {
  return jobs.map((job) =>
    job.status === "running"
      ? {
          ...job,
          completedAt: restoredAt,
          message:
            "Cancelled when the saved session was restored; run the analysis again on the restored copy.",
          status: "cancelled" as const,
        }
      : job,
  );
}

function createSharedState(): WorkbenchSharedState {
  return { artifacts: [], dirty: false, jobs: [], revision: 0, tracks: [] };
}

function applySharedAction<T extends WorkbenchSharedState>(
  state: T,
  action: WorkbenchSharedAction,
): T {
  switch (action.type) {
    case "add-artifact":
      if (
        utf8ByteLength(action.artifact.content) >
        SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes
      ) {
        throw new Error(
          `Artifact ${action.artifact.name} exceeds the ${SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes.toLocaleString()}-byte artifact budget.`,
        );
      }
      return {
        ...state,
        artifacts: pruneArtifactCache([
          ...state.artifacts.filter(({ id }) => id !== action.artifact.id),
          action.artifact,
        ]),
        revision: state.revision + 1,
      };
    case "add-track":
      return {
        ...state,
        dirty: true,
        revision: state.revision + 1,
        tracks: [
          ...state.tracks.filter(({ id }) => id !== action.track.id),
          action.track,
        ],
      };
    case "remove-track":
      return {
        ...state,
        dirty: true,
        revision: state.revision + 1,
        tracks: state.tracks.filter(({ id }) => id !== action.id),
      };
    case "start-job":
      return {
        ...state,
        jobs: [
          ...state.jobs.filter(({ id }) => id !== action.job.id),
          action.job,
        ].slice(-100),
        revision: state.revision + 1,
      };
    case "complete-job":
      if (
        utf8ByteLength(JSON.stringify(action.result)) >
        SEQUENCE_VIEWER_LIMITS.analysis.maxResultBytes
      ) {
        return updateJob(state, action.id, (job) => ({
          ...job,
          completedAt: action.completedAt,
          error:
            "The result exceeded the bounded live-result budget. Narrow the row set, coordinate range, or requested result count and retry.",
          message:
            "Result was too large for the bounded live workbench. Refine the request and retry.",
          status: "failed",
        }));
      }
      return updateJob(state, action.id, (job) => ({
        ...job,
        completedAt: action.completedAt,
        message: action.message,
        progress: 1,
        result: action.result,
        status: "completed",
      }));
    case "fail-job":
      return updateJob(state, action.id, (job) => ({
        ...job,
        completedAt: action.completedAt,
        error: action.error,
        message: action.error,
        status: "failed",
      }));
    case "cancel-job":
      return updateJob(state, action.id, (job) => ({
        ...job,
        completedAt: Date.now(),
        message: "Cancelled",
        status: "cancelled",
      }));
    case "restore-shared":
      return { ...state, ...action.state, revision: state.revision + 1 };
    case "set-dirty":
      return { ...state, dirty: action.dirty, revision: state.revision + 1 };
  }
}

function pruneArtifactCache(
  artifacts: Array<WorkbenchArtifact>,
): Array<WorkbenchArtifact> {
  const retained = artifacts.slice(
    -SEQUENCE_VIEWER_LIMITS.session.maxArtifacts,
  );
  let totalBytes = retained.reduce(
    (sum, artifact) => sum + utf8ByteLength(artifact.content),
    0,
  );
  while (
    retained.length > 1 &&
    totalBytes > SEQUENCE_VIEWER_LIMITS.session.maxArtifactCacheBytes
  ) {
    const removed = retained.shift();
    totalBytes -= removed == null ? 0 : utf8ByteLength(removed.content);
  }
  return retained;
}

function updateJob<T extends WorkbenchSharedState>(
  state: T,
  id: string,
  update: (job: WorkbenchJob) => WorkbenchJob,
): T {
  if (!state.jobs.some((job) => job.id === id)) return state;
  return {
    ...state,
    jobs: state.jobs.map((job) => (job.id === id ? update(job) : job)),
    revision: state.revision + 1,
  };
}

function pushBoundedHistory<T>(items: Array<T>, item: T): Array<T> {
  return [...items, item].slice(-50);
}
