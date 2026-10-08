# Privacy Policy

Effective date: September 15, 2026.

## Scope

Engineering Project OS is a skills-only plugin for ChatGPT and Codex that helps inspect, create and maintain repository-local engineering records. This policy describes data handling by the Project OS plugin and its publisher.

## Data processing

Project OS does not operate a hosted service, MCP server, user account system, analytics service or central failure database. Its bundled Python helper initiates no network requests. In ChatGPT, Project OS can process only project information, files, archives or reusable knowledge bundles supplied to the conversation and can return changed files as chat artifacts. In Codex, it may read the selected local workspace, a user-selected source repository or a user-selected bundle and may write Project OS records inside the target after the applicable preview and approval steps. Knowledge import never writes to the source repository.

The publisher does not receive, transmit or store repository contents, prompts, credentials or usage telemetry through Project OS. Data processed by ChatGPT, Codex, GitHub or another environment remains subject to that provider's terms and privacy policy.

## Retention and deletion

Project OS has no publisher-controlled data store and therefore retains no user data on behalf of the publisher. Project knowledge, reusable knowledge and exported bundles remain under the user's control and can be reviewed, versioned, transferred, retired or removed using the repository's normal tools and policies. Removing one copy does not recall copies the user already imported elsewhere.

## Security and permissions

Project OS uses only the file and command access provided by the current ChatGPT or Codex conversation. Installation does not grant repository access or authority to change application code, install dependencies, delete files, commit, push, deploy or contact external systems. Those actions remain subject to the user's instructions and the host environment's permission controls.

Security details and vulnerability reporting instructions are available in the [Security Policy](../SECURITY.md).

## Changes and contact

Material changes to this policy will be published in this repository with an updated effective date. Questions can be filed through [GitHub Issues](https://github.com/innrvoice/engineering-project-os/issues).
