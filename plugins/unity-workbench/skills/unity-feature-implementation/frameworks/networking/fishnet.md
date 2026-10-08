# FishNet Framework Guide

Use only when first-party project code actively uses FishNet.

## Inspect

- NetworkManager
- NetworkObject
- NetworkBehaviour
- ownership
- ServerRpc, ObserversRpc, TargetRpc
- SyncTypes
- prediction components
- scene management

## Rules

- Follow server authority and ownership conventions.
- Use SyncTypes for persistent replicated state.
- Use RPCs for transient communication.
- Respect prediction and reconcile flows.
- Avoid duplicate observer effects.
- Test owner, server, and observers.
