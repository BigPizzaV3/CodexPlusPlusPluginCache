import type { SequenceArtifactClassification } from "../biological-sequence-artifact-classifier";
import { biologicalFileBasename } from "../compressed-file-name";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { getSequenceFormatHint } from "./file-kind";
import { parseAbifRecord, parseScfRecord } from "./formats/chromatogram";
import { parseSnapGeneRecord } from "./formats/snapgene";
import type {
  SequenceDocument,
  SequenceParseResult,
  SequenceParseWarning,
} from "./types";

export type BinarySequenceFormat = "abif" | "scf" | "snapgene";

/** A filename selects a decoder, never establishes that its contents are valid. */
export function getBinarySequenceFormatHint(
  fileName?: string,
): BinarySequenceFormat | null {
  const hint = getSequenceFormatHint(fileName);
  if (hint === "ab1" || hint === "abi") return "abif";
  if (hint === "scf") return "scf";
  if (hint === "dna") return "snapgene";
  return null;
}

export function sniffBinarySequenceFormat(
  bytes: Uint8Array,
): BinarySequenceFormat | null {
  if (startsWith(bytes, [65, 66, 73, 70])) return "abif";
  if (startsWith(bytes, [46, 115, 99, 102])) return "scf";
  if (
    bytes[0] === 9 &&
    startsWith(bytes.subarray(5), [83, 110, 97, 112, 71, 101, 110, 101])
  )
    return "snapgene";
  return null;
}

export function parseBinarySequenceDocument({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName?: string;
}): SequenceDocument {
  if (bytes.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes) {
    throw new Error(
      "This binary sequence exceeds the 8 MiB bounded viewer limit.",
    );
  }
  const format = sniffBinarySequenceFormat(bytes);
  const hint = getBinarySequenceFormatHint(fileName);
  if (format == null)
    throw new Error(
      "No supported ABIF, SCF, or SnapGene binary signature was found.",
    );
  if (hint != null && hint !== format)
    throw new Error(
      "The binary sequence file extension does not match its contents.",
    );
  const parsed =
    format === "abif"
      ? parseAbifRecord({ bytes, fileName })
      : format === "scf"
        ? parseScfRecord({ bytes, fileName })
        : parseSnapGeneRecord({ bytes, fileName });
  const classification: SequenceArtifactClassification = {
    alignment: null,
    confidence: "high",
    evidence: [
      format === "snapgene"
        ? "Decoded the SnapGene DNA packet and supported source annotations."
        : `Decoded ${format.toUpperCase()} called bases, peak locations, and all four source trace channels.`,
    ],
    kind: format === "snapgene" ? "annotated-sequence" : "chromatogram",
    molecule: "dna",
    suggestedViewer: "sequence",
  };
  return {
    classification,
    ...(fileName == null ? {} : { fileName: biologicalFileBasename(fileName) }),
    format,
    kind: format === "snapgene" ? "annotated-sequence" : "chromatogram",
    records: [parsed.record],
    warnings: parsed.warnings,
  };
}

export function parseBinarySequenceDocumentResult(input: {
  bytes: Uint8Array;
  fileName?: string;
}): SequenceParseResult {
  try {
    const document = parseBinarySequenceDocument(input);
    return { diagnostics: document.warnings, document, status: "success" };
  } catch (error) {
    const diagnostic: SequenceParseWarning = {
      code: "binary-sequence-parse-failed",
      message:
        error instanceof Error
          ? error.message
          : "The binary biological sequence file could not be decoded.",
      severity: "error",
    };
    return {
      diagnostics: [diagnostic],
      message: diagnostic.message,
      status: "error",
    };
  }
}

function startsWith(bytes: Uint8Array, signature: Array<number>): boolean {
  return signature.every((value, index) => bytes[index] === value);
}
