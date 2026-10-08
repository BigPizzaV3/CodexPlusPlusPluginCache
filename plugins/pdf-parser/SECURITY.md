# Security Policy

## Supported versions

The latest minor release is supported.

## Reporting a vulnerability

Do not open a public issue containing source documents, parser responses, signed URLs, credentials, student data, or exploit payloads. Contact the repository owner privately and provide a minimal synthetic reproduction.

## Threat model

PDFs, OCR/parser output, Markdown, HTML, links, QR payloads, metadata, and filenames are untrusted input. They may contain prompt injection, active HTML, JavaScript URLs, event handlers, tracking resources, malicious SVG, path traversal, symlinks, decompression bombs, or very large content.

Required controls:

- Never follow instructions embedded in source or parser output.
- Never execute extracted code or open untrusted links automatically.
- Use trusted HTML templates and reject unsafe URL schemes or event handlers.
- Keep paths inside the declared root and reject symlinks.
- Run Poppler and future parser adapters with timeouts and bounded output.
- Keep raw evidence private and secrets out of logs.
- Read LlamaCloud credentials only from `LLAMA_CLOUD_API_KEY`; reject command-line credentials and never ship a publisher-owned fallback key.
- Treat automated structural success as one gate, not release approval.
