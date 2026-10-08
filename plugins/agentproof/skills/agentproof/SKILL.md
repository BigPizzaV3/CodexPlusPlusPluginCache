---
name: agentproof
description: Capture a new instrumented Codex CLI session into a canonical hash-only AgentProof receipt, or verify a receipt and its recorded repository commitments locally. Use when the user asks to create agent-execution evidence, verify an AgentProof receipt, or compare it with the current Git repository. Do not use to claim capture of the current Codex session, completeness, truth, authorship, work quality, compliance, payment authorization, settlement, signing, or anchoring.
---

# AgentProof

AgentProof starts a separate Codex CLI child process and records only hashes and typed
metadata from what its collector observes. It cannot capture the current Codex
conversation.

## Required boundary

- State before capture: `This starts a new instrumented Codex session; it does not capture the current session.`
- Treat a valid receipt as integrity and ordering evidence for observed events only.
- Never describe it as proof of completeness, truth, quality, safety, compliance,
  identity, payment authorization, or settlement.
- Never request, print, inspect, store, or place a credential in the request.
- Never add Sign, Anchor, payment, settlement, gateway, or model-API steps.
- Do not call an Anthropic or OpenAI model API. Capture invokes the installed Codex CLI
  using that CLI's existing authentication.
- Capture starts the child with Codex approval policy `never` because the child is
  non-interactive and cannot answer approval prompts. State this before execution.
  This does not widen its sandbox: it must retain the request's `read-only` or
  `workspace-write` sandbox.
- Capture needs the child CLI's network connection and nested sandbox. If the host
  sandbox blocks either, ask the user to approve the fixed launcher outside that
  outer sandbox. Never widen permissions silently. The child must still use the
  request's `read-only` or `workspace-write` sandbox.

## Resolve the runtime

Set `<skill-dir>` conceptually to the absolute directory containing this `SKILL.md`.
Use the script at `<skill-dir>/scripts/agentproof.py`. Do not copy it into the user's
workspace or modify it.

Read [request-contract.md](references/request-contract.md) and
[supported-repository-profile.md](references/supported-repository-profile.md) before
the first execution.

## Capture

1. Confirm the current working directory is the intended trusted Git repository.
2. Explain the new-session boundary using the exact sentence above.
3. Explain that the new child is non-interactive, uses Codex approval policy `never`,
   and retains the selected sandbox.
4. Create `.agentproof/request.json` with a structured write tool, never shell
   interpolation:

```json
{
  "action": "capture",
  "model": "<installed Codex model identifier>",
  "prompt": "<task for the new child session>",
  "sandbox": "workspace-write"
}
```

5. Run only:

```text
python3 -B <skill-dir>/scripts/agentproof.py --request .agentproof/request.json
```

6. If Codex requires approval to run that fixed command outside its outer sandbox,
   request it and explain that the nested child retains the requested sandbox.
7. Report the output path, event count, chain head and explicit gaps. Do not reproduce
   prompt or command content from the session.

The runtime removes the request after validating it and refuses to overwrite an
existing receipt. Never delete an existing receipt merely to make capture succeed;
ask the user how to preserve it.

## Verify

Create this exact request with a structured write tool:

```json
{"action":"verify"}
```

Use Verify for receipts produced by this strict plugin line. Do not promise that
historical Build Week prototype receipts are accepted.

Run the same fixed command. Report `MATCH` or `MISMATCH`, the receipt-chain status and
the explicit limits as separate fields. Never compress `MATCH` into `verified`,
`correct`, `authentic`, or an equivalent approval. A match does not establish who
produced the state or whether it is correct.

## Failure handling

- Preserve fail-closed errors; do not bypass path, symlink, schema, overwrite or
  repository checks.
- If Git is unavailable, or if `codex` is unavailable or unauthenticated, stop and
  report that capture was not performed.
- The runtime suppresses raw child stderr. On child failure it reports only a SHA-256
  commitment, byte count and line count; do not reconstruct or request the raw text.
- For `git_repository_required`, `run_from_git_repository_root`,
  `non_utf8_repository_path`, `repository_symlink_unsupported`,
  `snapshot_file_too_large`, `snapshot_total_too_large`,
  `repository_file_too_large` or `receipt_publish_failed`, stop and report the
  matching condition from the supported repository profile. Do not retry by
  weakening or bypassing that boundary.
- For `unexpected_runtime_error`, report only its exception type and traceback
  SHA-256 commitment. Never request, reconstruct or reproduce the raw traceback.
- Do not summarize a failed run as a valid receipt.
