import { useIntl } from "react-intl";

import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import type { MsaDocument } from "./types";

export function MsaMetadataPanel({
  document,
}: {
  document: MsaDocument;
}): React.ReactElement {
  const intl = useIntl();
  const entries = Object.entries(document.formatMetadata ?? {});
  const fields = [
    ["Format", document.format.toUpperCase()],
    ["Sequences", intl.formatNumber(document.rows.length)],
    ["Alignment columns", intl.formatNumber(document.alignedLength)],
    ["Detected molecule", document.molecule.moleculeType.toUpperCase()],
    ["Inference confidence", document.molecule.confidence],
    [
      "Display interpretation",
      `${document.displayInterpretation.moleculeType.toUpperCase()} (${document.displayInterpretation.source === "user-override" ? "user override" : "inferred"})`,
    ],
    [
      "Gaps",
      intl.formatNumber(document.rawSummary.gapFraction, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    ],
    [
      "Ambiguous symbols",
      intl.formatNumber(document.rawSummary.ambiguityFraction, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    ],
    ["Annotation tracks", intl.formatNumber(document.annotations.length)],
    ["Coding-sequence helpers", document.cdsContext.applicability],
  ];
  return (
    <section
      aria-label="Alignment details"
      className="space-y-4 text-xs text-token-text-secondary"
    >
      <dl className="grid gap-3">
        {fields.map(([label, value]) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-3"
            key={label}
          >
            <dt className="text-token-text-secondary">{label}</dt>
            <dd className="m-0 break-words font-medium text-token-text-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {document.molecule.evidence.length === 0 ? null : (
        <div className="border-t border-token-border pt-3">
          <h3 className="mb-1 font-medium text-token-text-primary">
            Inference evidence
          </h3>
          <p className="leading-relaxed">
            {document.molecule.evidence
              .map((evidence) => evidence.replaceAll("-", " "))
              .join(" · ")}
          </p>
        </div>
      )}
      {document.cdsContext.reasonNotEligible == null ? null : (
        <p className="leading-relaxed">
          {document.cdsContext.reasonNotEligible}
        </p>
      )}
      {entries.length === 0 ? null : (
        <WorkbenchDisclosure
          className="border-t border-token-border pt-3"
          defaultExpanded
          id="alignment.metadata"
          label={intl.formatMessage({
            id: "codex.filePreview.msa.formatMetadata",
            defaultMessage: "Parsed alignment metadata",
            description:
              "Expandable summary for parsed document-level MSA metadata.",
          })}
          summaryClassName="cursor-interaction font-medium text-token-text-primary select-none"
        >
          <div className="mt-3 grid gap-3">
            {entries.map(([key, value]) => (
              <div className="min-w-0" key={key}>
                <div className="text-[11px] text-token-text-tertiary">
                  {key}
                </div>
                <div className="whitespace-pre-wrap break-words font-medium leading-relaxed text-token-text-primary">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </WorkbenchDisclosure>
      )}
    </section>
  );
}
