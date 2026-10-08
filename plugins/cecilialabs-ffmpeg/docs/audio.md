# Audio Workflows

## Generate silence

```bash
cecilia-ffmpeg audio silence   --duration 2   --sample-rate 48000   --channels 2
```

## Detect silence

```bash
cecilia-ffmpeg audio detect-silence speech.wav   --noise-db -30   --min-duration 0.5   --json
```

The JSON result contains typed silence intervals.

## Remove silence

```bash
cecilia-ffmpeg audio remove-silence speech.wav   --noise-db -30   --min-duration 0.5   --keep-silence 0.05
```

Audio-only silence removal avoids unsafe implicit A/V timeline changes.

## Attach audio to video

Canonical:

```bash
cecilia-ffmpeg video attach-audio video.mp4 audio.wav --mode replace
```

Compatibility:

```bash
cecilia-ffmpeg audio attach video.mp4 audio.wav
```

## Add a silent track to video

Canonical:

```bash
cecilia-ffmpeg video add-silence video.mp4
```

Compatibility alias: `audio add-silence`.

## Telephony

```bash
cecilia-ffmpeg audio telephony input.wav   --codec mulaw   --sample-rate 8000   --channels 1   --container wav
```

The toolkit explicitly distinguishes:

- G.711 μ-law / PCMU;
- G.711 A-law / PCMA;
- GSM;
- PCM.

GSM and G.711 μ-law are not interchangeable names.

## Generic audio conversion

```bash
cecilia-ffmpeg convert file call.wav --to mp3 --audio-bitrate 128k
cecilia-ffmpeg convert file meeting.mp4 --to wav
```

Targets include WAV, MP3, AAC, M4A, FLAC, Opus, and Ogg.
