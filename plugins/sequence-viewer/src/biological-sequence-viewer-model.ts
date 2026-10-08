import {
  classifySequenceArtifact,
  type SequenceArtifactClassification,
} from "./biological-sequence-artifact-classifier";

import { isExplicitMsaFile } from "./msa/file-kind";
import { looksLikePir } from "./msa/formats/pir";
import { parseSequenceDocumentResult } from "./sequence/parser";
import type { SequenceDocument, SequenceParseResult } from "./sequence/types";
import { assertTextWithinInputBudget } from "./runtime-contract";

export type BiologicalSequenceViewerMode = "alignment" | "sequence";

export type BiologicalSequenceViewerModel = {
  alignmentAvailable: boolean;
  availableModes: Array<BiologicalSequenceViewerMode>;
  classification: SequenceArtifactClassification;
  defaultMode: BiologicalSequenceViewerMode;
  sequenceDocument: SequenceDocument | null;
  sequenceParse: SequenceParseResult;
};

export function createBiologicalSequenceViewerModel({
  contents,
  fileName,
  preparsedSequenceDocument,
}: {
  contents: string;
  fileName?: string;
  preparsedSequenceDocument?: SequenceDocument;
}): BiologicalSequenceViewerModel {
  assertTextWithinInputBudget(contents);
  const classification =
    preparsedSequenceDocument?.classification ??
    classifySequenceArtifact({ contents, fileName });
  const sequenceParse =
    preparsedSequenceDocument == null
      ? parseSequenceDocumentResult({
          classification,
          contents,
          fileName,
        })
      : ({
          diagnostics: preparsedSequenceDocument.warnings,
          document: preparsedSequenceDocument,
          status: "success",
        } as const);
  const sequenceDocument =
    sequenceParse.status === "success" ? sequenceParse.document : null;
  const isUnalignedPir =
    looksLikePir(contents) &&
    classification.alignment?.disposition === "not-alignment";
  const alignmentAvailable =
    classification.kind === "multiple-sequence-alignment" ||
    classification.alignment?.disposition === "ambiguous-equal-width" ||
    (isExplicitMsaFile(fileName ?? "") && !isUnalignedPir);
  const availableModes = [
    ...(sequenceDocument != null || alignmentAvailable
      ? (["sequence"] as const)
      : []),
    ...(alignmentAvailable ? (["alignment"] as const) : []),
  ];

  return {
    alignmentAvailable,
    availableModes,
    classification,
    defaultMode:
      (classification.suggestedViewer === "msa" || sequenceDocument == null) &&
      alignmentAvailable
        ? "alignment"
        : "sequence",
    sequenceDocument,
    sequenceParse,
  };
}
