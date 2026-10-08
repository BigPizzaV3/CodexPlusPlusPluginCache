---
name: flowstack-ui-maintainer
description: Coordinate a FLOWSTACK public-package change across authority, exact-version dependencies, Agent Knowledge, qualification, and release readiness. Use for maintaining Atom, Brick, Colors, Theme, or their public delivery adapters; use the builder skill for ordinary application UI work.
---

# FLOWSTACK UI Maintainer

Coordinate public package work without collapsing repository or release boundaries.

## Establish authority and exact evidence

Read the workspace and repository instructions that apply to the target. Identify the owner before editing: Atom owns public behavior, Brick finished presentation, Colors reviewed color candidates, Theme compiled semantic artifacts, the private Blocks registry owns paid copy-owned compositions, the public Blocks CLI owns only source-free authenticated delivery, and Agent Tools owns exact-version delivery adapters for public package guidance.

Resolve every affected public package and existing public owner with `scripts/resolve-agent-knowledge.mjs`. Pass `--project`, `--package`, and, for a selected owner, `--kind` plus `--id`; pass an exact `--version` whenever the package is not installed. When resolving a staged or locked archive, also pass its recorded `--archive-sha256`; the resolver must return that locked archive identity. Read the resolved zero-failure coverage, package guides, and selected artifacts. Never substitute a sibling checkout, current-main guidance, or a remembered API for an exact dependency boundary. Do not use Agent Tools to resolve private Blocks source, item guidance, bundles, or authenticated responses.

A new owner requires two passes. Before editing, resolve the baseline package guides and the closest existing owners rather than pretending the new ID exists. Add the public API and canonical Agent Knowledge, regenerate closed coverage, and pack a uniquely identified candidate. Then resolve the new owner from that candidate before a dependent repository adopts it. Do not let the same package version identify materially different candidates across a dependency handoff; use the repository-approved next or prerelease version, or require the exact archive digest when repository policy prevents an early version change.

Before changing an Atom or Brick component, run the owning workspace's task-context preparation when that workflow exists. Treat its output as routing, not authority.

## Plan the dependency slice

- Keep one coherent owner change per branch and record its true parent when work is stacked.
- Put behavior and accessibility prerequisites in Atom before Brick adopts them.
- Let Brick release before the private Blocks registry makes a released-dependency claim. Blocks may qualify against a uniquely versioned, digest-locked Brick candidate only when both owning repositories explicitly permit that candidate workflow; let the private release pipeline complete before a consumer claims an authenticated CLI installation.
- Treat Colors as an independently reviewed input and Theme as a compiled compatibility boundary; do not bypass their candidate and contract checks.
- Update canonical human and machine Agent Knowledge with the owned API. Derived LLM, skill, MCP, website, and archive views follow only after the source package is correct.

State the intended versions, archive identities when applicable, and dependency order before a release-sensitive change. A staged archive may qualify the next candidate only when the owning repository explicitly permits that release-candidate workflow; it is not a published dependency and cannot support a production-consumer claim.

## Implement and qualify

Make the smallest owner-correct change, preserve public export and CSS entry contracts, and add source, generated, packed, and clean-consumer evidence required by the repository. For components, verify semantics, naming, state, focus, keyboard and pointer behavior, responsive containment, appearance modes, forced colors, reduced motion, and documented customization surfaces in proportion to the change.

Regenerate derived artifacts only through repository commands. Review generated diffs for private paths, paid Blocks content, stale versions, uncovered owners, unresolved selections, and unrelated churn. Record Agent Knowledge usefulness only when it changed a decision or prevented a defect.

## Integrate without overreaching

Commit and push an owning subrepository before updating its parent revision. Preserve stacked parent relationships and report CI blockers at the repository that owns them. Do not merge, publish, deploy, create trusted-publishing configuration, or install into a personal environment without the user's authorization for that external mutation.

At handoff, report commits, branches or pull requests, exact versions, verification results, archive hashes when produced, remaining parent/release gates, and the next dependency owner. Do not call a local candidate publicly available.
