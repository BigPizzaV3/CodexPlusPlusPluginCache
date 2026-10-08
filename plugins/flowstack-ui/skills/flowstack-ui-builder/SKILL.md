---
name: flowstack-ui-builder
description: Build or change FLOWSTACK interfaces by selecting the correct public layer and loading exact-version package Agent Knowledge. Use for implementation work with FLOWSTACK components, themes, or colors; use the review skill for audit-only requests.
---

# FLOWSTACK UI Builder

Build from package-owned guidance, not remembered component rules.

## Resolve authority

1. Inspect the target project's dependencies and lockfile. Run `scripts/resolve-agent-knowledge.mjs` from this skill for every FLOWSTACK package and owner you use. Pass `--project`, `--package`, and, when selecting an owner, `--kind` plus `--id`. If that exact package is not installed, also pass its exact `--version`; ranges and implicit locked-version selection are rejected.
2. Read the resolved manifest, zero-failure coverage, package guides, and selected owner artifacts. Prefer the installed package. The resolver may use Agent Tools only when its locked route has the exact requested or installed version.
3. Stop with an unavailable-version report if exact guidance cannot be resolved. Never substitute current, latest, sibling-repository, or remembered guidance.

## Select the layer

- Route an ordinary finished interface to Brick. Search Brick before native replacements or application CSS, and do not import Atom directly.
- Route explicitly requested headless UI or primitive authoring to Atom. Do not add Brick appearance rules there.
- For custom design-system color work, take reviewed Colors output into Theme, compile compatible Theme artifacts, then load those artifacts with Brick.
- Treat paid Blocks as a separate authenticated product boundary. Agent Tools does not carry their registry, source, or item guidance; after an authorized CLI installation, resolve the copied code's public Brick owners here.
- Implement a supplied Blueprint or application plan only after its jobs and policy are explicit. Public skills do not invent product strategy, content, routes, business rules, persistence, analytics, art direction, or private Blueprint policy.

Read the selected package's layer-selection and composition/system guide before individual owners. Follow related exact Atom guidance only when a Brick guide routes there for behavioral understanding; keep finished implementation imports at Brick.

## Implement and verify

- Use documented composition, public APIs, semantic Theme tokens, supported recipes, parts, and responsive contracts from the resolved artifacts.
- Load Brick's documented CSS entry exactly once and apply Theme artifacts in the documented order. Confirm package and contract compatibility rather than assuming it.
- Keep application-owned semantic HTML where the package guide permits it. Do not recreate behavior, accessibility, responsiveness, or styling already owned by FLOWSTACK.
- Run the target repository's focused type, unit, browser/accessibility, build, and package checks in proportion to the change. Check keyboard/focus behavior, responsive containment, appearance modes, CSS presence, and Theme loading where relevant.

## Report gaps

Do not conceal a fallback. Record the exact package/version, intended job, guides and owners searched, missing capability, temporary native/application/CSS fallback, proposed owner (`Brick`, `Atom`, `Colors`, `Theme`, `Block`, `Blueprint`, or `application`), and verification evidence. Repeated compositions are Block or Blueprint candidates, not new component rules in this skill.
