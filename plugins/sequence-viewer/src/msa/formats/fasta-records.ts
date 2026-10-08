import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaParseWarning } from "../types";
import { createTextLineReader } from "../../text-lines";

type FastaRecord = {
  description?: string;
  headerLine: number;
  id: string;
  label: string;
  sequence: string;
};

export function parseFastaRecords(
  contents: string,
  { preserveGapSymbols = false }: { preserveGapSymbols?: boolean } = {},
): {
  records: Array<FastaRecord>;
  warnings: Array<MsaParseWarning>;
} {
  const records: Array<FastaRecord> = [];
  const warnings: Array<MsaParseWarning> = [];
  let active: {
    description?: string;
    headerLine: number;
    id: string;
    label: string;
    sequenceParts: Array<string>;
  } | null = null;

  const flush = (): void => {
    if (active == null) {
      return;
    }
    if (active.sequenceParts.length === 0) {
      warnings.push({
        code: "fasta-record-empty",
        line: active.headerLine,
        message: `FASTA record ${active.id} does not contain a sequence.`,
        severity: "error",
      });
    }
    records.push({
      description: active.description,
      headerLine: active.headerLine,
      id: active.id,
      label: active.label,
      sequence: active.sequenceParts.join(""),
    });
  };

  const readLine = createTextLineReader(contents);
  let sourceLine = readLine();
  while (sourceLine != null) {
    const { lineNumber, text: line } = sourceLine;
    if (line.startsWith(">")) {
      flush();
      const header = line.slice(1).trim();
      const [idToken, ...descriptionParts] = header.split(/\s+/);
      const id = idToken?.trim() || `sequence-${records.length + 1}`;
      const description = descriptionParts.join(" ").trim();
      if (header.length === 0) {
        warnings.push({
          code: "fasta-header-empty",
          line: lineNumber,
          message: "FASTA headers must include a non-empty sequence ID.",
          severity: "error",
        });
      }
      active = {
        ...(description.length > 0 ? { description } : {}),
        headerLine: lineNumber,
        id,
        label: id,
        sequenceParts: [],
      };
      sourceLine = readLine();
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith(";")) {
      sourceLine = readLine();
      continue;
    }
    if (active == null) {
      warnings.push({
        code: "fasta-content-before-header",
        line: lineNumber,
        message: "Skipped FASTA content before the first header.",
        preserved: "ignored",
        severity: "error",
      });
      sourceLine = readLine();
      continue;
    }
    const sequencePart = trimmed.replaceAll(/\s+/g, "");
    active.sequenceParts.push(
      preserveGapSymbols
        ? sequencePart
        : Array.from(sequencePart)
            .map((symbol) => normalizeGapSymbol(symbol))
            .join(""),
    );
    sourceLine = readLine();
  }
  flush();

  return { records, warnings };
}
