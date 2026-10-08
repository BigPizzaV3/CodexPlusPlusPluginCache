import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkbenchToolController } from "./workbench-tool-controller";
import { WorkbenchDisclosure } from "./workbench-disclosure";
import { useWorkbenchFeedback } from "./workbench-feedback";
import {
  WorkbenchToolControllerContext,
  WorkbenchTools,
} from "./workbench-tools";

afterEach(cleanup);

describe("WorkbenchTools", () => {
  it("starts closed and preserves input identity and value when switching tools", async () => {
    const user = userEvent.setup();
    render(
      <WorkbenchTools
        group="sequence-tools"
        label="Sequence tools"
        panels={[
          {
            content: (
              <input aria-label="Feature name" defaultValue="promoter" />
            ),
            id: "inspect",
            label: "Inspect",
          },
          {
            content: <p>Analysis settings</p>,
            id: "analyze",
            label: "Analyze",
          },
        ]}
      />,
    );

    const input = screen.getByLabelText("Feature name");
    expect(input).not.toBeVisible();
    expect(input.closest("section")).toHaveAttribute("inert");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    await user.clear(input);
    await user.type(input, "cI promoter");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(input).not.toBeVisible();
    expect(screen.getByText("Analysis settings")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByLabelText("Feature name")).toBe(input);
    expect(input).toHaveValue("cI promoter");
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(input).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps pending feedback visible until explicitly dismissed", async () => {
    function CopyFeedback(): React.ReactElement {
      const [pending, setPending] = useState(true);
      return pending ? (
        <div>
          <textarea aria-label="Sequence to copy" readOnly value="ACGT" />
          <button onClick={() => setPending(false)} type="button">
            Dismiss copy feedback
          </button>
        </div>
      ) : (
        <p>Ready</p>
      );
    }
    const user = userEvent.setup();
    render(
      <WorkbenchTools
        defaultPanel="export"
        group="sequence-tools"
        label="Sequence tools"
        panels={[
          { content: <CopyFeedback />, id: "export", label: "Export" },
          { content: <p>Annotations</p>, id: "inspect", label: "Inspect" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByLabelText("Sequence to copy")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Finish or dismiss");
    await user.click(
      screen.getByRole("button", { name: "Dismiss copy feedback" }),
    );
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByText("Annotations")).toBeVisible();
  });

  it("ignores hidden feedback and nonblocking information", async () => {
    const user = userEvent.setup();
    render(
      <WorkbenchTools
        defaultPanel="inspect"
        group="sequence-tools"
        label="Sequence tools"
        panels={[
          {
            content: (
              <div>
                <section hidden inert>
                  <p role="alert">Old analysis error</p>
                </section>
                <textarea
                  aria-label="Saved project information"
                  data-workbench-nonblocking="true"
                  readOnly
                  value="source metadata"
                />
              </div>
            ),
            id: "inspect",
            label: "Inspect",
          },
          {
            content: <p>Analysis settings</p>,
            id: "analyze",
            label: "Analyze",
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByText("Analysis settings")).toBeVisible();
  });

  it("shares direct, idempotent panel operations with the agent without unmounting content", async () => {
    const user = userEvent.setup();
    const controller = new WorkbenchToolController();
    render(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <WorkbenchTools
          group="sequence-tools"
          label="Sequence tools"
          panels={[
            {
              content: (
                <input aria-label="Feature name" defaultValue="promoter" />
              ),
              id: "inspect",
              label: "Inspect",
            },
            {
              content: <p>Analysis settings</p>,
              id: "analyze",
              label: "Analyze",
            },
          ]}
        />
      </WorkbenchToolControllerContext.Provider>,
    );
    const input = screen.getByLabelText("Feature name");
    expect(controller.getSnapshots()).toEqual([
      expect.objectContaining({
        activePanel: null,
        blocked: false,
        group: "sequence-tools",
        panels: [
          { id: "inspect", label: "Inspect" },
          { id: "analyze", label: "Analyze" },
        ],
      }),
    ]);
    act(() => {
      expect(controller.setPanel("sequence-tools", "inspect")).toMatchObject({
        applied: true,
        state: { activePanel: "inspect" },
      });
    });
    expect(input).toBeVisible();
    await user.type(input, " edited");
    act(() => {
      expect(controller.setPanel("sequence-tools", "inspect")).toMatchObject({
        applied: true,
        state: { activePanel: "inspect" },
      });
    });
    expect(input).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(controller.getSnapshots()[0]?.activePanel).toBe("analyze");
    act(() => {
      controller.setPanel("sequence-tools", null);
      controller.setPanel("sequence-tools", "inspect");
    });
    expect(screen.getByLabelText("Feature name")).toBe(input);
    expect(input).toHaveValue("promoter edited");
    expect(controller.setPanel("sequence-tools", "missing")).toMatchObject({
      applied: false,
      state: { activePanel: "inspect" },
    });
    expect(controller.setPanel("alignment-tools", "inspect")).toMatchObject({
      applied: false,
      state: { mountedGroups: ["sequence-tools"] },
    });
  });

  it("rejects agent switches and closes while the same visible UI approval is pending", async () => {
    const controller = new WorkbenchToolController();
    const user = userEvent.setup();
    function Approval(): React.ReactElement {
      const [pending, setPending] = useState(true);
      return pending ? (
        <div role="alertdialog">
          <p>Confirm workspace destination</p>
          <button onClick={() => setPending(false)} type="button">
            Cancel pending export
          </button>
        </div>
      ) : (
        <p>Export cancelled</p>
      );
    }
    render(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <WorkbenchTools
          defaultPanel="export"
          group="sequence-tools"
          label="Sequence tools"
          panels={[
            { content: <Approval />, id: "export", label: "Export" },
            {
              content: <p>Analysis settings</p>,
              id: "analyze",
              label: "Analyze",
            },
          ]}
        />
      </WorkbenchToolControllerContext.Provider>,
    );
    act(() => {
      expect(controller.setPanel("sequence-tools", "analyze")).toMatchObject({
        applied: false,
        state: { activePanel: "export", blocked: true },
      });
      expect(controller.setPanel("sequence-tools", null)).toMatchObject({
        applied: false,
      });
      expect(controller.setPanel("sequence-tools", "export")).toMatchObject({
        applied: true,
      });
    });
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(controller.getSnapshots()[0]?.blocked).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Cancel pending export" }),
    );
    act(() => {
      expect(controller.setPanel("sequence-tools", "analyze")).toMatchObject({
        applied: true,
      });
    });
    expect(screen.getByText("Analysis settings")).toBeVisible();
  });

  it("discovers mounted hidden disclosures and reveals their parent tools through shared operations", async () => {
    const controller = new WorkbenchToolController();
    const user = userEvent.setup();
    render(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <WorkbenchTools
          group="sequence-tools"
          label="Sequence tools"
          panels={[
            {
              id: "inspect",
              label: "Inspect",
              content: (
                <WorkbenchDisclosure
                  id="sequence.outer"
                  label="Inspector details"
                >
                  <WorkbenchDisclosure
                    id="sequence.inner"
                    label="Nested methods"
                  >
                    <input
                      aria-label="Method notes"
                      defaultValue="Original notes"
                    />
                  </WorkbenchDisclosure>
                </WorkbenchDisclosure>
              ),
            },
            {
              id: "analyze",
              label: "Analyze",
              content: <p>Analysis settings</p>,
            },
          ]}
        />
      </WorkbenchToolControllerContext.Provider>,
    );
    const input = screen.getByLabelText("Method notes");
    expect(input).not.toBeVisible();
    expect(controller.getDisclosureSnapshots()).toEqual([
      expect.objectContaining({
        id: "sequence.inner",
        expanded: false,
        ancestors: ["sequence.outer"],
        location: { group: "sequence-tools", panel: "inspect" },
      }),
      expect.objectContaining({
        id: "sequence.outer",
        expanded: false,
        ancestors: [],
        location: { group: "sequence-tools", panel: "inspect" },
      }),
    ]);
    act(() => {
      expect(controller.setDisclosure("sequence.inner", true)).toMatchObject({
        applied: true,
        state: { disclosure: { id: "sequence.inner", expanded: true } },
      });
    });
    expect(input).toBeVisible();
    expect(screen.getByRole("button", { name: "Inspect" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.type(input, " updated");
    await user.click(screen.getByText("Nested methods"));
    expect(
      controller
        .getDisclosureSnapshots()
        .find(({ id }) => id === "sequence.inner")?.expanded,
    ).toBe(false);
    expect(input).not.toBeVisible();
    act(() => {
      controller.setDisclosure("sequence.inner", true);
    });
    expect(screen.getByLabelText("Method notes")).toBe(input);
    expect(input).toHaveValue("Original notes updated");
  });

  it("uses source-scoped disclosure pages and resets disclosure state on source replacement", () => {
    const controller = new WorkbenchToolController();
    const renderDisclosures = (
      active: WorkbenchToolController,
    ): React.ReactElement => (
      <WorkbenchToolControllerContext.Provider value={active}>
        <WorkbenchDisclosure id="sequence.first" label="First section">
          <p>First body</p>
        </WorkbenchDisclosure>
        <WorkbenchDisclosure id="sequence.second" label="Second section">
          <p>Second body</p>
        </WorkbenchDisclosure>
      </WorkbenchToolControllerContext.Provider>
    );
    const view = render(renderDisclosures(controller));
    act(() => {
      controller.setDisclosure("sequence.first", true);
    });
    const firstPage = controller.queryDisclosures({
      limit: 1,
      mode: "sequence",
    });
    expect(firstPage).toMatchObject({
      target: "workbench-disclosures",
      page: { count: 1, offset: 0, totalCount: 2 },
      truncated: true,
      items: [
        expect.objectContaining({ id: "sequence.first", expanded: true }),
      ],
    });
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const next = controller.queryDisclosures({
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
      mode: "sequence",
    });
    expect(next).toMatchObject({
      nextCursor: null,
      page: { count: 1, offset: 1, totalCount: 2 },
      items: [expect.objectContaining({ id: "sequence.second" })],
    });
    expect(() =>
      controller.queryDisclosures({
        cursor: firstPage.nextCursor ?? undefined,
        limit: 1,
        mode: "alignment",
      }),
    ).toThrow("Invalid workbench-disclosures cursor");
    const replacement = new WorkbenchToolController();
    view.rerender(renderDisclosures(replacement));
    expect(screen.getByText("First body")).not.toBeVisible();
    expect(
      replacement.getDisclosureSnapshots().every(({ expanded }) => !expanded),
    ).toBe(true);
    expect(() =>
      replacement.queryDisclosures({
        cursor: firstPage.nextCursor ?? undefined,
        limit: 1,
        mode: "sequence",
      }),
    ).toThrow("Invalid workbench-disclosures cursor");
  });

  it("cannot collapse pending manual-copy feedback through either disclosure path", async () => {
    const controller = new WorkbenchToolController();
    const user = userEvent.setup();
    render(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <WorkbenchDisclosure
          defaultExpanded
          id="sequence.copy"
          label="Copy details"
        >
          <textarea aria-label="Manual copy" readOnly value="ACGT" />
        </WorkbenchDisclosure>
      </WorkbenchToolControllerContext.Provider>,
    );
    act(() => {
      expect(controller.setDisclosure("sequence.copy", false)).toMatchObject({
        applied: false,
        state: { disclosure: { expanded: true, blocked: true } },
      });
    });
    await user.click(screen.getByText("Copy details"));
    expect(screen.getByLabelText("Manual copy")).toBeVisible();
    expect(controller.getDisclosureSnapshots()[0]).toMatchObject({
      expanded: true,
      blocked: true,
    });
  });

  it("shares explicit feedback dismissal without exposing source text or an approval operation", async () => {
    const controller = new WorkbenchToolController();
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    function CopyFeedback(): React.ReactElement {
      const [visible, setVisible] = useState(true);
      const dismiss = useWorkbenchFeedback({
        id: "sequence.copy-feedback",
        kind: "copy",
        label: "Copy feedback",
        message: visible ? "Clipboard unavailable" : undefined,
        onDismiss: () => {
          onDismiss();
          setVisible(false);
        },
        visible,
      });
      return (
        <div>
          {visible ? (
            <textarea
              aria-label="Copy sequence manually"
              readOnly
              value="ACGT_PRIVATE_SOURCE"
            />
          ) : null}
          <button onClick={() => dismiss()} type="button">
            Dismiss copy feedback
          </button>
          <button onClick={() => setVisible(true)} type="button">
            Show copy feedback
          </button>
        </div>
      );
    }
    render(
      <WorkbenchToolControllerContext.Provider value={controller}>
        <WorkbenchTools
          defaultPanel="copy"
          group="sequence-display"
          label="Display tools"
          panels={[
            { content: <CopyFeedback />, id: "copy", label: "Copy" },
            { content: <p>View settings</p>, id: "display", label: "Display" },
          ]}
        />
      </WorkbenchToolControllerContext.Provider>,
    );
    const query = controller.queryFeedback({ limit: 100, mode: "sequence" });
    expect(query).toMatchObject({
      target: "workbench-feedback",
      items: [
        {
          id: "sequence.copy-feedback",
          kind: "copy",
          label: "Copy feedback",
          message: "Clipboard unavailable",
          visible: true,
        },
      ],
    });
    expect(JSON.stringify(query)).not.toContain("ACGT_PRIVATE_SOURCE");
    act(() => {
      expect(controller.setPanel("sequence-display", "display").applied).toBe(
        false,
      );
      expect(
        controller.dismissFeedback("sequence.copy-feedback"),
      ).toMatchObject({
        applied: true,
        state: { feedback: { visible: false } },
      });
      expect(
        controller.dismissFeedback("sequence.copy-feedback"),
      ).toMatchObject({ applied: true });
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByLabelText("Copy sequence manually"),
    ).not.toBeInTheDocument();
    expect(controller.getFeedbackSnapshots()[0]?.visible).toBe(false);
    expect(
      controller.dismissFeedback("sequence.source-write-approval"),
    ).toMatchObject({ applied: false });
    await user.click(
      screen.getByRole("button", { name: "Show copy feedback" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Dismiss copy feedback" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(2);
    act(() => {
      expect(controller.setPanel("sequence-display", "display").applied).toBe(
        true,
      );
    });
    expect(screen.getByText("View settings")).toBeVisible();
  });
});
