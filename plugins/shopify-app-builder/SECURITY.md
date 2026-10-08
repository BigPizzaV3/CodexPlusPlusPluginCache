# Security policy

## Supported version

Security fixes are applied to the latest published release.

## Report a vulnerability

Do not open a public issue containing a secret, exploit, private store identifier, or merchant data. Use GitHub's **Report a vulnerability** flow in the repository Security tab:

https://github.com/khadinakbarlabs/shopify-app-builder/security/advisories/new

Include the affected file, impact, safe reproduction steps, and any suggested fix. Remove or redact live credentials before attaching logs.

## Release controls

Every release runs tests, manifest validation, skill-name validation, a personal-path scan, secret-pattern scanning, npm package-content inspection, and a no-symlink check. The package intentionally has no dependencies and no install-time lifecycle scripts.
