import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  circularFeaturePath,
  coordinateFromFraction,
  normalizeSequenceAnnotationIndexState,
  SequenceOverview,
} from "./sequence-overview";
import {
  circularArrowPath,
  coordinateFromCircularPoint,
  createOverviewPlan,
  linearFeaturePath,
  localMapRanges,
  MAX_MAP_FEATURES,
  MAX_MAP_LANES,
  MAX_MAP_SEGMENTS,
  MIN_MAP_FEATURE_FRACTION,
} from "./sequence-overview-geometry";
import type { SequenceFeature, SequenceRecord } from "./types";

describe("sequence overview geometry", () => {
  it("maps overview fractions to clamped one-based coordinates", () => {
    expect(coordinateFromFraction(0, 100)).toBe(1);
    expect(coordinateFromFraction(0.49, 100)).toBe(50);
    expect(coordinateFromFraction(1, 100)).toBe(100);
    expect(coordinateFromFraction(4, 100)).toBe(100);
  });

  it("builds finite small and large circular feature arcs", () => {
    expect(circularFeaturePath(1, 10, 100, 50, 50, 30)).toMatch(/^M /u);
    const large = circularFeaturePath(1, 80, 100, 50, 50, 30);
    expect(large).toContain(" 0 1 1 ");
    expect(large).not.toContain("NaN");
  });

  it("draws an entire circular interval with two arcs and preserves strand direction", () => {
    expect(
      circularFeaturePath(1, 100, 100, 50, 50, 30).match(/ A /gu),
    ).toHaveLength(2);
    const range = { start: 1, end: 30 };
    const forward = circularArrowPath(range, 100, 50, 30, "+");
    const reverse = circularArrowPath(range, 100, 50, 30, "-");
    expect(forward).not.toEqual(reverse);
    expect(forward).toContain(" 0 0 1 ");
    expect(reverse).toContain(" 0 0 0 ");
    expect(
      circularArrowPath({ start: 1, end: 100 }, 100, 50, 30, "?"),
    ).not.toMatch(/NaN|Infinity/u);
    expect(linearFeaturePath(10, 20, 40, 10, "+")).toContain("L 50 25");
    expect(linearFeaturePath(10, 20, 40, 10, "-")).toContain("L 10 25");
    expect(linearFeaturePath(10, 20, 40, 10, "?")).not.toContain(" L ");
  });

  it("maps circular cardinal points to inclusive coordinates", () => {
    expect(coordinateFromCircularPoint(0, -1, 100)).toBe(1);
    expect(coordinateFromCircularPoint(1, 0, 100)).toBe(26);
    expect(coordinateFromCircularPoint(0, 1, 100)).toBe(51);
    expect(coordinateFromCircularPoint(-1, 0, 100)).toBe(76);
  });

  it("retains visible markers for one-base circular features, including at the origin", () => {
    const path = circularArrowPath(
      { start: 1, end: 1 },
      10_000_000,
      200,
      100,
      "+",
    );
    expect(path).toContain("198.");
    expect(path).toContain("201.");
    expect(path).not.toContain("NaN");
    const selection = circularFeaturePath(
      1,
      1,
      10_000_000,
      200,
      200,
      80,
      MIN_MAP_FEATURE_FRACTION,
    );
    expect(selection).not.toContain("M 200.000 120.000");
    const plan = createOverviewPlan(
      makeRecord({
        length: 10_000_000,
        topology: "circular",
        features: [
          makeFeature({ id: "first", start: 1, end: 1 }),
          makeFeature({ id: "last", start: 10_000_000, end: 10_000_000 }),
        ],
      }),
      "forward",
    );
    expect(plan.features.map(({ lane }) => lane)).toEqual([0, 1]);
  });

  it("mirrors actual compound intervals and strand without changing source features or qualifiers", () => {
    const feature = makeFeature({
      start: 1,
      end: 100,
      segments: [
        { start: 90, end: 100 },
        { start: 1, end: 10 },
        { start: 20, end: 30, remoteAccession: "OTHER.1" },
      ],
      qualifiers: { note: ["joined across origin", "source annotation"] },
    });
    const record = makeRecord({ features: [feature], topology: "circular" });
    const original = structuredClone(record);
    const plan = createOverviewPlan(record, "reverse-complement");
    expect(plan.features[0]).toMatchObject({
      feature,
      segments: [
        { start: 1, end: 11 },
        { start: 91, end: 100 },
      ],
      strand: "-",
    });
    expect(plan.features[0]?.feature).toBe(feature);
    expect(plan.remoteSegments).toBe(1);
    expect(record).toEqual(original);
  });

  it("splits wrapped intervals only for a circular molecule and never draws out-of-range intervals", () => {
    expect(localMapRanges({ start: 90, end: 10 }, 100, true)).toEqual([
      { start: 90, end: 100 },
      { start: 1, end: 10 },
    ]);
    expect(localMapRanges({ start: 90, end: 10 }, 100)).toEqual([]);
    expect(localMapRanges({ start: 101, end: 120 }, 100)).toEqual([]);
    expect(localMapRanges({ start: Number.NaN, end: 10 }, 100)).toEqual([]);
  });

  it("keeps overlapping features on separate lanes and gives a selected feature priority", () => {
    const features = Array.from({ length: MAX_MAP_LANES + 1 }, (_, index) =>
      makeFeature({ id: `feature-${index}` }),
    );
    const record = makeRecord({ features });
    const plan = createOverviewPlan(
      record,
      "forward",
      `feature-${MAX_MAP_LANES}`,
    );
    expect(plan.features).toHaveLength(MAX_MAP_LANES);
    expect(plan.omittedForDensity).toBe(1);
    expect(plan.features[0]?.feature.id).toBe(`feature-${MAX_MAP_LANES}`);
    expect(new Set(plan.features.map(({ lane }) => lane)).size).toBe(
      MAX_MAP_LANES,
    );
  });

  it("bounds map work while keeping annotations beyond the first map page selectable", () => {
    const record = manyFeatureRecord(MAX_MAP_FEATURES + 5);
    const selectedId = record.features.at(-1)?.id;
    const plan = createOverviewPlan(record, "forward", selectedId);
    expect(plan.features).toHaveLength(MAX_MAP_FEATURES);
    expect(plan.features[0]?.feature.id).toBe(selectedId);
    expect(plan.omittedForLimit).toBe(5);
    const segmented = createOverviewPlan(
      makeRecord({
        length: 10_000,
        features: [
          makeFeature({
            segments: Array.from(
              { length: MAX_MAP_SEGMENTS + 3 },
              (_, index) => ({ start: index * 2 + 1, end: index * 2 + 1 }),
            ),
          }),
        ],
      }),
      "forward",
    );
    expect(segmented.features[0]?.segments).toHaveLength(MAX_MAP_SEGMENTS);
    expect(segmented.omittedSegments).toBe(3);
  });
});

describe("sequence overview interaction", () => {
  it("keeps small-map feature names visible when the full index is collapsed", () => {
    const onChange = vi.fn();
    const props = renderOverview({
      layout: "circular",
      record: manyFeatureRecord(9),
      annotationIndex: { query: "", page: 0, expanded: false, onChange },
    });
    const labels = screen.getByRole("list", {
      name: "Visible map annotation labels",
    });
    expect(labels).toBeVisible();
    expect(within(labels).getAllByRole("listitem")).toHaveLength(9);
    const label = within(labels).getByRole("button", {
      name: /^Inspect annotation 8/u,
    });
    expect(label).toHaveAttribute(
      "title",
      expect.stringContaining("annotation 8"),
    );
    fireEvent.click(label);
    expect(props.onSelectFeature).toHaveBeenLastCalledWith("feature-8");
    props.rerender({
      annotationIndex: { query: "", page: 0, expanded: true, onChange },
    });
    expect(
      screen.queryByRole("list", { name: "Visible map annotation labels" }),
    ).not.toBeInTheDocument();
  });

  it("bounds compact labels to drawn features and opens the existing index for the rest", () => {
    const onChange = vi.fn();
    const record = manyFeatureRecord(13);
    record.features.push(
      makeFeature({
        id: "remote-only",
        label: "Remote only",
        segments: [{ start: 10, end: 80, remoteAccession: "OTHER.1" }],
      }),
    );
    renderOverview({
      layout: "circular",
      record,
      selectedFeatureId: "feature-12",
      annotationIndex: { query: "", page: 0, expanded: false, onChange },
    });
    const labels = screen.getByRole("list", {
      name: "Visible map annotation labels",
    });
    expect(within(labels).getAllByRole("listitem")).toHaveLength(12);
    expect(
      within(labels).getByRole("button", { name: /^Inspect annotation 12/u }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(labels).queryByText("Remote only")).not.toBeInTheDocument();
    expect(screen.getByText("12 of 13 mapped annotations")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Browse all 14 annotations" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ expanded: true });
  });

  it.each(["linear", "circular", "split"] as const)(
    "renders the requested %s layout without an implicit second map",
    (layout) => {
      renderOverview({ layout });
      expect(screen.queryByTestId("linear-sequence-map") != null).toBe(
        layout !== "circular",
      );
      expect(screen.queryByTestId("circular-sequence-map") != null).toBe(
        layout !== "linear",
      );
    },
  );

  it("selects a map feature with pointer, Enter, and Space without also jumping to the ruler", () => {
    const props = renderOverview({ selectedFeatureId: "feature-1" });
    const feature = screen.getByRole("button", { name: /^Select test gene/u });
    expect(feature).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(feature);
    fireEvent.keyDown(feature, { key: "Enter" });
    fireEvent.keyDown(feature, { key: " " });
    expect(props.onSelectFeature).toHaveBeenCalledTimes(3);
    expect(props.onSelectFeature).toHaveBeenLastCalledWith("feature-1");
    expect(props.onJump).not.toHaveBeenCalled();
  });

  it("returns source coordinates from reverse-complement map navigation and mirrors selection intervals", () => {
    const props = renderOverview({
      orientation: "reverse-complement",
      selection: {
        recordId: "record-1",
        start: 90,
        end: 10,
        segments: [
          { start: 90, end: 100 },
          { start: 1, end: 10 },
        ],
      },
    });
    const map = screen.getByRole("group", {
      name: "Linear map of Test plasmid",
    });
    vi.spyOn(map, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 1_000, 100),
    );
    fireEvent.click(map, { clientX: 24, clientY: 50 });
    expect(props.onJump).toHaveBeenLastCalledWith(100);
    fireEvent.click(map, { clientX: 976, clientY: 50 });
    expect(props.onJump).toHaveBeenLastCalledWith(1);
    expect(
      Array.from(map.querySelectorAll("[data-selection-range]")).map((node) =>
        node.getAttribute("data-selection-range"),
      ),
    ).toEqual(["1-11", "91-100"]);
    fireEvent.change(
      screen.getByRole("slider", { name: "Navigate map by coordinate" }),
      { target: { value: "26" } },
    );
    expect(props.onJump).toHaveBeenLastCalledWith(75);
  });

  it("navigates circular maps by angle without treating the molecule label as a coordinate", () => {
    const props = renderOverview({ layout: "circular" });
    const map = screen.getByRole("group", {
      name: "Circular map of Test plasmid",
    });
    vi.spyOn(map, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 400, 400),
    );
    fireEvent.click(map, { clientX: 200, clientY: 200 });
    expect(props.onJump).not.toHaveBeenCalled();
    fireEvent.click(map, { clientX: 200, clientY: 30 });
    expect(props.onJump).toHaveBeenLastCalledWith(1);
    fireEvent.click(map, { clientX: 370, clientY: 200 });
    expect(props.onJump).toHaveBeenLastCalledWith(26);
  });

  it("shares the active source coordinate between pointer navigation, both keyboard rulers, and orientation changes", () => {
    const props = renderOverview({ layout: "split" });
    const map = screen.getByRole("group", {
      name: "Linear map of Test plasmid",
    });
    vi.spyOn(map, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 1_000, 100),
    );
    fireEvent.click(map, { clientX: 872, clientY: 50 });
    expect(props.onJump).toHaveBeenLastCalledWith(90);
    props.rerender({ selection: { recordId: "record-1", start: 90, end: 90 } });
    const sliders = screen.getAllByRole("slider", {
      name: "Navigate map by coordinate",
    });
    for (const slider of sliders) expect(slider).toHaveValue("90");
    fireEvent.change(sliders[0]!, { target: { value: "91" } });
    expect(props.onJump).toHaveBeenLastCalledWith(91);
    props.rerender({
      orientation: "reverse-complement",
      selection: { recordId: "record-1", start: 91, end: 91 },
    });
    for (const slider of screen.getAllByRole("slider")) {
      expect(slider).toHaveValue("10");
      expect(slider).toHaveAttribute("aria-valuetext", "Source coordinate 91");
    }
  });

  it("accepts controlled annotation-index and origin-form state and emits the same UI patches", () => {
    const onChange = vi.fn();
    const onOriginRangeExpandedChange = vi.fn();
    const record = { ...manyFeatureRecord(65), topology: "circular" as const };
    const props = renderOverview({
      record,
      annotationIndex: { query: "", page: 1, expanded: true, onChange },
      originRangeExpanded: true,
      onOriginRangeExpandedChange,
    });
    expect(screen.getByText("31–60 of 65 annotations")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Origin-spanning selection start",
      }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Next annotation page" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ page: 2 });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Find annotation in map index" }),
      { target: { value: "annotation 64" } },
    );
    expect(onChange).toHaveBeenLastCalledWith({
      query: "annotation 64",
      page: 0,
    });
    props.rerender({
      annotationIndex: {
        query: "annotation 64",
        page: 0,
        expanded: true,
        onChange,
      },
      originRangeExpanded: false,
    });
    expect(screen.getByText("1–1 of 1 matches")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Origin-spanning selection start"),
    ).not.toBeVisible();
    expect(
      normalizeSequenceAnnotationIndexState(record, {
        query: "annotation 64",
        page: 20,
        expanded: true,
      }),
    ).toEqual({ query: "annotation 64", page: 0, expanded: true });
    expect(
      normalizeSequenceAnnotationIndexState(record, {
        query: "",
        page: 20,
        expanded: true,
      }).page,
    ).toBe(2);
  });

  it("discloses limits and provides search and pagination for every loaded annotation", () => {
    const props = renderOverview({
      layout: "circular",
      record: manyFeatureRecord(205),
    });
    const index = screen.getByRole("list", { name: "Map annotation index" });
    expect(within(index).getAllByRole("listitem")).toHaveLength(30);
    expect(screen.getByText("1–30 of 205 annotations")).toBeInTheDocument();
    expect(screen.getByTestId("sequence-map-limits")).toHaveTextContent(
      "limited to 200 annotations",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Next annotation page" }),
    );
    expect(screen.getByText("31–60 of 205 annotations")).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Find annotation in map index" }),
      { target: { value: "annotation 204" } },
    );
    expect(within(index).getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(
      within(index).getByRole("button", { name: /^annotation 204/u }),
    );
    expect(props.onSelectFeature).toHaveBeenLastCalledWith("feature-204");
  });

  it("validates source-coordinate origin selections before forwarding them", () => {
    const props = renderOverview({
      orientation: "reverse-complement",
      record: makeRecord({ topology: "circular" }),
    });
    fireEvent.click(screen.getByText("Select across the origin"));
    const start = screen.getByRole("spinbutton", {
      name: "Origin-spanning selection start",
    });
    const end = screen.getByRole("spinbutton", {
      name: "Origin-spanning selection end",
    });
    fireEvent.change(start, { target: { value: "10" } });
    fireEvent.change(end, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Select range" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "start greater than end",
    );
    expect(props.onSelectRange).not.toHaveBeenCalled();
    fireEvent.change(start, { target: { value: "90" } });
    fireEvent.change(end, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Select range" }));
    expect(props.onSelectRange).toHaveBeenLastCalledWith(90, 10, true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function renderOverview(
  overrides: Partial<ComponentProps<typeof SequenceOverview>> = {},
) {
  const props = {
    layout: "linear" as const,
    onJump: vi.fn(),
    onSelectFeature: vi.fn(),
    onSelectRange: vi.fn(),
    orientation: "forward" as const,
    record: makeRecord(),
    synchronizedViews: true,
    viewport: null,
    ...overrides,
  };
  const view = render(createElement(SequenceOverview, props));
  return {
    ...props,
    rerender: (patch: Partial<ComponentProps<typeof SequenceOverview>>) =>
      view.rerender(createElement(SequenceOverview, { ...props, ...patch })),
  };
}

function makeFeature(
  overrides: Partial<SequenceFeature> = {},
): SequenceFeature {
  return {
    id: "feature-1",
    label: "test gene",
    type: "gene",
    start: 10,
    end: 80,
    strand: "+",
    qualifiers: {},
    ...overrides,
  };
}

function makeRecord(overrides: Partial<SequenceRecord> = {}): SequenceRecord {
  // Deliberately synthetic coordinate-only fixtures, not biological evidence.
  return {
    id: "record-1",
    sourceLabel: "Test plasmid",
    features: [makeFeature()],
    length: 100,
    sequence: "A".repeat(100),
    molecule: "dna",
    metadata: {},
    ...overrides,
  };
}

function manyFeatureRecord(count: number): SequenceRecord {
  return makeRecord({
    length: 100_000,
    features: Array.from({ length: count }, (_, index) =>
      makeFeature({
        id: `feature-${index}`,
        label: `annotation ${index}`,
        start: index * 450 + 1,
        end: index * 450 + 40,
      }),
    ),
  });
}
