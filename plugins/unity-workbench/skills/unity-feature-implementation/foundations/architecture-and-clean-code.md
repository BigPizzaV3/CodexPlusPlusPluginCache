# Unity Architecture and Clean Code

Use these principles to produce maintainable Unity features without imposing
unnecessary abstractions or replacing the project's established architecture.

## Priority

1. Respect the existing project architecture.
2. Make the smallest coherent change.
3. Preserve clear responsibilities.
4. Minimize coupling.
5. Keep dependencies explicit.
6. Make important behavior testable.
7. Introduce abstractions only when they solve a real problem.

Architecture should reduce complexity, not merely redistribute it across more
files.

## Responsibility and cohesion

Each class or component should have one clear reason to change.

A responsibility is a cohesive area of behavior, not a single method.

Before extending a class, ask:

- Is the new behavior part of its current responsibility?
- Does this add an independent reason to change?
- Are its dependencies becoming unrelated?
- Would a collaborator improve understanding and testing?
- Would extraction add useful structure or only indirection?

Avoid both extremes:

- one MonoBehaviour controlling an entire feature
- one class per tiny operation

## Low coupling

Prefer systems that know only what they need.

Avoid:

- distant global singletons
- repeated hierarchy traversal
- static mutable state
- broad manager classes
- object names, scene names, or tags used as hidden APIs
- circular assembly dependencies
- public mutable fields used as informal integration points

Prefer:

- constructor injection for plain C# objects
- explicit serialized references
- established project DI
- narrow APIs
- local direct references when ownership is clear
- events only when one-to-many notification is required
- interfaces at meaningful boundaries

Direct references are acceptable when ownership, lifetime, and dependency
direction are clear.

## SOLID without overengineering

### Single Responsibility

Separate independent reasons for change.

Do not split code merely to satisfy file-size or method-count rules.

### Open/Closed

Create extension points when variation exists or is clearly required.

Do not introduce a strategy interface for one fixed implementation with no
credible variation.

### Liskov Substitution

Derived types must preserve the contract of their base type.

Be cautious with deep MonoBehaviour inheritance. Prefer composition when
subclasses mainly disable or replace inherited behavior.

### Interface Segregation

Keep interfaces focused around consumer needs.

Do not create interfaces for every class.

### Dependency Inversion

High-level gameplay rules should avoid depending directly on unstable
infrastructure when a meaningful boundary already exists or clearly helps.

Do not impose enterprise layering on a small project.

## Composition over inheritance

Prefer composition for abilities, movement modifiers, visual feedback, status
effects, interaction behavior, input adapters, and networking adapters.

Use inheritance when the subtype is genuinely substitutable and the hierarchy
is stable.

## Separate domain logic from Unity integration

When practical, keep deterministic rules in plain C#:

- cooldowns
- state transitions
- scoring
- damage formulas
- inventory rules
- progression
- validation
- data transformations

Use MonoBehaviours for lifecycle, transforms, physics, serialized references,
scene objects, animation, audio, VFX, input, and networking bridges.

Do not extract logic when doing so adds indirection without improving clarity or
testability.

## State ownership

Every mutable value should have a clear owner.

Determine:

- who creates it
- who mutates it
- who observes it
- how long it lives
- whether it is serialized
- whether it is replicated
- how it resets
- how it is disposed

Avoid multiple authoritative copies of the same state.

## Explicit dependencies

Dependencies should be visible through constructors, serialized references,
initialization methods, or established DI.

Avoid hidden dependencies through runtime searches, tags, names, static
accessors, or unrelated systems.

## Encapsulation

Keep mutable state private.

Expose intent-revealing methods and read-only properties.

Do not make fields public only for Inspector serialization. Prefer
`[SerializeField] private` when consistent with the project.

## Avoid premature abstraction

Do not introduce:

- custom DI containers
- generic service frameworks
- global messaging systems
- reflection registries
- broad plugin architectures
- complex factories
- configurable pipelines with one step

Prefer a concrete implementation with clear ownership.

## Avoid boolean overload

When many booleans form invalid combinations, consider an enum, explicit state,
state machine, or composed statuses.

Do not create a state machine for two simple conditions.

## Naming

Prefer domain names:

- `DashCooldown`
- `DamageReceiver`
- `RespawnCoordinator`
- `InventoryCapacity`

Avoid vague names such as `Helper`, `Utils`, `Common`, `Thing`, or generic
`Manager` without a clear domain.

## Duplication

Do not remove every repeated line immediately.

Extract only when meaning, ownership, and expected change are genuinely shared.

## Error handling

Validate at meaningful boundaries:

- public APIs
- external services
- network messages
- deserialized data
- required references
- authoring configuration

Do not hide invalid configuration behind scattered null checks.

## Comments

Comment intent, constraints, tradeoffs, and non-obvious Unity lifecycle behavior.

Do not narrate obvious code.

## Focused refactoring

Feature work may include a focused refactor when needed for safe implementation.

It must:

- have a clear reason
- affect the relevant system
- preserve behavior
- remain manageable
- be validated
- avoid unrelated cleanup

## Review checklist

- Does each changed class have a clear responsibility?
- Are dependencies explicit?
- Is state ownership clear?
- Did the change create a parallel system?
- Is each new abstraction justified?
- Are interfaces focused?
- Is inheritance genuinely substitutable?
- Can important rules be tested?
- Are public APIs minimal?
- Is the solution proportional to the request?
