import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS } from "./file-kind";
import {
  SEQUENCE_VIEWER_CHAT_FILE_META_KEY,
  SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI,
  SEQUENCE_VIEWER_CHAT_TOOL_NAME,
  SEQUENCE_VIEWER_RESOURCE_URI,
  SEQUENCE_VIEWER_TOOL_NAME,
  createSequenceOpenFromChatToolResult,
  createSequenceOpenToolResult,
  createSequenceViewerServer,
  createSequenceViewerCsp,
  createSequenceViewerHtml,
  sequenceOpenFromChatToolInputSchema,
  sequenceOpenToolInputSchema,
} from "./server";
import {
  SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
  type SequencePublicExampleAcquirer,
} from "./public-example-acquisition";
import { SEQUENCE_VIEWER_VERSION } from "./version";
import {
  SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
  SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
  SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
  SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
} from "./scientific-platform-protocol";
import {
  SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
  SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
  SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
  queuedSequenceViewerCommandSchema,
  type SequenceViewerControlCommand,
} from "./viewer-commands";
import {
  SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
  SEQUENCE_VIEWER_QUERY_TOOL_NAME,
  type SequenceViewerQueryRequest,
} from "./viewer-operations";
import {
  SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
  SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
  SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
} from "./workbench-persistence-protocol";
import {
  SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
  SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
} from "./workspace-browser-protocol";
import {
  SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
  SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
  SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
} from "./workspace-track-protocol";
import {
  SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
  SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
} from "./workspace-session-protocol";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";
import { alignSequences, exportAlignedFasta } from "./msa/alignment-editing";
import { parseMsa } from "./msa/parser";
import { buildGuideTree } from "./msa/phylogenetic-tree";
import { parseSequenceDocumentResult } from "./sequence/parser";
import { parseSequenceTrack } from "./sequence/tracks";

const INDEXED_BAM_FIXTURE =
  "H4sIBAAAAAAA/wYAQkMCAFgAc3L0ZdRiYGBw8HDhDPOzMtQz4wz2t0rOzy9KycxLLEnlcggO5Az2sypKTeP08bMyMeViBKpmAWKgCIMukAYA2DSCpUIAAAAfiwgEAAAAAAD/BgBCQwIAAQELZoAANiBmlfMUYmVIZhCEiqkAsToQFxkYGDI0ABmKQOwAxEJAbADEHSISgiKOjRoO/9GBH9QIDrixDAx8QAyTZ4AYa8RgAmQkALEYEAtCjRcUdGwEGotqYiiaiUxAmhvTRGOGEKiJThqCTo0CSCYEO0YVpabpGFnq6OqYeZj66hia6xhYMzhBDeaHGsyM3WATsKGPgTgAiCVENJpEFJAM94aaIgMyRRDkPAEOVmzOS4Wa0OiigOwqSx1tHdNgM18dYwMdQ2sGa6QoADmKkWEyAydSVN0E6gRHywRQtDi5KDYggt7XmREAnlXuT9YBAAAfiwgEAAAAAAD/BgBCQwIAGwADAAAAAAAAAAAA";
const INDEXED_BAI_FIXTURE =
  "QkFJAQEAAAACAAAASRIAAAEAAAAAAFkAAAAAAAAAWwEAAAAASpIAAAIAAAAAAFkAAAAAAAAAWwEAAAAABgAAAAAAAAAAAAAAAAAAAAEAAAAAAFkAAAAAAAAAAAAAAAAA";

// Genuine public records are embedded so rootless MCP regressions never depend
// on ignored local corpora, public-network access, or fabricated source bytes.
const PUBLIC_ARCHIVE_FASTQ = `@SRR014849.50939 EIXKN4201BA2EC length=135
GAAATTTCAGGGCCACCTTTTTTTTGATAGAATAATGGAGAAAATTAAAAGCTGTACATATACCAATGAACAATAAATCAATACATAAAAAAGGAGAAGTTGGAACCGAAAGGGTTTGAATTCAAACCCTTTCGG
+
;C?-EA/=<EA/B;<B;D>60,)%"<=:5<
@8<B;=B;<;EA4'@8FB6*<:=<<===<=
;=B:A9<<B;=B;=EA0:<B:<<=<<FA81
+$?6;<A9=<3>5@7@8<A<(B=*A=)<<2
?57B=*B=*D?-:=4
@SRR014849.110027 EIXKN4201APUB0 length=131
CTTCAAATGATTCCGGGACTGTTGGAACCGAAAGGGTTTGAATTCAAACCCTTTTCGGTTCCAACTCGCCGTCCGAATAATCCGTTCAAAATCTTGGCCTGTCAAAACGACTTTACGACCAGAACGATCCG
+
=B::@<':=5A9?7EA0:=<<?6@7<3?5<
@;%D?-B=)::0=4<D?-EA/D@2";B;B:
B:A9;;=<B;;<B;<B;<B;:A;<A;8FB7
+=<B;B:A9<1:=FB6(<=<<EA0956;<2
==A8===:@8=
@SRR014849.203935 EIXKN4201B4HU6 length=144
AACCCGTCCCATCAAAGATTTTGGTTGGAACCCGAAAGGGTTTTGAATTCAAACCCCTTTCGGTTCCAACTATTCAATTGTTTAACTTTTTTTAAATTGATGGTCTGTTGGACCATTTGTAATAATCCCCATCGGAATTTCTTT
+
A;@;%75?:#<<9EA1;=EA3%B;B;A;B;
@;%9EA1EA1EA3%<B;A;8EA0D@3$EA1
=B;A;B;B;:=:B;:B:A9:EA0A9<FA81
+&"D?-B;4<::/<;=:A98-5?6=C>+8<
<3;=4:DA3%<;=8-9.A=):B=*
`;

// First complete X55053.1 record from Biopython's cor6_6.gb public fixture.
// Restore its insignificant trailing ORIGIN padding to preserve exact bytes.
const PUBLIC_NCBI_GENBANK =
  `LOCUS       ATCOR66M      513 bp    mRNA            PLN       02-MAR-1992
DEFINITION  A.thaliana cor6.6 mRNA.
ACCESSION   X55053
VERSION     X55053.1  GI:16229
KEYWORDS    antifreeze protein homology; cold-regulated gene; cor6.6 gene; KIN1
            homology.
SOURCE      thale cress.
  ORGANISM  Arabidopsis thaliana
            Eukaryota; Viridiplantae; Streptophyta; Embryophyta; Tracheophyta;
            euphyllophytes; Spermatophyta; Magnoliophyta; eudicotyledons;
            Rosidae; Capparales; Brassicaceae; Arabidopsis.
REFERENCE   1  (bases 1 to 513)
  AUTHORS   Thomashow,M.F.
  TITLE     Direct Submission
  JOURNAL   Submitted (01-FEB-1991) M.F. Thomashow, Dept. Crop and Soil
            Sciences, Dept. Microbiology, Michigan State University, East
            Lansing, Michigan 48824, USA
REFERENCE   2  (bases 1 to 513)
  AUTHORS   Gilmour,S.J., Artus,N.N. and Thomashow,M.F.
  TITLE     cDNA sequence analysis and expression of two cold-regulated genes
            of Arabidopsis thaliana
  JOURNAL   Plant Mol. Biol. 18 (1), 13-21 (1992)
  MEDLINE   92119220
COMMENT     Cor6.6 homologous to KIN1. KIN1 is a cold-regulated Arabidopsis
            gene with suggested similarity to type I fish antifreeze proteins.
FEATURES             Location/Qualifiers
     source          1..513
                     /organism="Arabidopsis thaliana"
                     /strain="Columbia"
                     /db_xref="taxon:3702"
     gene            50..250
                     /gene="cor6.6"
     CDS             50..250
                     /gene="cor6.6"
                     /note="cold regulated"
                     /codon_start=1
                     /protein_id="CAA38894.1"
                     /db_xref="GI:16230"
                     /db_xref="SWISS-PROT:P31169"
                     /translation="MSETNKNAFQAGQAAGKAEEKSNVLLDKAKDAAAAAGASAQQAG
                     KSISDAAVGGVNFVKDKTGLNK"
BASE COUNT      194 a     82 c    104 g    133 t
ORIGIN
        1 aacaaaacac acatcaaaaa cgattttaca agaaaaaaat atctgaaaaa tgtcagagac
       61 caacaagaat gccttccaag ccggtcaggc cgctggcaaa gctgaggaga agagcaatgt
      121 tctgctggac aaggccaagg atgctgctgc tgcagctgga gcttccgcgc aacaggcggg
      181 aaagagtata tcggatgcgg cagtgggagg tgttaacttc gtgaaggaca agaccggcct
      241 gaacaagtag cgatccgagt caactttggg agttataatt tcccttttct aattaattgt
      301 tgggattttc aaataaaatt tgggagtcat aattgattct cgtactcatc gtacttgttg
      361 ttgtttttag tgttgtaatg ttttaatgtt tcttctccct ttagatgtac tacgtttgga
      421 actttaagtt taatcaacaa aatctagttt aagttctaaa aaaaaaaaaa aaaaaaaaaa
      481 aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa aaa
//
`.replace("ORIGIN\n", "ORIGIN      \n");

// Rfam RF04178 seed, including the authentic metadata and secondary structure.
const PUBLIC_RFAM_STOCKHOLM = `# STOCKHOLM 1.0

#=GF AC   RF04178
#=GF ID   BTnc005
#=GF DE   Bacteroides sRNA BTnc005
#=GF AU   Prezza, G
#=GF AU   Ryan, D
#=GF AU   Mädler, G
#=GF AU   Barquist, L; 0000-0003-4732-2667
#=GF AU   Westermann, A
#=GF SE   Published; PMID:32678091;
#=GF SS   Published; PMID:32678091;
#=GF GA   174.80
#=GF TC   179.30
#=GF NC   174.30
#=GF TP   Gene; sRNA;
#=GF BM   cmbuild -F CM SEED
#=GF CB   cmcalibrate --mpi CM
#=GF SM   cmsearch --cpu 4 --verbose --nohmmonly -T 30.00 -Z 742849.287494 CM SEQDB
#=GF DR   SO; 0000655; ncRNA;
#=GF RN   [1]
#=GF RM   32678091
#=GF RT   A high-resolution transcriptome map identifies small RNA regulation of
#=GF RT   metabolism in the gut microbe Bacteroides thetaiotaomicron.
#=GF RA   Ryan D, Jenniches L, Reichardt S, Barquist L, Westermann AJ
#=GF RL   Nat Commun. 2020;11:3557.
#=GF CC   An uncharacterized small RNA discovered in Bacteroides thetaiotaomicron
#=GF CC   [1]
#=GF WK   Bacteroides_thetaiotaomicron_sRNA
#=GF SQ   3


AE015928.1/72774-72978     GUAAGUAAAAGUGUAACAGGAAGAAAGUUGCAGCAUAUAUGCGGUGAAUUAUGCGGUGUCAUAGGAAUUGAGGAUUUAUGUAAGAUGCUGAUAAUGAGUAAGGAACCUUAAAGUUAAUCGUUCCCUGUCUCUCCGCAGAACCUACUGGACAAAACAGGACAGUAAGUGGACAAAAACCUACAAAUCAGC-GAUUUGUAGGUUUUUU
CP000139.1/2819055-2819247 AAAAGUAAGAGUGUAACAGGAAGAAAGUUGCAGCAUAUACGCGGUGAAUUAUUCGGUGUCAUAGGAGUAGAGUCUUUUGGUAAGAUGCUGAUAAUGAGUAGGGGAGAUGAAAGUUAAUCGUUCCCUGUCUCUCCGCUGG---------AAAGAAUUGCAAAACAA--AGA-AAAUCCCUGUAAAUUAAU-ACUUUACGGGGAUUUU
FP929033.1/4930704-4930908 GUAAGUAAAAGUGUAACAGGAAGAAAGUUGCAGCAUAUAUGCGGUGAAUUAUGCGGUGUCAUAGGAAUUGAGGAUUUAUGUAAGAUGCUGAUAAUGAGUAAGGAACCUUAAAGUUAAUCGUUCCCUGUCUCUCCGCUGAACUAUCCGGACAAAACCGGGCAAUGAACAGUCAAA-UCCCACAAAUUCAAUGAUUUGUGGGACUUUU
#=GC SS_cons               :::::::::::<<<<<<_________>>>>>>,,,,,,,,((((,,,<<<<<-<<<<<<<----<<<_______>>>------>>>>>>>>>>>><<<<<-<<<<_______________>>>>->>->>>,))))---------------------------------------<<<<<<<<<<<____>>>>>>>>>>>:::::
#=GC RF                    guAAGUAAaAGuGuaaCAGGAAGAAAGuugCaGCAUAUAuGCGGUGAauuaugCgGuguCAUAGgaaUuGAGgauuuauGUAAGaugCuGauaauGaGuaaGGaaccUuAAAGUUAAUCGuuCCCugUCuCUCCGCuGaACuaaCuGGAcAaAAcuGgacAauaAauaGaCAAAacCCcgcaaaucaau.gauuugcgGGguUUUU
//
`.replace("#=GF TP   Gene; sRNA;\n", "#=GF TP   Gene; sRNA; \n");

const PUBLIC_UNIPROT_RAS_ROWS = [
  {
    accession: "P01116",
    description:
      "RASK_HUMAN GTPase KRas, UniProtKB reviewed sequence version 1",
    sequence:
      "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQRVEDAFYTLVREIRQYRLKKISKEEKTPGCVKIKKCIIM",
    sha256: "1d5a9ab11f64cb886d8ffa08a153c412b2d190fcf70e5690cd4b4c7efcdee53a",
  },
  {
    accession: "P01111",
    description:
      "RASN_HUMAN GTPase NRas, UniProtKB reviewed sequence version 1",
    sequence:
      "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNSKSFADINLYREQIKRVKDSDDVPMVLVGNKCDLPTRTVDTKQAHELAKSYGIPFIETSAKTRQGVEDAFYTLVREIRQYRMKKLNSSDDGTQGCMGLPCVVM",
    sha256: "89016168d82568aa2caa97166c99ff0b61c6fb19d5729272a7e3f03ab26ce518",
  },
  {
    accession: "P01112",
    description:
      "RASH_HUMAN GTPase HRas, UniProtKB reviewed sequence version 1",
    sequence:
      "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHQYREQIKRVKDSDDVPMVLVGNKCDLAARTVESRQAQDLARSYGIPYIETSAKTRQGVEDAFYTLVREIRQHKLRKLNPPDESGPGCMSCKCVLS",
    sha256: "d9360238882c010c8474ef1eba1d2532cd96e706c7d7f689ea2014f37f8f886c",
  },
] as const;

function publicUniProtRasAlignment(): string {
  for (const row of PUBLIC_UNIPROT_RAS_ROWS) {
    if (
      createHash("sha256").update(row.sequence, "ascii").digest("hex") !==
      row.sha256
    ) {
      throw new Error(
        `The reviewed UniProtKB ${row.accession}@SV1 sequence drifted.`,
      );
    }
  }
  return exportAlignedFasta(
    alignSequences(
      PUBLIC_UNIPROT_RAS_ROWS.map(({ accession, description, sequence }) => ({
        description,
        id: accession,
        label: accession,
        sequence,
        sourceId: accession,
      })),
      { gapPenalty: -2, matchScore: 2, mismatchScore: -1 },
      "builtin-center-star",
    ).rows,
  );
}

const CODEX_MANAGED_PUBLIC_EXAMPLES = [
  {
    contents: () => PUBLIC_ARCHIVE_FASTQ,
    database: "ENA/SRA",
    fileName: "SRR014849-first-3.fastq",
    format: "fastq",
    identifier: "SRR014849",
    sha256: "6f692d81aad84c258e0dc42c6ca8dcf7b7da694c177a3e948820dd1ffb6e017a",
    sourceUrl: "https://www.ebi.ac.uk/ena/browser/view/SRR014849",
  },
  {
    contents: () => PUBLIC_NCBI_GENBANK,
    database: "NCBI GenBank",
    fileName: "X55053.1.gb",
    format: "genbank",
    identifier: "X55053.1",
    sha256: "e807f6fc5c0373916d3e8eabf86e1da1d3a24a79efc156b34793fca55e73b307",
    sourceUrl: "https://www.ncbi.nlm.nih.gov/nuccore/X55053.1",
  },
  {
    contents: publicUniProtRasAlignment,
    database: "UniProtKB",
    fileName: "human-RAS-UniProt-SV1.aln-fasta",
    format: "aligned-fasta",
    identifier: "P01116@SV1,P01111@SV1,P01112@SV1",
    sha256: "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
    sourceUrl: "https://rest.uniprot.org/uniprotkb/P01116.fasta",
  },
  {
    contents: () => PUBLIC_RFAM_STOCKHOLM,
    database: "Rfam",
    fileName: "RF04178-seed.sto",
    format: "stockholm",
    identifier: "RF04178",
    sha256: "a77480898aab5cc85b2c3eb332b05242c77aef0b9e4a29f5177f7d54adf6c035",
    sourceUrl: "https://rfam.org/family/RF04178",
  },
] as const;

class TrackingWorkspacePublisher extends SequenceWorkspaceExportPublisher {
  readonly boundSessions = new Set<string>();
  readonly clearedSessions: string[] = [];
  bindCalls = 0;

  override async bindSession(
    ...args: Parameters<SequenceWorkspaceExportPublisher["bindSession"]>
  ): Promise<boolean> {
    this.bindCalls += 1;
    const bound = await super.bindSession(...args);
    if (bound) this.boundSessions.add(args[0]);
    return bound;
  }

  override clearSession(sessionId: string): void {
    super.clearSession(sessionId);
    this.boundSessions.delete(sessionId);
    this.clearedSessions.push(sessionId);
  }
}

describe("sequence viewer server", () => {
  it("registers one combined biological sequence surface for sequence and MSA formats", () => {
    expect(BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS).toContain("fasta");
    expect(BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS).toContain("aln");
    expect(BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS).toContain("sto");
    expect(BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS).toEqual(
      expect.arrayContaining(["ab1", "abi", "scf", "dna"]),
    );
  });

  it("publishes separate app-only preview and model-visible chat tools", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      expect(client.getServerVersion()).toEqual({
        name: "biological-sequence-viewer",
        version: SEQUENCE_VIEWER_VERSION,
      });
      const { tools } = await client.listTools();
      const previewTool = tools.find(
        ({ name }) => name === SEQUENCE_VIEWER_TOOL_NAME,
      );
      const hostFileViewerMetadata = z.strictObject({
        entrypoints: z.array(
          z.strictObject({
            extensions: z.array(z.string().trim().min(1)),
            type: z.literal("file"),
          }),
        ),
      });
      expect(
        hostFileViewerMetadata.parse(previewTool?._meta?.["openai/ui"]),
      ).toEqual({
        entrypoints: [
          {
            extensions: [...BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINT_EXTENSIONS],
            type: "file",
          },
        ],
      });
      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: SEQUENCE_VIEWER_TOOL_NAME,
            _meta: expect.objectContaining({
              ui: {
                resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
                visibility: ["app"],
              },
            }),
          }),
          expect.objectContaining({
            name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
            description: expect.stringContaining(
              "for same-turn follow-up actions",
            ),
            _meta: expect.objectContaining({
              ui: {
                resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
                visibility: ["model", "app"],
              },
              "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
              "openai/widgetAccessible": true,
            }),
          }),
          expect.objectContaining({
            name: SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
            description: expect.stringContaining("fixed endpoints"),
            inputSchema: expect.objectContaining({
              properties: expect.objectContaining({
                exampleId: expect.objectContaining({ type: "string" }),
              }),
              required: ["exampleId"],
              type: "object",
            }),
            _meta: expect.objectContaining({
              ui: {
                resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
                visibility: ["model", "app"],
              },
              "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
              "openai/widgetAccessible": true,
            }),
          }),
          expect.objectContaining({
            name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
            description: expect.stringContaining(
              "do not delegate live-viewer control to a subagent",
            ),
            inputSchema: expect.objectContaining({
              properties: expect.objectContaining({
                action: expect.objectContaining({
                  enum: expect.arrayContaining([
                    "clear_alignment_selection",
                    "select_sequence_feature",
                    "set_alignment_view_options",
                  ]),
                }),
                row: expect.objectContaining({
                  description: expect.stringContaining("focus_alignment_cell"),
                }),
                rows: expect.objectContaining({
                  description: expect.stringContaining(
                    "required with set_alignment_row_visibility",
                  ),
                }),
                sessionId: expect.objectContaining({ type: "string" }),
              }),
              required: expect.arrayContaining(["action", "sessionId"]),
              type: "object",
            }),
            _meta: { ui: { visibility: ["model"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          expect.objectContaining({
            name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
            _meta: { ui: { visibility: ["app"] } },
          }),
          ...[
            SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
            SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
            SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
            SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
            SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
            SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
            SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
          ].map((name) =>
            expect.objectContaining({
              name,
              _meta: { ui: { visibility: ["app"] } },
            }),
          ),
        ]),
      );
      expect(tools.map(({ name }) => name)).not.toContain(
        "sequence.open_fastq_example",
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps package and plugin release versions synchronized", async () => {
    const [packageManifest, pluginManifest] = await Promise.all([
      readFile(path.resolve("package.json"), "utf8"),
      readFile(path.resolve(".codex-plugin/plugin.json"), "utf8"),
    ]);
    expect(JSON.parse(packageManifest)).toEqual(
      expect.objectContaining({ version: SEQUENCE_VIEWER_VERSION }),
    );
    expect(JSON.parse(pluginManifest)).toEqual(
      expect.objectContaining({ version: SEQUENCE_VIEWER_VERSION }),
    );
    expect(SEQUENCE_VIEWER_VERSION).toBe("0.1.43");
  });

  it("uses trusted file-viewer metadata only on the server and publishes a source-bound export", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-trusted-source-"),
    );
    const workspace = path.join(directory, "workspace");
    const sourceDirectory = path.join(workspace, "data");
    const sourcePath = path.join(sourceDirectory, "family.fasta");
    const stateDirectory = path.join(directory, "state");
    await mkdir(path.join(sourceDirectory, "exports"), { recursive: true });
    await writeFile(sourcePath, ">source\nACGT\n");
    const server = createSequenceViewerServer({ stateDirectory });
    const client = new Client(
      {
        name: "sequence-viewer-trusted-source-test",
        version: "0.1.0",
      },
      { capabilities: { roots: {} } },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    const hostMeta = {
      "openai/resource": {
        path: sourcePath,
      },
    };
    try {
      const opened = await client.callTool({
        _meta: hostMeta,
        arguments: {
          file: {
            name: "family.fasta",
            resourceUri: "codex-resource://trusted-family",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(opened.structuredContent).toEqual({
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://trusted-family",
        },
      });
      expect(JSON.stringify(opened)).not.toContain(sourcePath);

      const registration = await client.callTool({
        _meta: hostMeta,
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      const listed = await client.callTool({
        arguments: {
          candidate: { format: "fasta", name: "browser-derived.fasta" },
          directory: ".",
          limit: 50,
          sessionId,
        },
        name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
      });
      expect(listed.structuredContent).toMatchObject({
        candidate: {
          exactAvailable: true,
          exactWorkspacePath: "data/browser-derived.fasta",
        },
        directory: {
          relativePath: ".",
          sourceDirectoryWorkspacePath: "data",
          workspacePath: "data",
        },
      });
      expect(JSON.stringify(listed)).not.toContain(directory);
      const created = await client.callTool({
        arguments: {
          name: "browser-folder",
          parentDirectory: ".",
          sessionId,
        },
        name: SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
      });
      expect(created.structuredContent).toEqual({
        name: "browser-folder",
        relativePath: "browser-folder",
        workspacePath: "data/browser-folder",
      });
      expect(JSON.stringify(created)).not.toContain(directory);
      const destination = {
        base: "opened-source" as const,
        kind: "workspace" as const,
        relativePath: "exports/family-derived.fasta",
      };
      const exportPromise = client.callTool({
        arguments: {
          destination,
          format: "fasta",
          scope: "all",
          sessionId,
        },
        name: "sequence.export_artifact",
      });
      const waited = await client.callTool({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 1_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        waited.structuredContent as {
          command: { commandId: string };
        }
      ).command;
      const content = ">derived\nA-CG\n";
      const sha256 = createHash("sha256").update(content).digest("hex");
      const provenance = {
        engine: "sequence-viewer-export-v1",
        parameters: { scope: "all" },
        sourceRevision: 0,
      };
      const persisted = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(content),
          callerId: randomUUID(),
          commandId: command.commandId,
          dataBase64: Buffer.from(content).toString("base64"),
          destination,
          format: "fasta",
          kind: "artifact",
          mediaType: "text/x-fasta",
          name: "family-derived.fasta",
          provenance,
          sessionId,
          sha256,
          uploadId: randomUUID(),
        },
        name: SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
      });
      const { kind: _kind, ...artifact } = persisted.structuredContent as {
        kind: "artifact";
        [key: string]: unknown;
      };
      await client.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "Published workspace export.",
          sessionId,
          state: { artifact, provenance },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      const exported = await exportPromise;
      expect(exported.structuredContent).toMatchObject({
        applied: true,
        result: {
          destination: { base: "opened-source", kind: "workspace" },
          outputWorkspacePath: "data/exports/family-derived.fasta",
          sha256,
        },
      });
      expect(JSON.stringify(exported)).not.toContain(sourcePath);
      await expect(
        readFile(
          path.join(sourceDirectory, "exports/family-derived.fasta"),
          "utf8",
        ),
      ).resolves.toBe(content);
      const sidecar = await readFile(
        path.join(
          sourceDirectory,
          "exports/family-derived.fasta.provenance.json",
        ),
        "utf8",
      );
      expect(sidecar).not.toContain(directory);
      expect(sidecar).toContain('"workspacePath": "data/family.fasta"');

      const uiContent = "motif\tstart\tend\nA\t1\t4\n";
      const uiSha256 = createHash("sha256").update(uiContent).digest("hex");
      const uiDestination = {
        base: "opened-source" as const,
        kind: "workspace" as const,
        relativePath: "../results/motif-hits.tsv",
      };
      await mkdir(path.join(workspace, "results"));
      const authorization = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(uiContent),
          destination: uiDestination,
          format: "tsv",
          mediaType: "text/tab-separated-values",
          name: "motif-hits.tsv",
          provenance,
          sessionId,
          sha256: uiSha256,
        },
        name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
      });
      const uiCommandId = (
        authorization.structuredContent as { commandId: string }
      ).commandId;
      const uiPersisted = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(uiContent),
          callerId: randomUUID(),
          commandId: uiCommandId,
          dataBase64: Buffer.from(uiContent).toString("base64"),
          destination: uiDestination,
          format: "tsv",
          kind: "artifact",
          mediaType: "text/tab-separated-values",
          name: "motif-hits.tsv",
          provenance,
          sessionId,
          sha256: uiSha256,
          uploadId: randomUUID(),
        },
        name: SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
      });
      expect(uiPersisted.structuredContent).toMatchObject({
        kind: "artifact",
        outputWorkspacePath: "results/motif-hits.tsv",
      });
      await expect(
        readFile(path.join(workspace, "results/motif-hits.tsv"), "utf8"),
      ).resolves.toBe(uiContent);

      const sessionPayload = validWorkspaceSession();
      const sessionSha256 = createHash("sha256")
        .update(sessionPayload)
        .digest("hex");
      const sessionDestination = {
        base: "opened-source" as const,
        collisionPolicy: "next-version" as const,
        kind: "workspace" as const,
        relativePath: "family.sequence-viewer.session.json",
      };
      const sessionAuthorization = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(sessionPayload),
          destination: sessionDestination,
          kind: "session",
          name: "family.sequence-viewer.session.json",
          sessionId,
          sha256: sessionSha256,
        },
        name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
      });
      const sessionCommandId = (
        sessionAuthorization.structuredContent as { commandId: string }
      ).commandId;
      const savedSession = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(sessionPayload),
          callerId: randomUUID(),
          commandId: sessionCommandId,
          dataBase64: Buffer.from(sessionPayload).toString("base64"),
          destination: sessionDestination,
          kind: "session",
          name: "family.sequence-viewer.session.json",
          sessionId,
          sha256: sessionSha256,
          uploadId: randomUUID(),
        },
        name: SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
      });
      expect(savedSession.structuredContent).toMatchObject({
        kind: "session",
        outputWorkspacePath: "data/family.sequence-viewer.session.json",
        payloadSha256: sessionSha256,
      });
      expect(savedSession.structuredContent).not.toHaveProperty(
        "savedSessionId",
      );
      const discovered = await client.callTool({
        arguments: { sessionId },
        name: SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
      });
      expect(discovered.structuredContent).toMatchObject({
        candidates: [
          {
            mode: "sequence",
            sourceStatus: "verification-required",
            workspacePath: "data/family.sequence-viewer.session.json",
          },
        ],
      });
      expect(JSON.stringify(discovered)).not.toContain(directory);
      const candidateId = (
        discovered.structuredContent as {
          candidates: Array<{ candidateId: string }>;
        }
      ).candidates[0]!.candidateId;
      const restorePromise = client.callTool({
        arguments: { candidateId, sessionId },
        name: SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
      });
      const restoreWait = await client.callTool({
        arguments: { afterRevision: 1, sessionId, timeoutMs: 1_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const restoreCommand = (
        restoreWait.structuredContent as {
          command: {
            action: string;
            commandId: string;
            mode: string;
            session: string;
          };
        }
      ).command;
      expect(restoreCommand).toMatchObject({
        action: "restore_session",
        mode: "sequence",
        session: sessionPayload,
      });
      await client.callTool({
        arguments: {
          applied: true,
          commandId: restoreCommand.commandId,
          message: "Restored workspace project.",
          sessionId,
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      await expect(restorePromise).resolves.toMatchObject({
        structuredContent: {
          mode: "sequence",
          restored: true,
          workspacePath: "data/family.sequence-viewer.session.json",
        },
      });

      const unbound = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const unboundSessionId = (
        unbound.structuredContent as { sessionId: string }
      ).sessionId;
      const unavailable = await client.callTool({
        arguments: {
          directory: ".",
          limit: 50,
          sessionId: unboundSessionId,
        },
        name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
      });
      expect(unavailable).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining("trusted file metadata"),
          }),
        ],
        isError: true,
      });
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("loads trusted related text and indexed workspace tracks through opaque app-only bundles", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-workspace-tracks-"),
    );
    const workspace = path.join(directory, "workspace");
    const data = path.join(workspace, "data");
    const sourcePath = path.join(data, "source.fasta");
    await mkdir(data, { recursive: true });
    await Promise.all([
      writeFile(sourcePath, ">ref\n" + "A".repeat(45) + "\n"),
      writeFile(
        path.join(data, "genes.gff3"),
        "##gff-version 3\nref\ttest\tgene\t2\t8\t.\t+\t.\tID=gene-1;Name=Gene%201\n",
      ),
      writeFile(
        path.join(data, "reads.bam"),
        Buffer.from(INDEXED_BAM_FIXTURE, "base64"),
      ),
      writeFile(
        path.join(data, "reads.bam.bai"),
        Buffer.from(INDEXED_BAI_FIXTURE, "base64"),
      ),
    ]);
    const client = new Client(
      { name: "sequence-viewer-track-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        _meta: { "openai/resource": { path: sourcePath } },
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const { revision, sessionId } = registration.structuredContent as {
        revision: number;
        sessionId: string;
      };
      const listed = await client.callTool({
        arguments: { limit: 50, sessionId },
        name: SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
      });
      expect(JSON.stringify(listed)).not.toContain(directory);
      const entries = (
        listed.structuredContent as {
          entries: Array<{
            candidateId: string;
            kind: string;
            label: string;
          }>;
        }
      ).entries;
      const byName = (label: string) => {
        const entry = entries.find(
          (candidate) => candidate.kind === "file" && candidate.label === label,
        );
        if (entry == null) throw new Error(`Missing ${label}.`);
        return entry;
      };

      const textResolution = await client.callTool({
        arguments: {
          primaryCandidateId: byName("genes.gff3").candidateId,
          sessionId,
        },
        name: SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
      });
      const textBundleId = (
        textResolution.structuredContent as { bundleId: string }
      ).bundleId;
      const textLoadPromise = client.callTool({
        arguments: { bundleId: textBundleId, sessionId },
        name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
      });
      const textWait = await client.callTool({
        arguments: { afterRevision: revision, sessionId, timeoutMs: 2_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const textCommand = (
        textWait.structuredContent as {
          command: {
            commandId: string;
            content: string;
            displayName: string;
            format: "gff3";
            sourceContentHash: string;
            sourceWorkspacePath: string;
            trackId: string;
            revision: number;
          };
        }
      ).command;
      const textTrack = parseSequenceTrack({
        content: textCommand.content,
        displayName: textCommand.displayName,
        format: textCommand.format,
        id: textCommand.trackId,
        requestedReference: "ref",
        sourceContentHash: textCommand.sourceContentHash,
        sourceWorkspacePath: textCommand.sourceWorkspacePath,
      });
      await client.callTool({
        arguments: {
          applied: true,
          commandId: textCommand.commandId,
          message: "Loaded workspace annotation.",
          sessionId,
          state: { track: textTrack },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      const textLoaded = await textLoadPromise;
      expect(textLoaded.structuredContent).toMatchObject({
        format: "gff3",
        itemCount: 1,
        kind: "annotations",
        loaded: true,
        mappingStatus: "matched",
        sourceWorkspacePath: "data/genes.gff3",
      });
      expect(JSON.stringify(textLoaded)).not.toContain(directory);

      const bamResolution = await client.callTool({
        arguments: {
          primaryCandidateId: byName("reads.bam").candidateId,
          sessionId,
        },
        name: SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
      });
      const bamBundleId = (
        bamResolution.structuredContent as { bundleId: string }
      ).bundleId;
      const invalidIndexedLoad = await client.callTool({
        arguments: { bundleId: bamBundleId, sessionId },
        name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
      });
      expect(invalidIndexedLoad).toMatchObject({
        isError: true,
        content: [
          expect.objectContaining({
            text: expect.stringContaining("explicit contig"),
          }),
        ],
      });

      const refreshedBam = await client.callTool({
        arguments: {
          primaryCandidateId: byName("reads.bam").candidateId,
          sessionId,
        },
        name: SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
      });
      const bamLoadPromise = client.callTool({
        arguments: {
          bundleId: (refreshedBam.structuredContent as { bundleId: string })
            .bundleId,
          end: 45,
          reference: "ref",
          sessionId,
          start: 1,
        },
        name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
      });
      const bamWait = await client.callTool({
        arguments: {
          afterRevision: textCommand.revision,
          sessionId,
          timeoutMs: 2_000,
        },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const bamCommand = (
        bamWait.structuredContent as {
          command: {
            commandId: string;
            content: string;
            displayName: string;
            format: "bam";
            reference: string;
            revision: number;
            sourceContentHash: string;
            sourceItemCount: number;
            sourceTruncated: boolean;
            sourceWorkspacePath: string;
            trackId: string;
          };
        }
      ).command;
      const bamTrack = parseSequenceTrack({
        content: bamCommand.content,
        displayName: bamCommand.displayName,
        format: bamCommand.format,
        id: bamCommand.trackId,
        requestedReference: bamCommand.reference,
        sourceContentHash: bamCommand.sourceContentHash,
        sourceItemCount: bamCommand.sourceItemCount,
        sourceTruncated: bamCommand.sourceTruncated,
        sourceWorkspacePath: bamCommand.sourceWorkspacePath,
      });
      await client.callTool({
        arguments: {
          applied: true,
          commandId: bamCommand.commandId,
          message: "Loaded workspace BAM.",
          sessionId,
          state: { track: bamTrack },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      const bamLoaded = await bamLoadPromise;
      expect(bamLoaded.structuredContent).toMatchObject({
        format: "bam",
        itemCount: 6,
        kind: "reads",
        loaded: true,
        mappingStatus: "matched",
        sourceTruncated: false,
        sourceWorkspacePath: "data/reads.bam",
      });
      expect(JSON.stringify(bamLoaded)).not.toContain(directory);

      const unbound = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const unavailable = await client.callTool({
        arguments: {
          limit: 50,
          sessionId: (unbound.structuredContent as { sessionId: string })
            .sessionId,
        },
        name: SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
      });
      expect(unavailable).toMatchObject({ isError: true });
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("routes only trusted workspace FASTA and FASTQ above the direct-text threshold through an opaque indexed resource", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-native-indexed-"),
    );
    const workspace = path.join(directory, "workspace");
    const exactPath = path.join(workspace, "exact.fasta");
    const indexedPath = path.join(workspace, "indexed.fastq");
    await mkdir(workspace);
    await Promise.all([
      writeFile(exactPath, ">exact\nA\n"),
      writeFile(indexedPath, "@indexed\nA\n+\nI\n"),
    ]);
    await Promise.all([
      truncate(exactPath, 32 * 1_024 * 1_024),
      truncate(indexedPath, 32 * 1_024 * 1_024 + 1),
    ]);
    const client = new Client(
      { name: "sequence-viewer-native-indexed-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      stateDirectory: path.join(directory, "state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const exact = await client.callTool({
        _meta: { "openai/resource": { path: exactPath } },
        arguments: {
          file: {
            name: "exact.fasta",
            resourceUri: "codex-resource://exact",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(exact.structuredContent).toEqual({
        file: {
          name: "exact.fasta",
          resourceUri: "codex-resource://exact",
        },
      });

      const indexed = await client.callTool({
        _meta: { "openai/resource": { path: indexedPath } },
        arguments: {
          file: {
            name: "indexed.fastq",
            resourceUri: "codex-resource://oversized",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(indexed.structuredContent).toEqual({
        file: {
          name: "indexed.fastq",
          resourceUri: expect.stringMatching(
            /^viewer-file:\/\/sequence-viewer\/opened\/[0-9a-f-]{36}$/,
          ),
        },
        schemaVersion: 1,
        viewerCommandRevision: 0,
        sessionReady: true,
        viewerReady: false,
        viewerSessionId: expect.any(String),
      });
      expect(indexed._meta).toEqual(
        expect.objectContaining({
          [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: expect.objectContaining(
            {
              sessionId: (
                indexed.structuredContent as { viewerSessionId: string }
              ).viewerSessionId,
            },
          ),
          [SEQUENCE_VIEWER_CHAT_FILE_META_KEY]: expect.objectContaining({
            primaryFile: expect.objectContaining({ name: "indexed.fastq" }),
          }),
        }),
      );
      expect(JSON.stringify(indexed)).not.toContain(directory);
      expect(JSON.stringify(indexed)).not.toContain(indexedPath);
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it.each(["removed", "request-failed"] as const)(
    "fails closed when native indexed workspace authorization is %s",
    async (failure) => {
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-native-binding-race-"),
      );
      const workspace = path.join(directory, "workspace");
      const stateDirectory = path.join(directory, "state");
      const sourcePath = path.join(workspace, "indexed.fasta");
      await mkdir(workspace);
      await writeFile(sourcePath, ">demo\nACGT\n");
      await truncate(sourcePath, 32 * 1_024 * 1_024 + 1);

      let rootsRequests = 0;
      const client = new Client(
        { name: "sequence-viewer-native-binding-race-test", version: "0.1.0" },
        { capabilities: { roots: {} } },
      );
      client.setRequestHandler(ListRootsRequestSchema, async () => {
        rootsRequests += 1;
        if (rootsRequests <= 2) {
          return { roots: [{ uri: pathToFileURL(workspace).href }] };
        }
        if (failure === "request-failed") {
          throw new Error("The active workspace roots are unavailable.");
        }
        return { roots: [] };
      });
      const workspacePublisher = new TrackingWorkspacePublisher();
      const server = createSequenceViewerServer({
        stateDirectory,
        workspacePublisher,
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ]);
      try {
        const opened = await client.callTool({
          _meta: { "openai/resource": { path: sourcePath } },
          arguments: {
            file: {
              name: "indexed.fasta",
              resourceUri: "codex-resource://native-binding-race",
            },
          },
          name: SEQUENCE_VIEWER_TOOL_NAME,
        });
        expect(opened).toMatchObject({
          content: [
            expect.objectContaining({
              text: expect.stringContaining(
                "no longer authorized in the active workspace",
              ),
            }),
          ],
          isError: true,
        });
        expect(opened.structuredContent).toBeUndefined();
        expect(opened._meta).toBeUndefined();
        expect(JSON.stringify(opened)).not.toContain(sourcePath);
        expect(JSON.stringify(opened)).not.toContain(workspace);
        expect(rootsRequests).toBe(3);
        expect(workspacePublisher.bindCalls).toBe(1);
        expect(workspacePublisher.clearedSessions).toHaveLength(1);
        const sessionId = workspacePublisher.clearedSessions[0]!;
        expect(workspacePublisher.boundSessions).not.toContain(sessionId);
        expect(
          (await readdir(stateDirectory)).filter((entry) =>
            entry.endsWith(".json"),
          ),
        ).toEqual([]);

        for (const request of [
          {
            arguments: {
              afterRevision: 0,
              sessionId,
              timeoutMs: 1_000,
            },
            name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
          },
          {
            arguments: {
              length: 4,
              offsetDecimal: "6",
              sessionId,
              sourceId: randomUUID(),
              sourceRevision: "revoked",
            },
            name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
          },
        ]) {
          const denied = await client.callTool(request);
          expect(denied).toMatchObject({
            content: [
              expect.objectContaining({
                text: expect.stringContaining(
                  "viewer session is no longer active",
                ),
              }),
            ],
            isError: true,
          });
          expect(JSON.stringify(denied)).not.toContain(workspace);
        }
      } finally {
        await client.close();
        await server.close();
        await rm(directory, { force: true, recursive: true });
      }
    },
  );

  it("fails closed without canonical host metadata and rejects widget path fields", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-untrusted-source-"),
    );
    const workspace = path.join(directory, "workspace");
    const sourcePath = path.join(workspace, "family.fasta");
    await mkdir(workspace);
    await writeFile(sourcePath, ">source\nACGT\n");

    expect(() =>
      sequenceOpenToolInputSchema.parse({
        file: {
          fsPath: sourcePath,
          name: "family.fasta",
          resourceUri: "codex-resource://untrusted-family",
        },
      }),
    ).toThrow();
    expect(() =>
      sequenceOpenToolInputSchema.parse({
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://untrusted-family",
        },
        structuredContent: {
          "openai/resource": { path: sourcePath },
        },
      }),
    ).toThrow();

    const client = new Client(
      { name: "sequence-viewer-untrusted-source-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      stateDirectory: path.join(directory, "state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const obsoleteMeta = {
        "openai/fileViewer": {
          file: {
            fsPath: sourcePath,
            name: "family.fasta",
            uri: "codex-resource://untrusted-family",
          },
        },
      };
      const opened = await client.callTool({
        _meta: obsoleteMeta,
        arguments: {
          file: {
            name: "family.fasta",
            resourceUri: "codex-resource://untrusted-family",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(JSON.stringify(opened)).not.toContain(sourcePath);

      const malformedMetadataOpen = await client.callTool({
        _meta: { "openai/resource": { path: 42 } },
        arguments: {
          file: {
            name: "family.fasta",
            resourceUri: "codex-resource://untrusted-family",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(malformedMetadataOpen.structuredContent).toEqual({
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://untrusted-family",
        },
      });
      expect(JSON.stringify(malformedMetadataOpen)).not.toContain(sourcePath);

      const relativeMetadataOpen = await client.callTool({
        _meta: { "openai/resource": { path: "family.fasta" } },
        arguments: {
          file: {
            name: "family.fasta",
            resourceUri: "codex-resource://untrusted-family",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(relativeMetadataOpen.structuredContent).toEqual({
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://untrusted-family",
        },
      });

      const registration = await client.callTool({
        _meta: obsoleteMeta,
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      const contents = ">derived\nA-CG\n";
      const preflight = await client.callTool({
        arguments: {
          byteLength: Buffer.byteLength(contents),
          destination: {
            base: "opened-source",
            kind: "workspace",
            relativePath: "family-derived.fasta",
          },
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "family-derived.fasta",
          provenance: {
            engine: "sequence-viewer-export-v1",
            parameters: { scope: "all" },
            sourceRevision: 0,
          },
          sessionId,
          sha256: createHash("sha256").update(contents).digest("hex"),
        },
        name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
      });
      expect(preflight).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining("trusted file metadata"),
          }),
        ],
        isError: true,
      });
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("round-trips a model viewer action through app-only command tools", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      const controlPromise = client.callTool({
        arguments: {
          action: "focus_sequence_coordinate",
          coordinate: 12,
          sessionId,
        },
        name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
      });
      const waitResult = await client.callTool({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 1_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        waitResult.structuredContent as {
          command: { commandId: string; revision: number };
        }
      ).command;
      await client.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "Focused coordinate 12.",
          sessionId,
          state: { coordinate: 12 },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });

      await expect(controlPromise).resolves.toEqual(
        expect.objectContaining({
          structuredContent: {
            applied: true,
            message: "Focused coordinate 12.",
            state: { coordinate: 12 },
          },
        }),
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("round-trips new workbench controls through the MCP transport without dropping options", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const { sessionId } = z
        .object({ sessionId: z.string().uuid() })
        .parse(registration.structuredContent);
      const controls: Array<SequenceViewerControlCommand> = [
        {
          action: "set_sequence_view_options",
          palette: "muted-amino-acid",
        },
        {
          action: "set_sequence_view_options",
          palette: "muted-nucleic-acid",
        },
        { action: "set_sequence_view_options", palette: "neutral" },
        {
          action: "set_alignment_view_options",
          residuePalette: "muted-amino-acid",
        },
        {
          action: "set_alignment_view_options",
          residuePalette: "muted-nucleic-acid",
        },
        { action: "set_alignment_view_options", residuePalette: "neutral" },
        {
          action: "dismiss_workbench_feedback",
          feedbackId: "sequence.copy-feedback",
        },
        {
          action: "set_workbench_panel",
          group: "sequence-tools",
          panel: "inspect",
        },
        { action: "set_workbench_panel", group: "sequence-tools", panel: null },
        {
          action: "set_workbench_disclosure",
          disclosureId: "sequence.quality.methods",
          expanded: false,
        },
        {
          action: "set_read_pileup_options",
          includeDuplicates: false,
          includeQcFailed: true,
          includeSecondary: false,
          includeSupplementary: true,
          includeUnknownMappingQuality: false,
          minimumMappingQuality: 0,
          showAllBases: true,
          showSoftClips: false,
          sortBy: "mapping-quality",
          strand: "-",
        },
        {
          action: "select_read",
          sourceReadIndex: 0,
          trackId: "synthetic-transport-track",
        },
        { action: "clear_read_selection" },
        {
          action: "set_chromatogram_view_options",
          basesPerWindow: 40,
          firstBase: 11,
        },
        {
          action: "set_quality_view_options",
          distributionsExpanded: false,
          expandedTables: ["cycle-quality", "frequent-kmers"],
          methodsExpanded: true,
        },
        { action: "set_quality_view_options", expandedTables: [] },
        {
          action: "set_sequence_record_browser",
          expanded: true,
          page: 0,
          query: "",
          sortBy: "length",
        },
        {
          action: "set_sequence_annotation_index",
          expanded: false,
          page: 2,
          query: "CDS",
        },
        { action: "select_alignment_rows", rows: ["row-1", "row-3"] },
        { action: "select_alignment_rows", rows: [] },
      ];
      let afterRevision = 0;
      for (const control of controls) {
        const controlPromise = client.callTool({
          arguments: { ...control, sessionId },
          name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
        });
        const waited = await client.callTool({
          arguments: { afterRevision, sessionId, timeoutMs: 1_000 },
          name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
        });
        const { command } = z
          .object({ command: queuedSequenceViewerCommandSchema })
          .parse(waited.structuredContent);
        expect(command).toEqual({
          ...control,
          commandId: expect.any(String),
          revision: afterRevision + 1,
        });

        // This is a transport receipt, not a claim that a mounted UI ran it.
        const message =
          "Synthetic MCP transport receipt; no viewer UI is mounted.";
        const state = {
          receivedControl: control,
          syntheticTransportReceipt: true,
        };
        const completed = await client.callTool({
          arguments: {
            applied: true,
            commandId: command.commandId,
            message,
            sessionId,
            state,
          },
          name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
        });
        expect(completed.structuredContent).toEqual({
          completed: true,
          duplicate: false,
          late: false,
        });
        await expect(controlPromise).resolves.toMatchObject({
          structuredContent: { applied: true, message, state },
        });
        afterRevision = command.revision;
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects unknown and incomplete new workbench controls at the MCP boundary", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const { sessionId } = z
        .object({ sessionId: z.string().uuid() })
        .parse(registration.structuredContent);
      const invalidControls = [
        { action: "unknown_workbench_control" },
        { action: "dismiss_workbench_feedback" },
        { action: "set_workbench_panel", group: "sequence-tools" },
        {
          action: "set_workbench_disclosure",
          disclosureId: "sequence.quality.methods",
        },
        { action: "set_read_pileup_options" },
        { action: "select_read", trackId: "synthetic-transport-track" },
        { action: "set_chromatogram_view_options" },
        { action: "set_quality_view_options" },
        { action: "set_sequence_record_browser" },
        { action: "set_sequence_annotation_index" },
        { action: "select_alignment_rows" },
        {
          action: "set_workbench_panel",
          group: "sequence-tools",
          panel: "inspect",
          firstBase: 1,
        },
      ];
      for (const control of invalidControls) {
        const rejected = await client.callTool(
          {
            arguments: { ...control, sessionId },
            name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
          },
          undefined,
          { timeout: 2_000 },
        );
        expect(rejected, JSON.stringify(control)).toMatchObject({
          isError: true,
        });
      }

      // Unknown keys must not disappear in the MCP schema before strict action
      // validation. Complete any unexpected enqueue so a failing test cannot
      // leave a control request pending until the server's normal timeout.
      const unknownOption = client.callTool({
        arguments: {
          action: "set_quality_view_options",
          methodsExpanded: true,
          sessionId,
          unexpectedQualityOption: true,
        },
        name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
      });
      const waited = await client.callTool({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 1_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const { command } = z
        .object({ command: queuedSequenceViewerCommandSchema.nullable() })
        .parse(waited.structuredContent);
      if (command != null) {
        await client.callTool({
          arguments: {
            applied: false,
            commandId: command.commandId,
            message:
              "Synthetic transport fixture rejected an unexpectedly queued invalid command; no UI is mounted.",
            sessionId,
          },
          name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
        });
      }
      await expect(unknownOption).resolves.toMatchObject({ isError: true });
      expect(command).toBeNull();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("round-trips new viewer query targets through the MCP transport with exact request fields", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const { sessionId } = z
        .object({ sessionId: z.string().uuid() })
        .parse(registration.structuredContent);
      const queries: Array<SequenceViewerQueryRequest> = [
        { group: "sequence-tools", target: "workbench-panels" },
        {
          cursor: "q1.workbench-feedback.2",
          limit: 2,
          mode: "sequence",
          target: "workbench-feedback",
        },
        {
          cursor: "q1.workbench-disclosures.2",
          limit: 2,
          mode: "sequence",
          target: "workbench-disclosures",
        },
        { target: "sequence-ui-state" },
        { target: "read-pileup-state" },
        { target: "quality-report" },
        {
          cursor: "q1.read-detail.2",
          end: 8,
          limit: 2,
          sourceReadIndex: 0,
          start: 4,
          target: "read-detail",
          trackId: "synthetic-transport-track",
        },
        {
          cursor: "q1.chromatogram|synthetic|2|4|3|13|3",
          end: 4,
          limit: 3,
          record: "trace-1",
          start: 2,
          target: "chromatogram",
        },
      ];
      let afterRevision = 0;
      for (const request of queries) {
        const queryPromise = client.callTool({
          arguments: { ...request, sessionId },
          name: SEQUENCE_VIEWER_QUERY_TOOL_NAME,
        });
        const waited = await client.callTool({
          arguments: { afterRevision, sessionId, timeoutMs: 1_000 },
          name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
        });
        const { command } = z
          .object({ command: queuedSequenceViewerCommandSchema })
          .parse(waited.structuredContent);
        expect(command).toEqual({
          action: "query_viewer",
          commandId: expect.any(String),
          request,
          revision: afterRevision + 1,
        });
        const query = {
          syntheticTransportReceipt: true,
          target: request.target,
        };
        await client.callTool({
          arguments: {
            applied: true,
            commandId: command.commandId,
            message:
              "Synthetic MCP query receipt; no viewer data was evaluated.",
            sessionId,
            state: { query },
          },
          name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
        });
        await expect(queryPromise).resolves.toMatchObject({
          structuredContent: { applied: true, result: query },
        });
        afterRevision = command.revision;
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("round-trips unpaged coordinate queries without injecting a page limit", async () => {
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      let afterRevision = 0;
      for (const arguments_ of [
        { end: 4, sessionId, start: 1, target: "sequence-range" },
        { end: 4, sessionId, start: 1, target: "quality" },
        { end: 4, sessionId, start: 1, target: "columns" },
      ]) {
        const queryPromise = client.callTool({
          arguments: arguments_,
          name: SEQUENCE_VIEWER_QUERY_TOOL_NAME,
        });
        const waitResult = await client.callTool({
          arguments: { afterRevision, sessionId, timeoutMs: 1_000 },
          name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
        });
        const command = (
          waitResult.structuredContent as {
            command: {
              commandId: string;
              request: Record<string, unknown>;
              revision: number;
            };
          }
        ).command;
        expect(command.request).toMatchObject({ target: arguments_.target });
        expect(command.request).not.toHaveProperty("limit");
        await client.callTool({
          arguments: {
            applied: true,
            commandId: command.commandId,
            message: "Query completed.",
            sessionId,
            state: { query: { target: arguments_.target } },
          },
          name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
        });
        await expect(queryPromise).resolves.toEqual(
          expect.objectContaining({
            structuredContent: expect.objectContaining({
              result: { target: arguments_.target },
            }),
          }),
        );
        afterRevision = command.revision;
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("opens a workspace file through a hidden plugin resource", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-test-"),
    );
    await writeFile(path.join(workspace, "family.fasta"), ">demo\nACGT\n");
    await mkdir(path.join(workspace, "exports"));
    const client = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      stateDirectory: path.join(workspace, ".viewer-state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const result = await client.callTool({
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        arguments: { path: "family.fasta" },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: [
            {
              type: "text",
              text: expect.stringContaining("is opening"),
            },
          ],
          structuredContent: expect.objectContaining({
            viewerCommandRevision: 0,
            sessionReady: true,
            viewerReady: false,
            viewerSessionId: expect.any(String),
          }),
        }),
      );
      const viewerSessionId = (
        result.structuredContent as { viewerSessionId: string }
      ).viewerSessionId;
      const chatExportContent = ">chat-derived\nAC\n";
      await expect(
        client.callTool({
          arguments: {
            byteLength: Buffer.byteLength(chatExportContent),
            destination: {
              base: "opened-source",
              kind: "workspace",
              relativePath: "exports/chat-derived.fasta",
            },
            format: "fasta",
            mediaType: "text/x-fasta",
            name: "chat-derived.fasta",
            provenance: {
              engine: "sequence-viewer-browser-export-v1",
              parameters: { kind: "chat-parity" },
              sourceRevision: 0,
            },
            sessionId: viewerSessionId,
            sha256: createHash("sha256")
              .update(chatExportContent)
              .digest("hex"),
          },
          name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          structuredContent: expect.objectContaining({
            commandId: expect.any(String),
          }),
        }),
      );
      const controlPromise = client.callTool({
        arguments: {
          action: "search_sequence",
          query: "ACG",
          sessionId: viewerSessionId,
        },
        name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
      });
      const waitResult = await client.callTool({
        arguments: {
          afterRevision: 0,
          sessionId: viewerSessionId,
          timeoutMs: 1_000,
        },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        waitResult.structuredContent as {
          command: { commandId: string; revision: number };
        }
      ).command;
      await client.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "Found 2 matches.",
          sessionId: viewerSessionId,
          state: { matchCount: 2 },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      await expect(controlPromise).resolves.toEqual(
        expect.objectContaining({
          structuredContent: {
            applied: true,
            message: "Found 2 matches.",
            state: { matchCount: 2 },
          },
        }),
      );
      const viewerFile = result._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as
        { primaryFile?: { name?: string; uri?: string } } | undefined;
      expect(viewerFile?.primaryFile).toEqual({
        name: "family.fasta",
        uri: expect.stringMatching(
          new RegExp(`^${SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI}/`),
        ),
      });

      const resource = await client.readResource({
        uri: viewerFile?.primaryFile?.uri ?? "",
      });
      expect(resource.contents).toEqual([
        expect.objectContaining({
          text: ">demo\nACGT\n",
        }),
      ]);
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("keeps 100 public VCF samples private when a model loads a variant track", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-private-vcf-track-"),
    );
    const fixture = await readFile(
      path.resolve(
        "src/sequence/__fixtures__/official-vcf-4.3-first-100-sample-variant.vcf",
      ),
      "utf8",
    );
    expect(createHash("sha256").update(fixture).digest("hex")).toBe(
      "2841a817ca64295730ef905725a735b4a424bdcfd3e231304eeee8f44e76997b",
    );
    const trackPath = path.join(workspace, "public-100-sample-variants.vcf");
    await writeFile(trackPath, fixture);
    const client = new Client(
      { name: "sequence-viewer-private-track-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      stateDirectory: path.join(workspace, ".viewer-state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      const loadPromise = client.callTool({
        arguments: {
          format: "vcf",
          path: "public-100-sample-variants.vcf",
          reference: "1",
          sessionId,
        },
        name: SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
      });
      const waitResult = await client.callTool({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 2_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        waitResult.structuredContent as {
          command: {
            commandId: string;
            content: string;
            displayName: string;
            format: "vcf";
            reference: string;
            revision: number;
            trackId: string;
          };
        }
      ).command;
      const parsedTrack = parseSequenceTrack({
        content: command.content,
        displayName: command.displayName,
        format: command.format,
        id: command.trackId,
        requestedReference: command.reference,
        sourceWorkspacePath: trackPath,
      });
      expect(parsedTrack.vcfHeader?.sampleNames).toHaveLength(100);
      expect(parsedTrack.variants?.[0]?.sampleValues).toHaveLength(100);
      const privateTrack = {
        ...parsedTrack,
        mapping: {
          ...parsedTrack.mapping,
          privateMappingNote: "PRIVATE_MAPPING_NOTE",
        },
        summary: {
          ...parsedTrack.summary,
          privateSummaryNote: "PRIVATE_SUMMARY_NOTE",
        },
      };

      await client.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "Loaded a public 100-sample variant track.",
          sessionId,
          state: {
            privateStateNote: "PRIVATE_STATE_NOTE",
            track: privateTrack,
          },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });

      const modelResult = await loadPromise;
      expect(modelResult.structuredContent).toMatchObject({
        applied: true,
        result: {
          featureCount: 0,
          format: "vcf",
          id: command.trackId,
          kind: "variants",
          mapping: {
            matchedReference: "1",
            requestedReference: "1",
            status: "matched",
            unmatchedReferences: [],
          },
          name: "public-100-sample-variants.vcf",
          readCount: 0,
          sampleCount: 100,
          source: { displayName: "public-100-sample-variants.vcf" },
          summary: {
            itemCount: 1,
            materializedItemCount: 1,
            references: ["1"],
            truncated: false,
          },
          variantCount: 1,
        },
      });
      const disclosed = JSON.stringify(modelResult);
      for (const privateValue of [
        "HG00096",
        "HG00261",
        "0|0:0.200:-0.18,-0.47,-2.42",
        "##fileformat=VCFv4.3",
        "PRIVATE_MAPPING_NOTE",
        "PRIVATE_SUMMARY_NOTE",
        "PRIVATE_STATE_NOTE",
        workspace,
        trackPath,
      ]) {
        expect(disclosed).not.toContain(privateValue);
      }
      for (const privateKey of [
        "rawInfo",
        "samples",
        "sampleValues",
        "variants",
        "vcfHeader",
        "workspacePath",
      ]) {
        expect(disclosed).not.toContain(`"${privateKey}":`);
      }

      const rejectedLoadPromise = client.callTool({
        arguments: {
          format: "vcf",
          path: "public-100-sample-variants.vcf",
          reference: "1",
          sessionId,
        },
        name: SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
      });
      const rejectedWaitResult = await client.callTool({
        arguments: {
          afterRevision: command.revision,
          sessionId,
          timeoutMs: 2_000,
        },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const rejectedCommand = (
        rejectedWaitResult.structuredContent as {
          command: { commandId: string };
        }
      ).command;
      await client.callTool({
        arguments: {
          applied: false,
          commandId: rejectedCommand.commandId,
          message: "The viewer rejected this track.",
          sessionId,
          state: {
            privateStateNote: "REJECTED_PRIVATE_STATE_NOTE",
            track: privateTrack,
          },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      const rejectedModelResult = await rejectedLoadPromise;
      expect(rejectedModelResult.structuredContent).toMatchObject({
        applied: false,
        message: "The viewer rejected this track.",
        result: null,
      });
      const rejectedDisclosure = JSON.stringify(rejectedModelResult);
      expect(rejectedDisclosure).not.toContain("HG00096");
      expect(rejectedDisclosure).not.toContain("REJECTED_PRIVATE_STATE_NOTE");
      expect(rejectedDisclosure).not.toContain(workspace);

      expect(parsedTrack.vcfHeader?.sampleNames[0]).toBe("HG00096");
      expect(parsedTrack.vcfHeader?.sampleNames[99]).toBe("HG00261");
      expect(parsedTrack.variants?.[0]?.samples.HG00096).toBe(
        "0|0:0.200:-0.18,-0.47,-2.42",
      );
      expect(parsedTrack.variants?.[0]?.sampleValues).toHaveLength(100);
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("loads a bounded indexed BAM region into the mounted workbench", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-bam-test-"),
    );
    await Promise.all([
      writeFile(
        path.join(workspace, "samspec.bam"),
        Buffer.from(INDEXED_BAM_FIXTURE, "base64"),
      ),
      writeFile(
        path.join(workspace, "samspec.bam.bai"),
        Buffer.from(INDEXED_BAI_FIXTURE, "base64"),
      ),
    ]);
    const client = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      stateDirectory: path.join(workspace, ".viewer-state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;
      const loadPromise = client.callTool({
        arguments: {
          end: 45,
          format: "bam",
          path: "samspec.bam",
          reference: "ref",
          sessionId,
          start: 1,
        },
        name: SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
      });
      const waitResult = await client.callTool({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 1_000 },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        waitResult.structuredContent as {
          command: {
            action: string;
            commandId: string;
            content: string;
            format: string;
            reference: string;
            sourceItemCount: number;
            sourceTruncated: boolean;
            trackId: string;
          };
        }
      ).command;
      expect(command).toMatchObject({
        action: "load_track",
        format: "bam",
        reference: "ref",
        sourceItemCount: 6,
        sourceTruncated: false,
      });
      expect(command.content).toContain("@SQ\tSN:ref\tLN:45");
      await client.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "Loaded indexed BAM evidence.",
          sessionId,
          state: {
            track: parseSequenceTrack({
              content: command.content,
              displayName: "samspec.bam",
              format: "bam",
              id: command.trackId,
              requestedReference: command.reference,
              sourceItemCount: command.sourceItemCount,
              sourceTruncated: command.sourceTruncated,
            }),
          },
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      await expect(loadPromise).resolves.toEqual(
        expect.objectContaining({
          structuredContent: expect.objectContaining({ applied: true }),
        }),
      );
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("restores a historical chat file resource after the server restarts", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">demo\nACGT\n");
    let resourceUri = "";

    const firstClient = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    firstClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const firstServer = createSequenceViewerServer({ stateDirectory });
    const [firstClientTransport, firstServerTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      firstClient.connect(firstClientTransport),
      firstServer.connect(firstServerTransport),
    ]);
    try {
      const result = await firstClient.callTool({
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        arguments: { path: "family.fasta" },
      });
      resourceUri = (
        result._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
          primaryFile: { uri: string };
        }
      ).primaryFile.uri;
    } finally {
      await firstClient.close();
      await firstServer.close();
    }

    const restoredClient = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    restoredClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const restoredServer = createSequenceViewerServer({ stateDirectory });
    const [restoredClientTransport, restoredServerTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      restoredClient.connect(restoredClientTransport),
      restoredServer.connect(restoredServerTransport),
    ]);
    try {
      await expect(
        restoredClient.readResource({ uri: resourceUri }),
      ).resolves.toEqual({
        contents: [
          expect.objectContaining({
            text: ">demo\nACGT\n",
            uri: resourceUri,
          }),
        ],
      });
    } finally {
      await restoredClient.close();
      await restoredServer.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("restores the same authenticated chat session and a fresh source after a real server restart", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-session-restart-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">demo\nACGT\n");
    let originalSessionId = "";
    let originalResourceUri = "";
    let originalSourceId = "";
    let originalSourceRevision = "";
    const checkpointBase64 = Buffer.from(
      '{"mode":"alignment","selection":[2,5]}',
    ).toString("base64");

    const firstClient = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    firstClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const firstServer = createSequenceViewerServer({ stateDirectory });
    const [firstClientTransport, firstServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      firstClient.connect(firstClientTransport),
      firstServer.connect(firstServerTransport),
    ]);
    try {
      const opened = await firstClient.callTool({
        arguments: { path: "family.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      originalSessionId = (
        opened.structuredContent as { viewerSessionId: string }
      ).viewerSessionId;
      originalResourceUri = (
        opened._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
          primaryFile: { uri: string };
        }
      ).primaryFile.uri;
      const originalSource = opened._meta?.[
        SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
      ] as {
        sourceId: string;
        sourceRevision: string;
      };
      originalSourceId = originalSource.sourceId;
      originalSourceRevision = originalSource.sourceRevision;
      const saved = await firstClient.callTool({
        arguments: {
          checkpointBase64,
          lastAcknowledgedRevision: 7,
          sessionId: originalSessionId,
          sourceId: originalSourceId,
          sourceRevision: originalSourceRevision,
        },
        name: SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
      });
      expect(saved.isError).not.toBe(true);
    } finally {
      await firstClient.close();
      await firstServer.close();
    }

    const restoredClient = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    restoredClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const restoredServer = createSequenceViewerServer({ stateDirectory });
    const [restoredClientTransport, restoredServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      restoredClient.connect(restoredClientTransport),
      restoredServer.connect(restoredServerTransport),
    ]);
    try {
      const restored = await restoredClient.callTool({
        arguments: {
          resourceUri: originalResourceUri,
          sessionId: originalSessionId,
        },
        name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
      });
      expect(restored.isError).not.toBe(true);
      expect(restored.structuredContent).toEqual({
        revision: 7,
        schemaVersion: 1,
        sessionId: originalSessionId,
      });
      const refreshedSource = restored._meta?.[
        SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
      ] as { sessionId: string; sourceId: string; sourceRevision: string };
      expect(refreshedSource.sessionId).toBe(originalSessionId);
      expect(refreshedSource.sourceId).not.toBe(originalSourceId);
      expect(refreshedSource.sourceRevision).toBe(originalSourceRevision);
      expect(JSON.stringify(restored)).not.toContain(workspace);

      const recoveredCheckpoint = await restoredClient.callTool({
        arguments: {
          sessionId: originalSessionId,
          sourceId: refreshedSource.sourceId,
          sourceRevision: refreshedSource.sourceRevision,
        },
        name: SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
      });
      expect(recoveredCheckpoint.structuredContent).toMatchObject({
        checkpointBase64,
        hasCheckpoint: true,
        lastAcknowledgedRevision: 7,
        sourceRevision: originalSourceRevision,
      });

      const replayed = await restoredClient.callTool({
        arguments: {
          resourceUri: originalResourceUri,
          sessionId: originalSessionId,
        },
        name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
      });
      expect(replayed.structuredContent).toMatchObject({
        revision: 7,
        sessionId: originalSessionId,
      });
      expect(
        replayed._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      ).toEqual(refreshedSource);
      await expect(
        restoredClient.callTool({
          arguments: {
            length: 4,
            offsetDecimal: "6",
            sessionId: originalSessionId,
            sourceId: refreshedSource.sourceId,
            sourceRevision: refreshedSource.sourceRevision,
          },
          name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          bytesBase64: Buffer.from("ACGT").toString("base64"),
        },
      });

      const control = restoredClient.callTool({
        arguments: {
          action: "clear_sequence_selection",
          sessionId: originalSessionId,
        },
        name: SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
      });
      const pending = await restoredClient.callTool({
        arguments: {
          afterRevision: 7,
          sessionId: originalSessionId,
          timeoutMs: 1_000,
        },
        name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
      });
      const command = (
        pending.structuredContent as {
          command: { commandId: string; revision: number };
        }
      ).command;
      expect(command.revision).toBe(8);
      await restoredClient.callTool({
        arguments: {
          applied: true,
          commandId: command.commandId,
          message: "cleared after restart",
          sessionId: originalSessionId,
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      await expect(control).resolves.toMatchObject({
        structuredContent: { applied: true },
      });

      const crossSession = await restoredClient.callTool({
        arguments: {
          resourceUri: originalResourceUri,
          sessionId: randomUUID(),
        },
        name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
      });
      expect(crossSession).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining("does not own this session"),
          }),
        ],
        isError: true,
      });
    } finally {
      await restoredClient.close();
      await restoredServer.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it.each(["removed", "request-failed"] as const)(
    "revalidates an existing restored session when active roots are %s",
    async (failure) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-existing-session-root-race-"),
      );
      const stateDirectory = path.join(workspace, ".viewer-state");
      await writeFile(path.join(workspace, "family.fasta"), ">demo\nACGT\n");
      let phase: "active" | "revoking" | "restored" = "active";
      let revocationRootsRequests = 0;
      const client = new Client(
        { name: "sequence-viewer-existing-session-test", version: "0.1.0" },
        { capabilities: { roots: {} } },
      );
      client.setRequestHandler(ListRootsRequestSchema, async () => {
        if (phase !== "revoking" || revocationRootsRequests++ === 0) {
          return { roots: [{ uri: pathToFileURL(workspace).href }] };
        }
        if (failure === "request-failed") {
          throw new Error("The active workspace roots are unavailable.");
        }
        return { roots: [] };
      });
      const workspacePublisher = new TrackingWorkspacePublisher();
      const server = createSequenceViewerServer({
        stateDirectory,
        workspacePublisher,
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ]);
      try {
        const opened = await client.callTool({
          arguments: { path: "family.fasta" },
          name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        });
        const sessionId = (
          opened.structuredContent as { viewerSessionId: string }
        ).viewerSessionId;
        const resourceUri = (
          opened._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
            primaryFile: { uri: string };
          }
        ).primaryFile.uri;
        const originalSource = opened._meta?.[
          SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
        ] as { sourceId: string; sourceRevision: string };
        const initialBindCalls = workspacePublisher.bindCalls;
        expect(workspacePublisher.boundSessions).toContain(sessionId);

        phase = "revoking";
        const rejected = await client.callTool({
          arguments: { resourceUri, sessionId },
          name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
        });
        expect(rejected).toMatchObject({ isError: true });
        expect(rejected.structuredContent).toBeUndefined();
        expect(rejected._meta).toBeUndefined();
        expect(JSON.stringify(rejected)).not.toContain(workspace);
        expect(revocationRootsRequests).toBe(2);
        expect(workspacePublisher.bindCalls).toBe(initialBindCalls);
        expect(workspacePublisher.clearedSessions).not.toContain(sessionId);
        expect(workspacePublisher.boundSessions).toContain(sessionId);

        phase = "restored";
        const recovered = await client.callTool({
          arguments: { resourceUri, sessionId },
          name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
        });
        expect(recovered.isError).not.toBe(true);
        expect(recovered.structuredContent).toMatchObject({ sessionId });
        expect(
          recovered._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
        ).toEqual(originalSource);
        expect(workspacePublisher.bindCalls).toBe(initialBindCalls);
        await expect(
          client.callTool({
            arguments: {
              length: 4,
              offsetDecimal: "6",
              sessionId,
              sourceId: originalSource.sourceId,
              sourceRevision: originalSource.sourceRevision,
            },
            name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
          }),
        ).resolves.toMatchObject({
          structuredContent: {
            bytesBase64: Buffer.from("ACGT").toString("base64"),
          },
        });
      } finally {
        await client.close();
        await server.close();
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("restores an authenticated indexed native preview and checkpoint after a server restart", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-native-session-restart-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sourcePath = path.join(workspace, "native.fasta");
    await writeFile(sourcePath, ">native\nACGT\n");
    await truncate(sourcePath, 32 * 1_024 * 1_024 + 1);
    const checkpointBase64 = Buffer.from(
      '{"mode":"alignment","selection":[3,8]}',
    ).toString("base64");
    let originalSessionId = "";
    let originalResourceUri = "";
    let originalSourceRevision = "";

    const originalClient = new Client(
      { name: "sequence-viewer-native-restart-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    originalClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const originalServer = createSequenceViewerServer({ stateDirectory });
    const [originalClientTransport, originalServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      originalClient.connect(originalClientTransport),
      originalServer.connect(originalServerTransport),
    ]);
    try {
      const opened = await originalClient.callTool({
        _meta: { "openai/resource": { path: sourcePath } },
        arguments: {
          file: {
            name: "native.fasta",
            resourceUri: "codex-resource://native-preview",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      originalSessionId = (
        opened.structuredContent as { viewerSessionId: string }
      ).viewerSessionId;
      originalResourceUri = (
        opened._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
          primaryFile: { uri: string };
        }
      ).primaryFile.uri;
      const originalSource = opened._meta?.[
        SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
      ] as { sourceId: string; sourceRevision: string };
      originalSourceRevision = originalSource.sourceRevision;
      const saved = await originalClient.callTool({
        arguments: {
          checkpointBase64,
          lastAcknowledgedRevision: 5,
          sessionId: originalSessionId,
          sourceId: originalSource.sourceId,
          sourceRevision: originalSource.sourceRevision,
        },
        name: SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
      });
      expect(saved.isError, JSON.stringify(saved)).not.toBe(true);
    } finally {
      await originalClient.close();
      await originalServer.close();
    }

    const restartedClient = new Client(
      { name: "sequence-viewer-native-restart-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    restartedClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const restartedServer = createSequenceViewerServer({ stateDirectory });
    const [restartedClientTransport, restartedServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      restartedClient.connect(restartedClientTransport),
      restartedServer.connect(restartedServerTransport),
    ]);
    try {
      const restored = await restartedClient.callTool({
        arguments: {
          resourceUri: originalResourceUri,
          sessionId: originalSessionId,
        },
        name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
      });
      expect(restored.isError, JSON.stringify(restored)).not.toBe(true);
      expect(restored.structuredContent).toMatchObject({
        revision: 5,
        sessionId: originalSessionId,
      });
      const restoredSource = restored._meta?.[
        SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
      ] as { sourceId: string; sourceRevision: string };
      expect(restoredSource.sourceRevision).toBe(originalSourceRevision);
      await expect(
        restartedClient.callTool({
          arguments: {
            sessionId: originalSessionId,
            sourceId: restoredSource.sourceId,
            sourceRevision: restoredSource.sourceRevision,
          },
          name: SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          checkpointBase64,
          hasCheckpoint: true,
          lastAcknowledgedRevision: 5,
        },
      });
      expect(JSON.stringify(restored)).not.toContain(workspace);
    } finally {
      await restartedClient.close();
      await restartedServer.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it.each(["removed", "request-failed"] as const)(
    "fails closed when the active workspace is %s during session rebinding",
    async (failure) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-restore-binding-race-"),
      );
      const stateDirectory = path.join(workspace, ".viewer-state");
      await writeFile(path.join(workspace, "family.fasta"), ">demo\nACGT\n");
      let originalSessionId = "";
      let originalResourceUri = "";
      let originalSource: { sourceId: string; sourceRevision: string };

      const originalClient = new Client(
        { name: "sequence-viewer-binding-race-test", version: "0.1.0" },
        { capabilities: { roots: {} } },
      );
      originalClient.setRequestHandler(ListRootsRequestSchema, async () => ({
        roots: [{ uri: pathToFileURL(workspace).href }],
      }));
      const originalServer = createSequenceViewerServer({ stateDirectory });
      const [originalClientTransport, originalServerTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        originalClient.connect(originalClientTransport),
        originalServer.connect(originalServerTransport),
      ]);
      try {
        const opened = await originalClient.callTool({
          arguments: { path: "family.fasta" },
          name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        });
        originalSessionId = (
          opened.structuredContent as { viewerSessionId: string }
        ).viewerSessionId;
        originalResourceUri = (
          opened._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
            primaryFile: { uri: string };
          }
        ).primaryFile.uri;
        originalSource = opened._meta?.[
          SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY
        ] as { sourceId: string; sourceRevision: string };
      } finally {
        await originalClient.close();
        await originalServer.close();
      }

      let rootsRequests = 0;
      const racedClient = new Client(
        { name: "sequence-viewer-binding-race-test", version: "0.1.0" },
        { capabilities: { roots: {} } },
      );
      racedClient.setRequestHandler(ListRootsRequestSchema, async () => {
        rootsRequests += 1;
        if (rootsRequests <= 2) {
          return { roots: [{ uri: pathToFileURL(workspace).href }] };
        }
        if (failure === "request-failed") {
          throw new Error("The active workspace roots are unavailable.");
        }
        return { roots: [] };
      });
      const workspacePublisher = new TrackingWorkspacePublisher();
      const racedServer = createSequenceViewerServer({
        stateDirectory,
        workspacePublisher,
      });
      const [racedClientTransport, racedServerTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        racedClient.connect(racedClientTransport),
        racedServer.connect(racedServerTransport),
      ]);
      try {
        const restored = await racedClient.callTool({
          arguments: {
            resourceUri: originalResourceUri,
            sessionId: originalSessionId,
          },
          name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
        });
        expect(restored).toMatchObject({
          content: [
            expect.objectContaining({
              text: expect.stringContaining(
                "no longer authorized in the active workspace",
              ),
            }),
          ],
          isError: true,
        });
        expect(JSON.stringify(restored)).not.toContain(workspace);
        expect(rootsRequests).toBe(3);
        expect(workspacePublisher.bindCalls).toBe(1);
        expect(workspacePublisher.clearedSessions).toContain(originalSessionId);
        expect(workspacePublisher.boundSessions).not.toContain(
          originalSessionId,
        );

        for (const request of [
          {
            arguments: {
              afterRevision: 0,
              sessionId: originalSessionId,
              timeoutMs: 1_000,
            },
            name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
          },
          {
            arguments: {
              length: 4,
              offsetDecimal: "6",
              sessionId: originalSessionId,
              sourceId: originalSource!.sourceId,
              sourceRevision: originalSource!.sourceRevision,
            },
            name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
          },
        ]) {
          const denied = await racedClient.callTool(request);
          expect(denied).toMatchObject({
            content: [
              expect.objectContaining({
                text: expect.stringContaining(
                  "viewer session is no longer active",
                ),
              }),
            ],
            isError: true,
          });
          expect(JSON.stringify(denied)).not.toContain(workspace);
        }
      } finally {
        await racedClient.close();
        await racedServer.close();
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("rejects an active workspace-root switch while restoring a signed chat session", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-restore-root-race-"),
    );
    const workspace = path.join(directory, "workspace");
    const signedRoot = path.join(workspace, "nested");
    const stateDirectory = path.join(directory, "state");
    await mkdir(signedRoot, { recursive: true });
    await writeFile(path.join(signedRoot, "family.fasta"), ">demo\nACGT\n");
    let originalSessionId = "";
    let originalResourceUri = "";

    const originalClient = new Client(
      { name: "sequence-viewer-root-race-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    originalClient.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(signedRoot).href }],
    }));
    const originalServer = createSequenceViewerServer({ stateDirectory });
    const [originalClientTransport, originalServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      originalClient.connect(originalClientTransport),
      originalServer.connect(originalServerTransport),
    ]);
    try {
      const opened = await originalClient.callTool({
        arguments: { path: "family.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      originalSessionId = (
        opened.structuredContent as { viewerSessionId: string }
      ).viewerSessionId;
      originalResourceUri = (
        opened._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as {
          primaryFile: { uri: string };
        }
      ).primaryFile.uri;
    } finally {
      await originalClient.close();
      await originalServer.close();
    }

    let rootsRequests = 0;
    const racedClient = new Client(
      { name: "sequence-viewer-root-race-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    racedClient.setRequestHandler(ListRootsRequestSchema, async () => {
      rootsRequests += 1;
      return {
        roots: [
          {
            uri: pathToFileURL(rootsRequests === 1 ? signedRoot : workspace)
              .href,
          },
        ],
      };
    });
    const racedServer = createSequenceViewerServer({ stateDirectory });
    const [racedClientTransport, racedServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      racedClient.connect(racedClientTransport),
      racedServer.connect(racedServerTransport),
    ]);
    try {
      const restored = await racedClient.callTool({
        arguments: {
          resourceUri: originalResourceUri,
          sessionId: originalSessionId,
        },
        name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
      });
      expect(restored).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining("original active workspace"),
          }),
        ],
        isError: true,
      });
      expect(rootsRequests).toBe(2);
      expect(JSON.stringify(restored)).not.toContain(directory);
    } finally {
      await racedClient.close();
      await racedServer.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("acquires, provenance-binds, and opens one authoritative public example", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-public-example-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    const filePath = path.join(examplesDirectory, "NC_001416.1.gb");
    const fixtureContents =
      "LOCUS       NC_001416 4 bp DNA linear 01-JAN-2023\nACCESSION   NC_001416\nVERSION     NC_001416.1\nORIGIN\n        1 acgt\n//\n";
    const publicExampleAcquirer: SequencePublicExampleAcquirer = {
      acquire: async ({ exampleId }) => {
        await mkdir(examplesDirectory, { recursive: true });
        await writeFile(filePath, fixtureContents);
        const identity = await stat(filePath, { bigint: true });
        return {
          absolutePath: filePath,
          fileIdentity: {
            device: identity.dev.toString(),
            inode: identity.ino.toString(),
            modifiedAtNanoseconds: identity.mtimeNs.toString(),
            size: identity.size.toString(),
          },
          fileName: "NC_001416.1.gb",
          provenance: {
            artifactByteLength: Buffer.byteLength(fixtureContents),
            artifactRelativePath: "codex-viewer-examples/NC_001416.1.gb",
            artifactSha256: createHash("sha256")
              .update(fixtureContents)
              .digest("hex"),
            database: "NCBI Nuccore",
            exampleId,
            provenanceRelativePath:
              "codex-viewer-examples/NC_001416.1.gb.provenance.json",
            requestedIdentifier: "NC_001416.1",
            resolvedIdentifier: "NC_001416.1",
            subset: null,
          },
        };
      },
    };
    const client = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      publicExampleAcquirer,
      stateDirectory,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const result = await client.callTool({
        arguments: { exampleId: "ncbi-nc-001416-1" },
        name: SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: [
            expect.objectContaining({
              text: expect.stringContaining(
                "authoritative public record was acquired and validated",
              ),
              type: "text",
            }),
          ],
          structuredContent: expect.objectContaining({
            publicExampleProvenance: expect.objectContaining({
              artifactRelativePath: "codex-viewer-examples/NC_001416.1.gb",
              database: "NCBI Nuccore",
              exampleId: "ncbi-nc-001416-1",
            }),
            schemaVersion: 1,
            viewerCommandRevision: 0,
            sessionReady: true,
            viewerReady: false,
            viewerSessionId: expect.any(String),
          }),
        }),
      );
      const viewerFile = result._meta?.[SEQUENCE_VIEWER_CHAT_FILE_META_KEY] as
        { primaryFile?: { name?: string; uri?: string } } | undefined;
      expect(viewerFile?.primaryFile).toEqual({
        name: "NC_001416.1.gb",
        uri: expect.stringMatching(
          new RegExp(`^${SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI}/`),
        ),
      });
      const resource = await client.readResource({
        uri: viewerFile?.primaryFile?.uri ?? "",
      });
      expect((resource.contents[0] as { text?: string }).text).toContain(
        "VERSION     NC_001416.1",
      );
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects an acquired-path swap without leaking a handle, path, or command session", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-public-swap-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    const filePath = path.join(examplesDirectory, "NC_001416.1.gb");
    const originalPath = path.join(examplesDirectory, "validated-original.gb");
    await mkdir(examplesDirectory);
    const validated = "LOCUS       validated\nORIGIN\n        1 acgt\n//\n";
    await writeFile(filePath, validated);
    const identity = await stat(filePath, { bigint: true });
    await rename(filePath, originalPath);
    await writeFile(filePath, "LOCUS       attacker replacement\n//\n");
    const publicExampleAcquirer: SequencePublicExampleAcquirer = {
      acquire: async ({ exampleId }) => ({
        absolutePath: filePath,
        fileIdentity: {
          device: identity.dev.toString(),
          inode: identity.ino.toString(),
          modifiedAtNanoseconds: identity.mtimeNs.toString(),
          size: identity.size.toString(),
        },
        fileName: "NC_001416.1.gb",
        provenance: {
          artifactByteLength: Buffer.byteLength(validated),
          artifactRelativePath: "codex-viewer-examples/NC_001416.1.gb",
          artifactSha256: createHash("sha256").update(validated).digest("hex"),
          database: "NCBI Nuccore",
          exampleId,
          provenanceRelativePath:
            "codex-viewer-examples/NC_001416.1.gb.provenance.json",
          requestedIdentifier: "NC_001416.1",
          resolvedIdentifier: "NC_001416.1",
          subset: null,
        },
      }),
    };
    const client = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      publicExampleAcquirer,
      stateDirectory,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      for (let attempt = 0; attempt < 260; attempt += 1) {
        const result = await client.callTool({
          arguments: { exampleId: "ncbi-nc-001416-1" },
          name: SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
        });
        expect(result).toMatchObject({
          content: [
            expect.objectContaining({
              text: expect.stringContaining(
                "identity or active workspace changed before opening",
              ),
            }),
          ],
          isError: true,
        });
        expect(result).not.toHaveProperty("structuredContent.viewerSessionId");
        expect(JSON.stringify(result)).not.toContain(workspace);
      }
      await expect(readdir(stateDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("reports private-state disk failures actionably without leaking a viewer session", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-public-state-failure-"),
    );
    const stateDirectory = path.join(workspace, "unwritable-state-file");
    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    const filePath = path.join(examplesDirectory, "NC_001416.1.gb");
    const contents = "LOCUS       validated\nORIGIN\n        1 acgt\n//\n";
    await writeFile(stateDirectory, "not a directory\n");
    const publicExampleAcquirer: SequencePublicExampleAcquirer = {
      acquire: async ({ exampleId }) => {
        await mkdir(examplesDirectory, { recursive: true });
        await writeFile(filePath, contents);
        const identity = await stat(filePath, { bigint: true });
        return {
          absolutePath: filePath,
          fileIdentity: {
            device: identity.dev.toString(),
            inode: identity.ino.toString(),
            modifiedAtNanoseconds: identity.mtimeNs.toString(),
            size: identity.size.toString(),
          },
          fileName: "NC_001416.1.gb",
          provenance: {
            artifactByteLength: Buffer.byteLength(contents),
            artifactRelativePath: "codex-viewer-examples/NC_001416.1.gb",
            artifactSha256: createHash("sha256").update(contents).digest("hex"),
            database: "NCBI Nuccore",
            exampleId,
            provenanceRelativePath:
              "codex-viewer-examples/NC_001416.1.gb.provenance.json",
            requestedIdentifier: "NC_001416.1",
            resolvedIdentifier: "NC_001416.1",
            subset: null,
          },
        };
      },
    };
    const client = new Client(
      { name: "sequence-viewer-test", version: "0.1.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(workspace).href }],
    }));
    const server = createSequenceViewerServer({
      publicExampleAcquirer,
      stateDirectory,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const result = await client.callTool({
        arguments: { exampleId: "ncbi-nc-001416-1" },
        name: SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
      });
      expect(result).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining(
              "Codex local state is writable and retry",
            ),
          }),
        ],
        isError: true,
      });
      expect(result).not.toHaveProperty("structuredContent.viewerSessionId");
      expect(JSON.stringify(result)).not.toContain(workspace);
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it.each([
    "after-acquirer-resolution",
    "after-workspace-binding",
    "after-handle-persistence",
  ] as const)(
    "cleans public-example state when cancellation arrives %s",
    async (phase) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-public-cancel-"),
      );
      const stateDirectory = path.join(workspace, ".viewer-state");
      const examplesDirectory = path.join(workspace, "codex-viewer-examples");
      const filePath = path.join(examplesDirectory, "NC_001416.1.gb");
      const contents = "LOCUS       validated\nORIGIN\n        1 acgt\n//\n";
      await mkdir(examplesDirectory);
      await writeFile(filePath, contents);
      const identity = await stat(filePath, { bigint: true });
      let requestSignal: AbortSignal | undefined;
      const publicExampleAcquirer: SequencePublicExampleAcquirer = {
        acquire: async ({ exampleId }, extra) => {
          requestSignal = extra.signal;
          return {
            absolutePath: filePath,
            fileIdentity: {
              device: identity.dev.toString(),
              inode: identity.ino.toString(),
              modifiedAtNanoseconds: identity.mtimeNs.toString(),
              size: identity.size.toString(),
            },
            fileName: "NC_001416.1.gb",
            provenance: {
              artifactByteLength: Buffer.byteLength(contents),
              artifactRelativePath: "codex-viewer-examples/NC_001416.1.gb",
              artifactSha256: createHash("sha256")
                .update(contents)
                .digest("hex"),
              database: "NCBI Nuccore",
              exampleId,
              provenanceRelativePath:
                "codex-viewer-examples/NC_001416.1.gb.provenance.json",
              requestedIdentifier: "NC_001416.1",
              resolvedIdentifier: "NC_001416.1",
              subset: null,
            },
          };
        },
      };
      const controller = new AbortController();
      const cancelRequest = async () => {
        controller.abort();
        if (requestSignal == null) {
          throw new Error(
            "The public-example request signal was not captured.",
          );
        }
        if (requestSignal.aborted) return;
        await new Promise<void>((resolve) =>
          requestSignal?.addEventListener("abort", () => resolve(), {
            once: true,
          }),
        );
      };
      let cancelledSessionId: string | undefined;
      const workspacePublisher = new TrackingWorkspacePublisher();
      const server = createSequenceViewerServer({
        publicExampleAcquirer,
        publicExampleLifecycleHooks: {
          afterAcquisition:
            phase === "after-acquirer-resolution" ? cancelRequest : undefined,
          afterBinding:
            phase === "after-workspace-binding"
              ? async (sessionId) => {
                  cancelledSessionId = sessionId;
                  await cancelRequest();
                }
              : undefined,
          afterHandleOpen:
            phase === "after-handle-persistence"
              ? async (sessionId) => {
                  cancelledSessionId = sessionId;
                  await cancelRequest();
                }
              : undefined,
        },
        stateDirectory,
        workspacePublisher,
      });
      const client = new Client(
        { name: "sequence-viewer-test", version: "0.1.0" },
        { capabilities: { roots: {} } },
      );
      client.setRequestHandler(ListRootsRequestSchema, async () => ({
        roots: [{ uri: pathToFileURL(workspace).href }],
      }));
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ]);
      try {
        await expect(
          client.callTool(
            {
              arguments: { exampleId: "ncbi-nc-001416-1" },
              name: SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
            },
            undefined,
            { signal: controller.signal },
          ),
        ).rejects.toThrow("AbortError");

        if (cancelledSessionId == null) {
          expect(workspacePublisher.bindCalls).toBe(0);
        } else {
          await vi.waitFor(() =>
            expect(workspacePublisher.clearedSessions).toContain(
              cancelledSessionId,
            ),
          );
          expect(workspacePublisher.boundSessions).not.toContain(
            cancelledSessionId,
          );
          await vi.waitFor(async () => {
            const waitResult = await client.callTool({
              arguments: {
                afterRevision: 0,
                sessionId: cancelledSessionId,
                timeoutMs: 1_000,
              },
              name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
            });
            expect(waitResult).toMatchObject({
              content: [
                expect.objectContaining({
                  text: expect.stringContaining(
                    "viewer session is no longer active",
                  ),
                }),
              ],
              isError: true,
            });
          });
        }

        await vi.waitFor(async () => {
          const entries = await readdir(stateDirectory).catch(
            (error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") return [];
              throw error;
            },
          );
          expect(entries.filter((entry) => entry.endsWith(".json"))).toEqual(
            [],
          );
        });
      } finally {
        await client.close();
        await server.close();
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("opens an exact absolute path when the MCP host does not expose roots", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-test-"),
    );
    const filePath = path.join(workspace, "family.aln-fasta");
    await writeFile(filePath, ">demo\nACGT\n");
    const client = new Client({
      name: "sequence-viewer-test",
      version: "0.1.0",
    });
    const server = createSequenceViewerServer({
      stateDirectory: path.join(workspace, ".viewer-state"),
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      const result = await client.callTool({
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        arguments: { path: filePath },
      });
      expect(result).toEqual(
        expect.objectContaining({
          structuredContent: {
            schemaVersion: 1,
            viewerCommandRevision: 0,
            sessionReady: true,
            viewerReady: false,
            viewerSessionId: expect.any(String),
          },
        }),
      );
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it.each(CODEX_MANAGED_PUBLIC_EXAMPLES)(
    "opens a Codex-downloaded $database $format through the real rootless MCP lifecycle",
    async (example) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-codex-public-example-"),
      );
      const examplesDirectory = path.join(workspace, "codex-viewer-examples");
      const stateDirectory = path.join(workspace, ".viewer-state");
      const sourcePath = path.join(examplesDirectory, example.fileName);
      const provenancePath = `${sourcePath}.provenance.json`;
      const sourceContents = example.contents();
      const sourceSha256 = createHash("sha256")
        .update(sourceContents)
        .digest("hex");
      expect(sourceSha256).toBe(example.sha256);

      if (example.format === "fastq" || example.format === "genbank") {
        const parsed = parseSequenceDocumentResult({
          contents: sourceContents,
          fileName: example.fileName,
        });
        expect(parsed.status).toBe("success");
        if (parsed.status !== "success") {
          throw new Error(parsed.message);
        }
        expect(parsed.document.format).toBe(example.format);
        if (example.format === "fastq") {
          expect(parsed.document.fastqSummary?.readCount).toBe(3);
        } else {
          expect(parsed.document.records[0]).toMatchObject({
            length: 513,
            metadata: {
              version: expect.stringMatching(/^X55053\.1(?:\s|$)/u),
            },
          });
        }
      } else {
        const parsed = parseMsa(sourceContents, example.fileName);
        expect(parsed.status).toBe("success");
        if (parsed.status !== "success") {
          throw new Error(parsed.message);
        }
        expect(parsed.document.rows).toHaveLength(3);
        if (example.format === "aligned-fasta") {
          expect(parsed.document.alignedLength).toBe(191);
          expect(parsed.document.rows.map(({ label }) => label)).toEqual([
            "P01116",
            "P01111",
            "P01112",
          ]);
        }
      }

      // Codex, not the plugin, already has permission to create these files.
      await mkdir(examplesDirectory, { mode: 0o700 });
      await writeFile(sourcePath, sourceContents, {
        flag: "wx",
        mode: 0o600,
      });
      const provenanceContents = `${JSON.stringify(
        {
          acquiredBy: "codex-host",
          database: example.database,
          identifier: example.identifier,
          sha256: sourceSha256,
          sourceUrl: example.sourceUrl,
        },
        null,
        2,
      )}\n`;
      await writeFile(provenancePath, provenanceContents, {
        flag: "wx",
        mode: 0o600,
      });
      expect(provenanceContents).not.toContain(workspace);

      const publicExampleAcquirer: SequencePublicExampleAcquirer = {
        acquire: vi.fn(async () => {
          throw new Error(
            "Codex-managed starters never invoke plugin acquisition.",
          );
        }),
      };
      const workspacePublisher = new TrackingWorkspacePublisher();
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(
          new Error("Rootless viewer opens never use the network."),
        );
      const client = new Client({
        name: "sequence-viewer-rootless-codex-host-test",
        version: "1.0.0",
      });
      const server = createSequenceViewerServer({
        publicExampleAcquirer,
        stateDirectory,
        workspacePublisher,
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();

      try {
        await Promise.all([
          client.connect(clientTransport),
          server.connect(serverTransport),
        ]);
        const opened = await client.callTool({
          arguments: { path: sourcePath },
          name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        });
        expect(opened.isError).not.toBe(true);
        expect(opened.structuredContent).toMatchObject({
          viewerCommandRevision: 0,
          sessionReady: true,
          viewerReady: false,
          viewerSessionId: expect.any(String),
        });
        expect(
          opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
        ).toBeUndefined();
        expect(JSON.stringify(opened)).not.toContain(workspace);
        expect(JSON.stringify(opened)).not.toContain(sourcePath);

        const viewerFile = opened._meta?.[
          SEQUENCE_VIEWER_CHAT_FILE_META_KEY
        ] as { primaryFile?: { name?: string; uri?: string } } | undefined;
        expect(viewerFile?.primaryFile).toEqual({
          name: example.fileName,
          uri: expect.stringMatching(
            new RegExp(`^${SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI}/`),
          ),
        });
        const resource = await client.readResource({
          uri: viewerFile?.primaryFile?.uri ?? "",
        });
        expect(resource.contents).toEqual([
          expect.objectContaining({ text: sourceContents }),
        ]);
        expect(JSON.stringify(resource)).not.toContain(workspace);

        const viewerSessionId = (
          opened.structuredContent as { viewerSessionId: string }
        ).viewerSessionId;
        const sessionRecords = (await readdir(stateDirectory)).filter((name) =>
          name.endsWith(".json"),
        );
        expect(sessionRecords).toHaveLength(1);
        const sessionRecord = JSON.parse(
          await readFile(path.join(stateDirectory, sessionRecords[0]!), "utf8"),
        ) as { sessionId?: string; workspaceRoot?: string | null };
        expect(sessionRecord.sessionId).toBe(viewerSessionId);
        expect(sessionRecord.workspaceRoot).toBeNull();
        expect(workspacePublisher.bindCalls).toBe(0);
        expect(publicExampleAcquirer.acquire).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();

        if (example.format === "aligned-fasta") {
          const parsed = parseMsa(sourceContents, example.fileName);
          if (parsed.status !== "success") {
            throw new Error(parsed.message);
          }
          const tree = buildGuideTree(parsed.document.rows, "neighbor-joining");
          expect(tree.newick).toBe(
            "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);",
          );
          const outputContents = `${tree.newick}\n`;
          const outputSha256 = createHash("sha256")
            .update(outputContents)
            .digest("hex");
          const rejectedPluginExport = await client.callTool({
            arguments: {
              byteLength: Buffer.byteLength(outputContents),
              destination: {
                base: "opened-source",
                kind: "workspace",
                relativePath: "RAS-P01116-P01111-P01112-NJ.nwk",
              },
              format: "newick",
              mediaType: "text/plain",
              name: "RAS-P01116-P01111-P01112-NJ.nwk",
              provenance: {
                engine: "sequence-viewer-guide-tree-v1",
                parameters: { algorithm: tree.algorithm },
                sourceRevision: 0,
              },
              sessionId: viewerSessionId,
              sha256: outputSha256,
            },
            name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
          });
          expect(rejectedPluginExport).toMatchObject({ isError: true });
          expect(rejectedPluginExport.structuredContent).toBeUndefined();

          // The authenticated Codex caller can still publish the small result
          // itself; the viewer never receives invented workspace authority.
          const outputPath = path.join(
            examplesDirectory,
            "RAS-P01116-P01111-P01112-NJ.nwk",
          );
          await writeFile(outputPath, outputContents, {
            flag: "wx",
            mode: 0o600,
          });
          await writeFile(
            `${outputPath}.provenance.json`,
            `${JSON.stringify({
              algorithm: tree.algorithm,
              distance: tree.distance,
              outputSha256,
              publishedBy: "codex-host",
              sourceSha256,
              warning: tree.warning,
            })}\n`,
            { flag: "wx", mode: 0o600 },
          );
          await expect(readFile(outputPath, "utf8")).resolves.toBe(
            outputContents,
          );
          expect(workspacePublisher.bindCalls).toBe(0);
        }

        await expect(readFile(sourcePath, "utf8")).resolves.toBe(
          sourceContents,
        );
        await expect(readFile(provenancePath, "utf8")).resolves.toBe(
          provenanceContents,
        );
      } finally {
        fetchSpy.mockRestore();
        await client.close();
        await server.close();
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("rejects a relative Codex-downloaded source when the MCP host has no roots", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-rootless-relative-"),
    );
    const examplesDirectory = path.join(workspace, "codex-viewer-examples");
    const stateDirectory = path.join(workspace, ".viewer-state");
    await mkdir(examplesDirectory);
    await writeFile(
      path.join(examplesDirectory, "SRR014849-first-3.fastq"),
      PUBLIC_ARCHIVE_FASTQ,
    );
    const client = new Client({
      name: "sequence-viewer-rootless-relative-test",
      version: "1.0.0",
    });
    const server = createSequenceViewerServer({ stateDirectory });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ]);
      const rejected = await client.callTool({
        arguments: { path: "codex-viewer-examples/SRR014849-first-3.fastq" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(rejected).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining(
              "Relative paths require active local workspace roots",
            ),
          }),
        ],
        isError: true,
      });
      expect(rejected.structuredContent).toBeUndefined();
      expect(rejected._meta).toBeUndefined();
      await expect(readdir(stateDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await client.close();
      await server.close();
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects a Codex-downloaded absolute source outside independently granted roots", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-codex-foreign-root-"),
    );
    const grantedRoot = path.join(directory, "authorized-workspace");
    const foreignRoot = path.join(directory, "foreign-workspace");
    const stateDirectory = path.join(directory, ".viewer-state");
    await Promise.all([
      mkdir(grantedRoot),
      mkdir(path.join(foreignRoot, "codex-viewer-examples"), {
        recursive: true,
      }),
    ]);
    const foreignSourcePath = path.join(
      foreignRoot,
      "codex-viewer-examples",
      "SRR014849-first-3.fastq",
    );
    await writeFile(foreignSourcePath, PUBLIC_ARCHIVE_FASTQ);
    const client = new Client(
      { name: "sequence-viewer-codex-foreign-root-test", version: "1.0.0" },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(grantedRoot).href }],
    }));
    const server = createSequenceViewerServer({ stateDirectory });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    try {
      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ]);
      const rejected = await client.callTool({
        arguments: { path: foreignSourcePath },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(rejected).toMatchObject({
        content: [
          expect.objectContaining({
            text: expect.stringContaining(
              "inside the active local workspace roots",
            ),
          }),
        ],
        isError: true,
      });
      expect(rejected.structuredContent).toBeUndefined();
      expect(rejected._meta).toBeUndefined();
      expect(JSON.stringify(rejected)).not.toContain(PUBLIC_ARCHIVE_FASTQ);
      await expect(readdir(stateDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await client.close();
      await server.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps host file hints basename-only", () => {
    expect(
      sequenceOpenToolInputSchema.safeParse({
        file: {
          name: "demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      }).success,
    ).toBe(true);
    expect(
      sequenceOpenToolInputSchema.safeParse({
        file: {
          name: "../demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      }).success,
    ).toBe(false);
  });

  it("returns a pending viewer and hidden source metadata when the chat session is created", () => {
    const input = sequenceOpenFromChatToolInputSchema.parse({
      path: "results/family.aln-fasta",
    });
    const viewerFile = {
      primaryFile: {
        name: "family.aln-fasta",
        uri: "viewer-file://sequence-viewer/opened/token",
      },
    };

    const session = {
      revision: 0,
      sessionId: "11111111-1111-4111-8111-111111111111",
    };
    expect(
      createSequenceOpenFromChatToolResult(input, viewerFile, session),
    ).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("is opening"),
        },
      ],
      structuredContent: {
        schemaVersion: 1,
        sessionReady: true,
        viewerCommandRevision: 0,
        viewerReady: false,
        viewerSessionId: session.sessionId,
      },
      _meta: {
        [SEQUENCE_VIEWER_CHAT_FILE_META_KEY]: viewerFile,
        "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
      },
    });
  });

  it("supports optional reversible inline or full viewer presentation", () => {
    const viewerFile = {
      primaryFile: {
        name: "family.fasta",
        uri: "viewer-file://sequence-viewer/opened/token",
      },
    };
    const session = {
      revision: 0,
      sessionId: "11111111-1111-4111-8111-111111111111",
    };

    for (const presentation of ["full", "inline"] as const) {
      const input = sequenceOpenFromChatToolInputSchema.parse({
        path: "results/family.fasta",
        presentation,
      });
      expect(
        createSequenceOpenFromChatToolResult(input, viewerFile, session),
      ).toMatchObject({
        structuredContent: { viewerPresentation: presentation },
      });
    }
    expect(
      sequenceOpenFromChatToolInputSchema.safeParse({
        path: "results/family.fasta",
        presentation: "fullscreen",
      }).success,
    ).toBe(false);
  });

  it("rejects non-local chat paths", () => {
    expect(
      sequenceOpenFromChatToolInputSchema.safeParse({
        path: "results/broken\nfile.fasta",
      }).success,
    ).toBe(false);
    expect(
      sequenceOpenFromChatToolInputSchema.safeParse({
        path: "file:///workspace/results/family.fasta",
      }).success,
    ).toBe(false);
  });

  it("returns structured tool input and loads the compressed app from a blob URL", () => {
    expect(
      createSequenceOpenToolResult({
        file: {
          name: "demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      }),
    ).toEqual({
      content: [],
      structuredContent: {
        file: {
          name: "demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      },
    });
    const appJavaScriptGzipBase64 = gzipSync(
      "console.log('sequence viewer');\n",
    ).toString("base64");
    const html = createSequenceViewerHtml({
      appJavaScriptGzipBase64,
      styles: "body::after { content: '</style>'; }",
    });

    expect(html).toContain("<style>");
    expect(html).toContain('<script type="module">');
    expect(html).toContain("<\\/style>");
    expect(html).toContain(appJavaScriptGzipBase64);
    expect(html).toContain('new DecompressionStream("gzip")');
    expect(html).toContain("URL.createObjectURL(");
    expect(html).toContain("await import(appJavaScriptUrl)");
    expect(html).toContain("URL.revokeObjectURL(appJavaScriptUrl)");
    expect(html).toContain("atob(compressedBase64)");
    expect(html).not.toContain("http://127.0.0.1");
    expect(html).not.toContain("href=");
    expect(createSequenceViewerCsp()).toEqual({
      connectDomains: [],
      resourceDomains: ["blob:"],
    });
  });

  it("embeds every exact application byte for bounded, server-independent cold recovery", () => {
    const applicationBytes = Buffer.concat(
      Array.from({ length: 1_536 }, (_, index) =>
        createHash("sha256")
          .update(`sequence-viewer-cold-recovery-${index}`)
          .digest(),
      ),
    );
    const compressedApplication = gzipSync(applicationBytes);
    const html = createSequenceViewerHtml({
      appJavaScriptGzipBase64: compressedApplication.toString("base64"),
      styles: "body { color: inherit; }",
    });
    const embedded = html.match(
      /const compressedBase64 = \[([^\]]+)\]\.join\(""\)/u,
    );
    if (embedded?.[1] == null) {
      throw new Error("The recoverable application bundle was not embedded.");
    }
    const chunks: unknown = JSON.parse(`[${embedded[1]}]`);
    if (
      !Array.isArray(chunks) ||
      chunks.some((chunk) => typeof chunk !== "string")
    ) {
      throw new Error("The recoverable application chunks were not authentic.");
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 32_768)).toBe(true);
    const recoveredCompressedBytes = Buffer.from(chunks.join(""), "base64");
    expect(recoveredCompressedBytes).toEqual(compressedApplication);
    expect(gunzipSync(recoveredCompressedBytes)).toEqual(applicationBytes);
    expect(Buffer.byteLength(html)).toBeLessThan(4 * 1_024 * 1_024);
    expect(html).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|get_viewer_bundle_|resources\/read|tools\/call|localhost|127\.0\.0\.1/u,
    );
  });
});

function validWorkspaceSession(): string {
  return JSON.stringify({
    artifacts: [],
    createdAt: 1,
    dirty: false,
    jobs: [],
    revision: 0,
    schemaVersion: 1,
    source: {
      fileName: "family.fasta",
      format: "fasta",
      stateKey: "source-state",
    },
    tracks: [],
    view: {
      mode: "sequence",
      sequence: {
        geneticCodeId: 1,
        layout: "linear",
        orientation: "forward",
        paletteId: "neutral",
        selectedFeatureId: null,
        selectedRecordId: "source",
        selection: null,
        showFeatures: true,
        showQuality: true,
        showTranslation: true,
        synchronizedViews: true,
        viewport: null,
        wrapWidth: 60,
      },
    },
  });
}
