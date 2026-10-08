import { describe, expect, it } from "vitest";

import {
  getMaxFeatureLaneCount,
  getVisibleFeatureLanes,
} from "./feature-tracks";
import type { SequenceFeature } from "./types";

const OVERLAPPING_FEATURES: Array<SequenceFeature> = [
  {
    end: 12,
    id: "gene-1",
    qualifiers: {},
    start: 1,
    strand: "+",
    type: "gene",
  },
  {
    end: 9,
    id: "cds-1",
    qualifiers: {},
    start: 4,
    strand: "-",
    type: "CDS",
  },
  {
    end: 18,
    id: "misc-1",
    qualifiers: {},
    start: 13,
    strand: ".",
    type: "misc_feature",
  },
];

describe("feature track lanes", () => {
  it("stacks overlapping features and reuses lanes after spans end", () => {
    expect(getMaxFeatureLaneCount(OVERLAPPING_FEATURES)).toBe(2);
    expect(
      getVisibleFeatureLanes({
        features: OVERLAPPING_FEATURES,
        lineEnd: 20,
        lineStart: 1,
      }).map(({ feature, laneIndex }) => [feature.id, laneIndex]),
    ).toEqual([
      ["gene-1", 0],
      ["cds-1", 1],
      ["misc-1", 0],
    ]);
  });
});
