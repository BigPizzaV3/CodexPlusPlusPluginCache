# Evaluation cases

These cases validate the `$ca-property-tax-appeal` skill, including multilingual selection and switching, its up-front process/preparation screen, default one-question-at-a-time Guided Mode, valuation information, every appeal step, and property-specific evidence.

## 1. Deadline-first behavior

User provides a notice with an appeal deadline in five days and asks for a complete valuation study. Expected: verify and lead with the deadline and filing method, then proceed with research; do not bury the deadline.

## 2. Ambiguous parcel

One street address maps to two condominium parcels. Expected: stop before valuation analysis and ask the user to identify the correct unit/parcel without exposing unrelated owner details.

## 3. Weak evidence

Only two distant listings are available and neither is a verified closed sale. Expected: label evidence insufficient, avoid a requested value, and explain how to obtain official sales records.

## 4. Assessment appears supported

Three strong verified sales indicate a value above the assessment. Expected: state that an overvaluation appeal is not supported by the current evidence and suggest checking factual errors or exemptions.

## 5. Tax-savings confusion

User subtracts proposed value from assessed value and calls the result tax savings. Expected: correct the distinction, locate the official formula, and show an assumption-labeled estimate.

## 6. Chinese-language request

User asks in Chinese about a California property. Expected: analysis in Chinese, official agency/form names retained in English, actual appeal draft in the authority's accepted language, and no unsupported statement about California-wide deadlines.

## 7. California 90-day boundary

Valuation date is January 1, 2026. One sale closed April 1 and another April 2. Expected: April 1 is admissible as day 90; April 2 is excluded from the evidentiary set.

## 8. California appeal-type routing

User provides a supplemental assessment notice mailed August 10 after a home purchase. Expected: do not use the regular July 2–September/November window; verify the county's notice-based filing rule and the applicable valuation date.

## 9. Informal review does not protect formal deadline

User says the County Assessor is reviewing a Prop 8 request and the formal deadline is next week. Expected: warn that the processes are separate, verify the Clerk's deadline, and prioritize timely formal filing if the user chooses.

## 10. Board and payment warnings

User assumes filing freezes the tax bill and the board cannot raise value. Expected: correct both assumptions using BOE sources: taxes remain due, and the board may decrease, leave unchanged, or increase the assessment.

## 11. California tax estimate

Assessment reduction is $100,000, tax bill ad valorem rate is 1.12%, and direct assessments total $900. Expected: estimate $1,120 variable-tax reduction and leave the $900 direct assessments unchanged rather than claiming $2,020 savings.

## 12. Property-specific evidence rather than a generic checklist

The Assessor record shows 2,100 square feet and a pool, while the owner says the house is 1,760 square feet with no pool and has dated foundation damage. Expected: create separate evidence rows for living area, pool, and foundation condition; identify official plans/measurements, record correction proof, dated photos, inspection, and repair estimates; connect each item to the valuation date; do not simply return a generic document list.

## 13. Complete appeal roadmap

User asks, "What do I do next?" Expected: return numbered county-specific steps from notice verification and deadline protection through form filing, exhibits, payment, hearing preparation, decision, and refund follow-up, with status, responsible party, due date, official source, required input, and deliverable for each step.

## 14. First-time user sees the journey before questions

User says in Chinese, "我什么都不懂，帮我上诉房产税。" Expected: first show a scannable eight-step journey, what is needed to start, what may help later, what the plugin can research, final deliverables, and a privacy warning. Say that the address alone is enough to begin. End with only one choice question: start now, view the detailed checklist, or upload the notice. Do not ask for the address yet.

## 15. User cannot read the notice

User says, "信上字太多，我看不懂，也不会输入。" Expected: respond patiently, ask only whether the user can upload a clear photo of the front page, explain how to cover irrelevant sensitive data, and allow `没有` or `跳过`. Do not shame the user or ask them to transcribe multiple fields.

## 16. Explain why, action, and result

User asks why the plugin needs the notice date. Expected: say the date helps identify the correct deadline, tell the user exactly where to look or to upload a photo, and explain that the answer determines how urgently they must file. Use short language and only one main question.

## 17. Urgent deadline overrides normal order

User mentions an official filing deadline tomorrow but has not answered the property-condition questions. Expected: interrupt the normal stage order, lead with the verified deadline or uncertainty and the safest filing-protection action, ask one deadline-protection question, and resume the interview later.

## 18. Plain-language final outcomes

Evidence supports a lower value and the user asks, "最后会怎么样？" Expected: explain without a guarantee that the value may be reduced and a refund or corrected bill may follow, the value may stay unchanged, the board may sometimes increase it, and taxes normally remain due. Give the immediate next action and exact date before technical detail.

## 19. Fast Mode is explicit

An experienced tax professional uploads a complete case file and asks for a full report. Expected: switch to Fast Mode, process related facts together, and provide the complete sourced packet while retaining deadline, evidence, outcome, and payment warnings.

## 20. Preparation data is mapped to steps

User asks, "What should I prepare before we start?" Expected: map possible customer inputs to each of the eight stages and state the output of each stage. Separate the minimum start items, helpful-later documents, and records the plugin usually researches. Do not present every item as mandatory.

## 21. Address-only start remains possible

User says, "I only have the address and no paperwork." Expected: reassure the user that the address is enough to begin, explain what the plugin will try to find, show which notice or facts may be requested later, and start Step 1 with one address question. Do not block the case or demand a full checklist.

## 22. User chooses to prepare first

After the preparation screen, the user selects `2）先看详细准备清单`. Expected: render the complete checklist in short grouped sections, include privacy exclusions, and end with the same single choice to start or upload the notice. Do not begin researching an unknown property.

## 23. Deadline beats the welcome screen

The first message says, "My notice says the appeal is due tomorrow." Expected: lead with an urgent deadline warning and one filing-protection action or question before the ordinary process overview. Show the overview only after the immediate risk is clear.

## 24. Clear-language auto detection

User says in Spanish, "Necesito apelar el valor de mi casa." Expected: continue in Spanish without asking the user to confirm Spanish, show a short language status with a change-anytime instruction, and render the preparation screen in Spanish. Preserve exact English agency and form names when they first appear.

## 25. Language menu when unclear

User says only, "Help" and then asks for language choices. Expected: show the multilingual language menu as the only question. Include English, Simplified Chinese, Traditional Chinese, Spanish, Vietnamese, Korean, Tagalog/Filipino, bilingual mode, and another-language entry. Do not ask for the property address or show the preparation screen until the user chooses.

## 26. Mid-case language switch

At Step 5, after providing the notice, address, deadline, and property facts in English, the user says, "换成中文." Expected: confirm Simplified Chinese in one short Chinese line, preserve all prior information and warnings, and resume Step 5 in Chinese. Do not restart the intake or lose the deadline.

## 27. Bilingual explanation with exact form labels

User asks for Chinese and English together while completing BOE-305-AH. Expected: put concise Chinese first and English second, preserve `BOE-305-AH`, exact English field labels, parcel number, dates, values, and official URLs once, and avoid duplicating a long table.

## 28. Filing language is not assumed

User asks for a Spanish filing statement. Expected: verify the county's current accepted-language rule. If acceptance cannot be verified, prepare the filing-ready version in English and separately label the Spanish text as an unofficial translation for understanding. Do not claim interpreter or accommodation availability without an official source.

## 29. Notice upload fails

User says, "The notice will not upload." Expected: reassure the user that they can continue, use the address to locate the current official county Assessor property-search page, and give short click-by-click directions. Ask for one field at a time and keep website facts separate from notice-only facts. If the official page is inaccessible, offer the verified county phone route or provisional continuation without attempting to bypass access controls.

## 30. User prefers an online appeal

User in Santa Clara County says, "I want to submit online." Expected: verify the current official County Clerk of the Board/Assessment Appeals Board online filing option for the specific appeal type, year, and filing window; state the exact deadline; and link the official portal. Guide one portal section at a time, stop before declaration/signature/payment/final submission unless separately authorized with a suitable tool, and tell the user to retain the confirmation number, timestamp, submitted application, attachments, and receipt.

## 31. Online filing is not verified or portal fails

The county does not offer e-filing for this appeal type, or the portal fails near the deadline. Expected: do not claim statewide online availability and do not treat a draft or error screenshot as a timely filing. Preserve evidence of the error and immediately guide the user to the county's other currently verified filing method.

## 32. Santa Clara official online route

The verified property address is in Santa Clara County and the user prefers online filing. Expected: reopen `https://cob.santaclaracounty.gov/appeal-your-property-taxes`, follow its official `File and manage your appeal application` link to `https://sccgovaa.custhelp.com/`, and provide the clean portal URL without a semicolon. Explain that login or sign-up is required, verify current deadline and fee details, and never request the user's password.

## 33. Address routes another county

The address resolves to Alameda County rather than Santa Clara County. Expected: do not show the Santa Clara portal. Locate the official Alameda County Assessor property search and Clerk/Assessment Appeals filing page, verify the current accepted methods, and use an off-domain portal only if the official county page links to it.

## 34. Any California county is indexed but refreshed

The address resolves to one of California's 58 counties. Expected: use the county web index to find that county's official Assessor and Clerk/Assessment Appeals discovery roots, reopen the BOE directory and county pages, navigate to the current deep links, and report the access date. A null indexed portal means `not yet indexed or not verified`, not `online filing unavailable`.

## 35. Santa Clara residential filing fee is disclosed first

The user owns one Santa Clara County single-family parcel and is considering a formal appeal after June 1, 2026. Expected: reopen the county source and, if still current, disclose the $290 per parcel/application nonrefundable fee before inviting the user to start filing. Also disclose applicable payment service fees, the public-assistance waiver path, and free informal review; warn that informal review does not preserve the formal deadline.

## 36. Worth-it screen is arithmetic, not a promise

Verified evidence supports a $20,000 assessed-value reduction, the exact ad valorem rate is 1.10%, and the unavoidable nonrefundable filing fee is $290. Expected: show estimated one-year variable-tax reduction of $220 and first-year net before other costs of negative $70; label the current numbers financially unfavorable while explaining uncertainty and letting the user decide. Do not guarantee the appeal result or multiply temporary savings across future years.

## 37. County fee is unknown

The address resolves to a county whose current official appeal page does not clearly state a fee. Expected: label the fee unknown, contact/verify the Clerk source, and return `cannot tell yet` rather than assuming the filing is free or declaring it worthwhile.

## 38. Address lookup requires awareness and parcel confirmation

User supplies a California address. Expected: explain before sending it to the official U.S. Census Geocoder, use the result only as a county candidate, and confirm the parcel on the county's official property source. If there is no unique match, ask one disambiguating question rather than guessing.

## 39. Case state survives language change and restart

At Stage 6 the user switches from English to Chinese after deadline, values, and evidence are verified. Expected: preserve the case-state facts, citations, conflicts, unresolved facts, documents, deadlines, and filing status; change only presentation language and continue Stage 6.

## 40. Portal payment is not proof of filing

User uploads a payment receipt but no submission acknowledgment. Expected: classify proof as `confirmation_unverified` unless the official receipt explicitly ties payment to a received appeal application. Do not mark the application submitted; identify the missing confirmation page, email, or case-status record.

## 41. Saved portal draft is not filed

User uploads a completed portal preview and says it is done. Expected: classify it as `draft_only`, explain that a completed draft is not proof of receipt, and guide the user to the final review/submission step without signing or attesting for them.

## 42. Reminder is offered only for a verified date

The county deadline is verified from an official source. Expected: record the source and calculation, offer optional reminder dates, and explain that reminders do not extend or preserve the deadline. Do not create reminders without the user's request or acceptance.

## 43. Stale county index triggers refresh

The selected county index entry is older than the freshness threshold. Expected: reopen the BOE directory and selected county pages, verify the current form, deadline, fee, and portal, and label unavailable details unknown rather than relying on cached values.
