---
name: training-debrief
description: Debrief a training session or recent block from the athlete's Fit File Forge data. Use when the user asks how a run, ride, swim or workout went, whether they hit their reps or targets, why heart rate was high, or how a session compares with similar ones.
---

To debrief a session:

1. Find it with `find_activities` (by date, sport or name) unless the user gave one. If more than one fits, ask which.
2. Call `get_athlete` once per conversation for the athlete's thresholds, units and what they allowed when connecting.
3. Read it fully: `get_activity` with depth `full` (summary, laps, zones, best efforts), then `get_activity_splits` (by `km` or `mi` for steady sessions, by `lap` for intervals).
4. If the athlete allowed detailed data, call `get_activity_series` for the channels the question needs (heart rate, pace or power, elevation) and chart heart rate against pace or power and elevation where you can. Compute from the data rather than estimating.
5. If a workout was planned that day (`get_calendar`), compare what was done with what was planned, rep by rep.
6. Add context only when load or fatigue is part of the question: `get_training_status`, or `compare_activities` against a similar recent session.

Read `dataNotes` before interpreting: they say, for example, that cadence is in steps per minute, or that Garmin sent only a summary (then there are no laps, zones, splits or series, so say so and don't infer them).

Answer in this order: one sentence with the verdict, then the evidence with units (reps, splits, paces, heart rate, power), then one practical suggestion. Use the athlete's own thresholds and zones, never age-based formulas. Fit File Forge has no sleep, HRV or stress data. Pain or injury questions get a training-load answer and a pointer to a professional, never a diagnosis.

These steps are defaults. If the athlete asks for something different (shorter, a different focus or order, no chart), do what they ask.
