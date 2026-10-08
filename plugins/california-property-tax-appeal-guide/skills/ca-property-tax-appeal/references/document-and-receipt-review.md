# Document and filing-proof review

Read this reference when the user uploads a notice, tax bill, appraisal, evidence exhibit, portal screenshot, submitted PDF, receipt, or acknowledgment.

## Safe document intake

Ask the user to cover SSN, bank/card information, passwords, login codes, and unrelated medical or financial details. Do not require redaction of the property address, APN, assessment values, notice date, or applicant name when those fields are needed, but minimize repeating them.

Record the document as `user_provided`. Extract only fields relevant to the case and attach the page/location plus confidence (`clear`, `uncertain`, or `unreadable`). Never silently resolve an uncertain character in an APN, date, value, or confirmation number.

For a notice, extract and confirm in this order:

1. Document title and issuing office.
2. Assessment year and notice type.
3. Mailing/notice date and printed appeal deadline.
4. APN and property address.
5. Total, land, and improvement values.
6. Valuation or event date when shown.

If extraction is partial, ask about one uncertain field at a time. Compare against the official record and place material differences in `conflicts`.

## Filing packet completeness review

Before the user signs or submits, compare the completed application against the current county form/portal requirements. Check applicant authority, APN/account, assessment year, appeal type, value on roll, opinion of value, facts/reasons, representative authorization, attachments, signature/declaration, fee or waiver, and filing method. Label each `complete`, `missing`, `conflicting`, `not applicable`, or `requires user attestation`.

Never sign, certify, choose an attestation, or state personal knowledge for the user.

## Filing proof review

Classify uploads using these rules:

- `draft_only`: saved application, populated form, portal preview, cart, or payment screen without a received/submitted message.
- `confirmation_unverified`: screenshot or email appears to acknowledge an action but lacks the filing authority, case/APN/application identifier, or received/submitted date.
- `confirmation_verified`: official confirmation identifies the filing authority, a submitted/received event, case/APN/application identifier, and date/time or official receipt date.

Payment alone does not prove filing unless the official receipt explicitly ties payment to a received appeal application. An upload-complete message does not prove the whole application was submitted. If proof is incomplete, tell the user exactly what confirmation page, acknowledgment email, or case-status record is still needed.

After verification, store the confirmation number, received/submitted timestamp, submitted application, attachment list, and receipt. Remind the user to preserve original files outside the chat.
