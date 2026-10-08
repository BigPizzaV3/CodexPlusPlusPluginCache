import {
  getSequenceLineDisplayOffsetCh,
  SEQUENCE_RESIDUE_WIDTH_CH,
} from "./sequence-line-layout";
import {
  getDefaultSequencePalette,
  getCompatibleSequencePalettes,
  getSequenceResidueStyle,
} from "./sequence-palette";
import type { SequenceFeature, SequencePaletteId } from "./types";

export function TranslationTrack({
  feature,
  lineEnd,
  lineStart,
  paletteId,
}: {
  feature: SequenceFeature;
  lineEnd: number;
  lineStart: number;
  paletteId: SequencePaletteId;
}): React.ReactElement | null {
  const letters = getTranslationLettersForLine({
    feature,
    lineEnd,
    lineStart,
  });
  if (letters.length === 0) {
    return null;
  }
  const translationPalette =
    paletteId === "muted-nucleic-acid"
      ? getDefaultSequencePalette("protein")
      : (getCompatibleSequencePalettes("protein").find(
          ({ id }) => id === paletteId,
        )?.id ?? "neutral");

  return (
    <div className="bio-sequence-track-row">
      <span className="bio-sequence-track-label">AA</span>
      <div className="relative h-5">
        {letters.map(({ aminoAcid, coordinate }) => (
          <span
            className="bio-sequence-translation-residue"
            data-translation-coordinate={coordinate}
            key={`${feature.id}-${coordinate}-${aminoAcid}`}
            style={{
              ...getSequenceResidueStyle({
                molecule: "protein",
                paletteId: translationPalette,
                residue: aminoAcid,
              }),
              left: `${getSequenceLineDisplayOffsetCh({ coordinate, lineStart })}ch`,
              width: `${SEQUENCE_RESIDUE_WIDTH_CH}ch`,
            }}
          >
            {aminoAcid}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}

export function getTranslationLettersForLine({
  feature,
  lineEnd,
  lineStart,
}: {
  feature: SequenceFeature;
  lineEnd: number;
  lineStart: number;
}): Array<{ aminoAcid: string; coordinate: number }> {
  if (
    feature.translation == null ||
    feature.translation.length === 0 ||
    feature.translationTrackReliable === false
  ) {
    return [];
  }

  return [...feature.translation].flatMap((aminoAcid, index) => {
    const coordinate = getTranslationDisplayCoordinate(feature, index);
    return coordinate >= lineStart && coordinate <= lineEnd
      ? [{ aminoAcid, coordinate }]
      : [];
  });
}

export function getMaxTranslationTracksPerLine({
  features,
  lineWidth,
  sequenceLength,
}: {
  features: Array<SequenceFeature>;
  lineWidth: number;
  sequenceLength: number;
}): number {
  const trackCounts = new Map<number, number>();
  let maximum = 0;
  for (const feature of features) {
    if (
      feature.translation == null ||
      feature.translationTrackReliable === false
    ) {
      continue;
    }
    const featureLines = new Set<number>();
    for (let index = 0; index < feature.translation.length; index += 1) {
      const coordinate = getTranslationDisplayCoordinate(feature, index);
      if (coordinate < 1 || coordinate > sequenceLength) continue;
      const line = Math.floor((coordinate - 1) / lineWidth);
      if (featureLines.has(line)) continue;
      featureLines.add(line);
      const count = (trackCounts.get(line) ?? 0) + 1;
      trackCounts.set(line, count);
      maximum = Math.max(maximum, count);
    }
  }
  return maximum;
}

function getTranslationDisplayCoordinate(
  feature: SequenceFeature,
  index: number,
): number {
  return (
    feature.translationCoordinateMap?.[index]?.displayCoordinate ??
    (feature.strand === "-"
      ? feature.end - index * 3 - 2
      : feature.start + index * 3)
  );
}

export function getSelectedFeatureTranslation({
  feature,
  selectionEnd,
  selectionStart,
}: {
  feature: SequenceFeature;
  selectionEnd: number;
  selectionStart: number;
}): {
  aminoAcidEnd: number;
  aminoAcidStart: number;
  translation: string;
} | null {
  if (feature.translation == null || feature.translation.length === 0) {
    return null;
  }
  if (feature.translationMappingUnavailableReason != null) return null;
  if (feature.translationCoordinateMap != null) {
    const overlapping = feature.translationCoordinateMap.filter(
      ({ codonCoordinates }) =>
        codonCoordinates.some(
          (coordinate) =>
            coordinate >= selectionStart && coordinate <= selectionEnd,
        ),
    );
    const first = overlapping[0];
    const last = overlapping.at(-1);
    if (first == null || last == null) return null;
    const translation = feature.translation.slice(
      first.aminoAcidIndex - 1,
      last.aminoAcidIndex,
    );
    return translation.length === 0
      ? null
      : {
          aminoAcidEnd: last.aminoAcidIndex,
          aminoAcidStart: first.aminoAcidIndex,
          translation,
        };
  }
  if ((feature.segments?.length ?? 1) !== 1) return null;
  const overlapStart = Math.max(feature.start, selectionStart);
  const overlapEnd = Math.min(feature.end, selectionEnd);
  if (overlapStart > overlapEnd) {
    return null;
  }
  const aminoAcidStart = getFeatureAminoAcidIndexForCoordinate(
    feature,
    overlapStart,
  );
  const aminoAcidEnd = getFeatureAminoAcidIndexForCoordinate(
    feature,
    overlapEnd,
  );
  const start = Math.min(aminoAcidStart, aminoAcidEnd);
  const end = Math.max(aminoAcidStart, aminoAcidEnd);
  const translation = feature.translation.slice(start - 1, end);
  return translation.length === 0
    ? null
    : { aminoAcidEnd: end, aminoAcidStart: start, translation };
}

function getFeatureAminoAcidIndexForCoordinate(
  feature: SequenceFeature,
  coordinate: number,
): number {
  const zeroBasedIndex =
    feature.strand === "-"
      ? Math.floor((feature.end - coordinate) / 3)
      : Math.floor((coordinate - feature.start) / 3);
  return Math.min(
    feature.translation?.length ?? 1,
    Math.max(1, zeroBasedIndex + 1),
  );
}
