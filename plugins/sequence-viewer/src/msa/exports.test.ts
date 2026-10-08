import { describe, expect, it } from "vitest";

import {
  buildAlignedFasta,
  buildReferenceFasta,
  buildSearchHitsTsv,
  buildVisibleRangeSvg,
  buildVisibleRangeText,
} from "./exports";
import type { MsaSequenceRow } from "./types";

const rows: Array<MsaSequenceRow> = [
  {
    alignedSequence: "AC-G",
    id: "alpha",
    label: "alpha",
    ungappedLength: 3,
  },
  {
    alignedSequence: "ATCG",
    id: "beta",
    label: "beta",
    ungappedLength: 4,
  },
];

describe("MSA export helpers", () => {
  it("builds FASTA, reference FASTA, and visible-range text payloads", () => {
    expect(buildAlignedFasta(rows)).toBe(">alpha\nAC-G\n>beta\nATCG");
    expect(buildReferenceFasta({ label: "consensus", sequence: "ACCG" })).toBe(
      ">consensus\nACCG",
    );
    expect(buildVisibleRangeText({ endColumn: 3, rows, startColumn: 1 })).toBe(
      "alpha\tC-\nbeta\tTC",
    );
  });

  it("builds tabular hit exports and SVG range snapshots", () => {
    expect(
      buildSearchHitsTsv([
        {
          alignmentEndColumn: 3,
          alignmentStartColumn: 1,
          orientation: "forward",
          rowId: "alpha",
          rowLabel: "alpha",
          ungappedEndPosition: 3,
          ungappedStartPosition: 2,
        },
      ]),
    ).toContain("alpha\tforward\t2\t4\t2\t3");
    const svg = buildVisibleRangeSvg({
      endColumn: 4,
      rows,
      startColumn: 0,
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("alpha");
    expect(svg).toContain("AC-G");
  });

  it("neutralizes adversarial public-row labels in motif-hit TSV exports", () => {
    const hit = {
      alignmentEndColumn: 3,
      alignmentStartColumn: 1,
      orientation: "forward" as const,
      rowId: "CCNA2_MOUSE/171-297",
      rowLabel: "\u200b\t=HYPERLINK(\"https://example.invalid\")\r\n@SUM(1)",
      ungappedEndPosition: 3,
      ungappedStartPosition: 2,
    };

    const [header, row] = buildSearchHitsTsv([hit]).split("\n");
    expect(header).toBe(
      "row_label\torientation\talignment_start\talignment_end\tungapped_start\tungapped_end",
    );
    expect(row?.split("\t")).toEqual([
      "'\u200b =HYPERLINK(\"https://example.invalid\") @SUM(1)",
      "forward",
      "2",
      "4",
      "2",
      "3",
    ]);
  });

  it.each([
    ["=SUM(1,2)", "'=SUM(1,2)"],
    [" \t@SUM(1)", "'  @SUM(1)"],
    ["\ufeff\u200b-SUM(1)", "'\ufeff\u200b-SUM(1)"],
    ["\uff1dSUM(1)", "'\uff1dSUM(1)"],
    ["\u2003\uff20SUM(1)", "'\u2003\uff20SUM(1)"],
  ])("neutralizes copied alignment formula label %j", (label, expected) => {
    const row = {
      alignedSequence: "AC-G",
      id: "CCNA2_MOUSE/171-297",
      label,
      ungappedLength: 3,
    };

    expect(
      buildVisibleRangeText({
        endColumn: 3,
        rows: [row],
        startColumn: 1,
      }),
    ).toBe(`${expected}\tC-`);
  });

  it("prevents copied alignment labels from injecting spreadsheet rows or columns", () => {
    const maliciousRow = {
      alignedSequence: "AC-G",
      id: "CCNA2_MOUSE/171-297",
      label:
        "=HYPERLINK(\"https://example.invalid\")\r\n@SUM(1)\t=SUM(2)\r=SUM(3)\n+SUM(4)",
      ungappedLength: 3,
    };
    const genuinePublicRow = {
      alignedSequence: "A--G",
      id: "URS0000D6941A",
      label: "URS0000D6941A",
      ungappedLength: 2,
    };

    const result = buildVisibleRangeText({
      endColumn: 4,
      rows: [maliciousRow, genuinePublicRow],
      startColumn: 1,
    });
    const outputRows = result.split("\n");

    expect(outputRows).toHaveLength(2);
    expect(outputRows[0]?.split("\t")).toEqual([
      "'=HYPERLINK(\"https://example.invalid\") @SUM(1) =SUM(2) =SUM(3) +SUM(4)",
      "C-G",
    ]);
    expect(outputRows[1]?.split("\t")).toEqual(["URS0000D6941A", "--G"]);
  });

  it("does not change accession labels in FASTA or SVG exports", () => {
    const adversarialRow = {
      alignedSequence: "AC-G",
      id: "public-rfam-row",
      label: "=public-adversarial-label",
      ungappedLength: 3,
    };
    expect(buildAlignedFasta([adversarialRow])).toBe(
      ">=public-adversarial-label\nAC-G",
    );
    expect(
      buildVisibleRangeSvg({
        endColumn: 4,
        rows: [adversarialRow],
        startColumn: 0,
      }),
    ).toContain(">=public-adversarial-label</text>");
  });
});
