# Streaming & Capture

The streaming model separates source/capture, encoding, muxer/container, network transport, and destination.

## Camera capture

Linux example:

```bash
cecilia-ffmpeg stream camera   --device /dev/video0   --input-format v4l2   --framerate 15   --video-size 320x240   --video-codec h264   --transport http   --container mpegts   --url http://localhost:8083/stream
```

Capture backends:

- Linux: V4L2
- macOS: AVFoundation
- Windows: DirectShow

## Stream a file

```bash
cecilia-ffmpeg stream file input.mp4   --transport rtmp   --container flv   --url rtmp://example/live/key
```

File input is paced in real time by default. Use `--no-realtime` to disable throttling.

## Direct transports

```text
HTTP / HTTPS
RTMP / RTMPS
RTSP
SRT
UDP
TCP
```

Default container choices are transport-aware.

## WebSocket clarification

The toolkit does **not** claim direct WebSocket media output. The historical script named `stream-to-websocket.sh` actually produced MPEG-TS over HTTP.

For browser/WebSocket consumption, use an explicit relay architecture:

```text
camera/file
  ↓
FFmpeg encoded stream
  ↓
HTTP/RTMP/SRT/etc.
  ↓
relay/service
  ↓
WebSocket/browser client
```

## Dry run

Camera dry run is useful for checking the planned FFmpeg command without opening the device:

```bash
cecilia-ffmpeg stream camera ... --dry-run
```

## Capability caveat

Protocol/encoder availability depends on the local FFmpeg build. Use `doctor` and `environment capabilities` rather than assuming every build supports SRT or a specific encoder.
