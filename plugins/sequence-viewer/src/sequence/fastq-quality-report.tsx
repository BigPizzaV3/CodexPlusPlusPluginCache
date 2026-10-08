import { useEffect, useId, useState } from "react";

import {
  analyzeFastqQualityReport,
  createFastqQualityViewState,
  FASTQ_QUALITY_REPORT_LIMITS,
  FASTQ_QUALITY_REPORT_METHODS,
  FASTQ_QUALITY_TABLE_IDS,
  parseFastqAdapterSequence,
  summarizeFastqQualityReport,
  type FastqQualityReportSummary,
  type FastqQualityViewState,
} from "./fastq-quality-analysis";
import type { SequenceDocument } from "./types";

type ReportState = {
  adapterSequence: string | null;
  document: SequenceDocument;
} & (
  | { error: string; report?: never }
  | { error?: never; report: FastqQualityReportSummary }
);

export type FastqQualityReportControls = {
  adapterSequence?: string | null;
  onAdapterSequenceApply?: (sequence: string | null) => void;
  qualityReport?: FastqQualityReportSummary | null;
  qualityReportError?: string;
  qualityReportPending?: boolean;
  view?: FastqQualityViewState;
  onViewChange?: (view: FastqQualityViewState) => void;
};

import {
  ChartCard,
  CycleCompositionChart,
  CycleQualityChart,
  DistributionChart,
  QcDataTable,
  type QualityTableControls,
} from "./fastq-quality-charts";

export function FastqQualityReportView({
  adapterSequence: appliedAdapterSequence,
  document,
  onAdapterSequenceApply,
  onViewChange,
  qualityReport,
  qualityReportError,
  qualityReportPending,
  view: providedView,
}: {
  document: SequenceDocument;
} & FastqQualityReportControls): React.ReactElement {
  const [localView, setLocalView] = useState(createFastqQualityViewState);
  const view = providedView ?? localView;
  const changeView = onViewChange ?? setLocalView;
  const tableControls: QualityTableControls = {
    expandedTables: view.expandedTables,
    onToggle: (id, open) => {
      if (view.expandedTables.includes(id) === open) return;
      const expanded = new Set(view.expandedTables);
      if (open) expanded.add(id);
      else expanded.delete(id);
      changeView({
        ...view,
        expandedTables: FASTQ_QUALITY_TABLE_IDS.filter((tableId) =>
          expanded.has(tableId),
        ),
      });
    },
  };
  const [localAdapterSequence, setLocalAdapterSequence] = useState<
    string | null
  >(null);
  const adapterSequence =
    appliedAdapterSequence === undefined
      ? localAdapterSequence
      : appliedAdapterSequence;
  const controlled =
    qualityReport !== undefined ||
    qualityReportPending !== undefined ||
    qualityReportError !== undefined;
  const [state, setState] = useState<ReportState | null>(null);
  useEffect(() => {
    if (controlled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void analyzeFastqQualityReport(document, {
        adapterSequence: adapterSequence ?? undefined,
        signal: controller.signal,
      }).then(
        (report) => {
          if (!controller.signal.aborted) {
            setState({
              adapterSequence,
              document,
              report: summarizeFastqQualityReport(report),
            });
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setState({
              adapterSequence,
              document,
              error:
                error instanceof Error
                  ? error.message
                  : "Quality analysis is unavailable.",
            });
          }
        },
      );
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [adapterSequence, controlled, document]);

  const current =
    state?.document === document && state.adapterSequence === adapterSequence
      ? state
      : null;
  const report = controlled
    ? qualityReport?.adapterSequence === adapterSequence
      ? qualityReport
      : undefined
    : current?.report;
  const error = controlled ? qualityReportError : current?.error;
  const pending = controlled ? qualityReportPending === true : current == null;
  const cycles = report?.cycleBins ?? [];
  return (
    <div
      aria-label="Detailed FASTQ quality report"
      className="mt-4 border-t border-token-border pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-token-text-primary">
          Read quality
        </h3>
        {report == null ? null : (
          <span className="rounded-full bg-token-main-surface-secondary px-2 py-1 text-xs text-token-text-secondary">
            {report.scope.label}
          </span>
        )}
      </div>
      {pending ? (
        <p className="mt-2 text-xs text-token-text-secondary" role="status">
          Preparing a bounded quality report…
        </p>
      ) : error != null ? (
        <p className="mt-2 text-xs text-token-text-secondary" role="status">
          Detailed quality report unavailable: {error}
        </p>
      ) : report == null ? null : (
        <>
          <p
            className="mt-1 text-xs text-token-text-secondary"
            data-testid="fastq-quality-scope"
          >
            {report.scope.description}
          </p>
          <div className="mt-4 grid gap-4">
            <CycleQualityChart bins={cycles} tableControls={tableControls} />
            <CycleCompositionChart
              bins={cycles}
              tableControls={tableControls}
            />
          </div>
          <details
            className="mt-4 border-t border-token-border pt-3"
            open={view.distributionsExpanded}
            onToggle={(event) => {
              if (
                event.target === event.currentTarget &&
                event.currentTarget.open !== view.distributionsExpanded
              ) {
                changeView({
                  ...view,
                  distributionsExpanded: event.currentTarget.open,
                });
              }
            }}
          >
            <summary className={summaryClass}>
              Distributions and repeated patterns
            </summary>
            <div className="mt-4 grid gap-4">
              <DistributionChart
                bins={report.lengthBins}
                id="read-length"
                tableControls={tableControls}
                description="Counts of complete analyzed reads, grouped into equal-width length intervals when needed."
                title="Read lengths"
                unit="bp"
              />
              <DistributionChart
                bins={report.gcBins}
                id="read-gc"
                tableControls={tableControls}
                description={FASTQ_QUALITY_REPORT_METHODS.gc}
                title="GC per read"
                unit="%"
              />
              <DistributionChart
                bins={report.meanQualityBins}
                id="read-mean-quality"
                tableControls={tableControls}
                description={FASTQ_QUALITY_REPORT_METHODS.meanReadQuality}
                title="Mean quality per read"
                unit="Q"
              />
            </div>
            {report.undefinedGcReadCount > 0 ? (
              <p className="mt-2 text-xs text-token-text-secondary">
                GC is undefined for{" "}
                {report.undefinedGcReadCount.toLocaleString()} analyzed reads
                without canonical bases; those reads are not plotted in the GC
                chart.
              </p>
            ) : null}
            <div className="mt-4 grid gap-4">
              <RepeatedSequences
                report={report}
                tableControls={tableControls}
              />
              <FrequentKmers report={report} tableControls={tableControls} />
            </div>
          </details>
        </>
      )}
      <details
        className="mt-4 border-t border-token-border pt-3"
        open={view.methodsExpanded}
        onToggle={(event) => {
          if (
            event.target === event.currentTarget &&
            event.currentTarget.open !== view.methodsExpanded
          ) {
            changeView({ ...view, methodsExpanded: event.currentTarget.open });
          }
        }}
      >
        <summary className={summaryClass}>Adapter screen and methods</summary>
        <AdapterScreen
          adapterSequence={adapterSequence}
          analysisUnavailable={error != null}
          onApply={onAdapterSequenceApply ?? setLocalAdapterSequence}
          report={report}
        />
        <div className="mt-4 space-y-2 text-xs leading-relaxed text-token-text-secondary">
          <p>
            {FASTQ_QUALITY_REPORT_METHODS.disclaimer} Qualities use the same
            Phred+33 assumption as the overview; historical encodings are not
            detected automatically.
          </p>
          <p>
            The report considers at most{" "}
            {FASTQ_QUALITY_REPORT_LIMITS.maxConsideredReads.toLocaleString()}{" "}
            retained records and analyzes up to{" "}
            {FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads.toLocaleString()}{" "}
            complete reads or{" "}
            {FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedBases.toLocaleString()}{" "}
            bases, whichever is reached first. Reads without retained qualities
            or longer than{" "}
            {FASTQ_QUALITY_REPORT_LIMITS.maxReadLength.toLocaleString()} bases
            are excluded. Source files are unchanged.
          </p>
          {report != null &&
          (report.scope.missingQualityReads > 0 ||
            report.scope.oversizedReads > 0) ? (
            <p>
              Among {report.scope.consideredReads.toLocaleString()} considered
              records, {report.scope.missingQualityReads.toLocaleString()}{" "}
              lacked retained qualities and{" "}
              {report.scope.oversizedReads.toLocaleString()} exceeded the
              per-read length limit.
            </p>
          ) : null}
          <p>
            Cycle plots use at most {FASTQ_QUALITY_REPORT_LIMITS.maxCycleBins}{" "}
            adjacent-cycle groups. Means are weighted by the number of bases
            with quality scores; the range is the observed minimum–maximum, not
            quartiles. Table values describe the same groups. The GC overview
            uses all bases; the per-read GC distribution uses canonical bases
            only.
          </p>
        </div>
      </details>
    </div>
  );
}

function RepeatedSequences({
  report,
  tableControls,
}: {
  report: FastqQualityReportSummary;
  tableControls: QualityTableControls;
}): React.ReactElement {
  return (
    <ChartCard
      title="Identical read sequences"
      description={FASTQ_QUALITY_REPORT_METHODS.repeatedSequences}
    >
      <p className="my-3 text-sm text-token-text-primary">
        <strong>
          {formatPercent(
            report.duplicateReadCount / report.scope.analyzedReads,
          )}
        </strong>{" "}
        repeated beyond the first copy ·{" "}
        {report.uniqueSequenceCount.toLocaleString()} unique sequences
      </p>
      <p className="mb-2 text-xs text-token-text-secondary">
        Observed sequence repetition is not an estimate of PCR duplication or
        library complexity.
      </p>
      {report.frequentSequences.length === 0 ? (
        <p className="text-xs text-token-text-secondary">
          No complete sequence repeats in the analyzed reads.
        </p>
      ) : (
        <QcDataTable
          id="repeated-sequences"
          tableControls={tableControls}
          caption="Most frequent repeated read sequences"
          columns={["Sequence", "Length", "Reads", "Fraction"]}
          rows={report.frequentSequences.map(
            ({ count, fraction, sequenceLength, sequencePreview }) => [
              sequencePreview,
              `${sequenceLength.toLocaleString()} bp`,
              count.toLocaleString(),
              formatPercent(fraction),
            ],
          )}
        />
      )}
      <p className="mt-2 text-xs text-token-text-tertiary">
        Up to six repeated sequences are listed. Long sequences are abbreviated;
        counts use the complete sequence.
      </p>
    </ChartCard>
  );
}

function FrequentKmers({
  report,
  tableControls,
}: {
  report: FastqQualityReportSummary;
  tableControls: QualityTableControls;
}): React.ReactElement {
  const kmers = report.frequentKmers;
  return (
    <ChartCard
      title="Frequent 7-mers"
      description={FASTQ_QUALITY_REPORT_METHODS.kmers}
    >
      {kmers.length === 0 ? (
        <p className="my-3 text-xs text-token-text-secondary">
          No 7-mer occurs at least twice in the analyzed reads.
        </p>
      ) : (
        <QcDataTable
          id="frequent-kmers"
          tableControls={tableControls}
          caption="Most frequent 7-mers"
          columns={["7-mer", "Occurrences", "Fraction"]}
          rows={kmers.map(({ count, fraction, kmer }) => [
            kmer,
            count.toLocaleString(),
            formatPercent(fraction),
          ])}
        />
      )}
      <p className="mt-2 text-xs text-token-text-tertiary">
        {FASTQ_QUALITY_REPORT_METHODS.kmerCounting}
      </p>
    </ChartCard>
  );
}

function AdapterScreen({
  adapterSequence,
  analysisUnavailable,
  onApply,
  report,
}: {
  adapterSequence: string | null;
  analysisUnavailable: boolean;
  onApply: (sequence: string | null) => void;
  report?: FastqQualityReportSummary;
}): React.ReactElement {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setInput(adapterSequence ?? "");
    setError(null);
  }, [adapterSequence]);
  const adapter = report?.adapter;
  return (
    <div className="mt-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const parsed = parseFastqAdapterSequence(input);
            if (parsed == null)
              throw new Error("Enter an adapter sequence to screen.");
            setError(null);
            onApply(parsed);
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "The adapter sequence is invalid.",
            );
          }
        }}
      >
        <label
          className="min-w-0 flex-1 text-xs text-token-text-secondary"
          htmlFor={inputId}
        >
          Your adapter sequence
          <input
            aria-describedby={`${inputId}-help${error == null ? "" : ` ${inputId}-error`}`}
            aria-invalid={error != null}
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1.5 font-mono text-xs text-token-text-primary focus:outline-none focus:ring-2 focus:ring-token-focus-border"
            id={inputId}
            maxLength={256}
            onChange={(event) => setInput(event.target.value)}
            placeholder="8–64 A/C/G/T bases"
            spellCheck={false}
            value={input}
          />
        </label>
        <button className={buttonClass} type="submit">
          Screen sequence
        </button>
        {adapterSequence == null ? null : (
          <button
            className={buttonClass}
            onClick={() => {
              setInput("");
              setError(null);
              onApply(null);
            }}
            type="button"
          >
            Clear screen
          </button>
        )}
      </form>
      <p
        className="mt-2 text-xs leading-relaxed text-token-text-secondary"
        id={`${inputId}-help`}
      >
        {FASTQ_QUALITY_REPORT_METHODS.adapter}
      </p>
      {error == null ? null : (
        <p
          className="mt-2 text-xs text-token-text-primary"
          data-workbench-nonblocking="true"
          id={`${inputId}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
      {report?.adapterSequence == null ? null : (
        <p className="mt-2 break-all text-xs text-token-text-secondary">
          Screened sequence: <code>{report.adapterSequence}</code>
          {input.replaceAll(/\s/gu, "").toUpperCase() === report.adapterSequence
            ? null
            : " · Edited sequence has not been applied."}
        </p>
      )}
      <p className="mt-2 text-xs text-token-text-secondary" role="status">
        {adapterSequence == null
          ? "Adapter content not screened: no adapter sequence supplied."
          : analysisUnavailable
            ? "Adapter screen unavailable because the detailed quality report could not be calculated."
            : adapter == null || report == null
              ? "Screening the supplied adapter against the bounded read set…"
              : `${adapter.records.toLocaleString()} of ${report.scope.analyzedReads.toLocaleString()} analyzed reads contain the supplied sequence (${adapter.occurrences.toLocaleString()} exact occurrences).`}
      </p>
    </div>
  );
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

const summaryClass =
  "cursor-pointer text-xs font-medium text-token-text-primary focus:outline-none focus:ring-2 focus:ring-token-focus-border";
const buttonClass =
  "rounded-md border border-token-border px-2.5 py-1.5 text-xs font-medium text-token-text-primary hover:bg-token-main-surface-secondary focus:outline-none focus:ring-2 focus:ring-token-focus-border";
