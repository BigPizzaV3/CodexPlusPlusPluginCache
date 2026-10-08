# README GEN

## Operation

Create or update the requested canonical documentation from current repository evidence. Verify commands and paths; do not create missing product requirements.

## Goal

Create and maintain `README.md` as the repository profile for developers and coding agents: a concise, evidence-backed index of what the project is, how it is organized, how it is run and validated, and how it is operated. Do not copy universal SDLC rules from `AGENTS.md` or `CLAUDE.md` into the README.

## Inspect

Source tree, package and build files, scripts, lockfiles, configs, environment examples, Docker, CI and deployment files, tests, migrations, docs, public assets, route or API definitions, generated artifacts, and existing README content.

## Required repository profile

Near the top of the README, create or update `## Repository profile`. If an equivalent section already exists, normalize it instead of adding a duplicate.

Include only evidenced items that materially help orientation:

- project purpose and supported capabilities;
- primary languages, runtimes, frameworks, package or build systems;
- main entrypoints, applications, packages, services, and authoritative source areas;
- canonical specifications, design docs, ADRs, or operational docs when present;
- supported setup, run, test, lint, typecheck, build, generation, migration, and validation commands;
- configuration and environment model;
- data stores, migrations, generated artifacts, and regeneration ownership where material;
- deployment, runtime, background services, and operational constraints where material.

Keep the profile compact. Put detailed procedures in the appropriate sections below. Omit unsupported rows or state a material unknown; never fill a template by guessing.

## Content rules

- Prefer current executable repository evidence over stale prose. When README content conflicts with scripts, configs, lockfiles, source, CI, or deployment files, correct the README.
- Keep commands exactly as defined in current scripts or configs. Do not publish a command merely because it is conventional for the stack.
- Include only features, integrations, environment variables, routes, deployment steps, and operational notes evidenced in the repository.
- Preserve useful existing content when still accurate; remove stale, duplicate, placeholder, or speculative guidance.
- Separate stable repository profile facts from volatile implementation details. Link to canonical detailed docs instead of duplicating them.
- Ground non-obvious facts in exact files during analysis; use `path:line[-line]` anchors in the final report when useful, but do not litter the README with internal evidence notes unless repository convention requires them.
- Write in the repository's dominant documentation language unless the user requests another language.

## Markdown structure

Use sections that fit the repository and omit irrelevant ones: repository profile, overview, features, repository structure, prerequisites, installation, configuration and environment variables, local run, commands, architecture or data flow, API or UI routes, testing and validation, migrations and generated artifacts, deployment and runtime, troubleshooting, and open questions.

Keep the README scannable: one H1, clear H2 and H3 groups, compact lists, tables only for dense profile, command, or environment references, and no placeholder sections.

## Validation

After writing:

1. verify every documented command against current scripts or configs;
2. verify profile facts against current source, lockfiles, CI, and runtime files;
3. check referenced paths and links;
4. remove claims that cannot be supported from the repository;
5. review the complete README diff for stale or duplicated guidance.
