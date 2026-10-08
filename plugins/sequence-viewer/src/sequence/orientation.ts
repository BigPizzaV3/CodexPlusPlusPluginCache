import { reverseComplementNucleotide } from "../nucleotide-alphabet";

import type {
  SequenceFeature,
  SequenceRecord,
  SequenceSearchHit,
  SequenceSelection,
} from "./types";

export type SequenceOrientation = "forward" | "reverse-complement";

export function sourceCoordinateToDisplay(
  coordinate: number,
  length: number,
  orientation: SequenceOrientation,
): number {
  return orientation === "forward" ? coordinate : length - coordinate + 1;
}

export function sourceRangeToDisplay(
  range: { end: number; start: number },
  length: number,
  orientation: SequenceOrientation,
): { end: number; start: number } {
  if (orientation === "forward") return range;
  return {
    end: sourceCoordinateToDisplay(range.start, length, orientation),
    start: sourceCoordinateToDisplay(range.end, length, orientation),
  };
}

export function displaySelectionToSource(
  selection: SequenceSelection,
  length: number,
  orientation: SequenceOrientation,
): SequenceSelection {
  if (orientation === "forward") return selection;
  const range = sourceRangeToDisplay(selection, length, orientation);
  return {
    ...selection,
    ...range,
    segments:
      selection.segments == null
        ? undefined
        : selection.segments
            .map((segment) =>
              sourceRangeToDisplay(segment, length, orientation),
            )
            .reverse(),
  };
}

export function orientSequenceRecord(
  record: SequenceRecord,
  orientation: SequenceOrientation,
): SequenceRecord {
  if (orientation === "forward") return record;
  const { chromatogram: _chromatogram, ...sequenceRecord } = record;
  return {
    ...sequenceRecord,
    features: record.features.map((feature) =>
      orientFeature(feature, record.length),
    ),
    quality:
      record.quality == null
        ? undefined
        : {
            ascii: [...record.quality.ascii].reverse().join(""),
            phred: [...record.quality.phred].reverse(),
          },
    sequence: reverseComplementNucleotide(
      record.sequence,
      record.molecule === "rna" ? "rna" : "dna",
    ),
  };
}

export function orientSearchHit(
  hit: SequenceSearchHit,
  length: number,
  orientation: SequenceOrientation,
): SequenceSearchHit {
  if (orientation === "forward") return hit;
  return {
    ...hit,
    ...sourceRangeToDisplay(hit, length, orientation),
    orientation:
      hit.orientation === "forward" ? "reverse-complement" : "forward",
  };
}

function orientFeature(
  feature: SequenceFeature,
  length: number,
): SequenceFeature {
  const range = sourceRangeToDisplay(feature, length, "reverse-complement");
  return {
    ...feature,
    ...range,
    segments: feature.segments
      ?.map((segment) => ({
        ...segment,
        ...sourceRangeToDisplay(segment, length, "reverse-complement"),
      }))
      .reverse(),
    strand:
      feature.strand === "+"
        ? "-"
        : feature.strand === "-"
          ? "+"
          : feature.strand,
    translationCoordinateMap: feature.translationCoordinateMap?.map(
      (coordinate) => ({
        ...coordinate,
        codonCoordinates: coordinate.codonCoordinates.map((value) =>
          sourceCoordinateToDisplay(value, length, "reverse-complement"),
        ) as [number, number, number],
        displayCoordinate: sourceCoordinateToDisplay(
          coordinate.displayCoordinate,
          length,
          "reverse-complement",
        ),
      }),
    ),
  };
}
