# Netcode for GameObjects Debugging

## Inspect

- NetworkManager
- ownership
- NetworkVariables
- ServerRpc and ClientRpc
- network prefab registration
- scene management
- transport and Relay

## Common defects

- client applying authoritative result
- RPC ownership requirement mismatch
- NetworkVariable permission issue
- prefab not registered
- state missing for late joiner
- host-only assumption

## Validation

Test host, remote client, ownership rejection, and late join where relevant.
