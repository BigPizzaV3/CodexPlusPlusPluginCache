export const SEQUENCE_FILE_ENTRYPOINTS = [
  {
    extensions: [
      "aln-fasta",
      "afa",
      "afasta",
      "fasta",
      "fa",
      "fas",
      "fna",
      "faa",
      "ffn",
      "frn",
      "mfa",
    ],
    priority: 100,
  },
  {
    extensions: ["gb", "gbk", "genbank", "gbff"],
    priority: 100,
  },
  {
    extensions: ["embl", "emb"],
    priority: 100,
  },
  {
    extensions: ["fastq", "fq"],
    priority: 100,
  },
  {
    extensions: ["ab1", "abi", "scf", "dna"],
    priority: 100,
  },
] as const;

export const SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS =
  SEQUENCE_FILE_ENTRYPOINTS.flatMap(({ extensions }) => extensions);

export function getSequenceFormatHint(fileName?: string): string | null {
  if (fileName == null) {
    return null;
  }
  const normalizedFileName = stripBiologicalCompressionSuffix(
    biologicalFileBasename(fileName.toLowerCase()),
  );
  const lastDot = normalizedFileName.lastIndexOf(".");
  return lastDot === -1 ? null : normalizedFileName.slice(lastDot + 1);
}
import {
  biologicalFileBasename,
  stripBiologicalCompressionSuffix,
} from "../compressed-file-name";
