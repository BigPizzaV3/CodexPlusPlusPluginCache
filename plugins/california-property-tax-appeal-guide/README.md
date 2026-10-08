# California Property Tax Appeal Guide

A California-first Codex plugin that shows the full process and preparation checklist before starting a simple, one-question-at-a-time interview. It is designed for people who are unfamiliar with property tax, forms, or computers.

## Language support

The plugin uses the customer's language automatically when it is clear. Otherwise, it offers:

- English.
- 简体中文 and 繁體中文.
- Español.
- Tiếng Việt.
- 한국어.
- Tagalog / Filipino.
- Bilingual mode using English plus another language.
- Any other language the customer names when reliable support is available.

The customer can say `change language` or the equivalent at any time without restarting the case. Explanations are translated, while exact agency names, form names, field labels, addresses, parcel numbers, dates, values, and source links are preserved. A translated filing draft is not presented as officially accepted unless the county's current rules support that language.

## What appears first

Before asking for the property address, the plugin shows:

1. The selected language and how to change it.
2. The complete eight-step customer journey.
3. What the customer may provide at each step.
4. What is required to start versus merely helpful later.
5. What the plugin can usually find from official public sources.
6. What the customer will receive at the end.

The customer does not need every document before starting. A full address is enough to begin, and the plugin exposes missing items as the case progresses.

At every step it explains:

1. **Why this matters.**
2. **What to do now.**
3. **What happens after this step.**
4. **What the final result may be.**

The guided interview produces three concrete outcomes:

1. **Valuation information** — retrieve and explain the official assessment, factored base-year value when available, valuation date, property characteristics, and estimated value-based tax effect.
2. **Every appeal step** — identify the correct appeal type, protect the filing deadline, locate the county form or portal, and provide a step-by-step plan from informal review through hearing and decision.
3. **Evidence for this property** — find and verify comparable sales, identify factual errors and condition/location evidence, expose missing proof, and assemble a property-specific exhibit list and appeal packet.

## Typical request

> Use $ca-property-tax-appeal in Spanish. First show me the whole process, everything I may need to prepare, what you can find for me, and what I will receive. Then guide me one question at a time.

The plugin asks only one main question per reply. A user can answer `不知道`, `没有`, or `跳过` and continue. A user who already knows the process can request `快速模式`.

If the notice cannot be uploaded, the plugin can guide the customer to the official county property-search page and collect one available field at a time. If the county currently supports online appeal filing and the customer prefers it, the plugin verifies the official portal and deadline, guides each section, and explains which confirmation records to retain.

## Standard deliverables

- Deadline-first case classification.
- Automatic language detection, language menu, bilingual mode, and mid-case switching.
- Up-front process map and customer preparation checklist.
- Clear separation between required, optional, and plugin-researched information.
- Eight small guided stages with a visible progress marker.
- Plain-language definitions, numbered choices, and document-photo alternatives.
- Official property valuation snapshot with direct sources.
- Property-specific evidence gap matrix.
- Verified comparable-sales table and valuation range.
- Estimated variable property-tax effect with assumptions.
- Verified county fee disclosure and a pre-filing break-even check, including waiver or free-review options when officially available.
- Structured case continuity with source, conflict, missing-fact, document, filing-status, and deadline tracking.
- Optional address-to-county resolution through the official U.S. Census Geocoder, followed by county parcel confirmation.
- Document extraction rules, filing-completeness review, and proof-of-submission classification.
- Reminder-ready tracking for verified filing, deficiency, evidence, hearing, and follow-up dates.
- Numbered appeal roadmap with responsible party and due date.
- Form/portal guidance, supporting statement, exhibit index, filing checklist, and hearing-preparation checklist.
- No-upload notice fallback using the official county property-search website.
- Verified online-filing preference flow, including official portal guidance and proof-of-filing retention.

## Boundaries

The plugin provides informational support, not a licensed appraisal, legal advice, tax advice, representation, or guaranteed reduction. It does not sign or submit an application, bypass access controls, or treat listings and automated valuations as verified sales. It always explains that an appeal may reduce the value, leave it unchanged, or sometimes increase it, and that taxes normally remain payable while the case is pending.
