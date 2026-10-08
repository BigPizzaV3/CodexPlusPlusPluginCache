import type { ReactNode } from "react";

import {
  FASTQ_QUALITY_REPORT_METHODS,
  type FastqCycleBin,
  type FastqDistributionBin,
  type FastqQualityTableId,
} from "./fastq-quality-analysis";

export type QualityTableControls = {
  expandedTables: Array<FastqQualityTableId>;
  onToggle: (id: FastqQualityTableId, open: boolean) => void;
};

const CHART = { bottom: 148, left: 36, right: 288, top: 18, width: 300 };
const SERIES = [
  { color: "#059669", key: "A", label: "A", dash: undefined },
  { color: "#0284c7", key: "C", label: "C", dash: "8 3" },
  { color: "#b7791f", key: "G", label: "G", dash: "2 3" },
  { color: "#d05a67", key: "T", label: "T/U", dash: "8 3 2 3" },
  { color: "#64748b", key: "N", label: "N", dash: "4 3" },
  { color: "#8b5cb5", key: "other", label: "Other", dash: "1 3" },
] as const;

export function CycleQualityChart({
  bins,
  tableControls,
}: {
  bins: Array<FastqCycleBin>;
  tableControls: QualityTableControls;
}): React.ReactElement {
  const maximum = Math.max(40, ...bins.map((bin) => bin.maximum));
  const point = (index: number, value: number): string =>
    `${chartX(index, bins.length)},${chartY(value, maximum)}`;
  const upper = bins.map((bin, index) => point(index, bin.maximum));
  const lower = bins.map((bin, index) => point(index, bin.minimum)).reverse();
  return (
    <ChartCard
      title="Quality by cycle"
      description={FASTQ_QUALITY_REPORT_METHODS.cycleQuality}
    >
      <svg
        aria-label="Per-cycle quality: mean and observed range"
        className="h-[180px] w-full text-token-text-secondary"
        role="img"
        viewBox={`0 0 ${CHART.width} 180`}
      >
        <title>Quality by sequencing cycle</title>
        <desc>
          Mean quality is a solid line; the shaded area is the minimum–maximum
          range. Exact plotted values are available in the data table.
        </desc>
        <ChartAxes maximum={maximum} unit="Q" />
        <polygon
          fill="#0f9a8a"
          fillOpacity="0.13"
          points={[...upper, ...lower].join(" ")}
        />
        <polyline
          fill="none"
          points={bins.map((bin, index) => point(index, bin.mean)).join(" ")}
          stroke="#0f9a8a"
          strokeWidth="2.5"
        />
        {bins.length === 1 ? (
          <g>
            <line
              stroke="#0f9a8a"
              strokeOpacity="0.3"
              strokeWidth="6"
              x1={chartX(0, 1)}
              x2={chartX(0, 1)}
              y1={chartY(bins[0]!.minimum, maximum)}
              y2={chartY(bins[0]!.maximum, maximum)}
            />
            <circle
              cx={chartX(0, 1)}
              cy={chartY(bins[0]!.mean, maximum)}
              fill="#0f9a8a"
              r="3"
            />
          </g>
        ) : null}
        <CycleAxisLabels bins={bins} />
      </svg>
      <QcDataTable
        id="cycle-quality"
        tableControls={tableControls}
        caption="Quality by cycle data"
        columns={["Cycle", "Bases", "Mean Q", "Minimum Q", "Maximum Q"]}
        rows={bins.map((bin) => [
          rangeLabel(bin),
          bin.count.toLocaleString(),
          bin.mean.toFixed(1),
          bin.minimum,
          bin.maximum,
        ])}
      />
    </ChartCard>
  );
}

export function CycleCompositionChart({
  bins,
  tableControls,
}: {
  bins: Array<FastqCycleBin>;
  tableControls: QualityTableControls;
}): React.ReactElement {
  return (
    <ChartCard
      title="Base composition by cycle"
      description={FASTQ_QUALITY_REPORT_METHODS.baseComposition}
    >
      <svg
        aria-label="Per-cycle base composition"
        className="h-[180px] w-full text-token-text-secondary"
        role="img"
        viewBox={`0 0 ${CHART.width} 180`}
      >
        <title>Base composition by sequencing cycle</title>
        <desc>
          Separate labeled series show A, C, G, T/U, N and other symbols. Exact
          plotted percentages are available in the data table.
        </desc>
        <ChartAxes maximum={100} unit="%" />
        {SERIES.map(({ color, dash, key }) => (
          <g key={key}>
            <polyline
              fill="none"
              points={bins
                .map(
                  (bin, index) =>
                    `${chartX(index, bins.length)},${chartY(basePercent(bin, key), 100)}`,
                )
                .join(" ")}
              stroke={color}
              strokeDasharray={dash}
              strokeWidth="2"
            />
            {bins.length === 1 ? (
              <circle
                cx={chartX(0, 1)}
                cy={chartY(basePercent(bins[0]!, key), 100)}
                fill={color}
                r="3"
              />
            ) : null}
          </g>
        ))}
        <CycleAxisLabels bins={bins} />
      </svg>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-token-text-secondary">
        {SERIES.map(({ color, key, label }) => (
          <span className="inline-flex items-center gap-1" key={key}>
            <span
              aria-hidden="true"
              className="h-1.5 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>
      <QcDataTable
        id="cycle-composition"
        tableControls={tableControls}
        caption="Base composition by cycle data"
        columns={["Cycle", "A %", "C %", "G %", "T/U %", "N %", "Other %"]}
        rows={bins.map((bin) => [
          rangeLabel(bin),
          ...SERIES.map(({ key }) => basePercent(bin, key).toFixed(1)),
        ])}
      />
    </ChartCard>
  );
}

export function DistributionChart({
  bins,
  description,
  id,
  tableControls,
  title,
  unit,
}: {
  bins: Array<FastqDistributionBin>;
  description: string;
  id: FastqQualityTableId;
  tableControls: QualityTableControls;
  title: string;
  unit: string;
}): React.ReactElement {
  const maximum = Math.max(1, ...bins.map(({ count }) => count));
  const slotWidth = (CHART.right - CHART.left) / Math.max(1, bins.length);
  return (
    <ChartCard description={description} title={title}>
      {bins.length === 0 ? (
        <p className="py-8 text-xs text-token-text-secondary">
          No defined values to plot.
        </p>
      ) : (
        <svg
          aria-label={`${title} distribution`}
          className="h-[180px] w-full text-token-text-secondary"
          role="img"
          viewBox={`0 0 ${CHART.width} 180`}
        >
          <title>{title}</title>
          <desc>
            {description} Bar heights count reads. Exact plotted counts are
            available in the data table.
          </desc>
          <ChartAxes maximum={maximum} unit="" />
          {bins.map((bin, index) => (
            <rect
              fill="#0f9a8a"
              fillOpacity="0.8"
              height={CHART.bottom - chartY(bin.count, maximum)}
              key={bin.start}
              rx="1"
              width={Math.max(1, slotWidth - 2)}
              x={CHART.left + index * slotWidth + 1}
              y={chartY(bin.count, maximum)}
            >
              <title>
                {rangeLabel(bin)} {unit}: {bin.count.toLocaleString()} reads
              </title>
            </rect>
          ))}
          <text fill="currentColor" fontSize="12" x={CHART.left} y="170">
            {formatAxisValue(bins[0]!.start, unit)}
          </text>
          <text
            fill="currentColor"
            fontSize="12"
            textAnchor="end"
            x={CHART.right}
            y="170"
          >
            {formatAxisValue(bins.at(-1)!.end, unit)}
          </text>
        </svg>
      )}
      <QcDataTable
        id={id}
        tableControls={tableControls}
        caption={`${title} data`}
        columns={[`Range (${unit})`, "Reads"]}
        rows={bins.map((bin) => [rangeLabel(bin), bin.count.toLocaleString()])}
      />
    </ChartCard>
  );
}

export function ChartCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}): React.ReactElement {
  return (
    <section className="min-w-0 border-t border-token-border pt-3 first:border-t-0">
      <h4 className="text-xs font-semibold text-token-text-primary">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-token-text-secondary">
        {description}
      </p>
      {children}
    </section>
  );
}

export function QcDataTable({
  caption,
  columns,
  id,
  rows,
  tableControls,
}: {
  caption: string;
  columns: Array<string>;
  id: FastqQualityTableId;
  rows: Array<Array<string | number>>;
  tableControls: QualityTableControls;
}): React.ReactElement {
  return (
    <details
      className="mt-2"
      open={tableControls.expandedTables.includes(id)}
      onToggle={(event) => {
        if (event.target === event.currentTarget)
          tableControls.onToggle(id, event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer text-xs text-token-text-secondary focus:outline-none focus:ring-2 focus:ring-token-focus-border">
        View data table
      </summary>
      <div className="mt-2 max-h-56 overflow-auto rounded border border-token-border">
        <table className="w-full text-left text-xs text-token-text-secondary">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-token-main-surface-secondary">
            <tr>
              {columns.map((column) => (
                <th
                  className="px-2 py-1.5 font-medium whitespace-nowrap"
                  key={column}
                  scope="col"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-token-border" key={index}>
                {row.map((cell, cellIndex) => (
                  <td
                    className="px-2 py-1.5 whitespace-nowrap tabular-nums"
                    key={cellIndex}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ChartAxes({
  maximum,
  unit,
}: {
  maximum: number;
  unit: string;
}): React.ReactElement {
  const ticks =
    unit === ""
      ? [...new Set([0, Math.round(maximum / 2), maximum])]
      : [0, maximum / 2, maximum];
  return (
    <g fill="currentColor" fontSize="12">
      {ticks.map((value) => (
        <g key={value}>
          <line
            stroke="currentColor"
            strokeOpacity="0.12"
            x1={CHART.left}
            x2={CHART.right}
            y1={chartY(value, maximum)}
            y2={chartY(value, maximum)}
          />
          <text
            textAnchor="end"
            x={CHART.left - 6}
            y={chartY(value, maximum) + 4}
          >
            {formatAxisValue(value, unit)}
          </text>
        </g>
      ))}
    </g>
  );
}

function CycleAxisLabels({
  bins,
}: {
  bins: Array<FastqCycleBin>;
}): React.ReactElement {
  return (
    <g fill="currentColor" fontSize="12">
      <text x={CHART.left} y="170">
        Cycle {bins[0]?.start ?? 1}
      </text>
      <text textAnchor="end" x={CHART.right} y="170">
        {bins.at(-1)?.end ?? 1}
      </text>
    </g>
  );
}

function chartX(index: number, count: number): number {
  return count <= 1
    ? (CHART.left + CHART.right) / 2
    : CHART.left + (index / (count - 1)) * (CHART.right - CHART.left);
}

function chartY(value: number, maximum: number): number {
  return (
    CHART.bottom - (value / Math.max(1, maximum)) * (CHART.bottom - CHART.top)
  );
}

function basePercent(
  bin: FastqCycleBin,
  key: keyof FastqCycleBin["bases"],
): number {
  const total = Object.values(bin.bases).reduce((sum, count) => sum + count, 0);
  return total === 0 ? 0 : (bin.bases[key] / total) * 100;
}

function rangeLabel({ end, start }: { end: number; start: number }): string {
  return start === end
    ? start.toLocaleString()
    : `${start.toLocaleString()}–${end.toLocaleString()}`;
}

function formatAxisValue(value: number, unit: string): string {
  const number = Number(value.toFixed(1)).toLocaleString();
  return unit === "Q" ? `Q${number}` : `${number}${unit}`;
}
