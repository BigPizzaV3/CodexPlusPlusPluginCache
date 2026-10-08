# Receipt schema

Input is a JSON object with string values. Required fields are `owner_task_id`, `parent_task_id`, `destination_task_id`, `destination_artifact`, `destination_sha256`, `receipt_kind`, `state`, `timestamp`, `producer`, and `provenance`. Owner and parent must differ. SHA-256 digests contain 64 hexadecimal characters.

Optional card fields: `blocker`, `next_action`, `human_gate`, and `confidence`. Omit private details. Treat all content as claims, including state, confidence, timestamps, and provenance. Timestamp presence is not a freshness guarantee.

Verdicts:

- UNPROVEN: required evidence is absent or invalid, or no current digest was checked.
- CONFLICT: ownership or prior receipt identity conflicts.
- STALE_POINTER: the claimed digest differs from the current digest.
- SAME: both the current and previous receipt identify the same content.
- NEW: the current claim matches the checked digest and is not the same verified prior content.

The optional `--artifact` argument is an explicit file selection. Confirm it is the intended work product before running the check. Matching unrelated bytes cannot establish the receipt's factual history.
