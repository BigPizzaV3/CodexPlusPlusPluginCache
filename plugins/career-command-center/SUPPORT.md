# Support

Career Command Center is supported through GitHub Issues:

https://github.com/mrizaarseven98/career-command-center/issues

Before opening an issue, run this from a Codex task that has access to your career workspace:

```text
Diagnose Career Command Center and summarize any blockers without changing my documents.
```

The diagnostic checks the workspace structure, configuration, evidence readiness, registered master CVs, lead state, and automation synchronization.

## Include in a Report

- macOS version and Mac processor type.
- Codex surface used, such as desktop or CLI.
- Plugin and app version.
- The diagnostic summary with personal paths and personal information removed.
- Exact steps that caused the problem.

Do not attach CVs, transcripts, access tokens, private job-portal links, or other sensitive documents to a public issue.

## Common Problems

### The app is blocked on first launch

The bundled app is locally signed and is not distributed through the Mac App Store. Control-click `Career Command Center.app` in `~/Applications`, choose **Open**, and confirm once.

### macOS says the app executable is missing

Install Career Command Center 1.2.1 or later, start a new Codex task, and ask:

```text
Update my Career Command Center app and connect it to this workspace.
```

The installer repairs transfer-sensitive executable permissions and verifies the app before launch. A manual source rebuild should not be needed.

### The app opens the wrong workspace

Ask Codex to reinstall the companion app for the current project:

```text
Update my Career Command Center app and connect it to this workspace.
```

### Search settings show Sync needed

Ask Codex:

```text
Sync my Career Command Center automation settings.
```

### Personalized questions do not appear

Confirm that CVs or project files were imported, then use the **Audit in Codex** action under **Questions**. If Codex already completed the audit, press the refresh button in that workspace. Run the diagnostic if the queue still does not load; it validates `Evidence_Bank/personalized_questions.json` and reports malformed or unresolved records.

### Answers remain ready for review

Use **Review in Codex** from the Questions workspace. Saving an answer does not approve it automatically. Codex checks the cited source, updates verified evidence, and records whether the detail was accepted, excluded, or replaced by a narrower follow-up.

### A deleted opportunity returns

Run the diagnostic. Permanent deletion should retain a minimal tombstone that prevents rediscovery.

## Security Reports

For a potential security issue, do not post private data or exploit details in a public issue. Open a minimal issue asking for a private reporting channel.
