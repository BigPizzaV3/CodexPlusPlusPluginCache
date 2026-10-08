# Recovery

## Search or link verification fails

Keep the role out of Apply. State `Exact posting link: missing - not reviewed` and continue with other verified roles.

## Career Passport is unavailable

Use the current conversation and uploaded CV to make progress. Ask for a prior passport only if the missing history could materially create duplicates or unsafe documents.

## DOCX builder fails

Preserve the validated structured input and report `PARTIAL`. In the same response, provide the entire final CV in chat with every section and bullet in ready-to-copy order. If a cover letter was requested and safely available, provide its complete text too. State exactly which Word deliverable or QA step remains unavailable and offer to retry it later. Do not create a misleading `.txt` file, do not call the application pack complete, and do not reduce the fallback to an outline, sample section or promise.

If the host cannot create files at all, use the same full-in-chat fallback immediately after content validation. The user should still receive usable content even though layout, pagination, hyperlinks and rendered-density checks remain pending.

## Rendering unavailable

Run structural DOCX validation and label visual QA pending. The pack is not release-ready until a supported environment renders and inspects it.

## User supplies contradictory evidence

Do not choose the more flattering version. Show the conflict briefly and ask which statement is current. Record the answer as a correction event.

## Scheduled task cannot access files or web

Return `BLOCKED` with the missing dependency and one concrete action. Do not silently run a lower-quality search from memory.
