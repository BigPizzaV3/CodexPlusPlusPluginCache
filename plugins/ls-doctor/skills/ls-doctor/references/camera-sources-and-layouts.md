# Cameras, sources, and layouts

## Separate a locked feature from a missing device

- A locked or absent account feature belongs to access/eligibility.
- A selectable source that is black, busy, frozen, or absent belongs to local device, permission, architecture, or contention diagnosis.

## Diagnose a physical or virtual camera

1. Confirm the camera works in one simple native app and close every other app that may hold it.
2. Check Camera permission for TikTok LIVE Studio. On macOS, also check the OBS camera extension when using OBS Virtual Camera.
3. For OBS, click **Start Virtual Camera** before selecting it in TikTok LIVE Studio.
4. Record OBS version, TikTok LIVE Studio version, OS version, and CPU architecture. On macOS 14 or newer, OBS 30 or newer supplies the compatible camera extension described by OBS.
5. Restart OBS, then TikTok LIVE Studio, and test in a clean scene. Do not reinstall until permission, launch order, contention, and version compatibility have been tested.
6. Match camera resolution and frame rate to the LIVE quality setting. A source above the canvas/output requirement adds load without improving the stream.

On Windows, reinstalling the OBS virtual-camera component is a later repair and may require elevation. On macOS 13 and 14, allow the blocked OBS system extension in Privacy & Security; on newer macOS versions check Camera Extensions in Login Items & Extensions.

## Repair portrait, landscape, and dual layout

Preserve a last-known-good scene before changing layout.

- Portrait targets the vertical viewer path; landscape targets widescreen; dual layout maintains both views.
- In dual layout, source appearance/settings sync between portrait and landscape while position and size can differ. A change to the source itself can therefore affect both views.
- Converting layouts can remove unsupported widgets. Dual layout may not offer the same mobile-preview path as a single-layout scene.
- Test the viewer crop with mobile preview when supported. Do not judge vertical framing from the desktop canvas alone.
- Prefer a clean scene with one camera and one capture source to distinguish a broken source from a broken scene graph.

## Isolate co-host layout faults

Record the co-host mode and layout: Current scene versus Share screen, number of guests, selected shared source, canvas orientation, and which participant owns the problem source. Test the same sources without co-hosting, then add one guest. Do not rebuild the production layout until the clean-scene test identifies the failing layer.
