# Harry's field-tested LIVE Studio guide

This reference distils Harry Blanchflower's LIVE Studio tutorials, TokTutorials articles, Live Success newsletters, and Patreon posts archived in OpenClaw Hub through 2026-08-10. It is secondary evidence: use it after the primary domain workflow identifies a plausible layer. Current official documentation and observed UI override historical labels, screenshots, numbers, and availability claims.

## Audio

- Start in the OS sound settings, then LIVE Studio. Confirm the intended input and output before changing the mixer.
- Simplify the common setup to one intended microphone path and one intended programme-audio/output path. Delete nothing during diagnosis; mute one suspected duplicate at a time and preserve settings.
- Prefer explicitly named devices over **Default** for a controlled test. If that fixes the route, decide whether to keep the explicit endpoint or repair the OS default.
- Use headphones for echo diagnosis. With speakers, test LIVE Studio echo cancellation. Do not stack LIVE Studio suppression/cancellation with NVIDIA Broadcast or another processor without checking for pumping, delay, or a second mic path.
- On supported NVIDIA hardware, Broadcast can provide noise removal and room-echo removal. Select its virtual microphone in LIVE Studio and avoid simultaneously capturing the raw microphone.
- Use Test audio, Echo check when present, or a short local recording. Speak and play programme audio in the same test; do not rely on the local monitor.
- For link-source alerts, enable source sound and simulate inside the alert tool. A successful upstream simulation plus silence in LIVE Studio narrows the fault to the link source or stream mix.
- A capture card may carry embedded audio while a separate input captures the same signal. Mute one leg and use the one-clap test before adding anything.
- OBS Virtual Camera is video-only by default. Route mic and programme audio separately. If a virtual audio cable is used, document OBS monitoring and avoid direct LIVE Studio copies of the same signals.

## Performance and network

- Separate preview/UI lag, render/composition lag, encoder overload, game lag, and network frame drops.
- Run LIVE Studio's upload test under a representative workload when safe and offline. Harry's starting heuristics were about 10 Mbps upload for 1080p and 4 Mbps for 720p; treat them as field heuristics, not guarantees.
- Prefer a supported hardware encoder when available. Do not insist on H.265 when the current build, GPU, destination, or evidence favors another supported encoder.
- For a bounded overload test, duplicate the scene or make a scratch scene, then compare: 720p preset; 30 instead of 60 FPS; one camera at output resolution; one capture source; no background removal; no heavy browser/video source; preview hidden. Change one variable at a time.
- Prefer Game Capture, then Window Capture, then Display Capture when each is supported and captures the required content.
- Cap an uncapped game, close unused high-load apps, and verify the actual GPU/encoder in use.
- For network drops, check transfers, other network users, wired versus Wi-Fi, VPN/proxy state, ISP status, and whether multiple viewers see the fault.
- Do not blindly ignore LIVE Studio warnings. Compare them with measured upload, encoder, workload, and viewer output.

## Camera, background, OBS, and layouts

- If the camera is busy, decide which app owns it. When OBS or NVIDIA Broadcast is the producer, configure that producer before LIVE Studio, then select its virtual camera.
- If OBS output looks correct but LIVE Studio does not, test one OBS Virtual Camera source in a scratch scene. Check output selection, resolution/FPS, fit or stretch, crop, and the correct canvas.
- For dual layout, verify both canvases. Source properties may sync while position and crop differ.
- For capture-card video failure in LIVE Studio, test it in OBS and send the picture through OBS Virtual Camera. Treat audio separately.
- For poor cutout/background removal, compare **Original** with LIVE Studio cutout. With a physical green screen, light it evenly, crop non-green edges, and tune chroma settings while watching the viewer crop.
- Put a replacement image/video background below the camera source and loop/mute background video as intended.
- Match source resolution/FPS to output. Raising a camera to 4K or 60 FPS is not a fix when output is lower or the system is overloaded.
- In co-host or multi-guest failures, prove the same sources in a normal clean scene, then add one guest and record layout and voice paths.

## Access, install, and changing features

- Use the current official download and current in-product application route. Availability, follower requirements, macOS regions, virtual-camera gates, and layout names change.
- Creator Networks can be a legitimate optional route to request LIVE Studio or RTMP access, but never promise approval and never request credentials.
- Treat a missing control as a possible account/region/rollout gate before diagnosing the PC.
- Update the app or graphics driver only after recording versions and last-known-good state. Reinstall only after clean-scene, permission, contention, and version tests; back up scenes/settings first.

## Reject these historical fixes

Do not revive these claims from older content:

- using a VPN or location spoofing to obtain LIVE Studio or RTMP access;
- guaranteeing access from a follower count, agency, application link, or number of past streams;
- assuming Compatibility Mode still exists because a 2023 tutorial shows it;
- treating old hardware tables, bitrates, H.265, or an **ignore warning** instruction as universal;
- deleting production scenes/sources, clearing app data, or reinstalling early;
- assuming macOS is unavailable because an older help page says Windows-only.

See `hub-source-ledger.md` for provenance and deduplication.
