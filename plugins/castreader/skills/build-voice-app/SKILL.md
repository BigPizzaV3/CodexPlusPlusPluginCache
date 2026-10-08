---
name: build-voice-app
description: Build and verify a working text-to-speech feature using CastReader Voice API. Use for adding speech, narration, audio lessons or generated voice files to an application, with server-side credentials and restartable jobs.
---

# Build a voice feature

Deliver runnable code in the user's chosen stack and verify the actual flow through audio playback. The plugin root is two directories above this file.

## Current contract

Read `https://voice.castreader.com/integration-manifest.json` and the relevant part of `https://voice.castreader.com/openapi.json`; `https://voice.castreader.com/llms-full.txt` provides integration context. Paths in OpenAPI can be disabled: check `x-enabled` and the manifest. Current queued input limit is 500 normalized Unicode code points; short `/audio/speech` is 120. Streaming and realtime are disabled. Select the spoken language explicitly; language selection does not translate text.

Use a server-side `CASTREADER_API_KEY` supplied through the environment. Never request secrets in chat or put them in browser code, logs, URLs or version control. Activation is at `https://voice.castreader.com/request-access`; App Pro does not fund API usage.

## Deliver the application

For a new Node.js project, run:

```sh
node <plugin-root>/scripts/create-app.mjs /absolute/path/to/new-voice-app
```

The starter is a working audio-card app with editable text, language and voice selection, estimates, playback, downloads and persistent batches. Read its `README.md`. Run `npm install`, set the server environment, then `npm start`. Its dependency uses the versioned official SDK download; do not substitute an unpublished npm package name. Node.js 22+ is required.

For an existing application, adapt to its framework. Use the starter's `server.mjs` and `generate.mjs` as examples; preserve the user's project. For single audio jobs, copy or import the dependency-free `scripts/voice.mjs` implementation. Keep credentials and synthesis on the backend. Return controlled audio bytes or a protected application-owned result URL to the player. Add input validation and reuse account authorization before exposing a paid endpoint publicly. The starter binds to loopback and is not a public multiuser deployment template.

Resolve `https://voice.castreader.com/v1/route`, then pin work to the resource region. The accepted service bases are `https://voice.castreader.com/v1` and `https://api.castreader.cn/voice-api/v1`. Use SDK 0.2.3 or newer. Saved jobs on the retired China hostname are migrated by the bundled CLI without changing their job or idempotency identity. Use an authorized, ready `voice_...` ID from the account's regional list; catalog IDs and display names are not voice IDs. Voice listing may initialize builtin workspace references without synthesis.

Estimate actual input, display estimated charge and trial usage, and respect the budget. Save the body and idempotency key before POST, then the returned job ID. Continue that job after timeout. Missing downloads are download retries. Never silently create new paid requests for failed, expired or cancelled jobs. Save results within the current retention window (24 hours).

## Verify and hand over

Run relevant application checks, launch it, and inspect the user-facing flow. When credentials and the user's generation authorization are present, test one short clip and verify a decodable file, charge receipt and same-job recovery. Use the user's budget; otherwise disclose a small estimate before the authorized generation. Never top up or change subscriptions.

Without a key, complete and test the local app and use clearly labeled existing public samples only when useful. State that live synthesis is unverified; never label a saved sample as newly generated. Report the start command, behavior, test evidence, actual charge and remaining configuration.
