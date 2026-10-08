---
name: codex-cost
description: Explore local Codex usage in an animated, colored ASCII terminal dashboard or static charts. Use for token totals, model breakdowns, cumulative API-equivalent cost, cost by repo, or the GPT-3 era comparison from local Codex history.
---

# Codex Cost

This skill includes its own portable tool. Resolve this skill's directory, following a symlink if necessary, and open the dashboard with `scripts/open.sh`. Do not call `node` yourself: the `node` on PATH is often older than 22.13. It needs no checkout, npm dependencies, API key, or account sign-in. A source copy without that script must first be built using this repository's skill build instructions; do not substitute a registry package with the same name.

## Opening the dashboard

When the user invokes this skill or asks to open, show, or run their dashboard, start the **animated dashboard in a new Terminal window**. A new tab cannot be created from Codex: writing into the front window pastes the command into the current Codex tab, and it never runs. The Codex TUI has no terminal of its own, so do not paint on `/dev/tty`, do not pass `--takeover`, and do not ask the user to press Ctrl+Z or q in the current tab.

```bash
/bin/sh "/absolute/path/to/codex-cost/scripts/open.sh"
```

Resolve the skill's real directory first. Append dashboard flags when asked, for example `--range 30d` or `--metric cost`. Do not pass `--takeover`, `--seconds`, or `--width` unless the user asked for a narrower chart.

The script starts the dashboard itself in a new Terminal window. Never type the launcher into the current tab. Do not claim it opened unless the command succeeded. Do not tell the user to press q in the current tab.

**This needs permission to control Terminal.app.** If the command reports that it is sandboxed or cannot reach Terminal, request approval and re-run **the same `open.sh` command**. Do not switch to a static ASCII report, and do not offer a Ctrl+Z handoff.

Do not use a desktop or computer-use tool to launch the dashboard. `open.sh` is the only launch path.

## Charts in the conversation

Use this only when the user asks for charts in the conversation, a saved report, or noninteractive output:

```bash
/bin/sh "/absolute/path/to/codex-cost/scripts/run.sh" --terminal --ascii --no-color --width 80
```

**Return the command's real output, verbatim, in a fenced `text` block.** Do not summarize it, retype it, reformat it into your own bullet list, or drop the ASCII charts — the charts are the point of running this, and a prose summary of them is not an acceptable substitute. Include the coverage and warning lines as printed. See [Static charts or structured data](#static-charts-or-structured-data) for the range, bucket, metric, and detail flags.

Only run the static command when the user asked for charts in the conversation, a saved report, or noninteractive output. A failed window launch is not that request.

## Dashboard window

The dashboard animates by owning a screen: alternate screen buffer, hidden cursor, and a repaint timer. That cannot happen inside the Codex TUI or the conversation transcript. `open.sh` starts it in a new Terminal window, where the page keys work. Press `q` in that window to quit.

## Dashboard reference

When the user asks for animation, this is the colored interactive dashboard that `open.sh` starts in a new Terminal window. It starts with ASCII characters; the `a` key switches to Unicode/Braille. Its six full-page charts are Activity, Cumulative cost, Models, Token mix, GPT-3 era, and Cost by repo. Every page summarizes the full selected range; changing pages keeps the same range and aggregate totals.

The launcher starts with colored ASCII charts. Its explicit `--no-color` option or the dashboard's `c` key switches to monochrome. For a requested range or other flags, append them to the launcher command; it passes them through. Do not claim the dashboard started unless you actually saw it run.

Controls:

- Left/Right or `h`/`l`: cycle through chart pages.
- `1`–`6`: open Activity, Cumulative cost, Models, Token mix, GPT-3 era, or Cost by repo directly.
- Home/End: jump to the first/last chart page.
- Up/Down or `k`/`j`, and PageUp/PageDown: scroll the current page.
- `m`: on Activity, switch the Y axis between daily tokens and API-equivalent dollars.
- `a`: toggle ASCII and Unicode/Braille characters; starts in ASCII.
- `c`: toggle color.
- Space: pause/resume chart motion.
- `r`: replay the page entrance while motion is running.
- `q` or Ctrl+C: quit.

Use `--range all|7d|30d|90d` when a period is requested; otherwise use all history. Activity shows daily values as shaded areas stacked by model. It starts with tokens; use `--inspect --metric cost` to start with API-equivalent dollars. The `m` key changes only Activity's metric, and that choice persists when switching pages. Weekly/monthly `--bucket` values are for static reports only.

When history is wider than the chart, Activity sums consecutive days into labeled buckets. Interpret those Y values as bucket totals. Unpriced usage remains in token totals and is excluded from dollar estimates.

Motion is enabled by default:

- Activity uses contour currents, with `.`, `=`, and `#` waves inside the model-colored areas.
- Cumulative cost uses bright `o===` signal packets traveling along complete, faint dotted model curves.
- Models uses sparks circling `:` rails at each model's fixed bar length.
- Token mix uses a continuously looping sorting machine, with `o` particles falling into fixed colored `#` segments. Monochrome retains `I`, `C`, and `O` for input, cached input, and output.
- GPT-3 era uses two vertical bars side by side on the same dollar scale, with a flip-dot entrance that plays once, then settles until replayed.
- Cost by repo ranks the full range's local repo totals by API-equivalent cost. Chevrons loop through complete bars while names, dollar labels, and lengths stay fixed. Preserve partial and unpriced labels; wholly unpriced groups have no dollar bar. Repo groups use available repository or directory names, so same-name roots may be combined.

The reporting range, totals, dates, and dollar labels stay fixed. Space pauses or resumes motion; `r` replays while motion is running. Use `--inspect --no-motion` when the user requests still charts or reduced motion; the completed chart appears immediately and Space can enable motion later. Static reports and JSON never animate.

`--ascii`, `--color`, `--no-color`, and `--width 40..160` can accompany `--inspect`. ASCII is already the interactive default; use the `a` key for Unicode/Braille. `--color` overrides the `NO_COLOR` environment setting; use `--no-color` instead when the user requests monochrome. The two color flags cannot be combined. Interactive ASCII charts can retain their model colors.

## Static charts or structured data

When the user asks for charts inside the conversation, a saved report, or noninteractive output — not the live dashboard — run:

```bash
/bin/sh "/absolute/path/to/codex-cost/scripts/run.sh" --terminal --ascii --no-color --width 80
```

Match these options to the request:

- `--range all|7d|30d|90d`: reporting period, in UTC.
- `--bucket day|week|month`: group the activity chart.
- `--metric tokens|cost`: choose activity values.
- `--details`: include exact grouped values.
- `--data-dir`: use an explicitly supplied local history directory.
- `--rescan`: rebuild the local metadata index when requested.

Static reports print once and exit. Return the actual output in a fenced `text` block, preserving dates, model identifiers, totals, coverage labels, and warnings. For a focused request, include only relevant sections and the qualifications needed to interpret them. Do not invent or redraw usage from memory. Use `--json` instead for structured analytics, optionally with `--range`, and without terminal presentation flags. Report actionable errors if execution fails.

## Interpretation and privacy

Dollar values are API-equivalent estimates, not actual Codex subscription charges or invoices. Unpriced models remain in token totals but are excluded from cost; preserve partial and unpriced labels. Reasoning is already included in output, and cached input is already included in logged input, so neither is counted twice. The GPT-3 comparison is a pricing thought experiment, not equivalent model capability or a historical invoice.

The tool reads local logs and stores only numerical usage/session metadata in its local cache. It does not upload history or modify session logs. Local history may omit deleted records, other devices, and server-only usage.
