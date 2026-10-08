# Privacy and data handling

This Codex package contains skill instructions, reference material, helper scripts, documentation, visual assets, and a plugin manifest. The upstream conversion and installation CLI is not included.

The package does not include telemetry or analytics code, and Compound Engineering does not operate a backend that collects or stores your project data. Data can leave your machine through the AI host, tools, and integrations used by a workflow.

## Models and external services

Your AI host may send prompts, code, and other project context to its configured model providers. Some skills can also use authenticated model CLIs for independent research, review, or implementation. For example, code review can invoke a configured peer model as part of the review workflow. The host, provider, and workflow configuration determine that access.

Depending on the workflow and available tools, integrations may include:

- Documentation lookup through services such as Context7.
- GitHub operations such as reading issues, pushing changes, opening pull requests, or replying to review comments.
- Publishing or editing documents through Proof.
- Reading feedback from connected services such as Slack or GitHub.
- Transcribing recordings through OpenAI when the recording analyzer has an `OPENAI_API_KEY` and transcription is enabled.
- Image generation or publishing through tools available to the host.

These actions depend on the workflow you run and its configuration. Invoking a workflow can include calls to its configured integrations; an integration may not require a separate skill invocation. The package does not supply accounts or credentials for these services.

Installing dependencies or fetching remote Compound Packs also communicates with package registries or Git hosts.

## Local files and retention

Skills can create or modify code, plans, review reports, configuration, captured learnings, and temporary working files. Durable artifacts normally live in the project, including under `docs/plans/` and `docs/solutions/`. The `docs_root` setting can relocate the artifact directories; see [configuration](docs/guides/configuration.md#artifact-root).

Project files remain under your control. Processing and retention of data sent to model providers or integrations follow those services' policies and your account settings. Compound Engineering does not set their retention periods.

## Security reporting

Report security issues through the private disclosure process in [SECURITY.md](SECURITY.md).
