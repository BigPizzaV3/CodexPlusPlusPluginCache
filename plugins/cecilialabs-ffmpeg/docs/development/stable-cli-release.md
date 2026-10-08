# Stable CLI Release — v1.0.0

Milestone 15 converts the mature pre-v1 toolkit into a stable release. It does not introduce a new media domain.

## Frozen identities

- npm package: `@cecilialabs/ffmpeg`
- plugin: `ffmpeg-media-toolkit`
- executable: `cecilia-ffmpeg`
- package entrypoint: `.`
- Node.js: `>=22.0.0`
- FFmpeg: `>=6.1`
- license: MIT

The machine-readable source of truth is `specs/stable-release-contract.json`.

## Stability policy

For v1:

- existing command paths and global flags are compatibility-sensitive;
- existing package exports are compatibility-sensitive;
- structured JSON output must remain machine-consumable;
- compatibility aliases remain available unless removed in a future semver-major release;
- historical Bash script identifiers remain regression/migration references only and are never runtime dependencies;
- new media capabilities are deferred unless required to resolve a release blocker.

## Validation layers

Regular development validation:

```bash
npm run validate
```

Release validation:

```bash
npm run validate:release
```

The release gate adds stable identity/version/CLI/Skill/migration/runtime checks on top of the complete pre-v1 suite.

## Semantic versioning

The v1 line follows standard semantic versioning:

- patch: compatible fixes;
- minor: backward-compatible capabilities;
- major: intentional public CLI/API breaking changes.

The stable release verifier requires a plain `MAJOR.MINOR.PATCH` version for the v1 release artifact.

## Remaining release evidence

Milestone 15 still requires execution evidence for:

- clean tarball installation;
- Linux full release validation;
- macOS smoke validation;
- Windows smoke/strategy validation;
- final npm pack inspection;
- final README/changelog review;
- actual registry publication and post-publish Git tag.

A requirement is not complete merely because a script or workflow exists; execution evidence is required.
