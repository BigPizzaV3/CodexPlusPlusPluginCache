---
name: socialclaw
description: Schedule, publish, and track social media posts through the SocialClaw tools. Use when the user wants to post or schedule to X, LinkedIn, Instagram, Threads, Facebook Pages, TikTok, YouTube, Reddit, Pinterest, WordPress, Discord, or Telegram, connect a social account, upload media for a post, check what is scheduled, retry or cancel a post, read post analytics, or handle Instagram comments and messages.
---

# SocialClaw

SocialClaw publishes posts through the social accounts connected to the user's SocialClaw workspace. Every tool acts on the workspace the user picked when they signed in. Call `get_profile` if you need to confirm which workspace that is.

## Publishing a post

1. Call `list_accounts` to find the target account. If the account is missing, call `connect_account` and give the user the returned `authorizeUrl` to open. Telegram needs a bot token and chat id; Discord needs a channel webhook URL.
2. Call `account_capabilities` for that account to learn its text limits, allowed media, and whether it can publish right now.
3. For media, reuse something the user already uploaded (`list_assets`, use its `publicUrl`) or call `upload_asset` with a public `sourceUrl`. Pass the resulting URL as `media_link`.
4. Build a schedule document: `{ "timezone": "<IANA zone>", "posts": [{ "account": "<account handle from list_accounts, e.g. x:@yourbrand>", "name": "<short internal label>", "description": "<post text>", "publish_at": "<ISO-8601 time>", "media_link": "<optional>" }] }`. Use the user's timezone, and an ISO time in the near future when they say "now".
5. Call `validate_schedule` and fix every error it reports before going further.
6. Show the user the final text, target accounts, media, and publish time, and get a clear yes. Then call `apply_schedule` once, with an `idempotencyKey`, so a retry never posts twice.
7. Call `run_status` with the returned run id and tell the user what was scheduled or published, including the post links when they exist.

## Rules

- Never publish, reply, send a message, or delete anything without the user's explicit confirmation of the exact content.
- Facebook means Facebook Pages; personal profiles cannot be posted to. LinkedIn profiles and LinkedIn pages are separate accounts.
- Instagram and TikTok posts need media. TikTok takes one video or one photo gallery per post. YouTube takes one video. Reddit needs a `subreddit` setting.
- If a tool says the workspace needs an active paid plan, tell the user to pick a plan at https://getsocialclaw.com/pricing instead of retrying.
- If a platform or feature is not supported, say so plainly rather than inventing a workaround.
- Never ask the user for platform passwords or app secrets. Accounts are connected through SocialClaw's own sign-in links.

## After publishing

- `list_posts` and `get_post` show what is scheduled, published, or failed; `post_attempts` explains a failure.
- `retry_post` retries a failed post. `cancel_post` stops a scheduled post that has not gone out yet.
- `get_analytics` reads post, account, or run stats; `refresh_analytics` pulls fresh numbers from the platform.
- Instagram tools read and reply to comments, hide or delete them, and read and send direct messages.
