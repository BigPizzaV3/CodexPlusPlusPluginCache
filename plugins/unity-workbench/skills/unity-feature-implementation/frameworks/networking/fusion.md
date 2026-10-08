# Photon Fusion Framework Guide

Use only when first-party project code actively uses Photon Fusion.

## Inspect

- Fusion version
- topology: Host, Server, Shared, or Single
- `NetworkRunner`
- `NetworkObject`
- `NetworkBehaviour`
- input collection
- state authority
- input authority
- prediction and resimulation
- spawn registration

## Rules

- Put simulation logic in Fusion simulation callbacks.
- Respect state and input authority.
- Avoid ordinary Unity `Update` for authoritative network simulation.
- Use networked properties for persistent replicated state.
- Use RPCs for transient requests or notifications where appropriate.
- Consider resimulation safety.
- Avoid non-deterministic side effects during resimulation.
- Separate visual effects from simulation state.
- Validate host and remote clients.
