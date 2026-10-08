import {
  classifySequenceArtifact,
  type SequenceArtifactClassification,
} from "../../biological-sequence-artifact-classifier";
import { inferSequenceMolecule } from "../molecule-inference";
import { parseFeatureLocation } from "../feature-location";
import { enrichCdsFeatures } from "../feature-translation";
import type {
  SequenceDocument,
  SequenceFeature,
  SequenceParseWarning,
  SequenceRecord,
} from "../types";
import { makeUniqueSequenceRecords } from "./fasta";

export function parseEmblDocument({
  classification,
  contents,
  fileName,
}: {
  classification?: SequenceArtifactClassification;
  contents: string;
  fileName?: string;
}): SequenceDocument {
  const warnings: Array<SequenceParseWarning> = [];
  const normalizedContents = contents.replaceAll(/\r\n?/g, "\n");
  const records = makeUniqueSequenceRecords(
    splitEmblRecords(normalizedContents).map((recordContents) =>
      parseEmblRecord(recordContents, warnings),
    ),
  );

  return {
    classification:
      classification ?? classifySequenceArtifact({ contents, fileName }),
    fileName,
    format: "embl",
    kind: records.length === 1 ? "annotated-sequence" : "sequence-collection",
    records,
    warnings,
  };
}

function parseEmblRecord(
  contents: string,
  warnings: Array<SequenceParseWarning>,
): Omit<SequenceRecord, "id" | "length"> {
  const id = readField(contents, "ID");
  const accession = readField(contents, "AC");
  const description = readField(contents, "DE");
  const organism = readField(contents, "OS");
  const sequence = parseEmblSequence(contents);
  const sourceLabel =
    accession.split(/[;\s]/)[0] || id.split(/[;\s]/)[0] || "embl";

  return {
    description: description || undefined,
    features: enrichCdsFeatures({
      features: parseEmblFeatures(contents, warnings),
      sequence,
      warnings,
    }),
    metadata: {
      accession,
      description,
      id,
      organism,
    },
    molecule: inferSequenceMolecule([sequence]),
    sequence,
    sourceLabel,
  };
}

function parseEmblSequence(contents: string): string {
  const sequenceMatch = /^SQ\s+.+$/m.exec(contents);
  if (sequenceMatch == null) {
    return "";
  }
  return (
    contents
      .slice(sequenceMatch.index + sequenceMatch[0].length)
      .split(/^\/\//m)[0]
      ?.replaceAll(/[^A-Za-z]/g, "")
      .toUpperCase() ?? ""
  );
}

function parseEmblFeatures(
  contents: string,
  warnings: Array<SequenceParseWarning>,
): Array<SequenceFeature> {
  const features: Array<SequenceFeature> = [];
  let currentFeature: {
    location: string;
    qualifiers: Record<string, string | Array<string>>;
    type: string;
  } | null = null;
  let currentQualifier: {
    key: string;
    value: string;
  } | null = null;

  const flushQualifier = (): void => {
    if (currentFeature == null || currentQualifier == null) {
      return;
    }
    addQualifier(
      currentFeature.qualifiers,
      currentQualifier.key,
      stripQuotedValue(currentQualifier.value),
    );
    currentQualifier = null;
  };

  const flushFeature = (): void => {
    if (currentFeature == null) {
      return;
    }
    flushQualifier();
    const location = parseFeatureLocation(currentFeature.location);
    if (location == null) {
      warnings.push({
        code: "unsupported-embl-location",
        message: `Could not fully parse EMBL feature location '${currentFeature.location}'.`,
        severity: "warning",
      });
      currentFeature = null;
      return;
    }
    if (!location.translationTrackReliable) {
      warnings.push({
        code: "ambiguous-embl-location",
        message: `Retained EMBL feature bounds for '${currentFeature.location}', but exact translation mapping is unavailable: ${location.translationMappingUnavailableReason ?? "ambiguous location"}.`,
        severity: "info",
      });
    }
    features.push({
      end: location.end,
      id: `${currentFeature.type}-${features.length + 1}`,
      label: getFeatureLabel(currentFeature.qualifiers, currentFeature.type),
      qualifiers: currentFeature.qualifiers,
      segments: location.segments,
      sourceLocation: currentFeature.location,
      start: location.start,
      strand: location.strand,
      translation: getSingleQualifier(currentFeature.qualifiers.translation),
      translationMappingUnavailableReason:
        location.translationMappingUnavailableReason,
      translationTrackReliable: location.translationTrackReliable,
      type: currentFeature.type,
    });
    currentFeature = null;
  };

  for (const rawLine of contents.split("\n")) {
    const featureMatch = /^FT\s{3}(\S+)\s+(.+)$/.exec(rawLine);
    if (featureMatch != null) {
      flushFeature();
      currentFeature = {
        location: featureMatch[2] ?? "",
        qualifiers: {},
        type: featureMatch[1] ?? "misc_feature",
      };
      continue;
    }
    const qualifierMatch = /^FT\s{19}\/([^=]+)(?:=(.*))?$/.exec(rawLine);
    if (qualifierMatch != null && currentFeature != null) {
      flushQualifier();
      currentQualifier = {
        key: qualifierMatch[1] ?? "note",
        value: qualifierMatch[2] ?? "true",
      };
      continue;
    }

    const qualifierContinuationMatch = /^FT\s{19}(.+)$/.exec(rawLine);
    if (qualifierContinuationMatch != null && currentFeature != null) {
      if (currentQualifier != null) {
        currentQualifier.value = appendQualifierContinuation(
          currentQualifier.key,
          currentQualifier.value,
          qualifierContinuationMatch[1] ?? "",
        );
      } else {
        currentFeature.location += qualifierContinuationMatch[1]?.trim() ?? "";
      }
    }
  }
  flushFeature();
  return features;
}

function readField(contents: string, fieldName: string): string {
  return contents
    .split("\n")
    .flatMap((line) => {
      const match = new RegExp(`^${fieldName}\\s+(.+)$`).exec(line);
      return match?.[1] == null ? [] : [match[1].trim()];
    })
    .join(" ");
}

function stripQuotedValue(value: string): string {
  return value.replace(/^"/, "").replace(/"$/, "");
}

function addQualifier(
  qualifiers: Record<string, string | Array<string>>,
  key: string,
  value: string,
): void {
  const existingValue = qualifiers[key];
  qualifiers[key] =
    existingValue == null
      ? value
      : Array.isArray(existingValue)
        ? existingValue.concat(value)
        : [existingValue, value];
}

function appendQualifierContinuation(
  key: string,
  value: string,
  continuation: string,
): string {
  const trimmedContinuation = continuation.trim();
  return `${value}${key === "translation" ? "" : " "}${trimmedContinuation}`;
}

function splitEmblRecords(contents: string): string[] {
  return contents
    .split(/^\/\/\s*$/m)
    .map((record) => record.trim())
    .filter((record) => /^ID\s+/m.test(record));
}

function getFeatureLabel(
  qualifiers: Record<string, string | Array<string>>,
  fallback: string,
): string {
  return (
    getSingleQualifier(qualifiers.gene) ??
    getSingleQualifier(qualifiers.product) ??
    fallback
  );
}

function getSingleQualifier(
  value: string | Array<string> | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
