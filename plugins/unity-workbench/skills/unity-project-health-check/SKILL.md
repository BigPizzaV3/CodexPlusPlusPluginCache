---
name: unity-project-health-check
description: Audit the technical health of an existing Unity project without making changes by default. Use when the user asks for a project review, technical audit, architecture review, performance scan, package review, build readiness check, maintainability assessment, risk analysis, or general Unity project health report. Inspect evidence across code, assemblies, scenes, prefabs, packages, settings, tests, performance-sensitive paths, networking, rendering, persistence, and build configuration. Produce prioritized findings with severity, confidence, evidence, impact, and recommended next actions.
---

# Unity Project Health Check

Assess the technical health of a Unity project using evidence from the
repository and, when available, the connected Unity Editor.

The default mode is read-only.

Do not automatically fix findings unless the user explicitly asks for
remediation.

## Surface Limits

If the current surface is Chat mode without an attached workspace, repository files, or local filesystem access, do not present a project health report as if the project was audited. Explain that Unity Essentials can provide an audit checklist or review pasted evidence, but a real health check requires Codex with the Unity project folder open.

If Codex has a workspace or local files available, keep the audit evidence-based and read-only by default.

## Primary outcome

Produce a concise, prioritized report that answers:

- What is healthy?
- What is risky?
- What is broken or likely to break?
- What should be fixed first?
- Which findings are confirmed, likely, or unknown?
- Which checks could not be completed?

## Relationship with onboarding

Look for an existing context document:

- `Docs/AI/UnityProjectContext.md`
- `Docs/UnityProjectContext.md`
- architecture documentation
- repository instructions

If no reliable project context exists, use the
`unity-project-onboarding` workflow first or perform the minimum equivalent
inspection needed for the audit.

Do not duplicate complete onboarding findings in the health report.

## Default behavior

The health check is read-only unless explicitly requested otherwise.

Do not:

- modify code
- edit scenes or prefabs
- install or update packages
- change Project Settings
- enter Play Mode without a validation need
- trigger builds without a clear reason
- clear the Console
- rewrite documentation
- delete generated folders

## Knowledge routing

The skill contains:

- `foundations/`: audit principles and reporting rules
- `checklists/`: health domains
- `frameworks/`: framework-specific review criteria
- `references/`: templates, scoring, and capability guidance

Read only the areas relevant to the requested scope.

### Mandatory foundations

Always read:

- `foundations/evidence-and-confidence.md`
- `foundations/severity-and-prioritization.md`
- `foundations/read-only-audit-safety.md`
- `foundations/reporting-quality.md`

### Checklist routing

| Audit area | File |
|---|---|
| Architecture and coupling | `checklists/architecture-and-maintainability.md` |
| Code quality and C# risks | `checklists/code-quality.md` |
| Unity lifecycle and initialization | `checklists/lifecycle-and-initialization.md` |
| Assemblies and dependencies | `checklists/assemblies-and-dependencies.md` |
| Packages and compatibility | `checklists/packages-and-compatibility.md` |
| Scenes, prefabs, and serialization | `checklists/scenes-prefabs-serialization.md` |
| Performance and allocations | `checklists/performance.md` |
| Memory and asset loading | `checklists/memory-and-assets.md` |
| Rendering, shaders, and VFX | `checklists/rendering-and-vfx.md` |
| Multiplayer and networking | `checklists/multiplayer.md` |
| Save data and persistence | `checklists/save-and-persistence.md` |
| UI, localization, and accessibility | `checklists/ui-localization-accessibility.md` |
| Input and device support | `checklists/input-and-device-support.md` |
| Tests and validation | `checklists/testing-and-validation.md` |
| Builds, platforms, and CI | `checklists/builds-platforms-ci.md` |
| Security and secrets | `checklists/security-and-secrets.md` |
| Editor tooling and imports | `checklists/editor-tooling-and-imports.md` |
| Project hygiene and version control | `checklists/project-hygiene.md` |

### Framework routing

Read framework guidance only when active use is confirmed.

| Framework | File |
|---|---|
| Photon Fusion | `frameworks/networking/fusion.md` |
| Netcode for GameObjects | `frameworks/networking/netcode-for-gameobjects.md` |
| Mirror | `frameworks/networking/mirror.md` |
| FishNet | `frameworks/networking/fishnet.md` |
| URP | `frameworks/rendering/urp.md` |
| HDRP | `frameworks/rendering/hdrp.md` |

## Audit modes

### Focused

Use when the user asks about one area, such as performance or architecture.

Inspect only the relevant domains and immediate dependencies.

### Standard

Use for a general project health review.

Inspect all high-value domains, but sample large repositories rather than
reading every file.

### Release readiness

Use before a milestone, demo, submission, or launch.

Prioritize:

- compilation
- Console
- tests
- scenes
- builds
- packages
- missing references
- platform issues
- persistence
- severe performance risks

### Deep audit

Use only when explicitly requested or clearly justified.

May include:

- broad code sampling
- full assembly analysis
- package compatibility review
- profiler capture
- build validation
- multi-peer networking review
- target-device validation

## Core principles

1. Evidence before conclusions.
2. Read-only by default.
3. Separate confirmed defects from code smells.
4. Prioritize impact, not stylistic preference.
5. Respect existing architecture.
6. Do not recommend rewrites without strong justification.
7. Prefer actionable findings.
8. Avoid generic Unity advice.
9. Do not count generated or vendor code as first-party debt.
10. Report audit limitations.
11. Do not claim runtime, build, or platform validation that did not occur.
12. Keep the report proportionate to the project and request.

## Phase 1: Define audit scope

Determine:

- focused, standard, release readiness, or deep audit
- target platform
- Unity version
- project size
- active frameworks
- performance requirements
- multiplayer requirements
- release stage
- known concerns
- whether Editor tools are available

If the user did not specify scope, use a standard read-only audit.

## Phase 2: Establish baseline

Inspect:

- project context
- Unity version
- package manifest and lock file
- repository instructions
- current Console messages
- current test status
- build scene configuration
- first-party assemblies
- top-level first-party directories
- recent relevant changes when useful

Distinguish pre-existing known issues from newly discovered findings.

## Phase 3: Separate first-party and vendor code

Identify likely:

- first-party code
- embedded packages
- third-party packages
- generated source
- imported Asset Store content
- examples and samples
- test fixtures
- build artifacts

Do not report vendor implementation details as project-owned issues unless the
project integration creates the risk.

## Phase 4: Route to audit domains

Select the required checklists.

For a standard audit, normally include:

- architecture
- code quality
- lifecycle
- assemblies
- packages
- scenes and serialization
- performance
- memory and assets
- tests
- builds
- project hygiene

Include networking, rendering, UI, input, persistence, or editor tooling when
the project actively uses them.

## Phase 5: Gather evidence

Use:

- configuration files
- package metadata
- assembly definitions
- representative first-party code
- scene and prefab inspection
- Console messages
- test results
- profiler data
- build logs
- Git metadata
- project documentation

Sample intelligently.

Do not read every file unless the audit requires it.

## Phase 6: Record findings

Use `references/finding-template.md`.

Each finding should contain:

- title
- domain
- severity
- confidence
- evidence
- impact
- recommendation
- remediation size
- validation needed
- affected paths

Do not report a style preference as a defect.

## Phase 7: Deduplicate and group

Combine findings that share one root cause.

Example:

Do not report ten separate missing-reference symptoms when they all result from
one broken prefab base.

Group findings by:

- architecture
- correctness
- performance
- maintainability
- release risk
- data integrity
- platform compatibility

## Phase 8: Prioritize

Use `references/health-scoring.md`.

Prioritize based on:

- user impact
- crash or data-loss risk
- release-blocking potential
- frequency
- scope
- recovery difficulty
- confidence
- remediation cost

Do not prioritize a low-impact clean-code issue above a build failure or save
corruption risk.

## Phase 9: Identify healthy areas

Report meaningful positive findings.

Examples:

- clear assembly boundaries
- reliable automated tests
- no new Console errors
- consistent serialization practices
- strong package pinning
- clean networking authority model
- controlled asset loading

Do not add empty praise.

## Phase 10: Recommend next actions

Provide an ordered action plan.

Each action should state:

- expected benefit
- affected finding IDs
- likely effort
- required validation
- whether it can be handled by another plugin skill

Recommended routing:

- feature changes → `unity-feature-implementation`
- root-cause investigation → `unity-bug-investigation`
- final verification → `unity-build-validation`

## Phase 11: Optional baseline artifact

When useful, create or update:

`Docs/AI/UnityProjectHealth.md`

Use `references/health-report-template.md`.

Do not create a persistent report when the user requested only a quick review.

When updating an existing report:

- preserve manually authored notes
- update stale findings
- close resolved findings
- keep stable finding IDs
- record analyzed commit and date

## Severity definitions

### Critical

Likely to cause:

- data loss
- security exposure
- consistent crash
- broken production build
- severe multiplayer integrity failure
- project corruption

### High

Likely to cause:

- major feature failure
- frequent runtime errors
- serious release risk
- major platform incompatibility
- severe performance degradation
- save migration failure

### Medium

Meaningful maintainability, correctness, performance, or workflow risk.

### Low

Limited impact, localized debt, or preventive improvement.

### Informational

Useful observation with no immediate corrective need.

## Confidence definitions

### Confirmed

Directly demonstrated through configuration, code, Editor state, tests,
profiling, build output, or reproducible behavior.

### Likely

Supported by several consistent signals but not directly reproduced.

### Possible

Plausible and worth checking, but evidence is incomplete.

Do not assign high severity with weak confidence without clearly explaining the
uncertainty.

## Definition of done

The health check is complete when:

- scope is explicit
- baseline is recorded
- first-party and vendor code are separated
- relevant domains were inspected
- findings contain evidence
- severity and confidence are assigned
- duplicates are grouped
- healthy areas are identified
- limitations are explicit
- next actions are prioritized
- no unintended project changes were made
- persistent report is created only when appropriate

## Final response

Return:

### Overall health

A concise assessment and major theme.

### Highest-priority findings

List only the most important findings with severity and confidence.

### Healthy areas

Mention meaningful strengths.

### Recommended order

Provide the most useful remediation sequence.

### Audit coverage

State what was and was not checked.

### Report path

Include the persistent report path when created.
