---
name: browser-use
description: Use when the user asks to automate, control, inspect, or test a website in a browser and an approved host-managed browser capability is available.
---

# Browser Use

Use an approved **host-managed browser** capability exposed by ChatGPT, Codex, or the current host. Do not bootstrap external browser runtimes from this skill.

## Operating rule

1. Prefer the host-managed browser or computer-use capability already available in the session.
2. Interact only with pages and actions the user is authorized to access.
3. Respect normal authentication, permission, and access boundaries. Respect warnings, access controls, and site protections without attempting to defeat them.
4. Do not download, install, or execute external tooling from this skill.
5. Do not import credentials, cookies, browser profiles, or secrets from outside the active host capability.

## Instruction-only fallback

If no approved browser capability is available, provide a browser automation plan or code-level guidance only. Clearly state that no browser action was executed. Never fabricate navigation, clicks, screenshots, page state, or successful completion.

## Output

Report what was attempted, what the host actually allowed, the observed result, and any limitation that prevented completion.
