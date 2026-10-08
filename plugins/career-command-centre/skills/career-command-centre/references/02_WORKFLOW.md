# Workflow

Use this workflow as a state machine. A run may move backwards when validation fails; it may not skip a required gate.

1. `INTENT` — infer what outcome the user wants.
2. `INGEST` — read all supplied CV versions, role material and prior passport; register every source document.
3. `EVIDENCE` — extract source-only claims with provenance and reconcile cross-CV conflicts without silently merging them.
4. `REVIEW` — give a short qualitative CV read: strengths, likely underselling, inconsistencies and one priority edit; do not imply a universal ATS score.
5. `PREFERENCES` — resolve only decision-critical gaps.
6. `HISTORY` — reconcile prior roles, applications and corrections.
7. `DISCOVER` — search broadly enough to be selective.
8. `NORMALISE` — create stable role identities and deduplicate.
9. `VERIFY` — exact URL, open status, checked time and content fingerprint.
10. `ENRICH` — salary, employment type, closing date and recruiter.
11. `MAP` — requirement-to-evidence mapping and hard-gate review.
12. `CLARIFY` — optional micro-question only when decision-changing.
13. `DECIDE` — Apply, Maybe or Skip with honest risk.
14. `CRITIQUE` — check for preference, evidence and optimism errors.
15. `BUILD` — optional application pack from approved evidence IDs.
16. `QA` — contract, DOCX and rendered-layout checks.
17. `COMMIT` — update the Career Evidence File, preferences and immutable history events.
18. `NEXT` — give one clear next action, offer a milestone backup when useful, or schedule recurring work.

## Completion states

- `SUCCESS`: all requested work and required artifacts passed validation.
- `SUCCESS_NO_PACK`: requested assessment/search completed; no application pack was requested or eligible.
- `PARTIAL`: useful output exists but a non-optional stage remains incomplete.
- `BLOCKED`: an external dependency or critical user fact prevents progress.
- `FAILED`: output is unsafe or unusable and no reliable partial result can be returned.

Never upgrade `PARTIAL` to `SUCCESS` merely because a conversational answer was produced.
