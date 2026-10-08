---
name: weekly-review
description: Review a completed nutrition and fitness week in ChatGPT Library using the user's persisted targets, canonical ledger, and reconciled activity data.
---

# Weekly Review

Use this skill when the user asks for a weekly review, weekly recap, seven-day summary, adherence review, trends, or a nutrition/fitness cross-reference.

## Source and date rules

- Resolve the canonical Library nutrition ledger before calculating anything. The ledger is the source of truth; rebuildable current-state files and workbook projections are not sufficient by themselves.
- Use the ledger's persisted IANA timezone for every day boundary. A review window is seven complete local calendar days unless the user explicitly supplies another range.
- Include only entries and fitness observations whose local date falls inside the requested window. Do not leak data from the day before or after the window.
- Reconcile fitness inputs before analysis. Apple Health is canonical for automated steps when present; an explicit persisted manual override supersedes it. Preserve and disclose source conflicts rather than silently summing duplicates.
- Treat missing nutrient fields as `unknown`, never as zero. Distinguish measured, labeled, reference-derived, reconstructed, and unknown values in the review.

## Targets are user-specific

- Never invent, assume, or substitute a calorie, protein, fiber, micronutrient, step, or weight target.
- Use only targets explicitly stored in the user's ledger or explicitly supplied by the user in the current conversation. If a target is absent, report the metric without a target comparison and label the comparison unavailable.
- In particular, never use a hard-coded 2,000-kcal standard. A generic Daily Value may be shown only in the micronutrient reference section, never as the user's calorie target.
- Preserve the distinction between a single daily target and a target range. For ranges, report the range and the number of days within it; do not collapse it to an invented midpoint.
- Record the target basis and provenance in the narrative (for example, `USER_EXPLICIT` or `LEDGER_TARGET`).

## Required review sections

1. **Window and data quality** — local dates, number of days represented, missing days, late-arriving source data, unresolved conflicts, and unknown coverage.
2. **Nutrition** — daily and seven-day totals/averages for calories, protein, carbohydrates, fat, fiber, and hydration when available. Compare calories and protein only with user-specific targets. Show target attainment as a range or percentage only when the target exists.
3. **Micronutrients** — weekly totals/averages or coverage notes for tracked nutrients, with amount plus `%DV`/reference only where the reference is defined. Unknown is not deficiency.
4. **Fitness and activity** — canonical steps, workout/cardio sessions, and relevant body metrics. Flag suspicious post-hoc workout durations; do not use them for workout-density conclusions unless the user confirms they are valid.
5. **Cross-reference and trends** — compare nutrition and activity on workout versus rest days, and use non-overlapping 24/48/72-hour pre-workout windows when relevant. Use smoothed weight trends and ranges rather than point-cause claims.
6. **Actions** — concise, evidence-backed adjustments tied to the observed data. Do not prescribe medical treatment or infer a deficiency from incomplete coverage.

## Output contract

- State the exact window and timezone first.
- Provide a compact daily table followed by weekly averages/totals, target comparisons, data-quality caveats, and findings.
- Keep measured values separate from estimates and unknowns.
- Explain whether each conclusion is supported, suggestive, or unavailable because of missing data.
- A weekly review is read-only unless the user explicitly asks to log a correction or persist a target; never mutate the ledger merely by reviewing it.
