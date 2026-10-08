---
name: usage
description: Use when the signed-in user asks for current ChatGPT Work or Codex subscription usage, remaining allowances, credit balance, or reset times. On mobile, live checks require a ChatGPT Remote conversation connected to a desktop Codex host. Do not use for OpenAI API billing or token analytics.
---

# Account Usage

Report current ChatGPT Work and Codex subscription usage from the signed-in user's connected host. This is a read-only, latency-sensitive workflow.

## Invocation

- In a Remote Codex conversation, enter `$usage`.
- In a ChatGPT or ChatGPT Work conversation, select `@Usage`, whether or not the conversation is Remote.
- Natural-language requests can invoke this skill implicitly, such as `check my usage`.

## Remote-first execution

Use observable host capabilities and conversation context. Treat the request as Remote-capable when the conversation context explicitly identifies this conversation as Remote or a dedicated signed-in account-usage tool is available. If neither signal is present, follow **Non-Remote fallback** below.

On this Remote-capable path, if a dedicated signed-in account-usage or usage-limits tool is exposed, make a host-native, read-only account-usage call. Call it exactly once and answer from that result.

Do not browse. Do not search the web. Do not inspect GitHub. Do not search for the plugin. Do not open an account dashboard. Do not retry, refresh, poll, or wait. Do not start interactive sign-in. Do not attempt to discover, install, reload, repair, or diagnose plugin capabilities. Do not use shell or computer-use tools.

If the conversation context explicitly identifies this conversation as Remote but no signed-in account-usage tool is available, stop immediately. Say exactly: `Usage needs a ChatGPT Remote conversation connected to a running desktop Codex host.` Do not call any tool on this path. Do not render an empty or `Not shown` table and do not claim that zero usage was found. Do not show the dashboard link.

If the single native call fails, stop. Say: `Usage could not read usage from the connected host.` Include a short host-provided error only when it is safe and useful. Do not make a second call or try another source. Do not show the dashboard link.

Do not use `platform.openai.com/usage` unless the user specifically asks about metered OpenAI API usage or spend. API billing is separate from ChatGPT Work and Codex subscription usage.

## Non-Remote fallback

When the conversation context does not explicitly identify it as Remote and no dedicated signed-in account-usage tool is available, do not call any tool. Reply immediately: `This chat is not connected to Remote. [Open your ChatGPT/Codex usage dashboard](https://chatgpt.com/codex/settings/usage).`

Provide the link in chat; do not open it for the user. An explicitly identified Remote conversation stays on the Remote execution path above and never receives this link.

## Capability and privacy

Use only account data returned by the native usage tool. Never request credentials or attempt authentication. Do not inspect unrelated account data, conversations, files, browser tabs, or desktop content. Do not modify account settings, buy credits, or consume usage-reset credits.

## Report

Only render a result after the verified native account-usage tool returns data. Include every returned usage bucket, its label, `usedPercent`, window duration, and reset time. Include plan and credits only when the source supplies them.

Return a compact table with `Allowance`, `Used`, `Remaining`, and `Resets` columns. If the source supplies only `usedPercent`, `remainingPercent = 100 - usedPercent` may be the only permitted calculated value; label it `calculated`. Do not calculate or infer any other missing value. Omit unavailable cells or columns instead of displaying placeholders.

Add `Source: connected Codex host` and the local check time. Preserve the source's exact distinction between used and remaining values.
