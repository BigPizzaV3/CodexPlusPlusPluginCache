# Visual Truth Privacy Notice

Effective: July 22, 2026

Visual Truth is a development-only visual editor for compatible local React projects. This notice describes the data behavior of the Visual Truth Codex plugin and bundled editor.

## Data Visual Truth Processes

Visual Truth reads the rendered DOM, computed styles, responsive measurements, media attributes, and user-selected element information from the local development page where it is installed. It may store editor preferences, temporary visual history, reusable sections, named styles, responsive overrides, and user-written notes in browser-local storage.

When the user chooses **Make It Code**, Visual Truth writes a generated source module inside the local project. When the user chooses **Send to Codex**, Visual Truth creates a plain-text implementation brief and exposes it to the local Codex workflow or clipboard.

## Anonymous Installation Count

Beginning with version 1.2.0, Visual Truth makes one best-effort request after a successful project installation. The request contains only the event type (`install`) and Visual Truth version. The analytics database stores daily aggregate counts by version and does not create user-level or project-level records.

The installation counter does not intentionally collect or store names, email addresses, account identifiers, project names, project paths, source code, page content, editor activity, cookies, device identifiers, IP addresses, or user-agent strings. Network and hosting providers may temporarily process ordinary request metadata under their own policies. Set `VISUAL_TRUTH_ANALYTICS=0` when running the installer to disable the event.

## Voluntary Product Feedback

Version 1.3.0 includes an optional feedback form. Nothing is submitted unless the user chooses **Send feedback**. A submission stores the selected 1–5 rating, the text the user enters for what worked, what was confusing, and feature requests, an optional email address, the Visual Truth version, the form source, submission time, and an internal review status.

The feedback form does not automatically attach or store source code, page content, project names, project paths, screenshots, credentials, account identities, cookies, device identifiers, IP addresses, user-agent strings, or editor activity. An email address is stored only when the user types one because they want a reply.

The editor may keep a feedback-session count and reminder choice in browser-local storage so it can wait several editing sessions before showing a dismissible prompt. That count remains on the user's device and is not sent with feedback.

## Data Visual Truth Does Not Collect

Visual Truth does not include an advertising tracker or remote account system. The plugin does not intentionally transmit page content, project source, credentials, personal information, or editor history to Ultimate Design Studios.

Codex, the user's package manager, browser, operating system, source-control provider, and hosting provider may process information under their own policies when the user invokes those services.

## Local Storage and Deletion

Temporary editor state remains on the user's device in browser-local storage. Generated source remains in the user's project. Users can delete local editor data by clearing the site's browser storage and can remove generated source through their normal source-control workflow.

Voluntary feedback is retained only while it is useful for product improvement and support. To request deletion of a feedback response or optional email address, contact the publisher from the same email address and include enough detail to identify the response.

## Production Use

The editor overlay is intended only for local development. Users are responsible for preserving the documented development-only mount guard and reviewing production builds before deployment.

## Contact

Questions about this notice can be sent to info@ultimatedesignstudios.com, submitted through https://visual-truth-editor.deriquehanche.chatgpt.site/support, or shared through https://visual-truth-editor.deriquehanche.chatgpt.site/feedback.

## Changes

Material changes to this notice will be dated and included with the applicable Visual Truth release.
