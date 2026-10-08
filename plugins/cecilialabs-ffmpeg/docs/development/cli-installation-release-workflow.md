# CLI Installation & Release Workflow

This pre-v1 release-hardening layer separates three concerns that should not be conflated: public installation, local contributor linking, and maintainer publication.

## Public users

The public path relies on npm's standard executable mechanism:

```bash
npm install -g @cecilialabs/ffmpeg
cecilia-ffmpeg doctor
```

`package.json` maps `cecilia-ffmpeg` to `./dist/cli.js`. npm owns the executable link. There is no `postinstall` hook that edits shell configuration.

## Repository contributors

```bash
npm run setup:cli
```

The setup is explicitly interactive. It asks before running the build/link flow and asks again before an optional `~/.bashrc` change.

The local link path is:

```text
npm run setup:cli
  -> user consent
  -> npm run link:cli
       -> npm run build
       -> npm link
  -> locate cecilia-ffmpeg in PATH
  -> if already available: stop
  -> otherwise resolve npm global bin
  -> if Bash: ask before ~/.bashrc modification
  -> print source ~/.bashrc guidance
```

The managed Bash block is idempotent so repeated setup does not append duplicate PATH entries.

## Maintainer release

`scripts/publish-npm.sh` is repository-only and is not part of the npm `files` allowlist.

Actual publication is restricted to a clean local `master` equal to `origin/master`:

```text
master parity
  -> npm auth
  -> duplicate version protection
  -> npm run validate
  -> npm pack
  -> inspect exact .tgz
  -> npm publish exact .tgz
  -> verify registry version
  -> offer annotated v<version> Git tag
  -> push tag only after successful publication
```

The exact artifact inspected is the artifact published.

For a non-mutating feature-branch rehearsal:

```bash
./scripts/publish-npm.sh --dry-run --allow-non-master
```

After merge:

```bash
git checkout master
git pull --ff-only
./scripts/publish-npm.sh
```

## npm lifecycle

```text
prepack        -> npm run build
prepublishOnly -> npm run validate
```

`prepack` guarantees `dist/` exists in generated tarballs. `prepublishOnly` preserves the complete repository validation gate for direct npm publication.

## CLI identity

Human help begins with:

```text
Cecil-IA Labs · FFmpeg Media Toolkit
```

The headline is presentation-only. JSON output and media operation contracts are unchanged.
