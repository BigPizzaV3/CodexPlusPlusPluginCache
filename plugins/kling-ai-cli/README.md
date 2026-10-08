# Kling AI for local Codex

Create, monitor, and retrieve Kling AI images and videos, manage reusable Elements, and control subject motion from local Codex tasks with the official Global Kling CLI.

This is a Skills-only plugin. It does not register an MCP server or ChatGPT app, and it requires a local Codex environment with shell access and Node.js 18 or newer. ChatGPT web Work cannot run this local CLI workflow.

Plugin **1.0.5** supports the complete **Kling CLI 0.2.0+** command set. These version numbers identify different packages.

## Automatic runtime

This release invokes exactly CLI 0.2.0 from the official npm registry. npm may download and execute it; Codex explains this dependency before first use and respects host approvals:

```bash
npm exec --yes --registry=https://registry.npmjs.org --package=@klingai/cli-global@0.2.0 -- kling <command>
```

Codex checks the CLI version; dependency updates require an explicit plugin update. The npm package owns the Global Kling service configuration. The Skill never changes the service URL or asks the user to choose a region.

## Sign-in

Codex first checks the active account. If authorization is needed, it starts browser OAuth itself:

```bash
npm exec --yes --registry=https://registry.npmjs.org --package=@klingai/cli-global@0.2.0 -- kling login --skill-name kling-ai-cli --skill-version 1.0.5
```

The user only completes the Kling consent screen. Codex resumes the workflow after sign-in; it never asks the user to copy commands, paste tokens, or edit configuration.

## Supported workflows

- Text to image and image to image
- Text to video and image to video
- Generation status monitoring and result retrieval
- Element creation, listing, inspection, updates, deletion, and compatible generation binding
- Motion library and motion control from a video or saved motion
- Explicit asset uploads and transparent, user-authorized issue feedback
- Tool discovery, credit checks, and sign-out/account switching
- Reference images pasted or attached directly in the conversation

For image-based generation, Codex passes the attachment's local path to `--image`; the CLI uploads it automatically. No separate upload is needed for generation. Explicit requests to upload an asset and return its URL use `file_upload`.

Generation can consume Kling credits. A user request to generate authorizes one submission after materially missing inputs are resolved; the Skills check credits immediately before submission, run paid steps serially, and submit each authorized step at most once.

## Generation quality

Image and video Skills include prompt-construction, reference-fidelity, motion, timing, and continuity guidance. Product, advertising, portrait, and other scene patterns are loaded as needed. Shared runtime, billing, polling, and failure rules stay in the core Skill.

## Validation

```bash
npm run check
npm test
npm run pack:release
```

`pack:release` creates one Skills-only ZIP for local Codex and excludes MCP, app, mock runtime, and macOS metadata files.
