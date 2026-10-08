import {
  computeNucleotideConsensus,
  computeProteinRepresentative,
} from "./consensus";
import {
  computeColumnSummaries,
  getConservationProvenance,
  getMeanIdentity,
  getMeanNormalizedConservation,
  type MsaColumnSummary,
} from "./conservation";
import {
  buildUngappedProjection,
  type UngappedProjection,
} from "./coordinate-map";
import { expandNucleotideSymbol, isGapSymbol } from "./residue-alphabet";
import type {
  MsaDocument,
  MsaInsertionRun,
  MsaMetricProvenance,
  MsaRnaPair,
  MsaRnaStructureConsensus,
  MsaRowMetrics,
  MsaSequenceRow,
} from "./types";

export type MsaOverviewBucket = {
  /** Maximum occupancy preserves narrow gap spikes in the overview. */
  gapFraction: number;
  /** Minimum identity preserves narrow divergence spikes in the overview. */
  identity: number;
  meanGapFraction: number;
  meanIdentity: number;
};

export type MsaRowProjection = UngappedProjection & {
  rowId: string;
  rowLabel: string;
};

export type MsaDerivedAnalysis = {
  analysisId: string;
  consensusSequence: string;
  insertionByRowColumn: Record<
    string,
    Record<string, MsaInsertionRun | undefined> | undefined
  >;
  meanConservationNormalized: number | null;
  meanIdentity: number;
  metricProvenance: {
    conservation: MsaMetricProvenance | null;
  };
  mismatchDensityByColumn: Array<number | null>;
  overviewBuckets: Array<MsaOverviewBucket>;
  pairByColumn: Record<string, MsaRnaPair | undefined>;
  projections: Array<MsaRowProjection>;
  rnaStructureConsensusByColumn: Record<
    string,
    MsaRnaStructureConsensus | undefined
  >;
  rowMetricsById: Record<string, MsaRowMetrics | undefined>;
  summaries: Array<MsaColumnSummary>;
};

export type MsaAnalysisRequest = {
  analysisId: string;
  analysisRowIds: Array<string>;
  document: MsaDocument;
};

export function computeMsaDerivedAnalysis({
  analysisId,
  analysisRowIds,
  document,
}: MsaAnalysisRequest): MsaDerivedAnalysis {
  const scopedRowIds = new Set(analysisRowIds);
  const scopedRows = document.rows.filter(
    (row) => scopedRowIds.has(row.id) && !row.hidden,
  );
  const rowsForAnalysis = scopedRows;
  const moleculeType = document.displayInterpretation.moleculeType;
  const summaries = computeColumnSummaries(rowsForAnalysis, moleculeType);
  const consensusSequence =
    moleculeType === "protein"
      ? computeProteinRepresentative(rowsForAnalysis)
      : computeNucleotideConsensus(
          rowsForAnalysis,
          moleculeType,
          document.consensusPolicy.threshold,
        );
  return {
    analysisId,
    consensusSequence,
    insertionByRowColumn: indexInsertions(document.insertions),
    meanConservationNormalized: getMeanNormalizedConservation(summaries),
    meanIdentity: getMeanIdentity(summaries),
    metricProvenance: {
      conservation: getConservationProvenance(moleculeType),
    },
    mismatchDensityByColumn: computeMismatchDensityByColumn(
      rowsForAnalysis,
      consensusSequence,
    ),
    overviewBuckets: buildOverviewBuckets(summaries, document.alignedLength),
    pairByColumn: indexRnaPairs(document.rnaStructure?.pairs ?? []),
    projections: buildMsaRowProjections(
      document.rows.filter((row) => !row.hidden),
    ),
    rnaStructureConsensusByColumn: computeRnaStructureConsensusByColumn({
      pairs: document.rnaStructure?.pairs ?? [],
      rows: rowsForAnalysis,
    }),
    rowMetricsById: indexRowMetrics(
      computeRowMetrics(document.rows, consensusSequence),
    ),
    summaries,
  };
}

export function buildOverviewBuckets(
  summaries: Array<MsaColumnSummary>,
  alignedLength: number,
): Array<MsaOverviewBucket> {
  const bucketCount = Math.max(1, Math.min(80, alignedLength));
  return Array.from({ length: bucketCount }, (_, bucket) => {
    const start = Math.floor((bucket / bucketCount) * alignedLength);
    const end = Math.max(
      start + 1,
      Math.floor(((bucket + 1) / bucketCount) * alignedLength),
    );
    const bucketSummaries = summaries.slice(start, end);
    const count = bucketSummaries.length;
    return {
      gapFraction:
        count === 0
          ? 0
          : Math.max(...bucketSummaries.map(({ gapFraction }) => gapFraction)),
      identity:
        count === 0
          ? 0
          : Math.min(...bucketSummaries.map(({ identity }) => identity)),
      meanGapFraction:
        count === 0
          ? 0
          : bucketSummaries.reduce(
              (total, { gapFraction }) => total + gapFraction,
              0,
            ) / count,
      meanIdentity:
        count === 0
          ? 0
          : bucketSummaries.reduce(
              (total, { identity }) => total + identity,
              0,
            ) / count,
    };
  });
}

export function buildMsaRowProjections(
  rows: Array<MsaSequenceRow>,
): Array<MsaRowProjection> {
  return rows.map((row) => ({
    ...buildUngappedProjection(row.alignedSequence),
    rowId: row.id,
    rowLabel: row.label,
  }));
}

export function computeRowMetrics(
  rows: Array<MsaSequenceRow>,
  referenceSequence: string | null,
): Array<MsaRowMetrics> {
  return rows.map((row) => {
    if (referenceSequence == null) {
      return {
        coverageToReference: null,
        identityToReference: null,
        mismatchCountToReference: null,
        rowId: row.id,
        ungappedLength: row.ungappedLength,
      };
    }
    let alignedReferenceResidues = 0;
    let comparedResidues = 0;
    let matches = 0;
    let mismatches = 0;
    for (
      let column = 0;
      column < Math.max(referenceSequence.length, row.alignedSequence.length);
      column += 1
    ) {
      const reference = referenceSequence[column] ?? "-";
      const symbol = row.alignedSequence[column] ?? "-";
      if (!isGapSymbol(reference)) {
        alignedReferenceResidues += 1;
      }
      if (isGapSymbol(reference) || isGapSymbol(symbol)) {
        continue;
      }
      comparedResidues += 1;
      if (symbol.toUpperCase() === reference.toUpperCase()) {
        matches += 1;
      } else {
        mismatches += 1;
      }
    }
    return {
      coverageToReference:
        alignedReferenceResidues === 0
          ? null
          : comparedResidues / alignedReferenceResidues,
      identityToReference:
        comparedResidues === 0 ? null : matches / comparedResidues,
      mismatchCountToReference: mismatches,
      rowId: row.id,
      ungappedLength: row.ungappedLength,
    };
  });
}

function computeMismatchDensityByColumn(
  rows: Array<MsaSequenceRow>,
  referenceSequence: string | null,
): Array<number | null> {
  const alignedLength =
    referenceSequence?.length ?? rows[0]?.alignedSequence.length ?? 0;
  return Array.from({ length: alignedLength }, (_, column) => {
    const reference = referenceSequence?.[column];
    if (reference == null || isGapSymbol(reference)) {
      return null;
    }
    let comparedRows = 0;
    let mismatchedRows = 0;
    for (const row of rows) {
      const symbol = row.alignedSequence[column] ?? "-";
      comparedRows += 1;
      if (symbol.toUpperCase() !== reference.toUpperCase()) {
        mismatchedRows += 1;
      }
    }
    return comparedRows === 0 ? null : mismatchedRows / comparedRows;
  });
}

function computeRnaStructureConsensusByColumn({
  pairs,
  rows,
}: {
  pairs: Array<MsaRnaPair>;
  rows: Array<MsaSequenceRow>;
}): MsaDerivedAnalysis["rnaStructureConsensusByColumn"] {
  const consensusByColumn: MsaDerivedAnalysis["rnaStructureConsensusByColumn"] =
    {};
  if (rows.length === 0) {
    return consensusByColumn;
  }
  for (const pair of pairs) {
    let gapCount = 0;
    let invalidCount = 0;
    let watsonCrickCount = 0;
    let wobbleCount = 0;
    for (const row of rows) {
      const left = row.alignedSequence[pair.leftColumn] ?? "-";
      const right = row.alignedSequence[pair.rightColumn] ?? "-";
      if (isGapSymbol(left) || isGapSymbol(right)) {
        gapCount += 1;
        continue;
      }
      const pairFractions = classifyPairFractions(left, right);
      watsonCrickCount += pairFractions.watsonCrick;
      wobbleCount += pairFractions.wobble;
      invalidCount += pairFractions.invalid;
    }
    const totalRows = rows.length;
    const summary: MsaRnaStructureConsensus = {
      gapFraction: gapCount / totalRows,
      invalidFraction: invalidCount / totalRows,
      leftColumn: pair.leftColumn,
      rightColumn: pair.rightColumn,
      validPairFraction: (watsonCrickCount + wobbleCount) / totalRows,
      watsonCrickFraction: watsonCrickCount / totalRows,
      wobbleFraction: wobbleCount / totalRows,
    };
    consensusByColumn[String(pair.leftColumn)] = summary;
    consensusByColumn[String(pair.rightColumn)] = summary;
  }
  return consensusByColumn;
}

function classifyPairFractions(
  left: string,
  right: string,
): { invalid: number; watsonCrick: number; wobble: number } {
  const leftBases = normalizePairBases(left);
  const rightBases = normalizePairBases(right);
  if (leftBases.length === 0 || rightBases.length === 0) {
    return { invalid: 1, watsonCrick: 0, wobble: 0 };
  }
  const combinationWeight = 1 / (leftBases.length * rightBases.length);
  let invalid = 0;
  let watsonCrick = 0;
  let wobble = 0;
  for (const leftBase of leftBases) {
    for (const rightBase of rightBases) {
      const pair = `${leftBase}${rightBase}`;
      if (["AU", "UA", "CG", "GC"].includes(pair)) {
        watsonCrick += combinationWeight;
      } else if (["GU", "UG"].includes(pair)) {
        wobble += combinationWeight;
      } else {
        invalid += combinationWeight;
      }
    }
  }
  return { invalid, watsonCrick, wobble };
}

function normalizePairBases(symbol: string): Array<string> {
  return [...expandNucleotideSymbol(symbol)]
    .map((base) => (base === "T" ? "U" : base))
    .filter(
      (base, index, bases) =>
        ["A", "C", "G", "U"].includes(base) && bases.indexOf(base) === index,
    );
}

function indexInsertions(
  insertions: Array<MsaInsertionRun>,
): MsaDerivedAnalysis["insertionByRowColumn"] {
  const byRow: MsaDerivedAnalysis["insertionByRowColumn"] = {};
  for (const insertion of insertions) {
    const rowInsertions = byRow[insertion.rowId] ?? {};
    rowInsertions[String(insertion.afterAlignmentColumn)] = insertion;
    byRow[insertion.rowId] = rowInsertions;
  }
  return byRow;
}

function indexRnaPairs(
  pairs: Array<MsaRnaPair>,
): MsaDerivedAnalysis["pairByColumn"] {
  const pairByColumn: MsaDerivedAnalysis["pairByColumn"] = {};
  for (const pair of pairs) {
    pairByColumn[String(pair.leftColumn)] = pair;
    pairByColumn[String(pair.rightColumn)] = pair;
  }
  return pairByColumn;
}

function indexRowMetrics(
  metrics: Array<MsaRowMetrics>,
): MsaDerivedAnalysis["rowMetricsById"] {
  return Object.fromEntries(metrics.map((metric) => [metric.rowId, metric]));
}
