---
name: prepilot-router
description: Use for any broad or multi-part marketing request. Classifies the job, selects the smallest useful set of PrePilot marketing skills, sequences them, and keeps evidence, execution, QA, and measurement aligned.
---

# PrePilot Marketing Router

## Use it for

- Broad marketing requests with unclear method
- Multi-channel campaigns or launch work
- Requests that combine research, strategy, production, and measurement
- Cases where the user asks PrePilot what to do next

## Operating rules

- Use context already present in the conversation before asking for more input.
- Separate known facts, reasonable assumptions, and unknowns. Do not present assumptions as evidence.
- When the answer depends on current platform rules, market conditions, pricing, benchmarks, or competitors, verify them with current sources when tools are available.
- Prefer concrete decisions, examples, and next actions over generic marketing advice.
- Do not invent campaign performance, customer quotes, research findings, testimonials, rankings, or competitor claims.
- Keep the requested market, language, funnel stage, audience awareness, budget, and channel constraints visible throughout the work.
- Route by the user's job, not by marketing jargon in the prompt.
- Use one primary skill whenever possible. Add a second or third skill only when the job genuinely crosses stages.
- Do not create a long discovery questionnaire. Recover context from the conversation first, then ask only for missing inputs that materially change the answer.
- For execution work, route through marketing-quality before calling the output final when claims, spend, public publishing, or client delivery are involved.

## Workflow

1. Classify the request into one or more jobs: understand, decide, make, improve, launch, measure, or localize.
2. Identify the decision that must be made and the evidence required to make it.
3. Select the primary skill from the routing map below.
4. If work spans stages, sequence skills as evidence -> decision -> production -> quality -> measurement.
5. State major assumptions only when they affect the recommendation. Proceed with reasonable defaults for minor gaps.
6. Return the requested deliverable, not a description of the routing process.

## Output contract

- A focused answer using the selected workflow
- Visible assumptions only where material
- A short measurement or validation step when the output will be acted on

## Quality gate

- No more than three specialist skills for a normal request
- No duplicate analysis across skills
- No fake live data
- No vague next step such as "improve content" without specifying what to change

## Routing map

| User job | Primary skill | Common companion |
|---|---|---|
| Build reusable brand context | `brand-context` | `customer-research` |
| Understand customers | `customer-research` | `positioning-messaging` |
| Analyze competitors or category | `competitive-intelligence` | `positioning-messaging` |
| Define positioning or message hierarchy | `positioning-messaging` | `marketing-quality` |
| Decide the marketing direction | `marketing-strategy` | `analytics-measurement` |
| Build a campaign | `campaign-planning` | `creative-testing` |
| Apply behavioral science | `marketing-psychology` | the execution skill |
| Design offer or pricing | `offer-pricing` | `cro-funnel` |
| Write marketing copy | `copywriting` | `marketing-quality` |
| Build content plan | `content-strategy` | `social-content` or `blog-engine` |
| Create social work | `social-content` | `marketing-quality` |
| Plan or write blog content | `blog-engine` | `seo` or `geo-aeo` |
| Improve organic search | `seo` | `geo-aeo` |
| Improve AI answer visibility | `geo-aeo` | `seo` |
| Plan or review ads | `paid-media` | `creative-testing` |
| Build a creative test plan | `creative-testing` | `paid-media` |
| Improve conversion | `cro-funnel` | `copywriting` |
| Build lifecycle email | `email-lifecycle` | `copywriting` |
| Find growth bets | `growth-experiments` | `analytics-measurement` |
| Define measurement | `analytics-measurement` | any execution skill |
| Plan a launch | `launch-gtm` | `campaign-planning` |
| Adapt for Egypt/GCC/MENA | `mena-localization` | the source execution skill |
| Review work before use | `marketing-quality` | the producing skill |
| Size TAM/SAM/SOM or choose entry segment | `marketing-strategy` | `customer-research` |
| Choose GTM motion or beachhead | `launch-gtm` | `marketing-strategy` |
| Build a competitive battlecard | `competitive-intelligence` | `positioning-messaging` |
| Define a North Star Metric | `analytics-measurement` | `marketing-strategy` |
| Calibrate voice from writing samples | `brand-context` | `copywriting` or `social-content` |
| Humanize or de-slop marketing prose | `marketing-quality` | the producing skill |
| Review a LinkedIn profile | `social-content` | `positioning-messaging` |

For full-funnel tasks, default to: `brand-context` or existing context -> `marketing-strategy` -> channel skill -> `marketing-quality` -> `analytics-measurement`.

## Handoff

If the task is part of a larger marketing request, return the completed deliverable plus the evidence or decisions the next PrePilot skill needs. Do not repeat upstream analysis unless it changes the result.
