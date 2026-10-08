# Android attack-surface guide

Use this guide to create a compact, provenance-backed target inventory before dynamic work.

## Artifact intake

Record the package name, version, min/target SDK, build type, APK hash, signature, source revision, and device profile. Decompile with JADX and apktool when only an APK is available. Treat decompiler errors as limitations; inspect smali and resources where Java output is incomplete.

Search with `rg` before opening large trees. Useful concept groups include:

```text
WebView|addJavascriptInterface|setAllow.*Access|loadUrl
SharedPreferences|SQLiteDatabase|RoomDatabase|openFileOutput|getExternalStorage
Cipher|getInstance|SecretKeySpec|MessageDigest|SecureRandom|KeyStore
TrustManager|HostnameVerifier|CertificatePinner|http://
Intent|PendingIntent|ContentProvider|FileProvider|sendBroadcast|bindService
DexClassLoader|PathClassLoader|System.load|Runtime.exec|ProcessBuilder
Log.[divew]|Timber|ClipboardManager|FLAG_SECURE
```

Redact any matched secret value while preserving path, line, symbol, class, value class, length, and fingerprint.

## Manifest and IPC

Inventory application flags, backup rules, cleartext policy, network-security config, permissions, custom permission protection levels, and every activity, service, receiver, and provider. Resolve implicit exports and component-level read/write permissions.

For each reachable component, preserve the exact class, action, categories, URI authority, declared permission, expected caller, and security-sensitive effect. Test only with read-only or marker inputs unless a disposable environment permits a reversible write.

Inspect:

- intent extras reaching identifiers, files, URLs, commands, or queries;
- providers and FileProviders for unauthorized reads, traversal, or injectable selection;
- broadcasts or services that trigger privileged behavior;
- mutable or exposed PendingIntents;
- deep links reaching authenticated UI, redirects, WebViews, or state changes.

## WebViews and links

Trace every loaded origin and whether attacker-controlled links, redirects, files, or intent extras can influence it. Inventory JavaScript, file/content access, universal file access, mixed content, safe browsing, cookies, debugging, and each `@JavascriptInterface` method.

Do not call a bridge dangerous solely because it exists. Prove that untrusted content can invoke a sensitive method or reach local files, tokens, native actions, or protected navigation.

## Authentication and storage

Map login, token refresh, logout, biometric unlock, OAuth redirects, account switching, and backend session validation. Classify captured material before replay: access token, refresh token, JWT, session cookie equivalent, API token, client credential, or public identifier.

Inspect SharedPreferences, databases and WAL files, internal/external files, caches, WebView data, logs, backups, clipboard, screenshots, and memory. Record accessibility and lifecycle state: before login, after login, after logout, force-stop, backup/restore, or reinstall.

## Crypto and network

Tie every crypto call to the data or security decision it protects. Look for weak primitives, ECB, static IVs, hardcoded keys, predictable RNG, weak hashes used as security controls, custom trust, and unsafe KeyStore use.

Correlate static endpoints with runtime requests. Record scheme, host, route, method, caller state, certificate behavior, headers by name, token class, and PII class. Pinning bypass demonstrates test capability; it is not a vulnerability unless trust behavior or sensitive traffic is insecure.

## Code, resilience, and privacy

Trace external input to SQL/provider queries, deserialization, reflection, commands, script execution, dynamic code loading, and native libraries. Confirm execution rather than inferring it from a writable path.

Test root, emulator, debugger, Frida, signature, and integrity controls only when they protect meaningful functionality. Assess PII type, destination, first- or third-party status, permission and consent state, opt-out behavior, retention, clipboard, and screenshot exposure.

## Runtime profiles

Use only profiles relevant to the hypothesis:

- fresh install without login;
- logged-in test account;
- proxied and certificate-controlled;
- unproxied control;
- offline or degraded network;
- rooted/instrumented device when authorized.

Record unavailable profiles as coverage gaps. Never downgrade a static candidate merely because runtime tooling is unavailable.
