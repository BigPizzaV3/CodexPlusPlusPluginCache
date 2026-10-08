# CLI Installation & Release Workflow — Completion Checklist

**Roadmap slot:** 14.5  
**Package version:** `0.9.9` (release hardening; no version bump)  
**Status:** Implementation complete; validation and merge pending

## Public installation

- [x] Preserve `bin.cecilia-ffmpeg -> ./dist/cli.js`.
- [x] Document `npm install -g @cecilialabs/ffmpeg`.
- [x] Keep package-runner usage supported; since v1.1 it must explicitly select `cecilia-ffmpeg` because the package exposes multiple binaries.
- [x] Do not add a shell-mutating `postinstall`.

## Local development

- [x] Add `npm run setup:cli`.
- [x] Add build-before-link `npm run link:cli`.
- [x] Add `npm run unlink:cli`.
- [x] Prompt before build/link.
- [x] Detect whether `cecilia-ffmpeg` is already in `PATH`.
- [x] Prompt separately before changing `~/.bashrc`.
- [x] Keep Bash changes idempotent.
- [x] Avoid automatically editing non-Bash shell configuration.

## Packaging and publishing

- [x] Add `prepack -> npm run build`.
- [x] Preserve `prepublishOnly -> npm run validate`.
- [x] Add repository-only `scripts/publish-npm.sh`.
- [x] Require clean `master` for actual publication.
- [x] Verify parity with `origin/master`.
- [x] Verify npm authentication.
- [x] Reject duplicate published versions.
- [x] Pack and inspect the exact tarball before publishing.
- [x] Publish the exact inspected `.tgz`.
- [x] Verify registry propagation.
- [x] Offer annotated Git tag only after publish.
- [x] Keep repository scripts outside the npm package.

## CLI UX

- [x] Add `Cecil-IA Labs · FFmpeg Media Toolkit` headline to help.
- [x] Preserve plain/non-TTY behavior.
- [x] Preserve JSON contracts.
- [x] Cover headline in CLI help tests.

## Quality

- [x] Add `verify:distribution`.
- [x] Add it to `npm run validate`.
- [ ] Run `npm run validate` locally.
- [ ] Exercise `npm run setup:cli` interactively.
- [ ] Exercise `./scripts/publish-npm.sh --dry-run --allow-non-master`.

## Acceptance criterion

A contributor can expose the compiled checkout as `cecilia-ffmpeg` with explicit consent, a public user receives the command through standard npm installation without shell mutation, and a maintainer can publish the exact inspected package artifact from a clean synchronized `master`.
