import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  analyzeFastqQualityReport,
  FASTQ_QUALITY_TABLE_IDS,
  summarizeFastqQualityReport,
  type FastqQualityViewState,
} from "./fastq-quality-analysis";
import { FastqSummaryPanel } from "./fastq-summary-panel";
import { parseSequenceDocument } from "./parser";
import type { SequenceDocument } from "./types";

describe("FASTQ quality report interface", () => {
  it("preserves summary-only use without starting a detailed report", () => {
    const document = fixtureDocument();
    render(<FastqSummaryPanel summary={document.fastqSummary} />);
    expect(screen.getByText("FASTQ overview")).toBeInTheDocument();
    expect(screen.getByText("Reads").parentElement).toHaveTextContent("4");
    expect(screen.queryByText("Read quality")).not.toBeInTheDocument();
  });

  it("provides readable cycle plots with equivalent, accessible data tables", async () => {
    const document = fixtureDocument();
    render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    expect(await screen.findByTestId("fastq-quality-scope")).toHaveTextContent(
      "Analyzed 4 of 4 parsed reads · 22 bases",
    );
    const qualityChart = screen.getByRole("img", {
      name: "Per-cycle quality: mean and observed range",
    });
    expect(
      screen.getByRole("img", { name: "Per-cycle base composition" }),
    ).toBeInTheDocument();
    const card = qualityChart.closest("section");
    if (card == null) throw new Error("Expected a quality chart card.");
    await userEvent.click(within(card).getByText("View data table"));
    const table = screen.getByRole("table", { name: "Quality by cycle data" });
    expect(
      within(table).getByRole("row", { name: "1 4 22.5 0 40" }),
    ).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Cycle", "Bases", "Mean Q", "Minimum Q", "Maximum Q"]);

    await userEvent.click(
      screen.getByText("Distributions and repeated patterns"),
    );
    expect(
      screen.getByRole("img", { name: "Read lengths distribution" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "GC per read distribution" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Mean quality per read distribution" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/GC is undefined for 1 analyzed reads/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Most frequent repeated read sequences",
      }),
    ).toHaveTextContent("ACGTACGT");
  });

  it("marks retained-read subsets without replacing the whole-file totals", async () => {
    const complete = fixtureDocument();
    const document: SequenceDocument = {
      ...complete,
      recordInventory: { materializedCount: 2, totalCount: 4, truncated: true },
      records: complete.records.slice(0, 2),
    };
    render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    expect(await screen.findByTestId("fastq-quality-scope")).toHaveTextContent(
      "Analyzed 2 of 4 parsed reads",
    );
    expect(screen.getByTestId("fastq-quality-scope")).toHaveTextContent(
      "not a random sample",
    );
    expect(screen.getByText("Retained-read subset")).toBeInTheDocument();
    expect(
      screen.getByText("Reads", { selector: "dt" }).parentElement,
    ).toHaveTextContent("4");
  });

  it("runs an adapter screen only after explicit sequence entry and keeps its assumptions visible", async () => {
    const document = fixtureDocument();
    render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    await screen.findByTestId("fastq-quality-scope");
    await userEvent.click(screen.getByText("Adapter screen and methods"));
    expect(
      screen.getByText(
        "Adapter content not screened: no adapter sequence supplied.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/not a FastQC run/)).toBeVisible();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
      "ACGTACGT",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Screen sequence" }),
    );
    expect(
      await screen.findByText(
        "2 of 4 analyzed reads contain the supplied sequence (2 exact occurrences).",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        /No partial matches, mismatches or reverse-complement screen/,
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Clear screen" }));
    expect(
      screen.getByText(
        "Adapter content not screened: no adapter sequence supplied.",
      ),
    ).toBeVisible();
  });

  it("rejects an ambiguous adapter without discarding the readable QC report", async () => {
    const document = fixtureDocument();
    render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    await screen.findByTestId("fastq-quality-scope");
    await userEvent.click(screen.getByText("Adapter screen and methods"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
      "ACGTNNNN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Screen sequence" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("8–64 A/C/G/T bases");
    expect(
      screen.getByRole("img", {
        name: "Per-cycle quality: mean and observed range",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Adapter content not screened: no adapter sequence supplied.",
      ),
    ).toBeVisible();
  });

  it("identifies the applied adapter when an edited draft has not been submitted", async () => {
    const document = fixtureDocument();
    render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    await screen.findByTestId("fastq-quality-scope");
    await userEvent.click(screen.getByText("Adapter screen and methods"));
    const input = screen.getByRole("textbox", {
      name: "Your adapter sequence",
    });
    await userEvent.type(input, "ACGTACGT");
    await userEvent.click(
      screen.getByRole("button", { name: "Screen sequence" }),
    );
    await screen.findByText(
      "2 of 4 analyzed reads contain the supplied sequence (2 exact occurrences).",
    );
    await userEvent.clear(input);
    await userEvent.type(input, "TTTTTTTT");
    expect(screen.getByText(/Screened sequence:/)).toHaveTextContent(
      "ACGTACGT · Edited sequence has not been applied.",
    );
  });

  it("renders the same controlled report returned to the agent and delegates adapter changes", async () => {
    const document = fixtureDocument();
    const report = summarizeFastqQualityReport(
      await analyzeFastqQualityReport(document),
    );
    const onApply = vi.fn();
    const { rerender } = render(
      <FastqSummaryPanel
        adapterSequence={null}
        document={document}
        onAdapterSequenceApply={onApply}
        qualityReport={report}
        qualityReportPending={false}
        summary={document.fastqSummary}
      />,
    );
    expect(screen.getByTestId("fastq-quality-scope")).toHaveTextContent(
      report.scope.description,
    );
    await userEvent.click(screen.getByText("Adapter screen and methods"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
      "ACGTACGT",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Screen sequence" }),
    );
    expect(onApply).toHaveBeenCalledWith("ACGTACGT");
    rerender(
      <FastqSummaryPanel
        adapterSequence="ACGTACGT"
        document={document}
        onAdapterSequenceApply={onApply}
        qualityReport={null}
        qualityReportError="Quality report cancelled."
        qualityReportPending={false}
        summary={document.fastqSummary}
      />,
    );
    expect(
      screen.getByText(
        /Detailed quality report unavailable: Quality report cancelled/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Adapter screen unavailable because/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Screening the supplied adapter/),
    ).not.toBeInTheDocument();
  });

  it("opens and closes every QC disclosure through the same controlled view state", async () => {
    const document = fixtureDocument();
    const report = summarizeFastqQualityReport(
      await analyzeFastqQualityReport(document),
    );
    const onViewChange = vi.fn<(view: FastqQualityViewState) => void>();
    const view: FastqQualityViewState = {
      distributionsExpanded: true,
      expandedTables: [...FASTQ_QUALITY_TABLE_IDS],
      methodsExpanded: true,
    };
    const { rerender } = render(
      <FastqSummaryPanel
        document={document}
        onViewChange={onViewChange}
        qualityReport={report}
        summary={document.fastqSummary}
        view={view}
      />,
    );
    expect(screen.getAllByRole("table")).toHaveLength(7);
    expect(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
    ).toBeVisible();
    const table = screen
      .getByRole("table", { name: "Quality by cycle data" })
      .closest("details");
    if (table == null) throw new Error("Expected controlled table disclosure.");
    await userEvent.click(within(table).getByText("View data table"));
    expect(onViewChange).toHaveBeenLastCalledWith({
      ...view,
      expandedTables: FASTQ_QUALITY_TABLE_IDS.filter(
        (id) => id !== "cycle-quality",
      ),
    });
    rerender(
      <FastqSummaryPanel
        document={document}
        onViewChange={onViewChange}
        qualityReport={report}
        summary={document.fastqSummary}
        view={{
          distributionsExpanded: false,
          expandedTables: [],
          methodsExpanded: false,
        }}
      />,
    );
    for (const table of screen.getAllByRole("table")) {
      expect(table).not.toBeVisible();
    }
    expect(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
    ).not.toBeVisible();
  });

  it("does not display the previous document’s report while a new one is being calculated", async () => {
    const document = fixtureDocument();
    const { rerender } = render(
      <FastqSummaryPanel document={document} summary={document.fastqSummary} />,
    );
    await screen.findByTestId("fastq-quality-scope");
    const next = parseSequenceDocument({
      contents: "@new-synthetic-read\nAC\n+\n++\n",
      fileName: "next.fastq",
    });
    rerender(<FastqSummaryPanel document={next} summary={next.fastqSummary} />);
    expect(screen.queryByTestId("fastq-quality-scope")).not.toBeInTheDocument();
    expect(await screen.findByTestId("fastq-quality-scope")).toHaveTextContent(
      "Analyzed 1 of 1 parsed reads · 2 bases",
    );
  });
});

function fixtureDocument(): SequenceDocument {
  return parseSequenceDocument({
    contents: [
      "@synthetic-qc-read-1",
      "ACGTACGT",
      "+",
      "IIIIIIII",
      "@synthetic-qc-read-2",
      "ACGTACGT",
      "+",
      "55555555",
      "@synthetic-qc-read-3",
      "NNNN",
      "+",
      "!!!!",
      "@synthetic-qc-read-4",
      "GG",
      "+",
      "??",
    ].join("\n"),
    fileName: "synthetic-qc-report.fastq",
  });
}
