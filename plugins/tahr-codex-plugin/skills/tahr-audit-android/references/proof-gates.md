# Android proof gates

Use the matching gate before calling a result verified.

| Category | Verified impact requires | Candidate-only examples |
|---|---|---|
| Storage | Sensitive data location, protection state, actual readability, and relevant logout/backup lifecycle | Preference or database name without sensitive content or accessibility |
| Crypto | Weak primitive or key practice tied to sensitive data or a security control; prove tampering, replay, disclosure, prediction, or weakened decision when claiming that impact | `Cipher` reference, MD5 used for a cache key, static rule match |
| Auth/session | Token class, scope/expiry/binding, storage source, and backend acceptance; biometric bypass must reach protected functionality | Local callback hook, decoded JWT, token-shaped string |
| Network | Observed insecure trust or sensitive cleartext/proxy-visible traffic in the relevant app state | `usesCleartextTraffic`, HTTP string, successful pinning bypass alone |
| IPC/platform | External caller reaches the component without intended permission/auth and obtains data, changes state, or reaches protected UI/functionality | Exported flag, intent filter, provider authority |
| WebView | Attacker-controlled origin or navigation reaches a dangerous setting/bridge and causes native, file, token, or protected action impact | JavaScript enabled or bridge present without an untrusted-content path |
| Injection/code execution | Attacker input reaches the sink and produces command output, changed query result, loaded code, callback, meaningful crash, or state change | Writable file, reflection call, deserializer dependency |
| Resilience | Control exists, bypass succeeds, and protected functionality, sensitive data, paid feature, integrity decision, or anti-abuse control is weakened | Root/debug detection bypass with no protected impact |
| Privacy | PII or identifier type, source, destination, consent/permission state, and user-control or retention evidence | Permission requested or tracking SDK packaged |

## Runtime evidence record

Preserve:

- APK hash, package, device profile, app and identity state;
- exact component, class, method, URI, file, table/column, preference key, or endpoint;
- command or interaction and non-secret payload;
- expected secure behavior and actual result;
- log, traffic, UI, filesystem, or backend proof;
- before/after state and cleanup result;
- redacted value class, length, and fingerprint.

Static evidence may be conclusive about a packaged secret or manifest setting, but it does not prove runtime exploitability. Label the exact claim that the evidence supports.

## Safety stops

Skip and record a reason when proof would require:

- changing credentials, MFA, passkeys, roles, or protected account state;
- provider writes, record deletion, payments, messages, or third-party effects;
- clearing an app that contains protected state or unpreserved evidence;
- persistent dynamic code, destructive tampering, or destabilizing load;
- collecting raw PII or secrets beyond what is necessary to fingerprint the issue.

Use a disposable app install or synthetic account if a reversible state change is necessary. A safe skip is coverage, not a false positive or proof of security.

## Result dispositions

- `verified`: category proof and impact exist;
- `potential`: concrete static or runtime signal exists, but impact proof is missing;
- `rejected`: evidence disproves the candidate;
- `blocked_by_environment`: required device, login, root, proxy, or instrumentation is unavailable;
- `unsafe_or_destructive_skip`: the remaining proof path exceeds the authorized safety boundary;
- `not_observed`: a properly executed test did not reproduce the behavior.

Keep every candidate traceable through one disposition. Do not silently drop a result because its sensitive evidence must be redacted.
