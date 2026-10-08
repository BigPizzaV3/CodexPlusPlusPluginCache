---
name: unity-project-onboarding
description: Analyze and document an unfamiliar Unity project before substantial work begins. Use when opening, cloning, inheriting, reviewing, or starting work in a Unity repository; when the user asks to understand the project architecture; or before implementing a feature without sufficient project context. Detect Unity version, packages, render pipeline, input, networking, tests, assemblies, scenes, conventions, and available Unity MCP capabilities. Produce a persistent project context document without modifying Unity assets.
---

# Unity Project Onboarding

Understand the Unity project before making substantial changes.

This skill performs a read-only inspection of the repository and, when available, the connected Unity Editor. It produces a concise persistent description that future agents can use when working on the project.

## Surface Limits

If the current surface is Chat mode without an attached workspace, repository files, or local filesystem access, do not claim that you inspected the Unity project. Explain that Unity Essentials can give conceptual guidance from pasted files or screenshots, but a real onboarding requires Codex with the Unity project folder open.

If Codex has a workspace or local files available, verify the project root from actual files before producing findings.

## Primary outcome

Create or update:

`Docs/AI/UnityProjectContext.md`

If the project already uses another documentation location, prefer that location instead of creating a competing structure.

Do not create the document when the user only requested a quick explanation. In that case, return the findings directly.

## Core Principles

1. Inspect before modifying.
2. Prefer repository evidence over assumptions.
3. Separate confirmed facts from inferred conclusions.
4. Do not require a Unity MCP.
5. Use an available MCP only when it provides useful additional evidence.
6. Do not open or modify scenes merely to collect information.
7. Keep the generated context concise and useful for future tasks.
8. Preserve useful manually written documentation.
9. Never report a framework as installed solely because its name appears in generated or cached files.
10. Treat `Library/`, `Temp/`, `Logs/`, `obj/`, and build output as generated directories unless the project explicitly documents otherwise.

## MCP Policy

During onboarding, detect whether the project already has a Unity MCP provider before suggesting a new one.

Check:

- `Packages/manifest.json`
- `Packages/packages-lock.json`
- embedded packages under `Packages/`
- project MCP client config files
- currently available Codex MCP tools

Record existing MCP/tooling as `available`, `unavailable`, or `unverified`.

Do not install, update, remove, or replace MCP packages during onboarding. If no MCP exists, state that Unity work can continue from repository evidence and ask whether the user wants help choosing one.

## Phase 1: Verify The Project

Confirm that the current repository is a Unity project by looking for:

- `Assets/`
- `Packages/manifest.json`
- `ProjectSettings/ProjectVersion.txt`

If one or more are missing, search parent and immediate child directories for a Unity project root. If exactly one valid project root exists, use it. If multiple Unity projects exist, report them and inspect the project most relevant to the user's request. Do not create a Unity context document for an unverified project.

Record the resolved Unity project root.

## Phase 2: Read Existing Guidance

Before analyzing implementation details, locate existing project instructions.

Check for:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `CONTRIBUTING.md`
- files under `Docs/`
- files under `.github/`
- existing AI context or architecture documentation

Extract naming conventions, folder conventions, architectural rules, testing requirements, supported platforms, prohibited changes, package-management rules, and build instructions.

Project-specific instructions override generic recommendations in this skill.

## Phase 3: Detect The Unity Environment

Read `ProjectSettings/ProjectVersion.txt` and record the editor version, revision when present, and Unity generation.

Read `Packages/manifest.json` and `Packages/packages-lock.json` when present. Separate packages into Unity registry packages, embedded packages, Git packages, local file packages, scoped-registry packages, and unknown/custom packages.

Record packages relevant to render pipelines, input, networking, localization, addressables, entities/DOTS, tests, cinematics, animation, XR, multiplayer tools, dependency injection, async frameworks, and similar development workflows.

Do not dump the complete dependency list unless requested.

## Phase 4: Classify Key Systems

Classify the render pipeline from package dependencies, graphics settings, project documentation, and shader/material evidence. Use one of: Built-in Render Pipeline, Universal Render Pipeline, High Definition Render Pipeline, custom or mixed, unresolved.

Classify input as legacy Input Manager, Input System package, both, custom abstraction, or unresolved.

Detect networking from confirmed dependencies and first-party usage. Do not classify a project as multiplayer merely because a networking package exists.

Detect Unity Test Framework, EditMode tests, PlayMode tests, custom test assemblies, external test scripts, and CI test commands.

## Phase 5: Understand Project Structure

Inspect first-party directories under `Assets/`.

Ignore generated, imported, vendor, and cache directories where possible. Common vendor indicators include `Plugins`, `ThirdParty`, package names, publisher names, imported asset-store folders, and directories containing their own licenses or package manifests.

Identify primary game-code roots, editor-only code, tests, scenes, prefabs, ScriptableObjects, shaders, VFX, UI, networking, localization, addressable content, streaming assets, resources, plugins, and native libraries.

Do not assume directory names accurately represent architecture. Verify important conclusions against namespaces, assemblies, or representative files.

## Phase 6: Inspect Assemblies And Boundaries

Locate `.asmdef` and `.asmref` files.

For each important first-party assembly, record assembly name, approximate responsibility, major references, editor-only status, test status, platform restrictions, and unsafe-code setting when relevant.

Identify likely dependency direction. Flag observations such as circular conceptual dependencies, runtime assemblies depending on presentation-specific assemblies, large monolithic assemblies, editor code mixed into runtime folders, and test assemblies referencing unexpected production layers.

## Phase 7: Identify Scenes And Startup Flow

Determine scene information using the strongest available source:

1. A connected Unity MCP that can read Build Settings safely.
2. Serialized project settings.
3. Editor build-settings assets.
4. Documentation and scripts as fallback evidence.

Record enabled build scenes, likely boot/startup scene, menu or lobby scene, gameplay scenes, test/development scenes, and scene-loading system when identifiable.

Do not open, save, or modify scenes during onboarding.

## Phase 8: Identify Architecture And Conventions

Inspect a small, representative sample of first-party code. Do not read every script by default.

Look for MonoBehaviour-centric architecture, ScriptableObject architecture, service locator, dependency injection, event bus, MVC/MVP/MVVM, ECS, feature-based organization, state machines, command systems, data-oriented systems, custom update loops, async patterns, reactive frameworks, save-data architecture, and scene composition roots.

Classify each pattern as confirmed, likely, or uncertain.

Inspect existing code and formatting configuration for namespace style, private-field naming, serialized-field style, brace style, nullable-reference usage, async conventions, event naming, file organization, regions, comments, and XML documentation expectations.

Do not invent conventions from a single file unless no broader evidence exists.

## Phase 9: Detect Available Unity Tools

Map available tools to conceptual capabilities rather than coupling the skill to exact tool names.

Relevant capabilities include:

- `unity.connection.status`
- `unity.editor.version`
- `unity.console.read`
- `unity.scene.list`
- `unity.scene.inspect`
- `unity.buildsettings.read`
- `unity.gameobject.inspect`
- `unity.asset.search`
- `unity.package.read`
- `unity.tests.list`
- `unity.tests.run`
- `unity.playmode.read`
- `unity.profiler.read`

Do not invoke mutating tools during onboarding.

Do not enter Play Mode.

Do not run tests unless the user explicitly requested validation, or the project can run them safely and doing so is necessary to establish the current baseline.

## Phase 10: Generate The Project Context

Use `references/context-template.md`.

The document should normally contain:

1. Project summary
2. Confirmed environment
3. Important packages and frameworks
4. Directory structure
5. Assembly boundaries
6. Scenes and startup flow
7. Architecture
8. Coding conventions
9. Testing and validation
10. Available Unity tooling
11. Important constraints
12. Unknowns and confidence
13. Source files inspected
14. Last analyzed commit and date

Keep the main document short enough to be loaded frequently.

Avoid complete package dumps, inventories of every scene or script, speculative recommendations, generic Unity advice, copying README content verbatim, and information that can be rediscovered trivially.

## Updating An Existing Context Document

When `UnityProjectContext.md` already exists:

1. Read it before running the full inspection.
2. Preserve manually authored sections.
3. Validate claims that may have become stale.
4. Update changed facts.
5. Remove claims that are no longer supported.
6. Keep unresolved historical notes only when still useful.
7. Update the analyzed commit and date.
8. Summarize meaningful changes after editing.

Use explicit markers for generated sections when appropriate:

`<!-- unity-onboarding:generated:start -->`

`<!-- unity-onboarding:generated:end -->`

Do not overwrite text outside generated markers unless clearly obsolete and safe to update.

## Confidence And Evidence

Every important conclusion must be one of:

- **Confirmed:** directly supported by authoritative project configuration, code, documentation, or Editor data.
- **Likely:** supported by several indirect signals.
- **Unknown:** insufficient evidence.

For important claims, record one or more source paths.

## Safety Boundaries

During onboarding, do not:

- modify `.unity`, `.prefab`, `.asset`, `.mat`, `.controller`, or `.anim` files
- install, update, or remove packages
- change project settings
- enter Play Mode
- trigger a build
- reimport the project
- regenerate solution files
- delete generated directories
- fix warnings automatically
- reorganize folders
- rename assemblies or namespaces
- add dependencies
- create sample gameplay content
- expose credentials or secret values in generated documentation

If secrets are found, report their location without reproducing their values.

## Completion Criteria

Onboarding is complete when the Unity project root is verified, Unity version is known, relevant packages are summarized, render pipeline and input system are classified, important first-party directories are mapped, major assemblies are understood, scenes and startup flow are described as far as evidence permits, architectural and coding conventions are summarized, available Unity MCP capabilities are recorded, uncertainties are clearly marked, the context document is created or updated when appropriate, and no project assets were modified.

## Final Response

Return a concise summary containing:

- Unity version
- render pipeline
- important frameworks
- main architectural pattern
- startup scene or flow
- testing support
- available MCP/tooling
- context-document path
- important unknowns or risks

Do not repeat the complete context document in the response unless requested.
