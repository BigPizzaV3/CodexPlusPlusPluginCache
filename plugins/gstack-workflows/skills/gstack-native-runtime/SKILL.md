---
name: gstack-native-runtime
description: Bridge portable gstack workflows to an existing native gstack installation on a compatible Codex host without making it a hard plugin dependency.
---

# gstack Native Runtime Bridge

Use only when a workflow needs a capability implemented by the original local gstack runtime. First detect a compatible installation and shell. Read the installed current upstream Skill instead of assuming paths or behavior from an old version.

The native runtime is optional. Do not install, update, import credentials, pair agents, or change configuration unless the user requested that mutation. If no native runtime exists, return to the portable specialist workflow and use host capabilities where equivalent.
