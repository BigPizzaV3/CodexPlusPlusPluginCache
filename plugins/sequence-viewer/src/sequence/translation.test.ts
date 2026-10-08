import { describe, expect, it } from "vitest";

import { reverseComplement, translateSixFrames } from "./translation";

describe("sequence translation", () => {
  it("translates all forward and reverse frames with the standard code", () => {
    const frames = translateSixFrames("ATGAAATAG");

    expect(frames.find(({ frame }) => frame === 1)?.aminoAcids).toBe("MK*");
    expect(frames.map(({ frame }) => frame)).toEqual([1, -1, 2, -2, 3, -3]);
  });

  it("reverse-complements IUPAC nucleotide symbols", () => {
    expect(reverseComplement("ATGCRYNN")).toBe("NNRYGCAT");
  });

  it("normalizes RNA and marks ambiguous codons without inventing residues", () => {
    const frames = translateSixFrames("AUGNNNUAA");

    expect(frames.find(({ frame }) => frame === 1)?.aminoAcids).toBe("MX*");
  });
});
