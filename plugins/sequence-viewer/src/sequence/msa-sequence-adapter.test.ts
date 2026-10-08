import { describe, expect, it } from "vitest";

import { classifySequenceArtifact } from "../biological-sequence-artifact-classifier";
import { parseMsa } from "../msa/parser";
import { createSequenceDocumentFromMsa } from "./msa-sequence-adapter";

describe("createSequenceDocumentFromMsa", () => {
  it("restores A3M insertion residues in sequence mode", () => {
    const contents = [">query", "AC-DE", ">hit", "ACaa-DE"].join("\n");
    const result = parseMsa(contents, "/tmp/profile.a3m");
    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error(result.message);
    }

    const document = createSequenceDocumentFromMsa({
      classification: classifySequenceArtifact({
        contents,
        fileName: "profile.a3m",
      }),
      document: result.document,
      fileName: "profile.a3m",
    });

    expect(document.records.map((record) => record.sequence)).toEqual([
      "ACDE",
      "ACaaDE",
    ]);
  });
});
