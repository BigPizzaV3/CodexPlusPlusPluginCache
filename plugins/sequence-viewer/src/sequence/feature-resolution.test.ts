import { describe, expect, it } from "vitest";

import { resolveSequenceFeatureSelector } from "./feature-resolution";
import type { SequenceFeature } from "./types";

const FEATURES: SequenceFeature[] = [
  {
    end: 90,
    id: "CDS-3",
    label: "KRAS coding sequence",
    qualifiers: {
      gene: "KRAS",
      product: "GTPase KRas",
    },
    start: 10,
    strand: "+",
    type: "CDS",
  },
  {
    end: 180,
    id: "CDS-4",
    label: "Alternative coding sequence",
    qualifiers: {
      gene: "KRAS2",
    },
    start: 100,
    strand: "+",
    type: "CDS",
  },
  {
    end: 60,
    id: "domain-5",
    label: "Kinase domain",
    qualifiers: {
      note: ["Catalytic protein kinase region", "curated"],
    },
    start: 20,
    strand: "+",
    type: "domain",
  },
];

describe("resolveSequenceFeatureSelector", () => {
  it("prioritizes an exact generated feature ID case-insensitively", () => {
    expect(resolveSequenceFeatureSelector(FEATURES, "cds-3")).toEqual([
      FEATURES[0],
    ]);
  });

  it("matches biological feature types and reports ambiguity", () => {
    expect(resolveSequenceFeatureSelector(FEATURES, "CDS")).toEqual([
      FEATURES[0],
      FEATURES[1],
    ]);
  });

  it("matches a unique biological label case-insensitively", () => {
    expect(resolveSequenceFeatureSelector(FEATURES, "kinase DOMAIN")).toEqual([
      FEATURES[2],
    ]);
  });

  it("matches qualifier values by substring", () => {
    expect(resolveSequenceFeatureSelector(FEATURES, "protein kinase")).toEqual([
      FEATURES[2],
    ]);
  });
});
