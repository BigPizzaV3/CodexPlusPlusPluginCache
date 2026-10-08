# PodPitch

Find real podcasts by topic or name without an account. Public results contain show descriptions and listening links, never contact email addresses. Existing customers can connect PodPitch in the browser for account tools.

Account actions use the same team permissions, subscription rules, campaign modes, and pitch limits as the PodPitch product. Sending and scheduling remain deliberate user actions.

MCP endpoint: https://api.podpitch.com/v1/mcp

## Data and support

Public search sends the requested topic or show name to PodPitch. Results contain public show information and listening links. Search responses are cached for 15 minutes. Contact email addresses require an existing account connection.

When you connect an account, PodPitch stores the user, team, requesting client, and approved permissions for up to 30 days. Access tokens expire after one hour. Refresh tokens rotate, and revoking a token disables the connection. Requested account changes and messages are stored under the same policy as changes made in PodPitch itself.

The bug reporting tool stores the authenticated user and team, tool name, summary, details, and timestamp in PodPitch's support database. Reports may remain longer than 30 days while needed for support and service improvement. Send only a short reproduction, never credentials or a full conversation. The plugin does not request chat history, memory, or unrelated files.

For product or security concerns, contact [neal@podpitch.com](mailto:neal@podpitch.com). For account connection problems, start the connection again in your agent and sign in to your existing PodPitch account in the browser.

## Examples

- Find three podcasts about climate technology and explain their fit using their descriptions.
- Compare the topics and descriptions of two podcasts by their show IDs.
- Connect my existing PodPitch account and show my campaigns and pitch activity.

[Privacy](https://app.podpitch.com/privacy) | [Terms](https://app.podpitch.com/terms) | [PodPitch](https://podpitch.com)
