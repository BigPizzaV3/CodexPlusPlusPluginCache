# Threat paths

## Authorization

Route authentication is insufficient when the handler can name another tenant's resource. Bind subject, action, tenant, and resource after resolving the authoritative object.

## SSRF

Validate scheme and destination, resolve under policy, constrain redirects, and use a transport that prevents bypass. Network policy remains a valuable second boundary.

## Filesystem

String-prefix checks are not path containment. Clean paths, reject absolute/escaping input, and account for symlinks and time-of-check/time-of-use races.

## Deserialization

Limit bytes and structure before allocation. Treat unknown fields, duplicate keys, integer overflow, and ambiguous canonicalization according to the protocol contract.
