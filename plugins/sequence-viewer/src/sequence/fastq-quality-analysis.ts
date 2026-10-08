import {
  analyzeScientificSequenceQcRecords,
  type ScientificSequenceQcRecord,
} from "@openai/scientific-viewer-platform/sequence/scientific-sequence-qc";

import type { SequenceDocument } from "./types";

export const FASTQ_QUALITY_REPORT_LIMITS = Object.freeze({
  maxAdapterBases: 64,
  maxAnalyzedBases: 100_000,
  maxAnalyzedReads: 1_000,
  maxConsideredReads: 5_000,
  maxCycleBins: 80,
  maxHistogramBins: 40,
  maxPatterns: 6,
  maxReadLength: 10_000,
  maxStructuredReportBytes: 48 * 1_024,
});

export const FASTQ_QUALITY_REPORT_METHODS = Object.freeze({
  adapter:
    "Local, contiguous forward-strand matching of your supplied sequence only (U is treated as T). No partial matches, mismatches or reverse-complement screen. A match alone does not establish adapter contamination.",
  baseComposition:
    "Percentage of observed bases; T and U are grouped together.",
  cycleQuality:
    "Mean Phred score with the observed minimum–maximum range; not quartiles.",
  cycleGrouping:
    "Adjacent-cycle groups use base-count-weighted means and the observed minimum and maximum. Table values describe the same groups.",
  disclaimer:
    "This is a descriptive, bounded report, not a FastQC run. No automatic pass/fail thresholds, contamination identification or library-complexity estimate are applied.",
  gc: "GC per read, rounded to 1%. Denominator: A, C, G, T and U only; ambiguous bases are excluded.",
  kmers:
    "Observed pattern frequency, not a statistical enrichment or contamination call.",
  kmerCounting:
    "Top six of the repeated overlapping A/C/G/T 7-mers. U is treated as T; windows with ambiguous bases are skipped. Fractions use all counted 7-mer windows, not reads.",
  kmerFractionDenominator:
    "all-counted-overlapping-canonical-7-mer-windows" as const,
  meanReadQuality:
    "Arithmetic mean of each read’s Phred scores, rounded to the nearest integer; not Phred of the mean error probability.",
  qualityEncoding: "phred+33-assumed" as const,
  repeatedSequences:
    "Complete forward-read sequences are compared exactly, without reverse-complement matching.",
  repeatedSequenceFractionDenominator: "analyzed-reads" as const,
  sampling: "first-eligible-retained-reads" as const,
});

export const FASTQ_QUALITY_TABLE_IDS = [
  "cycle-quality",
  "cycle-composition",
  "read-length",
  "read-gc",
  "read-mean-quality",
  "repeated-sequences",
  "frequent-kmers",
] as const;

export type FastqQualityTableId = (typeof FASTQ_QUALITY_TABLE_IDS)[number];

export type FastqQualityViewState = {
  distributionsExpanded: boolean;
  expandedTables: Array<FastqQualityTableId>;
  methodsExpanded: boolean;
};

export const DEFAULT_FASTQ_QUALITY_VIEW_STATE =
  Object.freeze<FastqQualityViewState>({
    distributionsExpanded: false,
    expandedTables: ["repeated-sequences", "frequent-kmers"],
    methodsExpanded: false,
  });

export function createFastqQualityViewState(): FastqQualityViewState {
  return {
    ...DEFAULT_FASTQ_QUALITY_VIEW_STATE,
    expandedTables: [...DEFAULT_FASTQ_QUALITY_VIEW_STATE.expandedTables],
  };
}

type ScientificQcResult = Awaited<
  ReturnType<typeof analyzeScientificSequenceQcRecords>
>;

export type FastqQualityReport = {
  adapterSequence: string | null;
  duplicateReadCount: number;
  frequentSequences: Array<{
    count: number;
    fraction: number;
    sequence: string;
  }>;
  meanReadQualityDistribution: Array<{ count: number; value: number }>;
  qc: ScientificQcResult;
  scope: {
    analyzedBases: number;
    analyzedReads: number;
    consideredReads: number;
    isSubset: boolean;
    missingQualityReads: number;
    oversizedReads: number;
    populationReads: number;
    retainedReads: number;
  };
  uniqueSequenceCount: number;
};

export type FastqCycleBin = {
  bases: {
    A: number;
    C: number;
    G: number;
    N: number;
    other: number;
    T: number;
  };
  count: number;
  end: number;
  maximum: number;
  mean: number;
  minimum: number;
  start: number;
};

export type FastqDistributionBin = {
  count: number;
  end: number;
  start: number;
};

export type FastqQualityReportSummary = ReturnType<
  typeof summarizeFastqQualityReport
>;

export type FastqQualityReportState = {
  adapterSequence: string | null;
  error?: string;
  jobId: string;
  pending: boolean;
  report: FastqQualityReportSummary | null;
};

/** Detailed QC uses only complete, quality-bearing retained reads, never a cut read. */
export async function analyzeFastqQualityReport(
  document: SequenceDocument,
  {
    adapterSequence,
    isCancelled,
    signal,
  }: {
    adapterSequence?: string;
    isCancelled?: () => boolean;
    signal?: AbortSignal;
  } = {},
): Promise<FastqQualityReport> {
  const throwIfCancelled = (): void => {
    signal?.throwIfAborted();
    if (isCancelled?.())
      throw new DOMException("Quality report cancelled.", "AbortError");
  };
  if (document.format !== "fastq") {
    throw new Error("A detailed quality report requires FASTQ reads.");
  }
  const adapter = parseFastqAdapterSequence(adapterSequence);
  const records: Array<ScientificSequenceQcRecord> = [];
  let analyzedBases = 0;
  let consideredReads = 0;
  let missingQualityReads = 0;
  let oversizedReads = 0;
  for (const record of document.records) {
    throwIfCancelled();
    if (
      consideredReads >= FASTQ_QUALITY_REPORT_LIMITS.maxConsideredReads ||
      records.length >= FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads
    ) {
      break;
    }
    consideredReads += 1;
    if (record.quality == null) {
      missingQualityReads += 1;
      continue;
    }
    if (record.quality.ascii.length !== record.sequence.length) {
      throw new Error(
        "FASTQ quality length does not match the complete read sequence.",
      );
    }
    if (record.sequence.length > FASTQ_QUALITY_REPORT_LIMITS.maxReadLength) {
      oversizedReads += 1;
      continue;
    }
    if (
      analyzedBases + record.sequence.length >
      FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedBases
    ) {
      break;
    }
    records.push({
      id: record.id,
      quality: record.quality.ascii,
      sequence: record.sequence,
    });
    analyzedBases += record.sequence.length;
  }
  if (records.length === 0) {
    throw new Error(
      "No retained reads have complete qualities within the 10,000-base per-read report limit. Aggregate statistics above remain available.",
    );
  }

  const sequenceCounts = new Map<string, number>();
  const meanQualities = new Map<number, number>();
  async function* reportRecords(): AsyncGenerator<ScientificSequenceQcRecord> {
    let basesSinceYield = 0;
    for (const record of records) {
      throwIfCancelled();
      const sequence = record.sequence.toUpperCase();
      sequenceCounts.set(sequence, (sequenceCounts.get(sequence) ?? 0) + 1);
      let qualitySum = 0;
      const quality = record.quality ?? "";
      for (let index = 0; index < quality.length; index += 1) {
        qualitySum += quality.charCodeAt(index) - 33;
      }
      // The chart bins the arithmetic mean of Phred scores to the nearest integer.
      const meanQuality = Math.round(qualitySum / quality.length);
      meanQualities.set(meanQuality, (meanQualities.get(meanQuality) ?? 0) + 1);
      yield record;
      basesSinceYield += sequence.length;
      if (basesSinceYield >= 10_000) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        throwIfCancelled();
        basesSinceYield = 0;
      }
    }
  }

  const qc = await analyzeScientificSequenceQcRecords({
    adapters:
      adapter == null ? [] : [{ id: "user-supplied", sequence: adapter }],
    budget: {
      maxAdapterBases: FASTQ_QUALITY_REPORT_LIMITS.maxAdapterBases,
      maxAdapters: 1,
      maxCycles: FASTQ_QUALITY_REPORT_LIMITS.maxReadLength,
      maxDistinctKmers: 4 ** 7,
      maxInputRecords: FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads,
      maxKmerLength: 7,
      maxOverrepresentedKmers: 4 ** 7,
      maxRecords: FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads,
      maxTotalBases: FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedBases,
      maxUniqueSequences: FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads,
    },
    format: "fastq",
    // Show observed frequent patterns, without inventing enrichment thresholds.
    kmer: { length: 7, minCount: 2, minFraction: 0 },
    qualityEncoding: "phred+33",
    records: reportRecords(),
  });
  throwIfCancelled();
  const populationReads =
    document.fastqSummary?.readCount ??
    document.recordInventory?.totalCount ??
    document.records.length;
  return {
    adapterSequence: adapter,
    duplicateReadCount: qc.recordsAnalyzed - sequenceCounts.size,
    frequentSequences: [...sequenceCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort(
        ([leftSequence, leftCount], [rightSequence, rightCount]) =>
          rightCount - leftCount || leftSequence.localeCompare(rightSequence),
      )
      .slice(0, FASTQ_QUALITY_REPORT_LIMITS.maxPatterns)
      .map(([sequence, count]) => ({
        count,
        fraction: count / qc.recordsAnalyzed,
        sequence,
      })),
    meanReadQualityDistribution: [...meanQualities.entries()]
      .map(([value, count]) => ({ count, value }))
      .sort((left, right) => left.value - right.value),
    qc,
    scope: {
      analyzedBases,
      analyzedReads: qc.recordsAnalyzed,
      consideredReads,
      isSubset:
        qc.recordsAnalyzed !== populationReads ||
        document.recordInventory?.truncated === true,
      missingQualityReads,
      oversizedReads,
      populationReads,
      retainedReads: document.records.length,
    },
    uniqueSequenceCount: sequenceCounts.size,
  };
}

/** The model and UI receive the same bounded data, with no full read sequences. */
export function summarizeFastqQualityReport(report: FastqQualityReport) {
  const { scope } = report;
  const summary = {
    analysis: "quality-report" as const,
    adapter: report.qc.adapters[0] ?? null,
    adapterSequence: report.adapterSequence,
    cycleBins: groupFastqQualityCycles(report.qc.cycles),
    duplicateReadCount: report.duplicateReadCount,
    frequentKmers: report.qc.overrepresentedKmers.slice(
      0,
      FASTQ_QUALITY_REPORT_LIMITS.maxPatterns,
    ),
    frequentSequences: report.frequentSequences
      .slice(0, FASTQ_QUALITY_REPORT_LIMITS.maxPatterns)
      .map(({ count, fraction, sequence }) => ({
        count,
        fraction,
        sequenceLength: sequence.length,
        sequencePreview:
          sequence.length <= 48
            ? sequence
            : `${sequence.slice(0, 32)}…${sequence.slice(-12)}`,
        sequenceTruncated: sequence.length > 48,
      })),
    gcBins: groupFastqDistribution(
      report.qc.gcDistribution.flatMap(({ count, percent }) =>
        percent == null ? [] : [{ count, value: percent }],
      ),
    ),
    lengthBins: groupFastqDistribution(
      report.qc.lengthDistribution.map(({ count, length }) => ({
        count,
        value: length,
      })),
    ),
    limits: FASTQ_QUALITY_REPORT_LIMITS,
    meanQualityBins: groupFastqDistribution(report.meanReadQualityDistribution),
    methods: FASTQ_QUALITY_REPORT_METHODS,
    scope: {
      ...scope,
      description:
        `Analyzed ${scope.analyzedReads.toLocaleString()} of ${scope.populationReads.toLocaleString()} parsed reads · ${scope.analyzedBases.toLocaleString()} bases.` +
        (scope.isSubset
          ? ` First eligible retained reads in source order, not a random sample (${scope.retainedReads.toLocaleString()} reads retained for inspection). These charts do not establish whole-file QC.`
          : " All parsed reads are represented in this profile."),
      label: scope.isSubset ? "Retained-read subset" : "All parsed reads",
    },
    undefinedGcReadCount:
      report.qc.gcDistribution.find(({ percent }) => percent == null)?.count ??
      0,
    uniqueSequenceCount: report.uniqueSequenceCount,
  };
  if (
    new TextEncoder().encode(JSON.stringify(summary)).byteLength >
    FASTQ_QUALITY_REPORT_LIMITS.maxStructuredReportBytes
  ) {
    throw new Error("The quality report exceeds its structured-output budget.");
  }
  return summary;
}

export function groupFastqQualityCycles(
  cycles: ScientificQcResult["cycles"],
): Array<FastqCycleBin> {
  const width = Math.max(
    1,
    Math.ceil(cycles.length / FASTQ_QUALITY_REPORT_LIMITS.maxCycleBins),
  );
  const bins: Array<FastqCycleBin> = [];
  for (let offset = 0; offset < cycles.length; offset += width) {
    const selected = cycles.slice(offset, offset + width);
    const first = selected[0];
    const last = selected.at(-1);
    if (first == null || last == null) continue;
    const bin: FastqCycleBin = {
      bases: { A: 0, C: 0, G: 0, N: 0, other: 0, T: 0 },
      count: 0,
      end: last.cycle1,
      maximum: 0,
      mean: 0,
      minimum: 93,
      start: first.cycle1,
    };
    let qualitySum = 0;
    for (const cycle of selected) {
      bin.bases.A += cycle.bases.A;
      bin.bases.C += cycle.bases.C;
      bin.bases.G += cycle.bases.G;
      bin.bases.N += cycle.bases.N;
      bin.bases.T += cycle.bases.T + cycle.bases.U;
      bin.bases.other +=
        cycle.bases.ambiguous + cycle.bases.gap + cycle.bases.other;
      if (cycle.quality != null) {
        bin.count += cycle.quality.count;
        bin.maximum = Math.max(bin.maximum, cycle.quality.max);
        bin.minimum = Math.min(bin.minimum, cycle.quality.min);
        qualitySum += cycle.quality.sum;
      }
    }
    bin.mean = bin.count === 0 ? 0 : qualitySum / bin.count;
    bins.push(bin);
  }
  return bins;
}

/** Equal-width bins preserve every observation, including sparse empty intervals. */
export function groupFastqDistribution(
  points: ReadonlyArray<{ count: number; value: number }>,
): Array<FastqDistributionBin> {
  if (points.length === 0) return [];
  let minimum = points[0]!.value;
  let maximum = minimum;
  for (const { value } of points) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const width = Math.max(
    1,
    Math.ceil(
      (maximum - minimum + 1) / FASTQ_QUALITY_REPORT_LIMITS.maxHistogramBins,
    ),
  );
  const bins = Array.from(
    { length: Math.floor((maximum - minimum) / width) + 1 },
    (_, index) => ({
      count: 0,
      end: Math.min(maximum, minimum + (index + 1) * width - 1),
      start: minimum + index * width,
    }),
  );
  for (const { count, value } of points) {
    const bin = bins[Math.floor((value - minimum) / width)];
    if (bin != null) bin.count += count;
  }
  return bins;
}

export function parseFastqAdapterSequence(sequence?: string): string | null {
  if (sequence == null || sequence.trim().length === 0) return null;
  if (sequence.length > 256) {
    throw new Error("Supply one adapter sequence of 8–64 A/C/G/T bases.");
  }
  const normalized = sequence.replaceAll(/\s/gu, "").toUpperCase();
  if (!/^[ACGT]{8,64}$/u.test(normalized)) {
    throw new Error("Supply one adapter sequence of 8–64 A/C/G/T bases.");
  }
  return normalized;
}
