import { describe, expect, it } from "vitest";

import {
  getSelectedFeatureTranslation,
  getMaxTranslationTracksPerLine,
  getTranslationLettersForLine,
} from "./translation-track";
import type { SequenceFeature } from "./types";

const CDS_FEATURE: SequenceFeature = {
  end: 12,
  id: "cds-1",
  qualifiers: {},
  start: 1,
  strand: "+",
  translation: "MKPG",
  type: "CDS",
};

describe("translation track", () => {
  it("reserves one track for every co-visible CDS without allocating tracks for other lines", () => {
    expect(
      getMaxTranslationTracksPerLine({
        features: Array.from({ length: 3 }, (_, index) => ({
          ...CDS_FEATURE,
          id: `overlapping-${index}`,
          end: 120,
          translation: "M".repeat(40),
        })),
        lineWidth: 60,
        sequenceLength: 120,
      }),
    ).toBe(3);
    expect(
      getMaxTranslationTracksPerLine({
        features: [
          CDS_FEATURE,
          { ...CDS_FEATURE, id: "second-line", start: 61, end: 72 },
          { ...CDS_FEATURE, id: "unreliable", translationTrackReliable: false },
        ],
        lineWidth: 60,
        sequenceLength: 120,
      }),
    ).toBe(1);
  });

  it("counts compound translation tracks only on lines with mapped amino acids", () => {
    expect(
      getMaxTranslationTracksPerLine({
        features: [
          {
            ...CDS_FEATURE,
            end: 123,
            translation: "MK",
            translationCoordinateMap: [
              {
                aminoAcidIndex: 1,
                codonCoordinates: [1, 2, 3],
                displayCoordinate: 1,
              },
              {
                aminoAcidIndex: 2,
                codonCoordinates: [121, 122, 123],
                displayCoordinate: 121,
              },
            ],
          },
          { ...CDS_FEATURE, id: "intron-line", start: 61, end: 72 },
        ],
        lineWidth: 60,
        sequenceLength: 180,
      }),
    ).toBe(1);
  });

  it("aligns source-provided amino acids to codon starts", () => {
    expect(
      getTranslationLettersForLine({
        feature: CDS_FEATURE,
        lineEnd: 12,
        lineStart: 1,
      }),
    ).toEqual([
      { aminoAcid: "M", coordinate: 1 },
      { aminoAcid: "K", coordinate: 4 },
      { aminoAcid: "P", coordinate: 7 },
      { aminoAcid: "G", coordinate: 10 },
    ]);
  });

  it("shows selected CDS amino acids without inventing compound-location tracks", () => {
    expect(
      getSelectedFeatureTranslation({
        feature: CDS_FEATURE,
        selectionEnd: 8,
        selectionStart: 4,
      }),
    ).toEqual({ aminoAcidEnd: 3, aminoAcidStart: 2, translation: "KP" });
    expect(
      getTranslationLettersForLine({
        feature: { ...CDS_FEATURE, translationTrackReliable: false },
        lineEnd: 12,
        lineStart: 1,
      }),
    ).toEqual([]);
  });

  it("uses exact compound codon maps and ignores intron-only selections", () => {
    const joined: SequenceFeature = {
      ...CDS_FEATURE,
      end: 9,
      segments: [
        { end: 3, start: 1 },
        { end: 9, start: 7 },
      ],
      translation: "MK",
      translationCoordinateMap: [
        {
          aminoAcidIndex: 1,
          codonCoordinates: [1, 2, 3],
          displayCoordinate: 1,
        },
        {
          aminoAcidIndex: 2,
          codonCoordinates: [7, 8, 9],
          displayCoordinate: 7,
        },
      ],
    };

    expect(
      getSelectedFeatureTranslation({
        feature: joined,
        selectionEnd: 8,
        selectionStart: 7,
      }),
    ).toEqual({ aminoAcidEnd: 2, aminoAcidStart: 2, translation: "K" });
    expect(
      getSelectedFeatureTranslation({
        feature: joined,
        selectionEnd: 6,
        selectionStart: 4,
      }),
    ).toBeNull();
  });
});
