/**
 * Minimal, dependency-free validation helpers.
 *
 * In the canonical stack these would be Zod schemas. Here they are small,
 * explicit guards with the same responsibility: validate + coerce untrusted
 * input at the API boundary and return typed values or throw ValidationError.
 */

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when an operation needs explicit user consent that was not supplied
 * (e.g. sending a report context to an external AI provider). Maps to HTTP 409
 * so the client can distinguish "you must confirm this specific payload" from a
 * plain validation error. No external side effect occurs when this is thrown.
 */
export class ConsentRequiredError extends Error {
  status = 409;
  /** Machine-readable so the client can react (e.g. show the payload preview). */
  readonly code = "consent_required";
  /** Extra context the client needs to obtain consent (provider, digest, …). */
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ConsentRequiredError";
    this.details = details;
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function str(v: unknown, field: string): string {
  if (typeof v !== "string") throw new ValidationError(`${field} must be a string`);
  return v;
}

export function optStr(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  return str(v, field);
}

export function nonEmpty(v: unknown, field: string): string {
  const s = str(v, field).trim();
  if (!s) throw new ValidationError(`${field} must not be empty`);
  return s;
}

export function bool(v: unknown, field: string, def?: boolean): boolean {
  if (v === undefined && def !== undefined) return def;
  if (typeof v !== "boolean") throw new ValidationError(`${field} must be a boolean`);
  return v;
}

export function num(v: unknown, field: string, def?: number): number {
  if (v === undefined && def !== undefined) return def;
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new ValidationError(`${field} must be a number`);
  return v;
}

export function enumOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  field: string,
  def?: T,
): T {
  if (v === undefined && def !== undefined) return def;
  if (typeof v !== "string" || !allowed.includes(v as T))
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  return v as T;
}

export function strArray(v: unknown, field: string, def: string[] = []): string[] {
  if (v === undefined) return def;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw new ValidationError(`${field} must be an array of strings`);
  return v as string[];
}

export function isoDate(v: unknown, field: string): string {
  const s = str(v, field);
  if (Number.isNaN(Date.parse(s)))
    throw new ValidationError(`${field} must be a valid date`);
  return s;
}
