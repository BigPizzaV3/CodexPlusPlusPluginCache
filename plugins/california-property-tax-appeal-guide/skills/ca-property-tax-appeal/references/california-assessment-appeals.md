# California residential assessment appeals

Last source verification: 2026-08-30. Treat all dates, county procedures, form revisions, and URLs as stale until reopened for the user's assessment year.

## Required official sources

Open current versions of these sources before advising:

- California State Board of Equalization (BOE), Proposition 8 overview: https://www.boe.ca.gov/proptaxes/decline-in-value/
- BOE, Proposition 8 process: https://www.boe.ca.gov/proptaxes/decline-in-value/how-it-works.htm
- BOE, Assessment Appeals: https://www.boe.ca.gov/proptaxes/assessment-appeals/
- BOE, Assessment Appeals FAQs: https://www.boe.ca.gov/proptaxes/faqs/assessappeals.htm
- BOE, Publication 30: https://www.boe.ca.gov/proptaxes/pdf/pub30.pdf
- BOE annual Letters to Assessors index: `https://www.boe.ca.gov/proptaxes/YYYY.htm`
- Current county Assessor and Clerk of the Board/Assessment Appeals Board pages.

When a BOE publication conflicts with a statute, regulation, current Letter to Assessors, or county-specific filing instruction, surface the conflict and rely on the controlling/current official authority. Do not rely on a search-result snippet.

## Classify before selecting a deadline

### Proposition 8 decline in value / regular roll

- Test market value against factored base-year value as of the January 1 lien date.
- A reduction applies only if January 1 market value is lower than the factored base-year value.
- Treat the reduction as temporary. The Assessor reviews it annually; restoration can exceed 2% in one year but cannot exceed the factored base-year value absent change in ownership or new construction.
- Check the BOE's annual county filing-period letter. The statutory regular period begins July 2 and ends September 15 or November 30 depending on the county's certified notice practice for that year.
- Do not assume that a County Assessor's informal decline-in-value request preserves or extends the formal deadline.

For 2026 only, BOE LTA 2026/023 is the statewide deadline table: https://www.boe.ca.gov/proptaxes/pdf/lta26023.pdf. Reopen it and the county Clerk page before citing a deadline. Do not reuse its dates for another year.

### Base-year value, supplemental assessment, or escape assessment

- Use the change-in-ownership or new-construction completion date stated on the notice as the valuation date when applicable.
- Do not apply the regular July 2 filing window automatically.
- BOE's current general guidance describes a 60-day filing period tied to mailing of the supplemental/escape notice or, in some circumstances, the supplemental tax bill. County procedures and Revenue and Taxation Code section 1605 treatment can differ. Verify the notice, county Clerk instructions, and controlling rule before stating the deadline.

### Calamity reassessment

- Use the date of the misfortune or calamity as the valuation date.
- BOE's general FAQ describes an appeal deadline of six months from mailing of the reassessment notice. Verify the county's current instruction and the actual mailing date.

### Exemption, tax rate, bill, or ability-to-pay issue

- Do not route automatically to an Assessment Appeals Board. BOE states that an appeals board lacks jurisdiction to grant/deny exemptions or decide tax rates, tax bills, local budgets, tax policy, or ability to pay.
- Route factual assessment/value issues to the Assessor or Appeals Board as applicable; route billing/payment issues to the Tax Collector; identify the responsible exemption program without offering an appeals-board remedy it cannot grant.

## California evidence rules

- Determine the applicable valuation date first.
- Exclude any comparable sale occurring more than 90 calendar days after the valuation date. The 90th day is permissible; the 91st is not.
- Prefer arm's-length sales close to the valuation date and similar in location, use, size, age, quality, condition, site, and amenities.
- Present supported adjustments for material differences. Do not fabricate per-square-foot or amenity adjustments.
- Evidence previously sent to the Assessor or attached to the application must still be presented at the hearing to be considered by the board.
- A formal appraisal may be submitted, but the board may require its preparer to attend and answer questions.

## Filing and hearing safeguards

- Obtain BOE-305-AH from the county Clerk of the Board. The 2026 BOE forms list identifies revision 12 dated 05/24, but verify the county's current prescribed form rather than shipping a stale copy.
- Confirm whether the county accepts e-filing; California permits a county to adopt authenticated electronic filing but does not require every county to offer it.
- Verify e-filing separately for the user's county, appeal type, assessment year, and filing window. Use the current official Clerk of the Board/Assessment Appeals Board portal, not an Assessor review form or a third-party form service.
- For Santa Clara County, use the official instruction page at https://cob.santaclaracounty.gov/appeal-your-property-taxes and the online filing portal linked from that page at https://sccgovaa.custhelp.com/. Reopen both before giving instructions and verify eligibility, deadline, account/signature, attachment, payment, fee, and confirmation requirements. Do not include a trailing semicolon in the portal URL.
- For every other county, follow `references/county-filing-routing.md`: resolve the county from the property address, find the official Assessor record page and official Clerk/Assessment Appeals page, and accept an off-domain portal only when the official county page links to it.
- When a user prefers online filing, guide one portal section at a time and require a final user review. A portal draft, upload, or payment attempt is not proof of filing; retain the official confirmation number/page, timestamp, submitted application, attachments, and receipt when applicable.
- If a notice cannot be uploaded, locate the official county property-search page by address or APN. Keep website assessment data separate from notice-only facts such as mailing date, notice type, and a printed deadline.
- Warn the user that the board may leave the assessment unchanged, reduce it, or increase it.
- Warn the user to pay taxes on time despite a pending appeal; a successful reduction may lead to a refund with interest.
- Identify burden of proof without overstating it. BOE says the Assessor bears it in specified cases including an owner-occupied primary-residence single-family dwelling; in other cases the applicant generally bears it.
- If useful, explain the exchange-of-information procedure: a request generally must be made at least 30 days before hearing and the response at least 15 days before hearing, subject to local rules.
- Do not recommend whether to designate the application as a claim for refund without presenting the BOE's stated consequences and advising review of county instructions or qualified counsel.

## Required California output labels

Report these fields explicitly:

- `appeal_type`
- `county`
- `assessment_year`
- `valuation_date`
- `latest_admissible_sale_date`
- `formal_filing_deadline`
- `deadline_source`
- `county_form_or_portal_source`
- `informal_review_deadline`, if applicable
- `taxes_still_due_warning`
- `board_may_increase_value_warning`
- `evidence_confidence`
- `unresolved_facts`
