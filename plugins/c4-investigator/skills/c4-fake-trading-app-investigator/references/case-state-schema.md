# Case state schema

Use `assets/case-checkpoint-template.json` as the canonical structure. Keep IDs stable even if an item is corrected or withdrawn.

## Required top-level sections

- `case`: reference, title, status, purpose, jurisdiction, incident dates, investigator role, authority basis, and checkpoint time.
- `allegation_summary`: neutral summary and claimed loss.
- `evidence`: originals and derivatives with provenance.
- `entities`: people, organizations, accounts, domains, devices, apps, and infrastructure.
- `iocs`: normalized observable indicators.
- `transactions`: fiat and crypto payment ledger.
- `timeline`: dated events with source evidence.
- `hypotheses`: leading and alternative explanations with supporting and contrary evidence.
- `findings`: fact, reported statement, inference, or unknown; material findings cite evidence.
- `legal_candidates`: verified-as-of source and element mapping, never just a section list.
- `actions`: completed, pending, blocked, or declined actions.
- `contradictions`: unresolved conflicts in evidence or accounts.
- `limitations`: constraints on scope, sources, methods, or certainty.
- `open_questions`: material facts still needed.
- `readiness`: gate checks, status, reviewer confirmation, and rationale.

## Update discipline

Do not delete superseded data silently. Mark it superseded and link the replacement. Store timestamps as ISO 8601 where possible and always include timezone or explicitly mark it unknown. Normalize money with currency or token and keep conversion assumptions separate.

Material findings require at least one `evidence_ids` entry. Inferences require a confidence level and rationale. Legal candidates require an official source URL, verification date, and one or more elements.
