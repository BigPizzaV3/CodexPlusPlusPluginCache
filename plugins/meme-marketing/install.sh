#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_NAME="meme-marketing"

echo ""
echo "🎭 ========================================================="
echo "   Meme Marketing: Fully Agentic Meme Crafting Engine"
echo "   Universal Multi-Agent Installer"
echo "========================================================="
echo ""

# 1. Claude Code
if [ -d "$HOME/.claude" ] || command -v claude >/dev/null 2>&1; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$HOME/.claude/skills/${TARGET_NAME}"
  cp -r "$SCRIPT_DIR" "$HOME/.claude/skills/${TARGET_NAME}"
  echo "  ✅ Installed for Claude Code -> $HOME/.claude/skills/${TARGET_NAME}"
  echo "     Loads as a local plugin (skill + subagents + commands + hooks) on the next session."
  echo "     For auto-updates use: /plugin marketplace add imMamdouhaboammar/meme-marketing"
fi

# 2. Antigravity / Gemini CLI
if [ -d "$HOME/.gemini" ]; then
  mkdir -p "$HOME/.gemini/config/skills"
  rm -rf "$HOME/.gemini/config/skills/${TARGET_NAME}"
  cp -r "$SCRIPT_DIR" "$HOME/.gemini/config/skills/${TARGET_NAME}"
  echo "  ✅ Installed for Antigravity / Gemini CLI -> $HOME/.gemini/config/skills/${TARGET_NAME}"
fi

# 3. OpenAI Codex / OpenCode
if [ -d "$HOME/.codex" ]; then
  mkdir -p "$HOME/.codex/skills"
  rm -rf "$HOME/.codex/skills/${TARGET_NAME}"
  cp -r "$SCRIPT_DIR" "$HOME/.codex/skills/${TARGET_NAME}"
  echo "  ✅ Installed for Codex / OpenCode -> $HOME/.codex/skills/${TARGET_NAME}"
fi

# 4. Cursor IDE Workspace link (if in a workspace)
if [ -d "./.cursor" ]; then
  mkdir -p "./.cursor/skills"
  rm -rf "./.cursor/skills/${TARGET_NAME}"
  cp -r "$SCRIPT_DIR" "./.cursor/skills/${TARGET_NAME}"
  echo "  ✅ Linked for local Cursor workspace -> ./.cursor/skills/${TARGET_NAME}"
fi

# 5. Universal Agent Kernel (~/.agents/skills)
mkdir -p "$HOME/.agents/skills"
rm -rf "$HOME/.agents/skills/${TARGET_NAME}"
cp -r "$SCRIPT_DIR" "$HOME/.agents/skills/${TARGET_NAME}"
echo "  ✅ Installed for Universal Agent Kernel -> $HOME/.agents/skills/${TARGET_NAME}"

# 6. Optional CLI symlink to ~/.local/bin if directory exists
if [ -d "$HOME/.local/bin" ] && [ -w "$HOME/.local/bin" ]; then
  ln -sf "${SCRIPT_DIR}/bin/cli.js" "$HOME/.local/bin/meme-craft"
  echo "  ✅ CLI symlinked -> $HOME/.local/bin/meme-craft"
fi

echo ""
echo "🎉 Installation successful across all detected AI agent environments!"
echo "👉 Quick test: bun \"${SCRIPT_DIR}/bin/cli.js\" list"
echo "👉 Or tell your agent: 'Craft a meme about Friday deployment in Egyptian Arabic'"
echo ""
