# Setting up heyGRC

heyGRC reviews your pull requests for governance, risk, and compliance, grounded in your company
context and the frameworks you must comply with (ISO 27001, SOC 2, GDPR, the EU AI Act, and more). It
runs as a GitHub App, so the review happens server-side, not on your machine. Setup is three steps and
about three minutes.

## Step 1 — Install the GitHub App (one click, you)

Installing a GitHub App is an account-owner action, so this is the one step no agent or API can do for
you:

1. Go to **https://github.com/apps/heygrc/installations/new?via=claude-plugin**
2. Choose your org or account → **Only select repositories** → pick the repo(s) → **Install**.

heyGRC asks for the minimum it needs: **read-only** Contents and metadata; **read + write** Checks and
Pull requests. It never needs write access to your code.

Reviews start here. A bare install already reviews PRs with default frameworks under Free-plan limits,
before any heyGRC account exists. **Claim the install** by signing in to the console
([app.heygrc.com](https://app.heygrc.com)) and linking your org: claiming starts the 14-day trial and
unlocks API keys and configuration (steps 2 and 3).

## Step 2 — Get your heyGRC API key

In the **heyGRC console → Settings → API keys → Create key**. Copy the `hgrc_…` token (it is shown
once) and store it like a password:

```bash
export HEYGRC_API_KEY="hgrc_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Send it only in the `Authorization` header, never in a URL.

## Step 3 — Configure your context and frameworks (your agent does this)

This is the GRC-as-code part: you describe your company and the frameworks you care about, and your
agent writes it to heyGRC with a single call. The `profile` is free-form JSON; the more relevant it
is, the sharper the reviews.

```bash
curl -X PUT https://api.heygrc.com/v1/config \
  -H "Authorization: Bearer $HEYGRC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "company": "Acme Inc",
      "product": "B2B SaaS for invoice automation",
      "data_handled": "customer PII, payment metadata, uploaded documents",
      "hosting": "EU, AWS eu-central-1",
      "compliance_posture": "pursuing SOC 2 and ISO 27001; ships an AI feature"
    },
    "frameworks": ["ISO_27001", "SOC_2", "GDPR", "EU_AI_ACT"]
  }'
```

A `200 {"ok": true, …}` means you are configured. Read it back any time with
`GET https://api.heygrc.com/v1/config`.

## Step 4 — Choose how often it reviews

| Mode | Behavior |
|------|----------|
| `auto` | Reviews every PR when it is opened, reopened, or pushed to. (default) |
| `auto_once` | Reviews on open / reopen only, not on every new commit. |
| `mention_only` | Stays silent until someone comments `/heygrc` on a PR. |

Set this in the console, per org or per repo.

## That's it

Open a pull request. heyGRC posts a review grounded in your context and frameworks, with inline
comments on compliance-relevant changes and a Checks status (it never blocks the merge). To trigger a
review on demand, comment `/heygrc` on any PR (you must be an Owner, Member, or Collaborator).

## Links

- Full setup guide: https://docs.heygrc.com/docs/setup-with-an-agent
- GitHub App permissions: https://docs.heygrc.com/docs/github-app-permissions
- Pricing and plans: https://docs.heygrc.com/docs/pricing-and-plans
- API reference: https://docs.heygrc.com/docs/api-reference
