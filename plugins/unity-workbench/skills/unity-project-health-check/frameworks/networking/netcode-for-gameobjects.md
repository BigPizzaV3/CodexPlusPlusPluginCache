# Netcode for GameObjects Health Review

Inspect:

- NetworkManager configuration
- transport and Relay
- ownership rules
- ServerRpc validation
- NetworkVariable permissions
- prefab registration
- scene management
- host-only behavior
- late join
- disconnect cleanup
- dedicated-server compatibility

Common risks:

- client-authoritative outcomes
- unregistered prefabs
- per-frame RPCs
- state unavailable to late joiners
