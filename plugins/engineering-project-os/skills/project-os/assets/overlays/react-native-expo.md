# React Native and Expo ecosystem overlay

Use only with the `mobile` capability pack when the repository actually ships React Native or Expo.

- Verify APIs against the pinned native runtime and installed package implementation, not only TypeScript declarations, Node tests or current web standards.
- Distinguish React navigation focus, native view display, transport completion, file readiness and application lifecycle. A mounted component may still be hidden or no longer own completion.
- Treat Expo config plugins, generated native projects, autolinking, runtime versions and OTA manifests as separate compatibility boundaries.
- Bound native image decode before manipulation and validate real camera/file inputs. Synthetic bytes do not establish native decoder compatibility.
- Use supported platform and Expo APIs before custom native bridges, parsers, caches or transports.
- Recheck every version-sensitive workaround on Expo, React Native, platform or native dependency upgrades and keep iOS and Android evidence separate.
