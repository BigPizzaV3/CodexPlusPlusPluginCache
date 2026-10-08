---
name: plan-week
description: Plan or adjust a training week and put the workouts on the athlete's Garmin watch with Fit File Forge. Use when the user asks for next week's plan, a race block, to rearrange or catch up after missed sessions, or to send workouts to their watch.
---

To plan a week:

A single workout the athlete has already described ("6 × 800 m at 5K pace on Thursday") is built straight away with `build_workouts`; the propose-first step below is for multi-day plans.

1. Read the athlete first: `get_athlete` (thresholds and whether each is estimated, units, time zone, Garmin connection), `get_training_status` (fitness, fatigue, form), `get_trends` with range `4w` (recent weekly volume) and `get_calendar` for the week (what is already planned or on the watch).
2. Propose the week in plain words before building anything: each day's session, its purpose, and the week's volume against the last four. Keep hard days apart and easy days easy, and raise volume by no more than about 10% a week. Never stack missed sessions into catch-up days. Treat injuries the athlete mentions as hard limits.
3. Build only after the athlete agrees: one `build_workouts` call with up to seven sessions, each a plain-language description with its date. Where `get_athlete` shows a threshold as estimated or missing, put the target in the description ("at 4:35/km", "HR 150–160"). Use `edit_workout` to change one and `schedule_workouts` to move one or take it off the calendar.
4. Send to the watch only when the athlete asks or confirms: `send_to_garmin` with those workouts. Report each one as sent or not, with the weekday and date, and pass on any step the result says the athlete must take (connect Garmin, allow sending). Never say a workout is on the watch unless the result says it was sent.

Asking for advice never authorises saving or sending. If a call times out, check `get_calendar` before retrying so nothing is duplicated.

The athlete's explicit instructions come before these defaults (for example a different number of sessions, days or volume), except that nothing is sent to the watch without their OK. If what they ask looks risky, say so once, then follow their decision.
