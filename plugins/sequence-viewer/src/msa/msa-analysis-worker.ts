import { computeMsaDerivedAnalysis } from "./analysis";
import { parseMsa } from "./parser";
import type { MsaWorkerRequest, MsaWorkerResponse } from "./worker-protocol";

const workerScope = self as unknown as {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<MsaWorkerRequest>) => void,
  ) => void;
  postMessage: (response: MsaWorkerResponse) => void;
};

workerScope.addEventListener(
  "message",
  (event: MessageEvent<MsaWorkerRequest>) => {
    const request = event.data;
    try {
      if (request.type === "parse") {
        post({
          phase: "parsing",
          requestId: request.requestId,
          type: "phase",
        });
        post({
          phase: "parsed",
          requestId: request.requestId,
          result: parseMsa(request.contents, request.filePath),
          type: "parse-result",
        });
        return;
      }
      post({
        phase: "analyzing",
        requestId: request.requestId,
        type: "phase",
      });
      post({
        analysis: computeMsaDerivedAnalysis(request.payload),
        phase: "ready",
        requestId: request.requestId,
        type: "analysis-result",
      });
    } catch (error) {
      post({
        message: error instanceof Error ? error.message : String(error),
        phase: "error",
        requestId: request.requestId,
        type: "error",
      });
    }
  },
);

function post(response: MsaWorkerResponse): void {
  workerScope.postMessage(response);
}

export {};
