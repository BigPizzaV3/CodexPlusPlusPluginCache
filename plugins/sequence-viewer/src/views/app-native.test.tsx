import { act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  mockAppInstances,
  mockNativeHostCapabilities,
  mockServerToolHandler,
  type MockHostContext,
} from "./__fixtures__/app-host";
import { createArtifactStateKey } from "../artifact-state-key";
import { parseMsa } from "../msa/parser";
import {
  createDurableAlignmentState,
  createDurableSequenceState,
  decodeSequenceDurableViewerState,
  encodeSequenceDurableViewerState,
} from "../persistent/durable-viewer-state";
import * as nativeWorkspacePublisher from "../persistent/native-workspace-publisher";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { createSequenceInterfaceSettings } from "../sequence/interface-state";
import { parseSequenceDocument } from "../sequence/parser";
import {
  createAlignmentWorkbenchState,
  createSequenceWorkbenchState,
  sequenceWorkbenchReducer,
} from "../workbench-state";
import { startSequenceViewerApp } from "./app";

describe("sequence viewer app", () => {
  it("automatically opens a native viewer without a prior checkpoint or MCP server", async () => {
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler();
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }

      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });

      expect(
        await within(rootElement).findByText("demo.fasta"),
      ).toBeInTheDocument();
      expect(
        within(rootElement).getByRole("button", { name: "Save Original" }),
      ).toBeDisabled();
      expect(app.readServerResource).not.toHaveBeenCalled();
      expect(
        app.callServerTool.mock.calls.every(([request]) =>
          (request as { name: string }).name.startsWith(
            "ui/scientific/sequence/",
          ),
        ),
      ).toBe(true);
      expect(app.callServerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ui/scientific/sequence/restore_checkpoint",
        }),
        undefined,
      );
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "ui/scientific/sequence/checkpoint",
          }),
          undefined,
        );
      });
      expect(
        app.callServerTool.mock.calls.some(([request]) =>
          (request as { name: string }).name.startsWith("sequence."),
        ),
      ).toBe(false);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("rebinds workspace publication when a new native client supersedes the same session", async () => {
    const createPublisher = vi.spyOn(
      nativeWorkspacePublisher,
      "createNativeSequenceWorkspaceArtifactPublisher",
    );
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler();
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "first.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/first-source",
          },
        },
      });
      expect(createPublisher).toHaveBeenCalledOnce();

      mockNativeHostCapabilities.current = nativeSequenceHostCapabilities({
        backendGeneration: 3,
        backendInstanceId: "replacement-sequence-worker",
        channelId: "replacement-sequence-channel",
        sourceRevision: "replacement-source-revision",
      });
      mockServerToolHandler.current = createNativeSequenceToolHandler(
        undefined,
        {
          records: [{ id: "replacement", sequence: "TTGG" }],
          sourceRevision: "replacement-source-revision",
        },
      );
      await app.ontoolinput({
        arguments: {
          file: {
            name: "replacement.fasta",
            resourceUri:
              "viewer-file://sequence-viewer/opened/replacement-source",
          },
        },
      });

      expect(createPublisher).toHaveBeenCalledTimes(2);
      expect(createPublisher.mock.calls[1]?.[0].session).toMatchObject({
        backendGeneration: 3,
        backendInstanceId: "replacement-sequence-worker",
        logicalSessionId: "native-logical-session",
        sourceRevision: "replacement-source-revision",
      });
      expect(
        await within(rootElement).findByText("replacement.fasta"),
      ).toBeInTheDocument();
    } finally {
      createPublisher.mockRestore();
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it.each([
    { paletteId: "ncbi-nucleic-acid", expectedPaletteId: "ncbi-nucleic-acid" },
    {
      paletteId: "jalview-nucleotide",
      expectedPaletteId: "jalview-nucleotide",
    },
    {
      paletteId: "muted-nucleic-acid",
      expectedPaletteId: "muted-nucleic-acid",
    },
    { paletteId: "neutral", expectedPaletteId: "neutral" },
    { paletteId: "retired-palette", expectedPaletteId: "muted-nucleic-acid" },
    { paletteId: "rasmol", expectedPaletteId: "muted-nucleic-acid" },
  ])(
    "automatically restores exact sequence state from a $paletteId checkpoint with its original MCP unavailable",
    async ({ paletteId, expectedPaletteId }) => {
      const records = [
        { id: "initial-protein", sequence: "MKWVTFISLLFLFSSAYS" },
        { id: "demo", sequence: "ACGT" },
      ];
      const contents = records
        .map(({ id, sequence }) => `>${id}\n${sequence}\n`)
        .join("");
      const document = parseSequenceDocument({
        contents,
        fileName: "demo.fasta",
      });
      const record = document.records[1];
      if (record == null) throw new Error("Expected a sequence source record.");
      const sourceStateKey = createArtifactStateKey(contents, "demo.fasta");
      const interfaceSettings = createSequenceInterfaceSettings();
      interfaceSettings.recordBrowser = {
        expanded: true,
        page: 0,
        query: "demo",
        sortBy: "label",
      };
      interfaceSettings.annotationIndex = {
        expanded: true,
        page: 0,
        query: "CDS",
      };
      interfaceSettings.chromatogram = { basesPerWindow: 2, firstBase: 2 };
      interfaceSettings.readPileup.options = {
        ...interfaceSettings.readPileup.options,
        includeUnknownMappingQuality: false,
        minimumMappingQuality: 30,
        sortBy: "mapping-quality",
      };
      const checkpoint = encodeSequenceDurableViewerState({
        family: "sequence",
        mode: "sequence",
        sequence: createDurableSequenceState({
          activeSearchHitIndex: 0,
          focusCoordinate: 2,
          initialDocument: document,
          query: "CG",
          sourceStateKey,
          state: createSequenceWorkbenchState(document),
          view: {
            geneticCodeId: 1,
            interface: interfaceSettings,
            layout: "split",
            orientation: "reverse-complement",
            paletteId,
            selectedFeatureId: null,
            selectedRecordId: record.id,
            selection: { end: 3, recordId: record.id, start: 2 },
            showFeatures: true,
            showQuality: false,
            showTranslation: false,
            synchronizedViews: true,
            viewport: { end: 4, start: 1 },
            wrapWidth: 60,
          },
        }),
        sourceRevision: "native-source-revision",
        sourceStateKey,
        version: 1,
      });
      mockNativeHostCapabilities.current = {
        ...nativeSequenceHostCapabilities(),
        updateModelContext: { text: {} },
      };
      mockServerToolHandler.current = createNativeSequenceToolHandler(
        checkpoint,
        {
          records,
        },
      );
      try {
        const rootElement = globalThis.document.createElement("div");
        globalThis.document.body.append(rootElement);
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null || app.callServerTool == null) {
          throw new Error("Expected an authenticated native Sequence app.");
        }
        await app.ontoolinput({
          arguments: {
            file: {
              name: "demo.fasta",
              resourceUri: "viewer-file://sequence-viewer/opened/native-source",
            },
          },
        });

        await waitFor(() => {
          expect(
            within(rootElement).getByRole("textbox", {
              name: "Search sequence",
            }),
          ).toHaveValue("CG");
        });
        await userEvent.click(
          within(rootElement).getByRole("button", { name: "Display" }),
        );
        await waitFor(() => {
          expect(
            within(rootElement).getByRole("button", {
              name: "Show forward strand",
            }),
          ).toHaveAttribute("aria-pressed", "true");
          expect(
            within(rootElement).getByRole("button", { name: "Split" }),
          ).toHaveAttribute("aria-pressed", "true");
          expect(
            within(rootElement).getByRole("combobox", {
              name: "Residue palette",
            }),
          ).toHaveValue(expectedPaletteId);
          expect(app.updateModelContext).toHaveBeenLastCalledWith(
            expect.objectContaining({
              structuredContent: expect.objectContaining({
                display: expect.objectContaining({
                  paletteId: expectedPaletteId,
                }),
                displayedRecord: expect.objectContaining({
                  id: record.id,
                  index: 1,
                }),
                interface: expect.objectContaining({
                  annotationIndex: interfaceSettings.annotationIndex,
                  readPileup: interfaceSettings.readPileup,
                  recordBrowser: interfaceSettings.recordBrowser,
                }),
              }),
            }),
          );
        });
        await userEvent.clear(
          within(rootElement).getByRole("textbox", {
            name: "Search sequence",
          }),
        );
        await userEvent.type(
          within(rootElement).getByRole("textbox", {
            name: "Search sequence",
          }),
          "GT",
        );
        await waitFor(() => {
          const nativeCheckpointCall = [...app.callServerTool!.mock.calls]
            .reverse()
            .find(
              ([request]) =>
                (request as { name: string }).name ===
                "ui/scientific/sequence/checkpoint",
            );
          const request = nativeCheckpointCall?.[0] as
            { arguments: { checkpoint: Uint8Array } } | undefined;
          if (request == null) {
            throw new Error("Expected an automatic native state checkpoint.");
          }
          expect(
            decodeSequenceDurableViewerState(request.arguments.checkpoint),
          ).toMatchObject({
            mode: "sequence",
            sequence: {
              query: "GT",
              session: {
                view: {
                  sequence: {
                    paletteId: expectedPaletteId,
                    selectedRecordId: record.id,
                  },
                },
              },
              view: {
                interface: interfaceSettings,
                orientation: "reverse-complement",
                paletteId: expectedPaletteId,
                selectedRecordId: record.id,
              },
            },
            version: 1,
          });
        });
        expect(app.readServerResource).not.toHaveBeenCalled();
        expect(app.sendMessage).not.toHaveBeenCalled();
        expect(
          app.callServerTool.mock.calls.every(([request]) =>
            (request as { name: string }).name.startsWith(
              "ui/scientific/sequence/",
            ),
          ),
        ).toBe(true);
      } finally {
        mockNativeHostCapabilities.current = null;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("keeps pending edits and source writes on the same live viewer after a backend restart", async () => {
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(checkpoint);
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (
        app?.ontoolinput == null ||
        app.callServerTool == null ||
        app.hostContextChanged == null
      ) {
        throw new Error("Expected an authenticated live Sequence viewer.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });

      const saveOriginal = await within(rootElement).findByRole("button", {
        name: "Save Original",
      });
      await waitFor(() => expect(saveOriginal).toBeEnabled());
      await userEvent.type(
        within(rootElement).getByRole("textbox", { name: "Search sequence" }),
        "GT",
      );
      const callsBeforeRenewal = app.callServerTool.mock.calls.length;
      const refreshedCapabilities = nativeSequenceHostCapabilities({
        backendGeneration: 3,
        backendInstanceId: "restarted-native-sequence-worker",
        channelId: "restarted-native-sequence-channel",
      });
      mockNativeHostCapabilities.current = refreshedCapabilities;
      const refreshedContext: MockHostContext = {
        availableDisplayModes: ["inline", "fullscreen"],
        displayMode: "inline",
        scientificViewers: refreshedCapabilities.scientificViewers as Record<
          string,
          unknown
        >,
      };
      app.getHostContext.mockReturnValue(refreshedContext);
      await act(async () => app.hostContextChanged?.(refreshedContext));

      expect(app.callServerTool).toHaveBeenCalledTimes(callsBeforeRenewal);
      expect(
        within(rootElement).getByRole("textbox", { name: "Search sequence" }),
      ).toHaveValue("GT");
      expect(saveOriginal).toBeEnabled();
      await waitFor(() => {
        const latestCheckpoint = [...app.callServerTool!.mock.calls]
          .reverse()
          .find(
            ([request]) =>
              (request as { name: string }).name ===
              "ui/scientific/sequence/checkpoint",
          )?.[0] as
          | {
              arguments: {
                backendGeneration: number;
                backendInstanceId: string;
                channelId: string;
                checkpoint: Uint8Array;
              };
            }
          | undefined;
        expect(latestCheckpoint?.arguments).toMatchObject({
          backendGeneration: 3,
          backendInstanceId: "restarted-native-sequence-worker",
          channelId: "restarted-native-sequence-channel",
        });
        expect(
          decodeSequenceDurableViewerState(
            latestCheckpoint!.arguments.checkpoint,
          ),
        ).toMatchObject({ sequence: { query: "GT" } });
      });
      expect(app.sendMessage).not.toHaveBeenCalled();
      expect(app.readServerResource).not.toHaveBeenCalled();

      await userEvent.click(saveOriginal);
      await waitFor(() => {
        expect(within(rootElement).getByRole("status")).toHaveTextContent(
          "Original sequence saved",
        );
      });
      const writes = app.callServerTool.mock.calls.filter(([request]) =>
        (request as { name: string }).name.includes("/source_edit/"),
      );
      expect(writes).toHaveLength(3);
      expect(
        writes.every(
          ([request]) =>
            (request as { arguments: { backendGeneration: number } }).arguments
              .backendGeneration === 3,
        ),
      ).toBe(true);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it.each(["append-before", "append-after", "commit-after"] as const)(
    "resumes an original-source edit exactly once after %s backend interruption",
    async (interruption) => {
      const checkpoint = createDirtyNativeSequenceCheckpoint({
        contents: ">demo\nACGT\n",
        fileName: "demo.fasta",
      });
      mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
      const service = createNativeSequenceToolHandler(checkpoint, {
        maxSourceEditChunkBytes: 1024 * 1024,
      });
      let activeApp: (typeof mockAppInstances)[number] | undefined;
      let interrupted = false;
      mockServerToolHandler.current = async (request) => {
        const name = (request as { name: string }).name;
        const isInterruptedOperation =
          (name === "ui/scientific/sequence/source_edit/append" &&
            interruption.startsWith("append")) ||
          (name === "ui/scientific/sequence/source_edit/commit" &&
            interruption === "commit-after");
        if (!interrupted && isInterruptedOperation) {
          interrupted = true;
          if (interruption !== "append-before") {
            await service(request);
          }
          const renewed = nativeSequenceHostCapabilities({
            backendGeneration: 3,
            backendInstanceId: "resumed-native-sequence-worker",
            channelId: "resumed-native-sequence-channel",
          });
          mockNativeHostCapabilities.current = renewed;
          const context: MockHostContext = {
            displayMode: "inline",
            scientificViewers: renewed.scientificViewers as Record<
              string,
              unknown
            >,
          };
          activeApp?.getHostContext.mockReturnValue(context);
          activeApp?.hostContextChanged?.(context);
          throw new Error("The native Sequence backend disconnected.");
        }
        return await service(request);
      };
      try {
        const rootElement = document.createElement("div");
        document.body.append(rootElement);
        await startSequenceViewerApp(rootElement);
        activeApp = mockAppInstances.at(-1);
        if (
          activeApp?.ontoolinput == null ||
          activeApp.callServerTool == null
        ) {
          throw new Error("Expected an authenticated live Sequence viewer.");
        }
        await activeApp.ontoolinput({
          arguments: {
            file: {
              name: "demo.fasta",
              resourceUri: "viewer-file://sequence-viewer/opened/native-source",
            },
          },
        });
        const saveOriginal = await within(rootElement).findByRole("button", {
          name: "Save Original",
        });
        await waitFor(() => expect(saveOriginal).toBeEnabled());
        await userEvent.click(saveOriginal);

        await waitFor(() => {
          expect(within(rootElement).getByRole("status")).toHaveTextContent(
            "Original sequence saved",
          );
        });
        const operations = activeApp.callServerTool.mock.calls
          .map(
            ([request]) =>
              request as { arguments: Record<string, unknown>; name: string },
          )
          .filter((request) => request.name.includes("/source_edit/"));
        expect(
          operations.filter(({ name }) => name.endsWith("/begin")),
        ).toHaveLength(1);
        expect(
          operations.filter(({ name }) => name.endsWith("/resume")),
        ).toHaveLength(1);
        expect(
          operations.filter(({ name }) => name.endsWith("/commit")),
        ).toHaveLength(1);
        expect(operations.some(({ name }) => name.endsWith("/abort"))).toBe(
          false,
        );
        const appends = operations.filter(({ name }) =>
          name.endsWith("/append"),
        );
        expect(appends).toHaveLength(interruption === "append-before" ? 2 : 1);
        if (appends.length === 2) {
          expect(appends[0]?.arguments.requestId).toEqual(
            appends[1]?.arguments.requestId,
          );
          expect(appends[0]?.arguments.offsetDecimal).toEqual(
            appends[1]?.arguments.offsetDecimal,
          );
        }
        expect(
          operations.find(({ name }) => name.endsWith("/resume"))?.arguments,
        ).toMatchObject({
          backendGeneration: 3,
          backendInstanceId: "resumed-native-sequence-worker",
          channelId: "resumed-native-sequence-channel",
        });
        expect(activeApp.sendMessage).not.toHaveBeenCalled();
      } finally {
        mockNativeHostCapabilities.current = null;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("replaces a complete original only after an explicit native Save Original click", async () => {
    const contents = ">demo\nACGT\n";
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents,
      fileName: "demo.fasta",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(checkpoint);
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });
      const saveOriginal = await within(rootElement).findByRole("button", {
        name: "Save Original",
      });
      await waitFor(() => expect(saveOriginal).toBeEnabled());
      expect(
        app.callServerTool.mock.calls.some(([request]) =>
          (request as { name: string }).name.includes("/source_edit/"),
        ),
      ).toBe(false);

      await userEvent.click(saveOriginal);

      await waitFor(() => {
        const error = within(rootElement).queryByRole("alert");
        if (error != null) throw new Error(error.textContent ?? "Save failed.");
        expect(within(rootElement).getByRole("status")).toHaveTextContent(
          "Original sequence saved",
        );
      });
      const sourceEditCalls = app.callServerTool.mock.calls.filter(
        ([request]) =>
          (request as { name: string }).name.includes("/source_edit/"),
      );
      expect(
        sourceEditCalls.map(([request]) => (request as { name: string }).name),
      ).toEqual([
        "ui/scientific/sequence/source_edit/begin",
        "ui/scientific/sequence/source_edit/append",
        "ui/scientific/sequence/source_edit/commit",
      ]);
      expect(sourceEditCalls[0]?.[0]).toMatchObject({
        arguments: {
          approvedOperation: "replace-source",
          expectedSourceRevision: "native-source-revision",
        },
      });
      const appendRequest = sourceEditCalls[1]?.[0] as
        | {
            arguments: {
              bytes: Uint8Array;
              editId: string;
              offsetDecimal: string;
            };
          }
        | undefined;
      if (appendRequest == null) {
        throw new Error("Expected a bounded original-source write.");
      }
      expect(appendRequest.arguments.bytes.byteLength).toBeLessThanOrEqual(
        64 * 1024,
      );
      expect(new TextDecoder().decode(appendRequest.arguments.bytes)).toBe(
        ">demo\nCCGT\n",
      );
      expect(
        within(rootElement).getByRole("button", { name: "Save Original" }),
      ).toBeDisabled();
      expect(
        app.callServerTool.mock.calls.every(([request]) =>
          (request as { name: string }).name.startsWith(
            "ui/scientific/sequence/",
          ),
        ),
      ).toBe(true);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("never offers or performs an original-source write without explicit native approval", async () => {
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities({
      canEditApprovedSource: false,
    });
    mockServerToolHandler.current = createNativeSequenceToolHandler(checkpoint);
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });
      await within(rootElement).findByLabelText("Wrapped sequence view");
      expect(
        within(rootElement).queryByRole("button", { name: "Save Original" }),
      ).toBeNull();
      expect(
        app.callServerTool.mock.calls.some(([request]) =>
          (request as { name: string }).name.includes("/source_edit/"),
        ),
      ).toBe(false);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("saves an edited preview while preserving every unloaded original FASTA record", async () => {
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(
      checkpoint,
      {
        complete: false,
        nextCursor: "1",
        records: [
          { id: "demo", sequence: "ACGT" },
          {
            description: "untouched metadata",
            id: "unloaded",
            sequence: "TTAA",
            // Keep this controlled source-save fixture beyond the bounded
            // interactive cache while preserving its compact source bytes.
            sequenceLength: SEQUENCE_VIEWER_LIMITS.input.retainedFastaBases + 1,
          },
        ],
        sourceContents:
          ">demo\r\nAC\r\nGT\n>unloaded untouched metadata\r\nTTAA",
      },
    );
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });
      const saveOriginal = await within(rootElement).findByRole("button", {
        name: "Save Original",
      });
      await waitFor(() => expect(saveOriginal).toBeEnabled());
      expect(
        app.callServerTool.mock.calls.some(([request]) =>
          (request as { name: string }).name.includes("/source_edit/"),
        ),
      ).toBe(false);

      await userEvent.click(saveOriginal);
      await waitFor(() => {
        const error = within(rootElement).queryByRole("alert");
        if (error != null) throw new Error(error.textContent ?? "Save failed.");
        expect(within(rootElement).getByRole("status")).toHaveTextContent(
          "Original sequence saved",
        );
      });
      const append = app.callServerTool.mock.calls.find(
        ([request]) =>
          (request as { name: string }).name ===
          "ui/scientific/sequence/source_edit/append",
      )?.[0] as { arguments: { bytes: Uint8Array } } | undefined;
      expect(append).toBeDefined();
      expect(new TextDecoder().decode(append!.arguments.bytes)).toBe(
        ">demo\r\nCC\r\nGT\n>unloaded untouched metadata\r\nTTAA",
      );
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("proactively resumes authenticated original-source leases before appending or committing", async () => {
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(
      checkpoint,
      {
        sourceEditLeaseDurationMs: 20_000,
      },
    );
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/native-source",
          },
        },
      });
      const saveOriginal = await within(rootElement).findByRole("button", {
        name: "Save Original",
      });
      await waitFor(() => expect(saveOriginal).toBeEnabled());
      await userEvent.click(saveOriginal);
      await waitFor(() => {
        const error = within(rootElement).queryByRole("alert");
        if (error != null) throw new Error(error.textContent ?? "Save failed.");
        expect(within(rootElement).getByRole("status")).toHaveTextContent(
          "Original sequence saved",
        );
      });

      expect(
        app.callServerTool.mock.calls
          .map(([request]) => (request as { name: string }).name)
          .filter((name) => name.includes("/source_edit/")),
      ).toEqual([
        "ui/scientific/sequence/source_edit/begin",
        "ui/scientific/sequence/source_edit/resume",
        "ui/scientific/sequence/source_edit/append",
        "ui/scientific/sequence/source_edit/resume",
        "ui/scientific/sequence/source_edit/commit",
      ]);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("never overwrites a compressed sequence original without a native encoder", async () => {
    const checkpoint = createDirtyNativeSequenceCheckpoint({
      contents: ">demo\nACGT\n",
      fileName: "demo.fasta.gz",
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(checkpoint);
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native Sequence app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta.gz",
            resourceUri: "viewer-file://sequence-viewer/opened/native-gzip",
          },
        },
      });
      const saveOriginal = await within(rootElement).findByRole("button", {
        name: "Save Original",
      });
      await waitFor(() => {
        expect(saveOriginal).toBeDisabled();
        expect(saveOriginal).toHaveAttribute(
          "title",
          expect.stringContaining("uncompressed"),
        );
      });
      expect(
        app.callServerTool.mock.calls.some(([request]) =>
          (request as { name: string }).name.includes("/source_edit/"),
        ),
      ).toBe(false);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it.each(["gzip:renamed-original", "bgzf:renamed-original"])(
    "never rewrites a compressed logical %s source renamed with a plaintext extension",
    async (compressedSourceRevision) => {
      const checkpoint = createDirtyNativeSequenceCheckpoint({
        contents: ">demo\nACGT\n",
        fileName: "renamed.fasta",
        sourceRevision: compressedSourceRevision,
      });
      mockNativeHostCapabilities.current = nativeSequenceHostCapabilities({
        sourceRevision: compressedSourceRevision,
      });
      mockServerToolHandler.current = createNativeSequenceToolHandler(
        checkpoint,
        { sourceRevision: compressedSourceRevision },
      );
      try {
        const rootElement = document.createElement("div");
        document.body.append(rootElement);
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null || app.callServerTool == null) {
          throw new Error("Expected an authenticated native Sequence app.");
        }
        await app.ontoolinput({
          arguments: {
            file: {
              name: "renamed.fasta",
              resourceUri: "viewer-file://sequence-viewer/opened/native-gzip",
            },
          },
        });
        const saveOriginal = await within(rootElement).findByRole("button", {
          name: "Save Original",
        });
        await waitFor(() => {
          expect(saveOriginal).toBeDisabled();
          expect(saveOriginal).toHaveAttribute(
            "title",
            expect.stringContaining("recompression"),
          );
        });
        expect(
          app.callServerTool.mock.calls.some(([request]) =>
            (request as { name: string }).name.includes("/source_edit/"),
          ),
        ).toBe(false);
      } finally {
        mockNativeHostCapabilities.current = null;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("automatically restores alignment filters and selection with no MCP server", async () => {
    const contents = ">row-a\nAC-GT\n>row-b\nACTGT\n";
    const parsed = parseMsa(contents, "family.fasta");
    if (parsed.status !== "success") throw new Error(parsed.message);
    const initial = parsed.document;
    const anchor = initial.rows[0];
    if (anchor == null) throw new Error("Expected an aligned source row.");
    const sourceStateKey = createArtifactStateKey(contents, "family.fasta");
    const checkpoint = encodeSequenceDurableViewerState({
      alignment: createDurableAlignmentState({
        alignmentColumnJump: "3",
        anchorRowId: anchor.id,
        fileName: "family.fasta",
        focusedCell: { column: 2, rowId: anchor.id, symbol: "-" },
        guideTreeNewick: null,
        initialDocument: initial,
        motifQuery: "CG",
        pinnedCell: { column: 1, rowId: anchor.id, symbol: "C" },
        referencePositionJump: "2",
        selectedHitIndex: 0,
        sourceStateKey,
        state: createAlignmentWorkbenchState(initial),
        view: {
          analysisScope: "all-unhidden-rows",
          cellWidth: 25,
          colorMode: "identity",
          referenceMode: "anchor",
          residuePalette: "neutral",
          rowFilter: "row-a",
          searchScope: "currently-displayed-rows",
          selectedColumns: { end: 3, start: 1 },
          selectedRows: [anchor.id],
          showAnnotationTracks: true,
          showIdenticalAsDots: true,
          showRnaStructureOverlays: false,
        },
        viewport: { column: 1, row: 0 },
      }),
      family: "sequence",
      mode: "alignment",
      sourceRevision: "native-source-revision",
      sourceStateKey,
      version: 1,
    });
    mockNativeHostCapabilities.current = nativeSequenceHostCapabilities();
    mockServerToolHandler.current = createNativeSequenceToolHandler(
      checkpoint,
      {
        records: [
          { id: "row-a", sequence: "AC-GT" },
          { id: "row-b", sequence: "ACTGT" },
        ],
      },
    );
    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected an authenticated native alignment app.");
      }
      await app.ontoolinput({
        arguments: {
          file: {
            name: "family.fasta",
            resourceUri:
              "viewer-file://sequence-viewer/opened/native-alignment",
          },
        },
      });

      await waitFor(() => {
        expect(
          within(rootElement).getByRole("button", { name: "Alignment" }),
        ).toHaveAttribute("aria-pressed", "true");
        expect(
          within(rootElement).getByRole("textbox", {
            name: "Filter MSA rows",
          }),
        ).toHaveValue("row-a");
        expect(within(rootElement).getByDisplayValue("CG")).toBeInTheDocument();
      });
      expect(app.readServerResource).not.toHaveBeenCalled();
      expect(app.sendMessage).not.toHaveBeenCalled();
      expect(
        app.callServerTool.mock.calls.every(([request]) =>
          (request as { name: string }).name.startsWith(
            "ui/scientific/sequence/",
          ),
        ),
      ).toBe(true);
    } finally {
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });
});

function createDirtyNativeSequenceCheckpoint({
  contents,
  fileName,
  sourceRevision = "native-source-revision",
}: {
  contents: string;
  fileName: string;
  sourceRevision?: string;
}): Uint8Array {
  const initial = parseSequenceDocument({ contents, fileName });
  const original = initial.records[0];
  if (original == null || original.sequence.length === 0) {
    throw new Error("Expected a complete editable source record.");
  }
  const replacement = original.sequence[0] === "C" ? "A" : "C";
  const edited = {
    ...initial,
    records: [
      {
        ...original,
        sequence: replacement + original.sequence.slice(1),
      },
      ...initial.records.slice(1),
    ],
  };
  const state = sequenceWorkbenchReducer(
    createSequenceWorkbenchState(initial),
    {
      description: "Replace the first residue in the source copy.",
      document: edited,
      type: "apply-sequence-document",
    },
  );
  const sourceStateKey = createArtifactStateKey(contents, fileName);
  return encodeSequenceDurableViewerState({
    family: "sequence",
    mode: "sequence",
    sequence: createDurableSequenceState({
      activeSearchHitIndex: 0,
      initialDocument: initial,
      query: "",
      sourceStateKey,
      state,
      view: {
        geneticCodeId: 1,
        layout: "linear",
        orientation: "forward",
        paletteId: "neutral",
        selectedFeatureId: null,
        selectedRecordId: original.id,
        selection: null,
        showFeatures: true,
        showQuality: false,
        showTranslation: false,
        synchronizedViews: true,
        viewport: null,
        wrapWidth: 60,
      },
    }),
    sourceRevision,
    sourceStateKey,
    version: 1,
  });
}

function nativeSequenceHostCapabilities(options?: {
  backendGeneration?: number;
  backendInstanceId?: string;
  canEditApprovedSource?: boolean;
  channelId?: string;
  sourceRevision?: string;
}): Record<string, unknown> {
  const session = {
    backendGeneration: options?.backendGeneration ?? 2,
    backendInstanceId: options?.backendInstanceId ?? "native-sequence-worker",
    family: "sequence" as const,
    logicalSessionId: "native-logical-session",
    sourceRevision: options?.sourceRevision ?? "native-source-revision",
  };
  return {
    scientificViewers: {
      attachment: {
        backendGeneration: session.backendGeneration,
        backendInstanceId: session.backendInstanceId,
        channelId: options?.channelId ?? "native-sequence-channel",
        expiresAtMs: Date.now() + 60_000,
        family: session.family,
        frameId: "native-sequence-frame",
        logicalSessionId: session.logicalSessionId,
      },
      binaryTransfer: "bounded-process-ipc",
      effectiveCapabilities: {
        ...session,
        canEditApprovedSource: options?.canEditApprovedSource ?? true,
        canReadRanges: true,
      },
      familyScopedChannels: true,
      processIsolation: "family-process",
      protocolVersion: 1,
      transportSupportsRangeReads: true,
    },
  };
}

function createNativeSequenceToolHandler(
  restoredCheckpoint?: Uint8Array,
  options?: {
    complete?: boolean;
    maxSourceEditChunkBytes?: number;
    nextCursor?: string | null;
    sourceEditLeaseDurationMs?: number;
    sourceContents?: string;
    sourceRevision?: string;
    records?: Array<{
      description?: string;
      id: string;
      quality?: string;
      sequence: string;
      sequenceLength?: number;
    }>;
  },
): (request: unknown) => Promise<unknown> {
  let acknowledgedRevision = 4;
  let sourceEditWrittenBytes = 0;
  let sourceEditActive = false;
  let sourceEditCommittedResult:
    | {
        bytesWrittenDecimal: string;
        editId: string;
        sourceIdentity: {
          etag: string;
          fileId: string;
          rootId: string;
          sizeBytesDecimal: string;
        };
        sourceRevision: string;
      }
    | undefined;
  const maxSourceEditChunkBytes = options?.maxSourceEditChunkBytes ?? 64 * 1024;
  const sourceEditLeaseDurationMs =
    options?.sourceEditLeaseDurationMs ?? 60_000;
  const sourceRevision = options?.sourceRevision ?? "native-source-revision";
  const records = options?.records ?? [{ id: "demo", sequence: "ACGT" }];
  const sourceBytes = new TextEncoder().encode(
    options?.sourceContents ??
      records
        .map(
          (record) =>
            `>${record.id}${record.description ? ` ${record.description}` : ""}\n${record.sequence}\n`,
        )
        .join(""),
  );
  return async (request) => {
    const { arguments: args, name } = request as {
      arguments?: {
        approvedOperation?: string;
        bytes?: Uint8Array;
        checkpoint?: Uint8Array;
        cursor?: string;
        editId?: string;
        end1Decimal?: string;
        expectedSourceRevision?: string;
        lastAcknowledgedRevision?: number;
        length?: number;
        offsetDecimal?: string;
        recordNumber?: number;
        start1Decimal?: string;
      };
      name: string;
    };
    if (name === "ui/scientific/sequence/restore_checkpoint") {
      return {
        structuredContent:
          restoredCheckpoint == null
            ? { hasCheckpoint: false }
            : {
                checkpoint: restoredCheckpoint,
                hasCheckpoint: true,
                lastAcknowledgedRevision: acknowledgedRevision,
                recoveryReference: "native-durable-reference",
                sourceRevision,
              },
      };
    }
    if (name === "ui/scientific/sequence/records") {
      const cursor = args?.cursor ?? "0";
      const offset = Number(cursor);
      const pageRecords =
        options?.complete === false
          ? records.slice(offset, offset + 1)
          : records;
      const complete =
        options?.complete === false
          ? offset + pageRecords.length >= records.length
          : (options?.complete ?? true);
      return {
        structuredContent: {
          complete,
          cursor,
          nextCursor: complete
            ? null
            : (options?.nextCursor ?? String(offset + pageRecords.length)),
          records: pageRecords.map((record) => ({
            description: record.description ?? "",
            id: record.id,
            sequenceLength: record.sequenceLength ?? record.sequence.length,
          })),
          sourceRevision,
        },
      };
    }
    if (name === "ui/scientific/sequence/window") {
      const record = records[(args?.recordNumber ?? 1) - 1];
      if (record == null) {
        throw new Error("The requested native sequence record is unavailable.");
      }
      const start = Number(args?.start1Decimal ?? "1") - 1;
      const end = Number(args?.end1Decimal ?? record.sequence.length);
      const sequence = record.sequence.slice(start, end);
      return {
        structuredContent: {
          end1: end,
          ...(record.quality == null
            ? {}
            : { quality: record.quality.slice(start, end) }),
          sequence,
          sourceRevision,
          start1: start + 1,
        },
      };
    }
    if (name === "ui/scientific/sequence/read-range") {
      const offset = Number(args?.offsetDecimal);
      const length = args?.length;
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(length) ||
        length == null ||
        length <= 0 ||
        length > 256 * 1024
      ) {
        throw new Error("The original Sequence range is not safe.");
      }
      const bytes = sourceBytes.slice(offset, offset + length);
      return {
        structuredContent: {
          bytes,
          eof: offset + bytes.byteLength >= sourceBytes.byteLength,
        },
      };
    }
    if (name === "ui/scientific/sequence/source_edit/begin") {
      if (
        args?.approvedOperation !== "replace-source" ||
        args.expectedSourceRevision !== sourceRevision ||
        sourceEditActive
      ) {
        throw new Error("The original source replacement is not approved.");
      }
      sourceEditActive = true;
      sourceEditWrittenBytes = 0;
      return {
        structuredContent: {
          bytesWrittenDecimal: "0",
          editId: "native-original-source-edit",
          expiresAtMs: Date.now() + sourceEditLeaseDurationMs,
          maxChunkBytes: maxSourceEditChunkBytes,
          sourceRevision,
        },
      };
    }
    if (name === "ui/scientific/sequence/source_edit/append") {
      if (
        !sourceEditActive ||
        args?.editId !== "native-original-source-edit" ||
        !(args.bytes instanceof Uint8Array) ||
        args.bytes.byteLength === 0 ||
        args.bytes.byteLength > maxSourceEditChunkBytes ||
        args.offsetDecimal !== String(sourceEditWrittenBytes)
      ) {
        throw new Error("The original source edit chunk is unsafe.");
      }
      sourceEditWrittenBytes += args.bytes.byteLength;
      return {
        structuredContent: {
          bytesWrittenDecimal: String(sourceEditWrittenBytes),
          editId: "native-original-source-edit",
          expiresAtMs: Date.now() + sourceEditLeaseDurationMs,
          maxChunkBytes: maxSourceEditChunkBytes,
          sourceRevision,
        },
      };
    }
    if (name === "ui/scientific/sequence/source_edit/resume") {
      if (
        args?.editId !== "native-original-source-edit" ||
        (!sourceEditActive && sourceEditCommittedResult == null)
      ) {
        throw new Error("The original source edit cannot be resumed.");
      }
      return {
        structuredContent: {
          bytesWrittenDecimal: String(sourceEditWrittenBytes),
          editId: "native-original-source-edit",
          expiresAtMs: Date.now() + sourceEditLeaseDurationMs,
          maxChunkBytes: maxSourceEditChunkBytes,
          sourceRevision,
          state: sourceEditActive ? "staging" : "published",
          ...(sourceEditCommittedResult == null
            ? {}
            : { committedResult: sourceEditCommittedResult }),
        },
      };
    }
    if (name === "ui/scientific/sequence/source_edit/commit") {
      if (
        !sourceEditActive ||
        args?.editId !== "native-original-source-edit" ||
        sourceEditWrittenBytes === 0
      ) {
        throw new Error("The original source edit cannot be published.");
      }
      sourceEditActive = false;
      sourceEditCommittedResult = {
        bytesWrittenDecimal: String(sourceEditWrittenBytes),
        editId: "native-original-source-edit",
        sourceIdentity: {
          etag: "native-source-etag-v2",
          fileId: "native-source-file",
          rootId: "native-source-root",
          sizeBytesDecimal: String(sourceEditWrittenBytes),
        },
        sourceRevision: "native-source-revision-v2",
      };
      return {
        structuredContent: sourceEditCommittedResult,
      };
    }
    if (name === "ui/scientific/sequence/source_edit/abort") {
      sourceEditActive = false;
      return {
        structuredContent: {
          aborted: true,
          editId: "native-original-source-edit",
        },
      };
    }
    if (name === "ui/scientific/sequence/checkpoint") {
      if (!(args?.checkpoint instanceof Uint8Array)) {
        throw new Error("Expected a bounded native checkpoint payload.");
      }
      acknowledgedRevision = Math.max(
        acknowledgedRevision + 1,
        (args.lastAcknowledgedRevision ?? 0) + 1,
      );
      return {
        structuredContent: {
          checkpointVersion: 1,
          lastAcknowledgedRevision: acknowledgedRevision,
          logicalSessionId: "native-logical-session",
          recoveryReference: "native-durable-reference",
        },
      };
    }
    throw new Error("The original Sequence MCP server is unavailable: " + name);
  };
}
