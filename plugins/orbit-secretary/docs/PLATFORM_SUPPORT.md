# Platform support

Version **0.2.0** provides manager-routing and concise-reporting defaults through skill instructions, with a source-only reference evaluator. Platform targets, revision-specific automated checks and native-host acceptance are separate claims.

| Component | macOS | Windows | Linux |
|---|---|---|---|
| Native Codex host acceptance | Earlier limited tool pilot; full 0.2.0 acceptance is not established | Target platform; host E2E not verified | Target platform; host E2E not verified |
| Prior-revision offline/package CI | PASS at `523b092`, Python 3.10 and 3.14 | PASS at `523b092`, Python 3.10 and 3.14 | PASS at `523b092`, Python 3.10 and 3.14 on Ubuntu |
| Recorded local and host evidence | 53 local tests PASS on Python 3.12.14; bounded internal-agent evidence is described in [Validation](VALIDATION.md) | Automated evidence is revision-specific; no native-host E2E claim | Automated evidence is revision-specific; no native-host E2E claim |
| Observe / Discuss / finite authorized Act | Requires the current host's callable task tools | Same capability requirement; OS support alone does not imply tool availability | Same capability requirement; OS support alone does not imply tool availability |
| Unattended scheduling and complete OFF cancellation | Not provided | Not provided | Not provided |

The skill itself does not install or require Python. The separate source archive uses Python 3.10 or later plus IANA timezone data. CI covers the minimum interpreter, Python 3.10, and Python 3.14 on `ubuntu-latest`, `macos-latest` and `windows-latest`. Intermediate Python versions are compatibility targets, not individually verified by that matrix. Runner labels and host product versions can change.

## Historical automated matrix at the identified revision

[GitHub Actions run 33975743031](https://github.com/battle-doll/orbit-secretary/actions/runs/33975743031) completed successfully on 2026-09-05 UTC for source revision `523b09270f94d6b9732704259a3c6dd465594228`. All six jobs and their validation steps were inspected; this evidence applies to that revision, not automatically to subsequent changes.

| Actual job | Result | Job ID |
|---|---|---|
| `macos-latest / Python 3.10` | PASS | `101332002223` |
| `macos-latest / Python 3.14` | PASS | `101332002353` |
| `windows-latest / Python 3.10` | PASS | `101332002405` |
| `windows-latest / Python 3.14` | PASS | `101332002508` |
| `ubuntu-latest / Python 3.10` | PASS | `101332002373` |
| `ubuntu-latest / Python 3.14` | PASS | `101332002410` |

Each job passed package scope/syntax/link validation, synthetic and packaging tests, the offline-only demonstration, deterministic source and skills-only archive builds, and archive/checksum verification. Review artifacts were retained without publishing a release.

These historical checks executed offline utilities and packaging on the three runner operating systems. They do not establish results for any other source revision. They did not exercise native Codex task discovery, skill routing, message dispatch, receipts, user permissions or plugin OFF behavior. Windows and Linux host E2E remain unverified, and the macOS local pilot does not complete host acceptance. No all-platform native Codex E2E PASS is claimed.

## Maintainer development setup

This optional source-development workflow is for contributors; using the installed skill does not require it. From the source package directory, use an isolated virtual environment:

```sh
python -m venv .venv
```

Activate it with `.venv/bin/activate` on macOS/Linux or `.venv\Scripts\Activate.ps1` in Windows PowerShell. If activation is restricted, call that environment's Python executable directly. Then:

```sh
python -m pip install -r requirements-dev.txt
python scripts/validate_package.py
python -m unittest discover -s tests -v
python scripts/offline_core.py demo
python scripts/build_release.py
python scripts/build_release.py --verify
```

The pinned development dependencies are PyYAML for YAML validation and `tzdata` for timezone rules. Python's `zoneinfo` uses system timezone data when present and otherwise the first-party `tzdata` package; Windows commonly needs that package. CI sets `PYTHONTZPATH` to an empty string so all three operating systems use the pinned package. [Python zoneinfo documentation](https://docs.python.org/3/library/zoneinfo.html), [tzdata distribution](https://pypi.org/project/tzdata/), [PyYAML distribution](https://pypi.org/project/PyYAML/)

Dependency installation and GitHub Actions use their providers' network services. Orbit's offline model, local validation and builder make no network calls. The workflow uploads only generated review archives/checksums to the repository's CI artifact storage for seven days; it does not publish a GitHub release or submit a plugin.

## Reproducible archives

The builder reads an explicit public-file allowlist. It excludes private manager state, local audit material, environment files, credentials, raw task/session archives, Git history, submission drafts and existing `dist` output. It rejects symlinks, suspicious credential patterns and absolute user-directory paths in included text. This targeted scan supplements review; it is not a proof that arbitrary sensitive content can be detected.

Both source and skills-only plugin ZIPs contain a root `.codex-plugin/plugin.json`. The skills-only archive excludes Python scripts/tests/CI configuration. ZIP member order, file modes, timestamps and storage method are fixed, and text line endings normalize to LF. `SHA256SUMS` and `build-info.json` describe the resulting files. Running `--verify` compares the archives with their checksums and current allowlisted source. No credentials, installation or publication are needed.

Source and skills-only archives intentionally have different README content. Their scope is the same: manually invoked work and finite, explicitly authorized coordination through available host tools. Neither archive implements a persistent supervisor.

## Capability limits

When task listing or reading is unavailable, Orbit reports the gap and uses supplied evidence. Partial inventories stay partial. When an authorized delegation route is unavailable, it prepares a handoff instead of taking on long direct work. If a nonblocking status tool is unavailable after a permitted send, it returns the receipt with any remaining uncertainty; it does not require or substitute a long wait. Access to a tool in one development session does not establish availability on another installation.

Disabling the plugin prevents future normal discovery according to the host's behavior. It does not undo completed instructions, retract messages or prove cancellation of already running user work. Version 0.2.0 does not provide verified unattended operation or complete cancellation on OFF. See [Public scope](PUBLIC_SCOPE.md).

The 0.2.0 manager routing and concise-report defaults are carried in skill instructions on every platform. The source-only delegation reference evaluator does not add a runtime dependency to the skills-only package, enforce native task routing, or establish new all-platform host evidence.
