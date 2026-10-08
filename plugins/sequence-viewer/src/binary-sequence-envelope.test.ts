import { describe, expect, it } from "vitest";

import {
  BINARY_SEQUENCE_ENVELOPE_PREFIX,
  decodeBinarySequenceBase64,
  parseBinarySequenceEnvelope,
  serializeBinarySequenceEnvelope,
} from "./binary-sequence-envelope";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  makeSyntheticSnapGene,
} from "./sequence/__fixtures__/chromatogram";
import {
  getBinarySequenceFormatHint,
  parseBinarySequenceDocumentResult,
  sniffBinarySequenceFormat,
} from "./sequence/binary-parser";

describe("byte-preserving binary sequence resource envelopes", () => {
  it.each([1, 2, 3, 24_575, 24_576, 24_577, 70_001])(
    "round-trips %i bytes across bounded base64 chunk boundaries",
    (size) => {
      const bytes = Uint8Array.from(
        { length: size },
        (_, index) => index % 256,
      );
      const encoded = serializeBinarySequenceEnvelope(bytes);
      expect(encoded.slice(BINARY_SEQUENCE_ENVELOPE_PREFIX.length)).toBe(
        Buffer.from(bytes).toString("base64"),
      );
      expect(parseBinarySequenceEnvelope(encoded)).toEqual(bytes);
    },
  );

  it("leaves ordinary source text on its existing text path", () => {
    expect(parseBinarySequenceEnvelope(">test\nACGT\n")).toBeNull();
  });

  it.each(["", "AA", "A===", "AA=A", "AB==", "AAB=", "AA\n=", "AA-=", "===="])(
    "rejects malformed or noncanonical payload %j",
    (value) => {
      expect(() => decodeBinarySequenceBase64(value)).toThrow();
    },
  );

  it("enforces the binary byte budget before encoding or allocating decoded arrays", () => {
    expect(() =>
      serializeBinarySequenceEnvelope(
        new Uint8Array(SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1),
      ),
    ).toThrow(/8 MiB/u);
    expect(() =>
      decodeBinarySequenceBase64(
        "A".repeat(
          Math.ceil(SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes / 3) * 4 +
            4,
        ),
      ),
    ).toThrow(/8 MiB/u);
  });
});

describe("binary biological sequence classification and decoding", () => {
  it.each([
    {
      bytes: makeSyntheticAbif(),
      fileName: "sample.ab1",
      format: "abif",
      kind: "chromatogram",
      sequence: "ACGTN",
    },
    {
      bytes: makeSyntheticScf(),
      fileName: "sample.scf",
      format: "scf",
      kind: "chromatogram",
      sequence: "ACGTN",
    },
    {
      bytes: makeSyntheticSnapGene(),
      fileName: "sample.dna",
      format: "snapgene",
      kind: "annotated-sequence",
      sequence: "ATGAAACCCGGG",
    },
  ])(
    "decodes $fileName into a source-grounded Sequence document",
    ({ bytes, fileName, format, kind, sequence }) => {
      expect(sniffBinarySequenceFormat(bytes)).toBe(format);
      const parsed = parseBinarySequenceDocumentResult({ bytes, fileName });
      expect(parsed.status).toBe("success");
      if (parsed.status !== "success") return;
      expect(parsed.document).toMatchObject({
        format,
        kind,
        classification: { kind, suggestedViewer: "sequence" },
      });
      expect(parsed.document.records[0].sequence).toBe(sequence);
      if (format === "snapgene") {
        expect(parsed.document.records[0]).toMatchObject({
          topology: "circular",
          features: [
            expect.objectContaining({ start: 2, end: 8, label: "test gene" }),
          ],
        });
      }
    },
  );

  it("uses portable extension hints without trusting names as evidence of decodability", () => {
    expect(getBinarySequenceFormatHint("C:\\private\\sample.ABI.GZ")).toBe(
      "abif",
    );
    expect(getBinarySequenceFormatHint("/private/sample.dna")).toBe("snapgene");
    expect(getBinarySequenceFormatHint("/private/sample.scf")).toBe("scf");
    expect(getBinarySequenceFormatHint("/private/sample.fasta")).toBeNull();
    expect(
      parseBinarySequenceDocumentResult({
        bytes: new TextEncoder().encode("SnapGene"),
        fileName: "sample.dna",
      }).status,
    ).toBe("error");
    expect(
      parseBinarySequenceDocumentResult({
        bytes: makeSyntheticAbif(),
        fileName: "sample.dna",
      }).status,
    ).toBe("error");
  });

  it("does not disclose source paths in parsed file labels", () => {
    const parsed = parseBinarySequenceDocumentResult({
      bytes: makeSyntheticAbif(),
      fileName: "C:\\private\\source.ab1",
    });
    expect(parsed.status).toBe("success");
    expect(JSON.stringify(parsed)).not.toContain("private");
  });
});
