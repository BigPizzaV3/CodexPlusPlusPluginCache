# Cross-domain handoff contracts

Use this reference whenever more than one domain participates. Every handoff
must carry:

```text
handoff_id
producer
consumer
capability_ids
mode_and_scope
authorization_level
preconditions
input_contract
output_artifact
ownership_boundary
unknowns_and_cannot
test_evidence
coverage_status
```

## Required handoffs

### Authentication → API domains

Provide the trusted-server `X-API-Key` injection boundary, configuration name,
and redaction behavior. Never pass a real key or imply it was validated.

### Media → Messages

Provide the confirmed media ID/reference and lifecycle assumptions. Upload does
not send a message. Preserve the documented interactive-header link exception.

### Templates → Messages

Provide template name, language, and confirmed lifecycle/status evidence.
Template lifecycle remains owned by Templates; composition and sending remain
owned by Messages. Do not treat create success as approval or delivery.

### Messages → Retrieve / Webhook Receiver

Provide the YCloud message ID separately from project `externalId`. Preserve
accepted-versus-final status, duplicate/out-of-order events, and unknown states.
Carry webhook `event.id` separately from `whatsappMessage.id`; the receiver owns
event-level deduplication while the message consumer owns lifecycle projection.
Different event IDs for one message must not be collapsed into duplicates.

### Webhook Endpoint Management → Receiver

Provide endpoint ID, trusted tenant mapping seam, candidate-secret configuration
boundary, raw-body requirement, and event-catalog provenance. Do not claim a
provider dual-secret overlap window.

### WABA → Phone Numbers → Messages / Templates

Pass an opaque, case-sensitive WABA ID and separately confirmed phone-number
identity/configuration. Registration or settings success does not authorize or
prove message/template mutation.

### Groups → Messages

Pass the opaque group ID or invite-link message ID separately from request and
project correlation IDs. Group mutation acceptance and message final state are
different lifecycles.

### Flows → Messages

Pass opaque Flow ID plus confirmed lifecycle/status evidence. Flow publication
does not submit, accept, deliver, open, or complete a message.

### Webhook Receiver → Inbound Messages

Pass a verified and durably accepted inbound-message ID or `wamid`; never use
the webhook envelope event ID as the message operation path parameter.

### Balance → Project readiness policy

Pass synthetic or runtime balance evidence with provenance and freshness.
Balance does not certify affordability, account health, send acceptance, or
delivery.

### Contacts → Custom Events

Pass an opaque contact ID and only the explicitly selected event properties.
Contact persistence does not ingest an event; event acceptance does not prove
downstream processing. Keep contact and event-definition ownership separate.

### Contacts → Unsubscribers

Pass the opaque contact/customer identity and an explicit channel selector.
Never infer an unsubscribe state from contact existence or reuse a contact-note
ID as a customer ID.

### Contacts → Messages

Pass the confirmed destination/contact artifact separately from a message ID or
project `externalId`. Contact retrieval does not establish messaging eligibility,
acceptance, or delivery.

### Unsubscribers → Messages

Pass source-bound customer/channel eligibility evidence with freshness and the
project policy decision. It is an input to submission policy, not proof that a
provider will accept, reject, or deliver a message.

### Phone Numbers / Webhook Receiver → Calling

Pass a separately confirmed phone-number identity and verified call-related
event artifact. Keep phone-number ID, call ID, message ID, and webhook event ID
distinct. Calling command acceptance is not final session state.

### Calling → Media

Pass the opaque media reference returned by the call-media operation with its
call provenance and authorization boundary. A download handoff is not durable
storage, permission for reuse, or a later message send.

### Architect → Domain → Architect

Architect supplies normalized mode, selected capability rows, project seams,
authorization, preconditions, and expected evidence. Domain returns row status,
changed or proposed artifacts, tests/results, unknowns, and outgoing handoffs.
Architect merges the matrix and reports gaps; it must not delegate final coverage
accounting to the user.
