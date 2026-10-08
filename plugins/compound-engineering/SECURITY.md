# Security policy

## Supported versions

Security fixes are applied to upstream `main`. This submission is a snapshot; its source revision is recorded in [package details](docs/submission.md). Updating the upstream repository does not update an existing copy of this package.

## Reporting a vulnerability

Please do not open a public issue for undisclosed vulnerabilities.

Instead, report privately by emailing:

- `kieran@every.to`

Include:

- A clear description of the issue
- Reproduction steps or proof of concept
- Impact assessment (what an attacker can do)
- Any suggested mitigation

We will acknowledge receipt as soon as possible and work with you on validation, remediation, and coordinated disclosure timing.

## Scope

This package contains plugin instructions, configuration, reference files, and helper scripts. The upstream conversion/install CLI is not included.

- The host interprets skill instructions and can execute bundled scripts. Some workflows launch local processes, such as a prototype preview server.
- Workflows may read or modify project files and interact with configured external services. Their permissions and access also depend on the host and its tools.

For data-handling details, see [PRIVACY.md](PRIVACY.md).
