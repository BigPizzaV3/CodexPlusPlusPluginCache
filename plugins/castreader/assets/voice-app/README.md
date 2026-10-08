# Multilingual flashcards — complete local app

Edit a batch of short phrases, choose a ready voice, review its estimated cost,
explicitly generate, and replay or download the saved MP3s. The starter includes
a browser UI, a localhost Node.js server, the original checkpointed CLI, and
offline tests. It has no build step or UI/server framework dependencies.

The 20 starter rows contain five everyday phrases in English, Chinese, Japanese
and Spanish. Each row supplies its own text and language; the API does not
translate. This app runs queued jobs sequentially, one per card.

## Start the browser app

Requirements: Node.js 22+, an activated CastReader Voice API workspace, and a
server API key with `voices:read`, `speech:generate` and `usage:read` permissions.
Activate your account at <https://voice.castreader.com/request-access> and create
your key in the console. Choose only voices you are authorized to use.

Unzip `starter.zip`, open a terminal in its folder, then run:

```sh
npm install
npm start
```

Open **http://127.0.0.1:8791**. You can edit cards without a key. To connect, stop
the app and set `CASTREADER_API_KEY` in that terminal's environment or through
your secret manager, then run `npm start` again. On macOS/Linux, enter the key
at a hidden prompt (the key itself is not a shell command):

```sh
read -r -s CASTREADER_API_KEY
export CASTREADER_API_KEY
npm start
```

`.env` files are not loaded automatically. Never paste keys into the browser,
source files, URLs or a public report. The SDK installs directly from the
official `voice.castreader.com` download, pinned to **0.2.3**; it is not installed
by an npm registry package name. No SDK upgrade is required for this starter.

1. **Load ready voices.** The local server reads the API's model and voice lists
   using its key. The browser receives only ready voice IDs and display names.
   The SDK returns the first voice page; the app tells you if more exist.
2. **Edit text and language**, add/remove cards, and give the batch a title.
   The API does not translate text or silently change its language.
3. **Save plan & estimate.** This validates every row, checks the chosen voice,
   and calls the non-reserving estimate endpoint for each row. It saves an
   immutable batch; no generation is submitted.
4. **Review the cost, check the approval box, then Generate saved batch.**
   Normal usage charges apply. This is the only action that starts jobs.
5. Follow per-card progress. **Load player**, **Download**, **Manifest**, and
   **Download all · ZIP** read checksum-verified local files. They make no
   upstream requests and cannot trigger generation or an account recharge.

Closing the tab does not stop an active batch. Keep the terminal running.
Ctrl-C stops accepting browser requests and finishes the active batch before
exiting. A hard kill interrupts local waiting, but does not cancel a server job.

## Saved batches and recovery

The app stores private batches outside the starter folder and any website's
`public` directory, under your OS home directory:

```text
.castreader-flashcards/
  .server-running                 # app process lock
  batches/<generated-batch-uuid>/
    batch.json                    # frozen text, language, voice and estimate
    execution.json                # local run status; sanitized errors only
    state.json                    # original job IDs and idempotency keys
    .running                      # present while the CLI runner owns this batch
    <card-id>.mp3
    manifest.json
```

Reopen the same app and choose the original entry under **Saved batches**.
Review it, check the approval box and use **Resume original batch**:

- Completed files with matching hashes are reused with no API calls.
- Missing/corrupt files are downloaded from their original job.
- An uncertain submission reuses its saved idempotency key. The app disables
  SDK submission retries so the next attempt is an explicit resume.
- A failed, cancelled or expired job stops the batch. Resume checks that same
  job; it never silently replaces it. Not-yet-started cards can still be
  submitted when a batch resumes, as covered by the approval checkbox.
- Changed text or voice requires a new plan and a separate explicit generation.
  Keep the old batch to recover its jobs. A new batch can incur new charges.

Only one app process may use this data directory, and only one batch runs at
a time. A hard kill may leave `.server-running` and a batch's `.running` lock.
Read the PID in each lock and confirm that the earlier process has stopped
before manually removing **those exact lock files**. Do not delete `state.json`
or the batch folder. The app never automatically removes stale locks; a started
batch with a missing checkpoint is blocked pending restoration of its files.

Keep a private backup of the entire batch folder. Retained API audio is available
for at most 24 hours; download promptly. If the original result expired and the
local file is missing, recovery stops. Deliberate regeneration requires a new
batch and may cost again. Public exports include only audio and a manifest of
text, language, filenames, SHA-256 hashes and returned usage; they exclude keys,
job IDs, idempotency keys and private voice IDs.

## Limits, estimates and local security

The app accepts 1–200 rows, each with 1–500 NFC-normalized Unicode code points,
and applies any smaller model limit returned by the API. IDs are unique,
lowercase and filename-safe. Requests are capped at 512 KiB. The server rechecks
all input; browser form validation is only a convenience.

The browser plan sums the API's `maximum_charge_usd` for every row, **before
trial credit**. It does not add per-row trial snapshots together: those snapshots
could otherwise count the same remaining credit multiple times. A passing
per-row balance check does not guarantee enough balance for the whole batch;
prices, quotas, balance and availability can change after planning. The app
does not reserve funds, adjust quotas, recharge an account or promise capacity.

The server binds only `127.0.0.1`. Host must match the exact printed IP and port;
cross-origin requests are rejected, writes require the exact Origin, and API
requests require a random CSRF token obtained through same-origin bootstrap.
Static files use an explicit allowlist and a restrictive Content Security
Policy. There are no browser-supplied paths, upstream URLs or key inputs. The
SDK uses its official production origin and allowlisted regional routing.
The interface follows your browser language (English or Chinese); use the header's
language selector to switch without changing synthesis language or routing.
Set `FLASHCARDS_DATA_DIR` in the server environment to choose a private data
directory for a separate installation or test; HTTP requests cannot choose paths.
Use `PORT=8792 npm start` if the default port is occupied; a wildcard or LAN
bind address cannot be configured. Do not reverse-proxy or expose this app.
This is a single-user local development template, not a multi-user hosted app.

Local result ZIPs are capped at 128 MiB; larger batches can be downloaded as
individual clips plus a manifest. Downloading a result verifies its hash first.
Review pronunciation and voice similarity before publishing. These starter
phrases are not a certified language course or a native-speaker quality claim.

## Original CLI

The original runner and its checkpoints are unchanged:

```sh
node generate.mjs --plan
node generate.mjs --run
```

`--plan` is completely offline and uses the reference rate of USD 8/million
normalized characters before trial credit; confirm current pricing before
`--run`. CLI-only variables: `VOICE_ID` (defaults to ready Rowan), `CARDS_FILE`
(defaults to `cards.json`), and `OUTPUT_DIR` (defaults to `output`). The browser
server ignores these variables and never accepts paths from HTTP requests.
Existing CLI output folders stay recoverable with the CLI; they are not imported
into browser history automatically.

## Tests and download verification

In the extracted starter, run `npm test`. All tests use local fake clients;
they never submit live generation, recharge, deploy or publish. In the monorepo,
run `node --test apps/voice-api/scripts/flashcards-example.test.mjs`.

`starter.zip` contains the source, the same offline tests and
`source-checksums.json`, an SHA-256 map of its exact source entries. The sibling
`checksums.json` records the SHA-256 of `starter.zip` and `results.zip`.
The packaging script uses a fixed file allowlist, verifies the 20 original
audio hashes, and excludes secrets, dependencies, local batches and checkpoints.
`results.zip` is the separate existing set of **20 real saved clips**, not
output from the offline tests. Rebuilding the starter does not generate audio.

## 中文快速说明

解压后运行 `npm install` 和 `npm start`，打开 `http://127.0.0.1:8791`。
API Key 只通过终端环境变量 `CASTREADER_API_KEY` 设置，绝不填入网页。
先加载可用授权音色，编辑每张卡的文本和语言，保存计划并查看费用；勾选费用
确认后才会生成。计划按每张卡的后端最高费用合计，不重复抵扣免费额度。

批次私密保存在用户主目录 `.castreader-flashcards/batches`。重新启动后打开
同一个已保存批次，恢复原 job 和幂等键。播放、下载单文件或 ZIP 只读本地结果，
不会重新生成。请保留 `state.json`；强制退出后，确认旧进程已结束，才可删除
对应锁文件。失败或过期任务不会自动创建替代任务，也不会自动充值。

Guide: <https://voice.castreader.com/guides/multilingual-flashcard-audio>
Docs: <https://voice.castreader.com/docs>
Pricing: <https://voice.castreader.com/pricing>
