import {
  inferMoleculeFromSequences,
  type SequenceMoleculeKind,
} from "../biological-sequence-artifact-classifier";

export function inferSequenceMolecule(
  sequences: Array<string>,
): SequenceMoleculeKind {
  return inferMoleculeFromSequences(sequences);
}
