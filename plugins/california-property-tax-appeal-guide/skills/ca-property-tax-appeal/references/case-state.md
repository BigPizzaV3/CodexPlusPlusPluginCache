# Case state and continuity

Create and maintain one case-state object using `references/case-state-schema.json`. Update it after every meaningful user answer or research result. Do not expose the full JSON during Guided Mode unless the user asks.

Preserve the object across language changes and resumed conversations. Never replace a verified fact with a weaker source silently. Add a conflict and ask one question when official data and a user document materially disagree.

Run `python3 scripts/validate_case_state.py CASE.json` before valuation conclusions, before generating a filing packet, and after reviewing proof of filing.

Key gates:

- Do not begin valuation analysis while `parcel_status` is `ambiguous`.
- Do not present a deadline as exact unless it is `verified` with an official source and access date.
- Do not call an application submitted unless `submission_status` is at least `submitted_user_reported`.
- Do not call filing verified unless `proof_status` is `confirmation_verified` and the confirmation identifies the filing authority, submission event, date/time or receipt date, and case/APN/application identifier.
- Never treat `draft`, `payment attempted`, or `file uploaded` as submission.
- Keep missing facts in `unresolved_facts`; never fill them by inference.
