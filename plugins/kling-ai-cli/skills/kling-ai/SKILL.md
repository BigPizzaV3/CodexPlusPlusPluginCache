---
name: kling-ai
description: Generate Kling images and videos in local Codex, including text-to-image, image-to-image, text-to-video, image-to-video, reusable Elements, and motion control. Also handles login, credits, uploads, feedback, and task status through the Global CLI.
---

# Kling AI

## Capabilities

| Request | Command | Guidance |
| --- | --- | --- |
| Generate an image from text | `text_to_image` | [Image generation](../kling-ai-generate-image/SKILL.md) |
| Edit or restyle a reference image | `image_to_image` | [Image generation](../kling-ai-generate-image/SKILL.md) |
| Generate a video from text | `text_to_video` | [Video generation](../kling-ai-generate-video/SKILL.md) |
| Animate an image / use first and tail frames | `image_to_video` | [Video generation](../kling-ai-generate-video/SKILL.md) |
| Create a reusable subject from images or a video | `element_create` | [Create an Element](references/elements-motion-feedback.md#reusable-elements) |
| List saved subjects and their IDs | `element_list` | [List Elements](references/elements-motion-feedback.md#reusable-elements) |
| Read a subject's full details and resources | `element_get` | [Inspect an Element](references/elements-motion-feedback.md#reusable-elements) |
| Update a subject's name, description, tags, or supported resources | `element_update` | [Update an Element](references/elements-motion-feedback.md#reusable-elements) |
| Delete a specified saved subject | `element_delete` | [Delete an Element](references/elements-motion-feedback.md#reusable-elements) |
| List saved motions and their IDs | `motion_library_list` | [Browse saved motions](references/elements-motion-feedback.md#motion-library-and-motion-control) |
| Generate a video by driving a subject image with a motion video or saved motion ID | `motion_control` | [Generate with motion control](references/elements-motion-feedback.md#motion-library-and-motion-control) |
| Upload a local asset and return its URL | `file_upload` | [Explicit upload](references/elements-motion-feedback.md#explicit-asset-upload) |
| Query a generation's status and results | `query_tasks` | [Task results](references/cli-contract.md#output) |
| Check membership and remaining credits | `account` | [Account](references/cli-contract.md#commands) |
| Log in with browser OAuth | `login` | [Login](references/cli-contract.md#runtime) |
| Log out on the server and clear local credentials | `logout` | [Logout](references/cli-contract.md#commands) |
| Read the current identity, available models, and parameter specifications | `who_am_i` | [Model discovery](references/cli-contract.md#commands) |
| List the server's available tools and input schemas | `tool_list` | [Tool discovery](references/cli-contract.md#commands) |
| Report a stuck task, billing anomaly, or unexpected result with user authorization | `feedback` | [Issue feedback](references/elements-motion-feedback.md#issue-feedback) |

To reuse a saved subject in generation, inspect it with `element_get`, then bind it using `--elements` and `<<<id>>>` in a compatible generation command; see [binding rules](references/elements-motion-feedback.md#bind-an-element-to-generation). Creating an Element alone does not generate an image or video.

For a capability question, briefly describe image generation, video generation, reusable subjects, and motion control. Do not run a paid command.

Read [CLI commands and output](references/cli-contract.md) before the first remote operation. For Elements, motion control, explicit uploads, or feedback, also read [capability rules](references/elements-motion-feedback.md). Route image creation to `kling-ai-generate-image` and video creation/motion transfer to `kling-ai-generate-video`.

## Runtime and account

- Require shell access, Node.js 18+, and npm. Use `npm exec --yes --registry=https://registry.npmjs.org --package=@klingai/cli-global@0.2.0 -- kling --version`; use exactly CLI 0.2.0 for this plugin release. npm may download and execute that package from the official registry; explain this dependency before first use and respect host execution approvals. Do not change the version or bypass a denied command. If unavailable, report the limitation; do not substitute another generator or register an MCP server.
- Start with `who_am_i`. If authentication is needed, launch `login --skill-name kling-ai-cli --skill-version 1.0.5`; the user completes browser OAuth. Then run `tool_list` and `who_am_i`. Never request, read, print, or log credentials, tokens, or cookies.
- Use only the Global package and its service configuration. To switch accounts, run `logout` → `login` → `who_am_i`; stop if logout/login fails. Sign-out alone ends after `logout`.

## Submit and retrieve

1. A clear request authorizes one paid generation per explicitly requested step. Resolve only material ambiguities; do not add redundant confirmations or unrequested paid steps.
2. Select a live model from `who_am_i`; use its declared parameters, defaults, enums, and inputs. Rebuild flags after changing models. Preserve user facts and supplied copy; do not invent unsupported settings or commercial claims.
3. For pasted or attached media, resolve its path and role; pass correctly quoted arguments to the CLI for auto-upload. Never evaluate user text as shell code. Do not replace a failed reference workflow with text-only generation.
4. Immediately before every paid command, run `account`. Stop on zero or known insufficient credits. Keep at most one non-terminal paid task per objective; submit each authorized step at most once.
5. Preserve the returned `generationId`. Poll that task at provider-permitted intervals until terminal state, user cancellation, or turn timeout; a status-only request queries once. Return status, consumed credits when supplied, and the selected `works[]` URL. Stable identity is task number plus work index and content type. Result URLs expire after 24 hours; use a returned watermark-free URL only when authorized. Claim visual inspection only after doing it.
6. For dependent steps, continue only after the preceding step succeeds and the selected work is unambiguous; otherwise terminate the chain. Before reusing older Kling media, refresh its task once and use the same work index's current URL. If unavailable, request a fresh attachment; do not query repeatedly or select a substitute.

Element operations are synchronous: they return persistent subject IDs, not generation IDs. Do not poll them with `query_tasks`. Uploading an asset or selecting an Element does not authorize generation.

## Failures

- Only an explicitly pre-billing argument rejection with no `generationId` permits one correction: the original authorization remains unused. Refresh the live schema, preserve intent, recheck `account`, and submit the corrected command once. Stop after one correction.
- Credits/membership, queue/rate limits, media errors, safety restrictions, provider errors, or ambiguous billing: report the diagnostic and stop. Do not switch models, alter media, bypass restrictions, or automatically resubmit. Never claim a refund or non-billing without provider confirmation.
- If the submission response is lost, query only a known task number. Without one, report unknown state; a replacement requires that the user explicitly accepts possible duplicate billing. Feedback sends an issue summary and related task IDs to Kling. Send only with user authorization covering that data; existing authorization does not need repeated confirmation. State briefly when a report is sent and preserve host approval controls. Feedback does not fix or retry the task.
