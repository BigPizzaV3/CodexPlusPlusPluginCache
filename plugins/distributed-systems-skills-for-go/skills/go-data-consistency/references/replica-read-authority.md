# Replica read authority

## Separate commit, durability, and visibility

A successful primary commit does not by itself prove that an asynchronous replica has received, persisted, or replayed the change. A missing replica row is therefore a stale observation, not evidence that the primary rolled back. Retrying the logical write under a new identity can duplicate it.

Define which reads require read-your-writes, monotonic reads, or the latest authoritative state. For each, choose an evidence-bearing contract:

- read from the write authority;
- carry a commit or version token and wait until the selected replica has replayed at least that token;
- fall back to the authority when the replica cannot satisfy the token within a bounded latency budget; or
- accept bounded staleness only when the business invariant permits it.

Time-based stickiness without an observed replay boundary is a latency guess, not a consistency proof. A cache cannot make a stale replica authoritative.

## Bind tokens to topology

A replay token is meaningful only within the database's ordering and failover contract. Bind any application token to the relevant cluster or timeline generation, reject incomparable tokens, and define behavior after promotion. Health must include replay position and delay for the exact replica serving the read, not only process reachability.

With asynchronous PostgreSQL streaming replication, acknowledged primary transactions can be absent from a promoted lagging standby. Reconcile stable operation identities against the new authority and fence writes to the retired primary. Do not convert an absent row into a definite failure or mint a replacement operation.

## Qualify PostgreSQL settings

PostgreSQL streaming replication is asynchronous by default. `synchronous_commit=on` can wait for configured synchronous standbys to flush WAL, but does not mean an arbitrary read replica has replayed the transaction. `remote_apply` waits for the current selected synchronous standbys to report replay, making the transaction visible there in the documented simple case; it adds latency and availability coupling and does not establish a portable cross-database rule.
