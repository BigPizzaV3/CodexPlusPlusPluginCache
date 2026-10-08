import {
  classifySequenceArtifact,
  isRnaSecondaryStructureAnnotation,
} from "./biological-sequence-artifact-classifier";
import type { IndexedSequenceEnvelope } from "./indexed-sequence-envelope";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { makeUniqueSequenceRecords } from "./sequence/formats/fasta";
import { inferSequenceMolecule } from "./sequence/molecule-inference";
import { decodeFastqQuality } from "./sequence/quality";
import type {
  FastqSummary,
  SequenceDocument,
  SequenceParseWarning,
} from "./sequence/types";

const MAX_FASTA_MATERIALIZED_BASES =
  SEQUENCE_VIEWER_LIMITS.input.retainedFastaBases;
const MAX_OVERSIZED_RECORD_PREVIEW_BASES =
  SEQUENCE_VIEWER_LIMITS.input.retainedFastaBases;
const PROGRESS_INTERVAL_BYTES = 1 * 1_024 * 1_024;

export type IndexedSequenceProgress = {
  decodedBytes: number;
  materializedBases: number;
  recordCount: number;
};

export async function parseIndexedSequenceLines({
  compressed,
  fileName,
  format,
  lines,
  maxDecodedBytes = SEQUENCE_VIEWER_LIMITS.input.maxTextBytes,
  onProgress,
  signal,
  sourceBytes,
  sourceVersion = `size-${sourceBytes}`,
}: {
  compressed: boolean;
  fileName: string;
  format: "fasta" | "fastq";
  lines: AsyncIterable<string>;
  maxDecodedBytes?: number;
  onProgress?: (progress: IndexedSequenceProgress) => void;
  signal?: AbortSignal;
  sourceBytes: number;
  sourceVersion?: string;
}): Promise<IndexedSequenceEnvelope> {
  const progress = createProgress(onProgress, signal, maxDecodedBytes);
  const document =
    format === "fasta"
      ? await parseFastaLines(lines, fileName, progress)
      : await parseFastqLines(lines, fileName, progress);
  const fatal = document.warnings.find(({ severity }) => severity === "error");
  if (fatal != null) throw new Error(fatal.message);
  if (document.records.length === 0) {
    throw new Error(
      "No biological sequence records were parsed from this file.",
    );
  }
  progress.publish(true);
  return {
    document,
    index: {
      complete: true,
      compressed,
      decodedBytes: progress.decodedBytes,
      indexedRecordCount:
        document.recordInventory?.totalCount ?? document.records.length,
      materializedBases: document.records.reduce(
        (sum, record) => sum + record.length,
        0,
      ),
      materializedRecordCount: document.records.length,
      sourceBytes,
      sourceVersion,
    },
    schemaVersion: 1,
  };
}

async function parseFastaLines(
  lines: AsyncIterable<string>,
  fileName: string,
  progress: ProgressTracker,
): Promise<SequenceDocument> {
  const retained: Array<{
    description?: string;
    fullLength: number;
    sequence: string;
    sourceLabel: string;
    truncated: boolean;
  }> = [];
  const warnings: Array<SequenceParseWarning> = [];
  let active:
    | {
        description?: string;
        fullLength: number;
        prefix: Array<string>;
        prefixLength: number;
        sourceLabel: string;
      }
    | undefined;
  let recordCount = 0;
  let materializedBases = 0;
  let lineNumber = 0;
  const flush = (): void => {
    if (active == null) return;
    recordCount += 1;
    if (recordCount > SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords) {
      throw new Error(
        `Indexed FASTA supports at most ${SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords.toLocaleString()} records.`,
      );
    }
    progress.setRecordCount(recordCount);
    if (active.fullLength === 0) {
      warnings.push({
        code: "fasta-record-empty",
        line: lineNumber,
        message: `FASTA record ${active.sourceLabel} does not contain a sequence.`,
        severity: "error",
      });
      active = undefined;
      return;
    }
    const sequence = active.prefix.join("");
    const complete = sequence.length === active.fullLength;
    if (
      complete &&
      materializedBases + sequence.length <= MAX_FASTA_MATERIALIZED_BASES &&
      retained.length < SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords
    ) {
      retained.push({ ...active, sequence, truncated: false });
      materializedBases += sequence.length;
      progress.setMaterialized(materializedBases);
    } else if (retained.length === 0 && sequence.length > 0) {
      retained.push({ ...active, sequence, truncated: !complete });
      materializedBases += sequence.length;
      progress.setMaterialized(materializedBases);
      warnings.push({
        code: "indexed-record-preview",
        message: `${active.sourceLabel} is larger than the interactive materialized cache. The viewer retains a ${sequence.length.toLocaleString()}-residue prefix; source length ${active.fullLength.toLocaleString()} is recorded in metadata.`,
        severity: "info",
      });
    }
    active = undefined;
  };
  for await (const rawLine of lines) {
    lineNumber += 1;
    progress.consume(rawLine);
    const line = rawLine.trim();
    if (line.startsWith(">")) {
      flush();
      const header = line.slice(1).trim();
      const [sourceLabel = "", ...description] = header.split(/\s+/u);
      if (sourceLabel.length === 0) {
        warnings.push({
          code: "fasta-header-empty",
          line: lineNumber,
          message: "FASTA headers must include a non-empty sequence ID.",
          severity: "error",
        });
      }
      active = {
        description:
          description.length === 0 ? undefined : description.join(" "),
        fullLength: 0,
        prefix: [],
        prefixLength: 0,
        sourceLabel: sourceLabel || `record-${recordCount + 1}`,
      };
      continue;
    }
    if (line.length === 0 || line.startsWith(";")) continue;
    if (active == null) {
      warnings.push({
        code: "fasta-content-before-header",
        line: lineNumber,
        message: "FASTA sequence content appeared before the first header.",
        severity: "error",
      });
      continue;
    }
    if (isRnaSecondaryStructureAnnotation(line)) continue;
    const sequenceLine = line.replaceAll(/\s+/gu, "").toUpperCase();
    active.fullLength += sequenceLine.length;
    const prefixRemaining =
      MAX_OVERSIZED_RECORD_PREVIEW_BASES - active.prefixLength;
    if (prefixRemaining > 0) {
      const prefix = sequenceLine.slice(0, prefixRemaining);
      active.prefix.push(prefix);
      active.prefixLength += prefix.length;
    }
  }
  flush();
  if (recordCount > retained.length) {
    warnings.push({
      code: "indexed-materialization-limit",
      message: `Indexed ${recordCount.toLocaleString()} FASTA records while materializing ${retained.length.toLocaleString()} complete or preview record${retained.length === 1 ? "" : "s"} within a ${MAX_FASTA_MATERIALIZED_BASES.toLocaleString()}-base cache.`,
      severity: "info",
    });
  }
  const records = makeUniqueSequenceRecords(
    retained.map((item) => ({
      description: item.description,
      features: [],
      metadata: (item.truncated
        ? {
            indexed_preview: "true",
            indexed_source_length: item.fullLength.toString(),
          }
        : {}) as Record<string, string | Array<string>>,
      molecule: inferSequenceMolecule([item.sequence]),
      sequence: item.sequence,
      sourceLabel: item.sourceLabel,
    })),
  );
  const preview = records
    .map(
      ({ description, sequence, sourceLabel }) =>
        `>${sourceLabel}${description == null ? "" : ` ${description}`}\n${sequence}`,
    )
    .join("\n");
  const classification = classifySequenceArtifact({
    contents: preview,
    fileName: fileName.replace(/\.gz$/iu, ""),
  });
  return {
    classification: {
      ...classification,
      evidence: [
        ...classification.evidence,
        `Streaming index scanned ${recordCount.toLocaleString()} FASTA records.`,
      ],
      kind:
        recordCount === 1
          ? classification.kind
          : classification.kind === "multiple-sequence-alignment"
            ? classification.kind
            : "sequence-collection",
    },
    fileName,
    format: "fasta",
    kind: recordCount === 1 ? "single-sequence" : "sequence-collection",
    recordInventory: {
      materializedCount: records.length,
      totalCount: recordCount,
      truncated:
        records.length < recordCount ||
        retained.some(({ truncated }) => truncated),
    },
    records,
    warnings,
  };
}

async function parseFastqLines(
  lines: AsyncIterable<string>,
  fileName: string,
  progress: ProgressTracker,
): Promise<SequenceDocument> {
  const iterator = lines[Symbol.asyncIterator]();
  const retained: Array<{
    description?: string;
    quality: string;
    sequence: string;
    sourceLabel: string;
  }> = [];
  const warnings: Array<SequenceParseWarning> = [];
  const summary = emptySummary();
  let materializedBases = 0;
  let lineNumber = 0;
  const nextLine = async (): Promise<string | null> => {
    progress.checkCancelled();
    const next = await iterator.next();
    if (next.done) return null;
    lineNumber += 1;
    progress.consume(next.value);
    return next.value;
  };
  let line = await nextLine();
  while (line != null) {
    if (line.length === 0) {
      line = await nextLine();
      continue;
    }
    if (!line.startsWith("@") || line.length === 1) {
      warnings.push({
        code: "malformed-fastq-header",
        line: lineNumber,
        message: `FASTQ record on line ${lineNumber} must begin with a non-empty @ header.`,
        severity: "error",
      });
      break;
    }
    const headerLine = lineNumber;
    const headerTitle = line.slice(1).trimEnd();
    const header = headerTitle.trim();
    const [sourceLabel = "read", ...description] = header.split(/\s+/u);
    const sequenceParts: Array<string> = [];
    line = await nextLine();
    while (line != null && !line.startsWith("+")) {
      sequenceParts.push(line.replaceAll(/\s+/gu, ""));
      line = await nextLine();
    }
    if (line == null) {
      warnings.push({
        code: "truncated-fastq-separator",
        line: headerLine,
        message: `FASTQ record '${header}' ended before its + separator.`,
        severity: "error",
      });
      break;
    }
    const separatorLabel = line.slice(1).trimEnd();
    if (separatorLabel.length > 0 && separatorLabel !== headerTitle) {
      warnings.push({
        code: "fastq-separator-label-mismatch",
        line: lineNumber,
        message: `FASTQ + label '${separatorLabel}' does not match header '${headerTitle}'.`,
        severity: "error",
      });
      break;
    }
    const sequence = sequenceParts.join("").toUpperCase();
    const qualityParts: Array<string> = [];
    let qualityLength = 0;
    line = await nextLine();
    while (line != null && qualityLength < sequence.length) {
      qualityParts.push(line);
      qualityLength += line.length;
      line = await nextLine();
    }
    const quality = qualityParts.join("");
    if (sequence.length === 0 || quality.length !== sequence.length) {
      warnings.push({
        code: "fastq-quality-length-mismatch",
        line: headerLine,
        message: `FASTQ record '${header}' has ${sequence.length} residues and ${quality.length} quality characters.`,
        severity: "error",
      });
      break;
    }
    if (
      [...quality].some(
        (symbol) => symbol.charCodeAt(0) < 33 || symbol.charCodeAt(0) > 126,
      )
    ) {
      warnings.push({
        code: "invalid-fastq-quality-character",
        line: headerLine,
        message: `FASTQ record '${header}' contains quality outside printable Phred+33 ASCII.`,
        severity: "error",
      });
      break;
    }
    updateSummary(summary, sequence, quality);
    progress.setRecordCount(summary.readCount);
    if (summary.readCount > SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords) {
      throw new Error(
        `Indexed FASTQ supports at most ${SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords.toLocaleString()} reads.`,
      );
    }
    if (
      retained.length < SEQUENCE_VIEWER_LIMITS.input.retainedFastqRecords &&
      materializedBases + sequence.length <=
        SEQUENCE_VIEWER_LIMITS.input.retainedFastqBases
    ) {
      retained.push({
        description:
          description.length === 0 ? undefined : description.join(" "),
        quality,
        sequence,
        sourceLabel,
      });
      materializedBases += sequence.length;
      progress.setMaterialized(materializedBases);
    }
  }
  const records = makeUniqueSequenceRecords(
    retained.map((item) => ({
      description: item.description,
      features: [],
      metadata: {},
      molecule: inferSequenceMolecule([item.sequence]),
      quality: {
        ascii: item.quality,
        phred: decodeFastqQuality(item.quality),
      },
      sequence: item.sequence,
      sourceLabel: item.sourceLabel,
    })),
  );
  if (summary.readCount > records.length) {
    warnings.push({
      code: "fastq-inspection-retention-limit",
      message: `Streaming statistics include all ${summary.readCount.toLocaleString()} accepted reads; the bounded cache materialized ${records.length.toLocaleString()} reads and ${materializedBases.toLocaleString()} bases.`,
      severity: "info",
    });
  }
  const preview = records
    .map(
      ({ description, quality, sequence, sourceLabel }) =>
        `@${sourceLabel}${description == null ? "" : ` ${description}`}\n${sequence}\n+\n${quality?.ascii ?? ""}`,
    )
    .join("\n");
  return {
    classification: {
      ...classifySequenceArtifact({ contents: preview, fileName }),
      evidence: [
        "FASTQ @/+/quality record structure detected.",
        `Streaming index scanned ${summary.readCount.toLocaleString()} FASTQ reads.`,
      ],
      kind: "fastq",
      suggestedViewer: "sequence",
    },
    fastqSummary: finalizeSummary(summary),
    fileName,
    format: "fastq",
    kind: "fastq",
    recordInventory: {
      materializedCount: records.length,
      totalCount: summary.readCount,
      truncated: records.length < summary.readCount,
    },
    records,
    warnings,
  };
}

type SummaryAccumulator = {
  gcCount: number;
  nCount: number;
  q20Count: number;
  q30Count: number;
  qualityCount: number;
  qualityTotal: number;
  readCount: number;
  readLengthMax: number;
  readLengthMin: number;
  totalBases: number;
};

function emptySummary(): SummaryAccumulator {
  return {
    gcCount: 0,
    nCount: 0,
    q20Count: 0,
    q30Count: 0,
    qualityCount: 0,
    qualityTotal: 0,
    readCount: 0,
    readLengthMax: 0,
    readLengthMin: Number.POSITIVE_INFINITY,
    totalBases: 0,
  };
}

function updateSummary(
  summary: SummaryAccumulator,
  sequence: string,
  quality: string,
): void {
  summary.readCount += 1;
  summary.totalBases += sequence.length;
  summary.readLengthMax = Math.max(summary.readLengthMax, sequence.length);
  summary.readLengthMin = Math.min(summary.readLengthMin, sequence.length);
  for (const symbol of sequence) {
    if (symbol === "G" || symbol === "C") summary.gcCount += 1;
    if (symbol === "N") summary.nCount += 1;
  }
  for (const symbol of quality) {
    const score = symbol.charCodeAt(0) - 33;
    summary.qualityCount += 1;
    summary.qualityTotal += score;
    if (score >= 20) summary.q20Count += 1;
    if (score >= 30) summary.q30Count += 1;
  }
}

function finalizeSummary(summary: SummaryAccumulator): FastqSummary {
  return {
    gcFraction:
      summary.totalBases === 0 ? 0 : summary.gcCount / summary.totalBases,
    meanQuality:
      summary.qualityCount === 0
        ? 0
        : summary.qualityTotal / summary.qualityCount,
    meanReadLength:
      summary.readCount === 0 ? 0 : summary.totalBases / summary.readCount,
    nFraction:
      summary.totalBases === 0 ? 0 : summary.nCount / summary.totalBases,
    q20Fraction:
      summary.qualityCount === 0 ? 0 : summary.q20Count / summary.qualityCount,
    q30Fraction:
      summary.qualityCount === 0 ? 0 : summary.q30Count / summary.qualityCount,
    qualityEncoding: "phred+33-assumed",
    readCount: summary.readCount,
    readLengthMax: summary.readLengthMax,
    readLengthMin:
      summary.readLengthMin === Number.POSITIVE_INFINITY
        ? 0
        : summary.readLengthMin,
    totalBases: summary.totalBases,
  };
}

type ProgressTracker = ReturnType<typeof createProgress>;

function createProgress(
  onProgress: ((progress: IndexedSequenceProgress) => void) | undefined,
  signal: AbortSignal | undefined,
  maxDecodedBytes: number,
) {
  let decodedBytes = 0;
  let nextProgressAt = PROGRESS_INTERVAL_BYTES;
  let materializedBases = 0;
  let recordCount = 0;
  return {
    get decodedBytes() {
      return decodedBytes;
    },
    checkCancelled(): void {
      if (signal?.aborted === true) {
        throw new Error("Indexed sequence loading was cancelled.");
      }
    },
    consume(line: string): void {
      this.checkCancelled();
      decodedBytes += new TextEncoder().encode(`${line}\n`).byteLength;
      if (decodedBytes > maxDecodedBytes) {
        throw new Error(
          `Indexed sequence loading exceeded its ${maxDecodedBytes.toLocaleString()}-byte decoded input budget.`,
        );
      }
      if (decodedBytes >= nextProgressAt) {
        onProgress?.({ decodedBytes, materializedBases, recordCount });
        nextProgressAt = decodedBytes + PROGRESS_INTERVAL_BYTES;
      }
    },
    publish(force = false): void {
      if (force || decodedBytes >= nextProgressAt) {
        onProgress?.({ decodedBytes, materializedBases, recordCount });
      }
    },
    setMaterialized(value: number): void {
      materializedBases = value;
    },
    setRecordCount(value: number): void {
      recordCount = value;
    },
  };
}
