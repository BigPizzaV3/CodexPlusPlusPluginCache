# Build and release trust boundaries

Trace a selected artifact from source revision and dependency identity through install/build scripts, CI credentials, cache/artifact transfers and publication. A missing optional attestation format is not automatically a defect.

Separate untrusted pull-request code and metadata from privileged workflow contexts. Check trigger semantics, checkout ref, token/environment permissions and artifact/cache provenance. An isolated first workflow does not make its output trusted input to a privileged follow-up. Avoid executing untrusted install scripts just to inspect a dependency.

Follow the resolved lockfile, registry/source, transitive package and executed lifecycle script. Distinguish a reachable vulnerability from an advisory about an unused component. Review upgrades against the selected compatibility contract rather than replacing the dependency stack.

For publication, verify an explicit file inventory, secret/config exclusion, artifact digest, exact tested revision and established signature/provenance policy. Use synthetic canaries or sanitized fixtures; never print credentials to prove they could leak. Preserve the connection between approved artifact and published bytes. A checksum detects changes but does not authenticate a publisher by itself.

Use the configured provider's semantics. [GitHub's secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) explains untrusted checkout and privileged workflow risks; other providers have different triggers.
