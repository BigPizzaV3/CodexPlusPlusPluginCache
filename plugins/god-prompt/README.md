# OpenAI Plugin Directory review package

This directory is a review-oriented, skill-only GodPrompt package for the OpenAI universal
Plugin Directory. It intentionally does not replace the repository's broader portable skill.
The public-directory variant narrows activation to identifiable software-engineering goals
so normal general-purpose ChatGPT or Codex requests do not over-trigger GodPrompt.

The package is designed to be uploaded from `distribution/openai/` after ordinary developer
authentication is available. `review-tests.json` contains the five positive and three
negative cases required for review preparation. Actual public submission remains a human
portal action and is not performed by repository automation.

The directory also includes `.codex-plugin/plugin.json` as the compatibility manifest used
by current OpenAI Agents API plugin loading. It points only at the same scoped `skills/`
package, so API use does not broaden the Plugin Directory trigger contract or add an MCP
runtime dependency.

Before submission, re-check the current OpenAI Plugin Directory documentation and confirm
the portal still accepts a skill-only plugin with the same test fields and review policy.
