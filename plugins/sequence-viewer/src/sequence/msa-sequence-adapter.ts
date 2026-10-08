import type { SequenceArtifactClassification } from "../biological-sequence-artifact-classifier";
import { isGapSymbol } from "../msa/residue-alphabet";
import type { MsaDocument } from "../msa/types";
import { makeUniqueSequenceRecords } from "./formats/fasta";
import type { SequenceDocument } from "./types";

export function createSequenceDocumentFromMsa({
  classification,
  document,
  fileName,
}: {
  classification: SequenceArtifactClassification;
  document: MsaDocument;
  fileName?: string;
}): SequenceDocument {
  return {
    classification,
    fileName,
    format: "fasta",
    kind:
      document.rows.length === 1 ? "single-sequence" : "sequence-collection",
    records: makeUniqueSequenceRecords(
      document.rows.map((row) => ({
        description: row.description,
        features: [],
        metadata: {
          alignmentFormat: document.format,
          alignedLength: document.alignedLength.toString(),
          sourceRowId: row.sourceId ?? row.id,
        },
        molecule: toSequenceMolecule(
          document.displayInterpretation.moleculeType,
        ),
        sequence: projectSourceSequence(document, row.id, row.alignedSequence),
        sourceLabel: row.label,
      })),
    ),
    warnings: [
      {
        code: "derived-from-alignment",
        message:
          "Sequence mode shows each alignment row as its ungapped source sequence. Switch back to Alignment mode for column-by-column biology.",
        severity: "info",
      },
    ],
  };
}

function projectSourceSequence(
  document: MsaDocument,
  rowId: string,
  alignedSequence: string,
): string {
  const insertionsByColumn = new Map<number, string>();
  for (const insertion of document.insertions) {
    if (insertion.rowId !== rowId) {
      continue;
    }
    insertionsByColumn.set(
      insertion.afterAlignmentColumn,
      (insertionsByColumn.get(insertion.afterAlignmentColumn) ?? "") +
        insertion.residues,
    );
  }

  let sourceSequence = insertionsByColumn.get(-1) ?? "";
  for (const [alignmentColumn, symbol] of [...alignedSequence].entries()) {
    sourceSequence += symbol;
    sourceSequence += insertionsByColumn.get(alignmentColumn) ?? "";
  }

  return [...sourceSequence].filter((symbol) => !isGapSymbol(symbol)).join("");
}

function toSequenceMolecule(
  moleculeType: MsaDocument["displayInterpretation"]["moleculeType"],
): SequenceDocument["records"][number]["molecule"] {
  switch (moleculeType) {
    case "dna":
    case "nucleic-acid-ambiguous":
    case "protein":
    case "rna":
    case "unknown":
      return moleculeType;
    case "mixed":
      return "unknown";
  }
}
