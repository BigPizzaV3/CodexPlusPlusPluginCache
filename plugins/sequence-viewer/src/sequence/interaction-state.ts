import type { SequenceFeature, SequenceSelection } from "./types";

export type SequenceInteractionState = {
  activeSearchHitIndex: number;
  focusCoordinate?: number;
  selectedFeature?: SequenceFeature;
  selectedRecordId: string;
  selection?: SequenceSelection;
};

export type SequenceInteractionAction =
  | { recordId: string; type: "select-record" }
  | { selection: SequenceSelection; type: "select-range" }
  | { coordinate: number | undefined; type: "set-focus" }
  | { feature: SequenceFeature | undefined; type: "set-feature" }
  | { index: number; type: "set-search-hit" }
  | { type: "reset-search" }
  | { type: "clear-selection" };

export function createSequenceInteractionState(
  selectedRecordId: string,
): SequenceInteractionState {
  return { activeSearchHitIndex: 0, selectedRecordId };
}

export function sequenceInteractionReducer(
  state: SequenceInteractionState,
  action: SequenceInteractionAction,
): SequenceInteractionState {
  switch (action.type) {
    case "select-record":
      return action.recordId === state.selectedRecordId
        ? state
        : createSequenceInteractionState(action.recordId);
    case "select-range":
      return {
        ...state,
        focusCoordinate: action.selection.start,
        selection: action.selection,
      };
    case "set-focus":
      return { ...state, focusCoordinate: action.coordinate };
    case "set-feature":
      return { ...state, selectedFeature: action.feature };
    case "set-search-hit":
      return { ...state, activeSearchHitIndex: Math.max(0, action.index) };
    case "reset-search":
      return { ...state, activeSearchHitIndex: 0 };
    case "clear-selection":
      return {
        ...state,
        focusCoordinate: undefined,
        selectedFeature: undefined,
        selection: undefined,
      };
  }
}
