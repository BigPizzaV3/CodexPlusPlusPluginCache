import { describe, expect, it } from "vitest";

import {
  COMMON_RESTRICTION_ENZYMES,
  calculateSequenceStatistics,
  designPrimerPairs,
  findOpenReadingFrames,
  findRestrictionSites,
  simulateDigest,
} from "./analysis";

describe("sequence workbench analyses", () => {
  it("computes bounded, explicit nucleotide statistics", () => {
    expect(calculateSequenceStatistics("ACGTNN", "nucleic-acid")).toEqual({
      ambiguousCount: 2,
      gcFraction: 2 / 6,
      length: 6,
      molecule: "nucleic-acid",
      nFraction: 2 / 6,
      symbolCounts: { A: 1, C: 1, G: 1, N: 2, T: 1 },
    });
  });

  it("finds ORFs on both strands with table-specific stops", () => {
    const sequence = `ATG${"GCT".repeat(5)}TGA`;
    const standard = findOpenReadingFrames({
      geneticCodeId: 1,
      minAminoAcids: 5,
      sequence,
    });
    const mitochondrial = findOpenReadingFrames({
      geneticCodeId: 2,
      includePartial: true,
      minAminoAcids: 5,
      sequence,
      strands: "+",
    });

    expect(standard.items[0]).toMatchObject({
      aminoAcidLength: 6,
      completeStop: true,
      frame: 1,
      geneticCodeId: 1,
      start: 1,
      strand: "+",
    });
    expect(mitochondrial.items[0]).toMatchObject({
      completeStop: false,
      geneticCodeId: 2,
      translation: "MAAAAAW",
    });
  });

  it("maps reverse-strand ORFs back into source coordinates", () => {
    const reverseOrf = findOpenReadingFrames({
      minAminoAcids: 2,
      sequence: "TTATTTCAT",
      strands: "-",
    }).items[0];

    expect(reverseOrf).toMatchObject({
      end: 9,
      start: 1,
      strand: "-",
      translation: "MK",
    });
  });

  it("finds circular origin-spanning restriction sites without palindrome duplicates", () => {
    const sites = findRestrictionSites({
      circular: true,
      enzymes: [
        {
          cutBottom: 5,
          cutTop: 1,
          id: "ecori",
          name: "EcoRI",
          recognitionSequence: "GAATTC",
        },
      ],
      sequence: "AATTCG",
    });

    expect(sites).toEqual({
      items: [
        expect.objectContaining({
          end: 5,
          enzymeName: "EcoRI",
          start: 6,
          wrapsOrigin: true,
        }),
      ],
      truncated: false,
    });
  });

  it("does not wrap off-end Type IIS cuts on linear records", () => {
    const linear = findRestrictionSites({
      circular: false,
      enzymes: [
        {
          cutBottom: 11,
          cutTop: 7,
          id: "bsai",
          name: "BsaI",
          recognitionSequence: "GGTCTC",
        },
      ],
      sequence: "GGTCTC",
    });
    const circular = findRestrictionSites({
      circular: true,
      enzymes: [
        {
          cutBottom: 11,
          cutTop: 7,
          id: "bsai",
          name: "BsaI",
          recognitionSequence: "GGTCTC",
        },
      ],
      sequence: "GGTCTC",
    });

    expect(linear.items[0]).toMatchObject({ cutBottom: 12, cutTop: 8 });
    expect(circular.items[0]).toMatchObject({ cutBottom: 6, cutTop: 2 });
    expect(
      simulateDigest({
        circular: false,
        sequenceLength: 6,
        sites: linear.items,
      }),
    ).toEqual([{ end: 6, length: 6, start: 1, wrapsOrigin: false }]);
  });

  it.each([
    { enzymeName: "BsaI", forwardMotif: "GGTCTC", reverseMotif: "GAGACC" },
    { enzymeName: "BsmBI", forwardMotif: "CGTCTC", reverseMotif: "GAGACG" },
  ])(
    "mirrors asymmetric $enzymeName cuts upstream on the reverse strand",
    ({ enzymeName, forwardMotif, reverseMotif }) => {
      const enzymes = COMMON_RESTRICTION_ENZYMES.filter(
        ({ name }) => name === enzymeName,
      );
      const forward = findRestrictionSites({
        enzymes,
        sequence: `AAAAAA${forwardMotif}AAAAAAAAAAA`,
      });
      const reverse = findRestrictionSites({
        enzymes,
        sequence: `AAAAAA${reverseMotif}AAAAAAAAAAA`,
      });

      expect(forward.items).toEqual([
        expect.objectContaining({
          cutBottom: 18,
          cutTop: 14,
          end: 12,
          start: 7,
          strand: "+",
        }),
      ]);
      expect(reverse.items).toEqual([
        expect.objectContaining({
          cutBottom: 6,
          cutTop: 2,
          end: 12,
          start: 7,
          strand: "-",
        }),
      ]);
    },
  );

  it("reports the genuine RefSeq NC_005816.1 reverse BsaI cuts at 338/342", () => {
    // Immutable public RefSeq plasmid NC_005816.1, first 350 nucleotides:
    // biopython/biopython@c9489604d1d9607602ca9199a3852c1219ed330f,
    // Tests/GenBank/NC_005816.fna.
    const publicRefSeqPlasmid = [
      "TGTAACGAACGGTGCAATAGTGATCCACACCCAACGCCTGAAATCAGATCCAGGGGGTAATCTGCTCTCC",
      "TGATTCAGGAGAGTTTATGGTCACTTTTGAGACAGTTATGGAAATTAAAATCCTGCACAAGCAGGGAATG",
      "AGTAGCCGGGCGATTGCCAGAGAACTGGGGATCTCCCGCAATACCGTTAAACGTTATTTGCAGGCAAAAT",
      "CTGAGCCGCCAAAATATACGCCGCGACCTGCTGTTGCTTCACTCCTGGATGAATACCGGGATTATATTCG",
      "TCAACGCATCGCCGATGCTCATCCTTACAAAATCCCGGCAACGGTAATCGCTCGCGAGATCAGAGACCAG",
    ].join("");
    const sites = findRestrictionSites({
      enzymes: COMMON_RESTRICTION_ENZYMES.filter(({ id }) => id === "bsai"),
      sequence: publicRefSeqPlasmid,
    });

    expect(sites.items).toContainEqual(
      expect.objectContaining({
        cutBottom: 342,
        cutTop: 338,
        end: 348,
        enzymeName: "BsaI",
        start: 343,
        strand: "-",
      }),
    );
  });

  it("wraps mirrored reverse Type IIS cuts only on circular records", () => {
    const enzymes = COMMON_RESTRICTION_ENZYMES.filter(
      ({ id }) => id === "bsai",
    );
    const linear = findRestrictionSites({
      circular: false,
      enzymes,
      sequence: "GAGACC",
    });
    const circular = findRestrictionSites({
      circular: true,
      enzymes,
      sequence: "GAGACC",
    });
    const originSpanning = findRestrictionSites({
      circular: true,
      enzymes,
      sequence: "ACCGAG",
    });

    expect(linear.items[0]).toMatchObject({
      cutBottom: 0,
      cutTop: -4,
      strand: "-",
    });
    expect(circular.items[0]).toMatchObject({
      cutBottom: 6,
      cutTop: 2,
      strand: "-",
    });
    expect(originSpanning.items[0]).toMatchObject({
      cutBottom: 3,
      cutTop: 5,
      end: 3,
      start: 4,
      strand: "-",
      wrapsOrigin: true,
    });
    expect(
      simulateDigest({
        circular: false,
        sequenceLength: 6,
        sites: linear.items,
      }),
    ).toEqual([{ end: 6, length: 6, start: 1, wrapsOrigin: false }]);
  });

  it("preserves ambiguous recognition and RNA normalization on reverse cuts", () => {
    const sites = findRestrictionSites({
      enzymes: [
        {
          cutBottom: 11,
          cutTop: 7,
          id: "ambiguous-type-iis",
          name: "Ambiguous Type IIS",
          recognitionSequence: "GGNCTC",
        },
      ],
      sequence: "UUUUUUGAGACCUUUUUU",
    });

    expect(sites.items).toEqual([
      expect.objectContaining({
        cutBottom: 6,
        cutTop: 2,
        end: 12,
        start: 7,
        strand: "-",
      }),
    ]);
  });

  it("simulates linear and circular digest fragment boundaries", () => {
    const sites = [
      {
        cutBottom: 3,
        cutTop: 3,
        end: 4,
        enzymeId: "x",
        enzymeName: "X",
        recognitionSequence: "AAAA",
        start: 1,
        strand: "+" as const,
        wrapsOrigin: false,
      },
      {
        cutBottom: 8,
        cutTop: 8,
        end: 9,
        enzymeId: "x",
        enzymeName: "X",
        recognitionSequence: "AAAA",
        start: 6,
        strand: "+" as const,
        wrapsOrigin: false,
      },
    ];

    expect(
      simulateDigest({ circular: false, sequenceLength: 10, sites }),
    ).toEqual([
      { end: 2, length: 2, start: 1, wrapsOrigin: false },
      { end: 7, length: 5, start: 3, wrapsOrigin: false },
      { end: 10, length: 3, start: 8, wrapsOrigin: false },
    ]);
    expect(
      simulateDigest({ circular: true, sequenceLength: 10, sites }),
    ).toEqual([
      { end: 7, length: 5, start: 3, wrapsOrigin: false },
      { end: 2, length: 5, start: 8, wrapsOrigin: true },
    ]);
  });

  it("designs reproducible primer pairs that bracket the selected target", () => {
    let seed = 17;
    const sequence = Array.from({ length: 700 }, () => {
      seed = (seed * 48_271) % 2_147_483_647;
      return "ACGT"[seed % 4];
    }).join("");
    const pairs = designPrimerPairs({
      minProductLength: 60,
      sequence,
      targetEnd: 327,
      targetStart: 321,
    });

    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0]).toMatchObject({
      forward: expect.objectContaining({ strand: "+" }),
      reverse: expect.objectContaining({ strand: "-" }),
    });
    expect(pairs[0]?.productStart).toBeLessThanOrEqual(321);
    expect(pairs[0]?.productEnd).toBeGreaterThanOrEqual(327);
  });

  it("caps ORF result cardinality and reports truncation", () => {
    const result = findOpenReadingFrames({
      maxResults: 2,
      minAminoAcids: 1,
      sequence: "ATGATGTAAATGTAA",
      strands: "+",
    });
    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });
});
