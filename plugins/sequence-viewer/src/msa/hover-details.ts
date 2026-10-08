import type { MsaHoverCellDetails } from "./cell-hover-overlay";

export function buildHoverCellDetails(
  content: string,
  target: HTMLElement,
): NonNullable<MsaHoverCellDetails> {
  const rect = target.getBoundingClientRect();
  const placeAbove = rect.top >= 72;
  return {
    content,
    left: rect.left + rect.width / 2,
    placement: placeAbove ? "top" : "bottom",
    top: placeAbove ? rect.top - 6 : rect.bottom + 6,
  };
}
