import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../../runtime-contract";
import {
  isProteinExclusiveSymbol,
  normalizeGapSymbol,
} from "../residue-alphabet";
import type {
  MsaAnnotationTrack,
  MsaAnnotationTrackKind,
  MsaFormatDraft,
  MsaParseWarning,
} from "../types";

const MAX_STOCKHOLM_ROW_METADATA_VALUES = 256;
const STOCKHOLM_METADATA_SEPARATOR = " | ";

type StockholmRowMetadataValue = {
  byteLength: number;
  values: Array<string>;
};

function getStockholmTrackKind(
  tag: string,
  hasProteinExclusiveResidues: boolean,
): MsaAnnotationTrackKind {
  switch (tag) {
    case "RF":
      return "rna-reference-columns";
    case "RNA_ligand":
      return "rna-ligand";
    case "RNA_motif":
      return "rna-motif";
    case "RNA_structural_elements":
      return "rna-structural-elements";
    case "SS_cons":
      return hasProteinExclusiveResidues
        ? "protein-secondary-structure"
        : "rna-secondary-structure";
    default:
      return "custom";
  }
}

export function parseStockholm(contents: string): MsaFormatDraft {
  const rowsById = new Map<string, Array<string>>();
  const order: Array<string> = [];
  const warnings: Array<MsaParseWarning> = [];
  const gcTracks = new Map<string, Array<string>>();
  const gfMetadata = new Map<string, Array<string>>();
  const gsMetadata = new Map<
    string,
    Map<string, StockholmRowMetadataValue>
  >();
  const gsMetadataOverflows = new Set<string>();
  const grTracks = new Map<
    string,
    { parts: Array<string>; rowId: string; tag: string }
  >();
  const lines = contents.split(/\r?\n/);
  let sawHeader = false;
  let sawTerminator = false;

  const firstContentLine = lines.find((line) => line.trim().length > 0)?.trim();
  if (firstContentLine !== "# STOCKHOLM 1.0") {
    warnings.push({
      code: "stockholm-header-missing",
      message: "The first non-empty Stockholm line must be # STOCKHOLM 1.0.",
      severity: "error",
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (trimmed === "# STOCKHOLM 1.0") {
      sawHeader = true;
      continue;
    }
    if (trimmed === "//") {
      sawTerminator = true;
      break;
    }
    if (trimmed.startsWith("#=GC ")) {
      const [, tag, ...valueParts] = trimmed.split(/\s+/);
      if (tag == null || valueParts.length === 0) {
        warnings.push({
          code: "stockholm-gc-skipped",
          line: lineNumber,
          message: "Skipped a malformed Stockholm GC annotation.",
        });
        continue;
      }
      const parts = gcTracks.get(tag) ?? [];
      parts.push(valueParts.join(""));
      gcTracks.set(tag, parts);
      continue;
    }
    if (trimmed.startsWith("#=GF ")) {
      const [, tag, ...valueParts] = trimmed.split(/\s+/);
      if (tag == null || valueParts.length === 0) {
        warnings.push({
          code: "stockholm-gf-skipped",
          line: lineNumber,
          message: "Skipped a malformed Stockholm GF annotation.",
          preserved: "ignored",
          severity: "warning",
        });
        continue;
      }
      const parts = gfMetadata.get(tag) ?? [];
      parts.push(valueParts.join(" "));
      gfMetadata.set(tag, parts);
      continue;
    }
    if (trimmed.startsWith("#=GS ")) {
      const [, rowId, tag, ...valueParts] = trimmed.split(/\s+/);
      if (rowId == null || tag == null || valueParts.length === 0) {
        warnings.push({
          code: "stockholm-gs-skipped",
          line: lineNumber,
          message: "Skipped a malformed Stockholm GS annotation.",
          preserved: "ignored",
          severity: "warning",
        });
        continue;
      }
      const metadata =
        gsMetadata.get(rowId) ?? new Map<string, StockholmRowMetadataValue>();
      const key = `GS:${tag}`;
      const entry: StockholmRowMetadataValue = metadata.get(key) ?? {
        byteLength: 0,
        values: [],
      };
      const value = valueParts.join(" ");
      const byteLength =
        entry.byteLength +
        (entry.values.length === 0 ? 0 : STOCKHOLM_METADATA_SEPARATOR.length) +
        utf8ByteLength(value);
      if (
        entry.values.length >= MAX_STOCKHOLM_ROW_METADATA_VALUES ||
        byteLength > SEQUENCE_VIEWER_LIMITS.context.maxTextBytes
      ) {
        const overflowKey = `${rowId}\u0000${tag}`;
        if (!gsMetadataOverflows.has(overflowKey)) {
          gsMetadataOverflows.add(overflowKey);
          warnings.push({
            code: "stockholm-gs-metadata-limit",
            line: lineNumber,
            message: `Additional Stockholm GS ${tag} annotations for ${rowId} exceed the bounded row-metadata budget.`,
            preserved: "ignored",
            severity: "warning",
          });
        }
        continue;
      }
      entry.byteLength = byteLength;
      entry.values.push(value);
      metadata.set(key, entry);
      gsMetadata.set(rowId, metadata);
      continue;
    }
    if (trimmed.startsWith("#=GR ")) {
      const [, rowId, tag, ...valueParts] = trimmed.split(/\s+/);
      if (rowId == null || tag == null || valueParts.length === 0) {
        warnings.push({
          code: "stockholm-gr-skipped",
          line: lineNumber,
          message: "Skipped a malformed Stockholm GR annotation.",
          preserved: "ignored",
          severity: "warning",
        });
        continue;
      }
      const key = `${rowId}:${tag}`;
      const track = grTracks.get(key) ?? { parts: [], rowId, tag };
      track.parts.push(valueParts.join(""));
      grTracks.set(key, track);
      continue;
    }
    if (trimmed.startsWith("#")) {
      continue;
    }

    const [id, fragment] = trimmed.split(/\s+/, 2);
    if (id == null || fragment == null) {
      warnings.push({
        code: "stockholm-row-skipped",
        line: lineNumber,
        message: "Skipped a malformed Stockholm sequence row.",
      });
      continue;
    }
    if (!rowsById.has(id)) {
      order.push(id);
      rowsById.set(id, []);
    }
    rowsById.get(id)?.push(
      Array.from(fragment)
        .map((symbol) => normalizeGapSymbol(symbol))
        .join(""),
    );
  }

  if (!sawHeader && firstContentLine === "# STOCKHOLM 1.0") {
    warnings.push({
      code: "stockholm-header-missing",
      message: "The Stockholm header was not found.",
      severity: "error",
    });
  }
  if (!sawTerminator) {
    warnings.push({
      code: "stockholm-terminator-missing",
      message: "The Stockholm terminator line was not found.",
      severity: "error",
    });
  }

  const rowWidths = new Map(
    [...rowsById.entries()].map(([id, parts]) => [id, parts.join("").length]),
  );
  const alignedWidth = rowWidths.get(order[0] ?? "") ?? 0;
  for (const [tag, parts] of gcTracks) {
    const width = parts.join("").length;
    if (width !== alignedWidth) {
      warnings.push({
        code: "stockholm-gc-width-mismatch",
        message: `Stockholm GC track ${tag} has width ${width}; alignment width is ${alignedWidth}.`,
        severity: "error",
      });
    }
  }
  for (const track of grTracks.values()) {
    const rowWidth = rowWidths.get(track.rowId);
    if (rowWidth == null) {
      warnings.push({
        code: "stockholm-gr-row-missing",
        message: `Stockholm GR track ${track.tag} references unknown row ${track.rowId}.`,
        severity: "error",
      });
    } else if (track.parts.join("").length !== rowWidth) {
      warnings.push({
        code: "stockholm-gr-width-mismatch",
        message: `Stockholm GR track ${track.rowId} ${track.tag} does not match its row width.`,
        severity: "error",
      });
    }
  }

  const hasProteinExclusiveResidues = hasStockholmProteinResidues(rowsById);
  const annotations: Array<MsaAnnotationTrack> = [...gcTracks.entries()].map(
    ([tag, parts]) => ({
      id: `stockholm-gc-${tag}`,
      kind: getStockholmTrackKind(tag, hasProteinExclusiveResidues),
      label: tag,
      metadata: { source: "GC", tag },
      values: parts.join(""),
    }),
  );
  annotations.push(
    ...[...grTracks.values()].map((track) => ({
      id: `stockholm-gr-${track.rowId}-${track.tag}`,
      kind: getStockholmTrackKind(track.tag, hasProteinExclusiveResidues),
      label: `${track.rowId} ${track.tag}`,
      metadata: {
        rowId: track.rowId,
        source: "GR",
        tag: track.tag,
      },
      values: track.parts.join(""),
    })),
  );
  return {
    annotations,
    format: "stockholm",
    metadata: Object.fromEntries(
      [...gfMetadata.entries()].map(([tag, values]) => [
        `GF:${tag}`,
        values.join(" | "),
      ]),
    ),
    rows: order.map((id) => ({
      alignedSequence: rowsById.get(id)?.join("") ?? "",
      id,
      label: id,
      ...(gsMetadata.get(id) == null
        ? {}
        : {
            metadata: Object.fromEntries(
              [...(gsMetadata.get(id) ?? [])].map(([tag, entry]) => [
                tag,
                entry.values.join(STOCKHOLM_METADATA_SEPARATOR),
              ]),
            ),
          }),
    })),
    warnings,
  };
}

function hasStockholmProteinResidues(
  rowsById: Map<string, Array<string>>,
): boolean {
  for (const fragments of rowsById.values()) {
    for (const fragment of fragments) {
      for (const symbol of fragment) {
        if (isProteinExclusiveSymbol(symbol)) {
          return true;
        }
      }
    }
  }
  return false;
}
