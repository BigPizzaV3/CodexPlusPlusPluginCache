import type { MsaMotifSearchHit } from "../msa/search";
import type { MsaSequenceRow } from "../msa/types";
import { getSelectionSegments } from "../sequence/selection";
import type {
  SequenceDocument,
  SequenceRecord,
  SequenceSelection,
} from "../sequence/types";
import { neutralizeSpreadsheetFormula } from "../spreadsheet-safety";
import type { SequenceWorkspaceChunkProducer } from "./workspace-artifact-stream";

export function createFastaWorkspaceProducer(
  records: ReadonlyArray<SequenceRecord>,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      const record = records[recordIndex]!;
      if (recordIndex > 0) yield "\n";
      yield `>${record.sourceLabel}${record.description == null ? "" : ` ${record.description}`}\n`;
      yield* wrapSequenceFragments([record.sequence]);
    }
  };
}

export function createSelectedFastaWorkspaceProducer(
  document: SequenceDocument,
  selection: SequenceSelection,
): SequenceWorkspaceChunkProducer {
  const record = document.records.find(({ id }) => id === selection.recordId);
  if (record == null) {
    throw new Error("Selected sequence record could not be found.");
  }
  const range =
    selection.segments == null
      ? `${selection.start}-${selection.end}`
      : selection.segments
          .map(({ end, start }) => `${start}-${end}`)
          .join(",");
  return async function* () {
    yield `>${record.sourceLabel}:${range}\n`;
    yield* wrapSequenceRanges(record.sequence, getSelectionSegments(selection));
  };
}

export function createFastqWorkspaceProducer(
  record: SequenceRecord,
): SequenceWorkspaceChunkProducer {
  if (record.quality == null) {
    throw new Error("Selected record does not include FASTQ quality.");
  }
  return async function* () {
    yield `@${record.sourceLabel}\n`;
    yield record.sequence;
    yield "\n+\n";
    yield record.quality!.ascii;
  };
}

export function createAlignedFastaWorkspaceProducer(
  rows: ReadonlyArray<MsaSequenceRow>,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      if (index > 0) yield "\n";
      yield `>${row.label}\n`;
      yield row.alignedSequence;
    }
  };
}

export function createReferenceFastaWorkspaceProducer({
  label,
  sequence,
}: {
  label: string;
  sequence: string;
}): SequenceWorkspaceChunkProducer {
  return async function* () {
    yield `>${label}\n`;
    yield sequence;
  };
}

export function createSearchHitsTsvWorkspaceProducer(
  hits: ReadonlyArray<MsaMotifSearchHit>,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    yield "row_label\torientation\talignment_start\talignment_end\tungapped_start\tungapped_end";
    for (const hit of hits) {
      yield "\n";
      yield* escapeTsvFragments(neutralizeSpreadsheetFormula(hit.rowLabel));
      yield "\t";
      yield [
        hit.orientation,
        hit.alignmentStartColumn + 1,
        hit.alignmentEndColumn + 1,
        hit.ungappedStartPosition,
        hit.ungappedEndPosition,
      ].join("\t");
    }
  };
}

export function createDelimitedWorkspaceProducer(
  rows: Iterable<ReadonlyArray<string | number>>,
  delimiter: "," | "\t",
): SequenceWorkspaceChunkProducer {
  return async function* () {
    let first = true;
    for (const row of rows) {
      if (!first) yield "\n";
      first = false;
      for (let index = 0; index < row.length; index += 1) {
        if (index > 0) yield delimiter;
        const cell = row[index];
        const value =
          typeof cell === "string"
            ? neutralizeSpreadsheetFormula(cell)
            : String(cell ?? "");
        if (delimiter === ",") yield* escapeCsvFragments(value);
        else yield* escapeTsvFragments(value);
      }
    }
  };
}

export function createVisibleRangeSvgWorkspaceProducer({
  endColumn,
  rows,
  startColumn,
}: {
  endColumn: number;
  rows: ReadonlyArray<MsaSequenceRow>;
  startColumn: number;
}): SequenceWorkspaceChunkProducer {
  return async function* () {
    const rowHeight = 18;
    const labelWidth = 180;
    const cellWidth = 11;
    const fontSize = 11;
    const visibleColumnCount = Math.max(0, endColumn - startColumn);
    const width = labelWidth + visibleColumnCount * cellWidth + 16;
    const height = Math.max(rowHeight, rows.length * rowHeight + 18);
    yield `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    yield '<rect width="100%" height="100%" fill="white"/>';
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!;
      const y = 18 + rowIndex * rowHeight;
      yield `<text x="8" y="${y}" font-family="monospace" font-size="${fontSize}">`;
      yield* escapeXmlFragments(row.label);
      yield `</text><text x="${labelWidth}" y="${y}" font-family="monospace" font-size="${fontSize}">`;
      yield* escapeXmlFragments(
        row.alignedSequence,
        startColumn,
        endColumn,
      );
      yield "</text>";
    }
    yield "</svg>";
  };
}

export function createNewickWorkspaceProducer(
  newick: string,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    yield newick.trim().replace(/;?$/u, ";");
    yield "\n";
  };
}

export function createJsonWorkspaceProducer(
  value: unknown,
  indent = 2,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    yield* jsonFragments(value, indent, 0, new WeakSet<object>(), false);
  };
}

async function* wrapSequenceFragments(
  segments: ReadonlyArray<string>,
): AsyncGenerator<string> {
  let line = "";
  let wroteLine = false;
  for (const segment of segments) {
    for (let offset = 0; offset < segment.length; ) {
      const take = Math.min(80 - line.length, segment.length - offset);
      line += segment.slice(offset, offset + take);
      offset += take;
      if (line.length === 80) {
        if (wroteLine) yield "\n";
        yield line;
        wroteLine = true;
        line = "";
      }
    }
  }
  if (line.length > 0) {
    if (wroteLine) yield "\n";
    yield line;
  }
}

async function* wrapSequenceRanges(
  sequence: string,
  ranges: ReadonlyArray<{ end: number; start: number }>,
): AsyncGenerator<string> {
  let line = "";
  let wroteLine = false;
  for (const range of ranges) {
    let offset = range.start - 1;
    while (offset < range.end) {
      const take = Math.min(80 - line.length, range.end - offset);
      line += sequence.slice(offset, offset + take);
      offset += take;
      if (line.length === 80) {
        if (wroteLine) yield "\n";
        yield line;
        wroteLine = true;
        line = "";
      }
    }
  }
  if (line.length > 0) {
    if (wroteLine) yield "\n";
    yield line;
  }
}

async function* escapeXmlFragments(
  value: string,
  start = 0,
  end = value.length,
): AsyncGenerator<string> {
  for (let offset = start; offset < end; offset += 4_096) {
    yield value
      .slice(offset, Math.min(end, offset + 4_096))
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
}

async function* jsonFragments(
  value: unknown,
  indent: number,
  depth: number,
  ancestors: WeakSet<object>,
  arrayValue: boolean,
): AsyncGenerator<string> {
  if (value == null || typeof value === "boolean") {
    yield String(value);
    return;
  }
  if (typeof value === "number") {
    yield Number.isFinite(value) ? String(value) : "null";
    return;
  }
  if (typeof value === "string") {
    yield* jsonStringFragments(value);
    return;
  }
  if (typeof value !== "object") {
    if (arrayValue) yield "null";
    return;
  }
  if (ancestors.has(value)) throw new TypeError("Converting circular structure to JSON");
  ancestors.add(value);
  const padding = " ".repeat(indent * depth);
  const childPadding = " ".repeat(indent * (depth + 1));
  if (Array.isArray(value)) {
    yield "[";
    for (let index = 0; index < value.length; index += 1) {
      yield index === 0 ? `\n${childPadding}` : `,\n${childPadding}`;
      yield* jsonFragments(value[index], indent, depth + 1, ancestors, true);
    }
    if (value.length > 0) yield `\n${padding}`;
    yield "]";
  } else {
    const entries = Object.entries(value).filter(
      ([, entry]) =>
        entry !== undefined &&
        typeof entry !== "function" &&
        typeof entry !== "symbol",
    );
    yield "{";
    for (let index = 0; index < entries.length; index += 1) {
      const [key, entry] = entries[index]!;
      yield index === 0 ? `\n${childPadding}` : `,\n${childPadding}`;
      yield* jsonStringFragments(key);
      yield ": ";
      yield* jsonFragments(entry, indent, depth + 1, ancestors, false);
    }
    if (entries.length > 0) yield `\n${padding}`;
    yield "}";
  }
  ancestors.delete(value);
}

async function* jsonStringFragments(value: string): AsyncGenerator<string> {
  yield '"';
  let fragment = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    let encoded: string;
    if (code === 0x22) encoded = '\\"';
    else if (code === 0x5c) encoded = "\\\\";
    else if (code === 0x08) encoded = "\\b";
    else if (code === 0x0c) encoded = "\\f";
    else if (code === 0x0a) encoded = "\\n";
    else if (code === 0x0d) encoded = "\\r";
    else if (code === 0x09) encoded = "\\t";
    else if (code < 0x20) encoded = `\\u${code.toString(16).padStart(4, "0")}`;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        encoded = value.slice(index, index + 2);
        index += 1;
      } else encoded = `\\u${code.toString(16)}`;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      encoded = `\\u${code.toString(16)}`;
    } else encoded = value[index]!;
    fragment += encoded;
    if (fragment.length >= 4_096) {
      yield fragment;
      fragment = "";
    }
  }
  if (fragment.length > 0) yield fragment;
  yield '"';
}

async function* escapeCsvFragments(value: string): AsyncGenerator<string> {
  const quoted = /[",\r\n]/u.test(value);
  if (quoted) yield '"';
  for (let offset = 0; offset < value.length; offset += 4_096) {
    const fragment = value.slice(offset, offset + 4_096);
    yield quoted ? fragment.replaceAll('"', '""') : fragment;
  }
  if (quoted) yield '"';
}

async function* escapeTsvFragments(value: string): AsyncGenerator<string> {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "\r" && value[index + 1] === "\n") {
      output += " ";
      index += 1;
    } else if (
      character === "\r" ||
      character === "\n" ||
      character === "\t"
    ) {
      output += " ";
    } else output += character;
    if (output.length >= 4_096) {
      yield output;
      output = "";
    }
  }
  if (output.length > 0) yield output;
}
