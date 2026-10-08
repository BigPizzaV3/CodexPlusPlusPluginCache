# Contributing to Meme Marketing Agent

Thank you for your interest in contributing! Whether you're adding funny doodle line-art templates, expanding dialect banks, refining humor mechanics, or enhancing our anti-slop checks, your help makes meme marketing less cringe and more relatable.

---

## 🛠️ Development Setup

This project uses **[Bun](https://bun.sh)** for JavaScript/TypeScript and **Python 3.11+** for structural validation.

```bash
# 1. Clone repository
git clone https://github.com/imMamdouhaboammar/meme-marketing.git
cd meme-marketing

# 2. Install dependencies
bun install

# 3. Verify CLI execution
bun bin/cli.js --help
bun bin/cli.js list
```

---

## 🧪 Testing & Anti-Slop Verification

Before opening a pull request, ensure all gates and linters pass:

```bash
# Run anti-slop linter (Oxlint)
bun run lint

# Run Python validation unit tests
python3 scripts/test_validate.py

# Run Claude Code plugin tests (manifests, agents, commands, hooks, tune)
python3 scripts/test_plugin.py

# Validate the Claude Code plugin and marketplace manifests
bun run validate:plugin

# Test rendering a doodle template
bun run render --template distracted --caption "Test run" --out test.svg
rm test.svg

# Validate compliant fixture
bun run validate evals/fixtures/valid.json
```

---

## 🎨 Adding New Doodle Templates

1. Place new vector templates in `assets/templates/<name>-doodle.svg`.
2. Follow the minimalist comic line-art aesthetic:
   - Stroke width: `6px` to `8px` rounded strokes.
   - Clean, expressive hand-drawn eyes and mouths.
   - Scalable `viewBox="0 0 1000 650"`.
   - Placeholders formatted as `{{PLACEHOLDER_NAME}}`.
3. Register the template in `scripts/meme-craft.ts` under `handleList` and `handleRender`.
4. Update `README.md` with template previews and descriptions.

---

## 🎭 Expanding Dialects or Humor Mechanics

When adding or tuning regional dialects:
- Ground vocabulary in genuine everyday speech or cinema quotes.
- Never manufacture artificial slang.
- Maintain separate dialect markers: do not mix Egyptian vocabulary into Gulf/Saudi copy or vice versa.
- Add real-world prompt scenarios to `evals/evals.json`.

---

## 📋 Pull Request Process

1. Create a feature branch: `git checkout -b feat/my-cool-feature`.
2. Keep commits concise and descriptive (e.g. `feat: add two-buttons doodle template`, `fix: enforce anti-cringe filter`).
3. Ensure all tests (`bun run lint`, `python3 scripts/test_validate.py`, `python3 scripts/test_plugin.py`, `bun run validate:plugin`) pass. When you change any manifest version, bump all of them together (including the root `plugin.json` Codex mirror); `test_plugin.py` fails on drift.
4. Submit a Pull Request targeting `main`.
