# Submission package

This directory packages Compound Engineering for Codex submission review.

| Field | Value |
| --- | --- |
| Upstream repository | [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) |
| Source branch | `main` |
| Source commit | [`9ac32720f1c52b1fe4e760a79978647d53c9b429`](https://github.com/EveryInc/compound-engineering-plugin/commit/9ac32720f1c52b1fe4e760a79978647d53c9b429) |
| Snapshot date | September 10, 2026 |
| Upstream manifest version | `3.24.0` |
| Packaged skills | 35 |
| Plugin manifest | [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json) |

The version is copied from upstream. It has not been increased for this snapshot, so the source commit identifies its contents more precisely than the version alone.

## Contents

- The Codex plugin manifest, including the submission's display text.
- All 35 upstream skills, with their reference files, specialist prompts, scripts, and assets.
- Upstream documentation, with the README, catalog, package scope notes, privacy, and security pages adapted for this submission.
- Visual assets and the MIT license.

The package omits Git history, source code for the conversion CLI, the upstream test suite and site build, and other hosts' manifests and marketplace catalogs. Use the [full upstream repository](https://github.com/EveryInc/compound-engineering-plugin) for development and other installation formats.

## Changes from the previous submission

The previous submission matched upstream [commit `37eed42`](https://github.com/EveryInc/compound-engineering-plugin/commit/37eed42548189fcecbcb9333c8268d2cb4163c5d), apart from its Codex display metadata. This update includes subsequent changes to the existing skills and adds:

- [`ce-bakeoff`](guides/ce-bakeoff.md), which develops independent candidate approaches and selects a result against a shared brief.
- [`ce-noslop`](guides/ce-noslop.md), which rewrites, checks, or drafts prose while preserving the source's facts.

The submission retains its shorter descriptions and omission of the optional `brandColor` and `screenshots` fields. Its category is `Developer Tools`, an accepted submission category. The SVG icon has a 48×48-pixel size and a matching 48×48 viewBox. Its original artwork is scaled by 1.5 to preserve its appearance. No skill behavior is customized for this submission. Individual skill guides remain upstream documentation and generally use slash-style examples; in Codex, use the corresponding `$skill-name`.

## Verification

The packaged skills and visual assets match the source commit, apart from the SVG icon's dimensions, viewBox, and scaling wrapper. The manifest category, SVG dimensions, and viewBox are checked against the submission requirements. Documentation checks cover all 35 catalog entries and local links in the adapted pages. The ZIP is checked against the final package contents. These checks verify the package; they do not constitute an end-to-end run of every workflow or external integration.

Historical plans, reports, and captured learnings are retained as upstream reference material. Their references may describe files or workflows in the full repository. Each skill's `SKILL.md` remains the source of truth for its runtime behavior.
