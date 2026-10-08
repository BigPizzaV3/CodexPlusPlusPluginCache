# XR Specialization

## Use when

Use for XR Interaction Toolkit, OpenXR, VR locomotion, grab interactions,
tracking, haptics, body tracking, passthrough, and headset-specific behavior.

## Inspect first

- XR provider
- OpenXR features
- XR Interaction Toolkit version
- locomotion system
- interaction layers
- input actions
- supported devices
- tracking origin
- multiplayer ownership

## Implementation rules

- Reuse existing interaction managers and action maps.
- Avoid device-specific assumptions unless required.
- Respect tracking-origin configuration.
- Keep physical and virtual scale consistent.
- Consider seated and standing modes.
- Avoid forced camera motion that may cause discomfort.
- Handle tracking loss.
- Keep local tracking separate from replicated state.
- Preserve interaction-layer conventions.

## Validation

- headset or simulator
- interaction ownership
- tracking loss
- recentering
- locomotion comfort
- controller mapping
- performance on target hardware
