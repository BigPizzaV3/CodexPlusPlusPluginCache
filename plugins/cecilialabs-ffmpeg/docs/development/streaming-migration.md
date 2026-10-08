# Milestone 9 — Legacy Streaming Migration

## Legacy input

`legacy/bash/stream-to-websocket.sh`:

```bash
ffmpeg \
  -f v4l2 \
    -framerate 15 -video_size 320x240 -i /dev/video0 \
  -f mpegts \
    -codec:v mpeg1video -s 320x240 -b:v 500k -bf 0 \
  http://localhost:8083/juninhotest-uuid
```

Despite the filename, this is not a direct WebSocket stream. It captures V4L2 video, encodes MPEG-1 video, muxes MPEG-TS, and writes to an HTTP URL.

## Equivalent toolkit command

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
  --url http://localhost:8083/juninhotest-uuid
```

The receiver remains responsible for accepting the HTTP stream and, if required, relaying MPEG-TS to WebSocket/browser clients.

## Semantic improvements

- source capture, encoding, container, transport, and destination are independent typed concepts;
- destination URL schemes are validated against the selected transport;
- RTMP/RTSP select appropriate muxers instead of pretending every endpoint is MPEG-TS;
- WebSocket is represented as a future relay capability, not a misleading alias for HTTP;
- argument arrays replace shell strings;
- camera capture is portable across V4L2, AVFoundation, and DirectShow input formats;
- file streaming receives FFprobe preflight and real-time pacing by default.
