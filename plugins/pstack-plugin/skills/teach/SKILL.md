---
name: teach
description: "Explain a codebase, subsystem, feature, change, or technical idea so the user actually understands it. Use for 'teach me this', 'help me understand X', 'explain this change', 'walk me through this', or when the user wants more than a reference answer."
---
# Teach

Explain the thing so the user understands it well enough to work with it.

Do not produce a reference manual, dump implementation details, or list every symbol involved.

Teach what it is, how it works, and why it is built that way.

Use this skill for questions like:

- "Teach me how this works."
- "Help me understand this subsystem."
- "Explain this PR to me."
- "Walk me through this architecture."
- "I need to understand this before I change it."
- "Explain this like I'm new to the codebase."

## Start with what the user needs

Work out why they are asking.

They may be:

- about to change the code
- reviewing a PR
- debugging a problem
- onboarding to a project
- comparing designs
- trying to understand a technical concept

Use the conversation to judge what they already know.

Do not quiz them before explaining something you can explain directly.

Skip concepts they clearly understand. Spend time on the part their question is actually about.

## Get the facts first

If the explanation depends on a codebase, PR, issue, file, or other technical artifact, inspect the available source before teaching it.

Use the `how` skill to understand what the system does and how the parts fit together.

Use the `why` skill when the explanation depends on design history, intent, constraints, or tradeoffs.

Do not invent a simple story to make the explanation easier.

A clear explanation still has to be true.

## Give the smallest complete explanation first

Start with one or two paragraphs that answer:

- What is this?
- What job does it do?

That first explanation should be enough for the user to decide whether they need more detail.

Do not open with a table of contents, roadmap, or "here is what we are going to cover."

Start explaining.

## Build from concrete behavior

After the short definition, explain what actually happens.

For software, follow the path through the system.

For example:

```text
user action
-> request
-> validation
-> domain logic
-> database write
-> response

```

Explain what each step does and why it exists.

Do not replace an explanation with function names.

Bad:

```text
CreateOrder calls OrderService, then OrderRepository.

```

Better:

```text
The request handler turns the incoming JSON into an order command. The domain service checks whether the order is allowed, then the repository stores the accepted order.

```

Name the actual functions and files when they help the user find the code, but explain the mechanism first.

## Introduce concepts when they become necessary

Do not front-load ten definitions.

Introduce a concept when the explanation reaches the point where the user needs it.

If a queue matters only halfway through the flow, explain the queue halfway through the flow.

If a type exists only to prevent an invalid state, explain it when that invalid state becomes relevant.

This keeps the explanation attached to something concrete.

## Explain why the shape matters

When there is evidence for the design reason, connect the mechanism to that reason.

For example:

```text
The payment state lives on the session rather than the exit event because payment can happen before the camera sees the vehicle leave.

```

If the reason comes from historical evidence, use the `why` skill and preserve its confidence.

If you only know what the code does, do not turn that into a claim about why the team chose it.

Say:

```text
The code is structured this way. I could not verify whether that was the original reason for the design.

```

when that distinction matters.

## Use examples that match the real system

A good example should make the actual mechanism easier to see.

Prefer:

- a real request
- a real entity
- a real event
- a real state transition
- a small concrete input and output

Avoid generic examples when the source gives you a better one.

If the system manages parking sessions, explain it with a parking session.

If it processes fuel orders, explain it with a fuel order.

Do not switch domains just to create an analogy.

## Draw when the relationships are hard to hold in prose

Use a small text diagram when several parts interact.

Keep it simple.

Start with the main path:

```text
Browser -> API -> Service -> Database

```

Then add another part only if it matters:

```text
Browser -> API -> Service -> Database
                   |
                   v
                Event bus

```

Do not create one giant diagram containing every component in the system.

A diagram should reduce the amount the user has to remember, not create another thing they need explained.

## Teach flows in order

When the thing has a lifecycle, walk through it in the order it happens.

For example:

```text
1. Vehicle enters.
2. The camera emits an ANPR event.
3. Parking Edge creates a session.
4. The teller marks the session paid.
5. The vehicle reaches the exit.
6. Parking Edge checks the payment and grace period.
7. The gate may open.

```

Then explain the important decisions inside that flow.

Chronological explanations are usually easier to understand than explanations grouped by source file.

## Show boundaries

For architecture, explain who owns what.

The user should be able to answer questions like:

- Where does this behavior start?
- Which component owns the rule?
- Where is the state stored?
- Which component is allowed to change it?
- What crosses the network?
- What happens asynchronously?
- What can fail independently?

If they cannot answer those after the explanation, the architecture probably has not been explained yet.

## Call out the surprising part

Most systems have one or two things that a newcomer will assume incorrectly.

Name them.

Examples:

- the API does not actually perform the work synchronously
- the displayed value is calculated rather than stored
- an exit event does not close a session unless payment is valid
- two modules use different representations of the same entity
- a retry can cause the same message to arrive twice

These details are often more useful than another page of normal behavior.

Only include surprises supported by the source.

## Match the depth to the conversation

Do not give the full subsystem lecture when the user asks about one function.

Do not stop at a two-sentence summary when they asked for a deep walkthrough.

Start small. Go deeper as the question requires.

If the user asks a follow-up about one part, stay on that part instead of restarting the whole explanation.

## Do not hide complexity

Make the explanation easy to follow, but do not pretend the system is simpler than it is.

If two mechanisms interact, explain both.

If the evidence is incomplete, say so.

If the architecture has an awkward exception, include it when the exception changes the user's mental model.

Clarity means removing unnecessary difficulty, not removing facts.

## Writing

Apply the `unslop` skill to every response.

Use plain technical English.

Use one name for each concept and keep using it.

Prefer short paragraphs.

Mix sentence lengths naturally.

Avoid filler, motivational framing, and teaching theatre.

Do not say:

- "The key thing to remember is..."
- "Here's where it gets interesting..."
- "Let's break this down..."
- "Don't worry, this is simpler than it looks."
- "At its core..."

Just explain the thing.

Do not end with a generic summary that repeats what you already said.

Reply with the explanation itself.