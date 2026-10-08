import { expandNucleotideSymbol } from "../nucleotide-alphabet";

const CODON_ORDER = "TCAG";

export type GeneticCode = {
  id: number;
  name: string;
  startCodons: ReadonlySet<string>;
  table: Readonly<Record<string, string>>;
};

type GeneticCodeDefinition = {
  aminoAcids: string;
  name: string;
  startCodons: ReadonlyArray<string>;
};

// NCBI translation tables in the canonical T/C/A/G base order. This is the
// single translation source used by CDS, six-frame, and ORF workflows.
const GENETIC_CODE_DEFINITIONS: Readonly<
  Record<number, GeneticCodeDefinition>
> = Object.freeze({
  1: definition("Standard", ["ATG", "CTG", "TTG"], "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  2: definition("Vertebrate Mitochondrial", ["ATA", "ATC", "ATG", "ATT", "GTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG"),
  3: definition("Yeast Mitochondrial", ["ATA", "ATG", "GTG"], "FFLLSSSSYY**CCWWTTTTPPPPHHQQRRRRIIMMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  4: definition("Mold, Protozoan, and Coelenterate Mitochondrial", ["ATA", "ATC", "ATG", "ATT", "CTG", "GTG", "TTA", "TTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  5: definition("Invertebrate Mitochondrial", ["ATA", "ATC", "ATG", "ATT", "GTG", "TTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSSSVVVVAAAADDEEGGGG"),
  6: definition("Ciliate, Dasycladacean, and Hexamita Nuclear", ["ATG"], "FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  9: definition("Echinoderm and Flatworm Mitochondrial", ["ATG", "GTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG"),
  10: definition("Euplotid Nuclear", ["ATG"], "FFLLSSSSYY**CCCWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  11: definition("Bacterial, Archaeal, and Plant Plastid", ["ATA", "ATC", "ATG", "ATT", "CTG", "GTG", "TTG"], "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  12: definition("Alternative Yeast Nuclear", ["ATG", "CTG"], "FFLLSSSSYY**CC*WLLLSPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  13: definition("Ascidian Mitochondrial", ["ATA", "ATG", "GTG", "TTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSGGVVVVAAAADDEEGGGG"),
  14: definition("Alternative Flatworm Mitochondrial", ["ATG"], "FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG"),
  15: definition("Blepharisma Macronuclear", ["ATG"], "FFLLSSSSYY*QCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  16: definition("Chlorophycean Mitochondrial", ["ATG"], "FFLLSSSSYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  21: definition("Trematode Mitochondrial", ["ATG", "GTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNNKSSSSVVVVAAAADDEEGGGG"),
  22: definition("Scenedesmus obliquus Mitochondrial", ["ATG"], "FFLLSS*SYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  23: definition("Thraustochytrium Mitochondrial", ["ATG", "ATT", "GTG"], "FF*LSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  24: definition("Pterobranchia Mitochondrial", ["ATG", "CTG", "GTG", "TTG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG"),
  25: definition("Candidate Division SR1 and Gracilibacteria", ["ATG", "GTG", "TTG"], "FFLLSSSSYY**CCGWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  26: definition("Pachysolen tannophilus Nuclear", ["ATG", "CTG"], "FFLLSSSSYY**CC*WLLLAPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  27: definition("Karyorelict Nuclear", ["ATG"], "FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  28: definition("Condylostoma Nuclear", ["ATG"], "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  29: definition("Mesodinium Nuclear", ["ATG"], "FFLLSSSSYYYYCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  30: definition("Peritrich Nuclear", ["ATG"], "FFLLSSSSYYEECC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  31: definition("Blastocrithidia Nuclear", ["ATG"], "FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  32: definition("Balanophoraceae Plastid", ["ATA", "ATC", "ATG", "ATT", "CTG", "GTG", "TTG"], "FFLLSSSSYY*WCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"),
  33: definition("Cephalodiscidae Mitochondrial", ["ATG", "CTG", "GTG", "TTG"], "FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG"),
});

const GENETIC_CODES = new Map<number, GeneticCode>(
  Object.entries(GENETIC_CODE_DEFINITIONS).map(([rawId, value]) => {
    const id = Number(rawId);
    return [id, { id, name: value.name, startCodons: new Set(value.startCodons), table: createCodonTable(value.aminoAcids) }];
  }),
);

export const SUPPORTED_GENETIC_CODE_IDS = Object.freeze(
  [...GENETIC_CODES.keys()].sort((left, right) => left - right),
);

export function getGeneticCode(id = 1): GeneticCode | null {
  return GENETIC_CODES.get(id) ?? null;
}

export function translateGeneticCodeCodon(
  codon: string,
  geneticCodeId = 1,
  isInitiator = false,
): string {
  const code = getGeneticCode(geneticCodeId);
  if (code == null) return "X";
  const possibilities = expandCodon(codon.toUpperCase().replaceAll("U", "T"));
  if (possibilities.length === 0) return "X";
  if (isInitiator && possibilities.every((candidate) => code.startCodons.has(candidate))) return "M";
  const residues = new Set(possibilities.map((candidate) => code.table[candidate] ?? "X"));
  return residues.size === 1 ? [...residues][0] ?? "X" : "X";
}

function definition(name: string, startCodons: ReadonlyArray<string>, aminoAcids: string): GeneticCodeDefinition {
  return { aminoAcids, name, startCodons };
}

function createCodonTable(aminoAcids: string): Readonly<Record<string, string>> {
  if (aminoAcids.length !== 64) throw new Error("A genetic-code definition must contain exactly 64 residues.");
  const table: Record<string, string> = {};
  let index = 0;
  for (const first of CODON_ORDER) for (const second of CODON_ORDER) for (const third of CODON_ORDER) {
    table[`${first}${second}${third}`] = aminoAcids[index] ?? "X";
    index += 1;
  }
  return Object.freeze(table);
}

function expandCodon(codon: string): Array<string> {
  if (codon.length !== 3) return [];
  let candidates = [""];
  for (const symbol of codon) {
    const expansion = [...expandNucleotideSymbol(symbol)];
    if (expansion.length === 0) return [];
    candidates = candidates.flatMap((prefix) => expansion.map((base) => `${prefix}${base}`));
  }
  return candidates;
}
