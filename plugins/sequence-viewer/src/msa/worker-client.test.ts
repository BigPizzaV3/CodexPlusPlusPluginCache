import { afterEach, describe, expect, it, vi } from "vitest";

import { runMsaWorkerTask } from "./worker-client";
import type { MsaWorkerResponse } from "./worker-protocol";

afterEach(() => vi.useRealTimers());

describe("runMsaWorkerTask", () => {
  it("falls back exactly once and terminates after a worker crash", async () => {
    const worker = new FakeWorker((instance) => {
      instance.onerror?.({
        message: "worker crashed",
        preventDefault: vi.fn(),
      } as unknown as ErrorEvent);
    });
    const fallback = vi.fn(() => "main-thread-result");

    await expect(
      runMsaWorkerTask({
        createWorker: () => worker,
        fallback,
        request: { contents: ">a\nAC", requestId: "parse-1", type: "parse" },
        select: () => undefined,
      }),
    ).resolves.toEqual({
      fallbackReason: "worker crashed",
      value: "main-thread-result",
    });
    expect(fallback).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("recovers from message decoding errors and postMessage exceptions", async () => {
    const unreadable = new FakeWorker((instance) => {
      instance.onmessageerror?.({ data: null } as MessageEvent<unknown>);
    });
    const first = await runMsaWorkerTask({
      createWorker: () => unreadable,
      fallback: () => 1,
      request: { contents: "", requestId: "parse-2", type: "parse" },
      select: () => undefined,
    });
    expect(first).toMatchObject({
      fallbackReason: expect.stringContaining("unreadable"),
    });

    const throwing = new FakeWorker(() => {
      throw new Error("clone failed");
    });
    const second = await runMsaWorkerTask({
      createWorker: () => throwing,
      fallback: () => 2,
      request: { contents: "", requestId: "parse-3", type: "parse" },
      select: () => undefined,
    });
    expect(second).toMatchObject({
      fallbackReason: expect.stringContaining("clone failed"),
      value: 2,
    });
  });

  it("uses a watchdog when a worker never reaches a terminal response", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker(() => undefined);
    const task = runMsaWorkerTask({
      createWorker: () => worker,
      fallback: () => "timed-out-fallback",
      request: { contents: "", requestId: "parse-4", type: "parse" },
      select: () => undefined,
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(50);

    await expect(task).resolves.toMatchObject({
      fallbackReason: expect.stringContaining("50 ms"),
      value: "timed-out-fallback",
    });
  });

  it("accepts only the matching terminal response", async () => {
    const response = {
      analysis: { analysisId: "analysis-1" },
      phase: "ready",
      requestId: "analysis-1",
      type: "analysis-result",
    } as unknown as MsaWorkerResponse;
    const worker = new FakeWorker((instance) => {
      instance.onmessage?.({
        data: response,
      } as MessageEvent<MsaWorkerResponse>);
    });

    await expect(
      runMsaWorkerTask({
        createWorker: () => worker,
        fallback: () => "fallback",
        request: {
          payload: {} as never,
          requestId: "analysis-1",
          type: "analyze",
        },
        select: (candidate) =>
          candidate.type === "analysis-result"
            ? candidate.analysis.analysisId
            : undefined,
      }),
    ).resolves.toEqual({ value: "analysis-1" });
  });

  it("terminates a worker created after cancellation without running work", async () => {
    const controller = new AbortController();
    let resolveWorker!: (worker: FakeWorker) => void;
    const workerPromise = new Promise<FakeWorker>((resolve) => {
      resolveWorker = resolve;
    });
    const worker = new FakeWorker(() => undefined);
    const fallback = vi.fn(() => "fallback");
    const task = runMsaWorkerTask({
      createWorker: () => workerPromise,
      fallback,
      request: { contents: "", requestId: "parse-5", type: "parse" },
      select: () => undefined,
      signal: controller.signal,
    });

    controller.abort();
    resolveWorker(worker);

    await expect(task).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });
});

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<MsaWorkerResponse>) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn(() => {
    this.send(this);
  });

  constructor(private readonly send: (worker: FakeWorker) => void) {}
}
