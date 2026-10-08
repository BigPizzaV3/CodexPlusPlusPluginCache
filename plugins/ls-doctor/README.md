# LS Doctor

LS Doctor is a ChatGPT plugin for diagnosing TikTok LIVE Studio problems on Windows and macOS. It covers account and feature gates, audio and source routing, cameras and OBS Virtual Camera, stream performance, layouts and co-hosting, link-source alerts, app updates, inactivity checks, and support escalation.

It works evidence first: inspect the failing layer, state the confidence, and run one reversible test at a time. Its optional local collector reports allowlisted settings and log-signal counts without emitting raw logs, account data, credentials, stream keys, server URLs, or device IDs.

Version 1.0.3 adds a truthful desktop-inspection gate. When Computer Use is available in the ChatGPT desktop app, LS Doctor can inspect LIVE Studio and relevant Windows or macOS settings after the user approves access. When direct inspection is unavailable, it explains the limitation, links to the official desktop download, and continues with questions, screenshots, or user-run diagnostics. It does not claim that a missing capability proves the user is on the web.

## Use it

After installing the plugin, start a new ChatGPT or Codex chat and describe the symptom in ordinary language. Useful starting prompts include:

- `Diagnose why my microphone is missing or doubled in TikTok LIVE Studio.`
- `Find what is causing lag or dropped frames in TikTok LIVE Studio.`
- `Help me fix a locked camera or OBS Virtual Camera in TikTok LIVE Studio.`

LS Doctor keeps diagnosis read-only while a stream is live. It will not click Go LIVE or End LIVE, automate inactivity checks, bypass feature gates, or request credentials or stream keys.

For the strongest diagnosis, use the [ChatGPT desktop app](https://chatgpt.com/download/) for Windows or macOS and enable Computer Use when it is available. Web users still receive the full guided troubleshooting workflow; the desktop route is better because it can inspect the visible LIVE Studio state and relevant system settings with permission.

## Local collector

The collector requires Node.js 18 or newer. Codex desktop can locate its bundled Node runtime when `node` is not available on the system path.

```text
node skills/ls-doctor/scripts/collect-diagnostics.mjs --pretty
```

Run `node skills/ls-doctor/scripts/collect-diagnostics.mjs --help` for bounded log and path options. The report is written to standard output and is not uploaded.

## Stream-key guidance

TikTok LIVE Studio does not generate or reveal an RTMP stream key. RTMP access for a separate encoder is an account entitlement. Free-to-join TikTok LIVE Creator Networks are one possible route; the independent [TokTutorials country directory](https://www.toktutorials.com/list-of-agencies) lists networks and discloses that its owner receives commission from some listings. Verify a network through TikTok where possible, read its terms, and never share a TikTok password, 2FA code, session token, or stream key.

## Independence

LS Doctor is independent and is not affiliated with or endorsed by TikTok, ByteDance, OBS, Apple, or Microsoft.

## Privacy, terms, and support

- [Privacy policy](https://ls-doctor-legal.wg-mojo.chatgpt.site/privacy)
- [Terms of use](https://ls-doctor-legal.wg-mojo.chatgpt.site/terms)
- [Customer support](https://www.toktutorials.com/contact)
