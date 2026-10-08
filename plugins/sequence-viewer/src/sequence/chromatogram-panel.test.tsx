import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChromatogramPanel } from "./chromatogram-panel";
import type {
  ChromatogramBase,
  SequenceChromatogram,
  SequenceRecord,
} from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ChromatogramPanel", () => {
  it("renders genuine channel samples with called bases and Phred quality", () => {
    const record = traceRecord({ sequence: "ACGT" });
    const { container } = render(
      <ChromatogramPanel onSelectRange={vi.fn()} record={record} />,
    );

    expect(screen.getByText(/Original read orientation/)).toBeInTheDocument();
    expect(screen.getByRole("figure")).toHaveAccessibleName(
      /bases 1 to 4, four signal channels in original read orientation/,
    );
    expect(screen.getByText("Phred quality below calls")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Base 3, G, Phred quality 32" }),
    ).toBeInTheDocument();
    const traces = container.querySelectorAll("path[data-channel]");
    expect(traces).toHaveLength(4);
    expect(
      new Set(Array.from(traces, (trace) => trace.getAttribute("d"))).size,
    ).toBe(4);
    // The A channel's observed peak is 100; a common 0..100 scale maps it to y=10.
    expect(
      container.querySelector('path[data-channel="A"]')?.getAttribute("d"),
    ).toContain(`L${(12 + (8 / 47) * 776).toFixed(2)},10.00`);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("selects 1-based source coordinates, supports Shift ranges, and marks selection", async () => {
    const record = traceRecord();
    const onSelectRange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ChromatogramPanel onSelectRange={onSelectRange} record={record} />,
    );
    await user.click(screen.getByRole("button", { name: /^Base 3,/ }));
    expect(onSelectRange).toHaveBeenLastCalledWith(3, 3);
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /^Base 6,/ }));
    await user.keyboard("{/Shift}");
    expect(onSelectRange).toHaveBeenLastCalledWith(3, 6);

    rerender(
      <ChromatogramPanel
        onSelectRange={onSelectRange}
        record={record}
        selection={{ end: 6, recordId: record.id, start: 3 }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Base 3,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Base 6,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Base 7,/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects the nearest called peak when the signal is clicked", () => {
    const record = traceRecord();
    const onSelectRange = vi.fn();
    const { container } = render(
      <ChromatogramPanel onSelectRange={onSelectRange} record={record} />,
    );
    const svg = container.querySelector("svg");
    if (svg == null) throw new Error("Expected a trace SVG.");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 0, 800, 152),
    );
    // Fourth called base is at source sample 32 of 80, with 12px chart padding.
    fireEvent.click(svg, { clientX: 20 + 12 + (32 / 79) * 776 });
    expect(onSelectRange).toHaveBeenCalledWith(4, 4);
  });

  it("moves keyboard focus across windows and selects with native Enter/Space", async () => {
    const record = traceRecord({ sequence: "ACGT".repeat(30) });
    const onSelectRange = vi.fn();
    render(<ChromatogramPanel onSelectRange={onSelectRange} record={record} />);

    screen.getByRole("button", { name: /^Base 1,/ }).focus();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(screen.getByRole("button", { name: /^Base 2,/ })).toHaveFocus();
    expect(onSelectRange).toHaveBeenLastCalledWith(2, 2);
    await userEvent.keyboard("{End} ");
    expect(screen.getByRole("button", { name: /^Base 120,/ })).toHaveFocus();
    expect(onSelectRange).toHaveBeenLastCalledWith(120, 120);
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onSelectRange).toHaveBeenLastCalledWith(119, 120);
  });

  it("pans and zooms a bounded base window without changing the source selection", async () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    const onSelectRange = vi.fn();
    render(<ChromatogramPanel onSelectRange={onSelectRange} record={record} />);

    expect(screen.getByText("Bases 1–36 of 200")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Next chromatogram window" }),
    );
    expect(screen.getByText("Bases 37–72 of 200")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom in chromatogram" }),
    );
    expect(screen.getByText("Bases 37–54 of 200")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Previous chromatogram window" }),
    );
    expect(screen.getByText("Bases 19–36 of 200")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("slider", { name: "Chromatogram window start" }),
      {
        target: { value: "170" },
      },
    );
    expect(screen.getByText("Bases 170–187 of 200")).toBeInTheDocument();
    expect(onSelectRange).not.toHaveBeenCalled();
  });

  it("keeps confidence absent when the source has no quality values", () => {
    const record = traceRecord({ quality: null });
    render(<ChromatogramPanel onSelectRange={vi.fn()} record={record} />);

    expect(
      screen.getByText("No called-base confidence provided"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Base 1, A" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Phred/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quality 0/ }),
    ).not.toBeInTheDocument();
  });

  it("labels SCF source confidence honestly and leaves an ambiguous call unscored", () => {
    const record = traceRecord({
      format: "scf",
      quality: [90, null, 65, 0],
      qualityEncoding: "source-confidence",
      sequence: "ANCT",
    });
    render(<ChromatogramPanel onSelectRange={vi.fn()} record={record} />);

    expect(
      screen.getByText("Source confidence below calls"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Base 1, A, Source confidence 90" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Base 2, N" })).toHaveTextContent(
      "—",
    );
    expect(
      screen.getByRole("button", { name: "Base 4, T, Source confidence 0" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Phred/)).not.toBeInTheDocument();
  });

  it("retains signed baseline and narrow spikes while bounding long paths on a narrow viewport", () => {
    setObservedWidth(220);
    const record = traceRecord({ sequence: "ACGT", samplesPerBase: 2_000 });
    const trace = record.chromatogram;
    if (trace == null) throw new Error("Expected test trace samples.");
    trace.channels.A[1_777] = 1_000;
    trace.channels.C[777] = -300;
    const { container } = render(
      <ChromatogramPanel onSelectRange={vi.fn()} record={record} />,
    );

    expect(
      screen.getByText("Trace display uses a min/max envelope"),
    ).toBeInTheDocument();
    const traces = container.querySelectorAll("path[data-channel]");
    for (const path of Array.from(traces)) {
      expect(
        path.getAttribute("d")?.match(/[ML]/g)?.length,
      ).toBeLessThanOrEqual(440);
      expect(path.getAttribute("d")).not.toMatch(/NaN|Infinity/);
    }
    // Preserve both actual extremes at their sample positions, not averaged bins.
    expect(
      container.querySelector('path[data-channel="A"]')?.getAttribute("d"),
    ).toContain(`${(12 + (1_777 / 11_999) * 196).toFixed(2)},10.00`);
    expect(
      container.querySelector('path[data-channel="C"]')?.getAttribute("d"),
    ).toContain(`${(12 + (777 / 11_999) * 196).toFixed(2)},142.00`);
    expect(
      Number(container.querySelector("line")?.getAttribute("y1")),
    ).toBeLessThan(142);
  });

  it("caps labels at 100 even on a wide viewport and reduces the window on narrow screens", async () => {
    setObservedWidth(4_000);
    const record = traceRecord({ sequence: "ACGT".repeat(200) });
    const { container, unmount } = render(
      <ChromatogramPanel onSelectRange={vi.fn()} record={record} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom out chromatogram" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom out chromatogram" }),
    );
    expect(container.querySelectorAll("button[data-coordinate]")).toHaveLength(
      100,
    );
    expect(
      screen.getByRole("button", { name: "Zoom out chromatogram" }),
    ).toBeDisabled();
    unmount();
    setObservedWidth(220);
    const narrow = render(
      <ChromatogramPanel onSelectRange={vi.fn()} record={record} />,
    );
    expect(
      narrow.container.querySelectorAll("button[data-coordinate]"),
    ).toHaveLength(10);
  });

  it("follows external selections in this record but ignores another record's coordinates", () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    const onSelectRange = vi.fn();
    const { rerender } = render(
      <ChromatogramPanel onSelectRange={onSelectRange} record={record} />,
    );
    rerender(
      <ChromatogramPanel
        onSelectRange={onSelectRange}
        record={record}
        selection={{ end: 151, recordId: record.id, start: 150 }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Base 150,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Base 151,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    rerender(
      <ChromatogramPanel
        onSelectRange={onSelectRange}
        record={record}
        selection={{ end: 2, recordId: "different-record", start: 1 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Base 1,/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Base 150,/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("resets pan and zoom when the record or underlying trace changes", async () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    const onSelectRange = vi.fn();
    const { rerender } = render(
      <ChromatogramPanel onSelectRange={onSelectRange} record={record} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Next chromatogram window" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom in chromatogram" }),
    );
    const otherRecord = traceRecord({
      id: "other-read",
      sequence: "TGCA".repeat(50),
    });
    rerender(
      <ChromatogramPanel onSelectRange={onSelectRange} record={otherRecord} />,
    );
    expect(screen.getByText("Bases 1–36 of 200")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Base 1, T,/ }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Next chromatogram window" }),
    );
    rerender(
      <ChromatogramPanel
        onSelectRange={onSelectRange}
        record={traceRecord({ id: "other-read", sequence: "ACGT".repeat(50) })}
        selection={{ end: 172, recordId: "other-read", start: 172 }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Base 172,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("button", { name: /^Base \d+,/ })).toHaveLength(
      36,
    );
  });

  it("does not create a chromatogram for a record without trace data", () => {
    const { chromatogram: _trace, ...record } = traceRecord();
    const { container } = render(
      <ChromatogramPanel onSelectRange={vi.fn()} record={record} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("routes all pan, zoom, and slider changes through the controlled view callback", async () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    const onViewChange = vi.fn();
    const props = { onSelectRange: vi.fn(), onViewChange, record };
    const { rerender } = render(
      <ChromatogramPanel
        {...props}
        view={{ basesPerWindow: 20, firstBase: 41 }}
      />,
    );
    expect(screen.getByText("Bases 41–60 of 200")).toBeInTheDocument();
    expect(onViewChange).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Next chromatogram window" }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith({
      basesPerWindow: 20,
      firstBase: 61,
    });
    // Controlled state changes only after the parent applies the requested update.
    expect(screen.getByText("Bases 41–60 of 200")).toBeInTheDocument();
    rerender(
      <ChromatogramPanel
        {...props}
        view={{ basesPerWindow: 20, firstBase: 61 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom in chromatogram" }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith({
      basesPerWindow: 10,
      firstBase: 61,
    });
    rerender(
      <ChromatogramPanel
        {...props}
        view={{ basesPerWindow: 10, firstBase: 61 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Zoom out chromatogram" }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith({
      basesPerWindow: 20,
      firstBase: 61,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Previous chromatogram window" }),
    );
    expect(onViewChange).toHaveBeenLastCalledWith({
      basesPerWindow: 10,
      firstBase: 51,
    });
    fireEvent.change(
      screen.getByRole("slider", { name: "Chromatogram window start" }),
      {
        target: { value: "140" },
      },
    );
    expect(onViewChange).toHaveBeenLastCalledWith({
      basesPerWindow: 10,
      firstBase: 140,
    });
  });

  it("does not override explicit controlled windows but follows a changed external selection", () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    const onViewChange = vi.fn();
    const props = { onSelectRange: vi.fn(), onViewChange, record };
    const firstSelection = { end: 1, recordId: record.id, start: 1 };
    const { rerender } = render(
      <ChromatogramPanel
        {...props}
        selection={firstSelection}
        view={{ basesPerWindow: 20, firstBase: 1 }}
      />,
    );
    rerender(
      <ChromatogramPanel
        {...props}
        selection={firstSelection}
        view={{ basesPerWindow: 20, firstBase: 101 }}
      />,
    );
    expect(screen.getByText("Bases 101–120 of 200")).toBeInTheDocument();
    expect(onViewChange).not.toHaveBeenCalled();
    const nextSelection = { end: 172, recordId: record.id, start: 170 };
    rerender(
      <ChromatogramPanel
        {...props}
        selection={nextSelection}
        view={{ basesPerWindow: 20, firstBase: 101 }}
      />,
    );
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith({
      basesPerWindow: 20,
      firstBase: 160,
    });
    rerender(
      <ChromatogramPanel
        {...props}
        selection={nextSelection}
        view={{ basesPerWindow: 20, firstBase: 160 }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Base 170,/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(onViewChange).toHaveBeenCalledTimes(1);
  });

  it("keeps controlled first-base coordinates literal at the end of the read", () => {
    const record = traceRecord({ sequence: "ACGT".repeat(50) });
    render(
      <ChromatogramPanel
        onSelectRange={vi.fn()}
        onViewChange={vi.fn()}
        record={record}
        view={{ basesPerWindow: 40, firstBase: 199 }}
      />,
    );
    expect(screen.getByText("Bases 199–200 of 200")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Base \d+,/ })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole("slider", { name: "Chromatogram window start" }),
    ).toHaveValue("199");
  });

  it("preserves an explicit restored window when selection and view change together", () => {
    const record = traceRecord({ sequence: "ACGT".repeat(25) });
    const onViewChange = vi.fn();
    const props = { onSelectRange: vi.fn(), onViewChange, record };
    const { rerender } = render(
      <ChromatogramPanel
        {...props}
        selection={{ end: 25, recordId: record.id, start: 25 }}
        view={{ basesPerWindow: 20, firstBase: 20 }}
      />,
    );
    rerender(
      <ChromatogramPanel
        {...props}
        selection={{ end: 1, recordId: record.id, start: 1 }}
        view={{ basesPerWindow: 20, firstBase: 60 }}
      />,
    );

    expect(screen.getByText("Bases 60–79 of 100")).toBeInTheDocument();
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("honors a restore epoch when the restored window is unchanged, then follows later selection-only jumps", () => {
    const record = traceRecord({ sequence: "ACGT".repeat(25) });
    const onViewChange = vi.fn();
    const props = { onSelectRange: vi.fn(), onViewChange, record };
    const view = { basesPerWindow: 20, firstBase: 60 };
    const { rerender } = render(
      <ChromatogramPanel
        {...props}
        restorationEpoch={0}
        selection={{ end: 65, recordId: record.id, start: 65 }}
        view={view}
      />,
    );
    rerender(
      <ChromatogramPanel
        {...props}
        restorationEpoch={1}
        selection={{ end: 1, recordId: record.id, start: 1 }}
        view={view}
      />,
    );
    expect(screen.getByText("Bases 60–79 of 100")).toBeInTheDocument();
    expect(onViewChange).not.toHaveBeenCalled();

    rerender(
      <ChromatogramPanel
        {...props}
        restorationEpoch={1}
        selection={{ end: 5, recordId: record.id, start: 5 }}
        view={view}
      />,
    );
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith({
      basesPerWindow: 20,
      firstBase: 1,
    });
  });

  it("uses a changed external selection as the new Shift-selection anchor", async () => {
    const record = traceRecord();
    const onSelectRange = vi.fn();
    const { rerender } = render(
      <ChromatogramPanel onSelectRange={onSelectRange} record={record} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Base 2,/ }));
    rerender(
      <ChromatogramPanel
        onSelectRange={onSelectRange}
        record={record}
        selection={{ end: 5, recordId: record.id, start: 5 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Base 8,/ }), {
      shiftKey: true,
    });
    expect(onSelectRange).toHaveBeenLastCalledWith(5, 8);
  });
});

/** Synthetic trace fixture only; no instrument data or binary fixture is implied. */
function traceRecord({
  format = "abif",
  id = "synthetic-trace",
  quality,
  qualityEncoding = "phred",
  samplesPerBase = 8,
  sequence = "ACGTACGT",
}: {
  format?: SequenceChromatogram["format"];
  id?: string;
  quality?: SequenceChromatogram["quality"] | null;
  qualityEncoding?: SequenceChromatogram["qualityEncoding"];
  samplesPerBase?: number;
  sequence?: string;
} = {}): SequenceRecord {
  const sampleCount = (sequence.length + 2) * samplesPerBase;
  const channels: Record<ChromatogramBase, Array<number>> = {
    A: Array<number>(sampleCount).fill(0),
    C: Array<number>(sampleCount).fill(0),
    G: Array<number>(sampleCount).fill(0),
    T: Array<number>(sampleCount).fill(0),
  };
  const peakLocations = Array.from(
    { length: sequence.length },
    (_, index) => (index + 1) * samplesPerBase,
  );
  for (let index = 0; index < sequence.length; index += 1) {
    const base = sequence[index];
    if (base !== "A" && base !== "C" && base !== "G" && base !== "T") continue;
    const peak = peakLocations[index];
    const amplitude = { A: 100, C: 90, G: 80, T: 70 }[base];
    channels[base][peak - 1] = amplitude / 3;
    channels[base][peak] = amplitude;
    channels[base][peak + 1] = amplitude / 3;
  }
  return {
    chromatogram: {
      channels,
      format,
      peakLocations,
      quality:
        quality === null
          ? undefined
          : (quality ??
            Array.from(
              { length: sequence.length },
              (_, index) => 30 + (index % 10),
            )),
      qualityEncoding: quality === null ? undefined : qualityEncoding,
      sampleCount,
    },
    features: [],
    id,
    length: sequence.length,
    metadata: {},
    molecule: "dna",
    sequence,
    sourceLabel: "QA synthetic trace",
    topology: "linear",
  };
}

function setObservedWidth(width: number): void {
  class FixedResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    disconnect(): void {}
    unobserve(): void {}
    observe(target: Element): void {
      this.callback(
        [
          {
            borderBoxSize: [],
            contentBoxSize: [],
            contentRect: new DOMRect(0, 0, width, 220),
            devicePixelContentBoxSize: [],
            target,
          },
        ],
        this,
      );
    }
  }
  vi.stubGlobal("ResizeObserver", FixedResizeObserver);
}
