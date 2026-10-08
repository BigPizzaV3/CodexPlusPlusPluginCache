# Audio routing

## Trace the signal, not the labels

Use this model:

`physical mic/game/app -> optional processor or virtual device -> LIVE Studio source/mixer -> stream mix -> optional local monitor`

Ask where the first unexpected meter or sound appears. The same device name in several menus does not prove duplicate capture, and several different device names do not by themselves create double audio.

## Reconcile the three Windows controls

TikTok LIVE Studio's Audio mixer selects and mixes stream sources. Windows Volume mixer assigns default input/output endpoints per process. `TikTok LIVE Studio` and `MediaSDK_Server` can appear separately because Windows sees separate audio clients.

If all three are set differently:

- An explicitly selected microphone source in LIVE Studio normally opens that capture endpoint directly.
- A process set to **Default** inherits the Windows endpoint for the role it requests; a per-app override can send that process to another endpoint.
- LIVE Studio monitoring or test audio can leave through one output while MediaSDK_Server playback uses another.
- The result may be silence, a missing source, or monitoring from an unexpected headset/speaker. Double audio occurs only when the same programme signal reaches the stream mix twice or a monitored output loops back into a captured input.

Do not treat the two Windows process rows as two automatic microphone captures. Prove the route with meters and a recording.

## Run the one-clap test

1. Wear headphones and disable speakers to remove acoustic feedback.
2. Record a short offline test or use LIVE Studio's viewer-side Test audio.
3. Clap once near the mic while watching each LIVE Studio meter.
4. Mute one suspected route at a time.
5. If one mute removes only the delayed copy, that route is the duplicate. Restore unrelated routes.

Common duplicate legs include the raw mic plus NVIDIA Broadcast/another processed copy, mic monitoring captured as desktop audio, Discord or game voice plus co-host audio, a capture card carrying embedded audio plus a separate source, or two app-audio sources for the same process.

## Distinguish audience and monitor problems

- **Audience wrong, monitor right:** inspect stream sources, tracks, app capture, capture-card audio, and co-host/voice-chat duplication.
- **Audience right, monitor wrong:** inspect the Speaker row, audio monitoring, Windows per-app output, macOS output, and headset routing.
- **No meter:** inspect device selection, OS permission, disabled/disconnected endpoint, source contention, and processor input.
- **Meter but silence in recording:** inspect mute state, stream assignment, track/output selection, and app capture exclusions.

On macOS, also inspect Microphone permission and any aggregate, multi-output, loopback, or virtual audio device. A multi-output device can be useful for monitoring but can also return the programme mix to a captured input.

For co-host echo, remove one voice path: TikTok co-host audio, Discord, or in-game voice. TikTok's help specifically warns that simultaneous voice-chat channels can echo.
