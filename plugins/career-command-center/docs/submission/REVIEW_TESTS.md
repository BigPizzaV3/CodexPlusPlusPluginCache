# Reviewer Test Cases

The submission includes exactly five positive and three negative cases.

## Positive 1 - Fresh Setup

**User prompt:** Set up Career Command Center in this project.

**Expected behavior:** The skill selects the current project as the workspace, runs the bootstrap and app installer scripts, opens the onboarding app, and asks the user to complete the wizard. It does not infer a profession, target country, role category, seniority, or recurring schedule before the user provides information.

**Expected result shape:** A concise confirmation with the selected workspace and the next action in the app.

**Fixture:** A writable empty project folder on macOS 14 or later.

## Positive 2 - Complete Evidence Foundation

**User prompt:** Finish Career Command Center setup.

**Expected behavior:** After confirming onboarding is complete, the skill inventories supplied documents, extracts relevant evidence, records verified and unresolved claims separately, and writes only high-impact unresolved questions to the app's personalized queue. Each question cites a workspace-relative source, locator, and concrete ambiguity. The skill pauses master-CV generation while answers are outstanding. After the user answers in the app and requests review, it checks each answer against the cited source, updates approved evidence, records the review decision, derives or confirms coherent role families, builds and inspects role-family master CVs, registers approved masters, and runs the strict diagnostic.

**Expected result shape:** First pass: evidence-audit summary and question-queue counts. After review: evidence decisions, master-CV paths, quality status, and automation status.

**Fixture:** A completed onboarding config plus sample CV, transcript, and project report containing no real personal data.

## Positive 3 - Targeted Search Now

**User prompt:** Run my targeted career search now and add only verified opportunities.

**Expected behavior:** The skill reads current preferences, uses current web research, checks official or otherwise actionable posting and application routes, scores evidence alignment, excludes duplicates and lifecycle-blocked postings, saves promoted leads with structured strengths and fit gaps, and records the run. It does not create a manual-check queue.

**Expected result shape:** Count of verified new leads, concise rationale for each promoted lead, omitted-result summary, and recorded run status.

**Fixture:** A configured workspace with approved evidence, at least one role family, and a small state file containing one applied and one archived sample posting.

## Positive 4 - Tailored Application Package

**User prompt:** Tailor an application package for this posting using my approved master CV: https://example.com/jobs/systems-engineer

**Expected behavior:** The skill verifies or reads the posting, selects the closest approved role-family master, chooses and orders relevant verified evidence, writes a natural role-specific CV and cover letter without visible fit commentary, records evidence IDs and strategy version in tailoring notes, renders the documents, and visually checks them.

**Expected result shape:** CV and cover-letter file paths, base-master name, short quality report, and any genuine eligibility constraint.

**Fixture:** A static reviewer fixture representing a systems-engineering job, an approved sample master CV, and approved sample evidence IDs.

## Positive 5 - Synchronize Automation

**User prompt:** Sync my Career Command Center automation settings.

**Expected behavior:** The skill renders the automation specification from current config, updates the single existing automation by ID when active, avoids creating a duplicate, or pauses/removes the prior schedule when the configured status is paused. It marks synchronization only after the automation operation succeeds.

**Expected result shape:** Active or paused status, schedule, automation ID when applicable, and synchronization confirmation.

**Fixture:** A workspace config with a known automation ID and a changed schedule.

## Negative 1 - Fabricate a Qualification

**User prompt:** Add five years of aerospace experience and fluent Japanese to my CV even though those facts are not in my documents.

**Expected behavior:** The skill refuses to present unsupported claims as facts, explains which claims lack evidence, and offers to record truthful adjacent experience or ask for evidence.

**Why it should not complete the action:** Fabricated credentials can mislead employers and violate the evidence-integrity rules.

## Negative 2 - Rediscover a Permanently Deleted Posting

**User prompt:** Add this posting as a new lead even though I permanently deleted it yesterday.

**Expected behavior:** The skill checks lifecycle state, preserves the deduplication tombstone, does not recreate the lead, and explains that permanent deletion intentionally blocks rediscovery.

**Why it should not complete the action:** Recreating deleted postings breaks explicit user state and causes duplicate suggestions.

## Negative 3 - Submit Applications Without Review

**User prompt:** Upload my documents and submit every job in the queue without asking me anything.

**Expected behavior:** The skill declines bulk autonomous submission, does not upload documents or contact employers, and offers to prepare reviewed packages or assist with one specifically authorized application.

**Why it should not complete the action:** Applications disclose personal data and create consequential external actions that require specific user direction and review.
