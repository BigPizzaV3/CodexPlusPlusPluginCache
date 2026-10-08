# Security policy

## Supported versions

Version 2.1.x is the current feature and security line. Version 2.0.1 receives critical security fixes during the 2.1 migration window, and version 1.x remains available for its frozen contract. Withdrawn releases are unsupported.

## Reporting

Report non-sensitive defects through the [public issue tracker](https://github.com/theisegoria/chatgpt-skill-plugins/issues). For a vulnerability that would put users at risk if disclosed publicly, contact the repository owner through the private reporting channel available on the GitHub repository. Do not include secrets or private generated files in a public report.

Support and security response are best-effort; no response-time guarantee is offered.

## Security boundary

The plugins generate local text and structural preview files. They reject unsafe paths, symlink escapes, accidental overwrites, malformed specifications, active preview content, unsafe optional-renderer output, and unsafe archive entries. They do not operate a hosted service, authenticate users, send telemetry, automate desktop applications, execute generated model code, or guarantee that a downstream renderer, compiler, simulator, or importer is safe.

Users must review generated source before executing it with external software and must apply appropriate sandboxing and access controls to sensitive inputs.
