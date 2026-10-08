import { expect, test } from "@playwright/test";

test("restores the exact installed Sequence viewer after its real MCP process exits", async ({
  page,
  request,
}) => {
  const loadedViewerBundles: Array<string> = [];
  page.on("request", (browserRequest) => {
    const pathname = new URL(browserRequest.url()).pathname;
    if (
      pathname === "/e2e/generated-viewer.html" ||
      pathname === "/dist/views/app.js.gz" ||
      pathname === "/dist/views/styles.css"
    ) {
      loadedViewerBundles.push(pathname);
    }
  });

  await page.goto("/e2e/installed.html?persistent-native=1&fixture=dna-single.fasta");
  const viewer = page.frameLocator("#viewer");
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  const runningResponse = await request.get("/__sequence-viewer-persistent/mcp-status");
  expect(runningResponse.ok()).toBe(true);
  const running = (await runningResponse.json()) as McpProcessStatus;
  expect(running.running).toBe(true);
  expect(running.pid).toBeGreaterThan(0);
  expect(running.spawnCount).toBeGreaterThanOrEqual(1);
  expect(running.bridgeRequests).toMatchObject({
    resourceReads: 1,
    toolCalls: 1,
  });

  await viewer.getByLabel("Search sequence").fill("CGTA");
  await viewer.getByRole("button", { name: "Display", exact: true }).click();
  await viewer.getByRole("button", { name: "Show reverse complement" }).click();
  await viewer.getByRole("button", { name: "Split", exact: true }).click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const checkpoint = window.readPersistentNativeCheckpoint();
        return {
          layout: checkpoint?.sequence?.view?.layout,
          orientation: checkpoint?.sequence?.view?.orientation,
          query: checkpoint?.sequence?.query,
        };
      }),
    )
    .toEqual({
      layout: "split",
      orientation: "reverse-complement",
      query: "CGTA",
    });

  const beforeDeath = await page.evaluate(() => ({
    bundle: window.__persistentNativeBundle,
    nativeRequests: window.__persistentNativeRequests.length,
    realMcpRequests: window.__realMcpRequests.length,
    sourceEditRequests: window.__persistentNativeRequests.filter(({ name }) =>
      name.includes("/source_edit/"),
    ).length,
  }));
  expect(beforeDeath.bundle).toMatchObject({
    byteLength: expect.any(Number),
    mountCount: 1,
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
  });
  expect(beforeDeath.sourceEditRequests).toBe(0);
  expect(beforeDeath.realMcpRequests).toBe(2);

  const terminateResponse = await request.post("/__sequence-viewer-persistent/reset-mcp");
  expect(terminateResponse.ok()).toBe(true);
  const terminated = (await terminateResponse.json()) as McpTermination;
  expect(terminated.before).toMatchObject({
    pid: running.pid,
    running: true,
  });
  expect(terminated.terminatedPid).toBe(running.pid);
  expect(terminated.terminatedPidRunning).toBe(false);
  expect(terminated.after).toMatchObject({
    bridgeRequests: running.bridgeRequests,
    pid: null,
    running: false,
    spawnCount: running.spawnCount,
  });

  await page.evaluate(() => window.remountPersistentNativeViewer());

  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect(viewer.getByLabel("Search sequence")).toHaveValue("CGTA");
  await viewer.getByRole("button", { name: "Display", exact: true }).click();
  await expect(viewer.getByRole("button", { name: "Show forward strand" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Split", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const recovery = await page.evaluate(
    (nativeRequestCount) => ({
      bundle: window.__persistentNativeBundle,
      checkpoint: window.readPersistentNativeCheckpoint(),
      nativeRequests: window.__persistentNativeRequests
        .slice(nativeRequestCount)
        .map(({ name }) => name),
      realMcpRequests: window.__realMcpRequests,
      sourceEditRequests: window.__persistentNativeRequests.filter(({ name }) =>
        name.includes("/source_edit/"),
      ).length,
    }),
    beforeDeath.nativeRequests,
  );
  expect(recovery.bundle).toEqual({
    ...beforeDeath.bundle,
    mountCount: 2,
  });
  expect(recovery.checkpoint).toMatchObject({
    family: "sequence",
    mode: "sequence",
    sequence: {
      query: "CGTA",
      view: {
        layout: "split",
        orientation: "reverse-complement",
      },
    },
    sourceRevision: "installed-sequence-native-source-v1",
    version: 1,
  });
  expect(recovery.nativeRequests).toEqual(
    expect.arrayContaining([
      "ui/scientific/sequence/records",
      "ui/scientific/sequence/restore_checkpoint",
      "ui/scientific/sequence/window",
    ]),
  );
  expect(recovery.realMcpRequests).toHaveLength(beforeDeath.realMcpRequests);
  expect(recovery.sourceEditRequests).toBe(0);
  expect(loadedViewerBundles).toEqual([]);

  const finalResponse = await request.get("/__sequence-viewer-persistent/mcp-status");
  expect(finalResponse.ok()).toBe(true);
  expect((await finalResponse.json()) as McpProcessStatus).toEqual(terminated.after);
});

type McpProcessStatus = {
  bridgeRequests: { resourceReads: number; toolCalls: number };
  pid: number | null;
  running: boolean;
  spawnCount: number;
};

type McpTermination = {
  after: McpProcessStatus;
  before: McpProcessStatus;
  terminatedPid: number | null;
  terminatedPidRunning: boolean;
};

declare global {
  interface Window {
    __persistentNativeBundle:
      | { byteLength: number; mountCount: number; sha256: string }
      | undefined;
    __persistentNativeRequests: Array<{
      checkpointBytes?: number;
      name: string;
      revision: number;
    }>;
    readPersistentNativeCheckpoint: () =>
      | {
          family: "sequence";
          mode: "alignment" | "sequence";
          sequence?: {
            query: string;
            view: {
              layout: "circular" | "linear" | "split";
              orientation: "forward" | "reverse-complement";
            };
          };
          sourceRevision: string;
          version: 1;
        }
      | undefined;
    remountPersistentNativeViewer: () => void;
  }
}
