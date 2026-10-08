# Briefing collection contract

## Public default: brief essentials first

Start with whether the work is progressing, any meaningful blocker, and any decision the user needs to make. This applies to every installation and manager conversation without a special mode. Usually a short paragraph or up to three material points is enough; clarity and necessary disclosure take precedence over a fixed length.

Group related changes and prioritize what matters now. Do not list every task or fill empty headings for "no blockers" and "no decisions". If all work is routine, one accurate sentence is enough. Do not repeat unchanged state without a useful reason.

Keep file lists, raw logs, commands, test counts, internal decision/delivery IDs and step-by-step history in supporting records. Show only the depth of evidence requested or needed to assess a decision. Preserve exact task titles and a short source link where useful. A material failure, risk, unknown result or coverage gap belongs in the short report; concision must not hide it.

"Details", "evidence" or "everything" expands the current response to the requested scope, with sources and uncertainties. It does not permanently make later reports verbose. Only an explicit standing preference changes the default. A request for all tasks requires the actual accessible inventory and disclosed gaps, not an invented complete list.

| Available evidence | Honest short status |
|---|---|
| Send tool confirms enqueue only | Sent; acceptance not yet confirmed |
| Worker echoes the assignment's decision ID with acceptance | Accepted; not yet proof that work started |
| Correlated evidence shows assigned work is underway | Running |
| Worker claims completion without acceptance evidence | Worker reports done; verification outstanding |
| Correlated result meets the mandate's acceptance evidence | Completed with the relevant verified result |
| Receipt/response is ambiguous or unrelated | Status unconfirmed; no success attribution |

Do not expose internal IDs just to explain these distinctions. Keep them in the audit record for correlation. Apply [delegation.md](delegation.md) before collecting extensive history, benchmarking or investigating an issue: the short presentation is not permission for long direct work hidden behind it. Delegated collection inherits the exact authorized read scope and exclusions. After dispatch, briefly report the known state and return; do not wait for a report worker to finish.

## Evidence collection and continuity

1. Establish an aware `captured_until` timestamp at collection start and the user's IANA timezone. First report starts at local midnight on that date. Later reports start at the last successfully delivered cutoff, even across dates. Use `[start, captured_until)`; an event exactly at the cutoff belongs to the next report.
2. Inventory accessible Codex tasks, including pinned and unpinned tasks, and archived tasks when they may contain changes in the interval. Filter Codex work separately from ChatGPT conversations. A task created earlier belongs in the report if it changed in the interval. Include old running tasks only as clearly labeled carryover context, not new activity.
3. Respect each tool's pagination and limits. Never infer completeness from a default ten-item listing or a fixed recent-task cap. Expand listings and turn history until the interval is covered when the tool permits. Record exclusions, unavailable hosts, truncated pages and time gaps. Without exhaustive coverage proof, say `PARTIAL`, not “all tasks”.
4. Read compact summaries first, expanding only relevant changes and the evidence for proposed decisions. Recover all turns in the interval for included tasks when claiming complete interval coverage. Do not ingest every transcript into the CEO context.
5. Deduplicate by host + task + event/turn identifier. Observe task changes at event time, not folder modification time. Treat missing or conflicting timestamps as a coverage gap. If a source can deliver late events, use a bounded lookback plus persisted IDs; retain source cursors and disclose any unbounded lateness. The preview's offline timestamp filter alone does not solve late arrival.
6. Keep a report ID, interval, per-source cursors, task IDs, coverage, evidence links and delivery status. Store only in the user's manager workspace or a host-provided plugin data directory whose availability is verified. Never write into managed repositories just to keep secretary state. If no safe state store is available, use the current conversation and disclose that cross-chat continuity is unavailable.
7. Save a report before handing it off. Advance the global delivered watermark only after complete coverage and confirmed delivery. Confirmation is a host delivery receipt tied to report ID, or a subsequent user message explicitly acknowledging that report. An enqueue receipt alone is not delivery. If neither is available, mark delivery unconfirmed, preserve the old watermark and deduplicate at retry; do not demand acknowledgment on every report just to improve bookkeeping. A saved draft alone does not prove delivery. Partial reports can be useful but cannot silently skip missing work on the next run.

Keep period, cutoff, coverage, sources and target identifiers in the supporting report record. The default user response summarizes material progress, blockers and decisions, disclosing relevant gaps briefly. Detailed report fields are available when requested; they are not a compulsory user-facing template.

No report history means local today, not the last 24 hours. An existing report does not permit reading excluded or unrelated historical persona/configuration material.
