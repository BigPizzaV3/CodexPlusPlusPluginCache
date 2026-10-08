# Security

Report a suspected vulnerability privately through [QuarryFi support](https://quarryfi.com/support). Do not include tracker keys, customer data, source code, or exploit details in a public GitHub issue.

## Data and network boundary

The released plugin sends tracker requests only to `https://quarryfi.com` over HTTPS with TLS 1.2 or newer. Legacy custom `api_url` fields are ignored so a modified local config cannot redirect a seat credential.

The tracker may send timestamps, duration, project name, branch, language, file type, Git commit SHA, a one-way repository fingerprint, changed-file count, coarse activity category, and plugin runtime diagnostics. It does not send source code, diffs, prompts, commands, command output, file contents, filenames, local paths, raw repository URLs, or AI responses.

Seat keys are stored in `~/.quarryfi/config.json`, which setup creates with owner-only permissions. Never paste a key into a Codex conversation, issue, log excerpt, or support message. Revoke and replace any key that may have been exposed. After uninstalling the tracker, deleting `~/.quarryfi/` removes its saved keys, bounded audit log, and session state from the device.

The public privacy policy and terms are available at [quarryfi.com/privacy](https://quarryfi.com/privacy) and [quarryfi.com/terms](https://quarryfi.com/terms).
