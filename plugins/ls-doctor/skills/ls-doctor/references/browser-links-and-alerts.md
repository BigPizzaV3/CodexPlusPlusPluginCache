# Link sources, alerts, chat, gifts, and notifications

## Split the chain into three layers

Use this signal path:

`TikTok event -> alert service/app -> link or browser source -> LIVE Studio scene and stream mix -> viewer`

A follow, gift, chat message, or subscription can exist at one layer and fail at the next. Do not reinstall LIVE Studio or reconnect an account until the first missing signal is identified.

## Prove the upstream event

1. Confirm the correct TikTok account is connected in the alert tool.
2. Use that tool's built-in simulate, test, or preview control while offline.
3. If simulation fails inside the tool, fix its connection, action, event, asset, or account mapping before changing LIVE Studio.
4. If simulation succeeds in the tool, continue to the LIVE Studio source.

Never trigger a real gift, purchase, subscription, public message, or LIVE merely to test a local route.

## Inspect the LIVE Studio link source

- Confirm the source uses the intended current URL and belongs to the correct scene.
- Confirm sound is enabled when the alert should be audible.
- Confirm the source is visible, unlocked for editing, within the canvas, and above any source that could cover it.
- Check custom width and height against the alert tool's canvas. Treat creator-published dimensions as starting points, not invariants; tool and LIVE Studio sizing bugs change.
- Keep the source active only when its tool requires it. Record the old value before changing it.
- Simulate once, watch the source, the Audio mixer, and the viewer-path test, then restore any temporary test setting.

If a source is visually present but silent, trace its audio separately. Do not add desktop audio or a second copy of the same source until the existing route is understood.

## Isolate stale or broken rendering

Preserve the production scene and source settings. In a scratch scene:

1. Add one fresh link source using the current URL.
2. Use the alert tool's native canvas size first.
3. Simulate one short alert.
4. If the fresh source works, compare URL, dimensions, sound, active state, crop, opacity, and source order with the production source.
5. Recreate the production source only after saving its URL and settings. Reinstalling LIVE Studio is not an alert-source repair.

A link source that loads slowly or consumes excessive resources can cause composition lag. Confirm this by comparing the same scene with only that source disabled; do not delete unrelated sources.

## Distinguish platform data from overlay rendering

- TikTok mobile/Live Center shows the event, alert tool does not: alert-service connection or permission.
- Alert tool simulation works, LIVE Studio source does not: URL, source settings, rendering, scene, or network.
- Visual appears, sound does not: link-source sound, stream mix, mute, or duplicated/looped audio route.
- LIVE Studio shows the event, viewer does not: viewer path, crop, source order, stream mix, or mobile preview.
- Chat/gifts are absent in both TikTok surfaces and third-party tools: account, service, rollout, or network; collect exact timestamps and notices before escalation.
