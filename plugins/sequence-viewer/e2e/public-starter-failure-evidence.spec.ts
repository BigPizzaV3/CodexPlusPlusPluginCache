import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

const evidenceRoot =
  process.env.SEQUENCE_VIEWER_PUBLIC_EXAMPLES_EVIDENCE_ROOT?.trim() ?? "";
const runtimePluginRoot =
  process.env.SEQUENCE_VIEWER_E2E_PLUGIN_ROOT?.trim() ?? process.cwd();
const qualificationOutputRoot =
  process.env.SEQUENCE_VIEWER_QUALIFICATION_OUTPUT_ROOT?.trim() ??
  path.join(process.cwd(), "output/playwright/lsc-109-qualification");
const enabled =
  process.env.SEQUENCE_VIEWER_PUBLIC_STARTER_FAILURE_E2E === "1" &&
  process.env.SEQUENCE_VIEWER_E2E_FAULT_INJECTION === "1" &&
  path.isAbsolute(evidenceRoot) &&
  path.isAbsolute(runtimePluginRoot) &&
  path.isAbsolute(qualificationOutputRoot);
const failuresDirectory = path.join(qualificationOutputRoot, "failures");
const logsDirectory = path.join(qualificationOutputRoot, "logs/failures");
const screenshotsDirectory = path.join(
  qualificationOutputRoot,
  "screenshots/failures",
);
const tracesDirectory = path.join(
  qualificationOutputRoot,
  "traces/failures",
);
const starterContract = JSON.parse(
  readFileSync(path.join(runtimePluginRoot, "starter-examples.json"), "utf8"),
) as {
  examples: Array<{ id: string; prompt: string }>;
  pluginVersion: string;
};
const installedManifest = JSON.parse(
  readFileSync(
    path.join(runtimePluginRoot, ".codex-plugin/plugin.json"),
    "utf8",
  ),
) as { name: string; version: string };
if (installedManifest.version !== starterContract.pluginVersion) {
  throw new Error(
    "The bundled manifest and starter contract versions do not match.",
  );
}

const acquisitionScenarios: Array<AcquisitionScenario> = [
  {
    exampleId: "ncbi-nc-001416-1",
    expectedError:
      "The authoritative database could not be reached. Check network access and retry.",
    requirement: "network-unavailable",
  },
  {
    exampleId: "ncbi-nc-001416-1",
    expectedError:
      "The authoritative database returned HTTP 429. Retry after 60 seconds.",
    requirement: "rate-limit",
  },
  {
    exampleId: "ncbi-nc-001416-1",
    expectedError:
      "NCBI GenBank response contained an HTML or database error page.",
    requirement: "malformed-database-response",
  },
  {
    exampleId: "ncbi-nc-001416-1",
    expectedError: "The authoritative database returned HTTP 404.",
    requirement: "accession-missing",
  },
  {
    exampleId: "ena-drr037765-first-500",
    expectedError:
      "ENA file metadata did not uniquely match the pinned run and FASTQ file.",
    requirement: "payload-format-mismatch",
  },
  {
    exampleId: "ncbi-nc-001416-1",
    expectedError:
      "The authoritative response exceeded the starter byte budget.",
    requirement: "oversized-source-or-analysis-budget",
  },
  {
    exampleId: "ena-drr037765-first-500",
    expectedError:
      "The pinned ENA run did not contain 500 complete, identity-matched FASTQ reads.",
    requirement: "deterministic-subset-failure",
  },
];

test.skip(
  !enabled,
  "Set the bundle-backed starter failure qualification environment.",
);

test.beforeEach(async () => {
  await rm(evidenceRoot, { force: true, recursive: true });
  await mkdir(evidenceRoot, { recursive: true });
  expect(await readdir(evidenceRoot)).toEqual([]);
});

for (const scenario of acquisitionScenarios) {
  test(`bundle-backed ${scenario.requirement} is actionable and leaves no viewer or artifact`, async ({
    page,
  }, testInfo) => {
    const startedAt = new Date().toISOString();
    const contract = exampleContract(scenario.exampleId);
    await openFaultedStarter(page, contract, scenario.requirement);
    const status = page.getByRole("status");
    await expect(status).toHaveText(scenario.expectedError, {
      timeout: scenario.requirement === "deterministic-subset-failure"
        ? 60_000
        : 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Open acquired record" }),
    ).toBeEnabled();
    const state = await failureState(page);
    expect(state.viewerOpenCount).toBe(0);
    expect(state.viewerHasSource).toBe(false);
    expect(state.contextSessionIds).toEqual([]);
    expect(state.eventSessionIds).toEqual([]);
    expect(state.publicStarterResultPresent).toBe(false);
    expect(state.acquisitionCallCount).toBe(1);
    expect(state.registrationCallCount).toBe(0);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toEqual(
      expect.objectContaining({
        name: "sequence.acquire_public_example",
        status: "ok",
        summary: expect.objectContaining({ error: true }),
      }),
    );
    expect(
      state.events.every(({ requestBytes }) => requestBytes <= 280 * 1_024),
    ).toBe(true);
    const workspace = await workspaceSnapshot(evidenceRoot);
    expect(workspace.files).toEqual([]);
    expect(workspace.nonRegularEntries).toEqual([]);
    expect(workspace.directories).toEqual(["codex-viewer-examples"]);
    const serialized = JSON.stringify({ state, workspace });
    expect(serialized).not.toContain(evidenceRoot);
    expect(serialized).not.toMatch(/smoke-fixtures|bundled sample/iu);
    await writeFailureEvidence({
      assertions: {
        actionableResult: true,
        noBundledFallback: true,
        noMisleadingArtifact: true,
        noMisleadingViewer: true,
        sessionCount: 0,
        viewerContributionCount: 0,
        workspaceFileCount: 0,
      },
      completedAt: new Date().toISOString(),
      exampleId: scenario.exampleId,
      observedError: scenario.expectedError,
      page,
      requirement: scenario.requirement,
      startedAt,
      state,
      testInfo,
      workspace,
    });
  });
}

test("bundle-backed output quota failure preserves the mounted source and publishes no derived artifact", async ({
  page,
}, testInfo) => {
  const requirement: FaultScenario = "output-quota-failure";
  const startedAt = new Date().toISOString();
  const contract = exampleContract("uniprot-human-ras-sv1");
  await openFaultedStarter(page, contract, requirement);
  await expect(page.getByRole("status")).toHaveText(
    /^One installed viewer session opened · [0-9a-f-]{36}$/u,
    { timeout: 60_000 },
  );
  await expect(
    page.frameLocator("#viewer").getByLabel(
      "Interactive multiple sequence alignment viewer",
    ),
  ).toBeVisible();
  const sessionId = await page.evaluate(
    () => window.__publicStarterToolResult.structuredContent.viewerSessionId,
  );
  await callTool(page, "sequence.run_analysis", {
    algorithm: "neighbor-joining",
    analysis: "build-tree",
    sessionId,
  });
  await waitForJob(page, sessionId, "guide-tree");
  const exportResult = await page.evaluate(
    async ({ sessionId }) =>
      await window.callRealMcpTool("sequence.export_artifact", {
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: "quota-failure.nwk",
        },
        format: "newick",
        scope: "all",
        sessionId,
      }),
    { sessionId },
  );
  expect(
    exportResult?.isError === true ||
      exportResult?.structuredContent?.applied === false,
  ).toBe(true);
  const observedError = toolResultText(exportResult);
  expect(observedError).toContain(
    "workspace destination does not have enough free disk space",
  );
  await expect(page.getByRole("status")).toContainText(observedError);
  const state = await failureState(page);
  expect(state.viewerOpenCount).toBe(1);
  expect(state.viewerHasSource).toBe(true);
  expect(state.contextSessionIds).toEqual([sessionId]);
  expect(state.eventSessionIds).toEqual([sessionId]);
  expect(state.acquisitionCallCount).toBe(1);
  expect(state.registrationCallCount).toBe(0);
  const workspace = await workspaceSnapshot(evidenceRoot);
  expect(workspace.nonRegularEntries).toEqual([]);
  expect(workspace.files.map(({ relativePath }) => relativePath)).toEqual([
    "codex-viewer-examples/human-RAS-UniProt-SV1.aln-fasta",
    "codex-viewer-examples/human-RAS-UniProt-SV1.aln-fasta.provenance.json",
  ]);
  expect(
    workspace.files.some(({ relativePath }) =>
      /quota-failure|\.stage|\.tmp/iu.test(relativePath),
    ),
  ).toBe(false);
  const serialized = JSON.stringify({ exportResult, state, workspace });
  expect(serialized).not.toContain(evidenceRoot);
  expect(serialized).not.toMatch(/smoke-fixtures|bundled sample/iu);
  await writeFailureEvidence({
    assertions: {
      actionableResult: true,
      mountedSourcePreserved: true,
      noBundledFallback: true,
      noMisleadingArtifact: true,
      noMisleadingViewer: true,
      sessionCount: 1,
      viewerContributionCount: 1,
      workspaceFileCount: 2,
    },
    completedAt: new Date().toISOString(),
    exampleId: contract.id,
    observedError,
    page,
    requirement,
    startedAt,
    state: { ...state, exportResult },
    testInfo,
    workspace,
  });
});

async function openFaultedStarter(
  page: Page,
  contract: { id: string; prompt: string },
  requirement: FaultScenario,
): Promise<void> {
  const query = new URLSearchParams({
    "public-example-id": contract.id,
    "qualification-fault": requirement,
    "real-public-starter": "1",
    "starter-prompt": contract.prompt,
  });
  await page.goto(`/e2e/installed.html?${query}`);
  await expect(page.getByLabel("Marketplace starter evidence")).toBeVisible();
  await expect(page.getByText(contract.prompt, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open acquired record" }).click();
}

async function callTool(
  page: Page,
  name: string,
  args: Record<string, unknown>,
): Promise<RealMcpToolResult> {
  const result = await page.evaluate(
    async ({ args, name }) => await window.callRealMcpTool(name, args),
    { args, name },
  );
  expect(result?.isError, JSON.stringify(result)).not.toBe(true);
  expect(result?.structuredContent?.applied, JSON.stringify(result)).not.toBe(
    false,
  );
  return result;
}

async function waitForJob(
  page: Page,
  sessionId: string,
  kind: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await callTool(page, "sequence.query_viewer", {
          limit: 100,
          sessionId,
          target: "jobs",
        });
        return (response.structuredContent?.result?.items ?? []).some(
          (job: { kind: string; status: string }) =>
            job.kind === kind && job.status === "completed",
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function failureState(page: Page) {
  return await page.evaluate(() => ({
    acquisitionCallCount: window.__realMcpRequests.filter(
      ({ method, params }) =>
        method === "tools/call" &&
        params?.name === "sequence.acquire_public_example",
    ).length,
    contextSessionIds: [
      ...new Set(
        window.__viewerContexts
          .map(({ structuredContent }) => structuredContent?.viewerSessionId)
          .filter((value): value is string => typeof value === "string"),
      ),
    ],
    eventSessionIds: [
      ...new Set(
        window.__realMcpEvents
          .map(({ summary }) => summary.viewerSessionId)
          .filter((value): value is string => typeof value === "string"),
      ),
    ],
    events: window.__realMcpEvents,
    publicStarterResultPresent:
      window.__publicStarterToolResult != null,
    registrationCallCount: window.__realMcpRequests.filter(
      ({ method, params }) =>
        method === "tools/call" &&
        params?.name === "sequence.register_viewer_session",
    ).length,
    requests: window.__realMcpRequests,
    viewerHasSource: document
      .querySelector("iframe#viewer")
      ?.hasAttribute("src") ?? false,
    viewerOpenCount: window.__viewerOpenCount,
  }));
}

async function writeFailureEvidence({
  assertions,
  completedAt,
  exampleId,
  observedError,
  page,
  requirement,
  startedAt,
  state,
  testInfo,
  workspace,
}: {
  assertions: Record<string, boolean | number>;
  completedAt: string;
  exampleId: string;
  observedError: string;
  page: Page;
  requirement: FaultScenario;
  startedAt: string;
  state: Record<string, unknown>;
  testInfo: TestInfo;
  workspace: WorkspaceSnapshot;
}): Promise<void> {
  await Promise.all([
    mkdir(failuresDirectory, { recursive: true }),
    mkdir(logsDirectory, { recursive: true }),
    mkdir(screenshotsDirectory, { recursive: true }),
    mkdir(tracesDirectory, { recursive: true }),
  ]);
  const screenshotPath = path.join(screenshotsDirectory, `${requirement}.png`);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  const tracePath = path.join(tracesDirectory, `${requirement}.json`);
  await writeFile(
    tracePath,
    `${JSON.stringify({
      completedAt,
      exampleId,
      observedError,
      requirement,
      startedAt,
      state,
      workspace,
    }, null, 2)}\n`,
  );
  const logPath = path.join(logsDirectory, `${requirement}.log`);
  await writeFile(
    logPath,
    [
      `requirement=${requirement}`,
      `status=passed`,
      `exampleId=${exampleId}`,
      `observedError=${observedError}`,
      `assertions=${JSON.stringify(assertions)}`,
      `workspace=${JSON.stringify(workspace)}`,
      "",
    ].join("\n"),
  );
  const [log, screenshot, trace] = await Promise.all([
    describeEvidenceFile(logPath),
    describeEvidenceFile(screenshotPath),
    describeEvidenceFile(tracePath),
  ]);
  const record = {
    assertions,
    completedAt,
    environment: {
      bundleSha256: stringEnvironment(
        "SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_SHA256",
      ),
      commit: stringEnvironment("SEQUENCE_VIEWER_QUALIFICATION_COMMIT"),
      model: stringEnvironment("SEQUENCE_VIEWER_QUALIFICATION_MODEL"),
      node: process.version,
      operatingSystem: `${os.type()} ${os.release()}`,
      optionalSkills: stringEnvironment(
        "SEQUENCE_VIEWER_QUALIFICATION_OPTIONAL_SKILLS",
      ),
      plugin: {
        name: installedManifest.name,
        version: installedManifest.version,
      },
      reasoning: stringEnvironment(
        "SEQUENCE_VIEWER_QUALIFICATION_REASONING",
      ),
    },
    evidence: { log, screenshot, trace },
    exampleId,
    faultInjection: {
      boundary: "qualification-only preload around exact bundled MCP server",
      scenario: requirement,
    },
    observedError,
    requirement,
    schemaVersion: 1,
    startedAt,
    status: "passed",
    test: testInfo.title,
    workspace,
  };
  const recordPath = path.join(failuresDirectory, `${requirement}.json`);
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  await testInfo.attach(`${requirement}-screenshot`, {
    contentType: "image/png",
    path: screenshotPath,
  });
  await testInfo.attach(`${requirement}-trace`, {
    contentType: "application/json",
    path: tracePath,
  });
  await testInfo.attach(`${requirement}-log`, {
    contentType: "text/plain",
    path: logPath,
  });
}

async function workspaceSnapshot(
  root: string,
  directory = root,
): Promise<WorkspaceSnapshot> {
  const snapshot: WorkspaceSnapshot = {
    directories: [],
    files: [],
    nonRegularEntries: [],
  };
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const filePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, filePath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      snapshot.directories.push(relativePath);
      const nested = await workspaceSnapshot(root, filePath);
      snapshot.directories.push(...nested.directories);
      snapshot.files.push(...nested.files);
      snapshot.nonRegularEntries.push(...nested.nonRegularEntries);
    } else if (entry.isFile()) {
      const contents = await readFile(filePath);
      snapshot.files.push({
        byteLength: contents.byteLength,
        relativePath,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    } else {
      snapshot.nonRegularEntries.push(relativePath);
    }
  }
  snapshot.directories.sort((left, right) => left.localeCompare(right));
  snapshot.files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  snapshot.nonRegularEntries.sort((left, right) => left.localeCompare(right));
  return snapshot;
}

async function describeEvidenceFile(filePath: string): Promise<EvidenceFile> {
  const [contents, metadata] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ]);
  return {
    byteLength: metadata.size,
    relativePath: path
      .relative(qualificationOutputRoot, filePath)
      .split(path.sep)
      .join("/"),
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function exampleContract(id: string) {
  const example = starterContract.examples.find(
    (candidate) => candidate.id === id,
  );
  if (example == null) throw new Error(`Missing starter contract ${id}.`);
  return example;
}

function toolResultText(result: RealMcpToolResult): string {
  return (
    result.content?.find(({ type }) => type === "text")?.text ??
    JSON.stringify(result)
  );
}

function stringEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value == null || value === "") {
    throw new Error(`${name} is required for LSC-109 qualification.`);
  }
  return value;
}

declare global {
  interface Window {
    __publicStarterToolResult: {
      structuredContent: { viewerSessionId: string };
    };
    __realMcpEvents: Array<{
      name: string | null;
      requestBytes: number;
      status: "error" | "ok";
      summary: {
        error?: boolean;
        viewerSessionId?: string | null;
      };
    }>;
    __realMcpRequests: Array<{
      method: string;
      params?: { name?: string; uri?: string };
    }>;
    __viewerContexts: Array<{
      structuredContent: Record<string, any>;
      text: string;
    }>;
    __viewerOpenCount: number;
    callRealMcpTool: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<RealMcpToolResult>;
  }
}

type FaultScenario =
  | "accession-missing"
  | "deterministic-subset-failure"
  | "malformed-database-response"
  | "network-unavailable"
  | "output-quota-failure"
  | "oversized-source-or-analysis-budget"
  | "payload-format-mismatch"
  | "rate-limit";

type AcquisitionScenario = {
  exampleId: string;
  expectedError: string;
  requirement: Exclude<FaultScenario, "output-quota-failure">;
};

type RealMcpToolResult = {
  content?: Array<{ text?: string; type: string }>;
  isError?: boolean;
  structuredContent?: { applied?: boolean; result?: any };
};

type EvidenceFile = {
  byteLength: number;
  relativePath: string;
  sha256: string;
};

type WorkspaceSnapshot = {
  directories: Array<string>;
  files: Array<EvidenceFile>;
  nonRegularEntries: Array<string>;
};
