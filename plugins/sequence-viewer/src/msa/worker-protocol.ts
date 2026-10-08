import type { MsaAnalysisRequest, MsaDerivedAnalysis } from "./analysis";
import type { MsaParseResult } from "./types";

export type MsaWorkerRequest =
  | {
      contents: string;
      filePath?: string;
      requestId: string;
      type: "parse";
    }
  | {
      requestId: string;
      payload: MsaAnalysisRequest;
      type: "analyze";
    };

export type MsaWorkerResponse =
  | {
      phase: "parsing";
      requestId: string;
      type: "phase";
    }
  | {
      phase: "parsed";
      requestId: string;
      result: MsaParseResult;
      type: "parse-result";
    }
  | {
      phase: "analyzing";
      requestId: string;
      type: "phase";
    }
  | {
      analysis: MsaDerivedAnalysis;
      phase: "ready";
      requestId: string;
      type: "analysis-result";
    }
  | {
      message: string;
      phase: "error";
      requestId: string;
      type: "error";
    };
