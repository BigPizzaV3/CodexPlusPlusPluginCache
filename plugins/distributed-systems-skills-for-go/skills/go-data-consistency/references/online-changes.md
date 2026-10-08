# Online data changes

Treat a schema or representation migration as a protocol spoken concurrently by old binaries, new binaries, background jobs, and operators.

## Expand

Add only state that every deployed version can tolerate. Before choosing a DDL form, verify the target engine and version's lock level, table rewrite, validation scan, transaction, and failure behavior. Engine labels are not portable.

For PostgreSQL, `NOT VALID` can install supported constraints for new writes without first scanning existing rows; later `VALIDATE CONSTRAINT` checks historical rows under a different lock. `CREATE INDEX CONCURRENTLY` avoids blocking ordinary writes but performs more work, has transaction restrictions, and can leave an invalid index after failure. These are PostgreSQL mechanisms, not universal migration recipes.

## Backfill

- Partition by a stable, indexed key rather than offset pagination over a changing table.
- Make each batch bounded, committed, observable, and restartable.
- Use a conditional update so an old backfill value cannot overwrite a newer application write.
- Record progress as a hint; prove completeness from authoritative rows before cutover.
- Throttle from database and replica pressure, not a fixed sleep copied between environments.

## Cut over and contract

Deploy compatibility reads and writes before changing authority. Define which representation wins on disagreement and how drift is detected. Validate data and constraints before switching reads. Stop old writers, queued jobs, rollback paths, and external consumers before removing the old representation. A successful deploy is not evidence that no old binary remains.

Rollback can cease to be symmetric after new state becomes authoritative. Record the point of no return and use a forward repair when reverting code would discard valid new-format writes.
