import {
  classifySequenceArtifact,
  type SequenceArtifactClassification,
} from "../biological-sequence-artifact-classifier";
import {
  assertTextWithinInputBudget,
  SEQUENCE_VIEWER_LIMITS,
  SequenceViewerLimitError,
} from "../runtime-contract";
import { looksLikePir, parsePir } from "../msa/formats/pir";

import type {
  SequenceDocument,
  SequenceParseResult,
  SequenceParseWarning,
} from "./types";
import { parseEmblDocument } from "./formats/embl";
import { makeUniqueSequenceRecords, parseFastaDocument } from "./formats/fasta";
import { parseFastqDocument } from "./formats/fastq";
import { parseGenBankDocument } from "./formats/genbank";
import { inferSequenceMolecule } from "./molecule-inference";

export function parseSequenceDocument({
  classification: providedClassification,
  contents,
  fileName,
}: {
  classification?: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceDocument {
  assertTextWithinInputBudget(contents);
  const classification =
    providedClassification ?? classifySequenceArtifact({ contents, fileName });
  const document = looksLikePir(contents)
    ? parsePirSequenceDocument({ classification, contents, fileName })
    : (() => {
        switch (classification.kind) {
          case "annotated-sequence":
            return looksLikeGenBank(contents)
              ? parseGenBankDocument({ classification, contents, fileName })
              : parseEmblDocument({ classification, contents, fileName });
          case "fastq":
            return parseFastqDocument({ classification, contents, fileName });
          case "multiple-sequence-alignment":
          case "sequence-collection":
          case "single-sequence":
            return parseFastaDocument({
              classification,
              contents: stripFastaSecondaryStructureAnnotations(contents),
              fileName,
            });
          case "chromatogram":
          case "unknown":
            throw new Error(
              "No supported biological sequence records were parsed from this file.",
            );
        }
      })();
  assertSequenceDocumentWithinBudget(document);
  return document;
}

function stripFastaSecondaryStructureAnnotations(contents: string): string {
  return contents.replace(
    /^(?![ \t]*>)[ \t]*[.()[\]{}<>_-]*[()[\]{}<>][.()[\]{}<>_-]*[ \t]*(\r?\n|\r|$)/gmu,
    "$1",
  );
}

function parsePirSequenceDocument({
  classification,
  contents,
  fileName,
}: {
  classification: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceDocument {
  const draft = parsePir(contents);
  const records = makeUniqueSequenceRecords(
    draft.rows.map(({ alignedSequence, description, id }) => ({
      ...(description == null ? {} : { description }),
      features: [],
      metadata: {},
      molecule: inferSequenceMolecule([alignedSequence]),
      sequence: alignedSequence.toUpperCase(),
      sourceLabel: id,
    })),
  );
  return {
    classification,
    fileName,
    format: "fasta",
    kind: records.length === 1 ? "single-sequence" : "sequence-collection",
    records,
    warnings: (draft.warnings ?? []).map(({ code, line, message, severity }) => ({
      code,
      ...(line == null ? {} : { line }),
      message,
      severity: severity ?? "warning",
    })),
  };
}

export function parseSequenceDocumentResult(input: {
  classification?: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceParseResult {
  try {
    const document = parseSequenceDocument(input);
    if (document.records.length === 0) {
      return {
        diagnostics: document.warnings,
        message: "No biological sequence records were parsed from this file.",
        status: "error",
      };
    }
    const fatal = document.warnings.find(
      ({ severity }) => severity === "error",
    );
    return fatal == null
      ? { diagnostics: document.warnings, document, status: "success" }
      : {
          diagnostics: document.warnings,
          message: fatal.message,
          status: "error",
        };
  } catch (error) {
    const diagnostic: SequenceParseWarning = {
      code: "sequence-parse-failed",
      message:
        error instanceof Error
          ? error.message
          : "The biological sequence file could not be parsed.",
      severity: "error",
    };
    return {
      diagnostics: [diagnostic],
      message: diagnostic.message,
      status: "error",
    };
  }
}

function looksLikeGenBank(contents: string): boolean {
  return /^LOCUS\s+/m.test(contents);
}

function assertSequenceDocumentWithinBudget(document: SequenceDocument): void {
  const recordCount =
    document.recordInventory?.totalCount ?? document.records.length;
  const maxRecords =
    document.kind === "fastq"
      ? SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords
      : SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords;
  if (recordCount > maxRecords) {
    throw new SequenceViewerLimitError(
      "sequence_record_limit_exceeded",
      `This artifact contains more than ${maxRecords.toLocaleString()} records. Create a smaller subset and reopen it.`,
      { maxRecords, recordCount },
    );
  }
  const totalResidues =
    document.fastqSummary?.totalBases ??
    document.records.reduce((total, record) => total + record.length, 0);
  if (totalResidues > SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues) {
    throw new SequenceViewerLimitError(
      "sequence_residue_limit_exceeded",
      `This artifact contains ${totalResidues.toLocaleString()} residues; the bounded viewer accepts at most ${SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues.toLocaleString()}. Create a smaller subset and reopen it.`,
      { totalResidues },
    );
  }
}
