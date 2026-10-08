# First-use media setup

The media setup playbook is bundled with this skill. No separate "FFmpeg skill"
is needed. The operating-system executables `ffmpeg` AND `ffprobe` must be
available in the environment running TidyGuardian for the full media workflow.
A Python package named ffmpeg is not a substitute. No binaries or installers are
vendored, downloaded or executed by this setup module.

## Mandatory first step for agents

Before inventory, classification, previews or any file-operation workflow, run:

```bash
python3 <skill-directory>/scripts/tidyguardian.py setup --check --json
```

Use the actual installed skill directory. From the repository root it is
`tidyguardian/scripts/tidyguardian.py`. Python 3.10+ and local terminal access
are required. If this chat has no local terminal access, explain that you cannot
inspect the user's computer and ask them to run the command locally. Do not
report a browser or cloud sandbox's results as the user's laptop's state.

Exit 0 means both executables returned a successful version banner. Exit 3
means missing or unusable tools; show each status, the detected OS/CPU and the
execution context, then offer the following choices. Exit 2 is a setup error.
Do not interpret a printed installation command as having been executed.

### Full media setup (recommended)

Run `python3 <skill-directory>/scripts/tidyguardian.py setup` in a real terminal.
The wizard offers **T** (terminal instructions), **B** (open the FFmpeg download
page), **R** (recheck), **C** (explicitly choose basic mode), and **Q** (cancel).
B opens a browser only after the user chooses it; it does not download, unpack
or install anything. No interactive terminal means check/report only, not a
hidden installer or an unbounded wait for input.

For a chat-based agent, present the browser and terminal routes directly to the
user. The user personally runs an installer in a separate terminal, reviews the
package changes and licenses, and enters any administrator password there,
never in chat. Do not run package installation, bootstrap a package manager,
add repositories, elevate privileges or modify shell profiles without separate
explicit user approval. This bundled wizard deliberately delegates installation
to the user; it does not contain an auto-install command.

Current guidance, verified against publisher documentation:

| Environment | Suggested route |
| --- | --- |
| macOS with Homebrew already available | `brew install ffmpeg` |
| macOS without Homebrew | FFmpeg's macOS downloads, or separately review Homebrew installation at its official site |
| Windows with WinGet | `winget install --name "FFmpeg (Essentials Build)" --exact --source winget` |
| Windows without WinGet | Choose a Windows build linked from FFmpeg's official download page |
| Debian/Ubuntu with apt-get | `sudo apt-get update`, then `sudo apt-get install ffmpeg` |
| Other Linux, unsupported OS or missing package manager | Use FFmpeg's official download index and the distribution's documentation; do not guess a command |

Package availability, minimum OS versions, architecture support and licenses
can change. FFmpeg itself publishes source and links to third-party compiled
builds. Review the publisher and follow checksum/signature instructions. Do not
bypass operating-system security warnings, substitute a random download mirror,
use `curl | sh`, suppress package-manager prompts or auto-accept agreements.
The wizard never silently uninstalls, upgrades or overwrites an existing tool.

After installation, rerun `setup --check --json` or choose R. Reopen the terminal
or restart the agent if the installer changed PATH; an already-running process
may not inherit the new environment. Do not mark setup complete merely because
an installer returned success or a binary filename exists. Both tools must run.
The version check is an availability check, not cryptographic publisher
verification or a promise that every codec/file will decode.

### Explicit basic-mode opt-out

Full media setup is the default onboarding path. Never silently skip it. When
the user explicitly declines installation, C or this command records basic mode:

```bash
python3 <skill-directory>/scripts/tidyguardian.py setup --basic
```

Basic mode allows core inventory, planning and authorized file workflows without
media tools. `thumbnails` and `catalog --media-dates` still require both tools and
cannot use this opt-out. Pillow image EXIF remains separately optional. A failed
preview never means a file is disposable.

The small preference lives under the user's application config directory,
scoped to host, platform, CPU and Python executable. It is not stored in the
source folder. Existing, corrupt or linked preference files are not overwritten.
If saving is unavailable, the choice applies only to that interactive invocation;
repeat the choice when needed. Read-only `--check`, `--json` and `doctor` do not
write preferences or launch a browser. `setup` can always be rerun to revisit
installation. Every operational command checks the current executables again;
readiness is never cached. A saved basic-mode choice never enables previews or
authorizes a file operation. Installing both tools automatically makes the media
path available on the next check, regardless of a prior basic-mode preference.

## Permissions and execution environments

Installing software is separate from permission to scan, move, quarantine or
restore files. Every existing file-safety gate remains in effect. Never simulate
user confirmation, pipe answers or create a pseudo-terminal to approve an action.
Do not copy a basic-mode preference to other users or machines to skip onboarding.

SSH, WSL, containers and CI are identified when detectable, but absence of those
signals does not prove a physical local computer. Install only in the environment
that will run the skill. An install inside a cloud container does not install
FFmpeg on the user's Mac or Windows laptop. No user media is opened or uploaded
by setup. External requests happen only when the user opens a browser or runs
an installer.

## Sources

- FFmpeg download index: https://ffmpeg.org/download.html
- Homebrew FFmpeg formula and bundled executables: https://formulae.brew.sh/formula/ffmpeg
- Homebrew: https://brew.sh/
- Gyan Windows builds and package-manager names: https://www.gyan.dev/ffmpeg/builds/
- Microsoft WinGet install options and agreement prompts: https://learn.microsoft.com/windows/package-manager/winget/install
- Debian package information: https://packages.debian.org/stable/ffmpeg

These are installation references, not network endpoints contacted by a check.
