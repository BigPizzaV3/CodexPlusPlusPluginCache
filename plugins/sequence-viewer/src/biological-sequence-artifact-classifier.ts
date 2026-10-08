import { isExplicitMsaFile } from "./msa/file-kind";
import { looksLikePir, parsePir } from "./msa/formats/pir";
import { createTextLineReader } from "./text-lines";

export type SequenceArtifactKind =
  | "single-sequence"
  | "sequence-collection"
  | "multiple-sequence-alignment"
  | "fastq"
  | "annotated-sequence"
  | "chromatogram"
  | "unknown";

export type SequenceMoleculeKind =
  | "dna"
  | "rna"
  | "protein"
  | "nucleic-acid-ambiguous"
  | "unknown";

export type SequenceArtifactClassification = {
  alignment: FastaAlignmentAssessment | null;
  confidence: "low" | "medium" | "high";
  evidence: Array<string>;
  kind: SequenceArtifactKind;
  molecule: SequenceMoleculeKind;
  suggestedViewer: "msa" | "raw" | "sequence";
};

export type SequenceArtifactClassificationInput = {
  contents: string;
  fileName?: string;
};

export type FastaRecord = {
  header: string;
  sequence: string;
};

export type FastaAlignmentAssessment = {
  confidence: "low" | "medium" | "high";
  displayWidths: Array<number>;
  disposition:
    | "ambiguous-equal-width"
    | "explicit-alignment"
    | "not-alignment"
    | "probable-alignment"
    | "strong-alignment";
  equalWidth: boolean;
  evidence: Array<string>;
  explicitAlignmentFileName: boolean;
  gapCharacterCount: number;
  hasAlignmentGap: boolean;
  hasExplicitAlignedContainerHint: boolean;
  hasGapCharacters: boolean;
  hasMultipleRecords: boolean;
  isRectangular: boolean;
  likelyMsa: boolean;
  recordCount: number;
  widthCount: number;
};

const FASTA_HEADER_PATTERN = /^>\s*(.+)$/m;
const FASTQ_HEADER_PATTERN = /^@\S/;
const FASTQ_SEPARATOR_PATTERN = /^\+/;
const GAP_PATTERN = /[-.]/;
const MIN_EQUAL_WIDTH_FASTA_ROWS_FOR_ALIGNMENT_DEFAULT = 3;
const PROTEIN_ALPHABET = new Set("ABCDEFGHIKLMNPQRSTVWXYZ*UO");
const NUCLEIC_ACID_ALPHABET = new Set("ACGTURYSWKMBDHVN");

export function classifySequenceArtifact({
  contents,
  fileName,
}: SequenceArtifactClassificationInput): SequenceArtifactClassification {
  const sourceContents = contents;
  const normalizedFileName = fileName?.toLowerCase() ?? "";
  const evidence: Array<string> = [];

  if (looksLikeGenBank(sourceContents)) {
    evidence.push("GenBank LOCUS/FEATURES/ORIGIN signature detected.");
    return {
      alignment: null,
      confidence: "high",
      evidence,
      kind: "annotated-sequence",
      molecule: inferGenBankMolecule(sourceContents),
      suggestedViewer: "sequence",
    };
  }

  if (looksLikeEmbl(sourceContents)) {
    evidence.push("EMBL ID/FT/SQ signature detected.");
    return {
      alignment: null,
      confidence: "high",
      evidence,
      kind: "annotated-sequence",
      molecule: inferMoleculeFromText(sourceContents),
      suggestedViewer: "sequence",
    };
  }

  if (
    looksLikeFastq(sourceContents) ||
    /\.(?:fastq|fq)(?:\.gz)?$/i.test(normalizedFileName)
  ) {
    evidence.push("FASTQ @/+/quality record structure detected.");
    return {
      alignment: null,
      confidence: "high",
      evidence,
      kind: "fastq",
      molecule: inferMoleculeFromFastq(sourceContents),
      suggestedViewer: "sequence",
    };
  }

  const isPir = looksLikePir(sourceContents);
  const fastaRecords = isPir
    ? parsePir(sourceContents).rows.map(({ alignedSequence, id }) => ({
        header: id,
        sequence: alignedSequence,
      }))
    : parseFastaRecords(sourceContents);
  if (fastaRecords.length > 0) {
    const molecule = inferMoleculeFromSequences(
      fastaRecords.map(({ sequence }) => sequence),
    );
    const alignment = assessFastaAlignment({
      fileName: normalizedFileName,
      format: isPir ? "pir" : "fasta",
      records: fastaRecords,
    });

    evidence.push(
      `Parsed ${fastaRecords.length} ${isPir ? "PIR/NBRF" : "FASTA"} record(s).`,
    );
    if (alignment.explicitAlignmentFileName) {
      evidence.push("File name has an explicit MSA/alignment hint.");
    }
    if (alignment.hasAlignmentGap) {
      evidence.push(
        "At least one FASTA row contains alignment gap characters.",
      );
    }
    if (alignment.equalWidth && alignment.hasMultipleRecords) {
      evidence.push("FASTA rows share a common display width.");
    }
    if (
      alignment.disposition === "probable-alignment" &&
      !alignment.explicitAlignmentFileName
    ) {
      evidence.push(
        "Three or more equal-width FASTA rows make an aligned matrix more likely; default to Alignment while leaving Sequence available.",
      );
    }
    if (
      alignment.disposition === "ambiguous-equal-width" &&
      !alignment.explicitAlignmentFileName
    ) {
      evidence.push(
        "Equal-width ungapped FASTA is ambiguous; keep sequence view first while leaving MSA as an alternate.",
      );
    }
    if (
      alignment.disposition === "not-alignment" &&
      alignment.hasMultipleRecords
    ) {
      evidence.push(
        "FASTA rows do not share one display width, so the file is not an aligned matrix.",
      );
    }

    if (alignment.likelyMsa) {
      return {
        alignment,
        confidence: alignment.confidence,
        evidence,
        kind: "multiple-sequence-alignment",
        molecule,
        suggestedViewer: "msa",
      };
    }

    return {
      alignment,
      confidence: fastaRecords.length === 1 ? "high" : "medium",
      evidence,
      kind:
        fastaRecords.length === 1 ? "single-sequence" : "sequence-collection",
      molecule,
      suggestedViewer: "sequence",
    };
  }

  if (FASTA_HEADER_PATTERN.test(sourceContents)) {
    evidence.push(
      "FASTA header detected but no non-empty sequence rows parsed.",
    );
  }
  evidence.push("No supported sequence artifact signature was detected.");
  return {
    alignment: null,
    confidence: "low",
    evidence,
    kind: "unknown",
    molecule: "unknown",
    suggestedViewer: "raw",
  };
}

export function assessFastaAlignment({
  fileName,
  format = "fasta",
  records,
}: {
  fileName?: string;
  format?: "fasta" | "pir";
  records: Array<FastaRecord>;
}): FastaAlignmentAssessment {
  const displayWidths = records.map(({ sequence }) => sequence.length);
  const displayWidthSet = new Set(displayWidths);
  const explicitAlignmentFileName = isExplicitAlignmentFileName(fileName ?? "");
  const gapCharacterCount = records.reduce(
    (count, { sequence }) => count + countAlignmentGapCharacters(sequence),
    0,
  );
  const hasAlignmentGap = gapCharacterCount > 0;
  const hasMultipleRecords = records.length > 1;
  const equalWidth = displayWidthSet.size === 1;
  const evidence = [
    `${records.length} FASTA record(s) parsed for alignment assessment.`,
    `${displayWidthSet.size} unique display width${displayWidthSet.size === 1 ? "" : "s"} observed.`,
    ...(explicitAlignmentFileName
      ? ["File name has an explicit MSA/alignment hint."]
      : []),
    ...(hasAlignmentGap
      ? ["At least one FASTA row contains alignment gap characters."]
      : []),
  ];

  const createAssessment = (
    assessment: Omit<
      FastaAlignmentAssessment,
      | "displayWidths"
      | "evidence"
      | "equalWidth"
      | "explicitAlignmentFileName"
      | "gapCharacterCount"
      | "hasAlignmentGap"
      | "hasExplicitAlignedContainerHint"
      | "hasGapCharacters"
      | "hasMultipleRecords"
      | "isRectangular"
      | "recordCount"
      | "widthCount"
    >,
  ): FastaAlignmentAssessment => ({
    ...assessment,
    displayWidths,
    evidence,
    equalWidth,
    explicitAlignmentFileName,
    gapCharacterCount,
    hasAlignmentGap,
    hasExplicitAlignedContainerHint: explicitAlignmentFileName,
    hasGapCharacters: hasAlignmentGap,
    hasMultipleRecords,
    isRectangular: equalWidth,
    recordCount: records.length,
    widthCount: displayWidthSet.size,
  });

  if (!hasMultipleRecords) {
    return createAssessment({
      confidence: "high",
      disposition: "not-alignment",
      likelyMsa: false,
    });
  }

  if (format === "pir" && !equalWidth) {
    return createAssessment({
      confidence: "high",
      disposition: "not-alignment",
      likelyMsa: false,
    });
  }

  if (explicitAlignmentFileName) {
    return createAssessment({
      confidence: "high",
      disposition: "explicit-alignment",
      likelyMsa: true,
    });
  }

  if (!equalWidth) {
    return createAssessment({
      confidence: "high",
      disposition: "not-alignment",
      likelyMsa: false,
    });
  }

  if (hasAlignmentGap) {
    return createAssessment({
      confidence: "high",
      disposition: "strong-alignment",
      likelyMsa: true,
    });
  }

  if (records.length >= MIN_EQUAL_WIDTH_FASTA_ROWS_FOR_ALIGNMENT_DEFAULT) {
    return createAssessment({
      confidence: "medium",
      disposition: "probable-alignment",
      likelyMsa: true,
    });
  }

  return createAssessment({
    confidence: "medium",
    disposition: "ambiguous-equal-width",
    likelyMsa: false,
  });
}

export function inferMoleculeFromSequences(
  sequences: Array<string>,
): SequenceMoleculeKind {
  const residueSet = new Set<string>();
  for (const sequence of sequences) {
    for (const symbol of sequence) {
      const residue = symbol.toUpperCase();
      if (/^[A-Z*]$/.test(residue)) residueSet.add(residue);
    }
  }
  if (residueSet.size === 0) return "unknown";
  const hasT = residueSet.has("T");
  const hasU = residueSet.has("U");
  const isNucleicAcid = [...residueSet].every((residue) =>
    NUCLEIC_ACID_ALPHABET.has(residue),
  );
  if (isNucleicAcid) {
    if (hasT && !hasU) {
      return "dna";
    }
    if (hasU && !hasT) {
      return "rna";
    }
    return "nucleic-acid-ambiguous";
  }

  return [...residueSet].every((residue) => PROTEIN_ALPHABET.has(residue))
    ? "protein"
    : "unknown";
}

export function parseFastaRecords(contents: string): Array<FastaRecord> {
  const records: Array<FastaRecord> = [];
  let currentHeader: string | null = null;
  let currentSequenceParts: Array<string> = [];

  const readLine = createTextLineReader(contents);
  let sourceLine = readLine();
  while (sourceLine != null) {
    const line = sourceLine.text.trim();
    const headerMatch = FASTA_HEADER_PATTERN.exec(line);
    if (headerMatch != null) {
      if (currentHeader != null) {
        records.push({
          header: currentHeader,
          sequence: normalizeSequence(currentSequenceParts.join("")),
        });
      }
      currentHeader = headerMatch[1] ?? "";
      currentSequenceParts = [];
      sourceLine = readLine();
      continue;
    }

    if (
      currentHeader != null &&
      line.length > 0 &&
      !isRnaSecondaryStructureAnnotation(line)
    ) {
      currentSequenceParts.push(line);
    }
    sourceLine = readLine();
  }

  if (currentHeader != null) {
    records.push({
      header: currentHeader,
      sequence: normalizeSequence(currentSequenceParts.join("")),
    });
  }

  return records.filter(({ sequence }) => sequence.length > 0);
}

export function isRnaSecondaryStructureAnnotation(line: string): boolean {
  return (
    /^[.()[\]{}<>_-]+$/u.test(line) &&
    /[()[\]{}<>]/u.test(line) &&
    !line.startsWith(">")
  );
}

function normalizeSequence(sequence: string): string {
  return sequence.replaceAll(/\s+/g, "").toUpperCase();
}

function countAlignmentGapCharacters(sequence: string): number {
  let count = 0;
  for (const residue of sequence) {
    if (GAP_PATTERN.test(residue)) count += 1;
  }
  return count;
}

function looksLikeGenBank(contents: string): boolean {
  return /^LOCUS\s+/m.test(contents) && /^ORIGIN\s*$/m.test(contents);
}

function looksLikeEmbl(contents: string): boolean {
  return /^ID\s+/m.test(contents) && /^SQ\s+/m.test(contents);
}

function looksLikeFastq(contents: string): boolean {
  const readLine = createTextLineReader(contents);
  let line = readLine();
  while (line != null && line.text.length === 0) line = readLine();
  if (line == null || !FASTQ_HEADER_PATTERN.test(line.text)) return false;
  line = readLine();
  let sequenceLength = 0;
  while (line != null && !FASTQ_SEPARATOR_PATTERN.test(line.text)) {
    sequenceLength += line.text.replaceAll(/\s+/g, "").length;
    line = readLine();
  }
  if (line == null || sequenceLength === 0) return false;
  let qualityLength = 0;
  line = readLine();
  while (line != null && qualityLength < sequenceLength) {
    qualityLength += line.text.length;
    line = readLine();
  }
  return qualityLength >= sequenceLength;
}

function inferMoleculeFromFastq(contents: string): SequenceMoleculeKind {
  const readLine = createTextLineReader(contents);
  const sequences: Array<string> = [];
  let line = readLine();
  while (line != null && sequences.length < 32) {
    while (line != null && line.text.length === 0) line = readLine();
    if (line == null || !line.text.startsWith("@")) break;
    line = readLine();
    const sequenceParts: Array<string> = [];
    while (line != null && !line.text.startsWith("+")) {
      sequenceParts.push(line.text.replaceAll(/\s+/g, ""));
      line = readLine();
    }
    const sequence = sequenceParts.join("");
    if (sequence.length === 0 || line == null) break;
    sequences.push(sequence);
    line = readLine();
    let qualityLength = 0;
    while (line != null && qualityLength < sequence.length) {
      qualityLength += line.text.length;
      line = readLine();
    }
  }
  return inferMoleculeFromSequences(sequences);
}

function inferMoleculeFromText(contents: string): SequenceMoleculeKind {
  const fastaRecords = parseFastaRecords(contents);
  if (fastaRecords.length > 0) {
    return inferMoleculeFromSequences(
      fastaRecords.map(({ sequence }) => sequence),
    );
  }

  const annotatedSequence =
    extractGenBankSequence(contents) ?? extractEmblSequence(contents);
  return annotatedSequence == null
    ? "unknown"
    : inferMoleculeFromSequences([annotatedSequence]);
}

function inferGenBankMolecule(contents: string): SequenceMoleculeKind {
  const declaredMolecules = new Set<"dna" | "rna">();
  for (const match of contents.matchAll(/^LOCUS\s+(.+)$/gmu)) {
    const molecule = /\bbp\s+([^\s]+)/iu.exec(match[1] ?? "")?.[1];
    if (molecule == null) continue;
    if (/rna$/iu.test(molecule)) {
      declaredMolecules.add("rna");
    } else if (/dna$/iu.test(molecule)) {
      declaredMolecules.add("dna");
    }
  }
  if (declaredMolecules.size === 1) {
    return declaredMolecules.values().next().value ?? "unknown";
  }
  if (declaredMolecules.size > 1) return "nucleic-acid-ambiguous";
  return inferMoleculeFromText(contents);
}

function isExplicitAlignmentFileName(fileName: string): boolean {
  const normalizedFileName = fileName.toLowerCase();
  return (
    isExplicitMsaFile(normalizedFileName) || normalizedFileName.endsWith(".mfa")
  );
}

function extractGenBankSequence(contents: string): string | null {
  const originMatch = /^ORIGIN\s*$/m.exec(contents);
  if (originMatch == null) {
    return null;
  }

  return extractAnnotatedSequenceAfterHeader(contents, originMatch);
}

function extractEmblSequence(contents: string): string | null {
  const sequenceMatch = /^SQ\s+.+$/m.exec(contents);
  if (sequenceMatch == null) {
    return null;
  }

  return extractAnnotatedSequenceAfterHeader(contents, sequenceMatch);
}

function extractAnnotatedSequenceAfterHeader(
  contents: string,
  headerMatch: RegExpExecArray,
): string | null {
  const sequence =
    contents
      .slice(headerMatch.index + headerMatch[0].length)
      .split(/^\/\//m)[0]
      ?.replaceAll(/[^A-Za-z]/g, "")
      .toUpperCase() ?? "";
  return sequence.length === 0 ? null : sequence;
}
