# PixVerse CLI Cheatsheet

Use this as a fast reminder for the plugin's PixVerse CLI `1.4.0` minimum capability baseline. The current reviewed release is `1.4.5`; read `pixverse-cli-1.4.5.md` for Canvas/download changes and read `pixverse-cli-1.4.4.md` for H3 Max and cumulative image/audio additions. Read `pixverse-cli-1.4.0.md` for guaranteed support and `pixverse-cli-internal-1.4.0.md` for local/internal artifact notes. `"${PVX}" pixverse capabilities create <mode> --model <id> --json` is the offline source for Create parameter detail; it needs neither login nor network. Canvas contracts are separate and live: use `"${PVX}" pixverse capabilities canvas --json`. Use `"${PVX}" pixverse <command> --help` or `"${PVX}" doctor` for command/setup detail.

Apply `./quality-policy.md` for creative defaults, Seedance prompt enhancement and membership choices.

## Agent Rules

- For ordinary generation, do not spend a separate host-tool call on setup status: queue preflight and run enforce readiness. Read `"${PVX}" setup status` when setup is the actual problem or preflight returns `setup_required`.
- Prefer `--json` for machine-readable output.
- Build Create commands from the offline normalized capability record: required fields, model support, defaults, enums, ranges, units, and media limits. Do not invent a parameter or rely on the Web UI to coerce it. `create reference` requires `--prompt`.
- The reviewed internal CLI also exposes FLUX 3 for video and Wan 3.0 for video/reference/two-frame transition. Treat them as explicit or capability-driven choices; they do not replace the plugin's membership-aware defaults.
- Global `--region` accepts `global` or `cn`, and `PIXVERSE_REGION` takes precedence. Use one environment-selected region for an entire Canvas workflow; Canvas bindings and paid plans are region-bound.
- Fast path for obvious work: write and preflight the minimal queue in one `queue write --preflight` call, ask for approval when required, run one long-lived `queue run`, then deliver its local files directly. QA is not part of ordinary image/video generation. Use `qa project <slug>` only for requested QA or named checks in a specialized workflow; add `--all-runs` only when that inspection scope is needed.
- For multiple paid creations, use the same quote/run path so slot limits, polling, and manifest logging are handled.
- Before paid queue runs, use `"${PVX}" quote queue <spec.json>` to report planned task/material counts and balance state. Continue automatically by default; stop for batch approval only when effective policy is `require`.
- Retries, reworks, prompt fixes, audio fixes, failed-task replacements, and extra variants are also paid work when they create new PixVerse media; quote and confirm them again.
- Do not use direct `"${PVX}" pixverse create ...` for paid generation. Use `"${PVX}" queue write ... -- pixverse create ...` for a one-task queue spec so preflight confirmation and billing capture happen consistently.
- Generation defaults to automatic execution after preflight, including the first batch. If the user asks to control spending or confirm first, enable project `require`; only that effective policy waits. “Allow future generation” restores project `skip`. Follow `./generation-confirmation.md`; prior receipts do not gate automatic generation.
- Global skip remains available for power users and fully automated workflows with `"${PVX}" preferences quote-confirmation skip`, but only set it after the user explicitly asks to never stop for confirmations globally. Do not offer it in ordinary generation confirmations.
- For narrated videos, generate natural speech sections and align captions to actual audio. Use `subtitles voice-queue` only for an explicit fixed-window take plan; do not create one voice task per caption by default. Use `subtitles style` as the burn-in starting point and honor requested typography. See `audio-craft.md` and `../skills/pixverse-captions/SKILL.md`.
- Use `--no-wait` for queued async creation. Let `pvx queue` poll.
- `queue append --reuse <project-slug>:<task-id>` carries an accepted asset from an earlier manifest into a new queue; it is never submitted or charged and dependents use `{{id.path}}` as usual. Use it for variants, localization and retakes.
- Music has no fixed duration: never pass `--duration-seconds`; trim, loop or fade locally.
- Local, credit-free preparation: `"${PVX}" media probe|frames|tile|boundaries|cut|fetch|transcribe`, `"${PVX}" script parse|measure`, `"${PVX}" timeline build|anchors|captions|render|window`, `"${PVX}" graphics components|render`. See `./reference-breakdown.md`, `./semantic-script.md`, `./word-timing.md`, `./anchored-composition.md`, `./graphics-components.md`.
- Keep prompts under 5000 characters.
- Treat current user uploads as first-class references when the requested output depicts that subject.
- Choose the control layer before the model: image board, I2V, reference, transition, motion-control, extend, modify, upscale, voice/music, or local post.
- A simple prompt-only video stays one direct video task. Add image/storyboard tasks only for an explicitly explained controlled or production route.
- Do not silently downgrade reference-heavy work to pure text-to-video.
- Record generated task ids, URLs, commands, and user-facing role labels in project memory.
- `queue run` downloads successful generated assets under the project and returns an absolute `local_path`. Show generated images/videos from that local file as soon as it exists; ledger reconciliation continues in the same command. Run QA only for an explicit user request or named specialized-workflow checks. Never use the provider URL as the Codex inline preview source.
- After each stage, show `project handoff <slug> --stage <stage-name> --format markdown` so recorded files are inspectable.
- Final recaps must include an invoice-style ledger with task id, model/mode, status, local path, provider URL, and actual or observed credit cost when available.
- Build queue specs incrementally with `queue write` for the first task and `queue append` for dependent tasks. Batch those deterministic commands in one fail-fast host-tool call and add `--preflight` to the last mutation. Avoid hand-writing JSON when a command helper can preserve preflight confirmation and dependency validation.
- Under the default automatic policy or an explicit skip preference, add `--run-if-allowed` to the last mutation to show preflight and enter queue run in the same host call. It stops if the preference does not actually allow the run. Large batches can carry `--deadline-seconds`, `--poll-interval`, and `--status-interval` on that mutation.
- Use `queue plan`, `queue graph`, and `queue run --dry-run` only for complex or suspicious queues. Do not run them by habit before a simple one-task confirmation.
- Resume ongoing work with one `project resume [hint] --format markdown` call; use `project portfolio --format markdown` only when several projects may match.
- For a non-obvious route, use `route recommend --kind <image|video> ... --format markdown` before composing the queue.
- Seedance 2.5 is the default at 1080p, including ordinary 4–15 second shots and its expanded 16–30 second/reference domain. Apply the prompt-enhancement skill. If the runtime lacks it, refresh setup. Omit `--audio`, `--no-audio`, `--multi-shot`, and `--off-peak`; keep sound/cuts in the prompt. Mute the final export if silence is required. Ordinary generation adds no automatic QA.
- `pixverse miniapps list/info` are read-only inspection. Do not invoke paid `miniapps create` until pvx has a dedicated queue/preflight/receipt wrapper for it.
- Use `route queue <queue.json> ... --preflight` for a direct one-task route. Add `--mode board-to-video` only when the user explicitly accepts the extra paid control image and no board-selection checkpoint is needed.
- Keep `--membership-tier auto`. Free/Basic stops for upgrade or explicit fallback consent; show the clickable subscription link. Unknown membership blocks paid work. See `./quality-policy.md`.
- `authentication_required` means no generation started: run `"${PVX}" pixverse auth login --json`,
  open its emitted OAuth URL in Codex IAB, then run `doctor` and preflight again.
  `membership_route_required`/`membership_required` is an entitlement failure, not a prompt
  failure: stop, show the clickable subscription link and wait for upgrade or explicit fallback
  choice before preparing a fresh preflight.
- `"${PVX}" pixverse subscribe` returns the PixVerse subscription-page IAB handoff. Do not trigger it
  unless the user wants to recharge or upgrade.
- `"${PVX}" preferences membership-routing unrestricted-test` is only for an explicitly confirmed internal test account whose displayed Free/Basic label does not reflect its real capability. It never skips login, balance, quote, or approval.

## Setup

```bash
"${PVX}" setup status
"${PVX}" doctor
"${PVX}" bootstrap --yes
# Only when login is needed; a version upgrade does not require reauthorization.
"${PVX}" pixverse auth login --json
"${PVX}" pixverse auth status --json
"${PVX}" doctor
```

`bootstrap --yes` installs or refreshes `pixverse@latest` in the plugin-owned runtime and accepts any version `>=1.4.0`. Do not use `npm install -g pixverse` for this plugin.

## Creation Command Fragments

For a one-off paid task, wrap the command fragment first:

```bash
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind <image|video> --membership-tier auto --prompt "..." --preflight --format markdown
```

For an explicitly approved board-to-video shot whose board does not need an intermediate selection:

```bash
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind video --intent final --mode board-to-video --board-prompt <board-prompt-or-file> --prompt <video-prompt-or-file> --preflight --format markdown
```

For long prompts, save a prompt file first and pass the file path to `--prompt`:

```bash
"${PVX}" project prompt <slug> hero-video --kind video --text "..."
"${PVX}" queue write projects/<slug>/queue.json --project <slug> --id hero -- pixverse create reference --prompt projects/<slug>/prompts/hero-video.txt
```

For a dependent task, append it after the task it references. PixVerse-generated assets must stay inside the provider media store via `{{board.path}}`; do not feed their public URLs back into PixVerse, because that downloads and re-uploads the file and can hit the 10 MB upload limit. Direct user assets can still be local paths or external URLs. Placeholders are also treated as dependencies, and legacy internal `.url` placeholders are normalized to `.path` when loaded. The queue does not probe every internal reference before submission: only an explicit, pre-submission PixVerse image-limit error causes the generated image to be cached locally and retried once through the CLI's built-in local-image resize path.

```bash
"${PVX}" queue append projects/<slug>/queue.json --id film --label "Seedance reference film" --preflight --format markdown -- pixverse create reference --model seedance-2.5 --images "{{board.path}}" --prompt "..."
"${PVX}" queue graph projects/<slug>/queue.json
```

The following `pixverse create ...` lines are queue `cmd` fragments or the command after `--` in `queue write` / `queue append`. Do not run these fragments directly for paid generation.

```bash
pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high --aspect-ratio 9:16 --prompt "..."
pixverse create video --model seedance-2.5 --quality 1080p --duration 15 --aspect-ratio 9:16 --prompt "..."
pixverse create video --model seedance-2.5 --quality 1080p --duration 20 --aspect-ratio 9:16 --prompt "..."
pixverse create video --model flux-3.0 --quality 1080p --duration 10 --aspect-ratio 2:1 --audio --prompt "..."
pixverse create reference --model wan-3.0 --quality 1080p --duration auto --audios ./voice.wav --prompt "Animate to the supplied speech..."
pixverse create video --image ./frame.png --prompt "slow push-in..."
pixverse create reference --model v6 --quality 540p --images ./char.png ./prop.png --audio --prompt "@image1 holds @image2... This video should not generate any music, background music, score, melody, rhythmic bed, or trailer-style musical hit. Only generate synchronized sound effects and environmental ambience for what is visible in the shot."
pixverse create transition --images ./first.png ./last.png --prompt "..."
pixverse create extend --model v6 --video <video_id> --prompt "continue..."
pixverse create modify --model v5.5 --video <video_id> --prompt "change..."
pixverse create upscale --video <video_id> --quality 2160p
pixverse create motion-control --model v5.6 --image ./character.png --video ./motion.mp4
pixverse voice presets --model speech-2.8-hd --language zh --json
"${PVX}" subtitles clean projects/<slug>/prompts/narration.srt projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles inspect projects/<slug>/prompts/narration.clean.srt
"${PVX}" subtitles style --format force-style
"${PVX}" subtitles voice-queue projects/<slug>/prompts/narration.clean.srt projects/<slug>/voice-queue.json --project <slug> --segments-dir projects/<slug>/prompts/tts-segments --voice-id <preset_voice_id> --language zh --speed 0.9
pixverse create voice --model speech-2.8-hd --voice-id <preset_voice_id> --text "..."
pixverse create voice --model speech-2.8-hd --voice-id <preset_voice_id> --text ./projects/<slug>/prompts/narration.txt
pixverse music models --json
pixverse create music --model music-2.6 --prompt "..." --instrumental
pixverse create music --model lyria-3-pro-preview --prompt "Instrumental cue inspired by these references" --image ./mood-1.png ./mood-2.png --instrumental
```

Lyria 3 Pro supports image references, instrumental mode, and auto lyrics; put lyric-like instructions in `--prompt` because Lyria does not support a separate `--lyrics` value.

## Project Slugs, Deadlines, And Idempotency

Three rules that have each already cost real credits. Read them before any large batch.

### `--project` takes a slug, not a path

```bash
"${PVX}" queue run projects/<slug>/queue.json --project projects/<slug>   # WRONG
"${PVX}" queue run projects/<slug>/queue.json --project <slug>            # right
"${PVX}" queue run projects/<slug>/queue.json                             # better: let the spec say
```

A path-like `--project` is now rejected. It used to be folded into a slug, so `--project projects/foo`
silently wrote to `projects/projects-foo/` -- a parallel project tree nobody looks in. Four completed,
billed videos (1152 credits) were stranded there. `--project` may also no longer contradict the
`project` field inside the spec.

The `projects/` tree is resolved by walking **up from the current working directory** to the nearest
`.git` / `pyproject.toml` / `README.md`. Run pvx from a different directory and the same slug lands in
a different tree. `queue run` echoes `project_path` and `repo_root` -- read them; do not assume.

### `--deadline-seconds` is one clock for the whole queue

It is **not** a per-task timeout. It is a single wall-clock budget for the entire batch, evaluated once
before polling starts. Default **1500s (25 min)**. When it expires, every unfinished task is done being
waited on -- however many are left.

Set it explicitly for anything large:

```
--deadline-seconds = ceil(tasks / video-concurrency-slots) * 900 + 600
```

**Measured anchor:** a 44-task v04 batch took **5047s of wall clock (84 minutes)** -- 3.4x the default.
Run that batch on the default and the tail of the queue is guaranteed to be abandoned mid-flight.

Hitting the deadline says nothing about any individual task. A task that was already submitted has
already been **billed**, and PixVerse keeps working on it after pvx stops watching. Such tasks are now
recorded as `deadline_unresolved` (outcome unknown), never `failed`, re-checked once for free, and
listed in `pending-reconcile.jsonl`. Only tasks that were never submitted -- which cost nothing -- are
recorded as failed (`deadline_not_submitted`).

### Recovering tasks the queue lost track of

```bash
"${PVX}" queue reconcile <slug> --dry-run   # list what would be re-checked
"${PVX}" queue reconcile <slug>             # re-check and append recovered results
```

Free and read-only; spends no credits. Use it after a deadline, a crash, or a Ctrl-C. It re-checks every
task that was submitted but never reached a terminal state and **appends** any recovered success to the
manifest. It never rewrites an existing line. Do not conclude a video is lost until you have run it.

### Idempotency: reruns are free, edits are not

pvx injects `idempotency-key = sha256("<spec project>:<task id>:<command>")[:32]`. PixVerse dedupes on
that key.

- **Rerunning the same spec unchanged after a deadline or crash does not charge you again** -- the key
  matches and the original task is returned.
- **Changing one character of the prompt changes the key, and that is a new paid generation.** So is
  renaming the task id or the project. Retry first, edit second -- never both at once, or you pay for a
  new task and cannot tell which change mattered.

## Status And Assets

```bash
pixverse task status --ids 123,456 --type video --json
pixverse task status 123 456 --type video --json
pixverse task wait 123 --type video --json
pixverse asset info 123 --type video --json
pixverse asset download 123 --type video --dest ./projects/<slug>/assets/videos
pixverse asset list --type image --json
pixverse account usage --type used --limit 20 --json
```

For invoices, map usage `video_id` to generated task ids and sum all matching `credits` rows. A single task can have more than one usage row, and `asset info` may omit or under-specify cost.

## Useful Defaults

| Need | Good starting point |
|---|---|
| Explicitly accepted image fallback | `gemini-3.1-flash-lite`, `1080p` |
| Explicitly accepted video fallback | `v6`, `540p` |
| Intermediate video-control board | `gpt-image-2.5-sunburst`, `1440p` (2K), `detail-level=high` |
| General final still | `gpt-image-2.5-sunburst`, `1440p`, `detail-level=high` |
| Alternate final still | Nano Banana 2 / Pro, `1440p` |
| Explicit high-resolution delivery | `2160p` only when requested; never the automatic control-board setting |
| Fast video draft / preview | `seedance-2.5`, `1080p` |
| Serious reference-heavy video | `seedance-2.5`, `1080p` |
| 16–30s / automatic duration-framing / 10–30 image references | `seedance-2.5`, up to `1080p`, sound intent in prompt; inspect native audio |
| Product / brand / automotive hero | Sunburst 2K/high board -> `seedance-2.5` reference |
| Broad native alternative after user choice | `v6`, capability-checked quality |
| Vertical social | `9:16` |
| Product / UI / poster boards | image first, then video from selected board |
| Character consistency | reference mode with explicit identity anchors |
| Film/trailer synced SFX/ambience | Seedance 2.5 uses prompt sound directions without an audio flag; specialized sound QA only when required |
| Voiceover | `speech-2.8-hd` with an explicit `--voice-id` from `pixverse voice presets` |
| BGM | `music-2.6` instrumental unless lyrics matter; assume auto-duration, trim/fade/loop locally |

## Failure Classes

| Signal | Agent response |
|---|---|
| auth/login error | Run `pixverse auth login --json`, open its emitted URL in Codex IAB, and do not retry blindly |
| membership/entitlement required | Do not rewrite the prompt or retry; show the subscription link and wait for upgrade or explicit v6 540p / Nano Banana 2 Lite fallback consent, then re-preflight |
| insufficient balance | Stop paid generation and explain where it stopped |
| concurrency/queue | Wait, poll slots, retry later |
| CLI exit code `7` | Concurrency limit; wait for a slot and retry the same intent |
| prompt too long | Shorten prompt, keep identity locks |
| parameter invalid | Fix flags/model compatibility |
| moderation/rejected | Rewrite safer prompt, preserve creative intent |
| timeout | Check task status and asset library before declaring lost |
| `submit_timeout_unknown` | No task id returned, but the request may have reached PixVerse. Do not retry automatically; inspect account usage/assets and the recorded idempotency key before spending again |
| `deadline_unresolved` | Submitted and billed; outcome unknown, NOT failed. Run `queue reconcile <slug>` before retrying, or you pay twice |
| `deadline_not_submitted` | Never submitted, so never billed. Safe to rerun the same spec |
| generation_failed with a reference stack | Suspect an input image, not the prompt. Bisect the stack by removing one image at a time; change nothing else |
