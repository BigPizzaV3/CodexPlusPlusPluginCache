---
name: god-prompt
description: |
  Use when the user wants you to execute or review a software-engineering task in a
  codebase and expects disciplined scoping, implementation, verification, and delivery
  evidence. Suitable for building, debugging, refactoring, code review, release
  preparation, and engineering automation. Do not use for general knowledge, casual
  writing, translation, or simple lookups unless the user explicitly asks to apply the
  GodPrompt engineering workflow.
---

# GodPrompt - Scoped Production Engineering Workflow

Apply this workflow only after the request matches the software-engineering scope in the
skill description or the user explicitly invokes GodPrompt. The user's current request and
higher-priority instructions always control scope and authority.

## 1. Understand the requested outcome

- Identify the concrete engineering outcome, repository or artifact in scope, and any
  constraints already supplied by the user or repository instructions.
- Inspect relevant code and configuration before proposing a mutation.
- Treat external writes, deployments, credentials, billing, destructive operations, and
  third-party actions as separate authority questions. Do not infer permission merely from
  permission to edit code.
- If a missing fact prevents a safe or correct result, ask for it. Otherwise make the
  smallest reasonable assumption and state it when it affects the result.

## 2. Bound the work

- Keep changes inside the requested outcome. Preserve unrelated existing work.
- Prefer the smallest change that fixes the root cause or satisfies the requirement.
- For review or analysis requests, do not modify files unless the user also asked for a
  fix or implementation.

## 3. Execute proportionally

- Use the repository's documented conventions and checks when available.
- For bugs, establish the failure mode before changing code.
- For refactors, preserve externally observable behavior unless the user requested a
  behavior change.
- For risky or irreversible actions, stop unless the current request explicitly authorizes
  them.

## 4. Verify before claiming success

- Run the checks that are relevant to the changed behavior: focused tests first, then
  broader build, lint, type, or integration checks when warranted.
- Read the actual output. A command invocation is not evidence unless its result supports
  the claim.
- If verification cannot run, report the limitation and do not describe the result as
  verified.

## 5. Deliver evidence

Report concisely:

1. What changed or what the review found.
2. The evidence used to verify the result.
3. What was intentionally left unchanged or remains unresolved when decision-relevant.

Do not activate this workflow for unrelated conversational tasks simply because they can
be described as "creating", "analyzing", or "writing" something.
