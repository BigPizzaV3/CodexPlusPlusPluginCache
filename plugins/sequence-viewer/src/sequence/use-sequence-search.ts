import { useEffect, useState } from "react";

import { searchSequenceRecordsAsync } from "./search";
import type { SequenceRecord, SequenceSearchResult } from "./types";

export type SequenceSearchState = SequenceSearchResult & {
  phase: "idle" | "ready" | "searching";
};

type SequenceSearchSnapshot = {
  query: string;
  record: SequenceRecord | null;
  result: SequenceSearchResult;
};

export function useSequenceSearch({
  query,
  record,
}: {
  query: string;
  record: SequenceRecord | undefined;
}): SequenceSearchState {
  const [snapshot, setSnapshot] = useState<SequenceSearchSnapshot>({
    query: "",
    record: null,
    result: { hits: [], truncated: false },
  });

  useEffect(() => {
    if (record == null || query.trim().length === 0) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void searchSequenceRecordsAsync({
        includeReverseComplement: true,
        molecule: record.molecule,
        query,
        records: [record],
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted)
            setSnapshot({ query, record, result });
        })
        .catch((error: unknown) => {
          if ((error as Error).name !== "AbortError") {
            setSnapshot({
              query,
              record,
              result: { hits: [], truncated: true },
            });
          }
        });
    }, 120);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, record]);

  if (record == null || query.trim().length === 0) {
    return { hits: [], phase: "idle", truncated: false };
  }
  if (snapshot.query !== query || snapshot.record !== record) {
    return { hits: [], phase: "searching", truncated: false };
  }
  return { ...snapshot.result, phase: "ready" };
}
