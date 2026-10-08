import { describe, expect, it, vi } from "vitest";

import {
  createLatestModelContextUpdater,
  enforceModelContextBudget,
  serializedModelContextByteLength,
  type ModelContextUpdate,
} from "./model-context";

describe("model context updates", () => {
  it("counts exact Unicode fallback bytes while serializing structured content once", () => {
    let serializationCount = 0;
    const update: ModelContextUpdate = {
      structuredContent: {
        get sequence() {
          serializationCount += 1;
          return "🧬序列\uD800";
        },
        toolbarVisible: false,
      },
      text: "Aligned 🧬 residues \uD800",
    };
    const serialized = JSON.stringify({
      sequence: "🧬序列\uD800",
      toolbarVisible: false,
    });
    const fallback = `${update.text}\n\nStructured viewer context JSON:\n${serialized}`;
    const encoder = new TextEncoder();

    expect(serializedModelContextByteLength(update)).toBe(
      encoder.encode(fallback).byteLength + encoder.encode(serialized).byteLength,
    );
    expect(serializationCount).toBe(1);
  });

  it("serializes writes and publishes only the newest queued state", async () => {
    const firstUpdate = createDeferred<void>();
    const sendUpdate = vi
      .fn<(update: ModelContextUpdate) => Promise<void>>()
      .mockImplementationOnce(() => firstUpdate.promise)
      .mockResolvedValue(undefined);
    const updateModelContext = createLatestModelContextUpdater(sendUpdate, {
      minIntervalMs: 0,
    });

    const firstPromise = updateModelContext(contextUpdate("first"));
    const intermediatePromise = updateModelContext(
      contextUpdate("intermediate"),
    );
    const latestPromise = updateModelContext(contextUpdate("latest"));

    expect(sendUpdate).toHaveBeenCalledOnce();
    expect(sendUpdate.mock.calls[0]?.[0]).toMatchObject({
      structuredContent: {
        contextRevision: 1,
        schemaVersion: 2,
        value: "first",
      },
      text: "first",
    });

    firstUpdate.resolve();
    await Promise.all([firstPromise, intermediatePromise, latestPromise]);

    expect(sendUpdate).toHaveBeenCalledTimes(2);
    expect(sendUpdate.mock.calls[1]?.[0]).toMatchObject({
      structuredContent: {
        contextRevision: 3,
        schemaVersion: 2,
        value: "latest",
      },
      text: "latest",
    });
    expect(sendUpdate.mock.calls).not.toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ text: "intermediate" })],
      ]),
    );
  });

  it("rate-limits successive host writes", async () => {
    let clock = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      clock += milliseconds;
    });
    const sendUpdate = vi.fn().mockResolvedValue(undefined);
    const updateModelContext = createLatestModelContextUpdater(sendUpdate, {
      minIntervalMs: 75,
      now: () => clock,
      sleep,
    });

    await updateModelContext(contextUpdate("first"));
    await updateModelContext(contextUpdate("second"));

    expect(sleep).toHaveBeenCalledWith(75);
    expect(sendUpdate).toHaveBeenCalledTimes(2);
  });

  it("enforces a deterministic hard byte budget at multibyte boundaries", () => {
    const update: ModelContextUpdate = {
      structuredContent: {
        artifact: { name: "large.sto" },
        rowCoordinateMaps: Array.from({ length: 100 }, (_, index) => ({
          id: `row-${index}`,
          ungappedToAlignmentColumn: Array.from(
            { length: 500 },
            (_, column) => `${column}🧬`,
          ),
        })),
        toolbarVisible: false,
        viewer: "alignment",
        viewerSessionId: "session",
      },
      text: "Alignment context 🧬 ".repeat(2_000),
    };

    const bounded = enforceModelContextBudget(update, 4_096);

    expect(serializedModelContextByteLength(bounded)).toBeLessThanOrEqual(
      4_096,
    );
    expect(bounded.structuredContent.contextBudget).toMatchObject({
      maxBytes: 4_096,
      truncated: true,
    });
    expect(bounded.structuredContent.viewerSessionId).toBe("session");
    expect(bounded.structuredContent.toolbarVisible).toBe(false);
    expect(bounded.text).not.toContain("�");

    const complete = enforceModelContextBudget(contextUpdate("short"), 1_024);
    expect(serializedModelContextByteLength(complete)).toBeLessThanOrEqual(
      1_024,
    );
    expect(complete.structuredContent.contextBudget).toMatchObject({
      strategy: "complete",
      truncated: false,
    });
  });

  it("retains active-target semantics and bounded workbench identity after compaction", () => {
    const bounded = enforceModelContextBudget(
      {
        structuredContent: {
          activeTarget: {
            end: 420,
            kind: "sequence-range",
            recordId: "record-1",
            start: 400,
          },
          coordinateSystem: {
            basis: 1,
            end: "inclusive",
            orientation: "forward",
            space: "sequence",
          },
          transientFocus: { coordinate: 17, symbol: "G" },
          viewer: "sequence",
          viewerSessionId: "session",
          workbench: {
            artifactCount: 50,
            artifacts: Array.from({ length: 50 }, (_, index) => ({
              id: `artifact-${index}`,
              name: "x".repeat(1_000),
            })),
            capabilities: ["analysis", "editable-copy", "evidence-tracks"],
            dirty: true,
            trackCount: 12,
          },
        },
        text: "Sequence context ".repeat(4_000),
      },
      2_500,
    );

    expect(bounded.structuredContent.activeTarget).toMatchObject({
      end: 420,
      kind: "sequence-range",
      start: 400,
    });
    expect(bounded.structuredContent.transientFocus).toMatchObject({
      coordinate: 17,
    });
    expect(bounded.structuredContent.coordinateSystem).toMatchObject({
      basis: 1,
      end: "inclusive",
    });
    expect(bounded.structuredContent.workbench).toMatchObject({
      artifactCount: 50,
      dirty: true,
      trackCount: 12,
    });
    expect(serializedModelContextByteLength(bounded)).toBeLessThanOrEqual(
      2_500,
    );
  });

  it("fails closed when the configured budget cannot hold identity context", () => {
    expect(() =>
      enforceModelContextBudget(contextUpdate("too large"), 3),
    ).toThrow("[context_too_large]");
  });
});

function contextUpdate(value: string): ModelContextUpdate {
  return { structuredContent: { value }, text: value };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
