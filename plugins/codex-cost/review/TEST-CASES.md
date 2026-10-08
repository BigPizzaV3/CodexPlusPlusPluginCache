# Codex Cost review cases

These fixtures are entirely synthetic. They contain invented session IDs, paths,
timestamps, and token counts, with no prompts, responses, credentials, or real
usage history. `synthetic-unpriced-model` is deliberately absent from the bundled
price table. The malformed fixture intentionally includes one invalid JSON line.

Run from the repository or extracted plugin root. The reporting engine needs
Node.js 22.13+; `run.sh` selects a compatible installed version. No sign-in, API key,
network call, or real Codex history is needed for these cases.

```sh
review_tmp=$(mktemp -d)
export CODEX_COST_CACHE_DIR="$review_tmp/cache"
review_report() {
  /bin/sh skills/codex-cost/scripts/run.sh \
    --data-dir review/fixtures/main --range all "$@"
}
```

The explicit data directory restricts reporting to the supplied fixture; the
temporary cache keeps reviewer settings separate. Always use `--range all` for
these fixed dates. The report may append zero-usage days through the current UTC
date. Node versions that label SQLite experimental may print a warning to stderr;
JSON on stdout must remain parseable.

## Five positive cases

1. **Structured report and token accounting.** Ask Codex to report the supplied
   `review/fixtures/main` history as JSON, or reproduce directly:

   ```sh
   review_report --json > "$review_tmp/main.json"
   ```

   Expect exit 0 and valid JSON: `sessions=3`, `inputTokens=1200`,
   `cachedInputTokens=1000`, `outputTokens=220`, `totalTokens=2420`.
   Cached input and reasoning are each counted once. `pricedTokens=2200` and
   `unpricedTokens=220`; the bundled price table yields
   `estimatedApiCost=0.0058625` USD. This is a partial API-equivalent estimate.

2. **Modern request deduplication.** Run `review_report --json`. In `daily`, the
   `2026-01-05` entry must contain `inputTokens=700`, `cachedInputTokens=800`,
   `outputTokens=150`, and `totalTokens=1650`. The repeated response ID and request
   owned by another thread must not increase those counts.

3. **Archived cumulative history.** Run `review_report --json`. The `2026-01-06`
   daily entry must contain `inputTokens=350`, `cachedInputTokens=150`,
   `outputTokens=50`, and `totalTokens=550`. The file under `archived_sessions/`
   must be found, and repeated cumulative snapshots must not be summed twice.

4. **Static charts and unknown-price handling.** Ask for static ASCII charts of
   the supplied history, or run:

   ```sh
   review_report --terminal --ascii --no-color --width 80 --bucket month --details
   ```

   Expect a complete monochrome report with activity, cumulative cost, model and
   token sections, projects, GPT-3 comparison, and coverage/accounting notes.
   Keep `<$0.01 (partial)`, the 220-token missing-price note, and `Unpriced` beside
   `synthetic-unpriced-model` / `unpriced-demo`. The JSON model entry must have
   `pricingKnown=false`, `unpricedTokens=220`, and `estimatedApiCost=0`; this zero
   is a sentinel for unavailable pricing, not a claim of free usage. The GPT-3
   thought experiment includes all 2,420 tokens and totals `$0.1452` before display
   rounding. Codex should return actual static output with its qualifications.

5. **Cache reuse and explicit refresh.** After an earlier main-fixture run:

   ```sh
   review_report --json > "$review_tmp/cached.json"
   review_report --json --rescan > "$review_tmp/rescanned.json"
   ```

   Both reports must retain the same totals and model coverage as case 1.
   `diagnostics.cachedFiles` must be 3 on the warm run and 0 after `--rescan`.
   In this runtime, `diagnostics.parsedFiles` includes successfully loaded cache
   entries; use `cachedFiles` to distinguish reuse.

## Three negative or recovery cases

1. **Unsupported range.** Run `review_report --json --range 14d`.
   Expect exit 1, no JSON output, and the actionable stderr message
   `Codex Cost: --range must be all, 7d, 30d, or 90d.`

2. **No local records.** Create an empty supplied data directory:

   ```sh
   mkdir "$review_tmp/empty"
   /bin/sh skills/codex-cost/scripts/run.sh \
     --json --range all --data-dir "$review_tmp/empty"
   ```

   Expect exit 0, valid JSON, `sessions=0`, `totalTokens=0`,
   `estimatedApiCost=0`, and `diagnostics.files=0`. No data from the reviewer's
   default history may appear.

3. **Malformed and incomplete records.** Run:

   ```sh
   /bin/sh skills/codex-cost/scripts/run.sh \
     --json --range all --data-dir review/fixtures/malformed
   ```

   Expect exit 0 and retention of the valid record: `sessions=1`,
   `inputTokens=75`, `cachedInputTokens=25`, `outputTokens=10`,
   `totalTokens=110`. `diagnostics.malformedLines=1`; `diagnostics.warnings`
   must report one malformed/partially written line and one incomplete or
   inconsistent usage record. Do not invent missing usage.

## Validation record

All eight cases above were executed against the bundled reporting runtime on
2026-09-12. Exact JSON totals, price coverage, per-day accounting, cache behavior,
invalid-range exit status, and recovery diagnostics were asserted. Static report
sections and partial/unpriced labels were checked. Fixture files remained
unchanged. These checks do not claim an interactive macOS Terminal or official
directory installation test; those require separate host-level verification.
