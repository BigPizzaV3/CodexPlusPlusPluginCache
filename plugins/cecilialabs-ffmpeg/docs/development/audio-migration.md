# Milestone 5 — Legacy Audio Migration

| Legacy utility | v0.3.0 command | Migration notes |
|---|---|---|
| `add-audio-2-clip.sh` | `audio attach <video> <audio>` | Preserves the useful `apad` behavior without `eval`; adds explicit replace/append and video-copy/encode modes. |
| `add-silence-2-clip.sh` | `audio add-silence <video>` | Creates a finite silent track, maps streams explicitly, and refuses implicit destruction of existing audio. |
| `create-silence-audio.sh` | `audio silence` | Duration, sample rate, channels, layout, codec and output format are no longer hard-coded. |
| `remove-silence-noises.sh` | `audio detect-silence` + `audio remove-silence` | Replaces logfile + awk + temporary WAV segment + concat-list orchestration with structured detection and one typed `silenceremove` pipeline. |
| `convert-audio-to-gsm-ulaw.sh` | `audio telephony` | Corrects the legacy semantic mismatch: `pcm_mulaw` is G.711 μ-law, not GSM. GSM and G.711 now use separate profiles and containers. |

## Legacy behavior intentionally not reproduced

### Shell evaluation

Legacy scripts frequently used:

```bash
eval ffmpeg ...
```

The toolkit always executes an argument array through the shared process runtime with `shell: false`.

### Hard-coded working files

The silence-removal script wrote fixed logfile, concat-list and segment filenames into an application-specific directory. Milestone 5 has no hard-coded user path and does not need segment-list intermediates.

### Codec/container conflation

The legacy command:

```bash
ffmpeg -i input.wav -ar 8000 -c:a pcm_mulaw inx-test.gsm
```

encoded **G.711 μ-law** while using a `.gsm` filename. Milestone 5 makes this invalid by design unless codec and container are independently compatible.

Correct examples:

```bash
cecilia-ffmpeg audio telephony input.wav --codec mulaw --container wav --output pcmu.wav
cecilia-ffmpeg audio telephony input.wav --codec gsm --container gsm --output voice.gsm
```
