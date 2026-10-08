import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";

import type { MsaWorkerRequest, MsaWorkerResponse } from "./worker-protocol";

type MsaWorkerLike = Pick<Worker, "postMessage" | "terminate"> & {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<MsaWorkerResponse>) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
};

export async function runMsaWorkerTask<T>({
  createWorker,
  fallback,
  request,
  select,
  signal,
  timeoutMs = SEQUENCE_VIEWER_LIMITS.worker.timeoutMs,
}: {
  createWorker: () => MsaWorkerLike | null | Promise<MsaWorkerLike | null>;
  fallback: () => T | Promise<T>;
  request: MsaWorkerRequest;
  select: (response: MsaWorkerResponse) => T | undefined;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{ fallbackReason?: string; value: T }> {
  if (isSignalAborted(signal)) throw createAbortError();
  let worker: MsaWorkerLike | null;
  try {
    worker = await createWorker();
  } catch {
    worker = null;
  }
  if (isSignalAborted(signal)) {
    worker?.terminate();
    throw createAbortError();
  }
  if (worker == null) return { value: await fallback() };
  const activeWorker = worker;

  return await new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      if (timeoutId != null) clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
      activeWorker.terminate();
    };
    const succeed = (value: T, fallbackReason?: string): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ...(fallbackReason == null ? {} : { fallbackReason }), value });
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const recover = (reason: string): void => {
      if (settled) return;
      // Mark settled before awaiting the fallback so duplicate browser error
      // events cannot execute the expensive parse/analysis more than once.
      settled = true;
      cleanup();
      void Promise.resolve()
        .then(fallback)
        .then((value) => resolve({ fallbackReason: reason, value }), reject);
    };
    const abort = (): void => fail(createAbortError());

    signal?.addEventListener("abort", abort, { once: true });
    activeWorker.onerror = (event): void => {
      event.preventDefault?.();
      recover(
        event.message ||
          "The alignment worker crashed; main-thread fallback was used.",
      );
    };
    activeWorker.onmessageerror = (): void => {
      recover(
        "The alignment worker returned an unreadable message; main-thread fallback was used.",
      );
    };
    activeWorker.onmessage = (event): void => {
      const response = event.data;
      if (response.requestId !== request.requestId) return;
      if (response.type === "error") {
        recover(`${response.message}; main-thread fallback was used.`);
        return;
      }
      try {
        const value = select(response);
        if (value !== undefined) succeed(value);
      } catch (error) {
        recover(
          error instanceof Error
            ? `${error.message}; main-thread fallback was used.`
            : "The alignment worker response was invalid; main-thread fallback was used.",
        );
      }
    };
    timeoutId = setTimeout(() => {
      recover(
        `Alignment worker exceeded ${timeoutMs.toLocaleString()} ms; main-thread fallback was used.`,
      );
    }, timeoutMs);
    try {
      activeWorker.postMessage(request);
    } catch (error) {
      recover(
        error instanceof Error
          ? `${error.message}; main-thread fallback was used.`
          : "The alignment worker request could not be sent; main-thread fallback was used.",
      );
    }
  });
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function createAbortError(): Error {
  const error = new Error("MSA worker task was cancelled.");
  error.name = "AbortError";
  return error;
}
