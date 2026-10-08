import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaFormatDraft, MsaParseWarning } from "../types";

export function looksLikePir(contents: string): boolean {
  return /^[\t\n\r ]*>[A-Za-z0-9]{2};[^\r\n]+/u.test(contents);
}

export function parsePir(contents: string): MsaFormatDraft {
  const rows: MsaFormatDraft["rows"] = [];
  const warnings: Array<MsaParseWarning> = [];
  const lines = contents.split(/\r?\n/);
  let active: {
    description?: string;
    id: string;
    sequenceParts: Array<string>;
    sawDescription: boolean;
    startLine: number;
  } | null = null;

  const flush = (terminated: boolean): void => {
    if (active == null) {
      return;
    }
    if (!terminated) {
      warnings.push({
        code: "pir-terminator-missing",
        line: active.startLine,
        message: `PIR record ${active.id} ended without a * terminator.`,
        severity: "error",
      });
    }
    rows.push({
      alignedSequence: active.sequenceParts.join(""),
      ...(active.description == null
        ? {}
        : { description: active.description }),
      id: active.id,
      label: active.id,
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      flush(false);
      const header = /^>[A-Za-z0-9]{2};(.+)$/.exec(trimmed);
      const id = header?.[1]?.trim() || `sequence-${rows.length + 1}`;
      if (header == null) {
        warnings.push({
          code: "pir-header-invalid",
          line: index + 1,
          message: "PIR headers must use the >type;identifier form.",
          severity: "error",
        });
      }
      active = {
        id,
        sawDescription: false,
        sequenceParts: [],
        startLine: index + 1,
      };
      return;
    }
    if (active == null || trimmed.length === 0) {
      return;
    }
    if (!active.sawDescription) {
      active.description = trimmed;
      active.sawDescription = true;
      return;
    }
    const terminatorIndex = trimmed.indexOf("*");
    const sequencePart =
      terminatorIndex >= 0 ? trimmed.slice(0, terminatorIndex) : trimmed;
    active.sequenceParts.push(
      Array.from(sequencePart.replaceAll(/\s+/g, ""))
        .map((symbol) => normalizeGapSymbol(symbol))
        .join(""),
    );
    if (terminatorIndex >= 0) {
      flush(true);
      active = null;
    }
  });
  flush(false);

  return { format: "pir", rows, warnings };
}
