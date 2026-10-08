import { normalizeGapSymbol } from "../residue-alphabet";
import type {
  MsaAnnotationTrack,
  MsaFormatDraft,
  MsaParseWarning,
} from "../types";

const structureLikePattern = /^[()[\]{}<>A-Za-z._~, -]+$/;
const consensusLikePattern = /^[*:. ]+$/;

export function parseClustal(contents: string): MsaFormatDraft {
  const rowsById = new Map<
    string,
    { fragments: Array<string>; label: string }
  >();
  const order: Array<string> = [];
  const warnings: Array<MsaParseWarning> = [];
  const blocks: Array<{
    consensus?: string;
    structure?: string;
    width: number;
  }> = [];
  const lines = contents.split(/\r?\n/);
  const firstContentLine = lines.find((line) => line.trim().length > 0)?.trim();
  if (!/^(?:CLUSTAL|MUSCLE)\b/i.test(firstContentLine ?? "")) {
    warnings.push({
      code: "clustal-header-missing",
      message: "The CLUSTAL or MUSCLE alignment header was not found.",
      severity: "error",
    });
  }
  let currentBlock:
    | {
        consensus?: string;
        fragmentStart: number;
        rowIds: Set<string>;
        structure?: string;
        width: number;
      }
    | undefined;

  const finalizeBlock = () => {
    if (currentBlock == null || currentBlock.rowIds.size === 0) return;
    blocks.push({
      consensus: currentBlock.consensus,
      structure: currentBlock.structure,
      width: currentBlock.width,
    });
    currentBlock = undefined;
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trimEnd();
    if (line.trim().length === 0) {
      // An all-space consensus row is indistinguishable from a block separator
      // after trailing whitespace is stripped. Finalize the block and pad its
      // annotation later if another block establishes that the track exists.
      finalizeBlock();
      return;
    }
    if (/^CLUSTAL/i.test(trimmed.trim()) || /^MUSCLE/i.test(trimmed.trim())) {
      return;
    }
    if (/^\s/.test(line)) {
      if (currentBlock == null) {
        warnings.push({
          code: "clustal-annotation-skipped",
          line: lineNumber,
          message: "Skipped a CLUSTAL annotation row outside a sequence block.",
        });
        return;
      }
      const annotation = line
        .slice(
          currentBlock.fragmentStart,
          currentBlock.fragmentStart + currentBlock.width,
        )
        .padEnd(currentBlock.width, " ");
      if (consensusLikePattern.test(annotation)) {
        currentBlock.consensus = annotation;
      } else if (structureLikePattern.test(annotation)) {
        currentBlock.structure = annotation;
      } else {
        warnings.push({
          code: "clustal-annotation-skipped",
          line: lineNumber,
          message: "Skipped an unrecognized CLUSTAL annotation row.",
        });
      }
      return;
    }

    const rowMatch = /^(\S+)(\s+)(\S+)(?:\s+\d+)?\s*$/.exec(trimmed);
    const label = rowMatch?.[1];
    const fragment = rowMatch?.[3];
    if (label == null || fragment == null) {
      warnings.push({
        code: "clustal-row-skipped",
        line: lineNumber,
        message: "Skipped a malformed CLUSTAL sequence row.",
      });
      return;
    }
    if (currentBlock?.rowIds.has(label)) finalizeBlock();
    currentBlock ??= {
      fragmentStart:
        (rowMatch?.[1]?.length ?? 0) + (rowMatch?.[2]?.length ?? 0),
      rowIds: new Set(),
      width: fragment.length,
    };
    currentBlock.rowIds.add(label);
    const existing = rowsById.get(label);
    const normalizedFragment = Array.from(fragment)
      .map((symbol) => normalizeGapSymbol(symbol))
      .join("");
    if (existing == null) {
      order.push(label);
      rowsById.set(label, { fragments: [normalizedFragment], label });
    } else {
      existing.fragments.push(normalizedFragment);
    }
  });
  finalizeBlock();

  const annotations: Array<MsaAnnotationTrack> = [];
  if (blocks.some(({ consensus }) => consensus != null)) {
    annotations.push({
      id: "clustal-consensus",
      kind: "conservation",
      label: "CLUSTAL consensus",
      values: blocks
        .map(({ consensus, width }) => consensus ?? " ".repeat(width))
        .join(""),
    });
  }
  if (blocks.some(({ structure }) => structure != null)) {
    annotations.push({
      id: "clustal-structure",
      kind: "rna-secondary-structure",
      label: "RNA structure",
      values: blocks
        .map(({ structure, width }) => structure ?? " ".repeat(width))
        .join(""),
    });
  }

  return {
    annotations,
    format: "clustal",
    rows: order.map((id) => {
      const row = rowsById.get(id);
      return {
        alignedSequence: row?.fragments.join("") ?? "",
        id,
        label: row?.label ?? id,
      };
    }),
    warnings,
  };
}
