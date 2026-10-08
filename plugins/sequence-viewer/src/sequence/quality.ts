export function decodeFastqQuality(ascii: string): Array<number> {
  return [...ascii].map((character) => character.charCodeAt(0) - 33);
}

export function getMeanQuality(phred: Array<number>): number {
  return phred.length === 0
    ? 0
    : phred.reduce((total, score) => total + score, 0) / phred.length;
}

export function summarizeQuality(phred: ReadonlyArray<number>): {
  max: number;
  mean: number;
  min: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let total = 0;

  for (const score of phred) {
    total += score;
    if (Number.isNaN(score)) {
      min = Number.NaN;
      max = Number.NaN;
    }
    if (score < min) min = score;
    if (score > max) max = score;
  }

  return { max, mean: phred.length === 0 ? 0 : total / phred.length, min };
}
