import { describe, expect, it } from "vitest";

import {
  featureContainsCoordinate,
  featureOverlapsRange,
  parseFeatureLocation,
} from "./feature-location";

describe("feature locations", () => {
  it("preserves joined segments and complement strand", () => {
    expect(parseFeatureLocation("complement(join(<1..3,7..>9))")).toEqual({
      end: 9,
      segments: [
        { end: 9, partialEnd: true, partialStart: false, start: 7 },
        { end: 3, partialEnd: false, partialStart: true, start: 1 },
      ],
      start: 1,
      strand: "-",
      translationTrackReliable: false,
      translationMappingUnavailableReason: "partial boundary",
    });
  });

  it("retains remote segments without projecting them onto the local record", () => {
    expect(parseFeatureLocation("join(1..3,OTHER.1:5..8)")).toEqual({
      end: 3,
      segments: [
        { end: 3, partialEnd: false, partialStart: false, start: 1 },
        {
          end: 8,
          partialEnd: false,
          partialStart: false,
          remoteAccession: "OTHER.1",
          start: 5,
        },
      ],
      start: 1,
      strand: "+",
      translationTrackReliable: false,
      translationMappingUnavailableReason: "remote segment",
    });
  });

  it("marks exact local joins as safe for codon-coordinate mapping", () => {
    expect(parseFeatureLocation("join(1..3,7..9)")).toMatchObject({
      segments: [
        { end: 3, start: 1 },
        { end: 9, start: 7 },
      ],
      strand: "+",
      translationTrackReliable: true,
    });
  });

  it("does not treat gaps between joined segments as feature sequence", () => {
    const parsed = parseFeatureLocation("join(1..3,7..9)");
    expect(parsed).not.toBeNull();
    if (parsed == null) {
      throw new Error("Expected a parsed compound feature.");
    }
    const feature = {
      ...parsed,
      id: "joined",
      qualifiers: {},
      sourceLocation: "join(1..3,7..9)",
      type: "CDS" as const,
    };

    expect(featureContainsCoordinate(feature, 2)).toBe(true);
    expect(featureContainsCoordinate(feature, 5)).toBe(false);
    expect(featureOverlapsRange(feature, 4, 6)).toBe(false);
    expect(featureOverlapsRange(feature, 3, 7)).toBe(true);
  });
});
