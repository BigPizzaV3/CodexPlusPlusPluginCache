# Milestone 9 — Streaming & Capture — Checklist

**Target:** `v0.7.0`  
**Status:** Implemented; local validation required before merge

## Architecture

- [x] Separate source/capture, encoding, container, transport, and destination.
- [x] Preserve the shared `runFFmpeg()` process boundary.
- [x] No shell interpolation or `eval`.
- [x] Structured `StreamPlan` and `StreamReport` contracts.
- [x] Streaming JSON Schema.

## Commands

- [x] Implement `stream camera`.
- [x] Implement `stream file <input>`.
- [x] FFprobe preflight for file sources.
- [x] Real-time `-re` pacing for file sources by default.
- [x] Dry-run planning without opening camera/network resources.
- [x] Shared cancellation support.

## Capture

- [x] Linux V4L2 support.
- [x] macOS AVFoundation input format.
- [x] Windows DirectShow input format.
- [x] Explicit camera device.
- [x] Configurable frame rate.
- [x] Configurable video size.

## Transport/container

- [x] HTTP/HTTPS → MPEG-TS.
- [x] RTMP/RTMPS → FLV.
- [x] RTSP → RTSP muxer with TCP/UDP lower-transport selection.
- [x] SRT → MPEG-TS.
- [x] UDP → MPEG-TS.
- [x] TCP → MPEG-TS.
- [x] URL-scheme/transport consistency validation.
- [x] Direct WebSocket explicitly rejected with relay guidance.

## Encoding

- [x] Low-latency H.264 default.
- [x] MPEG-1 video profile for legacy JSMpeg-style workflows.
- [x] Explicit video stream copy.
- [x] AAC, audio copy, and audio-drop policies.
- [x] Configurable bitrates, H.264 preset, GOP, and pixel format.

## Migration

- [x] `stream-to-websocket.sh` correctly documented as HTTP output, not WebSocket.
- [x] Equivalent typed CLI invocation documented.
- [x] No dependency on the legacy Bash script at runtime.

## Quality

- [x] Unit tests for transport inference, muxer defaults, WebSocket rejection, capture defaults, and legacy-shaped planning.
- [x] CLI registration/options test.
- [x] Dry-run integration tests that do not require a live receiver or camera.
- [x] `verify:streaming` added to `npm run validate`.
- [x] Milestone 9 docs added.
- [ ] Run `npm run validate` in the configured local Codex Environment before merge.

## Acceptance criterion

The architecture supports HTTP, RTMP, RTSP, SRT, UDP, and TCP without coupling capture/encoding to the transport. WebSocket remains an explicit relay concern instead of being mislabeled.
