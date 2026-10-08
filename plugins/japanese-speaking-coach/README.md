# Japanese Speaking Coach for Codex

Japanese Speaking Coach is a voice-first rehearsal plugin for intermediate Japanese learners. It practices real-life interactions, extended explanations, and spoken summaries through a repeatable loop: attempt, focused repair, replay, and variation.

Coaching can be delivered in the learner's preferred language while the speaking task remains in Japanese.

## What it supports

- Real-life conversations in Japan, including phone and in-person scenarios
- Explanations adapted to a listener, purpose, and level of formality
- Spoken summaries of Japanese source material
- Focused feedback without interrupting every error
- Practice with misunderstandings, clarification, and recovery

## Install from a public Git repository

After this folder is published as a Git repository, add the repository as a marketplace and install the plugin:

```bash
codex plugin marketplace add https://github.com/timothy-huang/japanese-speaking-coach.git
codex plugin add japanese-speaking-coach@japanese-speaking-tools
```

Start a new Codex task after installation so the skill is loaded.

## Install from a local checkout

```bash
codex plugin marketplace add /absolute/path/to/japanese-speaking-coach-marketplace
codex plugin add japanese-speaking-coach@japanese-speaking-tools
```

## Try it

- “Rehearse a Japanese phone call and coach me in Traditional Chinese.”
- “Help me explain an idea in Japanese and coach me in Spanish.”
- “Recommend a Japanese speaking task and use English for feedback.”

Voice mode is recommended. The plugin will ask for a genuine first attempt before offering a polished model.

## Repository structure

```text
.agents/plugins/marketplace.json
plugins/japanese-speaking-coach/
  .codex-plugin/plugin.json
  assets/
  skills/rehearse-japanese-speaking/
```

## Privacy and scope

The plugin has no MCP server, external service, authentication requirement, or bundled executable code. It only supplies coaching instructions and image assets to Codex. It is a language-practice tool, not professional medical, legal, immigration, emergency, or financial advice.

## License

Released under the [MIT License](LICENSE).
