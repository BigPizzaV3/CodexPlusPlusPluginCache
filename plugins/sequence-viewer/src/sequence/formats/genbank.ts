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

export function parseGenBankDocument({
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
    splitGenBankRecords(normalizedContents).map((recordContents) =>
      parseGenBankRecord(recordContents, warnings),
    ),
  );
  const sourceClassification =
    classification ?? classifySequenceArtifact({ contents, fileName });
  const moleculeKinds = new Set(records.map(({ molecule }) => molecule));
  const molecule =
    moleculeKinds.size === 1
      ? (records[0]?.molecule ?? sourceClassification.molecule)
      : moleculeKinds.has("dna") && moleculeKinds.has("rna")
        ? "nucleic-acid-ambiguous"
        : sourceClassification.molecule;

  return {
    classification: { ...sourceClassification, molecule },
    fileName,
    format: "genbank",
    kind: records.length === 1 ? "annotated-sequence" : "sequence-collection",
    records,
    warnings,
  };
}

function parseGenBankRecord(
  contents: string,
  warnings: Array<SequenceParseWarning>,
): Omit<SequenceRecord, "id" | "length"> {
  const locusLine = contents.match(/^LOCUS\s+(.+)$/m)?.[1] ?? "";
  const definition = readWrappedField(contents, "DEFINITION");
  const accession = readWrappedField(contents, "ACCESSION");
  const version = readWrappedField(contents, "VERSION");
  const source = readWrappedField(contents, "SOURCE");
  const originMatch = /^ORIGIN\s*$/m.exec(contents);
  const sequence =
    originMatch == null
      ? ""
      : contents
          .slice(originMatch.index + originMatch[0].length)
          .split(/^\/\//m)[0]
          ?.replaceAll(/[^A-Za-z]/g, "")
          .toUpperCase() ?? "";
  const features = enrichCdsFeatures({
    features: parseGenBankFeatures(contents, warnings),
    sequence,
    warnings,
  });
  const sourceLabel =
    accession.split(/\s+/)[0] || locusLine.split(/\s+/)[0] || "genbank";
  const topology = /\bcircular\b/i.test(locusLine) ? "circular" : "linear";
  const declaredMolecule = /\bbp\s+([^\s]+)/iu.exec(locusLine)?.[1];

  return {
    description: definition || undefined,
    features,
    metadata: {
      accession,
      definition,
      locus: locusLine,
      source,
      version,
    },
    molecule:
      declaredMolecule != null && /rna$/iu.test(declaredMolecule)
        ? "rna"
        : inferSequenceMolecule([sequence]),
    sequence,
    sourceLabel,
    topology,
  };
}

function parseGenBankFeatures(
  contents: string,
  warnings: Array<SequenceParseWarning>,
): Array<SequenceFeature> {
  const featuresBlock = /^FEATURES\s+Location\/Qualifiers\s*$/m.exec(contents);
  const originMatch = /^ORIGIN\s*$/m.exec(contents);
  if (featuresBlock == null || originMatch == null) {
    return [];
  }

  const lines = contents
    .slice(featuresBlock.index + featuresBlock[0].length, originMatch.index)
    .split("\n");
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
        code: "unsupported-genbank-location",
        message: `Could not fully parse GenBank feature location '${currentFeature.location}'.`,
        severity: "warning",
      });
      currentFeature = null;
      return;
    }
    const label = getFeatureLabel(
      currentFeature.qualifiers,
      currentFeature.type,
    );
    if (!location.translationTrackReliable) {
      warnings.push({
        code: "ambiguous-genbank-location",
        message: `Retained GenBank feature bounds for '${currentFeature.location}', but exact translation mapping is unavailable: ${location.translationMappingUnavailableReason ?? "ambiguous location"}.`,
        severity: "info",
      });
    }
    features.push({
      end: location.end,
      id: `${currentFeature.type}-${features.length + 1}`,
      label,
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

  for (const rawLine of lines) {
    const featureMatch = /^\s{5}(\S+)\s+(.+)$/.exec(rawLine);
    if (featureMatch != null) {
      flushFeature();
      currentFeature = {
        location: featureMatch[2] ?? "",
        qualifiers: {},
        type: featureMatch[1] ?? "misc_feature",
      };
      continue;
    }

    const qualifierMatch = /^\s{21}\/([^=]+)(?:=(.*))?$/.exec(rawLine);
    if (qualifierMatch != null && currentFeature != null) {
      flushQualifier();
      currentQualifier = {
        key: qualifierMatch[1] ?? "note",
        value: qualifierMatch[2] ?? "true",
      };
      continue;
    }

    const qualifierContinuationMatch = /^\s{21}(.+)$/.exec(rawLine);
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

function readWrappedField(contents: string, fieldName: string): string {
  const lines = contents.split("\n");
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^${fieldName}\\s+`).test(line),
  );
  if (startIndex === -1) {
    return "";
  }
  const firstLine = new RegExp(`^${fieldName}\\s+(.+)$`).exec(
    lines[startIndex] ?? "",
  )?.[1];
  const values = firstLine == null ? [] : [firstLine.trim()];
  for (const line of lines.slice(startIndex + 1)) {
    const continuation = /^\s{12}(\S.*)$/.exec(line)?.[1];
    if (continuation == null) {
      break;
    }
    values.push(continuation.trim());
  }
  return values.join(" ");
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

function splitGenBankRecords(contents: string): string[] {
  return contents
    .split(/^\/\/\s*$/m)
    .map((record) => record.trim())
    .filter((record) => /^LOCUS\s+/m.test(record));
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
