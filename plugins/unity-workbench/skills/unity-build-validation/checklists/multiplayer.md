# Multiplayer Validation Checklist

## Validate roles

- server or host
- owning client
- non-owning client
- observer
- late joiner when relevant

## Check

- authority
- input ownership
- replicated state
- RPCs
- spawn and despawn
- reconnect
- disconnect cleanup
- prediction and reconciliation
- latency behavior
- host-only assumptions
- dedicated server when required

A single Editor instance is insufficient for strong multiplayer validation.
