import clsx from "clsx";
import type { ReactNode } from "react";
import { FormattedMessage, useIntl, type IntlShape } from "react-intl";

import {
  getSequencePalette,
  getSequenceResidueStyle,
} from "../sequence/sequence-palette";
import type { MsaReferenceMode } from "./alignment-state";
import {
  CODING_NONSYNONYMOUS_COLOR,
  CODING_SYNONYMOUS_COLOR,
  DIFFERENCE_MATCH_COLOR,
  DIFFERENCE_MISMATCH_COLOR,
  NUCLEOTIDE_TRANSITION_COLOR,
  NUCLEOTIDE_TRANSVERSION_COLOR,
  getHydrophobicityGradient,
  getIdentityGradient,
  getLegendSwatchColor,
  getProteinConservationGradient,
  getProteinSimilarityGradient,
  isThemeAwareMsaPalette,
  type MsaColorMode,
  type MsaResiduePalette,
} from "./colors";
import type { MsaDocument, MsaMoleculeType } from "./types";

export function MsaColorLegend({
  analysisPhase,
  colorMode,
  document,
  referenceMode,
  referenceSequence,
  residuePalette,
}: {
  analysisPhase: "analyzing" | "error" | "idle" | "ready";
  colorMode: MsaColorMode;
  document: MsaDocument;
  referenceMode: MsaReferenceMode;
  referenceSequence: string | null;
  residuePalette: MsaResiduePalette | null;
}): React.ReactElement {
  const intl = useIntl();
  const hasGaps = document.rawSummary.gapFraction > 0;
  const hasInsertions = document.insertions.length > 0;
  return (
    <div
      aria-label={intl.formatMessage({
        id: "codex.filePreview.msa.legend",
        defaultMessage: "MSA color legend",
        description: "Accessible label for the MSA viewer color legend.",
      })}
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-token-border pt-3 text-xs leading-relaxed text-token-text-secondary"
    >
      <span className="font-medium text-token-text-primary">
        <FormattedMessage
          id="codex.filePreview.msa.legend.title"
          defaultMessage="Legend"
          description="Title label for the MSA viewer color legend."
        />
      </span>
      {colorMode === "residue" ? (
        <ResiduePaletteLegend
          moleculeType={document.displayInterpretation.moleculeType}
          palette={residuePalette}
        />
      ) : colorMode === "identity" ? (
        <div className="flex flex-wrap items-center gap-2">
          {analysisPhase === "ready" ? (
            <>
              <span>
                <FormattedMessage
                  id="codex.filePreview.msa.legend.identity"
                  defaultMessage="Column identity"
                  description="Legend label for identity-mode coloring in the MSA viewer."
                />
              </span>
              <span
                aria-hidden="true"
                className="h-3 w-24 rounded-full border border-token-border"
                style={{ background: getIdentityGradient() }}
              />
              <span>
                <FormattedMessage
                  id="codex.filePreview.msa.legend.identityLow"
                  defaultMessage="low"
                  description="Legend endpoint label for low column identity."
                />
              </span>
              <span>
                <FormattedMessage
                  id="codex.filePreview.msa.legend.identityHigh"
                  defaultMessage="high"
                  description="Legend endpoint label for high column identity."
                />
              </span>
              <span className="text-token-text-tertiary">
                <FormattedMessage
                  id="codex.filePreview.msa.legend.identityPolicy"
                  defaultMessage="Modal nongap residue/base fraction."
                  description="Legend detail explaining the MSA identity metric."
                />
              </span>
            </>
          ) : (
            <span>
              <FormattedMessage
                id="codex.filePreview.msa.legend.identityPending"
                defaultMessage="Computing identity summaries before coloring columns."
                description="Legend message shown while identity-mode summaries are still pending."
              />
            </span>
          )}
        </div>
      ) : colorMode === "protein-conservation" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinConservation"
              defaultMessage="Protein conservation"
              description="Legend label for protein relative-entropy conservation coloring."
            />
          </span>
          <span
            aria-hidden="true"
            className="h-3 w-24 rounded-full border border-token-border"
            style={{ background: getProteinConservationGradient() }}
          />
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinConservationLow"
              defaultMessage="lower"
              description="Legend endpoint for lower protein conservation."
            />
          </span>
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinConservationHigh"
              defaultMessage="higher"
              description="Legend endpoint for higher protein conservation."
            />
          </span>
          <span className="text-token-text-tertiary">
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinConservationPolicy"
              defaultMessage="Henikoff-weighted relative entropy vs BLAST amino-acid background."
              description="Legend detail explaining the protein conservation metric."
            />
          </span>
        </div>
      ) : colorMode === "protein-similarity" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinSimilarity"
              defaultMessage="Protein similarity"
              description="Legend label for BLOSUM62 protein similarity coloring."
            />
          </span>
          <span
            aria-hidden="true"
            className="h-3 w-24 rounded-full border border-token-border"
            style={{ background: getProteinSimilarityGradient() }}
          />
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinSimilarityLow"
              defaultMessage="lower BLOSUM62"
              description="Legend endpoint for lower BLOSUM62 similarity."
            />
          </span>
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.proteinSimilarityHigh"
              defaultMessage="higher BLOSUM62"
              description="Legend endpoint for higher BLOSUM62 similarity."
            />
          </span>
        </div>
      ) : colorMode === "nucleotide-substitution" ? (
        <div className="flex flex-wrap items-center gap-2">
          <LegendChip
            backgroundColor={DIFFERENCE_MATCH_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.substitutionMatch"
                defaultMessage="Reference match"
                description="Legend label for nucleotide symbols that match the active reference."
              />
            }
          />
          <LegendChip
            backgroundColor={NUCLEOTIDE_TRANSITION_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.transition"
                defaultMessage="Transition"
                description="Legend label for transition substitutions in nucleotide alignments."
              />
            }
          />
          <LegendChip
            backgroundColor={NUCLEOTIDE_TRANSVERSION_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.transversion"
                defaultMessage="Transversion"
                description="Legend label for transversion substitutions in nucleotide alignments."
              />
            }
          />
        </div>
      ) : colorMode === "coding-impact" ? (
        <div className="flex flex-wrap items-center gap-2">
          <LegendChip
            backgroundColor={DIFFERENCE_MATCH_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.codonMatch"
                defaultMessage="Same codon"
                description="Legend label for coding DNA codons that match the reference codon."
              />
            }
          />
          <LegendChip
            backgroundColor={CODING_SYNONYMOUS_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.synonymous"
                defaultMessage="Synonymous codon change"
                description="Legend label for synonymous coding DNA changes."
              />
            }
          />
          <LegendChip
            backgroundColor={CODING_NONSYNONYMOUS_COLOR}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.nonsynonymous"
                defaultMessage="Nonsynonymous codon change"
                description="Legend label for nonsynonymous coding DNA changes."
              />
            }
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {referenceMode === "consensus" &&
          referenceSequence == null &&
          analysisPhase !== "ready" ? (
            <span>
              <FormattedMessage
                id="codex.filePreview.msa.legend.differencesPendingReference"
                defaultMessage="Computing consensus reference before highlighting differences."
                description="Legend guidance shown while difference-mode consensus analysis is still pending."
              />
            </span>
          ) : referenceSequence == null ? (
            <span>
              <FormattedMessage
                id="codex.filePreview.msa.legend.differencesNoReference"
                defaultMessage="Select a consensus or anchor reference to highlight differences."
                description="Legend guidance shown when difference coloring has no active MSA reference."
              />
            </span>
          ) : (
            <>
              <LegendChip
                backgroundColor={DIFFERENCE_MATCH_COLOR}
                label={intl.formatMessage({
                  id: "codex.filePreview.msa.legend.differenceMatch",
                  defaultMessage: "Match / baseline",
                  description:
                    "Legend label for cells that match the active MSA reference in difference mode.",
                })}
              />
              <LegendChip
                backgroundColor={DIFFERENCE_MISMATCH_COLOR}
                label={intl.formatMessage({
                  id: "codex.filePreview.msa.legend.differenceMismatch",
                  defaultMessage: "Difference from reference",
                  description:
                    "Legend label for cells that differ from the active MSA reference in difference mode.",
                })}
              />
            </>
          )}
        </div>
      )}
      {hasGaps ? (
        <LegendChip
          backgroundColor={
            colorMode === "residue" && isThemeAwareMsaPalette(residuePalette)
              ? getSequenceResidueStyle({
                  molecule:
                    document.displayInterpretation.moleculeType === "mixed"
                      ? "unknown"
                      : document.displayInterpretation.moleculeType,
                  paletteId: residuePalette,
                  residue: "-",
                }).backgroundColor
              : "transparent"
          }
          borderClassName="border-dashed"
          label={intl.formatMessage({
            id: "codex.filePreview.msa.legend.gap",
            defaultMessage: "Gap",
            description: "Legend label for alignment gaps.",
          })}
        />
      ) : null}
      {hasInsertions ? (
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded border border-token-border px-1 text-[10px] text-token-text-primary">
            <FormattedMessage
              id="codex.filePreview.msa.legend.insertionResidueExample"
              defaultMessage="A"
              description="Example aligned residue used in the A2M/A3M insertion legend badge."
            />
            <sup className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600 px-1 text-[7px] leading-3 text-white shadow-sm">
              <FormattedMessage
                id="codex.filePreview.msa.legend.insertionBadgeExample"
                defaultMessage="+n"
                description="Example insertion-count badge shown in the A2M/A3M insertion legend."
              />
            </sup>
          </span>
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.insertions"
              defaultMessage="A2M/A3M insertion after this aligned column (+n = hidden inserted residues)"
              description="Legend label explaining insertion badges preserved from A2M/A3M alignments."
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ResiduePaletteLegend({
  moleculeType,
  palette,
}: {
  moleculeType: MsaMoleculeType;
  palette: MsaResiduePalette | null;
}): React.ReactElement {
  const intl = useIntl();
  if (palette == null) {
    return (
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.legend.neutralFallback"
          defaultMessage="Neutral fallback coloring"
          description="Legend text for residue mode when no molecule-specific palette is available."
        />
      </span>
    );
  }
  if (isThemeAwareMsaPalette(palette)) {
    const definition = getSequencePalette(palette);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-token-text-primary">
          {formatResiduePaletteLabel(intl, palette)}
        </span>
        {definition.swatches.map((swatch) => (
          <span
            className="inline-flex items-center gap-1.5"
            key={swatch.label}
            title={swatch.residues}
          >
            <span
              className="inline-flex min-h-5 items-center rounded-sm border border-token-border px-1 font-mono"
              style={{
                backgroundColor: swatch.backgroundColor,
                color: swatch.textColor,
              }}
            >
              {swatch.label}
            </span>
          </span>
        ))}
        <span className="basis-full text-token-text-tertiary">
          {definition.description}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-token-text-primary">
        {formatResiduePaletteLabel(intl, palette)}
      </span>
      {palette === "rasmol" ? (
        <>
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "D" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolAcidic"
                defaultMessage="D/E"
                description="RasMol palette legend label for acidic residues."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "K" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolBasic"
                defaultMessage="K/R"
                description="RasMol palette legend label for basic residues."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "N" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolAmide"
                defaultMessage="N/Q"
                description="RasMol palette legend label for amide residues."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "L" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolAliphatic"
                defaultMessage="L/V/I"
                description="RasMol palette legend label for aliphatic residues."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "C" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolSulfur"
                defaultMessage="C/M"
                description="RasMol palette legend label for sulfur-containing residues."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "P" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.rasmolProline"
                defaultMessage="P"
                description="RasMol palette legend label for proline."
              />
            }
          />
        </>
      ) : palette === "clustal-x" ? (
        <>
          <LegendChip
            backgroundColor="#80a0f0"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.clustalHydrophobic"
                defaultMessage="hydrophobic"
                description="ClustalX palette legend label for hydrophobic residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#f01505"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.clustalPositive"
                defaultMessage="positive"
                description="ClustalX palette legend label for positively charged residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#c048c0"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.clustalNegative"
                defaultMessage="negative"
                description="ClustalX palette legend label for negatively charged residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#15c015"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.clustalPolar"
                defaultMessage="polar"
                description="ClustalX palette legend label for polar residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#15a4a4"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.clustalAromatic"
                defaultMessage="aromatic"
                description="ClustalX palette legend label for aromatic residues."
              />
            }
          />
        </>
      ) : palette === "zappo" ? (
        <>
          <LegendChip
            backgroundColor="#ffafaf"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoAliphatic"
                defaultMessage="ILVAM"
                description="Zappo palette legend label for aliphatic residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#ffc800"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoAromatic"
                defaultMessage="FWY"
                description="Zappo palette legend label for aromatic residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#6464ff"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoPositive"
                defaultMessage="KRH"
                description="Zappo palette legend label for positively charged residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#ff0000"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoNegative"
                defaultMessage="DE"
                description="Zappo palette legend label for negatively charged residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#00ff00"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoPolar"
                defaultMessage="STNQ"
                description="Zappo palette legend label for polar residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#ff00ff"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoSpecial"
                defaultMessage="PG"
                description="Zappo palette legend label for special conformational residues."
              />
            }
          />
          <LegendChip
            backgroundColor="#ffff00"
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.zappoCysteine"
                defaultMessage="C"
                description="Zappo palette legend label for cysteine."
              />
            }
          />
        </>
      ) : palette === "hydrophobicity" ? (
        <>
          <span
            aria-hidden="true"
            className="h-3 w-28 rounded-full border border-token-border"
            style={{ background: getHydrophobicityGradient() }}
          />
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.hydrophobicityHydrophobic"
              defaultMessage="hydrophobic"
              description="Legend endpoint label for highly hydrophobic residues."
            />
          </span>
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.legend.hydrophobicityHydrophilic"
              defaultMessage="hydrophilic"
              description="Legend endpoint label for highly hydrophilic residues."
            />
          </span>
        </>
      ) : palette === "ncbi-nucleic-acid" ? (
        <>
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "A" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.nucleotideA"
                defaultMessage="A"
                description="Nucleotide palette legend label for adenine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "C" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.nucleotideC"
                defaultMessage="C"
                description="Nucleotide palette legend label for cytosine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "G" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.nucleotideG"
                defaultMessage="G"
                description="Nucleotide palette legend label for guanine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({
              palette,
              symbol: moleculeType === "rna" ? "U" : "T",
            })}
            label={
              moleculeType === "rna" ? (
                <FormattedMessage
                  id="codex.filePreview.msa.legend.nucleotideU"
                  defaultMessage="U"
                  description="Nucleotide palette legend label for uracil."
                />
              ) : (
                <FormattedMessage
                  id="codex.filePreview.msa.legend.nucleotideTU"
                  defaultMessage="T/U"
                  description="Nucleotide palette legend label covering thymine and uracil semantics."
                />
              )
            }
          />
        </>
      ) : palette === "jalview-nucleotide" ? (
        <>
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "A" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.jalviewNucleotideA"
                defaultMessage="A"
                description="Jalview nucleotide palette legend label for adenine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "C" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.jalviewNucleotideC"
                defaultMessage="C"
                description="Jalview nucleotide palette legend label for cytosine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "G" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.jalviewNucleotideG"
                defaultMessage="G"
                description="Jalview nucleotide palette legend label for guanine."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({
              palette,
              symbol: moleculeType === "rna" ? "U" : "T",
            })}
            label={
              moleculeType === "rna" ? (
                <FormattedMessage
                  id="codex.filePreview.msa.legend.jalviewNucleotideU"
                  defaultMessage="U"
                  description="Jalview nucleotide palette legend label for uracil."
                />
              ) : (
                <FormattedMessage
                  id="codex.filePreview.msa.legend.jalviewNucleotideTU"
                  defaultMessage="T/U"
                  description="Jalview nucleotide palette legend label covering thymine and uracil semantics."
                />
              )
            }
          />
        </>
      ) : palette === "purine-pyrimidine" ? (
        <>
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "A" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.purines"
                defaultMessage="Purines A/G/R"
                description="Purine-pyrimidine palette legend label for purine symbols."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "C" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.pyrimidines"
                defaultMessage="Pyrimidines C/T/U/Y"
                description="Purine-pyrimidine palette legend label for pyrimidine symbols."
              />
            }
          />
        </>
      ) : (
        <>
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "R" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.ambiguityPurine"
                defaultMessage="R purine"
                description="Nucleotide ambiguity palette legend label for the purine ambiguity code R."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "Y" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.ambiguityPyrimidine"
                defaultMessage="Y pyrimidine"
                description="Nucleotide ambiguity palette legend label for the pyrimidine ambiguity code Y."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "W" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.ambiguityWeak"
                defaultMessage="W weak"
                description="Nucleotide ambiguity palette legend label for the weak-base ambiguity code W."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "S" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.ambiguityStrong"
                defaultMessage="S strong"
                description="Nucleotide ambiguity palette legend label for the strong-base ambiguity code S."
              />
            }
          />
          <LegendChip
            backgroundColor={getLegendSwatchColor({ palette, symbol: "N" })}
            label={
              <FormattedMessage
                id="codex.filePreview.msa.legend.ambiguityUnknown"
                defaultMessage="N unknown"
                description="Nucleotide ambiguity palette legend label for unknown or any-base symbol N."
              />
            }
          />
        </>
      )}
    </div>
  );
}

function LegendChip({
  backgroundColor,
  borderClassName,
  label,
}: {
  backgroundColor: string;
  borderClassName?: string;
  label: ReactNode;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={clsx(
          "inline-flex h-3 w-3 rounded-sm border border-token-border",
          borderClassName,
        )}
        style={{ backgroundColor }}
      />
      <span>{label}</span>
    </span>
  );
}

export function formatResiduePaletteLabel(
  intl: IntlShape,
  palette: MsaResiduePalette,
): string {
  switch (palette) {
    case "muted-nucleic-acid":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.softNucleotide",
        defaultMessage: "Soft nucleotide",
        description: "Label for the theme-aware low-chroma nucleotide palette.",
      });
    case "muted-amino-acid":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.softAminoAcid",
        defaultMessage: "Soft amino acid",
        description: "Label for the theme-aware low-chroma amino-acid palette.",
      });
    case "neutral":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.monochrome",
        defaultMessage: "Monochrome",
        description:
          "Label for residue lettering without residue-specific colors.",
      });
    case "rasmol":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.rasmol",
        defaultMessage: "RasMol",
        description: "Label for the RasMol protein residue color palette.",
      });
    case "clustal-x":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.clustalX",
        defaultMessage: "ClustalX",
        description: "Label for the ClustalX protein residue color palette.",
      });
    case "zappo":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.zappo",
        defaultMessage: "Zappo",
        description: "Label for the Zappo protein residue color palette.",
      });
    case "hydrophobicity":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.hydrophobicity",
        defaultMessage: "Hydrophobicity",
        description:
          "Label for the hydrophobicity-gradient protein residue color palette.",
      });
    case "ncbi-nucleic-acid":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.ncbiNucleicAcid",
        defaultMessage: "NCBI nucleic acid",
        description:
          "Label for the NCBI-style nucleic-acid residue color palette.",
      });
    case "jalview-nucleotide":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.jalviewNucleotide",
        defaultMessage: "Jalview nucleotide",
        description:
          "Label for the Jalview-style nucleotide residue color palette.",
      });
    case "purine-pyrimidine":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.purinePyrimidine",
        defaultMessage: "Purine / Pyrimidine",
        description:
          "Label for the purine-versus-pyrimidine nucleic-acid residue color palette.",
      });
    case "nucleotide-ambiguity":
      return intl.formatMessage({
        id: "codex.filePreview.msa.palette.nucleotideAmbiguity",
        defaultMessage: "Nucleotide ambiguity",
        description:
          "Label for the IUPAC nucleotide ambiguity residue color palette.",
      });
  }
}
