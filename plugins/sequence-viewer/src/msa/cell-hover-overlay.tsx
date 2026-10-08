import clsx from "clsx";

import type { MsaSequenceRow } from "./types";

export type FocusedMsaCell = {
  column: number;
  row: MsaSequenceRow;
  symbol: string;
} | null;

export type MsaHoverCellDetails = {
  content: string;
  left: number;
  placement: "bottom" | "top";
  top: number;
} | null;

export function MsaCellHoverDetails({
  details,
}: {
  details: MsaHoverCellDetails;
}): React.ReactElement | null {
  if (details == null) {
    return null;
  }
  return (
    <div
      role="tooltip"
      className={clsx(
        "pointer-events-none fixed z-[80] max-w-sm rounded-md border border-token-border bg-token-main-surface-primary px-2 py-1 text-[11px] leading-4 text-token-text-primary shadow-lg",
        details.placement === "top"
          ? "-translate-x-1/2 -translate-y-full"
          : "-translate-x-1/2",
      )}
      style={{ left: details.left, top: details.top }}
    >
      {details.content}
    </div>
  );
}
