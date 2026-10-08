# Minimal Codex Session Fields

## Purpose

Define which fields to read from active and archived Codex JSONL, how to reconstruct and deduplicate turns, which auditable source references to preserve, and which events to filter. Read this file when scanning sessions, building conversation records, or searching transcript evidence on demand. This file does not decide whether a candidate belongs in `AGENTS.md` and does not perform writes.

## Contents

- Data locations
- Trusted fields
- Turn reconstruction
- Deduplication
- Cross-session association
- Default exclusions
- Project roots
- Quota

## Data Locations

Scan both:

```text
$CODEX_HOME/sessions/**/*.jsonl
$CODEX_HOME/archived_sessions/**/*.jsonl
```

Archive status is only storage state. Merge active and archived copies by stable session ID. Prefer the newest copy that can form complete user/final records, while retaining every source location for audit. During record construction, read every accessible copy of the session and merge complete records by turn ID. Use the preferred copy for duplicate turns, but allow other copies to supply completed turns missing from it. This prevents a newer truncated tail or an active/archive divergence from hiding a completed turn in another copy. Exclude delegated subagent sessions identified by `session_meta.source.subagent` or `parent_thread_id`; they are not acceptance conversations between the user and the primary Codex agent.

## Trusted Fields

Read only fields required for the minimal index:

- Outer `session_meta`: `payload.id`/`session_id` and `payload.cwd`.
- Outer `session_meta`: `payload.source.subagent`/`parent_thread_id` for excluding subagent sessions.
- Outer `turn_context`: `payload.turn_id` and `payload.cwd`.
- `event_msg.task_started/task_complete/turn_aborted`: turn boundaries and legacy final fallback.
- `response_item.message`: `payload.role`, `payload.phase`, and `payload.content`.
- `event_msg.user_message`: compatible user source when no response item exists.
- Recursive `rate_limits` inside `event_msg.token_count`: seven-day quota window.

Store the source JSONL path and one-based line number in source references. When a complete turn comes from a secondary active or archived copy of the same session, use that actual copy's label as the record's `storage`, not the preferred copy's label.

## Turn Reconstruction

Prefer explicit turn IDs. When absent, generate ordinal turns in event order. Emit only completed records that contain both user input and a final answer; leave incomplete turns for a later incremental run. Attribute a turn to its own `turn_context.cwd`, falling back to the session `cwd` only when the turn has none. Add every trusted turn root to the dynamic allowlist during scanning.

For Assistant content, prefer `response_item.message` with `phase = final_answer`. For legacy logs, fall back only to `task_complete.last_agent_message` or an explicit final phase. Do not treat an ordinary `agent_message` as final.

Do not treat content as genuine user feedback when it is marked as user-authored but contains Codex-injected `# AGENTS.md instructions ... <INSTRUCTIONS>`, `<*_context>`, `<recommended_plugins>`, `<turn_aborted>`, or `<subagent_notification>` context. A subagent notification is agent-authored output delivered to the parent task, not user feedback. If one message contains both injected and genuine user parts, keep only the genuine parts. For legacy `# Context from my IDE setup:` and `# In app browser:` wrappers, extract only the actual request after `My request for Codex`. If that delimiter is absent, fail closed instead of retaining the generated state.

Each record stores `source.line_start/line_end` covering the turn's user and final references. When a new user event follows a previous final without an explicit task boundary, create a new turn before recording that line so the next request is not included in the previous record. On-demand evidence may use only a record ID already present in the batch and must stay within this closed line range.

## Deduplication

Within one turn, deduplicate identical normalized text using this precedence:

- Prefer `response_item.message/user` over `event_msg.user_message`.
- Prefer `response_item.message/assistant/final_answer` over `task_complete.last_agent_message`.
- After active content moves to archived storage, deduplicate by stable session ID and turn ID. Derive the record ID only from those stable identities, not from user/final text that a later canonical copy may correct, so serialization changes cannot bypass a checkpoint.

The same precedence applies when fallback text differs: if the primary `response_item` exists in a turn, do not concatenate compatible fallback text. Keep deduplication local to one turn. Preserve separate records for different turns even when their text is identical.

## Cross-Session Association

For each new record, select up to eight most recent earlier records in the same scope, then select up to eight additional earlier records with overlapping normalized terms or Chinese character bigrams. Do not attach raw text from another project merely because it is recent. Preserve each context record's real project scope; context must never authorize a project change in the wrong scope. Supply already checkpointed records from the minimal record index in state without marking them as new again.

The scanner stores an EOF byte/line cursor and cumulative metadata for each JSONL in state. The builder stores the byte/line/ordinal cursor of the last checkpointed complete turn for each source. Both layers read only appended tails when files grow normally and safely restart from the beginning after truncation. Stable record IDs plus the state record index allow old context to be associated without sending it through judgment again.

## Default Exclusions

Do not send these to the LLM:

- reasoning summaries and encrypted reasoning
- Assistant commentary
- tool calls and tool results
- runtime events other than token statistics

Only after an initial `needs_evidence` judgment may the evidence script read the requested user, Assistant, lifecycle, or tool slice. User evidence must reuse the normal record builder's injected-context and legacy IDE/browser-wrapper filters so excluded pseudo-user text cannot re-enter through evidence retrieval. Accept Assistant slices only with an explicit `role=assistant`; never classify developer or system messages as Assistant content. Continue to exclude encrypted reasoning.

## Project Roots

Treat `session_meta.cwd` as trusted local metadata. If the directory is inside a Git repository, use `git rev-parse --show-toplevel` as the project root; otherwise use the existing cwd. The roots in each batch form the project target allowlist. Writes may target only the exact root-level `AGENTS.md` for one of those roots.

Apply `--since` first to sessions whose latest event could contain a new turn, then filter records by turn time in the builder. Do not miss later feedback merely because a long-lived session began before the cutoff.

## Quota

Select the latest `event_msg.token_count` observation by event time. Search only its direct `payload.rate_limits` or `payload.info.rate_limits` for:

```text
used_percent
window_minutes = 10080
resets_at
```

Accept only a seven-day window whose event time is not in the future and whose reset has not expired. A scheduled run may continue only when `remaining = 100 - used_percent` is strictly greater than 20. If any field in the latest observation is missing, unparseable, future-dated, untrusted, or expired, return unknown and stop; do not fall back to an older valid observation.
