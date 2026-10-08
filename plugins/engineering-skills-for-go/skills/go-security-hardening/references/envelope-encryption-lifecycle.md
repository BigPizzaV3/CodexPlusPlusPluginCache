# Envelope-encryption lifecycle

Envelope encryption separates the key that encrypts application data—the data-encryption key (DEK)—from a key-encryption key (KEK) held by a KMS or equivalent protected system. This limits direct KEK exposure and can make routine KEK rotation a small rewrap operation. It does not make every rotation or compromise equivalent.

## Define the cryptographic envelope

Use a maintained AEAD construction or managed envelope primitive. For each ciphertext, preserve enough authenticated metadata to select and interpret it without guessing: envelope format and algorithm version, KEK identity and version, wrapped DEK, nonce when the primitive exposes one, ciphertext, and the associated-data schema version. Do not let an untrusted record select an arbitrary KMS key or endpoint; resolve identifiers through an allowed key policy.

Bind ciphertext to the context in which it is valid—such as tenant, object identity, field purpose, and schema version—using associated data when the protocol supports it. Associated data is authenticated but not secret. Canonicalize it deterministically and retain the values needed for decryption after migrations.

Choose DEK scope from blast radius, cryptographic usage limits, recovery needs, and KMS cost. Per-object DEKs are one useful envelope design, not a universal law. Never reuse a nonce for a given key. In Go, `cipher.AEAD` requires nonce uniqueness for the lifetime of a key; `NewGCMWithRandomNonce` is available from Go 1.24 but still limits one key to fewer than `2^32` encrypted messages. Prefer library-owned nonce handling or `crypto/rand` over ad hoc counters whose persistence and concurrency are unproven.

## Name the rotation being performed

- **Routine KEK rotation:** keep the DEK and data ciphertext, unwrap with the old KEK, and wrap with the new KEK. This changes protection of the DEK, not the data algorithm or exposure history.
- **DEK compromise or excessive use:** decrypt and re-encrypt the data under a new DEK. Rewrapping a compromised DEK under a new KEK preserves the compromised key.
- **Algorithm, format, or associated-data migration:** produce a new versioned ciphertext under the replacement construction. A KEK-only rewrap cannot change the data cipher or repair missing context binding.
- **KEK compromise:** assess whether attackers could unwrap stored DEKs and whether data must be re-encrypted. Merely creating a new KEK does not undo earlier access.

Do not describe “key rotation” without selecting one of these outcomes and its threat model.

## Cut over without losing decryptability

Treat rotation as a restartable mixed-version protocol:

1. Make the new decrypt capability available everywhere that may read retained ciphertext, including rollback binaries and recovery tooling.
2. Switch new encryption to the new primary only after that reader set is compatible.
3. Migrate existing envelopes with a stable record identity, explicit source and target key versions, and a compare-and-swap or equivalent ownership rule. A retry may produce a different valid wrapped DEK; it must not overwrite a newer migration or discard the last decryptable version.
4. Verify durable coverage by inventory, sample or canary decryption, and exception accounting. A completed scan or KMS request count is not proof that every live copy moved.
5. Disable and later destroy old key material only after live data, replicas, caches, queues, backups, legal holds, disaster recovery, and rollback paths have a documented decryptability or expiry decision.

If a KMS call or database write has an ambiguous outcome, retain the old readable envelope until the new envelope is durable and verified. Bound KMS concurrency and retry budgets; an outage in a KEK dependency can otherwise become a fleet-wide data outage.

## Qualify erasure and operations

Deleting a KEK provides cryptographic erasure only if no usable copies of that KEK or plaintext DEKs remain and no required recovery path depends on them. Backups, exported key material, process memory, logs, and escrow can invalidate that claim. Go does not promise reliable zeroization of copied byte slices, so minimize plaintext-key lifetime and exposure but do not claim garbage collection proves erasure.

Audit key-policy and lifecycle changes without logging plaintext, DEKs, ciphertext contents, or sensitive associated data. Monitor decrypt failures by envelope version, use of retired keys, KMS permission changes, rotation backlog, and records with unknown formats. Test old/new-reader overlap, concurrent writers, retries after every persistence boundary, corrupted metadata, disabled keys, backup restore, and rollback.

Primary evidence: [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final), [Tink client-side encryption](https://developers.google.com/tink/client-side-encryption), [Tink keysets](https://developers.google.com/tink/design/keysets), and [Go `crypto/cipher` for Go 1.26](https://pkg.go.dev/crypto/cipher@go1.26.3).
