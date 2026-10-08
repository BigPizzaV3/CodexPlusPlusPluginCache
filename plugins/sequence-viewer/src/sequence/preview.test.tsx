import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSequenceDocument } from "./parser";
import { summarizeQuality } from "./quality";
import { SequenceRichViewer } from "./sequence-rich-viewer";
import * as artifactStateKey from "../artifact-state-key";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommand,
} from "../viewer-commands";
import { parseWorkbenchSession } from "../workbench-state";
import { createSequenceInterfaceSettings } from "./interface-state";

afterEach(() => cleanup());

describe("SequenceRichViewer", () => {
  it("skips content hashing for an authenticated source key and preserves the fallback", () => {
    const createArtifactStateKey = vi.spyOn(
      artifactStateKey,
      "createArtifactStateKey",
    );
    const document = parseSequenceDocument({
      contents: ">trusted\nACGT\n",
      fileName: "trusted.fasta",
    });

    try {
      const view = render(
        <SequenceRichViewer
          document={document}
          sourceStateKeyOverride="authenticated-source-revision"
        />,
      );

      expect(createArtifactStateKey).not.toHaveBeenCalled();

      view.rerender(<SequenceRichViewer document={document} />);

      expect(createArtifactStateKey).toHaveBeenCalledWith(
        "trusted\u001fACGT",
        "trusted.fasta",
      );
    } finally {
      createArtifactStateKey.mockRestore();
    }
  });

  it("renders aligned FASTA rows in generic sequence mode with a compact legend and searchable wrapped cells", async () => {
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">a\nAC-GT\n>b\nACTGT\n",
          fileName: "family.fasta",
        })}
      />,
    );

    expect(
      screen.getByLabelText("Soft nucleotide palette legend"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Wrapped sequence view")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search sequence"), "AC");
    expect(await screen.findByText(/Search hits \(/)).toBeInTheDocument();
    expect(screen.getByLabelText("a position 1 A")).toBeInTheDocument();
  });

  it("keeps advanced display controls out of the canvas while preserving their state", async () => {
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">display\nACGTACGT\n",
          fileName: "display.fasta",
        })}
      />,
    );

    expect(
      screen.getByRole("grid", { name: "Wrapped sequence view" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Residue palette" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Display" }));
    const palette = screen.getByRole("combobox", { name: "Residue palette" });
    await userEvent.selectOptions(palette, "nucleotide-ambiguity");
    await userEvent.click(screen.getByRole("button", { name: "Display" }));

    expect(palette.isConnected).toBe(true);
    expect(palette.closest(".bio-workbench-tool-panel")).toHaveAttribute(
      "hidden",
    );
    expect(palette.closest(".bio-workbench-tool-panel")).toHaveAttribute(
      "inert",
    );
    await userEvent.click(screen.getByRole("button", { name: "Display" }));
    expect(screen.getByRole("combobox", { name: "Residue palette" })).toBe(
      palette,
    );
    expect(palette).toHaveValue("nucleotide-ambiguity");
  });

  it("supports submitting a coordinate without opening advanced tools", async () => {
    const updateModelContext = vi.fn();
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">jump\nACGTACGT\n",
          fileName: "jump.fasta",
        })}
        updateModelContext={updateModelContext}
      />,
    );

    await userEvent.type(
      screen.getByRole("textbox", { name: "Jump to coordinate" }),
      "6{Enter}",
    );

    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            selection: expect.objectContaining({ start: 6, end: 6 }),
          }),
        }),
      );
    });
  });

  it("uses the same record browser state for user filtering and agent commands", async () => {
    const document = parseSequenceDocument({
      contents:
        ">first Alpha\nACGT\n>second Beta\nACGTACGT\n>third Gamma\nACG\n",
      fileName: "QA_record_browser.fasta",
    });
    const onCommandResult = vi.fn();
    const viewer = (command?: SequenceViewerCommand, revision = 1) => (
      <SequenceRichViewer
        command={
          command == null ? undefined : sequenceCommand(command, revision)
        }
        document={document}
        onCommandResult={onCommandResult}
      />
    );
    const view = render(
      viewer({
        action: "set_sequence_record_browser",
        expanded: true,
        page: 99,
        query: "Beta",
        sortBy: "length",
      }),
    );

    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        expect.objectContaining({ action: "set_sequence_record_browser" }),
        expect.objectContaining({
          applied: true,
          state: {
            recordBrowser: {
              expanded: true,
              page: 0,
              query: "Beta",
              sortBy: "length",
            },
          },
        }),
      ),
    );
    expect(within(screen.getByRole("table")).getByText("second")).toBeVisible();
    expect(
      within(screen.getByRole("table")).queryByText("first"),
    ).not.toBeInTheDocument();
    await userEvent.clear(
      screen.getByRole("textbox", { name: "Filter records" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Filter records" }),
      "Alpha",
    );
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "sequence-ui-state" } },
        2,
      ),
    );

    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          state: {
            query: expect.objectContaining({
              result: expect.objectContaining({
                recordBrowser: {
                  expanded: true,
                  page: 0,
                  query: "Alpha",
                  sortBy: "length",
                },
              }),
            }),
          },
        }),
      ),
    );
    view.rerender(
      viewer({ action: "save_session", name: "QA browser session" }, 3),
    );
    const savedSession = onCommandResult.mock.calls.at(-1)?.[1].state?.session;
    if (typeof savedSession !== "string")
      throw new Error("Expected a browser session.");
    view.rerender(
      viewer(
        {
          action: "set_sequence_record_browser",
          query: "Gamma",
          expanded: false,
          sortBy: "source",
        },
        4,
      ),
    );
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 5),
    );
    expect(screen.getByRole("textbox", { name: "Filter records" })).toHaveValue(
      "Alpha",
    );
    expect(within(screen.getByRole("table")).getByText("first")).toBeVisible();
    const legacySession = parseWorkbenchSession(savedSession);
    if (legacySession.view.sequence == null)
      throw new Error("Expected sequence view.");
    delete legacySession.view.sequence.interface;
    view.rerender(
      viewer(
        { action: "restore_session", session: JSON.stringify(legacySession) },
        6,
      ),
    );
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "sequence-ui-state" } },
        7,
      ),
    );
    const defaults = createSequenceInterfaceSettings();
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "query_viewer" }),
      expect.objectContaining({
        state: {
          query: expect.objectContaining({
            result: expect.objectContaining({
              recordBrowser: defaults.recordBrowser,
              annotationIndex: defaults.annotationIndex,
              originRangeExpanded: false,
              readPileup: defaults.readPileup,
              qualityView: defaults.quality.view,
              quality: expect.objectContaining({ adapterSequence: null }),
            }),
          }),
        },
      }),
    );
  });

  it("applies trace commands to the visible original-read window and reports user panning", async () => {
    const document = parseSequenceDocument({
      contents: ">QA_trace\nACGTACGT\n",
      fileName: "QA_trace.fasta",
    });
    const record = document.records[0];
    if (record == null) throw new Error("Expected trace fixture.");
    record.chromatogram = {
      channels: {
        A: [8, 0, 0, 0, 8, 0, 0, 0],
        C: [0, 8, 0, 0, 0, 8, 0, 0],
        G: [0, 0, 8, 0, 0, 0, 8, 0],
        T: [0, 0, 0, 8, 0, 0, 0, 8],
      },
      format: "abif",
      peakLocations: [0, 1, 2, 3, 4, 5, 6, 7],
      sampleCount: 8,
    };
    const onCommandResult = vi.fn();
    const viewer = (command: SequenceViewerCommand, revision: number) => (
      <SequenceRichViewer
        command={sequenceCommand(command, revision)}
        document={document}
        onCommandResult={onCommandResult}
      />
    );
    const view = render(
      viewer(
        {
          action: "set_chromatogram_view_options",
          firstBase: 5,
          basesPerWindow: 2,
        },
        1,
      ),
    );

    expect(
      await screen.findByRole("figure", {
        name: /QA_trace chromatogram, bases 5 to 6/,
      }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Next chromatogram window" }),
    );
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "sequence-ui-state" } },
        2,
      ),
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          state: {
            query: expect.objectContaining({
              result: expect.objectContaining({
                chromatogram: { firstBase: 7, basesPerWindow: 2 },
              }),
            }),
          },
        }),
      ),
    );
    view.rerender(
      viewer({ action: "set_chromatogram_view_options", firstBase: 99 }, 3),
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_chromatogram_view_options" }),
        expect.objectContaining({ applied: false }),
      ),
    );
    expect(
      screen.getByRole("figure", {
        name: /QA_trace chromatogram, bases 7 to 8/,
      }),
    ).toBeVisible();
    view.rerender(
      viewer({ action: "select_sequence_range", start: 1, end: 1 }, 4),
    );
    view.rerender(
      viewer(
        {
          action: "set_chromatogram_view_options",
          firstBase: 7,
          basesPerWindow: 2,
        },
        5,
      ),
    );
    view.rerender(
      viewer({ action: "save_session", name: "QA trace session" }, 6),
    );
    const savedSession = onCommandResult.mock.calls.at(-1)?.[1].state?.session;
    if (typeof savedSession !== "string")
      throw new Error("Expected a serialized trace session.");
    expect(
      parseWorkbenchSession(savedSession).view.sequence?.selection,
    ).toMatchObject({ start: 1, end: 1 });
    view.rerender(viewer({ action: "clear_sequence_selection" }, 7));
    view.rerender(
      viewer(
        {
          action: "set_chromatogram_view_options",
          firstBase: 1,
          basesPerWindow: 4,
        },
        8,
      ),
    );
    expect(
      screen.getByRole("figure", {
        name: /QA_trace chromatogram, bases 1 to 4/,
      }),
    ).toBeVisible();
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 9),
    );
    expect(
      screen.getByRole("figure", {
        name: /QA_trace chromatogram, bases 7 to 8/,
      }),
    ).toBeVisible();
    view.rerender(viewer({ action: "clear_sequence_selection" }, 10));
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 11),
    );
    expect(
      screen.getByRole("figure", {
        name: /QA_trace chromatogram, bases 7 to 8/,
      }),
    ).toBeVisible();
  });

  it("shares read filters and source-read selection between the interface and agent queries", async () => {
    const document = parseSequenceDocument({
      contents: ">chr1\nACGTACGTACGT\n",
      fileName: "QA_read_reference.fasta",
    });
    const trackId = "22222222-2222-4222-8222-222222222222";
    const onCommandResult = vi.fn();
    const viewer = (command: SequenceViewerCommand, revision: number) => (
      <SequenceRichViewer
        command={sequenceCommand(command, revision)}
        document={document}
        onCommandResult={onCommandResult}
      />
    );
    const view = render(
      viewer(
        {
          action: "load_track",
          content:
            "@SQ\tSN:1\tLN:12\nQA-low\t0\t1\t1\t10\t4M\t*\t0\t0\tACGT\tIIII\nQA-high\t0\t1\t5\t60\t4M\t*\t0\t0\tACGT\tIIII\n",
          displayName: "QA_reads.sam",
          encoding: "utf8",
          format: "sam",
          reference: "chr1",
          trackId,
        },
        1,
      ),
    );

    expect(
      await screen.findByRole("button", { name: /Inspect read QA-low,/ }),
    ).toBeVisible();
    await userEvent.click(screen.getByText("Display & filters"));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Minimum MAPQ" }),
      "20",
    );
    expect(
      screen.queryByRole("button", { name: /Inspect read QA-low,/ }),
    ).not.toBeInTheDocument();
    view.rerender(
      viewer(
        {
          action: "query_viewer",
          request: {
            target: "reads",
            reference: "chr1",
            start: 1,
            end: 12,
            limit: 100,
          },
        },
        2,
      ),
    );

    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          state: {
            query: expect.objectContaining({
              items: [
                expect.objectContaining({
                  id: "QA-high",
                  trackId,
                  sourceReadIndex: 1,
                }),
              ],
            }),
          },
        }),
      ),
    );
    view.rerender(
      viewer({ action: "select_read", trackId, sourceReadIndex: 1 }, 3),
    );
    expect(
      await screen.findByRole("complementary", {
        name: "Selected read details",
      }),
    ).toHaveTextContent("QA-high");
    view.rerender(
      viewer({ action: "save_session", name: "QA read session" }, 4),
    );
    const savedSession = onCommandResult.mock.calls.at(-1)?.[1].state?.session;
    if (typeof savedSession !== "string")
      throw new Error("Expected a serialized read session.");
    expect(
      parseWorkbenchSession(savedSession).view.sequence?.interface?.readPileup,
    ).toMatchObject({
      options: { minimumMappingQuality: 20 },
      selectedRead: { trackId, sourceReadIndex: 1 },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Close read details" }),
    );
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "read-pileup-state" } },
        5,
      ),
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          state: {
            query: expect.objectContaining({
              result: expect.objectContaining({
                options: expect.objectContaining({ minimumMappingQuality: 20 }),
                selectedRead: null,
              }),
            }),
          },
        }),
      ),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Minimum MAPQ" }),
      "0",
    );
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 6),
    );
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("QA-high");
    expect(screen.getByRole("combobox", { name: "Minimum MAPQ" })).toHaveValue(
      "20",
    );

    const invalidSession = parseWorkbenchSession(savedSession);
    const invalidInterface = invalidSession.view.sequence?.interface;
    if (invalidInterface == null)
      throw new Error("Expected saved interface settings.");
    invalidInterface.readPileup.selectedRead = { trackId, sourceReadIndex: 99 };
    view.rerender(
      viewer(
        { action: "restore_session", session: JSON.stringify(invalidSession) },
        7,
      ),
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "restore_session" }),
      expect.objectContaining({ applied: false }),
    );
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("QA-high");
    view.rerender(
      viewer(
        {
          action: "edit_copy",
          request: { operation: "delete-sequence-range", start: 1, end: 1 },
        },
        8,
      ),
    );
    expect(
      screen.queryByRole("complementary", { name: "Selected read details" }),
    ).not.toBeInTheDocument();
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 9),
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "restore_session" }),
      expect.objectContaining({ applied: true }),
    );
    expect(
      screen.getByRole("complementary", { name: "Selected read details" }),
    ).toHaveTextContent("QA-high");
  });

  it("returns the displayed QC adapter report after user and model analyses", async () => {
    const document = parseSequenceDocument({
      contents:
        "@QA-read1\nACGTACGTAAAA\n+\nIIIIIIIIIIII\n@QA-read2\nTTTTTTTTGGGG\n+\nIIIIIIIIIIII\n",
      fileName: "QA_adapter_parity.fastq",
    });
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const viewer = (command?: SequenceViewerCommand, revision = 1) => (
      <SequenceRichViewer
        command={
          command == null ? undefined : sequenceCommand(command, revision)
        }
        document={document}
        onCommandResult={onCommandResult}
        updateModelContext={updateModelContext}
      />
    );
    const view = render(viewer());
    await userEvent.click(screen.getByRole("button", { name: "Quality" }));
    await userEvent.click(screen.getByText("Adapter screen and methods"));
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your adapter sequence" }),
      "ACGTACGT",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Screen sequence" }),
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                adapterSequence: "ACGTACGT",
                pending: false,
                reportAvailable: true,
              }),
            }),
          }),
        }),
      ),
    );
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "quality-report" } },
        1,
      ),
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          state: {
            query: expect.objectContaining({
              result: expect.objectContaining({
                adapterSequence: "ACGTACGT",
                adapter: expect.objectContaining({ records: 1 }),
                scope: expect.objectContaining({ analyzedReads: 2 }),
              }),
            }),
          },
        }),
      ),
    );
    view.rerender(
      viewer({ action: "save_session", name: "QA quality session" }, 2),
    );
    const savedSession = onCommandResult.mock.calls.at(-1)?.[1].state?.session;
    if (typeof savedSession !== "string")
      throw new Error("Expected a quality session.");
    expect(
      parseWorkbenchSession(savedSession).view.sequence?.interface?.quality,
    ).toEqual({
      adapterSequence: "ACGTACGT",
      view: {
        ...createSequenceInterfaceSettings().quality.view,
        methodsExpanded: true,
      },
    });
    view.rerender(
      viewer(
        {
          action: "run_analysis",
          jobId: "33333333-3333-4333-8333-333333333333",
          request: { analysis: "quality-report", adapterSequence: "TTTTTTTT" },
        },
        3,
      ),
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                adapterSequence: "TTTTTTTT",
                pending: false,
                reportAvailable: true,
              }),
            }),
          }),
        }),
      ),
    );
    const methods = screen
      .getByText("Adapter screen and methods")
      .closest("details");
    if (methods == null)
      throw new Error("Expected adapter methods disclosure.");
    expect(
      within(methods).getByText("TTTTTTTT", { selector: "code" }),
    ).toBeVisible();
    view.rerender(
      viewer(
        {
          action: "set_quality_view_options",
          methodsExpanded: false,
          distributionsExpanded: true,
          expandedTables: [],
        },
        4,
      ),
    );
    view.rerender(
      viewer({ action: "restore_session", session: savedSession }, 5),
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                adapterSequence: "ACGTACGT",
                pending: false,
                reportAvailable: true,
              }),
              qualityView: {
                ...createSequenceInterfaceSettings().quality.view,
                methodsExpanded: true,
              },
            }),
          }),
        }),
      ),
    );
    expect(
      within(methods).getByText("ACGTACGT", { selector: "code" }),
    ).toBeVisible();
    view.rerender(
      viewer(
        { action: "query_viewer", request: { target: "quality-report" } },
        6,
      ),
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "query_viewer" }),
      expect.objectContaining({
        state: {
          query: expect.objectContaining({
            result: expect.objectContaining({
              adapterSequence: "ACGTACGT",
              adapter: expect.objectContaining({ records: 1 }),
            }),
          }),
        },
      }),
    );
  });

  it("does not expose a completed quality report while replacing its source", async () => {
    const initial = parseSequenceDocument({
      contents: "@QA-old\nACGTACGT\n+\nIIIIIIII\n",
      fileName: "QA_old.fastq",
    });
    const replacement = parseSequenceDocument({
      contents: "@QA-new\nAAAA\n+\n5555\n",
      fileName: "QA_new.fastq",
    });
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const view = render(
      <SequenceRichViewer
        document={initial}
        onCommandResult={onCommandResult}
        updateModelContext={updateModelContext}
      />,
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            interface: expect.objectContaining({
              quality: expect.objectContaining({ reportAvailable: true }),
            }),
          }),
        }),
      ),
    );
    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "query_viewer", request: { target: "quality-report" } },
          1,
        )}
        document={replacement}
        onCommandResult={onCommandResult}
        updateModelContext={updateModelContext}
      />,
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        state: {
          query: expect.objectContaining({
            result: expect.objectContaining({ reportAvailable: false }),
          }),
        },
      }),
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            artifact: expect.objectContaining({ fileName: "QA_new.fastq" }),
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                pending: false,
                reportAvailable: true,
              }),
            }),
          }),
        }),
      ),
    );
    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "query_viewer", request: { target: "quality-report" } },
          2,
        )}
        document={replacement}
        onCommandResult={onCommandResult}
      />,
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        state: {
          query: expect.objectContaining({
            result: expect.objectContaining({
              scope: expect.objectContaining({
                analyzedBases: 4,
                analyzedReads: 1,
              }),
            }),
          }),
        },
      }),
    );
  });

  it("recomputes quality after a UI edit while the handled analysis command remains mounted", async () => {
    const document = parseSequenceDocument({
      contents: "@QA-edit\nACGTACGT\n+\nIIIIIIII\n",
      fileName: "QA_edit.fastq",
    });
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const command = sequenceCommand(
      {
        action: "run_analysis",
        jobId: "33333333-3333-4333-8333-333333333335",
        request: { analysis: "quality-report", adapterSequence: "ACGTACGT" },
      },
      1,
    );
    const view = render(
      <SequenceRichViewer
        command={command}
        document={document}
        onCommandResult={onCommandResult}
        updateModelContext={updateModelContext}
      />,
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                pending: false,
                reportAvailable: true,
              }),
            }),
          }),
        }),
      ),
    );
    const beforeJobId =
      updateModelContext.mock.calls.at(-1)?.[0].structuredContent.interface
        .quality.jobId;
    await userEvent.click(screen.getByLabelText("QA-edit position 1 A"));
    await userEvent.click(screen.getByRole("button", { name: "Edit copy" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete selection" }),
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            displayedRecord: expect.objectContaining({ length: 7 }),
            interface: expect.objectContaining({
              quality: expect.objectContaining({
                adapterSequence: "ACGTACGT",
                pending: false,
                reportAvailable: true,
                jobId: expect.not.stringMatching(beforeJobId),
              }),
            }),
          }),
        }),
      ),
    );
    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "query_viewer", request: { target: "quality-report" } },
          2,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    expect(onCommandResult).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        state: {
          query: expect.objectContaining({
            result: expect.objectContaining({
              adapter: expect.objectContaining({ records: 0 }),
              scope: expect.objectContaining({ analyzedBases: 7 }),
            }),
          }),
        },
      }),
    );
  });

  it("pushes text plus structured model context for the active record and explicit selection", async () => {
    const updateModelContext = vi.fn();
    const view = render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">demo\nACGTACGT\n",
          fileName: "demo.fasta",
        })}
        updateModelContext={updateModelContext}
      />,
    );
    const viewQueries = within(view.container);

    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({ viewer: "sequence" }),
          text: expect.stringContaining(
            "Current scientific viewer: Sequence viewer",
          ),
        }),
      );
    });

    const contextCallCount = updateModelContext.mock.calls.length;
    fireEvent.mouseEnter(viewQueries.getByLabelText("demo position 2 C"));
    await waitFor(() => {
      expect(updateModelContext).toHaveBeenCalledTimes(contextCallCount);
    });

    fireEvent.mouseDown(viewQueries.getByLabelText("demo position 2 C"));
    fireEvent.mouseUp(viewQueries.getByLabelText("demo position 2 C"));
    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            focus: expect.objectContaining({
              coordinate: 2,
              symbol: "C",
            }),
          }),
          text: expect.stringContaining("Focus: residue 2 C"),
        }),
      );
    });

    fireEvent.mouseDown(viewQueries.getByLabelText("demo position 2 C"));
    fireEvent.mouseEnter(viewQueries.getByLabelText("demo position 4 T"));
    fireEvent.mouseUp(viewQueries.getByLabelText("demo position 4 T"));

    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            selection: expect.objectContaining({
              end: 4,
              residues: [
                expect.objectContaining({ coordinate: 2, symbol: "C" }),
                expect.objectContaining({ coordinate: 3, symbol: "G" }),
                expect.objectContaining({ coordinate: 4, symbol: "T" }),
              ],
              sequence: "CGT",
              start: 2,
            }),
          }),
          text: expect.stringContaining("Selection: residues 2-4"),
        }),
      );
    });
    expect(updateModelContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("sequence CGT"),
      }),
    );

    await userEvent.click(viewQueries.getByText("Clear selection"));
    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            selection: null,
          }),
          text: expect.stringContaining("Selection: none"),
        }),
      );
    });
    expect(
      viewQueries.getByText(/Drag across the sequence/),
    ).toBeInTheDocument();
  });

  it("applies focus, range-selection, and motif-search commands from chat", async () => {
    const onCommandResult = vi.fn();
    const document = parseSequenceDocument({
      contents: ">query\nACGTACGT\n>target\nTTTACGTT\n",
      fileName: "queries.fasta",
    });
    const view = render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "focus_sequence_coordinate",
          coordinate: 4,
        })}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );

    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "focus_sequence_coordinate" }),
        expect.objectContaining({
          applied: true,
          state: { coordinate: 4, recordId: "query" },
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          {
            action: "select_sequence_range",
            end: 6,
            record: "target",
            start: 3,
          },
          2,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "select_sequence_range" }),
        expect.objectContaining({
          applied: true,
          state: { end: 6, recordId: "target", start: 3 },
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "search_sequence", query: "ACG", record: "target" },
          3,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Search sequence")).toHaveValue("ACG");
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "search_sequence" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            hitCount: 2,
            query: "ACG",
            recordId: "target",
          }),
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "navigate_sequence_search_hit", direction: "next" },
          4,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "navigate_sequence_search_hit" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ hitCount: 2, hitIndex: 2 }),
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          {
            action: "set_sequence_view_options",
            palette: "jalview-nucleotide",
            showFeatures: false,
            wrapWidth: 80,
          },
          5,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Residue palette")).toHaveValue(
        "jalview-nucleotide",
      );
      expect(screen.getByLabelText("Sequence wrap width")).toHaveValue("80");
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_sequence_view_options" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            showQuality: false,
            showTranslation: false,
          }),
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          { action: "set_sequence_record", record: "query" },
          6,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_sequence_record" }),
        expect.objectContaining({
          applied: true,
          state: { recordId: "query" },
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand({ action: "clear_sequence_selection" }, 7)}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "clear_sequence_selection" }),
        expect.objectContaining({ applied: true }),
      );
    });
  });

  it("keeps generated alignment bytes out of the completed live job result", async () => {
    const updateModelContext = vi.fn();
    const onOpenAlignment = vi.fn();
    const jobId = "22222222-2222-4222-8222-222222222222";
    render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "align_sequences",
          jobId,
          recordIds: ["a", "b"],
        })}
        document={parseSequenceDocument({
          contents: ">a\nACGT\n>b\nACTT\n",
          fileName: "pair.fasta",
        })}
        onOpenAlignment={onOpenAlignment}
        updateModelContext={updateModelContext}
      />,
    );

    await waitFor(() => expect(onOpenAlignment).toHaveBeenCalledOnce());
    await waitFor(() => {
      const completedJob = updateModelContext.mock.calls
        .map(
          ([context]) =>
            (
              context.structuredContent as {
                workbench?: {
                  jobs?: Array<{
                    id: string;
                    result?: { artifact?: Record<string, unknown> };
                    status: string;
                  }>;
                };
              }
            ).workbench?.jobs,
        )
        .flatMap((jobs) => jobs ?? [])
        .find(({ id, status }) => id === jobId && status === "completed");
      expect(completedJob?.result?.artifact).toBeDefined();
      expect(completedJob?.result?.artifact).not.toHaveProperty("content");
    });
  });

  it("rejects out-of-range coordinates and ambiguous record aliases", async () => {
    const onCommandResult = vi.fn();
    const document = parseSequenceDocument({
      contents: ">alpha shared\nACGT\n>beta shared\nTGCA\n",
      fileName: "strict-targets.fasta",
    });
    const view = render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "focus_sequence_coordinate",
          coordinate: 99,
          record: "alpha",
        })}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );

    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          message: expect.stringContaining("outside"),
          state: { maxCoordinate: 4, minCoordinate: 1 },
        }),
      );
    });

    view.rerender(
      <SequenceRichViewer
        command={sequenceCommand(
          {
            action: "select_sequence_range",
            end: 2,
            record: "shared",
            start: 1,
          },
          2,
        )}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          message: expect.stringContaining("More than one sequence record"),
          state: { candidateRecordIds: ["alpha", "beta"] },
        }),
      );
    });
  });

  it("selects an annotated feature from chat by its model-context ID", async () => {
    const onCommandResult = vi.fn();
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     gene            1..12
                     /gene="foo"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "demo.gb",
    });
    const feature = document.records[0]?.features[0];
    if (feature == null) {
      throw new Error("Expected the GenBank fixture to contain a feature.");
    }

    render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "select_sequence_feature",
          featureId: feature.id,
        })}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );

    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "select_sequence_feature" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ featureId: feature.id }),
        }),
      );
      expect(screen.getByText("Overlapping features")).toBeInTheDocument();
    });
  });

  it("selects a uniquely matched feature by biological type", async () => {
    const onCommandResult = vi.fn();
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             1..12
                     /gene="foo"
                     /translation="MKTW"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "demo.gb",
    });

    render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "select_sequence_feature",
          featureId: "cds",
        })}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );

    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "select_sequence_feature" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ type: "CDS" }),
        }),
      );
    });
  });

  it("returns bounded feature candidates when a biological selector is ambiguous", async () => {
    const onCommandResult = vi.fn();
    const document = parseSequenceDocument({
      contents: `LOCUS       DEMO       24 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             1..12
                     /gene="foo"
                     /translation="MKTW"
     CDS             13..24
                     /gene="bar"
                     /translation="MKTW"
ORIGIN
        1 atgaaaacgtggatgaaaacgtgg
//`,
      fileName: "demo.gb",
    });

    render(
      <SequenceRichViewer
        command={sequenceCommand({
          action: "select_sequence_feature",
          featureId: "CDS",
        })}
        document={document}
        onCommandResult={onCommandResult}
      />,
    );

    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "select_sequence_feature" }),
        expect.objectContaining({
          applied: false,
          state: expect.objectContaining({
            matchingFeatures: [
              expect.objectContaining({ id: "CDS-1" }),
              expect.objectContaining({ id: "CDS-2" }),
            ],
            matchingFeaturesTruncated: false,
          }),
        }),
      );
    });
  });

  it("renders GenBank feature tracks and FASTQ quality tracks", () => {
    const genBankDocument = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     gene            1..12
                     /gene="foo"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "demo.gb",
    });
    const { rerender } = render(
      <SequenceRichViewer document={genBankDocument} />,
    );
    expect(
      screen.getByLabelText("Select gene feature foo"),
    ).toBeInTheDocument();

    rerender(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: "@read1\nACGT\n+\nIIII\n",
          fileName: "reads.fastq",
        })}
      />,
    );
    expect(screen.getAllByText("FASTQ quality").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Base 1 quality 40")).toBeInTheDocument();
  });

  it("renders supported long FASTQ reads without overflowing argument limits", async () => {
    const length = 150_000;
    const document = parseSequenceDocument({
      contents: `@long-read\n${"A".repeat(length)}\n+\n${"I".repeat(length - 1)}!\n`,
      fileName: "long-reads.fastq",
    });

    render(
      <SequenceRichViewer
        document={document}
        sourceStateKeyOverride="authenticated-long-read"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Quality" }));
    expect(
      screen.getByText(/mean Q40\.0 · min Q0 · max Q40/),
    ).toBeInTheDocument();
    expect(summarizeQuality([])).toEqual({
      max: Number.NEGATIVE_INFINITY,
      mean: 0,
      min: Number.POSITIVE_INFINITY,
    });
    expect(summarizeQuality([1, Number.NaN, 2])).toEqual({
      max: Number.NaN,
      mean: Number.NaN,
      min: Number.NaN,
    });
    expect(
      summarizeQuality([Number.NEGATIVE_INFINITY, 1, Number.POSITIVE_INFINITY]),
    ).toEqual({
      max: Number.POSITIVE_INFINITY,
      mean: Number.NaN,
      min: Number.NEGATIVE_INFINITY,
    });
  });

  it("renders aggregate FASTQ QC with explicit Phred+33 provenance", async () => {
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: [
            "@read1",
            "ACGN",
            "+",
            "I5+!",
            "@read2",
            "GG",
            "+",
            "??",
          ].join("\n"),
          fileName: "reads.fastq",
        })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Quality" }));
    const panel = screen.getByText("FASTQ overview").closest("section");
    expect(panel).not.toBeNull();
    if (panel == null) {
      throw new Error("Expected the FASTQ overview panel.");
    }
    const summary = within(panel);
    expect(summary.getByText("Read length").parentElement).toHaveTextContent(
      "2-4 bp",
    );
    expect(summary.getByText("GC").parentElement).toHaveTextContent("66.7%");
    expect(
      summary.getByText("Q20", { selector: "dt" }).parentElement,
    ).toHaveTextContent("66.7%");
    expect(
      summary.getByText("Q30", { selector: "dt" }).parentElement,
    ).toHaveTextContent("50.0%");
    expect(summary.getByText(/Phred\+33 assumed/)).toBeInTheDocument();
  });

  it("renders grouped coordinates, aligned FASTQ quality, hover quality, and drag-pinned ranges", async () => {
    const view = render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: "@read1\nACGTACGTACGG\n+\nIIIIIIIIIIII\n",
          fileName: "reads.fastq",
        })}
      />,
    );
    const viewQueries = within(view.container);
    await userEvent.click(viewQueries.getByRole("button", { name: "Inspect" }));

    expect(viewQueries.getAllByText("1").length).toBeGreaterThan(0);
    expect(viewQueries.getAllByText("12").length).toBeGreaterThan(0);
    expect(
      view.container.querySelectorAll("[data-sequence-group]"),
    ).toHaveLength(2);
    expect(
      view.container.querySelectorAll("[data-quality-group]"),
    ).toHaveLength(2);

    const positionOne = viewQueries.getByLabelText("read1 position 1 A");
    fireEvent.mouseEnter(positionOne);
    expect(viewQueries.getByText(/1 · A · Q40/)).toBeInTheDocument();

    fireEvent.mouseDown(viewQueries.getByLabelText("read1 position 2 C"));
    fireEvent.mouseEnter(viewQueries.getByLabelText("read1 position 4 T"));
    fireEvent.mouseUp(viewQueries.getByLabelText("read1 position 4 T"));
    expect(viewQueries.getByText("2–4")).toBeInTheDocument();
    expect(viewQueries.getByText("CGT")).toBeInTheDocument();
    expect(viewQueries.getByText(/FASTQ quality Q40–Q40/)).toBeInTheDocument();
  });

  it.each([
    {
      location: "join(1..3,7..9)",
      segments: [
        { start: 1, end: 3 },
        { start: 7, end: 9 },
      ],
    },
    {
      location: "complement(join(1..3,7..9))",
      segments: [
        { start: 7, end: 9 },
        { start: 1, end: 3 },
      ],
    },
    {
      location: "join(OTHER:4..6,1..3,7..9)",
      segments: [
        { start: 1, end: 3 },
        { start: 7, end: 9 },
      ],
    },
  ])(
    "preserves local feature segments for map and agent selection: $location",
    async ({ location, segments }) => {
      const document = parseSequenceDocument({
        contents: `LOCUS       QA_FEATURE  12 bp    DNA     linear
DEFINITION  Synthetic feature selection geometry.
FEATURES             Location/Qualifiers
     gene            ${location}
                     /gene="QA feature"
ORIGIN
        1 acgtacgtacgt
//`,
        fileName: "QA_feature_geometry.gb",
      });
      const record = document.records[0];
      const feature = record?.features[0];
      if (record == null || feature == null)
        throw new Error("Expected feature fixture.");
      const onCommandResult = vi.fn();
      const updateModelContext = vi.fn();
      const view = render(
        <SequenceRichViewer
          document={document}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /^Select QA feature ·/ }),
      );
      await waitFor(() =>
        expect(updateModelContext).toHaveBeenLastCalledWith(
          expect.objectContaining({
            structuredContent: expect.objectContaining({
              selection: expect.objectContaining({
                length: 6,
                segments,
                wraparound: false,
              }),
            }),
          }),
        ),
      );
      view.rerender(
        <SequenceRichViewer
          command={sequenceCommand({
            action: "select_sequence_feature",
            featureId: feature.id,
          })}
          document={document}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />,
      );
      await waitFor(() =>
        expect(onCommandResult).toHaveBeenLastCalledWith(
          expect.objectContaining({ action: "select_sequence_feature" }),
          expect.objectContaining({
            applied: true,
            state: expect.objectContaining({
              recordId: record.id,
              featureId: feature.id,
              segments,
            }),
          }),
        ),
      );
    },
  );

  it("renders strand-aware CDS feature lanes and exact compound codon tracks", async () => {
    const reliableDocument = parseSequenceDocument({
      contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             complement(1..12)
                     /gene="foo"
                     /translation="MKPG"
ORIGIN
        1 atgaaaacgtgg
//`,
      fileName: "demo.gb",
    });
    const view = render(<SequenceRichViewer document={reliableDocument} />);
    await userEvent.click(screen.getByRole("button", { name: "Inspect" }));
    const featureButton = screen.getByLabelText("Select CDS feature foo");
    expect(featureButton).toHaveAttribute("data-feature-strand", "-");
    expect(screen.getByText("AA")).toBeInTheDocument();
    await userEvent.click(featureButton);
    expect(screen.getByText(/aa 1–4/)).toBeInTheDocument();

    view.rerender(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: `LOCUS       DEMO       12 bp    DNA     linear
DEFINITION  demo sequence.
ACCESSION   DEMO1
FEATURES             Location/Qualifiers
     CDS             join(1..3,7..9)
                     /gene="joined"
                     /translation="MK"
ORIGIN
        1 atgaaaacgtgg
//`,
          fileName: "joined.gb",
        })}
      />,
    );
    expect(screen.getByText("AA")).toBeInTheDocument();
    await userEvent.click(
      screen.getByLabelText("Select CDS feature joined segment 1-3"),
    );
    expect(screen.getByText(/aa 1–1/)).toBeInTheDocument();
    expect(screen.getByText(/aa 2–2/)).toBeInTheDocument();
  });

  it("makes multi-record sequence mode explicit and keeps the record browser available", async () => {
    const view = render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">short first\nACGT\n>long second\nACGTACGT\n",
          fileName: "collection.fasta",
        })}
      />,
    );
    const viewQueries = within(view.container);

    expect(viewQueries.getByText("Showing record 1 of 2")).toBeInTheDocument();
    expect(
      viewQueries.getByText(/starts on the first parsed record from the file/),
    ).toBeInTheDocument();
    await userEvent.clear(viewQueries.getByLabelText("Select sequence record"));
    await userEvent.type(
      viewQueries.getByLabelText("Select sequence record"),
      "2",
    );
    await userEvent.tab();
    expect(viewQueries.getByText("Showing record 2 of 2")).toBeInTheDocument();
    expect(viewQueries.getByLabelText("long position 1 A")).toBeInTheDocument();

    await userEvent.click(viewQueries.getByText("Browse all records"));
    await userEvent.selectOptions(
      viewQueries.getByLabelText("Sort records"),
      "length",
    );
    const rows = viewQueries.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("long");
    await userEvent.type(
      viewQueries.getByLabelText("Filter records"),
      "second",
    );
    const recordTable = within(viewQueries.getByRole("table"));
    expect(recordTable.queryByText("short")).not.toBeInTheDocument();
    await userEvent.click(recordTable.getByText("long"));
    expect(viewQueries.getByLabelText("long position 1 A")).toBeInTheDocument();
  });

  it("shows modality-specific canonical palette options and legends", async () => {
    const view = render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">dna\nACGTRYN\n",
          fileName: "dna.fasta",
        })}
      />,
    );
    const viewQueries = within(view.container);

    await userEvent.click(viewQueries.getByRole("button", { name: "Display" }));
    expect(viewQueries.getByLabelText("Residue palette")).toHaveValue(
      "muted-nucleic-acid",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "Soft nucleotide",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "Monochrome",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "NCBI nucleic acid",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "Jalview nucleotide",
    );
    await userEvent.selectOptions(
      viewQueries.getByLabelText("Residue palette"),
      "nucleotide-ambiguity",
    );
    expect(
      viewQueries.getByLabelText("Nucleotide ambiguity palette legend"),
    ).toBeInTheDocument();
    expect(viewQueries.getByText("R = A/G")).toBeInTheDocument();

    view.rerender(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">protein\nMKWVTFISLLFLFSSAYS\n",
          fileName: "protein.faa",
        })}
      />,
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "RasMol",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "ClustalX",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "Hydrophobicity",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveValue(
      "muted-amino-acid",
    );
    expect(viewQueries.getByLabelText("Residue palette")).not.toHaveTextContent(
      "Soft nucleotide",
    );
    expect(viewQueries.getByLabelText("Residue palette")).toHaveTextContent(
      "Monochrome",
    );
    expect(
      viewQueries.getByLabelText("Soft amino acid palette legend"),
    ).toBeVisible();
  });

  it.each([
    { molecule: "dna", sequence: "ACGTACGT" },
    { molecule: "rna", sequence: "ACGUACGU" },
    { molecule: "nucleic-acid-ambiguous", sequence: "ACGNACGN" },
    { molecule: "protein", sequence: "MKWVTFISLLFLFSSAYS" },
  ])(
    "shares $molecule palette choices between UI and agent commands",
    async ({ molecule, sequence }) => {
      const defaultPaletteId =
        molecule === "protein" ? "muted-amino-acid" : "muted-nucleic-acid";
      const defaultPaletteLabel =
        molecule === "protein" ? "Soft amino acid" : "Soft nucleotide";
      const scientificPalettes =
        molecule === "protein"
          ? ["rasmol", "clustal-x"]
          : ["ncbi-nucleic-acid", "jalview-nucleotide"];
      const document = parseSequenceDocument({
        contents: `>palette\n${sequence}\n`,
        fileName: "QA_palette.fasta",
      });
      expect(document.records[0]?.molecule).toBe(molecule);
      const onCommandResult = vi.fn();
      const viewer = (command: SequenceViewerCommand, revision: number) => (
        <SequenceRichViewer
          command={sequenceCommand(command, revision)}
          document={document}
          onCommandResult={onCommandResult}
        />
      );
      const queryCommand = {
        action: "query_viewer",
        request: { target: "sequence-ui-state" },
      } as const;
      const view = render(viewer(queryCommand, 1));

      expect(
        onCommandResult.mock.calls.at(-1)?.[1].state?.query?.result.palette,
      ).toMatchObject({
        id: defaultPaletteId,
        label: defaultPaletteLabel,
        defaultId: defaultPaletteId,
        restorationWarning: null,
        options: expect.arrayContaining([
          expect.objectContaining({
            id: defaultPaletteId,
            label: defaultPaletteLabel,
          }),
          expect.objectContaining({ id: "neutral", label: "Monochrome" }),
          ...scientificPalettes.map((id) => expect.objectContaining({ id })),
        ]),
      });
      await userEvent.click(screen.getByRole("button", { name: "Display" }));
      const palette = screen.getByRole("combobox", { name: "Residue palette" });
      await userEvent.selectOptions(palette, "neutral");
      view.rerender(viewer(queryCommand, 2));
      expect(
        onCommandResult.mock.calls.at(-1)?.[1].state?.query?.result.palette,
      ).toMatchObject({
        id: "neutral",
        label: "Monochrome",
      });

      for (const [index, paletteId] of (
        [defaultPaletteId, "neutral"] as const
      ).entries()) {
        view.rerender(
          viewer(
            {
              action: "set_sequence_view_options",
              palette: paletteId,
            },
            index + 3,
          ),
        );
        expect(palette).toHaveValue(paletteId);
        expect(onCommandResult).toHaveBeenLastCalledWith(
          expect.objectContaining({ action: "set_sequence_view_options" }),
          expect.objectContaining({
            applied: true,
            state: expect.objectContaining({ palette: paletteId }),
          }),
        );
      }
      expect(screen.getByLabelText("Monochrome palette legend")).toBeVisible();
      view.rerender(
        viewer(
          {
            action: "set_sequence_view_options",
            palette:
              molecule === "protein"
                ? "muted-nucleic-acid"
                : "muted-amino-acid",
          },
          5,
        ),
      );
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_sequence_view_options" }),
        expect.objectContaining({ applied: false }),
      );
      expect(palette).toHaveValue("neutral");
    },
  );

  it.each(
    [
      {
        molecule: "dna",
        sequence: "ACGTACGT",
        palettes: [
          { saved: "ncbi-nucleic-acid", expected: "ncbi-nucleic-acid" },
          { saved: "jalview-nucleotide", expected: "jalview-nucleotide" },
          { saved: "muted-nucleic-acid", expected: "muted-nucleic-acid" },
          { saved: "neutral", expected: "neutral" },
          { saved: "retired-palette", expected: "muted-nucleic-acid" },
          { saved: "rasmol", expected: "muted-nucleic-acid" },
        ],
      },
      {
        molecule: "rna",
        sequence: "ACGUACGU",
        palettes: [
          { saved: "jalview-nucleotide", expected: "jalview-nucleotide" },
          { saved: "neutral", expected: "neutral" },
          { saved: "retired-palette", expected: "muted-nucleic-acid" },
        ],
      },
      {
        molecule: "protein",
        sequence: "MKWVTFISLLFLFSSAYS",
        palettes: [
          { saved: "rasmol", expected: "rasmol" },
          { saved: "clustal-x", expected: "clustal-x" },
          { saved: "zappo", expected: "zappo" },
          { saved: "hydrophobicity", expected: "hydrophobicity" },
          { saved: "muted-amino-acid", expected: "muted-amino-acid" },
          { saved: "neutral", expected: "neutral" },
          { saved: "retired-palette", expected: "muted-amino-acid" },
          { saved: "ncbi-nucleic-acid", expected: "muted-amino-acid" },
        ],
      },
    ].flatMap(({ molecule, sequence, palettes }) =>
      palettes.map((palette) => ({ molecule, sequence, ...palette })),
    ),
  )(
    "restores saved $molecule palette $saved through the agent across active-record changes",
    async ({ molecule, sequence, saved, expected }) => {
      const initialSequence =
        molecule === "protein" ? "ACGTACGT" : "MKWVTFISLLFLFSSAYS";
      const document = parseSequenceDocument({
        contents: `>initial\n${initialSequence}\n>restored\n${sequence}\n`,
        fileName: "QA_palette_restore.fasta",
      });
      const onCommandResult = vi.fn();
      const viewer = (command: SequenceViewerCommand, revision: number) => (
        <SequenceRichViewer
          command={sequenceCommand(command, revision)}
          document={document}
          onCommandResult={onCommandResult}
        />
      );
      const view = render(
        viewer({ action: "set_sequence_record", record: "restored" }, 1),
      );
      view.rerender(
        viewer({ action: "save_session", name: "QA palette session" }, 2),
      );
      const session = parseWorkbenchSession(
        onCommandResult.mock.calls.at(-1)?.[1].state?.session,
      );
      if (session.view.sequence == null)
        throw new Error("Expected a Sequence session.");
      session.view.sequence.paletteId = saved;
      view.rerender(
        viewer({ action: "set_sequence_record", record: "initial" }, 3),
      );
      expect(screen.getByLabelText("Residue palette")).toHaveValue(
        molecule === "protein" ? "muted-nucleic-acid" : "muted-amino-acid",
      );

      view.rerender(
        viewer(
          { action: "restore_session", session: JSON.stringify(session) },
          4,
        ),
      );
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "restore_session" }),
        expect.objectContaining({ applied: true }),
      );
      expect(screen.getByLabelText("Residue palette")).toHaveValue(expected);
      expect(
        screen.getByLabelText(`restored position 1 ${sequence[0]}`),
      ).toBeInTheDocument();
      view.rerender(
        viewer(
          { action: "query_viewer", request: { target: "sequence-ui-state" } },
          5,
        ),
      );
      expect(
        onCommandResult.mock.calls.at(-1)?.[1].state?.query?.result.palette,
      ).toMatchObject({
        id: expected,
        restorationWarning:
          saved === expected
            ? null
            : expect.stringContaining(`Saved palette "${saved}"`),
      });
      if (saved !== expected) {
        expect(
          screen.getByText(
            `Saved palette "${saved}" is unavailable for ${molecule} sequences; using ${molecule === "protein" ? "Soft amino acid" : "Soft nucleotide"} instead.`,
          ),
        ).toBeVisible();
      }

      // Copy edits rematerialize the selected record; they must not reset its display choice.
      view.rerender(
        viewer(
          {
            action: "edit_copy",
            request: { operation: "delete-sequence-range", start: 1, end: 1 },
          },
          6,
        ),
      );
      expect(
        screen.getByLabelText(`restored position 1 ${sequence[1]}`),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Residue palette")).toHaveValue(expected);
      view.rerender(
        viewer({ action: "save_session", name: "QA restored palette" }, 7),
      );
      const resaved = parseWorkbenchSession(
        onCommandResult.mock.calls.at(-1)?.[1].state?.session,
      );
      expect(resaved.schemaVersion).toBe(1);
      expect(resaved.view.sequence).toMatchObject({
        paletteId: expected,
        selectedRecordId: "restored",
      });
    },
  );

  it.each([
    {
      sequence: "ACGTACGT",
      saved: "ncbi-nucleic-acid",
      expected: "ncbi-nucleic-acid",
    },
    {
      sequence: "ACGTACGT",
      saved: "retired-palette",
      expected: "muted-nucleic-acid",
    },
    {
      sequence: "ACGUACGU",
      saved: "jalview-nucleotide",
      expected: "jalview-nucleotide",
    },
    { sequence: "MKWVTFISLLFLFSSAYS", saved: "rasmol", expected: "rasmol" },
  ])(
    "restores $saved from a session file using the same compatible palette rules",
    async ({ sequence, saved, expected }) => {
      const document = parseSequenceDocument({
        contents: `>initial\nACGTACGT\n>restored\n${sequence}\n`,
        fileName: "QA_palette_file_restore.fasta",
      });
      const onCommandResult = vi.fn();
      const viewer = (command: SequenceViewerCommand, revision: number) => (
        <SequenceRichViewer
          command={sequenceCommand(command, revision)}
          document={document}
          onCommandResult={onCommandResult}
        />
      );
      const view = render(
        viewer({ action: "set_sequence_record", record: "restored" }, 1),
      );
      view.rerender(
        viewer({ action: "save_session", name: "QA palette file" }, 2),
      );
      const session = parseWorkbenchSession(
        onCommandResult.mock.calls.at(-1)?.[1].state?.session,
      );
      if (session.view.sequence == null)
        throw new Error("Expected a Sequence session.");
      session.view.sequence.paletteId = saved;
      view.rerender(
        viewer({ action: "set_sequence_record", record: "initial" }, 3),
      );
      await userEvent.click(screen.getByRole("button", { name: "Export" }));
      const content = JSON.stringify(session);
      const file = new File([content], "QA_palette_session.json", {
        type: "application/json",
      });
      Object.defineProperty(file, "text", { value: async () => content });
      await userEvent.upload(screen.getByLabelText("Restore session"), file);

      await waitFor(() =>
        expect(screen.getByLabelText("Residue palette")).toHaveValue(expected),
      );
      expect(
        screen.getByLabelText(`restored position 1 ${sequence[0]}`),
      ).toBeInTheDocument();
      view.rerender(
        viewer(
          { action: "query_viewer", request: { target: "sequence-ui-state" } },
          4,
        ),
      );
      expect(
        onCommandResult.mock.calls.at(-1)?.[1].state?.query?.result.palette,
      ).toMatchObject({
        id: expected,
        restorationWarning:
          saved === expected
            ? null
            : expect.stringContaining(`Saved palette "${saved}"`),
      });
    },
  );

  it("keeps long wrapped sequence rendering bounded to visible lines", () => {
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: `>long\n${"ACGT".repeat(2_500)}\n`,
          fileName: "long.fasta",
        })}
      />,
    );

    expect(
      screen.getAllByRole("gridcell", { name: /long position/i }).length,
    ).toBeLessThan(1_000);
  });

  it("uses one roving grid tab stop with arrow-key residue navigation", async () => {
    render(
      <SequenceRichViewer
        document={parseSequenceDocument({
          contents: ">keyboard\nACGT\n",
          fileName: "keyboard.fasta",
        })}
      />,
    );
    const cells = screen.getAllByRole("gridcell", {
      name: /keyboard position/i,
    });
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    cells[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByLabelText("keyboard position 2 C")).toHaveFocus();
  });
});

function sequenceCommand(
  command: SequenceViewerCommand,
  revision = 1,
): QueuedSequenceViewerCommand {
  return {
    ...command,
    commandId: `11111111-1111-4111-8111-${revision.toString().padStart(12, "0")}`,
    revision,
  } as QueuedSequenceViewerCommand;
}
