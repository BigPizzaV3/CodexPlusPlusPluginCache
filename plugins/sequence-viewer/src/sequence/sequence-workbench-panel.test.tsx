import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSequenceWorkbenchState } from "../workbench-state";
import { parseSequenceDocument } from "./parser";
import { SequenceWorkbenchPanel } from "./sequence-workbench-panel";
import { parseSequenceTrack } from "./tracks";
import { applySequenceAnnotationRequest } from "./workbench-controller";

afterEach(() => cleanup());

describe("compound chromosome annotations", () => {
  it("keeps an edit draft mounted while another contextual tool is open", async () => {
    renderPublicChromosomeFeatures();

    expect(
      screen.queryByRole("textbox", {
        name: "Replacement or inserted sequence",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit copy" }));
    const draft = screen.getByRole("textbox", {
      name: "Replacement or inserted sequence",
    });
    await userEvent.type(draft, "ACGT");
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(draft.isConnected).toBe(true);
    expect(draft.closest(".bio-workbench-tool-panel")).toHaveAttribute(
      "hidden",
    );
    expect(draft.closest(".bio-workbench-tool-panel")).toHaveAttribute("inert");
    expect(
      screen.getByRole("combobox", { name: "Genetic code" }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Edit copy" }));
    expect(
      screen.getByRole("textbox", { name: "Replacement or inserted sequence" }),
    ).toBe(draft);
    expect(draft).toHaveValue("ACGT");
    expect(
      screen.queryByRole("combobox", { name: "Genetic code" }),
    ).not.toBeInTheDocument();
  });

  it("displays genuine UCSC chr22 exon counts on both transcript strands", async () => {
    const { record } = renderPublicChromosomeFeatures();

    await userEvent.click(screen.getByRole("button", { name: "Edit copy" }));

    expect(
      screen.getByRole("button", {
        name: "mRNA1 region · 1,001–5,000 · + · 2 exons",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "mRNA2 region · 2,001–6,000 · - · 2 exons",
      }),
    ).toBeInTheDocument();
    expect(record.features.map(({ label }) => label)).toEqual(
      expect.arrayContaining(["mRNA1", "mRNA2"]),
    );
  });

  it("does not invent a compound exon label for a single-segment feature", async () => {
    renderPublicChromosomeFeatures({ includeSingleSegmentControl: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit copy" }));

    const control = screen.getByRole("button", {
      name: "QA singleton control region · 20–30 · +",
    });
    expect(control).not.toHaveTextContent(/exons?/iu);
    expect(
      screen.getByRole("button", {
        name: "mRNA1 region · 1,001–5,000 · + · 2 exons",
      }),
    ).toBeInTheDocument();
  });
});

function renderPublicChromosomeFeatures({
  includeSingleSegmentControl = false,
}: { includeSingleSegmentControl?: boolean } = {}) {
  // Only the reference coordinate scaffold is synthetic. Both BED12 rows are
  // copied unchanged from Biopython commit
  // c9489604d1d9607602ca9199a3852c1219ed330f, Tests/Blat/bed12.bed.
  // Original public fixture SHA-256:
  // 2abf5cf6d9a42792af2cbdede04e63a869a6a4083e77272cd17ef26ca9211a2c.
  const scaffold = parseSequenceDocument({
    contents: `>chr22 QA-SYNTHETIC-COORDINATE-SCAFFOLD-ONLY\n${"A".repeat(6_000)}`,
    fileName: "QA-SYNTHETIC-CHROMOSOME-COORDINATE-SCAFFOLD.fasta",
  });
  const originalRecord = scaffold.records[0];
  if (originalRecord == null) {
    throw new Error("Expected a bounded chromosome coordinate scaffold.");
  }
  const publicTrack = parseSequenceTrack({
    content: [
      "chr22\t1000\t5000\tmRNA1\t960\t+\t1200\t4900\t255,0,0\t2\t567,488,\t0,3512,",
      "chr22\t2000\t6000\tmRNA2\t900\t-\t2300\t5960\t0,255,0\t2\t433,399,\t0,3601,",
    ].join("\n"),
    displayName: "public-ucsc-chr22-bed12.bed",
    format: "bed",
    id: "public-ucsc-chr22-bed12",
    requestedReference: originalRecord.sourceLabel,
  });
  const imported = applySequenceAnnotationRequest({
    document: scaffold,
    request: { action: "import", trackId: publicTrack.id },
    selectedRecordId: originalRecord.id,
    tracks: [publicTrack],
  }).document;
  const importedRecord = imported.records[0];
  if (importedRecord == null) {
    throw new Error("Expected imported genuine UCSC chromosome annotations.");
  }
  const record = includeSingleSegmentControl
    ? {
        ...importedRecord,
        features: [
          ...importedRecord.features,
          {
            end: 30,
            id: "QA-SYNTHETIC-SINGLE-SEGMENT-NEGATIVE-CONTROL",
            label: "QA singleton control",
            qualifiers: {},
            segments: [{ end: 30, start: 20 }],
            start: 20,
            strand: "+" as const,
            type: "region",
          },
        ],
      }
    : importedRecord;
  const document = { ...imported, records: [record] };
  const state = createSequenceWorkbenchState(document);

  render(
    <SequenceWorkbenchPanel
      geneticCodeId={1}
      onAddAnnotation={vi.fn()}
      onAlignRecords={vi.fn()}
      onCancelJob={vi.fn()}
      onDeleteAnnotation={vi.fn()}
      onEdit={vi.fn()}
      onExport={vi.fn()}
      onGeneticCodeChange={vi.fn()}
      onImportTrack={vi.fn()}
      onLoadTrack={vi.fn()}
      onRedo={vi.fn()}
      onRemoveTrack={vi.fn()}
      onRestoreSession={vi.fn()}
      onRunAnalysis={vi.fn()}
      onSaveSession={vi.fn()}
      onSelectFeature={vi.fn()}
      onUndo={vi.fn()}
      onUpdateAnnotation={vi.fn()}
      record={record}
      recordCount={1}
      state={state}
    />,
  );

  return { record, state };
}
