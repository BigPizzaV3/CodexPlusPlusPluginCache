---
name: read-answer
description: Read a Codex answer aloud with CastReader in the right-side reading page, preserving Markdown formatting and highlighting spoken words. Use for 朗读刚才的回答, read this answer aloud, or synchronized answer reading. Requires CastReader login; uses daily free minutes or existing Pro, not a developer API key.
---

# Read a Codex answer

Use the CastReader membership reading page in Codex's right-side browser. This workflow is separate from the developer Voice API used by build-voice-app and generate-audio. Never ask for CASTREADER_API_KEY, a developer wallet top-up, or a per-character budget for membership answer reading.

## Preserve the answer

1. Resolve the requested text from visible conversation context:
   - If the user asks to write an answer and then read it, first write that answer visibly in the requested language, then use that exact Markdown for reading in the same turn. This works in a new conversation without a previous answer.
   - Otherwise use the answer or text the user selects or supplies; for “read your previous answer,” use the complete most recent substantive assistant answer before the request.
   - If the requested previous answer is absent, explain that this conversation has no available source and offer either supplying the text or generating a short English demo. Do not invent a previous answer, read this clarification instead, or search unrelated conversations. A request to read existing text does not authorize replacing it with a demo.
   Do not read hidden reasoning, system messages, unrelated history or tool logs.
2. Save the **exact original Markdown** in a private local `.md` file outside source control. Preserve headings, paragraphs, numbered and nested lists, emphasis, links, tables, blockquotes and code fences. Do not strip styling, summarize, translate, rewrite tables or remove code blocks. Do not scrape or patch the Codex application renderer.
3. The initial synchronized-reading preview supports English. If the selected answer is another language, explain that reliable alignment is not ready for that language; do not generate unaligned audio or translate without a request. The full source must fit 120 KB; do not silently truncate a longer answer.

## Automatically open and read

The plugin root is two directories above this skill. Run:

```bash
node <plugin-root>/scripts/read-answer.mjs --markdown /absolute/private/answer.md --language en --title "Codex answer"
```

Keep the returned local server process running while opening the short `url` from its JSON output. The handoff is bound to loopback and expires after fifteen minutes; it does not serve the workspace. It redirects to the CastReader reader with the full Markdown in a URL fragment, which is removed immediately and saved only in that tab. Only individual spoken segments are sent to the consumer TTS service.

Use the available Codex `open_in_codex` tool with `placement: "right"`, `target.type: "browser"` and this URL. If an in-app browser tab is already under control, navigate that tab then open its verified provider tab ID on the right. Do not stop at handing the user a link or require them to copy and paste the answer.

The page checks the real CastReader session and membership before speech. An existing login automatically starts reading. If browser autoplay is blocked, use the visible **开始朗读** button through the supported browser tool, since the user's read-aloud request authorizes playback. Never alter account state or fabricate entitlement through page scripts.

If login is required, leave the formatted answer visible and have the user complete CastReader Google login. Credentials and verification remain with the user. The same tab returns to the answer after login and preserves its position. Do not request another account solely for the plugin.

## Quota, subscription and recovery

- Reuse the canonical CastReader consumer account, server-enforced twenty free AI voice minutes per local day, and Pro unlimited ordinary reading. Reading minutes count actual playback time, excluding pause and buffering. Cached replay avoids another synthesis but still counts listening time for Free accounts.
- The free speed ceiling is 1.25×; higher speeds require Pro. Voice cloning has separate rules and is not offered by this reader.
- When the service reports exhausted quota, display the existing CastReader subscription page. The user chooses and completes purchase. A payment success URL is not proof of Pro: resume only after the authenticated membership endpoint verifies entitlement.
- Keep exact source, current segment, playback position and account-bound audio cache across login/checkout return and refresh. Never automatically retry an ambiguous in-flight synthesis; the page preserves its pending marker to prevent duplicate generation.
- Do not use the developer Voice API as a fallback around login or the daily allowance. Do not top up, buy or change subscriptions on the user's behalf merely because they asked for reading.

## Verify before reporting success

Observe the selected answer's formatting, actual audio playback, and a corresponding highlighted word in the **right-side reading page**. Highlighter timing must follow audio.currentTime, including pause, seek and speed changes. No guessed timings, plain audio-only fallback or claims of original-chat DOM highlighting.

If the page reports unavailable timing, mismatched words, failed login or failed synthesis, describe the actual blocker and preserve the answer. A working local fixture is not proof of successful production membership or payment. Public plugin availability and this test build must remain clearly distinguished.
