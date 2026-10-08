# DSIR GHO Health Data Skill plugin

A skills-only plugin containing the verified DSIR GHO 0.1.0 runtime. It discovers WHO GHO indicators, retrieves observations, preserves DSIR cleaning semantics, and exports CSV and JSON. No R, MCP server, hosted service or WHO API key is required.

## Package status

Plugin version 0.1.1 adds the existing DSIR package logo as both the composer icon and directory logo. The GHO skill runtime remains version 0.1.0 with identical files. The original plugin 0.1.0 ZIP remains available separately.

This is a plugin distribution artifact, not a published listing. It includes a portable root `plugin.json`, a `.codex-plugin/plugin.json` compatibility manifest, and the complete skill in `skills/dsir-gho/`. The runtime files are copied byte-for-byte from the verified standalone skill release. No marketplace was registered and no user-level installation was performed by the build.

When uploading `dsir-gho-plugin-0.1.1.zip`, the portal may still report that it will convert the Agent Plugins manifest to Codex format. This is an expected format-normalization notice; review and confirm it if prompted. Both icon fields are now populated and the referenced square JPEG is included in the archive. Local validation is not evidence of portal acceptance or public review approval.

The agent environment must supply Python 3.10+, script execution and outbound HTTPS to `ghoapi.azureedge.net`. Packaging cannot create those capabilities or override workspace policy. Code and script networking must be checked in the actual target account.

## For colleagues using the existing standalone ZIP in local Codex

PowerShell is optional. The installer only copies files to the skill directory.

On Windows, use File Explorer:

1. Extract `dsir-gho-0.1.0.zip`.
2. Enter `%USERPROFILE%` in File Explorer's address bar.
3. Open or create `.agents`, and inside it open or create `skills`.
4. Copy the extracted `dsir-gho` folder into that `skills` folder.
5. Confirm the final layout is `%USERPROFILE%\.agents\skills\dsir-gho\SKILL.md`, with `scripts` and `references` next to that file. Avoid an extra nested `dsir-gho` folder.
6. Start a new Codex conversation, restarting the app if discovery has not refreshed. Ask: `Use $dsir-gho to retrieve historical UHC service coverage for the Western Pacific Region.`

Do not overwrite an existing installation without reviewing it. The bundled PowerShell installer automates steps 2-5 and refuses an existing target. Merely extracting the ZIP to Downloads is not an installation.

## Local developer testing of this plugin

Extract the plugin ZIP and ask Codex to register the extracted plugin in your personal marketplace using its plugin-creator capability. After registration, refresh the Plugins Directory, open the plugin from that local source, install it, and start a new conversation. Registration is a separate operation; this ZIP does not silently update a personal marketplace.

If the target client lacks that capability, use its documented local marketplace setup rather than guessing an upload button. Do not copy the plugin root into the standalone skill directory. For a standalone fallback, the actual skill is under `skills/dsir-gho/`.

## ChatGPT installation and sharing

For the browser-based colleague experience, first make the plugin available to the target account through a supported workspace or public distribution route. A local developer's plugin registration is not a ChatGPT workspace installation.

Once the plugin is available in the colleague's Plugins Directory:

1. Open Plugins and locate DSIR GHO Health Data Skill.
2. Open its details and select the installation plus button.
3. Start a new chat. Use `@` to select the plugin or its skill, then ask a normal health-data question.
4. Confirm the agent's runtime can execute the bundled client and reach WHO. Use a Work/code-capable environment when required by the account's available tools.

Examples:

- Show historical UHC Service Coverage Index for the Western Pacific Region.
- Get measles reported cases in the Philippines since 2015.
- Compare historical UHC service coverage in China, Japan and the Philippines.
- Find WHO indicators for catastrophic health expenditure above 10%.

These are the steps for an available plugin, not proof this package is already discoverable in any account. Uploading the ZIP as a normal chat attachment or as Custom GPT Knowledge is not a documented installation method here. Do not promise colleagues a universal ZIP-upload button or unrestricted internet access.

## Publisher's next step

Choose a target account/workspace and verify its plugin import or distribution controls. For public distribution, the official submission flow supports skills-only plugins and requires publisher verification and review. This package has not been submitted, approved or published. It does not include invented publisher websites, support addresses, or policy URLs; supply genuine details when a chosen distribution route requires them.

Official references:

- [Plugin format](https://developers.openai.com/plugins/build/plugins)
- [Local testing](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Plugin installation and use](https://learn.chatgpt.com/docs/plugins)
- [Skills-only public submission](https://developers.openai.com/plugins/deploy/submission)
- [ChatGPT Work networking](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview)
