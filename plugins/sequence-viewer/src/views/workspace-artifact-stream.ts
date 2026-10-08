import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";

export type SequenceWorkspaceChunkProducer = () => AsyncIterable<
  string | Uint8Array
>;

const PRODUCER_FRAGMENT_BYTES = 64 * 1_024;

export async function measureSequenceWorkspaceProducer(
  createChunks: SequenceWorkspaceChunkProducer,
  signal?: AbortSignal,
): Promise<{ byteLength: number; peakRetainedBytes: number; sha256: string }> {
  const digest = new IncrementalSha256();
  let byteLength = 0;
  let peakRetainedBytes = 0;
  for await (const chunk of boundedProducerBytes(createChunks, signal)) {
    byteLength += chunk.byteLength;
    if (!Number.isSafeInteger(byteLength)) {
      throw new Error("The workspace export is too large to measure safely.");
    }
    digest.update(chunk);
    peakRetainedBytes = Math.max(peakRetainedBytes, chunk.byteLength);
  }
  return { byteLength, peakRetainedBytes, sha256: digest.digestHex() };
}

export async function* sequenceWorkspaceUploadChunks(
  createChunks: SequenceWorkspaceChunkProducer,
  {
    maxChunkBytes,
    signal,
    startOffset,
    totalBytes,
  }: {
    maxChunkBytes: number;
    signal?: AbortSignal;
    startOffset: number;
    totalBytes: number;
  },
): AsyncGenerator<{ bytes: Uint8Array; offset: number }> {
  if (
    startOffset < 0 ||
    startOffset > totalBytes ||
    (startOffset < totalBytes && startOffset % maxChunkBytes !== 0)
  ) {
    throw new Error("The server returned an invalid resumable offset.");
  }
  let produced = 0;
  let outputOffset = startOffset;
  let output = new Uint8Array(maxChunkBytes);
  let outputLength = 0;
  for await (const source of boundedProducerBytes(createChunks, signal)) {
    let sourceOffset = 0;
    if (produced + source.byteLength <= startOffset) {
      produced += source.byteLength;
      continue;
    }
    if (produced < startOffset) {
      sourceOffset = startOffset - produced;
      produced = startOffset;
    }
    while (sourceOffset < source.byteLength) {
      throwIfAborted(signal);
      const copied = Math.min(
        output.byteLength - outputLength,
        source.byteLength - sourceOffset,
      );
      output.set(source.subarray(sourceOffset, sourceOffset + copied), outputLength);
      outputLength += copied;
      sourceOffset += copied;
      produced += copied;
      if (outputLength === output.byteLength) {
        yield { bytes: output, offset: outputOffset };
        outputOffset += outputLength;
        output = new Uint8Array(maxChunkBytes);
        outputLength = 0;
      }
    }
  }
  if (produced !== totalBytes) {
    throw new Error("The workspace export producer changed between passes.");
  }
  if (outputLength > 0) {
    yield { bytes: output.slice(0, outputLength), offset: outputOffset };
    outputOffset += outputLength;
  }
  if (outputOffset !== totalBytes) {
    throw new Error("The workspace export producer returned inconsistent bytes.");
  }
}

export async function* textSequenceWorkspaceProducer(
  fragments: Iterable<string> | AsyncIterable<string>,
): AsyncGenerator<string> {
  for await (const fragment of fragments) yield fragment;
}

async function* boundedProducerBytes(
  createChunks: SequenceWorkspaceChunkProducer,
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array> {
  for await (const value of createChunks()) {
    throwIfAborted(signal);
    if (typeof value === "string") {
      for (let offset = 0; offset < value.length; ) {
        let end = Math.min(value.length, offset + PRODUCER_FRAGMENT_BYTES);
        if (
          end < value.length &&
          isHighSurrogate(value.charCodeAt(end - 1)) &&
          isLowSurrogate(value.charCodeAt(end))
        ) {
          end -= 1;
        }
        const bytes = new TextEncoder().encode(value.slice(offset, end));
        if (bytes.byteLength > 0) yield bytes;
        offset = end;
      }
    } else {
      for (let offset = 0; offset < value.byteLength; offset += PRODUCER_FRAGMENT_BYTES) {
        yield value.subarray(
          offset,
          Math.min(value.byteLength, offset + PRODUCER_FRAGMENT_BYTES),
        );
      }
    }
  }
}

function isHighSurrogate(value: number): boolean {
  return value >= 0xd800 && value <= 0xdbff;
}

function isLowSurrogate(value: number): boolean {
  return value >= 0xdc00 && value <= 0xdfff;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Operation cancelled.", "AbortError");
  }
}

// Small incremental SHA-256 implementation for browser producers. WebCrypto's
// digest API requires a complete ArrayBuffer and therefore cannot be used for
// the large workspace path.
class IncrementalSha256 {
  private readonly block = new Uint8Array(64);
  private blockLength = 0;
  private bytesHashed = 0;
  private finished = false;
  private readonly state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly words = new Uint32Array(64);

  update(data: Uint8Array): void {
    if (this.finished) throw new Error("SHA-256 digest is already finalized.");
    this.bytesHashed += data.byteLength;
    if (!Number.isSafeInteger(this.bytesHashed)) {
      throw new Error("SHA-256 input is too large.");
    }
    let offset = 0;
    while (offset < data.byteLength) {
      const copied = Math.min(64 - this.blockLength, data.byteLength - offset);
      this.block.set(data.subarray(offset, offset + copied), this.blockLength);
      this.blockLength += copied;
      offset += copied;
      if (this.blockLength === 64) {
        this.compress(this.block);
        this.blockLength = 0;
      }
    }
  }

  digestHex(): string {
    if (!this.finished) {
      const bitLength = BigInt(this.bytesHashed) * 8n;
      this.block[this.blockLength++] = 0x80;
      if (this.blockLength > 56) {
        this.block.fill(0, this.blockLength);
        this.compress(this.block);
        this.blockLength = 0;
      }
      this.block.fill(0, this.blockLength, 56);
      for (let index = 0; index < 8; index += 1) {
        this.block[63 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
      }
      this.compress(this.block);
      this.finished = true;
    }
    return [...this.state]
      .map((word) => word.toString(16).padStart(8, "0"))
      .join("");
  }

  private compress(block: Uint8Array): void {
    for (let index = 0; index < 16; index += 1) {
      const offset = index * 4;
      this.words[index] =
        ((block[offset] ?? 0) << 24) |
        ((block[offset + 1] ?? 0) << 16) |
        ((block[offset + 2] ?? 0) << 8) |
        (block[offset + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const x = this.words[index - 15] ?? 0;
      const y = this.words[index - 2] ?? 0;
      const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      this.words[index] =
        ((this.words[index - 16] ?? 0) +
          s0 +
          (this.words[index - 7] ?? 0) +
          s1) >>>
        0;
    }
    let [a, b, c, d, e, f, g, h] = this.state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choice = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 =
        ((h ?? 0) + sum1 + choice + SHA256_CONSTANTS[index]! + this.words[index]!) >>> 0;
      const sum0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    this.state[0] = ((this.state[0] ?? 0) + (a ?? 0)) >>> 0;
    this.state[1] = ((this.state[1] ?? 0) + (b ?? 0)) >>> 0;
    this.state[2] = ((this.state[2] ?? 0) + (c ?? 0)) >>> 0;
    this.state[3] = ((this.state[3] ?? 0) + (d ?? 0)) >>> 0;
    this.state[4] = ((this.state[4] ?? 0) + (e ?? 0)) >>> 0;
    this.state[5] = ((this.state[5] ?? 0) + (f ?? 0)) >>> 0;
    this.state[6] = ((this.state[6] ?? 0) + (g ?? 0)) >>> 0;
    this.state[7] = ((this.state[7] ?? 0) + (h ?? 0)) >>> 0;
  }
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export const SEQUENCE_WORKSPACE_PRODUCER_FRAGMENT_BYTES =
  PRODUCER_FRAGMENT_BYTES;
export const SEQUENCE_WORKSPACE_WIDGET_PEAK_LIMIT = 2 * 1_024 * 1_024;
export const SEQUENCE_WORKSPACE_REQUEST_CHUNK_BYTES =
  SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes;
