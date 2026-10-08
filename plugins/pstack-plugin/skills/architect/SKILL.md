---
name: architect
description: "Design types, interfaces, module boundaries, data flow, and ownership before implementation. Use for 'architect this', 'design this', API or domain modeling, refactors, new subsystems, or non-trivial changes where choosing the wrong shape would make the implementation harder."
---

# Architect

Design the shape before writing the implementation.

Work out the types, ownership, interfaces, module boundaries, and data flow first. The design should make the implementation more obvious, not move complexity into vague abstractions.

Use this skill for:

* new subsystems
* non-trivial features
* API design
* domain modeling
* refactors that change ownership
* service boundaries
* persistence boundaries
* event-driven flows
* changes where several reasonable designs exist
* code that keeps fighting its current architecture

For a small mechanical change with an obvious shape, skip this skill.

## Understand the existing system first

Do not design around a codebase you have not understood.

Use the `how` skill on the parts the change touches.

Work out:

* what owns the current behavior
* where state lives
* what the runtime flow is
* which boundaries already exist
* what callers depend on
* which invariants the current code enforces

If the new design changes an existing boundary, ownership rule, or strange-looking constraint, use `why` before removing it.

The current design may be accidental. It may also encode a constraint that is invisible in the code.

Treat verified history as a design input.

For greenfield work, skip the existing-system investigation and start from the requirements.

## Start with usage

Design from the caller inward.

Write the important usage before defining the internals.

For example:

```text
session = parking.open_session(entry)

payment = session.pay(method)

decision = session.request_exit(exit_event)
```

The exact syntax does not matter yet.

The point is to see what the caller needs to know.

If normal usage requires the caller to understand several internal steps, internal state transitions, or storage details, the design is probably exposing too much.

Ask:

* What should the caller provide?
* What should the caller receive?
* What should stay hidden?
* Which invalid operations should be impossible or difficult to express?

Use the answers to shape the API.

## Model the domain

Name the real concepts in the problem.

Do not create types just because the existing code has classes with those names.

Look for:

* entities with identity
* values with rules
* state transitions
* commands
* events
* policies
* external systems
* ownership boundaries

Give each rule one clear owner.

If two modules both decide whether the same operation is valid, ownership is unclear.

Prefer types that prevent invalid states instead of objects full of optional fields plus comments explaining which combinations are legal.

Use the `principle-model-the-domain` and `principle-type-system-discipline` skills when they apply.

## Decide where the boundaries are

A useful module owns something.

It may own:

* a business rule
* a state transition
* persistence
* communication with an external system
* a protocol
* a set of invariants

A module that only forwards arguments to another module probably does not justify the extra layer.

Keep framework, transport, and persistence details at their boundaries when possible.

The domain should not need to know that a request arrived through HTTP or that an entity happens to be stored in SQLite unless those facts are part of the domain.

Use `principle-boundary-discipline` when deciding where parsing, validation, and external representations stop.

## Sketch the design

For a small change, sketch:

* the important types
* their fields
* function or method signatures
* ownership
* the main data flow

For a larger change, also sketch:

* module boundaries
* dependencies between modules
* persistence ownership
* external integrations
* events or messages
* failure paths

Use pseudocode or incomplete declarations.

Do not fill in implementation details yet.

A sketch should expose the decisions without burying them under working code.

## Design more than one shape when the decision matters

For a meaningful architectural choice, produce at least two structurally different designs before choosing one.

Changing a method name does not count as another design.

The alternatives should disagree about something real, such as:

* which component owns state
* synchronous calls versus events
* one service versus separate responsibilities
* where validation occurs
* whether a concept is stored or derived
* whether callers coordinate several operations or call one higher-level operation

Do not create alternatives just to reach a quota. Use this when there is a real design choice.

Apply `principle-exhaust-the-design-space`.

## Compare the designs

Judge each design by what the caller must understand and what the system can enforce.

Prefer the design that:

* gives each rule one owner
* hides implementation details
* keeps dependencies pointed toward the domain
* makes invalid states harder to represent
* keeps common operations short
* isolates external systems
* makes important behavior testable
* handles concurrency without casual shared mutation
* has fewer special cases

Do not choose the design with the most layers.

Do not choose the most abstract design.

A good abstraction removes knowledge from its callers.

If an abstraction adds concepts without hiding anything, remove it.

Apply `principle-subtract-before-you-add`.

## Check the design against real scenarios

Walk real cases through the proposed API.

Use the common path first.

Then test the cases that are likely to expose a bad shape.

Examples include:

* duplicate requests
* retries
* partial failure
* stale state
* concurrent operations
* missing data
* an operation arriving in the wrong order
* an external dependency being unavailable
* a new domain variant

Do not solve every hypothetical edge case.

Use cases that come from the requirements, current code, bugs, or realistic behavior of the system.

If an ordinary scenario needs a workaround, the design needs another pass.

## Check the dependency direction

For each module, ask what it knows about.

Domain code should usually know domain concepts.

Adapters may know the domain and an external system.

The domain should not depend on an adapter merely because the adapter currently provides the data.

Look for dependencies that force business logic to know about:

* HTTP
* database rows
* JSON payloads
* UI components
* vendor SDKs
* queue-specific message formats

Move those translations to the boundary when possible.

## Write the decision down

For the chosen design, show:

### Usage

How the main caller uses it.

### Types

The important domain types and states.

### Interfaces

The functions or methods that form the contract.

### Ownership

Which component owns each important rule or state transition.

### Module map

Where the pieces live and which direction dependencies point.

### Flow

What happens through the system for the main case.

### Alternatives

The meaningful designs considered and why they lost.

### Risks

The assumptions most likely to prove the design wrong.

Keep this proportional to the task. A three-function refactor does not need an architecture document.

## Separate design from implementation

If the user asked only for architecture, stop at the design.

If they also asked for implementation, treat the chosen sketch as the starting contract.

Do not silently change the architecture halfway through coding because a local implementation choice is easier.

When implementation needs something the sketch did not anticipate, treat that as evidence.

Ask what changed:

* Was a requirement missed?
* Was the domain model wrong?
* Is ownership in the wrong place?
* Is the implementation leaking a detail that should stay hidden?

Small corrections are normal.

Repeated corrections of the same kind are not.

## Know when to throw the design away

Do not keep patching a bad design because work has already gone into it.

Warning signs include:

* the same workaround appearing in several places
* unrelated edge cases all needing special branches
* types needing repeated casts or escape hatches
* optional fields that are actually required in certain hidden states
* callers needing to know internal sequencing rules
* several modules enforcing the same invariant
* locks appearing because ownership was never made clear
* repeated changes to the contract during implementation

One awkward case does not prove the architecture is wrong.

Look for a pattern.

If the pattern is real, go back to the requirements and the lessons from implementation. Redesign as if those facts had been known from the start.

Apply `principle-redesign-from-first-principles` and `principle-fix-root-causes`.

Do not preserve the old shape merely because it already exists.

## Evidence

When designing against an existing project, tie claims about the current system to source you inspected.

Do not claim a constraint exists because the code looks like it might.

Use `how` for current behavior.

Use `why` for historical intent.

Keep requirements, verified constraints, and your own design judgment distinct.

## Writing

Apply `unslop` to the answer.

Use concrete domain names.

Do not hide a weak design behind architecture vocabulary.

Show the caller's usage early. Then show the types and ownership that make that usage possible.

The reply should contain the design itself, not a description of the design process.
