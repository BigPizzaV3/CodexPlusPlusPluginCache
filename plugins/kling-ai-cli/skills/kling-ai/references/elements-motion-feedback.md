# Elements, motion, uploads, and feedback (CLI 0.2.0+)

Use the command prefix, plugin telemetry, live capability discovery, credentials, and single-submit rules in [the CLI contract](cli-contract.md) and [the core Skill](../SKILL.md). Examples below show arguments after `kling`; substitute real user-selected IDs, paths, and live model values. Never invent IDs or call MCP/HTTP directly.

## Reusable Elements

- Discover `element_create`, `element_list`, `element_get`, `element_update`, and `element_delete` with `tool_list`; inspect per-command help before assembling inputs.
- Create an image Element with `--name`, `--description`, one or more `--tag`, `--cover`, and 1–3 repeatable `--secondary` images. A video Element uses `--video` instead of cover/secondary. The resource modes are mutually exclusive. Either may include optional `.mp3` `--voice`. Local resource paths auto-upload; public URLs pass through.
- Choose tags from the current region's live `element_create` tool description and pass them verbatim for both creation and updates. Never translate tags to the conversation language or hardcode a regional tag catalog.
- Element operations are synchronous. `element_create` returns the persistent `id`, not a `generationId`; do not poll `element_*` operations with `query_tasks`. `element_list` lists IDs/names; use `element_get <elementId>` for full name, description, tags and resource details. Preserve actual response nesting rather than inventing fields.
- `element_update <elementId>` accepts only changed fields: `--name`, `--description`, repeatable `--tag`, repeatable `--secondary`, `--video`, `--voice`. Omitted fields are preserved. The CLI first reads the Element and merges a full payload; image covers are preserved automatically, and `--cover` is not accepted for updates. Do not convert resource type through an update.
- Supplied tags and secondary images replace their entire lists. Secondary images must still total 1–3. For an add/remove request, inspect the current list and establish the complete intended replacement before updating; do not silently drop entries.
- Delete only the exact user-authorized Element. Resolve ambiguous names with `element_list`/`element_get` before `element_delete <elementId>`. Do not delete a persistent subject merely to test a workflow.

The creation examples assume the live catalog contains `Characters`; replace it with the exact current catalog value before execution.

```bash
kling element_create --name "Alice" --description "Red-haired detective" --tag Characters --cover ./front.png --secondary ./side.png
kling element_create --name "Alice video" --description "Detective in motion" --tag Characters --video ./alice.mp4 --voice ./voice.mp3
kling element_list
kling element_get <elementId>
kling element_update <elementId> --description "Red-haired private detective"
kling element_update <elementId> --secondary ./side-v2.png --secondary ./back.png
kling element_delete <elementId>
```

## Bind an Element to generation

Read full Element resources first to determine image/video type. Check both the live tool description for subject-type and invocation restrictions and `who_am_i` for the selected model's parameters. The model must declare `elements`; that parameter alone does not override an explicit restriction in the tool description. Do not reject an image Element solely because the model is named `kling-image-o1`, and do not use a fixed model-name allowlist as a substitute for live capability checks. If declarations conflict and compatibility remains unclear, explain the conflict and stop before binding submission; never probe compatibility with a paid generation. Any alternative model must preserve user intent and follow the existing model-selection and retry rules.

Use both the prompt marker `<<<id>>>` and the live-declared `--elements '[{"id":"<id>","bindName":"<name>"}]'`; a marker alone does not bind the subject. Preserve any separately required image input. Incompatible tool/model/type or missing `elements` declaration is a reason to stop and explain, not to strip the requested identity silently. Element selection does not itself submit generation.

## Motion library and motion control

`motion_library_list` returns saved motion IDs/names and available media metadata; use the returned ID as `--motionId`. `motion_control` requires a subject `--image`, explicit live `--model`, and exactly one motion source: `--video` (local path or public URL) or `--motionId`. Never pass both, and do not use `--omni`.

Read `who_am_i` for the model's required arguments, including `--motionDirection` when declared. Agent commands must supply required values; do not depend on terminal prompts. The CLI checks missing inputs before uploading. The optional positional prompt may refine appearance/action, but does not replace required motion inputs. Local subject and motion files auto-upload.

```bash
kling motion_library_list
kling motion_control --model <model> --image ./subject.png --video ./motion.mp4 --motionDirection motion_direction
kling motion_control --model <model> --image ./subject.png --motionId <id> --motionDirection image_direction --poll 300
```

These direction values are examples; confirm the selected model accepts them. Motion control is a paid generation: check `account` immediately before submission, submit at most once, preserve `generationId`, then query that same task with `query_tasks`. The result has the usual status, optional `creditsConsumed`, and final `works[]`. Do not impose ordinary text-to-video audio, duration, or multi-shot defaults on a motion model unless its schema supports them.

## Explicit asset upload

For a user request to upload an asset and return its URL, call `file_upload <filePath>`. The CLI obtains a single-use upload ticket and transfers the bytes; use the normalized `body.url` from the actual successful result. Do not expose the ticket or upload authorization. Upload alone does not authorize generation. Ordinary attached-reference generation and Element/motion resources use their auto-upload flags, with no extra standalone upload.

## Issue feedback

`feedback` records an issue; it does not retry a task, refund credits, or fix a result. This command sends an issue summary and related task IDs to Kling. Obtain user authorization for these data before sending; existing authorization does not need repeated confirmation. Do not suppress host approval prompts. Send only a relevant sanitized summary. Exclude tokens, passwords, cookies, authorization headers, private keys, and unnecessary personal data. Report once per issue.

For an empty result or opaque error, offer to send the sanitized diagnostic and known task IDs. If the user has already authorized that scope, send once and briefly report that it was sent.

Required options are `--summary` and `--category`; use a category from live help. Optional `--triggerMode` is `user_initiated` only when the user independently asks to send feedback; Agent-suggested reports authorized by the user use `agent_initiated`. Repeatable `--tool` entries form an ordered tool chain. Repeatable `--generationId`, `--modelVersion`, and `--relatedTaskTraceId` populate request `extra.generationId`, `extra.modelVersion`, and `extra.taskTraceId` arrays. These are request fields, not guaranteed response echoes. Historical `--relatedTaskTraceId` differs from this invocation's global `--task-trace-id`.

```bash
kling feedback --summary "Completed task returned no works" --category EMPTY_OR_PARTIAL_RESULT --triggerMode agent_initiated --tool image_to_video --tool query_tasks --generationId <id>
```

Briefly state whether feedback was sent or failed. Continue reporting the original task outcome or unresolved issue normally; a feedback acknowledgement does not mean the issue was fixed. For lost submission responses, never invent a generation ID for feedback.
