---
name: unity-feature-implementation
description: Implement, extend, or integrate a feature in an existing Unity project while respecting its architecture, coding conventions, scene structure, packages, networking model, and validation workflow. Use when the user asks to add gameplay mechanics, UI behavior, systems, editor tools, integrations, ScriptableObjects, shaders, VFX, networking functionality, save systems, input behavior, XR interactions, audio, animation, AI, or other concrete Unity features.
---

# Unity Feature Implementation

Implement Unity features as coherent additions to the existing project.

Do not treat a feature request as an isolated code-generation task. Understand
how the project currently solves related problems, identify the correct
extension points, implement the smallest complete solution, and validate it
using the strongest available evidence.

## Surface Limits

If the current surface is Chat mode without an attached workspace, repository files, or local filesystem access, do not claim that you can implement or validate changes in the user's Unity project. Explain that Unity Essentials can help reason from pasted code or screenshots, but real implementation requires Codex with the Unity project folder open.

If Codex has a workspace or local files available, inspect the project before editing and report validation honestly.

## Primary outcome

Deliver a working implementation that:

- follows the project's existing architecture
- respects current coding conventions
- integrates with existing systems
- avoids unnecessary dependencies
- minimizes scene and prefab changes
- compiles without new errors
- includes appropriate tests or validation
- documents assumptions and remaining setup

## Relationship with project onboarding

Before implementing a substantial feature, look for an existing project context
document such as:

- `Docs/AI/UnityProjectContext.md`
- `Docs/UnityProjectContext.md`
- project-specific AI or architecture documentation

If no reliable context exists and the project is unfamiliar, use the
`unity-project-onboarding` workflow first.

Do not repeat a complete onboarding when the necessary project context is
already current and supported by repository evidence.

## Knowledge routing

Before planning or editing, determine which internal guidance applies.

The skill contains three categories:

- `foundations/`: cross-cutting engineering rules
- `specializations/`: rules for a particular feature area
- `frameworks/`: rules for a concrete Unity package or technology

Read only the files that materially apply.

### Mandatory foundations

For every non-trivial runtime feature, read:

- `foundations/architecture-and-clean-code.md`
- `foundations/unity-lifecycle.md`
- `foundations/testing.md`

Read `foundations/serialization-safety.md` when the change affects:

- serialized fields
- scenes
- prefabs
- ScriptableObjects
- materials
- animation controllers
- project settings
- input action assets

Read `foundations/performance-basics.md` when the feature affects:

- frequently executed runtime code
- Update, FixedUpdate, or LateUpdate
- spawning
- collections
- networking
- rendering
- UI refreshes
- asset loading

### Specialization routing

A task may use more than one specialization.

| Area | File |
|---|---|
| Gameplay mechanics | `specializations/gameplay.md` |
| Player input | `specializations/input.md` |
| UI and HUD | `specializations/ui.md` |
| Multiplayer | `specializations/multiplayer.md` |
| Save data | `specializations/save-systems.md` |
| Shaders and rendering behavior | `specializations/shaders.md` |
| Particle System and VFX Graph | `specializations/vfx.md` |
| Editor extensions | `specializations/editor-tools.md` |
| XR and VR | `specializations/xr.md` |
| Audio | `specializations/audio.md` |
| Animation systems | `specializations/animation.md` |
| Navigation and gameplay AI | `specializations/ai-navigation.md` |
| Explicit optimization work | `specializations/performance.md` |

### Framework routing

Read a framework guide only when the project actively uses that framework.

Do not select a framework merely because its package is installed.

Confirm usage through:

- project context
- package configuration
- assembly references
- first-party code
- scenes or prefabs
- project documentation

### Resolution priority

When guidance conflicts, use this priority:

1. Explicit user requirements
2. Repository instructions and project architecture
3. Data integrity and safety requirements
4. Framework-specific guidance
5. Feature specialization guidance
6. Foundation guidance
7. Generic Unity conventions

Existing project architecture should normally be extended rather than replaced.

## Proportional architecture

The architectural complexity of the solution must be proportional to:

- feature complexity
- number of consumers
- expected variation
- lifetime of the system
- project size
- testing requirements
- networking or persistence requirements

Do not introduce an abstraction solely because a design principle can be
applied.

Prefer the simplest design that preserves clear ownership, cohesion,
testability, and safe future change.

## Feature workflow

1. Interpret the request as a concrete feature contract.
2. Read project context and relevant repository instructions.
3. Route to the required foundations, specializations, and frameworks.
4. Locate the correct integration points.
5. Assess risk.
6. Create a focused implementation plan.
7. Implement incrementally.
8. Compile and inspect Console output.
9. Run relevant tests.
10. Validate runtime behavior where possible.
11. Review the final diff.
12. Report completed work, validation, setup, and limitations.

## Feature contract

Identify:

- desired player or developer behavior
- feature entry point
- expected output or effect
- affected systems
- supported platforms
- multiplayer implications
- persistence implications
- UI implications
- performance expectations
- failure and edge cases
- explicit constraints
- acceptance criteria

Do not silently broaden the scope.

When requirements are incomplete, infer the smallest conventional behavior that
fits the existing project.

Ask a question only when an unresolved choice would substantially change the
public API, architecture, data format, network behavior, or visible result.
Otherwise, make a conservative decision and document it.

## Integration analysis

Before editing, answer:

1. Which existing component owns this responsibility?
2. Which assembly should contain the new code?
3. Is there already an extension point?
4. Does the project favor composition, inheritance, events, or services here?
5. Is configuration stored in prefabs, ScriptableObjects, settings, or code?
6. Does this behavior require scene or prefab wiring?
7. Who owns state authority in multiplayer?
8. What behavior must remain unchanged?
9. What is the smallest coherent file set?
10. How will the feature be verified?

Do not create a new manager, singleton, service locator, event bus, or framework
when an existing system already covers the responsibility.

## Risk classification

### Low risk

- isolated plain C# logic
- utility methods
- non-breaking configuration additions
- EditMode tests
- localized editor-only tooling

### Medium risk

- modifying runtime MonoBehaviours
- adding input handling
- changing ScriptableObject schemas
- adding runtime UI
- extending state machines
- modifying a prefab with limited usage

### High risk

- editing shared scenes or base prefabs
- changing public APIs used across assemblies
- modifying network authority
- changing serialization layouts
- changing addressable keys
- altering render-pipeline settings
- changing initialization order
- modifying Build Settings
- changing persistent save formats

For medium- and high-risk changes, identify affected assets, rollback strategy,
compatibility concerns, and required validation.

## Implementation rules

- Extend existing systems before creating parallel systems.
- Prefer the smallest coherent implementation.
- Avoid unrelated refactors.
- Preserve public APIs unless change is necessary.
- Search all usages before changing public members.
- Preserve serialized field names where possible.
- Use `FormerlySerializedAs` when renaming serialized fields.
- Follow existing async, DI, event, and state-management patterns.
- Keep Unity lifecycle methods understandable.
- Keep mutable state ownership clear.
- Avoid hidden dependencies.
- Do not add packages without explicit need and authorization.
- Do not edit generated directories or IDE artifacts.
- Do not claim validation that did not occur.

## Unity tooling

Use conceptual capabilities rather than hardcoded MCP tool names.

Read capabilities may include:

- `unity.connection.status`
- `unity.console.read`
- `unity.scene.inspect`
- `unity.buildsettings.read`
- `unity.gameobject.inspect`
- `unity.asset.search`
- `unity.tests.list`
- `unity.playmode.read`

Mutation capabilities may include:

- `unity.script.create`
- `unity.script.modify`
- `unity.asset.modify`
- `unity.gameobject.modify`
- `unity.scene.modify`
- `unity.playmode.set`
- `unity.tests.run`

Before invoking a mutating tool:

1. Confirm it targets the active Unity project.
2. Understand its side effects.
3. Prefer the most narrowly scoped operation.
4. Preserve existing serialized data.
5. Re-read affected state after mutation.
6. Check Console output after imports or recompilation.

## Definition of done

A feature is complete when:

- requested behavior is clearly understood
- correct integration points were identified
- implementation follows project architecture and conventions
- necessary code and safe asset changes are complete
- Unity or the strongest available fallback compiles
- no new unresolved errors were introduced
- relevant tests pass or limitations are reported
- runtime behavior was validated at an appropriate level
- serialized references and setup requirements are accounted for
- final diff contains no unrelated changes
- assumptions and risks are documented
- remaining manual steps are explicit
- documentation is updated when necessary

## Final response

Return:

### Implemented

Summarize completed behavior.

### Changed files

List important created and modified files with purpose.

### Validation

State exactly what was validated.

### Setup

List required Inspector, scene, prefab, input, package, or build setup.

### Assumptions and limitations

Record important assumptions and remaining risks.
