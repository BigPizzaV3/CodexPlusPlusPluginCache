# Receipts and evidence

Every command writes inside a new private `tidyguardian-<random-id>` directory beneath the chosen external reports directory. Existing reports are never overwritten. JSON is authoritative; CSV exports are formula-neutralized for human viewing and should not be fed back as executable plans.

Inventory: `catalog.json`, `catalog.csv`, `skipped.csv`, `receipt.md`.
Candidate plan: `plan.json`, `candidates.csv`, `review.html`, `receipt.md`.
Dry run: copied `plan.json`, exact `selection.json`, `receipt.md`.
Execution: those documents plus `journal.jsonl`, and a completed receipt when the batch finishes.

The journal starts with the plan and selected IDs. Each operation writes/fsyncs a prepared event before mutation and a done event with the resulting snapshot afterward. It records complete or stopped state. Entries form a hash chain to detect accidental corruption. This is not a cryptographic signature proving user identity.

After an error, quote the real journal location and distinguish completed, uncommitted and untouched operations. Do not report the whole batch as successful. `restore-plan` uses both done records and recoverable prepared records, but refuses conflicts and changed data. Keep journals with the quarantine until the user has independently reviewed their retention needs. No automatic receipt or quarantine deletion is implemented.
