# Issue flow report schema

Use the sections below in this exact order. Translate headings into the user’s language unless requested otherwise. Use “pull request” for GitHub and “merge request” for GitLab.

## 1. 周期摘要

State:

- Analysis project, exact dates, timezone, and data coverage.
- Number of Issues that changed from Open to Closed during the period.
- Number of Issues still Open at period end.
- Number of Issues present in both populations because they were closed and later reopened during the period.
- Closed-Issue delivery-link coverage: direct, explicit mention, inferred candidate, and no link found.

## 2. 创建时间分布

State that age is measured backward from the exact period-end timestamp. Use these mutually exclusive boundaries:

- 近 1 周: 0–7 elapsed days
- 近 2 周: over 7 through 14 elapsed days
- 近 1 个月: over 14 through 30 elapsed days
- 1 个月前: over 30 elapsed days

Show:

| 创建时间 | Open → Closed | 仍为 Open |

The four rows must sum to each population total.

## 3. Label 统计

Show:

| Label | Open → Closed | 仍为 Open |

Count a multi-label Issue under every label. Include “No label” when applicable and state that label totals can exceed total Issues.

## 4. Open → Closed Issue 与交付关联

List only Open → Closed Issues classified as Direct link, Explicit mention, or Inferred candidate. Do not list Issues classified as No delivery link found; report only their count in the period summary.

| Issue | Issue 提交人 | 关联等级 | Commit | Pull or Merge Request | 交付人 | 依据 |

Use only these relationship labels:

- Direct link
- Explicit mention
- Inferred candidate
- No delivery link found

Put commit links only in “Commit” and pull/merge request links only in “Pull or Merge Request.” Combine their platform-visible people in “交付人.” Deduplicate the same person when they are both the commit author and pull/merge request author. When people differ, label each role, such as “Name A（Commit）、Name B（PR）.” If commit author and committer materially differ, label both roles. Use “—” when no delivery person applies and “Unknown” when a delivery object exists but its person is unavailable.

“Issue 提交人” is the Issue author. Keep it distinct from the delivery person even when they are the same user.

For inferred candidates, include confidence and a concise caveat. Do not call a candidate the closing commit. If a pull/merge request provides the closure relationship, include its merge commit when available.

If any prescribed action was not completed, end the report with one concise sentence stating the missing check, its reason, and its effect on the conclusion. Do not add a separate “未执行项与缺失内容” section or table. State numerical coverage in that sentence when work was only partially completed.
