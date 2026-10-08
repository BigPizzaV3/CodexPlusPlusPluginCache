# Photon Fusion Health Review

Inspect:

- topology selection
- runner lifecycle
- state and input authority
- simulation callbacks
- prediction and resimulation safety
- RPC usage
- networked property ownership
- spawn and despawn
- multi-peer validation
- visual side effects during resimulation

Common risks:

- authoritative simulation in Unity `Update`
- duplicate effects during resimulation
- local-only assumptions
- RPCs used for durable state
- missing late-join state
