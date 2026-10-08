import clsx from "clsx";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { createArtifactStateKey } from "./artifact-state-key";
import type {
  BiologicalSequenceViewerMode,
  BiologicalSequenceViewerModel,
} from "./biological-sequence-viewer-model";
import type { ModelContextUpdate, ModelContextUpdater } from "./model-context";
import { MsaRichViewer } from "./msa/msa-rich-viewer";
import { parseMsa } from "./msa/parser";
import { SequenceDurableViewerStateContext } from "./persistent/durable-viewer-state";
import { createSequenceDocumentFromMsa } from "./sequence/msa-sequence-adapter";
import { SequenceRichViewer } from "./sequence/sequence-rich-viewer";
import { WorkbenchToolController } from "./ui/workbench-tool-controller";
import {
  hasPendingWorkbenchAction,
  hasPendingWorkbenchDialog,
  WorkbenchToolControllerContext,
} from "./ui/workbench-tools";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "./viewer-commands";
import type { SequenceWorkspaceArtifactPublisher } from "./views/workbench-persistence";
import type { SequenceWorkspaceTrackBrowserClient } from "./views/workspace-tracks";
import type { SequenceWorkspaceSessionClient } from "./views/workspace-sessions";
import { WorkspaceSessionDiscovery } from "./workspace-session-controls";

export type BiologicalSequenceViewerDisplayModeControl = {
  mode: "inline" | "fullscreen";
  pending: boolean;
  requestMode: (mode: "inline" | "fullscreen") => Promise<void>;
};

export function BiologicalSequenceViewer({
  browseWorkspaceTracks,
  contents,
  command,
  displayModeControl,
  fileName,
  initialToolbarVisible,
  model,
  onCommandResult,
  publishWorkspaceArtifact,
  sourceStateKey,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  browseWorkspaceTracks?: SequenceWorkspaceTrackBrowserClient;
  contents: string;
  command?: QueuedSequenceViewerCommand;
  displayModeControl?: BiologicalSequenceViewerDisplayModeControl;
  fileName?: string;
  initialToolbarVisible?: boolean;
  model: BiologicalSequenceViewerModel;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  sourceStateKey?: string;
  updateModelContext?: ModelContextUpdater;
  viewerSessionId?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const durableViewerState = useContext(SequenceDurableViewerStateContext);
  const resolvedSourceStateKey = useMemo(
    () => sourceStateKey ?? createArtifactStateKey(contents, fileName),
    [contents, fileName, sourceStateKey],
  );
  const getInitialToolbarVisibility = (): boolean =>
    (durableViewerState?.restoredState?.sourceStateKey ===
    resolvedSourceStateKey
      ? durableViewerState.restoredState.toolbarVisible
      : undefined) ??
    initialToolbarVisible ??
    true;
  const [toolbarVisible, setToolbarVisible] = useState(
    getInitialToolbarVisibility,
  );
  const [toolbarTemporarilyRevealed, setToolbarTemporarilyRevealed] =
    useState(false);
  const toolbarHeaderRef = useRef<HTMLElement | null>(null);
  const toolbarRevealZoneRef = useRef<HTMLButtonElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const handledToolbarCommandIdRef = useRef<string | undefined>(undefined);
  const latestChildModelContextRef = useRef<{
    sourceStateKey: string;
    update: ModelContextUpdate;
  } | null>(null);
  const toolbarSourceActivationRef = useRef<{
    controller: typeof durableViewerState;
    initialToolbarVisible: boolean | undefined;
    sourceStateKey: string;
  }>({
    controller: durableViewerState,
    initialToolbarVisible,
    sourceStateKey: resolvedSourceStateKey,
  });
  const [mode, setMode] = useState<BiologicalSequenceViewerMode>(
    model.defaultMode,
  );
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const toolController = useMemo(
    () => new WorkbenchToolController(),
    [resolvedSourceStateKey],
  );
  const toolControllerVersion = useSyncExternalStore(
    toolController.subscribe,
    toolController.getVersion,
    toolController.getVersion,
  );
  const [generatedAlignment, setGeneratedAlignment] = useState<{
    contents: string;
    name: string;
  } | null>(null);
  const availableModes = useMemo(
    () =>
      generatedAlignment == null || model.availableModes.includes("alignment")
        ? model.availableModes
        : [...model.availableModes, "alignment" as const],
    [generatedAlignment, model.availableModes],
  );
  const activeMode = availableModes.includes(mode) ? mode : model.defaultMode;
  const commandMode =
    command == null
      ? activeMode
      : getCommandMode(command, activeMode, {
          alignmentMetrics: availableModes.includes("alignment"),
          sequenceMetrics: model.sequenceDocument?.fastqSummary != null,
        });
  const toolbarRevealed = toolbarVisible || toolbarTemporarilyRevealed;
  const changeMode = useCallback(
    (nextMode: BiologicalSequenceViewerMode): boolean => {
      if (nextMode === activeMode) return true;
      if (
        hasPendingWorkbenchDialog() ||
        (viewerRef.current != null &&
          hasPendingWorkbenchAction(viewerRef.current))
      ) {
        setModeNotice(
          "Finish or dismiss the pending action before changing viewer mode.",
        );
        return false;
      }
      setModeNotice(null);
      setMode(nextMode);
      return true;
    },
    [activeMode],
  );
  const setToolbarVisibility = useCallback(
    (visible: boolean): boolean => {
      if (!visible) {
        const activeDialog = document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]',
        );
        const activeToolbarFeedback = Array.from(
          viewerRef.current?.querySelectorAll<HTMLElement>(
            "[data-sequence-toolbar-controls]",
          ) ?? [],
        ).some(hasPendingWorkbenchAction);
        if (activeDialog != null || activeToolbarFeedback) {
          return false;
        }
        viewerRef.current?.focus({ preventScroll: true });
      }
      setToolbarVisible(visible);
      setToolbarTemporarilyRevealed(false);
      durableViewerState?.setToolbarVisibility({
        sourceStateKey: resolvedSourceStateKey,
        visible,
      });
      return true;
    },
    [durableViewerState, resolvedSourceStateKey],
  );
  const revealToolbar = useCallback(() => {
    if (!toolbarVisible) setToolbarTemporarilyRevealed(true);
  }, [toolbarVisible]);
  const dismissToolbar = useCallback(
    (nextTarget: EventTarget | null, preserveFocusedToolbar = true) => {
      if (toolbarVisible) return;
      const toolbarContains = (target: EventTarget | null): boolean =>
        target instanceof Node &&
        (toolbarHeaderRef.current?.contains(target) === true ||
          toolbarRevealZoneRef.current?.contains(target) === true ||
          Array.from(
            viewerRef.current?.querySelectorAll(
              "[data-sequence-toolbar-controls]",
            ) ?? [],
          ).some((controls) => controls.contains(target)));
      if (
        toolbarContains(nextTarget) ||
        (preserveFocusedToolbar && toolbarContains(document.activeElement))
      ) {
        return;
      }
      setToolbarTemporarilyRevealed(false);
    },
    [toolbarVisible],
  );
  const updateModelContextWithToolbar = useCallback<ModelContextUpdater>(
    (update) => {
      latestChildModelContextRef.current = {
        sourceStateKey: resolvedSourceStateKey,
        update,
      };
      const disclosures = toolController.getDisclosureSnapshots();
      const feedback = toolController.getFeedbackSnapshots();
      return updateModelContext?.({
        ...update,
        structuredContent: {
          ...update.structuredContent,
          toolbarVisible,
          workbenchPanels: toolController.getSnapshots(),
          workbenchDisclosures: {
            items: disclosures.slice(0, 50),
            totalCount: disclosures.length,
            truncated: disclosures.length > 50,
          },
          workbenchFeedback: {
            items: feedback.slice(0, 50),
            totalCount: feedback.length,
            truncated: feedback.length > 50,
          },
        },
        text: `${update.text}\nToolbar: ${toolbarVisible ? "visible" : "hidden"}`,
      });
    },
    [
      resolvedSourceStateKey,
      toolbarVisible,
      toolController,
      toolControllerVersion,
      updateModelContext,
    ],
  );

  // Child context is deduplicated by biological state. Republish only when
  // shared UI chrome changes, without asking it to fabricate a data change.
  useEffect(() => {
    const latest = latestChildModelContextRef.current;
    if (latest?.sourceStateKey !== resolvedSourceStateKey) return;
    void Promise.resolve(updateModelContextWithToolbar(latest.update)).catch(
      () => {
        // A host context failure must not make the local viewer unusable.
      },
    );
  }, [resolvedSourceStateKey, updateModelContextWithToolbar]);

  useEffect(() => {
    setMode(model.defaultMode);
    setModeNotice(null);
    setGeneratedAlignment(null);
  }, [contents, fileName, model.defaultMode]);

  useEffect(() => {
    const activation = toolbarSourceActivationRef.current;
    if (
      activation.controller === durableViewerState &&
      activation.initialToolbarVisible === initialToolbarVisible &&
      activation.sourceStateKey === resolvedSourceStateKey
    ) {
      return;
    }
    toolbarSourceActivationRef.current = {
      controller: durableViewerState,
      initialToolbarVisible,
      sourceStateKey: resolvedSourceStateKey,
    };
    const restoredVisibility =
      durableViewerState?.restoredState?.sourceStateKey ===
      resolvedSourceStateKey
        ? durableViewerState.restoredState.toolbarVisible
        : undefined;
    setToolbarVisible(restoredVisibility ?? initialToolbarVisible ?? true);
    setToolbarTemporarilyRevealed(false);
  }, [durableViewerState, initialToolbarVisible, resolvedSourceStateKey]);

  useEffect(() => {
    const activation = toolbarSourceActivationRef.current;
    if (
      activation.controller !== durableViewerState ||
      activation.initialToolbarVisible !== initialToolbarVisible ||
      activation.sourceStateKey !== resolvedSourceStateKey
    ) {
      return;
    }
    const restoredVisibility =
      durableViewerState?.restoredState?.sourceStateKey ===
      resolvedSourceStateKey
        ? durableViewerState.restoredState.toolbarVisible
        : undefined;
    if (restoredVisibility != null && restoredVisibility !== toolbarVisible) {
      return;
    }
    durableViewerState?.setToolbarVisibility({
      sourceStateKey: resolvedSourceStateKey,
      visible: toolbarVisible,
    });
  }, [
    durableViewerState,
    initialToolbarVisible,
    resolvedSourceStateKey,
    toolbarVisible,
  ]);

  useEffect(() => {
    if (command == null) {
      return;
    }
    if (command.action === "set_display_mode") {
      return;
    }
    if (handledToolbarCommandIdRef.current === command.commandId) return;
    if (command.action === "set_toolbar_visibility") {
      handledToolbarCommandIdRef.current = command.commandId;
      const applied = setToolbarVisibility(command.visible);
      onCommandResult?.(command, {
        applied,
        message: applied
          ? command.visible
            ? "Showed the viewer toolbar."
            : "Hid the viewer toolbar."
          : "The viewer toolbar cannot be hidden while an approval or copy action needs attention.",
        state: { toolbarVisible: applied ? command.visible : toolbarVisible },
      });
      return;
    }
    if (command.action === "set_mode") {
      handledToolbarCommandIdRef.current = command.commandId;
      if (command.mode == null || !availableModes.includes(command.mode)) {
        onCommandResult?.(command, {
          applied: false,
          message: "That display mode is not available for this artifact.",
        });
        return;
      }
      const applied = changeMode(command.mode);
      onCommandResult?.(command, {
        applied,
        message: applied
          ? `Switched the viewer to ${command.mode} mode.`
          : "Finish or dismiss the pending action before changing viewer mode.",
        state: { mode: applied ? command.mode : activeMode },
      });
      return;
    }
    if (!availableModes.includes(commandMode)) {
      handledToolbarCommandIdRef.current = command.commandId;
      onCommandResult?.(command, {
        applied: false,
        message: `${commandMode} mode is not available for this artifact.`,
        state: { availableModes, mode: activeMode },
      });
      return;
    }
    if (commandMode !== activeMode) {
      if (!changeMode(commandMode)) {
        handledToolbarCommandIdRef.current = command.commandId;
        onCommandResult?.(command, {
          applied: false,
          message:
            "Finish or dismiss the pending action before changing viewer mode.",
          state: { mode: activeMode },
        });
      }
      return;
    }
    if (command.action === "set_workbench_panel") {
      handledToolbarCommandIdRef.current = command.commandId;
      const result = toolController.setPanel(command.group, command.panel);
      if (
        result.applied &&
        command.panel != null &&
        command.group === "sequence-display"
      ) {
        setToolbarVisibility(true);
      }
      onCommandResult?.(command, result);
      return;
    }
    if (command.action === "set_workbench_disclosure") {
      handledToolbarCommandIdRef.current = command.commandId;
      const result = toolController.setDisclosure(
        command.disclosureId,
        command.expanded,
      );
      if (
        result.applied &&
        command.expanded &&
        toolController
          .getDisclosureSnapshots()
          .find(({ id }) => id === command.disclosureId)?.location?.group ===
          "sequence-display"
      ) {
        setToolbarVisibility(true);
      }
      onCommandResult?.(command, result);
      return;
    }
    if (command.action === "dismiss_workbench_feedback") {
      handledToolbarCommandIdRef.current = command.commandId;
      onCommandResult?.(
        command,
        toolController.dismissFeedback(command.feedbackId),
      );
      return;
    }
    if (
      command.action === "query_viewer" &&
      (command.request.target === "workbench-disclosures" ||
        command.request.target === "workbench-feedback")
    ) {
      handledToolbarCommandIdRef.current = command.commandId;
      try {
        const query =
          command.request.target === "workbench-disclosures"
            ? toolController.queryDisclosures(command.request)
            : toolController.queryFeedback(command.request);
        onCommandResult?.(command, {
          applied: true,
          message: `Returned the mounted ${command.request.target} state.`,
          state: { query },
        });
      } catch (error) {
        onCommandResult?.(command, {
          applied: false,
          message:
            error instanceof Error
              ? error.message
              : "The workbench UI state could not be queried.",
        });
      }
      return;
    }
    if (
      command.action === "query_viewer" &&
      command.request.target === "workbench-panels"
    ) {
      handledToolbarCommandIdRef.current = command.commandId;
      const panels = toolController.getSnapshots(command.request.group);
      onCommandResult?.(command, {
        applied: panels.length > 0,
        message:
          panels.length > 0
            ? `Returned ${panels.length} mounted workbench tool group${panels.length === 1 ? "" : "s"}.`
            : "That workbench tool group is not mounted for this artifact.",
        state: {
          query: {
            items: panels,
            nextCursor: null,
            page: {
              count: panels.length,
              offset: 0,
              totalCount: panels.length,
            },
            target: "workbench-panels",
            truncated: false,
          },
        },
      });
    }
  }, [
    activeMode,
    availableModes,
    changeMode,
    command,
    commandMode,
    onCommandResult,
    setToolbarVisibility,
    toolbarVisible,
    toolController,
    toolControllerVersion,
  ]);

  return (
    <WorkbenchToolControllerContext.Provider value={toolController}>
      <div
        className="sequence-viewer-shell flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-token-main-surface-primary text-token-text-primary"
        data-toolbar-mode={toolbarVisible ? "pinned" : "hidden"}
        data-toolbar-revealed={toolbarRevealed}
        data-toolbar-visible={toolbarVisible}
        onBlurCapture={(event) => dismissToolbar(event.relatedTarget, false)}
        onFocusCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("[data-sequence-toolbar-controls]") != null
          ) {
            revealToolbar();
          }
        }}
        onPointerOut={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("[data-sequence-toolbar-controls]") != null
          ) {
            dismissToolbar(event.relatedTarget);
          }
        }}
        onPointerOver={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("[data-sequence-toolbar-controls]") != null
          ) {
            revealToolbar();
          }
        }}
        ref={viewerRef}
        tabIndex={-1}
      >
        {!toolbarVisible ? (
          <button
            aria-controls="sequence-viewer-topbar"
            aria-expanded={toolbarRevealed}
            aria-label="Reveal sequence viewer toolbar"
            className="sequence-toolbar-reveal-zone"
            onBlur={(event) => dismissToolbar(event.relatedTarget, false)}
            onClick={revealToolbar}
            onFocus={revealToolbar}
            onPointerEnter={revealToolbar}
            onPointerLeave={(event) => dismissToolbar(event.relatedTarget)}
            ref={toolbarRevealZoneRef}
            type="button"
          />
        ) : null}
        <BiologicalSequenceViewerHeader
          availableModes={availableModes}
          classification={model.classification.kind}
          displayModeControl={displayModeControl}
          fileName={fileName}
          headerRef={toolbarHeaderRef}
          mode={activeMode}
          onDismissToolbar={dismissToolbar}
          onModeChange={changeMode}
          onRevealToolbar={revealToolbar}
          onToolbarVisibilityChange={setToolbarVisibility}
          toolbarRevealed={toolbarRevealed}
          toolbarVisible={toolbarVisible}
        />
        {modeNotice == null ? null : (
          <p className="bio-workbench-tool-notice" role="status">
            {modeNotice}
          </p>
        )}
        <WorkspaceSessionDiscovery client={workspaceSessions} />
        {activeMode === "alignment" ? (
          <MsaRichViewer
            className="min-h-0 min-w-0 flex-1"
            command={
              command != null &&
              !isSharedWorkbenchCommand(command) &&
              commandMode === "alignment"
                ? command
                : undefined
            }
            contents={generatedAlignment?.contents ?? contents}
            fileName={generatedAlignment?.name ?? fileName}
            onCommandResult={onCommandResult}
            publishWorkspaceArtifact={publishWorkspaceArtifact}
            showFileHeader={false}
            sourceStateKeyOverride={
              generatedAlignment == null ? sourceStateKey : undefined
            }
            toolbarRevealed={toolbarRevealed}
            toolbarVisible={toolbarVisible}
            updateModelContext={
              updateModelContext == null
                ? undefined
                : updateModelContextWithToolbar
            }
            viewerSessionId={viewerSessionId}
            workspaceSessions={workspaceSessions}
          />
        ) : (
          <SequenceModeSurface
            command={
              command != null &&
              !isSharedWorkbenchCommand(command) &&
              commandMode === "sequence"
                ? command
                : undefined
            }
            contents={contents}
            browseWorkspaceTracks={browseWorkspaceTracks}
            fileName={fileName}
            model={model}
            onCommandResult={onCommandResult}
            onOpenAlignment={(alignedFasta, name) => {
              setGeneratedAlignment({ contents: alignedFasta, name });
              setMode("alignment");
            }}
            publishWorkspaceArtifact={publishWorkspaceArtifact}
            sourceStateKey={sourceStateKey}
            toolbarRevealed={toolbarRevealed}
            toolbarVisible={toolbarVisible}
            updateModelContext={
              updateModelContext == null
                ? undefined
                : updateModelContextWithToolbar
            }
            viewerSessionId={viewerSessionId}
            workspaceSessions={workspaceSessions}
          />
        )}
      </div>
    </WorkbenchToolControllerContext.Provider>
  );
}

function SequenceModeSurface({
  browseWorkspaceTracks,
  command,
  contents,
  fileName,
  model,
  onCommandResult,
  onOpenAlignment,
  publishWorkspaceArtifact,
  sourceStateKey,
  toolbarRevealed,
  toolbarVisible,
  updateModelContext,
  viewerSessionId,
  workspaceSessions,
}: {
  browseWorkspaceTracks?: SequenceWorkspaceTrackBrowserClient;
  command?: QueuedSequenceViewerCommand;
  contents: string;
  fileName?: string;
  model: BiologicalSequenceViewerModel;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  onOpenAlignment?: (alignedFasta: string, name: string) => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  sourceStateKey?: string;
  toolbarRevealed?: boolean;
  toolbarVisible?: boolean;
  updateModelContext?: ModelContextUpdater;
  viewerSessionId?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const artifactStateKey = useMemo(
    () => sourceStateKey ?? createArtifactStateKey(contents, fileName),
    [contents, fileName, sourceStateKey],
  );
  const sequenceDocument = useMemo(() => {
    if (model.sequenceDocument != null) {
      return model.sequenceDocument;
    }
    if (!model.alignmentAvailable) {
      return null;
    }
    const parseResult = parseMsa(contents, fileName);
    return parseResult.status === "success"
      ? createSequenceDocumentFromMsa({
          classification: model.classification,
          document: parseResult.document,
          fileName,
        })
      : null;
  }, [contents, fileName, model]);

  return sequenceDocument == null ? (
    <EmptyViewerState>
      No generic sequence projection is available for this biological artifact.
    </EmptyViewerState>
  ) : (
    <SequenceRichViewer
      browseWorkspaceTracks={browseWorkspaceTracks}
      command={command}
      document={sequenceDocument}
      key={artifactStateKey}
      onCommandResult={onCommandResult}
      onOpenAlignment={onOpenAlignment}
      publishWorkspaceArtifact={publishWorkspaceArtifact}
      sourceStateKeyOverride={artifactStateKey}
      toolbarRevealed={toolbarRevealed}
      toolbarVisible={toolbarVisible}
      updateModelContext={updateModelContext}
      viewerSessionId={viewerSessionId}
      workspaceSessions={workspaceSessions}
    />
  );
}

function isSharedWorkbenchCommand(
  command: QueuedSequenceViewerCommand,
): boolean {
  return (
    command.action === "set_mode" ||
    command.action === "set_display_mode" ||
    command.action === "set_toolbar_visibility" ||
    command.action === "set_workbench_panel" ||
    command.action === "set_workbench_disclosure" ||
    command.action === "dismiss_workbench_feedback" ||
    (command.action === "query_viewer" &&
      (command.request.target === "workbench-panels" ||
        command.request.target === "workbench-disclosures" ||
        command.request.target === "workbench-feedback"))
  );
}

function getCommandMode(
  command: QueuedSequenceViewerCommand,
  currentMode: BiologicalSequenceViewerMode,
  metricsCapabilities: {
    alignmentMetrics: boolean;
    sequenceMetrics: boolean;
  },
): BiologicalSequenceViewerMode {
  if (command.action === "set_workbench_panel") {
    return command.group === "alignment-tools" ? "alignment" : "sequence";
  }
  if (command.action === "set_workbench_disclosure") {
    return command.disclosureId.startsWith("alignment.")
      ? "alignment"
      : "sequence";
  }
  if (command.action === "dismiss_workbench_feedback") {
    return command.feedbackId.startsWith("alignment.")
      ? "alignment"
      : "sequence";
  }
  if (
    command.action === "set_read_pileup_options" ||
    command.action === "select_read" ||
    command.action === "clear_read_selection" ||
    command.action === "set_quality_view_options" ||
    command.action === "set_chromatogram_view_options"
  ) {
    return "sequence";
  }
  if (command.action === "restore_session" && command.mode != null) {
    return command.mode;
  }
  if (command.action === "align_sequences") {
    if (command.rowIds != null) return "alignment";
    if (command.recordIds != null) return "sequence";
    return currentMode;
  }
  if (command.action.includes("alignment")) return "alignment";
  if (command.action.includes("sequence")) return "sequence";
  if (command.action === "run_analysis") {
    return command.request.analysis === "build-tree" ||
      command.request.analysis === "distance-matrix"
      ? "alignment"
      : "sequence";
  }
  if (command.action === "edit_copy") {
    if (command.request.operation.includes("alignment")) return "alignment";
    if (
      command.request.operation === "insert-sequence" ||
      command.request.operation === "delete-sequence-range" ||
      command.request.operation === "replace-sequence-range" ||
      command.request.operation === "reverse-complement-range" ||
      command.request.operation === "rotate-sequence"
    ) {
      return "sequence";
    }
  }
  if (command.action === "manage_annotations") return "sequence";
  if (command.action === "query_viewer") {
    if (
      command.request.target === "workbench-disclosures" ||
      command.request.target === "workbench-feedback"
    )
      return command.request.mode ?? currentMode;
    if (
      command.request.target === "workbench-panels" &&
      command.request.group != null
    ) {
      return command.request.group === "alignment-tools"
        ? "alignment"
        : "sequence";
    }
    if (command.request.target === "metrics") {
      if (
        (currentMode === "sequence" && metricsCapabilities.sequenceMetrics) ||
        (currentMode === "alignment" && metricsCapabilities.alignmentMetrics)
      ) {
        return currentMode;
      }
      return metricsCapabilities.alignmentMetrics ? "alignment" : "sequence";
    }
    if (["columns", "rows", "tree-nodes"].includes(command.request.target)) {
      return "alignment";
    }
    if (
      [
        "chromatogram",
        "coverage",
        "features",
        "quality",
        "quality-report",
        "read-detail",
        "read-pileup-state",
        "reads",
        "records",
        "sequence-range",
        "sequence-ui-state",
        "variants",
      ].includes(command.request.target)
    ) {
      return "sequence";
    }
  }
  if (command.action === "export_artifact") {
    if (["aligned-fasta", "newick"].includes(command.format)) {
      return "alignment";
    }
    if (command.format === "svg") return currentMode;
    if (
      ["bed", "embl", "fasta", "fastq", "genbank", "gff3", "vcf"].includes(
        command.format,
      )
    ) {
      return "sequence";
    }
  }
  return currentMode;
}

function BiologicalSequenceViewerHeader({
  availableModes,
  classification,
  displayModeControl,
  fileName,
  headerRef,
  mode,
  onDismissToolbar,
  onModeChange,
  onRevealToolbar,
  onToolbarVisibilityChange,
  toolbarRevealed,
  toolbarVisible,
}: {
  availableModes: Array<BiologicalSequenceViewerMode>;
  classification: BiologicalSequenceViewerModel["classification"]["kind"];
  displayModeControl?: BiologicalSequenceViewerDisplayModeControl;
  fileName?: string;
  headerRef: React.RefObject<HTMLElement | null>;
  mode: BiologicalSequenceViewerMode;
  onDismissToolbar: (
    nextTarget: EventTarget | null,
    preserveFocusedToolbar?: boolean,
  ) => void;
  onModeChange: (mode: BiologicalSequenceViewerMode) => void;
  onRevealToolbar: () => void;
  onToolbarVisibilityChange: (visible: boolean) => void;
  toolbarRevealed: boolean;
  toolbarVisible: boolean;
}): React.ReactElement {
  return (
    <header
      className="sequence-viewer-topbar sticky top-0 z-20 border-b border-token-border bg-token-main-surface-primary"
      id="sequence-viewer-topbar"
      inert={!toolbarRevealed ? true : undefined}
      onBlur={(event) => onDismissToolbar(event.relatedTarget, false)}
      onFocus={onRevealToolbar}
      onPointerEnter={onRevealToolbar}
      onPointerLeave={(event) => onDismissToolbar(event.relatedTarget)}
      ref={headerRef}
    >
      <div className="bio-viewer-header">
        <div className="bio-viewer-identity">
          <span aria-hidden="true" className="bio-viewer-file-mark">
            {mode === "alignment" ? "≡" : "Aa"}
          </span>
          <div className="min-w-0">
            <div className="bio-viewer-file-name" title={fileName}>
              {fileName ?? "Biological sequence"}
            </div>
            <div className="bio-viewer-file-kind">
              {formatArtifactKind(classification)}
            </div>
          </div>
        </div>
        {availableModes.length > 1 ? (
          <nav
            aria-label="Biological Sequence & Alignment Viewer mode"
            className="bio-viewer-mode-switch"
          >
            {availableModes.map((availableMode) => (
              <button
                aria-pressed={mode === availableMode}
                className={clsx(
                  "bio-viewer-mode-button",
                  mode === availableMode
                    ? "bio-viewer-mode-button-active"
                    : "text-token-text-secondary hover:text-token-text-primary",
                )}
                key={availableMode}
                onClick={() => onModeChange(availableMode)}
                type="button"
              >
                {availableMode === "alignment" ? "Alignment" : "Sequence"}
              </button>
            ))}
          </nav>
        ) : null}
        {displayModeControl ? (
          <button
            className="bio-viewer-header-action"
            disabled={displayModeControl.pending}
            onClick={() =>
              void displayModeControl.requestMode(
                displayModeControl.mode === "fullscreen"
                  ? "inline"
                  : "fullscreen",
              )
            }
            type="button"
          >
            {displayModeControl.mode === "fullscreen"
              ? "Return to chat"
              : "Open in side pane"}
          </button>
        ) : null}
        <button
          aria-label={toolbarVisible ? "Hide toolbar" : "Show toolbar"}
          className="bio-viewer-header-action"
          onClick={() => onToolbarVisibilityChange(!toolbarVisible)}
          title={
            toolbarVisible
              ? "Hide the toolbar until you hover or focus the top edge"
              : "Keep the toolbar visible"
          }
          type="button"
        >
          {toolbarVisible ? "Hide" : "Show"}
        </button>
      </div>
    </header>
  );
}

function EmptyViewerState({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-token-text-secondary">
      {children}
    </div>
  );
}

function formatArtifactKind(
  kind: BiologicalSequenceViewerModel["classification"]["kind"],
): string {
  switch (kind) {
    case "annotated-sequence":
      return "Annotated sequence";
    case "chromatogram":
      return "Chromatogram";
    case "fastq":
      return "FASTQ reads";
    case "multiple-sequence-alignment":
      return "Multiple sequence alignment";
    case "sequence-collection":
      return "Sequence collection";
    case "single-sequence":
      return "Single sequence";
    case "unknown":
      return "Biological sequence artifact";
  }
}
