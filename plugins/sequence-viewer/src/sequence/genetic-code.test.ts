import { describe, expect, it } from "vitest";

import {
  SUPPORTED_GENETIC_CODE_IDS,
  getGeneticCode,
  translateGeneticCodeCodon,
} from "./genetic-code";
import { enrichCdsFeature } from "./feature-translation";
import { translateSixFrames } from "./translation";

describe("NCBI genetic codes", () => {
  it("supports every currently assigned unambiguous NCBI translation table", () => {
    expect(SUPPORTED_GENETIC_CODE_IDS).toEqual([
      1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 30, 31, 32, 33,
    ]);
    expect(getGeneticCode(2)?.name).toBe("Vertebrate Mitochondrial");
  });

  it("applies table-specific residues and initiator semantics", () => {
    expect(translateGeneticCodeCodon("TGA", 1)).toBe("*");
    expect(translateGeneticCodeCodon("TGA", 2)).toBe("W");
    expect(translateGeneticCodeCodon("ATA", 2)).toBe("M");
    expect(translateGeneticCodeCodon("GTG", 11, true)).toBe("M");
    expect(translateGeneticCodeCodon("GTG", 11, false)).toBe("V");
  });

  it("uses the requested code in all six computed frames", () => {
    const frames = translateSixFrames("ATATGA", 2);
    expect(frames.find(({ frame }) => frame === 1)).toMatchObject({
      aminoAcids: "MW",
      geneticCodeId: 2,
      geneticCodeName: "Vertebrate Mitochondrial",
    });
  });

  it("computes exact CDS translation for tables that were previously unsupported", () => {
    const warnings: Array<{
      code: string;
      message: string;
      severity: "info" | "warning" | "error";
    }> = [];
    const feature = enrichCdsFeature({
      feature: {
        end: 6,
        id: "cds-1",
        qualifiers: { transl_table: "5" },
        start: 1,
        strand: "+",
        type: "CDS",
      },
      sequence: "ATGAGA",
      warnings,
    });

    expect(feature.translation).toBe("MS");
    expect(feature.translationCoordinateMap).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it("returns X for unknown tables instead of silently using the standard code", () => {
    expect(translateGeneticCodeCodon("ATG", 999)).toBe("X");
    expect(translateSixFrames("ATG", 999)).toEqual([]);
  });
});
