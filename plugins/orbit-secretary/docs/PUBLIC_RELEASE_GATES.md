# Current release scope and future unattended requirements

This document defines the scope of **0.2.0** and separates its recorded evidence from requirements for a possible future unattended edition. It is a technical release reference, not a live publication-status report.

## What 0.2.0 includes

| Component | Scope |
|---|---|
| Installed skill and references | Concise briefings, direction and ROI discussion, and finite, explicitly authorized delegation through available Codex host tools. |
| Manager behavior | Quick answers and status stay with the manager; benchmarks and longer work follow the documented delegation policy. After dispatch, the manager briefly reports known receipt or start evidence and returns to the user. |
| Source-only reference evaluator | Deterministic routing and evidence classification for supplied inputs. It has no host permissions, native dispatch enforcement, timer or scheduler. |
| Unattended operation and hard OFF | Not included. No recurring supervisor, guaranteed cancellation of in-flight turns, retraction of delivered messages or reversal of completed work is provided. |

The [public scope](PUBLIC_SCOPE.md) and current skill describe the product. Normal use does not depend on users running acceptance experiments or validating the release. Packaging, evidence review and publication checks remain the maintainer's responsibility.

## Recorded evidence and its limits

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| Recorded macOS local suite: 53 tests PASS on Python 3.12.14 | Offline model, delegation-reference and packaging cases described in [Validation](VALIDATION.md). | Complete native Codex acceptance or results for every subsequent tree change. |
| Six prior cross-platform CI jobs | Offline/package execution at the exact revision recorded in [Platform support](PLATFORM_SUPPORT.md). | A CI pass for any revision other than the one identified in that record. |
| Earlier native-tool pilot | One transport receipt, without a correlated worker acknowledgment. | Proven orchestration effect or completed host acceptance. |
| Bounded internal-agent check | A clear capacity error returned without retry; a separate follow-up to an existing worker produced a correlated acknowledgment, manager handback and subsequently checked synthetic results. | Installed-plugin E2E, unattended supervision or acceptance on every host. |

Installation, task-tool availability, delivery evidence and task completion are distinct observations. The current release makes no all-platform native Codex E2E claim. A source evaluator's result is not an authenticated permission decision or a host-enforced execution gate.

## Future unattended edition only

The requirements below apply to a possible future unattended product. They are not hidden features of 0.2.0 and do not require end users to perform tests.

| Future capability | Evidence the implementation would need |
|---|---|
| Host-owned revocation | No new secretary read, evaluation, report, notification or dispatch after the host acknowledges disablement; local flags and cached instructions are insufficient. |
| Schedule cleanup | No residual wakeup or automatic reactivation after disablement, restart or reinstall. |
| Bounded cancellation | Defined cancellation of secretary-owned work, with unrelated user work preserved and already completed effects kept distinct. |
| Dispatch reconciliation | Unknown sends reconciled without blind retries or duplicate instructions. |
| Concurrent management | One authorized writer per target, current mandates and bounded budgets across overlapping runs. |
| Direction changes and user decisions | Stale goals rejected and user-only approvals never substituted by the manager. |
| Durable collection and metering | Disclosed storage, retention and deletion behavior, plus measured usage rather than invented account-wide costs. |

A future host would need to enforce revocation at the execution boundary before acknowledging OFF as complete. The relevant instant is the host's disable acknowledgment, not a later plugin poll. Completed effects cannot be retroactively undone. These requirements need implementation and host evidence before an unattended edition can claim them.

## Publication and data handling

Release review binds the submitted artifact to its version, source content and recorded checksum. Historical evidence retains its exact revision and is not relabeled as a result for a newer build. A source repository's public visibility and a plugin's portal publication remain separate states.

Only allowlisted public material belongs in release archives. Private manager records, real task transcripts, credentials, personal paths, submission drafts and unrelated historical configurations remain outside the package. Public examples are synthetic. Host and model processing are described in [Privacy](PRIVACY.md), and user-facing help is described in [Support](SUPPORT.md).

This document replaces the former 0.1 design-preview checklist as the current release-scope reference. It does not change the limited OFF behavior or authorize unattended execution.
