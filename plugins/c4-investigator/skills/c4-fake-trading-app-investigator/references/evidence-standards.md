# Evidence handling standard

## Minimum evidence record

For each item record: ID, description, original/derived status, source, collector, acquisition method, acquisition date/time/timezone, original filename or identifier, SHA-256 if available, storage reference, handling restrictions, and related items.

Never treat a chat upload as the forensic original unless the investigator confirms the acquisition path. State when metadata may have been stripped by forwarding, messaging, screenshots, exports, or platform processing.

## Originals and derivatives

- Preserve originals read-only where operationally possible.
- Perform OCR, transcription, enhancement, conversion, redaction, and annotation only on copies.
- Give each derivative its own evidence ID and link it to its source item.
- Record tool name/version, settings, operator, and time for a derived artifact when known.
- Hash before and after transfer where the process supports it; explain mismatches instead of overwriting them.

## Statements and translations

Label a person's account `reported` until corroborated. Preserve original language alongside translation. Record who translated, method used, disputed wording, and uncertainty. Do not merge multiple speakers into one narrative.

## Screenshots and screen recordings

A screenshot demonstrates displayed pixels, not necessarily the truth of the displayed balance, trade, identity, timestamp, or server state. Record device context and capture method. Seek corroborating payment, platform, device, network, or provider records.

## Online and blockchain observations

Record query time, timezone, source URL/provider, network/chain, block height or confirmation state, and raw identifier. Public labels and explorer interpretations are leads. Save the underlying transaction or record when available.

## Finding language

- `Fact`: directly established by cited evidence within its limits.
- `Reported`: asserted by a person or source but not independently established.
- `Inference`: reasoned assessment from cited facts; include alternatives.
- `Unknown`: required fact not presently established.

Confidence applies to an inference, not to the authenticity of an evidence item. Use `high`, `medium`, or `low`, followed by a short rationale.

## Court-readiness caution

The skill can improve organization and traceability but cannot certify admissibility, authenticity, chain of custody, expert competence, or compliance with a court's procedural requirements. Obtain supervisory, forensic, prosecutorial, and legal review.
