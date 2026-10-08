import { buildAlignedFasta, buildVisibleRangeSvg } from "./msa/exports";
import type { MsaColumnRange, MsaDocument, MsaSequenceRow } from "./msa/types";
import {
  buildFastaExport,
  buildFastqExport,
  buildSelectedSequenceExport,
} from "./sequence/exports";
import {
  extractSelectedSequence,
  getSelectionSegments,
  selectionContainsCoordinate,
  selectionOverlapsFeature,
} from "./sequence/selection";
import type {
  SequenceTrack,
  TrackFeature,
  TrackRead,
  TrackVariant,
} from "./sequence/tracks";
import type {
  SequenceDocument,
  SequenceFeature,
  SequenceRecord,
  SequenceSelection,
} from "./sequence/types";
import { neutralizeSpreadsheetFormula } from "./spreadsheet-safety";

export type WorkbenchExport = {
  content: string;
  format: string;
  mediaType: string;
  name: string;
};

export function exportSequenceWorkbench({
  document,
  format,
  name,
  recordId,
  scope,
  selection,
  tracks = [],
}: {
  document: SequenceDocument;
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
    | "vcf";
  name?: string;
  recordId: string;
  scope: "all" | "selection" | "visible";
  selection?: SequenceSelection;
  tracks?: Array<SequenceTrack>;
}): WorkbenchExport {
  const record =
    document.records.find(({ id }) => id === recordId) ?? document.records[0];
  if (record == null)
    throw new Error("No sequence record is available to export.");
  if (
    scope === "selection" &&
    (selection == null || selection.recordId !== record.id)
  ) {
    throw new Error("A selected export requires a selection on the active record.");
  }
  const baseName = sanitizeFileName(name ?? record.sourceLabel) || "sequence";
  const scopedRecord =
    scope === "selection" && selection != null
      ? projectSelectedSequenceRecord(record, selection)
      : record;
  const scopedRecords = scope === "all" ? document.records : [scopedRecord];
  if (format === "fasta") {
    return {
      content:
        scope === "selection" && selection != null
          ? buildSelectedSequenceExport({ document, selection })
          : buildFastaExport(scopedRecords),
      format,
      mediaType: "text/x-fasta",
      name: `${baseName}.fasta`,
    };
  }
  if (format === "fastq") {
    return {
      content: scopedRecords.map(buildFastqExport).join("\n"),
      format,
      mediaType: "text/x-fastq",
      name: `${baseName}.fastq`,
    };
  }
  if (format === "svg") {
    return {
      content: buildSequenceFigureSvg(
        scopedRecord,
        scope === "selection"
          ? { end: scopedRecord.length, recordId: record.id, start: 1 }
          : selection,
      ),
      format,
      mediaType: "image/svg+xml",
      name: `${baseName}.svg`,
    };
  }
  if (format === "genbank") {
    return {
      content: scopedRecords.map(buildGenBank).join(""),
      format,
      mediaType: "text/x-genbank",
      name: `${baseName}.gb`,
    };
  }
  if (format === "embl") {
    return {
      content: scopedRecords.map(buildEmbl).join(""),
      format,
      mediaType: "text/x-embl",
      name: `${baseName}.embl`,
    };
  }
  const features =
    scope === "selection"
      ? scopedRecord.features
      : featuresInScope(record, selection, scope);
  if (format === "gff3") {
    return {
      content: buildGff3(scopedRecord, features),
      format,
      mediaType: "text/x-gff3",
      name: `${baseName}.gff3`,
    };
  }
  if (format === "gtf") {
    return {
      content: buildGtf(scopedRecord, features),
      format,
      mediaType: "text/x-gtf",
      name: `${baseName}.gtf`,
    };
  }
  if (format === "pdf") {
    return {
      content: buildScientificPdf(`${scopedRecord.sourceLabel} sequence report`, [
        `Molecule: ${scopedRecord.molecule}`,
        `Length: ${scopedRecord.length.toLocaleString()} residues`,
        `Scope: ${scope}`,
        ...(selection == null
          ? []
          : [
              `Selection: ${selection.start}-${selection.end} (1-based inclusive)`,
            ]),
        `Annotations: ${features.length.toLocaleString()}`,
        `Sequence: ${scopedRecord.sequence.slice(0, 120)}`,
      ]),
      format,
      mediaType: "application/pdf",
      name: `${baseName}.pdf`,
    };
  }
  if (format === "bed") {
    return {
      content: buildBed(scopedRecord, features),
      format,
      mediaType: "text/x-bed",
      name: `${baseName}.bed`,
    };
  }
  if (format === "csv" || format === "tsv") {
    const delimiter = format === "csv" ? "," : "\t";
    return {
      content: buildFeatureTable(scopedRecord, features, delimiter),
      format,
      mediaType: format === "csv" ? "text/csv" : "text/tab-separated-values",
      name: `${baseName}.${format}`,
    };
  }
  if (format === "vcf") {
    return {
      content: buildVcf({ record, scope, selection, tracks }),
      format,
      mediaType: "text/x-vcf",
      name: `${baseName}.vcf`,
    };
  }
  const scopedJson = projectSequenceJsonExport({
    document,
    record,
    scope,
    scopedRecord,
    selection,
    tracks,
  });
  return {
    content: JSON.stringify(
      {
        document: scopedJson.document,
        exportedAt: new Date().toISOString(),
        scope,
        selection: selection ?? null,
        tracks: scopedJson.tracks,
      },
      null,
      2,
    ),
    format,
    mediaType: "application/json",
    name: `${baseName}.json`,
  };
}

function projectSelectedSequenceRecord(
  record: SequenceRecord,
  selection: SequenceSelection,
): SequenceRecord {
  let offset = 0;
  const windows = getSelectionSegments(selection).map((segment) => {
    const projected = { ...segment, offset };
    offset += segment.end - segment.start + 1;
    return projected;
  });
  const features = record.features.flatMap((feature) => {
    const sourceSegments = feature.segments ?? [
      { end: feature.end, start: feature.start },
    ];
    const segments = sourceSegments.flatMap((segment) =>
      windows.flatMap((window) => {
        const start = Math.max(segment.start, window.start);
        const end = Math.min(segment.end, window.end);
        return start > end
          ? []
          : [
              {
                ...segment,
                end: window.offset + end - window.start + 1,
                start: window.offset + start - window.start + 1,
              },
            ];
      }),
    );
    if (segments.length === 0) return [];
    const {
      sourceLocation: _sourceLocation,
      translation: _translation,
      translationCoordinateMap: _translationCoordinateMap,
      translationMappingUnavailableReason: _translationMappingUnavailableReason,
      translationSource: _translationSource,
      translationTrackReliable: _translationTrackReliable,
      ...safeFeature
    } = feature;
    return [
      {
        ...safeFeature,
        end: Math.max(...segments.map((segment) => segment.end)),
        qualifiers: Object.fromEntries(
          Object.entries(feature.qualifiers).filter(
            ([key]) => key.toLowerCase() !== "translation",
          ),
        ),
        segments,
        start: Math.min(...segments.map((segment) => segment.start)),
      },
    ];
  });
  const sequence = extractSelectedSequence(record, selection);
  const { chromatogram: _chromatogram, ...sequenceRecord } = record;
  return {
    ...sequenceRecord,
    features,
    length: sequence.length,
    ...(record.quality == null
      ? {}
      : {
          quality: {
            ascii: windows
              .map(({ end, start }) =>
                record.quality?.ascii.slice(start - 1, end),
              )
              .join(""),
            phred: windows.flatMap(({ end, start }) =>
              record.quality?.phred.slice(start - 1, end) ?? [],
            ),
          },
        }),
    sequence,
    topology: "linear",
  };
}

function projectSequenceJsonExport({
  document,
  record,
  scope,
  scopedRecord,
  selection,
  tracks,
}: {
  document: SequenceDocument;
  record: SequenceRecord;
  scope: "all" | "selection" | "visible";
  scopedRecord: SequenceRecord;
  selection?: SequenceSelection;
  tracks: Array<SequenceTrack>;
}): { document: SequenceDocument; tracks: Array<SequenceTrack> } {
  if (scope === "all") return { document, tracks };
  const {
    fastqSummary: _fastqSummary,
    recordInventory: inventory,
    ...documentWithoutAggregates
  } = document;
  return {
    document: {
      ...documentWithoutAggregates,
      ...(inventory == null
        ? {}
        : {
            recordInventory: {
              materializedCount: 1,
              totalCount: 1,
              truncated: false,
            },
          }),
      records: [scopedRecord],
      warnings:
        scope === "selection" && record.chromatogram != null
          ? [
              {
                code: "source-trace-not-carried",
                message:
                  "The source chromatogram and its base-call confidence values were not carried into this subsequence export because its sample coordinates were not remapped. The original source read is unchanged.",
                severity: "warning",
              },
            ]
          : [],
    },
    tracks: tracks.flatMap((track) =>
      projectSequenceTrack({ record, scope, selection, track }),
    ),
  };
}

function projectSequenceTrack({
  record,
  scope,
  selection,
  track,
}: {
  record: SequenceRecord;
  scope: "selection" | "visible";
  selection?: SequenceSelection;
  track: SequenceTrack;
}): Array<SequenceTrack> {
  const matchesReference = (reference: string): boolean =>
    normalizeVariantReference(reference) ===
      normalizeVariantReference(record.sourceLabel) ||
    normalizeVariantReference(reference) ===
      normalizeVariantReference(record.id);
  const inSelection = (coordinate: number): boolean =>
    scope !== "selection" ||
    (selection != null && selectionContainsCoordinate(selection, coordinate));
  const variants = (track.variants ?? []).filter(
    (variant) =>
      matchesReference(variant.reference) && inSelection(variant.position),
  );
  const features = (track.features ?? []).flatMap((feature) => {
    if (!matchesReference(feature.reference)) return [];
    if (scope !== "selection" || selection == null) return [feature];
    return clipTrackFeatureToSelection(feature, selection);
  });
  const reads = (track.reads ?? []).flatMap((read): Array<TrackRead> => {
    if (!matchesReference(read.reference)) return [];
    if (scope !== "selection" || selection == null) return [read];
    if (
      !getSelectionSegments(selection).some(
        ({ end, start }) => read.position >= start && read.end <= end,
      )
    ) {
      return [];
    }
    if (
      read.mateReference == null ||
      (matchesReference(read.mateReference) &&
        read.matePosition != null &&
        inSelection(read.matePosition))
    ) {
      return [read];
    }
    const { matePosition: _matePosition, mateReference: _mateReference, ...safe } =
      read;
    return [safe];
  });
  const items: Array<TrackFeature | TrackRead | TrackVariant> =
    track.kind === "variants"
      ? variants
      : track.kind === "annotations"
        ? features
        : reads;
  if (items.length === 0) return [];
  const {
    features: _features,
    reads: _reads,
    variants: _variants,
    vcfHeader: header,
    ...safeTrack
  } = track;
  const references = [...new Set(items.map((item) => item.reference))];
  return [
    {
      ...safeTrack,
      ...(track.kind === "annotations" ? { features } : {}),
      ...(track.kind === "reads" ? { reads } : {}),
      ...(track.kind === "variants" ? { variants } : {}),
      ...(header == null || track.kind !== "variants"
        ? {}
        : {
            vcfHeader: {
              ...header,
              metaLines: mergeVcfMetadata({
                scope,
                tracks: [track],
                variants: variants.map((variant) => ({ track, variant })),
              }),
            },
          }),
      mapping: {
        matchedReference: references[0] ?? record.sourceLabel,
        requestedReference: record.sourceLabel,
        status: "matched",
        unmatchedReferences: [],
      },
      summary: {
        ...track.summary,
        itemCount: items.length,
        materializedItemCount: items.length,
        references,
      },
    },
  ];
}

function clipTrackFeatureToSelection(
  feature: TrackFeature,
  selection: SequenceSelection,
): Array<TrackFeature> {
  const sourceSegments = feature.segments ?? [
    { end: feature.end, start: feature.start },
  ];
  return getSelectionSegments(selection).flatMap((window) => {
    const intersect = (segment: { end: number; start: number }) => {
      const start = Math.max(segment.start, window.start);
      const end = Math.min(segment.end, window.end);
      return start <= end ? [{ end, start }] : [];
    };
    const segments = sourceSegments.flatMap(intersect);
    if (segments.length === 0) return [];
    return [
      {
        ...feature,
        ...(feature.codingSegments == null
          ? {}
          : { codingSegments: feature.codingSegments.flatMap(intersect) }),
        end: Math.max(...segments.map(({ end }) => end)),
        segments,
        start: Math.min(...segments.map(({ start }) => start)),
      },
    ];
  });
}

function buildSequenceFigureSvg(
  record: SequenceRecord,
  selection: SequenceSelection | undefined,
): string {
  const width = 1_200;
  const featureRows = record.features.slice(0, 2_000);
  const height = Math.max(180, 130 + Math.ceil(featureRows.length / 8) * 18);
  const scale = (coordinate: number): number =>
    40 +
    ((Math.max(1, coordinate) - 1) / Math.max(1, record.length)) * (width - 80);
  const featureShapes = featureRows.flatMap((feature, featureIndex) =>
    (feature.segments ?? [feature]).map((segment) => {
      const x = scale(segment.start);
      const segmentWidth = Math.max(2, scale(segment.end + 1) - x);
      const y =
        92 + Math.floor(featureIndex / 8) * 18 + (featureIndex % 8) * 1.5;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${segmentWidth.toFixed(2)}" height="10" rx="2" fill="${svgFeatureColor(feature.type)}"><title>${escapeXml(feature.label ?? feature.type)} ${segment.start}-${segment.end}</title></rect>`;
    }),
  );
  const selectionShapes =
    selection == null
      ? []
      : (selection.segments ?? [selection]).map((segment) => {
          const x = scale(segment.start);
          return `<rect x="${x.toFixed(2)}" y="54" width="${Math.max(2, scale(segment.end + 1) - x).toFixed(2)}" height="28" fill="#10b981" fill-opacity="0.24" stroke="#059669" stroke-width="2"/>`;
        });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    `<title id="title">${escapeXml(record.sourceLabel)} sequence map</title>`,
    `<desc id="description">Linear one-based inclusive map of ${record.length} residues with ${record.features.length} features.</desc>`,
    `<rect width="100%" height="100%" fill="white"/>`,
    `<text x="40" y="28" font-family="system-ui,sans-serif" font-size="17" font-weight="600" fill="#111827">${escapeXml(record.sourceLabel)}</text>`,
    `<text x="40" y="46" font-family="system-ui,sans-serif" font-size="11" fill="#4b5563">${record.length.toLocaleString()} residues · ${escapeXml(record.molecule)} · 1-based inclusive</text>`,
    `<line x1="40" x2="${width - 40}" y1="68" y2="68" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>`,
    ...selectionShapes,
    ...featureShapes,
    "</svg>",
  ].join("\n");
}

export function exportAlignmentWorkbench({
  document,
  format,
  name,
  newick,
  scope,
  selectedColumns,
  selectedRows = [],
  visibleRows,
}: {
  document: MsaDocument;
  format:
    | "a3m"
    | "aligned-fasta"
    | "clustal"
    | "json"
    | "newick"
    | "pdf"
    | "stockholm"
    | "svg"
    | "tsv";
  name?: string;
  newick?: string | null;
  scope: "all" | "selection" | "visible";
  selectedColumns?: MsaColumnRange | null;
  selectedRows?: Array<string>;
  visibleRows: Array<MsaSequenceRow>;
}): WorkbenchExport {
  const baseName =
    sanitizeFileName(name ?? document.format ?? "alignment") || "alignment";
  const selectedRowIds = new Set(selectedRows);
  const rows =
    scope === "all"
      ? document.rows
      : scope === "selection" && selectedRowIds.size > 0
        ? document.rows.filter(({ id }) => selectedRowIds.has(id))
        : visibleRows;
  const startColumn =
    scope === "selection" && selectedColumns != null
      ? selectedColumns.start
      : 0;
  const endColumn =
    scope === "selection" && selectedColumns != null
      ? selectedColumns.end
      : document.alignedLength;
  const scopedRows = rows.map((row) => ({
    ...row,
    alignedSequence: row.alignedSequence.slice(startColumn, endColumn),
    ...(scope === "all"
      ? {}
      : {
          ungappedLength: row.alignedSequence
            .slice(startColumn, endColumn)
            .replaceAll(/[.\-]/gu, "").length,
        }),
  }));
  if (format === "aligned-fasta") {
    return {
      content: `${buildAlignedFasta(scopedRows)}\n`,
      format,
      mediaType: "text/x-fasta",
      name: `${baseName}.aln-fasta`,
    };
  }
  if (format === "a3m") {
    return {
      content: buildA3m(
        scopedRows,
        document.insertions,
        startColumn,
        endColumn,
      ),
      format,
      mediaType: "text/x-a3m",
      name: `${baseName}.a3m`,
    };
  }
  if (format === "clustal") {
    return {
      content: buildClustal(scopedRows),
      format,
      mediaType: "text/x-clustal",
      name: `${baseName}.aln`,
    };
  }
  if (format === "stockholm") {
    return {
      content: buildStockholm({
        document,
        endColumn,
        rows: scopedRows,
        startColumn,
      }),
      format,
      mediaType: "text/x-stockholm",
      name: `${baseName}.sto`,
    };
  }
  if (format === "pdf") {
    return {
      content: buildScientificPdf("Multiple sequence alignment report", [
        `Rows: ${scopedRows.length.toLocaleString()}`,
        `Columns: ${Math.max(0, endColumn - startColumn).toLocaleString()}`,
        `Scope: ${scope}`,
        ...scopedRows
          .slice(0, 32)
          .map((row) => `${row.label}: ${row.alignedSequence.slice(0, 96)}`),
      ]),
      format,
      mediaType: "application/pdf",
      name: `${baseName}.pdf`,
    };
  }
  if (format === "tsv") {
    return {
      content: [
        "row_id\trow_label\taligned_sequence",
        ...scopedRows.map(
          (row) =>
            `${escapeTsv(row.id)}\t${escapeTsv(row.label)}\t${escapeTsv(row.alignedSequence)}`,
        ),
      ].join("\n"),
      format,
      mediaType: "text/tab-separated-values",
      name: `${baseName}.tsv`,
    };
  }
  if (format === "svg") {
    return {
      content: buildVisibleRangeSvg({
        endColumn,
        rows,
        startColumn,
      }),
      format,
      mediaType: "image/svg+xml",
      name: `${baseName}.svg`,
    };
  }
  if (format === "newick") {
    if (scope !== "all") {
      throw new Error(
        "Newick export requires all scope because guide trees include every alignment row.",
      );
    }
    if (newick == null)
      throw new Error("Compute a guide tree before exporting Newick.");
    return {
      content: `${newick.trim().replace(/;?$/u, ";")}\n`,
      format,
      mediaType: "text/x-newick",
      name: `${baseName}.nwk`,
    };
  }
  return {
    content: JSON.stringify(
      {
        document:
          scope === "all"
            ? document
            : projectAlignmentJsonExport({
                document,
                endColumn,
                rows: scopedRows,
                startColumn,
              }),
        exportedAt: new Date().toISOString(),
        scope,
      },
      null,
      2,
    ),
    format,
    mediaType: "application/json",
    name: `${baseName}.json`,
  };
}

function projectAlignmentJsonExport({
  document,
  endColumn,
  rows,
  startColumn,
}: {
  document: MsaDocument;
  endColumn: number;
  rows: Array<MsaSequenceRow>;
  startColumn: number;
}): MsaDocument {
  const rowIds = new Set(rows.map(({ id }) => id));
  const annotations = document.annotations
    .filter(
      (annotation) =>
        annotation.metadata?.source !== "GR" ||
        (typeof annotation.metadata.rowId === "string" &&
          rowIds.has(annotation.metadata.rowId)),
    )
    .map((annotation) => ({
      ...annotation,
      values: annotation.values.slice(startColumn, endColumn),
    }));
  const insertions = document.insertions
    .filter(
      (insertion) =>
        rowIds.has(insertion.rowId) &&
        insertion.afterAlignmentColumn >= startColumn - 1 &&
        insertion.afterAlignmentColumn < endColumn,
    )
    .map((insertion) => ({
      ...insertion,
      afterAlignmentColumn: insertion.afterAlignmentColumn - startColumn,
      ...(insertion.sourceRowIndex == null
        ? {}
        : {
            sourceRowIndex: rows.findIndex(({ id }) => id === insertion.rowId),
          }),
    }));
  const rnaStructure =
    document.rnaStructure == null
      ? null
      : {
          ...document.rnaStructure,
          motifTracks: document.rnaStructure.motifTracks
            .filter(
              (track) =>
                track.metadata?.source !== "GR" ||
                (typeof track.metadata.rowId === "string" &&
                  rowIds.has(track.metadata.rowId)),
            )
            .map((track) => ({
              ...track,
              values: track.values.slice(startColumn, endColumn),
            })),
          pairs: document.rnaStructure.pairs
            .filter(
              ({ leftColumn, rightColumn }) =>
                leftColumn >= startColumn && rightColumn < endColumn,
            )
            .map((pair) => ({
              ...pair,
              leftColumn: pair.leftColumn - startColumn,
              rightColumn: pair.rightColumn - startColumn,
            })),
          rawStructure: document.rnaStructure.rawStructure.slice(
            startColumn,
            endColumn,
          ),
          ...(document.rnaStructure.referenceTrack == null
            ? {}
            : {
                referenceTrack: document.rnaStructure.referenceTrack.slice(
                  startColumn,
                  endColumn,
                ),
              }),
          warnings: [],
        };
  const residueCount = rows.reduce(
    (count, row) => count + row.alignedSequence.length,
    0,
  );
  const gapCount = rows.reduce(
    (count, row) =>
      count + (row.alignedSequence.match(/[.\-]/gu)?.length ?? 0),
    0,
  );
  return {
    ...document,
    alignedLength: endColumn - startColumn,
    annotations,
    insertions,
    rawSummary: {
      ...document.rawSummary,
      gapFraction: residueCount === 0 ? 0 : gapCount / residueCount,
      maxLabelLength: Math.max(0, ...rows.map(({ label }) => label.length)),
      sequenceCount: rows.length,
      structureTrackCount: annotations.filter(({ kind }) =>
        kind.includes("structure"),
      ).length,
      visibleSequenceCount: rows.filter(({ hidden }) => !hidden).length,
    },
    rnaStructure,
    rows,
    warnings: [],
  };
}

function buildA3m(
  rows: Array<MsaSequenceRow>,
  insertions: MsaDocument["insertions"],
  startColumn: number,
  endColumn: number,
): string {
  const rowInsertions = new Map<string, Map<number, Array<string>>>();
  for (const insertion of insertions) {
    if (
      insertion.afterAlignmentColumn < startColumn - 1 ||
      insertion.afterAlignmentColumn >= endColumn
    ) {
      continue;
    }
    const columns =
      rowInsertions.get(insertion.rowId) ?? new Map<number, Array<string>>();
    const residues = columns.get(insertion.afterAlignmentColumn) ?? [];
    residues.push(insertion.residues.toLowerCase());
    columns.set(insertion.afterAlignmentColumn, residues);
    rowInsertions.set(insertion.rowId, columns);
  }
  return `${rows
    .map((row) => {
      const columns = rowInsertions.get(row.id);
      let sequence = (columns?.get(startColumn - 1) ?? []).join("");
      for (let column = 0; column < row.alignedSequence.length; column += 1) {
        sequence += row.alignedSequence[column]?.toUpperCase() ?? "";
        sequence += (columns?.get(startColumn + column) ?? []).join("");
      }
      const label = safeAlignmentLabel(row.label, row.id);
      const description =
        row.description == null
          ? ""
          : ` ${row.description.replace(/[\r\n]/gu, " ")}`;
      return `>${label}${description}\n${sequence.replace(/\./gu, "-")}`;
    })
    .join("\n")}\n`;
}

function buildClustal(rows: Array<MsaSequenceRow>): string {
  const labels = rows.map((row) => safeAlignmentLabel(row.label, row.id));
  const labelWidth = Math.max(12, ...labels.map((label) => label.length));
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  const blocks = ["CLUSTAL W multiple sequence alignment", ""];
  for (let start = 0; start < alignedLength; start += 60) {
    for (const [index, row] of rows.entries()) {
      blocks.push(
        `${(labels[index] ?? row.id).padEnd(labelWidth)}  ${row.alignedSequence.slice(start, start + 60)}`,
      );
    }
    blocks.push("");
  }
  return `${blocks.join("\n")}\n`;
}

function buildStockholm({
  document,
  endColumn,
  rows,
  startColumn,
}: {
  document: MsaDocument;
  endColumn: number;
  rows: Array<MsaSequenceRow>;
  startColumn: number;
}): string {
  const labels = rows.map((row) => safeAlignmentLabel(row.label, row.id));
  const labelWidth = Math.max(1, ...labels.map((label) => label.length));
  const familyMetadata = Object.entries(document.formatMetadata ?? {}).flatMap(
    ([key, value]) => {
      if (!key.startsWith("GF:")) return [];
      const tag = safeStockholmTag(key.slice(3));
      return splitStockholmMetadata(value).map(
        (entry) => `#=GF ${tag} ${entry}`,
      );
    },
  );
  const rowLines = rows.flatMap((row, index) => {
    const label = labels[index] ?? row.id;
    const rowMetadata = Object.entries(row.metadata ?? {}).flatMap(
      ([key, value]) => {
        if (!key.startsWith("GS:")) return [];
        const tag = safeStockholmTag(key.slice(3));
        return splitStockholmMetadata(value).map(
          (entry) => `#=GS ${label} ${tag} ${entry}`,
        );
      },
    );
    const rowAnnotations = document.annotations.flatMap((annotation) => {
      if (
        annotation.metadata?.source !== "GR" ||
        annotation.metadata.rowId !== row.id
      ) {
        return [];
      }
      const tag = safeStockholmTag(
        String(annotation.metadata.tag ?? annotation.label),
      );
      return [
        `#=GR ${label} ${tag} ${sliceStockholmAnnotation(
          annotation.values,
          startColumn,
          endColumn,
          annotation.label,
        )}`,
      ];
    });
    return [
      ...rowMetadata,
      `${label.padEnd(labelWidth)} ${row.alignedSequence}`,
      ...rowAnnotations,
    ];
  });
  const columnAnnotations = document.annotations.flatMap((annotation) => {
    if (annotation.metadata?.source !== "GC") return [];
    const tag = safeStockholmTag(
      String(annotation.metadata.tag ?? annotation.label),
    );
    return [
      `#=GC ${tag} ${sliceStockholmAnnotation(
        annotation.values,
        startColumn,
        endColumn,
        annotation.label,
      )}`,
    ];
  });
  return [
    "# STOCKHOLM 1.0",
    ...familyMetadata,
    ...rowLines,
    ...columnAnnotations,
    "//",
    "",
  ].join("\n");
}

function splitStockholmMetadata(value: string): Array<string> {
  return value
    .split(" | ")
    .map((entry) => entry.replaceAll(/[\r\n]+/gu, " ").trim())
    .filter((entry) => entry.length > 0);
}

function safeStockholmTag(value: string): string {
  return value.replaceAll(/[\s\r\n]+/gu, "_") || "annotation";
}

function sliceStockholmAnnotation(
  value: string,
  startColumn: number,
  endColumn: number,
  label: string,
): string {
  if (value.length < endColumn) {
    throw new Error(
      `Stockholm annotation ${label} does not cover the exported alignment columns.`,
    );
  }
  return value.slice(startColumn, endColumn);
}

function safeAlignmentLabel(label: string, fallback: string): string {
  return (
    label.replace(/[\s\r\n]+/gu, "_") || fallback.replace(/[\s\r\n]+/gu, "_")
  );
}

function buildScientificPdf(title: string, lines: Array<string>): string {
  const safe = (value: string) =>
    value.replace(/[^\x20-\x7e]/gu, "?").replace(/[\\()]/gu, "\\$&");
  const visibleLines = [title, ...lines].slice(0, 45);
  const stream = [
    "BT",
    "/F1 12 Tf",
    "50 790 Td",
    "15 TL",
    ...visibleLines.map(
      (line, index) =>
        `${index === 0 ? "" : "T* "}(${safe(line.slice(0, 140))}) Tj`,
    ),
    "ET",
  ].join("\n");
  const encoder = new TextEncoder();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${encoder.encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
}

function buildGenBank(record: SequenceRecord): string {
  const locus = record.sourceLabel.slice(0, 16) || "SEQUENCE";
  const topology = record.topology === "circular" ? "circular" : "linear";
  const molecule =
    record.molecule === "protein"
      ? "PROTEIN"
      : record.molecule === "rna"
        ? "RNA"
        : "DNA";
  const unit = record.molecule === "protein" ? "aa" : "bp";
  const featureLines = record.features.flatMap((feature) => [
    `     ${feature.type.padEnd(15)} ${formatFeatureLocation(feature)}`,
    ...Object.entries(feature.qualifiers).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        (item) => `                     /${key}="${escapeQualifier(item)}"`,
      ),
    ),
  ]);
  const origin = wrap(record.sequence.toLowerCase(), 60).map((line, index) => {
    const groups = line.match(/.{1,10}/gu)?.join(" ") ?? line;
    return `${String(index * 60 + 1).padStart(9)} ${groups}`;
  });
  return [
    `LOCUS       ${locus.padEnd(16)} ${String(record.length).padStart(11)} ${unit} ${molecule.padEnd(7)} ${topology}`,
    `DEFINITION  ${record.description ?? record.sourceLabel}.`,
    `ACCESSION   ${record.sourceLabel}`,
    "FEATURES             Location/Qualifiers",
    ...featureLines,
    "ORIGIN",
    ...origin,
    "//",
    "",
  ].join("\n");
}

function buildEmbl(record: SequenceRecord): string {
  const molecule =
    record.molecule === "protein"
      ? "PROTEIN"
      : record.molecule === "rna"
        ? "RNA"
        : "DNA";
  const unit = record.molecule === "protein" ? "AA" : "BP";
  const featureLines = record.features.flatMap((feature) => [
    `FT   ${feature.type.padEnd(15)} ${formatFeatureLocation(feature)}`,
    ...Object.entries(feature.qualifiers).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        (item) => `FT                   /${key}="${escapeQualifier(item)}"`,
      ),
    ),
  ]);
  const sequenceLines = wrap(record.sequence.toLowerCase(), 60).map(
    (line, index) =>
      `     ${line.match(/.{1,10}/gu)?.join(" ") ?? line} ${Math.min(record.length, (index + 1) * 60)}`,
  );
  return [
    `ID   ${record.sourceLabel}; SV 1; ${record.topology === "circular" ? "circular" : "linear"}; ${molecule}; UNC; ${record.length} ${unit}.`,
    `AC   ${record.sourceLabel};`,
    `DE   ${record.description ?? record.sourceLabel}`,
    "FH   Key             Location/Qualifiers",
    "FH",
    ...featureLines,
    `SQ   Sequence ${record.length} ${unit};`,
    ...sequenceLines,
    "//",
    "",
  ].join("\n");
}

function buildGff3(
  record: SequenceRecord,
  features: Array<SequenceFeature>,
): string {
  const rows = features.flatMap((feature) =>
    (feature.segments ?? [{ end: feature.end, start: feature.start }]).map(
      (segment, index) =>
        [
          record.sourceLabel,
          "sequence-viewer",
          feature.type,
          segment.start,
          segment.end,
          ".",
          feature.strand,
          ".",
          [
            `ID=${encodeURIComponent(feature.id)}${index === 0 ? "" : `.${index + 1}`}`,
            feature.label == null
              ? null
              : `Name=${encodeURIComponent(feature.label)}`,
            ...Object.entries(feature.qualifiers).map(
              ([key, value]) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(
                  (Array.isArray(value) ? value : [value]).join(","),
                )}`,
            ),
          ]
            .filter(Boolean)
            .join(";"),
        ].join("\t"),
    ),
  );
  return ["##gff-version 3", ...rows, ""].join("\n");
}

function buildGtf(
  record: SequenceRecord,
  features: Array<SequenceFeature>,
): string {
  const escapeGtf = (value: string): string =>
    value
      .replace(/\\/gu, "\\\\")
      .replace(/"/gu, '\\"')
      .replace(/[\r\n]/gu, " ");
  const firstQualifier = (
    feature: SequenceFeature,
    key: string,
  ): string | null => {
    const value = feature.qualifiers[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };
  const lines = features.flatMap((feature) => {
    const segments = feature.segments ?? [
      { end: feature.end, start: feature.start },
    ];
    const segmentPhases = getGtfSegmentPhases(feature, segments);
    return segments.map((segment, segmentIndex) => {
      const geneId =
        firstQualifier(feature, "gene_id") ??
        firstQualifier(feature, "gene") ??
        firstQualifier(feature, "locus_tag") ??
        feature.id;
      const transcriptId =
        firstQualifier(feature, "transcript_id") ?? feature.id;
      const attributes = [
        `gene_id "${escapeGtf(geneId)}"`,
        `transcript_id "${escapeGtf(transcriptId)}"`,
        ...(feature.label == null
          ? []
          : [`gene_name "${escapeGtf(feature.label)}"`]),
      ].join("; ");
      return [
        record.sourceLabel,
        "sequence-viewer",
        feature.type,
        segment.start,
        segment.end,
        ".",
        feature.strand,
        segmentPhases[segmentIndex] ?? ".",
        `${attributes};`,
      ].join("\t");
    });
  });
  return `${lines.join("\n")}\n`;
}

function getGtfSegmentPhases(
  feature: SequenceFeature,
  segments: ReadonlyArray<{ end: number; start: number }>,
): Array<string> {
  if (feature.type.toLowerCase() !== "cds") {
    return segments.map(() => ".");
  }
  const qualifierCodonStart = feature.qualifiers.codon_start;
  const qualifierPhase = feature.qualifiers.gtf_phase;
  const rawCodonStart =
    feature.codonStart ??
    Number(
      Array.isArray(qualifierCodonStart)
        ? qualifierCodonStart[0]
        : qualifierCodonStart,
    );
  const rawPhase = Number(
    Array.isArray(qualifierPhase) ? qualifierPhase[0] : qualifierPhase,
  );
  let phase =
    rawCodonStart === 2 || rawCodonStart === 3
      ? rawCodonStart - 1
      : rawPhase === 1 || rawPhase === 2
        ? rawPhase
        : 0;
  const phases = segments.map(() => "0");
  // Feature locations already store segments in biological transcript order,
  // including reverse-strand complement(join(...)) locations.
  for (const [index, segment] of segments.entries()) {
    phases[index] = String(phase);
    const translatedBases = segment.end - segment.start + 1 - phase;
    phase = (3 - (translatedBases % 3)) % 3;
  }
  return phases;
}

function buildBed(
  record: SequenceRecord,
  features: Array<SequenceFeature>,
): string {
  return `${features
    .flatMap((feature) =>
      (feature.segments ?? [{ end: feature.end, start: feature.start }]).map(
        (segment) =>
          [
            record.sourceLabel,
            segment.start - 1,
            segment.end,
            feature.label ?? feature.id,
            0,
            feature.strand,
          ].join("\t"),
      ),
    )
    .join("\n")}\n`;
}

function buildFeatureTable(
  record: SequenceRecord,
  features: Array<SequenceFeature>,
  delimiter: string,
): string {
  const rows = features.map((feature) =>
    [
      record.sourceLabel,
      feature.id,
      feature.type,
      feature.label ?? "",
      feature.start,
      feature.end,
      feature.strand,
      JSON.stringify(feature.qualifiers),
    ]
      .map((value) => quoteDelimited(String(value), delimiter))
      .join(delimiter),
  );
  return [
    [
      "record",
      "feature_id",
      "type",
      "label",
      "start_1_based_inclusive",
      "end_1_based_inclusive",
      "strand",
      "qualifiers_json",
    ].join(delimiter),
    ...rows,
    "",
  ].join("\n");
}

function buildVcf({
  record,
  scope,
  selection,
  tracks,
}: {
  record: SequenceRecord;
  scope: "all" | "selection" | "visible";
  selection?: SequenceSelection;
  tracks: Array<SequenceTrack>;
}): string {
  const matchesActiveReference = (reference: string): boolean =>
    normalizeVariantReference(reference) ===
      normalizeVariantReference(record.sourceLabel) ||
    normalizeVariantReference(reference) ===
      normalizeVariantReference(record.id);
  const variantIsInScope = (variant: NonNullable<SequenceTrack["variants"]>[number]): boolean => {
    if (scope === "all") return true;
    if (!matchesActiveReference(variant.reference)) return false;
    if (scope !== "selection" || selection == null) return true;
    return (
      selection.recordId === record.id &&
      selectionContainsCoordinate(selection, variant.position)
    );
  };
  const variantTracks = tracks.filter(
    (track) =>
      track.kind === "variants" &&
      (scope === "all" ||
        (track.variants ?? []).some(variantIsInScope)),
  );
  const variants = variantTracks.flatMap((track) =>
    (track.variants ?? [])
      .filter(variantIsInScope)
      .map((variant) => ({ track, variant })),
  );
  const metadata = mergeVcfMetadata({ scope, tracks: variantTracks, variants });
  const sampleNames = [
    ...new Set(
      variantTracks.flatMap((track) =>
        track.vcfHeader?.sampleNames.length
          ? track.vcfHeader.sampleNames
          : (track.variants ?? []).flatMap((variant) =>
              Object.keys(variant.samples),
            ),
      ),
    ),
  ];
  const includeFormat =
    sampleNames.length > 0 ||
    variantTracks.some(
      (track) =>
        track.vcfHeader?.columns[8] === "FORMAT" ||
        (track.variants ?? []).some((variant) => variant.format != null),
    );
  const rows = variants.map(({ track, variant }) => {
    const fields = [
      variant.reference,
      String(variant.position),
      variant.rawId ?? variant.id,
      variant.referenceAllele,
      variant.alternateAlleles.join(",") || ".",
      variant.rawQuality ?? String(variant.quality ?? "."),
      variant.rawFilter ?? (variant.filters.join(";") || "PASS"),
      variant.rawInfo ??
        (Object.entries(variant.info)
          .map(([key, value]) => (value === true ? key : `${key}=${value}`))
          .join(";") || "."),
    ];
    if (includeFormat) {
      fields.push(variant.format ?? ".");
      for (const sampleName of sampleNames) {
        const originalIndex =
          track.vcfHeader?.sampleNames.indexOf(sampleName) ?? -1;
        fields.push(
          (originalIndex < 0
            ? undefined
            : variant.sampleValues?.[originalIndex]) ??
            variant.samples[sampleName] ??
            ".",
        );
      }
    }
    return fields.join("\t");
  });
  const columns = [
    "#CHROM",
    "POS",
    "ID",
    "REF",
    "ALT",
    "QUAL",
    "FILTER",
    "INFO",
    ...(includeFormat ? ["FORMAT", ...sampleNames] : []),
  ];
  return [
    ...metadata,
    columns.join("\t"),
    ...rows,
    "",
  ].join("\n");
}

function mergeVcfMetadata({
  scope,
  tracks,
  variants,
}: {
  scope: "all" | "selection" | "visible";
  tracks: Array<SequenceTrack>;
  variants: Array<{
    track: SequenceTrack;
    variant: NonNullable<SequenceTrack["variants"]>[number];
  }>;
}): Array<string> {
  const lines = tracks.flatMap((track) => track.vcfHeader?.metaLines ?? []);
  const fileFormat =
    lines.find((line) => line.startsWith("##fileformat=")) ??
    "##fileformat=VCFv4.3";
  const references = new Set(
    variants.map(({ variant }) => normalizeVariantReference(variant.reference)),
  );
  const filters = new Set(
    variants.flatMap(({ variant }) =>
      variant.rawFilter == null
        ? variant.filters
        : variant.rawFilter === "." || variant.rawFilter === "PASS"
          ? []
          : variant.rawFilter.split(";"),
    ),
  );
  const info = new Set(
    variants.flatMap(({ variant }) => Object.keys(variant.info)),
  );
  const formats = new Set(
    variants.flatMap(({ variant }) => variant.format?.split(":") ?? []),
  );
  const alternateAlleles = new Set(
    variants.flatMap(({ variant }) =>
      variant.alternateAlleles.flatMap((allele) => {
        const symbolic = /^<([^>]+)>$/u.exec(allele);
        return symbolic?.[1] == null ? [] : [symbolic[1]];
      }),
    ),
  );
  const neededMetadata = (line: string): boolean => {
    if (scope === "all") return true;
    const definition =
      /^##(contig|FILTER|INFO|FORMAT|ALT)=<ID=([^,>]+)/u.exec(line);
    if (definition == null) return true;
    const [, kind, id] = definition;
    if (id == null) return false;
    if (kind === "contig") return references.has(normalizeVariantReference(id));
    if (kind === "FILTER") return filters.has(id);
    if (kind === "INFO") return info.has(id);
    if (kind === "FORMAT") return formats.has(id);
    return alternateAlleles.has(id);
  };
  return [
    fileFormat,
    ...new Set(
      lines.filter(
        (line) => !line.startsWith("##fileformat=") && neededMetadata(line),
      ),
    ),
  ];
}

function normalizeVariantReference(reference: string): string {
  return reference.toLowerCase().replace(/^chr/u, "");
}

function formatFeatureLocation(feature: SequenceFeature): string {
  const segments = feature.segments ?? [
    { end: feature.end, start: feature.start },
  ];
  const body =
    segments.length === 1
      ? formatSegment(segments[0])
      : `join(${segments.map(formatSegment).join(",")})`;
  return feature.strand === "-" ? `complement(${body})` : body;
}

function formatSegment(
  segment: NonNullable<SequenceFeature["segments"]>[number] | undefined,
): string {
  if (segment == null) return "1..1";
  const prefix = segment.remoteAccession ? `${segment.remoteAccession}:` : "";
  return `${prefix}${segment.partialStart ? "<" : ""}${segment.start}..${
    segment.partialEnd ? ">" : ""
  }${segment.end}`;
}

function featuresInScope(
  record: SequenceRecord,
  selection: SequenceSelection | undefined,
  scope: "all" | "selection" | "visible",
): Array<SequenceFeature> {
  if (scope !== "selection" || selection == null) return record.features;
  return record.features.filter((feature) =>
    selectionOverlapsFeature(selection, feature),
  );
}

function wrap(value: string, width: number): Array<string> {
  const lines: Array<string> = [];
  for (let index = 0; index < value.length; index += width) {
    lines.push(value.slice(index, index + width));
  }
  return lines;
}

function sanitizeFileName(value: string): string {
  return value
    .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
}

function escapeQualifier(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeTsv(value: string): string {
  return neutralizeSpreadsheetFormula(
    value.replaceAll(/[\t\r\n]+/gu, " "),
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svgFeatureColor(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "cds") return "#2563eb";
  if (normalized.includes("gene")) return "#7c3aed";
  if (normalized.includes("promoter")) return "#d97706";
  if (normalized.includes("repeat")) return "#db2777";
  return "#0d9488";
}

function quoteDelimited(value: string, delimiter: string): string {
  const safeValue = neutralizeSpreadsheetFormula(value);
  return safeValue.includes(delimiter) || /["\r\n]/u.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue;
}
