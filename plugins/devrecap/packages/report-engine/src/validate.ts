/**
 * Post-composition validator.
 *
 * A composed report (especially from an optional LLM) must never detach from
 * the evidence. This validator checks a StructuredReport against the
 * ReportContext it was composed from and returns { ok:false, reason } when any
 * safety rule is violated. The caller then falls back to the deterministic
 * composer (whose output is always valid by construction).
 *
 * Rules:
 *   1. Every referenced workstream section maps to a real workstream + activities.
 *   2. No "completed" wording when the referenced work is exclusively unfinished.
 *   3. No fabricated technical terms (terms not present in the context).
 *   4. No fabricated next steps / blockers language beyond the supplied ones.
 *   5. No empty / generic workstream heading.
 *   6. No duplicate workstream headings.
 *   7. Non-empty content.
 */

import type { ReportContext, StructuredReport } from "@devrecap/shared";

export interface ValidationResult { ok: boolean; reason: string; }

const GENERIC_HEADING_RE =
  /^(the )?(application|app|system|project|task|code|changes|development|general development|a aplicação|o sistema|o projeto|desenvolvimento)\.?$/i;

/** Completion-claim wording (EN + PT). */
const COMPLETION_RE = /\b(completed|finished|done|concluí(?:do|ram)|finalizado|conclu[ií]do)\b/i;
/** Words that indicate an invented forward-looking plan (beyond supplied). */
const FABRICATED_NEXT_RE = /\b(next steps?:|todo:|tomorrow i will|amanhã (?:eu )?vou|próximos passos: (?!não)|will implement|plan to)\b/i;

export function validateComposedReport(report: StructuredReport, context: ReportContext): ValidationResult {
  const content = (report.content ?? "").trim();
  if (!content) return { ok: false, reason: "empty content" };

  // 5/6: headings must be specific and unique (from the report's own sections).
  const headings = report.sections.map((s) => s.heading.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const h of headings) {
    if (GENERIC_HEADING_RE.test(h.replace(/\s+/g, " ").trim())) {
      return { ok: false, reason: `generic heading: "${h}"` };
    }
    const key = h.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `duplicate heading: "${h}"` };
    seen.add(key);
  }

  // 1: every section references real workstream + activity IDs.
  const wsIds = new Set(context.workstreams.map((w) => w.id));
  const actIds = new Set(context.activities.map((a) => a.id));
  for (const s of report.sections) {
    if (s.workstreamId && !wsIds.has(s.workstreamId)) {
      return { ok: false, reason: `section references unknown workstream ${s.workstreamId}` };
    }
    for (const id of s.activityIds) {
      if (!actIds.has(id)) return { ok: false, reason: `section references unknown activity ${id}` };
    }
  }

  // 2: HONEST COMPLETION — validated PER WORKSTREAM, not globally. A composer
  //    must not claim an UNFINISHED workstream was completed just because a
  //    DIFFERENT workstream in the same report was. We attribute the report's
  //    prose to each section by its heading and check each unfinished section's
  //    own chunk for completion wording.
  const wsById = new Map(context.workstreams.map((w) => [w.id, w]));
  const finishedStatuses = new Set(["completed", "partially_completed"]);
  const unfinishedStatuses = new Set(["in_progress", "blocked", "unconfirmed"]);

  // Global guard first: if NOTHING is finished at all, completion wording
  // anywhere in the report is dishonest.
  const anyFinished = context.workstreams.some((w) => finishedStatuses.has(w.status));
  if (!anyFinished && COMPLETION_RE.test(content)) {
    return { ok: false, reason: "completion wording used for exclusively unfinished work" };
  }

  // Per-section attribution: split the prose into chunks anchored on each
  // section heading, then reject completion wording inside a chunk whose
  // workstream is NOT finished. This is what stops "workstream A is done" from
  // licensing "…and B is done too" when B is still in progress.
  const chunks = attributeSectionChunks(content, report.sections.map((s) => s.heading));
  for (const s of report.sections) {
    const ws = s.workstreamId ? wsById.get(s.workstreamId) : undefined;
    if (!ws || !unfinishedStatuses.has(ws.status)) continue; // only police unfinished
    const chunk = chunks.get(s.heading);
    if (chunk && COMPLETION_RE.test(chunk)) {
      return {
        ok: false,
        reason: `completion wording for unfinished workstream "${s.heading}" (status: ${ws.status})`,
      };
    }
  }

  // 3: no fabricated technical terms — every capitalized/known tech-looking
  //    token in the content that resembles a technical area must exist in the
  //    supplied technicalAreas (case-insensitive). We only police the exact
  //    supplied set's ABSENCE of contradiction: any term the composer presents
  //    as a "Technical area" list must be a subset. Conservative: check the
  //    technical-areas line if present.
  const areaSet = new Set(context.technicalAreas.map((t) => t.toLowerCase()));
  const areaLine = extractTechnicalAreasLine(content);
  if (areaLine) {
    for (const t of areaLine.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      if (!areaSet.has(t.toLowerCase())) {
        return { ok: false, reason: `fabricated technical term: "${t}"` };
      }
    }
  }

  // 4: no fabricated next-steps/plans (DevRecap never infers future work).
  if (FABRICATED_NEXT_RE.test(content)) {
    return { ok: false, reason: "fabricated next steps / plan" };
  }

  return { ok: true, reason: "" };
}

/**
 * Attribute the report's prose to each section by its heading. Returns a map of
 * heading → the text that follows it, up to the next known heading. This lets
 * the validator check completion claims PER workstream/section rather than
 * globally. Matching tolerates markdown heading markers ("### ", "#"), leading
 * bullets, and surrounding whitespace, and is case-insensitive.
 */
function attributeSectionChunks(content: string, headings: string[]): Map<string, string> {
  const lines = content.split(/\r?\n/);
  const norm = (s: string) => s.replace(/^[#>\-•\s]+/, "").trim().toLowerCase();
  const headingSet = new Map(headings.map((h) => [norm(h), h]));

  const result = new Map<string, string>();
  let current: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current !== null) {
      const prev = result.get(current);
      const text = buffer.join("\n");
      result.set(current, prev ? `${prev}\n${text}` : text);
    }
    buffer = [];
  };

  // Structural (non-workstream) section labels that also END a workstream
  // chunk so its text doesn't bleed into later sections like "What was left
  // open" (which may legitimately mention another workstream's completion).
  const STRUCTURAL_RE = /^(summary|resumo|main work|principais frentes|other things you worked on|outras (coisas|atividades)[^\n]*|problems? ?\/? ?interruptions?|problemas[^\n]*|technical areas|áreas técnicas|areas técnicas|what was left open|o que ficou em aberto|status)\b/i;

  for (const line of lines) {
    const key = norm(line);
    const matched = headingSet.get(key);
    // A heading line is one whose normalized text EXACTLY equals a section
    // heading (so ordinary prose that merely mentions the objective isn't
    // treated as a boundary).
    if (matched !== undefined) {
      flush();
      current = matched;
      continue;
    }
    // A markdown heading ("### …") or a known structural label ends the current
    // workstream chunk (its narrative is confined to its own section).
    if (current !== null && (/^#{1,6}\s/.test(line.trim()) || STRUCTURAL_RE.test(norm(line)))) {
      flush();
      current = null;
      continue;
    }
    if (current !== null) buffer.push(line);
  }
  flush();
  return result;
}

/** Extract the "Technical areas" / "Áreas técnicas" list line, if present. */
function extractTechnicalAreasLine(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^(technical areas|áreas técnicas|areas técnicas)\b/i.test(lines[i].trim())) {
      // the terms are usually on the next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t) return t.replace(/^[-•]\s*/, "");
      }
    }
  }
  return undefined;
}
