import { describe, expect, it } from "vitest";

import {
  createSequenceInteractionState,
  sequenceInteractionReducer,
} from "./interaction-state";

describe("sequenceInteractionReducer", () => {
  it("clears record-derived selection, focus, feature, and search state atomically", () => {
    const populated = {
      ...createSequenceInteractionState("first"),
      activeSearchHitIndex: 3,
      focusCoordinate: 8,
      selectedFeature: {
        end: 9,
        id: "cds-1",
        qualifiers: {},
        start: 1,
        strand: "+" as const,
        type: "CDS",
      },
      selection: { end: 9, recordId: "first", start: 1 },
    };

    expect(
      sequenceInteractionReducer(populated, {
        recordId: "second",
        type: "select-record",
      }),
    ).toEqual(createSequenceInteractionState("second"));
  });

  it("updates focus and selection together", () => {
    expect(
      sequenceInteractionReducer(createSequenceInteractionState("record"), {
        selection: { end: 5, recordId: "record", start: 3 },
        type: "select-range",
      }),
    ).toMatchObject({
      focusCoordinate: 3,
      selection: { end: 5, recordId: "record", start: 3 },
    });
  });
});
