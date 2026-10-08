import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import {
  SequencePublicExampleAcquisitionStore,
  type SequencePublicExampleId,
} from "./public-example-acquisition";
import type { RootsRequestExtra } from "./chat-file-resource";

const enabled = process.env.SEQUENCE_VIEWER_PUBLIC_EXAMPLES_LIVE === "1";
const evidenceRoot =
  process.env.SEQUENCE_VIEWER_PUBLIC_EXAMPLES_EVIDENCE_ROOT?.trim() || null;
const workspaces: string[] = [];

afterAll(async () => {
  await Promise.all(
    workspaces.map((workspace) =>
      rm(workspace, { force: true, recursive: true }),
    ),
  );
});

describe.skipIf(!enabled)(
  "live authoritative public example qualification",
  () => {
    it.each([
      "ena-drr037765-first-500",
      "ncbi-nc-001416-1",
      "rfam-rf00360-15-1",
      "uniprot-human-ras-sv1",
    ] as const)(
      "acquires and verifies %s without an optional research skill",
      async (exampleId) => {
        const workspace =
          evidenceRoot ??
          (await mkdtemp(
            path.join(os.tmpdir(), "sequence-viewer-live-public-example-"),
          ));
        if (evidenceRoot == null) {
          workspaces.push(workspace);
        } else {
          await mkdir(workspace, { recursive: true });
        }
        const extra: RootsRequestExtra = {
          sendRequest: async () => ({
            roots: [{ uri: pathToFileURL(workspace).href }],
          }),
        };
        const store = new SequencePublicExampleAcquisitionStore({
          requestTimeoutMs: 60_000,
        });

        const result = await store.acquire({ exampleId }, extra);
        const [artifact, provenanceText] = await Promise.all([
          readFile(result.absolutePath),
          readFile(`${result.absolutePath}.provenance.json`, "utf8"),
        ]);
        const provenance = JSON.parse(provenanceText);

        expect(result.provenance.exampleId).toBe(
          exampleId as SequencePublicExampleId,
        );
        expect(createHash("sha256").update(artifact).digest("hex")).toBe(
          result.provenance.artifactSha256,
        );
        expect(provenance).toEqual(
          expect.objectContaining({
            acquisition: expect.objectContaining({
              route: "official-database-endpoint",
              sources: expect.arrayContaining([
                expect.objectContaining({
                  byteLength: expect.any(Number),
                  sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
                  url: expect.stringMatching(/^https:\/\//u),
                }),
              ]),
            }),
            artifact: expect.objectContaining({
              byteLength: artifact.byteLength,
              sha256: result.provenance.artifactSha256,
            }),
            exampleId,
            schemaVersion: 1,
          }),
        );
        expect(provenanceText).not.toMatch(/smoke-fixtures|bundled sample/iu);
        if (exampleId === "ena-drr037765-first-500") {
          expect(provenance.resolvedIdentifier).toBe(
            "DRR037765/DRR037765.fastq.gz@md5:81735432a6f578b332aae58cdbd95231",
          );
          expect(artifact.byteLength).toBe(480_372);
          expect(result.provenance.artifactSha256).toBe(
            "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
          );
          expect(provenance.subset).toEqual({
            emittedRecords: 500,
            rule: "first 500 parsed records in source order after gzip decompression, canonical four-line FASTQ",
            sourceRecords: 967,
          });
          expect(provenance.artifact.validation).toEqual({
            format: "fastq",
            recordCount: 500,
            residueCount: 235_490,
          });
          expect(provenance.acquisition.sources).toEqual([
            expect.objectContaining({
              role: "file-report",
              upstreamBytes: 127_526,
              upstreamMd5: "81735432a6f578b332aae58cdbd95231",
              url: expect.stringContaining(
                "https://www.ebi.ac.uk/ena/portal/api/filereport",
              ),
            }),
            expect.objectContaining({
              byteLength: 127_526,
              role: "compressed-fastq",
              upstreamBytes: 127_526,
              upstreamMd5: "81735432a6f578b332aae58cdbd95231",
              url: "https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz",
            }),
          ]);
        }
        if (exampleId === "rfam-rf00360-15-1") {
          expect(provenance.resolvedIdentifier).toBe("RF00360@15.1:seed");
          expect(artifact.byteLength).toBe(3_433);
          expect(result.provenance.artifactSha256).toBe(
            "46005e52b767efcedcb942932adb4f1680b99121b45226ed0c37013e890305b1",
          );
          expect(provenance.acquisition.sources).toEqual([
            expect.objectContaining({
              byteLength: 5_928_432,
              role: "release-seed-archive",
              selectedAccession: "RF00360",
              selectedByteLength: 3_433,
              selectedSha256:
                "46005e52b767efcedcb942932adb4f1680b99121b45226ed0c37013e890305b1",
              sha256:
                "41f014f4ab5628620935f089b1bb77987ebc162fda7c72bff368a32c9cccabac",
              upstreamRelease: {
                archive: "Rfam.seed.gz",
                number: "15.1",
              },
              url: "https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/Rfam.seed.gz",
            }),
          ]);
          expect(provenance.artifact.validation).toEqual({
            columnCount: 132,
            format: "stockholm",
            rowCount: 9,
          });
          expect(artifact.toString("utf8")).toMatch(
            /^#=GF\s+BM\s+.*\bSEED\b.*$/mu,
          );
        }
        if (exampleId === "uniprot-human-ras-sv1") {
          expect(provenance.resolvedIdentifier).toBe(
            "P01116@SV1+P01111@SV1+P01112@SV1",
          );
          expect(provenance.derivation).toEqual({
            engine: "builtin-center-star",
            inputOrder: ["P01116", "P01111", "P01112"],
            parameters: { gapPenalty: -2, matchScore: 2, mismatchScore: -1 },
            warning: expect.stringContaining("exploratory"),
          });
          expect(provenance.artifact.validation).toEqual({
            columnCount: 191,
            format: "aligned-fasta",
            rowCount: 3,
          });
          expect(provenance.acquisition.sources).toEqual([
            expect.objectContaining({
              accession: "P01116",
              sequenceSha256:
                "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a",
              sequenceVersion: 1,
              url: "https://rest.uniprot.org/uniprotkb/P01116.fasta",
            }),
            expect.objectContaining({
              accession: "P01111",
              sequenceSha256:
                "89016168d82568aa2caa97166c99ff0b61c6fb19d5729272a7e3f03ab26ce518",
              sequenceVersion: 1,
              url: "https://rest.uniprot.org/uniprotkb/P01111.fasta",
            }),
            expect.objectContaining({
              accession: "P01112",
              sequenceSha256:
                "d9360238882c010c8474ef1eba1d2532cd96e706c7d7f689ea2014f37f8f886c",
              sequenceVersion: 1,
              url: "https://rest.uniprot.org/uniprotkb/P01112.fasta",
            }),
          ]);
          expect(artifact.toString("utf8")).toMatch(
            /^>P01116 RASK_HUMAN GTPase KRas, UniProtKB reviewed sequence version 1$/mu,
          );
        }
        if (exampleId === "ncbi-nc-001416-1") {
          expect(provenance.resolvedIdentifier).toBe("NC_001416.1");
          expect(provenance.artifact.validation).toEqual({
            format: "genbank",
            recordCount: 1,
            residueCount: 48_502,
          });
          expect(provenance.acquisition.sources).toEqual([
            expect.objectContaining({
              sequenceVersion: "NC_001416.1",
              url: expect.stringContaining(
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
              ),
              validatedCi: {
                codingSequenceSha256:
                  "a51dec784e51f85a35d643a84820c89430b526cd9bf54a398b91c70045cc62e8",
                geneticCodeId: 11,
                proteinAccession: "NP_040628.1",
                proteinLength: 237,
                proteinSha256:
                  "ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580",
              },
            }),
          ]);
        }
      },
      90_000,
    );
  },
);
