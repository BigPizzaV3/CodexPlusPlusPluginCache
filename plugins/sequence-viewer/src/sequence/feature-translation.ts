import { complementNucleotideSymbol } from "../nucleotide-alphabet";
import { getGeneticCode, translateGeneticCodeCodon } from "./genetic-code";

import type {
  SequenceFeature,
  SequenceParseWarning,
  SequenceTranslationCoordinate,
} from "./types";

export function enrichCdsFeatures({
  features,
  sequence,
  warnings,
}: {
  features: Array<SequenceFeature>;
  sequence: string;
  warnings: Array<SequenceParseWarning>;
}): Array<SequenceFeature> {
  return features.map((feature) =>
    feature.type.toLowerCase() === "cds"
      ? enrichCdsFeature({ feature, sequence, warnings })
      : feature,
  );
}

export function enrichCdsFeature({
  feature,
  sequence,
  warnings,
}: {
  feature: SequenceFeature;
  sequence: string;
  warnings: Array<SequenceParseWarning>;
}): SequenceFeature {
  const codonStart = parseCodonStart(feature.qualifiers.codon_start);
  const geneticCodeId = parseGeneticCodeId(feature.qualifiers.transl_table);
  const sourceTranslation = normalizeTranslation(
    getSingleQualifier(feature.qualifiers.translation) ?? feature.translation,
  );
  const unavailableReason = feature.translationMappingUnavailableReason;
  const coordinates =
    unavailableReason == null ? getBiologicalCoordinates(feature) : [];
  const offsetCoordinates = coordinates.slice(codonStart - 1);
  const codonCount = Math.floor(offsetCoordinates.length / 3);
  const translation =
    sourceTranslation ??
    translateCoordinates(
      sequence,
      offsetCoordinates,
      geneticCodeId,
      feature.strand,
    ).replace(/\*$/, "");
  let mappingReason = unavailableReason;
  if (getGeneticCode(geneticCodeId) == null) {
    if (sourceTranslation == null) {
      mappingReason ??= `unsupported genetic code ${geneticCodeId}`;
    }
    warnings.push({
      code: "unsupported-genetic-code",
      message:
        sourceTranslation == null
          ? `CDS '${feature.label ?? feature.id}' uses unsupported transl_table ${geneticCodeId}; no source translation was provided, so computed translation and amino-acid mapping are unavailable.`
          : mappingReason == null
            ? `CDS '${feature.label ?? feature.id}' uses unsupported transl_table ${geneticCodeId}; the source translation and its exact codon-coordinate mapping were preserved, but residues cannot be recomputed.`
            : `CDS '${feature.label ?? feature.id}' uses unsupported transl_table ${geneticCodeId}; the source translation remains visible, but amino-acid mapping is unavailable because ${mappingReason}.`,
      severity: "warning",
    });
  }
  if (translation.length > codonCount && mappingReason == null) {
    mappingReason = "translation is longer than the exact CDS codon path";
  }
  const translationCoordinateMap =
    mappingReason == null
      ? createTranslationCoordinateMap(
          offsetCoordinates,
          Math.min(translation.length, codonCount),
        )
      : undefined;
  return {
    ...feature,
    codonStart,
    geneticCodeId,
    translation: translation.length === 0 ? undefined : translation,
    translationCoordinateMap,
    translationMappingUnavailableReason: mappingReason,
    translationSource:
      translation.length === 0
        ? undefined
        : sourceTranslation == null
          ? "computed"
          : "qualifier",
    translationTrackReliable: mappingReason == null,
  };
}

function getBiologicalCoordinates(feature: SequenceFeature): Array<number> {
  const segments = feature.segments ?? [
    { end: feature.end, start: feature.start },
  ];
  const coordinates: Array<number> = [];
  for (const segment of segments) {
    if (segment.remoteAccession != null) continue;
    if (feature.strand === "-") {
      for (
        let coordinate = segment.end;
        coordinate >= segment.start;
        coordinate -= 1
      ) {
        coordinates.push(coordinate);
      }
    } else {
      for (
        let coordinate = segment.start;
        coordinate <= segment.end;
        coordinate += 1
      ) {
        coordinates.push(coordinate);
      }
    }
  }
  return coordinates;
}

function createTranslationCoordinateMap(
  coordinates: Array<number>,
  aminoAcidCount: number,
): Array<SequenceTranslationCoordinate> {
  return Array.from({ length: aminoAcidCount }, (_, index) => {
    const codon = coordinates.slice(index * 3, index * 3 + 3) as [
      number,
      number,
      number,
    ];
    return {
      aminoAcidIndex: index + 1,
      codonCoordinates: codon,
      displayCoordinate: Math.min(...codon),
    };
  });
}

function translateCoordinates(
  sequence: string,
  coordinates: Array<number>,
  geneticCodeId: number,
  strand: SequenceFeature["strand"],
): string {
  if (getGeneticCode(geneticCodeId) == null) return "";
  let translation = "";
  for (let index = 0; index + 2 < coordinates.length; index += 3) {
    const bases = coordinates
      .slice(index, index + 3)
      .map((coordinate) => sequence[coordinate - 1] ?? "N");
    const orientedBases = bases.map((base) => {
      const normalized = base.toUpperCase().replace("U", "T");
      // Coordinates are already in biological order. Negative-strand bases
      // still need complementation after their order is reversed.
      return strand === "-"
        ? complementNucleotideSymbol(normalized, "dna")
        : normalized;
    });
    translation += translateCodon(
      orientedBases.join(""),
      geneticCodeId,
      index === 0,
    );
  }
  return translation;
}

export function translateCodon(
  codon: string,
  geneticCodeId = 1,
  isInitiator = false,
): string {
  return translateGeneticCodeCodon(codon, geneticCodeId, isInitiator);
}

function parseCodonStart(value: string | Array<string> | undefined): 1 | 2 | 3 {
  const parsed = Number(getSingleQualifier(value) ?? 1);
  return parsed === 2 || parsed === 3 ? parsed : 1;
}

function parseGeneticCodeId(value: string | Array<string> | undefined): number {
  const parsed = Number(getSingleQualifier(value) ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeTranslation(value: string | undefined): string | undefined {
  const normalized = value?.replaceAll(/\s+/g, "").toUpperCase();
  return normalized == null || normalized.length === 0 ? undefined : normalized;
}

function getSingleQualifier(
  value: string | Array<string> | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
