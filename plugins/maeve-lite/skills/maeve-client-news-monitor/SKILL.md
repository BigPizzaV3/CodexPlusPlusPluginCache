---
name: maeve-client-news-monitor
description: Finds and synthesizes recent, externally verifiable business signals about a named person and company using public web search only. Use for explicit requests for key or recent signals, public developments, news, posts, interviews, podcasts, lectures, conference appearances, videos, company changes, or relevant industry and regulatory changes. Do not use for mailbox relationship history, open items, prior conversations, or a general meeting or prospect brief. If a request such as "research Andrew Simon from Weil," "brief me on Andrew Simon," or "prepare a prospect brief" does not make either intent clear, ask whether the user wants a general prospect brief, a recent-signals brief, or both before using any source. Never searches email or other private connected data. Requires web search and directly opened sources for every factual claim.
license: Apache-2.0
---

# Maeve Client News Monitor

On request, produce a concise, factual picture of the most important recent changes in a prospect's or client's business.

## Choose the right brief

Use this workflow immediately when the user explicitly asks for recent or key signals, public developments, recent news, appearances, posts, interviews, lectures, videos, company changes, or relevant industry or regulatory changes.

Do not use this workflow for a general prospect or meeting brief grounded in the user's relationship, mailbox history, prior conversations, or open items.

If the user gives only a named person and company with a generic request such as `research`, `look up`, `brief me on`, or `prepare a prospect brief`, and neither intent is otherwise clear, do not search the web or read a mailbox yet. Ask exactly one question:

> Would you like a general prospect brief, or a recent-signals brief focused on material changes involving the person and their company? I can also provide both.

- If the user chooses the general prospect brief, use the mailbox-grounded prospect or meeting brief workflow instead of Client News Monitor.
- If the user chooses the recent-signals brief, continue with Client News Monitor.
- If the user chooses both, keep the general prospect brief and the public signal brief as separate sections with separate provenance. This workflow handles only the public-signal portion. Never use mailbox details or other private information in web queries.

After Client News Monitor is selected, do not default to a biography or general profile.

A signal is the underlying change—not the publication format in which it appeared. A podcast, interview, post, conference appearance, or news story is evidence. The signal is the concrete development that the evidence reveals, such as a strategic partnership, product launch, business-model change, investment, leadership change, market entry, operating-model change, material dispute, or regulatory response.

Do not provide a biography, speculate about needs or intentions, explain how the user can help, recommend positioning, or draft an outreach angle. Give only the signal, its supporting facts, and a brief review of its potential impact on the prospect's or client's business.

Never abbreviate business development. Use `business signal`, `prospect signal`, or `client signal` when a label is needed.

## Scope and identity

Before searching, establish the person's full name and at least one identity anchor such as current company, role, location, or a public profile URL. If the identity remains ambiguous, ask one focused clarification question.

Use biographies and profile pages to confirm identity and discover substantive news, publications, talks, and recordings. Follow relevant links and evaluate their content under the same sourcing and date rules as other evidence. Do not turn the person's title, responsibilities, career history, education, location, or other evergreen profile facts into opening prose or signal bullets. A role belongs in the result only when a dated appointment or material responsibility change falls inside the searched window.

Use the user's requested time window. If none is given, search the previous six months. If that produces too little verified material, extend up to two years and disclose the expanded range. Never describe an older item as recent.

## Public-web boundary

Use only public web search and public pages opened from search results. Never search or read email, calendars, cloud drives, CRM systems, connected files, or any other private source. Do not put confidential matter names, private contact details, mailbox content, or other non-public information into a web query.

Do not use a Maeven server, MCP server, or private Maeven data source. Do not ask the user for passwords, API keys, OAuth tokens, session cookies, or MFA codes.

## Web-search preflight

Check that web search and page opening are available before researching.

- If web search is unavailable, stop and say that Client News Monitor requires web search or browsing. Do not substitute model memory, email search, another connector, or unsupported claims.
- If result pages cannot be opened, stop and explain that the sources could not be validated. Search-result snippets are not evidence.
- If access fails partway through, return only the signals already supported by opened sources. Label coverage as partial and describe the failure.

## Research workflow

### 1. Search the person for evidence

Complete each of these person-level search passes using the quoted full name with the company or role, newest to oldest:

1. `Posts and authored work` — professional posts, articles, commentary, and shared material.
2. `Interviews and audio` — interviews, podcasts, recorded discussions, and transcripts.
3. `Speaking and video` — lectures, presentations, keynotes, panels, conference or summit sessions, webinars, event-speaker pages, and videos.
4. `News and professional activity` — reliable news coverage, appointments, awards, and other substantive dated activity.

Use focused query variations such as the person's quoted name plus `lecture`, `presentation`, `speaker`, `keynote`, `panel`, `conference`, `summit`, `session`, `webinar`, `podcast`, `interview`, or `video`, along with the company and relevant year. Check official event organizers, conference schedules, host pages, transcript or episode pages, and video platforms. Do not treat the person-level search as complete after finding company announcements.

Open the original post, article, transcript, episode, video, or event page whenever possible. A snippet, scraped profile, unsourced aggregator, or copied repost does not validate a claim.

A substantive lecture, presentation, podcast, interview, or panel is a valid person-level signal when its topic or content provides current factual evidence of what the person is working on, explaining, building, or prioritizing, even when it does not announce a separate company transaction. Headline the substantive topic or position—not merely that the person appeared somewhere.

### 2. Search broadly for business changes

Run separate focused searches for company announcements, transactions, product or service changes, partnerships, investments, leadership changes, market expansion, operating-model changes, disputes, financial developments, and other material events. Search the company and each development revealed by the person-level evidence. Search company developments across the full requested window, independently of the named person's current topics. Include favorable and adverse developments, including cybersecurity incidents, data exposure, operational disruptions, and leadership changes. Do not treat coverage of one prominent announcement or topic as sufficient company coverage. Prefer primary and authoritative sources. Use reputable independent reporting when a primary source is unavailable or when it provides confirmation or additional detail. A company announcement is not required. Distinguish confirmed facts, attributed statements, and unconfirmed allegations.

Check industry and regulatory developments after completing the person and company searches. Include a development only when cited evidence establishes a concrete connection to the company's operations, markets, or an identified business development. A general connection to the person's job title or industry is insufficient. Do not use generic industry or regulatory news to compensate for incomplete person or company research. For regulatory facts, prefer the responsible regulator, government publication, legislation, court, or other primary authority. State the jurisdiction, status, and effective or publication date when available. Do not provide legal advice or claim that a rule applies unless a directly cited source establishes that fact.

### 3. Cluster evidence into signals

Group every validated source that concerns the same exact underlying change. Synthesize a launch announcement, interview, post, and other corroborating coverage into one signal instead of one item per source.

Do not merge distinct developments merely because they support the same broad strategy. A partnership, a separately launched product, a leadership change, and a new client-service model remain separate signals when each is a concrete change. One source may support more than one signal when it contains evidence of genuinely distinct developments.

For each source in a cluster, identify the distinct fact it establishes. Synthesize those facts into a compact account of what changed and how, including the mechanism, participants, scope, implementation, timing, or concrete actions when supported.

List every directly opened source used in the synthesis. Do not hide additional corroborating sources behind a single citation or repeat the signal as separate items merely because it appeared in several formats. Exclude duplicate syndications and sources that add no independently validated information.

When several validated, non-duplicate sources point to the same signal, retain and list all of them in that signal's source cluster. Do not cite only the easiest or most prominent one.

### 4. Rank and stop

Prioritize evidence and signals in this order:

1. `Person` — the named person's own professional posts, authored work, statements, interviews, talks, or direct involvement in a change.
2. `Company` — company-specific announcements, filings, transactions, launches, leadership changes, or reliable reporting not directly tied to a statement from the person.
3. `Industry and regulation` — developments with a concrete, sourced connection to the company or an identified business development; rank these after substantive person and company signals.

Classify a signal at the highest tier supported by its source cluster. For example, a company launch that the person also explains in an interview is a person-backed signal, not two signals. Within each tier, rank by magnitude of the business change, strength and breadth of source support, and recency. Use recency to order changes of similar importance.

Aim for five to eight distinct signals when that many substantive changes exist. Return fewer rather than padding the result with biographies, routine appearances, awards, generic marketing, or minor news. Stop after the person, company, industry, and regulatory search passes each produce no new validated, material change.

## Source and factuality rules

Every factual claim must be supported by a directly opened public source.

- Cite facts where they appear, using descriptive Markdown links.
- Give each source's publisher or organization, title, and publication date when available.
- State what each listed source contributes to the synthesized signal.
- Prefer primary and authoritative sources. Use reputable independent reporting when a primary source is unavailable or when it provides confirmation or additional detail. A company announcement is not required. Distinguish confirmed facts, attributed statements, and unconfirmed allegations.
- Distinguish a page's publication date from the date of the event it describes.
- If sources conflict, investigate the specific disagreement before excluding a material item. For event dates, check linked slides, recordings, transcripts, or organizer records, and distinguish event-specific dates from site-wide headers and page-update dates. Preserve supported facts and omit or qualify only unresolved claims. If timing cannot be established, describe the lead under Coverage and gaps without presenting it as recent.
- Never invent or repair a source, URL, quotation, date, title, relationship, event, or missing detail. Never fill a gap from model memory.
- Do not infer beliefs, intent, strategy, commercial need, personality, health, protected traits, or private circumstances.
- Exclude sensitive personal data and non-professional family or home details even when indexed publicly.

The `Potential impact` may be a short inference from the sourced facts. Keep it to one or two sentences about likely commercial, operational, financial, legal, regulatory, competitive, or timing effects on the prospect or client. Label uncertainty clearly. Do not turn impact into advice, a recommendation, a way the user can help, or an outreach suggestion.

## Output format

Start immediately with `Recent business signals`. Do not add a biographical introduction, executive summary, recommendation, assistance idea, or outreach language.

For each signal, use:

### N. Factual signal headline — date or date range

**Facts:** Synthesize what changed and how, including the participants, mechanism, scope, implementation, or timing supported by the source cluster. Cite each factual statement.

**Potential impact:** Give one or two sentences on the possible effect on the prospect's or client's business. Mark it as an inference unless a source states the impact directly. Do not suggest what the user should do.

**Sources:**

- `[Publisher — source title, publication date](https://example.com)` — state the specific part of the signal this source confirms or adds.
- Include every validated, non-duplicate source used for this signal.

After the sources, move directly to the next signal. Do not add recommendations, opportunities, ways to help, prospect scoring, or conversation suggestions.

End with `Coverage and gaps`: identify the person in at most one terse line, then state the date range, completion or gaps for each person-level search pass, company/industry/regulatory coverage, access failures, and material ambiguity. If no material signal was validated, say so plainly.

## What this skill does not do

- Monitor continuously or send alerts between requests.
- Read email or other private connected data.
- Produce a biography, infer needs or intentions, recommend positioning, or draft outreach.
- Present unsupported facts or provide legal advice.
