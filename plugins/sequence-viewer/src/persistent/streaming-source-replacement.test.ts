import { describe, expect, it, vi } from "vitest";

import { parseSequenceDocument } from "../sequence/parser";
import type { SequenceDocument } from "../sequence/types";
import {
  MAX_SEQUENCE_SOURCE_RANGE_BYTES,
  type ScientificSequenceDataClient,
} from "./scientific-data-client";
import {
  createSequenceOriginalSourceReplacementPlan,
  sequenceOriginalSourceUploadChunks,
  streamSequenceOriginalSourceReplacement,
} from "./streaming-source-replacement";

const sourceRevision = "authenticated-plaintext-revision";

describe("byte-exact native original Sequence replacement", () => {
  it("preserves irregular FASTA headers, wrapped CRLF, unseen records, and a missing terminal newline", async () => {
    const original =
      ">first  exact header\r\nAC\r\nGT\n>unseen  original metadata\r\nNN\r\nAA";
    const initial = sequenceDocument(
      ">first  exact header\nACGT\n",
      "large.fasta",
      { totalCount: 33, truncated: true },
    );
    const current = substituteResidue(initial, 0, 2, "A");
    const client = sourceRangeClient(original, { maxResponseBytes: 3 });
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    expect(await collectOriginalSource(client, plan)).toBe(
      ">first  exact header\r\nAC\r\nAT\n>unseen  original metadata\r\nNN\r\nAA",
    );
    expect(client.readOriginalSourceRange).toHaveBeenCalledWith(
      expect.objectContaining({
        length: MAX_SEQUENCE_SOURCE_RANGE_BYTES,
        offsetDecimal: "0",
      }),
    );
  });

  it("edits only FASTQ sequence bytes while preserving wrapped +/@ qualities and plus metadata", async () => {
    const original =
      "@read-one exact header\r\nAC\r\nGT\r\n+keep this metadata\r\n@+\r\n!#\r\n@hidden\nNN\n+hidden\n+@";
    const initial = sequenceDocument(
      "@read-one exact header\nACGT\n+\n@+!#\n",
      "reads.fastq",
      { totalCount: 34, truncated: true },
    );
    const current = substituteResidue(initial, 0, 1, "T");
    const client = sourceRangeClient(original, { maxResponseBytes: 7 });
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    expect(await collectOriginalSource(client, plan)).toBe(
      "@read-one exact header\r\nAT\r\nGT\r\n+keep this metadata\r\n@+\r\n!#\r\n@hidden\nNN\n+hidden\n+@",
    );
  });

  it("retains >65,536-residue tails and 33 unloaded FASTA records without materializing them", async () => {
    const preview = "A".repeat(65_536);
    const sourceTail = "C".repeat(19);
    const unseen = Array.from(
      { length: 33 },
      (_, index) => `>unloaded-${index}\r\nT${index % 10}\n`,
    ).join("");
    const original = `>first exact header\r\n${preview}\r\n${sourceTail}\n${unseen}`;
    const initial = sequenceDocument(
      `>first exact header\n${preview}\n`,
      "gigantic.fa",
      { totalCount: 34, truncated: true },
    );
    const current = substituteResidue(initial, 0, 65_535, "G");
    const client = sourceRangeClient(original, { maxResponseBytes: 13_117 });
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    expect(await collectOriginalSource(client, plan)).toBe(
      `>first exact header\r\n${"A".repeat(65_535)}G\r\n${sourceTail}\n${unseen}`,
    );
  });

  it("handles residue and CRLF boundaries crossing authenticated 256-KiB source windows", async () => {
    const description = "d".repeat(64 * 1024 - 10);
    const prefix = "A\r\n".repeat(65_535);
    const original = `>first ${description}\r\n${prefix}C\r\nunchanged-tail`;
    const initial = sequenceDocument(
      `>first ${description}\n${"A".repeat(65_535)}C\n`,
      "boundary.fasta",
      { totalCount: 1, truncated: true },
    );
    const current = substituteResidue(initial, 0, 65_535, "G");
    const client = sourceRangeClient(original, {
      maxResponseBytes: MAX_SEQUENCE_SOURCE_RANGE_BYTES,
    });
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    expect(await collectOriginalSource(client, plan)).toBe(
      `>first ${description}\r\n${prefix}G\r\nunchanged-tail`,
    );
    expect(client.readOriginalSourceRange.mock.calls.length).toBeGreaterThan(1);
    expect(
      client.readOriginalSourceRange.mock.calls.some(
        ([request]) =>
          BigInt(request.offsetDecimal) >=
          BigInt(MAX_SEQUENCE_SOURCE_RANGE_BYTES),
      ),
    ).toBe(true);
  });

  it("fails closed on a source revision change between bounded source reads", async () => {
    const original = ">record\nACGT\n";
    const initial = sequenceDocument(original, "record.fa");
    const current = substituteResidue(initial, 0, 0, "T");
    const client = sourceRangeClient(original, { maxResponseBytes: 3 });
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });
    const stream = streamSequenceOriginalSourceReplacement({ client, plan });
    await expect(stream.next()).resolves.toMatchObject({ done: false });
    client.session = {
      ...client.session,
      sourceRevision: "substituted-source",
    };

    await expect(stream.next()).rejects.toThrow(/revision.*changed/iu);
  });

  it("rejects renamed gzip/BGZF logical revisions and gzip magic before producing replacement bytes", async () => {
    const initial = sequenceDocument(">record\nACGT\n", "renamed.fa");
    const current = substituteResidue(initial, 0, 0, "T");
    for (const compressedRevision of ["gzip:abc", "bgzf:def"]) {
      expect(() =>
        createSequenceOriginalSourceReplacementPlan({
          current,
          initial,
          sourceRevision: compressedRevision,
        }),
      ).toThrow(/compressed|recompression/iu);
    }
    const client = sourceRangeClient(new Uint8Array([0x1f, 0x8b, 0x08, 0]));
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    await expect(collectOriginalSource(client, plan)).rejects.toThrow(
      /compressed|recompression/iu,
    );
  });

  it("rejects inserted residues, edited annotations, changed qualities, unsupported names, and substituted headers", async () => {
    const initial = sequenceDocument("@record\nACGT\n+\n!@+#\n", "reads.fastq");
    const edited = substituteResidue(initial, 0, 0, "T");
    const base = edited.records[0];
    if (base == null) throw new Error("Expected a materialized record.");
    const invalidDocuments: SequenceDocument[] = [
      { ...edited, fileName: "reads.fastq.gz" },
      {
        ...edited,
        records: [{ ...base, sequence: `${base.sequence}A` }],
      },
      {
        ...edited,
        records: [{ ...base, features: [{ id: "changed" } as never] }],
      },
      {
        ...edited,
        records: [
          {
            ...base,
            quality:
              base.quality == null
                ? undefined
                : { ...base.quality, ascii: "####" },
          },
        ],
      },
      {
        ...edited,
        records: [{ ...base, description: "changed header" }],
      },
    ];
    for (const current of invalidDocuments) {
      expect(() =>
        createSequenceOriginalSourceReplacementPlan({
          current,
          initial,
          sourceRevision,
        }),
      ).toThrow(/uncompressed|equal.length|quality|header|annotation/iu);
    }
    const plan = createSequenceOriginalSourceReplacementPlan({
      current: edited,
      initial,
      sourceRevision,
    });
    const substituted = sourceRangeClient("@another\nACGT\n+\n!@+#\n");
    await expect(collectOriginalSource(substituted, plan)).rejects.toThrow(
      /identity.*changed/iu,
    );
  });

  it("refuses truncated FASTQ qualities even when a target residue was already patched", async () => {
    const initial = sequenceDocument("@record\nACGT\n+\n!!!!\n", "reads.fq");
    const current = substituteResidue(initial, 0, 0, "T");
    const plan = createSequenceOriginalSourceReplacementPlan({
      current,
      initial,
      sourceRevision,
    });

    await expect(
      collectOriginalSource(sourceRangeClient("@record\nACGT\n+\n!!"), plan),
    ).rejects.toThrow(/quality/iu);
  });

  it("coalesces authenticated source fragments into exact bounded destination offsets", async () => {
    const source = (async function* () {
      yield new Uint8Array([1, 2, 3]);
      yield new Uint8Array([4, 5, 6, 7]);
      yield new Uint8Array([8, 9]);
    })();
    const chunks = [];
    for await (const chunk of sequenceOriginalSourceUploadChunks({
      maxChunkBytes: 4,
      source,
    })) {
      chunks.push({
        bytes: Array.from(chunk.bytes),
        offsetDecimal: chunk.offsetDecimal,
      });
    }

    expect(chunks).toEqual([
      { bytes: [1, 2, 3, 4], offsetDecimal: "0" },
      { bytes: [5, 6, 7, 8], offsetDecimal: "4" },
      { bytes: [9], offsetDecimal: "8" },
    ]);
  });
});

function sequenceDocument(
  contents: string,
  fileName: string,
  options?: { totalCount?: number; truncated?: boolean },
): SequenceDocument {
  const document = parseSequenceDocument({ contents, fileName });
  return {
    ...document,
    recordInventory: {
      materializedCount: document.records.length,
      totalCount: options?.totalCount ?? document.records.length,
      truncated: options?.truncated ?? false,
    },
  };
}

function substituteResidue(
  document: SequenceDocument,
  recordNumber: number,
  offset: number,
  replacement: string,
): SequenceDocument {
  return {
    ...document,
    records: document.records.map((record, index) =>
      index === recordNumber
        ? {
            ...record,
            sequence:
              record.sequence.slice(0, offset) +
              replacement +
              record.sequence.slice(offset + 1),
          }
        : record,
    ),
  };
}

function sourceRangeClient(
  contents: string | Uint8Array,
  options?: { maxResponseBytes?: number },
) {
  const source =
    typeof contents === "string"
      ? new TextEncoder().encode(contents)
      : contents;
  const client: Pick<ScientificSequenceDataClient, "session"> & {
    readOriginalSourceRange: ReturnType<
      typeof vi.fn<ScientificSequenceDataClient["readOriginalSourceRange"]>
    >;
    session: ScientificSequenceDataClient["session"];
  } = {
    session: {
      backendGeneration: 1,
      backendInstanceId: "authenticated-sequence-worker",
      canEditApprovedSource: true,
      family: "sequence",
      logicalSessionId: "authenticated-logical-session",
      sourceRevision,
    },
    readOriginalSourceRange: vi.fn(async ({ offsetDecimal, length }) => {
      const start = Number(BigInt(offsetDecimal));
      const bytes = source.slice(
        start,
        start + Math.min(length, options?.maxResponseBytes ?? length),
      );
      return { bytes, eof: start + bytes.byteLength >= source.byteLength };
    }),
  };
  return client;
}

async function collectOriginalSource(
  client: Pick<
    ScientificSequenceDataClient,
    "readOriginalSourceRange" | "session"
  >,
  plan: ReturnType<typeof createSequenceOriginalSourceReplacementPlan>,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of streamSequenceOriginalSourceReplacement({
    client,
    plan,
  })) {
    chunks.push(chunk);
    totalBytes += chunk.byteLength;
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
