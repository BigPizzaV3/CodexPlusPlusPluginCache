import {
  assertTextWithinInputBudget,
  SEQUENCE_VIEWER_LIMITS,
} from "./runtime-contract";

/** Byte-preserving transport over the existing opaque text-resource contract. */
export const BINARY_SEQUENCE_ENVELOPE_PREFIX =
  "OPENAI_SEQUENCE_VIEWER_BINARY_V1\n";
const MAX_BYTES = SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes;
const MAX_BASE64_CHARACTERS = Math.ceil(MAX_BYTES / 3) * 4;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function serializeBinarySequenceEnvelope(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("The binary sequence exceeds its 8 MiB transfer limit.");
  const chunks: Array<string> = [];
  // Multiples of three keep independently encoded chunks free of interior padding.
  const chunkBytes = 3 * 8_192;
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    chunks.push(
      btoa(String.fromCharCode(...bytes.subarray(offset, offset + chunkBytes))),
    );
  }
  const text = `${BINARY_SEQUENCE_ENVELOPE_PREFIX}${chunks.join("")}`;
  assertTextWithinInputBudget(text);
  return text;
}

export function parseBinarySequenceEnvelope(value: string): Uint8Array | null {
  if (!value.startsWith(BINARY_SEQUENCE_ENVELOPE_PREFIX)) return null;
  assertTextWithinInputBudget(value);
  return decodeBinarySequenceBase64(
    value.slice(BINARY_SEQUENCE_ENVELOPE_PREFIX.length),
  );
}

export function decodeBinarySequenceBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length > MAX_BASE64_CHARACTERS ||
    value.length % 4 !== 0
  ) {
    throw new Error(
      "The binary sequence payload is empty, malformed, or exceeds its 8 MiB transfer limit.",
    );
  }
  const paddingIndex = value.indexOf("=");
  const padding = paddingIndex < 0 ? 0 : value.length - paddingIndex;
  const body = paddingIndex < 0 ? value : value.slice(0, paddingIndex);
  if (
    padding > 2 ||
    (padding > 0 && value.slice(paddingIndex) !== "=".repeat(padding)) ||
    /[^A-Za-z0-9+/]/u.test(body) ||
    (padding === 1 && BASE64_ALPHABET.indexOf(body.at(-1) ?? "") % 4 !== 0) ||
    (padding === 2 && BASE64_ALPHABET.indexOf(body.at(-1) ?? "") % 16 !== 0)
  ) {
    throw new Error("The binary sequence payload is not canonical base64.");
  }
  const decoded = atob(value);
  if (decoded.length > MAX_BYTES)
    throw new Error("The binary sequence exceeds its 8 MiB transfer limit.");
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
