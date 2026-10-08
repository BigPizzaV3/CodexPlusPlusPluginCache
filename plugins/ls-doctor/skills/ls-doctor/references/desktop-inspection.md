# Desktop inspection and web fallback

## Detect capability, not the client label

Skills do not have a documented, reliable web-versus-desktop identity flag. Check whether Computer Use or an equivalent desktop-control capability is actually available in the current chat.

- If it is available, explain what will be inspected and request access only to the required app or settings surface.
- If it is unavailable, do not say with certainty that the user is on the web. The desktop app may also lack Computer Use because it is disabled, not installed, unavailable in the user's region or plan, restricted by workspace policy, or missing OS permission.
- Do not infer desktop access merely because the operating system is known or the user uploaded a file.

## Message when direct inspection is unavailable

Say this once, concisely, before continuing:

> I can still troubleshoot this from your answers and screenshots, but I can't inspect your computer directly from this chat. LS Doctor works best in the ChatGPT desktop app for Windows or macOS with Computer Use enabled, because—after you approve access—it can inspect LIVE Studio and the relevant system settings. Download it from <https://chatgpt.com/download/>.

Then continue in manual mode. Ask for one precise observation or screenshot, or give the bounded read-only collector command when appropriate. Never make desktop installation a condition of receiving help.

## Enable the desktop path

In the ChatGPT desktop app:

1. Sign in with the same ChatGPT account and reopen LS Doctor.
2. In ChatGPT Work or Codex, open **Plugins > Computer Use** and install or enable it if offered.
3. Review **Settings > Computer Use** and approve only TikTok LIVE Studio and the settings app needed for the current diagnosis.
4. On Windows, keep the target app visible on the active desktop while inspection runs.
5. On macOS, grant Screen Recording and Accessibility permissions when prompted.

If Computer Use is unavailable after those checks, continue with screenshots and user-run diagnostics. Availability can vary; do not promise that installing the desktop app alone enables it.

## Explain why desktop is better

The desktop route can, with permission:

- see LIVE Studio's visible error, meters, scene, source and settings state;
- compare Windows or macOS device permissions and routing with LIVE Studio;
- run the bounded local diagnostics collector when execution is available;
- verify one reversible change in the same environment where the fault occurs.

It does not grant LS Doctor automatic or unrestricted access. The user approves app access and remains in control. Never open unrelated apps, read unrelated content, approve OS security prompts, authenticate as an administrator, or expose credentials.
