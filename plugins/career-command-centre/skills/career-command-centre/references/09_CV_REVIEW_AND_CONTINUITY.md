# CV review, evidence file and continuity

## Multiple-CV intake

Accept one CV or several role-track-specific CVs in the same setup. If several are supplied:

1. Register each file or pasted version separately in `source_documents`, including its user-stated target direction and whether it is the primary base for that direction.
2. Extract claims with the exact source name. Shared claims may have corroborating sources; conflicting claims must remain separate until the user resolves them.
3. Identify which CV is the strongest starting base for each target direction.
4. Flag only material inconsistencies: employer, title, date, scope, metric, qualification, location/work-right statement or ownership level. Stylistic wording differences are not evidence conflicts.
5. Never treat the newest filename as authoritative when the user has named a different primary version.

## Quick CV read

Give an initial qualitative review before preference questions. Keep it compact enough that setup still feels conversational:

- `Overall CV strength`: choose `Strong`, `Solid but under-positioned`, or `Needs rebuilding`, followed by one sentence explaining the judgement from the supplied evidence.
- `What already works`: two to four specific strengths, grounded in the supplied evidence.
- `What may be underselling you`: two to four high-value weaknesses or missed signals.
- `Priority next edit`: the single change most likely to improve clarity or role direction.
- With several CVs, add `Best base by direction` and `Cross-CV consistency` only when useful.
- Close with `If you want, I can give you the deeper review after setup.` Do not force the longer critique into onboarding.

Review these dimensions:

- career thesis, seniority and target clarity;
- evidence specificity, ownership, scale and outcomes;
- chronology, section labels and scan order;
- ATS-readable headings, dates, contact details, links and file structure;
- repetition, vague claims and content that crowds out stronger proof;
- credible role directions and evidence gaps that may limit them.

When code execution is available for a DOCX, TXT or Markdown CV, run `python scripts/review_cv_text.py <file>`. It produces observable metrics plus impact-ranked findings and explicitly does not produce an ATS score. Use it to catch extraction, structure, chronology, repetition, specificity and readability issues; then apply career judgement and source evidence before recommending any edit. For another document language, pass `--language <code>` so English-only headings and prose rules are not forced onto the candidate. PDF files need host-supported text extraction before the same review dimensions are applied.

Do not invent a universal ATS rating. Without a supplied job description, do not claim a keyword-match score. If the user explicitly wants a score, label it as a transparent Career Centre heuristic, show the dimensions, and explain that employers' systems do not share one universal score. Do not require a metric in every bullet, invent numbers, or treat an unquantified but specific achievement as weak by default.

Separate base-CV quality from role-match quality. A strong general CV can still be a weak match for one posting, and a high keyword overlap can still hide an evidence gap.

## Career Evidence File

Use `Career_Passport.json` as the single portable Career Evidence File and history backup; do not create a second competing memory file. It contains:

- `source_documents`: every CV, LinkedIn export, prior Passport or evidence document used;
- `document_versions`: generated CV bases, tailored CVs and cover letters, their source-document IDs, state and concise change history;
- `evidence`: reusable claims with safe wording, provenance, confidence and restrictions;
- `preferences`: targets, geography, work rights, compensation, sources and document choices;
- `role_history` and `application_events`: deduplication and application lifecycle;
- `corrections` and `feedback`: what the user changed, liked, disliked or confirmed.

Update it after confirmed facts or corrections, meaningful preference changes, reviewed-role decisions, application outcomes and document feedback. Treat repeated behaviour as a proposed pattern until the user confirms it. A search can calibrate directions, exclusions or sources, but a job description can never become evidence about the person.

Create and attach an initial Passport after setup whenever file creation is available; do not wait for the user to discover or request it. Offer an updated Passport after meaningful milestones, not after every response. Preserve older source provenance rather than overwriting history.

When a document is revised, keep the earlier entry and mark it `superseded`; do not overwrite history. A ready Word file is `ready`. A complete in-chat fallback or unrendered draft is `partial`, never `ready`.

## Conversation continuity

The plugin does not control whether a provider carries files or skill state into an unrelated new conversation. The safe default is:

1. Keep one main Career Centre conversation for the active search.
2. Save the latest Career Passport as a local backup.
3. In a new ChatGPT or Claude conversation, upload the latest Passport plus any new CV or evidence and say “Continue my Career Centre from this Passport.”

The plugin or skill package is installed once. Never ask the user to re-upload the package for each search or each day; only the latest Passport is needed when continuity must move to a new conversation.

Mention this once after setup or the first Passport handoff. Do not nag in the continuing conversation. If a new conversation arrives without a Passport, use the attached CV and current context, explain the history limitation briefly, and continue rather than blocking.
