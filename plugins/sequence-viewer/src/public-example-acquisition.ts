import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzip as gunzipCallback } from "node:zlib";

import { ListRootsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { alignSequences, exportAlignedFasta } from "./msa/alignment-editing";
import { parseMsa } from "./msa/parser";
import {
  sequencePublicExampleIdSchema,
  sequenceViewerPublicExampleToolInputSchema,
} from "./protocol";
import { buildFastqExport } from "./sequence/exports";
import { parseSequenceDocumentResult } from "./sequence/parser";
import { reverseComplement, translateFrame } from "./sequence/translation";
import type { RootsRequestExtra } from "./chat-file-resource";
import { SEQUENCE_VIEWER_VERSION } from "./version";
import {
  isSequenceWorkspaceCollisionError,
  publishSequenceWorkspacePair,
} from "./workspace-atomic-publisher";

const gunzip = promisify(gunzipCallback);

const EXAMPLES_DIRECTORY_NAME = "codex-viewer-examples";
const MAX_NETWORK_RESPONSE_BYTES = 16 * 1_024 * 1_024;
const MAX_DECODED_RESPONSE_BYTES = 64 * 1_024 * 1_024;
const MAX_PROVENANCE_BYTES = 64 * 1_024;
const MAX_COLLISION_ATTEMPTS = 32;
const REQUEST_TIMEOUT_MS = 30_000;
const VALIDATOR_VERSION = 1;
const ENA_SUBSET_RECORDS = 500;
const NCBI_LAMBDA_CI_CODING_SHA256 =
  "a51dec784e51f85a35d643a84820c89430b526cd9bf54a398b91c70045cc62e8";
const NCBI_LAMBDA_CI_PROTEIN_SHA256 =
  "ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580";
const RFAM_RF00360_RELEASE_15_1_SEED_COUNT = 9;
const UNIPROT_RAS_ALIGNMENT_BYTE_LENGTH = 786;
const UNIPROT_RAS_ALIGNMENT_SHA256 =
  "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f";
const UNIPROT_RAS_RECORD_LENGTH = 189;
const UNIPROT_RAS_ALIGNMENT_SCORES = Object.freeze({
  gapPenalty: -2,
  matchScore: 2,
  mismatchScore: -1,
});

type PublicExampleIntegrityPins = {
  ena: {
    artifactByteLength: number;
    artifactSha256: string;
    compressedByteLength: number;
    compressedMd5: string;
    gcFraction: number;
    q30Fraction: number;
    readLengthMax: number;
    readLengthMin: number;
    sourceRecords: number;
    totalBases: number;
  };
};

const DEFAULT_PUBLIC_EXAMPLE_INTEGRITY_PINS: PublicExampleIntegrityPins = {
  ena: {
    artifactByteLength: 480_372,
    artifactSha256:
      "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
    compressedByteLength: 127_526,
    compressedMd5: "81735432a6f578b332aae58cdbd95231",
    gcFraction: 67_930 / 235_490,
    q30Fraction: 224_652 / 235_490,
    readLengthMax: 471,
    readLengthMin: 469,
    sourceRecords: 967,
    totalBases: 235_490,
  },
};

const UNIPROT_RAS_ENTRIES = [
  {
    accession: "P01116",
    caax: "CIIM",
    entryName: "RASK_HUMAN",
    gene: "KRAS",
    proteinName: "GTPase KRas",
    sequenceSha256:
      "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a",
    sequenceVersion: 1,
  },
  {
    accession: "P01111",
    caax: "CVVM",
    entryName: "RASN_HUMAN",
    gene: "NRAS",
    proteinName: "GTPase NRas",
    sequenceSha256:
      "89016168d82568aa2caa97166c99ff0b61c6fb19d5729272a7e3f03ab26ce518",
    sequenceVersion: 1,
  },
  {
    accession: "P01112",
    caax: "CVLS",
    entryName: "RASH_HUMAN",
    gene: "HRAS",
    proteinName: "GTPase HRas",
    sequenceSha256:
      "d9360238882c010c8474ef1eba1d2532cd96e706c7d7f689ea2014f37f8f886c",
    sequenceVersion: 1,
  },
] as const;

export const SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME =
  "sequence.acquire_public_example";

export { sequencePublicExampleIdSchema } from "./protocol";

export const sequenceAcquirePublicExampleInputSchema =
  sequenceViewerPublicExampleToolInputSchema.extend({
    workspaceRoot:
      sequenceViewerPublicExampleToolInputSchema.shape.workspaceRoot.refine(
        (root) => root == null || path.isAbsolute(root),
        "workspaceRoot must be an absolute local path.",
      ),
  });

export type SequencePublicExampleId = z.infer<
  typeof sequencePublicExampleIdSchema
>;

export type SequenceAcquirePublicExampleInput = z.infer<
  typeof sequenceAcquirePublicExampleInputSchema
>;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type FileSystemIdentity = {
  device: bigint;
  inode: bigint;
};

type HttpEvidence = {
  byteLength: number;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  sha256: string;
  url: string;
};

type ArtifactValidation = {
  format: "aligned-fasta" | "fastq" | "genbank" | "stockholm";
  recordCount?: number;
  residueCount?: number;
  rowCount?: number;
  columnCount?: number;
};

type AcquiredBytes = {
  artifactBytes: Buffer;
  database: "ENA" | "NCBI Nuccore" | "Rfam" | "UniProtKB";
  derivation?: Record<string, unknown>;
  requestedIdentifier: string;
  resolvedIdentifier: string;
  sources: Array<HttpEvidence & Record<string, unknown>>;
  subset: Record<string, unknown> | null;
  termsUrl: string;
  validation: ArtifactValidation;
};

export type SequencePublicExampleProvenanceSummary = {
  artifactByteLength: number;
  artifactRelativePath: string;
  artifactSha256: string;
  database: AcquiredBytes["database"];
  derivation?: Record<string, unknown>;
  exampleId: SequencePublicExampleId;
  provenanceRelativePath: string;
  requestedIdentifier: string;
  resolvedIdentifier: string;
  subset: Record<string, unknown> | null;
};

export type SequencePublicExampleAcquisition = {
  absolutePath: string;
  fileIdentity: SequencePublicExampleFileIdentity;
  fileName: string;
  provenance: SequencePublicExampleProvenanceSummary;
};

export type SequencePublicExampleFileIdentity = {
  device: string;
  inode: string;
  modifiedAtNanoseconds: string;
  size: string;
};

export type SequencePublicExampleAcquirer = {
  acquire: (
    input: SequenceAcquirePublicExampleInput,
    extra: RootsRequestExtra,
  ) => Promise<SequencePublicExampleAcquisition>;
};

export class PublicExampleAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicExampleAcquisitionError";
  }
}

export function throwIfPublicExampleAcquisitionAborted(
  signal?: AbortSignal,
): void {
  if (!signal?.aborted) return;
  throw new PublicExampleAcquisitionError(
    "Public example acquisition was cancelled. No viewer was opened.",
  );
}

type SequencePublicExampleAcquisitionLifecycleHooks = {
  afterPublishedArtifactVerified?: () => Promise<void> | void;
};

export class SequencePublicExampleAcquisitionStore
  implements SequencePublicExampleAcquirer
{
  readonly #lifecycleHooks: SequencePublicExampleAcquisitionLifecycleHooks;
  readonly #fetch: FetchLike;
  readonly #integrityPins: PublicExampleIntegrityPins;
  readonly #now: () => Date;
  readonly #requestTimeoutMs: number;

  constructor({
    lifecycleHooks = {},
    fetchImpl = globalThis.fetch.bind(globalThis),
    integrityPins = DEFAULT_PUBLIC_EXAMPLE_INTEGRITY_PINS,
    now = () => new Date(),
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
  }: {
    lifecycleHooks?: SequencePublicExampleAcquisitionLifecycleHooks;
    fetchImpl?: FetchLike;
    /** Deterministic unit fixtures may supply equivalent pins; installed hosts use the catalog defaults. */
    integrityPins?: PublicExampleIntegrityPins;
    now?: () => Date;
    requestTimeoutMs?: number;
  } = {}) {
    this.#lifecycleHooks = lifecycleHooks;
    this.#fetch = fetchImpl;
    this.#integrityPins = integrityPins;
    this.#now = now;
    this.#requestTimeoutMs = requestTimeoutMs;
  }

  async acquire(
    input: SequenceAcquirePublicExampleInput,
    extra: RootsRequestExtra,
  ): Promise<SequencePublicExampleAcquisition> {
    let parsedInput: SequenceAcquirePublicExampleInput;
    let workspace: WorkspaceDestination;
    try {
      parsedInput = sequenceAcquirePublicExampleInputSchema.parse(input);
      workspace = await resolveWorkspaceDestination(
        parsedInput.workspaceRoot,
        extra,
      );
    } catch (error) {
      throw normalizeAcquisitionError(error, extra.signal);
    }
    const acquiredAt = this.#now().toISOString();
    let acquired: AcquiredBytes;
    try {
      acquired = await this.#acquireBytes(parsedInput.exampleId, extra.signal);
    } catch (error) {
      throw normalizeAcquisitionError(error, extra.signal);
    }
    const artifactSha256 = sha256(acquired.artifactBytes);
    try {
      await assertUnchangedDirectory(workspace);
      for (let attempt = 1; attempt <= MAX_COLLISION_ATTEMPTS; attempt += 1) {
        await assertUnchangedDirectory(workspace);
        const baseName = fileNameForExample(parsedInput.exampleId, attempt);
        const artifactPath = path.join(workspace.examplesDirectory, baseName);
        const provenancePath = `${artifactPath}.provenance.json`;
        const artifactRelativePath = toWorkspaceRelativePath(
          workspace.root,
          artifactPath,
        );
        const provenanceRelativePath = toWorkspaceRelativePath(
          workspace.root,
          provenancePath,
        );
        const provenance = createProvenance({
          acquired,
          acquiredAt,
          artifactRelativePath,
          artifactSha256,
          exampleId: parsedInput.exampleId,
          provenanceRelativePath,
        });
        const provenanceText = `${JSON.stringify(provenance, null, 2)}\n`;
        const provenanceBytes = Buffer.byteLength(provenanceText, "utf8");
        if (provenanceBytes > MAX_PROVENANCE_BYTES) {
          throw new PublicExampleAcquisitionError(
            "The public-source provenance exceeded its safety budget. Retry after updating the plugin.",
          );
        }
        try {
          await publishSequenceWorkspacePair({
            artifact: acquired.artifactBytes,
            artifactPath,
            hooks: {
              beforeArtifactLink: () => assertUnchangedDirectory(workspace),
              beforeCommit: async () => {
                await assertUnchangedDirectory(workspace);
                await verifyPublishedArtifact({
                  artifactPath,
                  expectedByteLength: acquired.artifactBytes.byteLength,
                  expectedSha256: artifactSha256,
                });
                await this.#lifecycleHooks.afterPublishedArtifactVerified?.();
                throwIfPublicExampleAcquisitionAborted(extra.signal);
              },
              beforeSidecarLink: () => assertUnchangedDirectory(workspace),
            },
            sidecar: provenanceText,
            sidecarPath: provenancePath,
            signal: extra.signal,
          });
        } catch (error) {
          if (isSequenceWorkspaceCollisionError(error)) {
            continue;
          }
          throw error;
        }
        const fileIdentity = await verifyPublishedArtifact({
          artifactPath,
          expectedByteLength: acquired.artifactBytes.byteLength,
          expectedSha256: artifactSha256,
        });
        return {
          absolutePath: artifactPath,
          fileIdentity,
          fileName: baseName,
          provenance: {
            artifactByteLength: acquired.artifactBytes.byteLength,
            artifactRelativePath,
            artifactSha256,
            database: acquired.database,
            ...(acquired.derivation == null
              ? {}
              : { derivation: acquired.derivation }),
            exampleId: parsedInput.exampleId,
            provenanceRelativePath,
            requestedIdentifier: acquired.requestedIdentifier,
            resolvedIdentifier: acquired.resolvedIdentifier,
            subset: acquired.subset,
          },
        };
      }
      throw new PublicExampleAcquisitionError(
        "The public example destination is full. Remove an old example version and retry.",
      );
    } catch (error) {
      throw normalizeAcquisitionError(error, extra.signal);
    }
  }

  async #acquireBytes(
    exampleId: SequencePublicExampleId,
    signal?: AbortSignal,
  ): Promise<AcquiredBytes> {
    switch (exampleId) {
      case "ena-drr037765-first-500":
        return this.#acquireEnaReads(signal);
      case "ncbi-nc-001416-1":
        return this.#acquireNcbiGenBank(signal);
      case "rfam-rf00360-15-1":
        return this.#acquireRfamAlignment(signal);
      case "uniprot-human-ras-sv1":
        return this.#acquireUniProtRas(signal);
    }
  }

  async #acquireUniProtRas(signal?: AbortSignal): Promise<AcquiredBytes> {
    const responses = await Promise.all(
      UNIPROT_RAS_ENTRIES.map(async (entry) => {
        const url = new URL(
          `https://rest.uniprot.org/uniprotkb/${entry.accession}.fasta`,
        );
        const response = await this.#fetchBounded({
          allowedHosts: new Set(["rest.uniprot.org"]),
          maxBytes: 32 * 1_024,
          signal,
          url,
        });
        const text = decodeUtf8(
          response.bytes,
          `UniProtKB ${entry.accession} FASTA response`,
        );
        rejectHtmlPayload(text, `UniProtKB ${entry.accession} FASTA response`);
        return {
          entry,
          evidence: response.evidence,
          record: validateUniProtRasRecord(text, entry),
        };
      }),
    );
    signal?.throwIfAborted();
    const alignment = alignSequences(
      responses.map(({ entry, record }) => ({
        description: `${entry.entryName} ${entry.proteinName}, UniProtKB reviewed sequence version ${entry.sequenceVersion}`,
        id: entry.accession,
        label: entry.accession,
        metadata: {
          entryName: entry.entryName,
          gene: entry.gene,
          sequenceSha256: entry.sequenceSha256,
          sequenceVersion: String(entry.sequenceVersion),
        },
        sequence: record.sequence,
        sourceId: entry.accession,
      })),
      UNIPROT_RAS_ALIGNMENT_SCORES,
      "builtin-center-star",
    );
    if (
      alignment.engine !== "builtin-center-star" ||
      alignment.alignedLength !== 191 ||
      alignment.rows.length !== UNIPROT_RAS_ENTRIES.length ||
      alignment.rows.some(
        (row, index) =>
          row.label !== UNIPROT_RAS_ENTRIES[index]?.accession ||
          row.alignedSequence.replaceAll("-", "").length !==
            UNIPROT_RAS_RECORD_LENGTH ||
          row.alignedSequence.length !== alignment.alignedLength,
      )
    ) {
      throw new PublicExampleAcquisitionError(
        "The bounded RAS center-star alignment did not match its deterministic contract.",
      );
    }
    const artifactText = exportAlignedFasta(alignment.rows);
    const artifactBytes = Buffer.from(artifactText, "utf8");
    if (
      artifactBytes.byteLength !== UNIPROT_RAS_ALIGNMENT_BYTE_LENGTH ||
      sha256(artifactBytes) !== UNIPROT_RAS_ALIGNMENT_SHA256
    ) {
      throw new PublicExampleAcquisitionError(
        "The bounded RAS center-star alignment artifact changed. Review the derivation before updating this starter.",
      );
    }
    const parsed = parseMsa(artifactText, "human-RAS-UniProt-SV1.aln-fasta");
    const expectedAccessions = UNIPROT_RAS_ENTRIES.map(
      ({ accession }) => accession,
    );
    if (parsed.status !== "success") {
      throw new PublicExampleAcquisitionError(
        `The canonical UniProtKB RAS alignment failed production MSA validation: ${parsed.message}`,
      );
    }
    if (
      parsed.document.rows.length !== UNIPROT_RAS_ENTRIES.length ||
      parsed.document.alignedLength !== alignment.alignedLength ||
      parsed.document.rows.some(
        (row, index) => row.label !== expectedAccessions[index],
      )
    ) {
      throw new PublicExampleAcquisitionError(
        "The canonical UniProtKB RAS alignment failed production MSA validation.",
      );
    }
    const requestedIdentifier = UNIPROT_RAS_ENTRIES.map(
      ({ accession }) => accession,
    ).join(",");
    const resolvedIdentifier = UNIPROT_RAS_ENTRIES.map(
      ({ accession, sequenceVersion }) => `${accession}@SV${sequenceVersion}`,
    ).join("+");
    return {
      artifactBytes,
      database: "UniProtKB",
      derivation: {
        engine: alignment.engine,
        inputOrder: expectedAccessions,
        parameters: alignment.parameters,
        warning: alignment.warning,
      },
      requestedIdentifier,
      resolvedIdentifier,
      sources: responses.map(({ entry, evidence }) => ({
        ...evidence,
        accession: entry.accession,
        entryName: entry.entryName,
        gene: entry.gene,
        role: "reviewed-protein-sequence",
        sequenceSha256: entry.sequenceSha256,
        sequenceVersion: entry.sequenceVersion,
      })),
      subset: null,
      termsUrl: "https://www.uniprot.org/help/license",
      validation: {
        columnCount: parsed.document.alignedLength,
        format: "aligned-fasta",
        rowCount: parsed.document.rows.length,
      },
    };
  }

  async #acquireNcbiGenBank(signal?: AbortSignal): Promise<AcquiredBytes> {
    const requestedIdentifier = "NC_001416.1";
    const url = new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
    );
    url.search = new URLSearchParams({
      db: "nuccore",
      email: "support@openai.com",
      id: requestedIdentifier,
      retmode: "text",
      rettype: "gbwithparts",
      tool: "OpenAISequenceViewer",
    }).toString();
    const response = await this.#fetchBounded({
      allowedHosts: new Set(["eutils.ncbi.nlm.nih.gov"]),
      maxBytes: 2 * 1_024 * 1_024,
      signal,
      url,
    });
    const text = decodeUtf8(response.bytes, "NCBI GenBank response");
    rejectHtmlPayload(text, "NCBI GenBank response");
    if (
      !/^LOCUS\s+/mu.test(text) ||
      !/^ACCESSION\s+NC_001416(?:\s|$)/mu.test(text) ||
      !/^VERSION\s+NC_001416\.1(?:\s|$)/mu.test(text) ||
      !/^ORIGIN\s*$/mu.test(text) ||
      !/\/\/\s*$/u.test(text)
    ) {
      throw new PublicExampleAcquisitionError(
        "NCBI returned a record that did not match versioned accession NC_001416.1.",
      );
    }
    const parsed = parseSequenceDocumentResult({
      contents: text,
      fileName: "NC_001416.1.gb",
    });
    if (
      parsed.status !== "success" ||
      parsed.document.format !== "genbank" ||
      parsed.document.records.length !== 1
    ) {
      throw new PublicExampleAcquisitionError(
        "NCBI returned malformed, incomplete, or ambiguous GenBank data for NC_001416.1.",
      );
    }
    const [record] = parsed.document.records;
    if (
      record.sourceLabel !== "NC_001416" ||
      record.length !== 48_502 ||
      record.metadata.accession !== "NC_001416" ||
      record.metadata.version !== "NC_001416.1" ||
      !hasExactCiCds(record) ||
      !hasExactLambdaOperator(record, "operator-r3", 37_951, 37_967) ||
      !hasExactLambdaOperator(record, "operator-r2", 37_974, 37_990) ||
      !hasExactLambdaOperator(record, "operator-r1", 37_998, 38_014)
    ) {
      throw new PublicExampleAcquisitionError(
        "NCBI returned NC_001416.1 without the expected 48,502-base sequence, cI CDS, or lambda operator annotations.",
      );
    }
    const locusDate = /^LOCUS\s+.*?\s(\d{2}-[A-Z]{3}-\d{4})\s*$/mu.exec(
      text,
    )?.[1];
    return {
      artifactBytes: response.bytes,
      database: "NCBI Nuccore",
      requestedIdentifier,
      resolvedIdentifier: requestedIdentifier,
      sources: [
        {
          ...response.evidence,
          annotationDate: locusDate ?? null,
          validatedCi: {
            codingSequenceSha256: NCBI_LAMBDA_CI_CODING_SHA256,
            geneticCodeId: 11,
            proteinAccession: "NP_040628.1",
            proteinLength: 237,
            proteinSha256: NCBI_LAMBDA_CI_PROTEIN_SHA256,
          },
          sequenceVersion: requestedIdentifier,
        },
      ],
      subset: null,
      termsUrl: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
      validation: {
        format: "genbank",
        recordCount: parsed.document.records.length,
        residueCount: record.sequence.length,
      },
    };
  }

  async #acquireRfamAlignment(signal?: AbortSignal): Promise<AcquiredBytes> {
    const accession = "RF00360";
    const release = "15.1";
    const archiveUrl = new URL(
      `https://ftp.ebi.ac.uk/pub/databases/Rfam/${release}/Rfam.seed.gz`,
    );
    const archive = await this.#fetchBounded({
      allowedHosts: new Set(["ftp.ebi.ac.uk"]),
      maxBytes: 8 * 1_024 * 1_024,
      signal,
      url: archiveUrl,
    });
    let decodedArchive: Buffer;
    try {
      signal?.throwIfAborted();
      decodedArchive = await gunzip(archive.bytes, {
        maxOutputLength: MAX_DECODED_RESPONSE_BYTES,
      });
      signal?.throwIfAborted();
    } catch {
      if (signal?.aborted) {
        throw new PublicExampleAcquisitionError(
          "Public example acquisition was cancelled. No viewer was opened.",
        );
      }
      throw new PublicExampleAcquisitionError(
        `The Rfam ${release} seed archive was truncated, malformed, or exceeded the decoded-size budget.`,
      );
    }
    const alignmentBytes = extractRfamSeedAlignment(
      decodedArchive,
      accession,
      release,
    );
    const text = decodeUtf8(alignmentBytes, "Rfam Stockholm response");
    rejectHtmlPayload(text, "Rfam Stockholm response");
    const seedCount = parseRfamSeedCount(text, accession, release);
    if (
      !/^# STOCKHOLM 1\.0\s*$/mu.test(text) ||
      !new RegExp(`^#=GF\\s+AC\\s+${accession}\\s*$`, "mu").test(text) ||
      !/^#=GF\s+BM\s+.*\bSEED\b.*$/mu.test(text) ||
      !/\/\/\s*$/u.test(text)
    ) {
      throw new PublicExampleAcquisitionError(
        `Rfam returned an alignment that did not identify ${accession}.`,
      );
    }
    const parsed = parseMsa(text, `${accession}-rfam-${release}.sto`);
    if (
      parsed.status !== "success" ||
      parsed.document.rows.length < 2 ||
      parsed.document.rows.length !== seedCount ||
      !parsed.document.rows.some(({ alignedSequence }) =>
        /[-.]/u.test(alignedSequence),
      )
    ) {
      throw new PublicExampleAcquisitionError(
        `Rfam returned a malformed alignment or a row count that did not match the ${accession} seed metadata.`,
      );
    }
    const requestedIdentifier = `${accession}@${release}:seed`;
    const artifactBytes = alignmentBytes;
    return {
      artifactBytes,
      database: "Rfam",
      requestedIdentifier,
      resolvedIdentifier: requestedIdentifier,
      sources: [
        {
          ...archive.evidence,
          archiveFormat: "gzip",
          role: "release-seed-archive",
          selectedAccession: accession,
          selectedByteLength: artifactBytes.byteLength,
          selectedSha256: sha256(artifactBytes),
          upstreamCuration: { num_seed: seedCount },
          upstreamRelease: {
            archive: "Rfam.seed.gz",
            number: release,
          },
        },
      ],
      subset: {
        archiveRecordSelector: `exact #=GF AC ${accession}`,
        archiveRelease: release,
        selectedRecordCount: 1,
        selectedSeedRows: seedCount,
      },
      termsUrl: "https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/COPYING",
      validation: {
        columnCount: parsed.document.alignedLength,
        format: "stockholm",
        rowCount: parsed.document.rows.length,
      },
    };
  }

  async #acquireEnaReads(signal?: AbortSignal): Promise<AcquiredBytes> {
    const runAccession = "DRR037765";
    const metadataUrl = new URL(
      "https://www.ebi.ac.uk/ena/portal/api/filereport",
    );
    metadataUrl.search = new URLSearchParams({
      accession: runAccession,
      fields: "run_accession,fastq_ftp,fastq_md5,fastq_bytes",
      result: "read_run",
    }).toString();
    const metadata = await this.#fetchBounded({
      allowedHosts: new Set(["www.ebi.ac.uk"]),
      maxBytes: 256 * 1_024,
      signal,
      url: metadataUrl,
    });
    const fastq = parseEnaFileReport(metadata.bytes, runAccession);
    const pinned = this.#integrityPins.ena;
    if (
      fastq.byteLength !== pinned.compressedByteLength ||
      fastq.md5 !== pinned.compressedMd5
    ) {
      throw new PublicExampleAcquisitionError(
        "The pinned ENA source identity changed in the authoritative file report. Review the source before updating this starter.",
      );
    }
    if (fastq.byteLength > MAX_NETWORK_RESPONSE_BYTES) {
      throw new PublicExampleAcquisitionError(
        "The pinned ENA read file now exceeds the starter download budget.",
      );
    }
    const fastqUrl = enaFtpToHttps(fastq.ftpUrl);
    const compressed = await this.#fetchBounded({
      allowedHosts: new Set(["ftp.sra.ebi.ac.uk"]),
      maxBytes: Math.min(
        MAX_NETWORK_RESPONSE_BYTES,
        Math.max(fastq.byteLength, 1),
      ),
      signal,
      url: fastqUrl,
    });
    if (compressed.bytes.byteLength !== fastq.byteLength) {
      throw new PublicExampleAcquisitionError(
        "The ENA read file byte length did not match its authoritative file report.",
      );
    }
    if (md5(compressed.bytes) !== fastq.md5) {
      throw new PublicExampleAcquisitionError(
        "The ENA read file checksum did not match its authoritative file report.",
      );
    }
    let decoded: Buffer;
    try {
      signal?.throwIfAborted();
      decoded = await gunzip(compressed.bytes, {
        maxOutputLength: MAX_DECODED_RESPONSE_BYTES,
      });
      signal?.throwIfAborted();
    } catch {
      if (signal?.aborted) {
        throw new PublicExampleAcquisitionError(
          "Public example acquisition was cancelled. No viewer was opened.",
        );
      }
      throw new PublicExampleAcquisitionError(
        "The ENA read file was truncated, malformed, or exceeded the decoded-size budget.",
      );
    }
    const text = decodeUtf8(decoded, "ENA FASTQ response");
    rejectHtmlPayload(text, "ENA FASTQ response");
    const parsedSource = parseSequenceDocumentResult({
      contents: text,
      fileName: `${runAccession}.fastq`,
    });
    if (
      parsedSource.status !== "success" ||
      parsedSource.document.format !== "fastq" ||
      parsedSource.document.fastqSummary == null ||
      parsedSource.document.fastqSummary.readCount < ENA_SUBSET_RECORDS ||
      parsedSource.document.fastqSummary.readCount !== pinned.sourceRecords ||
      parsedSource.document.records.length < ENA_SUBSET_RECORDS ||
      parsedSource.document.records.some(
        (record) =>
          record.quality == null ||
          !new RegExp(`^${runAccession}\\.\\d+$`, "u").test(record.sourceLabel),
      )
    ) {
      throw new PublicExampleAcquisitionError(
        `The pinned ENA run did not contain ${ENA_SUBSET_RECORDS} complete, identity-matched FASTQ reads.`,
      );
    }
    const subsetText = `${parsedSource.document.records
      .slice(0, ENA_SUBSET_RECORDS)
      .map((record) => buildFastqExport(record))
      .join("\n")}\n`;
    const parsedSubset = parseSequenceDocumentResult({
      contents: subsetText,
      fileName: `${runAccession}-first-${ENA_SUBSET_RECORDS}.fastq`,
    });
    if (
      parsedSubset.status !== "success" ||
      parsedSubset.document.format !== "fastq" ||
      parsedSubset.document.fastqSummary?.readCount !== ENA_SUBSET_RECORDS
    ) {
      throw new PublicExampleAcquisitionError(
        "The deterministic ENA read subset failed FASTQ validation.",
      );
    }
    const artifactBytes = Buffer.from(subsetText, "utf8");
    const summary = parsedSubset.document.fastqSummary;
    if (
      artifactBytes.byteLength !== pinned.artifactByteLength ||
      sha256(artifactBytes) !== pinned.artifactSha256 ||
      summary.totalBases !== pinned.totalBases ||
      summary.readLengthMin !== pinned.readLengthMin ||
      summary.readLengthMax !== pinned.readLengthMax ||
      summary.gcFraction !== pinned.gcFraction ||
      summary.q30Fraction !== pinned.q30Fraction
    ) {
      throw new PublicExampleAcquisitionError(
        "The deterministic ENA first-500 artifact or live QC baseline changed. Review the source before updating this starter.",
      );
    }
    return {
      artifactBytes,
      database: "ENA",
      requestedIdentifier: runAccession,
      resolvedIdentifier: `${runAccession}/${fastq.fileName}@md5:${fastq.md5}`,
      sources: [
        {
          ...metadata.evidence,
          role: "file-report",
          upstreamBytes: fastq.byteLength,
          upstreamMd5: fastq.md5,
        },
        {
          ...compressed.evidence,
          role: "compressed-fastq",
          upstreamBytes: fastq.byteLength,
          upstreamMd5: fastq.md5,
        },
      ],
      subset: {
        emittedRecords: ENA_SUBSET_RECORDS,
        rule: `first ${ENA_SUBSET_RECORDS} parsed records in source order after gzip decompression, canonical four-line FASTQ`,
        sourceRecords: parsedSource.document.fastqSummary.readCount,
      },
      termsUrl: "https://www.ebi.ac.uk/ena/browser/about/policies",
      validation: {
        format: "fastq",
        recordCount: parsedSubset.document.fastqSummary.readCount,
        residueCount: parsedSubset.document.fastqSummary.totalBases,
      },
    };
  }

  async #fetchBounded({
    allowedHosts,
    maxBytes,
    signal,
    url,
  }: {
    allowedHosts: ReadonlySet<string>;
    maxBytes: number;
    signal?: AbortSignal;
    url: URL;
  }): Promise<{ bytes: Buffer; evidence: HttpEvidence }> {
    const combined = createRequestSignal(signal, this.#requestTimeoutMs);
    try {
      let response: Response;
      try {
        response = await this.#fetch(url, {
          headers: {
            Accept:
              "application/json, text/plain, application/octet-stream;q=0.9",
            "User-Agent": `OpenAI-Sequence-Viewer/${SEQUENCE_VIEWER_VERSION}`,
          },
          redirect: "error",
          signal: combined.signal,
        });
      } catch (error) {
        if (combined.signal.aborted) {
          throw new PublicExampleAcquisitionError(
            signal?.aborted
              ? "Public example acquisition was cancelled. No viewer was opened."
              : "The authoritative database request timed out. Retry when the service is available.",
          );
        }
        throw new PublicExampleAcquisitionError(
          "The authoritative database could not be reached. Check network access and retry.",
        );
      }
      const finalUrl = new URL(response.url || url.href);
      if (
        finalUrl.protocol !== "https:" ||
        !allowedHosts.has(finalUrl.hostname.toLowerCase()) ||
        finalUrl.username !== "" ||
        finalUrl.password !== "" ||
        finalUrl.hash !== ""
      ) {
        throw new PublicExampleAcquisitionError(
          "The authoritative database redirected outside its approved HTTPS endpoint.",
        );
      }
      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        const suffix = retryAfter == null ? "" : ` Retry after ${retryAfter}.`;
        throw new PublicExampleAcquisitionError(
          `The authoritative database returned HTTP ${response.status}.${suffix}`,
        );
      }
      const declaredLength = parseContentLength(
        response.headers.get("content-length"),
      );
      if (declaredLength != null && declaredLength > maxBytes) {
        throw new PublicExampleAcquisitionError(
          "The authoritative response exceeded the starter byte budget.",
        );
      }
      let bytes: Buffer;
      try {
        bytes = await readBoundedBody(response, maxBytes, combined.signal);
      } catch (error) {
        if (combined.signal.aborted) {
          throw new PublicExampleAcquisitionError(
            signal?.aborted
              ? "Public example acquisition was cancelled. No viewer was opened."
              : "The authoritative database response timed out. Retry when the service is available.",
          );
        }
        if (error instanceof PublicExampleAcquisitionError) throw error;
        throw new PublicExampleAcquisitionError(
          "The authoritative database response was interrupted. Retry when the service is available.",
        );
      }
      if (bytes.byteLength === 0) {
        throw new PublicExampleAcquisitionError(
          "The authoritative database returned an empty response.",
        );
      }
      return {
        bytes,
        evidence: {
          byteLength: bytes.byteLength,
          contentType: response.headers.get("content-type"),
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          sha256: sha256(bytes),
          url: finalUrl.href,
        },
      };
    } finally {
      combined.dispose();
    }
  }
}

type WorkspaceDestination = {
  directoryIdentity: FileSystemIdentity;
  examplesDirectory: string;
  root: string;
  rootIdentity: FileSystemIdentity;
};

function hasExactCiCds(record: {
  sequence: string;
  features: Array<{
    end: number;
    geneticCodeId?: number;
    qualifiers: Record<string, string | string[]>;
    sourceLocation?: string;
    start: number;
    strand: string;
    translation?: string;
    translationTrackReliable?: boolean;
    type: string;
  }>;
}): boolean {
  const feature = record.features.find(
    (feature) =>
      feature.type === "CDS" &&
      feature.start === 37_227 &&
      feature.end === 37_940 &&
      feature.strand === "-" &&
      feature.sourceLocation === "complement(37227..37940)" &&
      feature.geneticCodeId === 11 &&
      feature.translationTrackReliable === true &&
      hasQualifier(feature.qualifiers, "gene", "cI") &&
      hasQualifier(feature.qualifiers, "protein_id", "NP_040628.1") &&
      hasQualifier(
        feature.qualifiers,
        "product",
        "LexA family transcriptional regulator",
      ),
  );
  if (feature == null) return false;
  const codingSequence = reverseComplement(
    record.sequence.slice(feature.start - 1, feature.end),
  );
  const translationWithStop = translateFrame(codingSequence, 0, 11);
  if (!translationWithStop.endsWith("*")) return false;
  const translatedProtein = translationWithStop.slice(0, -1);
  return (
    sha256(Buffer.from(codingSequence, "ascii")) ===
      NCBI_LAMBDA_CI_CODING_SHA256 &&
    translatedProtein.length === 237 &&
    sha256(Buffer.from(translatedProtein, "ascii")) ===
      NCBI_LAMBDA_CI_PROTEIN_SHA256 &&
    feature.translation === translatedProtein
  );
}

function hasExactLambdaOperator(
  record: {
    features: Array<{
      end: number;
      qualifiers: Record<string, string | string[]>;
      start: number;
      type: string;
    }>;
  },
  note: string,
  start: number,
  end: number,
): boolean {
  return record.features.some(
    (feature) =>
      feature.type === "regulatory" &&
      feature.start === start &&
      feature.end === end &&
      hasQualifier(feature.qualifiers, "regulatory_class", "other") &&
      hasQualifier(feature.qualifiers, "note", note),
  );
}

function hasQualifier(
  qualifiers: Record<string, string | string[]>,
  name: string,
  expected: string,
): boolean {
  const value = qualifiers[name];
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

function validateUniProtRasRecord(
  text: string,
  entry: (typeof UNIPROT_RAS_ENTRIES)[number],
) {
  const header = text.split(/\r?\n/u, 1)[0] ?? "";
  if (
    !header.startsWith(`>sp|${entry.accession}|${entry.entryName} `) ||
    !hasFastaHeaderField(header, "OS", "Homo sapiens") ||
    !hasFastaHeaderField(header, "OX", "9606") ||
    !hasFastaHeaderField(header, "GN", entry.gene) ||
    !hasFastaHeaderField(header, "PE", "1") ||
    !hasFastaHeaderField(header, "SV", String(entry.sequenceVersion))
  ) {
    throw new PublicExampleAcquisitionError(
      `UniProtKB returned ${entry.accession} without the expected reviewed human sequence-version identity.`,
    );
  }
  const parsed = parseSequenceDocumentResult({
    contents: text,
    fileName: `${entry.accession}.fasta`,
  });
  if (
    parsed.status !== "success" ||
    parsed.document.format !== "fasta" ||
    parsed.document.records.length !== 1
  ) {
    throw new PublicExampleAcquisitionError(
      `UniProtKB returned malformed or ambiguous FASTA data for ${entry.accession}.`,
    );
  }
  const [record] = parsed.document.records;
  if (
    record.sourceLabel !== `sp|${entry.accession}|${entry.entryName}` ||
    record.length !== UNIPROT_RAS_RECORD_LENGTH ||
    record.molecule !== "protein" ||
    sha256(Buffer.from(record.sequence, "ascii")) !== entry.sequenceSha256 ||
    record.sequence.slice(9, 17) !== "GAGGVGKS" ||
    record.sequence.slice(29, 38) !== "DEYDPTIED" ||
    record.sequence.slice(59, 76) !== "GQEEYSAMRDQYMRTGE" ||
    record.sequence.slice(115, 119) !== "NKCD" ||
    !record.sequence.endsWith(entry.caax)
  ) {
    throw new PublicExampleAcquisitionError(
      `UniProtKB returned ${entry.accession} with unexpected sequence content or RAS motif identity.`,
    );
  }
  return record;
}

function hasFastaHeaderField(
  header: string,
  name: string,
  expected: string,
): boolean {
  return new RegExp(
    `(?:^|\\s)${name}=${escapeRegExp(expected)}(?=\\s[A-Z]{2}=|$)`,
    "u",
  ).test(header);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function verifyPublishedArtifact({
  artifactPath,
  expectedByteLength,
  expectedSha256,
}: {
  artifactPath: string;
  expectedByteLength: number;
  expectedSha256: string;
}): Promise<SequencePublicExampleFileIdentity> {
  const handle = await open(
    artifactPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size !== BigInt(expectedByteLength)) {
      throw new PublicExampleAcquisitionError(
        "The published public example did not retain its validated file identity.",
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    const current = await lstat(artifactPath, { bigint: true });
    if (
      !current.isFile() ||
      sha256(bytes) !== expectedSha256 ||
      !sameFileStat(before, after) ||
      !sameFileStat(after, current)
    ) {
      throw new PublicExampleAcquisitionError(
        "The published public example changed before it could be opened.",
      );
    }
    return {
      device: after.dev.toString(),
      inode: after.ino.toString(),
      modifiedAtNanoseconds: after.mtimeNs.toString(),
      size: after.size.toString(),
    };
  } finally {
    await handle.close();
  }
}

function sameFileStat(
  left: { dev: bigint; ino: bigint; mtimeNs: bigint; size: bigint },
  right: { dev: bigint; ino: bigint; mtimeNs: bigint; size: bigint },
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mtimeNs === right.mtimeNs &&
    left.size === right.size
  );
}

async function resolveWorkspaceDestination(
  requestedRoot: string | undefined,
  extra: RootsRequestExtra,
): Promise<WorkspaceDestination> {
  let rootsResult: { roots: Array<{ uri: string }> };
  try {
    rootsResult = await extra.sendRequest(
      { method: "roots/list" },
      ListRootsResultSchema,
    );
  } catch {
    throw new PublicExampleAcquisitionError(
      "The installed host did not expose an active workspace root. Open a workspace and retry. The host must provide an independently authenticated local workspace root through MCP roots/list.",
    );
  }
  const roots = Array.from(
    new Set(
      (
        await Promise.all(
          rootsResult.roots.map(async ({ uri }) => {
            if (!uri.startsWith("file://")) {
              return null;
            }
            try {
              return await realpath(fileURLToPath(uri));
            } catch {
              return null;
            }
          }),
        )
      ).filter((root): root is string => root != null),
    ),
  );
  if (roots.length === 0) {
    throw new PublicExampleAcquisitionError(
      "The installed host did not expose a readable local workspace root. Open a local workspace and retry. The host must provide an independently authenticated local workspace root through MCP roots/list.",
    );
  }
  let root: string;
  if (requestedRoot == null) {
    if (roots.length !== 1) {
      throw new PublicExampleAcquisitionError(
        "Multiple workspace roots are active. Retry with the exact intended workspace root.",
      );
    }
    root = roots[0];
  } else {
    let canonicalRequestedRoot: string;
    try {
      canonicalRequestedRoot = await realpath(requestedRoot);
    } catch {
      throw new PublicExampleAcquisitionError(
        "The requested workspace root is unavailable.",
      );
    }
    if (!roots.includes(canonicalRequestedRoot)) {
      throw new PublicExampleAcquisitionError(
        "The requested destination is not an active workspace root.",
      );
    }
    root = canonicalRequestedRoot;
  }
  const rootIdentity = await readDirectoryIdentity(root);
  const requestedDirectory = path.join(root, EXAMPLES_DIRECTORY_NAME);
  await mkdir(requestedDirectory, { mode: 0o700, recursive: true });
  const examplesDirectory = await realpath(requestedDirectory);
  if (
    examplesDirectory !== requestedDirectory ||
    !isPathWithin(root, examplesDirectory)
  ) {
    throw new PublicExampleAcquisitionError(
      "The public example directory is not a safe workspace directory.",
    );
  }
  const directoryIdentity = await readDirectoryIdentity(examplesDirectory);
  return { directoryIdentity, examplesDirectory, root, rootIdentity };
}

async function assertUnchangedDirectory(
  workspace: WorkspaceDestination,
): Promise<void> {
  const [rootIdentity, directoryIdentity, canonicalDirectory] =
    await Promise.all([
      readDirectoryIdentity(workspace.root),
      readDirectoryIdentity(workspace.examplesDirectory),
      realpath(workspace.examplesDirectory),
    ]);
  if (
    canonicalDirectory !== workspace.examplesDirectory ||
    !sameIdentity(rootIdentity, workspace.rootIdentity) ||
    !sameIdentity(directoryIdentity, workspace.directoryIdentity)
  ) {
    throw new PublicExampleAcquisitionError(
      "The workspace destination changed during acquisition. No viewer was opened.",
    );
  }
}

async function readDirectoryIdentity(
  directoryPath: string,
): Promise<FileSystemIdentity> {
  const directoryStat = await stat(directoryPath, { bigint: true });
  if (!directoryStat.isDirectory()) {
    throw new PublicExampleAcquisitionError(
      "The public example destination is not a directory.",
    );
  }
  return { device: directoryStat.dev, inode: directoryStat.ino };
}

function sameIdentity(
  left: FileSystemIdentity,
  right: FileSystemIdentity,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function createProvenance({
  acquired,
  acquiredAt,
  artifactRelativePath,
  artifactSha256,
  exampleId,
  provenanceRelativePath,
}: {
  acquired: AcquiredBytes;
  acquiredAt: string;
  artifactRelativePath: string;
  artifactSha256: string;
  exampleId: SequencePublicExampleId;
  provenanceRelativePath: string;
}): Record<string, unknown> {
  return {
    acquisition: {
      route: "official-database-endpoint",
      sources: acquired.sources,
    },
    artifact: {
      byteLength: acquired.artifactBytes.byteLength,
      format: acquired.validation.format,
      relativePath: artifactRelativePath,
      sha256: artifactSha256,
      validation: acquired.validation,
    },
    database: acquired.database,
    derivation: acquired.derivation ?? null,
    exampleId,
    pluginVersion: SEQUENCE_VIEWER_VERSION,
    provenanceRelativePath,
    requestedIdentifier: acquired.requestedIdentifier,
    resolvedIdentifier: acquired.resolvedIdentifier,
    retrievedAt: acquiredAt,
    schemaVersion: 1,
    subset: acquired.subset,
    termsUrl: acquired.termsUrl,
    validatorVersion: VALIDATOR_VERSION,
  };
}

function fileNameForExample(
  exampleId: SequencePublicExampleId,
  attempt: number,
): string {
  const [stem, extension] = (() => {
    switch (exampleId) {
      case "ena-drr037765-first-500":
        return ["DRR037765-first-500", ".fastq"];
      case "ncbi-nc-001416-1":
        return ["NC_001416.1", ".gb"];
      case "rfam-rf00360-15-1":
        return ["RF00360-rfam-15.1", ".sto"];
      case "uniprot-human-ras-sv1":
        return ["human-RAS-UniProt-SV1", ".aln-fasta"];
    }
  })();
  return `${stem}${attempt === 1 ? "" : `-${attempt}`}${extension}`;
}

function toWorkspaceRelativePath(root: string, filePath: string): string {
  if (!isPathWithin(root, filePath)) {
    throw new PublicExampleAcquisitionError(
      "The public example destination left the active workspace.",
    );
  }
  return path.relative(root, filePath).split(path.sep).join("/");
}

function isPathWithin(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === "" ||
    (!path.isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`))
  );
}

function extractRfamSeedAlignment(
  archiveBytes: Buffer,
  accession: string,
  release: string,
): Buffer {
  const recordStartMarker = Buffer.from("# STOCKHOLM 1.0", "ascii");
  const recordTerminatorMarker = Buffer.from("\n//", "ascii");
  const accessionMarker = Buffer.from(accession, "ascii");
  const accessionPattern = new RegExp(`^#=GF\\s+AC\\s+${accession}\\s*$`, "mu");
  const matches: Buffer[] = [];
  let cursor = 0;
  while (cursor < archiveBytes.length) {
    const recordStart = archiveBytes.indexOf(recordStartMarker, cursor);
    if (recordStart === -1) {
      break;
    }
    const terminatorStart = archiveBytes.indexOf(
      recordTerminatorMarker,
      recordStart,
    );
    if (terminatorStart === -1) {
      throw new PublicExampleAcquisitionError(
        `The Rfam ${release} seed archive contained a truncated Stockholm record.`,
      );
    }
    let recordEnd = terminatorStart + recordTerminatorMarker.length;
    if (archiveBytes[recordEnd] === 13) {
      recordEnd += 1;
    }
    if (archiveBytes[recordEnd] === 10) {
      recordEnd += 1;
    }
    const record = archiveBytes.subarray(recordStart, recordEnd);
    if (record.indexOf(accessionMarker) !== -1) {
      const text = decodeUtf8(record, "Rfam Stockholm record");
      if (accessionPattern.test(text)) {
        matches.push(Buffer.from(record));
      }
    }
    cursor = recordEnd;
  }
  if (matches.length !== 1) {
    throw new PublicExampleAcquisitionError(
      `The Rfam ${release} seed archive did not contain exactly one ${accession} record.`,
    );
  }
  return matches[0];
}

function parseRfamSeedCount(
  text: string,
  accession: string,
  release: string,
): number {
  const matches = [...text.matchAll(/^#=GF\s+SQ\s+(\d+)\s*$/gmu)];
  const seedCount = Number(matches[0]?.[1]);
  if (
    matches.length !== 1 ||
    seedCount !== RFAM_RF00360_RELEASE_15_1_SEED_COUNT
  ) {
    throw new PublicExampleAcquisitionError(
      `The Rfam ${accession} release ${release} seed count did not match the pinned archive contract.`,
    );
  }
  return seedCount;
}

function parseEnaFileReport(
  bytes: Uint8Array,
  runAccession: string,
): {
  byteLength: number;
  fileName: string;
  ftpUrl: string;
  md5: string;
} {
  const text = decodeUtf8(bytes, "ENA file report");
  rejectHtmlPayload(text, "ENA file report");
  const lines = text.trim().split(/\r?\n/u);
  if (lines.length !== 2) {
    throw new PublicExampleAcquisitionError(
      "ENA returned an ambiguous or empty file report for the pinned run.",
    );
  }
  const headers = lines[0].split("\t");
  const values = lines[1].split("\t");
  const requiredHeaders = [
    "run_accession",
    "fastq_ftp",
    "fastq_md5",
    "fastq_bytes",
  ];
  if (
    headers.length !== requiredHeaders.length ||
    values.length !== requiredHeaders.length ||
    new Set(headers).size !== requiredHeaders.length ||
    requiredHeaders.some((header) => !headers.includes(header))
  ) {
    throw new PublicExampleAcquisitionError(
      "ENA returned a malformed file report without the required pinned-run fields.",
    );
  }
  const row = Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ) as Record<(typeof requiredHeaders)[number], string>;
  if (
    row.run_accession !== runAccession ||
    row.fastq_ftp.includes(";") ||
    row.fastq_md5.includes(";") ||
    row.fastq_bytes.includes(";") ||
    !/^[a-f0-9]{32}$/u.test(row.fastq_md5)
  ) {
    throw new PublicExampleAcquisitionError(
      "ENA file metadata did not uniquely match the pinned run and FASTQ file.",
    );
  }
  const byteLength = Number(row.fastq_bytes);
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new PublicExampleAcquisitionError(
      "ENA returned an invalid authoritative FASTQ byte length.",
    );
  }
  let ftpUrl: URL;
  try {
    ftpUrl = new URL(
      row.fastq_ftp.startsWith("ftp://")
        ? row.fastq_ftp
        : `ftp://${row.fastq_ftp}`,
    );
  } catch {
    throw new PublicExampleAcquisitionError(
      "ENA returned an invalid authoritative FASTQ location.",
    );
  }
  if (
    ftpUrl.protocol !== "ftp:" ||
    ftpUrl.hostname !== "ftp.sra.ebi.ac.uk" ||
    ftpUrl.username !== "" ||
    ftpUrl.password !== "" ||
    ftpUrl.hash !== "" ||
    ftpUrl.search !== "" ||
    ftpUrl.pathname !== "/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz"
  ) {
    throw new PublicExampleAcquisitionError(
      "ENA returned a FASTQ location outside its approved public archive.",
    );
  }
  return {
    byteLength,
    fileName: path.posix.basename(ftpUrl.pathname),
    ftpUrl: ftpUrl.href,
    md5: row.fastq_md5,
  };
}

function enaFtpToHttps(value: string): URL {
  const ftpUrl = new URL(value);
  return new URL(`https://ftp.sra.ebi.ac.uk${ftpUrl.pathname}${ftpUrl.search}`);
}

function rejectHtmlPayload(text: string, label: string): void {
  const prefix = text.trimStart().slice(0, 256).toLowerCase();
  if (
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.includes("<title>error")
  ) {
    throw new PublicExampleAcquisitionError(
      `${label} contained an HTML or database error page.`,
    );
  }
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new PublicExampleAcquisitionError(`${label} was not valid UTF-8.`);
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  if (response.body == null) {
    throw new PublicExampleAcquisitionError(
      "The authoritative database returned no response body.",
    );
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  const abortRead = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener("abort", abortRead, { once: true });
  try {
    while (true) {
      if (signal.aborted) {
        throw new PublicExampleAcquisitionError(
          "Public example acquisition was cancelled. No viewer was opened.",
        );
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        throw new PublicExampleAcquisitionError(
          "The authoritative response exceeded the starter byte budget.",
        );
      }
      chunks.push(value);
    }
    if (signal.aborted) {
      throw new PublicExampleAcquisitionError(
        "Public example acquisition was cancelled. No viewer was opened.",
      );
    }
    return Buffer.concat(chunks, byteLength);
  } finally {
    signal.removeEventListener("abort", abortRead);
    await reader.cancel().catch(() => undefined);
  }
}

function createRequestSignal(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): { dispose: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort, { once: true });
  if (externalSignal?.aborted) {
    controller.abort();
  }
  return {
    dispose: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onAbort);
    },
    signal: controller.signal,
  };
}

function parseContentLength(value: string | null): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function md5(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

function normalizeAcquisitionError(
  error: unknown,
  signal?: AbortSignal,
): PublicExampleAcquisitionError {
  if (error instanceof PublicExampleAcquisitionError) {
    return error;
  }
  if (signal?.aborted) {
    return new PublicExampleAcquisitionError(
      "Public example acquisition was cancelled. No viewer was opened.",
    );
  }
  if (error instanceof z.ZodError) {
    return new PublicExampleAcquisitionError(
      "The public example request did not match the versioned starter catalog.",
    );
  }
  return new PublicExampleAcquisitionError(
    "The public example could not be acquired safely. No viewer was opened; check workspace capacity and retry.",
  );
}
