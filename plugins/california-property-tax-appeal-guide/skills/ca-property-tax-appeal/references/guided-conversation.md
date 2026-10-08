# Guided conversation playbook

Use this playbook as the default user experience. The goal is to show the customer the complete journey before collecting information, then help them finish without first understanding property-tax terminology.

## Contents

- Conversation contract
- Language setup
- Preparation screen
- Eight stages
- Plain-language rules
- Guided Mode versus Fast Mode

## Conversation contract

Before the first property question, apply `references/multilingual-support.md`, read `templates/customer-preparation-checklist.md`, and show the preparation screen below in the selected language. Translate this opening into the selected language:

> First I will explain the whole process, what you may need, what I can research, and what you will receive. You do not need to prepare everything now; after that, I will ask one question at a time.

The preparation screen may contain the full roadmap and checklist, but it must end with only one choice question. After the user chooses to start, use one main question per reply. A request to upload one document is one question. Never ask for an address, notice date, value, and property facts in the same reply.

## Language setup

When the user's preferred language is clear, use it automatically and show a short language status before the preparation screen. When it is unclear or the user requests options, show only the language menu from `references/multilingual-support.md`; show the preparation screen after the user chooses.

Treat a language change as a display preference, not a new case. Resume the same stage with all prior information intact.

Use `references/case-state.md` to retain the stage, verified facts, source strength, conflicts, unresolved facts, deadlines, documents, and filing status.

## Preparation screen

Show these sections in this order:

1. `语言`: show the selected language and say it can be changed at any time.
2. `整个流程`: summarize all eight stages in one short numbered list.
3. `开始必须有`: full property address; notice/tax bill if available; any known printed deadline. Say that the address alone is enough to begin.
4. `以后可能有帮助`: group purchase/property facts, condition evidence, and other supporting documents. Say these are not all required.
5. `我通常可以帮你查`: official offices and public record, current county rules/form/deadline, candidate comparable sales, and official tax-rate information when accessible.
6. `最后你会得到`: deadline alert, valuation explanation, appeal-strength conclusion, evidence list, comparable analysis, requested value when supportable, filing plan, statement, exhibits, and hearing checklist.
7. `隐私提醒`: do not send Social Security numbers, bank information, passwords, or unrelated sensitive data.
8. Ask one choice question: `1）现在开始；2）先看详细准备清单；3）先上传通知单。`

Keep this overview concrete but scannable. Use short numbered items instead of a dense table. Do not ask for the address until the user chooses `现在开始`. If the user asks for the detailed list, render the full customer preparation checklist and end with the same single start choice.

If the first user message already mentions a deadline within 30 days, a deadline tomorrow/today, or uncertainty about whether time has expired, protect the deadline first. Show the preparation screen after the urgent action is clear.

Use this response shape:

```text
第 X 步（共 8 步）：[short name]

为什么： [one or two short sentences]

现在怎么做： [one small action, with 2–3 numbered choices when useful]

问题： [one question ending with one question mark]

不知道也没关系： [say “不知道 / 没有 / 跳过” or upload a photo]

完成后： [one sentence about what the answer unlocks]
```

Translate every label in this response shape into the selected language.

Do not repeat every label when a one-line confirmation is enough. Keep the structure predictable, not robotic.

## Eight stages

### 1. Identify the property

Ask for the full street address. Explain that the address identifies the correct county office and official record. If multiple parcels or units match, show only the minimum distinguishing information and ask which one is theirs.

Example question:

> 这套房子的完整地址是什么？请写门牌号、街道、城市和邮编；不知道邮编可以不写。

### 2. Protect the deadline

Ask whether the user has an assessment notice, supplemental notice, escape assessment, or appeal letter. Prefer a photo or PDF when the user cannot read it. Extract only case-relevant fields and ask the user to confirm one uncertain field at a time.

Explain in plain language:

- `正式截止日` means the last day the correct appeals office can receive an acceptable application.
- An informal Assessor review normally does not preserve the formal appeal deadline.
- Taxes normally still must be paid on time during an appeal.

If a deadline is within 30 days, unknown, or possibly expired, pause the eight-stage order. Show `紧急：先保护截止日期`, the verified date or uncertainty, and the single safest action. Do not wait for a full valuation study before protecting a live deadline.

#### Notice upload fallback

Trigger this branch when the user says an upload failed, cannot take a photo, does not have the notice nearby, or prefers not to upload it.

1. Reassure the user that the case can continue without an upload. Do not ask them to troubleshoot repeatedly.
2. If the property has not been identified, ask only for the full property address. Use it to identify the county.
3. Open and verify the current official County Assessor website. Locate its public property or assessment search. Never send the user to a paid lookup site when an official search is available.
4. Give short, device-friendly directions using the labels currently visible on the official site: where to click, whether to search by address or APN, and which single field to find next.
5. Ask for only one item per turn, starting with the field most likely to protect the deadline: notice type/title, notice or mailing date, printed appeal deadline, assessment year, APN, then total/land/improvement values as relevant.
6. Treat facts copied from the website as `Official website record` with URL and access date. Do not call that record the user's mailed notice. Mark notice-only facts as unresolved until confirmed from the notice or county office.
7. If the website requires login, CAPTCHA, payment, or is inaccessible, do not bypass it. Offer two paths in one question: call the official office using the verified phone number, or continue provisionally with the address and known facts.

Example next question after finding the official page:

> I found the official [County] Assessor property-search page. Can you open this link and tell me the `Assessment Year` shown there? If the page does not open, answer `cannot open`.

#### Online appeal filing preference

Do not assume online filing is available statewide. Follow `references/county-filing-routing.md`. For every case, derive the county from the property address, reopen the current official County Clerk of the Board or Assessment Appeals Board page, and verify whether that appeal type and assessment year may be filed online.

For Santa Clara County, start with the official `Appeal your property taxes` instructions at https://cob.santaclaracounty.gov/appeal-your-property-taxes and use the online filing portal that page links to: https://sccgovaa.custhelp.com/. Reopen both before each case and verify the current deadline, eligibility, fee, account, signature, attachment, payment, and confirmation rules. The portal requires login or account creation; never request the user's password or create the account for them without separate explicit authorization and a suitable tool.

After verifying the deadline and accepted filing methods, ask one preference question:

> This county currently accepts [verified methods]. Would you prefer 1) the official online portal, or 2) the verified paper/in-person method?

If the user chooses online:

1. Link only to the official filing page or portal and identify the government office that operates it.
2. State the exact verified deadline and whether the application must be received, completed, or otherwise timely under the county's current wording.
3. List what to have ready: form-ready case data, opinion of value, supporting files, account/email access if required, authorized signer, and verified fee/payment method if any.
4. Walk through one screen or section at a time using the portal's current labels. Distinguish required fields from optional supporting uploads.
5. Before the declaration/signature screen, ask the user to review the completed data. Never attest, sign, certify, pay, or press the final submit control for the user without separate explicit authorization and a suitable tool.
6. Tell the user to save the confirmation page, confirmation number, timestamp, submitted PDF, attachments, and payment receipt if applicable. Ask them to verify that the portal says the filing was received or submitted; a saved draft is not proof of filing.
7. If the portal fails near the deadline, preserve evidence of the error and immediately show the county's other verified timely filing method. Do not claim that a screenshot extends the deadline.

If online filing is unavailable for the appeal type, outside its filing window, or cannot be verified, say so plainly and guide the user through the currently verified alternative.

### 3. Explain the government's numbers

Find the official record when possible. Explain only the values relevant to the case:

- `Assessed value（政府用来计算部分房产税的价值）`.
- `Market value（在指定日期，正常买卖大约能卖多少钱）`.
- `Factored base-year value（按加州规则每年调整后的基础价值）`.
- `Land / improvements（地的价值 / 房屋等建筑的价值）`.

Never dump a property record. State: `政府记录是___；你认为实际情况是___；两者差___。` Ask one confirmation question about the most important discrepancy.

### 4. Learn why the value may be wrong

Offer simple choices, such as:

1. Government record has a factual error, such as square footage or a pool.
2. Similar nearby homes sold for less.
3. The home had damage, poor condition, noise, access, or another problem on the valuation date.
4. The value changed after a purchase, construction, or ownership change.
5. Not sure yet.

Ask the user to choose one. Investigate other theories later instead of asking for all of them at once.

### 5. Collect proof for this house

For the selected issue, ask for one easiest proof item first. Accept a photo in place of typed details. Examples include the notice, tax bill, official property card, closing statement, appraisal, dated photos, inspection, repair estimate, permit, floor plan, or measurement.

Explain the difference:

- `你说的情况` is a useful lead.
- `能显示日期和来源的文件或照片` is stronger proof.
- A repair estimate shows possible cost but does not automatically prove the same reduction in market value.

Never ask for Social Security numbers, bank details, or unrelated personal records. Tell the user to cover sensitive information before uploading documents when it is not needed.

For every uploaded document, follow `references/document-and-receipt-review.md`. Record extraction confidence and ask the user to confirm one uncertain case-critical field at a time.

### 6. Compare similar sales

Explain a comparable sale as: `同一时间、附近、大小和条件相近，而且真正成交的房子`. Research official or primary records first. Explain why each selected property is similar or different in one sentence.

In Guided Mode, show the three strongest sales first as simple numbered cards. Put the full table in the final packet. Do not use listing prices or automated estimates as verified sale evidence.

Ask the user one question about the most material difference that cannot be resolved from records, such as condition, view, or renovation quality.

### 7. Decide whether an appeal is supported

State one of four conclusions:

1. `证据较强`: current evidence supports a lower value.
2. `证据一般`: an appeal may be reasonable, but important proof is missing.
3. `证据较弱`: current evidence does not show the assessment is too high.
4. `现在不能判断`: critical facts, dates, or verified sales are missing.

Explain the supported range, requested value, and estimated variable-tax effect without promising savings. Say clearly when the best evidence supports the Assessor instead of the user.

Before asking the user to proceed to a paid formal filing, show a short `Cost check` in plain language:

1. Verified county fee and whether it is nonrefundable.
2. Estimated one-year variable-tax reduction, if supportable.
3. First-year estimate after unavoidable fees and the assessed-value reduction needed to break even.
4. Evidence confidence, time/other cost warning, possible increase risk, and any verified waiver or free informal-review path.
5. A neutral conclusion: financially favorable, close call, financially unfavorable, or cannot tell yet.

Then ask one choice question: continue with the formal appeal, try the verified free/waiver path first, or pause. Do not decide for the user or imply that a positive arithmetic estimate guarantees success.

Ask the user to confirm the facts before drafting the support statement.

### 8. Finish the action plan and packet

Give the user one immediate action at a time, starting with the filing deadline. Then provide the complete numbered roadmap and packet.

When multiple filing methods are accepted, record the user's preferred method. For an online preference, include the official portal link, portal requirements, a pre-submission review step, and the exact proof of filing the user should retain.

After a verified deadline or hearing date is added, follow `references/deadline-follow-up.md` and offer user-approved reminders. After submission, review the confirmation and do not mark the case filed merely because a draft was saved, a document uploaded, or a payment attempted.

End with four plain-language blocks:

- `今天做什么`.
- `以后会收到什么`.
- `最后可能怎样`.
- `什么时候需要找真人帮助`.

Explain possible outcomes without alarm:

- The value may be reduced; a corrected bill or refund may follow according to county processing.
- The value may stay the same.
- The board may sometimes increase the value when evidence supports it.
- A late or incomplete filing may be rejected or require correction.

Do not give a universal processing-time estimate. Use a current official county source or say the timing is not confirmed.

## Plain-language rules

- Match the user's language and preferred terms.
- Use sentences that usually contain no more than one idea.
- Prefer `政府估值` before introducing `assessment`.
- Use exact calendar dates, such as `2026年11月30日`, not only `月底` or `很快`.
- Use digits and commas for money, such as `$850,000`.
- Limit answer choices to three when possible; add `不知道` as the escape choice.
- Put the next action before background details.
- Avoid tables during intake. Use tables only in the detailed packet.
- If the user is confused, rephrase once with an example instead of repeating the same wording.
- If another person is helping, explain that the county may require authorization before that person signs, files, or represents the owner.

## Guided Mode versus Fast Mode

Use Guided Mode by default. Switch to Fast Mode only when the user asks for a complete report, says they understand the process, or supplies a complete case file and asks for analysis.

Fast Mode may collect multiple related facts together and deliver the full packet at once, but it must retain deadline warnings, sources, evidence standards, possible outcomes, and guardrails.
