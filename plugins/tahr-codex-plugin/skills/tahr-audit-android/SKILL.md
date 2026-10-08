---
name: tahr-audit-android
description: Audit Android application security from an APK, AAB-derived APK, Android source repository, manifest, or authorized emulator/device. Use for mobile release reviews, OWASP MASVS-oriented assessments, exported component and deep-link testing, WebView and IPC review, local storage and token analysis, mobile API traffic review, runtime instrumentation, privacy testing, and Android hardening validation.
---

# Tahr Audit Android

Use an artifact-first workflow to turn manifest and code signals into focused runtime checks. Keep static evidence, runtime reachability, and verified security impact distinct.

## Set scope and safety

1. Identify the application ID, build variant, APK hash, source revision, device profile, identities, and backend environment in scope.
2. Treat a local repository or supplied artifact as authorized for read-only review. Default to static analysis when active device or backend testing is not clearly authorized.
3. Use a disposable emulator snapshot, test install, test accounts, and synthetic data for state-changing checks.
4. Do not clear package data, change protected account credentials, trigger lockouts, submit real payments, send messages, write through content providers, load persistent code, or tamper with production data.
5. Do not modify the app or implement fixes unless the user explicitly asks.

Use secrets, tokens, PII, keys, cookies, and credentials only transiently for authorized verification. Persist their class, source, key or field name, redacted excerpt, length, fingerprint, scope, expiry, and replay result—not raw values.

## Inventory before testing

Read [attack-surface.md](references/attack-surface.md) before exploring the application.

Prefer existing artifacts over broad rescans: manifest, decompiled source, smali/resources, class or string index, static findings, device information, traffic capture, dynamic plan, and earlier coverage. If no compact index exists, create a focused inventory of URLs, secrets, crypto APIs, log calls, password/token fields, WebViews, JavaScript bridges, dynamic loading, and native libraries.

Build a target list with provenance for:

- exported activities, services, receivers, providers, and their permissions;
- deep links, app links, intent actions, URI authorities, and parameters;
- WebViews, loaded origins, settings, file/content access, and bridges;
- authentication, biometric, token, OAuth, and session paths;
- storage locations, backup behavior, logs, clipboard, and caches;
- crypto operations, keys, IVs, RNG, signing, and integrity decisions;
- endpoints, trust configuration, cleartext paths, pinning, and PII flows;
- deserialization, reflection, commands, dynamic code, native libraries, and dependencies;
- privacy permissions, tracking SDKs, consent states, retention, and screenshots.

## Separate evidence levels

Classify each observation immediately:

1. **Static candidate** — source, smali, manifest, resource, dependency, or configuration evidence identifies a plausible weakness.
2. **Runtime reachability** — adb, UI, proxy, logcat, filesystem, Frida, or backend evidence shows that the path executes or is externally callable.
3. **Verified impact** — the behavior crosses a confidentiality, integrity, authorization, authentication, privacy, or protected-functionality boundary.

Never label a static flag as runtime exploitation. An exported component, weak algorithm, permissive WebView setting, cleartext allowance, dependency CVE, or disabled resilience control is a target until the matching proof gate is met.

## Plan and run focused checks

Read [proof-gates.md](references/proof-gates.md) before dynamic testing or severity assignment.

Prioritize high-impact targets from artifacts. For each target, define the safe command or interaction, caller and app state, expected secure behavior, impact proof, cleanup, and stop condition. Exercise fresh, logged-in, proxied, unproxied, and offline states only when they add relevant evidence.

Use read-only or marker-based component and provider checks by default. Instrument only the classes and methods identified by static evidence. Capture metadata rather than raw values. Stop when the device, app, backend, or account shows instability.

For dependency or platform intelligence, search only exact detected packages and versions. Record affected range, fixed version, prerequisites, and source, then prove that the vulnerable code path is packaged and reachable. Intelligence is a lead, never a finding.

When stuck, use a bounded fresh-agent pass to suggest missing test states or alternate proof paths. Treat suggestions as candidates and independently verify them.

## Report without losing uncertainty

Return three separate sections:

- **Verified findings:** include category proof, exact component or file, caller/app state, commands or interactions, before/after behavior, impact, and remediation.
- **Candidates:** include the static or runtime signal, missing proof, and safest next check.
- **Coverage:** mark every material target `tested`, `partially_tested`, `skipped_with_reason`, `inaccessible`, `blocked_by_environment`, or `unsafe_or_destructive_skip`.

Do not silently omit high-risk components because the emulator, login, proxy, root, Frida, or backend was unavailable. Do not interpret a blocker as evidence that the app is secure. Calibrate severity to demonstrated impact, not MASVS category names or scanner labels.
