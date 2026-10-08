---
title: Project Memory Companion for Obsidian
---

# Obsidian companion

Project Memory Companion is an optional visual review interface for the same portable Markdown used by Project Memory. The vault works without it.

## Dashboard

The dashboard shows:

- active and applied Promotion Inbox candidates with guarded lifecycle state;
- diff previews and side-by-side conflict comparisons;
- candidate search, status/operation filters, and explicit-selection bulk defer/reject actions;
- team notes with draft, requested, or changes-requested review state;
- overdue review dates;
- superseded notes missing replacement links;
- thin or uncovered workstreams from `Coverage.md`.
- the latest generated `Health Report.md` findings;
- a chronological knowledge timeline.

Use the brain-circuit ribbon icon or **Project Memory Companion: Open dashboard**.

## Candidate actions

Approve, reject, or defer candidates directly in the dashboard. Approval records a timestamp, optional reviewer alias, and proposal fingerprint. It intentionally does not apply the proposed change to canonical notes. Bulk approval is unavailable; semantic approval remains candidate-by-candidate.

After approving candidates, ask Codex:

```text
Apply the approved Project Memory candidates after rechecking conflicts and evidence.
```

## Team reviews

The companion can approve a team review or request changes. It records `review_status`, the review date, and an optional reviewer alias configured locally in Obsidian settings.

## Notifications

The optional local startup summary reports approved candidates awaiting application, application conflicts or failures, and overdue reviews. Disable it in the companion settings when you prefer dashboard-only review.

## Local installation

Copy the release files into:

```text
<vault>/.obsidian/plugins/project-memory-companion/
```

The folder must contain `main.js`, `manifest.json`, and `styles.css`. Reload Obsidian, open **Settings → Community plugins**, and enable **Project Memory Companion**.

The plugin is mobile-compatible and uses no Node.js or Electron APIs. It has no network access, telemetry, account, or external storage.
