# Netcode for GameObjects Framework Guide

Use only when first-party code actively uses NGO.

## Inspect

- NGO version
- NetworkManager
- NetworkObject registration
- ownership model
- ServerRpc and ClientRpc usage
- NetworkVariables
- scene management
- transport and Relay usage

## Rules

- Preserve server authority unless the project explicitly uses another model.
- Validate ownership before client-originated requests.
- Use NetworkVariables for persistent replicated state.
- Use RPCs for events and requests.
- Avoid per-frame RPCs.
- Handle late joiners.
- Register network prefabs correctly.
- Test host, client, and dedicated-server paths when relevant.
