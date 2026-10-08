import {
  classifySequenceArtifact,
  type SequenceArtifactClassification,
} from "../../biological-sequence-artifact-classifier";
import { SEQUENCE_VIEWER_LIMITS } from "../../runtime-contract";
import { createTextLineReader } from "../../text-lines";

import { inferSequenceMolecule } from "../molecule-inference";
import { decodeFastqQuality } from "../quality";
import type {
  FastqSummary,
  SequenceDocument,
  SequenceParseWarning,
  SequenceRecord,
} from "../types";
import { makeUniqueSequenceRecords } from "./fasta";

type FastqSummaryAccumulator = {
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

export function parseFastqDocument({
  classification,
  contents,
  fileName,
}: {
  classification?: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceDocument {
  const warnings: Array<SequenceParseWarning> = [];
  const readLine = createTextLineReader(contents);
  const retainedRecords: Array<Omit<SequenceRecord, "id" | "length">> = [];
  const summary = createEmptySummaryAccumulator();
  let retainedBases = 0;
  let retentionClosed = false;
  let currentLine = readLine();

  while (currentLine != null) {
    while (currentLine != null && currentLine.text.length === 0) {
      currentLine = readLine();
    }
    if (currentLine == null) break;
    const headerLine = currentLine.lineNumber;
    const header = currentLine.text;
    if (!header.startsWith("@") || header.length === 1) {
      warnings.push({
        code: "malformed-fastq-header",
        line: headerLine,
        message: `FASTQ record on line ${headerLine} must begin with a non-empty @ header.`,
        severity: "error",
      });
      break;
    }
    currentLine = readLine();

    const sequenceParts: Array<string> = [];
    while (currentLine != null && !currentLine.text.startsWith("+")) {
      sequenceParts.push(currentLine.text.replaceAll(/\s+/g, ""));
      currentLine = readLine();
    }
    const sequence = sequenceParts.join("").toUpperCase();
    if (currentLine == null) {
      warnings.push({
        code: "truncated-fastq-separator",
        line: headerLine,
        message: `FASTQ record '${header.slice(1)}' ended before its + separator.`,
        severity: "error",
      });
      break;
    }
    const separator = currentLine.text;
    const separatorLine = currentLine.lineNumber;
    if (sequence.length === 0) {
      warnings.push({
        code: "empty-fastq-sequence",
        line: headerLine,
        message: `FASTQ record '${header.slice(1)}' has an empty sequence.`,
        severity: "error",
      });
      break;
    }
    const separatorLabel = separator.slice(1).trimEnd();
    const headerLabel = header.slice(1).trim();
    const headerTitle = header.slice(1).trimEnd();
    if (separatorLabel.length > 0 && separatorLabel !== headerTitle) {
      warnings.push({
        code: "fastq-separator-label-mismatch",
        line: separatorLine,
        message: `FASTQ + label '${separatorLabel}' does not match header '${headerTitle}'.`,
        severity: "error",
      });
      break;
    }

    currentLine = readLine();
    const qualityParts: Array<string> = [];
    let qualityLength = 0;
    while (currentLine != null && qualityLength < sequence.length) {
      qualityParts.push(currentLine.text);
      qualityLength += currentLine.text.length;
      currentLine = readLine();
    }
    const qualityAscii = qualityParts.join("");
    if (qualityAscii.length !== sequence.length) {
      warnings.push({
        code:
          qualityAscii.length < sequence.length
            ? "truncated-fastq-quality"
            : "fastq-quality-length-mismatch",
        line: headerLine,
        message: `FASTQ record '${headerLabel}' has ${sequence.length} sequence residues but ${qualityAscii.length} quality characters.`,
        severity: "error",
      });
      break;
    }
    const invalidQualityOffset = [...qualityAscii].findIndex((character) => {
      const code = character.charCodeAt(0);
      return code < 33 || code > 126;
    });
    if (invalidQualityOffset !== -1) {
      warnings.push({
        code: "invalid-fastq-quality-character",
        column: invalidQualityOffset + 1,
        line: headerLine,
        message: `FASTQ record '${headerLabel}' contains a quality character outside printable Phred+33 ASCII.`,
        severity: "error",
      });
      break;
    }

    if (summary.readCount >= SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords) {
      warnings.push({
        code: "fastq-record-limit-exceeded",
        line: headerLine,
        message: `FASTQ input exceeds the ${SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords.toLocaleString()} record safety limit.`,
        severity: "error",
      });
      break;
    }
    if (
      summary.totalBases + sequence.length >
      SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues
    ) {
      warnings.push({
        code: "sequence-residue-limit-exceeded",
        line: headerLine,
        message: `FASTQ input exceeds the ${SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues.toLocaleString()} residue safety limit.`,
        severity: "error",
      });
      break;
    }

    updateSummaryAccumulator(summary, sequence, qualityAscii);
    if (
      !retentionClosed &&
      retainedRecords.length < SEQUENCE_VIEWER_LIMITS.input.retainedFastqRecords
    ) {
      const qualityWithinBudget =
        retainedBases + sequence.length <=
        SEQUENCE_VIEWER_LIMITS.input.retainedFastqBases;
      if (qualityWithinBudget || retainedRecords.length === 0) {
        retainedRecords.push({
          features: [],
          metadata: {},
          molecule: inferSequenceMolecule([sequence]),
          ...(qualityWithinBudget
            ? {
                quality: {
                  ascii: qualityAscii,
                  phred: decodeFastqQuality(qualityAscii),
                },
              }
            : {}),
          sequence,
          sourceLabel: headerLabel.split(/\s+/)[0] ?? "read",
        });
        retainedBases += sequence.length;
      }
      if (!qualityWithinBudget) retentionClosed = true;
    } else if (
      retainedRecords.length >=
      SEQUENCE_VIEWER_LIMITS.input.retainedFastqRecords
    ) {
      retentionClosed = true;
    }
  }

  const records = makeUniqueSequenceRecords(retainedRecords);
  if (summary.readCount > records.length || retentionClosed) {
    warnings.push({
      code: "fastq-inspection-retention-limit",
      message: `FASTQ summary statistics include all ${summary.readCount.toLocaleString()} accepted reads. Per-read inspection retains a prefix of at most ${SEQUENCE_VIEWER_LIMITS.input.retainedFastqRecords.toLocaleString()} reads and ${SEQUENCE_VIEWER_LIMITS.input.retainedFastqBases.toLocaleString()} decoded quality bases; an oversized first read remains inspectable without a decoded quality track.`,
      severity: "info",
    });
  }
  return {
    classification:
      classification ?? classifySequenceArtifact({ contents, fileName }),
    fastqSummary: finalizeFastqSummary(summary),
    fileName,
    format: "fastq",
    kind: "fastq",
    recordInventory: {
      materializedCount: records.length,
      totalCount: summary.readCount,
      truncated: summary.readCount > records.length,
    },
    records,
    warnings,
  };
}

export function createFastqSummary(
  records: Array<SequenceRecord>,
): FastqSummary {
  const summary = createEmptySummaryAccumulator();
  for (const record of records) {
    updateSummaryAccumulator(
      summary,
      record.sequence,
      record.quality?.ascii ?? "",
    );
  }
  return finalizeFastqSummary(summary);
}

function createEmptySummaryAccumulator(): FastqSummaryAccumulator {
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

function updateSummaryAccumulator(
  summary: FastqSummaryAccumulator,
  sequence: string,
  qualityAscii: string,
): void {
  summary.readCount += 1;
  summary.totalBases += sequence.length;
  summary.readLengthMin = Math.min(summary.readLengthMin, sequence.length);
  summary.readLengthMax = Math.max(summary.readLengthMax, sequence.length);
  for (const symbol of sequence) {
    if (symbol === "G" || symbol === "C") summary.gcCount += 1;
    else if (symbol === "N") summary.nCount += 1;
  }
  for (const character of qualityAscii) {
    const score = character.charCodeAt(0) - 33;
    summary.qualityCount += 1;
    summary.qualityTotal += score;
    if (score >= 20) summary.q20Count += 1;
    if (score >= 30) summary.q30Count += 1;
  }
}

function finalizeFastqSummary(summary: FastqSummaryAccumulator): FastqSummary {
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
    readLengthMin: summary.readCount === 0 ? 0 : summary.readLengthMin,
    totalBases: summary.totalBases,
  };
}
