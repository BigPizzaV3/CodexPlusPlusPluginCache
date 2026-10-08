import { useMemo } from "react";

import { summarizeQuality } from "./quality";
import type { SequenceRecord } from "./types";

export function QualityTrack({
  record,
}: {
  record: SequenceRecord;
}): React.ReactElement | null {
  const summary = useMemo(
    () =>
      record.quality == null ? null : summarizeQuality(record.quality.phred),
    [record.quality],
  );

  if (summary == null) {
    return null;
  }

  return (
    <div className="rounded-xl border border-token-border bg-token-bg-secondary/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-token-text-tertiary">
          FASTQ quality
        </div>
        <div className="text-xs text-token-text-secondary">
          mean Q{summary.mean.toFixed(1)} · min Q{summary.min} · max Q
          {summary.max}
        </div>
      </div>
      <p className="text-sm text-token-text-secondary">
        Per-base quality bars are aligned directly beneath the visible wrapped sequence lines.
      </p>
    </div>
  );
}
