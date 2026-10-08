# Security policy

## Supported version

Security fixes apply to the latest commit on `main`.

## Reporting

Report vulnerabilities privately through GitHub Security Advisories. Do not
include confidential documents or personal data in an issue, screenshot, test
fixture, or support bundle.

## Security boundaries

- Helper commands spawn argument arrays with `shell: false`.
- The installer refuses to overwrite conflicting discovery paths.
- Proofreading works on a copy and does not overwrite source files without user
  authorization.
- The project does not read credentials, call remote services, or upload text.
- Harper CLI, Node.js, Git, and agent clients are separately installed software
  with their own security models.
