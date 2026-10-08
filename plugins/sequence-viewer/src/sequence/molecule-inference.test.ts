import { describe, expect, it } from "vitest";

import { inferSequenceMolecule } from "./molecule-inference";

describe("inferSequenceMolecule", () => {
  it("delegates DNA, RNA, and protein sequence inference", () => {
    expect(inferSequenceMolecule(["ACGT"])).toBe("dna");
    expect(inferSequenceMolecule(["ACGU"])).toBe("rna");
    expect(inferSequenceMolecule(["MKWVTFISLLFLFSSAYS"])).toBe("protein");
  });
});
