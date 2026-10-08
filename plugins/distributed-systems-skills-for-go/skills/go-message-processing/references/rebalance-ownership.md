# Consumer-group rebalance ownership

A partition assignment is a revocable capability. Record the topic/stream, partition, group/member identity, assignment generation or member epoch where the protocol exposes one, starting offset, partition-scoped context, and completion frontier. Do not reuse one undifferentiated worker context or offset map across assignments.

## Transfer an assignment

On grant, create a fresh partition owner and admit work only through it. On revocation:

1. stop fetching and admitting work for the affected partition;
2. freeze the assignment's highest contiguous completed offset rather than the maximum observed completion;
3. cancel or drain owned workers within the rebalance budget;
4. commit only progress proven complete while that assignment is still allowed to commit;
5. handle an unknown, rejected, or timed-out commit as unresolved progress, not success;
6. retire the owner so late callbacks cannot update the next assignment's frontier.

Verify the deployed client callback and concurrency contract. Eager and cooperative protocols differ in which partitions move and when callbacks run. Static membership or cooperative assignment can reduce churn, but neither makes revocation impossible nor authorizes old workers indefinitely.

## Separate broker progress from business effects

Some protocols bind offset commits to a group generation or member epoch. That can reject stale progress, but it does not retract a database write or remote call already started by the old owner. Keep the business effect idempotent by stable message identity. When duplicate concurrent effects are unsafe, make the authoritative effect boundary compare an assignment/domain fence or claim the message durably before the effect.

After a rebalance, the new owner may legitimately replay from the last accepted offset. Therefore both late old-owner completion and successor replay must converge on one business result. Observe assignment age, revocations, drain time, rejected commits, replay distance, and late completions without using high-cardinality member identifiers as metric labels.
