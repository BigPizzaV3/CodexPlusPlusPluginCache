# Mirror Framework Guide

Use only when first-party project code actively uses Mirror.

## Inspect

- NetworkManager
- NetworkIdentity
- Commands
- ClientRpc and TargetRpc
- SyncVars and hooks
- authority
- spawning
- transport
- scene management

## Rules

- Keep server-authoritative outcomes on the server.
- Validate Commands.
- Use SyncVars for durable replicated state.
- Use RPCs for transient effects.
- Avoid per-frame network messages.
- Handle authority changes and disconnects.
- Register spawnable prefabs.
- Test host and remote client behavior.
