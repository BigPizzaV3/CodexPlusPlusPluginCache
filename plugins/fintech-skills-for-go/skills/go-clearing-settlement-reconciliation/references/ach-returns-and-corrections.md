# ACH returns and corrections

This reference applies to commercial ACH entries processed through FedACH under the active Operating Circular 4 and incorporated applicable ACH rules. It does not establish rules for Fedwire, cards, RTP, FedNow, government entries with separate requirements, or an institution's private contract. Verify the current Nacha rules, Federal Reserve circular, processing schedule, SEC code, account type, and participant role before encoding a deadline or permitted action.

## Preserve the original and every response

Keep the original forward entry immutable. Record its trace and batch identity, SEC code, Originator and ODFI identifiers, RDFI, amount, effective and settlement dates, source file, acknowledgment, settlement evidence, and rule version. A FedACH file acknowledgment reports receipt and limited processing; it does not guarantee that every item will be accepted.

Represent every return, Notification of Change (NOC), reversal, dishonored return, and contested dishonored return as its own evidence-bearing item linked to the original. Preserve its rail identity, code, amount when value-bearing, sender role, business day, source artifact, processing acknowledgment, and settlement evidence. Deduplicate on stable rail identity and fingerprint, not on a new local ingestion ID. Out-of-order delivery changes observation order, not economic or rule order.

## Do not collapse different mechanisms

- **Return:** an RDFI or other permitted party sends an item back under an applicable reason and deadline. The return is a new value-bearing event whose settlement can debit and credit the participant accounts separately from the forward item. Do not rewrite the original as if it never settled.
- **Notification of Change:** a nonvalue message communicates corrected information. It neither moves funds nor proves the current forward item succeeded or failed. Multiple change codes can exist for one forward item. Whether corrected data must or may govern later entries depends on the active rules, SEC code, entry recurrence, and party role; version the instruction and never mutate historical evidence.
- **Reversal:** an Originator-side corrective entry allowed only for specified erroneous-entry conditions and within the active rule window. It is not a generic cancellation, fraud recall, funding repair, or “do-over.” Preserve and reconcile both the original and reversing entries; the reversal can itself be returned.
- **Dishonored or contested return:** a later rule-governed response to the propriety of a return. It has its own identity and can create provisional and reversing settlement evidence; it is not a status edit on the first return.

Settlement of a forward entry is therefore not proof that no authorized return can arrive later. Conversely, initiating a return or reversal is not proof that the corrective movement settled.

## Bind decisions to role and time

Model Originator, ODFI, ACH Operator, RDFI, Receiver, and settlement-account holder explicitly. The same local service may act for only one of them, and a permission held by one role does not transfer to another.

Compute deadlines from the rule version, reason or change code, SEC code, account and authorization class, settlement date, banking-day calendar, and current processing schedule. Store the inputs and resulting deadline with its policy version. Do not hard-code a universal “two banking days” or apply a consumer extended-return window to every entry. Route late, unsupported, or evidentially incomplete cases to an explicit exception state rather than silently forcing a convenient code.

Once an item is sent to a Reserve Bank, amendment or revocation is limited by the applicable rules. A timeout or missing local acknowledgment does not create permission to originate an offsetting reversal. Resolve submission ambiguity using acknowledgments, file and item searches, settlement statements, and stable identities before retrying or correcting.

## Post and reconcile the economics

Post each value-bearing rail event through a replay-safe ledger identity. Link return and reversal postings to the original economic instruction without deleting earlier postings. NOCs update a versioned future-origination instruction where permitted but create no value posting by themselves.

Reconciliation should account separately for forward settlement, return settlement, reversal settlement, fees, dishonored-return provisional settlement, and later contest outcomes. Expose unmatched items, duplicate identities, code conflicts, approaching deadlines, late exceptions, and rule-version drift. Test duplicate files, two NOCs for one entry, return-after-settlement, reversal return, contested return, weekend and holiday boundaries, missed acknowledgments, and reprocessing after a crash.

Primary evidence: [Federal Reserve Operating Circular 4, effective January 5, 2026](https://www.frbservices.org/binaries/content/assets/crsocms/resources/rules-regulations/010526-operating-circular-4.pdf), [FedACH derived returns and NOCs FAQ](https://www.frbservices.org/resources/financial-services/ach/faq/derived-returns-nocs.html), and [Nacha on ACH reversals](https://www.nacha.org/news/second-chance-understanding-ach-reversals).
