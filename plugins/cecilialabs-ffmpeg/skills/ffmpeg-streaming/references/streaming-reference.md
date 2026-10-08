# Streaming Reference

## Direct transport matrix

| Transport | Schemes | Default muxer |
|---|---|---|
| HTTP | http, https | mpegts |
| RTMP | rtmp, rtmps | flv |
| RTSP | rtsp | rtsp |
| SRT | srt | mpegts |
| UDP | udp | mpegts |
| TCP | tcp | mpegts |

## Capture backends

| Platform | Default input format |
|---|---|
| Linux | v4l2 |
| macOS | avfoundation |
| Windows | dshow |

## File pacing

`stream file` uses `-re` by default so a normal media file is read at playback rate. Use `--no-realtime` only when receiver/workflow semantics allow unrestricted input speed.

## WebSocket boundary

The legacy script named `stream-to-websocket.sh` actually emitted MPEG-TS to HTTP. The toolkit intentionally rejects direct WebSocket claims. Use a relay that accepts FFmpeg output and exposes WebSocket to clients.
