---
name: unity-build-validation
description: Validate that a Unity project or completed change is ready to compile, test, build, and hand off. Use when the user asks to verify a feature, confirm build readiness, check compilation, run tests, validate scenes and prefabs, inspect Console output, confirm target-platform compatibility, prepare a release candidate, or determine whether Unity work is truly complete. Establish a baseline, run the strongest available validation, distinguish pre-existing failures from introduced regressions, and report exact evidence without overstating confidence.
---

# Unity Build Validation

Validate Unity work using progressively stronger evidence.

This skill is the final verification layer for feature implementation, bug
fixes, health-check remediation, milestones, and release preparation.

Compilation is necessary but not sufficient.

A change is not fully validated merely because C# compiles.

## Surface Limits

If the current surface is Chat mode without an attached workspace, repository files, build logs, or local filesystem access, do not claim build readiness or validation. Explain that Unity Essentials can help interpret pasted build output, but real build validation requires Codex with the Unity project folder open, a connected Unity Editor, CI output, or supplied build logs.

If Codex has a workspace or local files available, validate with the strongest available evidence and clearly state any missing Unity Editor, test, platform, or device coverage.

## Primary outcome

Produce an exact validation result that answers:

- Did Unity compile?
- Were new Console errors introduced?
- Which tests ran and what passed?
- Are required scenes configured?
- Are prefabs and serialized references valid?
- Does the target build succeed?
- Was runtime behavior exercised?
- Were platform-specific checks completed?
- What remains unverified?
- Is the result ready, conditionally ready, blocked, or not validated?

## Relationship with other skills

This skill may be used after:

- `unity-feature-implementation`
- `unity-bug-investigation`
- `unity-project-health-check`
- manual project changes
- package changes
- scene or prefab changes
- release preparation

Use project context from:

- `unity-project-onboarding`
- `Docs/AI/UnityProjectContext.md`
- repository instructions
- build documentation
- CI workflows

Do not repeat broad architecture analysis unless it is required to understand a
validation failure.

## Default behavior

Validation may execute tests, enter Play Mode, or trigger builds when those
operations are appropriate and available.

Do not modify production code or project assets merely to make validation pass.

Do not:

- disable failing tests
- clear the Console before recording the baseline
- suppress warnings without understanding them
- change build settings casually
- update packages
- delete user data
- rewrite scenes or prefabs
- mark a build ready based only on static inspection

## Knowledge routing

The skill contains:

- `foundations/`: validation principles
- `checklists/`: validation domains
- `frameworks/`: framework and platform-specific rules
- `references/`: plans, reports, status definitions, and capabilities

### Mandatory foundations

Always read:

- `foundations/evidence-levels.md`
- `foundations/baseline-and-regression.md`
- `foundations/validation-safety.md`
- `foundations/status-and-reporting.md`

### Checklist routing

| Validation domain | File |
|---|---|
| Compilation and Console | `checklists/compilation-and-console.md` |
| EditMode and PlayMode tests | `checklists/tests.md` |
| Scenes and Build Settings | `checklists/scenes-and-build-settings.md` |
| Prefabs and serialization | `checklists/prefabs-and-serialization.md` |
| Runtime smoke testing | `checklists/runtime-smoke-tests.md` |
| Builds and artifacts | `checklists/builds-and-artifacts.md` |
| Packages and assemblies | `checklists/packages-and-assemblies.md` |
| Performance budgets | `checklists/performance-budgets.md` |
| Multiplayer validation | `checklists/multiplayer.md` |
| Save and migration validation | `checklists/save-and-migration.md` |
| UI, localization, and input | `checklists/ui-localization-input.md` |
| Rendering, shaders, and VFX | `checklists/rendering-shaders-vfx.md` |
| XR and devices | `checklists/xr-and-devices.md` |
| CI and reproducibility | `checklists/ci-and-reproducibility.md` |
| Release candidate validation | `checklists/release-candidate.md` |

### Framework routing

Read framework guidance only when active use is confirmed.

| Framework or platform | File |
|---|---|
| Photon Fusion | `frameworks/networking/fusion.md` |
| Netcode for GameObjects | `frameworks/networking/netcode-for-gameobjects.md` |
| Mirror | `frameworks/networking/mirror.md` |
| FishNet | `frameworks/networking/fishnet.md` |
| URP | `frameworks/rendering/urp.md` |
| HDRP | `frameworks/rendering/hdrp.md` |
| Windows | `frameworks/platforms/windows.md` |
| Android | `frameworks/platforms/android.md` |
| iOS | `frameworks/platforms/ios.md` |
| WebGL | `frameworks/platforms/webgl.md` |
| Linux | `frameworks/platforms/linux.md` |
| macOS | `frameworks/platforms/macos.md` |
| Dedicated server | `frameworks/platforms/dedicated-server.md` |

## Validation modes

### Change validation

Use after a specific implementation or bug fix.

Focus on:

- changed assemblies
- affected scenes and prefabs
- relevant tests
- original behavior or reproduction
- regression surface

### Project validation

Use for a general readiness check.

Focus on:

- project compilation
- Console baseline
- test suites
- build scenes
- target build
- critical assets

### Release candidate validation

Use before publishing or handing off a build.

Include:

- clean build
- target platform
- release configuration
- smoke tests
- save compatibility
- networking
- performance budgets
- version and artifact metadata
- reproducibility

### CI validation

Use when validating automated commands or pipelines.

Confirm:

- command reproducibility
- exit codes
- test result artifacts
- build artifacts
- environment requirements
- secret handling
- failure visibility

## Core principles

1. Record the baseline before running validation.
2. Distinguish pre-existing failures from regressions.
3. Validate the changed surface first.
4. Progress from cheap to strong evidence.
5. Use the actual target platform when required.
6. Report exact commands, tests, scenes, and artifacts.
7. Do not claim runtime behavior from compilation.
8. Do not claim multiplayer correctness from one instance.
9. Do not claim visual correctness without visual inspection.
10. Do not claim performance compliance without measurement.
11. Preserve failing evidence.
12. Report blocked and unverified areas explicitly.

## Phase 1: Define validation contract

Determine:

- what change or project state is being validated
- acceptance criteria
- target platform
- build configuration
- scenes or features involved
- required test suites
- required runtime scenarios
- performance or memory budgets
- multiplayer topology
- device or XR requirements
- artifact expectations
- release stage

If no explicit criteria exist, infer the smallest meaningful validation set from
the change and project context.

## Phase 2: Establish baseline

Before changing state:

- record Git commit and working tree status
- inspect changed files
- read current Console messages
- record known failing tests
- record Unity and package versions
- record active target platform
- record Build Settings scenes
- identify existing build and CI commands
- identify required environment variables without exposing their values

Do not clear the Console until baseline evidence is preserved.

## Phase 3: Select validation level

Use `foundations/evidence-levels.md`.

Choose the strongest practical level required by the change.

Examples:

- plain C# calculation: compile + EditMode tests
- MonoBehaviour lifecycle: compile + PlayMode or runtime
- prefab integration: compile + serialized reference inspection + runtime
- multiplayer: multi-peer validation
- shader: shader compilation + visual validation
- platform API: target build + target device
- save migration: old save + new save + reload
- performance fix: before/after measurement

## Phase 4: Validate compilation and Console

Use `checklists/compilation-and-console.md`.

When Unity is connected:

1. Confirm active project.
2. Allow import and compilation to finish.
3. Read Console errors and warnings.
4. Separate pre-existing messages from new messages.
5. Identify assembly or package failures.
6. Do not clear messages needed as evidence.

When Unity is unavailable, use the strongest fallback:

- CI compilation
- generated solution compilation
- static analysis
- assembly-specific commands

Report that Unity Editor compilation was not confirmed.

## Phase 5: Run tests

Use `checklists/tests.md`.

Prefer targeted tests first, then broader suites.

Record:

- test category
- test names or filters
- passed
- failed
- skipped
- duration when useful
- pre-existing versus new failures
- test result artifact paths

Do not disable or ignore failures to obtain a green result.

## Phase 6: Validate scenes and serialized assets

Use:

- `checklists/scenes-and-build-settings.md`
- `checklists/prefabs-and-serialization.md`

Confirm:

- required scenes exist
- enabled scenes are correct
- startup flow is valid
- no required references are missing
- prefab variants remain valid
- ScriptableObject defaults are safe
- new `.meta` files exist
- no unintended broad serialization changes occurred

Do not open and save scenes merely to inspect them.

## Phase 7: Runtime smoke test

Use `checklists/runtime-smoke-tests.md`.

Exercise the smallest runtime scenario that proves the changed behavior.

Record:

- scene
- object or feature
- steps
- expected result
- observed result
- Console state
- repetitions
- cleanup or reload behavior

Do not say “tested in Play Mode” without stating what was exercised.

## Phase 8: Build target artifacts

Use `checklists/builds-and-artifacts.md`.

When a target build is required:

- confirm platform
- confirm configuration
- confirm scenes
- confirm output path
- record command or build method
- record duration when useful
- inspect warnings and failures
- verify artifact existence
- verify artifact metadata
- launch or install when appropriate

A successful Editor compile does not prove a player build succeeds.

## Phase 9: Run framework and platform checks

Load the relevant framework and platform guides.

Examples:

- networking topology
- dedicated-server symbols
- WebGL threading restrictions
- Android permissions and ABI
- iOS signing and IL2CPP
- Windows architecture
- shader and graphics API support

Do not mark platform validation complete without platform-relevant evidence.

## Phase 10: Validate acceptance criteria

Use a traceable matrix:

- criterion
- evidence
- status
- limitation

Every acceptance criterion must be:

- Passed
- Failed
- Blocked
- Not run
- Not applicable

Do not omit failed criteria from the final report.

## Phase 11: Review working tree and artifacts

Before completion:

- inspect final diff
- identify generated files
- identify unintended changes
- ensure temporary diagnostics are removed
- ensure test artifacts are stored appropriately
- ensure build artifacts are outside source directories unless expected
- ensure secrets were not written to logs or reports
- record artifact paths

## Phase 12: Assign validation status

Use `foundations/status-and-reporting.md`.

Allowed overall statuses:

- Ready
- Ready with limitations
- Blocked
- Failed
- Not validated

Do not use Ready when a required criterion was not run.

## Prohibited behavior

Do not:

- declare success from compilation alone
- hide failing tests
- clear evidence before recording it
- change code to silence tests without understanding the failure
- remove scenes from Build Settings to make a build pass
- disable stripping, signing, or platform constraints casually
- update dependencies during validation
- replace test data
- skip the original bug reproduction
- claim two-peer validation from one process
- claim performance improvement without equivalent measurements
- claim visual quality from code inspection
- expose signing credentials or tokens

## Definition of done

Validation is complete when:

- scope and acceptance criteria are explicit
- baseline is recorded
- required validation levels are selected
- compilation status is known
- Console regressions are classified
- required tests were run
- scenes and serialized assets were checked
- runtime behavior was exercised when required
- target build was produced when required
- framework and platform checks were applied
- acceptance criteria have statuses
- final diff and artifacts were reviewed
- overall status is assigned honestly
- limitations are explicit

## Final response

Return:

### Status

Ready / Ready with limitations / Blocked / Failed / Not validated

### Validation summary

Summarize the strongest evidence.

### Acceptance criteria

List each criterion and status.

### Tests and builds

Include exact suites, platforms, and artifact paths.

### Regressions

State new, pre-existing, and unresolved failures.

### Limitations

State what was not validated and why.

### Recommended next action

Include only the most important action required to reach Ready.
