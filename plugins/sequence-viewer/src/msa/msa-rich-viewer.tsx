import clsx from "clsx";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
  type SetStateAction,
  type WheelEventHandler,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { createArtifactStateKey } from "../artifact-state-key";
import { useModelContext, type ModelContextUpdater } from "../model-context";
import {
  applySequenceDurableDocumentPatches,
  createDurableAlignmentState,
  SequenceDurableViewerStateContext,
} from "../persistent/durable-viewer-state";
import { resolveViewerTarget } from "../target-resolution";
import { Button } from "../ui/button";
import { RichPreviewMessage } from "../ui/status-panel";
import { WorkbenchTools } from "../ui/workbench-tools";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import type { SequenceViewerEditRequest } from "../viewer-operations";
import type { SequenceWorkspaceArtifactPublisher } from "../views/workbench-persistence";
import type { SequenceWorkspaceSessionClient } from "../views/workspace-sessions";
import { exportAlignmentWorkbench } from "../workbench-exports";
import {
  alignmentWorkbenchReducer,
  createAlignmentWorkbenchState,
  parseWorkbenchSession,
  serializeWorkbenchSession,
  settleRestoredJobs,
} from "../workbench-state";
import { workspaceSessionDefaultName } from "../workspace-session-controls";
import { exportAlignedFasta } from "./alignment-editing";
import { createAlignmentExportParameters } from "./alignment-export-provenance";
import {
  createMsaInteractionState,
  createMsaRowSetKey,
  msaInteractionReducer,
  type MsaReferenceMode,
} from "./alignment-state";
import { AlignmentWorkbenchPanel } from "./alignment-workbench-panel";
import { computeRowMetrics } from "./analysis";
import {
  MsaCellHoverDetails,
  type FocusedMsaCell,
  type MsaHoverCellDetails,
} from "./cell-hover-overlay";
import { inferCdsContext } from "./codon";
import { formatResiduePaletteLabel, MsaColorLegend } from "./color-legend";
import {
  getCompatibleResiduePalettes,
  getDefaultColorMode,
  getDefaultResiduePalette,
  isResiduePaletteCompatible,
  type MsaColorMode,
  type MsaResiduePalette,
} from "./colors";
import { getAlignmentColumnForUngappedPosition } from "./coordinate-map";
import { MsaExportActions } from "./export-actions";
import { MsaGuideTreePanel } from "./guide-tree-panel";
import { MsaMatrixRenderer } from "./matrix-renderer";
import { MsaMetadataPanel } from "./metadata-panel";
import {
  getAvailableMsaMetricTracks,
  getDefaultMsaMetricTracks,
  MsaMetricTrackControls,
  MsaMetricTracks,
} from "./metric-tracks";
import { createMsaViewerModelContext } from "./model-context";
import { MsaOverviewStrip } from "./overview-strip";
import { markMsaPreviewMilestone } from "./performance";
import {
  MsaPerformanceStateBanner,
  MsaProgressiveLoadingMessage,
} from "./performance-banners";
import {
  buildGuideTree,
  isGuideTreeResult,
  type GuideTreeAlgorithm,
  type GuideTreeResult,
} from "./phylogenetic-tree";
import { MsaPinnedInspector } from "./pinned-inspector";
import { classifyResidue } from "./residue-alphabet";
import { MsaRowsPanel } from "./rows-panel";
import type { MsaMotifSearchHit } from "./search";
import { MsaSearchResultsPanel } from "./search-results-panel";
import type {
  MsaAnalysisScope,
  MsaColumnRange,
  MsaDocument,
  MsaMetricTrackKey,
  MsaMoleculeType,
  MsaRowMetrics,
  MsaRowSortDirection,
  MsaRowSortKey,
  MsaSearchScope,
  MsaSequenceRow,
} from "./types";
import {
  isAlignmentOperation,
  createAlignmentWorkbenchSession,
  useAlignmentWorkbenchCommands,
  type AlignmentWorkbenchView,
} from "./use-alignment-workbench-commands";
import {
  useMsaDerivedAnalysis,
  useMsaMotifSearch,
  useParsedMsaDocument,
} from "./use-msa-document";
import { useMsaViewport } from "./use-msa-viewport";
import { MSA_CELL_WIDTH_PX } from "./virtualization";
import { MsaWarningsDrawer } from "./warnings-drawer";
import {
  applyAlignmentEditRequest,
  realignRows,
  runAlignmentAnalysis,
} from "./workbench-controller";

const DEFAULT_CELL_WIDTH_PX = MSA_CELL_WIDTH_PX;
const MIN_CELL_WIDTH_PX = 16;
const MAX_CELL_WIDTH_PX = 42;
const WINDOW_STEP = 24;
const LARGE_ALIGNMENT_ROW_THRESHOLD = 1_000;

function alignmentTreeInputKey(document: MsaDocument): string {
  return document.rows
    .filter(({ hidden }) => !hidden)
    .map(({ alignedSequence, id }) => ({ alignedSequence, id }))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ alignedSequence, id }) => `${id}\u001f${alignedSequence}`)
    .join("\u001e");
}

function resolveAlignmentRow(rows: Array<MsaSequenceRow>, selector: string) {
  return resolveViewerTarget({
    aliases: (row) => [row.label, row.sourceId],
    id: (row) => row.id,
    selector,
    targets: rows,
  });
}

function isMsaColorModeCompatible({
  cdsEligible,
  colorMode,
  moleculeType,
}: {
  cdsEligible: boolean;
  colorMode: MsaColorMode;
  moleculeType: MsaMoleculeType;
}): boolean {
  const nucleicAcid =
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous";
  if (colorMode === "coding-impact") {
    return cdsEligible;
  }
  if (colorMode === "nucleotide-substitution") {
    return nucleicAcid;
  }
  if (
    colorMode === "protein-conservation" ||
    colorMode === "protein-similarity"
  ) {
    return moleculeType === "protein";
  }
  return true;
}

export function MsaRichViewer({
  className,
  command,
  contents,
  fileName,
  onCommandResult,
  publishWorkspaceArtifact,
  showFileHeader = true,
  sourceStateKeyOverride,
  toolbarRevealed,
  toolbarVisible = true,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  className?: string;
  command?: QueuedSequenceViewerCommand;
  contents: string;
  fileName?: string;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  showFileHeader?: boolean;
  sourceStateKeyOverride?: string;
  toolbarRevealed?: boolean;
  toolbarVisible?: boolean;
  updateModelContext?: ModelContextUpdater;
  viewerSessionId?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  return (
    <MsaPreview
      className={className}
      command={command}
      contents={contents}
      filePath={fileName}
      formatHintPath={fileName}
      onCommandResult={onCommandResult}
      publishWorkspaceArtifact={publishWorkspaceArtifact}
      showFileHeader={showFileHeader}
      sourceStateKeyOverride={sourceStateKeyOverride}
      toolbarRevealed={toolbarRevealed}
      toolbarVisible={toolbarVisible}
      updateModelContext={updateModelContext}
      viewerSessionId={viewerSessionId}
      workspaceSessions={workspaceSessions}
    />
  );
}

export function MsaPreview({
  className,
  command,
  contents,
  formatHintPath,
  filePath,
  onCommandResult,
  publishWorkspaceArtifact,
  showFileHeader = true,
  sourceStateKeyOverride,
  toolbarRevealed,
  toolbarVisible = true,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  className?: string;
  command?: QueuedSequenceViewerCommand;
  contents: string;
  formatHintPath?: string;
  filePath?: string;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  showFileHeader?: boolean;
  sourceStateKeyOverride?: string;
  toolbarRevealed?: boolean;
  toolbarVisible?: boolean;
  updateModelContext?: ModelContextUpdater;
  viewerSessionId?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const documentPreviewKey = useMemo(
    () =>
      sourceStateKeyOverride ??
      createArtifactStateKey(contents, formatHintPath ?? filePath),
    [contents, filePath, formatHintPath, sourceStateKeyOverride],
  );
  const parsed = useParsedMsaDocument({
    contents,
    filePath: formatHintPath ?? filePath,
  });
  useEffect(() => {
    markMsaPreviewMilestone("load-start");
    markMsaPreviewMilestone("shell-mounted");
  }, [contents, filePath, formatHintPath]);
  useEffect(() => {
    if (parsed.phase === "parsed" || parsed.phase === "error") {
      markMsaPreviewMilestone("parsed");
    }
  }, [parsed.phase]);
  if (parsed.phase === "parsing") {
    return (
      <MsaPreviewShell
        className={className}
        filePath={filePath}
        showFileHeader={showFileHeader}
      >
        <MsaProgressiveLoadingMessage phase="parsing" />
      </MsaPreviewShell>
    );
  }
  if (parsed.phase === "error") {
    return (
      <MsaPreviewShell
        className={className}
        filePath={filePath}
        showFileHeader={showFileHeader}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <RichPreviewMessage className="max-w-md text-center">
            {parsed.message}
          </RichPreviewMessage>
        </div>
      </MsaPreviewShell>
    );
  }
  return (
    <MsaDocumentPreview
      className={className}
      command={command}
      document={parsed.document}
      filePath={filePath}
      key={documentPreviewKey}
      onCommandResult={onCommandResult}
      publishWorkspaceArtifact={publishWorkspaceArtifact}
      showFileHeader={showFileHeader}
      sourceStateKeyOverride={documentPreviewKey}
      toolbarRevealed={toolbarRevealed}
      toolbarVisible={toolbarVisible}
      updateModelContext={updateModelContext}
      viewerSessionId={viewerSessionId}
      workspaceSessions={workspaceSessions}
    />
  );
}

function MsaDocumentPreview({
  className,
  command,
  document: initialDocument,
  filePath,
  onCommandResult,
  publishWorkspaceArtifact,
  showFileHeader = true,
  sourceStateKeyOverride,
  toolbarRevealed,
  toolbarVisible = true,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  className?: string;
  command?: QueuedSequenceViewerCommand;
  document: MsaDocument;
  filePath?: string;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  showFileHeader?: boolean;
  sourceStateKeyOverride?: string;
  toolbarRevealed?: boolean;
  toolbarVisible?: boolean;
  updateModelContext?: ModelContextUpdater;
  viewerSessionId?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const durableViewerState = useContext(SequenceDurableViewerStateContext);
  const handledCommandIdRef = useRef<string | undefined>(undefined);
  const cancelledJobsRef = useRef(new Set<string>());
  const restoredCheckpointRef = useRef<string | null>(null);
  const restoredMotifQueryRef = useRef<string | null>(null);
  const restoredHitIndexRef = useRef<number | null>(null);
  const intl = useIntl();
  const [workbenchState, dispatchWorkbench] = useReducer(
    alignmentWorkbenchReducer,
    initialDocument,
    createAlignmentWorkbenchState,
  );
  const document = workbenchState.document;
  const sourceStateKey = useMemo(
    () =>
      sourceStateKeyOverride ??
      createArtifactStateKey(
        initialDocument.rows
          .map(({ id, alignedSequence }) => `${id}\u001f${alignedSequence}`)
          .join("\u001e"),
        filePath,
      ),
    [filePath, initialDocument, sourceStateKeyOverride],
  );
  const workbenchStateRef = useRef(workbenchState);
  workbenchStateRef.current = workbenchState;
  const setDocument = useCallback(
    (update: SetStateAction<MsaDocument>): void => {
      const current = workbenchStateRef.current.document;
      dispatchWorkbench({
        document: typeof update === "function" ? update(current) : update,
        type: "replace-alignment-view-document",
      });
    },
    [],
  );
  const [workbenchTree, setWorkbenchTree] = useState<GuideTreeResult | null>(
    null,
  );
  const treeSourceKeyRef = useRef<string | null>(null);
  const [workbenchError, setWorkbenchError] = useState<string>();
  const [interactionState, dispatchInteraction] = useReducer(
    msaInteractionReducer,
    initialDocument.rows[0]?.id ?? null,
    createMsaInteractionState,
  );
  const {
    anchorRowId,
    focusedCell,
    guideTree,
    pinnedCell,
    referenceMode,
    selectedHitIndex,
  } = interactionState;
  const guideTreeNewick = guideTree?.newick ?? null;
  const [showIdenticalAsDots, setShowIdenticalAsDots] = useState(false);
  const [showAnnotationTracks, setShowAnnotationTracks] = useState(true);
  const [showRnaStructureOverlays, setShowRnaStructureOverlays] =
    useState(true);
  const [enabledMetricTracks, setEnabledMetricTracks] = useState<
    Array<MsaMetricTrackKey>
  >(() => getDefaultMsaMetricTracks(initialDocument));
  const [showSequenceLogoHelp, setShowSequenceLogoHelp] = useState(false);
  const [rowSortKey, setRowSortKey] = useState<MsaRowSortKey>("source");
  const [rowSortDirection, setRowSortDirection] =
    useState<MsaRowSortDirection>("asc");
  const [analysisScope, setAnalysisScope] =
    useState<MsaAnalysisScope>("all-unhidden-rows");
  const [searchScope, setSearchScope] = useState<MsaSearchScope>(
    "currently-displayed-rows",
  );
  const [colorMode, setColorMode] = useState<MsaColorMode>(() =>
    getDefaultColorMode(initialDocument.displayInterpretation.moleculeType),
  );
  const [residuePalette, setResiduePalette] =
    useState<MsaResiduePalette | null>(() =>
      getDefaultResiduePalette(
        initialDocument.displayInterpretation.moleculeType,
      ),
    );
  const [rowFilter, setRowFilter] = useState("");
  const [alignmentColumnJump, setAlignmentColumnJump] = useState("");
  const [referencePositionJump, setReferencePositionJump] = useState("");
  const [motifQuery, setMotifQuery] = useState("");
  const [cellWidth, setCellWidth] = useState(DEFAULT_CELL_WIDTH_PX);
  const [hoverCellDetails, setHoverCellDetails] =
    useState<MsaHoverCellDetails>(null);
  const [selectedColumnRange, setSelectedColumnRange] =
    useState<MsaColumnRange | null>(null);
  const setReferenceMode = (mode: MsaReferenceMode): void =>
    dispatchInteraction({ mode, type: "set-reference-mode" });
  const setAnchorRowId = (anchorRowId: string | null): void =>
    dispatchInteraction({ anchorRowId, type: "set-anchor" });
  const setFocusedCell = (cell: FocusedMsaCell): void =>
    dispatchInteraction({ cell, type: "set-focus" });
  const setPinnedCell = (cell: FocusedMsaCell): void =>
    dispatchInteraction({ cell, type: "set-pinned" });
  const setSelectedHitIndex = (
    value: number | ((current: number) => number),
  ): void =>
    dispatchInteraction({
      index: typeof value === "function" ? value(selectedHitIndex) : value,
      type: "set-selected-hit",
    });
  const columnSelectionAnchorRef = useRef<number | null>(null);
  const clearSelectedColumnRange = useCallback((): void => {
    setSelectedColumnRange(null);
    columnSelectionAnchorRef.current = null;
  }, []);
  const clearSelection = useCallback((): void => {
    clearSelectedColumnRange();
    dispatchInteraction({ type: "clear-selection" });
    setHoverCellDetails(null);
  }, [clearSelectedColumnRange]);

  const visibleRows = useMemo(() => {
    const normalizedFilter = rowFilter.trim().toLowerCase();
    return document.rows.filter((row) => {
      if (row.hidden) {
        return false;
      }
      if (normalizedFilter.length === 0) {
        return true;
      }
      return `${row.label} ${row.description ?? ""}`
        .toLowerCase()
        .includes(normalizedFilter);
    });
  }, [document.rows, rowFilter]);
  const visibleRowIds = useMemo(
    () => visibleRows.map((row) => row.id),
    [visibleRows],
  );
  const unhiddenRowIds = useMemo(
    () => document.rows.filter((row) => !row.hidden).map((row) => row.id),
    [document.rows],
  );
  const visibleRowSetKey = createMsaRowSetKey(visibleRowIds);
  const unhiddenRowSetKey = createMsaRowSetKey(unhiddenRowIds);
  useEffect(() => {
    dispatchInteraction({
      rowIds: visibleRowIds,
      type: "visible-rows-changed",
    });
  }, [visibleRowSetKey]);
  useEffect(() => {
    dispatchInteraction({
      rowIds: unhiddenRowIds,
      type: "analysis-rows-changed",
    });
    setMotifQuery(restoredMotifQueryRef.current ?? "");
    restoredMotifQueryRef.current = null;
  }, [unhiddenRowSetKey]);
  const setGuideTreeNewick = (newick: string | null): void =>
    dispatchInteraction({
      newick,
      rowSetKey: unhiddenRowSetKey,
      type: "set-guide-tree",
    });
  const analysisRowIds =
    analysisScope === "currently-displayed-rows"
      ? visibleRowIds
      : unhiddenRowIds;
  const searchRowIds =
    searchScope === "currently-displayed-rows" ? visibleRowIds : unhiddenRowIds;
  const searchRowSetKey = createMsaRowSetKey(searchRowIds);
  useEffect(() => {
    dispatchInteraction({
      index: restoredHitIndexRef.current ?? 0,
      type: "set-selected-hit",
    });
    restoredHitIndexRef.current = null;
  }, [searchRowSetKey]);
  const analysisState = useMsaDerivedAnalysis({
    analysisRowIds,
    document,
  });
  const analysis = analysisState.analysis;
  const referenceSequence = useMemo(() => {
    if (referenceMode === "none") {
      return null;
    }
    if (referenceMode === "anchor") {
      return (
        document.rows.find((row) => row.id === anchorRowId)?.alignedSequence ??
        null
      );
    }
    return analysis?.consensusSequence ?? null;
  }, [analysis?.consensusSequence, anchorRowId, document.rows, referenceMode]);
  const availableMetricTracks = getAvailableMsaMetricTracks({
    moleculeType: document.displayInterpretation.moleculeType,
    referenceAvailable: referenceSequence != null,
    rnaStructureAvailable: document.rnaStructure != null,
  });
  const visibleMetricTracks = enabledMetricTracks.filter((track) =>
    availableMetricTracks.includes(track),
  );
  const referenceLabel =
    referenceMode === "anchor"
      ? (document.rows.find((row) => row.id === anchorRowId)?.label ?? "anchor")
      : document.displayInterpretation.moleculeType === "protein"
        ? "protein_representative"
        : "nucleotide_consensus";
  const searchState = useMsaMotifSearch({
    analysis,
    document,
    rawQuery: motifQuery,
    searchRowIds,
  });
  const motifHits = searchState.hits;
  const selectedHit = motifHits[selectedHitIndex] ?? null;
  const rowMetricsById = useMemo(() => {
    if (referenceMode === "consensus" && analysis != null) {
      return analysis.rowMetricsById;
    }
    return Object.fromEntries(
      computeRowMetrics(document.rows, referenceSequence).map((metric) => [
        metric.rowId,
        metric,
      ]),
    ) as Record<string, MsaRowMetrics | undefined>;
  }, [analysis, document.rows, referenceMode, referenceSequence]);
  const staticRowCount =
    1 +
    (referenceMode === "none" ? 0 : 1) +
    (showAnnotationTracks ? document.annotations.length : 0) +
    (document.cdsContext.applicability === "eligible" ? 2 : 0);
  const {
    scrollHorizontallyBy,
    scrollToColumn,
    scrollToRow,
    setScrollContainerRef,
    slice,
  } = useMsaViewport({
    alignedLength: document.alignedLength,
    cellWidth,
    rowCount: visibleRows.length,
    staticRowCount,
  });
  const handleHorizontalWheel = useCallback<WheelEventHandler<HTMLElement>>(
    (event) => {
      if (event.deltaX === 0) {
        return;
      }
      event.preventDefault();
      scrollHorizontallyBy(event.deltaX);
    },
    [scrollHorizontallyBy],
  );
  useEffect(() => {
    const finishColumnSelection = (): void => {
      columnSelectionAnchorRef.current = null;
    };
    window.addEventListener("pointerup", finishColumnSelection);
    window.addEventListener("pointercancel", finishColumnSelection);
    return (): void => {
      window.removeEventListener("pointerup", finishColumnSelection);
      window.removeEventListener("pointercancel", finishColumnSelection);
    };
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key === "Escape" &&
        (selectedColumnRange != null || pinnedCell != null)
      ) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return (): void => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, pinnedCell, selectedColumnRange]);
  const renderedColumns = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, slice.columnEnd - slice.columnStart) },
        (_, offset) => slice.columnStart + offset,
      ),
    [slice.columnEnd, slice.columnStart],
  );
  const visibleTrackColumns = useMemo(
    () =>
      Array.from(
        {
          length: Math.max(
            0,
            slice.visibleColumnEnd - slice.visibleColumnStart,
          ),
        },
        (_, offset) => slice.visibleColumnStart + offset,
      ),
    [slice.visibleColumnEnd, slice.visibleColumnStart],
  );
  const displayedRows = useMemo(
    () => visibleRows.slice(slice.rowStart, slice.rowEnd),
    [slice.rowEnd, slice.rowStart, visibleRows],
  );
  const summaries = analysis?.summaries ?? [];
  const visibleColumns = Math.max(1, slice.visibleColumnCount);
  const isLargeAlignment =
    document.rows.length >= LARGE_ALIGNMENT_ROW_THRESHOLD ||
    document.rows.length * Math.max(document.alignedLength, 1) >= 250_000;
  const workbenchView = useMemo<AlignmentWorkbenchView>(
    () => ({
      analysisScope,
      cellWidth,
      colorMode,
      enabledMetricTracks,
      referenceMode,
      residuePalette,
      rowFilter,
      rowSortDirection,
      rowSortKey,
      searchScope,
      selectedColumns: selectedColumnRange,
      selectedRows: workbenchState.selectedRows,
      showAnnotationTracks,
      showIdenticalAsDots,
      showRnaStructureOverlays,
      showSequenceLogoHelp,
    }),
    [
      analysisScope,
      cellWidth,
      colorMode,
      enabledMetricTracks,
      referenceMode,
      residuePalette,
      rowFilter,
      rowSortDirection,
      rowSortKey,
      searchScope,
      selectedColumnRange,
      showAnnotationTracks,
      showIdenticalAsDots,
      showRnaStructureOverlays,
      showSequenceLogoHelp,
      workbenchState.selectedRows,
    ],
  );
  const treeInputKey = useMemo(
    () => alignmentTreeInputKey(document),
    [document],
  );
  const restoreWorkbenchView = useCallback(
    (view: AlignmentWorkbenchView): void => {
      setAnalysisScope(view.analysisScope as MsaAnalysisScope);
      setCellWidth(view.cellWidth);
      setColorMode(view.colorMode as MsaColorMode);
      setReferenceMode(view.referenceMode as MsaReferenceMode);
      setResiduePalette(view.residuePalette as MsaResiduePalette | null);
      setRowFilter(view.rowFilter);
      setSearchScope(view.searchScope as MsaSearchScope);
      setSelectedColumnRange(view.selectedColumns);
      dispatchWorkbench({
        rowIds: view.selectedRows,
        type: "select-alignment-rows",
      });
      setShowAnnotationTracks(view.showAnnotationTracks);
      setShowIdenticalAsDots(view.showIdenticalAsDots);
      setShowRnaStructureOverlays(view.showRnaStructureOverlays);
      setEnabledMetricTracks(
        view.enabledMetricTracks ?? getDefaultMsaMetricTracks(initialDocument),
      );
      setShowSequenceLogoHelp(view.showSequenceLogoHelp ?? false);
      setRowSortKey(view.rowSortKey ?? "source");
      setRowSortDirection(view.rowSortDirection ?? "asc");
    },
    [initialDocument],
  );
  const updateWorkbenchTree = useCallback(
    (tree: GuideTreeResult | null, sourceDocument = document): void => {
      treeSourceKeyRef.current =
        tree == null ? null : alignmentTreeInputKey(sourceDocument);
      setWorkbenchTree(tree);
      setGuideTreeNewick(tree?.newick ?? null);
    },
    [document, unhiddenRowSetKey],
  );
  const restoredNativeAlignment =
    durableViewerState?.restoredState?.sourceStateKey === sourceStateKey
      ? durableViewerState.restoredState.alignment
      : undefined;
  const [nativeRecoveryReady, setNativeRecoveryReady] = useState(
    () => restoredNativeAlignment == null,
  );
  useEffect(() => {
    if (restoredNativeAlignment == null || durableViewerState == null) {
      setNativeRecoveryReady(true);
      return;
    }
    const checkpointKey =
      durableViewerState.client.session.sourceRevision + ":" + sourceStateKey;
    if (restoredCheckpointRef.current === checkpointKey) {
      setNativeRecoveryReady(true);
      return;
    }
    try {
      const session = parseWorkbenchSession(
        JSON.stringify(restoredNativeAlignment.session),
      );
      if (
        session.view.mode !== "alignment" ||
        session.source.stateKey !== sourceStateKey ||
        session.source.format !== initialDocument.format ||
        session.source.fileName !== (filePath ?? null)
      ) {
        throw new Error(
          "The native Alignment checkpoint belongs to a different source artifact.",
        );
      }
      const restoredDocument = applySequenceDurableDocumentPatches(
        initialDocument,
        restoredNativeAlignment.documentPatches,
      );
      if (
        restoredNativeAlignment.documentPatches.length > 0 ||
        restoredNativeAlignment.history.length > 0 ||
        restoredNativeAlignment.future.length > 0
      ) {
        const historicalDocuments = restoredNativeAlignment.history.map(
          (entry) => ({
            description: entry.description,
            document: applySequenceDurableDocumentPatches(
              initialDocument,
              entry.patches,
            ),
          }),
        );
        dispatchWorkbench({
          document: historicalDocuments[0]?.document ?? initialDocument,
          type: "reset-alignment-document",
        });
        for (let index = 1; index < historicalDocuments.length; index++) {
          dispatchWorkbench({
            description:
              historicalDocuments[index - 1]?.description ??
              "Automatically restored native alignment history.",
            document: historicalDocuments[index]?.document ?? initialDocument,
            type: "apply-alignment-document",
          });
        }
        dispatchWorkbench({
          description:
            historicalDocuments.at(-1)?.description ??
            "Automatically restored native alignment edits.",
          document: restoredDocument,
          type: "apply-alignment-document",
        });
        for (const entry of [...restoredNativeAlignment.future].reverse()) {
          dispatchWorkbench({
            description: entry.description,
            document: applySequenceDurableDocumentPatches(
              initialDocument,
              entry.patches,
            ),
            type: "apply-alignment-document",
          });
        }
        for (
          let index = 0;
          index < restoredNativeAlignment.future.length;
          index++
        ) {
          dispatchWorkbench({ type: "undo-alignment-document" });
        }
      }
      dispatchWorkbench({
        state: {
          artifacts: session.artifacts,
          dirty: session.dirty,
          jobs: settleRestoredJobs(session.jobs),
          revision: session.revision,
          tracks: session.tracks,
        },
        type: "restore-shared",
      });
      restoreWorkbenchView(restoredNativeAlignment.view);
      dispatchInteraction({
        anchorRowId: restoredNativeAlignment.anchorRowId,
        type: "set-anchor",
      });
      restoredMotifQueryRef.current = restoredNativeAlignment.motifQuery;
      restoredHitIndexRef.current = restoredNativeAlignment.selectedHitIndex;
      setMotifQuery(restoredNativeAlignment.motifQuery);
      setAlignmentColumnJump(restoredNativeAlignment.alignmentColumnJump);
      setReferencePositionJump(restoredNativeAlignment.referencePositionJump);
      for (const [kind, checkpointCell] of [
        ["set-focus", restoredNativeAlignment.focusedCell],
        ["set-pinned", restoredNativeAlignment.pinnedCell],
      ] as const) {
        const row =
          checkpointCell == null
            ? undefined
            : restoredDocument.rows.find(
                (candidate) => candidate.id === checkpointCell.rowId,
              );
        dispatchInteraction({
          cell:
            checkpointCell == null || row == null
              ? null
              : {
                  column: checkpointCell.column,
                  row,
                  symbol: checkpointCell.symbol,
                },
          type: kind,
        });
      }
      if (restoredNativeAlignment.guideTreeNewick != null) {
        dispatchInteraction({
          newick: restoredNativeAlignment.guideTreeNewick,
          rowSetKey: createMsaRowSetKey(
            restoredDocument.rows
              .filter((row) => !row.hidden)
              .map((row) => row.id),
          ),
          type: "set-guide-tree",
        });
      }
      dispatchInteraction({
        index: restoredNativeAlignment.selectedHitIndex,
        type: "set-selected-hit",
      });
      scrollToColumn(restoredNativeAlignment.viewport.column);
      scrollToRow(restoredNativeAlignment.viewport.row);
      restoredCheckpointRef.current = checkpointKey;
      setWorkbenchError(undefined);
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The native Alignment checkpoint could not be restored.",
      );
    } finally {
      setNativeRecoveryReady(true);
    }
  }, [
    durableViewerState,
    filePath,
    initialDocument,
    restoreWorkbenchView,
    restoredNativeAlignment,
    scrollToColumn,
    scrollToRow,
    sourceStateKey,
  ]);
  useEffect(() => {
    if (durableViewerState == null || !nativeRecoveryReady) return;
    try {
      durableViewerState.updateAlignment({
        sourceStateKey,
        state: createDurableAlignmentState({
          alignmentColumnJump,
          anchorRowId,
          fileName: filePath,
          focusedCell:
            focusedCell == null
              ? null
              : {
                  column: focusedCell.column,
                  rowId: focusedCell.row.id,
                  symbol: focusedCell.symbol,
                },
          guideTreeNewick,
          initialDocument,
          motifQuery,
          pinnedCell:
            pinnedCell == null
              ? null
              : {
                  column: pinnedCell.column,
                  rowId: pinnedCell.row.id,
                  symbol: pinnedCell.symbol,
                },
          referencePositionJump,
          selectedHitIndex,
          sourceStateKey,
          state: workbenchState,
          view: workbenchView,
          viewport: {
            column: slice.visibleColumnStart,
            row: slice.visibleRowStart,
          },
        }),
      });
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The native Alignment state could not be checkpointed.",
      );
    }
  }, [
    alignmentColumnJump,
    anchorRowId,
    durableViewerState,
    filePath,
    focusedCell,
    guideTreeNewick,
    initialDocument,
    motifQuery,
    nativeRecoveryReady,
    pinnedCell,
    referencePositionJump,
    selectedHitIndex,
    slice.visibleColumnStart,
    slice.visibleRowStart,
    sourceStateKey,
    workbenchState,
    workbenchView,
  ]);
  useEffect(() => {
    if (durableViewerState == null) return;
    const flushCheckpoint = (): void => {
      void durableViewerState.flush().catch(() => {
        // A failed native flush never resurrects a conversation-scoped MCP.
      });
    };
    window.addEventListener("pagehide", flushCheckpoint);
    return () => {
      window.removeEventListener("pagehide", flushCheckpoint);
      flushCheckpoint();
    };
  }, [durableViewerState]);
  useEffect(() => {
    if (workbenchTree != null && treeSourceKeyRef.current !== treeInputKey) {
      treeSourceKeyRef.current = null;
      setWorkbenchTree(null);
      setGuideTreeNewick(null);
    }
  }, [treeInputKey, workbenchTree]);
  useAlignmentWorkbenchCommands({
    analysis,
    cancelledJobsRef,
    command,
    dispatch: dispatchWorkbench,
    documentFileName: filePath,
    handledCommandIdRef,
    hits: motifHits,
    onCommandResult,
    onRestoreView: restoreWorkbenchView,
    onSetTree: updateWorkbenchTree,
    selectedColumns: selectedColumnRange,
    sourceStateKey,
    state: workbenchState,
    tree: workbenchTree,
    view: workbenchView,
    visibleRows,
  });

  useEffect(() => {
    markMsaPreviewMilestone("usable-grid");
  }, [document.alignedLength, document.rows.length]);
  useEffect(() => {
    if (analysisState.phase === "ready") {
      markMsaPreviewMilestone("analysis-ready");
    }
  }, [analysisState.phase]);
  const alignmentModelContext = createMsaViewerModelContext({
    analysis,
    analysisScope,
    artifacts: workbenchState.artifacts,
    anchorRowId,
    cellWidth,
    colorMode,
    availableMetricTracks,
    enabledMetricTracks: visibleMetricTracks,
    document,
    dirty: workbenchState.dirty,
    filePath,
    focusedCell,
    guideTreeNewick,
    jobs: workbenchState.jobs,
    motifHits,
    motifQuery,
    searchPending: searchState.phase === "searching",
    searchTruncated: searchState.truncated,
    referenceLabel,
    referenceMode,
    residuePalette,
    rowFilter,
    rowSortDirection,
    rowSortKey,
    searchScope,
    selectedColumnRange,
    selectedRowIds: workbenchState.selectedRows,
    selectedHit,
    showAnnotationTracks,
    showIdenticalAsDots,
    showRnaStructureOverlays,
    showSequenceLogoHelp:
      showSequenceLogoHelp && visibleMetricTracks.includes("sequence-logo"),
    slice,
    sourceStateKey,
    tracks: workbenchState.tracks,
    tree: workbenchTree,
    visibleRows,
    viewerSessionId,
  });
  useModelContext(updateModelContext, {
    ...alignmentModelContext,
    structuredContent: {
      ...alignmentModelContext.structuredContent,
      toolbarVisible,
    },
  });

  useEffect(() => {
    if (selectedHit == null) {
      return;
    }
    if (
      selectedHit.alignmentStartColumn < slice.visibleColumnStart ||
      selectedHit.alignmentEndColumn >= slice.visibleColumnEnd
    ) {
      scrollToColumn(
        selectedHit.alignmentStartColumn -
          Math.floor(Math.max(visibleColumns, 1) / 4),
      );
    }
    const rowIndex = visibleRows.findIndex(
      (row) => row.id === selectedHit.rowId,
    );
    if (
      rowIndex >= 0 &&
      (rowIndex < slice.visibleRowStart || rowIndex >= slice.visibleRowEnd)
    ) {
      scrollToRow(Math.max(0, rowIndex - 2));
    }
  }, [
    scrollToColumn,
    scrollToRow,
    selectedHit,
    slice.visibleRowEnd,
    slice.visibleRowStart,
    slice.visibleColumnEnd,
    slice.visibleColumnStart,
    visibleColumns,
    visibleRows,
  ]);

  function updateInterpretation(moleculeType: MsaMoleculeType): void {
    const nucleicAcid =
      moleculeType === "dna" ||
      moleculeType === "rna" ||
      moleculeType === "nucleic-acid-ambiguous";
    setDocument((current) => ({
      ...current,
      cdsContext: inferCdsContext({
        alignedLength: current.alignedLength,
        moleculeType,
        rows: current.rows,
      }),
      displayInterpretation: {
        moleculeType,
        source: "user-override",
      },
      searchCapabilities: {
        ...current.searchCapabilities,
        supportsAmbiguousNucleotideCodes: nucleicAcid,
        supportsProteinAmbiguityCodes: moleculeType === "protein",
        supportsReverseComplement: nucleicAcid,
      },
    }));
    setResiduePalette((current) =>
      isResiduePaletteCompatible(moleculeType, current)
        ? current
        : getDefaultResiduePalette(moleculeType),
    );
    setColorMode((current) => {
      const proteinOnly =
        current === "protein-conservation" || current === "protein-similarity";
      const nucleotideOnly =
        current === "nucleotide-substitution" || current === "coding-impact";
      if (
        (proteinOnly && moleculeType !== "protein") ||
        (nucleotideOnly && !nucleicAcid)
      ) {
        return getDefaultColorMode(moleculeType);
      }
      return current;
    });
  }

  function toggleRow(rowId: string): void {
    applyRows(
      document.rows.map((row) =>
        row.id === rowId ? { ...row, hidden: !row.hidden } : row,
      ),
    );
  }

  function applyRows(nextRows: MsaDocument["rows"]): void {
    const nextUnhiddenRowIds = nextRows
      .filter((row) => !row.hidden)
      .map((row) => row.id);
    setDocument((current) => ({
      ...current,
      rawSummary: {
        ...current.rawSummary,
        visibleSequenceCount: nextUnhiddenRowIds.length,
      },
      rows: nextRows,
    }));
    dispatchInteraction({
      rowIds: nextUnhiddenRowIds,
      type: "analysis-rows-changed",
    });
    setMotifQuery("");
  }

  function adjustCellWidth(delta: number): void {
    setCellWidth((current) =>
      Math.max(MIN_CELL_WIDTH_PX, Math.min(MAX_CELL_WIDTH_PX, current + delta)),
    );
  }

  function resetView(): void {
    const moleculeType = document.displayInterpretation.moleculeType;
    dispatchInteraction({
      anchorRowId: document.rows.find((row) => !row.hidden)?.id ?? null,
      type: "reset",
    });
    setShowIdenticalAsDots(false);
    setShowAnnotationTracks(true);
    setShowRnaStructureOverlays(true);
    setEnabledMetricTracks(getDefaultMsaMetricTracks(document));
    setShowSequenceLogoHelp(false);
    setRowSortKey("source");
    setRowSortDirection("asc");
    setAnalysisScope("all-unhidden-rows");
    setSearchScope("currently-displayed-rows");
    setColorMode(getDefaultColorMode(moleculeType));
    setResiduePalette(getDefaultResiduePalette(moleculeType));
    setRowFilter("");
    setAlignmentColumnJump("");
    setReferencePositionJump("");
    setMotifQuery("");
    setCellWidth(DEFAULT_CELL_WIDTH_PX);
    scrollToColumn(0);
    clearSelection();
  }

  function jumpToAlignmentColumn(): void {
    const targetColumn = Number.parseInt(alignmentColumnJump.trim(), 10);
    if (!Number.isFinite(targetColumn)) {
      return;
    }
    scrollToColumn(Math.max(0, targetColumn - 1));
  }

  function jumpToReferencePosition(): void {
    const targetPosition = Number.parseInt(referencePositionJump.trim(), 10);
    if (!Number.isFinite(targetPosition) || referenceSequence == null) {
      return;
    }
    const targetColumn = getAlignmentColumnForUngappedPosition(
      referenceSequence,
      targetPosition,
    );
    if (targetColumn != null) {
      scrollToColumn(targetColumn);
    }
  }

  function buildColumnRange(anchor: number, column: number): MsaColumnRange {
    const start = Math.max(0, Math.min(anchor, column));
    const inclusiveEnd = Math.max(anchor, column);
    return {
      end: Math.min(document.alignedLength, inclusiveEnd + 1),
      start,
    };
  }

  function startColumnRangeSelection(column: number): void {
    const normalizedColumn = Math.max(
      0,
      Math.min(Math.max(0, document.alignedLength - 1), column),
    );
    columnSelectionAnchorRef.current = normalizedColumn;
    setSelectedColumnRange(
      buildColumnRange(normalizedColumn, normalizedColumn),
    );
  }

  function extendColumnRangeSelection(column: number): void {
    const anchor = columnSelectionAnchorRef.current;
    if (anchor == null) {
      return;
    }
    const normalizedColumn = Math.max(
      0,
      Math.min(Math.max(0, document.alignedLength - 1), column),
    );
    setSelectedColumnRange(buildColumnRange(anchor, normalizedColumn));
  }

  function updateKeyboardColumnRangeSelection(
    anchorColumn: number,
    nextColumn: number,
    extend: boolean,
  ): void {
    if (!extend) {
      columnSelectionAnchorRef.current = null;
      return;
    }
    const anchor = columnSelectionAnchorRef.current ?? anchorColumn;
    columnSelectionAnchorRef.current = anchor;
    setSelectedColumnRange(buildColumnRange(anchor, nextColumn));
  }

  function updateSelectedColumnRange(range: MsaColumnRange | null): void {
    setSelectedColumnRange(range);
    columnSelectionAnchorRef.current = null;
  }

  function focusSelectedColumnRange(): void {
    if (selectedColumnRange == null) {
      return;
    }
    scrollToColumn(selectedColumnRange.start);
  }

  useEffect(() => {
    if (
      command == null ||
      command.action === "set_mode" ||
      isAlignmentOperation(command) ||
      handledCommandIdRef.current === command.commandId
    ) {
      return;
    }
    let result: SequenceViewerCommandResult;
    switch (command.action) {
      case "clear_alignment_selection":
        clearSelection();
        result = {
          applied: true,
          message: "Cleared the alignment selection.",
        };
        break;
      case "filter_alignment_rows": {
        const nextFilter = command.query.trim();
        const normalizedFilter = nextFilter.toLowerCase();
        const matchingRowCount = document.rows.filter(
          (row) =>
            !row.hidden &&
            (normalizedFilter.length === 0 ||
              `${row.label} ${row.description ?? ""}`
                .toLowerCase()
                .includes(normalizedFilter)),
        ).length;
        const matchingRowIds = document.rows
          .filter(
            (row) =>
              !row.hidden &&
              (normalizedFilter.length === 0 ||
                `${row.label} ${row.description ?? ""}`
                  .toLowerCase()
                  .includes(normalizedFilter)),
          )
          .map((row) => row.id);
        setRowFilter(nextFilter);
        setMotifQuery("");
        setSelectedHitIndex(0);
        dispatchInteraction({
          rowIds: matchingRowIds,
          type: "visible-rows-changed",
        });
        result = {
          applied: true,
          message:
            nextFilter.length === 0
              ? `Cleared the row filter; ${matchingRowCount} unhidden rows are displayed.`
              : `Filtered the alignment to ${matchingRowCount} matching row${matchingRowCount === 1 ? "" : "s"}.`,
          state: { matchingRowCount, query: nextFilter },
        };
        break;
      }
      case "select_alignment_columns": {
        const start = Math.min(command.start ?? 1, command.end ?? 1);
        const end = Math.max(command.start ?? 1, command.end ?? 1);
        if (start < 1 || end > document.alignedLength) {
          result = {
            applied: false,
            message: `Alignment range ${start}-${end} is outside this ${document.alignedLength}-column alignment.`,
            state: { maxColumn: document.alignedLength, minColumn: 1 },
          };
          break;
        }
        updateSelectedColumnRange({ end, start: start - 1 });
        scrollToColumn(start - 1);
        result = {
          applied: true,
          message: `Selected alignment columns ${start}-${end}.`,
          state: { end, start },
        };
        break;
      }
      case "focus_alignment_cell": {
        const rowResolution = resolveAlignmentRow(visibleRows, command.row);
        if (rowResolution.status !== "resolved") {
          result = {
            applied: false,
            message:
              rowResolution.status === "ambiguous"
                ? `More than one visible alignment row matched ${command.row}; retry with an exact row ID.`
                : `No visible alignment row matched ${command.row ?? "the request"}.`,
            state:
              rowResolution.status === "ambiguous"
                ? {
                    candidateRowIds: rowResolution.candidates.map(
                      ({ id }) => id,
                    ),
                  }
                : undefined,
          };
          break;
        }
        const row = rowResolution.target;
        const requestedColumn = command.column ?? 1;
        if (requestedColumn < 1 || requestedColumn > document.alignedLength) {
          result = {
            applied: false,
            message: `Alignment column ${requestedColumn} is outside this ${document.alignedLength}-column alignment.`,
            state: { maxColumn: document.alignedLength, minColumn: 1 },
          };
          break;
        }
        const column = requestedColumn - 1;
        const cell = {
          column,
          row,
          symbol: row.alignedSequence[column] ?? "-",
        };
        setFocusedCell(cell);
        setPinnedCell(cell);
        scrollToColumn(column);
        const rowIndex = visibleRows.findIndex(
          (candidate) => candidate.id === row.id,
        );
        if (rowIndex >= 0) {
          scrollToRow(rowIndex);
        }
        result = {
          applied: true,
          message: `Focused ${row.label} at alignment column ${column + 1}.`,
          state: { column: column + 1, rowId: row.id, symbol: cell.symbol },
        };
        break;
      }
      case "focus_alignment_reference_coordinate": {
        if (referenceSequence == null) {
          result = {
            applied: false,
            message:
              "No active alignment reference is available. Set a consensus or anchor reference first.",
          };
          break;
        }
        const column = getAlignmentColumnForUngappedPosition(
          referenceSequence,
          command.coordinate,
        );
        if (column == null) {
          result = {
            applied: false,
            message: `Reference coordinate ${command.coordinate} is outside the active reference sequence.`,
          };
          break;
        }
        updateSelectedColumnRange({ end: column + 1, start: column });
        scrollToColumn(column);
        const referenceRow =
          referenceMode === "anchor"
            ? (document.rows.find((row) => row.id === anchorRowId) ?? null)
            : null;
        if (referenceRow != null) {
          const cell = {
            column,
            row: referenceRow,
            symbol: referenceRow.alignedSequence[column] ?? "-",
          };
          setFocusedCell(cell);
          setPinnedCell(cell);
          const rowIndex = visibleRows.findIndex(
            (row) => row.id === referenceRow.id,
          );
          if (rowIndex >= 0) {
            scrollToRow(rowIndex);
          }
        }
        result = {
          applied: true,
          message: `Focused reference coordinate ${command.coordinate} at alignment column ${column + 1}.`,
          state: {
            alignmentColumn: column + 1,
            coordinate: command.coordinate,
            referenceMode,
            referenceRowId: referenceRow?.id ?? null,
          },
        };
        break;
      }
      case "navigate_alignment_search_hit": {
        if (motifHits.length === 0) {
          result = {
            applied: false,
            message: "There are no alignment search hits to navigate.",
          };
          break;
        }
        const nextIndex =
          (selectedHitIndex +
            (command.direction === "next" ? 1 : -1) +
            motifHits.length) %
          motifHits.length;
        const hit = motifHits[nextIndex];
        if (hit == null) {
          return;
        }
        setSelectedHitIndex(nextIndex);
        result = {
          applied: true,
          message: `Focused alignment search hit ${nextIndex + 1} of ${motifHits.length}.`,
          state: {
            alignmentEndColumn: hit.alignmentEndColumn + 1,
            alignmentStartColumn: hit.alignmentStartColumn + 1,
            hitCount: motifHits.length,
            hitIndex: nextIndex + 1,
            orientation: hit.orientation,
            rowId: hit.rowId,
          },
        };
        break;
      }
      case "reset_alignment_view":
        resetView();
        result = {
          applied: true,
          message: "Reset the alignment view controls.",
        };
        break;
      case "search_alignment":
        setMotifQuery(command.query ?? "");
        setSelectedHitIndex(0);
        result = {
          applied: true,
          message: `Searching the alignment for ${command.query ?? ""}.`,
          state: { query: command.query ?? "" },
        };
        break;
      case "select_alignment_rows": {
        const resolutions = command.rows.map((selector) => ({
          resolution: resolveAlignmentRow(document.rows, selector),
          selector,
        }));
        const ambiguous = resolutions.find(
          ({ resolution }) => resolution.status === "ambiguous",
        );
        if (ambiguous?.resolution.status === "ambiguous") {
          result = {
            applied: false,
            message: `More than one alignment row matched ${ambiguous.selector}; retry with exact row IDs.`,
            state: {
              candidateRowIds: ambiguous.resolution.candidates.map(
                ({ id }) => id,
              ),
            },
          };
          break;
        }
        const missingRows = resolutions.flatMap(({ resolution, selector }) =>
          resolution.status === "not-found" ? [selector] : [],
        );
        if (missingRows.length > 0) {
          result = {
            applied: false,
            message:
              "The alignment row selection was not changed because some requested rows were not found.",
            state: { missingRows },
          };
          break;
        }
        const selectedRowIds = [
          ...new Set(
            resolutions.flatMap(({ resolution }) =>
              resolution.status === "resolved" ? [resolution.target.id] : [],
            ),
          ),
        ];
        dispatchWorkbench({
          rowIds: selectedRowIds,
          type: "select-alignment-rows",
        });
        result = {
          applied: true,
          message:
            selectedRowIds.length === 0
              ? "Cleared the alignment row selection."
              : `Selected ${selectedRowIds.length} alignment row${selectedRowIds.length === 1 ? "" : "s"} for analysis, editing, or export.`,
          state: { selectedRowCount: selectedRowIds.length, selectedRowIds },
        };
        break;
      }
      case "set_alignment_row_visibility": {
        const rowResolutions = command.rows.map((selector) => ({
          resolution: resolveAlignmentRow(document.rows, selector),
          selector,
        }));
        const ambiguous = rowResolutions.find(
          ({ resolution }) => resolution.status === "ambiguous",
        );
        if (ambiguous?.resolution.status === "ambiguous") {
          result = {
            applied: false,
            message: `More than one alignment row matched ${ambiguous.selector}; retry with exact row IDs.`,
            state: {
              candidateRowIds: ambiguous.resolution.candidates.map(
                ({ id }) => id,
              ),
            },
          };
          break;
        }
        const matchedRows = rowResolutions.flatMap(({ resolution }) =>
          resolution.status === "resolved" ? [resolution.target] : [],
        );
        if (matchedRows.length === 0) {
          result = {
            applied: false,
            message: "None of the requested alignment rows were found.",
            state: { missingRows: command.rows },
          };
          break;
        }
        const matchedRowIds = new Set(matchedRows.map(({ id }) => id));
        const nextRows = document.rows.map((row) =>
          matchedRowIds.has(row.id)
            ? { ...row, hidden: !command.visible }
            : row,
        );
        const missingRows = rowResolutions.flatMap(
          ({ resolution, selector }) =>
            resolution.status === "not-found" ? [selector] : [],
        );
        const visibleRowCount = nextRows.filter((row) => !row.hidden).length;
        applyRows(nextRows);
        result = {
          applied: true,
          message: `${command.visible ? "Showed" : "Hid"} ${matchedRows.length} alignment row${matchedRows.length === 1 ? "" : "s"}${missingRows.length === 0 ? "." : `; ${missingRows.length} requested row${missingRows.length === 1 ? " was" : "s were"} not found.`}`,
          state: {
            matchedRowIds: matchedRows.map(({ id }) => id),
            missingRows,
            visible: command.visible,
            visibleRowCount,
          },
        };
        break;
      }
      case "set_alignment_reference": {
        const normalizedReference = command.reference?.trim() ?? "";
        if (normalizedReference === "consensus") {
          setReferenceMode("consensus");
          result = {
            applied: true,
            message: "Set the alignment reference to consensus.",
            state: { referenceMode: "consensus" },
          };
          break;
        }
        if (normalizedReference === "none") {
          setReferenceMode("none");
          result = {
            applied: true,
            message: "Cleared the alignment reference.",
            state: { referenceMode: "none" },
          };
          break;
        }
        const rowResolution = resolveAlignmentRow(
          document.rows.filter((row) => !row.hidden),
          normalizedReference,
        );
        if (rowResolution.status !== "resolved") {
          result = {
            applied: false,
            message:
              rowResolution.status === "ambiguous"
                ? `More than one alignment row matched ${normalizedReference}; retry with an exact row ID.`
                : `No unhidden alignment row matched ${normalizedReference}.`,
            state:
              rowResolution.status === "ambiguous"
                ? {
                    candidateRowIds: rowResolution.candidates.map(
                      ({ id }) => id,
                    ),
                  }
                : undefined,
          };
          break;
        }
        const row = rowResolution.target;
        setAnchorRowId(row.id);
        setReferenceMode("anchor");
        result = {
          applied: true,
          message: `Set ${row.label} as the alignment reference.`,
          state: { referenceMode: "anchor", rowId: row.id },
        };
        break;
      }
      case "set_alignment_view_options": {
        const targetMoleculeType =
          command.moleculeType ?? document.displayInterpretation.moleculeType;
        const targetCdsContext =
          command.moleculeType == null
            ? document.cdsContext
            : inferCdsContext({
                alignedLength: document.alignedLength,
                moleculeType: targetMoleculeType,
                rows: document.rows,
              });
        const nextAvailableMetricTracks = getAvailableMsaMetricTracks({
          moleculeType: targetMoleculeType,
          referenceAvailable: referenceSequence != null,
          rnaStructureAvailable: document.rnaStructure != null,
        });
        const unavailableMetricTracks =
          command.enabledMetricTracks?.filter(
            (track) => !nextAvailableMetricTracks.includes(track),
          ) ?? [];
        if (unavailableMetricTracks.length > 0) {
          result = {
            applied: false,
            message:
              "Some requested metric tracks are unavailable for this alignment and active reference; no display options were changed.",
            state: {
              availableMetricTracks: nextAvailableMetricTracks,
              unavailableMetricTracks,
            },
          };
          break;
        }
        const nextEnabledMetricTracks = [
          ...new Set(command.enabledMetricTracks ?? enabledMetricTracks),
        ];
        if (
          command.showSequenceLogoHelp === true &&
          !nextEnabledMetricTracks.includes("sequence-logo")
        ) {
          result = {
            applied: false,
            message:
              "Enable the sequence-logo metric track before opening its help; no display options were changed.",
          };
          break;
        }
        if (
          command.colorMode != null &&
          !isMsaColorModeCompatible({
            cdsEligible: targetCdsContext.applicability === "eligible",
            colorMode: command.colorMode,
            moleculeType: targetMoleculeType,
          })
        ) {
          result = {
            applied: false,
            message: `Color mode ${command.colorMode} is not compatible with the ${targetMoleculeType} interpretation.`,
          };
          break;
        }
        if (
          command.residuePalette != null &&
          !isResiduePaletteCompatible(
            targetMoleculeType,
            command.residuePalette,
          )
        ) {
          result = {
            applied: false,
            message: `Residue palette ${command.residuePalette} is not compatible with the ${targetMoleculeType} interpretation.`,
          };
          break;
        }
        const nextColorMode =
          command.colorMode ??
          (isMsaColorModeCompatible({
            cdsEligible: targetCdsContext.applicability === "eligible",
            colorMode,
            moleculeType: targetMoleculeType,
          })
            ? colorMode
            : getDefaultColorMode(targetMoleculeType));
        const nextResiduePalette =
          command.residuePalette ??
          (isResiduePaletteCompatible(targetMoleculeType, residuePalette)
            ? residuePalette
            : getDefaultResiduePalette(targetMoleculeType));
        if (command.moleculeType != null) {
          updateInterpretation(command.moleculeType);
        }
        if (command.analysisScope != null) {
          setAnalysisScope(command.analysisScope);
        }
        if (command.cellWidth != null) {
          setCellWidth(command.cellWidth);
        }
        if (command.colorMode != null) {
          setColorMode(command.colorMode);
        }
        if (command.residuePalette != null) {
          setResiduePalette(command.residuePalette);
        }
        if (command.searchScope != null) {
          setSearchScope(command.searchScope);
        }
        if (command.showAnnotationTracks != null) {
          setShowAnnotationTracks(command.showAnnotationTracks);
        }
        if (command.showIdenticalAsDots != null) {
          setShowIdenticalAsDots(command.showIdenticalAsDots);
        }
        if (command.showRnaStructureOverlays != null) {
          setShowRnaStructureOverlays(command.showRnaStructureOverlays);
        }
        if (command.enabledMetricTracks != null) {
          setEnabledMetricTracks(nextEnabledMetricTracks);
        }
        if (command.showSequenceLogoHelp != null) {
          setShowSequenceLogoHelp(command.showSequenceLogoHelp);
        }
        if (command.rowSortKey != null) {
          setRowSortKey(command.rowSortKey);
        }
        if (command.rowSortDirection != null) {
          setRowSortDirection(command.rowSortDirection);
        }
        result = {
          applied: true,
          message: "Updated the alignment display and analysis options.",
          state: {
            analysisScope: command.analysisScope ?? analysisScope,
            cellWidth: command.cellWidth ?? cellWidth,
            colorMode: nextColorMode,
            availableMetricTracks: nextAvailableMetricTracks,
            enabledMetricTracks: nextEnabledMetricTracks.filter((track) =>
              nextAvailableMetricTracks.includes(track),
            ),
            moleculeType: targetMoleculeType,
            residuePalette: nextResiduePalette,
            rowSortDirection: command.rowSortDirection ?? rowSortDirection,
            rowSortKey: command.rowSortKey ?? rowSortKey,
            rowSortScope: "row-manager",
            searchScope: command.searchScope ?? searchScope,
            showAnnotationTracks:
              command.showAnnotationTracks ?? showAnnotationTracks,
            showIdenticalAsDots:
              command.showIdenticalAsDots ?? showIdenticalAsDots,
            showRnaStructureOverlays:
              command.showRnaStructureOverlays ?? showRnaStructureOverlays,
            showSequenceLogoHelp:
              (command.showSequenceLogoHelp ?? showSequenceLogoHelp) &&
              nextEnabledMetricTracks.includes("sequence-logo"),
          },
        };
        break;
      }
      case "show_all_alignment_rows": {
        const nextRows = document.rows.map((row) => ({
          ...row,
          hidden: false,
        }));
        applyRows(nextRows);
        result = {
          applied: true,
          message: `Showed all ${nextRows.length} alignment rows.`,
          state: { visibleRowCount: nextRows.length },
        };
        break;
      }
      case "compute_alignment_guide_tree": {
        try {
          const tree = buildGuideTree(
            document.rows.filter((row) => !row.hidden),
            "upgma",
          );
          updateWorkbenchTree(tree);
          result = {
            applied: true,
            message:
              "Computed an exploratory UPGMA guide tree from alignment p-distances.",
            state: {
              method: "UPGMA",
              newick: tree.newick,
              provenance:
                "Uncorrected alignment p-distance; all-gap columns ignored.",
            },
          };
        } catch (error) {
          result = {
            applied: false,
            message:
              error instanceof Error
                ? error.message
                : "The alignment guide tree could not be computed.",
          };
        }
        break;
      }
      default:
        return;
    }
    handledCommandIdRef.current = command.commandId;
    onCommandResult?.(command, result);
  }, [
    analysisScope,
    anchorRowId,
    cellWidth,
    clearSelection,
    colorMode,
    command,
    document,
    enabledMetricTracks,
    motifHits,
    onCommandResult,
    referenceMode,
    referenceSequence,
    residuePalette,
    rowSortDirection,
    rowSortKey,
    scrollToColumn,
    scrollToRow,
    searchScope,
    selectedHitIndex,
    showAnnotationTracks,
    showIdenticalAsDots,
    showRnaStructureOverlays,
    showSequenceLogoHelp,
    visibleRows,
  ]);

  function runLocalAlignmentAnalysis(
    request:
      | { algorithm: GuideTreeAlgorithm; analysis: "build-tree" }
      | { analysis: "distance-matrix" },
  ): void {
    const sourceDocument = document;
    const id = crypto.randomUUID();
    const kind =
      request.analysis === "build-tree" ? "guide-tree" : "distance-matrix";
    dispatchWorkbench({
      job: {
        id,
        kind,
        message: "Queued in the viewer",
        parameters: request,
        progress: 0,
        startedAt: Date.now(),
        status: "running",
      },
      type: "start-job",
    });
    window.setTimeout(() => {
      if (cancelledJobsRef.current.has(id)) return;
      if (workbenchStateRef.current.document !== sourceDocument) {
        dispatchWorkbench({
          completedAt: Date.now(),
          error:
            "The source alignment changed before this job completed. Run it again on the current copy.",
          id,
          type: "fail-job",
        });
        return;
      }
      try {
        const result = runAlignmentAnalysis({
          document: sourceDocument,
          request,
        });
        if (cancelledJobsRef.current.has(id)) return;
        if (workbenchStateRef.current.document !== sourceDocument) {
          dispatchWorkbench({
            completedAt: Date.now(),
            error:
              "The source alignment changed before this job completed. Run it again on the current copy.",
            id,
            type: "fail-job",
          });
          return;
        }
        if (request.analysis === "build-tree") {
          updateWorkbenchTree(result.tree as GuideTreeResult, sourceDocument);
        }
        dispatchWorkbench({
          completedAt: Date.now(),
          id,
          message: `${kind} completed.`,
          result,
          type: "complete-job",
        });
      } catch (error) {
        if (cancelledJobsRef.current.has(id)) return;
        dispatchWorkbench({
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : `${kind} failed.`,
          id,
          type: "fail-job",
        });
      }
    }, 0);
  }

  function applyLocalAlignmentEdit(request: SequenceViewerEditRequest): void {
    try {
      setWorkbenchError(undefined);
      const change = applyAlignmentEditRequest({
        document,
        request,
        tree: workbenchTree,
      });
      if ("historyOperation" in change) {
        dispatchWorkbench({
          type:
            change.historyOperation === "undo"
              ? "undo-alignment-document"
              : "redo-alignment-document",
        });
        return;
      }
      dispatchWorkbench({
        description: change.description,
        document: change.document,
        type: "apply-alignment-document",
      });
    } catch (error) {
      setWorkbenchError(
        error instanceof Error ? error.message : "The alignment edit failed.",
      );
    }
  }

  function realignLocalRows(rowIds?: Array<string>): void {
    const sourceDocument = document;
    const id = crypto.randomUUID();
    dispatchWorkbench({
      job: {
        id,
        kind: "align",
        message: "Queued in the viewer",
        parameters: { rowIds: rowIds ?? null },
        progress: 0,
        startedAt: Date.now(),
        status: "running",
      },
      type: "start-job",
    });
    window.setTimeout(() => {
      if (cancelledJobsRef.current.has(id)) return;
      if (workbenchStateRef.current.document !== sourceDocument) {
        dispatchWorkbench({
          completedAt: Date.now(),
          error:
            "The source alignment changed before this job completed. Run it again on the current copy.",
          id,
          type: "fail-job",
        });
        return;
      }
      try {
        const result = realignRows({ document: sourceDocument, rowIds });
        if (cancelledJobsRef.current.has(id)) return;
        if (workbenchStateRef.current.document !== sourceDocument) {
          dispatchWorkbench({
            completedAt: Date.now(),
            error:
              "The source alignment changed before this job completed. Run it again on the current copy.",
            id,
            type: "fail-job",
          });
          return;
        }
        const content = exportAlignedFasta(result.document.rows);
        dispatchWorkbench({
          description: "Realigned rows in an editable copy.",
          document: result.document,
          type: "apply-alignment-document",
        });
        dispatchWorkbench({
          artifact: {
            content,
            createdAt: Date.now(),
            format: "aligned-fasta",
            id: crypto.randomUUID(),
            mediaType: "text/x-fasta",
            name: `${basenameFromPath(filePath ?? "alignment")}.realigned.fasta`,
            provenance: {
              engine: result.engine,
              parameters: result.parameters,
              sourceRevision: workbenchState.revision,
            },
          },
          type: "add-artifact",
        });
        dispatchWorkbench({
          completedAt: Date.now(),
          id,
          message: "Alignment completed.",
          result: {
            alignedLength: result.document.alignedLength,
            rowCount: result.document.rows.length,
            warning: result.warning,
          },
          type: "complete-job",
        });
      } catch (error) {
        if (cancelledJobsRef.current.has(id)) return;
        dispatchWorkbench({
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : "Alignment failed.",
          id,
          type: "fail-job",
        });
      }
    }, 0);
  }

  function exportLocalAlignment(
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
  ): void {
    try {
      setWorkbenchError(undefined);
      const output = exportAlignmentWorkbench({
        document,
        format,
        name: filePath,
        newick: workbenchTree?.newick,
        scope,
        selectedColumns: selectedColumnRange,
        selectedRows: workbenchState.selectedRows,
        visibleRows,
      });
      dispatchWorkbench({
        artifact: {
          ...output,
          createdAt: Date.now(),
          id: crypto.randomUUID(),
          provenance: {
            engine: "sequence-viewer-alignment-export-v1",
            parameters: createAlignmentExportParameters({
              format,
              scope,
              tree: workbenchTree,
            }),
            sourceRevision: workbenchState.revision,
          },
        },
        type: "add-artifact",
      });
    } catch (error) {
      setWorkbenchError(
        error instanceof Error ? error.message : "The export failed.",
      );
    }
  }

  function prepareWorkspaceSession(): string {
    return serializeWorkbenchSession(
      createAlignmentWorkbenchSession(
        workbenchState,
        workbenchView,
        filePath,
        sourceStateKey,
      ),
    );
  }

  function saveLocalSession(): void {
    try {
      setWorkbenchError(undefined);
      const content = prepareWorkspaceSession();
      dispatchWorkbench({
        artifact: {
          content,
          createdAt: Date.now(),
          format: "sequence-viewer-session",
          id: crypto.randomUUID(),
          mediaType: "application/json",
          name: `${basenameFromPath(filePath ?? "alignment")}.alignment-session.json`,
          provenance: {
            engine: "sequence-viewer-session-v1",
            parameters: { mode: "alignment" },
            sourceRevision: workbenchState.revision,
          },
        },
        type: "add-artifact",
      });
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The session could not be saved.",
      );
    }
  }

  function restoreLocalSession(content: string): void {
    try {
      setWorkbenchError(undefined);
      const session = parseWorkbenchSession(content);
      if (session.view.mode !== "alignment" || session.view.alignment == null) {
        throw new Error("This is not an Alignment-mode workbench session.");
      }
      if (
        session.source.fileName !== (filePath ?? null) ||
        session.source.format !== document.format ||
        session.source.stateKey !== sourceStateKey
      ) {
        throw new Error(
          "This session belongs to a different source artifact and was not applied.",
        );
      }
      if (session.snapshot?.alignmentDocument != null) {
        dispatchWorkbench({
          description: "Restored saved alignment-copy state.",
          document: session.snapshot.alignmentDocument,
          type: "apply-alignment-document",
        });
      }
      dispatchWorkbench({
        state: {
          artifacts: session.artifacts,
          dirty: session.dirty,
          jobs: settleRestoredJobs(session.jobs),
          revision: workbenchState.revision,
          tracks: session.tracks,
        },
        type: "restore-shared",
      });
      restoreWorkbenchView(session.view.alignment);
      const restoredTree = [...session.jobs]
        .reverse()
        .find(
          ({ kind, status }) => kind === "guide-tree" && status === "completed",
        )?.result?.tree;
      if (isGuideTreeResult(restoredTree)) {
        updateWorkbenchTree(
          restoredTree,
          session.snapshot?.alignmentDocument ?? document,
        );
      }
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The session could not be restored.",
      );
    }
  }

  const toolbarProps: MsaToolbarProps = {
    anchorRowId,
    alignmentColumnJump,
    analysisScope,
    colorMode,
    document,
    motifQuery,
    onAnchorRowIdChange: setAnchorRowId,
    onAlignmentColumnJumpChange: setAlignmentColumnJump,
    onAnalysisScopeChange: setAnalysisScope,
    onColorModeChange: setColorMode,
    onInterpretationChange: updateInterpretation,
    onJumpToAlignmentColumn: jumpToAlignmentColumn,
    onJumpToReferencePosition: jumpToReferencePosition,
    onMotifQueryChange: (value) => {
      setMotifQuery(value);
      setSelectedHitIndex(0);
    },
    onNextHit: () =>
      setSelectedHitIndex((current) =>
        motifHits.length === 0 ? 0 : (current + 1) % motifHits.length,
      ),
    onPreviousHit: () =>
      setSelectedHitIndex((current) =>
        motifHits.length === 0
          ? 0
          : (current - 1 + motifHits.length) % motifHits.length,
      ),
    onReferenceModeChange: setReferenceMode,
    onReferencePositionJumpChange: setReferencePositionJump,
    onResetView: resetView,
    onResiduePaletteChange: setResiduePalette,
    onRowFilterChange: (value) => {
      setRowFilter(value);
      setMotifQuery("");
      setSelectedHitIndex(0);
    },
    onSearchScopeChange: setSearchScope,
    onShowAnnotationTracksChange: setShowAnnotationTracks,
    onShowIdenticalAsDotsChange: setShowIdenticalAsDots,
    onShowRnaStructureOverlaysChange: setShowRnaStructureOverlays,
    onWindowBack: () =>
      scrollToColumn(Math.max(0, slice.visibleColumnStart - WINDOW_STEP)),
    onWindowForward: () =>
      scrollToColumn(
        Math.min(
          Math.max(0, document.alignedLength - visibleColumns),
          slice.visibleColumnStart + WINDOW_STEP,
        ),
      ),
    onZoomIn: () => adjustCellWidth(4),
    onZoomOut: () => adjustCellWidth(-4),
    referenceMode,
    referencePositionJump,
    referenceSequence,
    residuePalette,
    rowFilter,
    searchScope,
    selectedHit,
    selectedHitIndex,
    showAnnotationTracks,
    showIdenticalAsDots,
    showRnaStructureOverlays,
    totalHits: motifHits.length,
  };
  const workbenchProps: ComponentProps<typeof AlignmentWorkbenchPanel> = {
    focusedCell:
      focusedCell == null
        ? null
        : { column: focusedCell.column, rowId: focusedCell.row.id },
    onBuildTree: (algorithm) =>
      runLocalAlignmentAnalysis({ algorithm, analysis: "build-tree" }),
    onCancelJob: (jobId) => {
      cancelledJobsRef.current.add(jobId);
      dispatchWorkbench({ id: jobId, type: "cancel-job" });
    },
    onDistanceMatrix: () =>
      runLocalAlignmentAnalysis({ analysis: "distance-matrix" }),
    onEdit: applyLocalAlignmentEdit,
    onExport: exportLocalAlignment,
    onRealign: realignLocalRows,
    onRedo: () => dispatchWorkbench({ type: "redo-alignment-document" }),
    onRestoreSession: restoreLocalSession,
    onSaveSession: saveLocalSession,
    prepareWorkspaceSession,
    publishWorkspaceArtifact,
    workspaceSessionName: workspaceSessionDefaultName(filePath, "alignment"),
    workspaceSessions,
    onSelectRows: (rowIds) =>
      dispatchWorkbench({ rowIds, type: "select-alignment-rows" }),
    onUndo: () => dispatchWorkbench({ type: "undo-alignment-document" }),
    selectedColumns: selectedColumnRange,
    state: workbenchState,
    tree: workbenchTree,
  };
  const controlsVisible = toolbarRevealed ?? toolbarVisible;

  return (
    <MsaPreviewShell
      className={className}
      filePath={filePath}
      showFileHeader={showFileHeader}
    >
      <div className="bio-workbench-layout bio-msa-workbench-layout">
        <main className="bio-workbench-main min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-token-border px-3 py-2">
            <span className="bg-token-main-surface-secondary rounded px-2 py-0.5 text-xs font-medium text-token-text-primary">
              {formatMoleculeLabel(document.displayInterpretation.moleculeType)}
            </span>
            <span className="rounded border border-token-border px-2 py-0.5 text-xs text-token-text-secondary">
              {document.format}
            </span>
            <span className="text-xs text-token-text-secondary">
              {document.molecule.confidence === "high" ? (
                <FormattedMessage
                  id="codex.filePreview.msa.confidence.high"
                  defaultMessage="high-confidence modality"
                  description="MSA viewer badge text for high-confidence molecule-type inference."
                />
              ) : (
                <FormattedMessage
                  id="codex.filePreview.msa.confidence.caveated"
                  defaultMessage="{confidence}-confidence modality inference"
                  description="MSA viewer badge text for caveated molecule-type inference."
                  values={{ confidence: document.molecule.confidence }}
                />
              )}
            </span>
            <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-token-text-secondary">
              <span>
                <FormattedMessage
                  id="codex.filePreview.msa.sequenceCount"
                  defaultMessage="{count, number} sequences"
                  description="Summary count of sequence rows parsed from an MSA file."
                  values={{ count: document.rows.length }}
                />
              </span>
              <span>
                <FormattedMessage
                  id="codex.filePreview.msa.columnCount"
                  defaultMessage="{count, number} alignment columns"
                  description="Summary count of alignment columns parsed from an MSA file."
                  values={{ count: document.alignedLength }}
                />
              </span>
              <span>
                {analysisState.phase === "ready" ? (
                  <FormattedMessage
                    id="codex.filePreview.msa.identity"
                    defaultMessage="{value}% mean identity"
                    description="Mean column identity summary for an MSA preview."
                    values={{
                      value: Math.round(
                        analysisState.analysis.meanIdentity * 100,
                      ),
                    }}
                  />
                ) : (
                  <FormattedMessage
                    id="codex.filePreview.msa.identityPending"
                    defaultMessage="Computing mean identity…"
                    description="Pending summary shown while MSA identity analysis is still running."
                  />
                )}
              </span>
              {analysisState.phase === "ready" &&
              analysisState.analysis.meanConservationNormalized != null ? (
                <span>
                  <FormattedMessage
                    id="codex.filePreview.msa.normalizedConservation"
                    defaultMessage="{value}% normalized conservation"
                    description="Mean normalized modality-specific conservation summary for an MSA preview."
                    values={{
                      value: Math.round(
                        analysisState.analysis.meanConservationNormalized * 100,
                      ),
                    }}
                  />
                </span>
              ) : null}
            </div>
          </div>
          <div
            data-sequence-toolbar-controls="alignment"
            hidden={!controlsVisible}
            inert={!controlsVisible ? true : undefined}
          >
            <MsaToolbar {...toolbarProps} section="primary" />
          </div>
          {workbenchError == null ? null : (
            <div
              className="border-b border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400"
              data-workbench-nonblocking="true"
              role="alert"
            >
              {workbenchError}
            </div>
          )}
          <MsaSearchResultsPanel
            hits={motifHits}
            isPending={searchState.phase === "searching"}
            onSelectHit={setSelectedHitIndex}
            query={motifQuery}
            referenceSequence={referenceSequence}
            selectedHitIndex={selectedHitIndex}
            truncated={searchState.truncated}
          />
          <MsaSelectedRangePanel
            pinnedCell={pinnedCell}
            range={selectedColumnRange}
            onClear={clearSelection}
            onFocus={focusSelectedColumnRange}
          />
          <MsaPerformanceStateBanner
            analysisMessage={
              analysisState.phase === "error"
                ? analysisState.message
                : undefined
            }
            fallbackMessage={
              analysisState.phase === "ready"
                ? analysisState.fallbackMessage
                : undefined
            }
            analysisPhase={analysisState.phase}
            isLargeAlignment={isLargeAlignment}
            searchPhase={searchState.phase}
          />

          <MsaWarningsDrawer warnings={document.warnings} />
          <MsaOverviewStrip
            alignedLength={document.alignedLength}
            isPending={analysisState.phase !== "ready"}
            onWindowStartChange={scrollToColumn}
            overviewBuckets={analysis?.overviewBuckets ?? []}
            selectedColumnRange={selectedColumnRange}
            onSelectedColumnRangeChange={updateSelectedColumnRange}
            onHorizontalWheel={handleHorizontalWheel}
            visibleColumns={visibleColumns}
            windowStart={slice.visibleColumnStart}
          />

          <MsaMetricTracks
            analysis={analysis}
            cellWidth={cellWidth}
            columns={visibleTrackColumns}
            document={document}
            enabledTracks={enabledMetricTracks}
            onHorizontalWheel={handleHorizontalWheel}
            referenceSequence={referenceSequence}
            slice={slice}
          />

          <div
            aria-label={intl.formatMessage({
              id: "codex.filePreview.msa.scrollViewport",
              defaultMessage: "Scrollable multiple sequence alignment matrix",
              description:
                "Accessible label for the horizontally and vertically scrollable MSA matrix viewport.",
            })}
            className="min-w-0 flex-1 overflow-auto"
            ref={setScrollContainerRef}
          >
            <MsaMatrixRenderer
              analysis={analysis}
              cellWidth={cellWidth}
              colorMode={colorMode}
              columns={renderedColumns}
              document={document}
              motifHits={motifHits}
              onFocusedCellChange={setFocusedCell}
              onHoverCellDetailsChange={setHoverCellDetails}
              onKeyboardRangeSelection={updateKeyboardColumnRangeSelection}
              onPinnedCellChange={setPinnedCell}
              onRangeSelectionExtend={extendColumnRangeSelection}
              onRangeSelectionStart={startColumnRangeSelection}
              referenceSequence={referenceSequence}
              residuePalette={residuePalette}
              rows={displayedRows}
              selectedColumnRange={selectedColumnRange}
              selectedHit={selectedHit}
              showAnnotationTracks={showAnnotationTracks}
              showIdenticalAsDots={showIdenticalAsDots}
              showRnaStructureOverlays={showRnaStructureOverlays}
              slice={slice}
              summaries={summaries}
              totalVisibleRows={visibleRows.length}
            />
          </div>
          <MsaStatusFooter
            document={document}
            focusedCell={focusedCell}
            selectedHit={selectedHit}
            visibleRowCount={visibleRows.length}
            visibleRange={{
              end: slice.visibleColumnEnd,
              start: slice.visibleColumnStart,
            }}
          />
          <MsaPinnedInspector
            analysis={analysis}
            cell={pinnedCell}
            document={document}
            onClear={() => setPinnedCell(null)}
            referenceSequence={referenceSequence}
          />
        </main>
        <aside
          className="bio-workbench-sidebar"
          data-sequence-toolbar-controls="alignment-inspector"
          hidden={!controlsVisible}
          inert={!controlsVisible ? true : undefined}
        >
          <WorkbenchTools
            group="alignment-tools"
            label="Alignment tools"
            panels={[
              {
                id: "display",
                label: "Display",
                content: (
                  <>
                    <MsaToolbar {...toolbarProps} section="display" />
                    <MsaMetricTrackControls
                      document={document}
                      enabledTracks={enabledMetricTracks}
                      onEnabledTracksChange={setEnabledMetricTracks}
                      onSequenceLogoHelpChange={setShowSequenceLogoHelp}
                      referenceSequence={referenceSequence}
                      showSequenceLogoHelp={showSequenceLogoHelp}
                    />
                    <MsaColorLegend
                      analysisPhase={analysisState.phase}
                      colorMode={colorMode}
                      document={document}
                      referenceMode={referenceMode}
                      referenceSequence={referenceSequence}
                      residuePalette={residuePalette}
                    />
                  </>
                ),
              },
              {
                id: "rows",
                label: "Rows",
                content: (
                  <MsaRowsPanel
                    document={document}
                    onSelectRows={workbenchProps.onSelectRows}
                    onSortDirectionChange={setRowSortDirection}
                    onSortKeyChange={setRowSortKey}
                    onToggleRow={toggleRow}
                    referenceKind={referenceMode}
                    rowMetricsById={rowMetricsById}
                    selectedRowIds={workbenchState.selectedRows}
                    sortDirection={rowSortDirection}
                    sortKey={rowSortKey}
                  />
                ),
              },
              {
                id: "analyze",
                label: "Analyze",
                content: (
                  <>
                    <AlignmentWorkbenchPanel
                      {...workbenchProps}
                      panel="analyze"
                    />
                    <MsaGuideTreePanel
                      newick={guideTreeNewick}
                      onCompute={() =>
                        updateWorkbenchTree(
                          buildGuideTree(
                            document.rows.filter((row) => !row.hidden),
                            "upgma",
                          ),
                        )
                      }
                      rows={document.rows.filter((row) => !row.hidden)}
                    />
                  </>
                ),
              },
              {
                id: "edit",
                label: workbenchState.dirty ? "Edit copy •" : "Edit copy",
                content: (
                  <AlignmentWorkbenchPanel {...workbenchProps} panel="edit" />
                ),
              },
              {
                id: "export",
                label: "Export",
                content: (
                  <>
                    <AlignmentWorkbenchPanel
                      {...workbenchProps}
                      panel="export"
                    />
                    <MsaExportActions
                      hits={motifHits}
                      publishWorkspaceArtifact={publishWorkspaceArtifact}
                      referenceLabel={referenceLabel}
                      referenceSequence={referenceSequence}
                      rows={visibleRows}
                      selectedColumnRange={selectedColumnRange}
                      serverSourceAlignedFasta={
                        document.format === "aligned-fasta" &&
                        workbenchState.revision === 0
                      }
                      sourceRevision={workbenchState.revision}
                      visibleColumnEnd={slice.visibleColumnEnd}
                      visibleColumnStart={slice.visibleColumnStart}
                    />
                  </>
                ),
              },
              {
                id: "details",
                label: "Details",
                content: <MsaMetadataPanel document={document} />,
              },
              {
                id: "tasks",
                label: workbenchState.jobs.some(
                  ({ status }) => status === "running",
                )
                  ? "Tasks •"
                  : "Tasks",
                content: (
                  <AlignmentWorkbenchPanel {...workbenchProps} panel="tasks" />
                ),
              },
            ]}
          />
        </aside>
      </div>
      <MsaCellHoverDetails details={hoverCellDetails} />
    </MsaPreviewShell>
  );
}

function MsaSelectedRangePanel({
  onClear,
  onFocus,
  pinnedCell,
  range,
}: {
  onClear: () => void;
  onFocus: () => void;
  pinnedCell: FocusedMsaCell;
  range: MsaColumnRange | null;
}): React.ReactElement | null {
  if (range == null && pinnedCell == null) {
    return null;
  }
  return (
    <section className="flex flex-wrap items-center gap-2 border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
      <span className="font-medium text-token-text-primary">
        {range == null ? (
          <FormattedMessage
            id="codex.filePreview.msa.pinnedCellSelection"
            defaultMessage="Pinned cell {rowLabel} column {column, number}"
            description="Summary of the currently pinned MSA cell selection."
            values={{
              column: pinnedCell?.column == null ? 0 : pinnedCell.column + 1,
              rowLabel: pinnedCell?.row.label ?? "",
            }}
          />
        ) : (
          <FormattedMessage
            id="codex.filePreview.msa.selectedRange"
            defaultMessage="Selected columns {start, number}-{end, number}"
            description="Summary of the currently selected MSA alignment-column range."
            values={{ end: range.end, start: range.start + 1 }}
          />
        )}
      </span>
      {range == null ? null : (
        <>
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.selectedRangeCount"
              defaultMessage="{count, number} columns"
              description="Column count for the currently selected MSA alignment-column range."
              values={{ count: range.end - range.start }}
            />
          </span>
          <Button color="outline" size="toolbar" onClick={onFocus}>
            <FormattedMessage
              id="codex.filePreview.msa.focusSelectedRange"
              defaultMessage="Focus range"
              description="Button that moves the MSA viewport to the selected alignment-column range."
            />
          </Button>
        </>
      )}
      <Button color="outline" size="toolbar" onClick={onClear}>
        <FormattedMessage
          id="codex.filePreview.msa.clearSelectedRange"
          defaultMessage="Clear selection"
          description="Button that clears the selected MSA range or pinned cell."
        />
      </Button>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.clearSelectionShortcut"
          defaultMessage="Esc"
          description="Keyboard shortcut hint for clearing the active MSA selection."
        />
      </span>
    </section>
  );
}

type MsaToolbarProps = {
  anchorRowId: string | null;
  alignmentColumnJump: string;
  analysisScope: MsaAnalysisScope;
  colorMode: MsaColorMode;
  document: MsaDocument;
  motifQuery: string;
  onAnchorRowIdChange: (value: string) => void;
  onAlignmentColumnJumpChange: (value: string) => void;
  onAnalysisScopeChange: (value: MsaAnalysisScope) => void;
  onColorModeChange: (value: MsaColorMode) => void;
  onInterpretationChange: (value: MsaMoleculeType) => void;
  onJumpToAlignmentColumn: () => void;
  onJumpToReferencePosition: () => void;
  onMotifQueryChange: (value: string) => void;
  onNextHit: () => void;
  onPreviousHit: () => void;
  onReferenceModeChange: (value: MsaReferenceMode) => void;
  onReferencePositionJumpChange: (value: string) => void;
  onResetView: () => void;
  onResiduePaletteChange: (value: MsaResiduePalette | null) => void;
  onRowFilterChange: (value: string) => void;
  onSearchScopeChange: (value: MsaSearchScope) => void;
  onShowAnnotationTracksChange: (value: boolean) => void;
  onShowIdenticalAsDotsChange: (value: boolean) => void;
  onShowRnaStructureOverlaysChange: (value: boolean) => void;
  onWindowBack: () => void;
  onWindowForward: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  referenceMode: MsaReferenceMode;
  referencePositionJump: string;
  referenceSequence: string | null;
  residuePalette: MsaResiduePalette | null;
  rowFilter: string;
  searchScope: MsaSearchScope;
  selectedHit: MsaMotifSearchHit | null;
  selectedHitIndex: number;
  showAnnotationTracks: boolean;
  showIdenticalAsDots: boolean;
  showRnaStructureOverlays: boolean;
  totalHits: number;
};

function MsaToolbar({
  anchorRowId,
  alignmentColumnJump,
  analysisScope,
  colorMode,
  document,
  motifQuery,
  onAnchorRowIdChange,
  onAlignmentColumnJumpChange,
  onAnalysisScopeChange,
  onColorModeChange,
  onInterpretationChange,
  onJumpToAlignmentColumn,
  onJumpToReferencePosition,
  onMotifQueryChange,
  onNextHit,
  onPreviousHit,
  onReferenceModeChange,
  onReferencePositionJumpChange,
  onResetView,
  onResiduePaletteChange,
  onRowFilterChange,
  onSearchScopeChange,
  onShowAnnotationTracksChange,
  onShowIdenticalAsDotsChange,
  onShowRnaStructureOverlaysChange,
  onWindowBack,
  onWindowForward,
  onZoomIn,
  onZoomOut,
  referenceMode,
  referencePositionJump,
  referenceSequence,
  residuePalette,
  rowFilter,
  searchScope,
  selectedHit,
  selectedHitIndex,
  showAnnotationTracks,
  showIdenticalAsDots,
  showRnaStructureOverlays,
  totalHits,
  section,
}: MsaToolbarProps & { section: "display" | "primary" }): React.ReactElement {
  const intl = useIntl();
  const hasAnnotationTracks = document.annotations.length > 0;
  const compatiblePalettes = getCompatibleResiduePalettes(
    document.displayInterpretation.moleculeType,
  );
  const nucleicAcidInterpretation =
    document.displayInterpretation.moleculeType === "dna" ||
    document.displayInterpretation.moleculeType === "rna" ||
    document.displayInterpretation.moleculeType === "nucleic-acid-ambiguous";
  if (section === "primary") {
    return (
      <div className="bio-primary-toolbar flex flex-wrap items-center gap-2 border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
        <div
          aria-label="Motif search"
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          role="group"
        >
          <ToolbarInput
            ariaLabel={intl.formatMessage({
              id: "codex.filePreview.msa.searchMotifAria",
              defaultMessage: "Search MSA motif",
              description: "Accessible label for searching an MSA motif.",
            })}
            onChange={onMotifQueryChange}
            onSubmit={onNextHit}
            placeholder={
              document.searchCapabilities.supportsReverseComplement
                ? intl.formatMessage({
                    id: "codex.filePreview.msa.searchMotifBothStrands",
                    defaultMessage: "Search motif (both strands)",
                    description:
                      "Placeholder text for nucleic-acid motif search with reverse-complement matching.",
                  })
                : intl.formatMessage({
                    id: "codex.filePreview.msa.searchMotif",
                    defaultMessage: "Search motif",
                    description:
                      "Placeholder text for motif search in an MSA viewer.",
                  })
            }
            value={motifQuery}
          />
          <Button color="outline" size="toolbar" onClick={onPreviousHit}>
            <FormattedMessage
              id="codex.filePreview.msa.previousHit"
              defaultMessage="Prev"
              description="Button label for moving to the previous MSA motif-search hit."
            />
          </Button>
          <Button color="outline" size="toolbar" onClick={onNextHit}>
            <FormattedMessage
              id="codex.filePreview.msa.nextHit"
              defaultMessage="Next"
              description="Button label for moving to the next MSA motif-search hit."
            />
          </Button>
          {totalHits > 0 ? (
            <span className="self-center font-medium text-token-text-primary">
              <FormattedMessage
                id="codex.filePreview.msa.hitSummary"
                defaultMessage="{current}/{total} · {orientation}"
                description="Summary of the selected MSA motif-search hit."
                values={{
                  current: selectedHitIndex + 1,
                  orientation: selectedHit?.orientation ?? "",
                  total: totalHits,
                }}
              />
            </span>
          ) : null}
        </div>
        <div
          aria-label="Alignment navigation"
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          role="group"
        >
          <ToolbarInput
            ariaLabel={intl.formatMessage({
              id: "codex.filePreview.msa.filterRowsAria",
              defaultMessage: "Filter MSA rows",
              description:
                "Accessible label for filtering visible MSA sequence rows.",
            })}
            onChange={onRowFilterChange}
            placeholder={intl.formatMessage({
              id: "codex.filePreview.msa.filterRowsPlaceholder",
              defaultMessage: "Filter rows",
              description:
                "Placeholder text for filtering visible MSA sequence rows.",
            })}
            value={rowFilter}
          />
          <ToolbarInput
            ariaLabel={intl.formatMessage({
              id: "codex.filePreview.msa.jumpAlignmentColumn",
              defaultMessage: "Jump to MSA alignment column",
              description:
                "Accessible label for entering an alignment column to jump to in the MSA viewer.",
            })}
            onChange={onAlignmentColumnJumpChange}
            onSubmit={onJumpToAlignmentColumn}
            placeholder={intl.formatMessage({
              id: "codex.filePreview.msa.jumpAlignmentColumnPlaceholder",
              defaultMessage: "Alignment column",
              description:
                "Placeholder for the MSA alignment-column jump input.",
            })}
            value={alignmentColumnJump}
          />
          <Button
            color="outline"
            size="toolbar"
            onClick={onJumpToAlignmentColumn}
          >
            <FormattedMessage
              id="codex.filePreview.msa.jumpAlignmentColumnButton"
              defaultMessage="Go to column"
              description="Button label for jumping to a chosen MSA alignment column."
            />
          </Button>
          <Button color="outline" size="toolbar" onClick={onZoomIn}>
            <FormattedMessage
              id="codex.filePreview.msa.zoomIn"
              defaultMessage="Zoom in"
              description="Button label for showing fewer MSA columns with larger visual cells."
            />
          </Button>
          <Button color="outline" size="toolbar" onClick={onZoomOut}>
            <FormattedMessage
              id="codex.filePreview.msa.zoomOut"
              defaultMessage="Zoom out"
              description="Button label for showing more MSA columns with denser visual cells."
            />
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="bio-inspector-controls space-y-4 text-xs text-token-text-secondary">
      <div className="grid gap-3">
        {referenceSequence == null ? null : (
          <>
            <ToolbarInput
              ariaLabel={intl.formatMessage({
                id: "codex.filePreview.msa.jumpReferenceCoordinate",
                defaultMessage: "Jump to active reference coordinate",
                description:
                  "Accessible label for entering an ungapped active-reference position to jump to.",
              })}
              onChange={onReferencePositionJumpChange}
              onSubmit={onJumpToReferencePosition}
              placeholder={intl.formatMessage({
                id: "codex.filePreview.msa.jumpReferenceCoordinatePlaceholder",
                defaultMessage: "Reference position",
                description:
                  "Placeholder for the active-reference position jump input.",
              })}
              value={referencePositionJump}
            />
            <Button
              color="outline"
              size="toolbar"
              onClick={onJumpToReferencePosition}
            >
              <FormattedMessage
                id="codex.filePreview.msa.jumpReferenceCoordinateButton"
                defaultMessage="Go to reference"
                description="Button label for jumping to an active-reference coordinate."
              />
            </Button>
          </>
        )}
        <ToolbarSelect
          label="Reference"
          ariaLabel={intl.formatMessage({
            id: "codex.filePreview.msa.referenceMode",
            defaultMessage: "MSA reference mode",
            description:
              "Accessible label for selecting an MSA reference mode.",
          })}
          onChange={(event) =>
            onReferenceModeChange(event.target.value as MsaReferenceMode)
          }
          value={referenceMode}
        >
          <option value="none">
            {intl.formatMessage({
              id: "codex.filePreview.msa.reference.none",
              defaultMessage: "No reference",
              description:
                "MSA reference-mode option that disables the reference row.",
            })}
          </option>
          <option value="consensus">
            {document.displayInterpretation.moleculeType === "protein"
              ? intl.formatMessage({
                  id: "codex.filePreview.msa.reference.proteinRepresentative",
                  defaultMessage: "Representative row",
                  description:
                    "MSA reference-mode option that shows a majority-residue representative row for proteins.",
                })
              : intl.formatMessage({
                  id: "codex.filePreview.msa.reference.consensus",
                  defaultMessage: "Consensus",
                  description:
                    "MSA reference-mode option that shows a nucleotide consensus sequence.",
                })}
          </option>
          <option value="anchor">
            {intl.formatMessage({
              id: "codex.filePreview.msa.reference.anchor",
              defaultMessage: "Anchor",
              description:
                "MSA reference-mode option that uses a selected sequence row.",
            })}
          </option>
        </ToolbarSelect>
        {referenceMode === "anchor" ? (
          <ToolbarSelect
            label="Anchor sequence"
            ariaLabel={intl.formatMessage({
              id: "codex.filePreview.msa.anchorRow",
              defaultMessage: "MSA anchor row",
              description:
                "Accessible label for selecting an MSA anchor sequence.",
            })}
            onChange={(event) => onAnchorRowIdChange(event.target.value)}
            value={anchorRowId ?? ""}
          >
            {document.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </ToolbarSelect>
        ) : null}
        <ToolbarSelect
          label="Analyze"
          ariaLabel={intl.formatMessage({
            id: "codex.filePreview.msa.analysisScope",
            defaultMessage: "MSA analysis scope",
            description:
              "Accessible label for selecting which rows drive MSA analysis summaries.",
          })}
          onChange={(event) =>
            onAnalysisScopeChange(event.target.value as MsaAnalysisScope)
          }
          value={analysisScope}
        >
          <option value="all-unhidden-rows">
            {intl.formatMessage({
              id: "codex.filePreview.msa.analysisScope.all",
              defaultMessage: "Analyze all shown-capable rows",
              description:
                "MSA analysis scope option that uses all rows that have not been explicitly hidden.",
            })}
          </option>
          <option value="currently-displayed-rows">
            {intl.formatMessage({
              id: "codex.filePreview.msa.analysisScope.displayed",
              defaultMessage: "Analyze filtered display",
              description:
                "MSA analysis scope option that uses only the rows currently displayed by filters.",
            })}
          </option>
        </ToolbarSelect>
        <ToolbarSelect
          label="Color by"
          ariaLabel={intl.formatMessage({
            id: "codex.filePreview.msa.colorMode",
            defaultMessage: "MSA color mode",
            description: "Accessible label for selecting an MSA color mode.",
          })}
          onChange={(event) =>
            onColorModeChange(event.target.value as MsaColorMode)
          }
          value={colorMode}
        >
          <option value="residue">
            {intl.formatMessage({
              id: "codex.filePreview.msa.colorMode.residue",
              defaultMessage: "Residue colors",
              description:
                "MSA color-mode option that colors cells by the active residue palette.",
            })}
          </option>
          <option value="identity">
            {intl.formatMessage({
              id: "codex.filePreview.msa.colorMode.identity",
              defaultMessage: "Identity",
              description:
                "MSA color-mode option that colors by per-column modal identity.",
            })}
          </option>
          {nucleicAcidInterpretation ? (
            <option value="nucleotide-substitution">
              {intl.formatMessage({
                id: "codex.filePreview.msa.colorMode.nucleotideSubstitution",
                defaultMessage: "Transition / transversion",
                description:
                  "MSA color-mode option that distinguishes transition and transversion substitutions from the active reference.",
              })}
            </option>
          ) : null}
          {document.cdsContext.applicability === "eligible" ? (
            <option value="coding-impact">
              {intl.formatMessage({
                id: "codex.filePreview.msa.colorMode.codingImpact",
                defaultMessage: "Synonymous / nonsynonymous",
                description:
                  "MSA color-mode option that distinguishes coding DNA synonymous and nonsynonymous codon differences from the active reference.",
              })}
            </option>
          ) : null}
          {document.displayInterpretation.moleculeType === "protein" ? (
            <>
              <option value="protein-conservation">
                {intl.formatMessage({
                  id: "codex.filePreview.msa.colorMode.proteinConservation",
                  defaultMessage: "Protein conservation",
                  description:
                    "MSA color-mode option that colors by protein relative-entropy conservation.",
                })}
              </option>
              <option value="protein-similarity">
                {intl.formatMessage({
                  id: "codex.filePreview.msa.colorMode.proteinSimilarity",
                  defaultMessage: "Protein similarity",
                  description:
                    "MSA color-mode option that colors by BLOSUM62 protein similarity.",
                })}
              </option>
            </>
          ) : null}
          <option value="difference">
            {intl.formatMessage({
              id: "codex.filePreview.msa.colorMode.differences",
              defaultMessage: "Differences",
              description:
                "MSA color-mode option that highlights differences from the reference.",
            })}
          </option>
        </ToolbarSelect>
        {colorMode === "residue" && compatiblePalettes.length > 0 ? (
          <ToolbarSelect
            label="Residue palette"
            ariaLabel={intl.formatMessage({
              id: "codex.filePreview.msa.residuePalette",
              defaultMessage: "MSA residue palette",
              description:
                "Accessible label for selecting a modality-specific MSA residue palette.",
            })}
            onChange={(event) =>
              onResiduePaletteChange(event.target.value as MsaResiduePalette)
            }
            value={residuePalette ?? compatiblePalettes[0]}
          >
            {compatiblePalettes.map((palette) => (
              <option key={palette} value={palette}>
                {formatResiduePaletteLabel(intl, palette)}
              </option>
            ))}
          </ToolbarSelect>
        ) : null}
        <ToolbarSelect
          label="Interpret as"
          ariaLabel={intl.formatMessage({
            id: "codex.filePreview.msa.interpretation",
            defaultMessage: "MSA molecule interpretation",
            description:
              "Accessible label for overriding the detected MSA molecule interpretation.",
          })}
          onChange={(event) =>
            onInterpretationChange(event.target.value as MsaMoleculeType)
          }
          value={document.displayInterpretation.moleculeType}
        >
          <option value="dna">
            {intl.formatMessage({
              id: "codex.filePreview.msa.interpretation.dna",
              defaultMessage: "DNA",
              description:
                "MSA molecule-interpretation option for DNA alignments.",
            })}
          </option>
          <option value="rna">
            {intl.formatMessage({
              id: "codex.filePreview.msa.interpretation.rna",
              defaultMessage: "RNA",
              description:
                "MSA molecule-interpretation option for RNA alignments.",
            })}
          </option>
          <option value="protein">
            {intl.formatMessage({
              id: "codex.filePreview.msa.interpretation.protein",
              defaultMessage: "Protein",
              description:
                "MSA molecule-interpretation option for protein alignments.",
            })}
          </option>
          <option value="nucleic-acid-ambiguous">
            {intl.formatMessage({
              id: "codex.filePreview.msa.interpretation.ambiguous",
              defaultMessage: "DNA/RNA ambiguous",
              description:
                "MSA molecule-interpretation option for ambiguous nucleic-acid alignments.",
            })}
          </option>
          <option value="unknown">
            {intl.formatMessage({
              id: "codex.filePreview.msa.interpretation.unknown",
              defaultMessage: "Unknown",
              description:
                "MSA molecule-interpretation option for unclassified alignments.",
            })}
          </option>
        </ToolbarSelect>
        <ToolbarCheckbox
          checked={showIdenticalAsDots}
          label={intl.formatMessage({
            id: "codex.filePreview.msa.dotsForMatches",
            defaultMessage: "Dots for matches",
            description:
              "MSA toolbar checkbox label for rendering identical reference matches as dots.",
          })}
          onChange={onShowIdenticalAsDotsChange}
        />
        <ToolbarCheckbox
          checked={showAnnotationTracks}
          disabled={!hasAnnotationTracks}
          label={
            hasAnnotationTracks
              ? intl.formatMessage({
                  id: "codex.filePreview.msa.annotations",
                  defaultMessage: "Annotations",
                  description:
                    "MSA toolbar checkbox label for showing annotation tracks.",
                })
              : intl.formatMessage({
                  id: "codex.filePreview.msa.annotationsUnavailable",
                  defaultMessage: "Annotations unavailable",
                  description:
                    "MSA toolbar checkbox label indicating that the current file has no annotation tracks.",
                })
          }
          onChange={onShowAnnotationTracksChange}
        />
        <ToolbarCheckbox
          checked={showRnaStructureOverlays}
          disabled={document.rnaStructure == null}
          label={
            document.rnaStructure == null
              ? intl.formatMessage({
                  id: "codex.filePreview.msa.rnaOverlaysUnavailable",
                  defaultMessage: "RNA overlays unavailable",
                  description:
                    "MSA toolbar checkbox label indicating that the file has no RNA pair overlays.",
                })
              : intl.formatMessage({
                  id: "codex.filePreview.msa.rnaOverlays",
                  defaultMessage: "RNA structure overlays",
                  description:
                    "MSA toolbar checkbox label for showing RNA structure overlays.",
                })
          }
          onChange={onShowRnaStructureOverlaysChange}
        />
        <ToolbarSelect
          label="Search in"
          ariaLabel={intl.formatMessage({
            id: "codex.filePreview.msa.searchScope",
            defaultMessage: "MSA motif search scope",
            description:
              "Accessible label for selecting which rows are searched for motifs.",
          })}
          onChange={(event) =>
            onSearchScopeChange(event.target.value as MsaSearchScope)
          }
          value={searchScope}
        >
          <option value="currently-displayed-rows">
            {intl.formatMessage({
              id: "codex.filePreview.msa.searchScope.displayed",
              defaultMessage: "Search displayed rows",
              description:
                "MSA search scope option that searches only filtered/displayed rows.",
            })}
          </option>
          <option value="all-unhidden-rows">
            {intl.formatMessage({
              id: "codex.filePreview.msa.searchScope.all",
              defaultMessage: "Search all unhidden rows",
              description:
                "MSA search scope option that searches every row that has not been explicitly hidden.",
            })}
          </option>
        </ToolbarSelect>
      </div>
      <div className="border-t border-token-border pt-3">
        <h3 className="mb-2 font-medium text-token-text-primary">Navigation</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button color="outline" size="toolbar" onClick={onResetView}>
            <FormattedMessage
              id="codex.filePreview.msa.resetView"
              defaultMessage="Reset view"
              description="Button label for resetting the MSA viewer view state."
            />
          </Button>
          <Button color="outline" size="toolbar" onClick={onWindowBack}>
            <FormattedMessage
              id="codex.filePreview.msa.previousColumns"
              defaultMessage="Previous columns"
              description="Button label for moving the visible MSA window to earlier alignment columns."
            />
          </Button>
          <Button color="outline" size="toolbar" onClick={onWindowForward}>
            <FormattedMessage
              id="codex.filePreview.msa.nextColumns"
              defaultMessage="Next columns"
              description="Button label for moving the visible MSA window to later alignment columns."
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToolbarSelect({
  ariaLabel,
  children,
  label,
  onChange,
  value,
}: {
  ariaLabel: string;
  children: ReactNode;
  label?: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  value: string;
}): React.ReactElement {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="font-medium text-token-text-secondary">
        {label ?? ariaLabel}
      </span>
      <select
        aria-label={ariaLabel}
        className="h-8 min-w-0 max-w-full rounded-md border border-token-border bg-token-input-background px-2 text-xs text-token-text-primary outline-none focus:border-token-focus-border"
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function ToolbarInput({
  ariaLabel,
  onChange,
  onSubmit,
  placeholder,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}): React.ReactElement {
  return (
    <input
      aria-label={ariaLabel}
      className="h-7 min-w-36 rounded-md border border-token-border bg-token-input-background px-2 text-xs text-token-text-primary outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onSubmit != null) {
          event.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      value={value}
    />
  );
}

function ToolbarCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}): React.ReactElement {
  return (
    <label
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border border-token-border px-2 text-xs",
        disabled
          ? "cursor-not-allowed text-token-text-tertiary"
          : "text-token-text-primary",
      )}
    >
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function MsaStatusFooter({
  document,
  focusedCell,
  selectedHit,
  visibleRange,
  visibleRowCount,
}: {
  document: MsaDocument;
  focusedCell: FocusedMsaCell;
  selectedHit: MsaMotifSearchHit | null;
  visibleRange: { end: number; start: number };
  visibleRowCount: number;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-token-border px-3 py-2 text-xs text-token-text-secondary">
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.visibleColumns"
          defaultMessage="Visible columns {start, number}-{end, number}"
          description="MSA footer summary of the currently visible alignment-column range."
          values={{ end: visibleRange.end, start: visibleRange.start + 1 }}
        />
      </span>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.visibleRows"
          defaultMessage="{count, number} visible rows"
          description="MSA footer summary of how many sequence rows are currently visible."
          values={{ count: visibleRowCount }}
        />
      </span>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.parseWarnings"
          defaultMessage="{count, number} parse warnings"
          description="MSA footer summary of parser warning count."
          values={{ count: document.warnings.length }}
        />
      </span>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.cdsMode"
          defaultMessage="CDS mode: {mode}"
          description="MSA footer summary of whether coding-sequence helpers are applicable."
          values={{ mode: document.cdsContext.applicability }}
        />
      </span>
      <span className="text-token-text-tertiary">
        Arrow, Home/End, and Page keys navigate; hold Shift to select columns.
      </span>
      {selectedHit == null ? null : (
        <span>
          <FormattedMessage
            id="codex.filePreview.msa.matchSummary"
            defaultMessage="Match {row}:{start, number}-{end, number} ({orientation})"
            description="MSA footer summary of the selected motif-search match."
            values={{
              end: selectedHit.alignmentEndColumn + 1,
              orientation: selectedHit.orientation,
              row: selectedHit.rowLabel,
              start: selectedHit.alignmentStartColumn + 1,
            }}
          />
        </span>
      )}
      {focusedCell == null ? null : (
        <span className="ml-auto font-medium text-token-text-primary">
          <FormattedMessage
            id="codex.filePreview.msa.focusedCellSummary"
            defaultMessage="{label} · col {column, number} · {symbol} · {residueClass}"
            description="MSA footer summary for the matrix cell currently under the cursor or keyboard focus."
            values={{
              column: focusedCell.column + 1,
              label: focusedCell.row.label,
              residueClass: classifyResidue(
                focusedCell.symbol,
                document.displayInterpretation.moleculeType,
              ),
              symbol: focusedCell.symbol,
            }}
          />
        </span>
      )}
    </div>
  );
}

function MsaPreviewShell({
  children,
  className,
  filePath,
  showFileHeader = true,
}: {
  children: ReactNode;
  className?: string;
  filePath?: string;
  showFileHeader?: boolean;
}): React.ReactElement {
  return (
    <div
      className={clsx(
        "flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-token-main-surface-primary",
        className,
      )}
    >
      {showFileHeader && filePath != null ? (
        <div className="border-b border-token-border px-3 py-2 text-sm font-medium text-token-text-primary">
          {basenameFromPath(filePath)}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function basenameFromPath(path: string): string {
  const slashIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
}

function formatMoleculeLabel(moleculeType: MsaMoleculeType): string {
  switch (moleculeType) {
    case "dna":
      return "DNA";
    case "mixed":
      return "Mixed";
    case "nucleic-acid-ambiguous":
      return "DNA/RNA ambiguous";
    case "protein":
      return "Protein";
    case "rna":
      return "RNA";
    case "unknown":
      return "Unknown";
  }
}
