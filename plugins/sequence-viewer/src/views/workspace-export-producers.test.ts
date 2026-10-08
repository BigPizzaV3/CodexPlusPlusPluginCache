import { describe, expect, it } from "vitest";

import {
  buildAlignedFasta,
  buildSearchHitsTsv,
  buildVisibleRangeSvg,
} from "../msa/exports";
import { buildFastaExport, buildFastqExport } from "../sequence/exports";
import type { SequenceRecord } from "../sequence/types";
import {
  createAlignedFastaWorkspaceProducer,
  createDelimitedWorkspaceProducer,
  createFastaWorkspaceProducer,
  createFastqWorkspaceProducer,
  createJsonWorkspaceProducer,
  createNewickWorkspaceProducer,
  createSearchHitsTsvWorkspaceProducer,
  createVisibleRangeSvgWorkspaceProducer,
} from "./workspace-export-producers";

describe("workspace export producers", () => {
  it("is byte-identical to Sequence and Alignment string exports", async () => {
    const record = {
      description: "demo",
      features: [],
      id: "r1",
      length: 4,
      metadata: {},
      molecule: "dna",
      quality: { ascii: "IIII", phred: [40, 40, 40, 40] },
      sequence: "ACGT",
      sourceLabel: "record",
      topology: "linear",
    } satisfies SequenceRecord;
    const rows = [
      { alignedSequence: "A-", id: "a", label: "a", ungappedLength: 1 },
      { alignedSequence: "AC", id: "b", label: "b", ungappedLength: 2 },
    ];
    await expect(materialize(createFastaWorkspaceProducer([record]))).resolves.toBe(
      buildFastaExport([record]),
    );
    await expect(materialize(createFastqWorkspaceProducer(record))).resolves.toBe(
      buildFastqExport(record),
    );
    await expect(
      materialize(createAlignedFastaWorkspaceProducer(rows)),
    ).resolves.toBe(buildAlignedFasta(rows));
    await expect(
      materialize(
        createVisibleRangeSvgWorkspaceProducer({
          endColumn: 2,
          rows,
          startColumn: 0,
        }),
      ),
    ).resolves.toBe(
      buildVisibleRangeSvg({ endColumn: 2, rows, startColumn: 0 }),
    );
  });

  it("matches JSON.stringify pretty output while streaming large strings", async () => {
    const value = { rows: [{ label: "café", sequence: "A".repeat(100_000) }] };
    await expect(materialize(createJsonWorkspaceProducer(value))).resolves.toBe(
      JSON.stringify(value, null, 2),
    );
  });

  it("streams CSV, TSV, and Newick escaping across bounded fragments", async () => {
    await expect(
      materialize(
        createDelimitedWorkspaceProducer(
          [
            ["name", "value"],
            ['a"b', "line\nbreak"],
          ],
          ",",
        ),
      ),
    ).resolves.toBe('name,value\n"a""b","line\nbreak"');
    await expect(
      materialize(
        createDelimitedWorkspaceProducer([["a\tb", "line\r\nbreak"]], "\t"),
      ),
    ).resolves.toBe("a b\tline break");
    await expect(
      materialize(createNewickWorkspaceProducer("(a:1,b:1)")),
    ).resolves.toBe("(a:1,b:1);\n");
  });

  it("neutralizes formula cells in CSV and TSV without changing strands or numbers", async () => {
    const values = [
      "=1+1",
      "\t=1+1",
      "\r=1+1",
      "\n=1+1",
      "\u200b=1+1",
      "\uff1d1+1",
      "-",
      "+",
      -42,
      "CCNA2_MOUSE/171-297",
    ];

    const csv = await materialize(createDelimitedWorkspaceProducer([values], ","));
    expect(csv).toContain("'=1+1,'\t=1+1");
    expect(csv).toContain('"\'\r=1+1","\'\n=1+1"');
    expect(csv).toContain("'\u200b=1+1,'\uff1d1+1");
    expect(csv.endsWith(",-,+,-42,CCNA2_MOUSE/171-297")).toBe(true);

    const tsv = await materialize(createDelimitedWorkspaceProducer([values], "\t"));
    expect(tsv.split("\t")).toEqual([
      "'=1+1",
      "' =1+1",
      "' =1+1",
      "' =1+1",
      "'\u200b=1+1",
      "'\uff1d1+1",
      "-",
      "+",
      "-42",
      "CCNA2_MOUSE/171-297",
    ]);
  });

  it("keeps sanitized spreadsheet cells in bounded streaming fragments", async () => {
    const value = `=${"A".repeat(12_000)}`;
    for (const delimiter of [",", "\t"] as const) {
      const producer = createDelimitedWorkspaceProducer([[value]], delimiter);
      const fragments: Array<string> = [];
      for await (const fragment of producer()) {
        if (typeof fragment !== "string") {
          throw new Error("Spreadsheet exporter emitted an unexpected binary chunk.");
        }
        fragments.push(fragment);
      }
      expect(fragments.join("")).toBe(`'${value}`);
      expect(Math.max(...fragments.map((fragment) => fragment.length))).toBeLessThanOrEqual(
        4_096,
      );
    }
  });

  it("sanitizes formula and row-injection payloads in streamed motif hits", async () => {
    const hits = [
      {
        alignmentEndColumn: 3,
        alignmentStartColumn: 1,
        orientation: "forward" as const,
        rowId: "public-pfam-row",
        rowLabel: "\ufeff\t=HYPERLINK(\"https://example.invalid\")\r\n@SUM(1)",
        ungappedEndPosition: 3,
        ungappedStartPosition: 2,
      },
    ];

    const result = await materialize(createSearchHitsTsvWorkspaceProducer(hits));
    expect(result).toBe(buildSearchHitsTsv(hits));
    expect(result.split("\n")).toHaveLength(2);
    expect(result.split("\n")[1]?.split("\t")).toHaveLength(6);
    expect(result).toContain("'\ufeff =HYPERLINK");
    expect(result).toContain(") @SUM(1)\tforward\t2\t4\t2\t3");
  });
});

async function materialize(
  producer: () => AsyncIterable<string | Uint8Array>,
): Promise<string> {
  const chunks: Array<Uint8Array> = [];
  for await (const chunk of producer()) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
