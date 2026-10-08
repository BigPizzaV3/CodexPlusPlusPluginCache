# Execution contexts

The same user request has different safe outcomes depending on where the
assistant is running. Determine the context from available tools and observed
filesystem access; never infer it from the product name alone.

| Context               | Inspect files                   | Execute scripts                        | Install dependencies               | Safe default                                       |
| --------------------- | ------------------------------- | -------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| ChatGPT regular       | No local access assumed         | No local execution assumed             | No                                 | Give a copy/paste guided flow                      |
| ChatGPT Work          | Only when attached and exposed  | When the environment exposes execution | Only through an explicit workflow  | Inspect, execute, poll, and report facts           |
| Codex                 | Yes in the authorized workspace | Yes                                    | Yes within scope and authorization | Run the associated script and verify artifacts     |
| IDE or terminal agent | Host-dependent                  | Host-dependent                         | Only with explicit authorization   | Detect first, then use the same commands/contracts |
| Unknown               | Unknown                         | Unknown                                | No assumption                      | Ask for the missing environment facts              |

## Detection sequence

1. Confirm the workspace or input path exists in the current host.
2. Resolve executable paths with command -v where the shell supports it.
3. Run the toolkit doctor and JSON capability/version commands when available.
4. Probe the specific media input only if it is available and relevant.
5. Record whether each result was observed, supplied by the user, or inferred.

For an executable host, the canonical first step is the associated read-only
script:

```bash
printf '%s\n' '{"context":"codex","input":{}}' \
  | node skills/ffmpeg-onboarding/scripts/check.mjs
```

Then route capability/media inspection to
`skills/ffmpeg-environment/scripts/inspect.mjs`; do not make the onboarding
script a generic media-operation proxy.

## Installation boundary

An installation plan should name the package manager, target scope, expected
binary path, and verification command. Do not modify shell startup files,
PATH, system packages, GPU drivers, or containers without explicit approval.
After an authorized change, repeat the preflight and show only non-secret
results.

## Handoff

Once readiness is established, hand off to the domain Skill that matches the
user request. If the request spans multiple operations, use ffmpeg-workflow to
select a pipeline or ordered domain actions. If readiness cannot be proven,
return the exact next command instead of claiming execution.
