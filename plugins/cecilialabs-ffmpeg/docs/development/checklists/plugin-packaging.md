# Milestone 11 — Plugin Packaging & Assets — Checklist

**Target:** `v0.9.0`  
**Status:** Implemented; local validation required before merge

## Portable plugin manifest

- [x] Agent Plugins 1.0.0 schema retained.
- [x] Name, version, description, author, homepage, repository, license, and keywords defined.
- [x] No non-standard top-level `skills`, `branding`, or `documentation` fields added to the closed manifest schema.
- [x] Cecil-IA Labs extension namespace contains branding, documentation, skill catalog, and npm identity metadata.
- [x] All extension file paths are plugin-relative and package-contained.

## Skills

- [x] Seven professional skills remain at the standard `skills/` fixed discovery location.
- [x] Extension skill catalog matches those seven skills.
- [x] No external skill path is referenced.

## Branding assets

- [x] `assets/icon.svg`.
- [x] `assets/icon-dark.svg`.
- [x] `assets/logo.svg`.
- [x] `assets/screenshots/cli-overview.svg`.
- [x] `assets/screenshots/skills-overview.svg`.
- [x] Icons use a 128×128 vector viewBox and remain legible at 16/32/64/128.
- [x] SVG assets contain no remote images, scripts, stylesheets, or web-font imports.

## Distribution

- [x] `package.json.files` includes `dist/`, `assets/`, `skills/`, `specs/`, `docs/`, manifest, README, and license.
- [x] Static plugin containment verifier added.
- [x] `npm pack --dry-run --json --ignore-scripts` verifier added.
- [x] Required dist/plugin/skill/asset/docs files are checked in dry-run tarball metadata.
- [x] Repository-only `legacy/`, `test/`, `scripts/`, and `node_modules/` are rejected if leaked.

## Quality

- [x] Added plugin packaging contract tests.
- [x] Added `verify:plugin`.
- [x] Added `verify:package`.
- [x] Added both to the validation gate in dependency-safe order.
- [x] Package/plugin/project identity advanced to `0.9.0`.
- [x] README, roadmap, changelog, assets docs, and Milestone 11 docs updated.
- [x] GitHub Actions intentionally remain deferred until alpha completion.
- [ ] Run `npm run validate` in the configured local Environment before merge.

## Acceptance criterion

The plugin distribution is self-contained: every discovered skill and every manifest-referenced local asset/document resolves within the package, and npm dry-run packaging confirms required files are shipped.
