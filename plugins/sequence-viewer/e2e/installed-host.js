const search = new URLSearchParams(location.search);
const fixtureName = search.get("name") ?? search.get("fixture") ?? "dna-single.fasta";
const sourcePath = search.get("source");
const starterPrompt = search.get("starter-prompt");
const starterProvenance = search.get("starter-provenance");
const publicExampleId = search.get("public-example-id");
const qualificationFault = search.get("qualification-fault");
const codexManagedStarter = search.has("codex-managed-starter");
const rootlessHost = search.has("rootless-host");
const realPublicStarter = search.has("real-public-starter") && publicExampleId != null;
const persistentNativeRecovery = search.has("persistent-native");
const fixtureCache = new Map();
const queuedCommands = [];
const completions = new Map();
const completedUploads = new Map();
const savedSessions = new Map();
const workspaceArtifacts = new Map();
const workspaceDirectories = new Set(["data", "data/exports", "results"]);
const workspaceSidecars = new Set();
const workspaceSessions = new Map();
const workspaceTrackCandidates = {
  bam: "22222222-2222-4222-8222-222222222222",
  bai: "33333333-3333-4333-8333-333333333333",
  gff: "44444444-4444-4444-8444-444444444444",
  reference: "55555555-5555-4555-8555-555555555555",
  root: "66666666-6666-4666-8666-666666666666",
};
const workspaceTrackBundles = new Map();
const uploads = new Map();
let revision = 0;
let failedCompletion = false;
let failedPersistenceAppend = false;
let failedPersistenceFinish = false;
let publicStarterToolResult;
let codexPreparedStarterSource;
let persistentNativeOpeningResult;
let sealedPersistentNativeViewerHtml;
const persistentNativeState = {
  checkpoint: undefined,
  lastAcknowledgedRevision: 0,
  logicalSessionId: undefined,
  records: [],
  sourceRevision: "installed-sequence-native-source-v1",
};
const proxyEnvelopeBytes = 280 * 1_024;

window.__viewerContexts = [];
window.__completionAttempts = 0;
window.__messages = [];
window.__maxToolsCallBytes = 0;
window.__persistenceToolCalls = [];
window.__persistentNativeBundle = undefined;
window.__persistentNativeRequests = [];
window.__publicStarterToolResult = undefined;
window.__resourceRequests = [];
window.__realMcpEvents = [];
window.__realMcpRequests = [];
window.__toolRequests = [];
window.__viewerOpenCount = 0;
window.readPersistentNativeCheckpoint = () =>
  persistentNativeState.checkpoint == null
    ? undefined
    : JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(persistentNativeState.checkpoint),
      );
window.remountPersistentNativeViewer = () => {
  if (!persistentNativeRecovery || sealedPersistentNativeViewerHtml == null) {
    throw new Error("The original sealed native viewer HTML is unavailable.");
  }
  viewerFrame.srcdoc = sealedPersistentNativeViewerHtml;
  window.__persistentNativeBundle.mountCount += 1;
};
window.readSavedSession = (id) => savedSessions.get(id);
window.readWorkspaceArtifact = (workspacePath) => workspaceArtifacts.get(workspacePath);
window.readWorkspaceSession = (workspacePath) => workspaceSessions.get(workspacePath);
window.prepareCodexManagedStarter = (absoluteSourcePath) => {
  if (
    !codexManagedStarter ||
    typeof absoluteSourcePath !== "string" ||
    !absoluteSourcePath.startsWith("/")
  ) {
    throw new Error("A Codex-managed starter requires its exact absolute source path.");
  }
  codexPreparedStarterSource = absoluteSourcePath;
};
window.callRealMcpTool = async (name, args) => {
  const result = await invokeRealMcp({
    method: "tools/call",
    params: { arguments: args, name },
  });
  if (
    qualificationFault != null &&
    (result?.isError === true || result?.structuredContent?.applied === false)
  ) {
    document.getElementById("starter-status").textContent =
      result.content?.find(({ type }) => type === "text")?.text ??
      "Qualification tool operation failed.";
  }
  return result;
};
window.openViewerFixture = (name) =>
  sendNativeInput(document.getElementById("viewer").contentWindow, name);
window.enqueueViewerCommand = (command) => {
  const queued = {
    ...command,
    commandId: crypto.randomUUID(),
    revision: ++revision,
  };
  queuedCommands.push(queued);
  return new Promise((resolve) => completions.set(queued.commandId, resolve));
};

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.jsonrpc !== "2.0" || message.method == null) return;
  if (message.id == null && message.method === "ui/notifications/initialized") {
    if (persistentNativeRecovery && persistentNativeOpeningResult != null)
      sendPersistentNativeOpen(event.source);
    else if (publicStarterToolResult != null)
      sendPublicStarterOpen(event.source, publicStarterToolResult);
    else if (search.has("chat")) sendChatOpen(event.source);
    else if (search.has("native-indexed")) sendNativeIndexedOpen(event.source);
    else if (search.has("native-fallback")) sendNativeFallback(event.source);
    else if (search.has("switch")) sendFileSwitch(event.source);
    else sendNativeInput(event.source, fixtureName);
    return;
  }
  if (message.id != null) void respond(event.source, message);
});

const viewerFrame = document.getElementById("viewer");
if (persistentNativeRecovery) {
  void initializePersistentNativeViewer().catch((error) => {
    console.error("Installed native Sequence recovery failed.", error);
    viewerFrame.dataset.persistentNativeError =
      error instanceof Error ? error.message : "Native recovery failed.";
  });
} else if ((sourcePath != null || realPublicStarter || codexManagedStarter) && starterPrompt != null) {
  const starter = document.getElementById("starter");
  starter.dataset.visible = "true";
  document.getElementById("starter-prompt").textContent = starterPrompt;
  document.getElementById("starter-provenance").textContent = realPublicStarter
    ? "Authoritative source will be acquired through the installed MCP server."
    : codexManagedStarter
      ? "Codex prepared the authoritative source with its existing workspace permissions."
      : (starterProvenance ?? "Authoritative provenance receipt verified");
  if (realPublicStarter) {
    document.getElementById("starter-status").textContent =
      "Ready to acquire and validate the authoritative record";
  }
  document.getElementById("open-starter").addEventListener("click", async (event) => {
    if (viewerFrame.hasAttribute("src")) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (codexManagedStarter) {
        if (codexPreparedStarterSource == null) {
          throw new Error("Codex must prepare the source before opening the viewer.");
        }
        document.getElementById("starter-status").textContent =
          "Opening the source Codex prepared...";
        const result = await invokeRealMcp({
          method: "tools/call",
          params: {
            arguments: { path: codexPreparedStarterSource },
            name: "sequence.open_from_chat",
          },
        });
        if (result?.isError) {
          throw new Error(
            result.content?.find(({ type }) => type === "text")?.text ??
              "The Codex-prepared source could not be opened.",
          );
        }
        const sessionId = result?.structuredContent?.viewerSessionId;
        const primaryFile = result?._meta?.["openai/viewerFile"]?.primaryFile;
        if (
          typeof sessionId !== "string" ||
          typeof primaryFile?.name !== "string" ||
          !String(primaryFile?.uri).startsWith("viewer-file://sequence-viewer/opened/")
        ) {
          throw new Error("The installed MCP server returned an incomplete viewer result.");
        }
        publicStarterToolResult = result;
        window.__publicStarterToolResult = result;
        document.getElementById("starter-status").textContent =
          `One installed viewer session opened · ${sessionId}`;
      } else if (realPublicStarter) {
        document.getElementById("starter-status").textContent =
          "Acquiring and validating the authoritative record...";
        const result = await invokeRealMcp({
          method: "tools/call",
          params: {
            arguments: { exampleId: publicExampleId },
            name: "sequence.acquire_public_example",
          },
        });
        if (result?.isError) {
          throw new Error(
            result.content?.find(({ type }) => type === "text")?.text ??
              "Authoritative acquisition failed.",
          );
        }
        const provenance = result?.structuredContent?.publicExampleProvenance;
        const sessionId = result?.structuredContent?.viewerSessionId;
        const primaryFile = result?._meta?.["openai/viewerFile"]?.primaryFile;
        if (
          provenance == null ||
          typeof sessionId !== "string" ||
          typeof primaryFile?.name !== "string" ||
          !String(primaryFile?.uri).startsWith("viewer-file://sequence-viewer/opened/")
        ) {
          throw new Error("The installed MCP server returned an incomplete viewer result.");
        }
        publicStarterToolResult = result;
        window.__publicStarterToolResult = result;
        document.getElementById("starter-provenance").textContent =
          `${provenance.database} · ${provenance.resolvedIdentifier} · ${provenance.artifactByteLength} bytes · SHA-256 ${provenance.artifactSha256} · opaque resource ${primaryFile.uri}`;
        document.getElementById("starter-status").textContent =
          `One installed viewer session opened · ${sessionId}`;
      } else {
        document.getElementById("starter-status").textContent =
          "One installed viewer session opened";
      }
      window.__viewerOpenCount += 1;
      viewerFrame.src = "/e2e/generated-viewer.html";
    } catch (error) {
      document.getElementById("starter-status").textContent =
        error instanceof Error ? error.message : "Authoritative acquisition failed.";
      button.disabled = false;
    }
  });
} else {
  viewerFrame.src = "/e2e/generated-viewer.html";
}

async function respond(target, message) {
  try {
    let result = {};
    if (message.method === "ui/initialize") {
      result = {
        protocolVersion: message.params?.protocolVersion ?? "2026-01-26",
        hostCapabilities: {
          message: { text: {} },
          ...(persistentNativeRecovery
            ? { scientificViewers: persistentNativeHostCapabilities() }
            : {}),
          updateModelContext: { text: {} },
        },
        hostContext: {
          availableDisplayModes: ["inline", "fullscreen"],
          displayMode: "inline",
          ...(persistentNativeRecovery
            ? { scientificViewers: persistentNativeHostCapabilities() }
            : {}),
        },
        hostInfo: { name: "Playwright sequence host", version: "1" },
      };
    } else if (
      persistentNativeRecovery &&
      message.method === "tools/call" &&
      String(message.params?.name).startsWith("ui/scientific/sequence/")
    ) {
      result = await callPersistentNativeOperation(
        message.params.name,
        message.params.arguments ?? {},
      );
    } else if (
      persistentNativeRecovery &&
      ["resources/read", "tools/call"].includes(message.method)
    ) {
      throw new Error("Persistent native Sequence recovery never forwards iframe requests to MCP.");
    } else if (
      (realPublicStarter || codexManagedStarter) &&
      ["resources/read", "tools/call"].includes(message.method)
    ) {
      result = await invokeRealMcp({
        method: message.method,
        params: message.params,
      });
    } else if (message.method === "resources/read") {
      window.__resourceRequests.push(message.params?.uri);
      if (search.has("resource-error")) {
        throw new Error("SEQUENCE_VIEWER_FILE_EXPIRED: The original file changed. Reopen it.");
      }
      if (message.params?.uri === "codex-resource://oversized-native") {
        await sleep(250);
        throw new Error("This file exceeds the bounded viewer limit of 32.0 MiB.");
      }
      if (String(message.params?.uri).startsWith("viewer-file://sequence-viewer/opened/")) {
        result = {
          contents: [
            {
              text: indexedNativeEnvelope(),
              uri: message.params?.uri,
            },
          ],
        };
        target.postMessage({ id: message.id, jsonrpc: "2.0", result }, "*");
        return;
      }
      const name = fileNameFromUri(message.params?.uri);
      if (name === "slow.fasta") await sleep(250);
      result = {
        contents: [
          {
            text: await readFixture(name),
            uri: message.params?.uri,
          },
        ],
      };
    } else if (message.method === "tools/call") {
      const requestBytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
      window.__maxToolsCallBytes = Math.max(window.__maxToolsCallBytes, requestBytes);
      if (requestBytes > proxyEnvelopeBytes) {
        throw new Error(
          `tools/call request ${requestBytes} exceeds the ${proxyEnvelopeBytes}-byte proxy envelope`,
        );
      }
      result = await callTool(message.params?.name ?? "", message.params?.arguments ?? {});
    } else if (message.method === "ui/update-model-context") {
      window.__viewerContexts.push({
        structuredContent: message.params?.structuredContent,
        text: message.params?.content?.[0]?.text ?? "",
      });
    } else if (message.method === "ui/request-display-mode") {
      result = { mode: message.params?.mode ?? "inline" };
    } else if (message.method === "ui/message") {
      window.__messages.push(message.params);
      result = { isError: false };
    }
    target.postMessage({ id: message.id, jsonrpc: "2.0", result }, "*");
  } catch (error) {
    target.postMessage(
      {
        error: {
          code: -32_000,
          message: error instanceof Error ? error.message : "Host error",
        },
        id: message.id,
        jsonrpc: "2.0",
      },
      "*",
    );
  }
}

async function initializePersistentNativeViewer() {
  const [source, opening] = await Promise.all([
    readFixture(fixtureName),
    invokeRealMcp({
      method: "tools/call",
      params: {
        arguments: { path: fixtureName },
        name: "sequence.open_from_chat",
      },
    }),
  ]);
  if (opening?.isError === true) {
    throw new Error(
      opening.content?.find(({ type }) => type === "text")?.text ??
        "The real installed Sequence server did not open the fixture.",
    );
  }
  const primaryFile = opening?._meta?.["openai/viewerFile"]?.primaryFile;
  const logicalSessionId = opening?.structuredContent?.viewerSessionId;
  if (
    typeof logicalSessionId !== "string" ||
    primaryFile?.name !== fixtureName ||
    typeof primaryFile?.uri !== "string" ||
    !primaryFile.uri.startsWith("viewer-file://sequence-viewer/opened/")
  ) {
    throw new Error("The installed Sequence opening did not issue a real session.");
  }
  const templateUri = opening?._meta?.["openai/outputTemplate"];
  if (templateUri !== "ui://sequence-viewer/viewer") {
    throw new Error("The installed Sequence opening returned an unsafe template.");
  }
  const resource = await invokeRealMcp({
    method: "resources/read",
    params: { uri: templateUri },
  });
  const html = resource?.contents
    ?.flatMap((content) => (typeof content?.text === "string" ? [content.text] : []))
    .join("\n");
  const htmlBytes = new TextEncoder().encode(html ?? "");
  if (htmlBytes.byteLength === 0 || htmlBytes.byteLength > 4 * 1024 * 1024) {
    throw new Error("The real installed Sequence viewer HTML is not safely bounded.");
  }
  persistentNativeState.records = parsePersistentNativeRecords(source);
  if (persistentNativeState.records.length === 0) {
    throw new Error("The native Sequence source contains no readable records.");
  }
  persistentNativeState.logicalSessionId = logicalSessionId;
  persistentNativeOpeningResult = opening;
  sealedPersistentNativeViewerHtml = html;
  window.__persistentNativeBundle = {
    byteLength: htmlBytes.byteLength,
    mountCount: 1,
    sha256: await digestHex(htmlBytes),
  };
  window.__viewerOpenCount += 1;
  viewerFrame.srcdoc = sealedPersistentNativeViewerHtml;
}

function persistentNativeHostCapabilities() {
  const session = {
    backendGeneration: 1,
    backendInstanceId: "installed-sequence-native-worker",
    family: "sequence",
    logicalSessionId: persistentNativeState.logicalSessionId,
  };
  return {
    attachment: {
      ...session,
      channelId: "installed-sequence-native-channel",
      expiresAtMs: Date.now() + 5 * 60 * 1000,
      frameId: "installed-sequence-native-frame",
    },
    binaryTransfer: "bounded-process-ipc",
    effectiveCapabilities: {
      ...session,
      canEditApprovedSource: true,
      canReadRanges: true,
      sourceRevision: persistentNativeState.sourceRevision,
    },
    familyScopedChannels: true,
    processIsolation: "family-process",
    protocolVersion: 1,
    transportSupportsRangeReads: true,
  };
}

async function callPersistentNativeOperation(name, args) {
  if (
    args.family !== "sequence" ||
    args.logicalSessionId !== persistentNativeState.logicalSessionId ||
    args.backendInstanceId !== "installed-sequence-native-worker" ||
    args.backendGeneration !== 1 ||
    args.sourceRevision !== persistentNativeState.sourceRevision ||
    args.frameId !== "installed-sequence-native-frame" ||
    args.channelId !== "installed-sequence-native-channel" ||
    args.resourceUri !== "ui://sequence-viewer/viewer"
  ) {
    throw new Error("The native Sequence request has no valid frame attachment.");
  }
  window.__persistentNativeRequests.push({
    checkpointBytes: args.checkpoint instanceof Uint8Array ? args.checkpoint.byteLength : undefined,
    name,
    revision: persistentNativeState.lastAcknowledgedRevision,
  });
  if (name === "ui/scientific/sequence/records") {
    const cursor = Number(args.cursor ?? "0");
    const limit = Number(args.limit);
    if (
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      limit > 256
    ) {
      throw new Error("The native Sequence record page is out of bounds.");
    }
    const end = Math.min(cursor + limit, persistentNativeState.records.length);
    return {
      structuredContent: {
        complete: end === persistentNativeState.records.length,
        cursor: String(cursor),
        nextCursor: end === persistentNativeState.records.length ? null : String(end),
        records: persistentNativeState.records
          .slice(cursor, end)
          .map(({ description, id, sequence }) => ({
            description,
            id,
            sequenceLength: sequence.length,
          })),
        sourceRevision: persistentNativeState.sourceRevision,
      },
    };
  }
  if (name === "ui/scientific/sequence/window") {
    const record = persistentNativeState.records[Number(args.recordNumber) - 1];
    const start1 = Number(args.start1Decimal);
    const end1 = Number(args.end1Decimal);
    if (
      record == null ||
      !Number.isSafeInteger(start1) ||
      !Number.isSafeInteger(end1) ||
      start1 <= 0 ||
      end1 < start1 ||
      end1 > record.sequence.length ||
      end1 - start1 >= 1024 * 1024
    ) {
      throw new Error("The native Sequence residue window is out of bounds.");
    }
    const sequence = record.sequence.slice(start1 - 1, end1);
    return {
      structuredContent: {
        ...(args.includeQuality === true && record.quality != null
          ? { quality: record.quality.slice(start1 - 1, end1) }
          : {}),
        end1,
        sequence,
        sourceRevision: persistentNativeState.sourceRevision,
        start1,
      },
    };
  }
  if (name === "ui/scientific/sequence/restore_checkpoint") {
    return {
      structuredContent:
        persistentNativeState.checkpoint == null
          ? { hasCheckpoint: false }
          : {
              checkpoint: persistentNativeState.checkpoint.slice(),
              hasCheckpoint: true,
              lastAcknowledgedRevision: persistentNativeState.lastAcknowledgedRevision,
              recoveryReference: "installed-sequence-native-recovery",
              sourceRevision: persistentNativeState.sourceRevision,
            },
    };
  }
  if (name === "ui/scientific/sequence/checkpoint") {
    if (
      !(args.checkpoint instanceof Uint8Array) ||
      args.checkpoint.byteLength === 0 ||
      args.checkpoint.byteLength > 192 * 1024 ||
      !Number.isSafeInteger(args.lastAcknowledgedRevision) ||
      args.lastAcknowledgedRevision < 0 ||
      args.lastAcknowledgedRevision > persistentNativeState.lastAcknowledgedRevision
    ) {
      throw new Error("The native Sequence checkpoint is unsafe or stale.");
    }
    const decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(args.checkpoint));
    if (
      decoded?.family !== "sequence" ||
      decoded.sourceRevision !== persistentNativeState.sourceRevision ||
      decoded.version !== 1
    ) {
      throw new Error("The native Sequence checkpoint has an invalid source.");
    }
    persistentNativeState.checkpoint = args.checkpoint.slice();
    persistentNativeState.lastAcknowledgedRevision += 1;
    return {
      structuredContent: {
        checkpointVersion: 1,
        lastAcknowledgedRevision: persistentNativeState.lastAcknowledgedRevision,
        logicalSessionId: persistentNativeState.logicalSessionId,
        recoveryReference: "installed-sequence-native-recovery",
      },
    };
  }
  throw new Error(`The native Sequence operation ${name} is not available.`);
}

function parsePersistentNativeRecords(source) {
  const lines = source.split(/\r?\n/u);
  const records = [];
  if (lines[0]?.startsWith("@")) {
    for (let index = 0; index + 3 < lines.length; index += 4) {
      const match = /^@(\S+)(?:\s+(.*))?$/u.exec(lines[index]);
      if (match == null || lines[index + 2] !== "+") {
        throw new Error("The native FASTQ source is invalid.");
      }
      const sequence = lines[index + 1];
      const quality = lines[index + 3];
      if (sequence.length !== quality.length) {
        throw new Error("The native FASTQ source has invalid qualities.");
      }
      records.push({
        description: match[2] ?? "",
        id: match[1],
        quality,
        sequence,
      });
    }
    return records;
  }
  let active;
  for (const line of lines) {
    if (line.startsWith(">")) {
      const match = /^>(\S+)(?:\s+(.*))?$/u.exec(line);
      if (match == null) throw new Error("The native FASTA source is invalid.");
      active = {
        description: match[2] ?? "",
        id: match[1],
        sequence: "",
      };
      records.push(active);
    } else if (line.trim() !== "") {
      if (active == null) throw new Error("The native FASTA source is invalid.");
      active.sequence += line.trim();
    }
  }
  return records;
}

function sendPersistentNativeOpen(target) {
  const primaryFile = persistentNativeOpeningResult._meta["openai/viewerFile"].primaryFile;
  sendNativeInputWithResource(target, primaryFile.name, primaryFile.uri);
  target.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: persistentNativeOpeningResult,
    },
    "*",
  );
}

async function callTool(name, args) {
  window.__toolRequests.push({ arguments: args, name });
  if (name.includes("workbench_payload") || name.includes("workspace_export")) {
    window.__persistenceToolCalls.push(name);
  }
  if (name === "sequence.register_viewer_session") {
    return {
      structuredContent: {
        revision: 0,
        schemaVersion: 1,
        sessionId: "11111111-1111-4111-8111-111111111111",
      },
    };
  }
  if (name === "sequence.wait_for_viewer_command") {
    const command = queuedCommands.find(
      (candidate) => candidate.revision > (args.afterRevision ?? 0),
    );
    if (command == null) await sleep(30);
    return {
      structuredContent: {
        command:
          command ??
          queuedCommands.find((candidate) => candidate.revision > (args.afterRevision ?? 0)) ??
          null,
      },
    };
  }
  if (name === "sequence.complete_viewer_command") {
    window.__completionAttempts += 1;
    const result = {
      applied: args.applied === true,
      message: args.message ?? "",
      state: args.state ?? {},
    };
    const completion = completions.get(args.commandId);
    if (completion != null) {
      completion(result);
      completions.delete(args.commandId);
      const index = queuedCommands.findIndex(({ commandId }) => commandId === args.commandId);
      if (index >= 0) queuedCommands.splice(index, 1);
    }
    if (search.has("completion-failure") && !failedCompletion) {
      failedCompletion = true;
      throw new Error("Injected lost completion response");
    }
    return {
      structuredContent: {
        completed: true,
        duplicate: completion == null,
        late: false,
      },
    };
  }
  if (name === "sequence.list_workspace_track_directory") {
    if (search.has("workspace-unavailable")) {
      throw new Error("Workspace track browsing is unavailable without trusted file metadata.");
    }
    return { structuredContent: listWorkspaceTracks() };
  }
  if (name === "sequence.resolve_workspace_track_bundle") {
    const primary = workspaceTrackEntry(args.primaryCandidateId);
    if (primary == null || primary.role === "index" || primary.role === "reference") {
      throw new Error("Choose a supported primary workspace track.");
    }
    const { bundle: _bundle, ...resolvedPrimary } = primary;
    const bundleId = crypto.randomUUID();
    workspaceTrackBundles.set(bundleId, resolvedPrimary);
    return {
      structuredContent: {
        bundleId,
        primary: resolvedPrimary,
        ready: true,
        requirements:
          resolvedPrimary.format === "bam"
            ? [
                {
                  candidates: [workspaceTrackEntry(workspaceTrackCandidates.bai)],
                  message: "Selected reads.bam.bai as the index.",
                  omittedCandidates: 0,
                  role: "index",
                  selectedCandidate: workspaceTrackEntry(workspaceTrackCandidates.bai),
                  status: "selected",
                },
              ]
            : [],
      },
    };
  }
  if (name === "sequence.load_workspace_track") {
    const primary = workspaceTrackBundles.get(args.bundleId);
    if (primary == null) throw new Error("The workspace track bundle expired.");
    if (
      primary.format === "bam" &&
      (args.reference !== "ref" || args.start !== 1 || args.end !== 45)
    ) {
      throw new Error("Workspace BAM requires the confirmed ref:1-45 window.");
    }
    const content =
      primary.format === "bam"
        ? "@HD\tVN:1.6\n@SQ\tSN:ref\tLN:45\nr1\t0\tref\t2\t60\t4M\t*\t0\t0\tCGTA\tIIII\n"
        : "##gff-version 3\nref\ttest\tgene\t2\t8\t.\t+\t.\tID=gene-1;Name=Gene%201\n";
    const completion = await window.enqueueViewerCommand({
      action: "load_track",
      content,
      displayName: primary.label,
      encoding: "utf8",
      format: primary.format,
      reference: primary.format === "bam" ? args.reference : "ref",
      sourceContentHash: "a".repeat(64),
      sourceItemCount: primary.format === "bam" ? 6 : undefined,
      sourceTruncated: false,
      sourceWorkspacePath: primary.workspacePath,
      trackId: crypto.randomUUID(),
    });
    if (!completion.applied) throw new Error(completion.message);
    const track = completion.state.track;
    return {
      structuredContent: {
        format: primary.format,
        itemCount: track.summary.itemCount,
        kind: track.kind,
        loaded: true,
        mappingStatus: track.mapping.status,
        name: primary.label,
        sha256: "a".repeat(64),
        sourceTruncated: track.summary.truncated,
        sourceWorkspacePath: primary.workspacePath,
      },
    };
  }
  if (name === "sequence.list_workspace_export_directory") {
    if (search.has("workspace-unavailable")) {
      throw new Error(
        "Workspace publication is unavailable for this viewer. Reopen a local workspace file after the host provides trusted file metadata.",
      );
    }
    return {
      structuredContent: listWorkspaceDirectory(args),
    };
  }
  if (name === "sequence.list_workspace_sessions") {
    if (search.has("workspace-unavailable")) {
      throw new Error("Workspace session discovery is unavailable without trusted file metadata.");
    }
    return {
      structuredContent: {
        candidates: [...workspaceSessions.values()].map((session) => ({
          candidateId: session.candidateId,
          createdAt: session.createdAt,
          dependencies: [],
          mode: session.mode,
          name: session.name,
          sourceStatus: "verification-required",
          workspacePath: session.workspacePath,
        })),
        omittedCandidates: 0,
      },
    };
  }
  if (name === "sequence.restore_workspace_session") {
    const session = [...workspaceSessions.values()].find(
      ({ candidateId }) => candidateId === args.candidateId,
    );
    if (session == null) throw new Error("Workspace session candidate expired.");
    const completion = await window.enqueueViewerCommand({
      action: "restore_session",
      mode: session.mode,
      session: session.payload,
    });
    if (!completion.applied) throw new Error(completion.message);
    return {
      structuredContent: {
        dependencies: [],
        mode: session.mode,
        name: session.name,
        restored: true,
        workspacePath: session.workspacePath,
      },
    };
  }
  if (name === "sequence.create_workspace_export_directory") {
    if (search.has("workspace-unavailable")) {
      throw new Error(
        "Workspace publication is unavailable for this viewer. Reopen a local workspace file after the host provides trusted file metadata.",
      );
    }
    const parent = resolveSourceRelativeWorkspacePath(args.parentDirectory);
    const created = `${parent === "." ? "" : `${parent}/`}${args.name}`;
    if (
      workspaceDirectories.has(created) ||
      workspaceArtifacts.has(created) ||
      workspaceSidecars.has(created)
    ) {
      throw new Error("A workspace entry with that folder name already exists.");
    }
    workspaceDirectories.add(created);
    return {
      structuredContent: {
        name: args.name,
        relativePath: workspacePathRelativeToSource(created),
        workspacePath: created,
      },
    };
  }
  if (name === "sequence.prepare_workspace_export") {
    if (search.has("workspace-unavailable")) {
      throw new Error(
        "Workspace publication is unavailable for this viewer. Reopen a local workspace file after the host provides trusted file metadata.",
      );
    }
    return {
      structuredContent: {
        commandId: crypto.randomUUID(),
        destination: { base: "opened-source", kind: "workspace" },
        maxWorkspaceArtifactBytes: 2 * 1_024 * 1_024 * 1_024,
      },
    };
  }
  if (name === "sequence.generate_workspace_export") {
    const existing = completedUploads.get(args.operationId);
    if (existing != null) return { structuredContent: existing };
    const source = await readFixture(fixtureName);
    const bytes = new TextEncoder().encode(source);
    const sha256 = await digestHex(bytes);
    const result = workspaceArtifactResult(
      {
        ...args,
        kind: "artifact",
        uploadId: args.operationId,
      },
      bytes,
      sha256,
    );
    result.metrics = {
      acceptedBytes: bytes.byteLength,
      chunkCount: Math.ceil(bytes.byteLength / (192 * 1_024)),
      committedBytes: bytes.byteLength,
      elapsedMs: { publish: 0, receive: 0, total: 0, validate: 0 },
      mode: "server-generated",
      peakRetainedBytes: Math.min(bytes.byteLength, 1024 * 1024),
      producedBytes: bytes.byteLength,
      retryCount: 0,
    };
    completedUploads.set(args.operationId, result);
    return { structuredContent: result };
  }
  if (name === "sequence.persist_workbench_payload") {
    const existing = completedUploads.get(args.uploadId);
    if (existing != null) return { structuredContent: existing };
    const bytes = decodeBase64(args.dataBase64);
    if (bytes.byteLength !== args.byteLength) {
      throw new Error("One-shot payload length mismatch");
    }
    return {
      structuredContent: await completeUpload(args, bytes),
    };
  }
  if (name === "sequence.begin_workbench_payload_upload") {
    const completed = completedUploads.get(args.uploadId);
    if (completed != null) {
      return {
        structuredContent: {
          maxChunkBytes: 192 * 1_024,
          maxWorkspaceArtifactBytes: 2 * 1_024 * 1_024 * 1_024,
          receivedBytes: args.byteLength,
          uploadId: args.uploadId,
        },
      };
    }
    let upload = uploads.get(args.uploadId);
    if (upload == null) {
      upload = {
        accepted: new Map(),
        bytes: new Uint8Array(args.byteLength),
        declaration: { ...args },
        receivedBytes: 0,
      };
      uploads.set(args.uploadId, upload);
    }
    return {
      structuredContent: {
        maxChunkBytes: 192 * 1_024,
        maxWorkspaceArtifactBytes: 2 * 1_024 * 1_024 * 1_024,
        receivedBytes: upload.receivedBytes,
        uploadId: args.uploadId,
      },
    };
  }
  if (name === "sequence.append_workbench_payload_chunk") {
    const upload = uploads.get(args.uploadId);
    if (upload == null) throw new Error("Upload not found");
    const chunk = decodeBase64(args.dataBase64);
    if (args.offset < upload.receivedBytes) {
      const accepted = upload.accepted.get(args.offset);
      if (accepted !== args.dataBase64) {
        throw new Error("Changed duplicate chunk");
      }
    } else {
      if (args.offset !== upload.receivedBytes) {
        throw new Error("Non-sequential upload offset");
      }
      upload.bytes.set(chunk, args.offset);
      upload.accepted.set(args.offset, args.dataBase64);
      upload.receivedBytes += chunk.byteLength;
    }
    const result = {
      structuredContent: {
        maxChunkBytes: 192 * 1_024,
        maxWorkspaceArtifactBytes: 2 * 1_024 * 1_024 * 1_024,
        receivedBytes: upload.receivedBytes,
        uploadId: args.uploadId,
      },
    };
    if (search.has("persistence-failure") && !failedPersistenceAppend) {
      failedPersistenceAppend = true;
      throw new Error("Injected proxy timeout after append");
    }
    return result;
  }
  if (name === "sequence.finish_workbench_payload_upload") {
    let completed = completedUploads.get(args.uploadId);
    if (completed == null) {
      const upload = uploads.get(args.uploadId);
      if (upload == null || upload.receivedBytes !== upload.bytes.byteLength) {
        throw new Error("Upload is incomplete");
      }
      completed = await completeUpload(upload.declaration, upload.bytes);
      uploads.delete(args.uploadId);
    }
    if (search.has("persistence-failure") && !failedPersistenceFinish) {
      failedPersistenceFinish = true;
      throw new Error("Injected proxy timeout after finish");
    }
    return { structuredContent: completed };
  }
  if (name === "sequence.abort_workbench_payload_upload") {
    const completed = completedUploads.get(args.uploadId);
    if (completed != null) {
      return {
        structuredContent: {
          aborted: false,
          result: completed,
          uploadId: args.uploadId,
        },
      };
    }
    const aborted = uploads.delete(args.uploadId);
    return { structuredContent: { aborted, uploadId: args.uploadId } };
  }
  return { structuredContent: {} };
}

function listWorkspaceTracks() {
  return {
    breadcrumbs: [
      {
        candidateId: workspaceTrackCandidates.root,
        label: "Workspace",
        workspacePath: ".",
      },
      {
        candidateId: workspaceTrackCandidates.root,
        label: "data",
        workspacePath: "data",
      },
    ],
    directory: {
      candidateId: workspaceTrackCandidates.root,
      label: "data",
      workspacePath: "data",
    },
    entries: [
      workspaceTrackEntry(workspaceTrackCandidates.gff),
      workspaceTrackEntry(workspaceTrackCandidates.bam),
      workspaceTrackEntry(workspaceTrackCandidates.bai),
      workspaceTrackEntry(workspaceTrackCandidates.reference),
    ],
    omittedEntries: 1,
  };
}

function workspaceTrackEntry(candidateId) {
  if (candidateId === workspaceTrackCandidates.gff) {
    return {
      candidateId,
      format: "gff3",
      kind: "file",
      label: "genes.gff3",
      role: "annotation",
      size: 73,
      workspacePath: "data/genes.gff3",
    };
  }
  if (candidateId === workspaceTrackCandidates.bam) {
    return {
      bundle: {
        indexMatches: 1,
        indexStatus: "ready",
        referenceMatches: 0,
        referenceStatus: "not-required",
      },
      candidateId,
      format: "bam",
      kind: "file",
      label: "reads.bam",
      role: "reads",
      size: 392,
      workspacePath: "data/reads.bam",
    };
  }
  if (candidateId === workspaceTrackCandidates.bai) {
    return {
      candidateId,
      format: "bai",
      kind: "file",
      label: "reads.bam.bai",
      role: "index",
      size: 96,
      workspacePath: "data/reads.bam.bai",
    };
  }
  if (candidateId === workspaceTrackCandidates.reference) {
    return {
      candidateId,
      format: "fasta",
      kind: "file",
      label: "source.fasta",
      role: "reference",
      size: 52,
      workspacePath: "data/source.fasta",
    };
  }
  return undefined;
}

async function completeUpload(declaration, bytes) {
  const sha256 = await digestHex(bytes);
  if (sha256 !== declaration.sha256) {
    throw new Error("Upload digest mismatch");
  }
  const result =
    declaration.kind === "artifact"
      ? declaration.destination?.kind === "workspace"
        ? workspaceArtifactResult(declaration, bytes, sha256)
        : {
            createdAt: Date.now(),
            format: declaration.format,
            id: declaration.uploadId,
            kind: "artifact",
            mediaType: declaration.mediaType,
            name: declaration.name,
            resourceUri: `viewer-artifact://sequence-viewer/generated/${declaration.uploadId}`,
            sha256,
            size: bytes.byteLength,
            version: 1,
          }
      : declaration.destination?.kind === "workspace"
        ? workspaceSessionResult(declaration, bytes, sha256)
        : {
            kind: "session",
            name: declaration.name,
            savedSessionId: declaration.uploadId,
            sha256,
            size: bytes.byteLength,
          };
  if (declaration.kind === "session" && declaration.destination?.kind !== "workspace") {
    savedSessions.set(
      declaration.uploadId,
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  }
  completedUploads.set(declaration.uploadId, result);
  return result;
}

function workspaceSessionResult(declaration, bytes, payloadSha256) {
  const payload = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed = JSON.parse(payload);
  const requested = resolveSourceRelativeWorkspacePath(declaration.destination.relativePath);
  const resolved = resolveWorkspaceCandidate(
    requested,
    declaration.destination.collisionPolicy ?? "exact",
  );
  const workspacePath = resolved.workspacePath;
  const session = {
    candidateId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: parsed.view.mode,
    name: resolved.name,
    payload,
    workspacePath,
  };
  workspaceSessions.set(workspacePath, session);
  workspaceArtifacts.set(
    workspacePath,
    JSON.stringify({
      createdAt: session.createdAt,
      dependencies: [],
      mode: session.mode,
      payload,
      payloadSha256,
      plugin: { name: "sequence-viewer", version: "0.1.26" },
      schemaVersion: 1,
      source: {
        sha256: "a".repeat(64),
        size: 1,
        workspacePath: `data/${fixtureName}`,
      },
      version: 1,
    }),
  );
  workspaceSidecars.add(`${workspacePath}.provenance.json`);
  return {
    destination: { base: "opened-source", kind: "workspace" },
    kind: "session",
    name: resolved.name,
    outputWorkspacePath: workspacePath,
    payloadSha256,
    payloadSize: bytes.byteLength,
    provenanceWorkspacePath: `${workspacePath}.provenance.json`,
    sha256: payloadSha256,
    size: bytes.byteLength,
    version: 1,
  };
}

function workspaceArtifactResult(declaration, bytes, sha256) {
  const requested = resolveSourceRelativeWorkspacePath(declaration.destination.relativePath);
  const resolved = resolveWorkspaceCandidate(
    requested,
    declaration.destination.collisionPolicy ?? "exact",
  );
  const normalized = resolved.workspacePath;
  const result = {
    destination: { base: "opened-source", kind: "workspace" },
    format: declaration.format,
    kind: "artifact",
    mediaType: declaration.mediaType,
    name: resolved.name,
    outputWorkspacePath: normalized,
    provenanceWorkspacePath: `${normalized}.provenance.json`,
    sha256,
    size: bytes.byteLength,
    version: 1,
  };
  workspaceArtifacts.set(normalized, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  workspaceSidecars.add(`${normalized}.provenance.json`);
  return result;
}

function listWorkspaceDirectory(args) {
  const directory = resolveSourceRelativeWorkspacePath(args.directory ?? ".");
  if (directory !== "." && !workspaceDirectories.has(directory)) {
    throw new Error("Workspace browsing requires an existing real directory.");
  }
  const children = [];
  for (const candidate of workspaceDirectories) {
    if (workspaceParent(candidate) === directory) {
      children.push({
        kind: "directory",
        name: workspaceBaseName(candidate),
        relativePath: workspacePathRelativeToSource(candidate),
      });
    }
  }
  const sourceWorkspacePath = `data/${fixtureName}`;
  const files = new Map([[sourceWorkspacePath, 64]]);
  for (const [workspacePath, content] of workspaceArtifacts) {
    files.set(workspacePath, new TextEncoder().encode(content).byteLength);
  }
  for (const workspacePath of workspaceSidecars) files.set(workspacePath, 128);
  for (const [workspacePath, size] of files) {
    if (workspaceParent(workspacePath) === directory) {
      children.push({
        kind: "file",
        name: workspaceBaseName(workspacePath),
        relativePath: workspacePathRelativeToSource(workspacePath),
        size,
      });
    }
  }
  children.sort((left, right) => left.name.localeCompare(right.name));
  const offset = args.cursor == null ? 0 : Number(args.cursor);
  const limit = args.limit ?? 50;
  const entries = children.slice(offset, offset + limit);
  const result = {
    directory: {
      breadcrumbs: workspaceBreadcrumbs(directory),
      parentRelativePath:
        directory === "." ? undefined : workspacePathRelativeToSource(workspaceParent(directory)),
      relativePath: workspacePathRelativeToSource(directory),
      sourceDirectoryWorkspacePath: "data",
      workspacePath: directory,
    },
    entries,
    nextCursor:
      offset + entries.length < children.length ? String(offset + entries.length) : undefined,
    omittedEntries: 0,
  };
  if (args.candidate != null) {
    const requested = `${directory === "." ? "" : `${directory}/`}${args.candidate.name}`;
    const exactAvailable = workspaceCandidateAvailable(requested);
    let next;
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const workspacePath = versionedWorkspacePath(requested, attempt);
      if (workspaceCandidateAvailable(workspacePath)) {
        next = { name: workspaceBaseName(workspacePath), workspacePath };
        break;
      }
    }
    result.candidate = {
      exactAvailable,
      exactWorkspacePath: requested,
      name: args.candidate.name,
      nextVersionName: next?.name,
      nextVersionWorkspacePath: next?.workspacePath,
    };
  }
  return result;
}

function resolveWorkspaceCandidate(requested, collisionPolicy) {
  const attempts = collisionPolicy === "next-version" ? 100 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const workspacePath = versionedWorkspacePath(requested, attempt);
    if (workspaceCandidateAvailable(workspacePath)) {
      return { name: workspaceBaseName(workspacePath), workspacePath };
    }
  }
  throw new Error(
    collisionPolicy === "next-version"
      ? "No available workspace export version was found within 100 attempts."
      : "The workspace export or provenance sidecar already exists.",
  );
}

function workspaceCandidateAvailable(workspacePath) {
  return (
    !workspaceArtifacts.has(workspacePath) &&
    !workspaceSidecars.has(workspacePath) &&
    !workspaceArtifacts.has(`${workspacePath}.provenance.json`) &&
    !workspaceSidecars.has(`${workspacePath}.provenance.json`) &&
    !workspaceDirectories.has(workspacePath)
  );
}

function versionedWorkspacePath(workspacePath, attempt) {
  if (attempt === 1) return workspacePath;
  const name = workspaceBaseName(workspacePath);
  const extension = name.lastIndexOf(".");
  const versioned =
    extension <= 0
      ? `${name}-${attempt}`
      : `${name.slice(0, extension)}-${attempt}${name.slice(extension)}`;
  const parent = workspaceParent(workspacePath);
  return `${parent === "." ? "" : `${parent}/`}${versioned}`;
}

function resolveSourceRelativeWorkspacePath(relativePath) {
  const parts = ["data"];
  for (const component of relativePath.split("/")) {
    if (component === "..") {
      if (parts.length === 0) throw new Error("Workspace path escapes root");
      parts.pop();
    } else if (component !== "." && component !== "") {
      parts.push(component);
    }
  }
  return parts.join("/") || ".";
}

function workspacePathRelativeToSource(workspacePath) {
  const source = ["data"];
  const target = workspacePath === "." ? [] : workspacePath.split("/");
  let common = 0;
  while (common < source.length && common < target.length && source[common] === target[common]) {
    common += 1;
  }
  const parts = [
    ...Array.from({ length: source.length - common }, () => ".."),
    ...target.slice(common),
  ];
  return parts.join("/") || ".";
}

function workspaceBreadcrumbs(workspacePath) {
  const breadcrumbs = [{ label: "Workspace", relativePath: "..", workspacePath: "." }];
  if (workspacePath === ".") return breadcrumbs;
  const parts = [];
  for (const component of workspacePath.split("/")) {
    parts.push(component);
    const current = parts.join("/");
    breadcrumbs.push({
      label: component,
      relativePath: workspacePathRelativeToSource(current),
      workspacePath: current,
    });
  }
  return breadcrumbs;
}

function workspaceParent(workspacePath) {
  const index = workspacePath.lastIndexOf("/");
  return index < 0 ? "." : workspacePath.slice(0, index);
}

function workspaceBaseName(workspacePath) {
  return workspacePath.split("/").at(-1);
}

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digestHex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sendNativeInput(target, name) {
  sendNativeInputWithResource(target, name, fixtureUri(name));
}

function sendNativeInputWithResource(target, name, resourceUri) {
  target.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-input",
      params: {
        arguments: {
          file: { name, resourceUri },
        },
      },
    },
    "*",
  );
}

function sendPublicStarterOpen(target, toolResult) {
  if (!codexManagedStarter) {
    target.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-input",
        params: { arguments: { exampleId: publicExampleId } },
      },
      "*",
    );
  }
  target.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: toolResult,
    },
    "*",
  );
}

async function invokeRealMcp(request) {
  window.__realMcpRequests.push(request);
  const requestBody = JSON.stringify(request);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let responseBytes = 0;
  try {
    const response = await fetch("/__sequence-viewer-mcp", {
      body: requestBody,
      headers: {
        "content-type": "application/json",
        ...(rootlessHost ? { "x-sequence-viewer-workspace-roots": "none" } : {}),
        ...(qualificationFault == null
          ? {}
          : {
              "x-sequence-viewer-qualification-fault": qualificationFault,
            }),
      },
      method: "POST",
    });
    const responseText = await response.text();
    responseBytes = new TextEncoder().encode(responseText).byteLength;
    const result = JSON.parse(responseText);
    window.__realMcpEvents.push({
      durationMs: performance.now() - started,
      method: request.method,
      name: request.params?.name ?? null,
      requestBytes: new TextEncoder().encode(requestBody).byteLength,
      responseBytes,
      startedAt,
      status: response.ok ? "ok" : "error",
      summary: summarizeRealMcpResult(result),
      uri: request.params?.uri ?? null,
    });
    if (!response.ok) {
      throw new Error(result.error ?? "The installed MCP bridge failed.");
    }
    return result;
  } catch (error) {
    if (window.__realMcpEvents.at(-1)?.startedAt !== startedAt) {
      window.__realMcpEvents.push({
        durationMs: performance.now() - started,
        method: request.method,
        name: request.params?.name ?? null,
        requestBytes: new TextEncoder().encode(requestBody).byteLength,
        responseBytes,
        startedAt,
        status: "error",
        summary: {
          error: error instanceof Error ? error.message : "The installed MCP bridge failed.",
        },
        uri: request.params?.uri ?? null,
      });
    }
    throw error;
  }
}

function summarizeRealMcpResult(result) {
  const structured = result?.structuredContent;
  const nested = structured?.result;
  return {
    applied: structured?.applied ?? null,
    artifactByteLength:
      structured?.publicExampleProvenance?.artifactByteLength ?? nested?.byteLength ?? null,
    duplicate: structured?.duplicate ?? null,
    error: result?.isError === true,
    exampleId: structured?.publicExampleProvenance?.exampleId ?? null,
    outputWorkspacePath: nested?.outputWorkspacePath ?? null,
    resultKind: nested?.kind ?? null,
    viewerSessionId:
      structured?.viewerSessionId ?? structured?.sessionId ?? nested?.viewerSessionId ?? null,
  };
}

function sendNativeIndexedOpen(target) {
  sendNativeInputWithResource(target, "native-large.fasta", "codex-resource://oversized-native");
  setTimeout(
    () =>
      sendNativeResult(target, {
        name: "native-large.fasta",
        resourceUri: "viewer-file://sequence-viewer/opened/11111111-1111-4111-8111-111111111111",
      }),
    20,
  );
}

function sendNativeFallback(target) {
  const file = { name: fixtureName, resourceUri: fixtureUri(fixtureName) };
  sendNativeInputWithResource(target, file.name, file.resourceUri);
  setTimeout(() => sendNativeResult(target, file), 20);
}

function sendNativeResult(target, file) {
  target.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: { file } },
    },
    "*",
  );
}

function sendChatOpen(target) {
  target.postMessage(
    {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-input",
      params: { arguments: { path: `/workspace/${fixtureName}` } },
    },
    "*",
  );
  setTimeout(() => {
    target.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: {
          _meta: {
            "openai/viewerFile": {
              primaryFile: {
                name: fixtureName,
                uri: fixtureUri(fixtureName),
              },
            },
          },
          structuredContent: {
            schemaVersion: 1,
            sessionReady: true,
            viewerCommandRevision: 0,
            viewerReady: false,
            viewerSessionId: "22222222-2222-4222-8222-222222222222",
          },
        },
      },
      "*",
    );
  }, 20);
}

function sendFileSwitch(target) {
  sendNativeInput(target, "slow.fasta");
  setTimeout(() => sendNativeInput(target, "fast.fasta"), 20);
}

function fixtureUri(name) {
  return `viewer-file://e2e/${encodeURIComponent(name)}`;
}

function fileNameFromUri(uri) {
  return decodeURIComponent(String(uri ?? "").slice(String(uri ?? "").lastIndexOf("/") + 1));
}

function indexedNativeEnvelope() {
  const sequence = "ACGTACGT";
  return `OPENAI_SEQUENCE_VIEWER_INDEXED_V1\n${JSON.stringify({
    document: {
      classification: {
        alignment: null,
        confidence: "high",
        evidence: ["Server-streamed indexed FASTA."],
        kind: "single-sequence",
        molecule: "dna",
        suggestedViewer: "sequence",
      },
      fileName: "native-large.fasta",
      format: "fasta",
      kind: "single-sequence",
      recordInventory: {
        materializedCount: 1,
        totalCount: 1,
        truncated: false,
      },
      records: [
        {
          features: [],
          id: "indexed-native",
          length: sequence.length,
          metadata: {},
          molecule: "dna",
          sequence,
          sourceLabel: "indexed-native",
          topology: "unknown",
        },
      ],
      warnings: [],
    },
    index: {
      complete: true,
      compressed: false,
      decodedBytes: 32 * 1_024 * 1_024 + 1,
      indexedRecordCount: 1,
      materializedBases: sequence.length,
      materializedRecordCount: 1,
      sourceBytes: 32 * 1_024 * 1_024 + 1,
      sourceVersion: "installed-host-native-indexed-v1",
    },
    schemaVersion: 1,
  })}`;
}

function readFixture(name) {
  if (name === "slow.fasta") return Promise.resolve(">slow\nAAAA\n");
  if (name === "fast.fasta") return Promise.resolve(">fast\nCCCC\n");
  if (name === "large-sequence.fasta") {
    return Promise.resolve(`>large\n${"ACGT".repeat(25_000)}\n`);
  }
  if (name === "proxy-large.fasta") {
    return Promise.resolve(`>proxy-large\n${"ACGT".repeat(550_000)}\n`);
  }
  if (name === "large.fastq") {
    return Promise.resolve(
      Array.from({ length: 6_000 }, (_, index) => `@read-${index + 1}\nACGT\n+\nIIII`).join("\n"),
    );
  }
  if (sourcePath != null && name === fixtureName) {
    const normalizedSource = sourcePath.replace(/^\/+/, "");
    if (
      !normalizedSource.startsWith("output/playwright/") ||
      normalizedSource.split("/").includes("..") ||
      !/^[A-Za-z0-9._/-]+$/u.test(normalizedSource)
    ) {
      return Promise.reject(new Error("Evidence source path is invalid."));
    }
    return fetch(`/${normalizedSource}`).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Evidence source ${name} could not be read.`);
      }
      return await response.text();
    });
  }
  let fixture = fixtureCache.get(name);
  if (fixture == null) {
    fixture = fetch(`/smoke-fixtures/${encodeURIComponent(name)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Fixture ${name} could not be read.`);
      return await response.text();
    });
    fixtureCache.set(name, fixture);
  }
  return fixture;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
