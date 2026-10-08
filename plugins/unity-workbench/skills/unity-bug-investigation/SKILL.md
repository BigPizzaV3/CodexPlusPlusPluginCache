---
name: unity-bug-investigation
description: Investigate, reproduce, isolate, explain, and validate bugs in an existing Unity project. Use when the user reports exceptions, incorrect behavior, regressions, visual glitches, multiplayer desync, input problems, scene or prefab issues, build failures, performance regressions, save corruption, intermittent failures, or other Unity defects. Gather evidence before editing, distinguish symptoms from causes, test hypotheses one at a time, apply the smallest justified fix, and validate the root cause.
---

# Unity Bug Investigation

Investigate Unity defects systematically and with evidence.

Do not begin by guessing a fix from the symptom alone. Establish the baseline,
reproduce the issue when possible, collect relevant evidence, formulate a small
set of hypotheses, test them one at a time, and only then implement the smallest
justified correction.

## Surface Limits

If the current surface is Chat mode without an attached workspace, repository files, logs, screenshots, or local filesystem access, do not claim that you investigated the project. Explain that Unity Essentials can help reason from evidence the user provides, but real bug investigation requires Codex with the Unity project folder open or enough logs/files pasted into chat.

If Codex has a workspace or local files available, collect project evidence before forming a root-cause claim.

## Primary outcome

Produce one of these outcomes:

1. A confirmed root cause and validated fix.
2. A narrowed cause with strong supporting evidence and a safe next experiment.
3. A documented blocker explaining why the issue could not be reproduced or
   verified.

Do not claim a root cause unless evidence supports it.

## Relationship with project onboarding

Look for current project context before investigating:

- `Docs/AI/UnityProjectContext.md`
- `Docs/UnityProjectContext.md`
- architecture documentation
- repository instructions
- recent change notes

If the project is unfamiliar and context is missing, use the
`unity-project-onboarding` workflow first, but keep the onboarding focused on
the systems relevant to the defect.

## Knowledge routing

The skill contains:

- `foundations/`: investigation principles used across bug types
- `specializations/`: defect-area guidance
- `frameworks/`: framework-specific debugging guidance
- `references/`: templates, evidence standards, validation, and safety

Read only the guidance that materially applies.

### Mandatory foundations

For every investigation, read:

- `foundations/evidence-first-debugging.md`
- `foundations/hypothesis-management.md`
- `foundations/reproduction-and-baselines.md`

Read `foundations/instrumentation.md` when adding logs, probes, captures, or
temporary diagnostics.

Read `foundations/change-safety.md` before modifying serialized assets,
project settings, packages, scenes, prefabs, or save formats.

### Specialization routing

| Defect area | File |
|---|---|
| Exceptions and crashes | `specializations/exceptions-and-crashes.md` |
| Gameplay and state bugs | `specializations/gameplay-and-state.md` |
| Input issues | `specializations/input.md` |
| UI and localization | `specializations/ui-and-localization.md` |
| Multiplayer and desync | `specializations/multiplayer.md` |
| Physics and movement | `specializations/physics-and-movement.md` |
| Rendering, shaders, and VFX | `specializations/rendering-and-vfx.md` |
| Performance regressions | `specializations/performance.md` |
| Save and persistence issues | `specializations/save-and-persistence.md` |
| Scenes, prefabs, and serialization | `specializations/scenes-prefabs-serialization.md` |
| Build and platform failures | `specializations/build-and-platform.md` |
| Editor tooling and imports | `specializations/editor-and-imports.md` |
| Intermittent or timing bugs | `specializations/intermittent-and-timing.md` |

A defect may require more than one specialization.

### Framework routing

Read framework guidance only when the project actively uses it.

| Framework | File |
|---|---|
| Photon Fusion | `frameworks/networking/fusion.md` |
| Netcode for GameObjects | `frameworks/networking/netcode-for-gameobjects.md` |
| Mirror | `frameworks/networking/mirror.md` |
| FishNet | `frameworks/networking/fishnet.md` |
| URP | `frameworks/rendering/urp.md` |
| HDRP | `frameworks/rendering/hdrp.md` |

### Resolution priority

When guidance conflicts:

1. Explicit user constraints
2. Repository instructions
3. Evidence and reproducibility
4. Data integrity and safety
5. Framework-specific guidance
6. Defect specialization
7. Generic investigation guidance

## Core principles

1. Reproduce before fixing when practical.
2. Distinguish symptoms from causes.
3. Prefer direct evidence over intuition.
4. Record the current baseline.
5. Change one meaningful variable at a time.
6. Keep temporary diagnostics narrow and removable.
7. Avoid speculative broad refactors.
8. Preserve user data and project assets.
9. Verify the fix against the original reproduction.
10. Check for regressions around the corrected behavior.
11. Do not hide uncertainty.
12. Do not claim success from compilation alone.

## Phase 1: Convert the report into a defect contract

Extract:

- observed behavior
- expected behavior
- affected user or system
- frequency
- first known occurrence
- environment
- platform
- scene or mode
- steps already attempted
- error messages
- stack traces
- recent related changes
- severity
- data-loss or crash risk

When the report is incomplete, infer only the smallest missing context.

Do not treat a vague report such as “movement is broken” as a complete
reproduction.

## Phase 2: Establish the baseline

Before editing:

- inspect current Console messages
- identify pre-existing failing tests
- inspect the relevant current code
- inspect recent changes when Git history is available
- record relevant project and package versions
- confirm the active scene, prefab, platform, and Editor instance
- preserve representative failing data or save files when relevant

Do not clear the Console before recording useful baseline evidence.

## Phase 3: Reproduce

Attempt the narrowest reliable reproduction.

Prefer:

1. Existing automated failing test
2. Minimal EditMode or PlayMode test
3. Existing reproduction scene
4. Existing gameplay scene with exact steps
5. Target platform or device reproduction
6. Controlled synthetic reproduction

Record:

- exact steps
- observed result
- frequency
- required timing
- required data
- platform differences
- Console output
- screenshots or captures when relevant

If reproduction fails, do not immediately modify code. Compare environment,
state, configuration, and version differences first.

## Phase 4: Classify the defect

Classify the issue by likely mechanism:

- deterministic logic error
- invalid state transition
- missing reference
- lifecycle or initialization order
- serialization mismatch
- asset configuration
- timing or race condition
- physics-step mismatch
- authority or replication error
- stale cache
- data migration
- rendering pipeline incompatibility
- platform-specific API
- package or version regression
- performance saturation
- user configuration
- external service failure

Classification guides evidence gathering. It does not confirm the cause.

## Phase 5: Build hypotheses

Use `references/hypothesis-log-template.md`.

Keep a small ranked set of plausible hypotheses.

Each hypothesis must include:

- claim
- supporting evidence
- contradicting evidence
- predicted observation
- cheapest discriminating test
- current status

Prefer tests that distinguish between multiple hypotheses.

Avoid collecting large amounts of data without a decision it can inform.

## Phase 6: Inspect the execution path

Trace the relevant flow:

- entry point
- initialization
- state owner
- dependencies
- input or event source
- transformations
- side effects
- presentation
- cleanup

Identify where expected and observed behavior diverge.

Use representative code and object inspection rather than reading the whole
project.

## Phase 7: Instrument narrowly

Add temporary instrumentation only when existing evidence is insufficient.

Good instrumentation:

- records state transitions
- identifies ownership
- timestamps key events
- records object identity
- records scene and lifecycle state
- captures authority and network tick
- captures input values
- captures serialized configuration
- records exact branch decisions

Avoid:

- logs every frame without filtering
- broad exception swallowing
- permanent debug flags scattered across production code
- instrumentation that changes timing significantly
- logging secrets or personal data

Mark temporary diagnostics clearly and remove them before completion unless the
project benefits from retaining them.

## Phase 8: Test hypotheses one at a time

For each hypothesis:

1. Predict the result.
2. Run the smallest discriminating experiment.
3. Record the actual result.
4. Update the hypothesis status.
5. Do not change unrelated variables.
6. Stop pursuing contradicted hypotheses.
7. Add a new hypothesis only when evidence warrants it.

A successful workaround does not automatically prove the root cause.

## Phase 9: Confirm the root cause

A root cause is confirmed when:

- evidence explains the original symptom
- the mechanism is understood
- a targeted change removes the reproduction
- reversing or isolating the change restores the failure when practical
- nearby scenarios remain valid
- competing plausible hypotheses are sufficiently ruled out

When full confirmation is impossible, report the strongest supported cause as
likely, not confirmed.

## Phase 10: Implement the smallest justified fix

The fix should:

- address the cause, not only mask the symptom
- follow project architecture
- preserve serialized data
- avoid unrelated refactoring
- include guards only at meaningful boundaries
- include migration when data formats changed
- maintain multiplayer authority
- preserve existing public behavior unless the bug itself is that behavior

Do not add broad null checks merely to suppress an invalid state.

Do not catch and ignore exceptions to make the Console quiet.

## Phase 11: Add regression coverage

Prefer a regression test that fails before the fix and passes after it.

Choose:

- EditMode for deterministic logic
- PlayMode for lifecycle, scene, physics, and engine behavior
- multi-peer or framework tests for multiplayer
- representative old data for save migration
- platform build or device tests for environment-specific failures

If automated regression coverage is impractical, create an exact manual
verification procedure.

## Phase 12: Validate the fix

Validate:

1. Original reproduction no longer fails.
2. Relevant tests pass.
3. Unity compiles without new errors.
4. Console has no new related warnings.
5. Nearby behavior still works.
6. Repeated execution remains stable.
7. Scene reload, disable, destruction, or despawn works when relevant.
8. Target platform behavior is checked when required.

Use `references/validation-strategy.md`.

## Phase 13: Review diagnostics and diff

Before completion:

- remove temporary logging
- remove experimental branches
- remove test assets not intended for commit
- inspect all changed files
- confirm no unrelated serialization changes
- confirm no tests were disabled
- confirm no warnings were hidden
- preserve useful permanent assertions or diagnostics only when justified

## Prohibited behavior

Do not:

- guess a root cause from one symptom
- make broad refactors before reproduction
- clear evidence before recording it
- disable failing tests
- swallow exceptions
- add retries without understanding failure
- add delays to hide timing problems without evidence
- reset user data as the default fix
- regenerate scenes or prefabs wholesale
- change package versions casually
- blame Unity, a package, or a platform without evidence
- claim a multiplayer fix from one local instance
- claim a performance fix without measurement
- leave excessive logs in hot paths
- expose secrets in bug reports

## Definition of done

The investigation is complete when:

- observed and expected behavior are documented
- reproduction status is known
- baseline evidence is recorded
- relevant hypotheses were tested
- root cause is confirmed or uncertainty is explicit
- the smallest justified fix is applied when possible
- regression coverage exists or manual verification is precise
- original reproduction is retested
- nearby behavior is checked
- temporary diagnostics are removed
- changed files are reviewed
- remaining risk is documented

## Final response

Return:

### Symptom

State the observed and expected behavior.

### Root cause

State confirmed, likely, or unresolved cause with evidence.

### Fix

Summarize the smallest applied correction.

### Changed files

List important changed files and purpose.

### Validation

State exact reproduction, tests, compilation, runtime, and platform checks.

### Remaining risks

List unresolved uncertainty or follow-up checks.
