import { describe, expect, it } from "vitest";

import {
  ALIGNMENT_ROW_GROUP_METADATA_KEY,
  addAlignmentGap,
  alignSequences,
  assignAlignmentRowGroup,
  deleteAlignmentGap,
  exportAlignedFasta,
  needlemanWunsch,
  removeAlignmentColumns,
  removeAlignmentRows,
  removeGappyAlignmentColumns,
  reorderAlignmentRows,
  sortAlignmentRows,
} from "./alignment-editing";
import { parseMsa } from "./parser";

describe("alignment generation and safe-copy edits", () => {
  it("performs deterministic global pairwise alignment", () => {
    expect(needlemanWunsch("ACGT", "AGT")).toMatchObject({
      left: "ACGT",
      right: "A-GT",
      score: 4,
    });
  });

  it("builds a rectangular exploratory center-star MSA", () => {
    const result = alignSequences([
      { id: "a", label: "alpha", sequence: "ACGT" },
      { id: "b", label: "beta", sequence: "AGT" },
      { id: "c", label: "gamma", sequence: "ACGTT" },
    ]);

    expect(result.engine).toBe("builtin-center-star");
    expect(
      new Set(result.rows.map(({ alignedSequence }) => alignedSequence.length)),
    ).toEqual(new Set([result.alignedLength]));
    expect(result.rows.map(({ ungappedLength }) => ungappedLength)).toEqual([
      4, 3, 5,
    ]);
    expect(result.warning).toContain("publication-grade");
  });

  it("honors explicit engine selection", () => {
    expect(() =>
      alignSequences(
        [
          { id: "a", label: "alpha", sequence: "ACGT" },
          { id: "b", label: "beta", sequence: "AGT" },
          { id: "c", label: "gamma", sequence: "ACGTT" },
        ],
        undefined,
        "builtin-pairwise",
      ),
    ).toThrow("exactly two sequences");
    expect(
      alignSequences(
        [
          { id: "a", label: "alpha", sequence: "ACGT" },
          { id: "b", label: "beta", sequence: "AGT" },
        ],
        undefined,
        "builtin-center-star",
      ).engine,
    ).toBe("builtin-center-star");
  });

  it("rejects center-star work that exceeds the aggregate dynamic-programming budget", () => {
    expect(() =>
      alignSequences(
        Array.from({ length: 8 }, (_, index) => ({
          id: `row-${index}`,
          label: `row-${index}`,
          sequence: "A".repeat(1_800),
        })),
        undefined,
        "builtin-center-star",
      ),
    ).toThrow("20,000,000 total dynamic-programming cells");
  });

  it("keeps rows and annotation widths synchronized while removing columns", () => {
    const document = parseDocument(`>a\nAC-GT\n>b\nA--GT\n`);
    document.annotations = [
      { id: "quality", kind: "quality", label: "Quality", values: "12345" },
    ];
    const edited = removeAlignmentColumns(document, 2, 3);

    expect(edited.document.alignedLength).toBe(3);
    expect(
      edited.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["AGT", "AGT"]);
    expect(edited.document.annotations[0]?.values).toBe("145");
    expect(edited.document.rnaStructure).toBeNull();
  });

  it("removes gappy columns at the requested threshold", () => {
    const edited = removeGappyAlignmentColumns(
      parseDocument(`>a\nA-CG\n>b\nA--G\n>c\nATCG\n`),
      2 / 3,
    );
    expect(
      edited.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["ACG", "A-G", "ACG"]);
    expect(edited.change.parameters).toMatchObject({ removedCount: 1 });
  });

  it("preserves ungapped columns and their annotations at a zero gap threshold", () => {
    const document = parseDocument(`>a\nA-.CG-\n>b\nAT.CG-\n>c\nATCCG-\n`);
    const originalAlignedSequences = document.rows.map(
      ({ alignedSequence }) => alignedSequence,
    );
    document.annotations = [
      { id: "quality", kind: "quality", label: "Quality", values: "123456" },
    ];
    const firstRowId = document.rows[0]?.id ?? "";
    document.insertions = [
      {
        afterAlignmentColumn: 0,
        residues: "a",
        rowId: firstRowId,
        sourceKind: "other",
      },
      {
        afterAlignmentColumn: 1,
        residues: "b",
        rowId: firstRowId,
        sourceKind: "other",
      },
      {
        afterAlignmentColumn: 3,
        residues: "c",
        rowId: firstRowId,
        sourceKind: "other",
      },
    ];

    const edited = removeGappyAlignmentColumns(document, 0);

    expect(edited.document.alignedLength).toBe(3);
    expect(
      edited.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["ACG", "ACG", "ACG"]);
    expect(edited.document.annotations[0]?.values).toBe("145");
    expect(edited.document.insertions).toEqual([
      {
        afterAlignmentColumn: 0,
        residues: "a",
        rowId: firstRowId,
        sourceKind: "other",
      },
      {
        afterAlignmentColumn: 1,
        residues: "c",
        rowId: firstRowId,
        sourceKind: "other",
      },
    ]);
    expect(edited.change.parameters).toEqual({
      minimumGapFraction: 0,
      removedCount: 3,
    });
    expect(document.alignedLength).toBe(6);
    expect(
      document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(originalAlignedSequences);
    expect(document.annotations[0]?.values).toBe("123456");
    expect(document.insertions).toHaveLength(3);
  });

  it("retains all 228 gap-free columns in the public 447-column hedgehog alignment", () => {
    const alignment = [
      "CLUSTAL 2.0.9 multiple sequence alignment",
      "",
      ...PUBLIC_HEDGEHOG_ALIGNMENT_ROWS.map(
        ({ fragments, label }) => `${label} ${fragments.join("")}`,
      ),
    ].join("\n");
    const result = parseMsa(alignment, "hedgehog.aln");
    if (result.status !== "success") throw new Error(result.message);
    const document = result.document;

    expect(document.rows).toHaveLength(5);
    expect(document.alignedLength).toBe(447);

    const edited = removeGappyAlignmentColumns(document, 0);

    expect(edited.document.alignedLength).toBe(228);
    expect(edited.change.parameters).toEqual({
      minimumGapFraction: 0,
      removedCount: 219,
    });
    expect(edited.document.rows).toHaveLength(5);
    expect(
      edited.document.rows.every(
        ({ alignedSequence }) =>
          alignedSequence.length === 228 && !/[-.]/u.test(alignedSequence),
      ),
    ).toBe(true);
    expect(document.alignedLength).toBe(447);
    expect(
      document.rows.some(({ alignedSequence }) => alignedSequence.includes("-")),
    ).toBe(true);
  });

  it("removes only completely gapped columns at the maximum gap threshold", () => {
    const edited = removeGappyAlignmentColumns(
      parseDocument(`>a\nA-C-\n>b\nAT--\n>c\nATC-\n`),
      1,
    );

    expect(
      edited.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["A-C", "AT-", "ATC"]);
    expect(edited.change.parameters).toEqual({
      minimumGapFraction: 1,
      removedCount: 1,
    });
  });

  it("adds and deletes a row-local gap without breaking rectangularity", () => {
    const document = parseDocument(`>a\nACGT\n>b\nACGT\n`);
    const added = addAlignmentGap(document, document.rows[0]?.id ?? "", 2);
    expect(
      added.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["A-CGT", "ACGT-"]);
    const deleted = deleteAlignmentGap(
      added.document,
      added.document.rows[0]?.id ?? "",
      2,
    );
    expect(
      deleted.document.rows.map(({ alignedSequence }) => alignedSequence),
    ).toEqual(["ACGT-", "ACGT-"]);
  });

  it("removes, reorders, and sorts rows using exact internal IDs", () => {
    const document = parseDocument(`>zeta\nAAAA\n>alpha\nAAAT\n>far\nTTTT\n`);
    const [zeta, alpha, far] = document.rows;
    const reordered = reorderAlignmentRows(
      document,
      [far?.id, alpha?.id, zeta?.id].filter((id): id is string => id != null),
    );
    expect(reordered.document.rows.map(({ label }) => label)).toEqual([
      "far",
      "alpha",
      "zeta",
    ]);
    const sorted = sortAlignmentRows(
      reordered.document,
      "identity-to-reference",
      zeta?.id,
    );
    expect(sorted.document.rows.map(({ label }) => label)).toEqual([
      "zeta",
      "alpha",
      "far",
    ]);
    const removed = removeAlignmentRows(sorted.document, [alpha?.id ?? ""]);
    expect(removed.document.rows.map(({ label }) => label)).toEqual([
      "zeta",
      "far",
    ]);
  });

  it("assigns reversible row groups and sorts groups without mutating source metadata", () => {
    const document = parseDocument(`>zeta\nAAAA\n>alpha\nAAAT\n>far\nTTTT\n`);
    const grouped = assignAlignmentRowGroup(
      document,
      [document.rows[0]?.id ?? "", document.rows[2]?.id ?? ""],
      "cohort-b",
    );
    expect(document.rows.every(({ metadata }) => metadata == null)).toBe(true);
    expect(
      grouped.document.rows
        .filter(
          ({ metadata }) =>
            metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY] != null,
        )
        .map(({ label }) => label),
    ).toEqual(["zeta", "far"]);
    const alphaGrouped = assignAlignmentRowGroup(
      grouped.document,
      [document.rows[1]?.id ?? ""],
      "cohort-a",
    );
    expect(
      sortAlignmentRows(alphaGrouped.document, "group").document.rows.map(
        ({ label }) => label,
      ),
    ).toEqual(["alpha", "far", "zeta"]);
    const cleared = assignAlignmentRowGroup(
      alphaGrouped.document,
      [document.rows[0]?.id ?? ""],
      null,
    );
    expect(
      cleared.document.rows[0]?.metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY],
    ).toBeUndefined();
  });

  it("exports edited rows as round-trippable aligned FASTA", () => {
    const result = alignSequences([
      { id: "a", label: "alpha", sequence: "ACGT" },
      { id: "b", label: "beta", sequence: "AGT" },
    ]);
    const exported = exportAlignedFasta(result.rows);
    const reparsed = parseMsa(exported, "edited.aln-fasta");
    expect(reparsed.status).toBe("success");
    if (reparsed.status === "success") {
      expect(reparsed.document.rows).toHaveLength(2);
      expect(reparsed.document.alignedLength).toBe(result.alignedLength);
    }
  });
});

function parseDocument(contents: string) {
  const result = parseMsa(contents, "fixture.aln-fasta");
  if (result.status !== "success") throw new Error(result.message);
  return result.document;
}

// Public Biopython ClustalW hedgehog protein alignment at commit
// c9489604d1d9607602ca9199a3852c1219ed330f, Tests/Clustalw/hedgehog.aln.
// Original SHA-256: 5aecd4f542de9c8b357bf658c6aad4cc08756a872c7458ac5fa863f5b34dfb3e.
const PUBLIC_HEDGEHOG_ALIGNMENT_ROWS = [
  {
    label: "gi|167877390|gb|EDS40773.1|",
    fragments: [
      "MFNLVSGTGGSSCCHRRNCFANRKKFFTMLLIFLLYMVSQVQSCGPGRGI",
      "GGPRRT-RKLLPLVFKQHVPNVSENSLGASGMQEGPISRNDSKFRSLETN",
      "YNKDIIFKDEEGTGADRVMTQRCKEKLNILAVSVMNQWPGLRLMVTEGWD",
      "EDHMHARESLHYEGRAVDIMTSDKDRSKIGMLARLAVEAGFDWVFYESRN",
      "HIHCSVKSDSSQSNHASGCFTGDSTVQTINGEHRKLSELQIGEKVLSVD-",
      "SSGRIVYSEVMMFMDRDTHQSREFVHIETDGG-AHLTVTPAHLVMVWQKE",
      "IGESRY---------LFADRIQEGDYVLV--NIDNNLEPRKVLRISAKLS",
      "QGVYAPLTSEGTVLVDSIAASCYALIDSQSVAHLSFLPYRVVQKVMDLFK",
      "FS-SQSHSLGLPRHEGIHWYAKSLYSIKDYVLPTDWLYH--------",
    ],
  },
  {
    label: "gi|167234445|ref|NP_001107837.",
    fragments: [
      "---------------------MRSASAAALLLAALLVVQAVRACGPGRGV",
      "GRRRGP-RKLTPLVFKQHVPNVPENTLTASGLTEGRIGRNDSRFKDLVPN",
      "YNQDIVFKDEEGTGADRLMTQRCKEKLNTLAISVMNQWPGVRLLVTEGWD",
      "EEGYHTPESLHYEGRAVDITTSDRDRSKYGMLARLAVEAGFDWVYYESRA",
      "HIHCSVKSESSQAAKYGGCFSGESTVLTSTGLRRNLSSLQIGEKIQALDP",
      "STNELVFSEVLLFLDYNPSQRRQFLHITLASG-RTLTVTPSHLLVLDDRT",
      "MK--------------YAQKLQPGDFLLVSDNAKNALISEKIVRLEAVWR",
      "SGVFAPLTGVGTLVVNDVVASCYATIDSQWLAHWAFAPIRWVAKLWD---",
      "------SGLRKP-GVGVFWYARLLYATADFVLPSHLLHE--------",
    ],
  },
  {
    label: "gi|74100009|gb|AAZ99217.1|",
    fragments: [
      "-------------MPQR----SLRHQLGMILVFFLLVTSHSLACGPGRGP",
      "GKRRGP-RKRTPLVFKQHIPNVSENTVGASGIHEGKITKPDPRFKEMVTN",
      "LNPNIVFRDEEENNEDRVMSKRCKDKLNTLAIAVMNEWPGVKLRVTEAWD",
      "TQGHHAPTSLHYEGRAVDITTSDRVRSRYGMLARLAVEAGFDWVYYESRS",
      "HIHCSVRSDSLDTTHYGGCFPRTGKVVVRNKGTITLDQLKVGDSVLSVD-",
      "LQGELTYSEVIAFLDTNKDSSGYFHRIETENG-HTIRLTGKHLIYSSYTN",
      "RTRFDLNDNDSEFEATYADQVQIGDYVMTT-DRTAGLFASRVKKIAAVSE",
      "KGVVAPLTKSGNIIVDGVVVSCYALINSDYIAHASFFFLRGLHQVTSHIP",
      "FVSWAESPLASYAIDGIHWYAKLLYKIAPLFLDRTLLYMND------",
    ],
  },
  {
    label: "gi|13990994|dbj|BAA33523.2|",
    fragments: [
      "------------MSPAR----LRPRLHFCLVLLLLLVVPAAWGCGPGRVV",
      "GSRRRPPRKLVPLAYKQFSPNVPEKTLGASGRYEGKIARSSERFKELTPN",
      "YNPDIIFKDEENTGADRLMTQRCKDRLNSLAISVMNQWPGVKLRVTEGWD",
      "EDGHHSEESLHYEGRAVDITTSDRDRNKYGLLARLAVEAGFDWVYYESKA",
      "HVHCSVKSEHSAAAKTGGCFPAGAQVRLESGARVALSAVRPGDRVLAMG-",
      "EDGSPTFSDVLILLDREPHRLRAFQVIETQDPPRRLALTPAHLLFTADNH",
      "TEPAAR------FRATFASHVQPGQYVLVA--GAPGLQPARVAAVSTHVA",
      "LGAYAPLTKHGTLVVEDVVASCFAAVADHHLAQLAFWPLRLFHSLAWG--",
      "---------SWTPGEGVHWYPQLLYRLGRLLLEEGSFHPLGMSGAGS",
    ],
  },
  {
    label: "gi|56122354|gb|AAV74328.1|",
    fragments: [
      "----------------------LAADDQGRLLYSDFLTFLDRDDGAKKVF",
      "YVIETREPRERLLLTAAHLLFVAPHNDSATGGPEASSGSGPP--------",
      "----------------------SGGALGPRALFASRVRPGQRVYVVAERD",
      "GDRRLLP------------------------------------------A",
      "AVHSVTLSEEAAGAYAP--LTAQGTILINR--------------------",
      "-----VLASCYAVIEEHSWAHRAFAPFRLAHA------------------",
      "-----------------------------------LLAALAPARTDRGGD",
      "SGGGDRGGGGGRVALPAPGAADAPGAG-----------------------",
      "------------ATAGIHWYSQLLYQIGTWLLDSEALHPLGMAVKSS",
    ],
  },
] as const;
