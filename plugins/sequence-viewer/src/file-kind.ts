import {
  biologicalFileBasename,
  stripBiologicalCompressionSuffix,
} from "./compressed-file-name";
import {
  MSA_FILE_ENTRYPOINT_EXTENSIONS,
  MSA_GENERIC_FASTA_ENTRYPOINT_EXTENSIONS,
} from "./msa/file-kind";
import { SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS } from "./sequence/file-kind";

export const BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS = [
  ...new Set([
    ...SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS,
    ...MSA_FILE_ENTRYPOINT_EXTENSIONS,
    ...MSA_GENERIC_FASTA_ENTRYPOINT_EXTENSIONS,
  ]),
] as const;

export const BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINTS = [
  {
    extensions: BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS,
    priority: 100,
  },
] as const;

export function isSupportedBiologicalSequenceFileName(
  fileName: string,
): boolean {
  const normalizedFileName = stripBiologicalCompressionSuffix(
    biologicalFileBasename(fileName.trim().toLowerCase()),
  );
  const lastDot = normalizedFileName.lastIndexOf(".");
  const extension =
    lastDot >= 0 ? normalizedFileName.slice(lastDot + 1) : normalizedFileName;
  return BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS.some(
    (supportedExtension) => supportedExtension === extension,
  );
}
