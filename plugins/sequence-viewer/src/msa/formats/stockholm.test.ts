import { describe, expect, it } from "vitest";

import { SEQUENCE_VIEWER_LIMITS } from "../../runtime-contract";
import { inferMsaMoleculeType } from "../molecule-inference";
import { parseMsa } from "../parser";
import type { MsaDocument } from "../types";

// Exact rows and annotations from the immutable Biopython Pfam fixture:
// github.com/biopython/biopython/blob/c9489604d1d9607602ca9199a3852c1219ed330f/Tests/Stockholm/pfam8.seed.txt
// Source SHA-256: 2e16e29871db7904f1e359953cba62195002572f3c4854b9419f2f889422d80e.
const PFAM_PDB_REFERENCES = [
  "PDB; 4I3Z D; 181-307;",
  "PDB; 4II5 D; 181-307;",
  "PDB; 4I3Z B; 181-307;",
  "PDB; 4II5 B; 181-307;",
  "PDB; 3QHW B; 181-307;",
  "PDB; 3QHW D; 181-307;",
  "PDB; 3QHR D; 181-307;",
  "PDB; 3QHR B; 181-307;",
];
const PFAM_CAENORHABDITIS_ROW = [
  "GIFDYYRHREV...HFRVRKYL..HKHPE...VDV.KTRAILIDW...MVEIQETFELNHETLYNAVKLT",
  "DMYLCKTK.NVDKN......TIQKLACVAIFIAAKY.......................DERS..PPLVD",
  "DLIYLS..............GD..RFSRDELLAMERELFATVGYDLG",
].join("");
const PFAM_MOUSE_ROW = [
  "DIHTYLREMEV..KCKPKVGYM..KRQPD...ITN.SMRAILVDW...LVEVGEEYKLQNETLHLAVNYI",
  "DRFLS.SM.SVLRG......KLQLVGTAAMLLASKF.......................EEIY..PPEVA",
  "EFVYIT..............DD..TYSKKQVLRMEHLVLKVLAFDLA",
].join("");
const PFAM_PROTEIN_SECONDARY_STRUCTURE = [
  "HHHHHHHHHHC..HTS-STTCT.TTCTSS...S-H.HHHHHHHHH...HHHHHHHTT--TTHHHHHHHHH",
  "HHHHH.HS.---CC......CHHHHHHHHHHHHHHH.......................HSSS..---HH",
  "HHHHHT..............TT..SS-HHHHHHHHHHHHHHTTT---",
].join("");
const PFAM_STOCKHOLM = [
  "# STOCKHOLM 1.0",
  "#=GF ID Cyclin_N",
  "#=GF AC PF00134.25",
  "#=GF DE Cyclin, N-terminal domain",
  "#=GS CCNA2_MOUSE/171-297 AC P51943.2",
  ...PFAM_PDB_REFERENCES.map(
    (reference) => `#=GS CCNA2_MOUSE/171-297 DR ${reference}`,
  ),
  `CCNB3_CAEEL/115-241 ${PFAM_CAENORHABDITIS_ROW}`,
  `CCNA2_MOUSE/171-297 ${PFAM_MOUSE_ROW}`,
  `#=GC SS_cons ${PFAM_PROTEIN_SECONDARY_STRUCTURE}`,
  "//",
].join("\n");

// Exact RF04178 alignment and structure from the immutable Biopython fixture:
// github.com/biopython/biopython/blob/c9489604d1d9607602ca9199a3852c1219ed330f/Tests/Stockholm/rfam1.seed.txt
// Source SHA-256: a77480898aab5cc85b2c3eb332b05242c77aef0b9e4a29f5177f7d54adf6c035.
const RFAM_FIRST_ROW = [
  "GUAAGUAAAAGUGUAACAGGAAGAAAGUUGCAGCAUAUAUGCGGUGAAUUAUGCGGUGUCAUAGGAAUUG",
  "AGGAUUUAUGUAAGAUGCUGAUAAUGAGUAAGGAACCUUAAAGUUAAUCGUUCCCUGUCUCUCCGCAGAA",
  "CCUACUGGACAAAACAGGACAGUAAGUGGACAAAAACCUACAAAUCAGC-GAUUUGUAGGUUUUUU",
].join("");
const RFAM_SECOND_ROW = [
  "AAAAGUAAGAGUGUAACAGGAAGAAAGUUGCAGCAUAUACGCGGUGAAUUAUUCGGUGUCAUAGGAGUAG",
  "AGUCUUUUGGUAAGAUGCUGAUAAUGAGUAGGGGAGAUGAAAGUUAAUCGUUCCCUGUCUCUCCGCUGG-",
  "--------AAAGAAUUGCAAAACAA--AGA-AAAUCCCUGUAAAUUAAU-ACUUUACGGGGAUUUU",
].join("");
const RFAM_THIRD_ROW = [
  "GUAAGUAAAAGUGUAACAGGAAGAAAGUUGCAGCAUAUAUGCGGUGAAUUAUGCGGUGUCAUAGGAAUUG",
  "AGGAUUUAUGUAAGAUGCUGAUAAUGAGUAAGGAACCUUAAAGUUAAUCGUUCCCUGUCUCUCCGCUGAA",
  "CUAUCCGGACAAAACCGGGCAAUGAACAGUCAAA-UCCCACAAAUUCAAUGAUUUGUGGGACUUUU",
].join("");
const RFAM_RNA_SECONDARY_STRUCTURE = [
  ":::::::::::<<<<<<_________>>>>>>,,,,,,,,((((,,,<<<<<-<<<<<<<----<<<___",
  "____>>>------>>>>>>>>>>>><<<<<-<<<<_______________>>>>->>->>>,))))----",
  "-----------------------------------<<<<<<<<<<<____>>>>>>>>>>>:::::",
].join("");
const RFAM_STOCKHOLM = [
  "# STOCKHOLM 1.0",
  "#=GF AC RF04178",
  "#=GF ID BTnc005",
  `AE015928.1/72774-72978 ${RFAM_FIRST_ROW}`,
  `CP000139.1/2819055-2819247 ${RFAM_SECOND_ROW}`,
  `FP929033.1/4930704-4930908 ${RFAM_THIRD_ROW}`,
  `#=GC SS_cons ${RFAM_RNA_SECONDARY_STRUCTURE}`,
  "//",
].join("\n");

function expectStockholmDocument(contents: string): MsaDocument {
  const result = parseMsa(contents, "public-family.sto");
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(result.message);
  }
  return result.document;
}

describe("Stockholm scientific metadata", () => {
  it("classifies genuine Pfam protein secondary structure without inventing RNA", () => {
    const document = expectStockholmDocument(PFAM_STOCKHOLM);

    expect(document.alignedLength).toBe(187);
    expect(document.formatMetadata).toMatchObject({
      "GF:AC": "PF00134.25",
      "GF:ID": "Cyclin_N",
    });
    expect(document.molecule).toMatchObject({
      confidence: "high",
      moleculeType: "protein",
    });
    expect(document.annotations).toContainEqual(
      expect.objectContaining({
        kind: "protein-secondary-structure",
        label: "SS_cons",
        values: PFAM_PROTEIN_SECONDARY_STRUCTURE,
      }),
    );
    expect(document.rnaStructure).toBeNull();
    expect(document.searchCapabilities).toMatchObject({
      supportsProteinAmbiguityCodes: true,
      supportsReverseComplement: false,
    });
  });

  it("preserves every genuine Pfam PDB cross-reference in source order", () => {
    const document = expectStockholmDocument(PFAM_STOCKHOLM);
    const mouseCyclin = document.rows.find(
      ({ id }) => id === "CCNA2_MOUSE/171-297",
    );

    expect(mouseCyclin?.metadata).toMatchObject({
      "GS:AC": "P51943.2",
      "GS:DR": PFAM_PDB_REFERENCES.join(" | "),
    });
    expect(mouseCyclin?.metadata?.["GS:DR"]?.split(" | ")).toHaveLength(8);
  });

  it("preserves genuine Rfam RNA classification and all 45 structure pairs", () => {
    const document = expectStockholmDocument(RFAM_STOCKHOLM);

    expect(document.alignedLength).toBe(206);
    expect(document.rows).toHaveLength(3);
    expect(document.formatMetadata).toMatchObject({
      "GF:AC": "RF04178",
      "GF:ID": "BTnc005",
    });
    expect(document.molecule).toMatchObject({
      confidence: "high",
      moleculeType: "rna",
    });
    expect(document.annotations).toContainEqual(
      expect.objectContaining({
        kind: "rna-secondary-structure",
        label: "SS_cons",
      }),
    );
    expect(document.rnaStructure?.pairs).toHaveLength(45);
  });

  it("prioritizes protein-exclusive residues over contradictory RNA annotations", () => {
    expect(
      inferMsaMoleculeType({
        annotations: [
          {
            id: "contradictory-structure",
            kind: "rna-secondary-structure",
            label: "SS_cons",
            values: "HHHH",
          },
        ],
        format: "stockholm",
        rows: [{ alignedSequence: "MQEI" }],
      }),
    ).toMatchObject({
      confidence: "high",
      moleculeType: "protein",
    });
  });

  it("bounds repeated row annotations and reports one truncation warning", () => {
    const document = expectStockholmDocument(
      [
        "# STOCKHOLM 1.0",
        ...Array.from(
          { length: 300 },
          (_, index) => `#=GS cyclin DR PDB; structure-${index};`,
        ),
        "cyclin MQEI",
        "//",
      ].join("\n"),
    );

    const references = document.rows[0]?.metadata?.["GS:DR"]?.split(" | ");
    expect(references).toHaveLength(256);
    expect(references?.[0]).toBe("PDB; structure-0;");
    expect(references?.at(-1)).toBe("PDB; structure-255;");
    expect(
      document.warnings.filter(
        ({ code }) => code === "stockholm-gs-metadata-limit",
      ),
    ).toHaveLength(1);
  });

  it("bounds repeated row annotations by UTF-8 bytes", () => {
    const boundedValue = "é".repeat(
      SEQUENCE_VIEWER_LIMITS.context.maxTextBytes / 2,
    );
    const document = expectStockholmDocument(
      [
        "# STOCKHOLM 1.0",
        `#=GS cyclin DR ${boundedValue}`,
        "#=GS cyclin DR overflow",
        "cyclin MQEI",
        "//",
      ].join("\n"),
    );

    expect(document.rows[0]?.metadata?.["GS:DR"]).toBe(boundedValue);
    expect(document.warnings).toContainEqual(
      expect.objectContaining({
        code: "stockholm-gs-metadata-limit",
        preserved: "ignored",
        severity: "warning",
      }),
    );
  });
});
