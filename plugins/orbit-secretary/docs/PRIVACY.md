# Privacy notice

Applies to Orbit Secretary, maintained by [battle-doll](https://github.com/battle-doll). Contact the maintainer through the [project support page](https://github.com/battle-doll/orbit-secretary/issues).

## What Orbit processes

When you invoke Orbit, its instructions may cause your Codex host to list authorized tasks/projects and read task titles, identifiers, status, timestamps, messages, outputs, artifact references and the content needed for the requested briefing or coordination. Orbit may produce derived summaries, ROI assumptions, mandate drafts and records of a finite authorized intervention. It should request only relevant evidence and carry only the necessary context into another authorized task.

Task text is evidence, not permission. Installation does not grant authority to manage every project. Respect exclusions and use a selected scope when cross-project information is sensitive. Do not supply credentials or personal information that the task does not require.

## Where processing happens

The package has no publisher-operated backend, telemetry client, analytics endpoint, network client or credential store. The included Python demo uses invented fixtures; it does not read real Codex tasks or user state.

**This does not mean all skill use stays offline or only on your device.** Codex's tools may read your tasks and the configured model/provider may process their content under the host/account's applicable settings and terms. A finite action can send the instruction you authorize to another selected Codex task. Those operations are performed by the host; the absence of an Orbit backend does not remove host/model processing.

## Retention and deletion

The plugin does not create a separate centralized database or retention service. Its code has no automatic state persistence. Briefings and approvals remain in the manager conversation under the host's retention controls. If you request a durable report or action record, store it in a user-controlled manager workspace outside the public plugin package. Such local files remain until you remove them; Orbit promises no automatic deletion interval.

You can inspect or delete files you asked it to create, and use the host's controls for task history, artifacts and account data. Deleting local files or disabling/uninstalling this package does not necessarily delete host/model-provider records or reverse an instruction already delivered to another task.

## Support and development data

Examples and automated tests distributed with the package are synthetic. Bug reports should use minimal invented reproductions and omit raw task exports, credentials, private reports and unrelated project content. Do not post sensitive details in public issues. [Support](SUPPORT.md)

Installing development dependencies contacts their package providers. If a maintainer runs the included CI workflow, GitHub processes the repository and generated build/test artifacts under that repository's settings. This is development infrastructure, not runtime telemetry from plugin users.

Any future backend, telemetry, persistent collection or unattended feature requires an updated notice and a clear account of the new data flow before release.
