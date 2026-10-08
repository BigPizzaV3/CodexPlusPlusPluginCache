import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PublicExampleAcquisitionError,
  SequencePublicExampleAcquisitionStore,
  type SequencePublicExampleId,
} from "./public-example-acquisition";
import type { RootsRequestExtra } from "./chat-file-resource";
import { calculatePDistance } from "./msa/guide-tree";
import { parseMsa } from "./msa/parser";
import { buildGuideTree } from "./msa/phylogenetic-tree";
import { buildFastqExport } from "./sequence/exports";
import { parseSequenceDocumentResult } from "./sequence/parser";

const workspaces: string[] = [];

const NCBI_LAMBDA_CI_GENOMIC_FORWARD =
  "TCAGCCAAACGTCTCTTCAGGCCACTGACTAGCGATAACTTTCCCCACAACGGAACAACTCTCATTGCATGGGATCATTGGGTACTGTGGGTTTAGTGGTTGTAAAAACACCTGACCGCTATCCCTGATCAGTTTCTTGAAGGTAAACTCATCACCCCCAAGTCTGGCTATGCAGAAATCACCTGGCTCAACAGCCTGCTCAGGGTCAACGAGAATTAACATTCCGTCAGGAAAGCTTGGCTTGGAGCCTGTTGGTGCGGTCATGGAATTACCTTCAACCTCAAGCCAGAATGCAGAATCACTGGCTTTTTTGGTTGTGCTTACCCATCTCTCCGCATCACCTTTGGTAAAGGTTCTAAGCTCAGGTGAGAACATCCCTGCCTGAACATGAGAAAAAACAGGGTACTCATACTCACTTCTAAGTGACGGCTGCATACTAACCGCTTCATACATCTCGTAGATTTCTCTGGCGATTGAAGGGCTAAATTCTTCAACGCTAACTTTGAGAATTTTTGCAAGCAATGCGGCGTTATAAGCATTTAATGCATTGATGCCATTAAATAAAGCACCAACGCCTGACTGCCCCATCCCCATCTTGTCTGCGACAGATTCCTGGGATAAGCCAAGTTCATTTTTCTTTTTTTCATAAATTGCTTTAAGGCGACGTGCGTCCTCAAGCTGCTCTTGTGTTAATGGTTTCTTTTTTGTGCTCAT";
const NCBI_LAMBDA_CI_PROTEIN =
  "MSTKKKPLTQEQLEDARRLKAIYEKKKNELGLSQESVADKMGMGQSGVGALFNGINALNAYNAALLAKILKVSVEEFSPSIAREIYEMYEAVSMQPSLRSEYEYPVFSHVQAGMFSPELRTFTKGDAERWVSTTKKASDSAFWLEVEGNSMTAPTGSKPSFPDGMLILVDPEQAVEPGDFCIARLGGDEFTFKKLIRDSGQVFLQPLNPQYPMIPCNESCSVVGKVIASQWPEETFG";

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map((workspace) =>
      rm(workspace, { force: true, recursive: true }),
    ),
  );
});

async function makeWorkspace(prefix = "sequence-public-example-") {
  const workspace = await realpath(
    await mkdtemp(path.join(os.tmpdir(), prefix)),
  );
  workspaces.push(workspace);
  return workspace;
}

function rootsExtra(
  roots: string[],
  signal?: AbortSignal,
): RootsRequestExtra {
  return {
    sendRequest: async () => ({
      roots: roots.map((root) => ({ uri: pathToFileURL(root).href })),
    }),
    signal,
  };
}

function createNcbiGenBank({
  ciGenomicForward = NCBI_LAMBDA_CI_GENOMIC_FORWARD,
  ciTranslation = NCBI_LAMBDA_CI_PROTEIN,
  includeCi = true,
  includeOperators = true,
  length = 48_502,
}: {
  ciGenomicForward?: string;
  ciTranslation?: string;
  includeCi?: boolean;
  includeOperators?: boolean;
  length?: number;
} = {}): string {
  let sequence = "acgt".repeat(Math.ceil(length / 4)).slice(0, length);
  if (length >= 37_940) {
    sequence = `${sequence.slice(0, 37_226)}${ciGenomicForward.toLowerCase()}${sequence.slice(37_940)}`;
  }
  const features = [
    `     source          1..${length}\n                     /organism="Escherichia phage Lambda"`,
    ...(includeCi
      ? [
          `     gene            complement(37227..37940)\n                     /gene="cI"\n                     /locus_tag="lambdap88"`,
          `     CDS             complement(37227..37940)\n                     /gene="cI"\n                     /locus_tag="lambdap88"\n                     /codon_start=1\n                     /transl_table=11\n                     /product="LexA family transcriptional regulator"\n                     /protein_id="NP_040628.1"\n                     /translation="${ciTranslation}"`,
        ]
      : []),
    ...(includeOperators
      ? [
          `     regulatory      37951..37967\n                     /regulatory_class="other"\n                     /note="operator-r3"`,
          `     regulatory      37974..37990\n                     /regulatory_class="other"\n                     /note="operator-r2"`,
          `     regulatory      37998..38014\n                     /regulatory_class="other"\n                     /note="operator-r1"`,
        ]
      : []),
  ].join("\n");
  const origin = Array.from(
    { length: Math.ceil(sequence.length / 60) },
    (_, lineIndex) => {
      const start = lineIndex * 60;
      const residues = sequence
        .slice(start, start + 60)
        .match(/.{1,10}/gu)
        ?.join(" ");
      return `${String(start + 1).padStart(9)} ${residues}`;
    },
  ).join("\n");
  return `LOCUS       NC_001416          ${length} bp    DNA     linear   PHG 01-JAN-2023
DEFINITION  Enterobacteria phage lambda, complete genome.
ACCESSION   NC_001416
VERSION     NC_001416.1
FEATURES             Location/Qualifiers
${features}
ORIGIN
${origin}
//
`;
}

const NCBI_GENBANK = createNcbiGenBank();

const RFAM_STOCKHOLM = `# STOCKHOLM 1.0
#=GF ID snoZ107_R87
#=GF AC RF00360
#=GF BM cmbuild -F CM SEED
#=GF SQ 9
AJ298135.1/1-12 AC-GUACUGAUG
AY013245.2/1-12 ACGGUACUGA-G
AY013245.3/1-12 AC-GUACUGAUG
AJ489952.1/1-12 ACGGUACUGA-G
AJ307928.1/1-12 AC-GUACUGAUG
AJ307662.1/1-12 ACGGUACUGA-G
AC135465.1/1-12 AC-GUACUGAUG
AJ489954.1/1-12 ACGGUACUGA-G
AF318011.1/1-12 AC-GUACUGAUG
#=GC SS_cons     <<<<....>>>>
//
`;

const RFAM_DECOY_STOCKHOLM = `# STOCKHOLM 1.0
#=GF ID decoy
#=GF AC RF99999
#=GF BM cmbuild -F CM SEED
#=GF SQ 2
DECOY.1/1-4 AC-G
DECOY.2/1-4 ACG-
//
`;

const UNIPROT_RAS_FASTA = {
  P01111: `>sp|P01111|RASN_HUMAN GTPase NRas OS=Homo sapiens OX=9606 GN=NRAS PE=1 SV=1
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAG
QEEYSAMRDQYMRTGEGFLCVFAINNSKSFADINLYREQIKRVKDSDDVPMVLVGNKCDL
PTRTVDTKQAHELAKSYGIPFIETSAKTRQGVEDAFYTLVREIRQYRMKKLNSSDDGTQG
CMGLPCVVM
`,
  P01112: `>sp|P01112|RASH_HUMAN GTPase HRas OS=Homo sapiens OX=9606 GN=HRAS PE=1 SV=1
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAG
QEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHQYREQIKRVKDSDDVPMVLVGNKCDL
AARTVESRQAQDLARSYGIPYIETSAKTRQGVEDAFYTLVREIRQHKLRKLNPPDESGPG
CMSCKCVLS
`,
  P01116: `>sp|P01116|RASK_HUMAN GTPase KRas OS=Homo sapiens OX=9606 GN=KRAS PE=1 SV=1
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAG
QEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDL
PSRTVDTKQAQDLARSYGIPFIETSAKTRQRVEDAFYTLVREIRQYRLKKISKEEKTPGC
VKIKKCIIM
`,
} as const;

function createRfamSeedArchive(
  rfamStockholm = RFAM_STOCKHOLM,
): Buffer {
  return gzipSync(
    `${RFAM_DECOY_STOCKHOLM}${rfamStockholm}${RFAM_DECOY_STOCKHOLM}`,
  );
}

function createFastq(recordCount = 501): string {
  return Array.from({ length: recordCount }, (_, index) => {
    const id = index + 1;
    return `@DRR037765.${id}\nACGTACGT\n+\nIIIIIIII`;
  }).join("\n") + "\n";
}

function createWrappedFastq(recordCount = 501): string {
  return (
    Array.from({ length: recordCount }, (_, index) => {
      const id = index + 1;
      return `@DRR037765.${id}\nACGT\nACGT\n+\nIIII\nIIII`;
    }).join("\n") + "\n"
  );
}

function createTestEnaIntegrityPins(enaFastq: string) {
  const compressed = gzipSync(enaFastq);
  const parsedSource = parseSequenceDocumentResult({
    contents: enaFastq,
    fileName: "DRR037765.fastq",
  });
  if (
    parsedSource.status !== "success" ||
    parsedSource.document.format !== "fastq" ||
    parsedSource.document.fastqSummary == null ||
    parsedSource.document.records.length < 500
  ) {
    return {
      ena: {
        artifactByteLength: 0,
        artifactSha256: "0".repeat(64),
        compressedByteLength: compressed.byteLength,
        compressedMd5: createHash("md5").update(compressed).digest("hex"),
        gcFraction: 0,
        q30Fraction: 0,
        readLengthMax: 0,
        readLengthMin: 0,
        sourceRecords: 0,
        totalBases: 0,
      },
    };
  }
  const subsetText = `${parsedSource.document.records
    .slice(0, 500)
    .map((record) => buildFastqExport(record))
    .join("\n")}\n`;
  const parsedSubset = parseSequenceDocumentResult({
    contents: subsetText,
    fileName: "DRR037765-first-500.fastq",
  });
  if (
    parsedSubset.status !== "success" ||
    parsedSubset.document.fastqSummary == null
  ) {
    throw new Error("The deterministic test FASTQ subset did not parse.");
  }
  const artifact = Buffer.from(subsetText, "utf8");
  const summary = parsedSubset.document.fastqSummary;
  return {
    ena: {
      artifactByteLength: artifact.byteLength,
      artifactSha256: createHash("sha256").update(artifact).digest("hex"),
      compressedByteLength: compressed.byteLength,
      compressedMd5: createHash("md5").update(compressed).digest("hex"),
      gcFraction: summary.gcFraction,
      q30Fraction: summary.q30Fraction,
      readLengthMax: summary.readLengthMax,
      readLengthMin: summary.readLengthMin,
      sourceRecords: parsedSource.document.fastqSummary.readCount,
      totalBases: summary.totalBases,
    },
  };
}

function mockOfficialFetch({
  enaFastq = createFastq(),
  enaMd5,
  ncbi = NCBI_GENBANK,
  rfamArchive,
  rfamStockholm = RFAM_STOCKHOLM,
  uniprot = {},
}: {
  enaFastq?: string;
  enaMd5?: string;
  ncbi?: string;
  rfamArchive?: Buffer;
  rfamStockholm?: string;
  uniprot?: Partial<Record<keyof typeof UNIPROT_RAS_FASTA, string>>;
} = {}) {
  const compressed = gzipSync(enaFastq);
  const selectedRfamArchive =
    rfamArchive ?? createRfamSeedArchive(rfamStockholm);
  const expectedMd5 =
    enaMd5 ?? createHash("md5").update(compressed).digest("hex");
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.hostname === "eutils.ncbi.nlm.nih.gov") {
      return textResponse(ncbi);
    }
    if (url.hostname === "rest.uniprot.org") {
      const accession = /^\/uniprotkb\/(P01111|P01112|P01116)\.fasta$/u.exec(
        url.pathname,
      )?.[1] as keyof typeof UNIPROT_RAS_FASTA | undefined;
      if (accession == null) throw new Error(`Unexpected URL ${url.href}`);
      return textResponse(uniprot[accession] ?? UNIPROT_RAS_FASTA[accession], {
        "content-type": "text/plain;format=fasta",
      });
    }
    if (
      url.hostname === "ftp.ebi.ac.uk" &&
      url.pathname === "/pub/databases/Rfam/15.1/Rfam.seed.gz"
    ) {
      return new Response(Uint8Array.from(selectedRfamArchive), {
        headers: { "content-type": "application/x-gzip" },
        status: 200,
      });
    }
    if (url.hostname === "www.ebi.ac.uk") {
      return textResponse(
        `run_accession\tfastq_ftp\tfastq_md5\tfastq_bytes\nDRR037765\tftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz\t${expectedMd5}\t${compressed.byteLength}\n`,
      );
    }
    if (url.hostname === "ftp.sra.ebi.ac.uk") {
      return new Response(compressed, {
        headers: { "content-type": "application/gzip" },
        status: 200,
      });
    }
    throw new Error(`Unexpected URL ${url.href}`);
  });
  return Object.assign(fetchImpl, {
    integrityPins: createTestEnaIntegrityPins(enaFastq),
  });
}

function textResponse(
  body: string,
  headers: Record<string, string> = { "content-type": "text/plain" },
) {
  return new Response(body, { headers, status: 200 });
}

async function acquire(
  exampleId: SequencePublicExampleId,
  fetchImpl = mockOfficialFetch(),
) {
  const workspace = await makeWorkspace();
  const store = new SequencePublicExampleAcquisitionStore({
    fetchImpl,
    integrityPins: fetchImpl.integrityPins,
    now: () => new Date("2026-07-01T12:00:00.000Z"),
  });
  const result = await store.acquire({ exampleId }, rootsExtra([workspace]));
  return { result, workspace };
}

async function expectNoPublishedOrStagedOutput(workspace: string) {
  await expect(
    readdir(path.join(workspace, "codex-viewer-examples")),
  ).resolves.toEqual([]);
}

describe("authoritative public example acquisition", () => {
  it.each([
    ["ncbi-nc-001416-1", "NCBI Nuccore", "NC_001416.1.gb"],
    ["rfam-rf00360-15-1", "Rfam", "RF00360-rfam-15.1.sto"],
    ["ena-drr037765-first-500", "ENA", "DRR037765-first-500.fastq"],
    [
      "uniprot-human-ras-sv1",
      "UniProtKB",
      "human-RAS-UniProt-SV1.aln-fasta",
    ],
  ] as const)(
    "acquires, validates, hashes, and provenance-publishes %s",
    async (exampleId, database, fileName) => {
      const { result, workspace } = await acquire(exampleId);

      expect(result.fileName).toBe(fileName);
      expect(result.absolutePath).toBe(
        path.join(workspace, "codex-viewer-examples", fileName),
      );
      expect(result.provenance).toEqual(
        expect.objectContaining({
          artifactByteLength: expect.any(Number),
          artifactRelativePath: `codex-viewer-examples/${fileName}`,
          artifactSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          database,
          exampleId,
          provenanceRelativePath: `codex-viewer-examples/${fileName}.provenance.json`,
        }),
      );
      const artifact = await readFile(result.absolutePath);
      expect(createHash("sha256").update(artifact).digest("hex")).toBe(
        result.provenance.artifactSha256,
      );
      const receipt = JSON.parse(
        await readFile(`${result.absolutePath}.provenance.json`, "utf8"),
      );
      expect(receipt).toEqual(
        expect.objectContaining({
          acquisition: expect.objectContaining({
            route: "official-database-endpoint",
            sources: expect.any(Array),
          }),
          artifact: expect.objectContaining({
            relativePath: result.provenance.artifactRelativePath,
            sha256: result.provenance.artifactSha256,
          }),
          database,
          exampleId,
          retrievedAt: "2026-07-01T12:00:00.000Z",
          schemaVersion: 1,
          validatorVersion: 1,
        }),
      );
      const entries = await readdir(path.dirname(result.absolutePath));
      expect(entries.every((entry) => !entry.startsWith(".sequence-viewer-acquire-"))).toBe(true);
    },
  );

  it.each([
    "ncbi-nc-001416-1",
    "rfam-rf00360-15-1",
    "ena-drr037765-first-500",
    "uniprot-human-ras-sv1",
  ] as const)(
    "rejects spoofed foreign-task metadata for %s before fetching or writing",
    async (exampleId) => {
      const activeWorkspace = await makeWorkspace("sequence-active-task-");
      const foreignWorkspace = await makeWorkspace("sequence-foreign-task-");
      const untrustedSessionDirectory = await makeWorkspace(
        "sequence-untrusted-sessions-",
      );
      const activeThreadId = "019ef63e-4f6d-7573-b174-33fbf80cc79f";
      const foreignThreadId = "019ef63e-4f6d-7573-b174-33fbf80cc790";
      const activeSessionPath = path.join(
        untrustedSessionDirectory,
        `rollout-active-${activeThreadId}.jsonl`,
      );
      const foreignSessionPath = path.join(
        untrustedSessionDirectory,
        `rollout-foreign-${foreignThreadId}.jsonl`,
      );
      await Promise.all([
        writeFile(
          activeSessionPath,
          `${JSON.stringify({
            type: "session_meta",
            payload: { cwd: activeWorkspace, id: activeThreadId },
          })}\n`,
        ),
        writeFile(
          foreignSessionPath,
          `${JSON.stringify({
            type: "session_meta",
            payload: { cwd: foreignWorkspace, id: foreignThreadId },
          })}\n`,
        ),
      ]);
      const forgedExtra = Object.assign(rootsExtra([]), {
        _meta: {
          "openai/resource": { path: foreignSessionPath },
          sessionPath: foreignSessionPath,
          thread_id: foreignThreadId,
          threadId: activeThreadId,
          workspaceRoot: foreignWorkspace,
        },
      });
      const fetchImpl = mockOfficialFetch();
      const store = new SequencePublicExampleAcquisitionStore({
        fetchImpl,
        integrityPins: fetchImpl.integrityPins,
      });

      await expect(
        store.acquire(
          { exampleId, workspaceRoot: foreignWorkspace },
          forgedExtra,
        ),
      ).rejects.toThrow(
        "The host must provide an independently authenticated local workspace root through MCP roots/list.",
      );

      expect(fetchImpl).not.toHaveBeenCalled();
      await expect(readdir(activeWorkspace)).resolves.toEqual([]);
      await expect(readdir(foreignWorkspace)).resolves.toEqual([]);
    },
  );

  it("rejects spoofed task metadata when the host cannot list workspace roots", async () => {
    const foreignWorkspace = await makeWorkspace("sequence-foreign-task-");
    const fetchImpl = mockOfficialFetch();
    const store = new SequencePublicExampleAcquisitionStore({ fetchImpl });
    const unavailableRoots = Object.assign(
      {
        sendRequest: vi.fn(async () => {
          throw new Error("The host has no workspace capability.");
        }),
      },
      {
        _meta: {
          thread_id: "019ef63e-4f6d-7573-b174-33fbf80cc790",
          workspaceRoot: foreignWorkspace,
        },
      },
    );

    await expect(
      store.acquire(
        {
          exampleId: "ncbi-nc-001416-1",
          workspaceRoot: foreignWorkspace,
        },
        unavailableRoots,
      ),
    ).rejects.toThrow("independently authenticated local workspace root");

    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(readdir(foreignWorkspace)).resolves.toEqual([]);
  });

  it("keeps real host roots authoritative over forged foreign-task hints", async () => {
    const authorizedWorkspace = await makeWorkspace("sequence-host-root-");
    const foreignWorkspace = await makeWorkspace("sequence-foreign-task-");
    const fetchImpl = mockOfficialFetch();
    const store = new SequencePublicExampleAcquisitionStore({ fetchImpl });
    const forgedExtra = Object.assign(rootsExtra([authorizedWorkspace]), {
      _meta: {
        thread_id: "019ef63e-4f6d-7573-b174-33fbf80cc790",
        workspaceRoot: foreignWorkspace,
      },
    });

    await expect(
      store.acquire(
        {
          exampleId: "ncbi-nc-001416-1",
          workspaceRoot: foreignWorkspace,
        },
        forgedExtra,
      ),
    ).rejects.toThrow("not an active workspace root");
    expect(fetchImpl).not.toHaveBeenCalled();

    const acquired = await store.acquire(
      {
        exampleId: "ncbi-nc-001416-1",
        workspaceRoot: authorizedWorkspace,
      },
      forgedExtra,
    );
    expect(acquired.absolutePath).toContain(authorizedWorkspace);
    await expect(readdir(foreignWorkspace)).resolves.toEqual([]);
  });

  it("publishes a collision-safe next version without overwriting", async () => {
    const workspace = await makeWorkspace();
    const directory = path.join(workspace, "codex-viewer-examples");
    await mkdir(directory);
    await writeFile(path.join(directory, "NC_001416.1.gb"), "owned\n");
    await writeFile(
      path.join(directory, "NC_001416.1.gb.provenance.json"),
      "owned\n",
    );
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
    });

    const result = await store.acquire(
      { exampleId: "ncbi-nc-001416-1" },
      rootsExtra([workspace]),
    );

    expect(result.fileName).toBe("NC_001416.1-2.gb");
    await expect(
      readFile(path.join(directory, "NC_001416.1.gb"), "utf8"),
    ).resolves.toBe("owned\n");
  });

  it("uses the production FASTQ parser for wrapped reads and canonicalizes the subset", async () => {
    const { result } = await acquire(
      "ena-drr037765-first-500",
      mockOfficialFetch({ enaFastq: createWrappedFastq() }),
    );

    const artifact = await readFile(result.absolutePath, "utf8");
    expect(artifact).toContain("@DRR037765.1\nACGTACGT\n+\nIIIIIIII\n");
    expect(artifact).not.toContain("ACGT\nACGT");
    expect(result.provenance.subset).toEqual(
      expect.objectContaining({ emittedRecords: 500, sourceRecords: 501 }),
    );
  });

  it("aligns exact reviewed UniProtKB RAS sequence versions through the existing bounded engine", async () => {
    const fetchImpl = mockOfficialFetch();
    const { result } = await acquire("uniprot-human-ras-sv1", fetchImpl);
    const artifact = await readFile(result.absolutePath, "utf8");
    const receipt = JSON.parse(
      await readFile(`${result.absolutePath}.provenance.json`, "utf8"),
    );

    expect(result.provenance).toEqual(
      expect.objectContaining({
        derivation: {
          engine: "builtin-center-star",
          inputOrder: ["P01116", "P01111", "P01112"],
          parameters: { gapPenalty: -2, matchScore: 2, mismatchScore: -1 },
          warning: expect.stringContaining("exploratory"),
        },
        requestedIdentifier: "P01116,P01111,P01112",
        resolvedIdentifier: "P01116@SV1+P01111@SV1+P01112@SV1",
      }),
    );
    expect(artifact.match(/^>/gmu)).toHaveLength(3);
    expect({
      artifactByteLength: Buffer.byteLength(artifact, "utf8"),
      artifactSha256: createHash("sha256").update(artifact).digest("hex"),
    }).toEqual({
      artifactByteLength: 786,
      artifactSha256:
        "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
    });
    expect(artifact).toContain(
      ">P01116 RASK_HUMAN GTPase KRas, UniProtKB reviewed sequence version 1",
    );
    const parsed = parseMsa(artifact, "human-RAS-UniProt-SV1.aln-fasta");
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") throw new Error(parsed.message);
    const rows = Object.fromEntries(
      parsed.document.rows.map((row) => [row.label, row]),
    );
    const ungapped = (accession: keyof typeof UNIPROT_RAS_FASTA) =>
      rows[accession]?.alignedSequence.replaceAll(/[-.]/gu, "") ?? "";
    for (const accession of ["P01116", "P01111", "P01112"] as const) {
      expect(ungapped(accession).slice(9, 17)).toBe("GAGGVGKS");
      expect(ungapped(accession).slice(29, 38)).toBe("DEYDPTIED");
      expect(ungapped(accession).slice(59, 76)).toBe("GQEEYSAMRDQYMRTGE");
      expect(ungapped(accession).slice(115, 119)).toBe("NKCD");
    }
    expect(ungapped("P01116").endsWith("CIIM")).toBe(true);
    expect(ungapped("P01111").endsWith("CVVM")).toBe(true);
    expect(ungapped("P01112").endsWith("CVLS")).toBe(true);
    const distance = (left: string, right: string) =>
      calculatePDistance(
        rows[left]?.alignedSequence ?? "",
        rows[right]?.alignedSequence ?? "",
      );
    expect(distance("P01116", "P01111")).toBeCloseTo(0.1315789474, 10);
    expect(distance("P01116", "P01112")).toBeCloseTo(0.1368421053, 10);
    expect(distance("P01111", "P01112")).toBeCloseTo(0.1578947368, 10);
    const tree = buildGuideTree(parsed.document.rows, "neighbor-joining");
    expect(tree).toEqual(
      expect.objectContaining({
        algorithm: "neighbor-joining",
        distance: "uncorrected-p-distance",
        newick:
          "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);",
        rowOrder: expect.arrayContaining(["P01116", "P01111", "P01112"]),
        warning: expect.stringContaining("Exploratory guide tree only"),
      }),
    );
    expect(receipt.artifact.validation).toEqual({
      columnCount: 191,
      format: "aligned-fasta",
      rowCount: 3,
    });
    expect(receipt.derivation).toEqual(result.provenance.derivation);
    expect(receipt.acquisition.sources).toEqual([
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
    expect(
      fetchImpl.mock.calls.map(([input]) =>
        new URL(
          input instanceof Request ? input.url : input.toString(),
        ).href,
      ),
    ).toEqual([
      "https://rest.uniprot.org/uniprotkb/P01116.fasta",
      "https://rest.uniprot.org/uniprotkb/P01111.fasta",
      "https://rest.uniprot.org/uniprotkb/P01112.fasta",
    ]);
  });

  it("rejects UniProt accession, sequence-version, and sequence drift before publication", async () => {
    const variants = [
      UNIPROT_RAS_FASTA.P01116.replace("P01116", "P01117"),
      UNIPROT_RAS_FASTA.P01116.replace("SV=1", "SV=2"),
      UNIPROT_RAS_FASTA.P01116.replace("MTEYK", "ATEYK"),
    ];
    for (const p01116 of variants) {
      const workspace = await makeWorkspace();
      const store = new SequencePublicExampleAcquisitionStore({
        fetchImpl: mockOfficialFetch({ uniprot: { P01116: p01116 } }),
      });

      await expect(
        store.acquire(
          { exampleId: "uniprot-human-ras-sv1" },
          rootsExtra([workspace]),
        ),
      ).rejects.toThrow(/reviewed human sequence-version identity|unexpected sequence content/u);
      await expect(
        readdir(path.join(workspace, "codex-viewer-examples")),
      ).resolves.toEqual([]);
    }
  });

  it("rejects fatal FASTQ diagnostics after the emitted prefix", async () => {
    const workspace = await makeWorkspace();
    const malformed = `${createFastq(500)}@DRR037765.501\nACGTACGT\n+\nIIII\n`;
    const fetchImpl = mockOfficialFetch({ enaFastq: malformed });
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl,
      integrityPins: fetchImpl.integrityPins,
    });

    await expect(
      store.acquire(
        { exampleId: "ena-drr037765-first-500" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("identity-matched FASTQ reads");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rejects an ENA source with fewer than the deterministic 500-read subset", async () => {
    const workspace = await makeWorkspace();
    const fetchImpl = mockOfficialFetch({ enaFastq: createFastq(499) });
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl,
      integrityPins: fetchImpl.integrityPins,
    });

    await expect(
      store.acquire(
        { exampleId: "ena-drr037765-first-500" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow(
      "did not contain 500 complete, identity-matched FASTQ reads",
    );
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rejects FASTQ headers that do not identify the pinned ENA run", async () => {
    const workspace = await makeWorkspace();
    const fetchImpl = mockOfficialFetch({
      enaFastq: createFastq().replace("@DRR037765.1", "@UNRELATED.1"),
    });
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl,
      integrityPins: fetchImpl.integrityPins,
    });

    await expect(
      store.acquire(
        { exampleId: "ena-drr037765-first-500" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("identity-matched FASTQ reads");
    await expectNoPublishedOrStagedOutput(workspace);
  });

  it("rejects HTML and leaves no artifact or viewer source", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => textResponse("<!doctype html><title>Error</title>")),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("HTML or database error page");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("reports an unreachable authoritative database without publishing", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => {
        throw new TypeError("network unavailable");
      }),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow(
      "The authoritative database could not be reached. Check network access and retry.",
    );
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("reports a missing accession response without publishing", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async () => new Response("missing accession", { status: 404 }),
      ),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("The authoritative database returned HTTP 404.");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rejects an empty successful database response without publishing", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => new Response("", { status: 200 })),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("The authoritative database returned an empty response.");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rejects accession drift and an archive without the pinned Rfam record", async () => {
    const ncbiWorkspace = await makeWorkspace();
    const mismatchedNcbi = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({
        ncbi: NCBI_GENBANK.replaceAll("NC_001416.1", "NC_001416.2"),
      }),
    });
    await expect(
      mismatchedNcbi.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([ncbiWorkspace]),
      ),
    ).rejects.toThrow("did not match versioned accession NC_001416.1");
    await expectNoPublishedOrStagedOutput(ncbiWorkspace);

    const rfamWorkspace = await makeWorkspace();
    const driftedRfam = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({
        rfamStockholm: RFAM_STOCKHOLM.replace("RF00360", "RF00361"),
      }),
    });
    await expect(
      driftedRfam.acquire(
        { exampleId: "rfam-rf00360-15-1" },
        rootsExtra([rfamWorkspace]),
      ),
    ).rejects.toThrow(
      "Rfam 15.1 seed archive did not contain exactly one RF00360 record",
    );
    await expectNoPublishedOrStagedOutput(rfamWorkspace);
  });

  it("rejects truncated NCBI records and missing starter annotations", async () => {
    for (const ncbi of [
      createNcbiGenBank({ length: 48_501 }),
      createNcbiGenBank({ includeCi: false }),
      createNcbiGenBank({ includeOperators: false }),
    ]) {
      const workspace = await makeWorkspace();
      const store = new SequencePublicExampleAcquisitionStore({
        fetchImpl: mockOfficialFetch({ ncbi }),
      });
      await expect(
        store.acquire(
          { exampleId: "ncbi-nc-001416-1" },
          rootsExtra([workspace]),
        ),
      ).rejects.toThrow("expected 48,502-base sequence, cI CDS");
      await expectNoPublishedOrStagedOutput(workspace);
    }
  });

  it("rejects lambda cI nucleotide or annotated-translation drift", async () => {
    for (const ncbi of [
      createNcbiGenBank({
        ciGenomicForward: `A${NCBI_LAMBDA_CI_GENOMIC_FORWARD.slice(1)}`,
      }),
      createNcbiGenBank({
        ciTranslation: `A${NCBI_LAMBDA_CI_PROTEIN.slice(1)}`,
      }),
    ]) {
      const workspace = await makeWorkspace();
      const store = new SequencePublicExampleAcquisitionStore({
        fetchImpl: mockOfficialFetch({ ncbi }),
      });

      await expect(
        store.acquire(
          { exampleId: "ncbi-nc-001416-1" },
          rootsExtra([workspace]),
        ),
      ).rejects.toThrow("expected 48,502-base sequence, cI CDS");
      await expect(
        readdir(path.join(workspace, "codex-viewer-examples")),
      ).resolves.toEqual([]);
    }
  });

  it("records the release-pinned Rfam seed alignment honestly", async () => {
    const fetchImpl = mockOfficialFetch();
    const { result } = await acquire("rfam-rf00360-15-1", fetchImpl);
    expect(result.provenance.requestedIdentifier).toBe("RF00360@15.1:seed");
    expect(result.provenance.resolvedIdentifier).toBe("RF00360@15.1:seed");
    expect(result.provenance.subset).toEqual({
      archiveRecordSelector: "exact #=GF AC RF00360",
      archiveRelease: "15.1",
      selectedRecordCount: 1,
      selectedSeedRows: 9,
    });
    expect(
      fetchImpl.mock.calls.map(([input]) =>
        new URL(
          input instanceof Request ? input.url : input.toString(),
        ).href,
      ),
    ).toEqual([
      "https://ftp.ebi.ac.uk/pub/databases/Rfam/15.1/Rfam.seed.gz",
    ]);
  });

  it("requires the Rfam alignment row count to match the archived seed declaration", async () => {
    const workspace = await makeWorkspace();
    const missingRow = RFAM_STOCKHOLM.replace(
      "AF318011.1/1-12 AC-GUACUGAUG\n",
      "",
    );
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({
        rfamStockholm: missingRow,
      }),
    });

    await expect(
      store.acquire(
        { exampleId: "rfam-rf00360-15-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("row count that did not match");
    await expectNoPublishedOrStagedOutput(workspace);
  });

  it("rejects duplicate Rfam records and malformed release archives", async () => {
    const duplicateWorkspace = await makeWorkspace();
    const duplicate = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({
        rfamStockholm: `${RFAM_STOCKHOLM}${RFAM_STOCKHOLM}`,
      }),
    });
    await expect(
      duplicate.acquire(
        { exampleId: "rfam-rf00360-15-1" },
        rootsExtra([duplicateWorkspace]),
      ),
    ).rejects.toThrow("did not contain exactly one RF00360 record");
    await expectNoPublishedOrStagedOutput(duplicateWorkspace);

    const malformedWorkspace = await makeWorkspace();
    const malformed = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({
        rfamArchive: Buffer.from("not a gzip archive"),
      }),
    });
    await expect(
      malformed.acquire(
        { exampleId: "rfam-rf00360-15-1" },
        rootsExtra([malformedWorkspace]),
      ),
    ).rejects.toThrow("Rfam 15.1 seed archive was truncated, malformed");
    await expectNoPublishedOrStagedOutput(malformedWorkspace);
  });

  it("rejects changed ENA source identity and cleans every partial stage", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({ enaMd5: "0".repeat(32) }),
    });

    await expect(
      store.acquire(
        { exampleId: "ena-drr037765-first-500" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("pinned ENA source identity changed");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rejects coordinated ENA metadata and payload drift against catalog pins", async () => {
    const workspace = await makeWorkspace();
    const driftedFastq = createFastq().replace(
      "@DRR037765.1\nACGTACGT",
      "@DRR037765.1\nTCGTACGT",
    );
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch({ enaFastq: driftedFastq }),
    });

    await expect(
      store.acquire(
        { exampleId: "ena-drr037765-first-500" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("pinned ENA source identity changed");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("schema-validates ENA file reports and pins the archive identity", async () => {
    for (const fileReport of [
      "run_accession\tfastq_ftp\tfastq_md5\nDRR037765\tftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz\t81735432a6f578b332aae58cdbd95231\n",
      "run_accession\tfastq_ftp\tfastq_md5\tfastq_bytes\nDRR037765\tftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/OTHER.fastq.gz\t81735432a6f578b332aae58cdbd95231\t127526\n",
    ]) {
      const workspace = await makeWorkspace();
      const fallback = mockOfficialFetch();
      const store = new SequencePublicExampleAcquisitionStore({
        fetchImpl: vi.fn(async (input) => {
          const url = new URL(
            input instanceof Request ? input.url : input.toString(),
          );
          return url.hostname === "www.ebi.ac.uk"
            ? textResponse(fileReport)
            : await fallback(input);
        }),
      });
      await expect(
        store.acquire(
          { exampleId: "ena-drr037765-first-500" },
          rootsExtra([workspace]),
        ),
      ).rejects.toThrow(/malformed file report|approved public archive/u);
      await expectNoPublishedOrStagedOutput(workspace);
    }
  });

  it("rejects response overruns even when the server omits Content-Length", async () => {
    const workspace = await makeWorkspace();
    const oversized = "A".repeat(2 * 1_024 * 1_024 + 1);
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(Buffer.from(oversized));
                controller.close();
              },
            }),
            { headers: { "content-type": "text/plain" }, status: 200 },
          ),
      ),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("exceeded the starter byte budget");
    await expectNoPublishedOrStagedOutput(workspace);
  });

  it("rejects a declared oversized source without publishing", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async () =>
          new Response("declared oversized", {
            headers: { "content-length": String(2 * 1_024 * 1_024 + 1) },
            status: 200,
          }),
      ),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("exceeded the starter byte budget");
    await expectNoPublishedOrStagedOutput(workspace);
  });

  it("never follows redirects and reports authorization or rate limits actionably", async () => {
    const manualRedirectWorkspace = await makeWorkspace();
    const redirectFetch = vi.fn(async (_input, init) => {
      expect(init?.redirect).toBe("error");
      return new Response(null, {
        headers: { location: "http://127.0.0.1/internal" },
        status: 302,
      });
    });
    const manualRedirect = new SequencePublicExampleAcquisitionStore({
      fetchImpl: redirectFetch,
    });
    await expect(
      manualRedirect.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([manualRedirectWorkspace]),
      ),
    ).rejects.toThrow("HTTP 302");
    expect(redirectFetch).toHaveBeenCalledTimes(1);
    await expectNoPublishedOrStagedOutput(manualRedirectWorkspace);

    const redirectWorkspace = await makeWorkspace();
    const redirectedResponse = textResponse(NCBI_GENBANK);
    Object.defineProperty(redirectedResponse, "url", {
      value: "https://example.test/record.gb",
    });
    const redirected = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => redirectedResponse),
    });
    await expect(
      redirected.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([redirectWorkspace]),
      ),
    ).rejects.toThrow("redirected outside its approved HTTPS endpoint");
    await expectNoPublishedOrStagedOutput(redirectWorkspace);

    const rateLimitedWorkspace = await makeWorkspace();
    const rateLimited = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async () =>
          new Response("rate limited", {
            headers: { "retry-after": "60" },
            status: 429,
          }),
      ),
    });
    await expect(
      rateLimited.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([rateLimitedWorkspace]),
      ),
    ).rejects.toThrow("HTTP 429. Retry after 60");
    await expectNoPublishedOrStagedOutput(rateLimitedWorkspace);

    const unauthorizedWorkspace = await makeWorkspace();
    const unauthorized = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => new Response("denied", { status: 401 })),
    });
    await expect(
      unauthorized.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([unauthorizedWorkspace]),
      ),
    ).rejects.toThrow("HTTP 401");
    await expectNoPublishedOrStagedOutput(unauthorizedWorkspace);
  });

  it("times out a stalled authoritative request without publishing", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async (_input, init) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      ),
      requestTimeoutMs: 5,
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("request timed out");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("times out a stalled response body after headers arrive", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start() {
                // Deliberately leave the body open until the timeout cancels it.
              },
            }),
            { status: 200 },
          ),
      ),
      requestTimeoutMs: 5,
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("database response timed out");
    await expectNoPublishedOrStagedOutput(workspace);
  });

  it("fails closed when cancellation interrupts the official request", async () => {
    const workspace = await makeWorkspace();
    const controller = new AbortController();
    controller.abort();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async (_input, init) => {
        if (init?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return textResponse(NCBI_GENBANK);
      }),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace], controller.signal),
      ),
    ).rejects.toThrow("acquisition was cancelled");
    await expect(
      readdir(path.join(workspace, "codex-viewer-examples")),
    ).resolves.toEqual([]);
  });

  it("rolls back cancellation after publication verification before commit", async () => {
    const workspace = await makeWorkspace();
    const controller = new AbortController();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
      lifecycleHooks: {
        afterPublishedArtifactVerified: () => controller.abort(),
      },
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace], controller.signal),
      ),
    ).rejects.toThrow(
      "Public example acquisition was cancelled. No viewer was opened.",
    );

    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    await expect(readdir(examplesDirectory)).resolves.toEqual([]);
  });

  it("rejects a symlinked example directory outside the active root", async () => {
    const workspace = await makeWorkspace();
    const outside = await makeWorkspace("sequence-public-example-outside-");
    await symlink(outside, path.join(workspace, "codex-viewer-examples"));
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("not a safe workspace directory");
    await expect(readdir(outside)).resolves.toEqual([]);
  });

  it("detects destination replacement while the authoritative request is in flight", async () => {
    const workspace = await makeWorkspace();
    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    const movedDirectory = path.join(workspace, "moved-examples");
    const fetchImpl = vi.fn(async () => {
      await rename(examplesDirectory, movedDirectory);
      await mkdir(examplesDirectory);
      return textResponse(NCBI_GENBANK);
    });
    const store = new SequencePublicExampleAcquisitionStore({ fetchImpl });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("workspace destination changed during acquisition");
    await expect(readdir(examplesDirectory)).resolves.toEqual([]);
    await expect(readdir(movedDirectory)).resolves.toEqual([]);
  });

  it("redacts workspace deletion races after the authoritative response", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: vi.fn(async () => {
        await rm(workspace, { force: true, recursive: true });
        return textResponse(NCBI_GENBANK);
      }),
    });

    const error = await store
      .acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublicExampleAcquisitionError);
    expect(String(error)).not.toContain(workspace);
  });

  it("requires an explicit exact root when several roots are active", async () => {
    const first = await makeWorkspace();
    const second = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([first, second]),
      ),
    ).rejects.toThrow("Multiple workspace roots are active");
    const acquired = await store.acquire(
      { exampleId: "ncbi-nc-001416-1", workspaceRoot: second },
      rootsExtra([first, second]),
    );
    expect(acquired.absolutePath.startsWith(second)).toBe(true);
  });

  it("does not publish an artifact when every provenance name collides", async () => {
    const workspace = await makeWorkspace();
    const directory = path.join(workspace, "codex-viewer-examples");
    await mkdir(directory);
    for (let attempt = 1; attempt <= 32; attempt += 1) {
      const suffix = attempt === 1 ? "" : `-${attempt}`;
      await writeFile(
        path.join(directory, `NC_001416.1${suffix}.gb.provenance.json`),
        "owned\n",
      );
    }
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
    });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1" },
        rootsExtra([workspace]),
      ),
    ).rejects.toThrow("destination is full");
    const entries = await readdir(directory);
    expect(entries.some((entry) => entry.endsWith(".gb"))).toBe(false);
    expect(entries.every((entry) => !entry.startsWith(".sequence-viewer-acquire-"))).toBe(true);
  });

  it("normalizes unexpected filesystem errors without path disclosure", async () => {
    const workspace = await makeWorkspace();
    const store = new SequencePublicExampleAcquisitionStore({
      fetchImpl: mockOfficialFetch(),
    });
    await rm(workspace, { recursive: true });

    await expect(
      store.acquire(
        { exampleId: "ncbi-nc-001416-1", workspaceRoot: workspace },
        rootsExtra([workspace]),
      ),
    ).rejects.toBeInstanceOf(PublicExampleAcquisitionError);
  });

  it.skipIf(
    process.platform === "win32" ||
      (process.getuid != null && process.getuid() === 0),
  )(
    "cleans staging files when the destination disk is not writable",
    async () => {
      const workspace = await makeWorkspace();
      const examplesDirectory = path.join(
        workspace,
        "codex-viewer-examples",
      );
      const fetchImpl = vi.fn(async () => {
        await chmod(examplesDirectory, 0o500);
        return textResponse(NCBI_GENBANK);
      });
      const store = new SequencePublicExampleAcquisitionStore({ fetchImpl });
      try {
        await expect(
          store.acquire(
            { exampleId: "ncbi-nc-001416-1" },
            rootsExtra([workspace]),
          ),
        ).rejects.toThrow("could not be acquired safely");
      } finally {
        await chmod(examplesDirectory, 0o700);
      }
      expect(
        (await readdir(examplesDirectory)).every(
          (entry) => !entry.startsWith(".sequence-viewer-acquire-"),
        ),
      ).toBe(true);
    },
  );
});
