import {
  classifySequenceArtifact,
  parseFastaRecords,
  type SequenceArtifactClassification,
} from "../../biological-sequence-artifact-classifier";
import { createTextLineReader } from "../../text-lines";

import { inferSequenceMolecule } from "../molecule-inference";
import type { SequenceDocument, SequenceRecord } from "../types";

export function parseFastaDocument({
  classification: providedClassification,
  contents,
  fileName,
}: {
  classification?: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceDocument {
  const fastaRecords = parseFastaRecords(contents);
  const records = makeUniqueSequenceRecords(
    fastaRecords.map(({ header, sequence }) => {
      const [sourceLabel, ...descriptionParts] = header.trim().split(/\s+/);
      const description = descriptionParts.join(" ").trim();
      return {
        description: description.length === 0 ? undefined : description,
        features: [],
        metadata: {},
        molecule: inferSequenceMolecule([sequence]),
        sequence,
        sourceLabel: sourceLabel ?? "record",
      };
    }),
  );
  const classification =
    providedClassification ?? classifySequenceArtifact({ contents, fileName });
  const validationWarnings = validateFastaStructure(contents);
  return {
    classification,
    fileName,
    format: "fasta",
    kind:
      records.length === 1
        ? "single-sequence"
        : classification.kind === "multiple-sequence-alignment"
          ? "sequence-collection"
          : "sequence-collection",
    records,
    warnings: [
      ...validationWarnings,
      ...(classification.kind === "multiple-sequence-alignment"
        ? [
            {
              code: "likely-msa",
              message:
                "This FASTA appears aligned; sequence view is available, but the MSA viewer is usually the better fit.",
              severity: "info",
            } as const,
          ]
        : []),
    ],
  };
}

function validateFastaStructure(
  contents: string,
): SequenceDocument["warnings"] {
  const warnings: SequenceDocument["warnings"] = [];
  const readLine = createTextLineReader(contents);
  let activeHeader: {
    hasSequence: boolean;
    label: string;
    line: number;
  } | null = null;
  let sourceLine = readLine();
  const flush = (): void => {
    if (activeHeader != null && !activeHeader.hasSequence) {
      warnings.push({
        code: "fasta-record-empty",
        line: activeHeader.line,
        message: `FASTA record ${activeHeader.label || "(unnamed)"} does not contain a sequence.`,
        severity: "error",
      });
    }
  };
  while (sourceLine != null) {
    const trimmed = sourceLine.text.trim();
    if (trimmed.startsWith(">")) {
      flush();
      const label = trimmed.slice(1).trim().split(/\s+/)[0] ?? "";
      if (label.length === 0) {
        warnings.push({
          code: "fasta-header-empty",
          line: sourceLine.lineNumber,
          message: "FASTA headers must include a non-empty sequence ID.",
          severity: "error",
        });
      }
      activeHeader = {
        hasSequence: false,
        label,
        line: sourceLine.lineNumber,
      };
    } else if (
      trimmed.length > 0 &&
      !trimmed.startsWith(";") &&
      activeHeader == null
    ) {
      warnings.push({
        code: "fasta-content-before-header",
        line: sourceLine.lineNumber,
        message: "FASTA sequence content appeared before the first header.",
        severity: "error",
      });
    } else if (
      trimmed.length > 0 &&
      !trimmed.startsWith(";") &&
      activeHeader != null
    ) {
      activeHeader.hasSequence = true;
    }
    sourceLine = readLine();
  }
  flush();
  return warnings;
}

export function makeUniqueSequenceRecords(
  records: Array<
    Omit<SequenceRecord, "id" | "length" | "topology"> & {
      topology?: SequenceRecord["topology"];
    }
  >,
): Array<SequenceRecord> {
  const seenLabels = new Map<string, number>();
  return records.map((record) => {
    const occurrence = (seenLabels.get(record.sourceLabel) ?? 0) + 1;
    seenLabels.set(record.sourceLabel, occurrence);
    return {
      ...record,
      id:
        occurrence === 1
          ? record.sourceLabel
          : `${record.sourceLabel}__${occurrence}`,
      length: record.sequence.length,
      topology: record.topology ?? "unknown",
    };
  });
}
