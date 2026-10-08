# Changelog

All notable changes to Engineering Project OS are documented in this file.

The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] - Unreleased candidate

### Fixed

- Delivered canonical request and proof examples in managed WORKFLOW for ordinary engineering turns, explicit cancellation and fresh file-only recovery.
- Required immediate record validation after intake and withdrawal and structural validation on recovery.
- Added explicit READY/NOT_READY outcome reports and a failing --require-ready mode for pending acceptance.
- Added a read-only exact-package acceptance guard before publication recommendations; package consistency alone does not imply readiness.
- Preserved schema 5, plans schema 2 and request/contract schema 1. Fresh host acceptance remains mandatory and publication is separate.

## [2.2.0] - Directory publication reported 2026-09-30

### Added

- Added durable user-request intake, conflict resolution and following-slice routing that survives context compaction through repository records.
- Added JSON acceptance contracts, explicit evidence targets and completion receipts for new plans.
- Added read-only plan status and transactional plan complete operations that reject open prerequisites, unresolved scoped requests and invalid proof.
- Added managed workflow guidance and schema 5 migration from schemas 2, 3 and 4 with historical closed dispositions and review-on-resume handling of legacy unfinished plans.
- Added synthetic continuity, closure, migration and extracted-package regressions. Fresh host behavior and publication remain separate acceptance gates.

### Changed

- Plan index format is schema 2; contracts and request registries use schema 1. Existing knowledge-transfer formats remain unchanged.
- Bootstrap, adoption and upgrade deliver workflow routing and request owners while preserving project content.
- Transactions verify written destinations after final validation and preserve divergent concurrent writes during rollback.

## [2.1.1] - 2026-09-15

### Changed

- Made `Built for Codex` the permanent product descriptor and positioned ChatGPT as a companion for explanations, supplied project files and portable knowledge bundles.
- Rewrote the primary onboarding around concrete developer workflows: resuming long Codex work, preserving acceptance boundaries, coordinating multi-phase migrations and reusing verified failure knowledge.
- Aligned plugin descriptions, skill metadata, capabilities, starter prompts and discovery evaluations with Codex-first activation and explicit negative cases.
- Updated the versionless social preview with the `BUILT FOR CODEX` eyebrow while preserving the approved logo, alignment, tagline and record labels.
- Kept schema 4, command interfaces, repository record formats and knowledge transfer formats unchanged.

## [2.1.0] - 2026-09-15

### Added

- Added a user-owned reusable failure knowledge library that moves directly between the user's repositories or through a deterministic portable JSON bundle.
- Added reviewed `knowledge list`, `prepare`, `approve`, `revise`, `retire`, `remove`, `export` and `import` workflows with target applicability previews, conflict detection and idempotent replay.
- Added schema 4 migration that preserves proven user lessons, keeps private lessons local and removes old release-managed seed entries without losing unresolved local changes.

### Changed

- Replaced the publisher-managed shared knowledge model with repository-local project and reusable registries controlled entirely by the user.
- Updated plugin discovery metadata and the third Directory starter prompt around the cross-project knowledge workflow.
- Reworked public documentation to explain who Project OS is for, how reusable failure knowledge compounds and how ChatGPT and Codex transfer it without automatic upload or a central service.
- Refreshed the final social preview alignment for the Resume identity introduced in 2.0.5.

### Deprecated

- Changed `sync-knowledge` into a read-only compatibility notice that directs users to explicit knowledge import.
- Kept `knowledge propose-shared` as a read-only alias for `knowledge prepare` during the 2.1.0 transition.

## [2.0.5] - 2026-09-15 - Universal Plugin Directory and GitHub

### Added

- Added a read-only `overview` route that explains what Project OS does, how it works and when a developer should use it without requiring repository files.
- Added a discovery golden set with direct, indirect, incomplete, negative and edge cases for ChatGPT and Codex activation checks.
- Added an explicit cross-project failure-knowledge lifecycle that keeps project evidence local, sanitizes reusable lessons and requires deliberate review before reuse.

### Changed

- Replaced the first Directory starter prompt with a product overview while retaining starter-package creation and existing-setup review as the other two entry points.
- Tightened plugin and skill metadata around resumable engineering work, repository continuity, evidence and reusable failure knowledge.
- Replaced the previous identity mark with a filled Resume symbol and refreshed the repository and social-preview artwork around the 2.0.5 positioning.
- Reworked the README and architectural explanation for developers so the audience, immediate benefits and compounding knowledge value are clear before setup details.
- Documented conservative implicit activation for clear Project OS continuity requests while excluding ordinary coding and generic project management.
- Kept technical setup, usage, reference and packaging guidance synchronized with the 2.0.5 behavior and release gates.

## [2.0.4] - 2026-09-14

### Changed

- Made the Universal Plugin Directory the primary installation route for ChatGPT and Codex, with the tagged standalone skill documented as a Codex-only alternative.
- Added the public Directory page to the README and setup guide, paired `@Engineering Project OS` and `$project-os` usage, update guidance and explicit repository-input boundaries.
- Reworked the README and architectural explanation around resumable engineering state while keeping setup, usage, reference, packaging, security and legal documents technical.
- Added ChatGPT and Codex capability metadata, reviewer guidance and starter prompts.
- Added a package gate that rejects hard-wrapped Markdown prose or list items and normalized public Markdown to one physical line per paragraph or item.
- Replaced file-upload instructions in the three ChatGPT starter buttons with outcome-focused setup, starter-package and review requests.
- Allowed ChatGPT setup advice and starter-package generation to begin from a project description or selected files while keeping existing-setup claims evidence-based.
- Documented full repository ZIP uploads as an optional deep-inspection input rather than the normal entry point.
- Included all changes from the Directory-only 2.0.2 and 2.0.3 versions in the GitHub 2.0.4 release line.

### Fixed

- Enabled implicit skill exposure when the plugin is selected so ChatGPT can invoke Project OS.
- Prevented the ChatGPT workflow from treating an empty host workspace as the supplied repository or falling back to a generic audit when repository files are missing.
- Kept `skills/project-os/agents/openai.yaml` within the accepted policy schema by using only `allow_implicit_invocation: true`.
- Increased all packaged SVG canvas dimensions to satisfy Directory validation.

## 2.0.3 - 2026-09-14 - Universal Plugin Directory only

### Changed

- Made the Universal Plugin Directory the primary installation route for ChatGPT and Codex, with the tagged standalone skill documented as a Codex-only alternative.
- Added the public Directory page to the README and setup guide, paired `@Engineering Project OS` and `$project-os` usage, update guidance and explicit repository-input boundaries.
- Reworked the README and architectural explanation around resumable engineering state while keeping setup, usage, reference, packaging, security and legal documents technical.
- Added ChatGPT and Codex capability metadata, reviewer guidance and starter prompts that ask for repository files when a ChatGPT conversation has none.
- Added a package gate that rejects hard-wrapped Markdown prose or list items and normalized public Markdown to one physical line per paragraph or item.

### Fixed

- Enabled implicit skill exposure when the plugin is selected so ChatGPT can invoke Project OS.
- Prevented the ChatGPT workflow from treating an empty host workspace as the supplied repository or falling back to a generic audit when repository files are missing.
- Kept `skills/project-os/agents/openai.yaml` within the accepted policy schema by using only `allow_implicit_invocation: true`.
- Increased all packaged SVG canvas dimensions to satisfy Directory validation.

## 2.0.2 - 2026-09-14 - Universal Plugin Directory only

### Changed

- Enabled the Project OS skill in both ChatGPT and Codex.
- Replaced Codex-only `$project-os` starter prompts with product-neutral prompts suitable for the shared Universal Plugin Directory listing.
- Updated plugin and skill metadata to explain explicit invocation in each product.

## [2.0.1] - 2026-09-14

### Fixed

- Anchored filesystem mutation and rollback to directory descriptors so parent symlink swaps cannot redirect writes; unsupported write environments now fail closed.
- Bound JSON parsing and concurrency hashes to the same byte snapshot across upgrade, sync and Program lifecycle operations.
- Rejected implicit release downgrades and guarded plan state throughout Program closure.
- Detected unprefixed PKCS#8 private-key markers in shared-knowledge sanitization.
- Handled non-object package.json values with a diagnostic instead of a traceback.
- Corrected the Expo bootstrap reviewer case and documented blocked-plan resumption.
- Corrected the copyright holder and author attribution to Pavel Bochkov Rastopchin.

### Changed

- Added public Privacy Policy, Terms and support metadata for the skills-only package.
- Aligned Codex-only metadata, listing assets and explicit invocation settings.
- Added reproducible ZIP packaging with complete public documentation, self-contained reviewer fixtures and extracted-artifact tests. Directory submission remains an independent distribution step.
- Kept this repository's working records local and added a publication check that preserves public plugin metadata, bundled templates and synthetic fixtures.

## [2.0.0] - 2026-09-13

### Changed

- Replaced installation profiles with one permanent Standard system and an explicit temporary Program lifecycle.
- Made short natural-language `$project-os` requests the primary Codex interface and added read-only help for discovering every supported request.
- Added deterministic Program start, status and close operations with complete contract validation.
- Added SHA-256 checked, tamper-evident archives for closed Program contracts.
- Added one conflict-checked helper upgrade operation with caught-failure rollback for release, schema, managed-content and lifecycle migrations.
- Advanced the repository manifest to schema 3 and aligned release surfaces on version 2.0.0.
- Documented safe self-hosting with a stable installed skill and candidate source helper.
- Added vector identity assets and aligned plugin and skill presentation metadata.
- Updated CI actions to current Node 24-based major releases.

## [1.0.1] - 2026-09-13

### Changed

- Clarified skill invocation, repository integration, everyday usage and release version alignment.
- Made the standalone GitHub skill the documented installation path.
- Aligned package metadata, generated repository metadata and bundled knowledge on one release version.
- Made repository and managed knowledge version mismatches fail the Project OS checker.
- Added lockstep release validation and documented the uniform managed-content upgrade workflow.

## [1.0.0] - 2026-09-13

### Added

- Stack-agnostic Project OS manifest with explicit record mappings.
- Non-destructive initialization and adoption of existing project systems.
- Service, web, mobile, data and delivery capability packs.
- React Native and Expo ecosystem overlay for the mobile pack.
- Deterministic detection, initialization, adoption, consistency checking and knowledge synchronization.
- Sanitized project and shared failure-knowledge lifecycle with conflict detection.
- Portable package manifests and repository-local packaging metadata.

[1.0.0]: https://github.com/innrvoice/engineering-project-os/releases/tag/v1.0.0
[1.0.1]: https://github.com/innrvoice/engineering-project-os/compare/v1.0.0...v1.0.1
[2.0.0]: https://github.com/innrvoice/engineering-project-os/compare/v1.0.1...v2.0.0
[2.0.1]: https://github.com/innrvoice/engineering-project-os/compare/v2.0.0...v2.0.1
[2.0.4]: https://github.com/innrvoice/engineering-project-os/compare/v2.0.1...v2.0.4
[2.0.5]: https://github.com/innrvoice/engineering-project-os/compare/v2.0.4...v2.0.5
[2.1.0]: https://github.com/innrvoice/engineering-project-os/compare/v2.0.5...v2.1.0
[2.1.1]: https://github.com/innrvoice/engineering-project-os/compare/v2.1.0...v2.1.1
