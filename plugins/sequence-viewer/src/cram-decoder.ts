import { CraiIndex, IndexedCramFile } from "@gmod/cram";

import { parseSequenceDocument } from "./sequence/parser";
import { MemoryFilehandle } from "./memory-filehandle";

const MAX_CRAM_WINDOW = 100_000;
const MAX_CRAM_READS = 10_000;

export type CramDecodeInput = {
  cramBytes: Uint8Array;
  end?: number;
  indexBytes: Uint8Array;
  reference?: string;
  referenceContents?: string;
  referenceFileName?: string;
  start?: number;
};

export type CramDecodeResult = {
  end: number;
  readCount: number;
  reference: string;
  sam: string;
  start: number;
  truncated: boolean;
};

export async function decodeCramWindowToSam({
  cramBytes,
  end: requestedEnd,
  indexBytes,
  reference: requestedReference,
  referenceContents,
  referenceFileName,
  start: requestedStart = 1,
}: CramDecodeInput): Promise<CramDecodeResult> {
  const referenceRecords =
    referenceContents == null
      ? []
      : parseSequenceDocument({
          contents: referenceContents,
          fileName: referenceFileName,
        }).records;
  const referenceByName = new Map(
    referenceRecords.flatMap((record) => [
      [record.id, record.sequence] as const,
      [record.sourceLabel, record.sequence] as const,
      [normalizeReference(record.id), record.sequence] as const,
      [normalizeReference(record.sourceLabel), record.sequence] as const,
    ]),
  );
  const referenceNames: Array<string> = [];
  const cram = new IndexedCramFile({
    cacheSize: Math.min(MAX_CRAM_READS * 2, 20_000),
    checkSequenceMD5: referenceRecords.length > 0,
    cramFilehandle: new MemoryFilehandle(cramBytes),
    index: new CraiIndex({
      filehandle: new MemoryFilehandle(indexBytes),
    }),
    seqFetch: async (sequenceId, start, end) => {
      const name = referenceNames[sequenceId];
      if (name == null) {
        throw new Error(`CRAM requested unknown reference sequence ID ${sequenceId}.`);
      }
      const sequence =
        referenceByName.get(name) ??
        referenceByName.get(normalizeReference(name));
      if (sequence == null) {
        throw new Error(
          `CRAM decoding requires reference ${name}. Provide referencePath pointing to a matching FASTA file.`,
        );
      }
      if (start < 1 || end < start || end > sequence.length) {
        throw new Error(
          `CRAM requested ${name}:${start}-${end}, outside the supplied ${sequence.length}-base reference.`,
        );
      }
      return sequence.slice(start - 1, end);
    },
  });
  const samHeader = await cram.cram.getSamHeader();
  const references = samHeader
    .filter(({ tag }) => tag === "SQ")
    .map(({ data }, sequenceId) => {
      const name = data.find(({ tag }) => tag === "SN")?.value;
      const rawLength = data.find(({ tag }) => tag === "LN")?.value;
      const length = Number(rawLength);
      if (name == null || !Number.isSafeInteger(length) || length <= 0) {
        throw new Error(`CRAM @SQ entry ${sequenceId + 1} is missing a valid SN or LN field.`);
      }
      referenceNames[sequenceId] = name;
      return { length, name, sequenceId };
    });
  if (references.length === 0) {
    throw new Error("CRAM header does not contain any @SQ reference entries.");
  }
  const selected = selectReference(references, requestedReference);
  const start = requestedStart;
  const end = requestedEnd ?? Math.min(selected.length, start + MAX_CRAM_WINDOW - 1);
  if (start < 1 || end < start || end > selected.length) {
    throw new Error(
      `CRAM window ${start}-${end} is outside ${selected.name} (1-${selected.length}).`,
    );
  }
  if (end - start + 1 > MAX_CRAM_WINDOW) {
    throw new Error(
      `CRAM windows are limited to ${MAX_CRAM_WINDOW.toLocaleString()} bases. Request a smaller regional window.`,
    );
  }
  const records = await cram.getRecordsForRange(
    selected.sequenceId,
    start,
    end,
    { decodeTags: true },
  );
  const retained = records.slice(0, MAX_CRAM_READS);
  const headerLines = references.map(
    ({ length, name }) => `@SQ\tSN:${sanitizeSamField(name)}\tLN:${length}`,
  );
  const samLines = retained.flatMap((record, index) => {
    if (record.isSegmentUnmapped()) return [];
    const readBases = record.getReadBases() ?? "*";
    const quality =
      record.qualityScores == null
        ? "*"
        : [...record.qualityScores]
            .map((score) => String.fromCharCode(Math.max(33, Math.min(126, score + 33))))
            .join("");
    const referenceName = referenceNames[record.sequenceId] ?? selected.name;
    const mateReference =
      record.mate == null
        ? "*"
        : referenceNames[record.mate.sequenceId] === referenceName
          ? "="
          : referenceNames[record.mate.sequenceId] ?? "*";
    const tags = Object.entries(record.tags).flatMap(([tag, value]) => {
      if (value == null || tag.length !== 2) return [];
      if (typeof value === "number") {
        return [`${sanitizeSamField(tag)}:${Number.isInteger(value) ? "i" : "f"}:${value}`];
      }
      return [
        `${sanitizeSamField(tag)}:Z:${sanitizeSamField(
          Array.isArray(value) ? value.join(",") : value,
        )}`,
      ];
    });
    return [
      [
        sanitizeSamField(record.readName ?? `cram-read-${index + 1}`),
        record.flags,
        sanitizeSamField(referenceName),
        record.alignmentStart,
        record.mappingQuality ?? 0,
        cramReadFeaturesToCigar(record.readFeatures, record.readLength),
        sanitizeSamField(mateReference),
        record.mate?.alignmentStart ?? 0,
        record.templateSize ?? record.templateLength ?? 0,
        sanitizeSamField(readBases),
        quality,
        ...tags,
      ].join("\t"),
    ];
  });
  return {
    end,
    readCount: records.length,
    reference: selected.name,
    sam: [...headerLines, ...samLines, ""].join("\n"),
    start,
    truncated: records.length > retained.length,
  };
}

export function cramReadFeaturesToCigar(
  features: ReadonlyArray<{
    code: string;
    data: number | string | [string, number] | Array<number>;
    pos: number;
  }> | undefined,
  readLength: number,
): string {
  if (readLength <= 0) return "*";
  if (features == null || features.length === 0) return `${readLength}M`;
  const operations: Array<{ code: string; length: number }> = [];
  let readPosition = 1;
  const append = (code: string, length: number): void => {
    if (length <= 0) return;
    const previous = operations.at(-1);
    if (previous?.code === code) previous.length += length;
    else operations.push({ code, length });
  };
  for (const feature of [...features].sort((left, right) => left.pos - right.pos)) {
    if (feature.code === "Q" || feature.code === "q") continue;
    const matchLength = feature.pos - readPosition;
    append("M", matchLength);
    readPosition += Math.max(0, matchLength);
    switch (feature.code) {
      case "I":
      case "i":
        append("I", typeof feature.data === "string" ? feature.data.length : 1);
        readPosition += typeof feature.data === "string" ? feature.data.length : 1;
        break;
      case "S":
        append("S", typeof feature.data === "string" ? feature.data.length : 0);
        readPosition += typeof feature.data === "string" ? feature.data.length : 0;
        break;
      case "D":
        append("D", typeof feature.data === "number" ? feature.data : 0);
        break;
      case "N":
        append("N", typeof feature.data === "number" ? feature.data : 0);
        break;
      case "H":
        append("H", typeof feature.data === "number" ? feature.data : 0);
        break;
      case "P":
        append("P", typeof feature.data === "number" ? feature.data : 0);
        break;
      case "b": {
        const length = typeof feature.data === "string" ? feature.data.length : 0;
        append("M", length);
        readPosition += length;
        break;
      }
      case "B":
      case "X":
        append("M", 1);
        readPosition += 1;
        break;
    }
  }
  append("M", readLength - readPosition + 1);
  return operations.length === 0
    ? `${readLength}M`
    : operations.map(({ code, length }) => `${length}${code}`).join("");
}

function selectReference(
  references: Array<{ length: number; name: string; sequenceId: number }>,
  selector: string | undefined,
) {
  if (selector == null) return references[0]!;
  const normalized = normalizeReference(selector);
  const matches = references.filter(
    ({ name }) => name === selector || normalizeReference(name) === normalized,
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `No CRAM reference matched ${selector}. Available references: ${references.slice(0, 100).map(({ name }) => name).join(", ")}.`
        : `More than one CRAM reference matched ${selector}. Use the exact @SQ name.`,
    );
  }
  return matches[0]!;
}

function normalizeReference(value: string): string {
  return value.toLowerCase().replace(/^chr/u, "");
}

function sanitizeSamField(value: string): string {
  return value.replaceAll(/[\t\r\n]/gu, " ");
}
