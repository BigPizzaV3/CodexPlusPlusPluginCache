import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import {
  getReadableResidueTextColor,
  getSequencePalette,
} from "./sequence-palette";
import type { SequencePaletteId } from "./types";

export function SequenceLegend({
  paletteId,
}: {
  paletteId: SequencePaletteId;
}): React.ReactElement {
  const palette = getSequencePalette(paletteId);
  return (
    <section aria-label={`${palette.label} palette legend`}>
      <WorkbenchDisclosure
        className="rounded-lg border border-token-border bg-token-main-surface-secondary px-3 py-2"
        id="sequence.legend"
        label={`Legend · ${palette.label}`}
        summaryClassName="cursor-pointer text-sm text-token-text-secondary"
      >
        <p className="mt-2 text-sm text-token-text-secondary">
          {palette.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {palette.swatches.map(
            ({ backgroundColor, label, residues, textColor }) => (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-token-border px-2 py-1 text-xs"
                key={`${label}-${residues}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex min-w-7 items-center justify-center rounded px-1 py-0.5 font-mono font-medium"
                  style={{
                    backgroundColor,
                    color:
                      textColor ?? getReadableResidueTextColor(backgroundColor),
                  }}
                >
                  {label}
                </span>
                <span className="font-mono text-token-text-secondary">
                  {residues}
                </span>
              </span>
            ),
          )}
        </div>
      </WorkbenchDisclosure>
    </section>
  );
}
