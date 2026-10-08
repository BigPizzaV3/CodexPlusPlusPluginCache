# Career Command Center Recurring Run

Workspace: `{{WORKSPACE}}`
Config: `{{CONFIG}}`
CV standard: `{{STRATEGY}}`

Read the config, workspace contract, evidence bank, personalized question bank, state, and CV standard before doing anything. Current config overrides older run memory. The CV standard overrides old CVs and job-specific packages.

## Objective

Find at least {{MIN_LEADS}} new, verified, high-fit opportunities per run while respecting the configured countries, opportunity types, work arrangements, seniority, keywords, exclusions, and minimum score. If `inferRoleFamilies` is true, derive defensible role families from approved evidence and the user's career direction; do not invent a professional identity from old defaults. If it is false, use the user's explicit role families. The run may use up to {{SEARCH_DEPTH_MINUTES}} minutes. Search broadly and continue across source families instead of stopping after the first promising result.

Never lower the fit or verification standard to pad the count. If fewer than the configured minimum exist after the full search, report the shortfall and source coverage honestly.

## Sources

Search a rotating combination of:

- Official employer and university career pages.
- ATS platforms such as Workday, Greenhouse, Lever, Ashby, Personio, SmartRecruiters, SuccessFactors, Taleo, Onlyfy, Softfactors, and institution-specific portals.
- National and regional job boards relevant to configured countries.
- LinkedIn Jobs, Indeed, Glassdoor, jobs.ch, Jobup, and comparable aggregators for discovery.
- Research-institute, laboratory, doctoral-school, grant-project, and PI pages for PhD or research roles.
- Specialist boards for the configured role families.

An aggregator is a discovery source. Verify the complete posting, employer, location, active application route, and deadline on a canonical or authoritative page before promotion whenever possible.

## Verification and dedupe

For every candidate:

1. Capture the full posting and canonical URL.
2. Confirm the role is active and the application route works.
3. Score fit using verified evidence, not keyword count alone. Score candidate-to-role alignment only.
4. Check `leads`, `deleted_leads`, and `lead_tombstones` using stable source ID, canonical URL, apply URL, organization, and normalized title.
5. Use `scripts/state_cli.py upsert` to write the lead. Do not edit state with ad hoc string manipulation.

Never re-add an applied, archived, deleted, or tombstoned posting. Never create duplicate records for the same role across platforms.

Allowed statuses are `to_apply`, `monitor`, `applied`, `archived`, and `deleted`. Do not create `manual_check` items. Unverified discoveries remain outside state.

## Promotion

Promote an opportunity when the candidate has a credible evidence bridge and the major requirements are compatible. Record:

- Stable source ID and platform source.
- Title, organization, location, type, work arrangement, and deadline.
- Canonical posting and application URLs.
- Concise summary, responsibilities, and requirements.
- Fit score and tier. Missing upload documents, application forms, references, certificates, transcripts, deadlines, and portal logistics must not lower this score.
- `assessment_schema_version: 2`.
- `match_strengths`: two to five concise, posting-specific evidence bridges. Each must identify what candidate evidence supports which part of the role.
- `fit_gaps`: zero to three genuine capability or domain gaps. A fit gap is something the role needs that the evidence bank does not demonstrate.
- `eligibility_constraints`: practical conditions to confirm, such as permit, location, required language, travel, schedule, or contract terms.
- `application_requirements`: submission tasks and requested materials, including transcripts, certificates, referees, forms, portfolio links, deadlines, and upload instructions.
- `search_notes`: discovery or source-verification context that does not belong to candidate fit.
- Verification timestamp and snapshot path.

Do not write new lead assessments into the legacy `rationale` or `concerns` fields. Never place application requirements or search notes in `fit_gaps`. Never describe missing submission documents as a candidate weakness.

Tier A is an exceptional match suitable for a package. Tier B is credible and worth applying to or monitoring. Do not package weak or speculative roles.

## CV and cover-letter packages

Read `Config/command_center_config.json` before package creation. Create packages only when enabled in config and the lead is Tier A or unusually strategic Tier B.

Before generating a CV:

1. Confirm `Verified_Evidence_Ledger.md`, `approved_evidence.json`, and at least one approved role-family master exist.
2. Read `personalized_questions.json`. If any question is `open`, `answered`, or `unable_to_verify`, keep searching and saving verified leads but do not create a CV or cover-letter package until the evidence review is complete.
3. Read the complete posting snapshot.
4. Follow `CV_GENERATION_STANDARD.md` exactly.
5. Copy one approved master. Never start from a blank page or an old tailored CV.
6. Use approved evidence IDs and preserve measured, estimated, shared, and blocked-claim boundaries.
7. Create `tailoring_notes.md` with the strategy version, base master, evidence IDs, changes, stretches, and review outcome.
8. Render and inspect the PDF and editable source. Run evidence, ATS, duplicate, integrity, and visual checks.
9. Do not mark a package ready while a blocker remains.

Cover letters must be direct, specific, and natural. Avoid generic openings, exaggerated enthusiasm, symmetric template structure, corporate filler, contrast formulas, and unsupported claims.

## Completion

Use `scripts/state_cli.py record-run` to write `Automation/automation_status.json` with run times, sources checked, leads added, packages created, shortfall, and errors. Keep the user-facing summary concise and list the strongest new leads first.
