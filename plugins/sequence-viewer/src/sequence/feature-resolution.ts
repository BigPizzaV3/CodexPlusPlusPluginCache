import type { SequenceFeature } from "./types";

export function resolveSequenceFeatureSelector(
  features: SequenceFeature[],
  selector: string,
): SequenceFeature[] {
  const query = normalize(selector);
  if (query.length === 0) {
    return [];
  }

  const exactIdMatches = features.filter(
    (feature) => normalize(feature.id) === query,
  );
  if (exactIdMatches.length > 0) {
    return exactIdMatches;
  }

  const exactBiologicalMatches = features.filter((feature) =>
    featureSearchTerms(feature).some((term) => term === query),
  );
  if (exactBiologicalMatches.length > 0) {
    return exactBiologicalMatches;
  }

  return features.filter((feature) =>
    featureSearchTerms(feature).some((term) => term.includes(query)),
  );
}

function featureSearchTerms(feature: SequenceFeature): string[] {
  return [
    feature.type,
    feature.label,
    ...Object.values(feature.qualifiers).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    ),
  ]
    .filter((value): value is string => value != null)
    .map(normalize)
    .filter(Boolean);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
