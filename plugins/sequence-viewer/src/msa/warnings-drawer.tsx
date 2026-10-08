import { FormattedMessage, useIntl } from "react-intl";

import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import type { MsaParseWarning } from "./types";

export function MsaWarningsDrawer({
  warnings,
}: {
  warnings: Array<MsaParseWarning>;
}): React.ReactElement | null {
  const intl = useIntl();
  if (warnings.length === 0) {
    return null;
  }
  return (
    <section className="border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
      <WorkbenchDisclosure
        id="alignment.warnings"
        label={intl.formatMessage(
          {
            id: "codex.filePreview.msa.warningSummary",
            defaultMessage: "{count, number} parse warnings",
            description:
              "Summary text for expanding parser warnings in the MSA preview.",
          },
          { count: warnings.length },
        )}
        summaryClassName="cursor-interaction font-medium text-token-text-primary select-none"
      >
        <div className="mt-2 space-y-1">
          {warnings.map((warning, index) => (
            <div
              className="bg-token-main-surface-secondary rounded-md border border-token-border px-2 py-1"
              key={`${warning.code}:${warning.line ?? "na"}:${index}`}
            >
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-token-text-primary">
                <span>{warning.code}</span>
                <span>
                  <FormattedMessage
                    id="codex.filePreview.msa.warningSeverity"
                    defaultMessage="Severity: {severity}"
                    description="Parser-warning severity label in the MSA preview."
                    values={{ severity: warning.severity ?? "warning" }}
                  />
                </span>
                {warning.line == null ? null : (
                  <span>
                    <FormattedMessage
                      id="codex.filePreview.msa.warningLine"
                      defaultMessage="Line {line, number}"
                      description="Parser-warning source-line label in the MSA preview."
                      values={{ line: warning.line }}
                    />
                  </span>
                )}
                {warning.preserved == null ? null : (
                  <span>
                    <FormattedMessage
                      id="codex.filePreview.msa.warningPreservation"
                      defaultMessage="Data: {status}"
                      description="Parser-warning preservation-status label in the MSA preview."
                      values={{ status: warning.preserved }}
                    />
                  </span>
                )}
              </div>
              <div className="mt-0.5">{warning.message}</div>
            </div>
          ))}
        </div>
      </WorkbenchDisclosure>
    </section>
  );
}
