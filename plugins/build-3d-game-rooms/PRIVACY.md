# Privacy policy

Build 3D Game Rooms is a skills-only plugin published by BallRoller Games. It
has no hosted service, account system, analytics, advertising, telemetry, or
publisher-operated network service or connector.

## Data handled and purposes

- **Publisher collection:** BallRoller Games does not receive or retain personal
  data, prompts, images, meshes, room files, credentials, or usage telemetry
  through this plugin.
- **Local project data:** Room briefs, prompts, approved reference images,
  generated meshes, Blender files, audit evidence, task identifiers, statuses,
  and credit usage are read or written only in the user's execution
  environment. They are used to build, audit, resume, and export the room.
- **Optional Meshy transmission:** Only when the user explicitly runs a paid
  submission with spend confirmation, the approved reference image and the
  declared generation parameters are sent directly from the user's environment
  to Meshy at `api.meshy.ai` to create the requested 3D asset. Meshy is the
  recipient and independent provider for that request. Meshy's privacy policy,
  terms, licensing, pricing, and retention practices apply.

The bundled scripts do not contact any other external service. If a user
chooses separate image-generation, storage, rendering, or deployment tools,
those tools operate under their own disclosures and policies.

## Credentials

Never paste an API key into ChatGPT, a prompt, a project file, a manifest, or a
support report. The optional Meshy client reads `MESHY_API_KEY` transiently from
the user's environment and sends it only to `api.meshy.ai` in the HTTPS
authorization header. It does not intentionally store, print, return, or add
the key to evidence packages. Neither BallRoller Games nor OpenAI receives the
key through the plugin.

## Retention

- BallRoller Games retains no plugin data because the publisher receives none.
- Local project data remains in the user's chosen filesystem until the user
  deletes it. The plugin has no remote copy and no automatic retention period.
- Meshy controls retention of data submitted to its service under Meshy's
  published policies and account controls. This plugin cannot alter or promise
  Meshy's retention period.

## User controls

Users can inspect the source and dry-run payload, omit the optional Meshy stage,
approve or reject each reference image, and must confirm every paid submission.
Users can delete local evidence and output files at any time, revoke or rotate
their Meshy API key, and use their Meshy account controls for data held by
Meshy. The workflow does not submit a retry automatically.

Privacy questions can be filed through the public support channel described in
[SUPPORT.md](SUPPORT.md). Do not include credentials, private assets, or other
sensitive information in a public issue.

Last updated: 2026-09-04.
