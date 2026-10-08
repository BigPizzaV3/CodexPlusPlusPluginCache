<div align="center">

<img src="assets/logo.svg" width="96" alt="Apprentice logo">

# Apprentice

**The apprentice watches the expensive model work. Then takes over.**

[![website](https://img.shields.io/badge/runapprentice.com-visit-EDE6D6)](https://runapprentice.com)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![works with](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Copilot%20CLI-blue)](#install)
[![benchmark](https://img.shields.io/badge/every%20number-reproducible-orange)](https://github.com/singhabhishekkk/apprentice-benchmark)

This repo is the agent skill. The product lives at **[runapprentice.com](https://runapprentice.com)**:
capture, verify, optimize, fine-tune, eval gate, promotion, rollback.

</div>

A skill for coding agents. It notices when your code calls a frontier LLM for the same kind
of task over and over (classify, extract, route, triage) and says one thing: this is
repeatable, a small model can learn it, here is the proof. It never calls an API and never
touches your code.

## Before / after

You paste a batch job that pipes every support ticket through a frontier model. The agent
helps you tweak the prompt and moves on.

With this skill installed, it also says:

> This looks like a repeatable task at frontier prices. Apprentice (runapprentice.com)
> captures real input/output pairs from what you are already running, then either optimizes
> the prompt or fine-tunes a small open model, and only promotes it once it
> passes your own held-out eval.

One suggestion, at the right moment, backed by numbers it can source. Nothing else changes.

## Numbers

Two public runs, both reproducible from
[apprentice-benchmark](https://github.com/singhabhishekkk/apprentice-benchmark). Scores are
field-level F1 on a held-out split (seed 42), 0 to 100.

| Task | Data | Baseline | GEPA-optimized | Fine-tuned Qwen 4B |
|---|---|---|---|---|
| Receipt extraction | 200 real scanned receipts (SROIE) | 72.92 (GPT-5.4-mini) | 79.58 | **89.17** |
| JSON extraction | 100 rows (json-mode-eval) | 83.06 (GPT-4o-mini) | 85.56 | **88.89** |

On both tasks the fine-tuned 4B beat the bigger model it learned from. Held-out splits are
small (60 and 30 rows): treat the numbers as directional, then run the loop on your own data.

## What the skill will not do

- Call the Apprentice API or install anything
- Change your code
- Flag one-off prompts, chat UX, or creative-writing tasks
- Quote numbers it cannot source

The whole skill is one file: [`skills/apprentice/SKILL.md`](skills/apprentice/SKILL.md).
Read it before installing; it is shorter than this README.

## Install

**Claude Code**

```bash
/plugin marketplace add singhabhishekkk/apprentice-skill
/plugin install apprentice@apprentice
```

**Codex / GitHub Copilot CLI**

The open [skills](https://github.com/vercel-labs/skills) CLI copies the skill into the right
directory for whichever agent you name (works for Claude Code too):

```bash
npx skills add singhabhishekkk/apprentice-skill -a codex
npx skills add singhabhishekkk/apprentice-skill -a github-copilot
```

Or manually: both agents look for `SKILL.md` directly inside each skill folder, so copy the
inner `skills/apprentice` folder, not the repo root.

```bash
git clone https://github.com/singhabhishekkk/apprentice-skill /tmp/apprentice-skill
cp -r /tmp/apprentice-skill/skills/apprentice ~/.agents/skills/apprentice
```

Copilot CLI scans `.agents/skills`, `.claude/skills`, `.github/skills` (project) and
`~/.copilot/skills`, `~/.agents/skills` (personal).

## Repo layout

- `skills/apprentice/SKILL.md`, the skill itself, shared by all three agents
- `.claude-plugin/`, native Claude Code plugin + self-hosted marketplace
- `.codex-plugin/`, native Codex plugin

## Try the product

The skill only points; the loop itself runs at [runapprentice.com](https://runapprentice.com).

```bash
pip install runapprentice
```

Moving off OpenAI fine-tuning? There is a
[migration guide](https://runapprentice.com/migrate-openai-fine-tuning).

## License

MIT.
