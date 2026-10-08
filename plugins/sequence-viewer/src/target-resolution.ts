export type TargetResolution<T> =
  | { status: "resolved"; target: T }
  | { candidates: Array<T>; status: "ambiguous" }
  | { status: "not-found" };

/** Exact stable IDs win. Human-readable aliases must resolve uniquely. */
export function resolveViewerTarget<T>({
  aliases,
  id,
  selector,
  targets,
}: {
  aliases: (target: T) => Array<string | null | undefined>;
  id: (target: T) => string;
  selector: string;
  targets: Array<T>;
}): TargetResolution<T> {
  const exact = targets.find((target) => id(target) === selector);
  if (exact != null) return { status: "resolved", target: exact };
  const normalized = selector.trim().toLowerCase();
  const candidates = targets.filter((target) =>
    aliases(target).some((alias) => alias?.trim().toLowerCase() === normalized),
  );
  if (candidates.length === 1 && candidates[0] != null) {
    return { status: "resolved", target: candidates[0] };
  }
  return candidates.length > 1
    ? { candidates, status: "ambiguous" }
    : { status: "not-found" };
}
