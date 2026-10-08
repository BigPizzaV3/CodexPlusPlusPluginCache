import { describe, expect, it } from "vitest";

import {
  getMsaFormatHint,
  getMsaPathExtension,
  isExplicitMsaFile,
  isMsaFastaCandidateFile,
  isMsaFile,
} from "./file-kind";

describe("MSA file-kind helpers", () => {
  it("recognizes explicit MSA extensions and compound aligned FASTA names", () => {
    expect(isExplicitMsaFile("/tmp/family.A3M")).toBe(true);
    expect(isExplicitMsaFile("/tmp/family.stk")).toBe(true);
    expect(isExplicitMsaFile("/tmp/family.aln-fasta")).toBe(true);
    expect(getMsaPathExtension("/tmp/family.aln-fasta")).toBe("aln-fasta");
    expect(getMsaFormatHint("/tmp/family.aln-fasta")).toBe("aln-fasta");
  });

  it.each([
    ["C:\\Research Data\\family.A3M.bgz", "a3m"],
    ["\\\\lab-server\\alignments\\family.aln-fasta.bgzf", "aln-fasta"],
    ["/Users/researcher/alignments/family.stk.bgzip", "stk"],
  ])(
    "recognizes compressed alignments on the source platform: %s",
    (source, format) => {
      expect(isExplicitMsaFile(source)).toBe(true);
      expect(getMsaPathExtension(source)).toBe(format);
      expect(getMsaFormatHint(source)).toBe(format);
    },
  );

  it("recognizes Windows and UNC FASTA alignment candidates", () => {
    for (const source of [
      "C:\\Research Data\\family.fasta.bgz",
      "\\\\lab-server\\alignments\\family.mfa.bgzf",
    ]) {
      expect(isMsaFastaCandidateFile(source)).toBe(true);
      expect(isMsaFile(source)).toBe(true);
    }
  });

  it("keeps generic FASTA names as MSA candidates rather than explicit claims", () => {
    expect(isExplicitMsaFile("/tmp/family.mfa")).toBe(false);
    expect(isMsaFastaCandidateFile("/tmp/family.mfa")).toBe(true);
    expect(isMsaFile("/tmp/family.FASTA")).toBe(true);
  });

  it("does not treat unrelated source and dotless names as MSA files", () => {
    expect(isMsaFile("/tmp/viewer.tsx")).toBe(false);
    expect(getMsaPathExtension("/tmp/no-extension")).toBeNull();
    expect(getMsaFormatHint()).toBeNull();
  });
});
