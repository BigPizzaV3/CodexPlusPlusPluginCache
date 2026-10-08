export const MSA_FILE_ENTRYPOINT_EXTENSIONS = [
  "a2m",
  "a3m",
  "afa",
  "afasta",
  "aln",
  "aln-fasta",
  "clustal",
  "clw",
  "msf",
  "nex",
  "nexus",
  "phy",
  "phylip",
  "pir",
  "stk",
  "sto",
  "stockholm",
] as const;

export const MSA_GENERIC_FASTA_ENTRYPOINT_EXTENSIONS = [
  "fa",
  "faa",
  "fas",
  "fasta",
  "ffn",
  "fna",
  "frn",
  "mfa",
] as const;

export const MSA_FILE_ENTRYPOINTS = [
  {
    extensions: MSA_FILE_ENTRYPOINT_EXTENSIONS,
    priority: 100,
  },
  {
    extensions: MSA_GENERIC_FASTA_ENTRYPOINT_EXTENSIONS,
    priority: 0,
  },
] as const;

const explicitMsaCompoundSuffixes = MSA_FILE_ENTRYPOINT_EXTENSIONS.filter(
  (extension) => extension.includes("-"),
).map((extension) => `.${extension}`);
const explicitMsaExtensions = new Set<string>(
  MSA_FILE_ENTRYPOINT_EXTENSIONS.filter(
    (extension) => !extension.includes("-"),
  ),
);
const fastaCandidateExtensions = new Set<string>(
  MSA_GENERIC_FASTA_ENTRYPOINT_EXTENSIONS,
);

function basename(filePath: string): string {
  return stripBiologicalCompressionSuffix(
    biologicalFileBasename(filePath.toLowerCase()),
  );
}

export function getMsaPathExtension(filePath: string): string | null {
  const filename = basename(filePath);
  const compoundSuffix = explicitMsaCompoundSuffixes.find((suffix) =>
    filename.endsWith(suffix),
  );
  if (compoundSuffix != null) {
    return compoundSuffix.slice(1);
  }

  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(lastDot + 1) : null;
}

export function isExplicitMsaFile(filePath: string): boolean {
  const filename = basename(filePath);
  if (explicitMsaCompoundSuffixes.some((suffix) => filename.endsWith(suffix))) {
    return true;
  }
  const extension = getMsaPathExtension(filePath);
  return extension != null && explicitMsaExtensions.has(extension);
}

export function isMsaFastaCandidateFile(filePath: string): boolean {
  const extension = getMsaPathExtension(filePath);
  return extension != null && fastaCandidateExtensions.has(extension);
}

export function isMsaFile(filePath: string): boolean {
  return isExplicitMsaFile(filePath) || isMsaFastaCandidateFile(filePath);
}

export function getMsaFormatHint(filePath?: string): string | null {
  if (filePath == null) {
    return null;
  }
  return getMsaPathExtension(filePath);
}
import {
  biologicalFileBasename,
  stripBiologicalCompressionSuffix,
} from "../compressed-file-name";
