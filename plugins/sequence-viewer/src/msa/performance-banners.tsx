import clsx from "clsx";
import { FormattedMessage } from "react-intl";

import { RichPreviewLoadingContent } from "../ui/status-panel";
import type { MsaAnalysisState, MsaSearchState } from "./use-msa-document";

export function MsaProgressiveLoadingMessage({
  phase,
}: {
  phase: "parsing";
}): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-token-text-secondary">
      <RichPreviewLoadingContent className="text-sm" />
      {phase === "parsing" ? (
        <FormattedMessage
          id="codex.filePreview.msa.loading.parsing"
          defaultMessage="Parsing alignment…"
          description="Progressive loading message shown while an MSA document is being parsed."
        />
      ) : null}
    </div>
  );
}

export function MsaPerformanceStateBanner({
  analysisPhase,
  analysisMessage,
  fallbackMessage,
  isLargeAlignment,
  searchPhase,
}: {
  analysisMessage?: string;
  fallbackMessage?: string;
  analysisPhase: MsaAnalysisState["phase"];
  isLargeAlignment: boolean;
  searchPhase: MsaSearchState["phase"];
}): React.ReactElement | null {
  const statuses: Array<React.ReactNode> = [];
  if (analysisPhase === "analyzing") {
    statuses.push(
      <FormattedMessage
        key="analysis"
        id="codex.filePreview.msa.loading.analysis"
        defaultMessage="Computing consensus, conservation summaries, and overview metrics…"
        description="Progressive analysis message shown while MSA derived metrics are being computed."
      />,
    );
  } else if (analysisPhase === "error") {
    statuses.push(
      analysisMessage ?? (
        <FormattedMessage
          key="analysis-error"
          id="codex.filePreview.msa.loading.analysisError"
          defaultMessage="Derived alignment analysis could not be computed."
          description="Fallback error message shown when MSA derived analysis fails."
        />
      ),
    );
  }
  if (searchPhase === "searching") {
    statuses.push(
      <FormattedMessage
        key="search"
        id="codex.filePreview.msa.loading.search"
        defaultMessage="Processing motif search results…"
        description="Progressive message shown while MSA motif search is still computing."
      />,
    );
  }
  if (fallbackMessage != null) statuses.push(fallbackMessage);
  if (!isLargeAlignment && statuses.length === 0) {
    return null;
  }
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-token-border px-3 py-2 text-xs",
        analysisPhase === "error"
          ? "bg-red-50 text-red-800"
          : "bg-token-main-surface-secondary text-token-text-secondary",
      )}
    >
      {isLargeAlignment ? (
        <span className="font-medium text-token-text-primary">
          <FormattedMessage
            id="codex.filePreview.msa.largeAlignmentMode"
            defaultMessage="Large alignment optimized mode"
            description="Banner title shown when a large MSA is rendered through optimized progressive/virtualized behavior."
          />
        </span>
      ) : null}
      {isLargeAlignment ? (
        <span>
          <FormattedMessage
            id="codex.filePreview.msa.largeAlignmentModeDescription"
            defaultMessage="Rich rendering is virtualized; heavier analyses appear progressively while raw view remains available in the surrounding file preview."
            description="Banner explanation for optimized large-alignment MSA viewing."
          />
        </span>
      ) : null}
      {statuses.map((status, index) => (
        <span key={index}>{status}</span>
      ))}
    </div>
  );
}
