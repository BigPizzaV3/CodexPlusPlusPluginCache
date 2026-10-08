---
name: recall
description: "Reconstruct recent working context from prior conversations, remembered context, and connected project sources, then give a concise current-state brief. Use for 'recall my work on X', 'catch me up', 'what have I been working on', 'where did I leave off', or before resuming earlier work."
---

# Recall

Reconstruct the user's working context before they resume something.

The goal is not a transcript summary. Work out what the user was trying to achieve, what changed, what is true now, what remains unresolved, and what they should do next.

Use this skill for questions like:

* "Recall my work on X."
* "Catch me up."
* "Where did I leave off?"
* "What have I been working on?"
* "What was the state of this project?"
* "What should I pick up next?"
* "We worked on this before. Where were we?"

Keep the answer focused on the requested work.

## Use the context ChatGPT actually has

Use the best available evidence.

This may include:

* the current conversation
* relevant prior conversation context available to ChatGPT
* remembered user context
* connected GitHub repositories
* issues and pull requests
* connected project trackers
* documents
* email or team communication when relevant and available
* other connected sources that contain the current state

Do not pretend you can access a conversation, repository, document, or service that is unavailable.

If the user already supplied a good state summary, use it instead of reconstructing the same information again.

Do not ask them to repeat details that are already available.

## Work out what kind of recall they want

There are two common cases.

### Project recall

The user names a project, feature, bug, ticket, repository, or other target.

Examples:

* "Catch me up on Parking Edge."
* "Where did we leave MFO-347?"
* "Recall the pricing work."
* "What happened with that authentication bug?"

For project recall, combine previous working context with the current project state.

### Activity recall

The user asks what they have been doing over a period.

Examples:

* "What did I work on this week?"
* "What have I been doing lately?"
* "Catch me up on yesterday."

For activity recall, focus on the user's work history during that period.

Do not drag unrelated project history into an activity recap.

## Set the scope

Respect the scope the user gives you.

That may include:

* a project
* a feature
* a ticket
* a repository
* a time period
* a particular problem

If they say "recent", use roughly the last seven days unless the conversation makes another range more sensible.

If they say "all", do not silently reduce it to recent activity.

If the topic is clear, proceed without asking for clarification.

If several unrelated projects share the same name or reference, clarify only when choosing the wrong one would materially change the answer.

## Reconstruct the working thread

Find the important pieces of the previous work.

For each relevant thread, recover:

* what the user wanted
* decisions that were made
* work that was completed
* work that was started but not finished
* problems encountered
* corrections to earlier assumptions
* rejected approaches
* PRs, tickets, branches, documents, or other artifacts
* the last meaningful state

Do not reproduce the conversation turn by turn.

Compress repeated discussion into the decision that survived.

If the user changed direction, use the later decision as the current one and mention the earlier approach only when it explains something important.

## Check the shared project record

When the user names a feature, bug, repository, issue, PR, or subsystem, previous conversation history is only part of the answer.

Check connected project sources when available.

Useful sources include:

* GitHub PRs
* GitHub issues
* commits
* Linear or another tracker
* design documents
* incident reports
* relevant team discussion
* CI or deployment state

Look for what happened after the previous conversation too.

A PR may have merged.

A ticket may have closed.

A fix may have been reverted.

A new bug may have appeared.

Someone else may have changed the same code.

Use the `why` skill when the shared record needs deeper historical investigation.

## Distinguish history from current state

Something being true in an old conversation does not make it true now.

Treat these as history:

* "PR is open."
* "Ticket is in progress."
* "Branch has not merged."
* "We still need to implement X."
* "This bug is unresolved."

When the answer matters and a connected source can verify the current state, check it.

Prefer current project state over remembered status.

For example:

```text
Previous state:
PR #42 was waiting for review.

Current state:
PR #42 has since merged.
```

Do not present stale history as current truth.

## Preserve decisions

A useful recall answer tells the user what was decided.

Examples:

```text
Use Ubuntu Server, not Desktop.
```

```text
Mender handles production OTA. Cloudsmith is optional for package distribution.
```

```text
The POS records cash or card but does not integrate with a payment terminal in the MVP.
```

Do not bury decisions inside a chronological retelling.

If a decision was tentative, say so.

If it was later reversed, give the current decision.

## Preserve corrections

Corrections matter because they stop the user from repeating dead ends.

Include them when relevant.

For example:

```text
Originally we planned to modify the existing sidebar. That was changed.
The ticket now requires a brand-new sidebar component with feature parity.
```

Or:

```text
The first fix was merged but did not solve the production issue, so a new ticket replaced it.
```

Do not include every disagreement. Keep corrections that affect the next piece of work.

## Find unresolved work

Separate finished work from open work.

Look for:

* unmerged PRs
* open tickets
* unanswered questions
* known bugs
* deferred decisions
* follow-up work
* dependencies
* tests or verification that still need to happen

Do not revive something merely because it appeared in an older conversation.

If later evidence shows it was completed, treat it as completed.

## Identify the next move

End with one concrete next action when there is a clear one.

Good:

```text
Next: start MFO-331. Its dependencies are merged and the ticket is ready.
```

Good:

```text
Next: upload the updated plugin bundle and verify that the six adapted skills pass scanning.
```

Weak:

```text
Next: continue development.
```

If several tasks can start independently and the user asked what is available, list those instead.

Do not manufacture a next step when the work is already finished.

## Handle incomplete memory

Sometimes the available context is not enough.

Say what you can establish and what you cannot.

For example:

```text
I can recover the design decision and the open PR, but I do not have access
to the conversation where the migration plan was finalized.
```

Then use available connected sources to fill the gap when possible.

Do not invent missing decisions because they fit the surrounding story.

## Resolve contradictions

Previous conversations and current project sources may disagree.

When they do, prefer current evidence for current state.

Preserve the contradiction if it explains how the project changed.

For example:

```text
We originally treated #21 as the next implementation ticket. That is stale.
It has since merged, and #24 is now the first unblocked ticket.
```

If two current sources disagree, show the disagreement rather than choosing one without evidence.

## Keep adjacent work out

A nearby ticket, feature, or project does not belong in the recall unless it:

* blocks the requested work
* changed the requested work
* explains a decision
* is the obvious next step

The user asked to recover a working context, not everything you know about them.

## Output

For a substantial project recall, use this shape when it helps.

### Capsule

At most five bullets.

Cover:

* what the work is
* the goal
* the important design decisions
* where it currently stands

### Threads

Give one compact line for each active or recently completed thread.

Use a status when you can establish one, such as:

```text
[merged #35]
[open PR #41]
[in progress]
[done]
[blocked]
[planned]
[reverted]
```

Do not invent PR numbers, branches, or statuses.

### Problems

Include only recurring or unresolved problems that matter to resuming the work.

Preserve failed fixes or reverted approaches when repeating them would waste time.

Keep this short.

### Next move

Give the single most useful next action.

For a simple recall question, do not force this structure. A few paragraphs may be enough.

## Activity recap

For questions like "what did I work on this week?", group related work rather than recounting every conversation.

Prefer:

```text
Parking Edge

You finished the paid-exit flow, worked through the POS and rate-card
tickets, then moved onto deployment and fleet management. The deployment
direction settled on Ubuntu Server with Mender.
```

over:

```text
Monday you asked X.
Then you asked Y.
Then on Tuesday you asked Z.
```

Mention dates only when they help establish sequence or scope.

## Evidence

Use concrete references when available.

Examples:

* PR number
* issue number
* Linear ticket
* commit
* document
* prior decision
* connected-source citation

Do not expose private internal context that the user did not ask for.

Do not claim a status is current unless you have current evidence or make clear that it comes from previous context.

## Writing

Apply `unslop` to the answer.

Keep the recap compact.

Use the project's real names and terminology.

Prefer decisions and current state over chronology.

Do not narrate how you searched for the context.

Do not repeat the user's entire history.

Give them enough context to continue working without reopening old conversations.

Reply with the brief itself.
