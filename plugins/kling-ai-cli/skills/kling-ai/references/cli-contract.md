# Official Global Kling CLI contract

## Runtime

Use the pinned 0.2.0 release of [`@klingai/cli-global`](https://www.npmjs.com/package/@klingai/cli-global) without a global installation:

```bash
npm exec --yes --registry=https://registry.npmjs.org --package=@klingai/cli-global@0.2.0 -- kling <command>
```

Full capability coverage requires CLI 0.2.0 or newer. The plugin release is 1.0.5; telemetry reports the plugin version. Use exactly `@klingai/cli-global@0.2.0` and check `--version`; changing this dependency requires an explicit plugin update. npm may download and execute the package from the official registry. Explain this dependency before first use and respect host execution approvals. The package requires Node.js 18 or newer, publishes the `kling` executable, and owns the Global Kling service configuration. Do not use a CLI version below 0.2.0, install a second regional package, or override the service URL.

## Commands

| Intent | Kling command and arguments |
| --- | --- |
| Browser OAuth | `login` |
| Discover identity, models, and input specs | `who_am_i` |
| Text to image | `text_to_image <prompt>` |
| Reference image to image | `image_to_image --image <url-or-local-path> <prompt>` |
| Text to video | `text_to_video <prompt>` |
| Image to video | `image_to_video --image <url-or-local-path> <prompt>` |
| Query a task | `query_tasks <generationId>` |
| Check membership and credits | `account` |
| Sign out on the server and clear local login | `logout` |
| List advertised tools and input schemas | `tool_list` |
| Upload an asset explicitly | `file_upload <filePath>` |
| Create an Element | `element_create --name N --description D --tag T ...` |
| List Elements | `element_list` |
| Read an Element | `element_get <elementId>` |
| Update selected Element fields | `element_update <elementId> ...` |
| Delete an Element | `element_delete <elementId>` |
| List saved motions | `motion_library_list` |
| Drive a subject with motion | `motion_control --model M --image <path-or-url> (--video <path-or-url> \| --motionId <id>)` |
| Send a user-authorized issue report | `feedback --summary S --category C ...` |

Local paths supplied to `--image` and `--tailImage` are uploaded automatically by the CLI. Use this path for conversation attachments instead of a separate upload operation. Explicit requests for an uploaded URL use `file_upload`; local Element images, videos and voice assets also auto-upload through their resource flags. See [capability workflows](elements-motion-feedback.md) for complete resource constraints.

Generation commands require `--model <name>` from the current `who_am_i`, unless the user explicitly requests a live-supported `--omni` workflow for one of the four ordinary image/video commands. `motion_control` requires `--model` and rejects `--omni`. Select the command and model before building flags. Treat that model's returned parameters as a closed allowlist:

- Use the canonical model name, not a remembered alias.
- Fill required parameters and use only exact allowed values.
- Preserve a declared default unless user intent reliably selects another allowed value; an optional parameter without a default is omitted unless needed.
- Never pass empty placeholders or flags declared only by another model.
- Rebuild all dynamic flags after switching the command or model.
- Keep prompt, local paths, and every user-provided value as separate quoted arguments; never evaluate them as shell syntax.

Append these flags to remote commands:

```text
--skill-name kling-ai-cli --skill-version 1.0.5 --quiet
```

Login omits `--quiet`. Global options: `--quiet` / `-q`, `--help` / `-h`, `--version` / `-v`, `--skill-name`, `--skill-version`, and `--omni` for the four ordinary generation commands. Top-level help/version are local; per-command help tries live `tools/list` and falls back to static usage when unavailable.

The five generation commands and `query_tasks` support `--poll <seconds>`: bare `--poll` waits up to 60 seconds; `--poll 0` disables inline polling. Prefer separate queries for interactive progress. A polling timeout never authorizes another generation.

When supported by the live schema, use `--task-trace-id <id>` to share one 32-character alphanumeric trace ID across the same user objective; do not confuse it with a generation ID. `--rationale` describes the purpose in English for the five generation commands, including `motion_control`. The CLI creates a trace ID when omitted, but separate commands then have separate traces. These are telemetry, not authorization or deduplication keys.

## Output

Element operations are synchronous and return persistent Element IDs rather than generation IDs; do not apply generation polling to `element_*`. The five asynchronous generation commands use `generationId` and `query_tasks`.

- Remote commands return `{ ok, status, body }`; the CLI parses MCP JSON text blocks into `body`. Inspect `ok` and the tool result before treating an operation as successful.
- stdout is JSON; `--quiet` produces compact single-line JSON.
- stderr contains progress and diagnostics.
- Exit `0` means the command completed, `1` means failure, and `130` means user cancellation.
- Submission returns `generation_id` or `generationId`.
- `account` may return membership and available-credit fields. Use it as a pre-submit insufficiency gate, not as a promise that the exact task cost is covered.
- Completed task data returns `works[]`; preserve each selected work's array index and content type, use `works[].url` as the primary result, and use `works[].url_without_watermark` only when present and authorized.
- Result URLs expire after 24 hours. A durable reference is the task number plus work index, not a saved URL.

Field casing can vary. Preserve values while matching `generation_id`/`generationId`, `credits_consumed`/`creditsConsumed`, and `url_without_watermark`/`urlWithoutWatermark`.

For Element, motion-library, upload, and feedback results, see [capability workflows](elements-motion-feedback.md). Poll aggregation uses `body.polled`, `body.timedOut`, and `body.generations[]` entries with `generationId`, `status`, and `result`. Task states may differ in casing; recognize queued/running, successful/partial, and failed/cancelled terminal states from the actual response.
