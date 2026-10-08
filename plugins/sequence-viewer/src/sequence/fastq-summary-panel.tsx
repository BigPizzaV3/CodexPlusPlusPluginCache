import {
  FastqQualityReportView,
  type FastqQualityReportControls,
} from "./fastq-quality-report";
import type { FastqSummary, SequenceDocument } from "./types";

export function FastqSummaryPanel({
  document,
  summary,
  ...qualityControls
}: {
  document?: SequenceDocument;
  summary?: FastqSummary;
} & FastqQualityReportControls): React.ReactElement | null {
  if (summary == null) {
    return null;
  }
  const metrics = [
    ["Reads", summary.readCount.toLocaleString()],
    ["Total bases", summary.totalBases.toLocaleString()],
    ["Read length", `${summary.readLengthMin}-${summary.readLengthMax} bp`],
    ["Mean length", `${summary.meanReadLength.toFixed(1)} bp`],
    ["GC", formatPercent(summary.gcFraction)],
    ["N bases", formatPercent(summary.nFraction)],
    ["Mean quality", `Q${summary.meanQuality.toFixed(1)}`],
    ["Q20", formatPercent(summary.q20Fraction)],
    ["Q30", formatPercent(summary.q30Fraction)],
  ];
  return (
    <section className="min-w-0">
      <div className="text-xs font-semibold tracking-wide text-token-text-tertiary uppercase">
        FASTQ overview
      </div>
      <p className="mt-1 text-xs text-token-text-secondary">
        Aggregate across parsed reads · Phred+33 assumed.
      </p>
      <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-x-4 gap-y-2">
        {metrics.map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="text-xs text-token-text-tertiary">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium break-words text-token-text-primary tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {document?.format === "fastq" ? (
        <FastqQualityReportView document={document} {...qualityControls} />
      ) : null}
    </section>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
