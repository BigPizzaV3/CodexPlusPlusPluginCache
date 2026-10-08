// oxlint-disable-next-line import/default
import MsaAnalysisWorker from "./msa-analysis-worker.ts?worker&inline";

export function createMsaAnalysisWorker(): Worker {
  return new MsaAnalysisWorker();
}
