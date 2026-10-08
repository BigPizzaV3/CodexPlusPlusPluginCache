# Milestone 9 — Streaming & Capture

Milestone 9 separates the streaming pipeline into four independent concerns:

```text
source/capture
    ↓
encoding
    ↓
container/muxer
    ↓
network transport + destination
```

This corrects the legacy assumption that a script sending MPEG-TS to an HTTP URL was itself a WebSocket stream.

## Commands

### Camera capture

```bash
cecilia-ffmpeg stream camera \
  --device /dev/video0 \
  --input-format v4l2 \
  --framerate 15 \
  --video-size 320x240 \
  --transport http \
  --container mpegts \
  --video-codec mpeg1video \
  --video-bitrate 500k \
  --audio-codec none \
  --url http://localhost:8083/live
```

When `--input-format` is omitted, the toolkit chooses `v4l2` on Linux, `avfoundation` on macOS, and `dshow` on Windows.

### File streaming

```bash
cecilia-ffmpeg stream file ./clip.mp4 \
  --transport srt \
  --url 'srt://receiver.example:9000?mode=caller'
```

File input is paced with `-re` by default. Pass `--no-realtime` when native-rate pacing is not wanted.

## Supported direct transports

| Transport | Accepted URL schemes | Default container |
|---|---|---|
| HTTP | `http://`, `https://` | MPEG-TS |
| RTMP | `rtmp://`, `rtmps://` | FLV |
| RTSP | `rtsp://` | RTSP |
| SRT | `srt://` | MPEG-TS |
| UDP | `udp://` | MPEG-TS |
| TCP | `tcp://` | MPEG-TS |

The URL scheme is inferred when `--transport` is omitted. If both are supplied, they must agree.

## WebSocket policy

Direct WebSocket output is **not** claimed as a stock-FFmpeg transport. A `ws://`/`wss://` destination or `--transport websocket` produces an explicit unsupported-operation error.

For browser/JSMpeg workflows, run FFmpeg into an HTTP/TCP/UDP endpoint owned by a relay service and let that relay expose WebSocket clients.

## Encoding

The default video profile is H.264 with `libx264`, `veryfast`, `zerolatency`, `yuv420p`, and GOP 60. MPEG-1 video remains available for legacy JSMpeg-style receivers. Stream copy is explicit and emits a compatibility warning.

File streaming uses AAC automatically when FFprobe finds an audio stream. Camera capture defaults to video-only because Milestone 9 models one camera input device; independent audio capture can be added later without changing transport/container planning.

## Safety and execution

- no shell interpolation;
- no `eval`;
- all execution goes through `runFFmpeg()`;
- file streams receive FFprobe preflight inspection;
- `--dry-run` resolves FFmpeg and returns the complete invocation without opening the network output or camera device;
- SIGINT/SIGTERM cancellation uses the shared runtime.

Network streaming does not use transactional output files because the destination is a live endpoint rather than a local artifact.
