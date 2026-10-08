# Privacy Policy

Effective date: 29 July 2026

## Scope

This policy covers the open-source Write Like Me skill and plugin. Write Like Me is a skills-only package: it has no Write Like Me server, account system, analytics service, advertising system, or hosted database.

## What the package processes

The package can process drafts, writing samples, dictated answers, user preferences, and corrections that a user intentionally supplies. It uses those materials to audit or revise a draft, build a portable writing-pattern file, or verify that a rewrite retained important meaning.

The AI host in which the package runs, such as ChatGPT, Codex, or Claude, processes the conversation and attachments under that host's own privacy policy and settings. Write Like Me does not control the host's collection, retention, model-training, or administrator policies.

## Collection and storage

Write Like Me does not independently transmit personal data to a Write Like Me service because no such service exists.

When local scripts are available:

- they read only the files supplied for the requested workflow;
- generated files are written to the location selected by the user or host;
- diagnostic JSON omits raw writing by default and records bounded metadata such as hashes, counts, provenance, mode, and reliability;
- raw source text is included in diagnostics only when `--include-source-text` is explicitly requested.

The portable `MY_WRITING_PATTERN.md` file and confirmed corrections remain under the user's control. There is no silent account-level memory. A user must save and provide that file again to reuse it in another conversation.

## User choices

Do not provide confidential or highly sensitive writing unless the selected AI host and workspace are approved for it. Users can:

- remove identifying details before submitting text;
- delete locally generated profiles and diagnostics;
- inspect a profile because it is plain Markdown;
- decline or edit any proposed correction rule;
- use draft cleaning without creating a persistent profile.

## Third-party services

Using an AI host or visiting the GitHub repository can create ordinary service, security, and analytics logs under those providers' policies. The repository contains no third-party tracking code.

The public project website includes an optional anonymous feedback form. It
stores only the platform and tests selected, bounded evaluation answers, the
user's written feedback, consent, the release version, and a creation
timestamp. It does not request a name, email address, IP address or raw writing
sample. The form is hosted separately from the skill package and is not used
for account memory, advertising or model training by Write Like Me.

## Changes and questions

Material changes will be recorded in the repository history and reflected by a new effective date. For privacy questions, open an issue at [github.com/HopLittleBunny/write-like-me/issues](https://github.com/HopLittleBunny/write-like-me/issues) without including private writing samples.
