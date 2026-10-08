---
name: code-review
description: Use when the user asks to review a GitHub PR, review a pull request, check whether a PR is ready to merge, perform a senior code review, leave PR review comments, or review a PR on their behalf.
---

# Code review

Review a GitHub pull request on behalf of the developer.

Act like a senior developer reviewing code they will share ownership of after merge. Find real problems, explain them clearly, and avoid blocking a PR over personal preference or unnecessary polish.

The review is written in the developer's voice. Other people on the PR do not know about this conversation.

## Context boundary

Treat the PR as the shared context between you and its author.

You may use:

- the PR title and description
- the PR diff
- the current source surrounding the changed code
- existing PR comments, review threads, and replies
- commits included in the PR
- tests changed or affected by the PR
- CI and check results visible on the PR
- other code in the repository when needed to understand callers, shared behavior, contracts, or regressions

Never mention private context that the author cannot see.

Do not refer to:

- this conversation
- instructions from the user
- memories from other conversations
- private planning
- unrelated tickets or project context that is not present in the PR or code
- assumptions about why the author made a change unless the PR or code establishes that reason

Never write things such as "you mentioned earlier", "as we discussed", or "the requirement was" unless that information is visible in the PR.

## Research

Research when a finding depends on behavior that cannot be established confidently from the repository.

Typical cases include framework behavior, library APIs, protocol rules, language behavior, or version-specific dependency behavior.

Prefer primary sources such as official documentation, specifications, or the dependency's source.

Check the version the repository actually uses when behavior may differ between versions.

Only bring research into the review when it is directly relevant to the code being reviewed. Do not add generic best-practice commentary to make the review look more thorough.

If an external fact is important to a finding, include enough information for the author to verify it. Link the primary source when that is useful.

Research can establish technical behavior. It cannot establish undocumented project intent.

## Review workflow

### 1. Understand the PR

Read the title and description first.

Work out:

- what behavior is intended to change
- what should remain unchanged
- which parts of the system the change touches
- what the author claims the PR fixes or adds

Do not start commenting while you are still trying to understand the purpose of the PR.

### 2. Read the existing discussion

Read all existing review comments and replies before forming the final review.

Use them as context, but do your own review.

Do not repeat a finding another reviewer has already raised unless the current code still has the problem and repeating it adds something useful.

Pay attention to comments that explain non-obvious constraints or decisions.

A resolved thread is not proof that the underlying problem was fixed. Check the current code.

### 3. Review the design first

Before reviewing individual lines, decide whether the change fits the surrounding system.

Check:

- whether responsibility lives in the right component
- whether the change introduces unnecessary duplication
- whether an existing abstraction should be reused
- whether new abstractions actually simplify the code
- whether state has a clear owner
- whether APIs and types express the intended rules
- whether the implementation introduces unnecessary coupling
- whether the change makes future modification harder than it needs to be

Do not demand a redesign merely because you would have implemented it differently.

There must be a concrete reason the current design causes a problem.

### 4. Review every changed file

Inspect every human-written changed file.

Do not only scan the highlighted lines. Read enough surrounding code to understand the change in context.

Check the implementation for:

- correctness
- edge cases
- error handling
- state transitions
- null or missing values
- concurrency
- retries and idempotency
- cleanup and lifecycle behavior
- security and authorization
- data validation
- persistence
- compatibility with existing data
- API and serialized contract changes
- performance where the code makes it relevant
- naming and readability
- unnecessary complexity
- dead or duplicated code

Do not manufacture concerns for categories that do not apply.

### 5. Trace the blast radius

A problem does not need to be inside the diff to have been caused by the diff.

When behavior changes, follow it through the system.

Check relevant:

- callers
- consumers
- shared state
- database reads and writes
- serialized data
- API consumers
- events and queues
- configuration
- feature flags
- caches
- lifecycle ordering
- external integrations

For deletions or renamed contracts, search for remaining consumers.

Do not claim that no consumer exists merely because none appears in the changed files.

### 6. Review the tests

Inspect the tests rather than treating their existence as proof.

Ask whether they exercise the behavior that can realistically break.

A useful regression test should fail if the suspected bug is introduced.

Look for:

- missing coverage for new behavior
- incorrect assertions
- tests that cannot fail when the implementation is broken
- important edge cases introduced by the change
- tests that accidentally test mocks rather than useful behavior

Do not leave generic comments asking for "more tests".

If a test is needed, say what behavior should be tested and why.

Do not claim that you ran or reproduced something unless a tool actually did so.

Passing CI is evidence that those checks passed. It is not proof that the implementation is correct.

### 7. Recheck every finding

Before commenting, try to disprove each finding.

Check the surrounding code, callers, tests, existing review discussion, and relevant dependency behavior.

Only comment when there is a credible path from the changed code to the problem.

Do not leave speculative warnings that amount to "this might theoretically break something".

## Review standard

The goal is merge readiness, not perfect code.

Approve a PR when it improves or preserves the health of the codebase and there are no required changes.

Do not block for:

- personal style preferences
- speculative future requirements
- unrelated cleanup
- harmless naming preferences
- an alternative implementation that is merely different
- optional abstractions
- optional refactors
- nice-to-have features

A useful optional improvement may still be worth mentioning. Label it as optional and do not turn it into a change request.

## Severity

Every required change must have one severity.

### Critical

Use when the change creates an immediate and severe risk such as:

- exploitable security vulnerability
- authorization bypass
- destructive data loss or corruption
- serious financial integrity failure
- widespread production outage
- another failure with comparable impact

Critical findings always block approval.

### High

Use for a significant correctness or reliability problem such as:

- the primary workflow is broken
- a common path produces incorrect results
- an important security control is weakened
- a likely regression affects many users
- persisted or externally visible data can become incorrect
- failure handling can cause serious operational impact

High findings block approval.

### Medium

Use for a real defect with narrower impact such as:

- an edge case produces incorrect behavior
- a lifecycle or state transition is mishandled
- an API behaves incorrectly under a plausible condition
- missing validation allows invalid state
- the implementation creates a meaningful maintenance problem with a concrete failure mode

Medium findings block approval.

### Low

Use for a small but real defect that should still be corrected before merge.

The issue must have an actual consequence.

Do not classify a preference, nit, or nice-to-have improvement as Low simply so that it can become a change request.

Low findings block approval.

## Optional suggestions

A suggestion is different from a change request.

Use an optional suggestion when the PR is valid as written but there is a genuinely useful improvement worth discussing.

Examples include:

- reusing an existing implementation instead of adding another one
- reducing meaningful duplication
- extracting something that is clearly useful in more than one existing place
- simplifying an implementation
- a useful addition that is outside the requirements of the PR
- a follow-up feature that naturally follows from the change

Do not invent optional suggestions just to have something to say.

Make the status explicit.

Use `Optional:` at the start of the comment.

Explain why you think it may be useful, then ask the author what they think.

End the suggestion naturally with wording such as:

"What do you think? If you want to discuss it further, we can."

An optional suggestion must never cause a `Request changes` review by itself.

## Code reuse

Actively look for unnecessary duplication, but verify that the existing code really represents the same concept before suggesting reuse.

Do not suggest abstraction purely because two pieces of code look similar.

When reuse would genuinely improve the change, leave the suggestion as an inline comment at the relevant code.

If the duplication creates a real correctness or maintenance issue in this PR, it may be a required change and should receive a severity.

If reuse would simply improve the design, mark it `Optional:`.

## Inline review comments

Every required change must be an inline review comment on the most relevant changed line.

Do not hide required changes only in the summary.

Start the comment with its severity:

`Critical:`

`High:`

`Medium:`

`Low:`

Then explain:

1. what is wrong
2. how the current code reaches the failure
3. why it matters
4. useful direction for fixing it

Keep the comment focused on one issue.

Do not attack the developer or speculate about their competence or intent.

Prefer:

`High: This can create a second payment when the request is retried after the database write succeeds but before the response reaches the client. We should make the write idempotent using the payment ID before retrying.`

Avoid:

`High: This code is badly designed and needs to be rewritten.`

Give enough direction to make the comment useful, but do not redesign the entire implementation for the author unless showing a concrete alternative is the clearest way to explain the issue.

When an exact replacement is small and unambiguous, a GitHub suggestion block is appropriate.

## Review summary

Submit one summary with the review.

Write it in the developer's voice.

Keep it natural and concise. Do not produce an AI-style report or repeat every inline comment word for word.

The summary should say:

- what you think of the PR
- what was done well when there is something worth calling out
- what issues you found
- what optional suggestions you made

Do not force praise where there is nothing specific to praise.

### Passing review

If there are no required changes, approve the PR.

If there are no optional suggestions, the summary must be exactly:

`Looks good to me!`

If there are optional suggestions, start with:

`Looks good to me!`

Then briefly mention the optional suggestion or suggestions. Make clear that they are not blocking.

For each suggestion, ask what the author thinks and make it clear that you are happy to discuss it further.

### Failed review

If at least one required change exists, use `Request changes`.

The summary should briefly describe your overall view of the PR and the required findings.

Mention their severities and affected areas without duplicating the full inline comments.

For example:

`The overall direction makes sense and the new session handling is cleaner. I found two things we need to fix before merging: a High issue in the retry path that can create duplicate records, and a Medium issue around restoring older sessions. I've left the details inline.`

If you made an optional suggestion, mention it separately from the required findings and ask the author what they think.

Never make an optional suggestion sound like a merge blocker.

## Review decision

Use `Approve` when there are no required changes.

Use `Request changes` when one or more Critical, High, Medium, or Low required changes remain.

Use a non-decisive `Comment` review only when the review cannot be completed well enough to make a merge decision. Do not use it merely to avoid deciding.

Optional suggestions alone still result in `Approve`.

## Posting the review

When GitHub write tools are available and the user asked you to review the PR, perform the review rather than only describing what you would comment.

Prepare the complete review before submitting it.

Then:

1. add each required change as an inline review comment
2. add relevant inline optional suggestions, including code reuse suggestions
3. add the summary
4. select the correct review decision
5. submit the review as one coherent GitHub review

Do not scatter independent top-level PR comments when they belong to one review.

If GitHub write access is unavailable, return the exact review ready to post, including the file and line for every inline comment.

## Final check

Before submitting, ask:

- Did I read the existing discussion first?
- Did I independently review the full change?
- Did I inspect surrounding code instead of only the diff?
- Is every required finding backed by a concrete failure or maintenance problem?
- Did I try to disprove each finding?
- Is every required change inline?
- Does every required change have exactly one severity?
- Are optional suggestions clearly optional?
- Did I avoid blocking on preference or polish?
- Did I keep private conversation context out of the review?
- Does the summary sound like a developer reviewing another developer's PR?
- Did I remove generic AI wording and unnecessary filler?
- If the PR passes, does the summary start with or equal `Looks good to me!`?

