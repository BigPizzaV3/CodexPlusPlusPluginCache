import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BiologicalSequenceViewer } from "./biological-sequence-viewer";
import { createBiologicalSequenceViewerModel } from "./biological-sequence-viewer-model";
import {
  SequenceDurableViewerStateContext,
  type SequenceDurableViewerStateController,
} from "./persistent/durable-viewer-state";
import type { QueuedSequenceViewerCommand } from "./viewer-commands";

afterEach(() => cleanup());

describe("BiologicalSequenceViewer", () => {
  it("defaults strong aligned FASTA to alignment while keeping sequence mode available", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          fileName="family.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "family.fasta",
          })}
        />
      </IntlProvider>,
    );

    expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
    expect(screen.getByLabelText("Wrapped sequence view")).toBeInTheDocument();
  });

  it("keeps single-sequence FASTA in sequence-only mode", () => {
    const contents = ">demo\nACGT\n";
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          fileName="demo.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "demo.fasta",
          })}
        />
      </IntlProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Alignment" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Wrapped sequence view")).toBeInTheDocument();
  });

  it("exposes the host display-mode control in the sequence viewer header", async () => {
    const contents = ">demo\nACGT\n";
    const requestMode = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          displayModeControl={{
            mode: "inline",
            pending: false,
            requestMode,
          }}
          fileName="demo.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "demo.fasta",
          })}
        />
      </IntlProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Open in side pane" }),
    );
    expect(requestMode).toHaveBeenCalledWith("fullscreen");

    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          displayModeControl={{
            mode: "fullscreen",
            pending: false,
            requestMode,
          }}
          fileName="demo.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "demo.fasta",
          })}
        />
      </IntlProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Return to chat" }),
    );
    expect(requestMode).toHaveBeenLastCalledWith("inline");
  });

  it.each([
    {
      contents: ">demo\nAACCGGTT\n",
      fileName: "demo.fasta",
      mode: "Sequence",
      searchLabel: "Search sequence",
    },
    {
      contents: ">row-a\nAC-GT\n>row-b\nACTGT\n",
      fileName: "family.fasta",
      mode: "Alignment",
      searchLabel: "Filter MSA rows",
    },
  ] as const)(
    "opens $mode with an accessible hidden toolbar when inline presentation is requested",
    async ({ contents, fileName, searchLabel }) => {
      render(
        <IntlProvider locale="en" messages={{}}>
          <BiologicalSequenceViewer
            contents={contents}
            fileName={fileName}
            initialToolbarVisible={false}
            model={createBiologicalSequenceViewerModel({ contents, fileName })}
          />
        </IntlProvider>,
      );

      const shell = document.querySelector(".sequence-viewer-shell");
      expect(shell).toHaveAttribute("data-toolbar-mode", "hidden");
      expect(shell).toHaveAttribute("data-toolbar-visible", "false");
      expect(shell).toHaveAttribute("data-toolbar-revealed", "false");
      const header = document.getElementById("sequence-viewer-topbar");
      expect(header).toHaveAttribute("inert");
      expect(
        screen.queryByRole("textbox", { name: searchLabel }),
      ).not.toBeInTheDocument();
      const edge = screen.getByRole("button", {
        name: "Reveal sequence viewer toolbar",
      });
      fireEvent.focus(edge);

      expect(shell).toHaveAttribute("data-toolbar-visible", "false");
      expect(shell).toHaveAttribute("data-toolbar-revealed", "true");
      expect(header).not.toHaveAttribute("inert");
      expect(
        await screen.findByRole("textbox", { name: searchLabel }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Show toolbar" }),
      ).toBeVisible();
    },
  );

  it.each([
    {
      contents: ">demo\nAACCGGTT\n",
      fileName: "demo.fasta",
      mode: "Sequence",
      searchLabel: "Search sequence",
    },
    {
      contents: ">row-a\nAC-GT\n>row-b\nACTGT\n",
      fileName: "family.fasta",
      mode: "Alignment",
      searchLabel: "Filter MSA rows",
    },
  ] as const)(
    "hides and temporarily reveals the $mode toolbar without unmounting live controls",
    async ({ contents, fileName, searchLabel }) => {
      const updateModelContext = vi.fn();
      render(
        <IntlProvider locale="en" messages={{}}>
          <BiologicalSequenceViewer
            contents={contents}
            fileName={fileName}
            model={createBiologicalSequenceViewerModel({ contents, fileName })}
            updateModelContext={updateModelContext}
          />
        </IntlProvider>,
      );

      const search = await screen.findByRole("textbox", { name: searchLabel });
      await userEvent.type(
        search,
        searchLabel === "Search sequence" ? "CC" : "row-a",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Hide toolbar" }),
      );

      const shell = document.querySelector(".sequence-viewer-shell");
      expect(shell).toHaveAttribute("data-toolbar-visible", "false");
      expect(shell).toHaveAttribute("data-toolbar-revealed", "false");
      expect(search.isConnected).toBe(true);
      expect(
        search.closest("[data-sequence-toolbar-controls]"),
      ).toHaveAttribute("hidden");
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({ toolbarVisible: false }),
        }),
      );
      const contextCalls = updateModelContext.mock.calls.length;
      const edge = screen.getByRole("button", {
        name: "Reveal sequence viewer toolbar",
      });
      fireEvent.pointerEnter(edge);

      expect(shell).toHaveAttribute("data-toolbar-visible", "false");
      expect(shell).toHaveAttribute("data-toolbar-revealed", "true");
      expect(updateModelContext).toHaveBeenCalledTimes(contextCalls);
      expect(screen.getByRole("textbox", { name: searchLabel })).toBe(search);
      expect(search).toHaveValue(
        searchLabel === "Search sequence" ? "CC" : "row-a",
      );
      const header = document.getElementById("sequence-viewer-topbar");
      if (header == null) throw new Error("Expected a mounted viewer header.");
      fireEvent.pointerLeave(header, { relatedTarget: search });
      fireEvent.focus(search, { relatedTarget: header });
      fireEvent.pointerOver(search, { relatedTarget: header });
      expect(shell).toHaveAttribute("data-toolbar-revealed", "true");
      expect(
        search.closest("[data-sequence-toolbar-controls]"),
      ).not.toHaveAttribute("inert");
      fireEvent.pointerOut(search, { relatedTarget: document.body });
      fireEvent.blur(search, { relatedTarget: document.body });
      expect(shell).toHaveAttribute("data-toolbar-revealed", "false");
      fireEvent.pointerEnter(edge);
      expect(shell).toHaveAttribute("data-toolbar-revealed", "true");
      await userEvent.click(
        screen.getByRole("button", { name: "Show toolbar" }),
      );

      expect(shell).toHaveAttribute("data-toolbar-visible", "true");
      expect(screen.getByRole("textbox", { name: searchLabel })).toBe(search);
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({ toolbarVisible: true }),
        }),
      );
    },
  );

  it("restores a hidden toolbar without resetting an active nondefault viewer mode", async () => {
    const contents = ">row-a\nAC-GT\n>row-b\nACTGT\n";
    const sourceStateKey = "artifact:shared-toolbar";
    const restoredState = {
      sourceStateKey,
      toolbarVisible: false,
    };
    const setToolbarVisibility = vi.fn(
      ({ visible }: { sourceStateKey: string; visible: boolean }) => {
        restoredState.toolbarVisible = visible;
      },
    );
    const controller = {
      flush: vi.fn(async () => undefined),
      restoredState,
      setToolbarVisibility,
      updateAlignment: vi.fn(),
      updateSequence: vi.fn(),
    } as unknown as SequenceDurableViewerStateController;
    render(
      <IntlProvider locale="en" messages={{}}>
        <SequenceDurableViewerStateContext.Provider value={controller}>
          <BiologicalSequenceViewer
            contents={contents}
            fileName="family.fasta"
            initialToolbarVisible={true}
            model={createBiologicalSequenceViewerModel({
              contents,
              fileName: "family.fasta",
            })}
            sourceStateKey={sourceStateKey}
          />
        </SequenceDurableViewerStateContext.Provider>
      </IntlProvider>,
    );

    expect(document.querySelector(".sequence-viewer-shell")).toHaveAttribute(
      "data-toolbar-visible",
      "false",
    );
    expect(setToolbarVisibility).not.toHaveBeenCalledWith(
      expect.objectContaining({ visible: true }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reveal sequence viewer toolbar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show toolbar" }));
    await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
    const search = screen.getByRole("textbox", { name: "Search sequence" });
    await userEvent.type(search, "GT");

    await userEvent.click(screen.getByRole("button", { name: "Hide toolbar" }));
    expect(screen.getByLabelText("Wrapped sequence view")).toBeInTheDocument();
    expect(search.isConnected).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Reveal sequence viewer toolbar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show toolbar" }));

    expect(screen.getByRole("button", { name: "Sequence" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("textbox", { name: "Search sequence" })).toBe(
      search,
    );
    expect(search).toHaveValue("GT");
  });

  it("applies shared model toolbar commands without resetting alignment filters", async () => {
    const contents = ">row-a\nAC-GT\n>row-b\nACTGT\n";
    const fileName = "family.fasta";
    const model = createBiologicalSequenceViewerModel({ contents, fileName });
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const view = render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>,
    );
    const filter = await screen.findByRole("textbox", {
      name: "Filter MSA rows",
    });
    await userEvent.type(filter, "row-a");

    const hideCommand = {
      action: "set_toolbar_visibility",
      commandId: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      visible: false,
    } satisfies QueuedSequenceViewerCommand;
    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={hideCommand}
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>,
    );

    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        hideCommand,
        expect.objectContaining({
          applied: true,
          state: { toolbarVisible: false },
        }),
      ),
    );
    expect(filter.isConnected).toBe(true);
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({ toolbarVisible: false }),
        }),
      ),
    );

    const showCommand = {
      action: "set_toolbar_visibility",
      commandId: "22222222-2222-4222-8222-222222222222",
      revision: 2,
      visible: true,
    } satisfies QueuedSequenceViewerCommand;
    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={showCommand}
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>,
    );

    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        showCommand,
        expect.objectContaining({
          applied: true,
          state: { toolbarVisible: true },
        }),
      ),
    );
    expect(screen.getByRole("textbox", { name: "Filter MSA rows" })).toBe(
      filter,
    );
    expect(filter).toHaveValue("row-a");
  });

  it("refuses human and model hide requests while a portal approval dialog is open", async () => {
    const contents = ">demo\nAACCGGTT\n";
    const fileName = "demo.fasta";
    const model = createBiologicalSequenceViewerModel({ contents, fileName });
    const onCommandResult = vi.fn();
    const view = render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );
    const approval = document.createElement("div");
    approval.setAttribute("role", "dialog");
    approval.setAttribute("aria-modal", "true");
    approval.setAttribute("aria-label", "Workspace approval");
    document.body.append(approval);

    try {
      await userEvent.click(
        screen.getByRole("button", { name: "Hide toolbar" }),
      );
      expect(document.querySelector(".sequence-viewer-shell")).toHaveAttribute(
        "data-toolbar-visible",
        "true",
      );
      const command = {
        action: "set_toolbar_visibility",
        commandId: "33333333-3333-4333-8333-333333333333",
        revision: 1,
        visible: false,
      } satisfies QueuedSequenceViewerCommand;
      view.rerender(
        <IntlProvider locale="en" messages={{}}>
          <BiologicalSequenceViewer
            command={command}
            contents={contents}
            fileName={fileName}
            model={model}
            onCommandResult={onCommandResult}
          />
        </IntlProvider>,
      );

      await waitFor(() =>
        expect(onCommandResult).toHaveBeenCalledWith(
          command,
          expect.objectContaining({
            applied: false,
            message: expect.stringContaining("approval or copy action"),
            state: { toolbarVisible: true },
          }),
        ),
      );
      expect(screen.getByRole("dialog", { name: "Workspace approval" })).toBe(
        approval,
      );
      expect(document.querySelector(".sequence-viewer-shell")).toHaveAttribute(
        "data-toolbar-visible",
        "true",
      );
    } finally {
      approval.remove();
    }
  });

  it("keeps active manual toolbar feedback visible while refusing to hide", async () => {
    const contents = ">demo\nAACCGGTT\n";
    const fileName = "demo.fasta";
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={contents}
          fileName={fileName}
          model={createBiologicalSequenceViewerModel({ contents, fileName })}
        />
      </IntlProvider>,
    );
    const controls = document.querySelector(
      '[data-sequence-toolbar-controls="sequence"]',
    );
    if (controls == null) {
      throw new Error("Expected mounted Sequence toolbar controls.");
    }
    const fallback = document.createElement("textarea");
    fallback.readOnly = true;
    fallback.setAttribute("aria-label", "Sequence text to copy manually");
    controls.append(fallback);

    try {
      await userEvent.click(
        screen.getByRole("button", { name: "Hide toolbar" }),
      );
      expect(document.querySelector(".sequence-viewer-shell")).toHaveAttribute(
        "data-toolbar-visible",
        "true",
      );
      expect(
        screen.getByRole("textbox", { name: "Sequence text to copy manually" }),
      ).toBe(fallback);
    } finally {
      fallback.remove();
    }
  });

  it("switches viewer modes from a model command and reports the applied state", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    const onCommandResult = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={
            {
              action: "set_mode",
              commandId: "11111111-1111-4111-8111-111111111111",
              mode: "sequence",
              revision: 1,
            } satisfies QueuedSequenceViewerCommand
          }
          contents={contents}
          fileName="family.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "family.fasta",
          })}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );

    expect(
      await screen.findByLabelText("Wrapped sequence view"),
    ).toBeInTheDocument();
    expect(onCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({ action: "set_mode" }),
      {
        applied: true,
        message: "Switched the viewer to sequence mode.",
        state: { mode: "sequence" },
      },
    );
  });

  it("routes row-based alignment commands to the alignment workbench", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    const onCommandResult = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={
            {
              action: "align_sequences",
              commandId: "11111111-1111-4111-8111-111111111111",
              jobId: "22222222-2222-4222-8222-222222222222",
              revision: 1,
              rowIds: ["a", "b"],
            } satisfies QueuedSequenceViewerCommand
          }
          contents={contents}
          fileName="family.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "family.fasta",
          })}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(onCommandResult).toHaveBeenCalledWith(
      expect.objectContaining({ action: "align_sequences" }),
      expect.objectContaining({
        applied: true,
        message: expect.stringContaining("realignment"),
      }),
    );
  });

  it("keeps FASTQ metrics queries in Sequence mode and returns the live aggregate", async () => {
    const contents = "@read-1\nACGT\n+\nIIII\n@read-2\nGC\n+\nI!\n";
    const onCommandResult = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={
            {
              action: "query_viewer",
              commandId: "11111111-1111-4111-8111-111111111111",
              request: { limit: 100, target: "metrics" },
              revision: 1,
            } satisfies QueuedSequenceViewerCommand
          }
          contents={contents}
          fileName="reads.fastq"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "reads.fastq",
          })}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );

    expect(await screen.findByText("FASTQ overview")).toBeInTheDocument();
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          applied: true,
          state: {
            query: expect.objectContaining({
              items: [
                expect.objectContaining({
                  readCount: 2,
                  totalBases: 6,
                  type: "fastq-summary",
                }),
              ],
              target: "metrics",
            }),
          },
        }),
      ),
    );
  });

  it("routes metrics for an aligned artifact back to Alignment mode", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    const model = createBiologicalSequenceViewerModel({
      contents,
      fileName: "family.fasta",
    });
    const onCommandResult = vi.fn();
    const view = render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={
            {
              action: "set_mode",
              commandId: "11111111-1111-4111-8111-111111111111",
              mode: "sequence",
              revision: 1,
            } satisfies QueuedSequenceViewerCommand
          }
          contents={contents}
          fileName="family.fasta"
          model={model}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );

    expect(
      await screen.findByLabelText("Wrapped sequence view"),
    ).toBeInTheDocument();
    onCommandResult.mockClear();
    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={
            {
              action: "query_viewer",
              commandId: "22222222-2222-4222-8222-222222222222",
              request: { limit: 100, target: "metrics" },
              revision: 2,
            } satisfies QueuedSequenceViewerCommand
          }
          contents={contents}
          fileName="family.fasta"
          model={model}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        expect.objectContaining({ action: "query_viewer" }),
        expect.objectContaining({
          applied: true,
          message: "Returned metrics from the live Alignment viewer.",
          state: {
            query: expect.objectContaining({ target: "metrics" }),
          },
        }),
      ),
    );
  });

  it("resets the mode and sequence interaction state when the artifact changes", async () => {
    const firstContents = ">a\nAC-GT\n>b\nACTGT\n";
    const secondContents = ">c\nTT-CC\n>d\nTTACC\n";
    const updateModelContext = vi.fn();
    const view = render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={firstContents}
          fileName="first.fasta"
          model={createBiologicalSequenceViewerModel({
            contents: firstContents,
            fileName: "first.fasta",
          })}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
    const residue = await screen.findByLabelText(/a position 4/);
    fireEvent.mouseDown(residue);
    fireEvent.mouseUp(residue);
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            selection: expect.objectContaining({ end: 4, start: 4 }),
          }),
        }),
      ),
    );

    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          contents={secondContents}
          fileName="second.fasta"
          model={createBiologicalSequenceViewerModel({
            contents: secondContents,
            fileName: "second.fasta",
          })}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            artifact: expect.objectContaining({ fileName: "second.fasta" }),
            selection: null,
          }),
        }),
      ),
    );
  });

  it("routes panel tools through the shared UI handler and reports their current choices", async () => {
    const contents = ">demo\nAACCGGTT\n";
    const fileName = "demo.fasta";
    const model = createBiologicalSequenceViewerModel({ contents, fileName });
    const onCommandResult = vi.fn();
    const updateModelContext = vi.fn();
    const renderViewer = (
      command?: QueuedSequenceViewerCommand,
    ): React.ReactElement => (
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={command}
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
          updateModelContext={updateModelContext}
        />
      </IntlProvider>
    );
    const view = render(renderViewer());
    const open = {
      action: "set_workbench_panel",
      commandId: "11111111-1111-4111-8111-111111111111",
      group: "sequence-tools",
      panel: "inspect",
      revision: 1,
    } satisfies QueuedSequenceViewerCommand;
    view.rerender(renderViewer(open));
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        open,
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            group: "sequence-tools",
            activePanel: "inspect",
          }),
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await waitFor(() =>
      expect(updateModelContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            workbenchPanels: expect.arrayContaining([
              expect.objectContaining({
                group: "sequence-tools",
                activePanel: "inspect",
              }),
            ]),
          }),
        }),
      ),
    );
    view.rerender(renderViewer(open));
    expect(
      onCommandResult.mock.calls.filter(
        ([command]) => command.commandId === open.commandId,
      ),
    ).toHaveLength(1);
    const query = {
      action: "query_viewer",
      commandId: "22222222-2222-4222-8222-222222222222",
      request: { target: "workbench-panels", group: "sequence-tools" },
      revision: 2,
    } satisfies QueuedSequenceViewerCommand;
    view.rerender(renderViewer(query));
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        query,
        expect.objectContaining({
          applied: true,
          state: {
            query: expect.objectContaining({
              target: "workbench-panels",
              truncated: false,
              page: { count: 1, offset: 0, totalCount: 1 },
              items: [
                expect.objectContaining({
                  activePanel: "inspect",
                  group: "sequence-tools",
                  panels: expect.arrayContaining([
                    { id: "inspect", label: "Inspect" },
                  ]),
                }),
              ],
            }),
          },
        }),
      ),
    );
    const close = {
      action: "set_workbench_panel",
      commandId: "33333333-3333-4333-8333-333333333333",
      group: "sequence-tools",
      panel: null,
      revision: 3,
    } satisfies QueuedSequenceViewerCommand;
    view.rerender(renderViewer(close));
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        close,
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({ activePanel: null }),
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("activates a panel's available viewer mode before applying its command", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    const command = {
      action: "set_workbench_panel",
      commandId: "11111111-1111-4111-8111-111111111111",
      group: "sequence-tools",
      panel: "inspect",
      revision: 1,
    } satisfies QueuedSequenceViewerCommand;
    const onCommandResult = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={command}
          contents={contents}
          fileName="family.fasta"
          model={createBiologicalSequenceViewerModel({
            contents,
            fileName: "family.fasta",
          })}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>,
    );
    await waitFor(() =>
      expect(onCommandResult).toHaveBeenCalledWith(
        command,
        expect.objectContaining({
          applied: true,
          state: expect.objectContaining({
            activePanel: "inspect",
            group: "sequence-tools",
          }),
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Sequence" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(onCommandResult).toHaveBeenCalledTimes(1);
  });

  it("keeps a portal approval visible and refuses both human and agent mode switches", async () => {
    const contents = ">a\nAC-GT\n>b\nACTGT\n";
    const fileName = "family.fasta";
    const model = createBiologicalSequenceViewerModel({ contents, fileName });
    const onCommandResult = vi.fn();
    const renderViewer = (
      command?: QueuedSequenceViewerCommand,
    ): React.ReactElement => (
      <IntlProvider locale="en" messages={{}}>
        <BiologicalSequenceViewer
          command={command}
          contents={contents}
          fileName={fileName}
          model={model}
          onCommandResult={onCommandResult}
        />
      </IntlProvider>
    );
    const view = render(renderViewer());
    const approval = document.createElement("div");
    approval.setAttribute("role", "alertdialog");
    approval.setAttribute("aria-label", "Pending workspace approval");
    document.body.append(approval);
    try {
      await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const command = {
        action: "set_workbench_panel",
        commandId: "11111111-1111-4111-8111-111111111111",
        group: "sequence-tools",
        panel: "inspect",
        revision: 1,
      } satisfies QueuedSequenceViewerCommand;
      view.rerender(renderViewer(command));
      await waitFor(() =>
        expect(onCommandResult).toHaveBeenCalledWith(
          command,
          expect.objectContaining({
            applied: false,
            state: { mode: "alignment" },
          }),
        ),
      );
      expect(
        screen.getByRole("alertdialog", { name: "Pending workspace approval" }),
      ).toBe(approval);
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } finally {
      approval.remove();
    }
  });
});
