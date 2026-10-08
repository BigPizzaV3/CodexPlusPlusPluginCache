# Data capability pack

Apply this pack when schemas, migrations, transactions, durable storage, deletion or restore are part of the change.

- Identify the canonical owner for each row, object, file, receipt, snapshot and recovery intent.
- Do not infer executable schema parity from migration identifiers. Rebuild or inspect effective definitions when parity is part of the claim.
- Verify concurrency with real transactions when lock order, isolation, triggers or partial progress determine correctness.
- Treat metadata and bytes, local and remote stores, ready and staged state, deletion and restore as separate commit boundaries unless the actual system makes them atomic.
- Exercise interruption and replay at durable boundaries. Confirm exact ownership, cleanup and survivor data instead of relying only on aggregate counts.
