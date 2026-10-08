# Codex TestFlight Release

An Agent Plugins v1-compatible skill package, with Codex marketplace metadata, for automating iOS TestFlight releases without opening Xcode UI.

The portable package is defined by the root [`plugin.json`](./plugin.json) and the skill under `skills/`. The [`.codex-plugin/plugin.json`](./.codex-plugin/plugin.json) and [`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json) files are retained as Codex marketplace compatibility metadata.

It helps Codex:

- bump the iOS build number,
- create an Xcode archive,
- upload to App Store Connect through an API key,
- verify the uploaded build,
- keep `No encryption` export compliance in the app Info.plist,
- set TestFlight `What to Test` text through App Store Connect API.
- optionally assign the build to a named external TestFlight group and submit it for Beta App Review.

## Install from the Codex GitHub marketplace

Codex can install plugin marketplaces from GitHub repositories. Add this repo as a marketplace:

```bash
codex plugin marketplace add michalcilek/codex-testflight-release
```

Then restart Codex, open Plugins, and install **Codex TestFlight Release**.

To refresh later:

```bash
codex plugin marketplace upgrade codex-testflight-release
```

## Agent Plugins v1

This repository follows the portable [Agent Plugins Specification 1.0.0](https://agent-plugins.org/specification):

- the root `plugin.json` is the portable manifest;
- `skills/codex-ios-api-build/SKILL.md` is discovered as the portable skill;
- no MCP server is included, so there is no `mcp.json`.

The Agent Plugins specification defines the package format, while each host controls distribution and publication. For public ChatGPT/Codex directory publication, submit the skills-only package through the [OpenAI plugin submission portal](https://platform.openai.com/plugins).

## Manual local install

Clone the repo:

```bash
git clone https://github.com/michalcilek/codex-testflight-release.git
```

Then add the cloned repo as a local marketplace:

```bash
codex plugin marketplace add ./codex-testflight-release
```

## Security

Never commit your App Store Connect `.p8` private key.

Create a local env file outside your repo:

```bash
mkdir -p ~/.private_keys
cp skills/codex-ios-api-build/examples/appstoreconnect.env.example ~/.private_keys/appstoreconnect.env
```

Then edit `~/.private_keys/appstoreconnect.env` with your real values:

```bash
ASC_KEY_ID=YOUR_KEY_ID
ASC_ISSUER_ID=YOUR_ISSUER_ID
ASC_KEY_PATH=/absolute/path/to/AuthKey_YOUR_KEY_ID.p8
# Optional external distribution:
ASC_BETA_GROUP=YOUR_EXTERNAL_GROUP_NAME
ASC_SUBMIT_BETA_REVIEW=true
```

## Usage

From your iOS app repo:

```bash
PROJECT_PATH=ios/MyApp/MyApp.xcodeproj \
SCHEME=MyApp \
EXPORT_OPTIONS=build/ExportOptions-TestFlight.plist \
~/plugins/codex-testflight-release/skills/codex-ios-api-build/scripts/build_testflight_api.sh 123
```

Set TestFlight notes:

```bash
~/plugins/codex-testflight-release/skills/codex-ios-api-build/scripts/set_testflight_whats_new.js \
  com.example.myapp \
  123 \
  en-US \
  "Test sign-in, sync, and the new release changes."
```

## No Encryption

If your app only uses exempt standard encryption, add this to the generated Info.plist build settings:

```text
INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
```

Then verify the archive contains:

```text
ITSAppUsesNonExemptEncryption = false
```

## Distribution notes

For external testing, the export options plist must set `testFlightInternalTestingOnly` to `false` or omit that key. Builds exported as internal-only cannot later be assigned to an external group. The build helper stops early when an external group is configured with an internal-only export plist.

External availability still follows Apple's TestFlight state machine. The plugin assigns the configured group and can submit Beta App Review automatically; first external builds may remain unavailable until Apple approves them.

This plugin is not part of the official Codex Plugin Directory. It is distributed as an open-source local plugin/marketplace repo. Enterprise and Edu users can also share installed local plugins with workspace members from the Codex app.
