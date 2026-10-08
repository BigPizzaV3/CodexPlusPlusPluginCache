# Performance and network

## Classify the dropped work

Do not call every frame problem "internet lag."

- **Rendering/composition:** preview or output stutters before encoding; GPU, effects, browser/media sources, scaling, capture method, or scene complexity are likely.
- **Encoding:** the composed frame is ready but the encoder cannot keep pace; encoder choice, resolution, FPS, preset, competing encoders, or thermal limits are likely.
- **Network:** LIVE Studio reports dropped network frames, unstable upload, bitrate collapse, or disconnects while local recording stays smooth.
- **Memory pressure:** use grows over time, the system swaps/compresses memory, or performance degrades only after a long run.

## Build a comparable baseline

Record the same scene, duration, resolution, FPS, encoder, bitrate, game workload, and destination. Capture CPU, GPU, memory, dropped-frame category, and upload stability. Change one variable and repeat.

For multistreaming, compare one destination with multiple destinations under the same scene. Extra encodes, browser sources, relay tools, virtual cameras, and duplicated capture paths can add load even when the internet connection is adequate.

## Reduce the correct load

- Prefer a supported hardware encoder when available.
- Reduce source count and disable one heavy browser, effect, high-resolution media, or duplicate capture at a time.
- Prefer Game Capture over Window Capture and Window Capture over Display Capture when the platform and content support it.
- Match camera/source FPS and resolution to output; test 30 FPS before reducing resolution further when 60 FPS overloads the system.
- Cap an uncapped game frame rate to leave GPU time for composition.
- Do not lower bitrate to fix rendering or encoding overload unless the encoder/load evidence also supports it.
- For network drops, compare wired versus Wi-Fi, disable VPN for a controlled test, verify upload headroom, and test another ingest time/route when available. Restore security software immediately after any bounded diagnostic test.

On Apple silicon, watch unified-memory pressure and thermals because GPU and CPU share memory. On Intel Mac and Windows, record the GPU actually used by the capture and encoder; mismatched adapters can add copies and stalls.

## Handle update regressions

Record before/after app and OS versions, preserve settings, and reproduce in a clean scene. Reinstalling or clearing state is a last resort. TikTok warns that an improper uninstall can remove scenes, so require a backup and explicit offline confirmation before that step.
