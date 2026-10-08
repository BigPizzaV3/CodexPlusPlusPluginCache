import { useEffect, useMemo, useRef, useState } from "react";

import { computeMsaDerivedAnalysis, type MsaDerivedAnalysis } from "./analysis";
import { parseMsa } from "./parser";
import {
  searchMsaMotifFromProjectionsAsyncResult,
  type MsaMotifSearchHit,
} from "./search";
import type { MsaDocument, MsaParseWarning } from "./types";
import type { MsaWorkerRequest, MsaWorkerResponse } from "./worker-protocol";
import { runMsaWorkerTask } from "./worker-client";

type MsaParseState =
  | { document: null; phase: "parsing" }
  | { document: MsaDocument; phase: "parsed" }
  | {
      document: null;
      message: string;
      phase: "error";
      warnings: Array<MsaParseWarning>;
    };

export type MsaAnalysisState =
  | { analysis: null; phase: "analyzing" | "idle" }
  | {
      analysis: MsaDerivedAnalysis;
      fallbackMessage?: string;
      phase: "ready";
    }
  | { analysis: null; message: string; phase: "error" };

export type MsaSearchState =
  | {
      hits: Array<MsaMotifSearchHit>;
      phase: "idle" | "ready";
      truncated: boolean;
    }
  | { hits: Array<MsaMotifSearchHit>; phase: "searching"; truncated: false };

type MsaParseStateSnapshot = {
  contents: string;
  filePath: string | undefined;
  state: MsaParseState;
};

type MsaAnalysisStateSnapshot = {
  analysisRowIds: Array<string>;
  document: MsaDocument | null;
  state: MsaAnalysisState;
};

type MsaSearchStateSnapshot = {
  analysis: MsaDerivedAnalysis | null;
  document: MsaDocument | null;
  rawQuery: string;
  searchRowIds: Array<string>;
  state: MsaSearchState;
};

let requestCounter = 0;

export function useParsedMsaDocument({
  contents,
  filePath,
}: {
  contents: string;
  filePath?: string;
}): MsaParseState {
  const [snapshot, setSnapshot] = useState<MsaParseStateSnapshot>(() => ({
    contents,
    filePath,
    state: { document: null, phase: "parsing" },
  }));
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const requestId = nextRequestId("parse");
    let disposed = false;
    const controller = new AbortController();

    const commitParseResult = (
      response: Extract<MsaWorkerResponse, { type: "parse-result" }>,
    ): void => {
      if (disposed || generationRef.current !== generation) {
        return;
      }
      if (response.result.status === "error") {
        setSnapshot({
          contents,
          filePath,
          state: {
            document: null,
            message: response.result.message,
            phase: "error",
            warnings: response.result.warnings,
          },
        });
        return;
      }
      setSnapshot({
        contents,
        filePath,
        state: { document: response.result.document, phase: "parsed" },
      });
    };

    const request: MsaWorkerRequest = {
      contents,
      ...(filePath == null ? {} : { filePath }),
      requestId,
      type: "parse",
    };
    void runMsaWorkerTask({
      createWorker: createMsaAnalysisWorker,
      fallback: () => ({
        phase: "parsed" as const,
        requestId,
        result: parseMsa(contents, filePath),
        type: "parse-result" as const,
      }),
      request,
      select: (response) =>
        response.type === "parse-result" ? response : undefined,
      signal: controller.signal,
    })
      .then(({ fallbackReason, value }) => {
        let response = value;
        if (fallbackReason != null && value.result.status === "success") {
          response = {
            ...value,
            result: {
              ...value.result,
              document: {
                ...value.result.document,
                warnings: value.result.document.warnings.concat({
                  code: "worker-fallback",
                  message: fallbackReason,
                  severity: "warning",
                }),
              },
            },
          };
        }
        commitParseResult(response);
      })
      .catch((error: unknown) => {
        if (!disposed && (error as Error).name !== "AbortError") {
          setSnapshot({
            contents,
            filePath,
            state: {
              document: null,
              message: error instanceof Error ? error.message : String(error),
              phase: "error",
              warnings: [],
            },
          });
        }
      });

    return (): void => {
      disposed = true;
      controller.abort();
    };
  }, [contents, filePath]);

  if (snapshot.contents !== contents || snapshot.filePath !== filePath) {
    return { document: null, phase: "parsing" };
  }
  return snapshot.state;
}

export function useMsaDerivedAnalysis({
  analysisRowIds,
  document,
}: {
  analysisRowIds: Array<string>;
  document: MsaDocument | null;
}): MsaAnalysisState {
  const [snapshot, setSnapshot] = useState<MsaAnalysisStateSnapshot>(() => ({
    analysisRowIds,
    document,
    state:
      document == null
        ? { analysis: null, phase: "idle" }
        : { analysis: null, phase: "analyzing" },
  }));
  const generationRef = useRef(0);

  useEffect(() => {
    if (document == null) {
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const requestId = nextRequestId("analysis");
    const analysisId = requestId;
    let disposed = false;
    const controller = new AbortController();

    const payload = { analysisId, analysisRowIds, document };
    const commitAnalysis = (
      analysis: MsaDerivedAnalysis,
      fallbackMessage?: string,
    ): void => {
      if (disposed || generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        analysisRowIds,
        document,
        state: {
          analysis,
          ...(fallbackMessage == null ? {} : { fallbackMessage }),
          phase: "ready",
        },
      });
    };

    const request = {
      payload,
      requestId,
      type: "analyze",
    } satisfies MsaWorkerRequest;
    void runMsaWorkerTask({
      createWorker: createMsaAnalysisWorker,
      fallback: () => computeMsaDerivedAnalysis(payload),
      request,
      select: (response) =>
        response.type === "analysis-result" ? response.analysis : undefined,
      signal: controller.signal,
    })
      .then(({ fallbackReason, value }) =>
        commitAnalysis(value, fallbackReason),
      )
      .catch((error: unknown) => {
        if (!disposed && (error as Error).name !== "AbortError") {
          setSnapshot({
            analysisRowIds,
            document,
            state: {
              analysis: null,
              message: error instanceof Error ? error.message : String(error),
              phase: "error",
            },
          });
        }
      });

    return (): void => {
      disposed = true;
      controller.abort();
    };
  }, [analysisRowIds, document]);

  if (document == null) {
    return { analysis: null, phase: "idle" };
  }
  if (
    snapshot.document !== document ||
    snapshot.analysisRowIds !== analysisRowIds
  ) {
    return { analysis: null, phase: "analyzing" };
  }
  return snapshot.state;
}

export function useMsaMotifSearch({
  analysis,
  document,
  rawQuery,
  searchRowIds,
}: {
  analysis: MsaDerivedAnalysis | null;
  document: MsaDocument | null;
  rawQuery: string;
  searchRowIds: Array<string>;
}): MsaSearchState {
  const [snapshot, setSnapshot] = useState<MsaSearchStateSnapshot>(() => ({
    analysis,
    document,
    rawQuery,
    searchRowIds,
    state:
      analysis == null || document == null || rawQuery.trim().length === 0
        ? { hits: [], phase: "idle", truncated: false }
        : { hits: [], phase: "searching", truncated: false },
  }));

  const scopedProjections = useMemo(() => {
    if (analysis == null) {
      return [];
    }
    if (searchRowIds.length === 0) {
      return analysis.projections;
    }
    const searchRowIdSet = new Set(searchRowIds);
    return analysis.projections.filter((projection) =>
      searchRowIdSet.has(projection.rowId),
    );
  }, [analysis, searchRowIds]);

  useEffect(() => {
    if (analysis == null || document == null || rawQuery.trim().length === 0) {
      return;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      void searchMsaMotifFromProjectionsAsyncResult({
        moleculeType: document.displayInterpretation.moleculeType,
        projections: scopedProjections,
        rawQuery,
        searchCapabilities: document.searchCapabilities,
        signal: controller.signal,
      }).then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setSnapshot({
          analysis,
          document,
          rawQuery,
          searchRowIds,
          state: { ...result, phase: "ready" },
        });
      });
    }, 120);
    return (): void => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [analysis, document, rawQuery, scopedProjections, searchRowIds]);

  if (analysis == null || document == null || rawQuery.trim().length === 0) {
    return { hits: [], phase: "idle", truncated: false };
  }
  if (
    snapshot.analysis !== analysis ||
    snapshot.document !== document ||
    snapshot.rawQuery !== rawQuery ||
    snapshot.searchRowIds !== searchRowIds
  ) {
    return { hits: [], phase: "searching", truncated: false };
  }
  return snapshot.state;
}

function nextRequestId(prefix: string): string {
  requestCounter += 1;
  return `${prefix}-${requestCounter}`;
}

async function createMsaAnalysisWorker(): Promise<Worker | null> {
  const isStorybook = typeof __STORYBOOK__ !== "undefined" && __STORYBOOK__;
  const windowType =
    typeof __WINDOW_TYPE__ === "undefined" ? "electron" : __WINDOW_TYPE__;
  if (
    typeof Worker === "undefined" ||
    isStorybook ||
    windowType === "extension"
  ) {
    return null;
  }
  try {
    const module = await import("./msa-analysis-worker-factory-vite");
    return module.createMsaAnalysisWorker();
  } catch {
    return null;
  }
}
