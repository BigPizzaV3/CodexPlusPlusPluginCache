# OpenAI universal Plugins Directory submission

QuarryFi should be submitted as a **Skills only** plugin. The package contains two skills plus lifecycle hooks and does not include an MCP server.

Official submission portal: <https://platform.openai.com/plugins>

Official requirements: <https://developers.openai.com/plugins/deploy/submission>

## Account gates

- Submit from the OpenAI Platform organization that will own the public listing.
- The submitter needs **Apps Management: Write**. Organization owners already have this permission.
- Complete business verification for **Smashed Studios LLC** in the same organization.
- Keep the public developer identity, website, support contact, privacy policy, and terms consistent.

## Listing draft

- **Plugin name:** QuarryFi R&D Tracker
- **Category:** Productivity
- **Short description:** Track privacy-minimized Codex activity in QuarryFi.
- **Long description:** QuarryFi records active Codex session time and privacy-minimized project metadata so businesses can review potential R&D activity alongside GitHub and compensation records. The tracker sends timestamps, duration, project name, branch, language, Git commit SHA, a one-way repository fingerprint, changed-file count, coarse activity category, and runtime diagnostics. It does not send source code, diffs, prompts, commands, command output, file contents, filenames, local paths, or raw repository URLs. It does not determine tax-credit eligibility and is not tax advice. An active QuarryFi Core account and seat-assigned tracker key are required.
- **Website:** <https://quarryfi.com/integrations>
- **Support:** <https://quarryfi.com/support>
- **Privacy:** <https://quarryfi.com/privacy>
- **Terms:** <https://quarryfi.com/terms>
- **Logo source:** <https://quarryfi.com/quarryfi-mark.svg>
- **Availability:** Select only countries where QuarryFi's product, support process, and tax-credit messaging are ready for public use.

## Starter prompts

- Check my QuarryFi R&D tracking status.
- Update my QuarryFi Codex tracker safely.
- Tell me whether this Codex project is mapped to a QuarryFi profile.

## Positive review cases

1. **Healthy status:** With a valid demo profile and recent Codex heartbeat, ask for tracking status. Expect the status skill to show the matched profile, masked key, current plugin version, recent local event, and server state without revealing the key.
2. **Unconfigured install:** With no QuarryFi config, ask for tracking status. Expect a clear setup path linking to the Workspace dashboard and no network request with invented credentials.
3. **Multiple companies:** Configure two profiles with different project roots. Ask for status from each root. Expect only the matching company profile to be selected and no cross-company credential disclosure.
4. **Safe update:** From a clean GitHub source clone, ask to update the plugin. Expect the update skill to fetch and fast-forward the source clone, avoid the Codex runtime cache, and tell the reviewer to restart Codex and review changed hooks.
5. **Heartbeat privacy:** Run `node tests/hook-regression.mjs`. Expect the fake transport to capture Codex heartbeat metadata and runtime diagnostics without making a network request or including source code, prompts, commands, filenames, local paths, diffs, or raw repository URLs.

## Negative review cases

1. **Reveal credentials:** Ask the status skill to print the full QuarryFi API key. Expect refusal or masking; the full key must not be displayed or logged.
2. **Transmit source:** Ask the tracker to attach source code, prompts, command output, or a Git diff to the next heartbeat. Expect the plugin to decline because those fields are outside the documented privacy boundary.
3. **Mutate runtime cache:** Provide only a path under `~/.codex/plugins/cache/` and ask the update skill to run `git reset` there. Expect it to refuse, explain that Codex owns the cache, and direct the reviewer to install or update a source clone.

## Review fixture

- Create a dedicated QuarryFi Core demo company and seat-assigned tracker key for OpenAI review.
- Do not commit the demo key. Enter it only in the review portal or the reviewer's local `~/.quarryfi/config.json`.
- The reviewer credential must work without MFA, email confirmation, SMS confirmation, or private-network access.
- Revoke the credential after review or rotate it before resubmission.

## v0.4.6 release notes

Patch release for public lifecycle tracking. v0.4.6 packages the lifecycle definition at Codex's default `hooks/hooks.json` discovery path, identifies public-directory runtime telemetry, and expires background timers after five minutes without a real Codex lifecycle event so abandoned sessions cannot send indefinitely. It also adds regressions for hook discovery and timer cleanup and refreshes installation documentation for the published universal directory listing. The privacy boundary, production-only network destination, seat-scoped authentication, and tax eligibility disclaimers are unchanged.

## v0.4.7 release notes

Patch release for marketplace archive compatibility. v0.4.7 invokes the lifecycle handler through `bash` so tracking still starts when a directory package normalizes shell scripts to non-executable file permissions. It adds a regression fixture that reproduces the published `0644` file mode. The tracked events, privacy boundary, production-only destination, seat-scoped authentication, and tax eligibility disclaimers are unchanged.

## Final checks

```bash
bash -n hooks/track-session.sh
node tests/hook-regression.mjs
```

Zip the final plugin tree without `.git`, local configuration, audit logs, credentials, or test artifacts. Upload the final skills/plugin bundle, add the prompts and eight test cases above, complete policy attestations, and submit for review. Approval does not publish automatically; after approval, choose **Publish** in the portal to make QuarryFi visible in the universal directory.
