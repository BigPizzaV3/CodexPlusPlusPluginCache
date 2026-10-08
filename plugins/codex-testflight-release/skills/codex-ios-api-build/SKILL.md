---
name: codex-ios-api-build
description: Build and upload iOS TestFlight builds from Codex using xcodebuild archive/export and App Store Connect API authentication. Use when the user asks to create a new TestFlight build, bump an iOS build number, archive an iOS app, upload via API key, set no-encryption export compliance, or automate TestFlight What to Test notes.
license: MIT
compatibility: Requires macOS with Xcode and xcodebuild, Node.js, Python 3, App Store Connect API credentials stored outside the repository, and network access.
---

# Codex iOS API Build

## Purpose

Create repeatable iOS TestFlight builds without opening Xcode UI:

1. bump `CURRENT_PROJECT_VERSION`,
2. archive for generic iOS device,
3. export/upload with `xcodebuild -exportArchive`,
4. authenticate using a local App Store Connect API key,
5. verify App Store Connect sees the build,
6. set TestFlight "What to Test" through App Store Connect API.

## Security Rules

- Never print `.p8` private key content.
- Keep App Store Connect API keys outside repos and outside synced folders.
- Use a local env file such as `$HOME/.private_keys/appstoreconnect.env`.
- Do not commit archives, exported IPA files, API keys, `.p8` files, or Xcode distribution logs.
- Treat App Store Connect `Key ID`, `Issuer ID`, Team ID, and key path as sensitive operational data.

Expected local env shape:

```bash
ASC_KEY_ID=YOUR_KEY_ID
ASC_ISSUER_ID=YOUR_ISSUER_ID
ASC_KEY_PATH=/absolute/path/to/AuthKey_YOUR_KEY_ID.p8
```

## Standard Workflow

Run from your iOS project repository root:

```bash
PROJECT_PATH=ios/MyApp/MyApp.xcodeproj \
SCHEME=MyApp \
EXPORT_OPTIONS=build/ExportOptions-TestFlight.plist \
/path/to/codex-testflight-release/skills/codex-ios-api-build/scripts/build_testflight_api.sh 123
```

Required environment variables for a public project:

- `PROJECT_PATH`: path to the `.xcodeproj`
- `SCHEME`: Xcode scheme to archive
- `EXPORT_OPTIONS`: export options plist for App Store/TestFlight upload

Archive output defaults to `build/<scheme>-<build>.xcarchive`.
Export output defaults to `build/<scheme>-<build>-export`.

## No Encryption

When the app only uses exempt standard encryption, add this generated Info.plist build setting before archiving:

```text
INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;
```

Verify the archived app:

```bash
/usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' build/MyApp-123.xcarchive/Products/Applications/MyApp.app/Info.plist
```

Expected value: `false`.

## What to Test

After upload, set TestFlight "What to Test":

```bash
/path/to/codex-testflight-release/skills/codex-ios-api-build/scripts/set_testflight_whats_new.js \
  com.example.myapp \
  123 \
  en-US \
  "Test sign-in, main workflow, sync, and the new release changes."
```

The helper uses App Store Connect API `betaBuildLocalizations`: it finds the app by bundle ID, finds the build by build number, then creates or updates the build localization.

## External TestFlight groups

Set `ASC_BETA_GROUP` to the exact external group name and optionally set `ASC_SUBMIT_BETA_REVIEW=true`. The metadata helper assigns the processed build to that group and submits it for Beta App Review when required.

The export options plist must set `testFlightInternalTestingOnly` to `false` or omit it. An internal-only build is permanently ineligible for external groups, so the build helper validates this before archiving.

## Verification

Always verify:

1. Archive succeeded: output includes `** ARCHIVE SUCCEEDED **`.
2. Upload succeeded: output includes `Uploaded package is processing`, `Upload succeeded`, and `** EXPORT SUCCEEDED **`.
3. API sees the expected build number and processing state.
4. Info.plist includes `ITSAppUsesNonExemptEncryption = false` when no-encryption compliance is expected.
5. `set_testflight_whats_new.js` reports `Updated What to Test` or `Created What to Test`.
6. When `ASC_BETA_GROUP` is configured, the helper confirms assignment to the named external group and reports the Beta App Review state.

Acceptable processing states include `PROCESSING` shortly after upload and `VALID` once Apple finishes.
