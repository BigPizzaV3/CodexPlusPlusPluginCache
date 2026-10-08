import { reverseComplementNucleotide } from "../nucleotide-alphabet";
import { getGeneticCode, translateGeneticCodeCodon } from "./genetic-code";

export type SequenceTranslationFrame = {
  aminoAcids: string;
  frame: 1 | 2 | 3 | -1 | -2 | -3;
  geneticCodeId: number;
  geneticCodeName: string;
};

export function translateSixFrames(
  sequence: string,
  geneticCodeId = 1,
): Array<SequenceTranslationFrame> {
  const code = getGeneticCode(geneticCodeId);
  if (code == null) return [];
  const normalized = sequence.toUpperCase().replaceAll("U", "T");
  const reverse = reverseComplement(normalized);
  return [0, 1, 2].flatMap((offset) => [
    {
      aminoAcids: translateFrame(normalized, offset, geneticCodeId),
      frame: (offset + 1) as 1 | 2 | 3,
      geneticCodeId,
      geneticCodeName: code.name,
    },
    {
      aminoAcids: translateFrame(reverse, offset, geneticCodeId),
      frame: -(offset + 1) as -1 | -2 | -3,
      geneticCodeId,
      geneticCodeName: code.name,
    },
  ]);
}

export function translateFrame(
  sequence: string,
  offset = 0,
  geneticCodeId = 1,
): string {
  let translation = "";
  for (let index = offset; index + 2 < sequence.length; index += 3) {
    translation += translateGeneticCodeCodon(
      sequence.slice(index, index + 3),
      geneticCodeId,
    );
  }
  return translation;
}

export function reverseComplement(sequence: string): string {
  return reverseComplementNucleotide(sequence);
}
