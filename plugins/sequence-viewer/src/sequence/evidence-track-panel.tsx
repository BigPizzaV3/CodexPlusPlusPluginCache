import { useMemo, useState } from "react";
import { WorkbenchDisclosure } from "../ui/workbench-disclosure";

import { getSelectionSegments } from "./selection";
import {
  getDefaultSequencePalette,
  getSequenceResidueStyle,
} from "./sequence-palette";
import {
  binReadCoverage,
  DEFAULT_READ_PILEUP_STATE,
  findVisibleReadMate,
  getEvidenceReferenceUnavailableReason,
  getReadPileupEntryForRecord,
  identifyReadPileupEntries,
  mappingQualityLabel,
  mappingQualityOpacity,
  projectReadAlignment,
  READ_PILEUP_DETAIL_BASES,
  READ_PILEUP_MAX_DISPLAY_READS,
  readFlagLabels,
  readPassesPileupFilters,
  summarizeReadBaseQuality,
  type ReadAlignmentProjection,
  type ReadPileupEntry,
  type ReadPileupOptions,
  type ReadPileupState,
} from "./read-pileup";
import {
  buildEvidenceWindow,
  type SequenceTrack,
  type TrackRead,
} from "./tracks";
import type {
  SequencePaletteId,
  SequenceRecord,
  SequenceSelection,
} from "./types";

export function EvidenceTrackPanel({
  record,
  paletteId = getDefaultSequencePalette(record.molecule),
  referenceRecords,
  readPileupState: controlledState,
  onReadPileupStateChange,
  selection,
  tracks,
  viewport,
}: {
  record: SequenceRecord;
  paletteId?: SequencePaletteId;
  referenceRecords?: ReadonlyArray<SequenceRecord>;
  readPileupState?: ReadPileupState;
  onReadPileupStateChange?: (state: ReadPileupState) => void;
  selection?: SequenceSelection;
  tracks: Array<SequenceTrack>;
  viewport: { end: number; start: number } | null;
}): React.ReactElement | null {
  const [localState, setLocalState] = useState(DEFAULT_READ_PILEUP_STATE);
  const state = controlledState ?? localState;
  const filters = state.options;
  const { showSoftClips, showAllBases, sortBy } = state.options;
  const setState = (next: ReadPileupState): void => {
    if (controlledState == null) setLocalState(next);
    onReadPileupStateChange?.(next);
  };
  const range = resolveEvidenceRange({ record, selection, viewport });
  const evidenceUnavailableReason =
    getEvidenceReferenceUnavailableReason(record);
  const referenceInventory = referenceRecords ?? [record];
  const evidence = useMemo(
    () =>
      tracks.length === 0 || evidenceUnavailableReason != null
        ? null
        : buildEvidenceWindow({
            end: range.end,
            maxReads: READ_PILEUP_MAX_DISPLAY_READS,
            readFilter: (read) => readPassesPileupFilters(read, filters),
            reference: record.sourceLabel,
            referenceRecords: referenceInventory,
            start: range.start,
            tracks,
          }),
    [
      evidenceUnavailableReason,
      filters,
      range.end,
      range.start,
      record.sourceLabel,
      referenceRecords,
      tracks,
    ],
  );
  const entries = useMemo(() => {
    return identifyReadPileupEntries(tracks, evidence?.reads ?? [])
      .map((entry) => ({
        ...entry,
        projection: projectReadAlignment({
          read: entry.read,
          referenceRecord: record,
          referenceSequence: record.sequence,
          range,
        }),
      }))
      .sort((left, right) => {
        if (sortBy === "mapping-quality") {
          const leftQuality =
            left.read.mappingQuality === 255 ? -1 : left.read.mappingQuality;
          const rightQuality =
            right.read.mappingQuality === 255 ? -1 : right.read.mappingQuality;
          return (
            rightQuality - leftQuality ||
            left.read.position - right.read.position
          );
        }
        if (sortBy === "strand" && left.read.strand !== right.read.strand) {
          return left.read.strand === "+" ? -1 : 1;
        }
        return left.read.position - right.read.position;
      });
  }, [evidence, range.end, range.start, record.sequence, sortBy, tracks]);
  if (tracks.length === 0) return null;
  if (evidenceUnavailableReason != null)
    return (
      <section
        aria-label="Loaded evidence tracks"
        className="sequence-evidence rounded-lg border border-token-border bg-token-main-surface-primary p-3"
        data-testid="sequence-evidence-tracks"
      >
        <h2 className="text-xs font-semibold text-token-text-primary">
          Evidence unavailable for edited reference
        </h2>
        <p className="mt-2 text-xs text-token-text-secondary" role="status">
          {evidenceUnavailableReason}
        </p>
        <p className="mt-1 text-[11px] text-token-text-secondary">
          {tracks.length} original-source tracks retained; no absence of reads
          or variants is inferred.
        </p>
      </section>
    );
  if (evidence == null) return null;
  const hasReadTracks = tracks.some((track) => track.kind === "reads");
  const coverage = binReadCoverage(evidence.coverage, 500);
  const maxDepth = Math.max(0, ...coverage.map((bin) => bin.maximumDepth));
  const span = range.end - range.start + 1;
  const detailed = span <= READ_PILEUP_DETAIL_BASES;
  const selectedEntry = resolveSelectedRead(
    tracks,
    state,
    record,
    range,
    referenceInventory,
  );
  const mate =
    selectedEntry == null ? null : findVisibleReadMate(selectedEntry, entries);
  const updateFilter = <Key extends keyof ReadPileupOptions>(
    key: Key,
    value: ReadPileupOptions[Key],
  ): void => {
    setState({ ...state, options: { ...state.options, [key]: value } });
  };
  const selectRead = (entry: ReadPileupEntry): void =>
    setState({
      ...state,
      selectedRead: {
        sourceReadIndex: entry.sourceReadIndex,
        trackId: entry.trackId,
      },
    });
  return (
    <section
      aria-label="Loaded evidence tracks"
      className="sequence-evidence rounded-lg border border-token-border bg-token-main-surface-primary p-3"
      data-testid="sequence-evidence-tracks"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-token-text-primary">
            Evidence tracks
          </h2>
          <p className="text-[11px] text-token-text-secondary">
            {range.start.toLocaleString()}–{range.end.toLocaleString()} ·{" "}
            {evidence.totalReadCount.toLocaleString()} loaded reads ·{" "}
            {evidence.variants.length.toLocaleString()} variants
          </p>
        </div>
        {evidence.sourceTruncated ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
            Partial source · coverage is not extrapolated
          </span>
        ) : null}
      </div>
      {hasReadTracks ? (
        <>
          <div className="sequence-evidence-controls mt-3 flex flex-wrap items-end gap-3 text-xs">
            <label className="flex flex-col gap-1 text-token-text-secondary">
              Minimum MAPQ
              <select
                className="rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1.5 text-token-text-primary"
                onChange={(event) =>
                  updateFilter(
                    "minimumMappingQuality",
                    Number(event.target.value),
                  )
                }
                value={filters.minimumMappingQuality}
              >
                {[
                  ...new Set([
                    0,
                    10,
                    20,
                    30,
                    40,
                    60,
                    filters.minimumMappingQuality,
                  ]),
                ]
                  .sort((left, right) => left - right)
                  .map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Any" : value}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-token-text-secondary">
              Read strand
              <select
                className="rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1.5 text-token-text-primary"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "all" || value === "+" || value === "-")
                    updateFilter("strand", value);
                }}
                value={filters.strand}
              >
                <option value="all">Both strands</option>
                <option value="+">Forward (+)</option>
                <option value="-">Reverse (−)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-token-text-secondary">
              Sort reads
              <select
                className="rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1.5 text-token-text-primary"
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === "position" ||
                    value === "mapping-quality" ||
                    value === "strand"
                  )
                    updateFilter("sortBy", value);
                }}
                value={sortBy}
              >
                <option value="position">Position</option>
                <option value="mapping-quality">Mapping quality</option>
                <option value="strand">Strand</option>
              </select>
            </label>
            <WorkbenchDisclosure
              id="sequence.read-display"
              label="Display & filters"
              className="text-token-text-secondary"
              summaryClassName="cursor-pointer rounded-md px-2 py-1.5"
            >
              <div className="mt-2 grid gap-2 rounded-lg border border-token-border bg-token-main-surface-secondary/30 p-3">
                {(
                  [
                    ["includeDuplicates", "Include duplicate reads"],
                    ["includeQcFailed", "Include QC-failed reads"],
                    ["includeSecondary", "Include secondary alignments"],
                    [
                      "includeSupplementary",
                      "Include supplementary alignments",
                    ],
                    [
                      "includeUnknownMappingQuality",
                      "Include unavailable MAPQ (255)",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label className="flex items-center gap-2" key={key}>
                    <input
                      checked={filters[key]}
                      onChange={(event) =>
                        updateFilter(key, event.target.checked)
                      }
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <input
                    checked={showSoftClips}
                    onChange={(event) =>
                      updateFilter("showSoftClips", event.target.checked)
                    }
                    type="checkbox"
                  />
                  Show soft clips
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={showAllBases}
                    onChange={(event) =>
                      updateFilter("showAllBases", event.target.checked)
                    }
                    type="checkbox"
                  />
                  Show all read bases when zoomed in
                </label>
                <p className="max-w-xs text-[11px]">
                  Filters apply to reads and coverage. MAPQ 255 is unavailable
                  and is included only by its separate setting.
                </p>
              </div>
            </WorkbenchDisclosure>
          </div>
          <div className="mt-3 rounded-md border border-token-border bg-token-main-surface-secondary/20 p-2">
            <div className="mb-1 flex justify-between text-[10px] text-token-text-secondary">
              <span>
                Combined loaded-read base depth
                {span > 500 ? " · maximum per display bin" : ""}
              </span>
              <span>
                max {evidence.coverageComplete ? "" : "observed "}
                {maxDepth.toLocaleString()}×
              </span>
            </div>
            <svg
              aria-label={`Coverage from ${range.start} to ${range.end}`}
              className="h-16 w-full"
              preserveAspectRatio="none"
              role="img"
              viewBox="0 0 1000 64"
            >
              {coverage.map((bin) => (
                <rect
                  data-depth={bin.maximumDepth}
                  fill="currentColor"
                  className="text-slate-500"
                  height={(bin.maximumDepth / Math.max(1, maxDepth)) * 56}
                  key={bin.start}
                  width={((bin.end - bin.start + 1) / span) * 1_000}
                  x={((bin.start - range.start) / span) * 1_000}
                  y={64 - (bin.maximumDepth / Math.max(1, maxDepth)) * 56}
                >
                  <title>
                    {bin.start}–{bin.end}: maximum {bin.maximumDepth}×
                  </title>
                </rect>
              ))}
            </svg>
            <p className="mt-1 text-[10px] text-token-text-secondary">
              Coverage uses all {evidence.coverageReadCount.toLocaleString()}{" "}
              filtered, loaded alignments before display sampling. Deletions and
              reference skips do not contribute.
            </p>
            {!evidence.coverageComplete ? (
              <p
                className="mt-1 text-[11px] text-amber-700 dark:text-amber-300"
                role="status"
              >
                {evidence.sourceTruncated
                  ? `Partial source: ${evidence.sourceReadCount.toLocaleString()} source-reported reads; only loaded reads contribute. `
                  : ""}
                {evidence.coverageOmittedReadCount > 0
                  ? `${evidence.coverageOmittedReadCount.toLocaleString()} reads excluded from coverage because CIGAR is unavailable, invalid, unsupported, or exceeds processing limits.`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-token-text-secondary">
            <span role="status">
              Showing {entries.length.toLocaleString()} of{" "}
              {evidence.filteredReadCount.toLocaleString()} reads passing
              filters
              {entries.length < evidence.filteredReadCount
                ? " · deterministic display sample"
                : ""}
              {evidence.sourceReferenceUncertain
                ? "Reference membership or alias mapping is unresolved; zero observed coverage does not establish absence. "
                : ""}
            </span>
            <span>
              → forward · ← reverse · I insertion · D deletion · dashed skip · S
              soft clip
            </span>
          </div>
          {!detailed ? (
            <p className="mt-1 text-[11px] text-token-text-secondary">
              Select {READ_PILEUP_DETAIL_BASES} bases or fewer to inspect
              mismatches and base qualities.
            </p>
          ) : null}
          {entries.length === 0 ? (
            <p className="py-6 text-center text-xs text-token-text-secondary">
              No loaded reads match this region and these filters.
            </p>
          ) : (
            <div
              className="mt-2 max-h-80 overflow-auto rounded-md border border-token-border"
              aria-label="Reads in view"
            >
              <div className="min-w-[44rem]">
                <div className="sticky top-0 z-10 flex border-b border-token-border bg-token-main-surface-primary text-[10px] text-token-text-secondary">
                  <span className="w-28 shrink-0 px-2 py-1">
                    Source coordinates
                  </span>
                  <span className="flex flex-1 justify-between px-1 py-1">
                    <span>{range.start.toLocaleString()}</span>
                    <span>{range.end.toLocaleString()}</span>
                  </span>
                </div>
                {detailed ? (
                  <div className="flex border-b border-token-border bg-token-main-surface-secondary/30">
                    <span
                      className="w-28 shrink-0 truncate px-2 py-1 text-[10px] text-token-text-secondary"
                      title={record.sourceLabel}
                    >
                      Reference · {record.sourceLabel}
                    </span>
                    <svg
                      aria-label="Selected reference bases"
                      className="h-6 min-w-0 flex-1"
                      preserveAspectRatio="none"
                      role="img"
                      viewBox="0 0 1000 24"
                    >
                      {Array.from({ length: span }, (_, index) => {
                        const base =
                          record.sequence[
                            range.start + index - 1
                          ]?.toUpperCase() ?? "?";
                        const style = getSequenceResidueStyle({
                          molecule: record.molecule,
                          paletteId,
                          residue: base,
                        });
                        return (
                          <g key={index}>
                            <rect
                              fill={style.backgroundColor}
                              height="18"
                              width={1_000 / span}
                              x={(index * 1_000) / span}
                              y="3"
                            />
                            {span <= 80 ? (
                              <text
                                fill={style.color}
                                fontFamily="var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)"
                                fontSize="12"
                                textAnchor="middle"
                                x={((index + 0.5) * 1_000) / span}
                                y="16"
                              >
                                {base}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : null}
                {entries.map((entry) => (
                  <button
                    aria-label={`Inspect read ${entry.read.id}, ${entry.read.position}–${entry.read.end}, ${entry.read.strand === "+" ? "forward" : "reverse"} strand, MAPQ ${mappingQualityLabel(entry.read.mappingQuality)}`}
                    aria-pressed={entry.key === selectedEntry?.key}
                    className={`sequence-evidence-read flex w-full items-center border-b border-token-border/40 text-left last:border-b-0 hover:bg-token-main-surface-secondary focus-visible:outline-2 focus-visible:outline-sky-600 ${entry.key === selectedEntry?.key ? "bg-sky-500/10" : ""}`}
                    key={entry.key}
                    onClick={() => selectRead(entry)}
                    type="button"
                  >
                    <span
                      className="w-28 shrink-0 truncate px-2 py-1 font-mono text-[10px] text-token-text-secondary"
                      title={entry.read.id}
                    >
                      {entry.read.strand === "+" ? "→" : "←"} {entry.read.id}
                    </span>
                    <ReadAlignmentGraphic
                      molecule={record.molecule}
                      paletteId={paletteId}
                      projection={entry.projection}
                      range={range}
                      read={entry.read}
                      showAllBases={showAllBases}
                      showSoftClips={showSoftClips}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedEntry == null ? (
            <p className="mt-2 text-[11px] text-token-text-secondary">
              Select a read to inspect CIGAR, flags, base quality and mate
              information.
            </p>
          ) : (
            <ReadDetails
              entry={selectedEntry}
              mate={mate}
              onClose={() => setState({ ...state, selectedRead: null })}
              onSelectRead={selectRead}
            />
          )}
        </>
      ) : null}
      {evidence.variants.length === 0 ? null : (
        <div
          className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-auto"
          aria-label="Variants in view"
        >
          {evidence.variants.slice(0, 100).map((variant, index) => (
            <span
              className="rounded-full border border-token-border bg-token-main-surface-primary px-2 py-1 text-[10px] text-token-text-secondary"
              key={`${variant.id}-${index}`}
            >
              {variant.position.toLocaleString()} {variant.referenceAllele}→
              {variant.alternateAlleles.join(",") || "."}
            </span>
          ))}
        </div>
      )}
      {evidence.variants.length > 100 ? (
        <p className="mt-1 text-[11px] text-token-text-secondary">
          Showing the first 100 of {evidence.variants.length.toLocaleString()}{" "}
          variants in this region.
        </p>
      ) : null}
    </section>
  );
}

function resolveSelectedRead(
  tracks: Array<SequenceTrack>,
  state: ReadPileupState,
  record: SequenceRecord,
  range: { end: number; start: number },
  referenceRecords: ReadonlyArray<SequenceRecord>,
): (ReadPileupEntry & { projection: ReadAlignmentProjection }) | null {
  if (state.selectedRead == null) return null;
  try {
    const entry = getReadPileupEntryForRecord(
      tracks,
      state.selectedRead,
      record,
      referenceRecords,
    );
    if (
      entry.read.end < range.start ||
      entry.read.position > range.end ||
      !readPassesPileupFilters(entry.read, state.options)
    )
      return null;
    return {
      ...entry,
      projection: projectReadAlignment({
        read: entry.read,
        referenceRecord: record,
        referenceSequence: record.sequence,
        range,
      }),
    };
  } catch {
    // A removed or reloaded track may invalidate a previously selected source index.
    return null;
  }
}

function ReadAlignmentGraphic({
  molecule,
  paletteId,
  projection,
  range,
  read,
  showAllBases,
  showSoftClips,
}: {
  molecule: SequenceRecord["molecule"];
  paletteId: SequencePaletteId;
  projection: ReadAlignmentProjection;
  range: { end: number; start: number };
  read: TrackRead;
  showAllBases: boolean;
  showSoftClips: boolean;
}): React.ReactElement {
  if (projection.unavailableReason != null)
    return (
      <span className="truncate px-2 text-[10px] text-amber-700 dark:text-amber-300">
        CIGAR unavailable · inspect read
      </span>
    );
  const span = range.end - range.start + 1;
  const x = (coordinate: number): number =>
    ((coordinate - range.start) / span) * 1_000;
  const color = read.strand === "+" ? "#64748b" : "#7c6b9a";
  // Legacy ink contrast assumes opaque swatches; quality opacity needs the original outline.
  const themeAwareLettering =
    paletteId === "muted-nucleic-acid" ||
    paletteId === "muted-amino-acid" ||
    paletteId === "neutral";
  return (
    <svg
      aria-hidden="true"
      className="h-6 min-w-0 flex-1"
      preserveAspectRatio="none"
      viewBox="0 0 1000 24"
    >
      {projection.blocks.map((block, index) => {
        const left = x(block.start);
        const right = x(block.end + 1);
        const label = `${block.operation} ${block.start}–${block.end}`;
        if (block.operation === "D" || block.operation === "N")
          return (
            <g data-cigar-operation={block.operation} key={index}>
              <title>
                {label}:{" "}
                {block.operation === "D" ? "deletion" : "reference skip"}, not
                covered bases
              </title>
              <line
                stroke={block.operation === "D" ? "#dc2626" : "#64748b"}
                strokeDasharray={block.operation === "N" ? "4 3" : undefined}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                x1={left}
                x2={right}
                y1="12"
                y2="12"
              />
              {block.operation === "D" && right - left > 12 ? (
                <text
                  fill="currentColor"
                  fontSize="9"
                  textAnchor="middle"
                  x={(left + right) / 2}
                  y="9"
                >
                  D
                </text>
              ) : null}
            </g>
          );
        const arrow = Math.min(5, (right - left) / 3);
        const points =
          read.strand === "+"
            ? `${left},6 ${right - arrow},6 ${right},12 ${right - arrow},18 ${left},18`
            : `${right},6 ${left + arrow},6 ${left},12 ${left + arrow},18 ${right},18`;
        return (
          <polygon
            data-cigar-operation={block.operation}
            fill={read.mappingQuality === 0 ? "none" : color}
            fillOpacity={mappingQualityOpacity(read.mappingQuality)}
            key={index}
            points={points}
            stroke={color}
            strokeOpacity="0.8"
            strokeWidth="0.75"
            vectorEffect="non-scaling-stroke"
          >
            <title>
              {label} · MAPQ {mappingQualityLabel(read.mappingQuality)}
            </title>
          </polygon>
        );
      })}
      {projection.bases
        .filter((base) => showAllBases || base.comparison !== "match")
        .map((base) => {
          const style = getSequenceResidueStyle({
            molecule,
            paletteId,
            residue: base.base,
          });
          return (
            <g data-base-comparison={base.comparison} key={base.coordinate}>
              <title>
                {base.coordinate}: {base.base}, reference{" "}
                {base.referenceBase ?? "unavailable"}; {base.comparison}; base
                quality {base.quality ?? "unavailable"}
              </title>
              <rect
                fill={style.backgroundColor}
                fillOpacity={
                  base.quality == null
                    ? 0.65
                    : Math.min(1, 0.25 + base.quality / 50)
                }
                height="14"
                width={Math.max(0.7, 1_000 / span)}
                x={x(base.coordinate)}
                y="5"
              />
              {span <= 80 ? (
                <text
                  fill={themeAwareLettering ? style.color : "white"}
                  fontFamily="var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)"
                  fontSize="10"
                  paintOrder={themeAwareLettering ? undefined : "stroke"}
                  stroke={themeAwareLettering ? undefined : "#1f2937"}
                  strokeWidth={themeAwareLettering ? undefined : "0.6"}
                  textAnchor="middle"
                  x={x(base.coordinate) + 500 / span}
                  y="15.5"
                >
                  {base.base}
                </text>
              ) : null}
            </g>
          );
        })}
      {projection.markers
        .filter((marker) => showSoftClips || marker.kind !== "soft-clip")
        .map((marker, index) => {
          const position = Math.min(995, Math.max(5, x(marker.anchor)));
          return (
            <g
              data-cigar-operation={marker.kind === "insertion" ? "I" : "S"}
              key={index}
            >
              <title>
                {marker.kind === "insertion"
                  ? "Insertion"
                  : "Unaligned soft clip"}{" "}
                before reference boundary {marker.anchor}: {marker.length} bases
                {marker.sequence === ""
                  ? " (sequence unavailable)"
                  : ` · ${marker.sequence}${marker.sequence.length < marker.length ? "…" : ""}`}
              </title>
              <line
                stroke={marker.kind === "insertion" ? "#9333ea" : "#b45309"}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                x1={position}
                x2={position}
                y1="4"
                y2="20"
              />
              <text
                fill={marker.kind === "insertion" ? "#9333ea" : "#b45309"}
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                x={position}
                y="8"
              >
                {marker.kind === "insertion" ? "I" : "S"}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

function ReadDetails({
  entry,
  mate,
  onClose,
  onSelectRead,
}: {
  entry: ReadPileupEntry & { projection: ReadAlignmentProjection };
  mate: ReadPileupEntry | null;
  onClose: () => void;
  onSelectRead: (entry: ReadPileupEntry) => void;
}): React.ReactElement {
  const { read, projection } = entry;
  const flags = readFlagLabels(read.flags);
  const quality = summarizeReadBaseQuality(read);
  return (
    <aside
      aria-label="Selected read details"
      className="sequence-evidence-details mt-3 rounded-lg border border-token-border bg-token-main-surface-secondary/20 p-3 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate font-mono font-semibold" title={read.id}>
          {read.id}
        </h3>
        <button
          aria-label="Close read details"
          className="rounded px-2 py-1 text-token-text-secondary"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
        <dt className="text-token-text-secondary">Source</dt>
        <dd>
          {entry.trackName} · loaded read index {entry.sourceReadIndex}{" "}
          (0-based)
        </dd>
        <dt className="text-token-text-secondary">Position</dt>
        <dd>
          {read.reference}:{read.position.toLocaleString()}–
          {read.end.toLocaleString()} · 1-based inclusive
        </dd>
        <dt className="text-token-text-secondary">Strand / MAPQ</dt>
        <dd>
          {read.strand === "+" ? "Forward (+)" : "Reverse (−)"} ·{" "}
          {mappingQualityLabel(read.mappingQuality)}
        </dd>
        <dt className="text-token-text-secondary">CIGAR</dt>
        <dd className="break-all font-mono">
          {read.cigar.slice(0, 4_096)}
          {read.cigar.length > 4_096
            ? "… (first 4,096 CIGAR characters shown)"
            : ""}
        </dd>
        <dt className="text-token-text-secondary">Flags</dt>
        <dd>
          {read.flags} · {(read.flags & 0x900) === 0 ? "primary; " : ""}
          {flags.join("; ") || "unpaired"}
        </dd>
        <dt className="text-token-text-secondary">Mean base quality</dt>
        <dd>
          {quality.mean == null
            ? "Unavailable"
            : `Q${quality.mean.toFixed(1)} over ${quality.availableCount.toLocaleString()} available values`}
        </dd>
        {(read.flags & 0x1) !== 0 ? (
          <>
            <dt className="text-token-text-secondary">Mate / template</dt>
            <dd>
              {(read.flags & 0x8) !== 0
                ? "Mate unmapped"
                : read.mateReference != null && read.matePosition != null
                  ? `${read.mateReference}:${read.matePosition.toLocaleString()}`
                  : "Mate position unavailable"}{" "}
              · TLEN {read.insertSize.toLocaleString()}
              {mate == null ? (
                " · no unambiguous mate in the displayed sample"
              ) : (
                <button
                  className="ml-2 rounded border border-token-border px-2 py-0.5 text-token-text-primary"
                  onClick={() => onSelectRead(mate)}
                  type="button"
                >
                  Inspect mate
                </button>
              )}
            </dd>
          </>
        ) : null}
        {projection.hardClippedBases > 0 ? (
          <>
            <dt className="text-token-text-secondary">Hard clipping</dt>
            <dd>
              {projection.hardClippedBases.toLocaleString()} bases not stored in
              SEQ
            </dd>
          </>
        ) : null}
      </dl>
      {projection.unavailableReason == null ? null : (
        <p className="mt-2 text-amber-700 dark:text-amber-300" role="status">
          Read rendering unavailable: {projection.unavailableReason}
        </p>
      )}
      {projection.markers.length === 0 ? null : (
        <div
          className="mt-2 flex flex-wrap gap-2"
          aria-label="Read insertions and clipping"
        >
          {projection.markers.map((marker, index) => (
            <span
              className="rounded border border-token-border px-2 py-1 font-mono text-[10px]"
              key={index}
            >
              {marker.kind === "insertion" ? "I" : "S"} {marker.length} bp ·
              boundary {marker.anchor} ·{" "}
              {marker.sequence || "bases unavailable"}
              {marker.sequence !== "" && marker.sequence.length < marker.length
                ? "…"
                : ""}
            </span>
          ))}
        </div>
      )}
      <WorkbenchDisclosure
        id="sequence.read-base-calls"
        label="Stored read sequence & tags"
        className="mt-2"
        summaryClassName="cursor-pointer text-token-text-secondary"
      >
        <p className="my-1 text-[10px] text-token-text-secondary">
          SAM reference orientation; reverse-strand SEQ is already
          reverse-complemented.{" "}
          {read.sequence.length > 500
            ? `First 500 of ${read.sequence.length.toLocaleString()} bases shown.`
            : ""}
        </p>
        <code className="block break-all font-mono text-[10px]">
          {read.sequence.slice(0, 500) || "Sequence unavailable"}
        </code>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[10px]">
          {Object.entries(read.tags)
            .slice(0, 20)
            .map(([tag, value]) => (
              <div className="contents" key={tag}>
                <dt className="font-mono text-token-text-secondary">{tag}</dt>
                <dd className="break-all">
                  {String(value).slice(0, 200)}
                  {String(value).length > 200 ? "…" : ""}
                </dd>
              </div>
            ))}
        </dl>
        {Object.keys(read.tags).length > 20 ? (
          <p className="text-[10px] text-token-text-secondary">
            First 20 alignment tags shown.
          </p>
        ) : null}
      </WorkbenchDisclosure>
    </aside>
  );
}

export function resolveEvidenceRange({
  record,
  selection,
  viewport,
}: {
  record: SequenceRecord;
  selection?: SequenceSelection;
  viewport: { end: number; start: number } | null;
}): { end: number; start: number } {
  const validViewport =
    viewport != null && viewport.start <= viewport.end ? viewport : null;
  const selectionSegments =
    selection?.recordId === record.id ? getSelectionSegments(selection) : [];
  const selectedSegment =
    selectionSegments.find(
      ({ end, start }) =>
        validViewport != null &&
        end >= validViewport.start &&
        start <= validViewport.end,
    ) ?? selectionSegments[0];
  const requestedRange = selectedSegment ??
    validViewport ?? { end: Math.min(record.length, 1_000), start: 1 };
  const start = Math.min(record.length, Math.max(1, requestedRange.start));
  return {
    end: Math.max(
      start,
      Math.min(record.length, requestedRange.end, start + 99_999),
    ),
    start,
  };
}
