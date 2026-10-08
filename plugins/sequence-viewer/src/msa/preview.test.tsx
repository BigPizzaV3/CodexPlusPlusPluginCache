import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { IntlProvider } from "react-intl"; // oxlint-disable-line no-restricted-imports
import { describe, expect, it, vi } from "vitest";

import { MsaPreview } from "./msa-rich-viewer";
import * as artifactStateKey from "../artifact-state-key";
import { getSequenceResidueStyle } from "../sequence/sequence-palette";
import { WorkbenchToolController } from "../ui/workbench-tool-controller";
import { WorkbenchToolControllerContext } from "../ui/workbench-tools";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";

function renderPreview(
  contents: string,
  filePath = "/tmp/alignment.afa",
): ReturnType<typeof render> {
  return renderWithMsaProviders(
    <MsaPreview className="h-full" contents={contents} filePath={filePath} />,
  );
}

function renderWithMsaProviders(ui: ReactElement): ReturnType<typeof render> {
  return render(ui, {
    wrapper: ({ children }): ReactElement => (
      <IntlProvider locale="en">{children}</IntlProvider>
    ),
  });
}

async function waitForViewer(): Promise<HTMLElement> {
  return screen.findByLabelText(
    "Interactive multiple sequence alignment viewer",
  );
}

function generateAlignment(rowCount: number, columnCount: number): string {
  const sequence = "ACGT"
    .repeat(Math.ceil(columnCount / 4))
    .slice(0, columnCount);
  return Array.from({ length: rowCount }, (_, index) =>
    [`>seq-${index + 1}`, sequence].join("\n"),
  ).join("\n");
}

describe("MsaPreview", () => {
  it("controls metric tracks, help, row order, and row selection without opening an inspector", async () => {
    const contents = [">alpha", "ACGT", ">beta", "ACGA"].join("\n");
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const view = renderWithMsaProviders(
      <MsaPreview
        command={alignmentCommand({
          action: "set_alignment_view_options",
          enabledMetricTracks: ["identity", "sequence-logo"],
          rowSortDirection: "desc",
          rowSortKey: "label",
          showSequenceLogoHelp: true,
        })}
        contents={contents}
        onCommandResult={onCommandResult}
        updateModelContext={updateModelContext}
      />,
    );
    await waitForViewer();
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            enabledMetricTracks: ["identity", "sequence-logo"],
            rowSortDirection: "desc",
            rowSortKey: "label",
            rowSortScope: "row-manager",
            showSequenceLogoHelp: true,
          }),
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Rows" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByLabelText(/Sequence logo \(mix/)).toBeChecked();
    expect(
      screen.getByText("What does Sequence logo show?").closest("details"),
    ).toHaveAttribute("open");
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            display: expect.objectContaining({
              enabledMetricTracks: ["identity", "sequence-logo"],
              rowSortDirection: "desc",
              rowSortKey: "label",
              showSequenceLogoHelp: true,
            }),
          }),
        }),
      ),
    );

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "select_alignment_rows", rows: ["alpha"] },
          2,
        )}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: true,
          state: { selectedRowCount: 1, selectedRowIds: ["alpha"] },
        }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Rows" }));
    expect(screen.getByLabelText("Select row alpha")).toBeChecked();
    const rows = screen.getByLabelText("MSA row visibility controls");
    expect(
      within(rows).getAllByRole("checkbox", { name: /Select row/ })[0],
    ).toHaveAccessibleName("Select row beta");
  });

  it("rejects unavailable metric tracks and ambiguous row selections without partial changes", async () => {
    const contents = [">dup", "ACGT", ">dup", "ACGA"].join("\n");
    const onCommandResult = vi.fn();
    const view = renderWithMsaProviders(
      <MsaPreview
        command={alignmentCommand({
          action: "set_alignment_view_options",
          colorMode: "residue",
          enabledMetricTracks: ["rna-structure"],
        })}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitForViewer();
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          state: expect.objectContaining({
            unavailableMetricTracks: ["rna-structure"],
          }),
        }),
      ),
    );
    expect(screen.getByLabelText("MSA color mode")).toHaveValue("difference");

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "select_alignment_rows", rows: ["dup"] },
          2,
        )}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          state: { candidateRowIds: ["dup__1", "dup__2"] },
        }),
      ),
    );
    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "select_alignment_rows", rows: ["dup__2"] },
          3,
        )}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: true,
          state: { selectedRowCount: 1, selectedRowIds: ["dup__2"] },
        }),
      ),
    );
    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "select_alignment_rows", rows: ["dup__1", "missing"] },
          4,
        )}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          state: { missingRows: ["missing"] },
        }),
      ),
    );
    expect(
      screen
        .getAllByLabelText(/^Select row/)
        .map((input) => (input as HTMLInputElement).checked),
    ).toEqual([false, true]);
    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "select_alignment_rows", rows: [] },
          5,
        )}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: true,
          state: { selectedRowCount: 0, selectedRowIds: [] },
        }),
      ),
    );
  });

  it.each(["ncbi-nucleic-acid", "muted-nucleic-acid", "neutral"] as const)(
    "round-trips %s and display options in saved alignment sessions",
    async (residuePalette) => {
      const contents = [">alpha", "ACGT", ">beta", "ACGA"].join("\n");
      let savedSession: string | undefined;
      const onCommandResult = vi.fn(
        (
          _: QueuedSequenceViewerCommand,
          result: SequenceViewerCommandResult,
        ) => {
          if (typeof result.state?.session === "string")
            savedSession = result.state.session;
        },
      );
      const view = renderWithMsaProviders(
        <MsaPreview
          command={alignmentCommand({
            action: "set_alignment_view_options",
            colorMode: "residue",
            residuePalette,
            enabledMetricTracks: ["sequence-logo"],
            rowSortDirection: "desc",
            rowSortKey: "length",
            showSequenceLogoHelp: true,
          })}
          contents={contents}
          onCommandResult={onCommandResult}
        />,
      );
      await waitForViewer();
      await waitFor(() => expect(onCommandResult).toHaveBeenCalled());
      view.rerender(
        <MsaPreview
          command={alignmentCommand(
            { action: "save_session", name: "alignment-session" },
            2,
          )}
          contents={contents}
          onCommandResult={onCommandResult}
        />,
      );
      await waitFor(() => expect(savedSession).toBeDefined());
      if (savedSession == null)
        throw new Error("Expected a serialized alignment session.");
      view.rerender(
        <MsaPreview
          command={alignmentCommand({ action: "reset_alignment_view" }, 3)}
          contents={contents}
          onCommandResult={onCommandResult}
        />,
      );
      await waitFor(() =>
        expect(screen.getByLabelText(/Sequence logo \(mix/)).not.toBeChecked(),
      );
      view.rerender(
        <MsaPreview
          command={alignmentCommand(
            { action: "restore_session", session: savedSession },
            4,
          )}
          contents={contents}
          onCommandResult={onCommandResult}
        />,
      );
      await waitFor(() =>
        expect(onCommandResult).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            applied: true,
            message: "Restored the saved Alignment workbench session.",
          }),
        ),
      );
      expect(screen.getByLabelText(/Sequence logo \(mix/)).toBeChecked();
      expect(screen.getByLabelText("Sort rows by")).toHaveValue("length");
      expect(screen.getByLabelText("MSA residue palette")).toHaveValue(
        residuePalette,
      );
      expect(screen.getByText("Descending sort")).toBeInTheDocument();
      expect(
        screen.getByText("What does Sequence logo show?").closest("details"),
      ).toHaveAttribute("open");
    },
  );

  it("keeps the matrix primary and makes one mounted tool panel visible at a time", async () => {
    const user = userEvent.setup();
    renderPreview([">alpha", "ACGT", ">beta", "ACGA"].join("\n"));
    await waitForViewer();

    const colorMode = screen.getByLabelText("MSA color mode");
    const rowVisibility = screen.getByLabelText("Show row alpha");
    expect(screen.getByLabelText("Search MSA motif")).toBeVisible();
    expect(screen.getByLabelText("Filter MSA rows")).toBeVisible();
    expect(colorMode).not.toBeVisible();
    expect(rowVisibility).not.toBeVisible();
    expect(colorMode.closest("[inert]")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Display" }));
    expect(colorMode).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Rows" }));
    expect(colorMode).not.toBeVisible();
    expect(rowVisibility).toBeVisible();
    expect(
      screen.getByLabelText("MSA row visibility controls"),
    ).not.toHaveClass("hidden");

    await user.click(screen.getByRole("button", { name: "Display" }));
    expect(screen.getByLabelText("MSA color mode")).toBe(colorMode);
    expect(rowVisibility).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Display" }));
    expect(colorMode).not.toBeVisible();
    expect(
      screen.getByLabelText("Scrollable multiple sequence alignment matrix"),
    ).toBeVisible();
  });

  it("preserves the same search, filter, and edit inputs through tool switching and toolbar reveal", async () => {
    const user = userEvent.setup();
    const contents = [">alpha", "ACGT", ">beta", "ACGA"].join("\n");
    const view = renderWithMsaProviders(<MsaPreview contents={contents} />);
    await waitForViewer();
    const search = screen.getByLabelText("Search MSA motif");
    const filter = screen.getByLabelText("Filter MSA rows");
    await user.type(filter, "alpha");
    await user.type(search, "AC");
    await user.click(screen.getByRole("button", { name: "Edit copy" }));
    const groupName = screen.getByLabelText("Alignment row group name");
    await user.type(groupName, "Kinases");
    await user.click(screen.getByRole("button", { name: "Display" }));

    view.rerender(<MsaPreview contents={contents} toolbarVisible={false} />);
    expect(screen.getByLabelText("Search MSA motif")).toBe(search);
    expect(screen.getByLabelText("Filter MSA rows")).toBe(filter);
    expect(search).toHaveValue("AC");
    expect(filter).toHaveValue("alpha");
    expect(search).not.toBeVisible();
    expect(search.closest("[inert]")).not.toBeNull();
    expect(
      screen.getByLabelText("Scrollable multiple sequence alignment matrix"),
    ).toBeVisible();

    view.rerender(
      <MsaPreview contents={contents} toolbarRevealed toolbarVisible={false} />,
    );
    expect(search).toBeVisible();
    expect(filter).toBeVisible();
    expect(screen.getByLabelText("MSA color mode")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit copy" }));
    expect(screen.getByLabelText("Alignment row group name")).toBe(groupName);
    expect(groupName).toHaveValue("Kinases");
  });

  it("uses row-manager selection for reversible alignment edits", async () => {
    const user = userEvent.setup();
    renderPreview([">alpha", "ACGT", ">beta", "ACGA"].join("\n"));
    await waitForViewer();

    await user.click(screen.getByRole("button", { name: "Rows" }));
    await user.click(screen.getByLabelText("Select row alpha"));
    await user.click(screen.getByRole("button", { name: "Edit copy" }));
    await user.click(
      screen.getByRole("button", { name: "Remove selected rows" }),
    );
    expect(screen.queryByLabelText(/alpha column 1 A/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/beta column 1 A/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText(/alpha column 1 A/)).toBeVisible();
  });

  it.each(["button", "agent"] as const)(
    "keeps manual-copy feedback visible until the %s explicitly dismisses it",
    async (source) => {
      const user = userEvent.setup();
      const controller = new WorkbenchToolController();
      const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockRejectedValue(new Error("Clipboard access denied"));
      try {
        renderWithMsaProviders(
          <WorkbenchToolControllerContext.Provider value={controller}>
            <MsaPreview
              contents={[">alpha", "ACGT", ">beta", "ACGA"].join("\n")}
            />
          </WorkbenchToolControllerContext.Provider>,
        );
        await waitForViewer();
        await user.click(screen.getByRole("button", { name: "Export" }));
        await user.click(
          screen.getByRole("button", { name: "Copy visible rows FASTA" }),
        );
        const manualCopy = await screen.findByRole("textbox", {
          name: "Alignment text to copy manually",
        });
        expect(manualCopy).toHaveValue(">alpha\nACGT\n>beta\nACGA");
        expect(controller.getFeedbackSnapshots("alignment")).toContainEqual(
          expect.objectContaining({
            id: "alignment.copy-feedback",
            kind: "copy",
            visible: true,
          }),
        );

        await user.click(screen.getByRole("button", { name: "Rows" }));
        expect(manualCopy).toBeVisible();
        expect(
          screen.getByText(
            "Finish or dismiss the action in the open tool before switching tools.",
          ),
        ).toBeVisible();
        if (source === "button") {
          await user.click(
            screen.getByRole("button", { name: "Dismiss copy feedback" }),
          );
        } else {
          act(() => {
            expect(
              controller.dismissFeedback("alignment.copy-feedback"),
            ).toMatchObject({ applied: true });
          });
        }
        await user.click(screen.getByRole("button", { name: "Rows" }));
        expect(screen.getByLabelText("Show row alpha")).toBeVisible();
        expect(
          screen.queryByLabelText("Alignment text to copy manually"),
        ).not.toBeInTheDocument();
      } finally {
        writeText.mockRestore();
      }
    },
  );

  it("opens registered alignment disclosures through the same mounted inspector controls", async () => {
    const controller = new WorkbenchToolController();
    renderWithMsaProviders(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <MsaPreview
          contents={[
            "# STOCKHOLM 1.0",
            "#=GF ID alignment-family",
            "alpha ACGU",
            "beta A-GU",
            "//",
          ].join("\n")}
          filePath="/tmp/alignment.sto"
        />
      </WorkbenchToolControllerContext.Provider>,
    );
    await waitForViewer();
    act(() => {
      expect(
        controller.setDisclosure("alignment.metadata", true),
      ).toMatchObject({ applied: true });
    });
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const metadata = screen.getByText("Parsed alignment metadata");
    expect(metadata).toBeVisible();
    expect(metadata.closest("details")).toHaveAttribute("open");
    act(() => {
      expect(
        controller.setDisclosure("alignment.guide-tree", true),
      ).toMatchObject({ applied: true });
    });
    expect(screen.getByRole("button", { name: "Analyze" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Compute guide tree" }),
    ).toBeVisible();
    expect(metadata).not.toBeVisible();
  });

  it("skips alignment hashing for an authenticated source key and preserves the fallback", async () => {
    const createArtifactStateKey = vi.spyOn(
      artifactStateKey,
      "createArtifactStateKey",
    );
    const contents = [">a", "ACGT", ">b", "ACGA"].join("\n");

    try {
      const view = renderWithMsaProviders(
        <MsaPreview
          contents={contents}
          filePath="/tmp/trusted.afa"
          sourceStateKeyOverride="authenticated-alignment-revision"
        />,
      );
      await waitForViewer();

      expect(createArtifactStateKey).not.toHaveBeenCalled();

      view.rerender(
        <IntlProvider locale="en">
          <MsaPreview contents={contents} filePath="/tmp/trusted.afa" />
        </IntlProvider>,
      );

      expect(createArtifactStateKey).toHaveBeenCalledWith(
        contents,
        "/tmp/trusted.afa",
      );
    } finally {
      createArtifactStateKey.mockRestore();
    }
  });

  it("shows an honest parsing shell before the viewer becomes usable", async () => {
    renderPreview([">a", "AA", ">b", "AG"].join("\n"));

    expect(screen.getByText("Parsing alignment…")).toBeInTheDocument();
    expect(await waitForViewer()).toBeInTheDocument();
  });

  it("renders a biology-aware rich DNA viewer and search navigation", async () => {
    const user = userEvent.setup();
    renderPreview([">a", "AAGT", ">b", "ACGT"].join("\n"));

    expect(await waitForViewer()).toBeInTheDocument();
    expect(screen.getAllByText("DNA").length).toBeGreaterThan(0);
    expect(screen.getByText("2 sequences")).toBeInTheDocument();
    expect(screen.getByLabelText("Annotations unavailable")).toBeDisabled();

    await user.type(screen.getByLabelText("Search MSA motif"), "ACT");
    expect(
      await screen.findByText(/Motif search results · 1 hits/),
    ).toBeInTheDocument();
    expect(screen.getByText(/ungapped 2-4/)).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/reverse-complement/)).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByText("Next"));
    expect(
      await screen.findByText(/Match a:2-4 \(reverse-complement\)/),
    ).toBeInTheDocument();
  });

  it("shows analytical tracks, coordinate jump controls, export actions, and a pinned inspector", async () => {
    renderPreview([">a", "AAGT", ">b", "ACGT"].join("\n"));

    await waitForViewer();
    await userEvent.click(screen.getByRole("button", { name: "Display" }));
    expect(screen.getByText("Tracks")).toBeInTheDocument();
    expect(screen.getAllByText("Identity histogram").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Sequence logo (mix + information)"),
    ).toBeInTheDocument();
    expect(screen.getByText("optional")).toBeInTheDocument();
    expect(
      screen.queryByText("What does Sequence logo show?"),
    ).not.toBeInTheDocument();
    const logoLabel = screen
      .getByText("Sequence logo (mix + information)")
      .closest("label");
    if (logoLabel == null) {
      throw new Error("Expected the sequence-logo toggle label to render.");
    }
    const logoToggle = logoLabel.querySelector("input");
    if (!(logoToggle instanceof HTMLInputElement)) {
      throw new Error("Expected the sequence-logo toggle input to render.");
    }
    fireEvent.click(logoToggle);
    expect(
      screen.getByText("What does Sequence logo show?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("What does Sequence logo show?"));
    expect(
      screen.getByText(
        "Tall single-letter stacks indicate a highly informative column; mixed letters indicate compositional variation.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Alignment cols")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Jump to MSA alignment column"),
    ).toBeInTheDocument();
    expect(screen.getByText("Copy / export")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/a column 1 A/));
    expect(screen.getByText("Pinned cell inspector")).toBeInTheDocument();
    expect(screen.getByText("Alignment column")).toBeInTheDocument();
  });

  it("rejects out-of-range alignment coordinates and ambiguous row aliases", async () => {
    const onCommandResult = vi.fn();
    const contents = [">dup", "ACGT", ">dup", "ACGA"].join("\n");
    const view = renderWithMsaProviders(
      <MsaPreview
        command={alignmentCommand({
          action: "focus_alignment_cell",
          column: 99,
          row: "dup__1",
        })}
        contents={contents}
        onCommandResult={onCommandResult}
      />,
    );
    await waitForViewer();
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          message: expect.stringContaining("outside"),
          state: { maxColumn: 4, minColumn: 1 },
        }),
      );
    });

    view.rerender(
      <IntlProvider locale="en">
        <MsaPreview
          command={alignmentCommand(
            { action: "focus_alignment_cell", column: 2, row: "dup" },
            2,
          )}
          contents={contents}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          applied: false,
          message: expect.stringContaining(
            "More than one visible alignment row",
          ),
          state: { candidateRowIds: ["dup__1", "dup__2"] },
        }),
      );
    });
  });

  it("pushes text plus structured model context for the active alignment view and range selection", async () => {
    const updateModelContext = vi.fn();
    renderWithMsaProviders(
      <MsaPreview
        className="h-full"
        contents={[">a", "AAGT", ">b", "ACGT"].join("\n")}
        filePath="/tmp/alignment.afa"
        updateModelContext={updateModelContext}
      />,
    );

    await waitForViewer();
    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            rowCoordinateMaps: expect.arrayContaining([
              expect.objectContaining({
                coordinateIntervals: expect.arrayContaining([
                  expect.objectContaining({
                    alignmentEndColumn: 4,
                    alignmentStartColumn: 1,
                    ungappedEndPosition: 4,
                    ungappedStartPosition: 1,
                  }),
                ]),
                rowLabel: "a",
              }),
            ]),
            viewer: "alignment",
          }),
          text: expect.stringContaining(
            "Current scientific viewer: Alignment viewer",
          ),
        }),
      );
    });

    fireEvent.pointerDown(
      screen.getByLabelText(
        "Start or extend an MSA column selection at column 1",
      ),
    );
    fireEvent.pointerEnter(
      screen.getByLabelText(
        "Start or extend an MSA column selection at column 2",
      ),
    );

    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            selection: expect.objectContaining({
              columns: [
                expect.objectContaining({
                  alignmentColumn: 1,
                  rows: [
                    expect.objectContaining({
                      rowLabel: "a",
                      symbol: "A",
                      ungappedPosition: 1,
                    }),
                    expect.objectContaining({
                      rowLabel: "b",
                      symbol: "A",
                      ungappedPosition: 1,
                    }),
                  ],
                }),
                expect.objectContaining({
                  alignmentColumn: 2,
                  conservation: expect.objectContaining({
                    identity: 0.5,
                  }),
                  rows: [
                    expect.objectContaining({
                      rowLabel: "a",
                      symbol: "A",
                      ungappedPosition: 2,
                    }),
                    expect.objectContaining({
                      rowLabel: "b",
                      symbol: "C",
                      ungappedPosition: 2,
                    }),
                  ],
                }),
              ],
              end: 2,
              start: 1,
            }),
          }),
          text: expect.stringContaining(
            "Selected column details: col 1 consensus A",
          ),
        }),
      );
    });
  });

  it("applies every alignment command exposed to chat", async () => {
    const contents = [">ref", "AAGT", ">mut", "ACGT"].join("\n");
    const onCommandResult = vi.fn();
    const view = renderWithMsaProviders(
      <MsaPreview
        command={alignmentCommand({
          action: "select_alignment_columns",
          end: 3,
          start: 2,
        })}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );

    await waitForViewer();
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "select_alignment_columns" }),
        expect.objectContaining({ applied: true, state: { end: 3, start: 2 } }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "focus_alignment_cell", column: 2, row: "mut" },
          2,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Pinned cell inspector")).toBeInTheDocument();
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "focus_alignment_cell" }),
        expect.objectContaining({
          applied: true,
          state: { column: 2, rowId: "mut", symbol: "C" },
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "search_alignment", query: "CG" },
          3,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Search MSA motif")).toHaveValue("CG");
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "search_alignment" }),
        expect.objectContaining({ applied: true, state: { query: "CG" } }),
      );
      expect(
        screen.getByText(/Motif search results · 1 hits/),
      ).toBeInTheDocument();
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "navigate_alignment_search_hit", direction: "next" },
          4,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "navigate_alignment_search_hit" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ hitCount: 1, hitIndex: 1 }),
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "set_alignment_reference", reference: "mut" },
          5,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("MSA reference mode")).toHaveValue("anchor");
      expect(screen.getByLabelText("MSA anchor row")).toHaveValue("mut");
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_alignment_reference" }),
        expect.objectContaining({
          applied: true,
          state: { referenceMode: "anchor", rowId: "mut" },
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "focus_alignment_reference_coordinate", coordinate: 2 },
          6,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: "focus_alignment_reference_coordinate",
        }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            alignmentColumn: 2,
            coordinate: 2,
            referenceRowId: "mut",
          }),
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "filter_alignment_rows", query: "ref" },
          7,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Filter MSA rows")).toHaveValue("ref");
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "filter_alignment_rows" }),
        expect.objectContaining({
          applied: true,
          state: { matchingRowCount: 1, query: "ref" },
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          {
            action: "set_alignment_row_visibility",
            rows: ["mut"],
            visible: false,
          },
          8,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_alignment_row_visibility" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ visibleRowCount: 1 }),
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand({ action: "show_all_alignment_rows" }, 9)}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "show_all_alignment_rows" }),
        expect.objectContaining({
          applied: true,
          state: { visibleRowCount: 2 },
        }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          {
            action: "set_alignment_view_options",
            analysisScope: "currently-displayed-rows",
            cellWidth: 24,
            colorMode: "nucleotide-substitution",
            searchScope: "all-unhidden-rows",
            showIdenticalAsDots: true,
          },
          10,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("MSA analysis scope")).toHaveValue(
        "currently-displayed-rows",
      );
      expect(screen.getByLabelText("MSA motif search scope")).toHaveValue(
        "all-unhidden-rows",
      );
      expect(screen.getByLabelText("MSA color mode")).toHaveValue(
        "nucleotide-substitution",
      );
      expect(screen.getByLabelText("Dots for matches")).toBeChecked();
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "set_alignment_view_options" }),
        expect.objectContaining({ applied: true }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand({ action: "clear_alignment_selection" }, 11)}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "clear_alignment_selection" }),
        expect.objectContaining({ applied: true }),
      );
    });

    view.rerender(
      <MsaPreview
        command={alignmentCommand(
          { action: "compute_alignment_guide_tree" },
          12,
        )}
        contents={contents}
        filePath="/tmp/commands.afa"
        onCommandResult={onCommandResult}
      />,
    );
    await waitFor(() => {
      expect(onCommandResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "compute_alignment_guide_tree" }),
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ method: "UPGMA" }),
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    const guideTreeSummary = screen.getByText("Exploratory guide tree");
    fireEvent.click(guideTreeSummary);
    const guideTreeDetails = guideTreeSummary.closest("details");
    if (guideTreeDetails == null)
      throw new Error("Expected guide-tree details.");
    expect(within(guideTreeDetails).getByText(/'ref'/)).toBeVisible();
  });

  it("includes enough selected-column context to answer residue mapping and conservation follow-ups", async () => {
    const updateModelContext = vi.fn();
    renderWithMsaProviders(
      <MsaPreview
        className="h-full"
        contents={[
          ">KRAS_G12C_HUMAN",
          "LLLLLLLLLLL-------------C",
          ">KRAS_WT_HUMAN",
          "LLLLLLLLLLL-------------G",
        ].join("\n")}
        filePath="/tmp/kras-g12c.afa"
        updateModelContext={updateModelContext}
      />,
    );

    await waitForViewer();
    fireEvent.pointerDown(
      screen.getByLabelText(
        "Start or extend an MSA column selection at column 25",
      ),
    );

    await waitFor(() => {
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            rowCoordinateMaps: expect.arrayContaining([
              expect.objectContaining({
                coordinateIntervals: expect.arrayContaining([
                  expect.objectContaining({
                    alignmentEndColumn: 25,
                    alignmentStartColumn: 25,
                    ungappedEndPosition: 12,
                    ungappedStartPosition: 12,
                  }),
                ]),
                rowLabel: "KRAS_G12C_HUMAN",
              }),
            ]),
            selection: expect.objectContaining({
              columns: [
                expect.objectContaining({
                  alignmentColumn: 25,
                  conservation: expect.objectContaining({
                    identity: 0.5,
                  }),
                  rows: [
                    expect.objectContaining({
                      rowLabel: "KRAS_G12C_HUMAN",
                      symbol: "C",
                      ungappedPosition: 12,
                    }),
                    expect.objectContaining({
                      rowLabel: "KRAS_WT_HUMAN",
                      symbol: "G",
                      ungappedPosition: 12,
                    }),
                  ],
                }),
              ],
            }),
          }),
          text: expect.stringContaining(
            "Selected column details: col 25 consensus",
          ),
        }),
      );
    });
  });

  it("keeps tracks windowed to the displayed alignment columns when paging horizontally", async () => {
    renderPreview(generateAlignment(2, 120));

    await waitForViewer();
    expect(
      screen.getByText(
        "Tracks show the currently displayed alignment columns 1-84.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Next columns"));

    expect(
      screen.getByText(
        "Tracks show the currently displayed alignment columns 25-108.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps horizontal scrolling scoped to the alignment matrix viewport", async () => {
    renderPreview(generateAlignment(2, 500));

    await waitForViewer();
    const matrixViewport = screen.getByLabelText(
      "Scrollable multiple sequence alignment matrix",
    );
    expect(matrixViewport).toHaveClass("overflow-auto");
    expect(matrixViewport.parentElement).toHaveClass(
      "min-w-0",
      "overflow-hidden",
    );
  });

  it("scrolls the shared alignment viewport from tracks, overview, and slider gestures", async () => {
    renderPreview(generateAlignment(2, 500));

    await waitForViewer();
    const firstWindow =
      "Tracks show the currently displayed alignment columns 1-84.";
    const secondWindow =
      "Tracks show the currently displayed alignment columns 25-108.";
    const slider = screen.getByLabelText("Move MSA overview window");

    expect(screen.getByText(firstWindow)).toBeInTheDocument();
    fireEvent.wheel(screen.getByLabelText("MSA metric tracks"), {
      deltaX: 600,
    });
    expect(screen.getByText(secondWindow)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "0" } });
    expect(screen.getByText(firstWindow)).toBeInTheDocument();
    fireEvent.wheel(screen.getByLabelText("MSA overview strip"), {
      deltaX: 600,
    });
    expect(screen.getByText(secondWindow)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "0" } });
    expect(screen.getByText(firstWindow)).toBeInTheDocument();
    fireEvent.wheel(slider, { deltaX: 600 });
    expect(screen.getByText(secondWindow)).toBeInTheDocument();
  });

  it("supports drag-style column range selection from the ruler and selected-range exports", async () => {
    renderPreview([">a", "AAGT", ">b", "ACGT"].join("\n"));

    await waitForViewer();
    fireEvent.pointerDown(
      screen.getByLabelText(
        "Start or extend an MSA column selection at column 1",
      ),
    );
    fireEvent.pointerEnter(
      screen.getByLabelText(
        "Start or extend an MSA column selection at column 2",
      ),
    );
    expect(screen.getByText("Selected columns 1-2")).toBeInTheDocument();
    expect(screen.getByText("2 columns")).toBeInTheDocument();
    expect(screen.getByText("Copy selected range")).toBeInTheDocument();
    expect(
      screen.getByText("Workspace export is unavailable for this viewer."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Download selected SVG")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear selection"));
    expect(screen.queryByText("Selected columns 1-2")).toBeNull();
  });

  it("shows RNA structural annotations, row filters, interpretation override, and focus details", async () => {
    renderPreview(
      [
        "# STOCKHOLM 1.0",
        "rna1 AC-G",
        "rna2 AU-G",
        "#=GC SS_cons <<>>",
        "#=GC RF xxxx",
        "//",
      ].join("\n"),
      "/tmp/rfam.sto",
    );

    await waitForViewer();
    expect(screen.getAllByText("RNA").length).toBeGreaterThan(0);
    expect(screen.getByText("SS_cons")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Annotations"));
    expect(screen.queryByText("SS_cons")).toBeNull();
    fireEvent.click(screen.getByLabelText("Annotations"));
    expect(screen.getByText("SS_cons")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter MSA rows"), {
      target: { value: "rna1" },
    });
    expect(screen.getAllByText("rna1").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("MSA molecule interpretation"), {
      target: { value: "protein" },
    });
    expect(screen.getAllByText("Protein").length).toBeGreaterThan(0);
    fireEvent.mouseEnter(screen.getByLabelText(/rna1 column 1 A/));
    expect(screen.queryByText(/rna1 · col 1 · A/)).toBeNull();
    expect(screen.getByRole("tooltip")).toHaveTextContent("rna1");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Column 1");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Ungapped position 1",
    );
    fireEvent.focus(screen.getByLabelText(/rna1 column 1 A/));
    expect(screen.getByText(/rna1 · col 1 · A/)).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByLabelText(/rna1 column 1 A/));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByLabelText(/rna1 column 3 -/));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Symbol -");
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("Ungapped");
  });

  it("renders a parse error panel instead of a misleading matrix", async () => {
    renderPreview("plain text", "/tmp/not-alignment.txt");
    expect(
      await screen.findByText(
        "Codex could not determine a supported MSA text format.",
      ),
    ).toBeInTheDocument();
  });

  it("uses a hidden A3M format hint path for workspace previews", async () => {
    renderWithMsaProviders(
      <MsaPreview
        className="h-full"
        contents={[">query", "AC-DE", ">hit", "ACaa-DE"].join("\n")}
        formatHintPath="/tmp/protein-profile.a3m"
      />,
    );

    await waitForViewer();
    expect(screen.queryByText(/common display width/i)).toBeNull();
    expect(screen.getAllByText("Protein").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("MSA color mode")).toHaveValue("residue");
    expect(screen.getByLabelText("MSA residue palette")).toHaveValue(
      "muted-amino-acid",
    );
    expect(screen.getAllByText("Soft amino acid").length).toBeGreaterThan(0);
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A2M/A3M insertion after this aligned column (+n = hidden inserted residues)",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("protein-profile.a3m")).toBeNull();
  });

  it("defaults nucleic acids to Differences and exposes residue palettes only in residue mode", async () => {
    renderPreview([">a", "AAGT", ">b", "ACGT"].join("\n"));

    await waitForViewer();
    expect(screen.getByLabelText("MSA color mode")).toHaveValue("difference");
    expect(screen.queryByLabelText("MSA residue palette")).toBeNull();
    expect(await screen.findByText("Match / baseline")).toBeInTheDocument();
    expect(
      await screen.findByText("Difference from reference"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("MSA color mode"), {
      target: { value: "residue" },
    });

    const paletteSelect = screen.getByLabelText("MSA residue palette");
    expect(paletteSelect).toHaveValue("muted-nucleic-acid");
    expect(screen.getAllByText("Soft nucleotide").length).toBeGreaterThan(0);
    expect(screen.queryByText("RasMol")).toBeNull();
  });

  it.each([
    {
      molecule: "dna",
      palette: "muted-nucleic-acid",
      sequence: "AGTN-",
      path: "/tmp/soft-dna.afa",
      column: 2,
      symbol: "G",
      legend: "G",
    },
    {
      molecule: "rna",
      palette: "muted-nucleic-acid",
      sequence: "AGUN-",
      path: "/tmp/soft-rna.afa",
      column: 3,
      symbol: "U",
      legend: "T/U",
    },
    {
      molecule: "protein",
      palette: "muted-amino-acid",
      sequence: "KRUB-",
      path: "/tmp/soft-protein.a3m",
      column: 1,
      symbol: "K",
      legend: "Positive",
    },
  ] as const)(
    "controls and discovers the soft $molecule palette with matching legend pairs",
    async ({ molecule, palette, sequence, path, column, symbol, legend }) => {
      const onCommandResult = vi.fn();
      const updateModelContext = vi.fn();
      const contents = `>row\n${sequence}\n>other\n${sequence}`;
      renderWithMsaProviders(
        <MsaPreview
          command={alignmentCommand({
            action: "set_alignment_view_options",
            colorMode: "residue",
            residuePalette: palette,
          })}
          contents={contents}
          filePath={path}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />,
      );
      await waitForViewer();
      await waitFor(() =>
        expect(onCommandResult).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            applied: true,
            state: expect.objectContaining({ residuePalette: palette }),
          }),
        ),
      );
      const cell = screen.getByLabelText(`row column ${column} ${symbol}`);
      const expected = getSequenceResidueStyle({
        molecule,
        paletteId: palette,
        residue: symbol,
      });
      expect(cell.style.backgroundColor).toBe(expected.backgroundColor);
      expect(cell.style.color).toBe(expected.color);
      const swatch = within(
        screen.getByLabelText("MSA color legend"),
      ).getByText(legend);
      expect(swatch.style.backgroundColor).toBe(expected.backgroundColor);
      expect(swatch.style.color).toBe(expected.color);
      await waitFor(() =>
        expect(updateModelContext).toHaveBeenLastCalledWith(
          expect.objectContaining({
            structuredContent: expect.objectContaining({
              display: expect.objectContaining({
                residuePalette: palette,
                defaultResiduePalette: palette,
                compatibleResiduePalettes: expect.arrayContaining([
                  palette,
                  "neutral",
                ]),
              }),
            }),
          }),
        ),
      );
      fireEvent.change(screen.getByLabelText("MSA residue palette"), {
        target: { value: "neutral" },
      });
      expect(cell.style.backgroundColor).toBe("transparent");
      expect(cell.style.color).toBe("var(--bio-token-text-primary)");
    },
  );

  it("resets incompatible palettes when interpretation crosses modality families", async () => {
    renderPreview([">a", "KR", ">b", "KR"].join("\n"), "/tmp/family.a3m");

    await waitForViewer();
    expect(screen.getByLabelText("MSA residue palette")).toHaveValue(
      "muted-amino-acid",
    );
    fireEvent.change(screen.getByLabelText("MSA molecule interpretation"), {
      target: { value: "dna" },
    });

    expect(screen.getByLabelText("MSA residue palette")).toHaveValue(
      "muted-nucleic-acid",
    );
    expect(screen.getAllByText("Soft nucleotide").length).toBeGreaterThan(0);
  });

  it("updates the adaptive legend for major palette and mode changes", async () => {
    renderPreview([">a", "KR", ">b", "KR"].join("\n"), "/tmp/family.a3m");

    await waitForViewer();
    fireEvent.change(screen.getByLabelText("MSA residue palette"), {
      target: { value: "rasmol" },
    });
    expect(screen.getAllByText("RasMol").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("MSA residue palette"), {
      target: { value: "hydrophobicity" },
    });
    expect(screen.getAllByText("Hydrophobicity").length).toBeGreaterThan(0);
    expect(screen.getByText("hydrophobic")).toBeInTheDocument();
    expect(screen.getByText("hydrophilic")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("MSA color mode"), {
      target: { value: "protein-conservation" },
    });
    expect(
      (await screen.findAllByText("Protein conservation")).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("MSA color mode"), {
      target: { value: "difference" },
    });
    expect(screen.getByText("Match / baseline")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("MSA reference mode"), {
      target: { value: "none" },
    });
    expect(
      screen.getByText(
        "Select a consensus or anchor reference to highlight differences.",
      ),
    ).toBeInTheDocument();
  });

  it("supports nucleic-acid palette legends and ambiguity-aware RNA residue colors", async () => {
    renderPreview(
      [">rna1", "AUR", ">rna2", "AUR"].join("\n"),
      "/tmp/rna.aln-fasta",
    );

    await waitForViewer();
    fireEvent.change(screen.getByLabelText("MSA color mode"), {
      target: { value: "residue" },
    });
    fireEvent.change(screen.getByLabelText("MSA residue palette"), {
      target: { value: "purine-pyrimidine" },
    });
    expect(screen.getAllByText("Purine / Pyrimidine").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Purines A/G/R")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("MSA residue palette"), {
      target: { value: "nucleotide-ambiguity" },
    });
    expect(screen.getAllByText("Nucleotide ambiguity").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("R purine")).toBeInTheDocument();
    expect(screen.getByLabelText(/rna1 column 2 U/)).toBeInTheDocument();
  });

  it("renders coding-DNA translation helpers and exposes coding-aware color modes", async () => {
    renderPreview(
      [">ref", "ATGAAA", ">syn", "ATGAAG", ">nonsyn", "ATGGAA"].join("\n"),
      "/tmp/coding.afa",
    );

    await waitForViewer();
    expect(screen.getByText("AA translation")).toBeInTheDocument();
    const translation = screen.getByText("AA translation").parentElement!;
    const methionine = within(translation).getByText("M");
    expect(methionine.style.backgroundColor).toBe(
      "var(--bio-protein-hydrophobic-surface)",
    );
    expect(methionine.style.color).toBe(
      "var(--bio-protein-hydrophobic-foreground)",
    );
    expect(translation).toHaveAttribute(
      "title",
      expect.stringContaining("not substitution impact or conservation"),
    );
    expect(screen.getByLabelText("MSA color mode")).toHaveTextContent(
      "Transition / transversion",
    );
    expect(screen.getByLabelText("MSA color mode")).toHaveTextContent(
      "Synonymous / nonsynonymous",
    );
  });

  it("keeps dark canonical nucleotide palette cells legible with a light foreground", async () => {
    renderPreview(
      [">dna_g", "AGT", ">dna_g2", "AGT"].join("\n"),
      "/tmp/readable-dna.aln-fasta",
    );

    await waitForViewer();
    fireEvent.change(screen.getByLabelText("MSA color mode"), {
      target: { value: "residue" },
    });
    fireEvent.change(screen.getByLabelText("MSA residue palette"), {
      target: { value: "ncbi-nucleic-acid" },
    });

    expect(screen.getByLabelText(/dna_g column 2 G/)).toHaveStyle({
      backgroundColor: "#0000ff",
      color: "#ffffff",
    });
  });

  it("renders Differences mode as neutral matches plus highlighted mismatches", async () => {
    renderPreview([">ref", "AA", ">mut", "AG"].join("\n"));

    await waitForViewer();
    fireEvent.change(screen.getByLabelText("MSA reference mode"), {
      target: { value: "anchor" },
    });
    expect(screen.getByLabelText("MSA anchor row")).toHaveValue("ref");

    expect(screen.getByLabelText(/ref column 2 A/)).toHaveStyle({
      backgroundColor: "#f8fafc",
    });
    expect(screen.getByLabelText(/mut column 2 G/)).toHaveStyle({
      backgroundColor: "#ffd6a8",
    });
  });

  it("keeps mounted matrix cells and row controls bounded for large alignments", async () => {
    renderPreview(generateAlignment(400, 500), "/tmp/large.afa");

    const viewer = await waitForViewer();
    const matrixCells = viewer.querySelectorAll(
      'button[aria-label*=" column "]',
    );
    expect(matrixCells.length).toBeGreaterThan(0);
    expect(matrixCells.length).toBeLessThan(6_000);

    const rowControls = screen.getByLabelText("MSA row visibility controls");
    const rowCheckboxes = rowControls.querySelectorAll(
      'input[type="checkbox"]',
    );
    expect(rowCheckboxes.length).toBeGreaterThan(0);
    expect(rowCheckboxes.length).toBeLessThan(60);
  }, 15_000);

  it("computes tooltip geometry lazily only after an active cell is hovered", async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    renderPreview([">a", "AA", ">b", "AG"].join("\n"));
    await waitForViewer();

    expect(rectSpy).not.toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByLabelText(/a column 1 A/));
    expect(rectSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Ungapped position 1",
    );
    rectSpy.mockRestore();
  });

  it("exposes an accessible grid with one roving tab stop and arrow navigation", async () => {
    renderPreview([">a", "AAGT", ">b", "ACGT"].join("\n"));
    const grid = await waitForViewer();
    expect(grid).toHaveAttribute("role", "grid");
    const cells = screen.getAllByRole("gridcell", { name: /column/ });
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    screen.getByLabelText(/a column 1 A/).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByLabelText(/a column 2 A/)).toHaveFocus();
  });

  it("announces optimized mode for especially large row counts", async () => {
    renderPreview(generateAlignment(1_001, 4), "/tmp/large-rows.afa");

    await waitForViewer();
    expect(
      screen.getByText("Large alignment optimized mode"),
    ).toBeInTheDocument();
  });
});

function alignmentCommand(
  command: SequenceViewerCommand,
  revision = 1,
): QueuedSequenceViewerCommand {
  return {
    ...command,
    commandId: `11111111-1111-4111-8111-${revision.toString().padStart(12, "0")}`,
    revision,
  } as QueuedSequenceViewerCommand;
}
