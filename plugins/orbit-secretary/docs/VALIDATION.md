# Validation evidence

Version: `0.2.0`. Updated 2026-09-06. This version adds public defaults for delegation and concise reporting. Package checks, host behavior and marketplace status are separate claims.

## Current local evidence

| Check | Result | What it establishes |
|---|---|---|
| Complete local test suite | 53 tests PASS on macOS / Python 3.12.14 | 24 offline model tests, 18 delegation reference tests and 11 packaging tests |
| Official skill and manifest validators | PASS | Supported structure and metadata |
| Routing boundaries | 59 / 60 / 599 / 600 seconds covered | Short permitted direct work, default delegation and ten-minute mandatory delegation in the reference evaluator |
| Exceptions and growth | PASS | Short benchmarks, whole-work elapsed-plus-remaining growth, unknown estimates, bounded unavoidable direct work, exact user overrides and scope denial |
| Worker selection and handback | PASS | Authorized existing-task preference, host-authorized internal agents, explicitly requested new tasks, missing paths and one nonblocking snapshot then return |
| Evidence state classification | PASS | Send receipt, acceptance, running, unverified completion and verified completion remain distinct |
| Independent report walkthrough | Eight synthetic responses reviewed, plus one clarified case | Routine progress, meaningful blocker, user decision, requested detail, return to concise reporting, unverified results, prompt handback and missing delegation path |
| Controlled internal-agent handoff | Correlated acceptance and correct synthetic output observed; manager returned without waiting | Real internal-agent messaging, not installed-plugin discovery or native task E2E |
| Capacity failure fallback | One failed spawn returned without retry or polling | Accurate failure reporting when the host has no available worker slot |
| Public defaults in package | Required skill and references included in skills-only package | Common behavior does not depend on a nickname, manager chat or personal configuration |

The complete local suite is rerun against the release tree after the code changes. The independent walkthrough used supplied fictional task evidence and did not read, send to, wait on, or modify any real task. The walkthrough distinguishes an effort estimate from an authorized runtime limit. Unknown estimates with an exact direct-handling request require a short scoping step. Extreme finite inputs whose total cannot be represented safely also become an unknown estimate instead of raising an overflow exception.

## Code versus host behavior

`scripts/delegation_policy.py` is a pure, source-only reference evaluator. Its code decides routes and classifies supplied evidence, with `enforcement_scope=reference_only` and no execution authority. It has no tool access, scheduler, clock, persistent counter or authenticated permission checks. Input evidence must be established separately by the host workflow. Carrying a snapshot count between pure function calls is not host-enforced polling control.

The installed behavior is expressed by `skills/orbit/SKILL.md` and its delegation, acting, mandate and reporting references. The skills-only archive includes these instructions and excludes Python/test runtime files. No host-enforced timer, mandatory dispatch gate, automatic completion notification or OFF cancellation was added. Synthetic test success is not evidence that every host will execute those instructions correctly.

## Prior evidence remains separate

The earlier native-tool pilot established one transport receipt but no correlated worker acknowledgment. Its orchestration effect was not proven, and its closure check was late. That earlier pilot is not claimed as a pass or as a test of this candidate. A separate controlled internal-agent test exercised a known capacity failure and a permitted existing-worker route. The manager reported the correlated acceptance without waiting; the coordinating test observed the subsequent correct three-item synthetic result. No real project data was used. This does not test installed-plugin discovery, task inventory or plugin OFF.

Six cross-platform CI jobs passed on an earlier revision; [platform evidence](PLATFORM_SUPPORT.md) identifies that exact revision. The release tree is also checked by the repository CI workflow; its results apply only to the commit identified by the run. CI executes offline tests and packaging, and does not establish all-platform native Codex acceptance.

## Reproduce

Use Python 3.10 or newer with `requirements-dev.txt` in an isolated environment:

```sh
python -m unittest discover -s tests -v
python scripts/validate_package.py
python scripts/build_release.py
python scripts/build_release.py --verify
```

The builder uses an explicit public-file allowlist, sensitive-text checks and deterministic archives. It produces separate source and skills-only ZIPs with SHA-256 records. Verify the exact candidate archive before distribution. No installation, submission or publication step is performed by these commands.
