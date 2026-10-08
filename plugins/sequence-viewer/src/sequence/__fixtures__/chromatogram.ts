import type { ChromatogramBase } from "../types";

/** Generated conformance inputs, not measured biological data. */
export const SYNTHETIC_TRACE_CHANNELS: Record<
  ChromatogramBase,
  Array<number>
> = {
  A: [0, 12, 40, 12, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  C: [0, 0, 0, 0, 20, 50, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  G: [0, 0, 0, 0, 0, 0, 0, 25, 60, 15, 0, 0, 0, 0, 0, 0],
  T: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 70, 12, 0, 0, 0],
};

export function makeSyntheticAbif({
  channels = SYNTHETIC_TRACE_CHANNELS,
  directoryPaddingEntries = 0,
  editedOnly = false,
  order = "GATC",
  peaks = [2, 5, 8, 11, 14],
  quality = [31, 32, 33, 34, 0],
  sequence = "ACGTN",
  version = 101,
}: {
  channels?: Record<ChromatogramBase, Array<number>>;
  directoryPaddingEntries?: number;
  editedOnly?: boolean;
  order?: string;
  peaks?: Array<number>;
  quality?: Array<number> | null;
  sequence?: string;
  version?: number;
} = {}): Uint8Array {
  const revision = editedOnly ? 1 : 2;
  const entries = [
    { name: "FWO_", number: 1, type: 2, size: 1, data: text(order) },
    { name: "PBAS", number: revision, type: 2, size: 1, data: text(sequence) },
    { name: "PLOC", number: revision, type: 4, size: 2, data: shorts(peaks) },
    ...(quality == null
      ? []
      : [
          {
            name: "PCON",
            number: revision,
            type: 2,
            size: 1,
            data: Uint8Array.from(quality),
          },
        ]),
    ...[...order].map((base, index) => ({
      name: "DATA",
      number: 9 + index,
      type: 4,
      size: 2,
      data: shorts(channels[base as ChromatogramBase] ?? channels.A),
    })),
    {
      name: "S/N%",
      number: 1,
      type: 4,
      size: 2,
      data: shorts([100, 101, 102, 103]),
    },
    { name: "RevC", number: 1, type: 4, size: 2, data: shorts([0]) },
  ];
  const directoryOffset = 128;
  const directorySize = (entries.length + directoryPaddingEntries) * 28;
  const bytes = new Uint8Array(
    directoryOffset +
      directorySize +
      entries.reduce(
        (sum, { data }) => sum + (data.length > 4 ? data.length : 0),
        0,
      ),
  );
  const view = new DataView(bytes.buffer);
  bytes.set(text("ABIF"));
  view.setUint16(4, version, false);
  bytes.set(text("tdir"), 6);
  view.setUint32(10, 1, false);
  view.setUint16(14, 1023, false);
  view.setUint16(16, 28, false);
  view.setUint32(18, entries.length, false);
  view.setUint32(22, directorySize, false);
  view.setUint32(26, directoryOffset, false);
  let payloadOffset = directoryOffset + directorySize;
  entries.forEach((entry, index) => {
    const offset = directoryOffset + index * 28;
    bytes.set(text(entry.name), offset);
    view.setUint32(offset + 4, entry.number, false);
    view.setUint16(offset + 8, entry.type, false);
    view.setUint16(offset + 10, entry.size, false);
    view.setUint32(offset + 12, entry.data.length / entry.size, false);
    view.setUint32(offset + 16, entry.data.length, false);
    if (entry.data.length <= 4) {
      bytes.set(entry.data, offset + 20);
    } else {
      view.setUint32(offset + 20, payloadOffset, false);
      bytes.set(entry.data, payloadOffset);
      payloadOffset += entry.data.length;
    }
  });
  return bytes;
}

export function makeSyntheticScf({
  channels = SYNTHETIC_TRACE_CHANNELS,
  comments = "",
  peaks = [2, 5, 8, 11, 14],
  privateData = new Uint8Array(),
  sampleSize = 2,
  sequence = "ACGTN",
  version = "3.00",
}: {
  channels?: Record<ChromatogramBase, Array<number>>;
  comments?: string;
  peaks?: Array<number>;
  privateData?: Uint8Array;
  sampleSize?: 1 | 2;
  sequence?: string;
  version?: "2.00" | "3.00";
} = {}): Uint8Array {
  const bases = ["A", "C", "G", "T"] as const;
  const samples = channels.A.length;
  const baseCount = sequence.length;
  const sampleOffset = 128;
  const baseOffset = sampleOffset + 4 * samples * sampleSize;
  const commentOffset = baseOffset + baseCount * 12;
  const commentBytes = text(comments);
  const privateOffset = commentOffset + commentBytes.length;
  const bytes = new Uint8Array(privateOffset + privateData.length);
  const view = new DataView(bytes.buffer);
  bytes.set(text(".scf"));
  view.setUint32(4, samples, false);
  view.setUint32(8, sampleOffset, false);
  view.setUint32(12, baseCount, false);
  view.setUint32(24, baseOffset, false);
  view.setUint32(28, commentBytes.length, false);
  view.setUint32(32, commentOffset, false);
  bytes.set(text(version), 36);
  view.setUint32(40, sampleSize, false);
  view.setUint32(44, 2, false);
  view.setUint32(48, privateData.length, false);
  view.setUint32(52, privateOffset, false);
  bases.forEach((base, channelIndex) => {
    const encoded = [...channels[base]];
    if (version === "3.00") {
      for (let pass = 0; pass < 2; pass += 1) {
        let previous = 0;
        for (let index = 0; index < encoded.length; index += 1) {
          const current = encoded[index];
          encoded[index] =
            (current - previous) & (sampleSize === 1 ? 255 : 65535);
          previous = current;
        }
      }
    }
    encoded.forEach((amplitude, sampleIndex) => {
      const index =
        version === "3.00"
          ? channelIndex * samples + sampleIndex
          : sampleIndex * 4 + channelIndex;
      if (sampleSize === 1) view.setUint8(sampleOffset + index, amplitude);
      else view.setUint16(sampleOffset + index * 2, amplitude, false);
    });
  });
  for (let index = 0; index < baseCount; index += 1) {
    const interleaved = version === "2.00";
    view.setUint32(
      baseOffset + index * (interleaved ? 12 : 4),
      peaks[index],
      false,
    );
    bases.forEach((base, channelIndex) => {
      const offset =
        baseOffset +
        (interleaved
          ? index * 12 + 4 + channelIndex
          : baseCount * (4 + channelIndex) + index);
      view.setUint8(
        offset,
        sequence[index] === base ? 31 + index : channelIndex + 1,
      );
    });
    view.setUint8(
      baseOffset + (interleaved ? index * 12 + 8 : baseCount * 8 + index),
      sequence.charCodeAt(index),
    );
  }
  bytes.set(commentBytes, commentOffset);
  bytes.set(privateData, privateOffset);
  return bytes;
}

export function makeSyntheticSnapGene(): Uint8Array {
  const sequence = text("ATGAAACCCGGG");
  const feature = text(
    '<Features><Feature name="test gene" type="gene" directionality="1"><Segment range="2-8" type="standard" /></Feature></Features>',
  );
  const bytes = new Uint8Array(
    19 + 5 + 1 + sequence.length + 5 + feature.length,
  );
  const view = new DataView(bytes.buffer);
  bytes[0] = 9;
  view.setUint32(1, 14, false);
  bytes.set(text("SnapGene"), 5);
  view.setUint16(13, 1, false);
  view.setUint16(15, 15, false);
  view.setUint16(17, 19, false);
  view.setUint32(20, sequence.length + 1, false);
  bytes[24] = 1;
  bytes.set(sequence, 25);
  const featureOffset = 25 + sequence.length;
  bytes[featureOffset] = 10;
  view.setUint32(featureOffset + 1, feature.length, false);
  bytes.set(feature, featureOffset + 5);
  return bytes;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function shorts(values: Array<number>): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, false));
  return bytes;
}
