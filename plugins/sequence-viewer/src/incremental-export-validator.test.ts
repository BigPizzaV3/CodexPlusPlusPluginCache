import { describe, expect, it } from "vitest";

import { IncrementalSequenceExportValidator } from "./incremental-export-validator";

describe("IncrementalSequenceExportValidator", () => {
  it("validates split UTF-8 and format boundaries without retaining payloads", () => {
    const validator = new IncrementalSequenceExportValidator(
      "fasta",
      "text/x-fasta",
    );
    const bytes = Buffer.from(">café\nACGT\n");
    for (const byte of bytes) validator.update(Uint8Array.of(byte));
    expect(() => validator.finish()).not.toThrow();
    expect(validator.peakRetainedBytes).toBeLessThan(2_048);
  });

  it("tracks JSON strings, escapes, and nesting across chunks", () => {
    const validator = new IncrementalSequenceExportValidator(
      "json",
      "application/json",
    );
    for (const chunk of [' {"value":"a\\', 'u0041", "rows":[1,2]} ']) {
      validator.update(Buffer.from(chunk));
    }
    expect(() => validator.finish()).not.toThrow();

    const invalid = new IncrementalSequenceExportValidator(
      "json",
      "application/json",
    );
    expect(() => invalid.update(Buffer.from('{"value":}'))).toThrow("JSON");
  });

  it("fails closed for invalid UTF-8, media types, and incomplete formats", () => {
    expect(
      () => new IncrementalSequenceExportValidator("svg", "text/plain"),
    ).toThrow("media type");
    const invalidUtf8 = new IncrementalSequenceExportValidator(
      "fasta",
      "text/x-fasta",
    );
    expect(() => invalidUtf8.update(Uint8Array.of(0xc3, 0x28))).toThrow();
    const incompleteSvg = new IncrementalSequenceExportValidator(
      "svg",
      "image/svg+xml",
    );
    incompleteSvg.update(Buffer.from("<svg>"));
    expect(() => incompleteSvg.finish()).toThrow("SVG");

    const fastq = new IncrementalSequenceExportValidator(
      "fastq",
      "text/x-fastq",
    );
    fastq.update(Buffer.from("@read\nACGT\n+\nIII"));
    expect(() => fastq.finish()).toThrow("quality lengths");
  });

  it.each([
    ["a3m", "text/x-a3m", ">alpha\nACgtGT\n>beta\nA-GT\n"],
    [
      "clustal",
      "text/x-clustal",
      "CLUSTAL W multiple sequence alignment\n\nalpha  ACGT\nbeta   A-GT\n",
    ],
    [
      "stockholm",
      "text/x-stockholm",
      "# STOCKHOLM 1.0\nalpha ACGT\nbeta  A-GT\n//\n",
    ],
    [
      "gtf",
      "text/x-gtf",
      'chr1\tviewer\tgene\t1\t4\t.\t+\t.\tgene_id "g1"; transcript_id "t1";\n',
    ],
    [
      "pdf",
      "application/pdf",
      "%PDF-1.4\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n",
    ],
  ] as const)(
    "incrementally accepts canonical %s without buffering the artifact",
    (format, mediaType, contents) => {
      const validator = new IncrementalSequenceExportValidator(
        format,
        mediaType,
      );
      const encoded = new TextEncoder().encode(contents);
      for (let offset = 0; offset < encoded.length; offset += 3) {
        validator.update(encoded.subarray(offset, offset + 3));
      }
      expect(() => validator.finish()).not.toThrow();
      expect(validator.peakRetainedBytes).toBeLessThan(2_048);
    },
  );

  it.each([
    ["a3m", "text/x-a3m", ">alpha\n"],
    ["clustal", "text/x-clustal", ">alpha\nACGT\n"],
    ["stockholm", "text/x-stockholm", "# STOCKHOLM 1.0\nalpha ACGT\n"],
    ["gtf", "text/x-gtf", "chr1\tviewer\tgene\t1\t4\t.\t+\t.\tname x;\n"],
    ["pdf", "application/pdf", "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"],
  ] as const)(
    "rejects incomplete or mislabeled %s output",
    (format, mediaType, contents) => {
      const validator = new IncrementalSequenceExportValidator(
        format,
        mediaType,
      );
      validator.update(new TextEncoder().encode(contents));
      expect(() => validator.finish()).toThrow();
    },
  );

  it("accepts genuine non-UTF-8 binary bytes inside PDF objects", () => {
    const validator = new IncrementalSequenceExportValidator(
      "pdf",
      "application/pdf",
    );
    validator.update(new TextEncoder().encode("%PDF-1.7\n"));
    validator.update(Uint8Array.of(0xff, 0xfe, 0x80));
    validator.update(new TextEncoder().encode("\nstartxref\n12\n%%EOF\n"));
    expect(() => validator.finish()).not.toThrow();
  });
});
