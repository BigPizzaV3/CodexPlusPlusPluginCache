import type { ReportKind, ReportLength, ReportStyle } from "@devrecap/shared";

export type CliOperation = "setup" | "sources" | "prepare" | "render" | "report" | "help";

export interface CommandPreset {
  request?: string;
  kind?: ReportKind;
  style?: ReportStyle;
  length?: ReportLength;
}

export interface CliInvocation {
  operation: CliOperation;
  args: string[];
  preset?: CommandPreset;
}

const EXPLICIT = new Set(["setup", "sources", "prepare", "render", "report", "help", "--help", "-h"]);

export function resolveCliInvocation(argv: string[]): CliInvocation {
  const first = argv[0] ?? "help";
  const rest = argv.slice(1);
  if (first === "--help" || first === "-h") return { operation: "help", args: [] };
  if (EXPLICIT.has(first)) return { operation: first as CliOperation, args: rest };

  if (first === "today") return { operation: "report", args: rest, preset: { request: "today", kind: "daily" } };
  if (first === "week") return { operation: "report", args: rest, preset: { request: "this week", kind: "weekly" } };
  if (first === "month") return { operation: "report", args: rest, preset: { request: "this month", kind: "monthly" } };
  if (first === "daily") return { operation: "report", args: rest, preset: { request: "today", kind: "daily", style: "spoken", length: "short" } };
  if (first === "remember") return { operation: "report", args: rest, preset: { request: "this week", kind: "help_me_remember", style: "professional", length: "detailed" } };
  if (first === "review") return { operation: "report", args: rest, preset: { request: "this week", kind: "review", style: "professional", length: "normal" } };

  // Backwards-compatible free-form mode: `devrecap "last 14 days"`.
  return { operation: "report", args: argv };
}

export function resolveRange(
  request: string,
  from?: string,
  to?: string,
  now = new Date(),
): { start: string; end: string } {
  if (from || to) {
    return {
      start: from ? startOfDate(from) : startOfLocalDay(now).toISOString(),
      end: to ? endOfDate(to) : now.toISOString(),
    };
  }

  if (/\b(hoje|today)\b/i.test(request)) return { start: startOfLocalDay(now).toISOString(), end: now.toISOString() };

  if (/\b(esta semana|essa semana|this week|week)\b/i.test(request)) {
    return { start: startOfWeek(now).toISOString(), end: now.toISOString() };
  }

  if (/\b(este mês|esse mês|este mes|esse mes|this month|month)\b/i.test(request)) {
    return { start: startOfMonth(now).toISOString(), end: now.toISOString() };
  }

  const matchPt = /(?:últimos|ultimos)\s+(\d+)\s+dias/i.exec(request);
  const matchEn = /last\s+(\d+)\s+days/i.exec(request);
  const days = Number(matchPt?.[1] ?? matchEn?.[1]);
  if (Number.isFinite(days) && days > 0) {
    const start = startOfLocalDay(now);
    start.setDate(start.getDate() - (days - 1));
    return { start: start.toISOString(), end: now.toISOString() };
  }

  return { start: startOfWeek(now).toISOString(), end: now.toISOString() };
}

export function inferReportKind(
  request: string,
  range: { start: string; end: string },
  override?: ReportKind,
): ReportKind {
  if (override) return override;
  if (/\b(hoje|today)\b/i.test(request)) return "daily";
  if (/\b(mês|mes|month)\b/i.test(request)) return "monthly";
  return (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000 <= 7.5 ? "weekly" : "custom";
}

function startOfLocalDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(value: Date): Date {
  const d = startOfLocalDay(value);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function startOfMonth(value: Date): Date {
  const d = startOfLocalDay(value);
  d.setDate(1);
  return d;
}

function startOfDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString();
}

function endOfDate(value: string): string {
  const d = new Date(`${value}T23:59:59.999`);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString();
}
