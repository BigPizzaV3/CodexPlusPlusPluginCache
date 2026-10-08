# Privacy

The repository has no analytics, telemetry, hosted service, or network runtime.
The bundled helper reads only paths supplied to it and writes no document data.
Its commands print diagnostics, lint findings, protected-span reports, or diffs
to the invoking process.

Agent clients and separately installed tools may have their own data-handling
policies. Review those policies before processing confidential text. Do not put
sensitive documents into public bug reports or repository fixtures.

The Claude Desktop, ChatGPT/Codex, and Gemini distributions do not add a network
service or telemetry. They execute inside or provide instructions to the host
application. That host may transmit and retain user text under its own terms and
settings. Release archives and `manifest.json` contain project files and
checksums only; they do not contain user documents.

Optional companion skills are separately installed software with their own data
handling. Proofread does not activate terminology web research unless the user
requests professional translation verification and the host permits it. Search
queries should contain only the minimum term required, never confidential
passages or whole documents.
