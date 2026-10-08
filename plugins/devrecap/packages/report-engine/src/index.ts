export * from "./redact.ts";
export * from "./deterministic.ts";
export * from "./providers.ts";
export * from "./build.ts";
export * from "./workstreams.ts";
export * from "./language.ts";
export * from "./context.ts";
export * from "./validate.ts";
export * from "./composer.ts";
export {
  buildAnalysisContract,
  buildAnalysisPrompt,
  validateReportAnalysis,
  type AnalysisItem,
  type ReportAnalysis,
  type AnalysisOptions,
  type AnalysisContract,
} from "./analysis.ts";
export {
  buildDeterministicAnalysis,
} from "./analysis-quality.ts";
export * from "./html.ts";

// NOTE: report composition goes through the Semantic Composer path
// (`selectComposer` + `composeReport` in composer.ts). An external composer is
// gated behind explicit, payload-matching consent at the API layer. There is
// deliberately NO ungated `selectProvider` helper — that would bypass consent.
