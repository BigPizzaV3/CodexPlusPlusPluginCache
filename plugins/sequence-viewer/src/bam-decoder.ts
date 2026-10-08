import { BamFile, type BamRecord } from "@gmod/bam";

import { MemoryFilehandle } from "./memory-filehandle";

const MAX_BAM_WINDOW = 100_000;
const MAX_BAM_READS = 10_000;

export type BamDecodeInput = {
  bamBytes: Uint8Array;
  end?: number;
  indexBytes: Uint8Array;
  indexFormat?: "bai" | "csi";
  reference?: string;
  start?: number;
};

export type BamDecodeResult = {
  end: number;
  readCount: number;
  reference: string;
  sam: string;
  start: number;
  truncated: boolean;
};

export async function decodeBamWindowToSam({
  bamBytes,
  end: requestedEnd,
  indexBytes,
  indexFormat = "bai",
  reference: requestedReference,
  start: requestedStart = 1,
}: BamDecodeInput): Promise<BamDecodeResult> {
  const indexFilehandle = new MemoryFilehandle(indexBytes);
  const bam = new BamFile({
    bamFilehandle: new MemoryFilehandle(bamBytes),
    ...(indexFormat === "csi"
      ? { csiFilehandle: indexFilehandle }
      : { baiFilehandle: indexFilehandle }),
  });
  await bam.getHeader();
  const references = (bam.indexToChr ?? []).map(({ length, refName }, index) => ({
    index,
    length,
    name: refName,
  }));
  if (references.length === 0) {
    throw new Error("BAM header does not contain any reference entries.");
  }
  const selected = selectReference(references, requestedReference);
  const start = requestedStart;
  const end = requestedEnd ?? Math.min(selected.length, start + MAX_BAM_WINDOW - 1);
  if (start < 1 || end < start || end > selected.length) {
    throw new Error(
      `BAM window ${start}-${end} is outside ${selected.name} (1-${selected.length}).`,
    );
  }
  if (end - start + 1 > MAX_BAM_WINDOW) {
    throw new Error(
      `BAM windows are limited to ${MAX_BAM_WINDOW.toLocaleString()} bases. Request a smaller regional window.`,
    );
  }
  const records = await bam.getRecordsForRange(
    selected.name,
    start - 1,
    end,
  );
  const retained = records.slice(0, MAX_BAM_READS);
  return {
    end,
    readCount: records.length,
    reference: selected.name,
    sam: [
      ...references.map(
        ({ length, name }) =>
          `@SQ\tSN:${sanitizeSamField(name)}\tLN:${length}`,
      ),
      ...retained.flatMap((record) => bamRecordToSam(record, references)),
      "",
    ].join("\n"),
    start,
    truncated: records.length > retained.length,
  };
}

function bamRecordToSam(
  record: BamRecord,
  references: Array<{ index: number; length: number; name: string }>,
): Array<string> {
  if (record.isSegmentUnmapped()) return [];
  const reference = references[record.ref_id]?.name;
  if (reference == null) return [];
  const mateReference =
    record.next_refid < 0
      ? "*"
      : record.next_refid === record.ref_id
        ? "="
        : references[record.next_refid]?.name ?? "*";
  const quality = record.qual;
  const qualityText =
    quality == null || [...quality].every((score) => score === 255)
      ? "*"
      : [...quality]
          .map((score) =>
            String.fromCharCode(Math.max(33, Math.min(126, score + 33))),
          )
          .join("");
  const tags = Object.entries(record.tags).flatMap(([tag, value]) => {
    if (value == null || tag.length !== 2) return [];
    if (typeof value === "number") {
      return [`${sanitizeSamField(tag)}:${Number.isInteger(value) ? "i" : "f"}:${value}`];
    }
    return [
      `${sanitizeSamField(tag)}:Z:${sanitizeSamField(
        Array.isArray(value) ? value.join(",") : String(value),
      )}`,
    ];
  });
  return [
    [
      sanitizeSamField(record.name),
      record.flags,
      sanitizeSamField(reference),
      record.start + 1,
      record.mq ?? 0,
      record.CIGAR || "*",
      sanitizeSamField(mateReference),
      record.next_pos < 0 ? 0 : record.next_pos + 1,
      record.template_length,
      sanitizeSamField(record.seq || "*"),
      qualityText,
      ...tags,
    ].join("\t"),
  ];
}

function selectReference(
  references: Array<{ index: number; length: number; name: string }>,
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
        ? `No BAM reference matched ${selector}. Available references: ${references.slice(0, 100).map(({ name }) => name).join(", ")}.`
        : `More than one BAM reference matched ${selector}. Use the exact @SQ name.`,
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
