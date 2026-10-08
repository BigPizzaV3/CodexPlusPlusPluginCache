import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { createArtifactStateKey } from "../artifact-state-key";
import { decodeBamWindowToSam } from "../bam-decoder";
import { decodeCramWindowToSam } from "../cram-decoder";
import { useModelContext, type ModelContextUpdater } from "../model-context";
import { alignSequences, exportAlignedFasta } from "../msa/alignment-editing";
import {
  applySequenceDurableDocumentPatches,
  createDurableSequenceState,
  SequenceDurableViewerStateContext,
} from "../persistent/durable-viewer-state";
import {
  MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
  type ScientificSequenceDataClient,
} from "../persistent/scientific-data-client";
import {
  createSequenceOriginalSourceReplacementPlan,
  sequenceOriginalSourceUploadChunks,
  streamSequenceOriginalSourceReplacement,
  type SequenceOriginalSourceReplacementPlan,
} from "../persistent/streaming-source-replacement";
import { resolveViewerTarget } from "../target-resolution";
import { Button } from "../ui/button";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import type {
  SequenceViewerAnnotationRequest,
  SequenceViewerAnalysisRequest,
  SequenceViewerEditRequest,
} from "../viewer-operations";
import type { SequenceWorkspaceArtifactPublisher } from "../views/workbench-persistence";
import type { SequenceWorkspaceSessionClient } from "../views/workspace-sessions";
import type { SequenceWorkspaceTrackBrowserClient } from "../views/workspace-tracks";
import { exportSequenceWorkbench } from "../workbench-exports";
import {
  createSequenceWorkbenchState,
  parseWorkbenchSession,
  sequenceWorkbenchReducer,
  serializeWorkbenchSession,
  settleRestoredJobs,
} from "../workbench-state";
import { workspaceSessionDefaultName } from "../workspace-session-controls";
import {
  ChromatogramPanel,
  type ChromatogramViewState,
} from "./chromatogram-panel";
import { clampSequenceCoordinate } from "./coordinate-map";
import { EvidenceTrackPanel } from "./evidence-track-panel";
import { FastqSummaryPanel } from "./fastq-summary-panel";
import {
  createFastqQualityViewState,
  type FastqQualityReportState,
} from "./fastq-quality-analysis";
import { getLocalFeatureSegments } from "./feature-location";
import { resolveSequenceFeatureSelector } from "./feature-resolution";
import { getGeneticCode } from "./genetic-code";
import {
  createSequenceInterfaceSettings,
  validateSequenceInterfaceSettingsForSource,
} from "./interface-state";
import {
  createSequenceInteractionState,
  sequenceInteractionReducer,
} from "./interaction-state";
import { MetadataPanel } from "./metadata-panel";
import { createSequenceViewerModelContext } from "./model-context";
import {
  displaySelectionToSource,
  orientSearchHit,
  orientSequenceRecord,
  sourceCoordinateToDisplay,
  sourceRangeToDisplay,
} from "./orientation";
import { PerformanceBanners } from "./performance-banners";
import { PinnedInspector } from "./pinned-inspector";
import { QualityTrack } from "./quality-track";
import {
  DEFAULT_READ_PILEUP_STATE,
  getReadPileupEntryForRecord,
  type ReadPileupState,
} from "./read-pileup";
import {
  DEFAULT_SEQUENCE_RECORD_BROWSER_STATE,
  normalizeSequenceRecordBrowserState,
  RecordListPanel,
} from "./record-list-panel";
import { SearchPanel } from "./search-panel";
import { createOriginSpanningSelection } from "./selection";
import { SequenceLegend } from "./sequence-legend";
import {
  normalizeSequenceAnnotationIndexState,
  SequenceOverview,
  type SequenceAnnotationIndexState,
} from "./sequence-overview";
import {
  getCompatibleSequencePalettes,
  getDefaultSequencePalette,
} from "./sequence-palette";
import { SequenceRenderer } from "./sequence-renderer";
import { SequenceToolbar } from "./sequence-toolbar";
import { SequenceWorkbenchPanel } from "./sequence-workbench-panel";
import { parseSequenceTrack, type SequenceTrackFormat } from "./tracks";
import type {
  SequenceDocument,
  SequenceFeature,
  SequencePaletteId,
  SequenceRecord,
  SequenceSearchHit,
  SequenceSelection,
} from "./types";
import { useSequenceSearch } from "./use-sequence-search";
import {
  createSequenceInterfaceSnapshot,
  isSequenceInterfaceCommand,
  useSequenceInterfaceCommands,
} from "./use-sequence-interface-commands";
import {
  isWorkbenchOperationCommand,
  createSequenceWorkbenchSession,
  runSequenceWorkbenchJob,
  useSequenceWorkbenchCommands,
  type SequenceWorkbenchRestoreSource,
  type SequenceWorkbenchView,
} from "./use-sequence-workbench-commands";
import { WarningsDrawer } from "./warnings-drawer";
import {
  applySequenceAnnotationRequest,
  applySequenceEditRequest,
} from "./workbench-controller";

export function SequenceRichViewer({
  browseWorkspaceTracks,
  command,
  document: initialDocument,
  onCommandResult,
  onOpenAlignment,
  publishWorkspaceArtifact,
  sourceStateKeyOverride,
  toolbarRevealed,
  toolbarVisible = true,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  browseWorkspaceTracks?: SequenceWorkspaceTrackBrowserClient;
  command?: QueuedSequenceViewerCommand;
  document: SequenceDocument;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  onOpenAlignment?: (alignedFasta: string, name: string) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
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
  const activeSourceEditRef = useRef<AbortController | null>(null);
  const [sourceSaveState, setSourceSaveState] = useState<{
    status: "idle" | "saving" | "saved";
    message?: string;
    error?: string;
  }>({ status: "idle" });
  const restoredCheckpointRef = useRef<string | null>(null);
  const restoredSearchHitRef = useRef<number | null>(null);
  const [workbenchState, dispatchWorkbench] = useReducer(
    sequenceWorkbenchReducer,
    initialDocument,
    createSequenceWorkbenchState,
  );
  const workbenchStateRef = useRef(workbenchState);
  workbenchStateRef.current = workbenchState;
  const document = workbenchState.document;
  const sourceStateKey = useMemo(
    () =>
      sourceStateKeyOverride ??
      createArtifactStateKey(
        initialDocument.records
          .map(({ id, sequence }) => `${id}\u001f${sequence}`)
          .join("\u001e"),
        initialDocument.fileName,
      ),
    [initialDocument, sourceStateKeyOverride],
  );
  const sourceStateKeyRef = useRef(sourceStateKey);
  const sourceDocumentReady = sourceStateKeyRef.current === sourceStateKey;
  useEffect(() => {
    if (sourceStateKeyRef.current === sourceStateKey) return;
    sourceStateKeyRef.current = sourceStateKey;
    dispatchWorkbench({
      document: initialDocument,
      type: "reset-sequence-document",
    });
    dispatchInteraction({ type: "clear-selection" });
    dispatchInteraction({
      recordId: initialDocument.records[0]?.id ?? "",
      type: "select-record",
    });
    setSourceSaveState({ status: "idle" });
    setRecordBrowserState(DEFAULT_SEQUENCE_RECORD_BROWSER_STATE);
    setAnnotationIndexState({ expanded: false, page: 0, query: "" });
    setOriginRangeExpanded(false);
    setChromatogramView({ basesPerWindow: 40, firstBase: 1 });
    setReadPileupState(DEFAULT_READ_PILEUP_STATE);
    setQualityReport(null);
    setQualityAdapterSequence(null);
    qualityReportDocumentRef.current = null;
    interfaceRestoreEpochRef.current += 1;
    setQualityView(createFastqQualityViewState());
  }, [initialDocument, sourceStateKey]);
  const [interactionState, dispatchInteraction] = useReducer(
    sequenceInteractionReducer,
    document.records[0]?.id ?? "",
    createSequenceInteractionState,
  );
  const {
    activeSearchHitIndex,
    focusCoordinate,
    selectedFeature,
    selectedRecordId,
    selection,
  } = interactionState;
  const setSelectedRecordId = (recordId: string): void =>
    dispatchInteraction({ recordId, type: "select-record" });
  const setSelectedFeature = (feature: SequenceFeature | undefined): void =>
    dispatchInteraction({ feature, type: "set-feature" });
  const setFocusCoordinate = (coordinate: number | undefined): void =>
    dispatchInteraction({ coordinate, type: "set-focus" });
  const setActiveSearchHitIndex = (
    value: number | ((current: number) => number),
  ): void =>
    dispatchInteraction({
      index: typeof value === "function" ? value(activeSearchHitIndex) : value,
      type: "set-search-hit",
    });
  const [query, setQuery] = useState("");
  const [paletteChoice, setPaletteChoice] = useState<{
    paletteId: SequencePaletteId;
    recordId: string;
    restoredFrom?: string;
    sourceStateKey: string;
  }>(() => ({
    paletteId: getDefaultSequencePalette(
      initialDocument.records[0]?.molecule ?? "unknown",
    ),
    recordId: initialDocument.records[0]?.id ?? "",
    sourceStateKey,
  }));
  const [wrapWidth, setWrapWidth] = useState(60);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showQuality, setShowQuality] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [geneticCodeId, setGeneticCodeId] = useState(1);
  const [layout, setLayout] = useState<"circular" | "linear" | "split">(
    "linear",
  );
  const [orientation, setOrientation] = useState<
    "forward" | "reverse-complement"
  >("forward");
  const [synchronizedViews, setSynchronizedViews] = useState(true);
  const [viewport, setViewport] = useState<{
    end: number;
    start: number;
  } | null>(null);
  const [workbenchError, setWorkbenchError] = useState<string>();
  const [hoverCoordinate, setHoverCoordinate] = useState<number>();
  const [coordinateDraft, setCoordinateDraft] = useState("");
  const [recordBrowserState, setRecordBrowserState] = useState(
    DEFAULT_SEQUENCE_RECORD_BROWSER_STATE,
  );
  const [annotationIndexState, setAnnotationIndexState] =
    useState<SequenceAnnotationIndexState>({
      expanded: false,
      page: 0,
      query: "",
    });
  const [originRangeExpanded, setOriginRangeExpanded] = useState(false);
  const [chromatogramViewState, setChromatogramView] =
    useState<ChromatogramViewState>({
      basesPerWindow: 40,
      firstBase: 1,
    });
  const [readPileupStateValue, setReadPileupState] = useState<ReadPileupState>(
    DEFAULT_READ_PILEUP_STATE,
  );
  const [qualityReport, setQualityReport] =
    useState<FastqQualityReportState | null>(null);
  const [qualityAdapterSequence, setQualityAdapterSequence] = useState<
    string | null
  >(null);
  const [qualityView, setQualityView] = useState(createFastqQualityViewState);
  const qualityReportDocumentRef = useRef<SequenceDocument | null>(null);
  const interfaceRestoreEpochRef = useRef(0);
  const interfaceRestoreEpoch = interfaceRestoreEpochRef.current;
  const onQualityReportChange = useCallback(
    (next: FastqQualityReportState): void => {
      if (next.pending) {
        qualityReportDocumentRef.current = workbenchStateRef.current.document;
        setQualityAdapterSequence(next.adapterSequence);
      }
      setQualityReport((current) =>
        next.pending || current?.jobId === next.jobId ? next : current,
      );
    },
    [],
  );
  const currentQualityReport =
    sourceDocumentReady && qualityReportDocumentRef.current === document
      ? qualityReport
      : null;
  const selectedRecord =
    document.records.find(({ id }) => id === selectedRecordId) ??
    document.records[0];
  const paletteMatchesRecord =
    paletteChoice.sourceStateKey === sourceStateKey &&
    paletteChoice.recordId === selectedRecord?.id;
  const compatiblePalettes = getCompatibleSequencePalettes(
    selectedRecord?.molecule ?? "unknown",
  );
  const paletteId =
    paletteMatchesRecord &&
    compatiblePalettes.some(({ id }) => id === paletteChoice.paletteId)
      ? paletteChoice.paletteId
      : getDefaultSequencePalette(selectedRecord?.molecule ?? "unknown");
  const paletteRestoreNotice =
    paletteMatchesRecord && paletteChoice.restoredFrom != null
      ? `Saved palette "${paletteChoice.restoredFrom}" is unavailable for ${selectedRecord?.molecule ?? "unknown"} sequences; using ${compatiblePalettes.find(({ id }) => id === paletteId)?.label ?? paletteId} instead.`
      : null;
  const setPaletteId = useCallback(
    (nextPaletteId: SequencePaletteId): void => {
      setPaletteChoice({
        paletteId: nextPaletteId,
        recordId: selectedRecord?.id ?? "",
        sourceStateKey,
      });
    },
    [selectedRecord?.id, sourceStateKey],
  );
  const recordBrowser = useMemo(
    () =>
      normalizeSequenceRecordBrowserState(document.records, recordBrowserState),
    [document.records, recordBrowserState],
  );
  const annotationIndex = useMemo(
    () =>
      selectedRecord == null
        ? annotationIndexState
        : normalizeSequenceAnnotationIndexState(
            selectedRecord,
            annotationIndexState,
          ),
    [annotationIndexState, selectedRecord],
  );
  const changeAnnotationIndex = useCallback(
    (patch: Partial<SequenceAnnotationIndexState>): void => {
      setAnnotationIndexState((current) => ({ ...current, ...patch }));
    },
    [],
  );
  const annotationIndexControl = useMemo(
    () => ({ ...annotationIndex, onChange: changeAnnotationIndex }),
    [annotationIndex, changeAnnotationIndex],
  );
  const interfaceRecordRef = useRef(selectedRecord?.id);
  const chromatogramView = useMemo<ChromatogramViewState>(() => {
    if (interfaceRecordRef.current !== selectedRecord?.id) {
      return { basesPerWindow: 40, firstBase: 1 };
    }
    return {
      ...chromatogramViewState,
      firstBase: Math.min(
        chromatogramViewState.firstBase,
        Math.max(1, selectedRecord?.length ?? 1),
      ),
    };
  }, [chromatogramViewState, selectedRecord?.id, selectedRecord?.length]);
  const readPileupState = useMemo(() => {
    if (readPileupStateValue.selectedRead == null) return readPileupStateValue;
    try {
      if (selectedRecord == null)
        throw new Error("No reference record is selected.");
      getReadPileupEntryForRecord(
        workbenchState.tracks,
        readPileupStateValue.selectedRead,
        selectedRecord,
        document.records,
      );
      return readPileupStateValue;
    } catch {
      // Source edits, record switches and removed tracks cannot retain a
      // projected read selection or serialize it into the next checkpoint.
      return { ...readPileupStateValue, selectedRead: null };
    }
  }, [
    document.records,
    readPileupStateValue,
    selectedRecord,
    workbenchState.tracks,
  ]);
  useEffect(() => {
    if (interfaceRecordRef.current === selectedRecord?.id) return;
    interfaceRecordRef.current = selectedRecord?.id;
    setAnnotationIndexState({ expanded: false, page: 0, query: "" });
    setOriginRangeExpanded(false);
    setChromatogramView({ basesPerWindow: 40, firstBase: 1 });
    setReadPileupState((current) => ({ ...current, selectedRead: null }));
  }, [selectedRecord?.id]);
  useEffect(() => {
    if (readPileupState !== readPileupStateValue) {
      setReadPileupState((current) =>
        current === readPileupStateValue ? readPileupState : current,
      );
    }
  }, [readPileupState, readPileupStateValue]);
  const nativeSourceEditClient =
    durableViewerState == null
      ? null
      : getNativeSequenceSourceEditClient(durableViewerState.client);
  const sourceSaveAvailability = getOriginalSequenceSaveAvailability({
    current: document,
    initial: initialDocument,
    sourceRevision: nativeSourceEditClient?.session.sourceRevision,
  });
  const saveOriginalSequence = useCallback(async (): Promise<void> => {
    if (
      nativeSourceEditClient == null ||
      !sourceSaveAvailability.available ||
      !workbenchState.dirty ||
      sourceSaveState.status !== "idle" ||
      activeSourceEditRef.current != null
    ) {
      return;
    }
    const controller = new AbortController();
    activeSourceEditRef.current = controller;
    let editId: string | undefined;
    let committed = false;
    setSourceSaveState({ status: "saving" });
    setWorkbenchError(undefined);
    try {
      const originalSource = streamSequenceOriginalSourceReplacement({
        client: nativeSourceEditClient,
        plan: sourceSaveAvailability.plan,
        signal: controller.signal,
      });
      const firstFragment = await originalSource.next();
      if (firstFragment.done || firstFragment.value.byteLength === 0) {
        throw new Error("An empty sequence cannot replace the original file.");
      }
      let lease = await nativeSourceEditClient.beginSourceEdit({
        approvedOperation: "replace-source",
        expectedSourceRevision: nativeSourceEditClient.session.sourceRevision,
        signal: controller.signal,
      });
      editId = lease.editId;
      const maxChunkBytes = Math.min(
        lease.maxChunkBytes ?? 64 * 1024,
        MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
      );
      const fragments = (async function* () {
        yield firstFragment.value;
        yield* originalSource;
      })();
      for await (const chunk of sequenceOriginalSourceUploadChunks({
        maxChunkBytes,
        signal: controller.signal,
        source: fragments,
      })) {
        const requestId = globalThis.crypto.randomUUID();
        for (let attempt = 0; ; attempt += 1) {
          try {
            if (lease.expiresAtMs - Date.now() <= 30_000) {
              lease = await renewOriginalSequenceSourceEdit({
                client: nativeSourceEditClient,
                editId,
                expectedOffsetDecimal: chunk.offsetDecimal,
                maxChunkBytes: chunk.bytes.byteLength,
                signal: controller.signal,
              });
            }
            lease = await nativeSourceEditClient.appendSourceEdit({
              bytes: chunk.bytes,
              editId,
              offsetDecimal: chunk.offsetDecimal,
              requestId,
              signal: controller.signal,
            });
            break;
          } catch (error) {
            if (
              controller.signal.aborted ||
              attempt >= 2 ||
              !isRecoverableSequenceSourceEditError(error)
            ) {
              throw error;
            }
            const resumed = await renewOriginalSequenceSourceEdit({
              client: nativeSourceEditClient,
              editId,
              maxChunkBytes: chunk.bytes.byteLength,
              signal: controller.signal,
            });
            if (
              resumed.state === "published" ||
              (resumed.maxChunkBytes ?? maxChunkBytes) < chunk.bytes.byteLength
            ) {
              throw new Error(
                "The original Sequence edit cannot resume its bounded chunk.",
              );
            }
            const durableOffset = BigInt(resumed.bytesWrittenDecimal);
            if (
              durableOffset ===
              BigInt(chunk.offsetDecimal) + BigInt(chunk.bytes.byteLength)
            ) {
              lease = resumed;
              break;
            }
            if (durableOffset !== BigInt(chunk.offsetDecimal)) {
              throw new Error(
                "The original Sequence edit resumed at an inconsistent offset.",
              );
            }
            lease = resumed;
          }
        }
      }
      let result;
      try {
        if (lease.expiresAtMs - Date.now() <= 30_000) {
          lease = await renewOriginalSequenceSourceEdit({
            client: nativeSourceEditClient,
            editId,
            expectedOffsetDecimal: lease.bytesWrittenDecimal,
            maxChunkBytes,
            signal: controller.signal,
          });
        }
        result = await nativeSourceEditClient.commitSourceEdit({
          editId,
          signal: controller.signal,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          !isRecoverableSequenceSourceEditError(error)
        ) {
          throw error;
        }
        const resumed = await nativeSourceEditClient.resumeSourceEdit({
          editId,
          signal: controller.signal,
        });
        result =
          resumed.state === "published" && resumed.committedResult != null
            ? resumed.committedResult
            : await nativeSourceEditClient.commitSourceEdit({
                editId,
                signal: controller.signal,
              });
      }
      committed = true;
      if (
        result.sourceRevision === nativeSourceEditClient.session.sourceRevision
      ) {
        throw new Error(
          "The saved sequence must be reopened with its new source revision.",
        );
      }
      durableViewerState?.dispose();
      dispatchWorkbench({ dirty: false, type: "set-dirty" });
      setSourceSaveState({
        message:
          "Original sequence saved. Reopen the file to continue with its updated source revision.",
        status: "saved",
      });
    } catch (error) {
      if (editId != null && !committed) {
        try {
          await nativeSourceEditClient.abortSourceEdit({ editId });
        } catch {
          // The host revokes expired or disconnected source-edit leases.
        }
      }
      setSourceSaveState({
        error:
          error instanceof Error
            ? error.message
            : "The original sequence file could not be saved.",
        status: "idle",
      });
    } finally {
      if (activeSourceEditRef.current === controller) {
        activeSourceEditRef.current = null;
      }
    }
  }, [
    document,
    durableViewerState,
    nativeSourceEditClient,
    sourceSaveAvailability,
    sourceSaveState.status,
    workbenchState.dirty,
  ]);
  const effectiveShowQuality = showQuality && selectedRecord?.quality != null;
  const effectiveShowTranslation =
    showTranslation && recordHasTranslatedCds(selectedRecord);
  const orientedRecord = useMemo(
    () =>
      selectedRecord == null
        ? undefined
        : orientSequenceRecord(selectedRecord, orientation),
    [orientation, selectedRecord],
  );
  const displaySelection = useMemo(
    () =>
      selectedRecord == null || selection == null
        ? undefined
        : displaySelectionToSource(
            selection,
            selectedRecord.length,
            orientation,
          ),
    [orientation, selectedRecord, selection],
  );
  const workbenchView = useMemo<SequenceWorkbenchView>(
    () => ({
      geneticCodeId,
      interface: {
        annotationIndex,
        chromatogram: chromatogramView,
        originRangeExpanded,
        quality: { adapterSequence: qualityAdapterSequence, view: qualityView },
        readPileup: readPileupState,
        recordBrowser,
      },
      layout,
      orientation,
      paletteId,
      selectedFeatureId: selectedFeature?.id ?? null,
      selectedRecordId: selectedRecord?.id ?? selectedRecordId,
      selection: selection ?? null,
      showFeatures,
      showQuality: effectiveShowQuality,
      showTranslation: effectiveShowTranslation,
      synchronizedViews,
      viewport,
      wrapWidth,
    }),
    [
      annotationIndex,
      chromatogramView,
      effectiveShowQuality,
      effectiveShowTranslation,
      geneticCodeId,
      layout,
      orientation,
      originRangeExpanded,
      paletteId,
      qualityAdapterSequence,
      qualityView,
      readPileupState,
      recordBrowser,
      selectedFeature?.id,
      selectedRecord?.id,
      selectedRecordId,
      selection,
      showFeatures,
      synchronizedViews,
      viewport,
      wrapWidth,
    ],
  );
  const restoreWorkbenchView = useCallback(
    (
      view: SequenceWorkbenchView,
      source?: SequenceWorkbenchRestoreSource,
    ): void => {
      const restoredSource = source ?? workbenchStateRef.current;
      const restoredRecord = restoredSource.document.records.find(
        ({ id }) => id === view.selectedRecordId,
      );
      if (restoredRecord == null) {
        throw new Error(
          "The saved selection does not identify a restored source record.",
        );
      }
      const settings = view.interface ?? createSequenceInterfaceSettings();
      validateSequenceInterfaceSettingsForSource({
        record: restoredRecord,
        records: restoredSource.document.records,
        settings,
        tracks: restoredSource.tracks,
      });
      const savedPalette = getCompatibleSequencePalettes(
        restoredRecord.molecule,
      ).find(({ id }) => id === view.paletteId);
      const restoredPaletteId =
        savedPalette?.id ?? getDefaultSequencePalette(restoredRecord.molecule);
      interfaceRecordRef.current = restoredRecord.id;
      setRecordBrowserState(
        normalizeSequenceRecordBrowserState(
          restoredSource.document.records,
          settings.recordBrowser,
        ),
      );
      setAnnotationIndexState(
        normalizeSequenceAnnotationIndexState(
          restoredRecord,
          settings.annotationIndex,
        ),
      );
      setChromatogramView(settings.chromatogram);
      setOriginRangeExpanded(settings.originRangeExpanded);
      setReadPileupState(settings.readPileup);
      setQualityView(settings.quality.view);
      setQualityAdapterSequence(settings.quality.adapterSequence);
      setQualityReport(null);
      qualityReportDocumentRef.current = null;
      // A restore can run earlier in this render's effects. Do not let that
      // render start a report with the previous document or adapter settings.
      interfaceRestoreEpochRef.current += 1;
      setGeneticCodeId(view.geneticCodeId);
      setLayout(view.layout);
      setOrientation(view.orientation);
      setPaletteChoice({
        paletteId: restoredPaletteId,
        recordId: restoredRecord.id,
        restoredFrom:
          savedPalette == null ? view.paletteId.slice(0, 100) : undefined,
        sourceStateKey: sourceStateKeyRef.current,
      });
      setShowFeatures(view.showFeatures);
      setShowQuality(view.showQuality);
      setShowTranslation(view.showTranslation);
      setSynchronizedViews(view.synchronizedViews);
      setViewport(view.viewport);
      setWrapWidth(view.wrapWidth);
      dispatchInteraction({
        recordId: view.selectedRecordId,
        type: "select-record",
      });
      if (view.selection == null) {
        dispatchInteraction({ type: "clear-selection" });
      } else {
        dispatchInteraction({
          selection: view.selection,
          type: "select-range",
        });
      }
      dispatchInteraction({
        feature: restoredRecord.features.find(
          ({ id }) => id === view.selectedFeatureId,
        ),
        type: "set-feature",
      });
    },
    [],
  );

  const restoredNativeSequence =
    durableViewerState?.restoredState?.sourceStateKey === sourceStateKey
      ? durableViewerState.restoredState.sequence
      : undefined;
  const [nativeRecoveryReady, setNativeRecoveryReady] = useState(
    () => restoredNativeSequence == null,
  );
  const viewerStateReady = sourceDocumentReady && nativeRecoveryReady;

  useEffect(() => {
    if (restoredNativeSequence == null || durableViewerState == null) {
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
        JSON.stringify(restoredNativeSequence.session),
      );
      if (
        session.view.mode !== "sequence" ||
        session.source.stateKey !== sourceStateKey ||
        session.source.format !== initialDocument.format ||
        session.source.fileName !== (initialDocument.fileName ?? null)
      ) {
        throw new Error(
          "The native Sequence checkpoint belongs to a different source artifact.",
        );
      }
      const restoredDocument = createSequenceWorkbenchState(
        applySequenceDurableDocumentPatches(
          initialDocument,
          restoredNativeSequence.documentPatches,
        ),
        initialDocument,
      ).document;
      const restoredRecord = restoredDocument.records.find(
        ({ id }) => id === restoredNativeSequence.view.selectedRecordId,
      );
      if (restoredRecord == null) {
        throw new Error(
          "The native Sequence checkpoint selected an unavailable source record.",
        );
      }
      validateSequenceInterfaceSettingsForSource({
        record: restoredRecord,
        records: restoredDocument.records,
        settings:
          restoredNativeSequence.view.interface ??
          createSequenceInterfaceSettings(),
        tracks: session.tracks,
      });
      if (
        restoredNativeSequence.documentPatches.length > 0 ||
        restoredNativeSequence.history.length > 0 ||
        restoredNativeSequence.future.length > 0
      ) {
        const historicalDocuments = restoredNativeSequence.history.map(
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
          sourceDocument: initialDocument,
          type: "reset-sequence-document",
        });
        for (let index = 1; index < historicalDocuments.length; index++) {
          dispatchWorkbench({
            description:
              historicalDocuments[index - 1]?.description ??
              "Automatically restored native sequence history.",
            document: historicalDocuments[index]?.document ?? initialDocument,
            type: "restore-sequence-document",
          });
        }
        dispatchWorkbench({
          description:
            historicalDocuments.at(-1)?.description ??
            "Automatically restored native sequence edits.",
          document: restoredDocument,
          type: "restore-sequence-document",
        });
        for (const entry of [...restoredNativeSequence.future].reverse()) {
          dispatchWorkbench({
            description: entry.description,
            document: applySequenceDurableDocumentPatches(
              initialDocument,
              entry.patches,
            ),
            type: "restore-sequence-document",
          });
        }
        for (
          let index = 0;
          index < restoredNativeSequence.future.length;
          index++
        ) {
          dispatchWorkbench({ type: "undo-sequence-document" });
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
      restoredSearchHitRef.current =
        restoredNativeSequence.activeSearchHitIndex;
      restoreWorkbenchView(restoredNativeSequence.view, {
        document: restoredDocument,
        tracks: session.tracks,
      });
      setQuery(restoredNativeSequence.query);
      dispatchInteraction({
        coordinate: restoredNativeSequence.focusCoordinate ?? undefined,
        type: "set-focus",
      });
      restoredCheckpointRef.current = checkpointKey;
      setWorkbenchError(undefined);
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The native Sequence checkpoint could not be restored.",
      );
    } finally {
      setNativeRecoveryReady(true);
    }
  }, [
    durableViewerState,
    initialDocument,
    restoreWorkbenchView,
    restoredNativeSequence,
    sourceStateKey,
  ]);

  useEffect(() => {
    if (selectedRecord == null) {
      return;
    }
    setHoverCoordinate(undefined);
    setCoordinateDraft("");
  }, [selectedRecord]);

  const searchResult = useSequenceSearch({ query, record: selectedRecord });
  const hits = searchResult.hits;
  useEffect(() => {
    const restoredHitIndex = restoredSearchHitRef.current;
    if (restoredHitIndex != null) {
      dispatchInteraction({
        index: restoredHitIndex,
        type: "set-search-hit",
      });
      restoredSearchHitRef.current = null;
      return;
    }
    dispatchInteraction({ type: "reset-search" });
  }, [query, selectedRecord?.id]);
  useEffect(() => {
    if (
      durableViewerState == null ||
      !sourceDocumentReady ||
      !nativeRecoveryReady ||
      sourceSaveState.status === "saved"
    ) {
      return;
    }
    try {
      durableViewerState.updateSequence({
        sourceStateKey,
        state: createDurableSequenceState({
          activeSearchHitIndex,
          focusCoordinate,
          initialDocument,
          query,
          sourceStateKey,
          state: workbenchState,
          view: workbenchView,
        }),
      });
    } catch (error) {
      setWorkbenchError(
        error instanceof Error
          ? error.message
          : "The native Sequence state could not be checkpointed.",
      );
    }
  }, [
    activeSearchHitIndex,
    durableViewerState,
    focusCoordinate,
    initialDocument,
    nativeRecoveryReady,
    query,
    sourceSaveState.status,
    sourceDocumentReady,
    sourceStateKey,
    workbenchState,
    workbenchView,
  ]);
  useEffect(() => {
    if (durableViewerState == null) return;
    const flushCheckpoint = (): void => {
      void durableViewerState.flush().catch(() => {
        // The host retains the previous good checkpoint for automatic retry.
      });
    };
    window.addEventListener("pagehide", flushCheckpoint);
    return () => {
      window.removeEventListener("pagehide", flushCheckpoint);
      flushCheckpoint();
    };
  }, [durableViewerState]);
  useEffect(
    () => () => {
      activeSourceEditRef.current?.abort(
        new DOMException("The Sequence viewer was closed.", "AbortError"),
      );
    },
    [],
  );
  useSequenceWorkbenchCommands({
    cancelledJobsRef,
    command:
      viewerStateReady && !isSequenceInterfaceCommand(command)
        ? command
        : undefined,
    dispatch: dispatchWorkbench,
    handledCommandIdRef,
    hits: searchResult.hits,
    onCommandResult,
    onOpenAlignment,
    onQualityReportChange,
    onRestoreView: restoreWorkbenchView,
    selectedRecordId: selectedRecord?.id ?? selectedRecordId,
    selection,
    sourceStateKey,
    state: workbenchState,
    view: workbenchView,
  });
  const sequenceModelContext =
    selectedRecord == null
      ? {
          structuredContent: {
            artifact: {
              fileName: document.fileName ?? null,
              format: document.format,
              kind: document.kind,
            },
            viewer: "sequence",
          },
          text: "Current scientific viewer: Sequence viewer\nState: no biological sequence records were parsed from this file.",
        }
      : createSequenceViewerModelContext({
          activeSearchHitIndex,
          artifacts: workbenchState.artifacts,
          document,
          dirty: workbenchState.dirty,
          focusCoordinate,
          geneticCodeId,
          hits,
          jobs: workbenchState.jobs,
          layout,
          orientation,
          paletteId,
          query,
          record: selectedRecord,
          selectedFeature,
          selection,
          sourceStateKey,
          showFeatures,
          showQuality: effectiveShowQuality,
          showTranslation: effectiveShowTranslation,
          synchronizedViews,
          tracks: workbenchState.tracks,
          viewport,
          searchTruncated: searchResult.truncated,
          searchPending: searchResult.phase === "searching",
          viewerSessionId,
          wrapWidth,
        });
  useModelContext(viewerStateReady ? updateModelContext : undefined, {
    ...sequenceModelContext,
    structuredContent: {
      ...sequenceModelContext.structuredContent,
      interface:
        selectedRecord == null
          ? null
          : createSequenceInterfaceSnapshot({
              annotationIndex,
              chromatogramView,
              originRangeExpanded,
              paletteId,
              paletteRestoreNotice,
              qualityAdapterSequence,
              qualityReport: currentQualityReport,
              qualityView,
              readPileupState,
              record: selectedRecord,
              recordBrowser,
            }),
      toolbarVisible,
    },
  });
  if (selectedRecord == null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-token-text-primary">
        No biological sequence records were parsed from this file.
      </div>
    );
  }
  const searchHitRanges = hits.map((hit) => {
    const oriented = orientSearchHit(hit, selectedRecord.length, orientation);
    return { end: oriented.end, start: oriented.start };
  });
  useSequenceInterfaceCommands({
    annotationIndex,
    chromatogramView,
    command: viewerStateReady ? command : undefined,
    handledCommandIdRef,
    hits,
    onAnnotationIndexChange: setAnnotationIndexState,
    onChromatogramViewChange: setChromatogramView,
    onCommandResult,
    onReadPileupStateChange: setReadPileupState,
    onRecordBrowserChange: setRecordBrowserState,
    onQualityViewChange: setQualityView,
    originRangeExpanded,
    paletteId,
    paletteRestoreNotice,
    qualityAdapterSequence,
    qualityReport: currentQualityReport,
    qualityView,
    readPileupState,
    record: selectedRecord,
    recordBrowser,
    selection,
    state: workbenchState,
    viewport,
  });

  const selectRange = useCallback((nextSelection: SequenceSelection): void => {
    dispatchInteraction({ selection: nextSelection, type: "select-range" });
    setCoordinateDraft(nextSelection.start.toString());
    setViewport(
      nextSelection.segments == null
        ? {
            end: nextSelection.end,
            start: nextSelection.start,
          }
        : null,
    );
  }, []);
  const clearSelection = useCallback((): void => {
    dispatchInteraction({ type: "clear-selection" });
  }, []);
  const selectFeature = useCallback(
    (
      feature: SequenceFeature,
      record: SequenceRecord = selectedRecord,
    ): SequenceSelection | null => {
      const segments = getLocalFeatureSegments(feature).map(
        ({ end, start }) => ({
          end,
          start,
        }),
      );
      const first = segments[0];
      const last = segments.at(-1);
      if (segments.length > 1_000) {
        setWorkbenchError(
          "Feature selections support up to 1,000 local segments. Select a smaller range to inspect this feature.",
        );
        return null;
      }
      if (
        first == null ||
        last == null ||
        segments.some(
          ({ end, start }) => start < 1 || end < start || end > record.length,
        )
      ) {
        setWorkbenchError(
          "This feature has no selectable local range in the current record.",
        );
        return null;
      }
      const nextSelection: SequenceSelection = {
        end: last.end,
        recordId: record.id,
        ...(segments.length > 1 ? { segments } : {}),
        start: first.start,
      };
      setWorkbenchError(undefined);
      dispatchInteraction({ feature, type: "set-feature" });
      selectRange(nextSelection);
      return nextSelection;
    },
    [selectRange, selectedRecord],
  );
  const selectSearchHit = useCallback(
    (hit: SequenceSearchHit): void => {
      selectRange({
        end: hit.end,
        recordId: hit.recordId,
        start: hit.start,
      });
    },
    [selectRange],
  );
  const selectSearchHitByIndex = useCallback(
    (nextIndex: number): { hit: SequenceSearchHit; index: number } | null => {
      if (hits.length === 0) {
        return null;
      }
      const normalizedIndex = (nextIndex + hits.length) % hits.length;
      setActiveSearchHitIndex(normalizedIndex);
      const hit = hits[normalizedIndex];
      if (hit == null) {
        return null;
      }
      selectSearchHit(hit);
      return { hit, index: normalizedIndex };
    },
    [hits, selectSearchHit],
  );
  const selectFeatureByOffset = useCallback(
    (
      offset: number,
    ): { feature: SequenceFeature; selection: SequenceSelection } | null => {
      if (selectedRecord.features.length === 0) {
        return null;
      }
      const currentIndex =
        selectedFeature == null
          ? offset > 0
            ? -1
            : 0
          : selectedRecord.features.findIndex(
              ({ id }) => id === selectedFeature.id,
            );
      const normalizedIndex =
        (currentIndex + offset + selectedRecord.features.length) %
        selectedRecord.features.length;
      const feature = selectedRecord.features[normalizedIndex];
      if (feature == null) {
        return null;
      }
      const nextSelection = selectFeature(feature);
      return nextSelection == null
        ? null
        : { feature, selection: nextSelection };
    },
    [selectFeature, selectedFeature, selectedRecord],
  );
  const runLocalAnalysis = useCallback(
    (analysis: SequenceViewerAnalysisRequest): void => {
      setWorkbenchError(undefined);
      runSequenceWorkbenchJob({
        analysis,
        cancelledJobsRef,
        dispatch: dispatchWorkbench,
        onQualityReportChange,
        selectedRecordId: selectedRecord.id,
        selection,
        state: workbenchState,
        isSourceCurrent: () =>
          workbenchStateRef.current.document === workbenchState.document,
        viewerGeneticCodeId: geneticCodeId,
      });
    },
    [
      geneticCodeId,
      onQualityReportChange,
      selectedRecord.id,
      selection,
      workbenchState,
    ],
  );
  useEffect(() => {
    if (
      document.format !== "fastq" ||
      !viewerStateReady ||
      interfaceRestoreEpoch !== interfaceRestoreEpochRef.current ||
      qualityReportDocumentRef.current === document
    )
      return;
    qualityReportDocumentRef.current = document;
    runLocalAnalysis({
      analysis: "quality-report",
      ...(qualityAdapterSequence == null
        ? {}
        : { adapterSequence: qualityAdapterSequence }),
    });
  }, [
    document,
    qualityAdapterSequence,
    interfaceRestoreEpoch,
    runLocalAnalysis,
    viewerStateReady,
  ]);
  const applyLocalEdit = useCallback(
    (request: SequenceViewerEditRequest): void => {
      try {
        setWorkbenchError(undefined);
        const change = applySequenceEditRequest({
          document,
          request,
          selectedRecordId: selectedRecord.id,
        });
        if ("historyOperation" in change) {
          dispatchWorkbench({
            type:
              change.historyOperation === "undo"
                ? "undo-sequence-document"
                : "redo-sequence-document",
          });
          return;
        }
        dispatchWorkbench({
          description: change.description,
          document: change.document,
          type: "apply-sequence-document",
        });
      } catch (error) {
        setWorkbenchError(
          error instanceof Error
            ? error.message
            : "The edit could not be applied.",
        );
      }
    },
    [document, selectedRecord.id],
  );
  const manageLocalAnnotation = useCallback(
    (request: SequenceViewerAnnotationRequest): void => {
      try {
        setWorkbenchError(undefined);
        const change = applySequenceAnnotationRequest({
          document,
          request,
          selectedRecordId: selectedRecord.id,
          tracks: workbenchState.tracks,
        });
        dispatchWorkbench({
          description: change.description,
          document: change.document,
          type: "apply-sequence-document",
        });
      } catch (error) {
        setWorkbenchError(
          error instanceof Error
            ? error.message
            : "The annotation change could not be applied.",
        );
      }
    },
    [document, selectedRecord.id, workbenchState.tracks],
  );
  const addLocalAnnotation = useCallback(
    ({ label, type }: { label: string; type: string }): void => {
      if (selection == null || selection.recordId !== selectedRecord.id) return;
      manageLocalAnnotation({
        action: "add",
        feature: {
          end: selection.end,
          id: `user-${crypto.randomUUID()}`,
          label,
          qualifiers: { created_by: "sequence-viewer-workbench" },
          start: selection.start,
          strand: ".",
          type,
        },
      });
    },
    [manageLocalAnnotation, selectedRecord.id, selection],
  );
  const loadLocalTrack = useCallback(
    async ({
      bytes,
      displayName,
      format,
      indexBytes,
      indexFormat,
      referenceContents,
      referenceFileName,
    }: {
      bytes: Uint8Array;
      displayName: string;
      format: SequenceTrackFormat;
      indexBytes?: Uint8Array;
      indexFormat?: "bai" | "csi";
      referenceContents?: string;
      referenceFileName?: string;
    }): Promise<void> => {
      try {
        setWorkbenchError(undefined);
        let sourceItemCount: number | undefined;
        let sourceTruncated: boolean | undefined;
        let content: string | Uint8Array;
        if (format === "cram") {
          const decoded = await decodeCramWindowToSam({
            cramBytes: bytes,
            end: Math.min(selectedRecord.length, 100_000),
            indexBytes:
              indexBytes ??
              (() => {
                throw new Error("A CRAI index is required for CRAM tracks.");
              })(),
            reference: selectedRecord.sourceLabel,
            referenceContents,
            referenceFileName,
            start: 1,
          });
          content = decoded.sam;
          sourceItemCount = decoded.readCount;
          sourceTruncated = decoded.truncated;
        } else if (format === "bam" && indexBytes != null) {
          const decoded = await decodeBamWindowToSam({
            bamBytes: bytes,
            end: Math.min(selectedRecord.length, 100_000),
            indexBytes,
            indexFormat,
            reference: selectedRecord.sourceLabel,
            start: 1,
          });
          content = decoded.sam;
          sourceItemCount = decoded.readCount;
          sourceTruncated = decoded.truncated;
        } else {
          content =
            format === "bam"
              ? await decompressBgzfIfNeeded(bytes)
              : decodeUtf8(bytes);
        }
        const track = parseSequenceTrack({
          content,
          displayName,
          format,
          id: crypto.randomUUID(),
          requestedReference: selectedRecord.sourceLabel,
          sourceItemCount,
          sourceTruncated,
        });
        dispatchWorkbench({ track, type: "add-track" });
      } catch (error) {
        setWorkbenchError(
          error instanceof Error
            ? error.message
            : "The track could not be loaded.",
        );
      }
    },
    [selectedRecord.length, selectedRecord.sourceLabel],
  );
  const alignLocalRecords = useCallback((): void => {
    const sourceDocument = document;
    const jobId = crypto.randomUUID();
    dispatchWorkbench({
      job: {
        id: jobId,
        kind: "align",
        message: "Aligning materialized records…",
        parameters: { recordIds: document.records.map(({ id }) => id) },
        progress: 0,
        startedAt: Date.now(),
        status: "running",
      },
      type: "start-job",
    });
    queueMicrotask(() => {
      try {
        if (cancelledJobsRef.current.has(jobId)) return;
        if (workbenchStateRef.current.document !== sourceDocument) {
          dispatchWorkbench({
            completedAt: Date.now(),
            error:
              "The source sequence changed before this job completed. Run it again on the current copy.",
            id: jobId,
            type: "fail-job",
          });
          return;
        }
        const aligned = alignSequences(
          sourceDocument.records.map(
            ({ description, id, sequence, sourceLabel }) => ({
              description,
              id,
              label: sourceLabel,
              sequence,
            }),
          ),
        );
        if (cancelledJobsRef.current.has(jobId)) return;
        if (workbenchStateRef.current.document !== sourceDocument) {
          dispatchWorkbench({
            completedAt: Date.now(),
            error:
              "The source sequence changed before this job completed. Run it again on the current copy.",
            id: jobId,
            type: "fail-job",
          });
          return;
        }
        const content = `${exportAlignedFasta(aligned.rows)}\n`;
        const name = `${stripFileExtension(sourceDocument.fileName ?? "sequences")}.aligned.fasta`;
        dispatchWorkbench({
          artifact: {
            content,
            createdAt: Date.now(),
            format: "aligned-fasta",
            id: crypto.randomUUID(),
            mediaType: "text/x-fasta",
            name,
            provenance: {
              engine: aligned.engine,
              parameters: aligned.parameters,
              sourceRevision: workbenchState.revision,
            },
          },
          type: "add-artifact",
        });
        dispatchWorkbench({
          completedAt: Date.now(),
          id: jobId,
          message: `Aligned ${aligned.rows.length.toLocaleString()} records.`,
          result: {
            alignedLength: aligned.alignedLength,
            engine: aligned.engine,
            rowCount: aligned.rows.length,
            warning: aligned.warning,
          },
          type: "complete-job",
        });
        onOpenAlignment?.(content, name);
      } catch (error) {
        if (cancelledJobsRef.current.has(jobId)) return;
        dispatchWorkbench({
          completedAt: Date.now(),
          error:
            error instanceof Error
              ? error.message
              : "The records could not be aligned.",
          id: jobId,
          type: "fail-job",
        });
      }
    });
  }, [
    document.fileName,
    document.records,
    onOpenAlignment,
    workbenchState.revision,
  ]);
  const exportLocalArtifact = useCallback(
    (
      format:
        | "bed"
        | "csv"
        | "embl"
        | "fasta"
        | "fastq"
        | "genbank"
        | "gff3"
        | "gtf"
        | "json"
        | "pdf"
        | "svg"
        | "tsv"
        | "vcf",
      scope: "all" | "selection" | "visible",
    ): void => {
      try {
        setWorkbenchError(undefined);
        const output = exportSequenceWorkbench({
          document,
          format,
          recordId: selectedRecord.id,
          scope,
          selection,
          tracks: workbenchState.tracks,
        });
        dispatchWorkbench({
          artifact: {
            ...output,
            createdAt: Date.now(),
            id: crypto.randomUUID(),
            provenance: {
              engine: "sequence-viewer-export-v1",
              parameters: { scope },
              sourceRevision: workbenchState.revision,
            },
          },
          type: "add-artifact",
        });
      } catch (error) {
        setWorkbenchError(
          error instanceof Error
            ? error.message
            : "The export could not be prepared.",
        );
      }
    },
    [
      document,
      selectedRecord.id,
      selection,
      workbenchState.revision,
      workbenchState.tracks,
    ],
  );
  const prepareWorkspaceSession = useCallback(
    (): string =>
      serializeWorkbenchSession(
        createSequenceWorkbenchSession(
          workbenchState,
          workbenchView,
          sourceStateKey,
        ),
      ),
    [sourceStateKey, workbenchState, workbenchView],
  );
  const saveLocalSession = useCallback((): void => {
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
          name: `${stripFileExtension(document.fileName ?? "sequence")}.sequence-session.json`,
          provenance: {
            engine: "sequence-viewer-session-v1",
            parameters: { mode: "sequence" },
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
  }, [document.fileName, prepareWorkspaceSession, workbenchState.revision]);
  const restoreLocalSession = useCallback(
    (content: string): void => {
      try {
        setWorkbenchError(undefined);
        const session = parseWorkbenchSession(content);
        if (session.view.mode !== "sequence" || session.view.sequence == null) {
          throw new Error("This is not a Sequence-mode workbench session.");
        }
        if (
          session.source.format !== document.format ||
          session.source.fileName !== (document.fileName ?? null) ||
          session.source.stateKey !== sourceStateKey
        ) {
          throw new Error(
            "This session belongs to a different source artifact and was not applied.",
          );
        }
        const restoredDocument =
          session.snapshot?.sequenceDocument == null
            ? document
            : createSequenceWorkbenchState(
                session.snapshot.sequenceDocument,
                workbenchState.sourceDocument,
              ).document;
        restoreWorkbenchView(session.view.sequence, {
          document: restoredDocument,
          tracks: session.tracks,
        });
        if (session.snapshot?.sequenceDocument != null) {
          dispatchWorkbench({
            description: "Restored saved sequence-copy state.",
            document: restoredDocument,
            type: "restore-sequence-document",
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
      } catch (error) {
        setWorkbenchError(
          error instanceof Error
            ? error.message
            : "The session could not be restored.",
        );
      }
    },
    [document, restoreWorkbenchView, sourceStateKey, workbenchState],
  );
  useEffect(() => {
    if (
      command == null ||
      !viewerStateReady ||
      command.action === "set_mode" ||
      isWorkbenchOperationCommand(command) ||
      isSequenceInterfaceCommand(command) ||
      handledCommandIdRef.current === command.commandId
    ) {
      return;
    }
    const requestedRecord = "record" in command ? command.record : undefined;
    const recordResolution =
      requestedRecord == null
        ? { status: "resolved" as const, target: selectedRecord }
        : resolveViewerTarget({
            aliases: (record) => [record.sourceLabel, record.description],
            id: (record) => record.id,
            selector: requestedRecord,
            targets: document.records,
          });
    if (
      recordResolution.status !== "resolved" ||
      recordResolution.target == null
    ) {
      handledCommandIdRef.current = command.commandId;
      onCommandResult?.(command, {
        applied: false,
        message:
          recordResolution.status === "ambiguous"
            ? `More than one sequence record matched ${requestedRecord}; retry with an exact record ID.`
            : `No sequence record matched ${requestedRecord ?? "the request"}.`,
        state:
          recordResolution.status === "ambiguous"
            ? {
                candidateRecordIds: recordResolution.candidates.map(
                  ({ id }) => id,
                ),
              }
            : undefined,
      });
      return;
    }
    const targetRecord = recordResolution.target;
    if (targetRecord.id !== selectedRecordId) {
      setSelectedRecordId(targetRecord.id);
      return;
    }

    let result: SequenceViewerCommandResult;
    switch (command.action) {
      case "clear_sequence_selection":
        clearSelection();
        result = {
          applied: true,
          message: "Cleared the sequence selection.",
        };
        break;
      case "focus_sequence_coordinate": {
        const coordinate = command.coordinate ?? 1;
        if (coordinate < 1 || coordinate > targetRecord.length) {
          result = {
            applied: false,
            message: `Coordinate ${coordinate} is outside ${targetRecord.sourceLabel} (1-${targetRecord.length}).`,
            state: { maxCoordinate: targetRecord.length, minCoordinate: 1 },
          };
          break;
        }
        selectRange({
          end: coordinate,
          recordId: targetRecord.id,
          start: coordinate,
        });
        result = {
          applied: true,
          message: `Focused ${targetRecord.sourceLabel} at coordinate ${coordinate}.`,
          state: { coordinate, recordId: targetRecord.id },
        };
        break;
      }
      case "navigate_sequence_search_hit": {
        const selected = selectSearchHitByIndex(
          activeSearchHitIndex + (command.direction === "next" ? 1 : -1),
        );
        if (selected == null) {
          result = {
            applied: false,
            message: "There are no sequence search hits to navigate.",
          };
          break;
        }
        result = {
          applied: true,
          message: `Focused sequence search hit ${selected.index + 1} of ${hits.length}.`,
          state: {
            end: selected.hit.end,
            hitCount: hits.length,
            hitIndex: selected.index + 1,
            orientation: selected.hit.orientation,
            recordId: selected.hit.recordId,
            start: selected.hit.start,
          },
        };
        break;
      }
      case "select_sequence_range": {
        const requestedStart = command.start ?? 1;
        const requestedEnd = command.end ?? 1;
        const start = command.wraparound
          ? requestedStart
          : Math.min(requestedStart, requestedEnd);
        const end = command.wraparound
          ? requestedEnd
          : Math.max(requestedStart, requestedEnd);
        if (
          start < 1 ||
          end < 1 ||
          start > targetRecord.length ||
          end > targetRecord.length
        ) {
          result = {
            applied: false,
            message: `Range ${start}-${end} is outside ${targetRecord.sourceLabel} (1-${targetRecord.length}).`,
            state: { maxCoordinate: targetRecord.length, minCoordinate: 1 },
          };
          break;
        }
        let nextSelection: SequenceSelection;
        try {
          nextSelection = command.wraparound
            ? createOriginSpanningSelection({
                end,
                record: targetRecord,
                start,
              })
            : { end, recordId: targetRecord.id, start };
        } catch (error) {
          result = {
            applied: false,
            message:
              error instanceof Error
                ? error.message
                : "The origin-spanning range is invalid.",
          };
          break;
        }
        selectRange(nextSelection);
        result = {
          applied: true,
          message: `Selected ${targetRecord.sourceLabel} coordinates ${start}-${end}${command.wraparound ? " across the circular origin" : ""}.`,
          state: command.wraparound
            ? {
                end,
                recordId: targetRecord.id,
                segments: nextSelection.segments,
                start,
                wraparound: true,
              }
            : { end, recordId: targetRecord.id, start },
        };
        break;
      }
      case "select_sequence_feature": {
        const featureMatches = resolveSequenceFeatureSelector(
          targetRecord.features,
          command.featureId,
        );
        if (featureMatches.length === 0) {
          const availableFeatures = targetRecord.features
            .slice(0, 50)
            .map(({ end, id, label, start, type }) => ({
              end,
              id,
              label: label ?? null,
              start,
              type,
            }));
          result = {
            applied: false,
            message: `No feature in ${targetRecord.sourceLabel} matched ${command.featureId}.`,
            state: {
              availableFeatures,
              availableFeaturesTruncated:
                targetRecord.features.length > availableFeatures.length,
            },
          };
          break;
        }
        if (featureMatches.length > 1) {
          const matchingFeatures = featureMatches
            .slice(0, 50)
            .map(({ end, id, label, start, type }) => ({
              end,
              id,
              label: label ?? null,
              start,
              type,
            }));
          result = {
            applied: false,
            message: `More than one feature matched ${command.featureId}; retry with one of the exact candidate IDs.`,
            state: {
              matchingFeatures,
              matchingFeaturesTruncated:
                featureMatches.length > matchingFeatures.length,
            },
          };
          break;
        }
        const feature = featureMatches[0];
        if (feature == null) {
          return;
        }
        const featureSelection = selectFeature(feature, targetRecord);
        if (featureSelection == null) {
          result = {
            applied: false,
            message: `The local ranges of ${feature.label ?? feature.type} cannot be selected in ${targetRecord.sourceLabel}.`,
            state: { featureId: feature.id, recordId: targetRecord.id },
          };
          break;
        }
        result = {
          applied: true,
          message: `Selected ${feature.label ?? feature.type} in ${targetRecord.sourceLabel}.`,
          state: {
            ...featureSelection,
            featureId: feature.id,
            type: feature.type,
          },
        };
        break;
      }
      case "navigate_sequence_feature": {
        const next = selectFeatureByOffset(
          command.direction === "next" ? 1 : -1,
        );
        result =
          next == null
            ? {
                applied: false,
                message:
                  "No selectable local feature is available in this record.",
              }
            : {
                applied: true,
                message: `Selected ${next.feature.label ?? next.feature.type}.`,
                state: { ...next.selection, featureId: next.feature.id },
              };
        break;
      }
      case "set_sequence_record":
        result = {
          applied: true,
          message: `Displayed sequence record ${targetRecord.sourceLabel}.`,
          state: { recordId: targetRecord.id },
        };
        break;
      case "set_sequence_view_options": {
        if (
          command.geneticCodeId != null &&
          getGeneticCode(command.geneticCodeId) == null
        ) {
          result = {
            applied: false,
            message: `Genetic code table ${command.geneticCodeId} is not supported.`,
          };
          break;
        }
        if (
          command.orientation === "reverse-complement" &&
          (targetRecord.molecule === "protein" ||
            targetRecord.molecule === "unknown")
        ) {
          result = {
            applied: false,
            message: `${targetRecord.sourceLabel} cannot be shown as a reverse complement because it is ${targetRecord.molecule}.`,
          };
          break;
        }
        if (
          command.palette != null &&
          !getCompatibleSequencePalettes(targetRecord.molecule).some(
            ({ id }) => id === command.palette,
          )
        ) {
          result = {
            applied: false,
            message: `Palette ${command.palette} is not compatible with ${targetRecord.molecule} sequences.`,
          };
          break;
        }
        if (command.showQuality === true && targetRecord.quality == null) {
          result = {
            applied: false,
            message: `${targetRecord.sourceLabel} does not contain FASTQ quality scores.`,
          };
          break;
        }
        if (
          command.showTranslation === true &&
          !targetRecord.features.some(
            ({ translation, type }) =>
              type.toLowerCase() === "cds" && translation != null,
          )
        ) {
          result = {
            applied: false,
            message: `${targetRecord.sourceLabel} does not contain a translated CDS feature.`,
          };
          break;
        }
        if (command.palette != null) {
          setPaletteId(command.palette);
        }
        if (command.geneticCodeId != null) {
          setGeneticCodeId(command.geneticCodeId);
        }
        if (command.layout != null) {
          setLayout(command.layout);
        }
        if (command.orientation != null) {
          setOrientation(command.orientation);
        }
        if (command.showFeatures != null) {
          setShowFeatures(command.showFeatures);
        }
        if (command.showQuality != null) {
          setShowQuality(command.showQuality);
        }
        if (command.showTranslation != null) {
          setShowTranslation(command.showTranslation);
        }
        if (command.synchronizedViews != null) {
          setSynchronizedViews(command.synchronizedViews);
        }
        if (command.originRangeExpanded != null) {
          setOriginRangeExpanded(command.originRangeExpanded);
        }
        if (command.wrapWidth != null) {
          setWrapWidth(command.wrapWidth);
        }
        result = {
          applied: true,
          message: `Updated display options for ${targetRecord.sourceLabel}.`,
          state: {
            geneticCodeId: command.geneticCodeId ?? geneticCodeId,
            layout: command.layout ?? layout,
            orientation: command.orientation ?? orientation,
            originRangeExpanded:
              command.originRangeExpanded ?? originRangeExpanded,
            palette: command.palette ?? paletteId,
            showFeatures: command.showFeatures ?? showFeatures,
            showQuality:
              targetRecord.quality != null &&
              (command.showQuality ?? showQuality),
            showTranslation:
              recordHasTranslatedCds(targetRecord) &&
              (command.showTranslation ?? showTranslation),
            synchronizedViews: command.synchronizedViews ?? synchronizedViews,
            wrapWidth: command.wrapWidth ?? wrapWidth,
          },
        };
        break;
      }
      case "search_sequence": {
        const nextQuery = command.query ?? "";
        if (query !== nextQuery) {
          setQuery(nextQuery);
          setActiveSearchHitIndex(0);
          return;
        }
        if (searchResult.phase === "searching") return;
        const nextHits = searchResult.hits;
        const firstHit = nextHits[0];
        if (firstHit != null) {
          selectRange({
            end: firstHit.end,
            recordId: firstHit.recordId,
            start: firstHit.start,
          });
        }
        result = {
          applied: true,
          message:
            nextHits.length === 0
              ? searchResult.truncated
                ? `Search of ${targetRecord.sourceLabel} reached the bounded work limit without finding a match; refine the query and retry.`
                : `Searched ${targetRecord.sourceLabel}; no matches were found.`
              : `Found ${nextHits.length} match${nextHits.length === 1 ? "" : "es"} and focused the first one.`,
          state: {
            hitCount: nextHits.length,
            query: nextQuery,
            recordId: targetRecord.id,
            truncated: searchResult.truncated,
          },
        };
        break;
      }
      default:
        return;
    }
    handledCommandIdRef.current = command.commandId;
    onCommandResult?.(command, result);
  }, [
    activeSearchHitIndex,
    clearSelection,
    command,
    document.records,
    geneticCodeId,
    hits.length,
    layout,
    onCommandResult,
    orientation,
    originRangeExpanded,
    paletteId,
    query,
    searchResult,
    selectRange,
    selectSearchHitByIndex,
    selectedRecord,
    selectedRecordId,
    setPaletteId,
    selectFeature,
    selectFeatureByOffset,
    showFeatures,
    showQuality,
    showTranslation,
    viewerStateReady,
    synchronizedViews,
    wrapWidth,
  ]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && selection != null) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return (): void => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, selection]);

  return (
    <div className="bio-sequence-surface flex min-h-0 flex-1 flex-col bg-token-main-surface-primary text-token-text-primary">
      <div
        data-sequence-toolbar-controls="sequence"
        hidden={!(toolbarRevealed ?? toolbarVisible)}
        inert={!(toolbarRevealed ?? toolbarVisible) ? true : undefined}
      >
        <SequenceToolbar
          coordinateValue={coordinateDraft}
          document={document}
          displayOptions={
            <div className="flex flex-wrap items-center gap-4">
              <button
                aria-pressed={orientation === "reverse-complement"}
                className="rounded-md border border-token-border px-2.5 py-1 text-xs text-token-text-secondary hover:text-token-text-primary"
                disabled={
                  selectedRecord.molecule === "protein" ||
                  selectedRecord.molecule === "unknown"
                }
                onClick={() =>
                  setOrientation((current) =>
                    current === "forward" ? "reverse-complement" : "forward",
                  )
                }
                type="button"
              >
                {orientation === "forward"
                  ? "Show reverse complement"
                  : "Show forward strand"}
              </button>
              <label className="inline-flex items-center gap-1.5 text-xs text-token-text-secondary">
                <input
                  checked={synchronizedViews}
                  onChange={(event) =>
                    setSynchronizedViews(event.target.checked)
                  }
                  type="checkbox"
                />
                Sync overview and detail
              </label>
            </div>
          }
          featureCount={selectedRecord.features.length}
          onCoordinateChange={setCoordinateDraft}
          onCoordinateJump={() => {
            const coordinate = clampSequenceCoordinate(
              Number(coordinateDraft),
              selectedRecord.length,
            );
            const nextSelection = {
              end: coordinate,
              recordId: selectedRecord.id,
              start: coordinate,
            };
            selectRange(nextSelection);
          }}
          onClearSelection={clearSelection}
          onNextFeature={() => selectFeatureByOffset(1)}
          onNextSearchHit={() =>
            selectSearchHitByIndex(activeSearchHitIndex + 1)
          }
          onPaletteChange={setPaletteId}
          onPreviousFeature={() => selectFeatureByOffset(-1)}
          onPreviousSearchHit={() =>
            selectSearchHitByIndex(activeSearchHitIndex - 1)
          }
          publishWorkspaceArtifact={publishWorkspaceArtifact}
          onQueryChange={setQuery}
          onToggleFeatures={() => setShowFeatures((value) => !value)}
          onToggleQuality={() => setShowQuality((value) => !value)}
          onToggleTranslation={() => setShowTranslation((value) => !value)}
          onWrapWidthChange={setWrapWidth}
          paletteId={paletteId}
          query={query}
          record={selectedRecord}
          searchHitCount={hits.length}
          selection={selection}
          showFeatures={showFeatures}
          showQuality={effectiveShowQuality}
          showTranslation={effectiveShowTranslation}
          sourceRevision={workbenchState.revision}
          wrapWidth={wrapWidth}
        />
      </div>
      <PerformanceBanners document={document} />
      {paletteRestoreNotice == null ? null : (
        <p
          className="px-4 py-2 text-sm text-token-text-secondary"
          data-workbench-nonblocking="true"
          role="status"
        >
          {paletteRestoreNotice}
        </p>
      )}
      <WarningsDrawer warnings={document.warnings} />
      <div className="bio-workbench-layout grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main
          className="bio-workbench-main min-w-0 space-y-4"
          aria-label="Sequence canvas"
        >
          <RecordListPanel
            browserState={recordBrowser}
            onBrowserStateChange={setRecordBrowserState}
            onSelectRecord={(recordId) => {
              setSelectedRecordId(recordId);
            }}
            records={document.records}
            selectedRecordId={selectedRecord.id}
            totalRecordCount={
              document.recordInventory?.totalCount ?? document.records.length
            }
          />
          <div className="bio-sequence-viewbar flex flex-wrap items-center gap-2 border-b border-token-border px-1 pb-3">
            <span className="text-sm font-medium text-token-text-primary">
              View
            </span>
            {(["linear", "circular", "split"] as const).map((candidate) => (
              <button
                aria-pressed={layout === candidate}
                className={
                  layout === candidate
                    ? "rounded-md border border-token-border bg-token-main-surface-primary px-2.5 py-1 text-sm font-medium text-token-text-primary shadow-sm"
                    : "rounded-md border border-token-border px-2.5 py-1 text-sm text-token-text-secondary hover:text-token-text-primary"
                }
                key={candidate}
                onClick={() => setLayout(candidate)}
                type="button"
              >
                {candidate[0]?.toUpperCase()}
                {candidate.slice(1)}
              </button>
            ))}
            {nativeSourceEditClient == null ? null : (
              <Button
                aria-label="Save Original"
                disabled={
                  !workbenchState.dirty ||
                  !sourceSaveAvailability.available ||
                  sourceSaveState.status !== "idle"
                }
                onClick={() => {
                  void saveOriginalSequence();
                }}
                title={
                  sourceSaveState.status === "saved"
                    ? "Reopen the saved source before making further changes."
                    : !workbenchState.dirty
                      ? "Make a sequence edit before saving the original file."
                      : sourceSaveAvailability.reason
                }
                type="button"
              >
                {sourceSaveState.status === "saving"
                  ? "Saving Original…"
                  : sourceSaveState.status === "saved"
                    ? "Original Saved"
                    : "Save Original"}
              </Button>
            )}
          </div>
          {sourceSaveState.message == null ? null : (
            <div
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              {sourceSaveState.message}
            </div>
          )}
          {workbenchError == null ? null : (
            <div
              className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400"
              data-workbench-nonblocking="true"
              role="alert"
            >
              {workbenchError}
            </div>
          )}
          {sourceSaveState.error == null ? null : (
            <div
              className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400"
              role="alert"
            >
              {sourceSaveState.error}
            </div>
          )}
          <SequenceOverview
            annotationIndex={annotationIndexControl}
            layout={layout}
            onOriginRangeExpandedChange={setOriginRangeExpanded}
            originRangeExpanded={originRangeExpanded}
            onJump={(coordinate) =>
              selectRange({
                end: coordinate,
                recordId: selectedRecord.id,
                start: coordinate,
              })
            }
            onSelectRange={(start, end, wraparound) => {
              try {
                setWorkbenchError(undefined);
                selectRange(
                  wraparound
                    ? createOriginSpanningSelection({
                        end,
                        record: selectedRecord,
                        start,
                      })
                    : {
                        end: Math.max(start, end),
                        recordId: selectedRecord.id,
                        start: Math.min(start, end),
                      },
                );
              } catch (error) {
                setWorkbenchError(
                  error instanceof Error
                    ? error.message
                    : "The range could not be selected.",
                );
              }
            }}
            onSelectFeature={(featureId) => {
              const feature = selectedRecord.features.find(
                ({ id }) => id === featureId,
              );
              if (feature == null) return;
              selectFeature(feature);
            }}
            orientation={orientation}
            record={selectedRecord}
            selectedFeatureId={selectedFeature?.id}
            selection={selection}
            synchronizedViews={synchronizedViews}
            viewport={viewport}
          />
          {selectedRecord.chromatogram == null ? null : (
            <ChromatogramPanel
              record={selectedRecord}
              restorationEpoch={interfaceRestoreEpoch}
              selection={selection}
              view={chromatogramView}
              onViewChange={setChromatogramView}
              onSelectRange={(start, end) =>
                selectRange({
                  end,
                  recordId: selectedRecord.id,
                  start,
                })
              }
            />
          )}
          <EvidenceTrackPanel
            paletteId={paletteId}
            readPileupState={readPileupState}
            onReadPileupStateChange={setReadPileupState}
            record={selectedRecord}
            referenceRecords={document.records}
            selection={selection}
            tracks={workbenchState.tracks}
            viewport={viewport}
          />
          <SequenceRenderer
            focusCoordinate={
              focusCoordinate == null
                ? undefined
                : sourceCoordinateToDisplay(
                    focusCoordinate,
                    selectedRecord.length,
                    orientation,
                  )
            }
            lineWidth={wrapWidth}
            onFocusCoordinate={(coordinate) => {
              const sourceCoordinate = sourceCoordinateToDisplay(
                coordinate,
                selectedRecord.length,
                orientation,
              );
              setFocusCoordinate(sourceCoordinate);
              setCoordinateDraft(sourceCoordinate.toString());
            }}
            onHoverCoordinate={(coordinate) => {
              if (coordinate == null) {
                setHoverCoordinate(undefined);
                return;
              }
              const sourceCoordinate = sourceCoordinateToDisplay(
                coordinate,
                selectedRecord.length,
                orientation,
              );
              setHoverCoordinate(sourceCoordinate);
              setCoordinateDraft(sourceCoordinate.toString());
            }}
            onSelectFeature={(feature) => {
              const sourceFeature = selectedRecord.features.find(
                ({ id }) => id === feature.id,
              );
              if (sourceFeature == null) return;
              selectFeature(sourceFeature);
            }}
            onSelectionChange={(nextSelection) =>
              selectRange(
                displaySelectionToSource(
                  nextSelection,
                  selectedRecord.length,
                  orientation,
                ),
              )
            }
            paletteId={paletteId}
            record={orientedRecord ?? selectedRecord}
            searchHitRanges={searchHitRanges}
            selectedFeatureId={selectedFeature?.id}
            selection={displaySelection}
            showFeatures={showFeatures}
            showQuality={effectiveShowQuality}
            showTranslation={effectiveShowTranslation}
          />
          <SequenceLegend paletteId={paletteId} />
        </main>
        <aside
          className="bio-workbench-sidebar min-w-0"
          aria-label="Sequence workspace tools"
        >
          <SequenceWorkbenchPanel
            browseWorkspaceTracks={browseWorkspaceTracks}
            contextPanels={[
              {
                id: "inspect",
                label: "Inspect",
                content: (
                  <div className="space-y-4">
                    <PinnedInspector
                      feature={selectedFeature}
                      hoverCoordinate={hoverCoordinate}
                      onClearSelection={clearSelection}
                      record={selectedRecord}
                      selection={selection}
                    />
                    <MetadataPanel record={selectedRecord} />
                  </div>
                ),
              },
              ...(document.fastqSummary == null &&
              selectedRecord.quality == null
                ? []
                : [
                    {
                      id: "quality",
                      label: "Quality",
                      content: (
                        <div className="space-y-4">
                          <FastqSummaryPanel
                            adapterSequence={qualityAdapterSequence}
                            document={document}
                            onAdapterSequenceApply={(adapterSequence) =>
                              runLocalAnalysis({
                                analysis: "quality-report",
                                ...(adapterSequence == null
                                  ? {}
                                  : { adapterSequence }),
                              })
                            }
                            qualityReport={currentQualityReport?.report ?? null}
                            qualityReportError={currentQualityReport?.error}
                            qualityReportPending={
                              currentQualityReport == null ||
                              currentQualityReport.pending
                            }
                            onViewChange={setQualityView}
                            view={qualityView}
                            summary={document.fastqSummary}
                          />
                          {selectedRecord.quality == null ? null : (
                            <QualityTrack
                              record={orientedRecord ?? selectedRecord}
                            />
                          )}
                        </div>
                      ),
                    },
                  ]),
              ...(query.length === 0
                ? []
                : [
                    {
                      id: "search-results",
                      label: `Results (${hits.length.toLocaleString()}${searchResult.truncated ? "+" : ""})`,
                      content: (
                        <SearchPanel
                          hits={hits}
                          onSelectHit={selectSearchHit}
                          searching={searchResult.phase === "searching"}
                          truncated={searchResult.truncated}
                        />
                      ),
                    },
                  ]),
            ]}
            geneticCodeId={geneticCodeId}
            onAddAnnotation={addLocalAnnotation}
            onAlignRecords={alignLocalRecords}
            onCancelJob={(jobId) => {
              cancelledJobsRef.current.add(jobId);
              dispatchWorkbench({ id: jobId, type: "cancel-job" });
            }}
            onEdit={applyLocalEdit}
            onExport={exportLocalArtifact}
            onGeneticCodeChange={setGeneticCodeId}
            onDeleteAnnotation={(featureId) => {
              manageLocalAnnotation({ action: "delete", featureId });
              if (selectedFeature?.id === featureId)
                setSelectedFeature(undefined);
            }}
            onImportTrack={(trackId) =>
              manageLocalAnnotation({ action: "import", trackId })
            }
            onLoadTrack={(input) => void loadLocalTrack(input)}
            onRedo={() => dispatchWorkbench({ type: "redo-sequence-document" })}
            onRemoveTrack={(id) =>
              dispatchWorkbench({ id, type: "remove-track" })
            }
            onRunAnalysis={runLocalAnalysis}
            onRestoreSession={restoreLocalSession}
            onSaveSession={saveLocalSession}
            prepareWorkspaceSession={prepareWorkspaceSession}
            publishWorkspaceArtifact={publishWorkspaceArtifact}
            workspaceSessionName={workspaceSessionDefaultName(
              document.fileName,
              "sequence",
            )}
            workspaceSessions={workspaceSessions}
            onSelectFeature={(feature) => {
              selectFeature(feature);
            }}
            onUndo={() => dispatchWorkbench({ type: "undo-sequence-document" })}
            onUpdateAnnotation={({ feature, label, type }) =>
              manageLocalAnnotation({
                action: "update",
                feature: {
                  end: feature.end,
                  id: feature.id,
                  label,
                  qualifiers: feature.qualifiers,
                  start: feature.start,
                  strand: feature.strand,
                  type,
                },
              })
            }
            record={selectedRecord}
            recordCount={document.records.length}
            selection={selection}
            selectedFeature={selectedFeature}
            state={workbenchState}
          />
        </aside>
      </div>
    </div>
  );
}

type NativeSequenceSourceEditClient = Pick<
  ScientificSequenceDataClient,
  | "session"
  | "readOriginalSourceRange"
  | "beginSourceEdit"
  | "appendSourceEdit"
  | "resumeSourceEdit"
  | "commitSourceEdit"
  | "abortSourceEdit"
>;

function getNativeSequenceSourceEditClient(
  client: unknown,
): NativeSequenceSourceEditClient | null {
  if (client == null || typeof client !== "object") return null;
  const candidate = client as Partial<NativeSequenceSourceEditClient>;
  return candidate.session != null &&
    candidate.session.canEditApprovedSource === true &&
    typeof candidate.readOriginalSourceRange === "function" &&
    typeof candidate.beginSourceEdit === "function" &&
    typeof candidate.appendSourceEdit === "function" &&
    typeof candidate.resumeSourceEdit === "function" &&
    typeof candidate.commitSourceEdit === "function" &&
    typeof candidate.abortSourceEdit === "function"
    ? (candidate as NativeSequenceSourceEditClient)
    : null;
}

function isRecoverableSequenceSourceEditError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message = `${code} ${error.message}`;
  if (
    /(?:source.changed|revok|not.authoriz|scope|conflict|digest|offset|abort)/iu.test(
      message,
    )
  ) {
    return false;
  }
  if (/permission/iu.test(message) && !/expir/iu.test(message)) return false;
  return /(?:stale.?generation|expir|disconnect|unavailable|temporar|timeout|closed|econnreset)/iu.test(
    message,
  );
}

async function renewOriginalSequenceSourceEdit({
  client,
  editId,
  expectedOffsetDecimal,
  maxChunkBytes,
  signal,
}: {
  client: NativeSequenceSourceEditClient;
  editId: string;
  expectedOffsetDecimal?: string;
  maxChunkBytes: number;
  signal?: AbortSignal;
}) {
  const resumed = await client.resumeSourceEdit({ editId, signal });
  if (
    resumed.state === "published" ||
    (resumed.maxChunkBytes ?? 64 * 1024) < maxChunkBytes ||
    (expectedOffsetDecimal != null &&
      resumed.bytesWrittenDecimal !== expectedOffsetDecimal)
  ) {
    throw new Error(
      "The original Sequence edit cannot renew its authenticated source lease.",
    );
  }
  return resumed;
}

function getOriginalSequenceSaveAvailability({
  current,
  initial,
  sourceRevision,
}: {
  current: SequenceDocument;
  initial: SequenceDocument;
  sourceRevision?: string;
}):
  | {
      available: true;
      plan: SequenceOriginalSourceReplacementPlan;
      reason: string;
    }
  | { available: false; reason: string } {
  if (sourceRevision == null) {
    return {
      available: false,
      reason:
        "Original-source replacement requires an authenticated native reader.",
    };
  }
  try {
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });
    return {
      available: true,
      plan,
      reason:
        "Replace only the edited residues while preserving every other original source byte.",
    };
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : "The original Sequence source cannot be safely replaced.",
    };
  }
}

function recordHasTranslatedCds(
  record: SequenceDocument["records"][number] | undefined,
): boolean {
  return (
    record?.features.some(
      ({ translation, type }) =>
        type.toLowerCase() === "cds" && translation != null,
    ) ?? false
  );
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function stripFileExtension(fileName: string): string {
  const normalized = fileName.trim();
  const index = normalized.lastIndexOf(".");
  return index > 0 ? normalized.slice(0, index) : normalized || "sequences";
}

async function decompressBgzfIfNeeded(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    return bytes;
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser cannot decompress BGZF BAM data. Load the track through sequence.load_track instead.",
    );
  }
  const copy = bytes.slice().buffer;
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
