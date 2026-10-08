---
name: why
description: "Investigate why a codebase, feature, design decision, threshold, workaround, or architectural choice exists by tracing evidence across the sources available to ChatGPT. Use for 'why does X work this way', 'why did we choose Y', design rationale, regressions, postmortems, historical context, and tradeoff questions."
---
# Why

Investigate why something exists or works the way it does.

The goal is to recover the evidence behind a decision, not invent a plausible explanation from the current code.

Use this skill for questions like:

* "Why was this designed this way?"
* "Why do we use X instead of Y?"
* "Why does this workaround exist?"
* "Why is this limit 500?"
* "What caused this regression?"
* "What led to this architecture?"
* "Was this added for a customer, incident, or technical constraint?"
* "What alternatives did we consider?"

Use `how` when the question is about what the system does or how it runs. Use `why` when the question is about intent, history, constraints, or tradeoffs.

## Evidence before explanation

Do not infer historical intent from the shape of the current code unless no better evidence exists.

Look for direct evidence first.

Useful sources include:

* Git history
* commits
* pull requests
* review comments
* GitHub issues
* Linear or another issue tracker
* design documents
* RFCs
* ADRs
* project notes
* team chat
* incident reports
* error tracking
* observability data
* product analytics
* code comments and tests when they record a constraint

Use whatever sources ChatGPT can access in the current conversation.

If the user names a repository, ticket, PR, document, incident, or other source that is accessible, inspect it before answering.

Do not ask the user to paste information that is already available through a connected source.

## Start with the target

Pin down what decision you are investigating.

The target may be:

* a function
* a class
* a configuration value
* a feature
* an API
* an architectural pattern
* a guard or workaround
* a database field
* a retry policy
* a timeout
* a threshold
* a deleted or legacy path
* a change in behavior

Find the concrete code or artifact first when one exists.

Record the important names that can lead you into the history:

* file paths
* symbols
* configuration keys
* commit hashes
* PR numbers
* issue IDs
* feature names
* error messages
* customer or project names already present in the source

These are search terms, not conclusions.

## Follow the evidence trail

Start with the source closest to the implementation.

For code, this usually means:

1. Find the relevant file and symbol.
2. Find commits that changed it.
3. Find the PRs connected to those commits.
4. Read the PR description and discussion.
5. Follow linked issues, tickets, documents, and incidents.
6. Search other connected sources using the concrete names you found.

A useful clue should lead to the next source.

For example:

```text
code
-> commit
-> PR
-> Linear ticket
-> design document
-> incident
```

Do not search every source using only the broad feature name when a commit, ticket ID, error string, or exact symbol gives you a better query.

## Search the sources that matter

Use available connected sources when they can contain part of the answer.

### Source control

Look for:

* commit messages
* PR descriptions
* review comments
* linked issues
* reverted changes
* earlier implementations
* tests added with the change
* comments that name a constraint

Source control is often the strongest evidence because it sits close to the change that shipped.

### Issue trackers

Look for:

* the original problem statement
* acceptance criteria
* customer requests
* scope changes
* parent initiatives
* bug reports
* linked incidents
* implementation discussion

Tickets often explain the product or business reason better than the code does.

### Long-form documents

Look for:

* RFCs
* ADRs
* design docs
* PRDs
* postmortems
* meeting notes
* architecture documents

These are especially useful for alternatives considered and rejected.

### Team chat

When available, look for:

* the feature name
* PR links
* ticket IDs
* error messages
* discussion near the date of the change
* incident channels
* conversations involving the authors or reviewers

Chat often contains decisions that never made it into the formal record.

### Error and observability data

Use these when the target looks like a response to runtime behavior.

Examples include:

* retries
* timeouts
* circuit breakers
* null guards
* rate limits
* memory limits
* backoff
* defensive checks
* feature flags

Look for errors, incidents, metric changes, or release correlations that line up with the code change.

### Product data

Use product analytics when a threshold, rollout, experiment, or user behavior may have shaped the decision.

Look for evidence such as:

* usage distributions
* experiment results
* feature adoption
* traffic levels
* data volumes
* rollout dates

Do not invent a data-driven rationale just because a number looks deliberate.

## Treat missing evidence as missing evidence

A search that finds nothing is useful.

Say which source you checked and that it did not contain evidence for the decision.

Do not turn an empty search into:

"therefore the decision was probably made informally."

That is still an inference.

The correct answer may be:

"We can see when this changed and what it does, but I could not find a recorded reason for choosing this design."

That is better than a convincing story with no source behind it.

## Separate fact from inference

Keep three levels clear.

### Direct evidence

The source explicitly states the reason.

Examples:

* a PR says the old implementation caused duplicate charges
* a ticket says a customer requires a 15 minute grace period
* a postmortem says retries caused duplicate writes

State these confidently and cite the source.

### Strong inference

Several pieces of evidence point to the same conclusion, but nobody states it directly.

Say:

* "This appears to have been..."
* "The evidence suggests..."
* "The most likely reason is..."

Then explain the evidence.

### Unknown

The record does not support an answer.

Say so.

Do not promote an inference to fact because it sounds sensible.

## Check chronology

Dates matter.

Build the smallest useful timeline when several sources are involved.

For example:

```text
12 May
production errors increase

14 May
ticket created

16 May
PR opened

18 May
fix merged

19 May
errors stop
```

Chronology can support a conclusion, but correlation alone does not prove intent.

A change merging after an incident does not automatically mean the incident caused it.

Look for the link in a PR, ticket, comment, or document.

## Look for alternatives

When the question asks why X instead of Y, find evidence that Y was actually considered.

Do not manufacture rejected alternatives from your own architecture knowledge.

Distinguish:

* an alternative the team explicitly considered
* an alternative that existed in an earlier implementation
* an alternative you think would have been possible

Only the first two are historical evidence.

You may discuss the third as your own analysis, but label it separately.

## Surface contradictions

History is messy.

A ticket may say one thing while the merged PR does another.

A design document may describe an approach that was abandoned during implementation.

A comment may claim a workaround is temporary even though it became permanent.

When sources disagree, show the disagreement.

Do not silently choose the cleaner story.

Prefer the source closest to the final decision when judging what actually shipped, but preserve earlier sources when they explain how the decision changed.

## Handle current code carefully

The current implementation can tell you:

* what exists now
* what behavior survived
* what assumptions are encoded
* what constraints tests enforce

It cannot reliably tell you why those choices were originally made.

Do not write:

"The code uses a queue because the team wanted loose coupling."

unless a source says that.

The safe version is:

"The current design uses a queue between X and Y. I found no source that records why that choice was made."

## For regressions and incidents

When investigating a regression, answer a slightly different question.

Find:

* the last known good behavior
* the change that altered it
* what that change was trying to achieve
* the failure it introduced
* when the failure became visible
* whether earlier fixes were attempted
* whether any fix was reverted
* what remains unresolved

Keep cause and motivation separate.

A PR may have had a valid goal and still introduced the regression.

## For thresholds and constants

When investigating a number such as a timeout, limit, grace period, or batch size, search for the number itself as well as the symbol that contains it.

Look in:

* git history
* PR discussion
* tickets
* documents
* incidents
* dashboards
* analytics

If you cannot find where the number came from, say that the value is unexplained.

Do not reverse-engineer a neat justification from the number.

## Answer structure

Lead with the best-supported answer.

For a small question, a few paragraphs may be enough.

For a larger investigation, use this shape when it helps.

### What we know

State the reason supported by direct evidence.

### Evidence

Walk through the important sources in chronological or causal order.

Do not dump every search result.

### What changed

Explain how the decision evolved when the record shows more than one design.

### Confidence

Say whether the conclusion is:

* directly documented
* strongly supported
* plausible but unproven
* unknown

Explain the gap when confidence is limited.

### Open questions

Include only unresolved questions that materially affect the conclusion.

## Citations

Cite the source behind claims about intent.

Prefer specific references such as:

* PR number
* issue or ticket ID
* commit
* document
* chat thread
* incident
* error-tracker issue

When ChatGPT can provide a native citation, use it.

A reader should be able to trace the important claims back to evidence.

## Writing

Apply the `unslop` skill to the final answer.

Use plain language.

Do not turn the investigation into detective-roleplay.

Do not pad weak evidence with confident prose.

Do not narrate every search you performed.

Give the user the reason, the evidence, the uncertainty, and any contradiction that matters.

Reply with the investigation itself, not a report about the workflow.
