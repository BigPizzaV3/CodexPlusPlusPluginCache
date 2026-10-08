import { z } from "zod";

import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import {
  measureSequenceWorkspaceProducer,
  sequenceWorkspaceUploadChunks,
  type SequenceWorkspaceChunkProducer,
} from "../views/workspace-artifact-stream";
import {
  sequenceWorkbenchPersistenceResultSchema,
  type SequenceWorkbenchPersistenceResult,
} from "../workbench-persistence-protocol";
import {
  type ScientificSequenceDataClient,
  type SequenceNativeArtifactDestination,
  type SequenceNativeArtifactPublication,
  type SequenceNativeArtifactTransaction,
} from "./scientific-data-client";

const NATIVE_EXPORT_CHUNK_BYTES = 64 * 1024;

const publishedManifestEntrySchema = z.object({
  role: z.enum(["data", "provenance"]).optional(),
  relativeName: z.string().min(1),
  sizeBytesDecimal: z
    .string()
    .regex(/^(0|[1-9]\d*)$/u)
    .optional(),
  sha256: z
    .string()
    .regex(/^sha256:[a-f\d]{64}$/u)
    .optional(),
});

/**
 * Preserve the existing Sequence/Alignment Save As UI while binding every
 * directory and streaming write to the authenticated desktop-owned worker.
 */
export function createNativeSequenceWorkspaceArtifactPublisher(
  client: ScientificSequenceDataClient,
): SequenceWorkspaceArtifactPublisher {
  const publisher: SequenceWorkspaceArtifactPublisher = Object.assign(
    async (
      artifact: PreparedSequenceWorkspaceArtifact,
      relativePath: string,
      collisionPolicy: "exact" | "next-version" = "exact",
      signal?: AbortSignal,
    ): Promise<SequenceWorkbenchPersistenceResult> => {
      const name = relativePath.split("/").at(-1);
      if (name == null || name.length === 0) {
        throw new Error("The native Sequence destination has no filename.");
      }
      const destination: SequenceNativeArtifactDestination = {
        relativePath,
        collisionPolicy: collisionPolicy === "exact" ? "fail" : "next-version",
        artifactKind: `sequence-${artifact.format}`,
      };
      const provenanceRelativePath = `${relativePath}.provenance.json`;
      let transaction: SequenceNativeArtifactTransaction | undefined;
      try {
        let measurement: { byteLength: number; sha256: string };
        if (artifact.serverGeneration != null) {
          if (
            artifact.content != null ||
            artifact.createChunks != null ||
            (artifact.serverGeneration.kind !== "opened-source" &&
              artifact.serverGeneration.kind !== "native-rich")
          ) {
            throw new Error(
              "The requested native source export is not authentic.",
            );
          }
          const generation = {
            ...destination,
            idempotencyKey: globalThis.crypto.randomUUID(),
            memberName: name,
            signal,
          };
          const staged =
            artifact.serverGeneration.kind === "native-rich"
              ? await client.stageNativeRichSource({
                  ...generation,
                  format: artifact.format,
                  ...(artifact.serverGeneration.records == null
                    ? {}
                    : { records: artifact.serverGeneration.records }),
                })
              : artifact.format === "fasta" ||
                  artifact.format === "fastq" ||
                  artifact.format === "aligned-fasta"
                ? await client.stageOpenedSource({
                    ...generation,
                    format: artifact.format,
                  })
                : (() => {
                    throw new Error(
                      "The requested native source export is not authentic.",
                    );
                  })();
          transaction = staged;
          const byteLength = Number(staged.bytesWrittenDecimal);
          if (!Number.isSafeInteger(byteLength)) {
            throw new Error(
              "The native source publication byte count is invalid.",
            );
          }
          measurement = { byteLength, sha256: staged.sha256 };
        } else {
          const createChunks = getNativeArtifactProducer(artifact);
          measurement = await measureSequenceWorkspaceProducer(
            createChunks,
            signal,
          );
          transaction = await client.beginArtifactExport({
            ...destination,
            idempotencyKey: globalThis.crypto.randomUUID(),
            memberName: name,
            signal,
          });
          await appendNativeSequenceArtifact({
            client,
            createChunks,
            destination,
            memberName: name,
            role: "data",
            signal,
            totalBytes: measurement.byteLength,
            transactionId: transaction.transactionId,
          });
        }

        if (transaction.publicationId == null) {
          throw new Error(
            "The native Sequence transaction has no publication ID.",
          );
        }
        const provenanceBytes = new TextEncoder().encode(
          `${JSON.stringify({
            schemaVersion: 1,
            sourceRevision: client.session.sourceRevision,
            format: artifact.format,
            mediaType: artifact.mediaType,
            name,
            sha256: measurement.sha256,
            sizeBytesDecimal: String(measurement.byteLength),
            provenance: artifact.provenance,
            publicationId: transaction.publicationId,
          })}\n`,
        );
        await appendNativeSequenceArtifact({
          client,
          createChunks: async function* () {
            yield provenanceBytes;
          },
          destination,
          memberName: `${name}.provenance.json`,
          role: "provenance",
          signal,
          totalBytes: provenanceBytes.byteLength,
          transactionId: transaction.transactionId,
        });
        const publication = await client.commitArtifactExport({
          ...destination,
          publication: "sibling-set",
          signal,
          transactionId: transaction.transactionId,
        });
        verifyNativePublication(
          publication,
          name,
          measurement,
          provenanceBytes,
        );
        transaction = undefined;

        return sequenceWorkbenchPersistenceResultSchema.parse({
          kind: "artifact",
          destination: { base: "opened-source", kind: "workspace" },
          format: artifact.format,
          mediaType: artifact.mediaType,
          name,
          outputWorkspacePath: relativePath,
          provenanceWorkspacePath: provenanceRelativePath,
          sha256: measurement.sha256,
          size: measurement.byteLength,
          version: 1,
        });
      } catch (error) {
        if (transaction != null) {
          await client
            .abortArtifactExport({
              ...destination,
              transactionId: transaction.transactionId,
            })
            .catch(() => undefined);
        }
        throw error;
      }
    },
    {
      listDirectory: async (
        input: Parameters<
          SequenceWorkspaceArtifactPublisher["listDirectory"]
        >[0],
      ) => await client.listWorkspaceDirectory(input),
      createDirectory: async (
        input: Parameters<
          SequenceWorkspaceArtifactPublisher["createDirectory"]
        >[0],
      ) => await client.createWorkspaceDirectory(input),
      supportsNativeRichGeneration: true,
    },
  );
  return publisher;
}

function getNativeArtifactProducer(
  artifact: PreparedSequenceWorkspaceArtifact,
): SequenceWorkspaceChunkProducer {
  if (artifact.createChunks != null && artifact.content == null) {
    return artifact.createChunks;
  }
  if (artifact.createChunks == null && artifact.content != null) {
    const content = artifact.content;
    return async function* () {
      yield content;
    };
  }
  throw new Error(
    "A native Sequence artifact requires exactly one bounded content producer.",
  );
}

async function appendNativeSequenceArtifact({
  client,
  destination,
  createChunks,
  memberName,
  role,
  signal,
  totalBytes,
  transactionId,
}: {
  client: ScientificSequenceDataClient;
  destination: SequenceNativeArtifactDestination;
  createChunks: SequenceWorkspaceChunkProducer;
  memberName: string;
  role: "data" | "provenance";
  signal?: AbortSignal;
  totalBytes: number;
  transactionId: string;
}): Promise<void> {
  signal?.throwIfAborted();
  for await (const chunk of sequenceWorkspaceUploadChunks(createChunks, {
    maxChunkBytes: NATIVE_EXPORT_CHUNK_BYTES,
    signal,
    startOffset: 0,
    totalBytes,
  })) {
    await client.appendArtifactExport({
      ...destination,
      transactionId,
      memberName,
      offsetDecimal: String(chunk.offset),
      bytes: chunk.bytes,
      expectedChunkDigest: await digestNativeSequenceChunk(chunk.bytes),
      requestId: globalThis.crypto.randomUUID(),
      role,
      signal,
    });
  }
}

async function digestNativeSequenceChunk(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", owned);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function verifyNativePublication(
  publication: SequenceNativeArtifactPublication,
  memberName: string,
  measurement: { byteLength: number; sha256: string },
  provenanceBytes: Uint8Array,
): void {
  if (
    publication.bytesWrittenDecimal !==
    String(measurement.byteLength + provenanceBytes.byteLength)
  ) {
    throw new Error("The native Sequence publication byte count is invalid.");
  }
  const manifest = publication.manifest;
  if (manifest == null || !Array.isArray(manifest.entries)) {
    throw new Error("The native Sequence publication has no host manifest.");
  }
  const member = manifest.entries
    .map((entry) => publishedManifestEntrySchema.safeParse(entry))
    .find((entry) => entry.success && entry.data.relativeName === memberName);
  if (
    member == null ||
    !member.success ||
    (member.data.sizeBytesDecimal != null &&
      member.data.sizeBytesDecimal !== String(measurement.byteLength)) ||
    (member.data.sha256 != null &&
      member.data.sha256 !== `sha256:${measurement.sha256}`)
  ) {
    throw new Error(
      "The native Sequence publication manifest is inconsistent.",
    );
  }
  const provenance = manifest.entries
    .map((entry) => publishedManifestEntrySchema.safeParse(entry))
    .find(
      (entry) =>
        entry.success &&
        entry.data.relativeName === `${memberName}.provenance.json`,
    );
  if (
    provenance == null ||
    !provenance.success ||
    provenance.data.role === "data" ||
    (provenance.data.sizeBytesDecimal != null &&
      provenance.data.sizeBytesDecimal !== String(provenanceBytes.byteLength))
  ) {
    throw new Error(
      "The native Sequence publication is missing its provenance.",
    );
  }
}
