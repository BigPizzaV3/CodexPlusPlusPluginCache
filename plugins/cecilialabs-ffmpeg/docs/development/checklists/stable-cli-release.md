# Stable CLI Release — Completion Checklist

**Target:** `v1.0.0`  
**Status:** ✅ Released 2026-09-20

## Stable contract

- [x] Freeze npm package, plugin, executable, Node, FFmpeg and license identities.
- [x] Freeze global CLI option and top-level command contract.
- [x] Synchronize package/plugin/source/lockfile version to `1.0.0`.
- [x] Establish stable semantic-version format.
- [x] Add public npm publish configuration.
- [x] Add `verify:release`.
- [x] Add `validate:release`.
- [x] Make npm publication use the release validation gate.

## Compatibility

- [x] Confirm CLI architecture is stable under full validation.
- [x] Confirm core/public package APIs are stable.
- [x] Preserve all 21 historical migration mappings.
- [x] Run all seven Skill validations under the v1 release gate.
- [x] Confirm plugin installation from the packed artifact.
- [x] Confirm no runtime dependency on historical `.sh` implementations.

## Platform evidence

- [x] Linux full release validation.
- [ ] macOS smoke test. *(deferred after release; automated workflow retained)*
- [ ] Windows smoke test and documented strategy. *(strategy documented; runtime smoke deferred after release)*

## Distribution evidence

- [x] Clean installation from generated `.tgz`.
- [x] Verify `cecilia-ffmpeg --version` from clean install.
- [x] Verify `cecilia-ffmpeg --help` from clean install.
- [x] Final npm package contents inspected.
- [x] Final publication dry-run.
- [x] npm package ready for public publication.

## Release documentation

- [x] Final README review.
- [x] Final installation guide review.
- [x] Final changelog review.
- [x] Record platform validation evidence.
- [x] Mark roadmap release requirements complete.

## Final release

- [x] `npm run validate:release`.
- [x] Merge Milestone 15.
- [x] Publish `@cecilialabs/ffmpeg@1.0.0`.
- [x] Verify npm registry.
- [x] Create/push `v1.0.0` annotated Git tag after registry verification.


## Release evidence

- Linux release gate passed with 46 test files / 140 tests.
- 22 deterministic media fixtures were validated with FFprobe.
- All 21 historical migration regressions passed.
- All seven Skills validated.
- Clean installation from the generated npm tarball passed.
- Production dependency audit: `npm audit --omit=dev` reported 0 vulnerabilities.
- `@cecilialabs/ffmpeg@1.0.0` was published successfully to npm.
- GitHub Release `v1.0.0` was created after npm publication.
