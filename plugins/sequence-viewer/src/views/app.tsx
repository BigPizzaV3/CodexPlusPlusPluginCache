import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { createRoot, type Root } from "react-dom/client";
import { IntlProvider } from "react-intl";

import { createArtifactStateKey } from "../artifact-state-key";
import {
  decodeBinarySequenceBase64,
  parseBinarySequenceEnvelope,
  serializeBinarySequenceEnvelope,
} from "../binary-sequence-envelope";
import {
  BiologicalSequenceViewer,
  type BiologicalSequenceViewerDisplayModeControl,
} from "../biological-sequence-viewer";
import { createBiologicalSequenceViewerModel } from "../biological-sequence-viewer-model";
import { stripBiologicalCompressionSuffix } from "../compressed-file-name";
import {
  buildIndexedPreviewContents,
  parseIndexedSequenceEnvelope,
} from "../indexed-sequence-envelope";
import {
  createLatestModelContextUpdater,
  formatModelContextText,
  truncateContextText,
  type ModelContextUpdater,
} from "../model-context";
import {
  SequenceDurableViewerStateContext,
  SequenceDurableViewerStateController,
  type SequenceNativeCheckpointClient,
} from "../persistent/durable-viewer-state";
import { createNativeSequenceWorkspaceArtifactPublisher } from "../persistent/native-workspace-publisher";
import {
  createHostScientificSequenceDataClient,
  refreshHostScientificSequenceDataClient,
  type ScientificSequenceDataClient,
} from "../persistent/scientific-data-client";
import {
  sequenceViewerChatFileInputSchema,
  sequenceViewerChatToolInputSchema,
  sequenceViewerPublicExampleToolInputSchema,
  sequenceViewerSessionSchema,
  sequenceViewerToolInputSchema,
  sequenceViewerToolResultMetadataSchema,
  sequenceViewerToolResultSessionSchema,
  sequenceViewerWaitResultSchema,
  type SequenceViewerChatFileInput,
  type SequenceViewerToolInput,
} from "../protocol";
import { SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME } from "../scientific-platform-protocol";
import { getHistoricalViewerFileErrorMessage } from "../resource-error";
import {
  assertTextWithinInputBudget,
  SEQUENCE_VIEWER_LIMITS,
  SequenceViewerLimitError,
  utf8ByteLength,
} from "../runtime-contract";
import {
  getSequenceFormatHint,
  SEQUENCE_FILE_ENTRYPOINTS,
} from "../sequence/file-kind";
import type { SequenceDocument } from "../sequence/types";
import {
  getBinarySequenceFormatHint,
  parseBinarySequenceDocument,
  sniffBinarySequenceFormat,
} from "../sequence/binary-parser";
import { Button } from "../ui/button";
import { StatusPanel } from "../ui/status-panel";
import { SEQUENCE_VIEWER_VERSION } from "../version";
import {
  SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
  SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
  type QueuedSequenceViewerCommand,
  type SequenceViewerCommandResult,
} from "../viewer-commands";
import {
  encodedSequenceToolRequestBytes,
  isRetryableSequencePersistenceError,
  persistSequenceCommandResult,
  createSequenceWorkspaceArtifactPublisher,
  type SequenceWorkspaceArtifactPublisher,
} from "./workbench-persistence";
import {
  createSequenceWorkspaceSessionClient,
  type SequenceWorkspaceSessionClient,
} from "./workspace-sessions";
import {
  createSequenceWorkspaceTrackBrowserClient,
  type SequenceWorkspaceTrackBrowserClient,
} from "./workspace-tracks";
import {
  parsePluginScientificSequenceSource,
  PluginScientificSequenceDataClient,
} from "./scientific-platform-client";

export type { SequenceViewerChatFileInput, SequenceViewerToolInput };
export type SequenceViewerLoadState =
  | { status: "error"; message: string }
  | { status: "expired"; message: string }
  | { status: "loading" }
  | { status: "missing-input" }
  | {
      contents: string;
      fileName?: string;
      model: ReturnType<typeof createBiologicalSequenceViewerModel>;
      sourceStateKey: string;
      status: "ready";
    };

export function parseSequenceViewerToolInput(
  value: unknown,
): SequenceViewerToolInput | null {
  const parsed = sequenceViewerToolInputSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseSequenceViewerToolResultMetadata(
  value: unknown,
): SequenceViewerChatFileInput | null {
  const parsed = sequenceViewerToolResultMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data["openai/viewerFile"] : null;
}

export function parseSequenceViewerToolResultSession(value: unknown): {
  revision: number;
  sessionId: string;
} | null {
  const parsed = sequenceViewerToolResultSessionSchema.safeParse(value);
  return parsed.success
    ? {
        revision: parsed.data.viewerCommandRevision,
        sessionId: parsed.data.viewerSessionId,
      }
    : null;
}

const NATIVE_SEQUENCE_RECORD_PAGE_SIZE = 256;
const NATIVE_SEQUENCE_WINDOW_RESIDUES = 64 * 1_024;

type NativeSequenceDataClient = Pick<
  ScientificSequenceDataClient,
  "listRecords" | "readResidueWindow"
>;

type NativeSequenceRecord = Awaited<
  ReturnType<NativeSequenceDataClient["listRecords"]>
>["records"][number];

type RetainedNativeSequenceRecord = NativeSequenceRecord & {
  materializedLength: number;
  recordNumber: number;
};

async function loadNativeSequenceSource(
  client: NativeSequenceDataClient,
  isFastq: boolean,
): Promise<{
  contents: string;
  inventory: NonNullable<SequenceDocument["recordInventory"]>;
  previewSourceLengths: Map<number, number>;
}> {
  const retainedRecords: Array<RetainedNativeSequenceRecord> = [];
  const seenCursors = new Set<string>();
  const maxRecords = isFastq
    ? SEQUENCE_VIEWER_LIMITS.input.maxFastqRecords
    : SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords;
  const maxRetainedRecords = isFastq
    ? SEQUENCE_VIEWER_LIMITS.input.retainedFastqRecords
    : SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords;
  const maxRetainedBases = isFastq
    ? SEQUENCE_VIEWER_LIMITS.input.retainedFastqBases
    : SEQUENCE_VIEWER_LIMITS.input.retainedFastaBases;
  let cursor: string | undefined;
  let totalCount = 0;
  let retainedBases = 0;
  let retainedTextBytes = 0;
  let retainingRecords = true;

  while (true) {
    const page = await client.listRecords({
      ...(cursor == null ? {} : { cursor }),
      limit: NATIVE_SEQUENCE_RECORD_PAGE_SIZE,
    });
    if (page.records.length === 0) {
      throw new Error(
        totalCount === 0
          ? "The selected sequence source contains no readable records."
          : "The indexed Sequence record page contains no readable records.",
      );
    }
    if (page.complete !== (page.nextCursor == null)) {
      throw new Error("The indexed Sequence record page is incomplete.");
    }

    for (const record of page.records) {
      totalCount += 1;
      if (totalCount > maxRecords) {
        throw new SequenceViewerLimitError(
          "sequence_record_limit_exceeded",
          `This artifact contains more than ${maxRecords.toLocaleString()} records. Create a smaller subset and reopen it.`,
          { maxRecords, recordCount: totalCount },
        );
      }
      if (
        !retainingRecords ||
        retainedRecords.length >= maxRetainedRecords
      ) {
        retainingRecords = false;
        continue;
      }

      const remainingBases = maxRetainedBases - retainedBases;
      const materializedLength =
        record.sequenceLength <= remainingBases
          ? record.sequenceLength
          : retainedRecords.length === 0 && remainingBases > 0
            ? Math.min(
                record.sequenceLength,
                remainingBases,
                NATIVE_SEQUENCE_WINDOW_RESIDUES,
              )
            : undefined;
      if (materializedLength == null) {
        retainingRecords = false;
        continue;
      }

      const description = record.description
        ? ` ${record.description}`
        : "";
      const headerBytes = utf8ByteLength(
        `${isFastq ? "@" : ">"}${record.id}${description}\n`,
      );
      const recordTextBytes =
        headerBytes +
        materializedLength * (isFastq ? 2 : 1) +
        (isFastq ? 4 : 1);
      if (
        retainedTextBytes + recordTextBytes >
        SEQUENCE_VIEWER_LIMITS.input.maxTextBytes
      ) {
        retainingRecords = false;
        continue;
      }

      retainedRecords.push({
        ...record,
        materializedLength,
        recordNumber: totalCount,
      });
      retainedBases += materializedLength;
      retainedTextBytes += recordTextBytes;
      if (materializedLength < record.sequenceLength) {
        retainingRecords = false;
      }
    }

    if (page.complete) break;
    const nextCursor = page.nextCursor;
    if (nextCursor == null || seenCursors.has(nextCursor)) {
      throw new Error("The indexed Sequence record cursor did not advance.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  if (retainedRecords.length === 0) {
    throw new Error(
      "The selected sequence source exceeds its interactive memory budget.",
    );
  }

  const previewSourceLengths = new Map<number, number>();
  const contents: Array<string> = [];
  for (const [index, record] of retainedRecords.entries()) {
    const sequenceChunks: Array<string> = [];
    const qualityChunks: Array<string> = [];
    for (
      let start1 = 1;
      start1 <= record.materializedLength;
      start1 += NATIVE_SEQUENCE_WINDOW_RESIDUES
    ) {
      const end1 = Math.min(
        record.materializedLength,
        start1 + NATIVE_SEQUENCE_WINDOW_RESIDUES - 1,
      );
      const window = await client.readResidueWindow({
        end1Decimal: end1.toString(),
        includeQuality: isFastq,
        recordNumber: record.recordNumber,
        start1Decimal: start1.toString(),
      });
      if (window.sequence.length !== end1 - start1 + 1) {
        throw new Error(
          "The indexed Sequence residue window does not match its requested interval.",
        );
      }
      sequenceChunks.push(window.sequence);
      if (isFastq) {
        if (
          window.quality == null ||
          window.quality.length !== window.sequence.length
        ) {
          throw new Error(
            "The returned FASTQ qualities do not match their sequence.",
          );
        }
        qualityChunks.push(window.quality);
      }
    }
    const description = record.description ? ` ${record.description}` : "";
    const sequence = sequenceChunks.join("");
    contents.push(
      isFastq
        ? `@${record.id}${description}\n${sequence}\n+\n${qualityChunks.join("")}\n`
        : `>${record.id}${description}\n${sequence}\n`,
    );
    if (record.materializedLength < record.sequenceLength) {
      previewSourceLengths.set(index, record.sequenceLength);
    }
  }

  return {
    contents: contents.join(""),
    inventory: {
      materializedCount: retainedRecords.length,
      totalCount,
      truncated:
        retainedRecords.length < totalCount || previewSourceLengths.size > 0,
    },
    previewSourceLengths,
  };
}

export async function loadSequenceViewerResource(
  input: SequenceViewerToolInput | SequenceViewerChatFileInput,
  readText: (resourceUri: string) => Promise<string>,
  persistentClient?: NativeSequenceDataClient | null,
): Promise<SequenceViewerLoadState> {
  try {
    const file =
      "file" in input
        ? { name: input.file.name, uri: input.file.resourceUri }
        : input.primaryFile;
    let resourceText: string;
    let nativeRecordInventory: SequenceDocument["recordInventory"];
    let nativePreviewSourceLengths: Map<number, number> | undefined;
    const formatHint = getSequenceFormatHint(file.name);
    const supportsNativeIndex =
      formatHint != null &&
      (SEQUENCE_FILE_ENTRYPOINTS[0].extensions.some(
        (extension) => extension === formatHint,
      ) ||
        SEQUENCE_FILE_ENTRYPOINTS[3].extensions.some(
          (extension) => extension === formatHint,
        ));
    if (persistentClient == null || !supportsNativeIndex) {
      resourceText = await readText(file.uri);
    } else {
      const isFastq = /\.(?:fastq|fq)$/iu.test(
        stripBiologicalCompressionSuffix(file.name),
      );
      const nativeSource = await loadNativeSequenceSource(
        persistentClient,
        isFastq,
      );
      resourceText = nativeSource.contents;
      nativeRecordInventory = nativeSource.inventory;
      nativePreviewSourceLengths = nativeSource.previewSourceLengths;
    }
    assertTextWithinInputBudget(resourceText);
    const binaryBytes = parseBinarySequenceEnvelope(resourceText);
    if (binaryBytes == null && getBinarySequenceFormatHint(file.name) != null) {
      throw new Error(
        "The selected binary sequence was delivered as text. Reopen the original binary file so its bytes can be decoded without loss.",
      );
    }
    const binaryDocument =
      binaryBytes == null
        ? undefined
        : parseBinarySequenceDocument({
            bytes: binaryBytes,
            fileName: file.name,
          });
    const indexed =
      binaryBytes == null ? parseIndexedSequenceEnvelope(resourceText) : null;
    const preparsedSequenceDocument = binaryDocument ?? indexed?.document;
    const contents =
      preparsedSequenceDocument == null
        ? resourceText
        : buildIndexedPreviewContents(preparsedSequenceDocument);
    assertTextWithinInputBudget(contents);
    let model = createBiologicalSequenceViewerModel({
      contents,
      fileName: file.name,
      preparsedSequenceDocument,
    });
    if (
      nativeRecordInventory != null &&
      model.sequenceDocument != null &&
      model.sequenceParse.status === "success"
    ) {
      const sequenceDocument = {
        ...model.sequenceDocument,
        records: model.sequenceDocument.records.map((record, index) => {
          const sourceLength = nativePreviewSourceLengths?.get(index);
          return sourceLength == null
            ? record
            : {
                ...record,
                metadata: {
                  ...record.metadata,
                  indexed_preview: "true",
                  indexed_source_length: sourceLength.toString(),
                },
              };
        }),
        recordInventory: nativeRecordInventory,
      };
      model = {
        ...model,
        sequenceDocument,
        sequenceParse: {
          ...model.sequenceParse,
          document: sequenceDocument,
        },
      };
    }
    if (model.availableModes.length === 0) {
      const parseMessage =
        model.sequenceParse.status === "error"
          ? model.sequenceParse.message
          : undefined;
      return {
        message:
          parseMessage ??
          "No supported biological sequence or alignment records were parsed.",
        status: "error",
      };
    }
    return {
      contents,
      fileName: file.name,
      model,
      sourceStateKey: createArtifactStateKey(resourceText, file.name),
      status: "ready",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "File contents could not be read.";
    const historicalViewerFileMessage =
      getHistoricalViewerFileErrorMessage(message);
    return {
      message: historicalViewerFileMessage ?? message,
      status: historicalViewerFileMessage == null ? "error" : "expired",
    };
  }
}

export async function readHostResourceText(
  app: Pick<App, "readServerResource">,
  resourceUri: string,
): Promise<string> {
  const resource = await app.readServerResource({ uri: resourceUri });
  const binaryContents = resource.contents.flatMap((content) =>
    "blob" in content ? [content.blob] : [],
  );
  const textContents = resource.contents.flatMap((content) =>
    "text" in content ? [content.text] : [],
  );
  if (binaryContents.length > 0) {
    if (binaryContents.length !== 1 || textContents.length > 0) {
      throw new Error(
        "The selected resource must contain exactly one binary payload without mixed text.",
      );
    }
    const bytes = decodeBinarySequenceBase64(binaryContents[0]);
    if (sniffBinarySequenceFormat(bytes) != null)
      return serializeBinarySequenceEnvelope(bytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    assertTextWithinInputBudget(text);
    return text;
  }
  if (textContents.length === 0) {
    throw new Error("The selected resource did not contain readable text.");
  }
  const text = textContents.join("\n");
  assertTextWithinInputBudget(text);
  return text;
}

export function renderSequenceViewerState(
  root: Root,
  state: SequenceViewerLoadState,
  updateModelContext?: ModelContextUpdater,
  displayModeControl?: BiologicalSequenceViewerDisplayModeControl,
  command?: QueuedSequenceViewerCommand,
  onCommandResult?: (
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ) => void,
  viewerSessionId?: string,
  reopenHistoricalFile?: () => void,
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher,
  browseWorkspaceTracks?: SequenceWorkspaceTrackBrowserClient,
  workspaceSessions?: SequenceWorkspaceSessionClient,
  durableViewerState?: SequenceDurableViewerStateController,
  initialToolbarVisible?: boolean,
): void {
  const recoveredMode =
    state.status === "ready" &&
    durableViewerState?.restoredState?.sourceStateKey === state.sourceStateKey
      ? durableViewerState.restoredState.mode
      : undefined;
  root.render(
    <IntlProvider locale="en" messages={{}}>
      <SequenceDurableViewerStateContext.Provider
        value={durableViewerState ?? null}
      >
        {state.status === "ready" ? (
          <BiologicalSequenceViewer
            command={command}
            contents={state.contents}
            displayModeControl={displayModeControl}
            fileName={state.fileName}
            initialToolbarVisible={initialToolbarVisible}
            model={
              recoveredMode != null &&
              state.model.availableModes.includes(recoveredMode)
                ? { ...state.model, defaultMode: recoveredMode }
                : state.model
            }
            onCommandResult={onCommandResult}
            browseWorkspaceTracks={browseWorkspaceTracks}
            publishWorkspaceArtifact={publishWorkspaceArtifact}
            workspaceSessions={workspaceSessions}
            updateModelContext={updateModelContext}
            sourceStateKey={state.sourceStateKey}
            viewerSessionId={viewerSessionId}
          />
        ) : state.status === "loading" ? (
          <StatusPanel title="Loading sequence…">
            Reading the selected file contents.
          </StatusPanel>
        ) : state.status === "missing-input" ? (
          <StatusPanel title="No sequence selected">
            The host did not provide a readable sequence resource.
          </StatusPanel>
        ) : state.status === "expired" ? (
          <StatusPanel title="Sequence viewer link expired">
            <p>{state.message}</p>
            {reopenHistoricalFile == null ? (
              <p className="mt-3">Ask Codex to reopen this file from chat.</p>
            ) : (
              <Button className="mt-4" onClick={reopenHistoricalFile}>
                Reopen from chat
              </Button>
            )}
          </StatusPanel>
        ) : (
          <StatusPanel title="Sequence could not be opened">
            {state.message}
          </StatusPanel>
        )}
      </SequenceDurableViewerStateContext.Provider>
    </IntlProvider>,
  );
}

function isNativeSequenceCheckpointClient(
  client: ScientificSequenceDataClient,
): client is ScientificSequenceDataClient & SequenceNativeCheckpointClient {
  const checkpointClient = client as ScientificSequenceDataClient &
    Partial<SequenceNativeCheckpointClient>;
  return (
    typeof checkpointClient.checkpoint === "function" &&
    typeof checkpointClient.restoreCheckpoint === "function"
  );
}

export function createModelContextUpdater(
  app: Pick<App, "getHostCapabilities" | "updateModelContext">,
): ModelContextUpdater {
  return async ({ structuredContent, text }) => {
    if (app.getHostCapabilities()?.updateModelContext == null) {
      return;
    }
    await app.updateModelContext({
      content: [
        {
          text: formatModelContextText({ structuredContent, text }),
          type: "text",
        },
      ],
      structuredContent,
    });
  };
}

export async function startSequenceViewerApp(
  rootElement: HTMLElement,
): Promise<void> {
  const root = createRoot(rootElement);
  const app = new App(
    { name: "sequence-viewer", version: SEQUENCE_VIEWER_VERSION },
    { availableDisplayModes: ["inline", "fullscreen"] },
  );
  let loadGeneration = 0;
  let awaitingNativeToolResultFile = false;
  let pendingNativeInputFile: SequenceViewerToolInput["file"] | undefined;
  let currentState: SequenceViewerLoadState = { status: "missing-input" };
  let connected = false;
  let displayModeControlEnabled = false;
  let displayMode: "inline" | "fullscreen" = "inline";
  let displayModePending = false;
  let availableDisplayModes: Array<"inline" | "fullscreen"> = [];
  let openingToolResultReceived = false;
  let openingToolFailed = false;
  let initialToolbarVisible: boolean | undefined;
  let viewerSessionId: string | undefined;
  let viewerSessionRegistration: Promise<void> | undefined;
  let workspaceArtifactPublisher:
    | SequenceWorkspaceArtifactPublisher
    | undefined;
  let workspaceArtifactPublisherClient:
    | ScientificSequenceDataClient
    | null
    | undefined;
  let workspaceArtifactPublisherSessionId: string | undefined;
  let workspaceTrackBrowser: SequenceWorkspaceTrackBrowserClient | undefined;
  let workspaceTrackBrowserSessionId: string | undefined;
  let workspaceSessionClient: SequenceWorkspaceSessionClient | undefined;
  let workspaceSessionClientSessionId: string | undefined;
  let viewerCommandRevision = 0;
  let viewerCommandLoopGeneration = 0;
  let viewerCommandLoopStarted = false;
  let nativeScientificDataClient: ScientificSequenceDataClient | null = null;
  let pluginScientificDataClient: PluginScientificSequenceDataClient | null =
    null;
  let latestViewerInput:
    | SequenceViewerToolInput
    | SequenceViewerChatFileInput
    | undefined;
  let durableViewerState: SequenceDurableViewerStateController | undefined;
  let pendingViewerSessionActivation:
    | { revision: number; sessionId: string }
    | undefined;
  let currentCommand: QueuedSequenceViewerCommand | undefined;
  let pendingPersistenceAbortController: AbortController | undefined;
  let resolveCurrentCommand:
    | ((result: SequenceViewerCommandResult) => void)
    | undefined;
  let pendingExportAcknowledgment:
    | {
        commandId: string;
        resolve: (result: SequenceViewerCommandResult) => void;
      }
    | undefined;

  const publishModelContext = createModelContextUpdater(app);
  const updateModelContext = createLatestModelContextUpdater(async (update) => {
    try {
      await publishModelContext(update);
    } finally {
      // The opening result can carry the authoritative server session and may
      // be released only after the host receives ready viewer context. Wait
      // for that publication round trip before creating an input-only
      // fallback. A host without context support returns from publication
      // immediately and retains the same fallback behavior.
      if (
        update.structuredContent.viewer != null &&
        pendingNativeInputFile != null &&
        !openingToolResultReceived &&
        viewerSessionId == null
      ) {
        await ensureViewerSession();
      }
    }
  });

  const renderCurrentState = () => {
    const canRequestSidePane =
      connected &&
      displayModeControlEnabled &&
      (displayMode === "fullscreen" ||
        availableDisplayModes.length === 0 ||
        availableDisplayModes.includes("fullscreen"));
    renderSequenceViewerState(
      root,
      currentState,
      updateModelContext,
      canRequestSidePane
        ? {
            mode: displayMode,
            pending: displayModePending,
            requestMode: requestDisplayMode,
          }
        : undefined,
      currentCommand,
      handleCommandResult,
      viewerSessionId,
      connected && app.getHostCapabilities()?.message != null
        ? reopenHistoricalFile
        : undefined,
      getWorkspaceArtifactPublisher(),
      getWorkspaceTrackBrowser(),
      getWorkspaceSessionClient(),
      durableViewerState,
      initialToolbarVisible,
    );
  };
  function getWorkspaceArtifactPublisher():
    | SequenceWorkspaceArtifactPublisher
    | undefined {
    if (viewerSessionId == null) {
      workspaceArtifactPublisher = undefined;
      workspaceArtifactPublisherClient = undefined;
      workspaceArtifactPublisherSessionId = undefined;
      return undefined;
    }
    if (
      workspaceArtifactPublisherSessionId !== viewerSessionId ||
      workspaceArtifactPublisherClient !== nativeScientificDataClient
    ) {
      workspaceArtifactPublisher =
        nativeScientificDataClient == null
          ? createSequenceWorkspaceArtifactPublisher(app, viewerSessionId)
          : createNativeSequenceWorkspaceArtifactPublisher(
              nativeScientificDataClient,
            );
      workspaceArtifactPublisherClient = nativeScientificDataClient;
      workspaceArtifactPublisherSessionId = viewerSessionId;
    }
    return workspaceArtifactPublisher;
  }
  function getWorkspaceTrackBrowser():
    | SequenceWorkspaceTrackBrowserClient
    | undefined {
    if (viewerSessionId == null || nativeScientificDataClient != null) {
      workspaceTrackBrowser = undefined;
      workspaceTrackBrowserSessionId = undefined;
      return undefined;
    }
    if (workspaceTrackBrowserSessionId !== viewerSessionId) {
      workspaceTrackBrowser = createSequenceWorkspaceTrackBrowserClient(
        app,
        viewerSessionId,
      );
      workspaceTrackBrowserSessionId = viewerSessionId;
    }
    return workspaceTrackBrowser;
  }
  function getWorkspaceSessionClient():
    | SequenceWorkspaceSessionClient
    | undefined {
    if (viewerSessionId == null || nativeScientificDataClient != null) {
      workspaceSessionClient = undefined;
      workspaceSessionClientSessionId = undefined;
      return undefined;
    }
    if (workspaceSessionClientSessionId !== viewerSessionId) {
      workspaceSessionClient = createSequenceWorkspaceSessionClient(
        app,
        viewerSessionId,
      );
      workspaceSessionClientSessionId = viewerSessionId;
    }
    return workspaceSessionClient;
  }
  function handleCommandResult(
    command: QueuedSequenceViewerCommand,
    result: SequenceViewerCommandResult,
  ): void | Promise<SequenceViewerCommandResult> {
    if (currentCommand?.commandId !== command.commandId) {
      return;
    }
    const resolveCommand = resolveCurrentCommand;
    if (resolveCommand == null) return;
    if (command.action !== "export_artifact" || !result.applied) {
      resolveCommand(result);
      return;
    }

    return new Promise<SequenceViewerCommandResult>((resolve) => {
      pendingExportAcknowledgment?.resolve({
        applied: false,
        message: "The viewer export was superseded before persistence completed.",
      });
      pendingExportAcknowledgment = {
        commandId: command.commandId,
        resolve,
      };
      resolveCommand(result);
    });
  }
  function settleExportAcknowledgment(
    commandId: string,
    result: SequenceViewerCommandResult,
  ): void {
    if (pendingExportAcknowledgment?.commandId !== commandId) return;
    const acknowledgment = pendingExportAcknowledgment;
    pendingExportAcknowledgment = undefined;
    acknowledgment.resolve(result);
  }
  const setCurrentState = (state: SequenceViewerLoadState) => {
    currentState = state;
    renderCurrentState();
  };
  const applyHostContext = (
    context: ReturnType<App["getHostContext"]> | undefined,
  ) => {
    if (context?.theme != null) {
      applyDocumentTheme(context.theme);
    }
    if (context?.styles?.variables != null) {
      applyHostStyleVariables(context.styles.variables);
    }
    if (
      context?.displayMode === "inline" ||
      context?.displayMode === "fullscreen"
    ) {
      displayMode = context.displayMode;
    }
    if (context?.availableDisplayModes != null) {
      availableDisplayModes = context.availableDisplayModes.filter(
        (mode): mode is "inline" | "fullscreen" =>
          mode === "inline" || mode === "fullscreen",
      );
    }
    renderCurrentState();
  };
  async function requestDisplayMode(mode: "inline" | "fullscreen") {
    displayModePending = true;
    renderCurrentState();
    try {
      const result = await app.requestDisplayMode({ mode });
      displayMode =
        result.mode === "inline" || result.mode === "fullscreen"
          ? result.mode
          : mode;
    } catch {
      applyHostContext(app.getHostContext());
    } finally {
      displayModePending = false;
      renderCurrentState();
    }
  }
  async function reopenHistoricalFile(): Promise<void> {
    try {
      const result = await app.sendMessage({
        content: [
          {
            text: "Reopen the file used by this historical Biological Sequence & Alignment Viewer card from its current local path.",
            type: "text",
          },
        ],
        role: "user",
      });
      if (result.isError) {
        throw new Error("The host rejected the reopen request.");
      }
    } catch {
      setCurrentState({
        message:
          "Codex could not start the reopen request. Ask Codex to reopen this file from chat.",
        status: "expired",
      });
    }
  }

  renderCurrentState();
  const flushHiddenViewerCheckpoint = (): void => {
    if (document.visibilityState !== "hidden") return;
    void durableViewerState?.flush().catch(() => {
      // Keep the last authenticated checkpoint; never fall back to MCP.
    });
  };
  const flushViewerCheckpointBeforePageHide = (
    event: PageTransitionEvent,
  ): void => {
    void durableViewerState?.flush().catch(() => {
      // Keep the last authenticated checkpoint; never fall back to MCP.
    });
    if (event.persisted) return;
    document.removeEventListener("visibilitychange", flushHiddenViewerCheckpoint);
    window.removeEventListener("pagehide", flushViewerCheckpointBeforePageHide, true);
  };
  document.addEventListener("visibilitychange", flushHiddenViewerCheckpoint);
  window.addEventListener("pagehide", flushViewerCheckpointBeforePageHide, {
    capture: true,
  });

  const restoreChatViewerSession = async (
    input: SequenceViewerChatFileInput,
    previousClient: PluginScientificSequenceDataClient,
    generation: number,
  ): Promise<boolean> => {
    const sessionId = viewerSessionId;
    if (
      sessionId == null ||
      previousClient.source.sessionId !== sessionId ||
      typeof app.callServerTool !== "function"
    ) {
      return false;
    }
    const restoredResult = await app.callServerTool({
      arguments: { resourceUri: input.primaryFile.uri, sessionId },
      name: SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
    });
    if (restoredResult.isError) {
      throw new Error("The historical Sequence viewer session could not be restored.");
    }
    const restored = sequenceViewerSessionSchema.parse(
      restoredResult.structuredContent,
    );
    if (restored.sessionId !== sessionId) {
      throw new Error("The host restored a different Sequence viewer session.");
    }
    const source = parsePluginScientificSequenceSource(restoredResult._meta);
    if (
      source == null ||
      source.sessionId !== sessionId ||
      source.sourceRevision !== previousClient.source.sourceRevision ||
      source.fileName !== previousClient.source.fileName
    ) {
      throw new Error(
        "The historical Sequence viewer source changed or could not be reauthorized.",
      );
    }
    if (
      generation !== loadGeneration ||
      viewerSessionId !== sessionId ||
      pluginScientificDataClient !== previousClient ||
      latestViewerInput !== input
    ) {
      return false;
    }
    pluginScientificDataClient = new PluginScientificSequenceDataClient(
      app,
      source,
    );
    pendingViewerSessionActivation = restored;
    return true;
  };

  const loadInput = async (
    input: SequenceViewerToolInput | SequenceViewerChatFileInput,
    { retryRestoredSession = true }: { retryRestoredSession?: boolean } = {},
  ) => {
    latestViewerInput = input;
    loadGeneration += 1;
    const generation = loadGeneration;
    setCurrentState({ status: "loading" });
    const persistentClient = createHostScientificSequenceDataClient(app);
    const activePluginClient =
      persistentClient == null &&
      pluginScientificDataClient?.source.sessionId === viewerSessionId
        ? pluginScientificDataClient
        : null;
    let nextDurableViewerState:
      | SequenceDurableViewerStateController
      | undefined;
    if (persistentClient != null) {
      if (!isNativeSequenceCheckpointClient(persistentClient)) {
        if (generation === loadGeneration) {
          setCurrentState({
            message:
              "The native Sequence viewer recovery service is unavailable.",
            status: "error",
          });
        }
        return;
      }
      nextDurableViewerState = new SequenceDurableViewerStateController(
        persistentClient,
      );
    } else if (activePluginClient != null) {
      nextDurableViewerState = new SequenceDurableViewerStateController(
        activePluginClient,
      );
    }
    let state: SequenceViewerLoadState;
    try {
      [state] = await Promise.all([
        loadSequenceViewerResource(
          input,
          async (resourceUri) => readHostResourceText(app, resourceUri),
          persistentClient ??
            (activePluginClient?.source.format === "unsupported"
              ? null
              : activePluginClient),
        ),
        nextDurableViewerState?.restore(),
      ]);
      if (
        (state.status === "error" || state.status === "expired") &&
        retryRestoredSession &&
        persistentClient == null &&
        activePluginClient != null &&
        activePluginClient.source.format !== "unsupported" &&
        "primaryFile" in input
      ) {
        throw new Error(state.message);
      }
    } catch (error) {
      nextDurableViewerState?.dispose();
      if (
        generation === loadGeneration &&
        retryRestoredSession &&
        persistentClient == null &&
        activePluginClient != null &&
        "primaryFile" in input
      ) {
        try {
          if (
            await restoreChatViewerSession(input, activePluginClient, generation)
          ) {
            if (generation === loadGeneration) {
              await loadInput(input, { retryRestoredSession: false });
            }
            return;
          }
        } catch (restoreError) {
          error = restoreError;
        }
      }
      if (generation === loadGeneration) {
        setCurrentState({
          message:
            error instanceof Error
              ? error.message
              : "The native Sequence viewer could not be restored.",
          status: "error",
        });
      }
      return;
    }
    if (generation !== loadGeneration) {
      nextDurableViewerState?.dispose();
      return;
    }
    if (durableViewerState != null) {
      void durableViewerState.flush().catch(() => {
        // Keep recovery native; an unavailable worker must not restart MCP.
      });
      durableViewerState.dispose();
    }
    durableViewerState = nextDurableViewerState;
    nativeScientificDataClient = persistentClient;
    if (persistentClient != null) {
      viewerSessionId = persistentClient.session.logicalSessionId;
      viewerCommandLoopStarted = true;
    }
    setCurrentState(state);
    if (
      persistentClient == null &&
      state.status === "ready" &&
      pendingViewerSessionActivation != null &&
      pendingViewerSessionActivation.sessionId === viewerSessionId
    ) {
      const session = pendingViewerSessionActivation;
      pendingViewerSessionActivation = undefined;
      activateViewerSession(session);
    } else {
      startViewerCommandLoopIfReady();
    }
  };
  app.ontoolinput = async ({ arguments: args }) => {
    const input = parseSequenceViewerToolInput(args);
    if (input != null) {
      if (openingToolFailed) openingToolResultReceived = false;
      openingToolFailed = false;
      initialToolbarVisible = undefined;
      awaitingNativeToolResultFile = true;
      pendingNativeInputFile = input.file;
      displayModeControlEnabled = false;
      await loadInput(input);
      return;
    }
    const openingHint =
      sequenceViewerChatToolInputSchema.safeParse(args).success ||
      sequenceViewerPublicExampleToolInputSchema.safeParse(args).success;
    // Chat inputs are opening hints, not file capabilities. Hosts may replay
    // them after a result; only a new authoritative input or result may
    // supersede the accepted resource load or its terminal error.
    if (openingHint && (latestViewerInput != null || openingToolFailed))
      return;
    loadGeneration += 1;
    displayModeControlEnabled = openingHint;
    if (displayModeControlEnabled) openingToolFailed = false;
    awaitingNativeToolResultFile = !displayModeControlEnabled;
    pendingNativeInputFile = undefined;
    setCurrentState(
      displayModeControlEnabled
        ? { status: "loading" }
        : { status: "missing-input" },
    );
  };
  app.ontoolresult = async (result) => {
    if (result.isError === true) {
      const message = truncateContextText(
        result.content?.find((item) => item.type === "text")?.text.trim() ||
          "The opening tool failed. Ask Codex to retry opening the sequence from chat.",
        2_000,
      );
      openingToolFailed = true;
      openingToolResultReceived = true;
      loadGeneration += 1;
      viewerCommandLoopGeneration += 1;
      awaitingNativeToolResultFile = false;
      pendingNativeInputFile = undefined;
      pendingViewerSessionActivation = undefined;
      displayModeControlEnabled = false;
      latestViewerInput = undefined;
      pendingPersistenceAbortController?.abort(
        new DOMException(message, "AbortError"),
      );
      pendingPersistenceAbortController = undefined;
      if (pendingExportAcknowledgment != null) {
        settleExportAcknowledgment(pendingExportAcknowledgment.commandId, {
          applied: false,
          message,
        });
      }
      resolveCurrentCommand?.({ applied: false, message });
      currentCommand = undefined;
      resolveCurrentCommand = undefined;
      viewerSessionId = undefined;
      viewerCommandLoopStarted = false;
      nativeScientificDataClient = null;
      pluginScientificDataClient = null;
      durableViewerState?.dispose();
      durableViewerState = undefined;
      setCurrentState({ message, status: "error" });
      return;
    }
    const session = parseSequenceViewerToolResultSession(
      result.structuredContent,
    );
    const chatInput = parseSequenceViewerToolResultMetadata(result._meta);
    if (chatInput != null) openingToolFailed = false;
    if (openingToolFailed) return;
    const pluginSource = parsePluginScientificSequenceSource(result._meta);
    const sameChatInput =
      chatInput != null &&
      latestViewerInput != null &&
      "primaryFile" in latestViewerInput &&
      latestViewerInput.primaryFile.name === chatInput.primaryFile.name &&
      latestViewerInput.primaryFile.uri === chatInput.primaryFile.uri;
    const samePluginSource =
      pluginSource == null
        ? pluginScientificDataClient == null
        : pluginScientificDataClient != null &&
          pluginScientificDataClient.source.sessionId === pluginSource.sessionId &&
          pluginScientificDataClient.source.sourceRevision ===
            pluginSource.sourceRevision &&
          pluginScientificDataClient.source.fileName === pluginSource.fileName &&
          pluginScientificDataClient.source.format === pluginSource.format &&
          pluginScientificDataClient.source.sizeBytesDecimal ===
            pluginSource.sizeBytesDecimal;
    if (
      sameChatInput &&
      currentState.status === "ready" &&
      (session == null || session.sessionId === viewerSessionId) &&
      samePluginSource
    ) {
      awaitingNativeToolResultFile = false;
      pendingNativeInputFile = undefined;
      displayModeControlEnabled = true;
      openingToolResultReceived = true;
      return;
    }
    if (
      result.structuredContent != null &&
      typeof result.structuredContent === "object" &&
      "viewerPresentation" in result.structuredContent
    ) {
      const presentation = result.structuredContent.viewerPresentation;
      if (presentation === "full" || presentation === "inline") {
        initialToolbarVisible = presentation === "full";
      }
    } else {
      initialToolbarVisible = undefined;
    }
    if (
      session != null &&
      createHostScientificSequenceDataClient(app) == null
    ) {
      // Adopt the server-provisioned session before awaiting resource I/O.
      // Otherwise app startup can observe an empty session and register a
      // second fallback while this result is already being processed.
      if (chatInput != null) {
        pendingViewerSessionActivation = session;
        activateViewerSession(session);
      } else if (
        viewerSessionId !== session.sessionId ||
        !viewerCommandLoopStarted
      ) {
        activateViewerSession(session);
      }
    }
    pluginScientificDataClient =
      pluginSource != null &&
      session != null &&
      pluginSource.sessionId === session.sessionId &&
      typeof app.callServerTool === "function"
        ? new PluginScientificSequenceDataClient(app, pluginSource)
        : null;
    if (chatInput != null) {
      awaitingNativeToolResultFile = false;
      pendingNativeInputFile = undefined;
      displayModeControlEnabled = true;
      await loadInput(chatInput);
      // A failed opening and retry can replace this input while its read settles.
      if (latestViewerInput !== chatInput) return;
    } else if (awaitingNativeToolResultFile) {
      const nativeInput = parseSequenceViewerToolInput(
        result.structuredContent,
      );
      if (nativeInput != null) {
        awaitingNativeToolResultFile = false;
        const supersedesInput =
          pendingNativeInputFile?.name !== nativeInput.file.name ||
          pendingNativeInputFile.resourceUri !== nativeInput.file.resourceUri;
        pendingNativeInputFile = undefined;
        displayModeControlEnabled = false;
        if (supersedesInput) {
          await loadInput(nativeInput);
          if (latestViewerInput !== nativeInput) return;
        }
      }
    }
    openingToolResultReceived = true;
    if (
      connected &&
      viewerSessionId == null &&
      nativeScientificDataClient == null &&
      createHostScientificSequenceDataClient(app) == null
    ) {
      await ensureViewerSession();
    }
  };
  app.addEventListener("hostcontextchanged", (context) => {
    const hostContext = app.getHostContext() ?? context;
    applyHostContext(hostContext);
    if (nativeScientificDataClient != null) {
      const refreshedContext =
        context != null &&
        typeof context === "object" &&
        Object.hasOwn(context, "scientificViewers")
          ? context
          : hostContext;
      refreshHostScientificSequenceDataClient(
        app,
        nativeScientificDataClient,
        refreshedContext,
      );
    }
  });
  await app.connect();
  connected = true;
  applyHostContext(app.getHostContext());
  if (typeof app.callServerTool !== "function") {
    return;
  }
  // Chat opens receive an opening tool result, which may already contain the
  // server-provisioned session. Native installed-host opens can provide only a
  // file tool input. The first ready-context publication above is the native
  // fallback barrier; do not race a still-pending opening result here.
  if (
    viewerSessionId == null &&
    openingToolResultReceived &&
    nativeScientificDataClient == null &&
    createHostScientificSequenceDataClient(app) == null
  ) {
    await ensureViewerSession();
  } else if (
    viewerSessionId != null &&
    !viewerCommandLoopStarted &&
    nativeScientificDataClient == null
  ) {
    startViewerCommandLoopIfReady();
  }

  async function ensureViewerSession(): Promise<void> {
    if (
      openingToolFailed ||
      viewerSessionId != null ||
      viewerSessionRegistration != null ||
      nativeScientificDataClient != null ||
      createHostScientificSequenceDataClient(app) != null ||
      typeof app.callServerTool !== "function"
    ) {
      return viewerSessionRegistration;
    }
    const registrationInput = latestViewerInput;
    const registrationGeneration = viewerCommandLoopGeneration;
    viewerSessionRegistration = (async () => {
      const registrationResult = await app.callServerTool?.({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      if (
        registrationResult == null ||
        viewerSessionId != null ||
        openingToolFailed ||
        registrationGeneration !== viewerCommandLoopGeneration
      ) {
        return;
      }
      const registration = sequenceViewerSessionSchema.parse(
        registrationResult.structuredContent,
      );
      pendingViewerSessionActivation = registration;
      activateViewerSession(registration);
      const pluginSource = parsePluginScientificSequenceSource(
        registrationResult._meta,
      );
      const sourceInput = latestViewerInput;
      const sourceFileName =
        sourceInput == null
          ? undefined
          : "file" in sourceInput
            ? sourceInput.file.name
            : sourceInput.primaryFile.name;
      if (
        pluginSource != null &&
        pluginSource.sessionId === registration.sessionId &&
        sourceInput === registrationInput &&
        pluginSource.fileName === sourceFileName &&
        typeof app.callServerTool === "function"
      ) {
        pluginScientificDataClient = new PluginScientificSequenceDataClient(
          app,
          pluginSource,
        );
        if (latestViewerInput != null) {
          if (currentState.status !== "ready") {
            await loadInput(latestViewerInput);
          } else {
            const sourceStateKey = currentState.sourceStateKey;
            const restorationLoadGeneration = loadGeneration;
            const nextDurableViewerState =
              new SequenceDurableViewerStateController(pluginScientificDataClient);
            try {
              await nextDurableViewerState.restore();
            } catch (error) {
              nextDurableViewerState.dispose();
              if (
                loadGeneration === restorationLoadGeneration &&
                viewerSessionId === registration.sessionId &&
                pendingViewerSessionActivation === registration
              ) {
                setCurrentState({
                  message:
                    error instanceof Error
                      ? error.message
                      : "The Sequence viewer could not restore its saved state.",
                  status: "error",
                });
              }
              return;
            }
            if (
              currentState.status !== "ready" ||
              currentState.sourceStateKey !== sourceStateKey ||
              latestViewerInput !== sourceInput ||
              viewerSessionId !== registration.sessionId ||
              pluginScientificDataClient.source.sourceId !==
                pluginSource.sourceId
            ) {
              nextDurableViewerState.dispose();
              return;
            }
            durableViewerState = nextDurableViewerState;
            renderCurrentState();
          }
        }
      }
      if (pendingViewerSessionActivation === registration) {
        pendingViewerSessionActivation = undefined;
        startViewerCommandLoopIfReady();
      }
    })();
    try {
      await viewerSessionRegistration;
    } finally {
      viewerSessionRegistration = undefined;
    }
  }

  function activateViewerSession(session: {
    revision: number;
    sessionId: string;
  }): void {
    if (openingToolFailed) return;
    pendingPersistenceAbortController?.abort(
      new DOMException("The viewer session changed.", "AbortError"),
    );
    pendingPersistenceAbortController = undefined;
    if (pendingExportAcknowledgment != null) {
      settleExportAcknowledgment(pendingExportAcknowledgment.commandId, {
        applied: false,
        message: "The viewer session changed before persistence completed.",
      });
    }
    resolveCurrentCommand?.({
      applied: false,
      message: "The viewer session changed before the action completed.",
    });
    currentCommand = undefined;
    resolveCurrentCommand = undefined;
    viewerSessionId = session.sessionId;
    viewerCommandRevision = session.revision;
    viewerCommandLoopGeneration += 1;
    viewerCommandLoopStarted = false;
    renderCurrentState();
    startViewerCommandLoopIfReady();
  }

  function startViewerCommandLoopIfReady(): void {
    // A long poll can occupy the same host request lane as the file read and
    // checkpoint restoration needed to mount this viewer.
    if (
      !connected ||
      openingToolFailed ||
      currentState.status !== "ready" ||
      pendingViewerSessionActivation != null ||
      nativeScientificDataClient != null ||
      viewerSessionId == null ||
      viewerCommandLoopStarted
    ) {
      return;
    }
    viewerCommandLoopStarted = true;
    void runViewerCommandLoop(
      viewerCommandLoopGeneration,
      viewerSessionId,
      viewerCommandRevision,
    );
  }

  async function runViewerCommandLoop(
    generation: number,
    sessionId: string,
    initialRevision: number,
  ): Promise<void> {
    let revision = initialRevision;
    let attemptedInactiveSessionRecovery = false;
    let pendingCompletion:
      | {
          command: QueuedSequenceViewerCommand;
          result: SequenceViewerCommandResult;
        }
      | undefined;
    while (connected && generation === viewerCommandLoopGeneration) {
      try {
        if (pendingCompletion != null) {
          pendingPersistenceAbortController ??= new AbortController();
          let completionResult: SequenceViewerCommandResult;
          try {
            completionResult = await persistSequenceCommandResult(app, {
              command: pendingCompletion.command,
              result: pendingCompletion.result,
              sessionId,
              signal: pendingPersistenceAbortController.signal,
            });
          } catch (error) {
            if (generation !== viewerCommandLoopGeneration) {
              await completeSupersededPersistenceCommand(app, {
                commandId: pendingCompletion.command.commandId,
                sessionId,
              });
              return;
            }
            if (isRetryableSequencePersistenceError(error)) throw error;
            completionResult = {
              applied: false,
              message:
                `The viewer could not persist the requested workbench payload: ${
                  error instanceof Error ? error.message : "validation failed"
                }`.slice(0, 2_000),
            };
          }
          const completionRequest = createProxySafeCommandCompletionRequest({
            commandId: pendingCompletion.command.commandId,
            result: completionResult,
            sessionId,
          });
          const completionReceipt = await app.callServerTool(completionRequest);
          if (generation !== viewerCommandLoopGeneration) return;
          const completionWasApplied =
            completionResult.applied &&
            completionRequest.arguments?.applied === true &&
            completionReceipt.isError !== true;
          settleExportAcknowledgment(
            pendingCompletion.command.commandId,
            completionWasApplied
              ? completionResult
              : {
                  applied: false,
                  message: completionResult.message,
                },
          );
          revision = pendingCompletion.command.revision;
          viewerCommandRevision = revision;
          pendingCompletion = undefined;
          pendingPersistenceAbortController = undefined;
          currentCommand = undefined;
          resolveCurrentCommand = undefined;
          renderCurrentState();
          continue;
        }
        const waitResult = await app.callServerTool({
          arguments: {
            afterRevision: revision,
            sessionId,
            timeoutMs: 25_000,
          },
          name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
        });
        if (generation !== viewerCommandLoopGeneration) {
          return;
        }
        if (waitResult.isError) {
          const message = waitResult.content.find(
            (item) => item.type === "text",
          );
          throw new Error(
            message?.text ?? "The viewer command could not be polled.",
          );
        }
        const { command } = sequenceViewerWaitResultSchema.parse(
          waitResult.structuredContent,
        );
        if (command == null) {
          continue;
        }
        if (command.action === "set_display_mode") {
          const requestedMode = command.displayMode ?? "fullscreen";
          await requestDisplayMode(requestedMode);
          if (generation !== viewerCommandLoopGeneration) return;
          pendingCompletion = {
            command,
            result: {
              applied: true,
              message:
                requestedMode === "fullscreen"
                  ? "Moved the viewer to the side pane."
                  : "Returned the viewer to the chat thread.",
              state: { displayMode: requestedMode },
            },
          };
          continue;
        }
        currentCommand = command;
        renderCurrentState();
        const result = await new Promise<SequenceViewerCommandResult>(
          (resolve) => {
            const timeout = window.setTimeout(
              () =>
                resolve({
                  applied: false,
                  message: "The viewer could not apply the requested action.",
                }),
              20_000,
            );
            resolveCurrentCommand = (value) => {
              window.clearTimeout(timeout);
              resolve(value);
            };
          },
        );
        if (generation !== viewerCommandLoopGeneration) return;
        pendingCompletion = { command, result };
      } catch (error) {
        if (
          !attemptedInactiveSessionRecovery &&
          pendingCompletion == null &&
          error instanceof Error &&
          /viewer session is no longer active/iu.test(error.message) &&
          generation === viewerCommandLoopGeneration &&
          viewerSessionId === sessionId &&
          latestViewerInput != null &&
          "primaryFile" in latestViewerInput &&
          pluginScientificDataClient?.source.sessionId === sessionId
        ) {
          attemptedInactiveSessionRecovery = true;
          try {
            if (
              await restoreChatViewerSession(
                latestViewerInput,
                pluginScientificDataClient,
                loadGeneration,
              )
            ) {
              const restored = pendingViewerSessionActivation;
              if (
                restored != null &&
                restored.sessionId === sessionId &&
                generation === viewerCommandLoopGeneration
              ) {
                pendingViewerSessionActivation = undefined;
                activateViewerSession(restored);
                return;
              }
            }
          } catch {
            // Preserve the visible card; never mint an unauthenticated session.
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
    }
  }
}

export function createProxySafeCommandCompletionRequest({
  commandId,
  result,
  sessionId,
}: {
  commandId: string;
  result: SequenceViewerCommandResult;
  sessionId: string;
}): Parameters<App["callServerTool"]>[0] {
  const request = {
    arguments: {
      applied: result.applied,
      commandId,
      message: result.message,
      sessionId,
      state: result.state ?? {},
    },
    name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  };
  const requestBytes = encodedSequenceToolRequestBytes(request);
  if (
    requestBytes <= SEQUENCE_VIEWER_LIMITS.command.maxCompletionRequestBytes
  ) {
    return request;
  }
  return {
    arguments: {
      applied: false,
      commandId,
      message: `The viewer result was ${requestBytes.toLocaleString()} bytes and exceeded the ${SEQUENCE_VIEWER_LIMITS.command.maxCompletionRequestBytes.toLocaleString()}-byte completion request budget. Request a smaller page or coordinate window.`,
      sessionId,
      state: {},
    },
    name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  };
}

async function completeSupersededPersistenceCommand(
  app: Pick<App, "callServerTool">,
  { commandId, sessionId }: { commandId: string; sessionId: string },
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await app.callServerTool({
        arguments: {
          applied: false,
          commandId,
          message: "The viewer session changed before persistence completed.",
          sessionId,
          state: {},
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      return;
    } catch {
      if (attempt === 2) return;
      await new Promise((resolve) =>
        window.setTimeout(resolve, 50 * 2 ** attempt),
      );
    }
  }
}

const rootElement = document.getElementById("root");
if (rootElement != null) {
  await startSequenceViewerApp(rootElement);
}
