import {
  MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
  MAX_SEQUENCE_SOURCE_RANGE_BYTES,
  type ScientificSequenceDataClient,
} from "./scientific-data-client";
import type { SequenceDocument } from "../sequence/types";

const MAX_SOURCE_REPLACEMENT_INTERVALS = 4_096;
const MAX_SOURCE_REPLACEMENT_BYTES = 1024 * 1024;
const MAX_SOURCE_HEADER_BYTES = 64 * 1024;
const SUPPORTED_RESIDUE = /^[A-Za-z*.?-]$/u;

export type SequenceOriginalSourceMutation = Readonly<{
  recordNumber: number;
  recordId: string;
  edits: ReadonlyArray<
    Readonly<{
      expected: string;
      offset0: number;
      replacement: string;
    }>
  >;
}>;

export type SequenceOriginalSourceReplacementPlan = Readonly<{
  format: "fasta" | "fastq";
  mutations: ReadonlyArray<SequenceOriginalSourceMutation>;
  sourceRevision: string;
}>;

type SequenceOriginalSourceRangeClient = Pick<
  ScientificSequenceDataClient,
  "readOriginalSourceRange" | "session"
>;

/**
 * Limit original-source edits to equal-length residue substitutions in the
 * authenticated, currently visible record previews. Unloaded records, wrapped
 * lines, headers, qualities, and every other original byte remain untouched.
 */
export function createSequenceOriginalSourceReplacementPlan({
  current,
  initial,
  sourceRevision,
}: {
  current: SequenceDocument;
  initial: SequenceDocument;
  sourceRevision: string;
}): SequenceOriginalSourceReplacementPlan {
  if (/^(?:bgzf|gzip):/iu.test(sourceRevision)) {
    throw new Error(
      "Compressed original sequences require atomic recompression and index updates.",
    );
  }
  const fileName = current.fileName ?? "";
  const supportedPlainFile =
    current.format === "fasta"
      ? /\.(?:fa|faa|fas|fasta|ffn|fna|frn)$/iu.test(fileName)
      : current.format === "fastq" && /\.(?:fastq|fq)$/iu.test(fileName);
  if (!supportedPlainFile || initial.format !== current.format) {
    throw new Error(
      "Only uncompressed plaintext FASTA and FASTQ originals can be replaced.",
    );
  }

  const inventory = current.recordInventory;
  const initialInventory = initial.recordInventory;
  if (
    inventory == null ||
    initialInventory == null ||
    inventory.materializedCount !== current.records.length ||
    initialInventory.materializedCount !== initial.records.length ||
    inventory.totalCount !== initialInventory.totalCount ||
    inventory.truncated !== initialInventory.truncated ||
    current.records.length !== initial.records.length ||
    current.records.length === 0
  ) {
    throw new Error(
      "The original Sequence record inventory no longer matches its authenticated previews.",
    );
  }

  const mutations: SequenceOriginalSourceMutation[] = [];
  let intervalCount = 0;
  let changedBytes = 0;
  for (
    let recordIndex = 0;
    recordIndex < current.records.length;
    recordIndex++
  ) {
    const record = current.records[recordIndex];
    const original = initial.records[recordIndex];
    if (
      record == null ||
      original == null ||
      record.id !== original.id ||
      record.sourceLabel !== original.sourceLabel ||
      record.description !== original.description ||
      record.length !== original.length ||
      record.sequence.length !== original.sequence.length ||
      original.sequence.length !== original.length ||
      JSON.stringify(record.features) !== JSON.stringify(original.features) ||
      JSON.stringify(record.metadata) !== JSON.stringify(original.metadata) ||
      record.molecule !== original.molecule ||
      record.topology !== original.topology ||
      record.quality?.ascii !== original.quality?.ascii ||
      (current.format === "fastq" &&
        (record.quality == null ||
          record.quality.ascii.length !== record.sequence.length))
    ) {
      throw new Error(
        "Original-source replacement only supports equal-length residue edits without record, annotation, header, or quality changes.",
      );
    }

    const edits: Array<{
      expected: string;
      offset0: number;
      replacement: string;
    }> = [];
    for (let offset = 0; offset < record.sequence.length; ) {
      if (record.sequence[offset] === original.sequence[offset]) {
        offset += 1;
        continue;
      }
      const start = offset;
      while (
        offset < record.sequence.length &&
        record.sequence[offset] !== original.sequence[offset]
      ) {
        const expected = original.sequence[offset];
        const replacement = record.sequence[offset];
        if (
          expected == null ||
          replacement == null ||
          !SUPPORTED_RESIDUE.test(expected) ||
          !SUPPORTED_RESIDUE.test(replacement)
        ) {
          throw new Error(
            "Original-source replacement requires single-byte biological residues.",
          );
        }
        changedBytes += 1;
        if (changedBytes > MAX_SOURCE_REPLACEMENT_BYTES) {
          throw new Error(
            "The original Sequence edit exceeds its bounded residue budget.",
          );
        }
        offset += 1;
      }
      intervalCount += 1;
      if (intervalCount > MAX_SOURCE_REPLACEMENT_INTERVALS) {
        throw new Error(
          "The original Sequence edit exceeds its bounded interval budget.",
        );
      }
      edits.push({
        expected: original.sequence.slice(start, offset),
        offset0: start,
        replacement: record.sequence.slice(start, offset),
      });
    }
    if (edits.length > 0) {
      mutations.push({
        edits,
        recordId: original.id,
        recordNumber: recordIndex + 1,
      });
    }
  }
  if (mutations.length === 0) {
    throw new Error(
      "Only deliberate, equal-length residue substitutions can replace the original source.",
    );
  }
  return {
    format: current.format === "fasta" ? "fasta" : "fastq",
    mutations,
    sourceRevision,
  };
}

/** Stream original source bytes and patch only authenticated residue offsets. */
export async function* streamSequenceOriginalSourceReplacement({
  client,
  plan,
  signal,
}: {
  client: SequenceOriginalSourceRangeClient;
  plan: SequenceOriginalSourceReplacementPlan;
  signal?: AbortSignal;
}): AsyncGenerator<Uint8Array> {
  if (
    client.session.sourceRevision !== plan.sourceRevision ||
    /^(?:bgzf|gzip):/iu.test(plan.sourceRevision)
  ) {
    throw new Error(
      "The original Sequence source revision is compressed or has changed.",
    );
  }
  const parser = new ByteExactSequenceSourceParser(plan);
  let sourceOffset = 0n;
  let firstRange = true;
  for (;;) {
    signal?.throwIfAborted();
    if (client.session.sourceRevision !== plan.sourceRevision) {
      throw new Error("The original Sequence source revision has changed.");
    }
    const range = await client.readOriginalSourceRange({
      length: MAX_SEQUENCE_SOURCE_RANGE_BYTES,
      offsetDecimal: sourceOffset.toString(),
      signal,
    });
    if (
      firstRange &&
      range.bytes.byteLength >= 2 &&
      range.bytes[0] === 0x1f &&
      range.bytes[1] === 0x8b
    ) {
      throw new Error(
        "Compressed original sequences require atomic recompression and index updates.",
      );
    }
    firstRange = false;
    if (range.bytes.byteLength > 0) {
      const bytes = parser.consume(range.bytes);
      sourceOffset += BigInt(bytes.byteLength);
      yield bytes;
    }
    if (range.eof) {
      parser.finish();
      return;
    }
  }
}

/** Coalesce authenticated source fragments into bounded, exact-offset writes. */
export async function* sequenceOriginalSourceUploadChunks({
  maxChunkBytes,
  signal,
  source,
}: {
  maxChunkBytes: number;
  signal?: AbortSignal;
  source: AsyncIterable<Uint8Array>;
}): AsyncGenerator<{ bytes: Uint8Array; offsetDecimal: string }> {
  if (
    !Number.isSafeInteger(maxChunkBytes) ||
    maxChunkBytes <= 0 ||
    maxChunkBytes > MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES
  ) {
    throw new Error("The original Sequence upload chunk limit is not safe.");
  }
  let offset = 0n;
  let buffered = new Uint8Array(maxChunkBytes);
  let bufferedLength = 0;
  for await (const fragment of source) {
    signal?.throwIfAborted();
    if (
      !ArrayBuffer.isView(fragment) ||
      Object.prototype.toString.call(fragment) !== "[object Uint8Array]" ||
      fragment.byteLength === 0 ||
      fragment.byteLength > MAX_SEQUENCE_SOURCE_RANGE_BYTES
    ) {
      throw new Error("The original Sequence source fragment is not bounded.");
    }
    let fragmentOffset = 0;
    while (fragmentOffset < fragment.byteLength) {
      signal?.throwIfAborted();
      const length = Math.min(
        buffered.byteLength - bufferedLength,
        fragment.byteLength - fragmentOffset,
      );
      buffered.set(
        fragment.subarray(fragmentOffset, fragmentOffset + length),
        bufferedLength,
      );
      bufferedLength += length;
      fragmentOffset += length;
      if (bufferedLength === buffered.byteLength) {
        yield { bytes: buffered, offsetDecimal: offset.toString() };
        offset += BigInt(bufferedLength);
        buffered = new Uint8Array(maxChunkBytes);
        bufferedLength = 0;
      }
    }
  }
  if (bufferedLength > 0) {
    yield {
      bytes: buffered.slice(0, bufferedLength),
      offsetDecimal: offset.toString(),
    };
  }
}

type SourceParserState =
  | "fasta-expect-header"
  | "fasta-header"
  | "fasta-sequence"
  | "fastq-expect-header"
  | "fastq-header"
  | "fastq-sequence"
  | "fastq-plus"
  | "fastq-quality"
  | "fastq-quality-complete";

class ByteExactSequenceSourceParser {
  private state: SourceParserState;
  private lineStart = true;
  private recordNumber = 0;
  private sequenceOffset = 0n;
  private qualityOffset = 0n;
  private readonly header: number[] = [];
  private mutationIndex = 0;
  private editIndex = 0;
  private editCharacter = 0;
  private passthrough = false;

  constructor(private readonly plan: SequenceOriginalSourceReplacementPlan) {
    this.state =
      plan.format === "fasta" ? "fasta-expect-header" : "fastq-expect-header";
  }

  consume(input: Uint8Array): Uint8Array {
    if (this.passthrough) return input;
    const output = input.slice();
    for (let index = 0; index < output.byteLength; index++) {
      if (this.passthrough) break;
      this.consumeByte(output, index);
    }
    return output;
  }

  finish(): void {
    if (this.passthrough) return;
    if (this.state === "fastq-quality-complete") {
      this.finishFastqRecord();
    }
    if (this.mutationIndex !== this.plan.mutations.length) {
      throw new Error(
        "The original Sequence source ended before every residue edit was verified.",
      );
    }
    if (
      this.state === "fastq-header" ||
      this.state === "fastq-sequence" ||
      this.state === "fastq-plus" ||
      this.state === "fastq-quality"
    ) {
      throw new Error("The original FASTQ record has incomplete quality data.");
    }
  }

  private consumeByte(output: Uint8Array, index: number): void {
    const value = output[index];
    if (value == null) return;
    switch (this.state) {
      case "fasta-expect-header":
      case "fastq-expect-header": {
        if (value === 0x0a || value === 0x0d) return;
        const marker = this.state === "fasta-expect-header" ? 0x3e : 0x40;
        if (value !== marker) {
          throw new Error(
            "The original Sequence source has an invalid record header.",
          );
        }
        this.beginHeader();
        return;
      }
      case "fasta-header":
      case "fastq-header": {
        if (value === 0x0a) {
          this.finishHeader();
          return;
        }
        this.header.push(value);
        if (this.header.length > MAX_SOURCE_HEADER_BYTES) {
          throw new Error(
            "The original Sequence record header exceeds its bounded size.",
          );
        }
        return;
      }
      case "fasta-sequence": {
        if (value === 0x0a) {
          this.lineStart = true;
          return;
        }
        if (value === 0x0d) return;
        if (this.lineStart && value === 0x3e) {
          this.assertCurrentRecordComplete();
          this.beginHeader();
          return;
        }
        this.lineStart = false;
        this.patchResidue(output, index);
        if (
          this.mutationIndex === this.plan.mutations.length &&
          this.editIndex === 0
        ) {
          this.passthrough = true;
        }
        return;
      }
      case "fastq-sequence": {
        if (value === 0x0a) {
          this.lineStart = true;
          return;
        }
        if (value === 0x0d) return;
        if (this.lineStart && value === 0x2b) {
          this.assertCurrentRecordComplete();
          this.state = "fastq-plus";
          this.lineStart = false;
          return;
        }
        this.lineStart = false;
        this.patchResidue(output, index);
        return;
      }
      case "fastq-plus": {
        if (value === 0x0a) {
          this.state =
            this.sequenceOffset === 0n
              ? "fastq-quality-complete"
              : "fastq-quality";
          this.qualityOffset = 0n;
          this.lineStart = true;
        }
        return;
      }
      case "fastq-quality": {
        if (value === 0x0a || value === 0x0d) return;
        this.qualityOffset += 1n;
        if (this.qualityOffset > this.sequenceOffset) {
          throw new Error(
            "The original FASTQ quality exceeds its sequence length.",
          );
        }
        if (this.qualityOffset === this.sequenceOffset) {
          this.state = "fastq-quality-complete";
        }
        return;
      }
      case "fastq-quality-complete": {
        if (value === 0x0d) return;
        if (value !== 0x0a) {
          throw new Error(
            "The original FASTQ quality exceeds its sequence length.",
          );
        }
        this.finishFastqRecord();
        return;
      }
    }
  }

  private beginHeader(): void {
    this.recordNumber += 1;
    this.sequenceOffset = 0n;
    this.qualityOffset = 0n;
    this.header.length = 0;
    this.editIndex = 0;
    this.editCharacter = 0;
    this.lineStart = false;
    this.state = this.plan.format === "fasta" ? "fasta-header" : "fastq-header";
  }

  private finishHeader(): void {
    if (this.header.at(-1) === 0x0d) this.header.pop();
    const header = new TextDecoder("utf-8", { fatal: true }).decode(
      new Uint8Array(this.header),
    );
    const match = /^\s*(\S+)(?:\s+(.*))?$/u.exec(header);
    if (match == null) {
      throw new Error(
        "The original Sequence source has an invalid record header.",
      );
    }
    const expected = this.plan.mutations[this.mutationIndex];
    if (
      expected != null &&
      expected.recordNumber === this.recordNumber &&
      expected.recordId !== match[1]
    ) {
      throw new Error("The original Sequence record identity has changed.");
    }
    this.lineStart = true;
    this.state =
      this.plan.format === "fasta" ? "fasta-sequence" : "fastq-sequence";
  }

  private patchResidue(output: Uint8Array, index: number): void {
    const mutation = this.plan.mutations[this.mutationIndex];
    if (mutation?.recordNumber === this.recordNumber) {
      const edit = mutation.edits[this.editIndex];
      if (
        edit != null &&
        this.sequenceOffset === BigInt(edit.offset0 + this.editCharacter)
      ) {
        const expected = edit.expected.charCodeAt(this.editCharacter);
        if (output[index] !== expected) {
          throw new Error(
            "The original Sequence residue changed before replacement.",
          );
        }
        output[index] = edit.replacement.charCodeAt(this.editCharacter);
        this.editCharacter += 1;
        if (this.editCharacter === edit.expected.length) {
          this.editIndex += 1;
          this.editCharacter = 0;
          if (this.editIndex === mutation.edits.length) {
            this.mutationIndex += 1;
            this.editIndex = 0;
          }
        }
      }
    }
    this.sequenceOffset += 1n;
  }

  private assertCurrentRecordComplete(): void {
    const next = this.plan.mutations[this.mutationIndex];
    if (next?.recordNumber === this.recordNumber) {
      throw new Error(
        "The original Sequence record ended before all expected residues were found.",
      );
    }
  }

  private finishFastqRecord(): void {
    this.assertCurrentRecordComplete();
    this.state = "fastq-expect-header";
    this.lineStart = true;
    if (this.mutationIndex === this.plan.mutations.length) {
      this.passthrough = true;
    }
  }
}
