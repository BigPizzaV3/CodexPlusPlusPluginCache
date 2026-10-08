# Installation

## Recommended global CLI installation

Install the package globally when you want the canonical `cecilia-ffmpeg` command to be available directly from the shell:

```bash
npm install -g @cecilialabs/ffmpeg
```

Then run:

```bash
cecilia-ffmpeg --help
cecilia-ffmpeg doctor
cecilia-ffmpeg environment capabilities --json
```

The executables are provided by the package `bin` mapping:

```json
{
  "bin": {
    "cecilia-ffmpeg": "./dist/cli.js"
  }
}
```

`cecilia-ffmpeg` is the human/automation CLI and the canonical executable for agent workflows.

Use [Agent workflows](agent-workflows.md) when an assistant also needs to
choose an execution context or an associated Skill script.

npm creates the executable link automatically. The package deliberately has **no `postinstall` shell mutation**.

## Run without installing globally

Package-runner usage names the CLI executable explicitly:

```bash
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg doctor
```

Or install as a project dependency:

```bash
npm install @cecilialabs/ffmpeg
npm exec -- cecilia-ffmpeg doctor
```

All subsequent CLI examples in the public documentation assume the recommended global installation and therefore use `cecilia-ffmpeg ...` directly.

## Local development checkout

Repository contributors can expose the compiled checkout as a global command without installing the published package:

```bash
npm run setup:cli
```

The interactive setup asks for permission before it:

1. builds the TypeScript project;
2. runs the local npm link flow;
3. checks whether `cecilia-ffmpeg` is already in `PATH`;
4. only if necessary, offers to add the npm global bin directory to `~/.bashrc`.

The shell modification is explicit, opt-in, Bash-specific, and written as an idempotent managed block. If the npm global bin directory is already in `PATH`, `~/.bashrc` is not changed.

Equivalent manual development commands:

```bash
npm run build
npm link
cecilia-ffmpeg --help
```

Remove the development link with:

```bash
npm run unlink:cli
```

## Runtime requirements

- Node.js: `>=22.0.0`
- minimum supported FFmpeg: `6.1`
- FFprobe is required for media inspection and output validation

Binary resolution follows the configured environment unless overridden:

```bash
cecilia-ffmpeg doctor \
  --ffmpeg-path /opt/ffmpeg/bin/ffmpeg \
  --ffprobe-path /opt/ffmpeg/bin/ffprobe
```

## Verify the environment

```bash
cecilia-ffmpeg environment check --json
cecilia-ffmpeg doctor
cecilia-ffmpeg environment capabilities --json
```

`environment check` is the agent-facing read-only onboarding flow. It reports
the observed execution context, Node.js/npm, toolkit resolution, FFmpeg and
FFprobe paths/versions, capabilities, and optional output-path writability.
It does not install packages or edit shell startup files. In a regular Chat
context it returns the exact commands to copy into a Work/Codex/IDE/terminal
environment.

The toolkit installation flow is explicit and reversible:

```bash
cecilia-ffmpeg environment install global --json
cecilia-ffmpeg environment install local --apply --authorize --json
cecilia-ffmpeg environment install npm-exec --apply --authorize --json
```

The first command is a plan. `--apply --authorize` is required for npm to run;
the flow supports global, local, and ephemeral `npm exec` use and never
installs system FFmpeg packages or mutates a shell startup file. Repeat the
check after installation. In v1.2, hardware encoding selection performs an
additional runtime usability probe before choosing an accelerator; capability
discovery alone still does not prove that a device is usable.

For a repository checkout, build before invoking a Skill-associated script:

```bash
npm install
npm run build
printf '%s\n' '{"context":"codex","input":{}}' \
  | node skills/ffmpeg-onboarding/scripts/check.mjs
```

## Packaging and release lifecycle

`npm pack` invokes:

```text
prepack -> npm run build
```

Publication retains the existing quality gate:

```text
prepublishOnly -> npm run validate:release
```

Repository maintainers also have `scripts/publish-npm.sh`, which is intentionally excluded from the npm package. Its release flow is:

```text
clean master
  -> origin/master parity
  -> npm authentication
  -> duplicate-version check
  -> npm run validate:release
  -> npm pack
  -> tarball inspection
  -> npm publish
  -> registry verification
  -> optional annotated Git tag + push
```

Dry-run from a feature branch:

```bash
./scripts/publish-npm.sh --dry-run --allow-non-master
```

Actual publication is restricted to a clean `master` matching `origin/master`:

```bash
./scripts/publish-npm.sh
```

## Plugin distribution

The npm package also contains the Agent Plugin manifest, Skills, assets, specs, and documentation. Repository-only setup, test, and release scripts are not shipped in the npm tarball.

Installing the npm runtime does not automatically activate the plugin in an
agent host. Complete the two surfaces separately:

1. Build the plugin archive with `npm run pack:openai-plugin`.
2. Import or upload `.openai-pack/cecilialabs-ffmpeg-openai-v2.0.0.zip` through
   the plugin host's supported installation flow.
3. Confirm that `plugin.json` exposes the ten Skill entries and that the host
   lists them.
4. From the extracted plugin root, run the onboarding script and inspect its
   one-line JSON envelope:

```bash
printf '%s\n' '{"context":"codex","input":{}}' \
  | node cecilialabs-ffmpeg/skills/ffmpeg-onboarding/scripts/check.mjs
```

The archive includes `dist/`, `skills/`, `docs/`, `README.md`, and every
manifest-referenced asset, so the associated scripts can start from the
extracted plugin without relying on a checkout or a globally linked CLI. A
diagnostic that returns `output.status: "blocked"` or `"warning"` proves that
the check ran, not that media execution is ready; remediate and repeat it
until `output.status: "ready"`.

## Platform notes

Linux is the full release-validation platform for v2. macOS and Windows
receive clean-install plus real environment/media/CLI/Skill smoke validation in
the release workflow. Camera capture uses V4L2 on Linux, AVFoundation on
macOS, and DirectShow on Windows when selected.

Platform-specific FFmpeg installation is intentionally outside the toolkit's runtime responsibility.

See [Platform support & release validation](platform-support.md) for the v2 test matrix and hosted-CI limitations.
