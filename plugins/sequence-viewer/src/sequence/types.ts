import type {
  SequenceArtifactClassification,
  SequenceMoleculeKind,
} from "../biological-sequence-artifact-classifier";

export type SequenceDocumentKind =
  | "annotated-sequence"
  | "chromatogram"
  | "fastq"
  | "sequence-collection"
  | "single-sequence";

export type SequenceFormat =
  "abif" | "embl" | "fasta" | "fastq" | "genbank" | "scf" | "snapgene";

export type SequenceParseWarning = {
  code: string;
  column?: number;
  line?: number;
  message: string;
  severity: "info" | "warning" | "error";
};

export type SequenceParseResult =
  | {
      diagnostics: Array<SequenceParseWarning>;
      document: SequenceDocument;
      status: "success";
    }
  | {
      diagnostics: Array<SequenceParseWarning>;
      message: string;
      status: "error";
    };

export type SequenceFeature = {
  codonStart?: 1 | 2 | 3;
  end: number;
  geneticCodeId?: number;
  id: string;
  label?: string;
  qualifiers: Record<string, string | Array<string>>;
  segments?: Array<SequenceFeatureSegment>;
  sourceLocation?: string;
  start: number;
  strand: "+" | "-" | "." | "?";
  translation?: string;
  translationCoordinateMap?: Array<SequenceTranslationCoordinate>;
  translationMappingUnavailableReason?: string;
  translationSource?: "computed" | "qualifier";
  translationTrackReliable?: boolean;
  type: string;
};

export type SequenceTranslationCoordinate = {
  aminoAcidIndex: number;
  codonCoordinates: [number, number, number];
  displayCoordinate: number;
};

export type SequenceFeatureSegment = {
  end: number;
  partialEnd?: boolean;
  partialStart?: boolean;
  remoteAccession?: string;
  start: number;
};

export type SequenceQuality = {
  ascii: string;
  phred: Array<number>;
};

export type ChromatogramBase = "A" | "C" | "G" | "T";

/** Signal and base calls in the source read orientation, never display-reversed. */
export type SequenceChromatogram = {
  /** SCF stores a separate source confidence byte for each candidate base. */
  baseConfidences?: Record<ChromatogramBase, Array<number>>;
  channels: Record<ChromatogramBase, Array<number>>;
  format: "abif" | "scf";
  /** Zero-based sample indices, one per called base in record.sequence. */
  peakLocations: Array<number>;
  /** Original called-base confidence values; absent when the source omits them. */
  quality?: Array<number | null>;
  qualityEncoding?: "phred" | "source-confidence";
  sampleCount: number;
};

export type SequenceRecord = {
  chromatogram?: SequenceChromatogram;
  description?: string;
  /** Imported evidence still uses the unedited source's reference coordinates. */
  evidenceCoordinatesStale?: boolean;
  features: Array<SequenceFeature>;
  id: string;
  length: number;
  metadata: Record<string, string | Array<string>>;
  molecule: SequenceMoleculeKind;
  quality?: SequenceQuality;
  sequence: string;
  sourceLabel: string;
  topology?: "circular" | "linear" | "unknown";
};

export type SequenceDocument = {
  classification: SequenceArtifactClassification;
  fastqSummary?: FastqSummary;
  fileName?: string;
  format: SequenceFormat;
  kind: SequenceDocumentKind;
  records: Array<SequenceRecord>;
  recordInventory?: {
    materializedCount: number;
    totalCount: number;
    truncated: boolean;
  };
  warnings: Array<SequenceParseWarning>;
};

export type FastqSummary = {
  gcFraction: number;
  meanQuality: number;
  meanReadLength: number;
  nFraction: number;
  q20Fraction: number;
  q30Fraction: number;
  qualityEncoding: "phred+33-assumed";
  readCount: number;
  readLengthMax: number;
  readLengthMin: number;
  totalBases: number;
};

export type SequenceSearchHit = {
  end: number;
  orientation: "forward" | "reverse-complement";
  recordId: string;
  start: number;
};

export type SequenceSearchResult = {
  hits: Array<SequenceSearchHit>;
  truncated: boolean;
};

export type SequenceSelection = {
  end: number;
  recordId: string;
  segments?: Array<{ end: number; start: number }>;
  start: number;
};

export type SequencePaletteId =
  | "clustal-x"
  | "hydrophobicity"
  | "jalview-nucleotide"
  | "muted-amino-acid"
  | "muted-nucleic-acid"
  | "ncbi-nucleic-acid"
  | "neutral"
  | "nucleotide-ambiguity"
  | "purine-pyrimidine"
  | "rasmol"
  | "zappo";

export type SequenceLine = {
  end: number;
  index: number;
  start: number;
};

export type SequenceFeatureLane = {
  end: number;
  feature: SequenceFeature;
  laneIndex: number;
  start: number;
};
