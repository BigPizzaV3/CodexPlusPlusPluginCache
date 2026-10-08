import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBiologicalSequenceViewerModel } from "../biological-sequence-viewer-model";
import {
  parseBinarySequenceEnvelope,
  serializeBinarySequenceEnvelope,
} from "../binary-sequence-envelope";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  makeSyntheticSnapGene,
} from "../sequence/__fixtures__/chromatogram";
import { serializeIndexedSequenceEnvelope } from "../indexed-sequence-envelope";
import { parseIndexedSequenceLines } from "../indexed-sequence-parser";
import {
  ScientificSequenceDataClient,
  type SequenceScientificDataTransport,
} from "../persistent/scientific-data-client";
import { parseSequenceDocument } from "../sequence/parser";
import { PerformanceBanners } from "../sequence/performance-banners";
import {
  createModelContextUpdater,
  loadSequenceViewerResource,
  parseSequenceViewerToolInput,
  parseSequenceViewerToolResultMetadata,
  parseSequenceViewerToolResultSession,
  readHostResourceText,
  renderSequenceViewerState,
} from "./app";

const renderedRoots: Array<Root> = [];

afterEach(async () => {
  await act(async () => {
    for (const root of renderedRoots.splice(0).reverse()) {
      root.unmount();
    }
  });
});

function createManagedRoot(element: HTMLElement): Root {
  const root = createRoot(element);
  renderedRoots.push(root);
  return root;
}

describe("sequence viewer app resource loading and initial rendering", () => {
  it.each([
    ["sample.ab1", "abif", makeSyntheticAbif()],
    ["sample.scf", "scf", makeSyntheticScf()],
    ["sample.dna", "snapgene", makeSyntheticSnapGene()],
  ] as const)(
    "loads actual binary %s resources with native trace or annotation data intact",
    async (name, format, bytes) => {
      const state = await loadSequenceViewerResource(
        { file: { name, resourceUri: "codex-resource://binary-source" } },
        async () => serializeBinarySequenceEnvelope(bytes),
      );
      expect(state.status).toBe("ready");
      if (state.status !== "ready") return;
      expect(state.model.availableModes).toEqual(["sequence"]);
      expect(state.model.sequenceDocument?.format).toBe(format);
      if (format === "snapgene") {
        expect(state.model.sequenceDocument?.records[0]).toMatchObject({
          topology: "circular",
          features: [expect.objectContaining({ start: 2, end: 8 })],
        });
      } else {
        expect(
          state.model.sequenceDocument?.records[0].chromatogram,
        ).toMatchObject({ sampleCount: 16, peakLocations: [2, 5, 8, 11, 14] });
      }
      expect(state.contents).not.toContain("OPENAI_SEQUENCE_VIEWER_BINARY");
    },
  );

  it("converts a single native binary blob to the byte-preserving resource envelope", async () => {
    const bytes = makeSyntheticAbif();
    const text = await readHostResourceText(
      {
        readServerResource: async () => ({
          contents: [
            {
              uri: "codex-resource://trace",
              mimeType: "application/octet-stream",
              blob: Buffer.from(bytes).toString("base64"),
            },
          ],
        }),
      },
      "codex-resource://trace",
    );
    expect(parseBinarySequenceEnvelope(text)).toEqual(bytes);
  });

  it("rejects mixed native binary/text resources and invalid binary contents without silently falling back", async () => {
    await expect(
      readHostResourceText(
        {
          readServerResource: async () => ({
            contents: [
              {
                uri: "codex-resource://mixed",
                blob: Buffer.from(makeSyntheticScf()).toString("base64"),
              },
              { uri: "codex-resource://mixed", text: ">misleading\nACGT" },
            ],
          }),
        },
        "codex-resource://mixed",
      ),
    ).rejects.toThrow(/exactly one binary/u);
    const state = await loadSequenceViewerResource(
      {
        file: { name: "invalid.ab1", resourceUri: "codex-resource://invalid" },
      },
      async () =>
        serializeBinarySequenceEnvelope(new TextEncoder().encode("ABIF")),
    );
    expect(state).toMatchObject({
      status: "error",
      message: expect.stringMatching(/truncated|outside/u),
    });
    const misleadingText = await loadSequenceViewerResource(
      {
        file: { name: "invalid.dna", resourceUri: "codex-resource://invalid" },
      },
      async () => ">not-binary\nACGT\n",
    );
    expect(misleadingText).toMatchObject({
      status: "error",
      message: expect.stringMatching(/delivered as text/u),
    });
  });

  it("validates safe tool inputs and loads host-managed sequence text", async () => {
    expect(
      parseSequenceViewerToolInput({
        file: {
          name: "demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      }),
    ).toEqual({
      file: {
        name: "demo.fasta",
        resourceUri: "codex-resource://demo",
      },
    });
    expect(
      parseSequenceViewerToolInput({
        file: {
          name: "../demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      }),
    ).toBeNull();

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "demo.fasta",
          resourceUri: "codex-resource://demo",
        },
      },
      async () => ">demo\nACGT\n",
    );
    expect(state).toEqual(expect.objectContaining({ status: "ready" }));
    if (state.status === "ready") {
      expect(state.sourceStateKey).toContain("demo.fasta");
    }
  });

  it("loads BGZIP-compressed FASTQ previews with their measured qualities", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          complete: true,
          cursor: "0",
          nextCursor: null,
          records: [
            { description: "measured read", id: "read-1", sequenceLength: 4 },
          ],
          sourceRevision: "native-source-revision",
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          quality: "IIII",
          sequence: "ACGT",
          sourceRevision: "native-source-revision",
        },
      });
    const readText = vi.fn();
    const client = new ScientificSequenceDataClient(
      { request },
      {
        backendGeneration: 2,
        backendInstanceId: "native-sequence-worker",
        family: "sequence",
        logicalSessionId: "native-logical-session",
        sourceRevision: "native-source-revision",
      },
    );

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "reads.fastq.bgzip",
          resourceUri: "viewer-file://sequence-viewer/opened/bgzip-source",
        },
      },
      readText,
      client,
    );

    expect(state).toMatchObject({
      contents: "@read-1 measured read\nACGT\n+\nIIII\n",
      status: "ready",
    });
    expect(request.mock.calls[1]?.[0]).toMatchObject({
      operation: "ui/scientific/sequence/window",
      payload: { includeQuality: true },
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("materializes a million-residue public GRCh37-derived FASTA through bounded source windows", async () => {
    // Controlled reconstruction: repeat genuine public GRCh37 chr1 excerpts;
    // this is not the original million-base biological reference.
    const publicReferenceExcerpt =
      "ACTAAAAAGGACAATTCACTACATATTATTCTCTTACAGTTTTTATGCCTCATTCTGTGAAAATTGCTGTAGTCTCTTCCAGTTATGAAGAAGGTAGGTGGAAACAAAGACAAAACACATATATTAGAAGAATGAATGAAATTGTAGCATTTTATTGACA";
    const publicReferenceTail =
      "CGGGGAGCGTTTTGACACCCTCGGAGACCCGGTGTAGCAGGAAGAGCCCATTGATGGGGAAGGTGGGGGCGGTTGTGCACCTCAAGCAGGTAAAAGCCCCTCCACAGGCACCAGGGCCGT";
    const interiorLength = 1_000_000 - 10_000 - publicReferenceTail.length;
    const reference =
      "N".repeat(10_000) +
      publicReferenceExcerpt
        .repeat(Math.ceil(interiorLength / publicReferenceExcerpt.length))
        .slice(0, interiorLength) +
      publicReferenceTail;
    const listRecords = vi
      .fn<ScientificSequenceDataClient["listRecords"]>()
      .mockResolvedValue({
        complete: true,
        cursor: "0",
        nextCursor: null,
        records: [
          {
            description: "public GRCh37 chromosome 1 fixture",
            id: "chr1",
            sequenceLength: reference.length,
          },
        ],
        sourceRevision: "public-reference-revision",
      });
    const readResidueWindow = vi
      .fn<ScientificSequenceDataClient["readResidueWindow"]>()
      .mockImplementation(async ({ end1Decimal, start1Decimal }) => ({
        sequence: reference.slice(
          Number(start1Decimal) - 1,
          Number(end1Decimal),
        ),
        sourceRevision: "public-reference-revision",
      }));
    const readText = vi.fn();

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "qa-broad-hg19-chr1-first-1m.fasta",
          resourceUri: "viewer-file://sequence-viewer/opened/public-reference",
        },
      },
      readText,
      { listRecords, readResidueWindow },
    );

    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.model.sequenceDocument?.records[0]).toMatchObject({
      id: "chr1",
      length: 1_000_000,
      sequence: reference,
    });
    expect(state.model.sequenceDocument?.recordInventory).toEqual({
      materializedCount: 1,
      totalCount: 1,
      truncated: false,
    });
    expect(readResidueWindow).toHaveBeenCalledTimes(16);
    expect(readResidueWindow.mock.calls[0]?.[0]).toMatchObject({
      end1Decimal: "65536",
      recordNumber: 1,
      start1Decimal: "1",
    });
    expect(readResidueWindow.mock.calls.at(-1)?.[0]).toMatchObject({
      end1Decimal: "1000000",
      recordNumber: 1,
      start1Decimal: "983041",
    });
    for (const [request] of readResidueWindow.mock.calls) {
      expect(
        Number(request.end1Decimal) - Number(request.start1Decimal) + 1,
      ).toBeLessThanOrEqual(64 * 1_024);
    }
    expect(readText).not.toHaveBeenCalled();
  });

  it("pages all 85 authentic Arabidopsis chloroplast protein accessions without fabricating the source count", async () => {
    // Each accession and its 16-residue prefix come from the public
    // Arabidopsis thaliana chloroplast protein fixture.
    const publicProteinPrefixes = `NP_051037.1:MPTIKQLIRNTRQPIR
NP_051039.1:MTAILERRESESLWGR
NP_051040.2:MDKFQGYLEFDGARQQ
NP_051041.1:MVKLRLKRCGRKQRAV
NP_051042.1:MLNIFNLICIFFNSTL
NP_051043.1:MLTLKLFVYTVVIFFV
NP_051044.1:MVTIRADEISNIIRER
NP_051045.1:MKNLTDSFVYLGHWPS
NP_051046.1:MNPLVSAASVIAAGLA
NP_051047.1:MNVLSCSINTLIKEGL
NP_051048.1:MTKRYWNIDLEEMMRA
NP_051049.1:MAERANLVFHNKVIDG
NP_051050.1:MIDRYKHQQLRIGLVS
NP_051051.1:MLGDEKEGTSAIPGFN
NP_051052.1:MDIVSLAWAALMVVFT
NP_051053.1:MEVNILAFIATALFIL
NP_051054.1:MTIALGKFTKDEKDLF
NP_051055.1:MKTLYSLRRFYHVETL
NP_051056.1:MTIAFQLAVFALIITS
NP_051057.1:MAKKSLIYREKKRQKL
NP_051058.1:MALRFPRFSQGLAQDP
NP_051059.1:MIIRSPEPEVKILVDR
NP_051060.2:MPRSRINGNFIDKTFT
NP_051061.1:MSRYRGPRFKKIRRLG
NP_051062.1:MQGTLSVWLAKRGLVH
NP_051063.1:MNSIKFPILDRTTKNS
NP_051064.1:MFLLYEYDIFWAFLLI
NP_051065.1:MTLNLCVLTPNRIVWD
NP_051066.1:MRTNPTTSNPEVSIRE
NP_051067.1:MSPQTETKASVGFKAG
NP_051068.1:MEKSWFNFMFSKGELE
NP_051069.1:MTTFNNLPSIFVPLVG
NP_051070.1:MSWRSESIWIEFITGS
NP_051071.1:MAKKKAFIPFFYFLSI
NP_051072.1:MQTRNTFSWIREEITR
NP_051073.1:MADTTGRIPLWVIGTV
NP_051074.1:MTQSNPNEQSVELNRT
NP_051075.1:MTIDRTYPIFTVRWLA
NP_051076.1:MSGSTGERSFADIITS
NP_051077.1:MPTITSYFGFLLAALT
NP_051078.1:MIEVFLFGIVLGLIPI
NP_051079.1:MRDLKTYLSVAPVLST
NP_051080.1:MAKGKDVRVTIILECT
NP_051081.1:MNKSKRLFTKSKRSFR
NP_051082.1:MTRIKRGYIARRRRTK
NP_051038.1:MPTIKQLIRNTRQPIR
NP_051083.1:MPIGVPKVPFRSPGEG
NP_051084.1:MGLPWYRVHTVVLNDP
NP_051085.1:MEALVYTFLLVSTLGI
NP_051086.1:METATLVAIFISGLLV
NP_051087.1:MATQTVEDSSRSGPRS
NP_051088.1:MSKVYDWFEERLEIQA
NP_051089.1:MGVTKKPDLNDPVLRA
NP_051090.1:MVREKVKVSTRTLQWK
NP_051091.1:MAKPILRIGSRKNTRS
NP_051092.1:MKIRASVRKICEKCRL
NP_051093.1:MGKDTIADIITSIRNA
NP_051094.1:MIQPQTYLNVADNSGA
NP_051095.1:MLSPKRTRFRKQHRGR
NP_051096.1:MGQKINPLGFRLGTTQ
NP_051097.1:MIKKRKKKSYTEVYAL
NP_051098.1:MTRSLKKNPFVAKHLL
NP_051099.1:MAIHLYKTSTPSTRNG
NP_051100.1:MDGIKYAVFTDKSIRL
NP_051101.1:MKGHQFKSWIFELREI
NP_051103.2:MIWHVQNENFILDSTR
NP_051104.1:MSRRGTAEEKTAKSDP
NP_051105.1:MMVFQSFILGNLVSLC
NP_051106.1:MEHTYQYSWIIPFIPL
NP_051107.1:MAVPKKRTSISKKRIR
NP_051108.1:MIFSILEHILTHISFS
NP_051109.2:MNDFPWLTIIVVFPIS
NP_051110.1:MSHSVKIYDTCIGCTQ
NP_051111.1:MILEHVLVLSAYLFLI
NP_051112.1:MDLPGPIHDFLLVFLG
NP_051113.1:MLPMITGFMNYGQQTL
NP_051114.1:MIIYATAVQTINSFVK
NP_051115.1:MKRPVTGKDLMIVNMG
NP_051116.1:MIKNIVISFEEQKEES
NP_051117.1:MMVFQSFILGNLVSLC
NP_051118.1:MSRRGTAEEKTAKSDP
NP_051119.2:MIWHVQNENFILDSTR
NP_051121.1:MKGHQFKSWIFELREI
NP_051122.1:MDGIKYAVFTDKSIRL
NP_051123.1:MAIHLYKTSTPSTRNG`;
    const sourceRecords = publicProteinPrefixes
      .split("\n")
      .map((line) => {
        const [id, sequence] = line.split(":");
        return { id: id!, sequence: sequence! };
      });
    expect(sourceRecords).toHaveLength(85);
    const listRecords = vi
      .fn<ScientificSequenceDataClient["listRecords"]>()
      .mockImplementation(async ({ cursor }) => {
        const offset = cursor == null ? 0 : Number(cursor);
        const records = sourceRecords.slice(offset, offset + 32);
        const nextOffset = offset + records.length;
        return {
          complete: nextOffset === sourceRecords.length,
          cursor: String(offset),
          nextCursor:
            nextOffset === sourceRecords.length ? null : String(nextOffset),
          records: records.map(({ id, sequence }) => ({
            description: "Arabidopsis thaliana chloroplast protein",
            id,
            sequenceLength: sequence.length,
          })),
          sourceRevision: "public-chloroplast-revision",
        };
      });
    const readResidueWindow = vi
      .fn<ScientificSequenceDataClient["readResidueWindow"]>()
      .mockImplementation(async ({ recordNumber }) => ({
        sequence: sourceRecords[recordNumber - 1]!.sequence,
        sourceRevision: "public-chloroplast-revision",
      }));

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "chloroplast-genes-proteins.faa",
          resourceUri: "viewer-file://sequence-viewer/opened/chloroplast",
        },
      },
      vi.fn(),
      { listRecords, readResidueWindow },
    );

    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.model.sequenceDocument?.recordInventory).toEqual({
      materializedCount: 85,
      totalCount: 85,
      truncated: false,
    });
    expect(state.model.sequenceDocument?.records).toHaveLength(85);
    expect(state.model.sequenceDocument?.records[32]).toMatchObject({
      id: "NP_051070.1",
      sequence: "MSWRSESIWIEFITGS",
    });
    expect(state.model.sequenceDocument?.records.at(-1)?.id).toBe(
      "NP_051123.1",
    );
    expect(listRecords.mock.calls).toEqual([
      [{ limit: 256 }],
      [{ cursor: "32", limit: 256 }],
      [{ cursor: "64", limit: 256 }],
    ]);
    expect(readResidueWindow).toHaveBeenCalledTimes(85);
  });

  it.each([512 * 1_024 * 1_024 + 1, 1_024 ** 3 + 1, 8 * 1_024 ** 3])(
    "keeps a %i-residue indexed FASTA within one bounded preview window",
    async (sourceLength) => {
      const publicResiduePrefix = "MPTIKQLIRNTRQPIR".repeat(4_096);
      const listRecords = vi
        .fn<ScientificSequenceDataClient["listRecords"]>()
        .mockResolvedValue({
          complete: true,
          cursor: "0",
          nextCursor: null,
          records: [
            {
              description: "public-source bounded stress fixture",
              id: "NP_051037.1",
              sequenceLength: sourceLength,
            },
          ],
          sourceRevision: "bounded-giant-source",
        });
      const readResidueWindow = vi
        .fn<ScientificSequenceDataClient["readResidueWindow"]>()
        .mockResolvedValue({
          sequence: publicResiduePrefix,
          sourceRevision: "bounded-giant-source",
        });

      const state = await loadSequenceViewerResource(
        {
          file: {
            name: "bounded-public-protein.faa",
            resourceUri: "viewer-file://sequence-viewer/opened/bounded-giant",
          },
        },
        vi.fn(),
        { listRecords, readResidueWindow },
      );

      expect(state.status).toBe("ready");
      if (state.status !== "ready") return;
      expect(state.model.sequenceDocument?.recordInventory).toEqual({
        materializedCount: 1,
        totalCount: 1,
        truncated: true,
      });
      expect(state.model.sequenceDocument?.records[0]).toMatchObject({
        length: 65_536,
        metadata: {
          indexed_preview: "true",
          indexed_source_length: sourceLength.toString(),
        },
      });
      expect(readResidueWindow).toHaveBeenCalledOnce();
      expect(readResidueWindow).toHaveBeenCalledWith({
        end1Decimal: "65536",
        includeQuality: false,
        recordNumber: 1,
        start1Decimal: "1",
      });
    },
  );

  it("keeps measured FASTQ qualities aligned across bounded residue windows", async () => {
    const sequence = "ACTG".repeat(20_000);
    const quality = "I".repeat(65_536) + "!".repeat(sequence.length - 65_536);
    const listRecords = vi
      .fn<ScientificSequenceDataClient["listRecords"]>()
      .mockResolvedValue({
        complete: true,
        cursor: "0",
        nextCursor: null,
        records: [{ description: "", id: "measured", sequenceLength: 80_000 }],
        sourceRevision: "public-fastq-revision",
      });
    const readResidueWindow = vi
      .fn<ScientificSequenceDataClient["readResidueWindow"]>()
      .mockImplementation(async ({ end1Decimal, start1Decimal }) => {
        const start = Number(start1Decimal) - 1;
        const end = Number(end1Decimal);
        return {
          quality: quality.slice(start, end),
          sequence: sequence.slice(start, end),
          sourceRevision: "public-fastq-revision",
        };
      });

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "public-measured.fastq",
          resourceUri: "viewer-file://sequence-viewer/opened/measured-fastq",
        },
      },
      vi.fn(),
      { listRecords, readResidueWindow },
    );

    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.model.sequenceDocument?.records[0]).toMatchObject({
      length: 80_000,
      quality: { ascii: quality },
      sequence,
    });
    expect(readResidueWindow).toHaveBeenCalledTimes(2);
    expect(readResidueWindow.mock.calls[1]?.[0]).toMatchObject({
      end1Decimal: "80000",
      includeQuality: true,
      start1Decimal: "65537",
    });
  });

  it("rejects an indexed source whose record cursor does not advance", async () => {
    const listRecords = vi
      .fn<ScientificSequenceDataClient["listRecords"]>()
      .mockResolvedValue({
        complete: false,
        cursor: "stalled",
        nextCursor: "stalled",
        records: [{ description: "", id: "alpha", sequenceLength: 4 }],
        sourceRevision: "stalled-source-revision",
      });
    const readResidueWindow = vi.fn();

    await expect(
      loadSequenceViewerResource(
        {
          file: {
            name: "public.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/stalled",
          },
        },
        vi.fn(),
        { listRecords, readResidueWindow },
      ),
    ).resolves.toEqual({
      message: "The indexed Sequence record cursor did not advance.",
      status: "error",
    });
    expect(readResidueWindow).not.toHaveBeenCalled();
  });

  it("describes oversized FASTA previews without mislabeling them as FASTQ reads", async () => {
    const document = parseSequenceDocument({
      contents: ">NP_051037.1\nMPTIKQLIRNTRQPIR\n",
      fileName: "chloroplast-genes-proteins.faa",
    });
    document.records[0]!.metadata = {
      indexed_preview: "true",
      indexed_source_length: "1000000",
    };
    document.recordInventory = {
      materializedCount: 1,
      totalCount: 85,
      truncated: true,
    };
    const rootElement = globalThis.document.createElement("div");
    globalThis.document.body.append(rootElement);
    const root = createManagedRoot(rootElement);

    await act(async () => {
      root.render(<PerformanceBanners document={document} />);
    });

    expect(rootElement).toHaveTextContent(
      "Large FASTA optimized mode: indexed 85 sequence records; interactive browsing retains the first 1 within the documented memory budget.",
    );
    expect(rootElement).toHaveTextContent(
      "The first record retains 16 of 1,000,000 residues.",
    );
    expect(rootElement).not.toHaveTextContent("FASTQ");
    expect(rootElement).not.toHaveTextContent("parsed reads");
  });

  it("states when native FASTQ quality statistics cover only retained reads", async () => {
    const document = parseSequenceDocument({
      contents: "@public-read\nACGT\n+\nIIII\n",
      fileName: "public.fastq",
    });
    document.recordInventory = {
      materializedCount: 1,
      totalCount: 6_001,
      truncated: true,
    };
    const rootElement = globalThis.document.createElement("div");
    globalThis.document.body.append(rootElement);
    const root = createManagedRoot(rootElement);

    await act(async () => {
      root.render(<PerformanceBanners document={document} />);
    });

    expect(rootElement).toHaveTextContent(
      "Large FASTQ optimized mode: summary statistics cover the first 1 of 6,001 indexed reads; interactive browsing retains the first 1 within the documented memory budget.",
    );
    expect(rootElement).not.toHaveTextContent("cover all 6,001");
  });

  it("preserves the GenBank parser when native indexing supports only FASTA and FASTQ", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const readText = vi
      .fn()
      .mockResolvedValue(
        "LOCUS       DEMO       4 bp    DNA     linear\nACCESSION   DEMO1\nORIGIN\n        1 acgt\n//\n",
      );
    const client = new ScientificSequenceDataClient(
      { request },
      {
        backendGeneration: 2,
        backendInstanceId: "native-sequence-worker",
        family: "sequence",
        logicalSessionId: "native-logical-session",
        sourceRevision: "native-source-revision",
      },
    );

    const state = await loadSequenceViewerResource(
      {
        file: {
          name: "annotated.gb",
          resourceUri: "viewer-file://sequence-viewer/opened/genbank-source",
        },
      },
      readText,
      client,
    );

    expect(state).toMatchObject({
      model: { sequenceDocument: { records: [{ id: "DEMO1" }] } },
      status: "ready",
    });
    expect(readText).toHaveBeenCalledWith(
      "viewer-file://sequence-viewer/opened/genbank-source",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("validates hidden chat-open resource metadata", () => {
    expect(
      parseSequenceViewerToolResultMetadata({
        "openai/viewerFile": {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      }),
    ).toEqual({
      primaryFile: {
        name: "demo.fasta",
        uri: "viewer-file://sequence-viewer/opened/token",
      },
    });
    expect(parseSequenceViewerToolResultMetadata({})).toBeNull();
    expect(
      parseSequenceViewerToolResultSession({
        viewerCommandRevision: 2,
        viewerSessionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      revision: 2,
      sessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parseSequenceViewerToolResultSession({})).toBeNull();
  });

  it("reads opaque file contents through standard MCP resources/read", async () => {
    const readServerResource = vi.fn().mockResolvedValue({
      contents: [{ text: ">demo\nACGT\n", uri: "codex-resource://demo" }],
    });

    await expect(
      readHostResourceText({ readServerResource }, "codex-resource://demo"),
    ).resolves.toBe(">demo\nACGT\n");
    expect(readServerResource).toHaveBeenCalledWith({
      uri: "codex-resource://demo",
    });
  });

  it("hydrates a server-streamed indexed sequence document without reparsing the envelope as FASTA", async () => {
    async function* lines() {
      yield ">alpha first";
      yield "ACGT";
      yield ">beta";
      yield "TTTT";
    }
    const envelope = await parseIndexedSequenceLines({
      compressed: true,
      fileName: "family.fasta.gz",
      format: "fasta",
      lines: lines(),
      sourceBytes: 24,
    });
    const state = await loadSequenceViewerResource(
      {
        primaryFile: {
          name: "family.fasta.gz",
          uri: "viewer-file://sequence-viewer/opened/token",
        },
      },
      async () => serializeIndexedSequenceEnvelope(envelope),
    );

    expect(state).toMatchObject({
      status: "ready",
      model: {
        sequenceDocument: {
          recordInventory: {
            materializedCount: 2,
            totalCount: 2,
          },
          records: [{ id: "alpha" }, { id: "beta" }],
        },
      },
    });
    if (state.status === "ready") {
      expect(state.contents).toBe(">alpha first\nACGT\n>beta\nTTTT");
      const changedSourceState = await loadSequenceViewerResource(
        {
          primaryFile: {
            name: "family.fasta.gz",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
        async () =>
          serializeIndexedSequenceEnvelope({
            ...envelope,
            index: { ...envelope.index, sourceVersion: "changed-source" },

          }),
      );
      expect(changedSourceState.status).toBe("ready");
      if (changedSourceState.status === "ready") {
        expect(changedSourceState.sourceStateKey).not.toBe(
          state.sourceStateKey,
        );
      }
    }
  });

  it("classifies an expired resource proxy error", async () => {
    await expect(
      loadSequenceViewerResource(
        {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
        async () => {
          throw new Error(
            "MCP error -32603: SEQUENCE_VIEWER_FILE_EXPIRED: The original file changed. Reopen it.",
          );
        },
      ),
    ).resolves.toEqual({
      message: "The original file changed. Reopen it.",
      status: "expired",
    });
  });

  it("sends text and structured model context through the current host capability", async () => {
    const updateModelContext = vi.fn().mockResolvedValue({});
    const updateContext = createModelContextUpdater({
      getHostCapabilities: () => ({ updateModelContext: { text: {} } }),
      updateModelContext,
    });

    await updateContext({
      structuredContent: { viewer: "sequence" },
      text: "Current scientific viewer: Sequence viewer",
    });

    expect(updateModelContext).toHaveBeenCalledWith({
      content: [
        {
          text: 'Current scientific viewer: Sequence viewer\n\nStructured viewer context JSON:\n{"viewer":"sequence"}',
          type: "text",
        },
      ],
      structuredContent: { viewer: "sequence" },
    });
  });

  it("renders ready sequence documents", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createManagedRoot(rootElement);
    const contents = ">demo\nACGT\n";
    await act(async () => {
      renderSequenceViewerState(root, {
        contents,
        fileName: "demo.fasta",
        model: createReadyModel(contents, "demo.fasta"),
        sourceStateKey: "artifact:test-demo",
        status: "ready",
      });
    });

    expect(await screen.findByText("demo.fasta")).toBeInTheDocument();
  });

  it("toggles aligned FASTA between sequence and alignment modes in one viewer", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const root = createManagedRoot(rootElement);
    const contents = ">a\nAC-GT\n>b\nACTGT\n";

    await act(async () => {
      renderSequenceViewerState(root, {
        contents,
        fileName: "family.fasta",
        model: createReadyModel(contents, "family.fasta"),
        sourceStateKey: "artifact:test-family",
        status: "ready",
      });
    });

    expect(
      await screen.findByRole("button", { name: "Alignment" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Sequence" }));
    expect(
      within(rootElement).getByLabelText("Wrapped sequence view"),
    ).toBeInTheDocument();
  });
});

function createReadyModel(contents: string, fileName: string) {
  return createBiologicalSequenceViewerModel({ contents, fileName });
}
