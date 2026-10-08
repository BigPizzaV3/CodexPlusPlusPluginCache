import { describe, expect, it } from "vitest";

import {
  createMsaInteractionState,
  createMsaRowSetKey,
  msaInteractionReducer,
} from "./alignment-state";
import type { MsaSequenceRow } from "./types";

describe("msaInteractionReducer", () => {
  it("atomically clears stale row-derived focus, search, and guide-tree state", () => {
    const alpha = row("alpha");
    const beta = row("beta");
    const populated = {
      ...createMsaInteractionState(alpha.id),
      focusedCell: { column: 1, row: beta, symbol: "C" },
      guideTree: {
        newick: "(alpha,beta);",
        rowSetKey: createMsaRowSetKey([alpha.id, beta.id]),
      },
      pinnedCell: { column: 1, row: beta, symbol: "C" },
      referenceMode: "anchor" as const,
      selectedHitIndex: 4,
    };

    const next = msaInteractionReducer(populated, {
      rowIds: [alpha.id],
      type: "analysis-rows-changed",
    });

    expect(next).toMatchObject({
      anchorRowId: alpha.id,
      focusedCell: null,
      guideTree: null,
      pinnedCell: null,
      referenceMode: "anchor",
      selectedHitIndex: 0,
    });
  });

  it("moves a hidden anchor to the first remaining row and falls back when empty", () => {
    const state = {
      ...createMsaInteractionState("hidden"),
      referenceMode: "anchor" as const,
    };

    expect(
      msaInteractionReducer(state, {
        rowIds: ["visible"],
        type: "visible-rows-changed",
      }),
    ).toMatchObject({ anchorRowId: "visible", referenceMode: "anchor" });
    expect(
      msaInteractionReducer(state, {
        rowIds: [],
        type: "visible-rows-changed",
      }),
    ).toMatchObject({ anchorRowId: null, referenceMode: "none" });
  });
});

function row(id: string): MsaSequenceRow {
  return {
    alignedSequence: "AC",
    id,
    label: id,
    ungappedLength: 2,
  };
}
