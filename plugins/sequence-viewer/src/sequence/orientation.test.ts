import { describe, expect, it } from "vitest";

import { parseSequenceDocument } from "./parser";
import {
  displaySelectionToSource,
  orientSearchHit,
  orientSequenceRecord,
  sourceCoordinateToDisplay,
  sourceRangeToDisplay,
} from "./orientation";

describe("sequence orientation projection", () => {
  it("round-trips one-based inclusive coordinates", () => {
    expect(sourceCoordinateToDisplay(1, 10, "reverse-complement")).toBe(10);
    expect(sourceRangeToDisplay({ end: 4, start: 2 }, 10, "reverse-complement")).toEqual({
      end: 9,
      start: 7,
    });
    expect(
      displaySelectionToSource(
        { end: 9, recordId: "r", start: 7 },
        10,
        "reverse-complement",
      ),
    ).toEqual({ end: 4, recordId: "r", start: 2 });
  });

  it("reverse-complements sequence, quality, features, and strands without mutating source", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       ORIENT     8 bp    DNA     linear
ACCESSION   ORIENT1
FEATURES             Location/Qualifiers
     gene            2..5
                     /gene="demo"
ORIGIN
        1 atgccgta
//`,
      fileName: "orientation.gb",
    });
    const record = document.records[0]!;
    const oriented = orientSequenceRecord(record, "reverse-complement");

    expect(oriented.sequence).toBe("TACGGCAT");
    expect(oriented.features[0]).toMatchObject({
      end: 7,
      start: 4,
      strand: "-",
    });
    expect(record.sequence).toBe("ATGCCGTA");
  });

  it("projects genuine RNAcentral RNA with uracil instead of introducing thymine", () => {
    // Public RNAcentral URS0000D6941A from immutable R2DT fixture
    // a1ca674f245e4dc13838e346b8e03295c2130d0c/examples/RF02976.fasta.
    const document = parseSequenceDocument({
      contents: `>URS0000D6941A
CCGAGAUAGGGGUACAAAUCCUGCCAAUGGCGUUUCCCUGGACCUUAGCGAUGAAGGCAUUUCAAAGCCUGAGCAACGAC
UCUCGGCGUCAGAUGGGGAGAGUGCCAGACGUGGUGUCCCCGCUGAC`,
      fileName: "RF02976.fasta",
    });
    const record = document.records[0]!;
    const oriented = orientSequenceRecord(record, "reverse-complement");

    expect(record.molecule).toBe("rna");
    expect(oriented.molecule).toBe("rna");
    expect(oriented.sequence.slice(-12)).toBe("CCCCUAUCUCGG");
    expect(oriented.sequence).not.toContain("T");
    expect(record.sequence.slice(0, 12)).toBe("CCGAGAUAGGGG");
  });

  it("preserves RNA IUPAC ambiguity and measured quality orientation", () => {
    // Explicitly synthetic negative/edge-case control, not a biological read.
    const document = parseSequenceDocument({
      contents: "@QA-SYNTHETIC-IUPAC-RNA-READ\nAUGCRYN\n+\n!#%')+-\n",
      fileName: "rna.fastq",
    });
    const record = document.records[0]!;
    const oriented = orientSequenceRecord(record, "reverse-complement");

    expect(record.molecule).toBe("rna");
    expect(oriented.sequence).toBe("NRYGCAU");
    expect(oriented.quality?.ascii).toBe("-+)'%#!");
    expect(oriented.quality?.phred).toEqual(
      [...record.quality!.phred].reverse(),
    );
  });

  it("projects search-hit coordinates and orientation", () => {
    expect(
      orientSearchHit(
        { end: 5, orientation: "forward", recordId: "r", start: 3 },
        10,
        "reverse-complement",
      ),
    ).toEqual({
      end: 8,
      orientation: "reverse-complement",
      recordId: "r",
      start: 6,
    });
  });

  it("keeps source traces only in their original orientation", () => {
    // Synthetic trace control; samples are not experimental evidence.
    const document = parseSequenceDocument({
      contents: ">QA-SYNTHETIC-TRACE\nATGC\n",
      fileName: "synthetic-trace.fasta",
    });
    const record = document.records[0]!;
    record.chromatogram = {
      channels: {
        A: [1, 2, 3, 4],
        C: [2, 3, 4, 5],
        G: [3, 4, 5, 6],
        T: [4, 5, 6, 7],
      },
      format: "abif",
      peakLocations: [0, 1, 2, 3],
      quality: [20, 30, 40, 50],
      qualityEncoding: "phred",
      sampleCount: 4,
    };
    const source = structuredClone(record);

    expect(orientSequenceRecord(record, "forward")).toBe(record);
    const reversed = orientSequenceRecord(record, "reverse-complement");
    expect(reversed.sequence).toBe("GCAT");
    expect(Object.hasOwn(reversed, "chromatogram")).toBe(false);
    expect(reversed.quality).toBeUndefined();
    expect(record).toEqual(source);
  });

  it("preserves forward compound order and round-trips reverse-strand selections", () => {
    const source = {
      end: 2,
      recordId: "r",
      segments: [
        { end: 12, start: 10 },
        { end: 7, start: 5 },
        { end: 2, start: 1 },
      ],
      start: 10,
    };
    expect(displaySelectionToSource(source, 12, "forward")).toBe(source);
    const reversed = displaySelectionToSource(source, 12, "reverse-complement");
    expect(reversed.segments).toEqual([
      { end: 12, start: 11 },
      { end: 8, start: 6 },
      { end: 3, start: 1 },
    ]);
    expect(
      displaySelectionToSource(reversed, 12, "reverse-complement"),
    ).toEqual(source);
  });

  it("round-trips both segments of an origin-spanning selection", () => {
    const source = {
      end: 2,
      recordId: "r",
      segments: [
        { end: 10, start: 8 },
        { end: 2, start: 1 },
      ],
      start: 8,
    };
    const displayed = displaySelectionToSource(
      source,
      10,
      "reverse-complement",
    );
    expect(displayed.segments).toEqual([
      { end: 10, start: 9 },
      { end: 3, start: 1 },
    ]);
    expect(
      displaySelectionToSource(displayed, 10, "reverse-complement"),
    ).toEqual(source);
  });
});
