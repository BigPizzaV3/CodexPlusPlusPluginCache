# HTTP and JSON message boundaries

## Establish the wire contract before decoding

Decide the accepted method, media type, content encoding, API version, character encoding, and maximum decoded size before building a domain command. Reject unsupported media types and content encodings explicitly. Apply `http.MaxBytesReader` or an equivalent hard limit before JSON decoding. If compressed request bodies are supported, also bound the decompressed stream; a limit on compressed bytes is not a limit on allocation or decode work.

Do not retain or read the request body after the handler returns, and stop work when `r.Context()` is canceled. Go's server closes the request body for server requests; if the handler installs decompression or other owned wrappers, ensure their cleanup and the underlying close remain correctly chained. A handler may own temporary buffers and DTOs, but data retained after return must follow an explicit ownership contract.

## Decode one complete value into private state

Decode into a new typed wire DTO. Do not apply defaults, authorize, mutate domain state, or reuse a partially populated destination until decoding and semantic validation both succeed. `encoding/json` can populate fields before returning an error, so an error invalidates the whole candidate DTO.

For a single-document endpoint, require exactly one JSON value followed only by whitespace and EOF. One successful `Decoder.Decode` does not prove the body contains no second value because `Decoder` is a streaming API and may buffer past the requested value.

Choose unknown-field behavior per versioned contract. `Decoder.DisallowUnknownFields` rejects object keys without matching exported struct fields, but strict rejection can itself be a compatibility break for clients that legitimately send newer fields. Tolerant evolution and typo detection are competing product contracts, not universal parser style.

Reject duplicate security-, identity-, routing-, amount-, or operation-defining member names when different components could interpret them differently. RFC 8259 recommends unique object names but does not define one receiver behavior for duplicates; Go's `encoding/json` v1 accepts duplicates and later members replace or merge earlier values. `DisallowUnknownFields` does not reject duplicates. If duplicate rejection is required, enforce it over the token stream or use a reviewed decoder with that documented guarantee before ordinary unmarshaling.

Avoid decoding exact identifiers, counters, or money through `any`, whose JSON numbers become `float64` under the v1 default. Use typed integer/string/decimal wire fields or deliberately preserve number tokens and validate range and scale before conversion.

## Separate parsing, validation, and domain effects

Treat these as distinct stages:

1. transport admission and byte limits;
2. media-type and content-encoding negotiation;
3. syntax and structural decoding;
4. field and cross-field validation;
5. authentication and resource authorization;
6. construction of an immutable domain command;
7. one domain invocation; and
8. protocol-specific response mapping.

Return stable, non-sensitive error categories for unsupported media, oversized input, malformed input, validation failure, conflict, overload, and internal failure. Do not echo raw bodies, credentials, signatures, tokens, or parser internals. Preserve a bounded correlation identity and safe field-level diagnostics when the public contract permits them.

## Test the actual boundary

Exercise empty bodies, valid bodies at the limit, one byte over the limit, trailing values, duplicate critical names, unknown names under each supported API version, numeric overflow or precision loss, cancellation during decode, unsupported encodings, and decode errors after some fields were seen. Assert that no domain effect occurs until the entire candidate message is accepted.
