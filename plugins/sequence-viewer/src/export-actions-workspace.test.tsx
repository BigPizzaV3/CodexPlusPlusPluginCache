import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MsaExportActions } from "./msa/export-actions";
import { ExportActions } from "./sequence/export-actions";
import { parseSequenceDocument } from "./sequence/parser";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "./views/workbench-persistence";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("workspace export action provenance", () => {
  it("uses the live sequence workbench revision", async () => {
    const publisher = createPublisher("derived.fasta");
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });

    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={publisher}
        record={document.records[0]}
        sourceRevision={7}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Publish record FASTA" }),
    );
    const save = await screen.findByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher.mock.calls[0]![0].provenance.sourceRevision).toBe(7);
  });

  it("uses the live alignment workbench revision", async () => {
    const publisher = createPublisher("visible.afa");

    render(
      <IntlProvider locale="en" messages={{}}>
        <MsaExportActions
          hits={[]}
          publishWorkspaceArtifact={publisher}
          referenceLabel="reference"
          referenceSequence="ACGT"
          rows={[
            {
              alignedSequence: "ACGT",
              id: "reference",
              label: "reference",
              ungappedLength: 4,
            },
          ]}
          selectedColumnRange={null}
          sourceRevision={11}
          visibleColumnEnd={4}
          visibleColumnStart={1}
        />
      </IntlProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Publish visible FASTA" }),
    );
    const save = await screen.findByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher.mock.calls[0]![0].provenance.sourceRevision).toBe(11);
  });

  it("offers only source-bound workspace exports in Sequence mode", () => {
    const publisher = createPublisher("derived.fasta");
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });

    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={publisher}
        record={document.records[0]!}
        sourceRevision={2}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Publish record FASTA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish all FASTA" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Export record FASTA" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Export all FASTA" }),
    ).not.toBeInTheDocument();
  });

  it("streams exactly the visible Alignment rows through an authorized workspace export", async () => {
    const publisher = createPublisher("msa-visible-rows.afa");

    render(
      <IntlProvider locale="en" messages={{}}>
        <MsaExportActions
          hits={[]}
          publishWorkspaceArtifact={publisher}
          referenceLabel="visible"
          referenceSequence="AC-T"
          rows={[
            {
              alignedSequence: "AC-T",
              id: "visible",
              label: "visible",
              ungappedLength: 3,
            },
            {
              alignedSequence: "A-GT",
              id: "filtered",
              label: "filtered",
              ungappedLength: 3,
            },
          ]}
          selectedColumnRange={null}
          sourceRevision={5}
          visibleColumnEnd={4}
          visibleColumnStart={0}
        />
      </IntlProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Download visible FASTA" }),
    ).not.toBeInTheDocument();
    await publishVisibleArtifact("Publish visible FASTA");

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    const artifact = publisher.mock.calls[0]![0];
    expect(artifact).toEqual(
      expect.objectContaining({
        format: "aligned-fasta",
        name: "msa-visible-rows.afa",
        provenance: expect.objectContaining({ sourceRevision: 5 }),
      }),
    );
    expect(artifact).not.toHaveProperty("content");
    const chunks: Array<string> = [];
    for await (const chunk of artifact.createChunks!()) {
      chunks.push(
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk),
      );
    }
    expect(chunks.join("")).toBe(">visible\nAC-T\n>filtered\nA-GT");
  });

  it("reports unavailable workspace exports without advertising blocked downloads", () => {
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });

    render(
      <ExportActions
        document={document}
        record={document.records[0]!}
        sourceRevision={0}
      />,
    );

    expect(
      screen.getByText("Workspace export is unavailable for this viewer."),
    ).toHaveAttribute("role", "status");
    expect(
      screen.queryByRole("button", { name: /export|publish/iu }),
    ).toBeNull();
  });

  it("reports unavailable Alignment exports while retaining manual copy controls", () => {
    renderAlignmentActions(undefined, 0);

    expect(
      screen.getByText("Workspace export is unavailable for this viewer."),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("button", { name: "Copy visible rows FASTA" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download visible FASTA" }),
    ).not.toBeInTheDocument();
  });

  it("confirms a Sequence clipboard write only after the host accepts it", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={createPublisher("demo.fasta")}
        record={document.records[0]!}
        sourceRevision={0}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Copy record FASTA" }),
    );

    expect(writeText).toHaveBeenCalledWith(">demo\nACGT");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Copied to clipboard.",
    );
    expect(
      screen.queryByRole("textbox", { name: "Sequence text to copy manually" }),
    ).not.toBeInTheDocument();
  });

  it("uses a successful gesture-scoped legacy clipboard fallback", async () => {
    stubClipboard(
      vi.fn(async () => Promise.reject(new Error("Permission denied"))),
    );
    const execCommand = vi.fn(() => true);
    vi.stubGlobal("document", Object.assign(document, { execCommand }));

    renderAlignmentActions(createPublisher("visible.afa"), 0);
    await userEvent.click(
      screen.getByRole("button", { name: "Copy visible rows FASTA" }),
    );

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Copied to clipboard.",
    );
    expect(
      screen.queryByRole("textbox", {
        name: "Alignment text to copy manually",
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["Sequence", "Copy record FASTA", "Sequence text to copy manually"],
    ["Alignment", "Copy visible rows FASTA", "Alignment text to copy manually"],
  ] as const)(
    "exposes exact selectable %s text when clipboard access is denied",
    async (mode, action, accessibleName) => {
      stubClipboard(
        vi.fn(async () => Promise.reject(new Error("Permission denied"))),
      );
      const execCommand = vi.fn(() => false);
      vi.stubGlobal("document", Object.assign(document, { execCommand }));

      if (mode === "Sequence") {
        const document = parseSequenceDocument({
          contents: ">demo\nACGT\n",
          fileName: "demo.fasta",
        });
        render(
          <ExportActions
            document={document}
            publishWorkspaceArtifact={createPublisher("demo.fasta")}
            record={document.records[0]!}
            sourceRevision={0}
          />,
        );
      } else {
        renderAlignmentActions(createPublisher("visible.afa"), 0);
      }

      await userEvent.click(screen.getByRole("button", { name: action }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Clipboard access is unavailable.",
      );
      const field = screen.getByRole("textbox", { name: accessibleName });
      expect(field).toHaveValue(
        mode === "Sequence" ? ">demo\nACGT" : ">reference\nACGT",
      );
      expect(field).toHaveAttribute("readonly");
      expect(field).toHaveFocus();
      expect(
        screen.queryByText("Copied to clipboard."),
      ).not.toBeInTheDocument();
    },
  );

  it("rejects oversized manual-copy fallbacks before allocating a selection field", async () => {
    stubClipboard(
      vi.fn(async () => Promise.reject(new Error("Permission denied"))),
    );
    const execCommand = vi.fn(() => true);
    vi.stubGlobal("document", Object.assign(document, { execCommand }));
    const sequenceDocument = parseSequenceDocument({
      contents: `>large\n${"A".repeat(128 * 1_024 + 1)}\n`,
      fileName: "large.fasta",
    });
    render(
      <ExportActions
        document={sequenceDocument}
        publishWorkspaceArtifact={createPublisher("large.fasta")}
        record={sequenceDocument.records[0]!}
        sourceRevision={0}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Copy record FASTA" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This selection is too large to display for manual copying.",
    );
    expect(execCommand).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "Sequence text to copy manually" }),
    ).not.toBeInTheDocument();
  });

  it("publishes a complete source PDF through the authenticated native backend", async () => {
    const publisher = createPublisher("sequence.pdf");
    publisher.supportsNativeRichGeneration = true;
    const document = parseSequenceDocument({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });

    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={publisher}
        record={document.records[0]}
        sourceRevision={0}
      />,
    );
    await publishVisibleArtifact("Publish source PDF");

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        format: "pdf",
        mediaType: "application/pdf",
        name: "sequence.pdf",
        serverGeneration: { compression: "none", kind: "native-rich" },
      }),
    );
    expect(publisher.mock.calls[0]![0]).not.toHaveProperty("content");
    expect(publisher.mock.calls[0]![0]).not.toHaveProperty("createChunks");
  });

  it("preserves source-bound compound coordinates, strand, and GTF qualifiers", async () => {
    const publisher = createPublisher("annotations.gtf");
    publisher.supportsNativeRichGeneration = true;
    const document = annotatedSequenceDocument();
    const record = document.records[0]!;

    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={publisher}
        record={record}
        sourceRevision={0}
      />,
    );
    await publishVisibleArtifact("Publish source GTF");

    await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect(publisher.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        format: "gtf",
        mediaType: "text/x-gtf",
        serverGeneration: {
          compression: "none",
          kind: "native-rich",
          records: expect.arrayContaining([
            expect.objectContaining({
              end1: 3,
              id: record.features[0]?.id,
              kind: "misc_feature",
              metadata: {
                gene_id: "GENE1",
                gene_name: "GENE1",
                transcript_id: "TX1",
              },
              reference: record.id,
              start1: 1,
              strand: "-",
            }),
            expect.objectContaining({
              end1: 9,
              id: record.features[0]?.id,
              reference: record.id,
              start1: 7,
              strand: "-",
            }),
          ]),
        },
      }),
    );
    expect(publisher.mock.calls[0]![0].serverGeneration?.records).toHaveLength(
      2,
    );
  });

  it("fails closed for remote or incompletely inventoried source annotations", () => {
    const publisher = createPublisher("annotations.gtf");
    publisher.supportsNativeRichGeneration = true;
    const remote = annotatedSequenceDocument();
    remote.records[0]!.features[0]!.segments![0]!.remoteAccession = "OTHER.1";

    const { rerender } = render(
      <ExportActions
        document={remote}
        publishWorkspaceArtifact={publisher}
        record={remote.records[0]!}
        sourceRevision={0}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Publish source GTF" }),
    ).not.toBeInTheDocument();

    const incomplete = annotatedSequenceDocument();
    incomplete.recordInventory = {
      materializedCount: 1,
      totalCount: 2,
      truncated: true,
    };
    rerender(
      <ExportActions
        document={incomplete}
        publishWorkspaceArtifact={publisher}
        record={incomplete.records[0]!}
        sourceRevision={0}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Publish source GTF" }),
    ).not.toBeInTheDocument();
  });

  it("never routes edited sequence state to whole-source native exports", () => {
    const publisher = createPublisher("sequence.pdf");
    publisher.supportsNativeRichGeneration = true;
    const document = annotatedSequenceDocument();

    render(
      <ExportActions
        document={document}
        publishWorkspaceArtifact={publisher}
        record={document.records[0]!}
        sourceRevision={1}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Publish source PDF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish source GTF" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish record FASTA" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["A3M", "a3m", "alignment.a3m"],
    ["CLUSTAL", "clustal", "alignment.aln"],
    ["Stockholm", "stockholm", "alignment.sto"],
    ["PDF", "pdf", "alignment.pdf"],
  ] as const)(
    "publishes complete source %s alignment through the native backend",
    async (label, format, name) => {
      const publisher = createPublisher(name);
      publisher.supportsNativeRichGeneration = true;

      renderAlignmentActions(publisher, 0);
      await publishVisibleArtifact(`Publish source ${label}`);

      await waitFor(() => expect(publisher).toHaveBeenCalledOnce());
      expect(publisher.mock.calls[0]![0]).toEqual(
        expect.objectContaining({
          format,
          name,
          provenance: expect.objectContaining({
            parameters: { kind: `source-${format}`, scope: "all" },
            sourceRevision: 0,
          }),
          serverGeneration: { compression: "none", kind: "native-rich" },
        }),
      );
      expect(publisher.mock.calls[0]![0]).not.toHaveProperty("content");
    },
  );

  it("retains exact visible alignment exports when native source access is unavailable", () => {
    const publisher = createPublisher("visible.afa");

    renderAlignmentActions(publisher, 0);

    expect(
      screen.queryByRole("button", { name: "Publish source Stockholm" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish visible FASTA" }),
    ).toBeInTheDocument();
  });

  it("never routes edited alignment state to whole-source native exports", () => {
    const publisher = createPublisher("alignment.sto");
    publisher.supportsNativeRichGeneration = true;

    renderAlignmentActions(publisher, 1);

    expect(
      screen.queryByRole("button", { name: "Publish source Stockholm" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish visible FASTA" }),
    ).toBeInTheDocument();
  });
});

async function publishVisibleArtifact(label: string): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: label }));
  const save = await screen.findByRole("button", { name: "Save" });
  await waitFor(() => expect(save).toBeEnabled());
  await userEvent.click(save);
}

function annotatedSequenceDocument() {
  return parseSequenceDocument({
    contents: `LOCUS       demo        12 bp    DNA     circular
ACCESSION   demo
FEATURES             Location/Qualifiers
     misc_feature    complement(join(1..3,7..9))
                     /gene="GENE1"
                     /transcript_id="TX1"
ORIGIN
        1 acgtacgtacgt
//`,
    fileName: "demo.gb",
  });
}

function renderAlignmentActions(
  publisher: SequenceWorkspaceArtifactPublisher | undefined,
  sourceRevision: number,
): void {
  render(
    <IntlProvider locale="en" messages={{}}>
      <MsaExportActions
        hits={[]}
        publishWorkspaceArtifact={publisher}
        referenceLabel="reference"
        referenceSequence="ACGT"
        rows={[
          {
            alignedSequence: "ACGT",
            id: "reference",
            label: "reference",
            ungappedLength: 4,
          },
        ]}
        selectedColumnRange={null}
        sourceRevision={sourceRevision}
        visibleColumnEnd={4}
        visibleColumnStart={1}
      />
    </IntlProvider>,
  );
}

function stubClipboard(writeText: (value: string) => Promise<void>): void {
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), { clipboard: { writeText } }),
  );
}

function createPublisher(name: string) {
  const publisher = vi.fn(
    async (
      _artifact: PreparedSequenceWorkspaceArtifact,
      _relativePath: string,
      _collisionPolicy?: "exact" | "next-version",
    ) => workspaceResult(name),
  );
  return Object.assign(publisher, {
    createDirectory: vi.fn(),
    listDirectory: vi.fn(async () => ({
      candidate: {
        exactAvailable: true,
        exactWorkspacePath: `exports/${name}`,
        name,
        nextVersionName: name,
        nextVersionWorkspacePath: `exports/${name}`,
      },
      directory: {
        breadcrumbs: [
          { label: "Workspace", relativePath: ".", workspacePath: "." },
        ],
        relativePath: ".",
        sourceDirectoryWorkspacePath: ".",
        workspacePath: ".",
      },
      entries: [],
      omittedEntries: 0,
    })),
  }) as typeof publisher & SequenceWorkspaceArtifactPublisher;
}

function workspaceResult(name: string) {
  return {
    destination: { base: "opened-source" as const, kind: "workspace" as const },
    format: "fasta" as const,
    kind: "artifact" as const,
    mediaType: "text/x-fasta",
    name,
    outputWorkspacePath: `exports/${name}`,
    provenanceWorkspacePath: `exports/${name}.provenance.json`,
    sha256: "a".repeat(64),
    size: 8,
    version: 1 as const,
  };
}
