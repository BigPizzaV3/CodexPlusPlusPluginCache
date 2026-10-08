# AI attack methodology

Use this reference to choose attack families from observed application signals. Do not run every family against every input.

## Discovery and baseline

1. Locate model, embedding, vector, agent, and moderation SDK calls.
2. Trace each call to its caller, route, job, upload, connector, or UI action.
3. Replay a benign request and preserve the request shape, identity, response shape, latency, and output sink.
4. Probe guardrails progressively and distinguish keyword rejection, semantic refusal, moderation envelopes, rate limits, and application errors.
5. Test one endpoint and controllable field as one injection point; do not blend results across fields.

## Direct instruction control

Exercise distinct concepts such as role confusion, delimiter or chat-template smuggling, fake policy/config blocks, structured-output coercion, competing objectives, many-shot priming, gradual multi-turn escalation, payload splitting, language switching, and Unicode or encoding transformations.

Use harmless markers during exploration. Promote only when the same technique crosses an application-specific policy, data, workflow, tool, or authorization boundary. Stop repeating a concept after bounded cosmetic variants fail; move to a semantically different idea.

## Indirect ingestion and RAG

Use formats the target genuinely processes: document body and properties, PDF or DOCX metadata, image metadata, CSV or JSON fields, email, calendar, ticket, connector content, fetched URLs, profile fields, filenames, or knowledge-base chunks.

Embed a unique retrieval marker and a benign requested effect. Track three distinct states:

- **stored** — the application accepted the content;
- **retrieved** — a response or trace proves that exact content entered model context;
- **changed** — the content caused security-relevant behavior beyond faithful quotation or summarization.

Require all applicable states. Test cross-user or cross-tenant impact only with separate validated identities and a disposable shared corpus.

## Data and memory isolation

Test application-specific system or developer instructions, private RAG sources, conversation memory, cross-session context, cross-tenant retrieval, embedding/vector exposure, error-state context, and secrets embedded in prompts or configuration.

Treat public policy summaries, model self-description, invented records, and intentionally public content as observations. For a leak, prove non-public origin and preserve only redacted content metadata.

## Rendered output

Map every consumer: chat bubble, citation card, tool-result panel, shared thread, saved note, export, HTML preview, or diagram renderer. Match tests to the real renderer: Markdown images and links, HTML/SVG/iframe contexts, Mermaid, attribute contexts, sanitizer parse differentials, citation metadata, and stored output.

Place a unique canary in model-controlled output, open the real view in a browser, and capture a callback, DOM mutation, console marker, dialog, or stored cross-user trigger. Plain API echo or escaped text is not execution.

## Tools, MCP, and autonomous flows

Enumerate advertised tools, resources, prompts, schemas, and planner steps before making calls. Re-enumerate during long sessions to detect changed descriptions or behavior.

Test with disposable resources and harmless actions:

- instructions embedded in tool descriptions or resources;
- parameter injection and scope expansion;
- low-privilege requests that induce privileged tool access;
- planner or task-list redirection;
- output from one tool piped into a more privileged tool;
- autonomous callbacks without operator authorization.

Distinguish capability from agency: a tool existing is inventory; the agent invoking it across a real boundary is evidence.

## Resource controls

Measure input and output limits, sustained request rate, tenant quotas, concurrent requests, reasoning or output amplification, tool retry loops, context growth, and streaming connection behavior. Use conservative ceilings and stop on latency growth, errors, instability, or budget risk.

Quantitative cost claims require observed input/output usage and sustainable request rate. Consolidate multiple resource-control failures on the same endpoint into one finding.

## Chaining

Chain only captured primitives. Examples include retrieved instruction to unauthorized tool call, private prompt leak to targeted control bypass, or model output to browser-side execution. Prove every link and the composed effect; a plausible graph is not evidence.

## Exploit intelligence

Search current intelligence only for an exact observed provider, framework, component, or version. Record source, affected range, fixed version, prerequisites, and applicability. Classify the result as a lead until reachability and target behavior are proven.
