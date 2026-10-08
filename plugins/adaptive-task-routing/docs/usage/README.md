# Adaptive Task Routing — User Guide

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

**Know what to do next—and when no change is needed.**

Adaptive Task Routing assesses the conversation, model and reasoning settings at meaningful task boundaries. It first shows the action to take now, then a short reason. A model that fits the task is not automatically worth switching to midway through the work.

It weighs task needs, current suitability, remaining work, context continuity and switching costs. Keeping an adequate setup is a valid outcome. Unknown settings warrant provisional wording, not a claim that they have been verified. Actual savings and reliability improvements require evidence.

## How it works

1. The AI delivers the findings you requested or presents an actionable plan.
2. The routing note leads with an action: keep, keep provisionally, start a new conversation, change settings, or request a necessary decision. It still answers whether a new conversation is needed when context routing is enabled.
3. Default `ask` confirms changes and material blockers. Retention and nonblocking uncertainty do not interrupt already authorized work. A request for a plan never authorizes implementation.

Brief questions and unchanged phases skip routing. The plugin considers conversation and model choices separately; a handoff can also need a different model.

## Install

### Gemini CLI

```bash
gemini extensions install https://github.com/zyzdev/adaptive-task-routing-gemini --ref v0.5.0
```

Restart Gemini CLI after installation.

### Claude Code

The public directory submission is under review. Until it is listed, clone the dedicated repository and start Claude Code with the plugin directory:

```bash
git clone --branch v0.5.0 https://github.com/zyzdev/adaptive-task-routing-claude.git
claude --plugin-dir "$PWD/adaptive-task-routing-claude"
```

### ChatGPT and Codex

Download `adaptive-task-routing-openai-0.5.0.zip` from the [v0.5.0 release](https://github.com/zyzdev/adaptive-task-routing/releases/tag/v0.5.0). In a surface that supports local plugins, add the extracted plugin through its plugin or marketplace interface. Public directory availability is subject to OpenAI review.

## First use

Start a fresh conversation after enabling the plugin. For example:

> Review this project and propose an improvement plan. Do not edit files yet.

If needed, ask explicitly to use the adaptive-task-routing Skill. The AI should deliver the plan before the routing note; this request does not authorize implementation.

## What you will see

These are separate scenarios following the requested plan or findings. The keep example assumes the checks are already authorized; a plan-only request ends with the plan instead. Models and native reasoning options are illustrative and depend on the platform. A current-setting line requires an actual observation.

**When changing is not worthwhile**

```text
---

### Adaptive Task Routing

✓ Keep current

The current setup is sufficient, and little work remains to repay a switch.

Conversation: Stay here; no new conversation needed.
Current AI: GPT-5.6 Sol / high.

No action needed. Continuing the already authorized checks.
```

**When a change is worthwhile**

```text
---

### Adaptive Task Routing

Change AI setting

The next phase needs stronger validation than the observed setup provides.

Conversation: Stay here; no new conversation needed.
Task-fit setting: GPT-6 Astra / high.

Use GPT-6 Astra / high?
```

The control depends on the host. `auto` reports an applied change only after verification; it explains the actual fallback when no control is available. Missing current metadata instead uses “Keep provisionally,” a useful task-fit setting and a short uncertainty reason. A material blocker gets a concrete question.

For a plan-only request, the ending says the plan is complete and implementation has not started. For a handoff, the note answers “Conversation: Start a new conversation with the necessary handoff, pending your decision” and supplies only the facts and constraints needed in the destination.

## Modes and detail

| Mode | Behavior |
| --- | --- |
| `ask` (default) | Ask before a proposed change or a material blocker. Retain/nonblocking defer continue only already authorized work. |
| `auto` | Apply justified changes only through authorized, supported and verifiable controls. Explain fallbacks; do not proceed through a material blocker. |
| `off` | Skip the selected router and its output. |

Context and Model modes are independent. Say “Turn context routing off for this task,” “Set model routing to ask,” or “Use auto for both routers in this conversation.” A mode change alone does not authorize work.

Compact is the default display. Ask “Show the details” to see **Minimum needed**, **Task-fit setting** and the upgrade rationale. Task fit answers what suits the phase; the action answers what to do now. Details reuse the current assessment. Switch scores remain diagnostic; compact/detailed are not additional routing modes.

Verified keep shows only the observed current AI in compact; task-fit alternatives are reserved for details. Provisional keep can also reflect uncertain switching costs or benefits, even when the current AI is known.

## What are recommendations based on?

- **Conversation context:** Assesses which information the next task needs and whether old assumptions or constraints might interfere, then recommends staying, handing off relevant information, or starting fresh.
- **Model and reasoning effort:** Considers task difficulty, ambiguity, error cost, and verification needs to provide minimum-sufficient and task-fit settings and explain whether an upgrade is worthwhile.
- **Model information:** Prioritizes information available from the current environment. When unavailable, uses valid bundled references appropriate to the platform. A reference does not guarantee that your account can select that model.

See [Design and architecture](../architecture.md) for the full decision principles and platform limitations.

## Explicit activation

- Codex surfaces with Skill mentions: `$adaptive-task-routing`
- Claude Code: `/adaptive-task-routing:adaptive-task-routing`
- Other surfaces: ask, “Use the adaptive-task-routing skill before starting this work.”

## Remove

Gemini CLI:

```bash
gemini extensions uninstall adaptive-task-routing
```

For Claude Code started with `--plugin-dir`, exit the session and delete the cloned directory. For ChatGPT or Codex, remove or disable the plugin from the same plugin or marketplace interface used to install it.

## Troubleshooting

- Start a new conversation after installing or updating.
- Confirm that `adaptive-task-routing`, `task-context-router`, and `research-model-router` appear in the Skill inventory.
- If no recommendation appears, try explicit activation once.
- A recommendation does not prove that the host changed the model or conversation. Automatic changes are reported only after verification.

For development and validation details, return to the [development guide](https://github.com/zyzdev/adaptive-task-routing/blob/main/DEVELOPMENT.md).
