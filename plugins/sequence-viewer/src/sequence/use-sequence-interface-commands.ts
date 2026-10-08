import { useEffect, type MutableRefObject } from "react";

import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import { querySequenceViewer } from "../viewer-query";
import type { SequenceWorkbenchState } from "../workbench-state";
import type { ChromatogramViewState } from "./chromatogram-panel";
import { resolveEvidenceRange } from "./evidence-track-panel";
import type {
  FastqQualityReportState,
  FastqQualityViewState,
} from "./fastq-quality-analysis";
import {
  getEvidenceReferenceUnavailableReason,
  getReadPileupEntryForRecord,
  readPassesPileupFilters,
  type ReadPileupState,
} from "./read-pileup";
import {
  normalizeSequenceRecordBrowserState,
  type SequenceRecordBrowserState,
} from "./record-list-panel";
import {
  normalizeSequenceAnnotationIndexState,
  type SequenceAnnotationIndexState,
} from "./sequence-overview";
import {
  getCompatibleSequencePalettes,
  getDefaultSequencePalette,
} from "./sequence-palette";
import type {
  SequencePaletteId,
  SequenceRecord,
  SequenceSearchHit,
  SequenceSelection,
} from "./types";

export function isSequenceInterfaceCommand(
  command: QueuedSequenceViewerCommand | undefined,
): boolean {
  if (command == null) return false;
  switch (command.action) {
    case "set_sequence_record_browser":
    case "set_sequence_annotation_index":
    case "set_chromatogram_view_options":
    case "set_quality_view_options":
    case "set_read_pileup_options":
    case "select_read":
    case "clear_read_selection":
      return true;
    case "query_viewer":
      return [
        "sequence-ui-state",
        "read-pileup-state",
        "read-detail",
        "reads",
        "coverage",
        "quality-report",
      ].includes(command.request.target);
    default:
      return false;
  }
}

export function createSequenceInterfaceSnapshot({
  annotationIndex,
  chromatogramView,
  originRangeExpanded,
  paletteId,
  paletteRestoreNotice,
  qualityAdapterSequence,
  qualityReport,
  qualityView,
  readPileupState,
  record,
  recordBrowser,
}: {
  annotationIndex: SequenceAnnotationIndexState;
  chromatogramView: ChromatogramViewState;
  originRangeExpanded: boolean;
  paletteId: SequencePaletteId;
  paletteRestoreNotice: string | null;
  qualityAdapterSequence: string | null;
  qualityReport: FastqQualityReportState | null;
  qualityView: FastqQualityViewState;
  readPileupState: ReadPileupState;
  record: SequenceRecord;
  recordBrowser: SequenceRecordBrowserState;
}) {
  const paletteOptions = getCompatibleSequencePalettes(record.molecule);
  return {
    annotationIndex,
    chromatogram: record.chromatogram == null ? null : chromatogramView,
    originRangeExpanded,
    palette: {
      defaultId: getDefaultSequencePalette(record.molecule),
      id: paletteId,
      label:
        paletteOptions.find(({ id }) => id === paletteId)?.label ?? paletteId,
      options: paletteOptions.map(({ description, id, label }) => ({
        description,
        id,
        label,
      })),
      restorationWarning: paletteRestoreNotice,
    },
    quality: {
      adapterSequence: qualityAdapterSequence,
      error: qualityReport?.error ?? null,
      jobId: qualityReport?.jobId ?? null,
      pending: qualityReport?.pending ?? false,
      reportAvailable: qualityReport?.report != null,
    },
    qualityView,
    readPileup: readPileupState,
    recordBrowser,
  };
}

/** UI controls and model commands share the same controlled presentation state. */
export function useSequenceInterfaceCommands({
  annotationIndex,
  chromatogramView,
  command,
  handledCommandIdRef,
  hits,
  onAnnotationIndexChange,
  onChromatogramViewChange,
  onCommandResult,
  onReadPileupStateChange,
  onRecordBrowserChange,
  onQualityViewChange,
  originRangeExpanded,
  paletteId,
  paletteRestoreNotice,
  qualityAdapterSequence,
  qualityReport,
  qualityView,
  readPileupState,
  record,
  recordBrowser,
  selection,
  state,
  viewport,
}: {
  annotationIndex: SequenceAnnotationIndexState;
  chromatogramView: ChromatogramViewState;
  command?: QueuedSequenceViewerCommand;
  handledCommandIdRef: MutableRefObject<string | undefined>;
  hits: Array<SequenceSearchHit>;
  onAnnotationIndexChange: (value: SequenceAnnotationIndexState) => void;
  onChromatogramViewChange: (value: ChromatogramViewState) => void;
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void;
  onReadPileupStateChange: (value: ReadPileupState) => void;
  onRecordBrowserChange: (value: SequenceRecordBrowserState) => void;
  onQualityViewChange: (value: FastqQualityViewState) => void;
  originRangeExpanded: boolean;
  paletteId: SequencePaletteId;
  paletteRestoreNotice: string | null;
  qualityAdapterSequence: string | null;
  qualityReport: FastqQualityReportState | null;
  qualityView: FastqQualityViewState;
  readPileupState: ReadPileupState;
  record: SequenceRecord;
  recordBrowser: SequenceRecordBrowserState;
  selection?: SequenceSelection;
  state: SequenceWorkbenchState;
  viewport: { end: number; start: number } | null;
}): void {
  useEffect(() => {
    if (
      command == null ||
      !isSequenceInterfaceCommand(command) ||
      handledCommandIdRef.current === command.commandId
    ) {
      return;
    }
    let result: SequenceViewerCommandResult;
    try {
      switch (command.action) {
        case "set_sequence_record_browser": {
          const next = normalizeSequenceRecordBrowserState(
            state.document.records,
            {
              expanded: command.expanded ?? recordBrowser.expanded,
              page:
                command.page ??
                (command.query == null ? recordBrowser.page : 0),
              query: command.query ?? recordBrowser.query,
              sortBy: command.sortBy ?? recordBrowser.sortBy,
            },
          );
          onRecordBrowserChange(next);
          result = {
            applied: true,
            message: "Updated the sequence record browser.",
            state: { recordBrowser: next },
          };
          break;
        }
        case "set_sequence_annotation_index": {
          const next = normalizeSequenceAnnotationIndexState(record, {
            expanded: command.expanded ?? annotationIndex.expanded,
            page:
              command.page ??
              (command.query == null ? annotationIndex.page : 0),
            query: command.query ?? annotationIndex.query,
          });
          onAnnotationIndexChange(next);
          result = {
            applied: true,
            message: "Updated the sequence annotation index.",
            state: { annotationIndex: next },
          };
          break;
        }
        case "set_chromatogram_view_options": {
          if (record.chromatogram == null) {
            throw new Error("The selected record has no chromatogram trace.");
          }
          const firstBase = command.firstBase ?? chromatogramView.firstBase;
          const basesPerWindow =
            command.basesPerWindow ?? chromatogramView.basesPerWindow;
          if (
            !Number.isSafeInteger(firstBase) ||
            firstBase < 1 ||
            firstBase > record.length
          ) {
            throw new Error(
              `The first trace base must be within 1–${record.length}.`,
            );
          }
          if (
            !Number.isSafeInteger(basesPerWindow) ||
            basesPerWindow < 1 ||
            basesPerWindow > 100
          ) {
            throw new Error(
              "Trace windows must contain between 1 and 100 requested bases.",
            );
          }
          const next = { basesPerWindow, firstBase };
          onChromatogramViewChange(next);
          result = {
            applied: true,
            message:
              "Updated the chromatogram view in original read coordinates. The visible window also adapts to available width.",
            state: { chromatogram: next },
          };
          break;
        }
        case "set_quality_view_options": {
          if (state.document.format !== "fastq") {
            throw new Error(
              "Quality report display options require FASTQ reads.",
            );
          }
          const next: FastqQualityViewState = {
            distributionsExpanded:
              command.distributionsExpanded ??
              qualityView.distributionsExpanded,
            expandedTables: [
              ...new Set(command.expandedTables ?? qualityView.expandedTables),
            ],
            methodsExpanded:
              command.methodsExpanded ?? qualityView.methodsExpanded,
          };
          onQualityViewChange(next);
          result = {
            applied: true,
            message: "Updated the quality report disclosures and data tables.",
            state: { qualityView: next },
          };
          break;
        }
        case "set_read_pileup_options": {
          const previous = readPileupState.options;
          const next: ReadPileupState = {
            ...readPileupState,
            options: {
              includeDuplicates:
                command.includeDuplicates ?? previous.includeDuplicates,
              includeQcFailed:
                command.includeQcFailed ?? previous.includeQcFailed,
              includeSecondary:
                command.includeSecondary ?? previous.includeSecondary,
              includeSupplementary:
                command.includeSupplementary ?? previous.includeSupplementary,
              includeUnknownMappingQuality:
                command.includeUnknownMappingQuality ??
                previous.includeUnknownMappingQuality,
              minimumMappingQuality:
                command.minimumMappingQuality ?? previous.minimumMappingQuality,
              showAllBases: command.showAllBases ?? previous.showAllBases,
              showSoftClips: command.showSoftClips ?? previous.showSoftClips,
              sortBy: command.sortBy ?? previous.sortBy,
              strand: command.strand ?? previous.strand,
            },
          };
          onReadPileupStateChange(next);
          result = {
            applied: true,
            message: "Updated the read pileup filters and display options.",
            state: { readPileup: next },
          };
          break;
        }
        case "select_read": {
          const unavailableReason =
            getEvidenceReferenceUnavailableReason(record);
          if (unavailableReason != null) throw new Error(unavailableReason);
          const selectedRead = {
            sourceReadIndex: command.sourceReadIndex,
            trackId: command.trackId,
          };
          const { read } = getReadPileupEntryForRecord(
            state.tracks,
            selectedRead,
            record,
            state.document.records,
          );
          const range = resolveEvidenceRange({ record, selection, viewport });
          if (read.position > range.end || read.end < range.start) {
            throw new Error(
              "The read is outside the displayed reference window. Focus its reference range before selecting it.",
            );
          }
          if (!readPassesPileupFilters(read, readPileupState.options)) {
            throw new Error(
              "The read is excluded by the active pileup filters. Change those filters before selecting it.",
            );
          }
          const next = { ...readPileupState, selectedRead };
          onReadPileupStateChange(next);
          result = {
            applied: true,
            message: "Selected the loaded source read for inspection.",
            state: { readPileup: next },
          };
          break;
        }
        case "clear_read_selection": {
          const next = { ...readPileupState, selectedRead: null };
          onReadPileupStateChange(next);
          result = {
            applied: true,
            message: "Cleared the read inspector selection.",
            state: { readPileup: next },
          };
          break;
        }
        case "query_viewer": {
          if (command.request.target === "sequence-ui-state") {
            result = {
              applied: true,
              message: "Returned the live sequence interface state.",
              state: {
                query: {
                  target: command.request.target,
                  result: createSequenceInterfaceSnapshot({
                    annotationIndex,
                    chromatogramView,
                    originRangeExpanded,
                    paletteId,
                    paletteRestoreNotice,
                    qualityAdapterSequence,
                    qualityReport,
                    qualityView,
                    readPileupState,
                    record,
                    recordBrowser,
                  }),
                },
              },
            };
          } else if (command.request.target === "quality-report") {
            result = {
              applied: true,
              message:
                qualityReport?.report == null
                  ? "The live quality report is not ready; run quality-report analysis or inspect its job status."
                  : "Returned the same bounded quality report displayed in the viewer.",
              state: {
                query: {
                  target: command.request.target,
                  result: qualityReport?.report ?? {
                    adapterSequence: qualityAdapterSequence,
                    error: qualityReport?.error ?? null,
                    jobId: qualityReport?.jobId ?? null,
                    pending: qualityReport?.pending ?? false,
                    reportAvailable: false,
                  },
                },
              },
            };
          } else {
            result = {
              applied: true,
              message: `Returned ${command.request.target} from the live read pileup.`,
              state: {
                query: querySequenceViewer({
                  artifacts: state.artifacts,
                  document: state.document,
                  hits,
                  jobs: state.jobs,
                  readPileupRange: resolveEvidenceRange({
                    record,
                    selection,
                    viewport,
                  }),
                  readPileupState,
                  request: command.request,
                  selectedRecordId: record.id,
                  tracks: state.tracks,
                }),
              },
            };
          }
          break;
        }
        default:
          return;
      }
    } catch (error) {
      result = {
        applied: false,
        message:
          error instanceof Error
            ? error.message
            : "The sequence interface action could not be applied.",
      };
    }
    handledCommandIdRef.current = command.commandId;
    onCommandResult?.(command, result);
  }, [
    annotationIndex,
    chromatogramView,
    command,
    handledCommandIdRef,
    hits,
    onAnnotationIndexChange,
    onChromatogramViewChange,
    onCommandResult,
    onReadPileupStateChange,
    onRecordBrowserChange,
    onQualityViewChange,
    originRangeExpanded,
    paletteId,
    paletteRestoreNotice,
    qualityAdapterSequence,
    qualityReport,
    qualityView,
    readPileupState,
    record,
    recordBrowser,
    selection,
    state,
    viewport,
  ]);
}
