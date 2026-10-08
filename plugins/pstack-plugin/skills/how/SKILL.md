---
name: how
description: "Explain how a codebase, subsystem, feature, API, or technical artifact works by inspecting the available source. Use for 'how does X work', code walkthroughs, runtime flows, architecture questions, ownership questions, and 'where should this live'."
---

# How

Explain how the target actually works.

Build a useful mental model from the source. Do not produce an annotated file listing, guess from filenames, or describe how this kind of system usually works.

Use this skill for questions like:

- "How does this work?"
- "Walk me through this feature."
- "What happens when this request comes in?"
- "How is this subsystem structured?"
- "Where does this logic belong?"
- "Which component owns this?"
- "Is this the right layer?"
- "What is wrong with this architecture?"

## Get the source first

Use the best source available in the conversation.

Prefer:

1. Connected GitHub repositories, PRs, issues, diffs, and files.
2. Files the user attached.
3. Other connected sources with relevant implementation or technical documentation.
4. Public source when the target is public.

If the user names a repository, PR, issue, file, class, function, or subsystem that you can access, inspect it before answering.

If the conversation already contains enough source, use it.

Do not ask the user to paste information you can already access.

If you cannot access the source needed to answer, say what is missing. Do not fill gaps with guesses.

## Decide what you are explaining

Pin down the target before exploring.

It may be:

- one function or class
- a request path
- a UI flow
- an event flow
- a service
- a feature spread across several modules
- a persistence model
- an integration
- a package or module boundary
- ownership of a domain concept

If the question is slightly ambiguous, use the most likely interpretation from the conversation and proceed. State the interpretation only when it matters.

## Start where the behavior starts

Find the real entry point.

Common entry points include:

- an HTTP route
- a controller
- a UI event handler
- a command
- a message consumer
- a scheduled job
- a public service method
- application startup
- an external callback

Do not start by collecting every file that mentions the same word.

Find what triggers the behavior, then follow it.

## Trace the flow

Follow the implementation from trigger to result.

Work out:

1. What starts the flow?
2. What data enters?
3. Where is it parsed or validated?
4. Which business rules run?
5. What state is read?
6. What state changes?
7. Which external systems are called?
8. What response, event, write, or other side effect comes out?

Follow real callers and callees when the source lets you.

For asynchronous systems, include queues, events, callbacks, retries, and later consumers when they affect the result.

For UI code, follow the path from the user action through state changes to the rendered result.

For data-heavy flows, show where the representation changes. For example:

```text
raw request
-> transport type
-> domain type
-> persistence model
-> response

```

Stop exploring when you can explain the relevant path without skipping a material step.

## Find the concepts that matter

Pull out only the concepts needed to understand the flow.

These may include:

- domain entities
- state owners
- services
- repositories
- adapters
- coordinators
- protocols
- queues
- tables
- configuration
- important invariants

Explain what each one owns.

Do not turn the answer into a catalogue of classes and files.

## Explain ownership

When the question is about placement or architecture, work out:

- who owns the behavior
- which layer implements it
- what depends on that layer
- what that layer depends on
- where data crosses system boundaries
- whether framework, transport, persistence, and domain concerns are mixed
- what callers need to know about the implementation

Keep current state and recommendations separate.

Say:

```text
Today this lives in X.

```

before:

```text
I would move it to Y because...

```

Do not describe your preferred design as though it already exists.

## Call out the parts people get wrong

Include non-obvious behavior that would matter to someone changing the code.

Examples:

- state is owned somewhere unexpected
- a call that looks synchronous continues through an event
- a value is calculated rather than stored
- retries can execute the same operation more than once
- configuration changes the path
- the same concept has two representations
- ordering matters
- a write happens indirectly
- a path that looks unused is reached dynamically
- an abstraction requires callers to know its internal rules

Only include these when the source supports them.

## Explain mode

Use this by default.

Start with a short explanation of what the target is and what job it performs.

Then explain the actual flow in order.

Include the important concepts as they become relevant rather than dumping definitions up front.

Reference concrete files, functions, types, PRs, or other source locations when useful.

For a larger subsystem, a compact file map can help:

```text
api/
  request entry point

domain/
  business rules

storage/
  persistence

events/
  asynchronous follow-up

```

Do not list every related file.

Finish with the few gotchas that matter.

The structure should fit the question. A small function does not need five sections.

## Critique mode

Use this when the user asks what is wrong, what should change, or where something should live.

Understand the current system first. Then critique it.

Look for concrete problems such as:

- unclear ownership
- dependencies pointing the wrong way
- the same business rule implemented in several places
- framework code mixed with business logic
- database or transport types leaking through domain APIs
- shared mutable state
- unnecessary coupling
- abstractions that expose their internal rules
- layers that only pass calls through
- one concept split across unrelated lifecycle modules
- validation repeated deep inside trusted code
- data structures that allow impossible states

Do not manufacture problems because the user asked for a critique.

Group findings only when useful:

- Act on: worth changing.
- Consider: a real tradeoff, but not an obvious change.
- Noted: useful context, no change needed.
- Dismissed: looked suspicious but the source shows it is fine.

For anything worth changing, say what is wrong, where it happens, why it matters, and the smallest useful correction.

## Evidence

Tie factual claims to source you inspected.

Cite files, symbols, PRs, issues, or connected-source results when citations are available.

If something is an inference, say so.

Never claim you read, searched, ran, or verified something you could not access.

Code is good evidence for what the system does. It is weak evidence for why somebody originally designed it that way.

Use the `why` skill for historical rationale when it is available.

## Writing

Apply the `unslop` skill to the answer.

Use the same name for the same concept throughout the explanation.

Prefer concrete mechanisms over architecture jargon.

Explain the path a value, request, event, or state change takes.

Do not narrate the investigation unless the user asks.

Do not paste large blocks of source when naming the relevant symbol is enough.

Reply with the explanation, not a report about how you produced it.