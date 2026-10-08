/**
 * Semantic Report Composer.
 *
 * Sits between the deterministic evidence pipeline (ReportInput) and the final
 * readable report. A composer may GROUP, NAME, SUMMARIZE, and improve wording —
 * it NEVER decides whether work happened, invents work, or infers completion
 * beyond the supplied status. The deterministic composer is always available as
 * a fallback and as the source of truth.
 *
 * Architecture:
 *   ReportInput ──buildReportContext──▶ ReportContext ──▶ SemanticReportComposer
 *                                                            ├─ DeterministicComposer (local, default)
 *                                                            └─ LLMComposer (optional; OpenAI / Ollama)
 *   Composed output ──validate──▶ (ok) rendered report | (fail) deterministic fallback
 */

import type {
  ReportInput, ReportContext, StructuredReport, StructuredReportSection,
  SemanticReportComposer, Settings,
} from "@devrecap/shared";
import { renderDeterministic, renderStructured } from "./deterministic.ts";
import { validateComposedReport } from "./validate.ts";
import { composePrompt, callOpenAI, callOllama } from "./providers.ts";

/**
 * The deterministic composer. Renders directly from the (already sanitized)
 * ReportInput using the report-engine's local renderers, and emits the
 * traceable section structure. Never external, never fails on content.
 */
export class DeterministicComposer implements SemanticReportComposer {
  readonly name = "deterministic";
  readonly external = false;
  private input: ReportInput;
  constructor(input: ReportInput) { this.input = input; }
  async compose(_context: ReportContext): Promise<StructuredReport> {
    return renderStructured(this.input);
  }
}

/**
 * Optional LLM composer. Receives ONLY the structured ReportContext (never raw
 * data) and asks the model to rewrite it into readable prose in the target
 * language, under strict no-invention rules. Its output is validated by the
 * caller and falls back to deterministic when it fails.
 */
export class LLMComposer implements SemanticReportComposer {
  readonly external = true;
  readonly name: string;
  private call: (prompt: string) => Promise<string>;
  private input: ReportInput;
  constructor(name: string, call: (prompt: string) => Promise<string>, input: ReportInput) {
    this.name = name;
    this.call = call;
    this.input = input;
  }
  async compose(context: ReportContext): Promise<StructuredReport> {
    const prompt = composePrompt(context);
    const content = (await this.call(prompt)).trim();
    if (!content) throw new Error("empty LLM response");
    // Keep the deterministic section structure for traceability; the LLM only
    // rewrites the human-readable `content`.
    const deterministic = renderStructured(this.input);
    return {
      content,
      sections: deterministic.sections,
      composer: this.name,
      fellBack: false,
    };
  }
}

/** Select a composer from settings. Falls back to deterministic. */
export function selectComposer(settings: Settings, input: ReportInput): SemanticReportComposer {
  if (settings.aiProvider === "openai" && settings.openaiApiKey) {
    const key = settings.openaiApiKey, model = settings.aiModel || "gpt-4o-mini";
    return new LLMComposer("openai", (p) => callOpenAI(key, model, p), input);
  }
  if (settings.aiProvider === "ollama") {
    const endpoint = settings.ollamaEndpoint, model = settings.aiModel || "llama3.1";
    return new LLMComposer("ollama", (p) => callOllama(endpoint, model, p), input);
  }
  return new DeterministicComposer(input);
}

/**
 * Compose a report and GUARANTEE a valid, traceable result. If the selected
 * composer is external and its output fails validation (or throws), fall back
 * to the deterministic composer. The deterministic result is always valid.
 */
export async function composeReport(
  composer: SemanticReportComposer,
  input: ReportInput,
  context: ReportContext,
): Promise<StructuredReport> {
  const safeFallback = (reason: string): Promise<StructuredReport> => {
    const det = renderStructured(input);
    return Promise.resolve({ ...det, composer: `${composer.name} (fell back: ${reason})`, fellBack: true });
  };

  if (!composer.external) {
    // Deterministic path is trusted; still run the validator as a guard.
    const out = await composer.compose(context);
    const v = validateComposedReport(out, context);
    return v.ok ? out : safeFallback(v.reason);
  }

  try {
    const out = await composer.compose(context);
    const v = validateComposedReport(out, context);
    if (!v.ok) return safeFallback(v.reason);
    return out;
  } catch (e) {
    return safeFallback(String(e).slice(0, 120));
  }
}

/** Re-export for callers that want the section type. */
export type { StructuredReportSection };
