export type MsaFormat =
  | "a2m"
  | "a3m"
  | "aligned-fasta"
  | "clustal"
  | "msf"
  | "nexus"
  | "phylip"
  | "pir"
  | "stockholm";

export type MsaMoleculeType =
  "dna" | "mixed" | "nucleic-acid-ambiguous" | "protein" | "rna" | "unknown";

export type MsaMetricTrackKey =
  | "gap"
  | "identity"
  | "mismatch"
  | "modality-conservation"
  | "rna-structure"
  | "sequence-logo";

export type MsaRowSortKey =
  "coverage" | "identity" | "label" | "length" | "mismatches" | "source";

export type MsaRowSortDirection = "asc" | "desc";

export type MsaMoleculeEvidence =
  | "a2m-a3m-profile-convention"
  | "ambiguous-symbol-set"
  | "dna-t-present"
  | "metadata-hint"
  | "protein-exclusive-symbol-present"
  | "rna-u-present"
  | "stockholm-rna-structure-present";

export type MsaMoleculeInference = {
  confidence: "high" | "low" | "medium";
  evidence: Array<MsaMoleculeEvidence>;
  moleculeType: MsaMoleculeType;
  warnings: Array<string>;
};

export type MsaResidueClass =
  | "ambiguous-amino-acid"
  | "ambiguous-nucleotide"
  | "canonical-dna-base"
  | "canonical-rna-base"
  | "gap"
  | "insertion"
  | "special-amino-acid"
  | "standard-amino-acid"
  | "termination"
  | "unknown";

export type MsaSequenceRow = {
  alignedSequence: string;
  description?: string;
  duplicateSourceLabelCount?: number;
  duplicateSourceLabelIndex?: number;
  hidden?: boolean;
  id: string;
  label: string;
  metadata?: Record<string, string>;
  sourceId?: string;
  sourceCoordinates?: {
    end?: number;
    start?: number;
    strand?: "+" | "-" | "unknown";
  };
  ungappedLength: number;
};

export type MsaAnnotationTrackKind =
  | "cds-codon-frame"
  | "conservation"
  | "consensus"
  | "custom"
  | "protein-secondary-structure"
  | "quality"
  | "rna-base-pair-conservation"
  | "rna-helix"
  | "rna-ligand"
  | "rna-motif"
  | "rna-reference-columns"
  | "rna-secondary-structure"
  | "rna-structural-elements"
  | "sequence-logo";

export type MsaAnnotationTrack = {
  id: string;
  kind: MsaAnnotationTrackKind;
  label: string;
  metadata?: Record<string, boolean | number | string>;
  values: string;
};

export type MsaInsertionRun = {
  afterAlignmentColumn: number;
  residues: string;
  rowId: string;
  sourceRowIndex?: number;
  sourceKind: "a2m-a3m-lowercase" | "other";
};

export type MsaRnaPair = {
  leftColumn: number;
  notation: string;
  pairClass?: "noncanonical" | "unknown" | "watson-crick" | "wobble";
  pseudoknotLevel?: number;
  rightColumn: number;
};

export type MsaRnaStructureModel = {
  motifTracks: Array<MsaAnnotationTrack>;
  notation: "extended-dot-bracket" | "unknown" | "vienna-dot-bracket" | "wuss";
  pairs: Array<MsaRnaPair>;
  rawStructure: string;
  referenceTrack?: string;
  source:
    | "clustal-structure-line"
    | "other"
    | "stockholm-gr-structure"
    | "stockholm-ss-cons";
  warnings: Array<string>;
};

export type MsaCdsContext = {
  applicability: "eligible" | "not-eligible" | "unknown";
  frameStartColumn?: number;
  geneticCodeId?: number;
  reasonNotEligible?: string;
  translationMode?: "standard-default" | "unknown" | "user-selected";
};

export type MsaSearchCapabilities = {
  motifSearch: boolean;
  rowLabelSearch: true;
  supportsAmbiguousNucleotideCodes: boolean;
  supportsProteinAmbiguityCodes: boolean;
  supportsReverseComplement: boolean;
};

export type MsaParseWarning = {
  code: string;
  line?: number;
  message: string;
  preserved?: "approximated" | "ignored" | "preserved";
  severity?: "error" | "info" | "warning";
};

export type MsaAnalysisScope = "all-unhidden-rows" | "currently-displayed-rows";

export type MsaSearchScope = "all-unhidden-rows" | "currently-displayed-rows";

export type MsaColumnRange = {
  end: number;
  start: number;
};

export type MsaWeightingPolicy = "henikoff" | "none";

export type MsaConservationModel =
  | "dna-information-content"
  | "protein-relative-entropy"
  | "rna-information-content"
  | "rna-structure-consensus";

export type MsaMetricKind =
  | "column-identity"
  | "gap-occupancy"
  | "nucleotide-information-content"
  | "protein-relative-entropy"
  | "protein-similarity"
  | "rna-structure-consensus"
  | "row-identity-to-reference";

export type MsaMetricProvenance = {
  algorithm: string;
  ambiguityPolicy?: string;
  backgroundModel?: string;
  gapPolicy: string;
  kind: MsaMetricKind;
  modality: MsaMoleculeType;
  weightingPolicy: MsaWeightingPolicy;
};

export type MsaConsensusPolicy = {
  ambiguityPolicy: "iupac-cover-threshold";
  gapPolicy: "exclude-gaps-from-threshold";
  threshold: number;
};

export type MsaRnaStructureConsensus = {
  gapFraction: number;
  invalidFraction: number;
  leftColumn: number;
  rightColumn: number;
  validPairFraction: number;
  watsonCrickFraction: number;
  wobbleFraction: number;
};

export type MsaRowMetrics = {
  coverageToReference: number | null;
  identityToReference: number | null;
  mismatchCountToReference: number | null;
  rowId: string;
  ungappedLength: number;
};

export type MsaDocument = {
  alignedLength: number;
  annotations: Array<MsaAnnotationTrack>;
  cdsContext: MsaCdsContext;
  consensusPolicy: MsaConsensusPolicy;
  displayInterpretation: {
    moleculeType: MsaMoleculeType;
    source: "inferred" | "user-override";
  };
  format: MsaFormat;
  formatMetadata?: Record<string, string>;
  insertions: Array<MsaInsertionRun>;
  molecule: MsaMoleculeInference;
  rawSummary: {
    ambiguityFraction: number;
    gapFraction: number;
    maxLabelLength: number;
    sequenceCount: number;
    structureTrackCount: number;
    visibleSequenceCount: number;
  };
  rnaStructure: MsaRnaStructureModel | null;
  rows: Array<MsaSequenceRow>;
  searchCapabilities: MsaSearchCapabilities;
  warnings: Array<MsaParseWarning>;
};

export type MsaParseResult =
  | {
      document: MsaDocument;
      status: "success";
    }
  | {
      message: string;
      status: "error";
      warnings: Array<MsaParseWarning>;
    };

export type MsaFormatDraft = {
  annotations?: Array<MsaAnnotationTrack>;
  format: MsaFormat;
  insertions?: Array<MsaInsertionRun>;
  metadata?: Record<string, string>;
  rows: Array<Omit<MsaSequenceRow, "ungappedLength">>;
  warnings?: Array<MsaParseWarning>;
};
