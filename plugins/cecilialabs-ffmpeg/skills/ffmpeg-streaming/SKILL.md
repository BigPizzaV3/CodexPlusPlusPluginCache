---
name: ffmpeg-streaming
description: Capture cameras or stream media files through FFmpeg using typed source, encoding, container, transport, and destination settings. Use for HTTP, RTMP, RTSP, SRT, UDP, or TCP streaming and for camera capture planning.
---

# FFmpeg Streaming

Use this skill for live capture and network media delivery.

## Activation scope

Use for:

- camera capture from V4L2, AVFoundation, or DirectShow;
- streaming a media file at playback rate;
- HTTP(S), RTMP(S), RTSP, SRT, UDP, or TCP destinations;
- choosing a transport-appropriate muxer and low-latency encoding.

## Do not use

Do not claim direct WebSocket support. If browser clients need WebSocket, model an explicit relay service. Do not use file-output transactional semantics for live network destinations.

## Required inputs

Identify:

- source kind: camera or file;
- camera device and capture backend when applicable;
- destination URL;
- transport/container when not inferable;
- video/audio codec policy;
- bitrate/GOP/preset constraints.

## Preflight

For file sources, probe before streaming. For camera sources, use `--dry-run` to validate the planned invocation without opening the device.

## Toolkit surface selection

1. Use the associated `scripts/run.mjs` entry point for supported streaming and capture operations.
2. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
3. Use native FFmpeg only for unsupported streaming features or an explicit native-command request.

## Associated scripts

Use `scripts/run.mjs` with `input.action` `file` or `camera`. File requests
require `input` and `url`; camera requests require `device` and `url`. The
script produces a validated transport/encoding plan and only reports live
execution when the active host actually ran it.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"file","input":"clip.mp4","url":"srt://example.test:9000"}}' \
  | node skills/ffmpeg-streaming/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg stream camera --device <device> --url <url>
cecilia-ffmpeg stream file <input> --url <url>
```

Supported direct transport families: HTTP(S), RTMP(S), RTSP, SRT, UDP, TCP.

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only for unsupported streaming features or explicit user requests. Maintain strict separation between input capture format, media encoding, muxer/container, and network transport.

## Output expectations

A dry run should expose the complete plan without opening sockets. A live run remains active until input completion, receiver failure, or cancellation.

## Validation

Validate URL scheme/transport agreement, muxer compatibility, encoder availability, and receiver expectations. For network problems, distinguish FFmpeg encoding failure from receiver/connectivity failure.

## Error recovery

- For a `ws://`/`wss://` destination, require an explicit relay architecture.
- For RTMP use FLV; for RTSP use the RTSP muxer; for generic HTTP/SRT/UDP/TCP use MPEG-TS in the current toolkit.
- If a receiver rejects the stream, verify its expected codec/container and listening mode.
- If a camera cannot open, verify device path/name, capture backend, permissions, and supported mode.

## Safety and determinism

Never expose credentials embedded in streaming URLs in unnecessary logs. Use cancellation through the shared runtime; do not kill unrelated FFmpeg processes.

## References

Read `references/streaming-reference.md` for transport and capture details.
