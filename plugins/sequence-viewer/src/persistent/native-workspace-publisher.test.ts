import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { parseMsa } from "../msa/parser";
import { parseSequenceDocument } from "../sequence/parser";
import { sequenceViewerExportInputSchema } from "../viewer-operations";
import type { PreparedSequenceWorkspaceArtifact } from "../views/workbench-persistence";
import {
  exportAlignmentWorkbench,
  exportSequenceWorkbench,
} from "../workbench-exports";
import { createNativeSequenceWorkspaceArtifactPublisher } from "./native-workspace-publisher";
import {
  ScientificSequenceDataClient,
  type SequencePersistentDataSession,
  type SequenceScientificDataTransport,
} from "./scientific-data-client";

const session: SequencePersistentDataSession = {
  family: "sequence",
  logicalSessionId: "native-sequence-session-1",
  backendInstanceId: "native-sequence-backend-1",
  backendGeneration: 2,
  sourceRevision: "native-source-revision-1",
};

const nativeExportFormatCases = [
  ["a3m", /^>alignment-a\nACGT/u],
  ["aligned-fasta", /^>alignment-a\nACGT/u],
  ["bed", /^demo\t(?:0\t3|6\t9)/u],
  ["clustal", /^CLUSTAL W multiple sequence alignment\n/u],
  ["csv", /^record,feature_id,/u],
  ["embl", /^ID\s+demo/u],
  ["fasta", /^>demo\nACGT/u],
  ["fastq", /^@demo\nACGT\n\+\nIIII/u],
  ["genbank", /^LOCUS\s+demo/u],
  ["gff3", /^##gff-version 3/u],
  ["gtf", /^demo\tsequence-viewer\t/u],
  ["json", /^\{\n\s+"document"/u],
  ["newick", /^\('alignment-a':0\.1,'alignment-b':0\.2\);\n$/u],
  ["pdf", /^%PDF-1\.4\n/u],
  ["stockholm", /^# STOCKHOLM 1\.0\n/u],
  ["svg", /^<svg\s/u],
  ["tsv", /^record\tfeature_id\t/u],
  ["vcf", /^##fileformat=VCFv4/u],
] as const;

describe("native Sequence workspace publication", () => {
  it("covers every user-advertised native workspace export format", () => {
    expect(nativeExportFormatCases.map(([format]) => format).sort()).toEqual(
      [...sequenceViewerExportInputSchema.shape.format.options].sort(),
    );
  });

  it.each(nativeExportFormatCases)(
    "publishes genuine %s bytes and its atomic format-authenticated provenance",
    async (format, expectedHeader) => {
      const annotatedDocument = parseSequenceDocument({
        contents: `LOCUS       demo        12 bp    DNA     circular
ACCESSION   demo
FEATURES             Location/Qualifiers
     misc_feature    complement(join(1..3,7..9))
                     /note="important"
ORIGIN
        1 acgtacgtacgt
//`,
        fileName: "demo.gb",
      });
      const fastqDocument = parseSequenceDocument({
        contents: "@demo\nACGT\n+\nIIII\n",
        fileName: "demo.fastq",
      });
      const alignment = parseMsa(
        ">alignment-a\nACGT\n>alignment-b\nA-GT\n",
        "demo.aln-fasta",
      );
      if (alignment.status !== "success") {
        throw new Error("The native alignment fixture is not authentic.");
      }
      const generated =
        format === "a3m" ||
        format === "aligned-fasta" ||
        format === "clustal" ||
        format === "newick" ||
        format === "stockholm"
          ? exportAlignmentWorkbench({
              document: alignment.document,
              format,
              ...(format === "newick"
                ? { newick: "('alignment-a':0.1,'alignment-b':0.2)" }
                : {}),
              scope: "all",
              visibleRows: alignment.document.rows,
            })
          : exportSequenceWorkbench({
              document: format === "fastq" ? fastqDocument : annotatedDocument,
              format,
              recordId:
                (format === "fastq" ? fastqDocument : annotatedDocument)
                  .records[0]?.id ?? "",
              scope: "all",
            });
      expect(generated.content).toMatch(expectedHeader);

      const members = new Map<
        string,
        { role: "data" | "provenance"; bytes: Array<Uint8Array> }
      >();
      const transactionId = `all-formats-${format}-transaction`;
      const publicationId = `all-formats-${format}-publication`;
      const request = vi.fn<SequenceScientificDataTransport["request"]>(
        async ({ operation, payload }) => {
          if (operation === "ui/scientific/sequence/export/begin") {
            return {
              structuredContent: {
                publicationId,
                state: "staging",
                transactionId,
              },
            };
          }
          if (operation === "ui/scientific/sequence/export/append") {
            if (!(payload.bytes instanceof Uint8Array)) {
              throw new Error("The authentic export chunk contains no bytes.");
            }
            const memberName = String(payload.memberName);
            const role = payload.role === "provenance" ? "provenance" : "data";
            const member = members.get(memberName) ?? { bytes: [], role };
            const expectedOffset = member.bytes.reduce(
              (offset, chunk) => offset + chunk.byteLength,
              0,
            );
            if (
              payload.offsetDecimal !== String(expectedOffset) ||
              payload.expectedChunkDigest !==
                createHash("sha256").update(payload.bytes).digest("hex")
            ) {
              throw new Error("The authentic export chunk is inconsistent.");
            }
            member.bytes.push(payload.bytes.slice());
            members.set(memberName, member);
            return {
              structuredContent: { state: "staging", transactionId },
            };
          }
          if (operation !== "ui/scientific/sequence/export/commit") {
            throw new Error(`Unexpected native operation ${operation}`);
          }
          if (payload.publication !== "sibling-set") {
            throw new Error("The scientific artifact set was not atomic.");
          }
          const entries = Array.from(members, ([memberName, member]) => {
            const bytes = Buffer.concat(member.bytes);
            return {
              relativeName: memberName,
              role: member.role,
              sizeBytesDecimal: String(bytes.byteLength),
              sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
            };
          });
          return {
            structuredContent: {
              bytesWrittenDecimal: String(
                entries.reduce(
                  (total, entry) => total + Number(entry.sizeBytesDecimal),
                  0,
                ),
              ),
              manifest: { artifactKind: payload.artifactKind, entries },
              publicationId,
              state: "published",
              transactionId,
            },
          };
        },
      );
      const publisher = createNativeSequenceWorkspaceArtifactPublisher(
        new ScientificSequenceDataClient({ request }, session),
      );
      const artifact: PreparedSequenceWorkspaceArtifact = {
        ...generated,
        format,
        provenance: {
          engine: "native-sequence",
          parameters: { format },
          sourceRevision: 0,
        },
      };

      await expect(
        publisher(artifact, `results/${generated.name}`),
      ).resolves.toMatchObject({
        format,
        mediaType: generated.mediaType,
        outputWorkspacePath: `results/${generated.name}`,
        provenanceWorkspacePath: `results/${generated.name}.provenance.json`,
        sha256: createHash("sha256").update(generated.content).digest("hex"),
      });
      const data = Buffer.concat(members.get(generated.name)?.bytes ?? []);
      const provenance = Buffer.concat(
        members.get(`${generated.name}.provenance.json`)?.bytes ?? [],
      );
      expect(data.toString("utf8")).toBe(generated.content);
      expect(JSON.parse(provenance.toString("utf8"))).toMatchObject({
        format,
        mediaType: generated.mediaType,
        publicationId,
        sha256: createHash("sha256").update(generated.content).digest("hex"),
      });
      expect(
        request.mock.calls.every(
          ([input]) => input.payload.artifactKind === `sequence-${format}`,
        ),
      ).toBe(true);
      expect(
        request.mock.calls.filter(
          ([input]) =>
            input.operation === "ui/scientific/sequence/export/begin",
        ),
      ).toHaveLength(1);
      expect(
        request.mock.calls.filter(
          ([input]) =>
            input.operation === "ui/scientific/sequence/export/commit",
        ),
      ).toHaveLength(1);
    },
  );

  it("streams actual artifacts and provenance through bounded, authenticated native transactions", async () => {
    const transactions = new Map<
      string,
      {
        publicationId: string;
        members: Map<
          string,
          { role: "data" | "provenance"; chunks: Array<Uint8Array> }
        >;
      }
    >();
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation, payload }) => {
        if (operation === "ui/scientific/sequence/export/begin") {
          const transactionId = `native-transaction-${transactions.size + 1}`;
          transactions.set(transactionId, {
            publicationId: `native-publication-${transactions.size + 1}`,
            members: new Map(),
          });
          return {
            structuredContent: {
              publicationId: `native-publication-${transactions.size}`,
              transactionId,
              state: "staging",
            },
          };
        }
        const transaction = transactions.get(String(payload.transactionId));
        if (transaction == null) {
          throw new Error("The native test transaction was not authorized.");
        }
        if (operation === "ui/scientific/sequence/export/append") {
          if (!(payload.bytes instanceof Uint8Array)) {
            throw new Error("The native test chunk contains no bytes.");
          }
          const memberName = String(payload.memberName);
          const role = payload.role === "provenance" ? "provenance" : "data";
          let member = transaction.members.get(memberName);
          if (member == null) {
            member = { chunks: [], role };
            transaction.members.set(memberName, member);
          }
          const expectedOffset = member.chunks.reduce(
            (offset, bytes) => offset + bytes.byteLength,
            0,
          );
          if (
            payload.offsetDecimal !== String(expectedOffset) ||
            payload.expectedChunkDigest !==
              createHash("sha256").update(payload.bytes).digest("hex")
          ) {
            throw new Error("The native test chunk is not authentic.");
          }
          member.chunks.push(payload.bytes.slice());
          return {
            structuredContent: {
              transactionId: payload.transactionId,
              state: "staging",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/commit") {
          if (payload.publication !== "sibling-set") {
            throw new Error(
              "The native artifact pair was not committed atomically.",
            );
          }
          const entries = [...transaction.members].map(
            ([memberName, member]) => {
              const byteLength = member.chunks.reduce(
                (total, chunk) => total + chunk.byteLength,
                0,
              );
              const digest = createHash("sha256");
              for (const chunk of member.chunks) {
                digest.update(chunk);
              }
              return {
                relativeName: memberName,
                role: member.role,
                sizeBytesDecimal: String(byteLength),
                sha256: `sha256:${digest.digest("hex")}`,
              };
            },
          );
          const byteLength = entries.reduce(
            (total, entry) => total + Number(entry.sizeBytesDecimal),
            0,
          );
          return {
            structuredContent: {
              transactionId: payload.transactionId,
              publicationId: transaction.publicationId,
              state: "published",
              bytesWrittenDecimal: String(byteLength),
              manifest: {
                artifactKind: payload.artifactKind,
                entries,
              },
            },
          };
        }
        throw new Error(`Unexpected native operation ${operation}`);
      },
    );
    const source = new Uint8Array(160_013).fill(65);
    const artifact: PreparedSequenceWorkspaceArtifact = {
      createChunks: async function* () {
        yield source.subarray(0, 90_000);
        yield source.subarray(90_000);
      },
      format: "fasta",
      mediaType: "text/x-fasta",
      name: "derived.fasta",
      provenance: {
        engine: "native-sequence",
        parameters: { complete: true },
        sourceRevision: 0,
      },
    };
    const client = new ScientificSequenceDataClient({ request }, session);
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(client);

    await expect(
      publisher(artifact, "results/derived.fasta"),
    ).resolves.toMatchObject({
      kind: "artifact",
      destination: { base: "opened-source", kind: "workspace" },
      name: "derived.fasta",
      outputWorkspacePath: "results/derived.fasta",
      provenanceWorkspacePath: "results/derived.fasta.provenance.json",
      sha256: createHash("sha256").update(source).digest("hex"),
      size: source.byteLength,
    });

    expect(transactions.size).toBe(1);
    const transaction = transactions.get("native-transaction-1");
    const data = transaction?.members.get("derived.fasta");
    const provenance = transaction?.members.get(
      "derived.fasta.provenance.json",
    );
    expect(data?.chunks.every((chunk) => chunk.byteLength <= 64 * 1024)).toBe(
      true,
    );
    expect(data?.chunks).toHaveLength(3);
    expect(provenance?.role).toBe("provenance");
    expect(
      JSON.parse(
        new TextDecoder().decode(provenance?.chunks[0] ?? new Uint8Array()),
      ),
    ).toMatchObject({
      sourceRevision: session.sourceRevision,
      format: "fasta",
      publicationId: transaction?.publicationId,
      sha256: createHash("sha256").update(source).digest("hex"),
    });
    expect(
      request.mock.calls.every(([input]) =>
        input.operation.startsWith("ui/scientific/sequence/export/"),
      ),
    ).toBe(true);
  });

  it("publishes a source-generated complete FASTA without copying source bytes into the widget", async () => {
    const source = new TextEncoder().encode(
      ">first\nAACCGGTT\n>second\nTTGGCCAA\n",
    );
    const sourceDigest = createHash("sha256").update(source).digest("hex");
    const provenanceChunks: Array<Uint8Array> = [];
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation, payload }) => {
        if (operation === "ui/scientific/sequence/export/source") {
          return {
            structuredContent: {
              transactionId: "native-source-transaction-1",
              publicationId: "native-source-publication-1",
              state: "staging",
              bytesWrittenDecimal: String(source.byteLength),
              sha256: sourceDigest,
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/append") {
          if (!(payload.bytes instanceof Uint8Array)) {
            throw new Error("Source provenance bytes are unavailable.");
          }
          provenanceChunks.push(payload.bytes.slice());
          return {
            structuredContent: {
              transactionId: "native-source-transaction-1",
              state: "staging",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/commit") {
          const provenance = provenanceChunks[0];
          if (provenance == null) {
            throw new Error("Source provenance was not written.");
          }
          return {
            structuredContent: {
              transactionId: "native-source-transaction-1",
              publicationId: "native-source-publication-1",
              state: "published",
              bytesWrittenDecimal: String(
                source.byteLength + provenance.byteLength,
              ),
              manifest: {
                entries: [
                  {
                    relativeName: "all-records.fasta",
                    role: "data",
                    sizeBytesDecimal: String(source.byteLength),
                    sha256: `sha256:${sourceDigest}`,
                  },
                  {
                    relativeName: "all-records.fasta.provenance.json",
                    role: "provenance",
                    sizeBytesDecimal: String(provenance.byteLength),
                    sha256: `sha256:${createHash("sha256").update(provenance).digest("hex")}`,
                  },
                ],
              },
            },
          };
        }
        throw new Error(`Unexpected native operation ${operation}`);
      },
    );
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );

    await expect(
      publisher(
        {
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "all-records.fasta",
          provenance: {
            engine: "native-sequence",
            parameters: { complete: true },
            sourceRevision: 0,
          },
          serverGeneration: {
            compression: "none",
            kind: "opened-source",
          },
        },
        "results/all-records.fasta",
      ),
    ).resolves.toMatchObject({
      kind: "artifact",
      sha256: sourceDigest,
      size: source.byteLength,
      outputWorkspacePath: "results/all-records.fasta",
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/export/source",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/commit",
    ]);
    expect(request.mock.calls[0]?.[0].payload).not.toHaveProperty("bytes");
    expect(request.mock.calls[0]?.[0].payload).toMatchObject({
      deferCommit: true,
    });
    expect(request.mock.calls[2]?.[0].payload).toMatchObject({
      publication: "sibling-set",
    });
  });

  it("publishes worker-generated rich bytes and provenance without routing sequence content through the renderer", async () => {
    const generated = Buffer.from(
      "LOCUS       reference 8 bp DNA linear\nORIGIN\n        1 aaccggtt\n//\n",
    );
    const digest = createHash("sha256").update(generated).digest("hex");
    /** @type {Uint8Array | undefined} */
    let provenance: Uint8Array | undefined;
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation, payload }) => {
        if (operation === "ui/scientific/sequence/export/rich") {
          return {
            structuredContent: {
              bytesWrittenDecimal: String(generated.byteLength),
              publicationId: "native-rich-publication-1",
              sha256: digest,
              state: "staging",
              transactionId: "native-rich-transaction-1",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/append") {
          if (
            payload.memberName !== "reference.gb.provenance.json" ||
            !(payload.bytes instanceof Uint8Array)
          ) {
            throw new Error(
              "The native rich artifact leaked data into its renderer.",
            );
          }
          provenance = payload.bytes.slice();
          return {
            structuredContent: {
              state: "staging",
              transactionId: "native-rich-transaction-1",
            },
          };
        }
        if (
          operation === "ui/scientific/sequence/export/commit" &&
          provenance != null
        ) {
          return {
            structuredContent: {
              bytesWrittenDecimal: String(
                generated.byteLength + provenance.byteLength,
              ),
              manifest: {
                entries: [
                  {
                    relativeName: "reference.gb",
                    role: "data",
                    sha256: `sha256:${digest}`,
                    sizeBytesDecimal: String(generated.byteLength),
                  },
                  {
                    relativeName: "reference.gb.provenance.json",
                    role: "provenance",
                    sha256: `sha256:${createHash("sha256").update(provenance).digest("hex")}`,
                    sizeBytesDecimal: String(provenance.byteLength),
                  },
                ],
              },
              publicationId: "native-rich-publication-1",
              state: "published",
              transactionId: "native-rich-transaction-1",
            },
          };
        }
        throw new Error(`Unexpected native rich operation ${operation}`);
      },
    );
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );
    expect(publisher.supportsNativeRichGeneration).toBe(true);

    await expect(
      publisher(
        {
          format: "genbank",
          mediaType: "text/x-genbank",
          name: "reference.gb",
          provenance: {
            engine: "native-sequence",
            parameters: { complete: true },
            sourceRevision: 0,
          },
          serverGeneration: { compression: "none", kind: "native-rich" },
        },
        "results/reference.gb",
      ),
    ).resolves.toMatchObject({
      format: "genbank",
      outputWorkspacePath: "results/reference.gb",
      provenanceWorkspacePath: "results/reference.gb.provenance.json",
      sha256: digest,
      size: generated.byteLength,
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/export/rich",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/commit",
    ]);
    expect(request.mock.calls[0]?.[0].payload).not.toHaveProperty("bytes");
    expect(request.mock.calls[0]?.[0].payload).toMatchObject({
      artifactKind: "sequence-genbank",
      deferCommit: true,
      format: "genbank",
    });
    expect(request.mock.calls[2]?.[0].payload).toMatchObject({
      publication: "sibling-set",
    });
  });

  it("aborts the actual native transaction when a streamed chunk is rejected", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation }) => {
        if (operation === "ui/scientific/sequence/export/begin") {
          return {
            structuredContent: {
              publicationId: "native-aborted-publication-1",
              transactionId: "native-aborted-transaction-1",
              state: "staging",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/append") {
          throw new Error("The actual staged chunk was rejected.");
        }
        if (operation === "ui/scientific/sequence/export/abort") {
          return { structuredContent: { state: "aborted" } };
        }
        throw new Error(`Unexpected native operation ${operation}`);
      },
    );
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );

    await expect(
      publisher(
        {
          content: ">derived\nACGT\n",
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "derived.fasta",
          provenance: {
            engine: "native-sequence",
            parameters: {},
            sourceRevision: 0,
          },
        },
        "results/derived.fasta",
      ),
    ).rejects.toThrow(/rejected/u);
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/export/begin",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/abort",
    ]);
  });

  it("never publishes an artifact when its provenance sibling cannot be staged", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation, payload }) => {
        if (operation === "ui/scientific/sequence/export/begin") {
          return {
            structuredContent: {
              publicationId: "atomic-publication-1",
              state: "staging",
              transactionId: "atomic-transaction-1",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/append") {
          if (payload.role === "provenance") {
            throw new Error("The provenance destination already exists.");
          }
          return {
            structuredContent: {
              state: "staging",
              transactionId: "atomic-transaction-1",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/abort") {
          return { structuredContent: { state: "aborted" } };
        }
        throw new Error("A partial artifact was unexpectedly published.");
      },
    );
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );

    await expect(
      publisher(
        {
          content: ">derived\nACGT\n",
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "derived.fasta",
          provenance: {
            engine: "native-sequence",
            parameters: {},
            sourceRevision: 0,
          },
        },
        "results/derived.fasta",
      ),
    ).rejects.toThrow(/provenance destination/u);
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/export/begin",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/abort",
    ]);
    expect(
      request.mock.calls.some(
        ([input]) => input.operation === "ui/scientific/sequence/export/commit",
      ),
    ).toBe(false);
  });

  it("aborts the complete staged pair when its existing provenance destination collides at commit", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async ({ operation }) => {
        if (operation === "ui/scientific/sequence/export/begin") {
          return {
            structuredContent: {
              publicationId: "collision-publication-1",
              state: "staging",
              transactionId: "collision-transaction-1",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/append") {
          return {
            structuredContent: {
              state: "staging",
              transactionId: "collision-transaction-1",
            },
          };
        }
        if (operation === "ui/scientific/sequence/export/commit") {
          throw new Error("The provenance sibling already exists.");
        }
        if (operation === "ui/scientific/sequence/export/abort") {
          return { structuredContent: { state: "aborted" } };
        }
        throw new Error(`Unexpected native operation ${operation}`);
      },
    );
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );

    await expect(
      publisher(
        {
          content: ">derived\nACGT\n",
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "derived.fasta",
          provenance: {
            engine: "native-sequence",
            parameters: {},
            sourceRevision: 0,
          },
        },
        "results/derived.fasta",
      ),
    ).rejects.toThrow(/provenance sibling already exists/u);
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/export/begin",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/append",
      "ui/scientific/sequence/export/commit",
      "ui/scientific/sequence/export/abort",
    ]);
    expect(request.mock.calls.at(-1)?.[0].payload).toMatchObject({
      transactionId: "collision-transaction-1",
    });
  });

  it("uses only authenticated source-confined native workspace browsing", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          directory: {
            breadcrumbs: [
              {
                label: "Workspace",
                relativePath: ".",
                workspacePath: "workspace",
              },
            ],
            relativePath: ".",
            sourceDirectoryWorkspacePath: "workspace",
            workspacePath: "workspace",
          },
          entries: [
            { kind: "directory", name: "results", relativePath: "results" },
          ],
          omittedEntries: 0,
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          name: "results",
          relativePath: "results",
          workspacePath: "workspace/results",
        },
      });
    const publisher = createNativeSequenceWorkspaceArtifactPublisher(
      new ScientificSequenceDataClient({ request }, session),
    );

    await expect(
      publisher.listDirectory({ directory: ".", limit: 50 }),
    ).resolves.toMatchObject({
      entries: [{ name: "results" }],
    });
    await expect(
      publisher.createDirectory({ parentDirectory: ".", name: "results" }),
    ).resolves.toMatchObject({ workspacePath: "workspace/results" });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/workspace/list",
      "ui/scientific/sequence/workspace/create-directory",
    ]);
  });
});
