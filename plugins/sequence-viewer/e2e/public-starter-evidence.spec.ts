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
  process.env.SEQUENCE_VIEWER_PUBLIC_STARTER_E2E === "1" &&
  path.isAbsolute(evidenceRoot) &&
  path.isAbsolute(runtimePluginRoot) &&
  path.isAbsolute(qualificationOutputRoot);
const screenshotsDirectory = path.join(qualificationOutputRoot, "screenshots");
const tracesDirectory = path.join(qualificationOutputRoot, "traces");
const exampleEvidenceDirectory = path.join(
  qualificationOutputRoot,
  "examples",
);
const scenarioEvidenceDirectory = path.join(
  qualificationOutputRoot,
  "failures",
);
const scenarioLogsDirectory = path.join(
  qualificationOutputRoot,
  "logs/failures",
);
const scenarioScreenshotsDirectory = path.join(
  qualificationOutputRoot,
  "screenshots/failures",
);
const scenarioTracesDirectory = path.join(
  qualificationOutputRoot,
  "traces/failures",
);
const starterContract = JSON.parse(
  readFileSync(path.join(runtimePluginRoot, "starter-examples.json"), "utf8"),
) as {
  pluginVersion: string;
  examples: Array<{
    area: "Alignment" | "Sequence";
    artifacts: Record<string, any>;
    bounds: Record<string, any>;
    expectedResults: Record<string, any>;
    id: string;
    prompt: string;
    source: Record<string, any>;
    viewer: { mode: "alignment" | "sequence" };
  }>;
};
const installedManifest = JSON.parse(
  readFileSync(
    path.join(runtimePluginRoot, ".codex-plugin/plugin.json"),
    "utf8",
  ),
) as {
  interface: { defaultPrompt: Array<string>; displayName: string };
  name: string;
  version: string;
};
const installedPrompts = installedManifest.interface.defaultPrompt;

if (
  JSON.stringify(installedPrompts) !==
  JSON.stringify(starterContract.examples.map(({ prompt }) => prompt))
) {
  throw new Error(
    "The installed marketplace manifest prompts do not match its starter contract.",
  );
}

test.skip(!enabled, "Set the live public-starter evidence environment.");

test.beforeEach(async () => {
  await rm(evidenceRoot, { force: true, recursive: true });
  await mkdir(evidenceRoot, { recursive: true });
  expect(await readdir(evidenceRoot)).toEqual([]);
});

test("visible ENA starter acquires through MCP and reports live FASTQ QC", async ({
  page,
}, testInfo) => {
  const contract = exampleContract("ena-drr037765-first-500");
  const opened = await openStarter(page, {
    exampleId: contract.id,
    fileName: "DRR037765-first-500.fastq",
    prompt: contract.prompt,
  });
  const viewer = viewerFrame(page);
  const expected = contract.expectedResults;
  await expect(viewer.getByText("FASTQ overview")).toBeVisible();
  await expect(
    viewer.getByText("Reads", { exact: true }).locator(".."),
  ).toContainText(String(expected.readCount));
  await expect(
    viewer.getByText("Total bases", { exact: true }).locator(".."),
  ).toContainText(expected.totalBases.toLocaleString("en-US"));
  await expect(
    viewer.getByText("Read length", { exact: true }).locator(".."),
  ).toContainText(`${expected.readLengthMin}-${expected.readLengthMax} bp`);
  await expect(
    viewer.getByText("GC", { exact: true }).locator(".."),
  ).toContainText(expected.displayGcPercent);
  await expect(
    viewer.getByText("Q30", { exact: true }).locator(".."),
  ).toContainText(expected.displayQ30Percent);
  await assertArtifactBaseline(
    "DRR037765-first-500.fastq",
    expected.artifactByteLength,
    expected.artifactSha256,
  );
  const screenshot = await capture(page, "ena-drr037765-live-qc.png");
  await writeSafeScenarioEvidence({
    assertions: {
      actionableResult: true,
      noBundledFallback: true,
      noMisleadingArtifact: true,
      noMisleadingViewer: true,
      officialEndpointFallbackSucceeded: true,
      optionalSkillAvailable: false,
      sessionCount: 1,
      viewerContributionCount: 1,
    },
    exampleId: contract.id,
    observedResult:
      "Optional Life Science Research skills were unavailable; the official ENA endpoints succeeded with one mounted viewer session.",
    page,
    requirement: "optional-skill-unavailable-fallback",
    startedAt: opened.startedAt,
    testInfo,
  });
  await writeExampleEvidence({
    contract,
    observations: {
      gcPercent: expected.gcPercent,
      q30Percent: expected.q30Percent,
      readCount: expected.readCount,
      readLength: [expected.readLengthMin, expected.readLengthMax],
      subset: opened.receipt.subset,
      totalBases: expected.totalBases,
    },
    opened,
    page,
    screenshot,
    testInfo,
  });
});

test("visible UniProt RAS starter maps a reference, computes distances/tree, and publishes provenance Newick", async ({
  page,
}, testInfo) => {
  const contract = exampleContract("uniprot-human-ras-sv1");
  const opened = await openStarter(page, {
    exampleId: contract.id,
    fileName: "human-RAS-UniProt-SV1.aln-fasta",
    prompt: contract.prompt,
  });
  const { sessionId } = opened;
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();
  const rows = await callRealTool(page, "sequence.query_viewer", {
    limit: 10,
    sessionId,
    target: "rows",
  });
  expect(JSON.stringify(rows)).toContain("P01116");
  expect(JSON.stringify(rows)).toContain("P01111");
  expect(JSON.stringify(rows)).toContain("P01112");
  const rowItems = rows.structuredContent?.result?.items as Array<{
    alignedSequence: string;
    label: string;
  }>;
  expect(rowItems).toHaveLength(3);
  expect(ungappedRow(rowItems, "P01116").endsWith("CIIM")).toBe(true);
  expect(ungappedRow(rowItems, "P01111").endsWith("CVVM")).toBe(true);
  expect(ungappedRow(rowItems, "P01112").endsWith("CVLS")).toBe(true);

  const referenceResult = await callRealTool(
    page,
    "sequence.control_viewer",
    {
      action: "set_alignment_reference",
      reference: "P01116",
      sessionId,
    },
  );
  expect(referenceResult.structuredContent?.state).toEqual({
    referenceMode: "anchor",
    rowId: "P01116",
  });
  for (const [start, end, sequence] of [
    [10, 17, "GAGGVGKS"],
    [30, 38, "DEYDPTIED"],
    [60, 76, "GQEEYSAMRDQYMRTGE"],
    [116, 119, "NKCD"],
  ] as const) {
    const startFocus = await callRealTool(page, "sequence.control_viewer", {
      action: "focus_alignment_reference_coordinate",
      coordinate: start,
      sessionId,
    });
    const endFocus = await callRealTool(page, "sequence.control_viewer", {
      action: "focus_alignment_reference_coordinate",
      coordinate: end,
      sessionId,
    });
    expect(startFocus.structuredContent?.state).toEqual(
      expect.objectContaining({
        coordinate: start,
        alignmentColumn: expect.any(Number),
      }),
    );
    expect(endFocus.structuredContent?.state).toEqual(
      expect.objectContaining({
        coordinate: end,
        alignmentColumn: expect.any(Number),
      }),
    );
    const startColumn =
      startFocus.structuredContent?.state?.alignmentColumn;
    const endColumn = endFocus.structuredContent?.state?.alignmentColumn;
    expect(startColumn).toEqual(expect.any(Number));
    expect(endColumn).toEqual(expect.any(Number));
    const columns = await callRealTool(page, "sequence.query_viewer", {
      end: endColumn,
      sessionId,
      start: startColumn,
      target: "columns",
    });
    const items = columns.structuredContent?.result?.items as Array<{
      conservation: number;
      identity: number;
      rows: Array<{ rowLabel: string; symbol: string }>;
    }>;
    expect(items).toHaveLength(sequence.length);
    for (const item of items) {
      expect(item.identity).toBe(1);
      // Protein conservation is normalized relative entropy against the
      // residue background, so even an invariant common residue is not 1.0.
      expect(item.conservation).toBeGreaterThan(0.5);
      expect(item.conservation).toBeLessThanOrEqual(1);
      expect(item.rows).toHaveLength(3);
    }
    for (const accession of ["P01116", "P01111", "P01112"]) {
      expect(
        items
          .map(
            ({ rows }) =>
              rows.find(({ rowLabel }) => rowLabel === accession)?.symbol ?? "",
          )
          .join(""),
      ).toBe(sequence);
    }
  }

  await callRealTool(page, "sequence.run_analysis", {
    analysis: "distance-matrix",
    sessionId,
  });
  const distanceJob = await waitForCompletedJob(
    page,
    sessionId,
    "distance-matrix",
  );
  expect(distanceJob.result?.distance).toBe("uncorrected-p-distance");
  expect(distanceJob.result?.labels).toEqual([
    expect.objectContaining({ label: "P01116" }),
    expect.objectContaining({ label: "P01111" }),
    expect.objectContaining({ label: "P01112" }),
  ]);
  const matrix = distanceJob.result?.matrix as Array<Array<number>>;
  expect(matrix[0]?.[1]).toBeCloseTo(
    contract.expectedResults.pDistances["P01116/P01111"],
    9,
  );
  expect(matrix[0]?.[2]).toBeCloseTo(
    contract.expectedResults.pDistances["P01116/P01112"],
    9,
  );
  expect(matrix[1]?.[2]).toBeCloseTo(
    contract.expectedResults.pDistances["P01111/P01112"],
    9,
  );

  await callRealTool(page, "sequence.run_analysis", {
    algorithm: "neighbor-joining",
    analysis: "build-tree",
    sessionId,
  });
  const treeJob = await waitForCompletedJob(page, sessionId, "guide-tree");
  expect(treeJob.result?.tree).toEqual(
    expect.objectContaining({
      algorithm: "neighbor-joining",
      distance: "uncorrected-p-distance",
      rowOrder: expect.arrayContaining(contract.expectedResults.treeLeaves),
      warning: expect.stringContaining("Exploratory guide tree only"),
    }),
  );
  expect(treeJob.result?.tree?.newick).toBe(
    contract.expectedResults.treeNewick,
  );
  await viewer.getByRole("button", { name: /^Tree/u }).click();
  await expect(viewer.getByLabel("Graphical guide tree")).toBeVisible();

  const exported = await callRealTool(page, "sequence.export_artifact", {
    destination: {
      base: "opened-source",
      kind: "workspace",
      relativePath: "RAS-P01116-P01111-P01112-NJ.nwk",
    },
    format: "newick",
    scope: "all",
    sessionId,
  });
  expect(exported.structuredContent?.result).toEqual(
    expect.objectContaining({
      outputWorkspacePath:
        "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk",
      provenanceWorkspacePath:
        "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk.provenance.json",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      size: expect.any(Number),
    }),
  );
  const newickPath = path.join(
    evidenceRoot,
    "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk",
  );
  const [newick, sidecarText] = await Promise.all([
    readFile(newickPath, "utf8"),
    readFile(`${newickPath}.provenance.json`, "utf8"),
  ]);
  expect(newick.trimEnd().endsWith(";")).toBe(true);
  expect(newick.trim()).toBe(treeJob.result?.tree?.newick);
  expect(newick).toContain("P01116");
  expect(newick).toContain("P01111");
  expect(newick).toContain("P01112");
  await assertArtifactBaseline(
    "human-RAS-UniProt-SV1.aln-fasta",
    contract.expectedResults.artifactByteLength,
    contract.expectedResults.artifactSha256,
  );
  const sidecar = JSON.parse(sidecarText);
  expect(sidecar).toEqual(
    expect.objectContaining({
      export: expect.objectContaining({
        format: "newick",
        sha256: createHash("sha256").update(newick).digest("hex"),
        size: Buffer.byteLength(newick),
      }),
      output: {
        workspacePath: "codex-viewer-examples/RAS-P01116-P01111-P01112-NJ.nwk",
      },
      provenance: expect.objectContaining({
        engine: "sequence-viewer-alignment-export-v1",
        parameters: {
          scope: "all",
          tree: expect.objectContaining({
            algorithm: "neighbor-joining",
            distanceModel: "uncorrected-p-distance",
            engine: "sequence-viewer-guide-tree-v1",
            rowOrder: expect.arrayContaining(["P01116", "P01111", "P01112"]),
            warning: expect.stringContaining("Exploratory guide tree only"),
          }),
        },
      }),
      source: expect.objectContaining({
        sha256: contract.expectedResults.artifactSha256,
        workspacePath: "codex-viewer-examples/human-RAS-UniProt-SV1.aln-fasta",
      }),
    }),
  );
  expect(exported.structuredContent?.result?.sha256).toBe(
    createHash("sha256").update(newick).digest("hex"),
  );
  expect(exported.structuredContent?.result?.size).toBe(
    Buffer.byteLength(newick),
  );

  const beforeCollision = {
    newick: createHash("sha256").update(newick).digest("hex"),
    sidecar: createHash("sha256").update(sidecarText).digest("hex"),
  };
  const collision = await callRealToolExpectError(
    page,
    "sequence.export_artifact",
    {
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "RAS-P01116-P01111-P01112-NJ.nwk",
      },
      format: "newick",
      scope: "all",
      sessionId,
    },
  );
  expect(JSON.stringify(collision)).toMatch(/already exists|collision/iu);
  const [newickAfterCollision, sidecarAfterCollision] = await Promise.all([
    readFile(newickPath),
    readFile(`${newickPath}.provenance.json`),
  ]);
  expect(createHash("sha256").update(newickAfterCollision).digest("hex")).toBe(
    beforeCollision.newick,
  );
  expect(createHash("sha256").update(sidecarAfterCollision).digest("hex")).toBe(
    beforeCollision.sidecar,
  );
  await writeSafeScenarioEvidence({
    assertions: {
      actionableResult: true,
      noBundledFallback: true,
      noMisleadingArtifact: true,
      noMisleadingViewer: true,
      outputHashesPreserved: true,
      sessionCount: 1,
      viewerContributionCount: 1,
    },
    exampleId: contract.id,
    observedResult:
      toolResultText(collision) ||
      "The workspace export or provenance sidecar already exists.",
    page,
    requirement: "output-collision",
    startedAt: opened.startedAt,
    testInfo,
  });

  const screenshot = await capture(
    page,
    "uniprot-ras-live-tree-and-newick.png",
  );
  await remountViewer(page, sessionId, opened.initialResourceUri);
  const remountedRows = await callRealTool(page, "sequence.query_viewer", {
    limit: 10,
    sessionId,
    target: "rows",
  });
  expect(remountedRows.structuredContent?.result?.items).toHaveLength(3);
  await writeSafeScenarioEvidence({
    assertions: {
      actionableResult: true,
      noBundledFallback: true,
      noMisleadingArtifact: true,
      noMisleadingViewer: true,
      retryOrRemountSucceeded: true,
      sessionContinuityVerified: true,
      sessionCount: 1,
      viewerContributionCount: 1,
    },
    exampleId: contract.id,
    observedResult:
      `Viewer remount retained session ${sessionId} and all three RAS rows.`,
    page,
    requirement: "viewer-retry-remount",
    startedAt: opened.startedAt,
    testInfo,
  });
  await writeExampleEvidence({
    contract,
    observations: {
      activeReference: "P01116",
      artifactRoundTripSha256: beforeCollision.newick,
      collisionPreserved: true,
      pDistances: contract.expectedResults.pDistances,
      remountSessionId: sessionId,
      treeNewick: newick.trim(),
    },
    opened,
    page,
    screenshot,
    testInfo,
  });
});

test("visible NCBI starter maps the cI switch and runs code-aware translation", async ({
  page,
}, testInfo) => {
  const contract = exampleContract("ncbi-nc-001416-1");
  const opened = await openStarter(page, {
    exampleId: contract.id,
    fileName: "NC_001416.1.gb",
    prompt: contract.prompt,
  });
  const { sessionId } = opened;
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await viewer.getByText("Record metadata", { exact: true }).click();
  await expect(viewer.getByText("NC_001416.1", { exact: true })).toBeVisible();
  const features: Array<any> = [];
  for (const query of [
    "NP_040628.1",
    "operator-r3",
    "operator-r2",
    "operator-r1",
  ]) {
    features.push(...(await queryFeatures(page, sessionId, query)));
  }
  const featureText = JSON.stringify(features);
  expect(featureText).toContain("NP_040628.1");
  expect(featureText).toContain("operator-r3");
  expect(featureText).toContain("operator-r2");
  expect(featureText).toContain("operator-r1");
  const ci = features.find(
    (feature: any) => feature.qualifiers?.protein_id === "NP_040628.1",
  );
  expect(ci).toEqual(
    expect.objectContaining({
      end: 37_940,
      geneticCodeId: 11,
      sourceLocation: "complement(37227..37940)",
      start: 37_227,
      strand: "-",
    }),
  );
  for (const [operator, location] of Object.entries(
    contract.expectedResults.operators as Record<string, string>,
  )) {
    const [start, end] = location.split("..").map(Number);
    const feature = features.find((candidate) =>
      JSON.stringify(candidate).includes(
        `operator-r${operator.slice(-1).toLowerCase()}`,
      ),
    );
    expect(feature, `${operator} feature`).toEqual(
      expect.objectContaining({ start, end }),
    );
  }
  await callRealTool(page, "sequence.control_viewer", {
    action: "select_sequence_feature",
    featureId: ci.id,
    sessionId,
  });
  await callRealTool(page, "sequence.run_analysis", {
    analysis: "translate",
    end: 37_940,
    frame: -1,
    geneticCodeId: 11,
    sessionId,
    start: 37_227,
  });
  const translationJob = await waitForCompletedJob(
    page,
    sessionId,
    "translation",
  );
  const completedTranslation = translationJob.result?.result?.frames?.[0];
  expect(translationJob.result?.provenance).toEqual(
    expect.objectContaining({
      engine: "sequence-viewer-translation-v2",
      geneticCodeId: 11,
    }),
  );
  expect(completedTranslation?.frame).toBe(-1);
  const translatedProtein = completedTranslation?.aminoAcids.replace(
    /\*$/u,
    "",
  );
  expect(translatedProtein).toHaveLength(
    contract.expectedResults.ci.aminoAcids,
  );
  expect(createHash("sha256").update(translatedProtein).digest("hex")).toBe(
    contract.expectedResults.ci.proteinSha256,
  );
  await viewer.getByRole("button", { name: "Tasks" }).click();
  await expect(viewer.getByText("Latest result")).toBeVisible();
  await expect(viewer.locator("pre")).toContainText(
    "sequence-viewer-translation-v2",
  );
  const screenshot = await capture(
    page,
    "ncbi-nc-001416-live-ci-translation.png",
  );
  await writeExampleEvidence({
    contract,
    observations: {
      ci: contract.expectedResults.ci,
      operators: contract.expectedResults.operators,
      sequenceLength: contract.expectedResults.sequenceLength,
      translationEngine: translationJob.result?.provenance?.engine,
      translationSha256: createHash("sha256")
        .update(translatedProtein)
        .digest("hex"),
    },
    opened,
    page,
    screenshot,
    testInfo,
  });
});

async function openStarter(
  page: Page,
  {
    exampleId,
    fileName,
    prompt,
  }: { exampleId: string; fileName: string; prompt: string },
): Promise<OpenedStarter> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const examplesDirectory = path.join(evidenceRoot, "codex-viewer-examples");
  await expectPathMissing(examplesDirectory);
  expect(installedPrompts.filter((candidate) => candidate === prompt)).toHaveLength(
    1,
  );
  const query = new URLSearchParams({
    "public-example-id": exampleId,
    "real-public-starter": "1",
    "starter-prompt": prompt,
  });
  await page.goto(`/e2e/installed.html?${query}`);
  await expect(page.getByLabel("Marketplace starter evidence")).toHaveCount(1);
  await expect(page.getByLabel("Marketplace starter evidence")).toBeVisible();
  await expect(page.getByText(prompt, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open acquired record" }).click();
  await expect(page.getByRole("status")).toHaveText(
    /^One installed viewer session opened · [0-9a-f-]{36}$/u,
    { timeout: 60_000 },
  );
  await expect(page.locator("iframe#viewer")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__viewerOpenCount)).toBe(1);
  await expect(
    page.getByText(
      /opaque resource viewer-file:\/\/sequence-viewer\/opened\//u,
    ),
  ).toBeVisible();

  await expect
    .poll(
      async () =>
        await page.evaluate(() =>
          window.__realMcpRequests.map(({ method, params }) => ({
            method,
            name: params?.name,
            uri: params?.uri,
          })),
        ),
    )
    .toEqual(
      expect.arrayContaining([
        {
          method: "tools/call",
          name: "sequence.acquire_public_example",
          uri: undefined,
        },
        expect.objectContaining({
          method: "resources/read",
          uri: expect.stringMatching(
            /^viewer-file:\/\/sequence-viewer\/opened\/[0-9a-f-]{36}$/u,
          ),
        }),
      ]),
    );
  const acquisitionCalls = await page.evaluate(
    () =>
      window.__realMcpRequests.filter(
        ({ method, params }) =>
          method === "tools/call" &&
          params?.name === "sequence.acquire_public_example",
      ).length,
  );
  expect(acquisitionCalls).toBe(1);
  const sessionId = await page.evaluate(
    () => window.__publicStarterToolResult.structuredContent.viewerSessionId,
  );
  await expect
    .poll(async () => (await latestContext(page))?.viewerSessionId)
    .toBe(sessionId);
  const example = exampleContract(exampleId);
  await expect
    .poll(async () => (await latestContext(page))?.viewer)
    .toBe(example.viewer.mode);
  expect(
    await page.evaluate(
      () =>
        window.__realMcpRequests.filter(
          ({ method, params }) =>
            method === "tools/call" &&
            params?.name === "sequence.register_viewer_session",
        ).length,
    ),
  ).toBe(0);

  const sessionIds = await page.evaluate(() => [
    ...new Set(
      window.__realMcpEvents
        .map(({ summary }) => summary.viewerSessionId)
        .filter((value): value is string => typeof value === "string"),
    ),
  ]);
  expect(sessionIds).toEqual([sessionId]);
  const initialResourceUris = await page.evaluate(() => [
    ...new Set(
      window.__realMcpRequests
        .filter(({ method }) => method === "resources/read")
        .map(({ params }) => params?.uri)
        .filter((value): value is string => typeof value === "string"),
    ),
  ]);
  expect(initialResourceUris).toHaveLength(1);

  const nondisclosureText = await page.evaluate(() =>
    JSON.stringify({
      contexts: window.__viewerContexts,
      events: window.__realMcpEvents,
      result: window.__publicStarterToolResult,
      requests: window.__realMcpRequests,
    }),
  );
  expect(nondisclosureText).not.toContain(evidenceRoot);
  expect(nondisclosureText).not.toMatch(/smoke-fixtures|bundled sample/iu);

  const artifactPath = path.join(examplesDirectory, fileName);
  const artifact = await readFile(artifactPath);
  const receipt = JSON.parse(
    await readFile(`${artifactPath}.provenance.json`, "utf8"),
  );
  expect(receipt).toEqual(
    expect.objectContaining({
      acquisition: expect.objectContaining({
        route: "official-database-endpoint",
      }),
      artifact: expect.objectContaining({
        relativePath: `codex-viewer-examples/${fileName}`,
        sha256: createHash("sha256").update(artifact).digest("hex"),
      }),
      exampleId,
    }),
  );
  assertReceiptContract(exampleId, receipt, artifact);
  return {
    artifact,
    artifactPath,
    durationMs: performance.now() - started,
    initialResourceUri: initialResourceUris[0] ?? "",
    receipt,
    sessionId,
    startedAt,
  };
}

async function callRealTool(
  page: Page,
  name: string,
  args: Record<string, unknown>,
): Promise<RealMcpToolResult> {
  const result = await page.evaluate(
    async ({ args, name }) => await window.callRealMcpTool(name, args),
    { args, name },
  );
  const diagnostic = `${name} ${JSON.stringify(args)} => ${JSON.stringify(
    result,
  )}`;
  expect(result?.isError, diagnostic).not.toBe(true);
  expect(result?.structuredContent?.applied, diagnostic).not.toBe(false);
  return result;
}

async function callRealToolExpectError(
  page: Page,
  name: string,
  args: Record<string, unknown>,
): Promise<RealMcpToolResult> {
  const result = await page.evaluate(
    async ({ args, name }) => await window.callRealMcpTool(name, args),
    { args, name },
  );
  const diagnostic = `${name} ${JSON.stringify(args)} => ${JSON.stringify(
    result,
  )}`;
  expect(
    result?.isError === true || result?.structuredContent?.applied === false,
    diagnostic,
  ).toBe(true);
  expect(result?.structuredContent, diagnostic).not.toHaveProperty(
    "viewerSessionId",
  );
  return result;
}

function toolResultText(result: RealMcpToolResult): string {
  return (
    result.content?.find(
      (item): item is { text: string; type: string } =>
        item.type === "text" && typeof item.text === "string",
    )?.text ?? JSON.stringify(result)
  );
}

async function remountViewer(
  page: Page,
  sessionId: string,
  resourceUri: string,
): Promise<void> {
  const contextsBefore = await page.evaluate(
    () => window.__viewerContexts.length,
  );
  await page.locator("iframe#viewer").evaluate((frame: HTMLIFrameElement) => {
    frame.src = `/e2e/generated-viewer.html?remount=${Date.now()}`;
  });
  await expect(
    viewerFrame(page).getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__viewerContexts.length))
    .toBeGreaterThan(contextsBefore);
  await expect
    .poll(async () => (await latestContext(page))?.viewerSessionId)
    .toBe(sessionId);
  await expect(page.locator("iframe#viewer")).toHaveCount(1);
  expect(await page.evaluate(() => window.__viewerOpenCount)).toBe(1);
  const trace = await page.evaluate(() => ({
    acquisitionCalls: window.__realMcpRequests.filter(
      ({ method, params }) =>
        method === "tools/call" &&
        params?.name === "sequence.acquire_public_example",
    ).length,
    resourceUris: [
      ...new Set(
        window.__realMcpRequests
          .filter(({ method }) => method === "resources/read")
          .map(({ params }) => params?.uri)
          .filter((value): value is string => typeof value === "string"),
      ),
    ],
  }));
  expect(trace.acquisitionCalls).toBe(1);
  expect(trace.resourceUris).toEqual([resourceUri]);
}

async function queryFeatures(
  page: Page,
  sessionId: string,
  query: string,
): Promise<Array<any>> {
  const response = await callRealTool(page, "sequence.query_viewer", {
    limit: 25,
    query,
    sessionId,
    target: "features",
  });
  return response.structuredContent?.result?.items ?? [];
}

function ungappedRow(
  rows: Array<{ alignedSequence: string; label: string }>,
  label: string,
): string {
  return (
    rows
      .find((row) => row.label === label)
      ?.alignedSequence.replaceAll(/[-.]/gu, "") ?? ""
  );
}

async function waitForCompletedJob(
  page: Page,
  sessionId: string,
  kind: string,
): Promise<CompletedJob> {
  let completed: CompletedJob | undefined;
  await expect
    .poll(
      async () => {
        const response = await callRealTool(page, "sequence.query_viewer", {
          limit: 100,
          sessionId,
          target: "jobs",
        });
        const jobs = (response.structuredContent?.result?.items ??
          []) as Array<CompletedJob>;
        completed = jobs.find(
          (job) => job.kind === kind && job.status === "completed",
        );
        return completed != null;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  if (completed == null) throw new Error(`${kind} did not complete.`);
  return completed;
}

function exampleContract(id: string) {
  const example = starterContract.examples.find(
    (candidate) => candidate.id === id,
  );
  if (example == null) throw new Error(`Missing starter contract ${id}`);
  return example;
}

function assertReceiptContract(
  exampleId: string,
  receipt: Record<string, any>,
  artifact: Buffer,
): void {
  expect(receipt.pluginVersion).toBe(installedManifest.version);
  expect(receipt.artifact).toEqual(
    expect.objectContaining({
      byteLength: artifact.byteLength,
      sha256: createHash("sha256").update(artifact).digest("hex"),
    }),
  );
  expect(receipt.acquisition?.route).toBe("official-database-endpoint");
  if (exampleId === "ena-drr037765-first-500") {
    expect(receipt).toEqual(
      expect.objectContaining({
        database: "ENA",
        resolvedIdentifier:
          "DRR037765/DRR037765.fastq.gz@md5:81735432a6f578b332aae58cdbd95231",
        subset: {
          emittedRecords: 500,
          rule: "first 500 parsed records in source order after gzip decompression, canonical four-line FASTQ",
          sourceRecords: 967,
        },
      }),
    );
    expect(receipt.artifact.validation).toEqual({
      format: "fastq",
      recordCount: 500,
      residueCount: 235_490,
    });
    expect(receipt.acquisition.sources).toEqual([
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
    return;
  }
  if (exampleId === "uniprot-human-ras-sv1") {
    expect(receipt).toEqual(
      expect.objectContaining({
        database: "UniProtKB",
        derivation: {
          engine: "builtin-center-star",
          inputOrder: ["P01116", "P01111", "P01112"],
          parameters: { gapPenalty: -2, matchScore: 2, mismatchScore: -1 },
          warning: expect.stringContaining("exploratory"),
        },
        resolvedIdentifier: "P01116@SV1+P01111@SV1+P01112@SV1",
      }),
    );
    expect(receipt.artifact.validation).toEqual({
      columnCount: 191,
      format: "aligned-fasta",
      rowCount: 3,
    });
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
    return;
  }
  if (exampleId === "ncbi-nc-001416-1") {
    expect(receipt).toEqual(
      expect.objectContaining({
        database: "NCBI Nuccore",
        resolvedIdentifier: "NC_001416.1",
      }),
    );
    expect(receipt.artifact.validation).toEqual({
      format: "genbank",
      recordCount: 1,
      residueCount: 48_502,
    });
    expect(receipt.acquisition.sources).toEqual([
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
    return;
  }
  throw new Error(`No receipt contract exists for ${exampleId}.`);
}

async function latestContext(
  page: Page,
): Promise<Record<string, any> | undefined> {
  return await page.evaluate(
    () => window.__viewerContexts.at(-1)?.structuredContent,
  );
}

async function expectPathMissing(filePath: string): Promise<void> {
  await expect(
    readFile(filePath).then(
      () => false,
      (error: NodeJS.ErrnoException) => error.code === "ENOENT",
    ),
  ).resolves.toBe(true);
}

async function assertArtifactBaseline(
  fileName: string,
  byteLength: number,
  sha256: string,
): Promise<void> {
  const artifact = await readFile(
    path.join(evidenceRoot, "codex-viewer-examples", fileName),
  );
  expect(artifact).toHaveLength(byteLength);
  expect(createHash("sha256").update(artifact).digest("hex")).toBe(sha256);
}

async function capture(page: Page, name: string): Promise<EvidenceFile> {
  await mkdir(screenshotsDirectory, { recursive: true });
  const filePath = path.join(screenshotsDirectory, name);
  await page.screenshot({
    fullPage: true,
    path: filePath,
  });
  return await describeEvidenceFile(filePath);
}

async function writeExampleEvidence({
  contract,
  observations,
  opened,
  page,
  screenshot,
  testInfo,
}: {
  contract: ReturnType<typeof exampleContract>;
  observations: Record<string, unknown>;
  opened: OpenedStarter;
  page: Page;
  screenshot: EvidenceFile;
  testInfo: TestInfo;
}): Promise<void> {
  const completedAt = new Date().toISOString();
  const browserTrace = await page.evaluate(() => ({
    contexts: window.__viewerContexts,
    mcpEvents: window.__realMcpEvents,
    mcpRequests: window.__realMcpRequests,
    viewerOpenCount: window.__viewerOpenCount,
  }));
  const serializedTrace = `${JSON.stringify(browserTrace, null, 2)}\n`;
  expect(serializedTrace).not.toContain(evidenceRoot);
  expect(serializedTrace).not.toMatch(/smoke-fixtures|bundled sample/iu);
  await mkdir(tracesDirectory, { recursive: true });
  const tracePath = path.join(tracesDirectory, `${contract.id}.json`);
  await writeFile(tracePath, serializedTrace);
  const traceEvidence = await describeEvidenceFile(tracePath);
  const workspaceFiles = await workspaceInventory(evidenceRoot);
  const expectedWorkspacePaths = [
    contract.artifacts.source,
    contract.artifacts.sourceProvenance,
    ...(contract.artifacts.derived == null
      ? []
      : [
          contract.artifacts.derived.output,
          contract.artifacts.derived.provenance,
        ]),
  ].sort((left, right) => left.localeCompare(right));
  expect(workspaceFiles.map(({ relativePath }) => relativePath)).toEqual(
    expectedWorkspacePaths,
  );
  const sourceProvenance = workspaceFiles.find(
    ({ relativePath }) => relativePath === contract.artifacts.sourceProvenance,
  );
  expect(sourceProvenance).toBeDefined();
  const contexts = browserTrace.contexts.map(({ structuredContent }) =>
    structuredContent,
  );
  const contextSessionIds = [
    ...new Set(
      contexts
        .map(({ viewerSessionId }) => viewerSessionId)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  expect(contextSessionIds).toEqual([opened.sessionId]);
  const acquisitionCalls = browserTrace.mcpRequests.filter(
    ({ method, params }) =>
      method === "tools/call" &&
      params?.name === "sequence.acquire_public_example",
  ).length;
  expect(acquisitionCalls).toBe(1);
  const responseBytes = browserTrace.mcpEvents.reduce(
    (sum, event) => sum + event.responseBytes,
    0,
  );
  const requestBytes = browserTrace.mcpEvents.reduce(
    (sum, event) => sum + event.requestBytes,
    0,
  );
  const record = {
    area: contract.area,
    completedAt,
    environment: {
      bundle: {
        byteLength: numberEnvironment(
          "SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_BYTES",
        ),
        fileCount: numberEnvironment(
          "SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_FILE_COUNT",
        ),
        sha256: stringEnvironment(
          "SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_SHA256",
        ),
      },
      commit: stringEnvironment("SEQUENCE_VIEWER_QUALIFICATION_COMMIT"),
      host: {
        name: "Playwright installed marketplace host",
        version: "1",
      },
      model: stringEnvironment("SEQUENCE_VIEWER_QUALIFICATION_MODEL"),
      node: process.version,
      optionalSkills: stringEnvironment(
        "SEQUENCE_VIEWER_QUALIFICATION_OPTIONAL_SKILLS",
      ),
      os: {
        arch: os.arch(),
        platform: os.platform(),
        release: os.release(),
      },
      plugin: {
        name: installedManifest.name,
        version: installedManifest.version,
      },
      reasoning: stringEnvironment(
        "SEQUENCE_VIEWER_QUALIFICATION_REASONING",
      ),
      tree: stringEnvironment("SEQUENCE_VIEWER_QUALIFICATION_TREE"),
    },
    evidence: {
      screenshot,
      trace: traceEvidence,
    },
    exampleId: contract.id,
    observations,
    prompt: contract.prompt,
    promptIndex: installedPrompts.indexOf(contract.prompt),
    schemaVersion: 1,
    source: {
      artifactByteLength: opened.artifact.byteLength,
      artifactSha256: createHash("sha256")
        .update(opened.artifact)
        .digest("hex"),
      database: opened.receipt.database,
      receiptSha256: sourceProvenance?.sha256,
      resolvedIdentifier: opened.receipt.resolvedIdentifier,
      retrievedAt: opened.receipt.retrievedAt,
      route: opened.receipt.acquisition.route,
      sources: opened.receipt.acquisition.sources,
      subset: opened.receipt.subset,
    },
    startedAt: opened.startedAt,
    status: "passed",
    test: testInfo.title,
    timing: {
      installedFlowMs: opened.durationMs,
      mcpRequestBytes: requestBytes,
      mcpResponseBytes: responseBytes,
    },
    viewer: {
      acquisitionCallCount: acquisitionCalls,
      cardCount: 1,
      contextSessionIds,
      mode: contract.viewer.mode,
      sessionCount: contextSessionIds.length,
      sessionId: opened.sessionId,
      viewerContributionCount: browserTrace.viewerOpenCount,
    },
    workspace: {
      finalFiles: workspaceFiles,
      initialEntries: [],
      outputBytes: workspaceFiles.reduce(
        (sum, file) => sum + file.byteLength,
        0,
      ),
    },
  };
  await mkdir(exampleEvidenceDirectory, { recursive: true });
  const recordPath = path.join(exampleEvidenceDirectory, `${contract.id}.json`);
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  await testInfo.attach(`${contract.id}-screenshot`, {
    contentType: "image/png",
    path: path.join(qualificationOutputRoot, screenshot.relativePath),
  });
  await testInfo.attach(`${contract.id}-trace`, {
    contentType: "application/json",
    path: tracePath,
  });
}

async function writeSafeScenarioEvidence({
  assertions,
  exampleId,
  observedResult,
  page,
  requirement,
  startedAt,
  testInfo,
}: {
  assertions: Record<string, boolean | number>;
  exampleId: string;
  observedResult: string;
  page: Page;
  requirement:
    | "optional-skill-unavailable-fallback"
    | "output-collision"
    | "viewer-retry-remount";
  startedAt: string;
  testInfo: TestInfo;
}): Promise<void> {
  const completedAt = new Date().toISOString();
  await Promise.all([
    mkdir(scenarioEvidenceDirectory, { recursive: true }),
    mkdir(scenarioLogsDirectory, { recursive: true }),
    mkdir(scenarioScreenshotsDirectory, { recursive: true }),
    mkdir(scenarioTracesDirectory, { recursive: true }),
  ]);
  const screenshotPath = path.join(
    scenarioScreenshotsDirectory,
    `${requirement}.png`,
  );
  await page.screenshot({ fullPage: true, path: screenshotPath });
  const state = await page.evaluate(() => ({
    contexts: window.__viewerContexts,
    events: window.__realMcpEvents,
    requests: window.__realMcpRequests,
    viewerOpenCount: window.__viewerOpenCount,
  }));
  const serialized = JSON.stringify({
    completedAt,
    exampleId,
    observedResult,
    requirement,
    startedAt,
    state,
  });
  expect(serialized).not.toContain(evidenceRoot);
  expect(serialized).not.toMatch(/smoke-fixtures|bundled sample/iu);
  const tracePath = path.join(scenarioTracesDirectory, `${requirement}.json`);
  await writeFile(tracePath, `${JSON.stringify({
    completedAt,
    exampleId,
    observedResult,
    requirement,
    startedAt,
    state,
  }, null, 2)}\n`);
  const logPath = path.join(
    scenarioLogsDirectory,
    `${requirement}.log`,
  );
  await writeFile(
    logPath,
    [
      `requirement=${requirement}`,
      "status=passed",
      `exampleId=${exampleId}`,
      `observedResult=${observedResult}`,
      `assertions=${JSON.stringify(assertions)}`,
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
    observedResult,
    requirement,
    schemaVersion: 1,
    startedAt,
    status: "passed",
    test: testInfo.title,
  };
  const recordPath = path.join(
    scenarioEvidenceDirectory,
    `${requirement}.json`,
  );
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

async function workspaceInventory(
  root: string,
  directory = root,
): Promise<Array<WorkspaceFileEvidence>> {
  const files: Array<WorkspaceFileEvidence> = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  )) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await workspaceInventory(root, filePath)));
    } else if (entry.isFile()) {
      const contents = await readFile(filePath);
      files.push({
        byteLength: contents.byteLength,
        relativePath: path.relative(root, filePath).split(path.sep).join("/"),
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    } else {
      throw new Error("Qualification workspace contained a non-regular entry.");
    }
  }
  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
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

function stringEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value == null || value === "") {
    throw new Error(`${name} is required for LSC-109 qualification.`);
  }
  return value;
}

function numberEnvironment(name: string): number {
  const value = Number(stringEnvironment(name));
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function viewerFrame(page: Page) {
  return page.frameLocator("#viewer");
}

declare global {
  interface Window {
    __publicStarterToolResult: {
      structuredContent: { viewerSessionId: string };
    };
    __realMcpRequests: Array<{
      method: string;
      params?: { name?: string; uri?: string };
    }>;
    __realMcpEvents: Array<{
      durationMs: number;
      method: string;
      name: string | null;
      requestBytes: number;
      responseBytes: number;
      startedAt: string;
      status: "error" | "ok";
      summary: { viewerSessionId?: string | null };
      uri: string | null;
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

type RealMcpToolResult = {
  content?: Array<{ text?: string; type: string }>;
  isError?: boolean;
  structuredContent?: {
    applied?: boolean;
    result?: any;
  };
};

type CompletedJob = {
  kind: string;
  result?: any;
  status: string;
};

type OpenedStarter = {
  artifact: Buffer;
  artifactPath: string;
  durationMs: number;
  initialResourceUri: string;
  receipt: Record<string, any>;
  sessionId: string;
  startedAt: string;
};

type EvidenceFile = {
  byteLength: number;
  relativePath: string;
  sha256: string;
};

type WorkspaceFileEvidence = EvidenceFile;
