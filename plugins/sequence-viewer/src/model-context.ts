import { useEffect, useRef } from "react";

import {
  SEQUENCE_VIEWER_LIMITS,
  SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
  SequenceViewerLimitError,
  utf8ByteLength,
} from "./runtime-contract";

export type ModelContextUpdate = {
  structuredContent: Record<string, unknown>;
  text: string;
};

export type ModelContextUpdater = (
  update: ModelContextUpdate,
) => Promise<void> | void;

type ModelContextUpdateWaiter = {
  reject: (reason?: unknown) => void;
  resolve: () => void;
};

type PendingModelContextUpdate = {
  update: ModelContextUpdate;
  waiters: Array<ModelContextUpdateWaiter>;
};

/**
 * Serializes host writes, coalesces queued state, assigns monotonic revisions,
 * and rate-limits transient UI churn. One write may be in flight and one
 * newest pending value is retained.
 */
export function createLatestModelContextUpdater(
  sendUpdate: ModelContextUpdater,
  {
    minIntervalMs = SEQUENCE_VIEWER_LIMITS.context.minPublishIntervalMs,
    now = Date.now,
    sleep = (milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
  }: {
    minIntervalMs?: number;
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): ModelContextUpdater {
  let contextRevision = 0;
  let lastPublishAt = Number.NEGATIVE_INFINITY;
  let pending: PendingModelContextUpdate | null = null;
  let flushing = false;

  const flush = async (): Promise<void> => {
    if (flushing) return;
    flushing = true;
    try {
      while (pending != null) {
        const waitMs = Math.max(0, minIntervalMs - (now() - lastPublishAt));
        if (waitMs > 0) await sleep(waitMs);

        const current = pending;
        pending = null;
        try {
          await sendUpdate(current.update);
          lastPublishAt = now();
          current.waiters.forEach(({ resolve }) => resolve());
        } catch (error) {
          current.waiters.forEach(({ reject }) => reject(error));
        }
      }
    } finally {
      flushing = false;
      if (pending != null) void flush();
    }
  };

  return (update) => {
    contextRevision += 1;
    const revisioned = enforceModelContextBudget({
      ...update,
      structuredContent: {
        ...update.structuredContent,
        contextRevision,
        schemaVersion: SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
      },
    });
    return new Promise<void>((resolve, reject) => {
      if (pending == null) {
        pending = { update: revisioned, waiters: [{ reject, resolve }] };
      } else {
        pending.update = revisioned;
        pending.waiters.push({ reject, resolve });
      }
      void flush();
    });
  };
}

export function useModelContext(
  updateModelContext: ModelContextUpdater | undefined,
  update: ModelContextUpdate,
): void {
  const lastUpdateKeyRef = useRef<string | null>(null);
  const updateKey = JSON.stringify(update);

  useEffect(() => {
    if (
      updateModelContext == null ||
      update.text.length === 0 ||
      lastUpdateKeyRef.current === updateKey
    ) {
      return;
    }
    lastUpdateKeyRef.current = updateKey;
    void Promise.resolve(updateModelContext(update)).catch(() => {
      // The viewer remains useful when a host does not persist context.
    });
  }, [update, updateKey, updateModelContext]);
}

export function formatContextLines(
  lines: Array<string | null | undefined>,
): string {
  return lines.filter((line): line is string => line != null).join("\n");
}

const MODEL_CONTEXT_JSON_PREFIX = "\n\nStructured viewer context JSON:\n";

export function formatModelContextText({
  structuredContent,
  text,
}: ModelContextUpdate): string {
  return `${text}${MODEL_CONTEXT_JSON_PREFIX}${JSON.stringify(structuredContent)}`;
}

export function truncateContextText(value: string, maxLength = 120): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function serializedModelContextByteLength(
  update: ModelContextUpdate,
): number {
  const structured = JSON.stringify(update.structuredContent);
  // Count the exact text fallback (including its heading) plus the same JSON
  // sent once as structured content. The surrounding JSON-RPC envelope is
  // host-owned and outside this app-context budget.
  return (
    utf8ByteLength(update.text) +
    utf8ByteLength(MODEL_CONTEXT_JSON_PREFIX) +
    utf8ByteLength(structured) * 2
  );
}

export function enforceModelContextBudget(
  update: ModelContextUpdate,
  maxBytes = SEQUENCE_VIEWER_LIMITS.context.maxBytes,
): ModelContextUpdate {
  const originalBytes = serializedModelContextByteLength(update);
  if (originalBytes <= maxBytes) {
    const complete: ModelContextUpdate = {
      ...update,
      structuredContent: {
        ...update.structuredContent,
        contextBudget: {
          bytes: originalBytes,
          maxBytes,
          strategy: "complete",
          truncated: false,
        },
      },
    };
    if (serializedModelContextByteLength(complete) <= maxBytes) return complete;
  }

  const compact: ModelContextUpdate = {
    structuredContent: {
      ...compactStructuredContent(update.structuredContent),
      contextBudget: {
        maxBytes,
        originalBytes,
        strategy: "compact",
        truncated: true,
      },
    },
    text: truncateUtf8(
      update.text,
      Math.min(SEQUENCE_VIEWER_LIMITS.context.maxTextBytes, maxBytes / 4),
    ),
  };
  if (serializedModelContextByteLength(compact) <= maxBytes) return compact;

  const minimal: ModelContextUpdate = {
    structuredContent: {
      activeTarget: compactSummary(compact.structuredContent.activeTarget),
      artifact: compact.structuredContent.artifact ?? null,
      coordinateSystem: compact.structuredContent.coordinateSystem ?? null,
      contextBudget: {
        maxBytes,
        originalBytes,
        strategy: "minimal",
        truncated: true,
      },
      contextRevision: compact.structuredContent.contextRevision ?? null,
      focus: compactSummary(compact.structuredContent.focus),
      schemaVersion:
        compact.structuredContent.schemaVersion ??
        SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
      search: compactSummary(compact.structuredContent.search),
      selection: compactSummary(compact.structuredContent.selection),
      ...(typeof compact.structuredContent.toolbarVisible === "boolean"
        ? { toolbarVisible: compact.structuredContent.toolbarVisible }
        : {}),
      transientFocus: compactSummary(
        compact.structuredContent.transientFocus,
      ),
      viewer: compact.structuredContent.viewer ?? "sequence",
      viewerSessionId: compact.structuredContent.viewerSessionId ?? null,
      workbench: compactWorkbenchSummary(
        compact.structuredContent.workbench,
      ),
    },
    text: truncateUtf8(update.text, Math.max(128, maxBytes / 6)),
  };
  if (serializedModelContextByteLength(minimal) <= maxBytes) return minimal;

  const emergency: ModelContextUpdate = {
    structuredContent: {
      contextBudget: {
        maxBytes,
        originalBytes,
        strategy: "identity-only",
        truncated: true,
      },
      contextRevision: update.structuredContent.contextRevision ?? null,
      schemaVersion:
        update.structuredContent.schemaVersion ??
        SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
      ...(typeof update.structuredContent.toolbarVisible === "boolean"
        ? { toolbarVisible: update.structuredContent.toolbarVisible }
        : {}),
      viewer: update.structuredContent.viewer ?? "sequence",
      viewerSessionId: update.structuredContent.viewerSessionId ?? null,
    },
    text: "Biological Sequence & Alignment Viewer context was compacted to its hard byte budget.",
  };
  if (serializedModelContextByteLength(emergency) <= maxBytes) return emergency;
  throw new SequenceViewerLimitError(
    "context_too_large",
    "The configured model-context budget cannot hold the minimum payload.",
    { maxBytes },
  );
}

function compactStructuredContent(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const compact = { ...content };
  const features = asRecord(compact.features);
  compact.features = compactCollection(features, 12);
  const records = asRecord(compact.sequenceRecords);
  compact.sequenceRecords = compactCollection(records, 12);

  const selection = asRecord(compact.selection);
  if (Object.keys(selection).length > 0) {
    compact.selection = {
      ...selection,
      columns: compactArray(selection.columns, 4, (column) => {
        const record = asRecord(column);
        return { ...record, rows: compactArray(record.rows, 8) };
      }),
      overlappingFeatures: compactArray(selection.overlappingFeatures, 12),
      residues: compactArray(selection.residues, 16),
      translatedSelections: compactArray(selection.translatedSelections, 8),
    };
  }

  const focus = asRecord(compact.focus);
  if (Object.keys(focus).length > 0) {
    compact.focus = {
      ...focus,
      overlappingFeatures: compactArray(focus.overlappingFeatures, 8),
    };
  }

  const display = asRecord(compact.display);
  if (Object.keys(display).length > 0) {
    compact.display = {
      ...display,
      hiddenRowIds: compactArray(display.hiddenRowIds, 12),
      visibleRowIds: compactArray(display.visibleRowIds, 12),
    };
  }
  compact.rowCoordinateMaps = compactArray(
    compact.rowCoordinateMaps,
    4,
    (map) => {
      const record = asRecord(map);
      return {
        ...record,
        coordinateIntervals: compactArray(record.coordinateIntervals, 16),
        intervals: compactArray(record.intervals, 16),
        ungappedToAlignmentColumn: compactArray(
          record.ungappedToAlignmentColumn,
          16,
        ),
      };
    },
  );
  const guideTree = asRecord(compact.guideTree);
  if (typeof guideTree.newick === "string") {
    compact.guideTree = {
      ...guideTree,
      newick: truncateContextText(guideTree.newick, 2_048),
      truncated: guideTree.newick.length > 2_048,
    };
  }
  const workbench = asRecord(compact.workbench);
  if (Object.keys(workbench).length > 0) {
    compact.workbench = {
      ...workbench,
      actionHints: compactArray(workbench.actionHints, 4),
      artifacts: compactArray(workbench.artifacts, 8),
      capabilities: compactArray(workbench.capabilities, 16),
      jobs: compactArray(workbench.jobs, 12),
      tracks: compactArray(workbench.tracks, 12),
    };
  }
  return compact;
}

function compactCollection(
  value: Record<string, unknown>,
  limit: number,
): Record<string, unknown> {
  if (Object.keys(value).length === 0) return value;
  const items = Array.isArray(value.items) ? value.items : [];
  return {
    ...value,
    items: items.slice(0, limit),
    truncated: value.truncated === true || items.length > limit,
  };
}

function compactArray(
  value: unknown,
  limit: number,
  map: (value: unknown) => unknown = (item) => item,
): Array<unknown> {
  return Array.isArray(value) ? value.slice(0, limit).map(map) : [];
}

function compactSummary(value: unknown): unknown {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return value ?? null;
  return Object.fromEntries(
    Object.entries(record).filter(([, candidate]) =>
      ["boolean", "number", "string"].includes(typeof candidate),
    ),
  );
}

function compactWorkbenchSummary(value: unknown): unknown {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return value ?? null;
  return {
    artifactCount: record.artifactCount ?? null,
    capabilities: compactArray(record.capabilities, 16),
    dirty: record.dirty ?? null,
    trackCount: record.trackCount ?? null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) return value;
  const suffix = "…";
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${value.slice(0, middle)}${suffix}`;
    if (utf8ByteLength(candidate) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  const end =
    low > 0 && /[\uD800-\uDBFF]/.test(value[low - 1] ?? "") ? low - 1 : low;
  return `${value.slice(0, end)}${suffix}`;
}
