---
name: infer-product-operations
description: "Analyze GitHub or GitLab Issue flow for a requested period, focusing on two populations: Issues that changed from open to closed during the period and Issues that were still open at period end. Break both populations into mutually exclusive creation-age buckets of 0–7 days, 8–14 days, 15–30 days, and over 30 days; preserve labels and inspect delivery links for closures. Use for lightweight project progress reports, closure-flow reviews, open-backlog aging, weekly or monthly Issue summaries, and requests asking what was resolved versus what remains open."
---

# Analyze Issue Flow

Turn GitHub or GitLab Issue activity into a concise, evidence-backed progress report. Keep all access strictly read-only.

## 1. Fix scope

- Resolve the platform, instance hostname when self-managed, project namespace/name, requested time window, and reporting timezone.
- Support GitHub.com, GitLab.com, and self-managed GitLab instances.
- Default to the most recent 30 days when no window is given.
- State exact start and end dates.
- Analyze remote platform state only. Ignore local worktrees and local-only branches.

## 2. Establish access

Determine visibility before requesting authentication.

- For a public project, begin without authentication. Use public platform APIs and pages or public remote Git data.
- For a private project, request authorization only when no existing authenticated connector, platform CLI (`gh` or `glab`), signed-in browser session, or suitable read-only token can provide access.
- Treat `404`, `403`, sign-in redirects, and empty results as ambiguous until visibility and authentication are resolved.
- Never expose credentials in commands, logs, reports, or URLs.

Prefer sources in this order:

1. Applicable authenticated connector or platform API.
2. Existing authenticated `gh` or `glab` CLI.
3. Existing signed-in browser session.
4. Public platform pages or APIs for public projects.
5. Ask the user to connect or authenticate only when necessary.

## 3. Collect complete Issue data

Collect and paginate all Issues needed to construct both status populations:

- Every Issue that transitioned from open to closed inside the time window, including Issues created before the window.
- Every Issue that is open at the end of the time window, including Issues created before the window.
- Issue number, title, stable URL, author, created time, closed time, current state, and all labels.
- Closing actor or reason when available.
- Timeline/system events, linked branches, commits, pull/merge requests, cross-references, commit authors, and pull/merge request authors for closed Issues.

Do not count pull/merge requests as Issues on GitHub endpoints that return both. On GitLab, include Issue-type work items and exclude tasks, incidents, epics, and other work-item types unless the user asks to include them.

Use state-transition events when available. If the platform exposes only the current state and `closed_at`, treat a `closed_at` timestamp inside the period as the best available evidence of an open-to-closed transition and disclose the limitation. If an Issue was closed and then reopened before period end, include it in the closed population because the transition occurred and also in the open-at-end population; flag this overlap explicitly.

Report incomplete pagination, disabled Issue features, inaccessible timelines, missing transition history, or permission-limited fields. Never describe inaccessible data as empty.

## 4. Calculate the counts

Use these two primary populations consistently:

- **Open → Closed:** Issues with an open-to-closed transition inside the reporting period, regardless of creation date.
- **Still Open:** Issues whose state is open at the reporting period end, regardless of creation date.

Break each population into mutually exclusive creation-age buckets measured from the period-end timestamp:

- **近 1 周:** created 0–7 elapsed days before period end.
- **近 2 周:** created more than 7 and no more than 14 elapsed days before period end.
- **近 1 个月:** created more than 14 and no more than 30 elapsed days before period end.
- **1 个月前:** created more than 30 elapsed days before period end.

Use timestamp differences rather than calendar labels. State the bucket boundaries in the report. The four bucket counts must sum to the population total, except that an Issue may appear once in each population when it was closed and later reopened during the period.

For labels:

- Show label distribution separately for Open → Closed and Still Open.
- Count each Issue once under every label it carries within its population.
- State that label totals can exceed the Issue total.
- Group Issues without labels under “No label” or the natural equivalent in the user’s language.
- Preserve platform label names exactly.

Do not rank people or equate Issue count with performance. If author fields appear in details, treat them as attribution only.

## 5. Resolve closed-Issue delivery links

For every Issue in the Open → Closed population, inspect its timeline, system events, development links, referenced commits, and associated pull/merge requests. Classify the strongest available relationship:

1. **Direct link — high confidence**
   - A commit or pull/merge request uses a supported closing keyword with the Issue reference.
   - A system event explicitly says the commit or pull/merge request closed the Issue.
   - The platform exposes an explicit closing relationship.

2. **Explicit mention — medium confidence**
   - A commit or pull/merge request explicitly references the Issue but does not establish that it closed or fully resolved it.

3. **Inferred candidate — low confidence**
   - No explicit reference exists, but the timing and change content plausibly match.
   - Use only when a representative diff was inspected.
   - Describe it as a possible relationship, never as the closing commit.

4. **No delivery link found**
   - The Issue was manually closed, closed as duplicate/wontfix, resolved outside the repository, or lacks visible linkage.

When a pull/merge request closes the Issue, report both the pull/merge request and its merge commit when available. When several commits contribute, do not arbitrarily choose one.

For every reported commit or pull/merge request, show the platform-visible person name:

- For a commit, use the commit author name. If author and committer differ materially, show both with clear roles.
- For a pull/merge request, use the pull/merge request author. Do not substitute the merger or reviewer unless separately identified.
- When several linked delivery items have different people, map each person to the corresponding commit or pull/merge request.
- Write “Unknown” when the platform does not expose a name. Do not infer identity from an email address.

Also show the author of each Open → Closed Issue in the delivery table as “Issue 提交人.” Keep Issue authorship separate from delivery attribution. Put commits and pull/merge requests in separate columns, but combine their people in one “交付人” column. Deduplicate the same person; when the people differ, label their roles, such as “Name A（Commit）、Name B（PR）.”

## 6. Disclose omissions

Never silently skip a required action. If anything prescribed by this skill was not completed, add one concise sentence at the end of the report stating what was not completed, why, and how it may affect the conclusion. Do not create a separate omissions section or table.

Do not use brevity, corpus size, or inconvenience alone as a reason to omit required analysis. If the corpus is large, use pagination or batching. When partial completion is unavoidable, state the completed coverage numerically.

## 7. Produce the report

Read [report-schema.md](references/report-schema.md) and follow it exactly. Write in the user’s language unless requested otherwise. Keep the report concise.

Use stable Issue, commit, and pull/merge request links. Separate observed facts from inferred candidates. Do not invent missing authors, labels, closure reasons, commits, or delivery relationships.

## Quality check

- Exact project, platform, dates, timezone, and coverage are visible.
- Open → Closed and Still Open populations are both collected.
- Every page is covered or the gap is disclosed.
- Issue, age-bucket, label, and closure counts use the defined rules.
- Issues created before the window are not omitted from either population.
- The four creation-age buckets are mutually exclusive and sum to each population total.
- Reopened Issues that belong to both populations are explicitly identified.
- Issue-type filtering is correct for the platform.
- Label double-counting behavior is disclosed.
- Every closed Issue has a delivery-link classification.
- Every closed Issue with a direct, explicit, or inferred delivery relationship includes its Issue author as “Issue 提交人.”
- Commit and pull/merge request links use separate columns, while their people share one deduplicated “交付人” column.
- Every reported commit or pull/merge request includes its visible author name or “Unknown.”
- Direct, explicit, inferred, and absent links are not conflated.
- “No delivery link found” is counted in the summary but its Issues are not listed in the delivery table.
- Every unperformed required action is disclosed in one concise sentence with its reason and impact.
- No individual productivity ranking appears.
- No secrets or unnecessary personal data are reproduced.
- No external state is modified.
