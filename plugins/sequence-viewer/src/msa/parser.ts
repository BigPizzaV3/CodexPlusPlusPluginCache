import { inferCdsContext } from "./codon";
import {
  assertTextWithinInputBudget,
  SEQUENCE_VIEWER_LIMITS,
} from "../runtime-contract";
import { getMsaFormatHint } from "./file-kind";
import { parseA2mA3m } from "./formats/a2m-a3m";
import { parseAlignedFasta } from "./formats/aligned-fasta";
import { parseClustal } from "./formats/clustal";
import { parseMsf } from "./formats/msf";
import { parseNexus } from "./formats/nexus";
import { parsePhylip } from "./formats/phylip";
import { parsePir } from "./formats/pir";
import { parseStockholm } from "./formats/stockholm";
import { inferMsaMoleculeType } from "./molecule-inference";
import {
  classifyResidue,
  countUngappedResidues,
  isGapSymbol,
} from "./residue-alphabet";
import { parseRnaStructureTrack } from "./rna-structure";
import type {
  MsaDocument,
  MsaFormat,
  MsaFormatDraft,
  MsaInsertionRun,
  MsaMoleculeType,
  MsaParseResult,
  MsaParseWarning,
  MsaSequenceRow,
} from "./types";

type DetectedMsaFormat = {
  format: MsaFormat;
};

const extensionFormat = new Map<string, MsaFormat>([
  ["a2m", "a2m"],
  ["a3m", "a3m"],
  ["afa", "aligned-fasta"],
  ["afasta", "aligned-fasta"],
  ["aln-fasta", "aligned-fasta"],
  ["fa", "aligned-fasta"],
  ["faa", "aligned-fasta"],
  ["fas", "aligned-fasta"],
  ["fasta", "aligned-fasta"],
  ["fna", "aligned-fasta"],
  ["mfa", "aligned-fasta"],
  ["aln", "clustal"],
  ["clustal", "clustal"],
  ["clw", "clustal"],
  ["msf", "msf"],
  ["nex", "nexus"],
  ["nexus", "nexus"],
  ["phy", "phylip"],
  ["phylip", "phylip"],
  ["pir", "pir"],
  ["stk", "stockholm"],
  ["sto", "stockholm"],
  ["stockholm", "stockholm"],
]);

function detectMsaFormat(
  contents: string,
  filePath?: string,
): DetectedMsaFormat | null {
  const trimmed = contents.trimStart();
  if (/^# STOCKHOLM 1\.0\b/.test(trimmed)) {
    return { format: "stockholm" };
  }
  if (/^(CLUSTAL|MUSCLE)\b/i.test(trimmed)) {
    return { format: "clustal" };
  }
  if (/^#NEXUS\b/i.test(trimmed)) {
    return { format: "nexus" };
  }
  if (/^>[^;\n]*;/.test(trimmed)) {
    return { format: "pir" };
  }
  if (/\bMSF:\s*\d+/i.test(trimmed) || /\n\s*\/\/\s*\n/.test(contents)) {
    return { format: "msf" };
  }

  const hint = getMsaFormatHint(filePath);
  const hintedFormat = hint == null ? null : extensionFormat.get(hint);
  if (trimmed.startsWith(">")) {
    // FASTA records are a stronger content signal than ambiguous suffixes such
    // as `.aln`, which are used by both CLUSTAL-family outputs and aligned
    // FASTA exports in the wild. Keep extension-driven profile/PIR parsing
    // where the outer syntax is intentionally FASTA-like but semantically
    // richer.
    if (
      hintedFormat === "a2m" ||
      hintedFormat === "a3m" ||
      hintedFormat === "pir"
    ) {
      return { format: hintedFormat };
    }
    return { format: "aligned-fasta" };
  }
  if (hintedFormat != null) {
    return { format: hintedFormat };
  }

  if (/^\s*\d+\s+\d+\s*(?:\r?\n|$)/.test(trimmed)) {
    return { format: "phylip" };
  }
  return null;
}

function parseDraft(
  detected: DetectedMsaFormat,
  contents: string,
): MsaFormatDraft {
  switch (detected.format) {
    case "a2m":
    case "a3m":
      return parseA2mA3m(contents, detected.format);
    case "aligned-fasta":
      return parseAlignedFasta(contents);
    case "clustal":
      return parseClustal(contents);
    case "msf":
      return parseMsf(contents);
    case "nexus":
      return parseNexus(contents);
    case "phylip":
      return parsePhylip(contents);
    case "pir":
      return parsePir(contents);
    case "stockholm":
      return parseStockholm(contents);
  }
}

function normalizeRows(
  draft: MsaFormatDraft,
  warnings: Array<MsaParseWarning>,
): Array<MsaSequenceRow> {
  const sourceIds = draft.rows.map(
    (row, index) => row.id || `sequence-${index + 1}`,
  );
  const totalBySourceId = new Map<string, number>();
  for (const sourceId of sourceIds) {
    totalBySourceId.set(sourceId, (totalBySourceId.get(sourceId) ?? 0) + 1);
  }
  const occurrenceBySourceId = new Map<string, number>();
  return draft.rows.map((row, index) => {
    const sourceId = sourceIds[index] ?? `sequence-${index + 1}`;
    const duplicateSourceLabelCount = totalBySourceId.get(sourceId) ?? 1;
    const duplicateSourceLabelIndex =
      (occurrenceBySourceId.get(sourceId) ?? 0) + 1;
    occurrenceBySourceId.set(sourceId, duplicateSourceLabelIndex);
    if (duplicateSourceLabelCount > 1 && duplicateSourceLabelIndex === 2) {
      warnings.push({
        code: "duplicate-sequence-id",
        message: `Sequence ID ${sourceId} appears more than once. Viewer state uses unique internal row IDs while preserving the source label.`,
        preserved: "preserved",
        severity: "warning",
      });
    }
    const alignedSequence = row.alignedSequence;
    const internalId =
      duplicateSourceLabelCount === 1
        ? sourceId
        : `${sourceId}__${duplicateSourceLabelIndex}`;
    return {
      ...row,
      ...(duplicateSourceLabelCount > 1
        ? {
            duplicateSourceLabelCount,
            duplicateSourceLabelIndex,
          }
        : {}),
      id: internalId,
      label: row.label || sourceId,
      sourceId,
      ungappedLength: countUngappedResidues(alignedSequence),
    };
  });
}

function normalizeInsertions({
  insertions,
  rows,
}: {
  insertions: Array<MsaInsertionRun>;
  rows: Array<MsaSequenceRow>;
}): Array<MsaInsertionRun> {
  return insertions.map((insertion) => {
    const indexedRow =
      insertion.sourceRowIndex == null
        ? null
        : rows[insertion.sourceRowIndex] ?? null;
    const fallbackRow =
      indexedRow ??
      rows.find((row) => row.sourceId === insertion.rowId) ??
      null;
    return fallbackRow == null
      ? insertion
      : { ...insertion, rowId: fallbackRow.id };
  });
}

function getWidthError(rows: Array<MsaSequenceRow>): string | null {
  const width = rows[0]?.alignedSequence.length;
  if (width == null) {
    return null;
  }
  return rows.some((row) => row.alignedSequence.length !== width)
    ? "Alignment rows do not share a common display width."
    : null;
}

function getAmbiguityFraction(
  rows: Array<MsaSequenceRow>,
  moleculeType: MsaMoleculeType,
): number {
  let ambiguity = 0;
  let residues = 0;
  for (const row of rows) {
    for (const symbol of row.alignedSequence) {
      if (isGapSymbol(symbol)) {
        continue;
      }
      residues += 1;
      const residueClass = classifyResidue(symbol, moleculeType);
      if (
        residueClass === "ambiguous-amino-acid" ||
        residueClass === "ambiguous-nucleotide" ||
        residueClass === "unknown"
      ) {
        ambiguity += 1;
      }
    }
  }
  return residues === 0 ? 0 : ambiguity / residues;
}

function getGapFraction(rows: Array<MsaSequenceRow>): number {
  let gaps = 0;
  let total = 0;
  for (const row of rows) {
    for (const symbol of row.alignedSequence) {
      total += 1;
      if (isGapSymbol(symbol)) {
        gaps += 1;
      }
    }
  }
  return total === 0 ? 0 : gaps / total;
}

function buildDocument(
  draft: MsaFormatDraft,
  rows: Array<MsaSequenceRow>,
  warnings: Array<MsaParseWarning>,
): MsaDocument {
  const annotations = draft.annotations ?? [];
  const molecule = inferMsaMoleculeType({
    annotations,
    format: draft.format,
    rows,
  });
  warnings.push(
    ...molecule.warnings.map((message) => ({
      code: "molecule-inference-warning",
      message,
    })),
  );
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  const rnaStructure = parseRnaStructureTrack({ annotations });
  if (rnaStructure != null) {
    warnings.push(
      ...rnaStructure.warnings.map((message) => ({
        code: "rna-structure-warning",
        message,
      })),
    );
  }
  const cdsContext = inferCdsContext({
    alignedLength,
    moleculeType: molecule.moleculeType,
    rows,
  });
  const nucleicAcid =
    molecule.moleculeType === "dna" ||
    molecule.moleculeType === "rna" ||
    molecule.moleculeType === "nucleic-acid-ambiguous";
  return {
    alignedLength,
    annotations,
    cdsContext,
    consensusPolicy: {
      ambiguityPolicy: "iupac-cover-threshold",
      gapPolicy: "exclude-gaps-from-threshold",
      threshold: 0.7,
    },
    displayInterpretation: {
      moleculeType: molecule.moleculeType,
      source: "inferred",
    },
    format: draft.format,
    ...(draft.metadata == null ? {} : { formatMetadata: draft.metadata }),
    insertions: normalizeInsertions({
      insertions: draft.insertions ?? [],
      rows,
    }),
    molecule,
    rawSummary: {
      ambiguityFraction: getAmbiguityFraction(rows, molecule.moleculeType),
      gapFraction: getGapFraction(rows),
      maxLabelLength: Math.max(0, ...rows.map((row) => row.label.length)),
      sequenceCount: rows.length,
      structureTrackCount: annotations.filter((track) =>
        track.kind.startsWith("rna-"),
      ).length,
      visibleSequenceCount: rows.filter((row) => !row.hidden).length,
    },
    rnaStructure,
    rows,
    searchCapabilities: {
      motifSearch: rows.length > 0,
      rowLabelSearch: true,
      supportsAmbiguousNucleotideCodes: nucleicAcid,
      supportsProteinAmbiguityCodes: molecule.moleculeType === "protein",
      supportsReverseComplement: nucleicAcid,
    },
    warnings,
  };
}

export function parseMsa(contents: string, filePath?: string): MsaParseResult {
  try {
    assertTextWithinInputBudget(contents);
    const normalized = contents.replaceAll(/\r\n?/g, "\n");
    const detected = detectMsaFormat(normalized, filePath);
    if (detected == null) {
      return {
        message: "Codex could not determine a supported MSA text format.",
        status: "error",
        warnings: [],
      };
    }
    const draft = parseDraft(detected, normalized);
    const warnings = [...(draft.warnings ?? [])];
    const rows = normalizeRows(draft, warnings);
    if (rows.length === 0) {
      return {
        message: "No alignment rows were parsed from this file.",
        status: "error",
        warnings,
      };
    }
    if (rows.length > SEQUENCE_VIEWER_LIMITS.input.maxMsaRows) {
      return {
        message: `This alignment contains ${rows.length.toLocaleString()} rows; the bounded viewer accepts at most ${SEQUENCE_VIEWER_LIMITS.input.maxMsaRows.toLocaleString()}. Create a smaller subset and reopen it.`,
        status: "error",
        warnings: warnings.concat({
          code: "msa-row-limit-exceeded",
          message: "Alignment row safety limit exceeded.",
          severity: "error",
        }),
      };
    }
    const widthError = getWidthError(rows);
    if (widthError != null) {
      return { message: widthError, status: "error", warnings };
    }
    const alignedLength = rows[0]?.alignedSequence.length ?? 0;
    if (alignedLength === 0) {
      return {
        message: "The alignment rows do not contain any residues or gaps.",
        status: "error",
        warnings: warnings.concat({
          code: "msa-empty-alignment",
          message: "The alignment rows do not contain any residues or gaps.",
          severity: "error",
        }),
      };
    }
    const cellCount = rows.length * alignedLength;
    if (cellCount > SEQUENCE_VIEWER_LIMITS.input.maxMsaCells) {
      return {
        message: `This alignment contains ${cellCount.toLocaleString()} cells; the bounded viewer accepts at most ${SEQUENCE_VIEWER_LIMITS.input.maxMsaCells.toLocaleString()}. Create a smaller subset and reopen it.`,
        status: "error",
        warnings: warnings.concat({
          code: "msa-cell-limit-exceeded",
          message: "Alignment cell safety limit exceeded.",
          severity: "error",
        }),
      };
    }
    for (const annotation of draft.annotations ?? []) {
      if (annotation.values.length !== alignedLength) {
        warnings.push({
          code: "msa-annotation-width-mismatch",
          message: `${annotation.label} has width ${annotation.values.length}, but alignment rows have width ${alignedLength}.`,
          severity: "error",
        });
      }
    }
    const fatal = warnings.find(({ severity }) => severity === "error");
    if (fatal != null) {
      return { message: fatal.message, status: "error", warnings };
    }
    return {
      document: buildDocument(draft, rows, warnings),
      status: "success",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The alignment could not be parsed.";
    return {
      message,
      status: "error",
      warnings: [{ code: "msa-parse-failed", message, severity: "error" }],
    };
  }
}
