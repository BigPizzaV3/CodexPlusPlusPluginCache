# Claim recovery

Read this file completely before releasing or replacing another task's claim.

## Exact evidence first

Time, silence, `idle`, `notLoaded`, an old timestamp, a filtered discovery miss, or an unresponsive message is not stale-owner proof.

1. Read the claim from the primary worktree and note its exact thread UUID and revision.
2. Inspect that exact native Codex task. Retry once with an unfiltered inventory when a filtered lookup misses.
3. If it is running or its state remains uncertain, preserve the claim. A path warning alone does not stop work; pause only an actual incompatible hunk, writer command, or exact exclusive action.
4. If exact native evidence proves it terminal, archived, or unusable, compare its goal and boundary with the current direct user request.
5. The user's request to continue the same required work authorises a conflict-free replacement; it does not authorise unrelated work or another repository.
6. Release the stale claim with its current revision and `--status stale-owner-confirmed`, then create the replacement task's own claim. Never edit the former task's file in place.

## Interrupted updates

A revision mismatch means the board changed. List it again; never overwrite the newer record.

If a release receipt exists but the active claim also remains after a reported filesystem error, treat the claim as active until the exact record is reconciled. Do not delete a receipt or claim by hand during ordinary work.

## Legacy state

An enabled schema-1 marker is incompatible with the boundary board. Keep project writes single-task and conflict-free until the project is deactivated and the user authorises the dry-run-first migration. Preserve `CURRENT.md`, task, inbox, and transcript history. Migration writes an exact marker backup, creates an empty schema-2 board, and keeps the project disabled. It never translates history into claims by guessing which old tasks remain live.
