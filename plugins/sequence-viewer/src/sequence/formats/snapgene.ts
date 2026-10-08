import {
  SEQUENCE_VIEWER_LIMITS,
  SequenceViewerLimitError,
} from "../../runtime-contract";
import { enrichCdsFeature } from "../feature-translation";
import type {
  SequenceFeature,
  SequenceFeatureSegment,
  SequenceParseWarning,
  SequenceRecord,
} from "../types";

// Compatibility is deliberately limited to revisions exercised by the primary
// Biopython SnapGene fixtures, not inferred from a matching filename or cookie.
// https://github.com/biopython/biopython/tree/master/Tests/SnapGene
// Packet and coordinate reference:
// https://github.com/biopython/biopython/blob/master/Bio/SeqIO/SnapGeneIO.py
const SUPPORTED_REVISIONS = new Set([
  "13:11",
  "13:12",
  "14:16",
  "15:19",
  "15:20",
]);
const MAX_XML_DEPTH = 32;
const MAX_WARNING_KINDS = 64;
const MAX_TRANSLATED_BASES = 1_000_000;
const utf8 = new TextDecoder("utf-8", { fatal: true });

type XmlElement = {
  attributes: Map<string, string>;
  children: Array<XmlElement>;
  name: string;
  text: string;
};

type Packet = { data: Uint8Array; type: number };
type Qualifiers = SequenceFeature["qualifiers"];

class Warnings {
  private readonly entries = new Map<string, SequenceParseWarning>();
  private omitted = 0;

  add(code: string, message: string, detail = ""): void {
    const key = `${code}:${detail}`;
    if (this.entries.has(key)) return;
    if (this.entries.size >= MAX_WARNING_KINDS) {
      this.omitted += 1;
      return;
    }
    this.entries.set(key, { code, message, severity: "warning" });
  }

  list(): Array<SequenceParseWarning> {
    const warnings = [...this.entries.values()];
    if (this.omitted > 0) {
      warnings.push({
        code: "snapgene-additional-warnings",
        message:
          "Additional unsupported SnapGene annotation properties were omitted from this bounded warning summary.",
        severity: "warning",
      });
    }
    return warnings;
  }
}

export function parseSnapGeneRecord({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName?: string;
}): { record: SequenceRecord; warnings: Array<SequenceParseWarning> } {
  if (bytes.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes) {
    throw new SequenceViewerLimitError(
      "snapgene-input-too-large",
      "SnapGene import exceeds the bounded artifact byte limit.",
    );
  }
  const packets = readPackets(bytes);
  const cookie = packets.shift();
  if (
    cookie?.type !== 9 ||
    cookie.data.length !== 14 ||
    utf8.decode(cookie.data.subarray(0, 8)) !== "SnapGene"
  ) {
    throw new Error(
      "The file does not start with a valid SnapGene cookie packet.",
    );
  }
  const header = new DataView(
    cookie.data.buffer,
    cookie.data.byteOffset,
    cookie.data.byteLength,
  );
  const sequenceType = header.getUint16(8);
  const exportVersion = header.getUint16(10);
  const importVersion = header.getUint16(12);
  if (sequenceType !== 1) {
    throw new Error("Only SnapGene DNA sequence containers are supported.");
  }
  if (!SUPPORTED_REVISIONS.has(`${exportVersion}:${importVersion}`)) {
    throw new Error(
      `Unsupported SnapGene revision ${exportVersion}:${importVersion}. Export this file to GenBank to view its sequence and annotations.`,
    );
  }

  const warnings = new Warnings();
  const singletonTypes = new Set<number>();
  let dna: Uint8Array | undefined;
  const xmlPackets: Array<{ root: XmlElement; type: number }> = [];
  for (const packet of packets) {
    if (packet.type === 9)
      throw new Error("A SnapGene file cannot contain a second cookie packet.");
    if ([0, 5, 6, 10].includes(packet.type)) {
      if (singletonTypes.has(packet.type))
        throw new Error(`Duplicate SnapGene packet type ${packet.type}.`);
      singletonTypes.add(packet.type);
      if (packet.type === 0) dna = packet.data;
      else xmlPackets.push({ root: parseXml(packet.data), type: packet.type });
    } else {
      warnings.add(
        "unsupported-snapgene-packet",
        `SnapGene packet 0x${packet.type.toString(16).padStart(2, "0")} is not imported; its application settings, history, or other data remain only in the original file.`,
        String(packet.type),
      );
    }
  }
  if (dna == null || dna.length < 2)
    throw new Error("The SnapGene file has no nonempty DNA sequence packet.");
  if (dna.length - 1 > SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues) {
    throw new SequenceViewerLimitError(
      "snapgene-residue-limit",
      "SnapGene sequence exceeds the total residue limit.",
    );
  }
  const flags = dna[0] ?? 0;
  const rawSequence = utf8.decode(dna.subarray(1));
  if (!/^[ACGTRYSWKMBDHVNacgtryswkmbdhvn]+$/.test(rawSequence)) {
    throw new Error(
      "The SnapGene DNA packet contains invalid or unsupported sequence symbols.",
    );
  }
  const sequence = rawSequence.toUpperCase();
  if ((flags & ~1) !== 0) {
    warnings.add(
      "unsupported-snapgene-dna-flags",
      "Only DNA topology is interpreted from the SnapGene sequence flags; strand chemistry and other flag properties are not reproduced.",
    );
  }
  const sourceLabel =
    fileName
      ?.split(/[/\\]/)
      .pop()
      ?.replace(/\.dna$/i, "") || "SnapGene sequence";
  const record: SequenceRecord = {
    features: [],
    id: sourceLabel,
    length: sequence.length,
    metadata: {
      snapgeneDnaFlags: String(flags),
      snapgeneExportVersion: String(exportVersion),
      snapgeneImportVersion: String(importVersion),
    },
    molecule: "dna",
    sequence,
    sourceLabel,
    topology: flags & 1 ? "circular" : "linear",
  };
  for (const { root, type } of xmlPackets) {
    const expectedRoot =
      type === 5 ? "Primers" : type === 6 ? "Notes" : "Features";
    if (root.name !== expectedRoot)
      throw new Error(`Expected a SnapGene ${expectedRoot} XML root.`);
    if (type === 6) readNotes(root, record, warnings);
    else if (type === 10) readFeatures(root, record, warnings);
    else readPrimers(root, record, warnings);
  }
  const translationWarnings: Array<SequenceParseWarning> = [];
  let translatedBases = 0;
  record.features = record.features.map((feature) => {
    if (feature.type.toLowerCase() !== "cds") return feature;
    const length =
      feature.segments?.reduce(
        (sum, segment) => sum + segment.end - segment.start + 1,
        0,
      ) ?? 0;
    if (length > MAX_TRANSLATED_BASES - translatedBases) {
      warnings.add(
        "snapgene-translation-budget",
        "Some CDS coordinate maps exceed the bounded import translation budget; source translations are retained where available, but those maps are unavailable.",
      );
      return {
        ...feature,
        translationTrackReliable: false,
        translationMappingUnavailableReason:
          "bounded SnapGene import translation budget",
      };
    }
    translatedBases += length;
    return enrichCdsFeature({
      feature,
      sequence,
      warnings: translationWarnings,
    });
  });
  for (const warning of translationWarnings)
    warnings.add(warning.code, warning.message);
  return { record, warnings: warnings.list() };
}

function readPackets(bytes: Uint8Array): Array<Packet> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: Array<Packet> = [];
  for (let offset = 0; offset < bytes.length;) {
    if (bytes.length - offset < 5)
      throw new Error("Truncated SnapGene packet header.");
    const type = view.getUint8(offset);
    const size = view.getUint32(offset + 1);
    offset += 5;
    if (size > bytes.length - offset)
      throw new Error("SnapGene packet extends beyond the end of the file.");
    if (packets.length >= SEQUENCE_VIEWER_LIMITS.input.maxTrackItems) {
      throw new SequenceViewerLimitError(
        "snapgene-packet-limit",
        "SnapGene file contains too many packets.",
      );
    }
    packets.push({ data: bytes.subarray(offset, offset + size), type });
    offset += size;
  }
  return packets;
}

function readNotes(
  root: XmlElement,
  record: SequenceRecord,
  warnings: Warnings,
): void {
  checkProperties(
    root,
    [],
    root.children.map((child) => child.name),
    warnings,
  );
  for (const child of root.children) {
    checkProperties(child, [...child.attributes.keys()], [], warnings, true);
    const value = plainText(child.text, warnings);
    addValue(record.metadata, `snapgene.${child.name}`, value);
    for (const [key, attribute] of child.attributes)
      addValue(record.metadata, `snapgene.${child.name}.${key}`, attribute);
    if (
      child.name === "Description" ||
      (child.name === "Comments" && !record.description)
    )
      record.description = value || undefined;
  }
}

function readFeatures(
  root: XmlElement,
  record: SequenceRecord,
  warnings: Warnings,
): void {
  checkProperties(root, ["nextValidID"], ["Feature"], warnings);
  for (const node of root.children.filter(
    (child) => child.name === "Feature",
  )) {
    checkProperties(
      node,
      ["name", "type", "directionality", "recentID"],
      ["Segment", "Q"],
      warnings,
    );
    const qualifiers: Qualifiers = {};
    const name = plainText(node.attributes.get("name") ?? "", warnings);
    const direction = node.attributes.get("directionality") ?? "0";
    const strand =
      direction === "1"
        ? "+"
        : direction === "2"
          ? "-"
          : direction === "0"
            ? "."
            : "?";
    if (strand === "?")
      warnings.add(
        "unsupported-snapgene-directionality",
        "Bidirectional or unknown SnapGene feature directionality is retained as unknown strand; its translation mapping is unavailable.",
      );
    addValue(qualifiers, "snapgene_directionality", direction);
    const sourceId = node.attributes.get("recentID");
    if (sourceId != null) addValue(qualifiers, "snapgene_id", sourceId);
    let segments: Array<SequenceFeatureSegment> = [];
    let mappingReason =
      strand === "." || strand === "?"
        ? "no single feature strand specified"
        : undefined;
    for (const segment of node.children.filter(
      (child) => child.name === "Segment",
    )) {
      checkProperties(
        segment,
        ["range", "type", "name", "color", "translated"],
        [],
        warnings,
      );
      const range = requiredAttribute(segment, "range");
      const parts = readRange(range, record, false);
      const segmentType = segment.attributes.get("type") ?? "standard";
      if (segmentType === "gap") {
        addValue(qualifiers, "snapgene_gap_range", range);
        warnings.add(
          "snapgene-gap-segments",
          "SnapGene gap segments are recorded as qualifiers and excluded from the biological feature path.",
        );
        continue;
      }
      if (
        segmentType !== "standard" ||
        (segment.attributes.has("translated") &&
          segment.attributes.get("translated") !== "1")
      ) {
        mappingReason = "unsupported SnapGene segment translation semantics";
        warnings.add(
          "unsupported-snapgene-segment",
          "A SnapGene segment has unsupported translation semantics; its coordinate bounds are retained, but translation mapping is unavailable.",
        );
      }
      const segmentName = segment.attributes.get("name");
      if (segmentName != null)
        addValue(
          qualifiers,
          "snapgene_segment_name",
          `${range}:${plainText(segmentName, warnings)}`,
        );
      const color = segment.attributes.get("color");
      if (color != null) {
        addValue(qualifiers, "snapgene_segment_color", `${range}:${color}`);
        warnings.add(
          "snapgene-display-properties",
          "SnapGene segment colors are retained as coordinate-labelled qualifiers, but native map styling is not reproduced.",
        );
      }
      segments.push(...parts);
    }
    if (segments.length === 0)
      throw new Error("SnapGene feature has no supported non-gap location.");
    if (strand === "-") segments = segments.reverse();
    for (const qualifier of node.children.filter(
      (child) => child.name === "Q",
    )) {
      checkProperties(qualifier, ["name"], ["V"], warnings);
      const key = requiredAttribute(qualifier, "name");
      if (qualifier.children.length === 0) addValue(qualifiers, key, "true");
      for (const value of qualifier.children.filter(
        (child) => child.name === "V",
      )) {
        checkProperties(value, ["text", "predef", "int"], [], warnings);
        const values = ["text", "predef", "int"].filter((attribute) =>
          value.attributes.has(attribute),
        );
        if (values.length !== 1) {
          warnings.add(
            "unsupported-snapgene-qualifier",
            "A SnapGene qualifier value did not have exactly one supported text, predef, or int representation and was not imported.",
          );
          continue;
        }
        const attribute = values[0] ?? "text";
        const rawValue = value.attributes.get(attribute) ?? "";
        if (
          attribute === "int" &&
          (!/^-?\d+$/.test(rawValue) || !Number.isSafeInteger(Number(rawValue)))
        )
          throw new Error("Invalid SnapGene integer qualifier.");
        addValue(
          qualifiers,
          key,
          plainText(rawValue, warnings).replaceAll(/\r\n?|\n/g, " "),
        );
      }
    }
    if (name && !Object.hasOwn(qualifiers, "label"))
      addValue(qualifiers, "label", name);
    else if (name) addValue(qualifiers, "snapgene_name", name);
    const type = node.attributes.get("type") || "misc_feature";
    const translation = firstValue(qualifiers.translation)
      ?.replaceAll(/\s+/g, "")
      .toUpperCase();
    if (type.toLowerCase() === "cds") {
      const codonStart = firstValue(qualifiers.codon_start);
      const geneticCode = firstValue(qualifiers.transl_table);
      if (codonStart != null && !/^[123]$/.test(codonStart))
        throw new Error("Invalid SnapGene CDS codon_start qualifier.");
      if (
        geneticCode != null &&
        (!/^\d+$/.test(geneticCode) ||
          !Number.isSafeInteger(Number(geneticCode)) ||
          Number(geneticCode) < 1)
      )
        throw new Error("Invalid SnapGene CDS transl_table qualifier.");
    }
    appendFeature(record, {
      ...featureLocation(segments, strand),
      id: `snapgene-feature-${record.features.length + 1}`,
      label: firstValue(qualifiers.label) || name || type,
      qualifiers,
      translation: translation || undefined,
      translationMappingUnavailableReason: mappingReason,
      translationSource: translation ? "qualifier" : undefined,
      translationTrackReliable: mappingReason == null,
      type,
    });
  }
}

function readPrimers(
  root: XmlElement,
  record: SequenceRecord,
  warnings: Warnings,
): void {
  checkProperties(
    root,
    ["nextValidID"],
    ["HybridizationParams", "Primer"],
    warnings,
  );
  const params = root.children.filter(
    (child) => child.name === "HybridizationParams",
  );
  if (params.length > 1)
    throw new Error("Duplicate SnapGene primer hybridization parameters.");
  const minLength = readOptionalNumber(params[0], "minContinuousMatchLen", 0);
  const minTm = readOptionalNumber(params[0], "minMeltingTemperature", 0);
  if (minLength != null && (!Number.isSafeInteger(minLength) || minLength < 0))
    throw new Error("Invalid SnapGene minimum primer match length.");
  if (params[0] != null)
    checkProperties(
      params[0],
      ["minContinuousMatchLen", "minMeltingTemperature"],
      [],
      warnings,
    );
  for (const primer of root.children.filter(
    (child) => child.name === "Primer",
  )) {
    checkProperties(
      primer,
      ["name", "sequence", "description", "recentID", "dateAdded"],
      ["BindingSite"],
      warnings,
    );
    const name = plainText(primer.attributes.get("name") ?? "Primer", warnings);
    const sites = primer.children.filter(
      (child) => child.name === "BindingSite",
    );
    const detailedSites = new Set<string>();
    // Simplified sites can precede their detailed equivalents in the XML.
    // Only suppress a duplicate when a detailed site survives visibility filters.
    const orderedSites = [
      ...sites.filter((site) => site.attributes.get("simplified") !== "1"),
      ...sites.filter((site) => site.attributes.get("simplified") === "1"),
    ];
    if (sites.length === 0)
      warnings.add(
        "snapgene-unbound-primer",
        "An unbound SnapGene primer has no genomic location and is not displayed as a feature.",
      );
    for (const site of orderedSites) {
      checkProperties(
        site,
        [
          "location",
          "boundStrand",
          "simplified",
          "annealedBases",
          "meltingTemperature",
        ],
        [],
        warnings,
      );
      const rawRange = requiredAttribute(site, "location");
      const boundStrand = site.attributes.get("boundStrand") ?? "0";
      if (boundStrand !== "0" && boundStrand !== "1")
        throw new Error("Unsupported SnapGene primer strand.");
      const strand = boundStrand === "1" ? "-" : "+";
      let segments = readRange(rawRange, record, true);
      if (strand === "-") segments = segments.reverse();
      if (
        site.attributes.get("simplified") === "1" &&
        detailedSites.has(`${rawRange}:${boundStrand}`)
      ) {
        warnings.add(
          "snapgene-simplified-primer-sites",
          "Duplicate simplified SnapGene primer sites are not shown twice.",
        );
        continue;
      }
      const annealed = site.attributes.get("annealedBases");
      const tm = readOptionalNumber(site, "meltingTemperature", undefined);
      if (
        (annealed != null && annealed.length < (minLength ?? 0)) ||
        (tm != null && tm < (minTm ?? 0))
      ) {
        warnings.add(
          "snapgene-hidden-primer-sites",
          "Primer sites below the file's hybridization length or melting-temperature threshold are not displayed, matching SnapGene's visible-site filtering.",
        );
        continue;
      }
      if (
        (annealed == null && (minLength ?? 0) > 0) ||
        (tm == null && (minTm ?? 0) > 0)
      ) {
        warnings.add(
          "snapgene-primer-filter-unknown",
          "Some primer sites lack the stored measurements needed to apply all hybridization thresholds; these imported sites may differ from SnapGene's visible sites.",
        );
      }
      if (site.attributes.get("simplified") !== "1")
        detailedSites.add(`${rawRange}:${boundStrand}`);
      const qualifiers: Qualifiers = {
        label: name,
        snapgene_primer_location: rawRange,
      };
      for (const key of ["sequence", "description", "recentID", "dateAdded"]) {
        const value = primer.attributes.get(key);
        if (value != null)
          addValue(qualifiers, `snapgene_${key}`, plainText(value, warnings));
      }
      if (annealed != null) addValue(qualifiers, "annealed_bases", annealed);
      if (tm != null) addValue(qualifiers, "melting_temperature", String(tm));
      appendFeature(record, {
        ...featureLocation(segments, strand),
        id: `snapgene-primer-${record.features.length + 1}`,
        label: name,
        qualifiers,
        type: "primer_bind",
      });
    }
  }
}

function readRange(
  range: string,
  record: SequenceRecord,
  primer: boolean,
): Array<SequenceFeatureSegment> {
  const match = /^(\d+)-(\d+)$/.exec(range);
  if (match == null) throw new Error("Invalid SnapGene annotation range.");
  const start = Number(match[1]) + (primer ? 1 : 0);
  const end = Number(match[2]) + (primer ? 1 : 0);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < 1 ||
    start > record.length ||
    end > record.length
  )
    throw new Error("SnapGene annotation range lies outside the sequence.");
  if (start <= end) return [{ start, end }];
  if (record.topology !== "circular")
    throw new Error(
      "An origin-spanning SnapGene annotation requires a circular sequence.",
    );
  return [
    { start, end: record.length },
    { start: 1, end },
  ];
}

function featureLocation(
  segments: Array<SequenceFeatureSegment>,
  strand: SequenceFeature["strand"],
): Pick<
  SequenceFeature,
  "start" | "end" | "segments" | "strand" | "sourceLocation"
> {
  let start = Infinity;
  let end = 0;
  for (const segment of segments) {
    start = Math.min(start, segment.start);
    end = Math.max(end, segment.end);
  }
  const forwardSegments = strand === "-" ? [...segments].reverse() : segments;
  const ranges = forwardSegments.map(
    (segment) => `${segment.start}..${segment.end}`,
  );
  const location =
    ranges.length === 1 ? (ranges[0] ?? "") : `join(${ranges.join(",")})`;
  return {
    start,
    end,
    segments,
    strand,
    sourceLocation: strand === "-" ? `complement(${location})` : location,
  };
}

function appendFeature(record: SequenceRecord, feature: SequenceFeature): void {
  if (record.features.length >= SEQUENCE_VIEWER_LIMITS.input.maxTrackItems)
    throw new SequenceViewerLimitError(
      "snapgene-feature-limit",
      "SnapGene file contains too many annotations.",
    );
  record.features.push(feature);
}

function requiredAttribute(node: XmlElement, name: string): string {
  const value = node.attributes.get(name);
  if (value == null || value.length === 0)
    throw new Error(`Missing SnapGene ${node.name} ${name} attribute.`);
  return value;
}

function readOptionalNumber(
  node: XmlElement | undefined,
  name: string,
  fallback: number | undefined,
): number | undefined {
  const value = node?.attributes.get(name);
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(parsed))
    throw new Error(`Invalid SnapGene ${name} value.`);
  return parsed;
}

function addValue(target: Qualifiers, key: string, value: string): void {
  const prior = Object.hasOwn(target, key) ? target[key] : undefined;
  if (Array.isArray(prior)) {
    prior.push(value);
    return;
  }
  const next = prior == null ? value : [prior, value];
  // Qualifier names are untrusted data, including __proto__ and constructor.
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value: next,
    writable: true,
  });
}

function firstValue(
  value: string | Array<string> | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function plainText(value: string, warnings: Warnings): string {
  const parts: Array<string> = [];
  let offset = 0;
  let hasMarkup = false;
  while (offset < value.length) {
    const start = value.indexOf("<", offset);
    const end = start === -1 ? -1 : value.indexOf(">", start + 1);
    if (start === -1 || end === -1) {
      parts.push(value.slice(offset));
      break;
    }
    parts.push(value.slice(offset, start));
    const tag = /^\/?([A-Za-z][A-Za-z0-9-]*)(?:[ \t\r\n][^<>]*|\/)?$/.exec(
      value.slice(start + 1, end),
    );
    if (tag == null) parts.push(value.slice(start, end + 1));
    else {
      hasMarkup = true;
      if (["p", "br", "div"].includes(tag[1]?.toLowerCase() ?? ""))
        parts.push(" ");
    }
    offset = end + 1;
  }
  if (hasMarkup) {
    warnings.add(
      "snapgene-rich-text",
      "SnapGene rich-text markup is displayed as plain text; formatting is not reproduced.",
    );
  }
  return parts.join("").trim();
}

function checkProperties(
  node: XmlElement,
  attributes: Array<string>,
  children: Array<string>,
  warnings: Warnings,
  allowText = false,
): void {
  const allowedAttributes = new Set(attributes);
  const allowedChildren = new Set(children);
  if (
    (!allowText && node.text.trim()) ||
    [...node.attributes.keys()].some((key) => !allowedAttributes.has(key)) ||
    node.children.some((child) => !allowedChildren.has(child.name))
  ) {
    warnings.add(
      "unsupported-snapgene-xml-property",
      `Some ${node.name} properties or child annotations are not represented by this viewer and remain in the original file.`,
      node.name,
    );
  }
}

/** Small, bounded XML subset reader: no DOM, DTDs, entity expansion, or I/O. */
function parseXml(bytes: Uint8Array): XmlElement {
  const xml = utf8.decode(bytes);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(xml))
    throw new Error("Invalid control character in SnapGene XML.");
  const stack: Array<XmlElement> = [];
  let root: XmlElement | undefined;
  let offset = 0;
  let nodes = 0;
  let declarationSeen = false;
  const appendText = (text: string): void => {
    const current = stack[stack.length - 1];
    if (current != null) current.text += text;
    else if (/[^ \t\r\n]/.test(text))
      throw new Error("Unexpected text outside the SnapGene XML root.");
  };
  while (offset < xml.length) {
    if (xml[offset] !== "<") {
      const next = xml.indexOf("<", offset);
      const end = next === -1 ? xml.length : next;
      const value = xml.slice(offset, end);
      if (value.includes("]]>")) throw new Error("Invalid SnapGene XML text.");
      appendText(decodeEntities(value));
      offset = end;
      continue;
    }
    if (xml.startsWith("<!--", offset)) {
      const end = xml.indexOf("-->", offset + 4);
      if (end === -1 || xml.slice(offset + 4, end).includes("--"))
        throw new Error("Malformed SnapGene XML comment.");
      offset = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", offset)) {
      const end = xml.indexOf("]]>", offset + 9);
      if (end === -1 || stack.length === 0)
        throw new Error("Malformed SnapGene XML CDATA.");
      appendText(xml.slice(offset + 9, end));
      offset = end + 3;
      continue;
    }
    if (xml.startsWith("<?xml", offset)) {
      const end = xml.indexOf("?>", offset + 5);
      const declaration = xml.slice(offset, end + 2);
      if (
        end === -1 ||
        offset !== 0 ||
        declarationSeen ||
        root != null ||
        !/^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(["'])1\.0\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(["'])UTF-8\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(["'])(?:yes|no)\3)?[ \t\r\n]*\?>$/i.test(
          declaration,
        )
      )
        throw new Error("Unsupported SnapGene XML declaration.");
      declarationSeen = true;
      offset = end + 2;
      continue;
    }
    if (xml.startsWith("<!", offset) || xml.startsWith("<?", offset))
      throw new Error(
        "DTD, entity declarations, and processing instructions are not supported in SnapGene XML.",
      );
    const close = xml.startsWith("</", offset);
    offset += close ? 2 : 1;
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(xml.slice(offset));
    if (nameMatch == null)
      throw new Error("Invalid SnapGene XML element name.");
    const name = nameMatch[0];
    offset += name.length;
    if (close) {
      while (/[ \t\r\n]/.test(xml[offset] ?? "") && offset < xml.length)
        offset += 1;
      if (xml[offset] !== ">" || stack.pop()?.name !== name)
        throw new Error("Mismatched SnapGene XML closing element.");
      offset += 1;
      continue;
    }
    const element: XmlElement = {
      attributes: new Map(),
      children: [],
      name,
      text: "",
    };
    let selfClosing = false;
    while (offset < xml.length) {
      const beforeSpace = offset;
      while (/[ \t\r\n]/.test(xml[offset] ?? "") && offset < xml.length)
        offset += 1;
      if (xml[offset] === ">") {
        offset += 1;
        break;
      }
      if (xml.startsWith("/>", offset)) {
        selfClosing = true;
        offset += 2;
        break;
      }
      if (beforeSpace === offset)
        throw new Error("Malformed SnapGene XML attribute separation.");
      const attribute =
        /^([A-Za-z_][A-Za-z0-9_.-]*)[ \t\r\n]*=[ \t\r\n]*(["'])/.exec(
          xml.slice(offset),
        );
      if (attribute == null)
        throw new Error("Malformed SnapGene XML attribute.");
      const key = attribute[1] ?? "";
      const quote = attribute[2] ?? '"';
      offset += attribute[0].length;
      const end = xml.indexOf(quote, offset);
      if (
        end === -1 ||
        element.attributes.has(key) ||
        xml.slice(offset, end).includes("<")
      )
        throw new Error("Invalid or duplicate SnapGene XML attribute.");
      element.attributes.set(key, decodeEntities(xml.slice(offset, end)));
      nodes += 1;
      if (nodes > SEQUENCE_VIEWER_LIMITS.input.maxTrackItems)
        throw new SequenceViewerLimitError(
          "snapgene-xml-limit",
          "SnapGene XML exceeds the bounded node or attribute limit.",
        );
      offset = end + 1;
    }
    if (xml[offset - 1] !== ">")
      throw new Error("Unterminated SnapGene XML element.");
    nodes += 1;
    if (
      nodes > SEQUENCE_VIEWER_LIMITS.input.maxTrackItems ||
      stack.length >= MAX_XML_DEPTH
    )
      throw new SequenceViewerLimitError(
        "snapgene-xml-limit",
        "SnapGene XML exceeds the bounded node or nesting limit.",
      );
    const parent = stack[stack.length - 1];
    if (parent != null) parent.children.push(element);
    else if (root == null) root = element;
    else throw new Error("SnapGene XML contains multiple roots.");
    if (!selfClosing) stack.push(element);
  }
  if (root == null || stack.length > 0)
    throw new Error("Incomplete SnapGene XML document.");
  return root;
}

function decodeEntities(value: string): string {
  return value.replaceAll(
    /&([^;&\s]*);|&/g,
    (entity: string, name: string | undefined) => {
      if (name === "amp") return "&";
      if (name === "lt") return "<";
      if (name === "gt") return ">";
      if (name === "quot") return '"';
      if (name === "apos") return "'";
      const numeric =
        name != null && /^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(name)
          ? name.startsWith("#x")
            ? Number.parseInt(name.slice(2), 16)
            : Number(name.slice(1))
          : NaN;
      if (
        numeric === 9 ||
        numeric === 10 ||
        numeric === 13 ||
        (numeric >= 0x20 &&
          numeric <= 0x10ffff &&
          !(numeric >= 0xd800 && numeric <= 0xdfff) &&
          numeric !== 0xfffe &&
          numeric !== 0xffff)
      )
        return String.fromCodePoint(numeric);
      throw new Error("Unknown or invalid entity in SnapGene XML.");
    },
  );
}
