# App runtime and updates

## Classify the failing layer

For an issue not covered elsewhere, classify it before acting:

1. **Account/service:** the same control or data is absent across devices, the app shows an eligibility/enforcement notice, or chat/gifts/tools fail for the account.
2. **App state:** launch, UI, scene, cache, local database, or a version-specific regression fails on one computer.
3. **OS integration:** permission, driver, security software, virtual device, window capture, or process audio fails outside the scene.
4. **Hardware/load:** the failure appears only under a source, game, encoder, memory, or thermal workload.
5. **Network/path:** sign-in, service data, upload, chat, gifts, or updates fail with route-specific errors.

## Install and launch

- Use only the current official download page and choose the package matching Windows, Apple silicon, or Intel Mac. Do not repeat older Windows-only help text.
- Record package/app version, OS version, architecture, install location, and exact launch error.
- Check free disk space, system time, security-software event/history, and whether the process opens then exits.
- Test once without optional overlays, virtual devices, capture utilities, or multistream tools. Restore them one at a time.
- Do not disable security protections broadly or permanently. If a bounded test identifies interference, create the narrow vendor-documented exception and re-enable protection.

## Login and service data

- Never ask for credentials, cookies, QR tokens, or a session export.
- Distinguish failed authentication from missing LIVE entitlement and from a service/network failure after successful login.
- Record the exact error, account region, whether TikTok works in the browser/mobile app, system date/time, VPN/proxy state, and whether another network changes the result.
- For chat, gifts, notifications, or interactive tools, compare account visibility in TikTok mobile/Live Center and a clean LIVE Studio scene. Treat rollout/eligibility as an account question, not a cache fix.

## Crash or frozen UI

- Use process state, app version, crash count, recent update, active sources, hardware encoder, and bounded log-signal counts.
- Reproduce offline in a clean scene. Add the suspected browser/media/capture source last.
- If a clean scene is stable, preserve the production scene and isolate its sources instead of clearing all app data.
- If every scene fails, test a supported encoder/default quality profile and close competing capture/overlay tools.

## Update regression

Preserve the current configuration and record before/after versions. Test the failing workflow in a clean scene. A reinstall is a last resort because an improper uninstall can remove scenes. Require a backup, offline state, explicit confirmation, the official installer, and a rollback plan.

Do not downgrade from an unofficial mirror or edit version/update controls to bypass platform requirements.
