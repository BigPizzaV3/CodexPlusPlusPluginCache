import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { WorkbenchTools } from "../ui/workbench-tools";
import { WorkbenchDisclosure } from "../ui/workbench-disclosure";

import type {
  SequenceViewerAnalysisRequest,
  SequenceViewerEditRequest,
} from "../viewer-operations";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import type { SequenceWorkspaceSessionClient } from "../views/workspace-sessions";
import type { SequenceWorkspaceTrackBrowserClient } from "../views/workspace-tracks";
import type {
  SequenceWorkbenchState,
  WorkbenchArtifact,
} from "../workbench-state";
import { WorkspacePublishButton } from "../workspace-publish-button";
import { WorkspaceSessionSaveButton } from "../workspace-session-controls";
import { getGeneticCode, SUPPORTED_GENETIC_CODE_IDS } from "./genetic-code";
import { getSelectionLength, getSelectionSegments } from "./selection";
import type { SequenceTrackFormat } from "./tracks";
import type {
  SequenceFeature,
  SequenceRecord,
  SequenceSelection,
} from "./types";
import { WorkspaceTrackBrowserButton } from "./workspace-track-browser-dialog";

type WorkbenchTab = "analyze" | "edit" | "export" | "history" | "tracks";

export function SequenceWorkbenchPanel({
  browseWorkspaceTracks,
  contextPanels = [],
  geneticCodeId,
  onAddAnnotation,
  onAlignRecords,
  onCancelJob,
  onEdit,
  onExport,
  onGeneticCodeChange,
  onDeleteAnnotation,
  onImportTrack,
  onLoadTrack,
  onRedo,
  onRemoveTrack,
  onRunAnalysis,
  onRestoreSession,
  onSaveSession,
  prepareWorkspaceSession,
  publishWorkspaceArtifact,
  onSelectFeature,
  onUndo,
  onUpdateAnnotation,
  record,
  recordCount,
  selection,
  selectedFeature,
  state,
  workspaceSessionName,
  workspaceSessions,
}: {
  browseWorkspaceTracks?: SequenceWorkspaceTrackBrowserClient;
  contextPanels?: Array<{ id: string; label: string; content: ReactNode }>;
  geneticCodeId: number;
  onAddAnnotation: (input: { label: string; type: string }) => void;
  onAlignRecords: () => void;
  onCancelJob: (jobId: string) => void;
  onEdit: (request: SequenceViewerEditRequest) => void;
  onExport: (
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
  ) => void;
  onGeneticCodeChange: (id: number) => void;
  onDeleteAnnotation: (featureId: string) => void;
  onImportTrack: (trackId: string) => void;
  onLoadTrack: (input: {
    bytes: Uint8Array;
    displayName: string;
    format: SequenceTrackFormat;
    indexBytes?: Uint8Array;
    indexFormat?: "bai" | "csi";
    referenceContents?: string;
    referenceFileName?: string;
  }) => void;
  onRedo: () => void;
  onRemoveTrack: (trackId: string) => void;
  onRunAnalysis: (request: SequenceViewerAnalysisRequest) => void;
  onRestoreSession: (content: string) => void;
  onSaveSession: () => void;
  prepareWorkspaceSession?: () => string;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  onSelectFeature: (feature: SequenceFeature) => void;
  onUndo: () => void;
  onUpdateAnnotation: (input: {
    feature: SequenceFeature;
    label: string;
    type: string;
  }) => void;
  record: SequenceRecord;
  recordCount: number;
  selection?: SequenceSelection;
  selectedFeature?: SequenceFeature;
  state: SequenceWorkbenchState;
  workspaceSessionName?: string;
  workspaceSessions?: SequenceWorkspaceSessionClient;
}): React.ReactElement {
  const [editSequence, setEditSequence] = useState("");
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [annotationType, setAnnotationType] = useState("misc_feature");
  const [fileError, setFileError] = useState<string>();
  const [featureFilter, setFeatureFilter] = useState("");
  const [includePartialOrfs, setIncludePartialOrfs] = useState(false);
  const [orfMinimumAminoAcids, setOrfMinimumAminoAcids] = useState(30);
  const [orfStrands, setOrfStrands] = useState<"+" | "-" | "both">("both");
  const [primerMaximumPairs, setPrimerMaximumPairs] = useState(10);
  const [primerMaximumProductLength, setPrimerMaximumProductLength] =
    useState(1_500);
  const [primerMinimumProductLength, setPrimerMinimumProductLength] =
    useState(80);
  const [restrictionEnzymes, setRestrictionEnzymes] = useState("");
  const [sessionError, setSessionError] = useState<string>();
  const activeSelection =
    selection?.recordId === record.id ? selection : undefined;
  const runningJobs = state.jobs.filter(({ status }) => status === "running");
  const latestJob = state.jobs.at(-1);
  const filteredFeatures = useMemo(() => {
    const query = featureFilter.trim().toLowerCase();
    if (query.length === 0) return record.features;
    return record.features.filter((feature) =>
      [
        feature.id,
        feature.label,
        feature.type,
        ...Object.entries(feature.qualifiers).flatMap(([key, value]) => [
          key,
          ...(Array.isArray(value) ? value : [value]),
        ]),
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [featureFilter, record.features]);
  const actions = useMemo(
    () =>
      [
        ["analyze", "Analyze"],
        ["edit", state.dirty ? "Edit copy •" : "Edit copy"],
        [
          "tracks",
          `Tracks${state.tracks.length === 0 ? "" : ` ${state.tracks.length}`}`,
        ],
        ["export", "Export"],
        [
          "history",
          `Tasks${runningJobs.length === 0 ? "" : ` ${runningJobs.length}`}`,
        ],
      ] as Array<[WorkbenchTab, string]>,
    [runningJobs.length, state.dirty, state.tracks.length],
  );

  async function loadTrack(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    try {
      if (
        files.reduce((sum, file) => sum + file.size, 0) >
        16 * 1_024 * 1_024
      ) {
        throw new Error(
          "Interactive track uploads are limited to 16 MiB total.",
        );
      }
      const file = files.find(({ name }) => inferTrackFormat(name) != null);
      if (file == null)
        throw new Error("No supported evidence track was selected.");
      const format = inferTrackFormat(file.name);
      if (format == null) {
        throw new Error(
          "Choose a BED, GFF3, GTF, VCF, SAM, BAM, or CRAM file.",
        );
      }
      setFileError(undefined);
      if (format === "cram") {
        const index = files.find(({ name }) =>
          name.toLowerCase().endsWith(".crai"),
        );
        const reference = files.find(({ name }) => isReferenceFileName(name));
        if (index == null || reference == null) {
          throw new Error(
            "CRAM loading requires the CRAM, its CRAI index, and a matching FASTA reference in the same chooser.",
          );
        }
        onLoadTrack({
          bytes: new Uint8Array(await file.arrayBuffer()),
          displayName: file.name,
          format,
          indexBytes: new Uint8Array(await index.arrayBuffer()),
          referenceContents: await reference.text(),
          referenceFileName: reference.name,
        });
        return;
      }
      if (format === "bam") {
        const index = files.find(({ name }) => /\.(?:bai|csi)$/iu.test(name));
        onLoadTrack({
          bytes: new Uint8Array(await file.arrayBuffer()),
          displayName: file.name,
          format,
          indexBytes:
            index == null
              ? undefined
              : new Uint8Array(await index.arrayBuffer()),
          indexFormat: index?.name.toLowerCase().endsWith(".csi")
            ? "csi"
            : "bai",
        });
        return;
      }
      onLoadTrack({
        bytes: new Uint8Array(await file.arrayBuffer()),
        displayName: file.name,
        format,
      });
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "The track could not be loaded.",
      );
    }
  }

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

  const panelContent: Record<WorkbenchTab, ReactNode> = {
    analyze: (
      <div className="space-y-3">
        <label className="flex flex-wrap items-center gap-2 text-sm text-token-text-secondary">
          Genetic code
          <select
            aria-label="Genetic code"
            className={inputClass}
            onChange={(event) =>
              onGeneticCodeChange(Number(event.target.value))
            }
            value={geneticCodeId}
          >
            {SUPPORTED_GENETIC_CODE_IDS.map((id) => (
              <option key={id} value={id}>
                {id} · {getGeneticCode(id)?.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <AnalysisButton
            label="Statistics"
            onClick={() => onRunAnalysis({ analysis: "statistics" })}
          />
          <AnalysisButton
            label="Six-frame translation"
            onClick={() => onRunAnalysis({ analysis: "translate" })}
          />
          <AnalysisButton
            label="Find ORFs"
            onClick={() =>
              onRunAnalysis({
                analysis: "find-orfs",
                includePartial: includePartialOrfs,
                minAminoAcids: orfMinimumAminoAcids,
                strands: orfStrands,
              })
            }
          />
          <AnalysisButton
            label="Restriction digest"
            onClick={() =>
              onRunAnalysis({
                analysis: "restriction-analysis",
                enzymes: parseRestrictionEnzymes(restrictionEnzymes),
              })
            }
          />
          <AnalysisButton
            label="Design primers"
            onClick={() =>
              onRunAnalysis({
                analysis: "design-primers",
                maxPairs: primerMaximumPairs,
                maxProductLength: primerMaximumProductLength,
                minProductLength: primerMinimumProductLength,
              })
            }
          />
          <button
            className={actionClass}
            disabled={recordCount < 2}
            onClick={onAlignRecords}
            type="button"
          >
            Align {recordCount.toLocaleString()} records
          </button>
        </div>
        <p className="text-xs text-token-text-secondary">
          Primer design and built-in alignment are exploratory. Results include
          engine provenance and explicit limitations.
        </p>
        <WorkbenchDisclosure
          className="rounded-md border border-token-border bg-token-main-surface-primary p-2"
          id="sequence.analysis-parameters"
          label="Advanced analysis parameters"
          summaryClassName="cursor-pointer text-sm font-medium text-token-text-primary"
        >
          <div className="mt-3 grid gap-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-token-text-primary">
                ORFs
              </legend>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                Minimum amino acids
                <input
                  aria-label="Minimum ORF amino acids"
                  className={inputClass}
                  min="1"
                  onChange={(event) =>
                    setOrfMinimumAminoAcids(
                      Math.max(1, Number(event.target.value)),
                    )
                  }
                  type="number"
                  value={orfMinimumAminoAcids}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                Strands
                <select
                  aria-label="ORF strands"
                  className={inputClass}
                  onChange={(event) =>
                    setOrfStrands(event.target.value as "+" | "-" | "both")
                  }
                  value={orfStrands}
                >
                  <option value="both">Both</option>
                  <option value="+">Forward</option>
                  <option value="-">Reverse</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                <input
                  checked={includePartialOrfs}
                  onChange={(event) =>
                    setIncludePartialOrfs(event.target.checked)
                  }
                  type="checkbox"
                />
                Include partial ORFs
              </label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-token-text-primary">
                Primer pairs
              </legend>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                Minimum product
                <input
                  aria-label="Minimum primer product length"
                  className={inputClass}
                  min="20"
                  onChange={(event) =>
                    setPrimerMinimumProductLength(
                      Math.min(
                        primerMaximumProductLength,
                        Math.max(20, Number(event.target.value)),
                      ),
                    )
                  }
                  type="number"
                  value={primerMinimumProductLength}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                Maximum product
                <input
                  aria-label="Maximum primer product length"
                  className={inputClass}
                  min="20"
                  onChange={(event) =>
                    setPrimerMaximumProductLength(
                      Math.max(
                        primerMinimumProductLength,
                        Number(event.target.value),
                      ),
                    )
                  }
                  type="number"
                  value={primerMaximumProductLength}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-token-text-secondary">
                Maximum pairs
                <input
                  aria-label="Maximum primer pairs"
                  className={inputClass}
                  max="50"
                  min="1"
                  onChange={(event) =>
                    setPrimerMaximumPairs(
                      Math.min(50, Math.max(1, Number(event.target.value))),
                    )
                  }
                  type="number"
                  value={primerMaximumPairs}
                />
              </label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-token-text-primary">
                Restriction digest
              </legend>
              <label className="block text-xs text-token-text-secondary">
                Enzymes (comma separated)
                <input
                  aria-label="Restriction enzymes"
                  className={`${inputClass} mt-1 w-full`}
                  onChange={(event) =>
                    setRestrictionEnzymes(event.target.value)
                  }
                  placeholder="EcoRI, BamHI; blank = common set"
                  value={restrictionEnzymes}
                />
              </label>
            </fieldset>
          </div>
        </WorkbenchDisclosure>
      </div>
    ),
    edit: (
      <div className="grid gap-4">
        <p className="text-sm text-token-text-secondary">
          Edits are staged in a reversible copy.
        </p>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-token-text-primary">
            Edit selected sequence
          </h3>
          <textarea
            aria-label="Replacement or inserted sequence"
            className={`${inputClass} min-h-16 w-full font-mono`}
            onChange={(event) => setEditSequence(event.target.value)}
            placeholder="Paste bases or residues"
            value={editSequence}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className={actionClass}
              disabled={editSequence.trim().length === 0}
              onClick={() => {
                onEdit({
                  coordinate: activeSelection?.start ?? 1,
                  operation: "insert-sequence",
                  sequence: editSequence,
                });
                setEditSequence("");
              }}
              type="button"
            >
              Insert before {activeSelection?.start ?? 1}
            </button>
            <button
              className={actionClass}
              disabled={
                activeSelection == null ||
                activeSelection.segments != null ||
                editSequence.trim().length === 0
              }
              onClick={() => {
                if (activeSelection == null) return;
                onEdit({
                  end: activeSelection.end,
                  operation: "replace-sequence-range",
                  sequence: editSequence,
                  start: activeSelection.start,
                });
                setEditSequence("");
              }}
              type="button"
            >
              Replace selection
            </button>
            <button
              className={actionClass}
              disabled={
                activeSelection == null || activeSelection.segments != null
              }
              onClick={() => {
                if (activeSelection == null) return;
                onEdit({
                  end: activeSelection.end,
                  operation: "delete-sequence-range",
                  start: activeSelection.start,
                });
              }}
              type="button"
            >
              Delete selection
            </button>
          </div>
          {activeSelection?.segments == null ? null : (
            <p className="text-xs text-token-text-secondary">
              Discontinuous selections can be inspected and exported. Select a
              contiguous range before editing or annotating.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-token-text-primary">
            Annotate selection
          </h3>
          <div className="flex gap-2">
            <input
              aria-label="Annotation type"
              className={inputClass}
              onChange={(event) => setAnnotationType(event.target.value)}
              value={annotationType}
            />
            <input
              aria-label="Annotation label"
              className={inputClass}
              onChange={(event) => setAnnotationLabel(event.target.value)}
              placeholder="Label"
              value={annotationLabel}
            />
          </div>
          <button
            className={actionClass}
            disabled={
              activeSelection == null ||
              activeSelection.segments != null ||
              annotationLabel.trim().length === 0
            }
            onClick={() => {
              onAddAnnotation({
                label: annotationLabel.trim(),
                type: annotationType.trim() || "misc_feature",
              });
              setAnnotationLabel("");
            }}
            type="button"
          >
            Add annotation
          </button>
          <button
            className={actionClass}
            disabled={
              selectedFeature == null || annotationLabel.trim().length === 0
            }
            onClick={() => {
              if (selectedFeature == null) return;
              onUpdateAnnotation({
                feature: selectedFeature,
                label: annotationLabel.trim(),
                type: annotationType.trim() || selectedFeature.type,
              });
              setAnnotationLabel("");
            }}
            type="button"
          >
            Update selected feature
          </button>
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-token-text-primary">
              Features and annotations
            </h3>
            <input
              aria-label="Filter features"
              className={inputClass}
              onChange={(event) => setFeatureFilter(event.target.value)}
              placeholder="Filter type, label, qualifier"
              value={featureFilter}
            />
            <span className="text-xs text-token-text-secondary">
              {filteredFeatures.length.toLocaleString()} of{" "}
              {record.features.length.toLocaleString()}
            </span>
          </div>
          <div className="max-h-44 overflow-auto rounded border border-token-border bg-token-main-surface-primary">
            {filteredFeatures.slice(0, 500).map((feature) => (
              <div
                className={`flex items-center gap-2 border-b border-token-border px-2 py-1.5 text-sm last:border-b-0 ${selectedFeature?.id === feature.id ? "bg-emerald-500/10" : ""}`}
                key={feature.id}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectFeature(feature)}
                  type="button"
                >
                  <span className="font-medium text-token-text-primary">
                    {feature.label ?? feature.type}
                  </span>{" "}
                  <span className="text-token-text-secondary">
                    {feature.type} · {feature.start.toLocaleString()}–
                    {feature.end.toLocaleString()} · {feature.strand}
                    {feature.segments != null && feature.segments.length > 1
                      ? ` · ${feature.segments.length.toLocaleString()} exons`
                      : null}
                  </span>
                </button>
                <button
                  aria-label={`Delete ${feature.label ?? feature.type}`}
                  className={actionClass}
                  onClick={() => onDeleteAnnotation(feature.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))}
            {filteredFeatures.length === 0 ? (
              <p className="p-2 text-sm text-token-text-secondary">
                No features match this filter.
              </p>
            ) : null}
          </div>
          {filteredFeatures.length > 500 ? (
            <p className="text-xs text-token-text-secondary">
              Showing the first 500 matches; use the model query tool to page
              the full feature set.
            </p>
          ) : null}
        </div>
      </div>
    ),
    tracks: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="hover:bg-token-main-surface-secondary inline-flex cursor-pointer items-center rounded-md border border-token-border bg-token-main-surface-primary px-2.5 py-1.5 text-sm font-medium text-token-text-primary">
            Load local evidence track
            <input
              accept=".bai,.bam,.bed,.cram,.crai,.csi,.fa,.fasta,.fna,.gff,.gff3,.gtf,.sam,.vcf"
              className="sr-only"
              multiple
              onChange={(event) => void loadTrack(event)}
              type="file"
            />
          </label>
          <WorkspaceTrackBrowserButton browser={browseWorkspaceTracks} />
        </div>
        {fileError == null ? null : (
          <p role="alert" className="text-sm text-red-500">
            {fileError}
          </p>
        )}
        <div className="grid gap-2">
          {state.tracks.map((track) => (
            <div
              className="rounded border border-token-border bg-token-main-surface-primary p-2"
              key={track.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-token-text-primary">
                    {track.name}
                  </div>
                  <div className="text-xs text-token-text-secondary">
                    {track.format.toUpperCase()} ·{" "}
                    {track.summary.itemCount.toLocaleString()} items · mapping{" "}
                    {track.mapping.status}
                  </div>
                </div>
                <button
                  aria-label={`Remove ${track.name}`}
                  className={actionClass}
                  onClick={() => onRemoveTrack(track.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              {track.kind === "annotations" ? (
                <button
                  className={`${actionClass} mt-2`}
                  onClick={() => onImportTrack(track.id)}
                  type="button"
                >
                  Import into editable copy
                </button>
              ) : null}
            </div>
          ))}
          {state.tracks.length === 0 ? (
            <p className="text-sm text-token-text-secondary">
              Load GFF/GTF/BED annotations, VCF variants, SAM reads, BAM +
              BAI/CSI, or CRAM + CRAI + reference FASTA. Indexed read bundles
              load only the first bounded regional window; the model can request
              exact workspace regions with <code>sequence.load_track</code>.
            </p>
          ) : null}
        </div>
      </div>
    ),
    export: (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              "fasta",
              "genbank",
              "embl",
              "gff3",
              "gtf",
              "bed",
              "csv",
              "tsv",
              "vcf",
              "svg",
              "pdf",
              "json",
            ] as const
          ).map((format) => (
            <button
              className={actionClass}
              key={format}
              onClick={() =>
                onExport(format, activeSelection == null ? "all" : "selection")
              }
              type="button"
            >
              {format.toUpperCase()}
            </button>
          ))}
          <button className={actionClass} onClick={onSaveSession} type="button">
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
          <p className="text-sm text-red-500" role="alert">
            {sessionError}
          </p>
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
    ),
    history: (
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-token-text-primary">
            Tasks
          </h3>
          <div className="mt-2 space-y-2">
            {state.jobs
              .slice(-10)
              .reverse()
              .map((job) => (
                <div
                  className="rounded border border-token-border bg-token-main-surface-primary p-2 text-sm"
                  key={job.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{job.kind}</span>
                    <span className="text-token-text-secondary">
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-token-text-secondary">
                    {job.message}
                  </div>
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
              <p className="text-sm text-token-text-secondary">
                No analyses have run yet.
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-token-text-primary">
            Latest result
          </h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-token-border bg-token-main-surface-primary p-2 text-xs whitespace-pre-wrap text-token-text-secondary">
            {latestJob?.result == null
              ? "No completed result."
              : JSON.stringify(latestJob.result, null, 2).slice(0, 8_000)}
          </pre>
        </div>
      </div>
    ),
  };

  return (
    <section
      aria-label="Sequence workbench"
      className="bio-sequence-workbench min-w-0"
      data-testid="sequence-workbench"
    >
      {activeSelection == null ? null : (
        <div
          aria-label="Selected sequence actions"
          className="flex flex-wrap items-center gap-2 border-b border-token-border px-3 py-3"
        >
          <span className="text-sm font-medium text-token-text-primary">
            {getSelectionSegments(activeSelection)
              .map(
                ({ end, start }) =>
                  `${start.toLocaleString()}–${end.toLocaleString()}`,
              )
              .join(" + ")}{" "}
            selected · {getSelectionLength(activeSelection).toLocaleString()}{" "}
            residues
          </span>
          <button
            className={actionClass}
            disabled={activeSelection.segments != null}
            onClick={() =>
              onRunAnalysis({
                analysis: "translate",
                end: activeSelection.end,
                start: activeSelection.start,
              })
            }
            type="button"
          >
            Translate
          </button>
          <button
            className={actionClass}
            disabled={activeSelection.segments != null}
            onClick={() =>
              onEdit({
                end: activeSelection.end,
                operation: "reverse-complement-range",
                start: activeSelection.start,
              })
            }
            type="button"
          >
            Reverse complement
          </button>
          <button
            className={actionClass}
            onClick={() => onExport("fasta", "selection")}
            type="button"
          >
            Export FASTA
          </button>
        </div>
      )}
      <WorkbenchTools
        group="sequence-tools"
        label="Sequence tools"
        panels={[
          ...contextPanels,
          ...actions.map(([id, label]) => ({
            id,
            label,
            content: panelContent[id],
          })),
        ]}
      />
      {latestJob == null ? null : (
        <div
          className="border-t border-token-border px-3 py-2 text-sm text-token-text-secondary"
          role="status"
        >
          <span className="font-medium text-token-text-primary">
            {latestJob.kind}
          </span>
          {" · "}
          {latestJob.status}
          {latestJob.message == null ? "" : ` · ${latestJob.message}`}
        </div>
      )}
    </section>
  );
}

function AnalysisButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button className={actionClass} onClick={onClick} type="button">
      {label}
    </button>
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
      <p className="text-sm text-token-text-secondary">
        Exports and generated alignments appear here with their provenance.
      </p>
    );
  return (
    <div className="grid gap-2">
      {artifacts
        .slice(-10)
        .reverse()
        .map((artifact) => (
          <div
            className="flex items-center justify-between gap-2 rounded border border-token-border bg-token-main-surface-primary p-2"
            key={artifact.id}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {artifact.name}
              </div>
              <div className="text-xs text-token-text-secondary">
                {artifact.format} · {artifact.provenance.engine}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {publisher == null ? (
                <span
                  className="text-xs text-token-text-secondary"
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
    artifact.format !== "bed" &&
    artifact.format !== "csv" &&
    artifact.format !== "gff3" &&
    artifact.format !== "gtf" &&
    artifact.format !== "vcf" &&
    artifact.format !== "tsv" &&
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

function parseRestrictionEnzymes(value: string): Array<string> | undefined {
  const enzymes = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return enzymes.length === 0 ? undefined : enzymes;
}

function inferTrackFormat(fileName: string): SequenceTrackFormat | null {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".bam")) return "bam";
  if (normalized.endsWith(".bed")) return "bed";
  if (normalized.endsWith(".cram")) return "cram";
  if (normalized.endsWith(".gff") || normalized.endsWith(".gff3"))
    return "gff3";
  if (normalized.endsWith(".gtf")) return "gtf";
  if (normalized.endsWith(".sam")) return "sam";
  if (normalized.endsWith(".vcf")) return "vcf";
  return null;
}

function isReferenceFileName(fileName: string): boolean {
  return /\.(?:fa|fasta|fna)$/iu.test(fileName);
}

const actionClass =
  "rounded-md border border-token-border bg-token-main-surface-primary px-2.5 py-1 text-sm font-medium text-token-text-secondary hover:bg-token-main-surface-secondary hover:text-token-text-primary disabled:cursor-not-allowed disabled:opacity-40";
const inputClass =
  "min-w-0 max-w-full rounded-md border border-token-border bg-token-input-background px-2 py-1 text-sm text-token-text-primary outline-none focus:border-token-focus-border";
