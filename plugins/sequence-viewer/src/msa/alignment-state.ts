import type { FocusedMsaCell } from "./cell-hover-overlay";

export type MsaReferenceMode = "anchor" | "consensus" | "none";

export type MsaInteractionState = {
  anchorRowId: string | null;
  focusedCell: FocusedMsaCell;
  guideTree: { newick: string; rowSetKey: string } | null;
  pinnedCell: FocusedMsaCell;
  referenceMode: MsaReferenceMode;
  selectedHitIndex: number;
};

export type MsaInteractionAction =
  | { anchorRowId: string | null; type: "set-anchor" }
  | { cell: FocusedMsaCell; type: "set-focus" }
  | { cell: FocusedMsaCell; type: "set-pinned" }
  | { index: number; type: "set-selected-hit" }
  | { mode: MsaReferenceMode; type: "set-reference-mode" }
  | { newick: string | null; rowSetKey: string; type: "set-guide-tree" }
  | { rowIds: Array<string>; type: "visible-rows-changed" }
  | { rowIds: Array<string>; type: "analysis-rows-changed" }
  | { anchorRowId: string | null; type: "reset" }
  | { type: "clear-selection" };

export function createMsaInteractionState(
  anchorRowId: string | null,
): MsaInteractionState {
  return {
    anchorRowId,
    focusedCell: null,
    guideTree: null,
    pinnedCell: null,
    referenceMode: "consensus",
    selectedHitIndex: 0,
  };
}

export function msaInteractionReducer(
  state: MsaInteractionState,
  action: MsaInteractionAction,
): MsaInteractionState {
  switch (action.type) {
    case "set-anchor":
      return { ...state, anchorRowId: action.anchorRowId };
    case "set-focus":
      return { ...state, focusedCell: action.cell };
    case "set-pinned":
      return { ...state, pinnedCell: action.cell };
    case "set-selected-hit":
      return { ...state, selectedHitIndex: Math.max(0, action.index) };
    case "set-reference-mode":
      return { ...state, referenceMode: action.mode };
    case "set-guide-tree":
      return {
        ...state,
        guideTree:
          action.newick == null
            ? null
            : { newick: action.newick, rowSetKey: action.rowSetKey },
      };
    case "visible-rows-changed":
      return reconcileVisibleRows(state, action.rowIds, false);
    case "analysis-rows-changed":
      return reconcileVisibleRows(state, action.rowIds, true);
    case "clear-selection":
      return { ...state, focusedCell: null, pinnedCell: null };
    case "reset":
      return createMsaInteractionState(action.anchorRowId);
  }
}

export function createMsaRowSetKey(rowIds: Array<string>): string {
  return rowIds.join("\u001f");
}

function reconcileVisibleRows(
  state: MsaInteractionState,
  rowIds: Array<string>,
  analysisRowsChanged: boolean,
): MsaInteractionState {
  const available = new Set(rowIds);
  const firstRowId = rowIds[0] ?? null;
  const anchorStillVisible =
    state.anchorRowId != null && available.has(state.anchorRowId);
  const anchorRowId = anchorStillVisible ? state.anchorRowId : firstRowId;
  const referenceMode =
    state.referenceMode !== "anchor" || anchorRowId != null
      ? state.referenceMode
      : rowIds.length > 0
        ? "consensus"
        : "none";
  const rowSetKey = createMsaRowSetKey(rowIds);
  return {
    ...state,
    anchorRowId,
    focusedCell:
      state.focusedCell != null && available.has(state.focusedCell.row.id)
        ? state.focusedCell
        : null,
    guideTree:
      analysisRowsChanged && state.guideTree?.rowSetKey !== rowSetKey
        ? null
        : state.guideTree,
    pinnedCell:
      state.pinnedCell != null && available.has(state.pinnedCell.row.id)
        ? state.pinnedCell
        : null,
    referenceMode,
    selectedHitIndex: analysisRowsChanged ? 0 : state.selectedHitIndex,
  };
}
