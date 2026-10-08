/**
 * External AI transport for the OPTIONAL Semantic Composer (OpenAI, Ollama).
 *
 * `composePrompt` builds the prompt from the sanitized, structured
 * ReportContext ONLY — never raw sessions, commands, file contents, or code.
 * `callOpenAI` / `callOllama` are thin `fetch` transports (no SDK dependency).
 * These are OFF by default and are only reached after the API layer verifies
 * explicit, payload-matching user consent (see apps/server/src/api.ts and
 * report-engine/composer.ts). Nothing here selects a provider or sends data on
 * its own.
 */

import type { ReportContext } from "@devrecap/shared";

// ---------------------------------------------------------------------------
// Semantic Composer prompt — built ONLY from the structured ReportContext.
// The model receives distilled facts (objectives, statuses, counts, technical
// terms) — never raw rollouts, sessions, command output, source, or paths.
// ---------------------------------------------------------------------------

/** Build the composer prompt from a sanitized ReportContext (no raw content). */
export function composePrompt(context: ReportContext): string {
  const langName = context.language === "pt" ? "Brazilian Portuguese" : "English";
  const ws = context.workstreams.map((w) => {
    const acts = context.activities.filter((a) => w.activityIds.includes(a.id));
    const bullets = acts.map((a) =>
      `    - objective: ${a.objective || "(unspecified)"}; status: ${a.status}; ` +
      `files modified: ${a.filesModifiedCount}; files read: ${a.filesReadCount}` +
      (a.validationSummary ? `; ${a.validationSummary}` : "") +
      (a.errorsSummary ? `; ${a.errorsSummary}` : "")).join("\n");
    return `  Workstream: ${w.objective} [status: ${w.status}, kind: ${w.workKind}]\n` +
      `  Technical areas: ${w.technicalTerms.join(", ") || "(none)"}\n` +
      `  Activities:\n${bullets}`;
  }).join("\n\n");

  return [
    "You are a concise engineering assistant helping a developer REMEMBER what they worked on.",
    `Write the report in ${langName}. Preserve technical terms, file names, and identifiers verbatim (do NOT translate them).`,
    `Report type: ${context.kind}. Length: ${context.length}.`,
    "",
    "STRICT RULES — obey exactly:",
    "- Only summarize the workstreams and activities supplied below. NEVER invent work.",
    "- NEVER claim completion beyond the supplied `status`. If status is in_progress/blocked/partially_completed, say so honestly.",
    "- NEVER fabricate blockers or next steps. If none are supplied, do not add any.",
    "- NEVER introduce technical terms that are not in the supplied Technical areas.",
    "- Name each section by its OBJECTIVE (why the work existed), never by a technology alone.",
    "- Do not include raw file paths, commands, or code.",
    "",
    `PERIOD: ${context.period.start.slice(0, 10)} to ${context.period.end.slice(0, 10)}`,
    `TECHNICAL AREAS (the ONLY technologies you may mention): ${context.technicalAreas.join(", ") || "(none)"}`,
    context.openObjectives.length ? `LEFT OPEN (not confirmed complete): ${context.openObjectives.join("; ")}` : "",
    "",
    "WORKSTREAMS:",
    ws,
  ].filter(Boolean).join("\n");
}

/** Low-level OpenAI chat call (used by the LLM composer). */
export async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned no content");
  return content;
}

/** Low-level Ollama generate call (used by the LLM composer). */
export async function callOllama(endpoint: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama request failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { response?: string };
  const content = json.response?.trim();
  if (!content) throw new Error("Ollama returned no content");
  return content;
}
