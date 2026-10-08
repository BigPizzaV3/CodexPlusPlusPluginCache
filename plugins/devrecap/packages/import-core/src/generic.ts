/**
 * GenericTextAdapter — the lowest-priority fallback.
 *
 * When no specialized adapter recognizes an imported file, this adapter keeps
 * the content as coarse note events (one per non-empty line, capped) so the
 * import is never silently lost. It always returns a tiny non-zero confidence
 * so it wins only when nothing else matches.
 */

import type { RawEvent, ImportSourceAdapter } from "@devrecap/shared";

const MAX_LINES = 5000;

export class GenericTextAdapter implements ImportSourceAdapter {
  readonly kind = "generic" as const;
  detect(): number {
    return 0.05; // always a weak match; specialized adapters outrank it
  }
  parseContent(content: string): { events: RawEvent[]; malformed: number; sessionId?: string } {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    const events: RawEvent[] = [];
    let seq = 0;
    for (const line of lines.slice(0, MAX_LINES)) {
      events.push({
        seq: seq++,
        rootType: "generic",
        payloadType: "note",
        data: { text: line },
        raw: line,
      });
    }
    return { events, malformed: 0 };
  }
}
