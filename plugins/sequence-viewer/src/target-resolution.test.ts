import { describe, expect, it } from "vitest";

import { resolveViewerTarget } from "./target-resolution";

const targets = [
  { id: "row-1", label: "duplicate" },
  { id: "row-2", label: "duplicate" },
];

describe("resolveViewerTarget", () => {
  it("prioritizes exact IDs and rejects ambiguous aliases", () => {
    expect(resolve("row-2")).toMatchObject({
      status: "resolved",
      target: { id: "row-2" },
    });
    expect(resolve("DUPLICATE")).toMatchObject({
      candidates: targets,
      status: "ambiguous",
    });
    expect(resolve("missing")).toEqual({ status: "not-found" });
  });
});

function resolve(selector: string) {
  return resolveViewerTarget({
    aliases: (target) => [target.label],
    id: (target) => target.id,
    selector,
    targets,
  });
}
