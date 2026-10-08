import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getMsaViewportSlice,
  MSA_ROW_HEIGHT_PX,
  type MsaViewportSlice,
} from "./virtualization";

type MsaViewportMetrics = {
  height: number;
  scrollLeft: number;
  scrollTop: number;
  width: number;
};

const EMPTY_METRICS: MsaViewportMetrics = {
  height: 0,
  scrollLeft: 0,
  scrollTop: 0,
  width: 0,
};

export function useMsaViewport({
  alignedLength,
  cellWidth,
  rowCount,
  staticRowCount,
}: {
  alignedLength: number;
  cellWidth: number;
  rowCount: number;
  staticRowCount: number;
}): {
  metrics: MsaViewportMetrics;
  scrollHorizontallyBy: (deltaX: number) => void;
  scrollToColumn: (column: number) => void;
  scrollToRow: (rowIndex: number) => void;
  setScrollContainerRef: (node: HTMLDivElement | null) => void;
  slice: MsaViewportSlice;
} {
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [metrics, setMetrics] = useState<MsaViewportMetrics>(EMPTY_METRICS);
  const animationFrameRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const updateMetrics = useCallback((node: HTMLDivElement): void => {
    setMetrics({
      height: node.clientHeight,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      width: node.clientWidth,
    });
  }, []);

  const setScrollContainerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      scrollContainerRef.current = node;
      setScrollContainer(node);
      if (node != null) {
        updateMetrics(node);
      }
    },
    [updateMetrics],
  );

  useEffect(() => {
    if (scrollContainer == null) {
      return;
    }
    const scheduleMetricsUpdate = (): void => {
      if (animationFrameRef.current != null) {
        return;
      }
      animationFrameRef.current = scheduleFrame(() => {
        animationFrameRef.current = null;
        updateMetrics(scrollContainer);
      });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMetricsUpdate);
    observer?.observe(scrollContainer);
    scrollContainer.addEventListener("scroll", scheduleMetricsUpdate, {
      passive: true,
    });
    return (): void => {
      if (animationFrameRef.current != null) {
        cancelFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      observer?.disconnect();
      scrollContainer.removeEventListener("scroll", scheduleMetricsUpdate);
    };
  }, [scrollContainer, updateMetrics]);

  const slice = useMemo(
    () =>
      getMsaViewportSlice({
        alignedLength,
        cellWidth,
        height: metrics.height,
        rowCount,
        scrollLeft: metrics.scrollLeft,
        scrollTop: metrics.scrollTop,
        staticRowCount,
        width: metrics.width,
      }),
    [
      alignedLength,
      cellWidth,
      metrics.height,
      metrics.scrollLeft,
      metrics.scrollTop,
      metrics.width,
      rowCount,
      staticRowCount,
    ],
  );

  const scrollToColumn = useCallback(
    (column: number): void => {
      const node = scrollContainerRef.current;
      if (node == null) {
        return;
      }
      const nextScrollLeft = Math.max(0, column) * cellWidth;
      node.scrollLeft = nextScrollLeft;
      updateMetrics(node);
    },
    [cellWidth, updateMetrics],
  );

  const scrollHorizontallyBy = useCallback(
    (deltaX: number): void => {
      const node = scrollContainerRef.current;
      if (node == null || deltaX === 0) {
        return;
      }
      node.scrollLeft += deltaX;
      updateMetrics(node);
    },
    [updateMetrics],
  );

  const scrollToRow = useCallback(
    (rowIndex: number): void => {
      const node = scrollContainerRef.current;
      if (node == null) {
        return;
      }
      node.scrollTop =
        Math.max(0, rowIndex + staticRowCount) * MSA_ROW_HEIGHT_PX;
      updateMetrics(node);
    },
    [staticRowCount, updateMetrics],
  );

  return {
    metrics,
    scrollHorizontallyBy,
    scrollToColumn,
    scrollToRow,
    setScrollContainerRef,
    slice,
  };
}

function scheduleFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
    return;
  }
  window.clearTimeout(handle);
}
