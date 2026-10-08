# County filing website routing

Use this reference after a California property address is available. Its purpose is to route the homeowner to the correct official county websites without maintaining a stale statewide portal list.

The complete 58-county discovery index is in `references/county-web-index.json`, sourced from the California State Board of Equalization directory at https://www.boe.ca.gov/proptaxes/countycontacts.htm. After resolving the address to a county, run `python3 scripts/lookup_county_web.py "COUNTY"` to retrieve that county's indexed official roots. Treat the output as a starting point and refresh the selected pages before presenting them.

## Address-to-county routing

1. Resolve the full property address to exactly one California county using an official county parcel/property search, official GIS/open-data source, or another reliable address source.
2. If the address could belong to multiple parcels, units, or counties, ask one disambiguating question and stop before filing guidance.
3. Look up the county in `references/county-web-index.json`, then locate both official functions for that county:
   - County Assessor property/assessment search, used to retrieve publicly available assessment information when the notice cannot be uploaded.
   - Clerk of the Board or Assessment Appeals Board filing page, used for formal appeal deadlines, forms, fees, accepted filing methods, and any online portal.
4. Prefer pages on the official county government domain. A filing portal on another domain is acceptable only when the official county filing page links directly to it.
5. Reopen the BOE directory entry and both selected county pages for every case. Navigate from the indexed root to the current property-search and assessment-appeal pages. Record the page title, direct URL, government office, and access date. Do not infer one county's process from another county.
6. Verify the portal is for a formal `Assessment Appeal Application`, not an informal Assessor review, property-record correction, exemption request, or tax-payment service.
7. Verify every filing, processing, hearing, per-parcel, payment, and service fee; whether it is refundable; when it is charged; and whether an official waiver or free informal review exists. Never infer that a county has no fee because the index has no fee entry.
8. Present only the links relevant to the user's property county. Do not burden the user with a 58-county directory.

When the county cannot be established reliably, ask the user to confirm the city/ZIP or county. Do not choose a filing website from city name alone when boundaries are uncertain.

## Santa Clara County official route

Use these as stable discovery anchors, but reopen them before every Santa Clara County case because deadlines, fees, forms, and portal behavior can change.

- Official instructions: `Appeal your property taxes`, Office of the Clerk of the Board of Supervisors, County of Santa Clara: https://cob.santaclaracounty.gov/appeal-your-property-taxes
- Online filing and case-management portal: https://sccgovaa.custhelp.com/

The official instruction page links to the portal as `File and manage your appeal application`. The portal requires the user to log in or create an account and directs users to have the assessment notice available. If the notice cannot be uploaded or is unavailable, first use the official property-record fallback and identify any remaining notice-only fields; do not invent them.

Before giving Santa Clara filing instructions, reopen the official instructions, its current `Filing dates and deadlines` page, and the linked portal. Verify:

- the appeal type and assessment year are eligible;
- the exact filing window or notice-based deadline;
- the current processing fee and any verified waiver path;
- account, signature, attachment, and payment requirements;
- what confirmation proves successful filing.

As verified on 2026-09-13, Santa Clara County states that beginning June 1, 2026 its nonrefundable administrative processing fee is $290 per parcel/application for residential, vacant land, and agricultural property, and $675 per parcel or account/application for commercial, business, and multifamily property with five or more units. It also lists a 2.22% credit-card service fee with a $1.49 minimum, says applications will not be processed until payment is received in full, describes a possible processing-fee waiver for applicants receiving public assistance, and points to a free informal Assessor review. Reopen the source before repeating any of these terms.

Never include the stray semicolon sometimes copied after the portal URL. The canonical link ends with `/`.

## Other California counties

Build the route dynamically from the verified address and the 58-county index:

1. Search for the official `[County name] County Assessor property search` and `[County name] assessment appeals Clerk of the Board` pages.
2. Open the results and confirm the domain and office identity from the page itself; never cite a search-result snippet.
3. Find the current filing/deadline page and determine whether it links to an authenticated online filing portal.
4. If an off-domain portal is found independently but the official county page does not link to it, treat it as unverified and do not send the user there.
5. If no online filing method is verified, explain the county's currently accepted paper, mail, in-person, or other official method.

Store the result in the case record as:

- `county`
- `county_assessor_record_source`
- `county_appeal_instructions_source`
- `county_deadline_source`
- `county_form_or_portal_source`
- `online_filing_available` (`yes`, `no`, or `unverified`)
- `filing_fee`, `fee_basis`, `fee_due_event`, and `fee_nonrefundable`
- `payment_service_fee`, if applicable
- `fee_waiver_or_reduction`, if officially verified
- `free_informal_review`, if officially verified, with a warning that it does not preserve the formal deadline
- `fee_source`
- `source_access_date`
