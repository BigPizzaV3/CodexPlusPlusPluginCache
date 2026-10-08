# Scientific source authorization

These adapters belong to the Slide Viewer and shared scientific-viewer plugins. They do not add host APIs, inherit native-file grants, or authorize arbitrary filesystem paths or network destinations from a viewer resource ID.

## Model requests and widget requests

Current Codex model tool calls overwrite opted-in `codex/sandbox-state-meta` with the current sandbox state. Widget tool calls do not have the same provenance: their `_meta` can be supplied by the widget, and `ui.visibility` alone is not an authorization boundary in the inspected host.

The plugin therefore uses the existing host exclusion for tools declaring `openai/fileParams`, together with model-only visibility and a private in-flight request context. Actual file inputs are named when present; an empty list is a valid declaration for tools without file inputs. This is an adapter for the audited Codex transport behavior, not a universal MCP authentication mechanism. The actual stdio transport and initialized `codex-mcp-client` name are compatibility checks, not cryptographic identity or proof of a minimum release. Other clients may use independently returned MCP `roots/list` for reads; their metadata does not enable privileged operations.

Evidence for that distinction:

- [Codex model metadata overwrite](https://github.com/openai/codex/blob/343074d4207d572809bd8cea15f4be1d09d98e0b/codex-rs/core/src/mcp_tool_call.rs#L753).
- [Codex initialized client identity](https://github.com/openai/codex/blob/343074d4207d572809bd8cea15f4be1d09d98e0b/codex-rs/codex-mcp/src/rmcp_client.rs#L1006).
- [Literal file-parameter lists and the empty-list no-op](https://github.com/openai/codex/blob/343074d4207d572809bd8cea15f4be1d09d98e0b/codex-rs/codex-mcp/src/codex_apps/file_params.rs#L27).
- The widget resolver was inspected at monorepo commit `2b8492a9d7d8781ec78d8567998ea84943f57bbd`, in `codex/codex-apps/webview/src/local-conversation/mcp-app-scope-policy.ts` (`resolveMcpAppToolCall`, `hasOpenAIFileParams`) and `items/mcp-app-resource-content.tsx` (`stripReservedMcpAppToolCallMeta`).

`guardedModelRequest` is a server-only callback into the active private model context, checked around asynchronous work. It must not be reconstructed from arguments, client names, visibility flags, or a prepared-operation lease. Retaining a reader after its guarded handler finishes does not retain model authorization.

## Read leases and revocation

A guarded open or renewal may issue a five-minute read lease bound to the exact source ID, source revision and viewer session. The source also retains its thirty-minute lifetime and transfer budget. UI reads can consume that lease but cannot extend it or use it to open another source. UI metadata is ignored. Renewal requires a fresh guarded model request. Read lease expiry is returned to the caller when a lease is issued.

Where MCP roots are available, the plugin queries the actual current roots before and after reads. Withdrawal of that roots capability does not fall back to the opening metadata or lease. Trusted current filesystem restrictions are intersected with the roots at the actual dataset path; malformed or unsupported restrictions fail closed. An observed current denial, source mutation, session closure, cancellation, or expiry prevents results from being returned. Permission changes that the host has not reported are not observable by this plugin: the lease is a bounded grant, not a claim of instantaneous policy revocation.

## Ordinary card recovery

A guarded local-file chat open may save an opaque recovery reference in the workspace's owner-private `.slide-viewer-state` store. This is available only when the guarded workspace is also an independently returned current MCP root and the guarded request authorizes creating that private store. Rootless, legacy, native, project, and multiple-source presentations retain their existing authorization flow.

The saved record binds one canonical file path, filesystem fingerprint, source revision, workspace identity, and fixed seven-day expiry. An explicit recovery request must authenticate that record and recheck current roots and the exact file before and after opening a fresh runtime. Widget metadata and a historical path do not grant access. Resume results echo the caller's request ID so a late result cannot replace another mounted card. Concurrent updates use checked record revisions; a losing resume closes its new runtime.

Only accepted publications with a ready frame save passive viewport, theme, toolbar, base-layer visibility/opacity, and bounded spatial display settings. Commands, exports, consent, jobs, runtime source IDs, and undo history are not restored. Gene names are resolved against the freshly opened default matrix; ambiguous or absent genes are not silently selected. Imported/composite views disable ordinary recovery and require a fresh authorized open.

**Forget saved access** removes the authenticated record and frees its storage slot. It leaves the source file and an already-authorized healthy runtime unchanged, prevents later recovery, and invalidates pending resumes. Both the healthy viewer toolbar and its recovery panel expose this action. Store and record integrity failures remain failures, including when forgetting access.

## Directory consistency

The default `directory-inventory` mode performs a complete, bounded inventory of regular files and directories. It pins canonical root and ancestor identities, directory mutation fingerprints, file identities and metadata content hashes. Reads reauthorize their child file through the shared file capability layer. Missing keys are bound to their ancestor identities, so additions cannot silently continue to render as empty chunks. Symlinks and unsafe relative keys are rejected.

The explicitly selected `metadata-and-object-validators` directory mode does not enumerate the tree. It pins metadata, observed objects and ancestors as reads occur, including missing metadata probes. It can open large chunked datasets without first listing all chunks, but its observed-object table remains bounded. Neither mode is an OS-atomic filesystem or cross-object content snapshot.

## Anonymous public HTTPS

The source requires an explicit credential-free HTTPS base URL on port 443 and a recognized current network grant. Every key and redirect is constrained to that origin and directory prefix. No cookies, origin authorization headers, arbitrary queries or metadata-provided external URLs are followed. DNS results must all be public addresses; private, loopback, link-local, metadata and reserved destinations are rejected.

A direct connection pins a validated numeric address, verifies the actual TCP peer, and verifies TLS for the original hostname. An explicitly configured HTTP(S) proxy is used through CONNECT instead of bypassed. `HTTPS_PROXY` takes precedence, followed by the HTTP and ALL proxy fallbacks. Conflicting case variants and unsupported proxy transports fail closed. The CONNECT authority and Host header are the same validated public IP and port; a denied numeric CONNECT is not retried with a hostname, a direct connection, a redirect, or `NO_PROXY`. Proxy credentials are sent only to the configured proxy. HTTPS-proxy TLS and inner origin TLS both require certificate and hostname verification, even if a global Node setting attempts to disable it. Tunnel setup accepts only a body-free 200 response and has a ten-second total DNS/connection deadline.

For a tunnel, the actual TCP peer is the configured proxy. Acceptance is delegated route enforcement by that trusted proxy, not proof that the socket itself is connected to the public origin. A managed proxy may reject numeric CONNECT; that is an unsupported access path, not permission to take a different route.

Objects require strong per-resource ETags, or a supplied complete SHA-256 integrity manifest. A whole-object hash is checked against the entire bounded object before any range is returned. ETags and metadata anchors detect changes but do not establish atomic cross-resource coherence or publisher authenticity.

DICOMweb is a separate narrow read policy: bounded QIDO queries, WADO metadata, selected frames, and complete bounded Part 10 instance responses. Metadata and frame/object validators belong to their respective resources. A read source never authorizes STOW; writes require separate exact-destination and body-bound consent.

An explicit DICOMweb SHA manifest is a distinct mode, not an ETag waiver. It pins canonical request paths plus exact Accept representations, full metadata-body bytes, and the encoded payload of each single-frame MIME part with its media type and transfer syntax. Multipart boundaries and envelope size are transport details, not frame identity; their bytes still count against wire limits. The fixed shared MIME parser checks framing and Content-Location. All seeds and requests must be listed before any network I/O, and selected WSI metadata must agree with complete declared frame coverage. A caller-acquired manifest establishes consistency with those supplied bytes, not publisher authenticity. Ordinary strong-validator and object-store manifest modes remain unchanged.

OME-Zarr public project manifests define the admitted object set and explicit missing metadata probes. The adapter rejects unlisted data before the object provider can return a missing object as array fill. Project preparation authorizes and verifies exact source recipes during the original guarded model call. It may read existing signed records but does not create private state, keys or scientific indexes. The one-use consumed command rechecks those prepared bindings before index reconstruction or saved-state writes; it cannot mint fresh model authority. Pending results and cleanup retain their operation and byte reservations until handoff or real I/O drain. Expiry or failed adoption retires only newly prepared sources, never the existing scene.

DICOMweb project recipes similarly require complete representation-bound SHA pins for the explicit selected instances. They retain source-derived topology and delivery identity, not live handles, manifest filesystem paths, leases or a claim of atomic origin state. Restoring one failed source retires only its newly owned records and waits for their operations to drain; it cannot close an existing project session. Strong-validator sources remain ineligible for durable pixel-snapshot recipes. They and complete-SHA sources may export metadata-only annotations/measurements or the strict [native WADO pixel profile](FORMAT_SUPPORT.md#dicom-derived-objects-and-web-operations).

Native WADO export reuses the existing exact source/session/revision and current network/read authority, retaining actual SOP/frame/delivery/resource identities. It does not mint or renew grants. Genuine current user image capture and exact destination authorization remain separate requirements. Requests failing metadata-determined profile, selection, serialized-provenance or padded TIFF-output checks reject before export frame reads, destination authorization or private state. Actual encoded PNG size is checked after reading. Original trusted request identity, pre/post source checks and cancellation/drain fences remain intact; native delivery and a declared `LossyImageCompression=00` do not establish original stored transfer syntax or acquisition history.

Computed artifact application is a separate read-preparation flow, not a write operation grant. The original guarded model request reads an existing signed completed result, checks whole artifact/source/matrix identities, and prepares bounded immutable projections. App reads use the existing source-bound read scope and actual physical observation IDs; they cannot restore disk state, renew access or provide replacement artifact rows. Prepared project recipes recheck that exact cache under the current request before adoption and never recompute missing results. Current private request identity is retained through verification; cancellation signals are passed separately, not by cloning a trusted request into an untrusted one.

ANN/SR scientific layers retain two independent proofs: the annotation file and the actual image target. Queries, indexes and restoration recheck both. The annotation import owns only its newly authorized file; the image handle is borrowed. Observed source/target/index-access denial fences later rootless cache reads until a fresh guarded renewal proves the complete current scope; changed source identity requires reimport. Neither a saved SOP UID nor an inspected object's reference fields grant an image binding.

The model-only STOW preparation binds the exact original file hashes, SOP identities, destination and multipart body to a private 30-second, one-use operation. Submission consumes it before network I/O and rechecks current reads and network policy through the final response. Cancellation bounds authorization waits and closes the connection. Once bytes may have left the process, failure is indeterminate rather than proof of no external effect; there is no automatic retry. This mechanism does not authenticate human consent or de-identify patient data. An explicit user upload request is required independently of generic filesystem/network access, and no live endpoint qualification is implied by controlled transport tests.

## Resource limits and verification scope

| Resource | Limit |
| --- | --- |
| One object response | 32 MiB |
| One complete metadata object | 8 MiB |
| Retained metadata | 288 keys, 16 MiB aggregate |
| Initial metadata seeds | 32 keys |
| Directory inventory / retained observed objects | 100,000 entries; 16 MiB key budget; depth 64 |
| Active reads per source | 8 |
| One read operation | 30 seconds, shortened by source/lease expiry |
| Source transfer budget | 4 GiB over at most 30 minutes |
| Source registrations | 16 total, 8 per viewer session |

Regression tests use actual temporary directories for filesystem authorization and mutation behavior, and controlled DNS/TCP/TLS/HTTP transports for remote failure cases. Synthetic sparse-index tests do not represent a physical million-file tissue dataset. These tests are not a claim of authenticated-host rendering, live public-endpoint access, or clinical validation; those require their own qualification evidence.

Scientific subprocesses additionally require working operating-system RSS and process-liveness inspection. If the runtime sandbox prevents those checks, the workflow stops without disabling its memory or orphan-process guard. Running development tests with process-inspection access does not establish that an installed host provides the same environment.
