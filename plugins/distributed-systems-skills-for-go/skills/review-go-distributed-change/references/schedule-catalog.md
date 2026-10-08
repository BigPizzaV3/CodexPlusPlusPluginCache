# Failure schedule catalog

| Boundary | Before | After |
|---|---|---|
| Database commit | no durable state | state may exist despite lost response |
| Broker publish | event absent | event may exist despite lost acknowledgement |
| Consumer acknowledgement | redelivery expected | broker-specific persistence of ack |
| Lease renewal | authority nearing expiry | renewal result may be unknown |
| Remote call | no bytes sent | effect may exist without response |

For every boundary, ask what stable identity, authoritative read, fence, or reconciliation step distinguishes the outcomes.
