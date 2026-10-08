# Platform Support & Release Validation

Milestone 25 introduces explicit platform evidence for the v2 release line.

## Support matrix

| Platform | Runtime | FFmpeg integration | Release gate |
|---|---|---|---|
| Linux | Node.js >=22 | FFmpeg/FFprobe >=6.1 | full `validate:release` + release smoke |
| macOS | Node.js >=22 | FFmpeg/FFprobe >=6.1, AVFoundation capture | build + release contract + clean install + release smoke |
| Windows | Node.js >=22 | FFmpeg/FFprobe >=6.1, DirectShow capture | build + release contract + clean install + release smoke |

## Linux

Linux remains the primary full-validation platform. The release workflow runs
the complete test, fixture, packaging, v2 release-contract, clean-install, and
real environment/media/CLI/Skill smoke gates.

## macOS

The macOS release smoke validates:

- dependency installation;
- TypeScript build;
- v2 release contract;
- clean npm tarball installation;
- package import and direct `cecilia-ffmpeg` executable;
- CLI help/version and `doctor --json` with FFmpeg and FFprobe installed;
- a real generated-media trim and namespaced pipeline smoke.

Camera hardware is not available on hosted CI, so AVFoundation device capture is not exercised there.

## Windows

The Windows strategy uses native Node/npm behavior and the npm-generated `.cmd` executable shim. The smoke validates:

- dependency installation;
- TypeScript build;
- v2 release contract;
- clean npm tarball installation;
- package import and `cecilia-ffmpeg.cmd` invocation;
- CLI help/version and `doctor --json` with FFmpeg and FFprobe installed;
- a real generated-media trim and namespaced pipeline smoke.

DirectShow camera hardware is not available on hosted CI. Live device capture and external streaming receivers therefore remain environment-specific integration concerns rather than release-smoke requirements.

## GitHub Actions

`.github/workflows/v2-release-validation.yml` provides:

1. a full Linux v2 release-validation job;
2. macOS and Windows release-smoke jobs;
3. manual `workflow_dispatch` support for release rehearsals.

A workflow definition is not itself validation evidence. Record successful v2
workflow runs before publishing the package or creating the release tag.
