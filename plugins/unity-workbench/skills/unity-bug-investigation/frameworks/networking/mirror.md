# Mirror Debugging

## Inspect

- NetworkIdentity
- Commands
- ClientRpc and TargetRpc
- SyncVars and hooks
- authority
- spawn registration
- scene transitions

## Common defects

- Command called without authority
- server state modified locally
- SyncVar hook assumptions
- duplicate host-side execution
- missing spawn registration

## Validation

Test host and remote client separately.
