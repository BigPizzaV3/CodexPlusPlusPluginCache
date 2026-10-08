# Interview contract

The interview exists to prevent irrelevant searches and noisy alerts, not to collect a profile. Reuse facts already present in the conversation and ask a single compact batch whenever possible.

## Essential questions

For a one-time search, resolve only fields that could change the result materially:

1. What exact physical product, free public activity or event, or manufacturer freebie is wanted? Ask for category, model, variant, size, color, condition, quantity, or date only when relevant.
2. Where must it be available? Prefer country plus state/region or city. Offer online-only searching when a person declines location.
3. What currency and effective-price ceiling apply? Effective price includes mandatory shipping and known mandatory fees. A percentage discount is not interchangeable with a price ceiling.
4. What does “free” mean here? Distinguish no-purchase zero-cost, free with purchase, BOGO, after rebate, trial or subscription, and sample or sweepstakes. Trials and subscriptions are detected for exclusion, not promoted by version 0.1.0.
5. Which conditions are acceptable: purchase requirement, rebate, membership, trial, auto-renewal, app-only, new-customer, pickup, delivery, used, refurbished, or open-box?
6. Are there preferred, allowed, or blocked merchants or sources, and is there a deadline?

For a recurring watch, additionally resolve:

- cadence and timezone;
- quiet hours when relevant;
- alert threshold: new verified match, price improvement amount or percentage, material term change, and optional expiry warning;
- end date or stopping condition;
- whether unverified leads should be listed in a digest but never alerted as matches.

Do not ask for every optional field. If “any deal” genuinely means no constraint, preserve that explicit choice.

## Privacy boundaries

Ask for the coarsest useful location. A city or region is normally sufficient. Request a postal code only when the user chooses inventory-level locality and explain why. Never request a full address, payment details, account password, one-time code, government identifier, medical information, or proof of eligibility.

Eligibility may be recorded only as a user assertion such as “student discounts are acceptable.” Do not request documents or identifiers. Offer a discreet scheduled-task title when a search topic could be sensitive.

## Watch Card

Before the first search, show a concise Watch Card:

- Looking for
- Geography and currency
- Price or savings target
- Accepted offer types
- Accepted and excluded conditions
- Merchants or source rules
- Deadline
- For recurring watches: cadence, timezone, alerts, quiet behavior, and stopping rule
- For recurring watches: proposed create or update action and, for update, exact host task identifier
- For recurring watches: canonical approval digest for the normalized actionable settings

For a one-time search, proceed after the user answers the necessary questions. For a scheduled watch, ask the user to confirm the complete Watch Card, proposed task action, schedule, and approval digest before any create or update request is sent to the host. Any later change to a digest-bound field requires a new card, digest, and confirmation.

If geography, timezone, or the meaning of free remains ambiguous and could change the result, ask rather than guessing.
