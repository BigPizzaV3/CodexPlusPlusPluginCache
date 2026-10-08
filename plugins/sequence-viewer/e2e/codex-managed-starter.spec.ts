import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { z } from "zod";

// Exact FASTA header and first 210 bases of public RefSeq NC_005816.1:
// https://raw.githubusercontent.com/biopython/biopython/c9489604d1d9607602ca9199a3852c1219ed330f/Tests/GenBank/NC_005816.fna
// This is explicitly an excerpt, not the full 9,609-base plasmid record.
const publicRefSeqExcerpt = Buffer.from(
  [
    ">gi|45478711|ref|NC_005816.1| Yersinia pestis biovar Microtus str. 91001 plasmid pPCP1, complete sequence",
    "TGTAACGAACGGTGCAATAGTGATCCACACCCAACGCCTGAAATCAGATCCAGGGGGTAATCTGCTCTCC",
    "TGATTCAGGAGAGTTTATGGTCACTTTTGAGACAGTTATGGAAATTAAAATCCTGCACAAGCAGGGAATG",
    "AGTAGCCGGGCGATTGCCAGAGAACTGGGGATCTCCCGCAATACCGTTAAACGTTATTTGCAGGCAAAAT",
    "",
  ].join("\n"),
  "utf8",
);
const publicRefSeqExcerptSha256 =
  "f6eeff4e0165470e2ffb3023e4ddf98e29558f2b2f11420ab868345427227ca4";
const fullPublicRefSeqSha256 =
  "ecf45b132b98f149284dd214eea45801d6bab2de084f8843f366351d80fd4a3f";

test("Codex-prepared public examples open in the installed viewer without plugin workspace roots", async ({
  page,
  request,
}) => {
  const outputDirectory = path.join(process.cwd(), "output/playwright");
  await mkdir(outputDirectory, { recursive: true });
  const codexWorkspace = await mkdtemp(
    path.join(outputDirectory, "codex-managed-starter-"),
  );

  try {
    const publicSource = path.join(
      outputDirectory,
      "real-public-corpus/refseq-plasmid-NC_005816.fna",
    );
    expect(createHash("sha256").update(publicRefSeqExcerpt).digest("hex")).toBe(
      publicRefSeqExcerptSha256,
    );
    expect(publicRefSeqExcerpt.byteLength).toBe(319);
    const fullPublicSource = await readFile(publicSource).catch(() => null);
    if (fullPublicSource != null) {
      expect(createHash("sha256").update(fullPublicSource).digest("hex")).toBe(
        fullPublicRefSeqSha256,
      );
      expect(
        fullPublicSource.subarray(0, publicRefSeqExcerpt.byteLength),
      ).toEqual(publicRefSeqExcerpt);
    }
    const source = fullPublicSource ?? publicRefSeqExcerpt;
    const preparedSource = path.join(
      codexWorkspace,
      fullPublicSource == null
        ? "NC_005816.1-first-210bp.fna"
        : "NC_005816.1-full.fna",
    );

    // Codex, not the installed plugin, prepares the authorized local artifact.
    await writeFile(preparedSource, source, { flag: "wx", mode: 0o600 });
    const preparedBytes = await readFile(preparedSource);
    expect(createHash("sha256").update(preparedBytes).digest("hex")).toBe(
      createHash("sha256").update(source).digest("hex"),
    );

    const search = new URLSearchParams({
      "codex-managed-starter": "1",
      fixture: path.basename(preparedSource),
      "rootless-host": "1",
      "starter-prompt":
        "Fetch the public sequence into the workspace and inspect it in the viewer",
    });
    await page.goto(`/e2e/installed.html?${search.toString()}`);
    await page.evaluate(
      (absoluteSourcePath) =>
        window.prepareCodexManagedStarter(absoluteSourcePath),
      preparedSource,
    );

    const blockedLegacyAcquisition = await page.evaluate(() =>
      window.callRealMcpTool("sequence.acquire_public_example", {
        exampleId: "ncbi-nc-001416-1",
      }),
    );
    expect(blockedLegacyAcquisition.isError).toBe(true);
    expect(
      blockedLegacyAcquisition.content?.find(({ type }) => type === "text")
        ?.text,
    ).toMatch(/independently authenticated local workspace root/u);
    expect(await page.evaluate(() => window.__viewerOpenCount)).toBe(0);

    const rootlessStatus = await request.get(
      "/__sequence-viewer-persistent/mcp-status",
    );
    expect(rootlessStatus.ok()).toBe(true);
    const deniedProcess = (await rootlessStatus.json()) as {
      advertisedWorkspaceRootCount: number;
      pid: number;
      running: boolean;
      spawnCount: number;
      workspaceRootListRequestCount: number;
    };
    expect(deniedProcess).toMatchObject({
      advertisedWorkspaceRootCount: 0,
      running: true,
    });
    expect(deniedProcess.workspaceRootListRequestCount).toBeGreaterThan(0);
    const adversarialPreflightRequestCount = await page.evaluate(
      () => window.__realMcpRequests.length,
    );

    await page.getByRole("button", { name: "Open acquired record" }).click();
    const viewer = page.frameLocator("#viewer");
    await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

    const firstResidue = source
      .toString("utf8")
      .split("\n")
      .find((line) => line.length > 0 && !line.startsWith(">"))
      ?.at(0);
    expect(firstResidue).toMatch(/[ACGTU]/u);
    await expect(
      viewer.getByRole("gridcell", {
        name: new RegExp(`position 1 ${firstResidue}`, "u"),
      }),
    ).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => window.__viewerOpenCount))
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__realMcpRequests.some(
            ({ method, params }) =>
              method === "resources/read" &&
              params?.uri?.startsWith("viewer-file://sequence-viewer/opened/"),
          ),
        ),
      )
      .toBe(true);

    const evidence = await page.evaluate(() => ({
      context: window.__viewerContexts,
      opening: window.__publicStarterToolResult,
      requests: window.__realMcpRequests,
      status: document.getElementById("starter-status")?.textContent,
      visibleHostText: document.body.innerText,
      visibleViewerText:
        document.querySelector("iframe")?.contentDocument?.body.innerText,
    }));
    const openRequests = evidence.requests.filter(
      ({ params }) => params?.name === "sequence.open_from_chat",
    );
    expect(openRequests).toHaveLength(1);
    expect(openRequests[0]).toMatchObject({
      method: "tools/call",
      params: {
        arguments: { path: preparedSource },
        name: "sequence.open_from_chat",
      },
    });
    expect(
      evidence.requests.filter(
        ({ params }) => params?.name === "sequence.acquire_public_example",
      ),
    ).toHaveLength(1);
    const actualStarterRequests = evidence.requests.slice(
      adversarialPreflightRequestCount,
    );
    expect(
      actualStarterRequests.some(
        ({ params }) => params?.name === "sequence.acquire_public_example",
      ),
    ).toBe(false);
    expect(
      actualStarterRequests.filter(
        ({ params }) => params?.name === "sequence.open_from_chat",
      ),
    ).toHaveLength(1);
    expect(evidence.opening.structuredContent.viewerSessionId).toMatch(
      /^[0-9a-f-]{36}$/iu,
    );
    expect(evidence.status).toContain(
      evidence.opening.structuredContent.viewerSessionId,
    );

    const userVisibleEvidence = JSON.stringify({
      context: evidence.context,
      opening: evidence.opening,
      resourceRequests: evidence.requests.filter(
        ({ method }) => method === "resources/read",
      ),
      status: evidence.status,
      visibleHostText: evidence.visibleHostText,
      visibleViewerText: evidence.visibleViewerText,
    });
    expect(userVisibleEvidence).not.toContain(codexWorkspace);
    expect(userVisibleEvidence).not.toContain(preparedSource);

    const finalStatus = await request.get(
      "/__sequence-viewer-persistent/mcp-status",
    );
    const renderedProcess = (await finalStatus.json()) as typeof deniedProcess;
    expect(renderedProcess).toMatchObject({
      advertisedWorkspaceRootCount: 0,
      pid: deniedProcess.pid,
      running: true,
      spawnCount: deniedProcess.spawnCount,
    });
    expect(renderedProcess.workspaceRootListRequestCount).toBeGreaterThan(
      deniedProcess.workspaceRootListRequestCount,
    );
  } finally {
    await rm(codexWorkspace, { force: true, recursive: true });
  }
});

// Opt-in acceptance of pre-acquired public bytes, not a network acquisition or
// installed-Codex qualification. Pins come from the shipped starter contract
// and the RF00360@15.1 live-acquisition regression, never the input sidecars.
const exactAssetRoot =
  process.env.SEQUENCE_VIEWER_CODEX_MANAGED_STARTER_ASSET_ROOT?.trim();
const exactAssets = [
  {
    id: "ena-drr037765-first-500",
    relativePath: "codex-viewer-examples/DRR037765-first-500.fastq",
    bytes: 480_372,
    sha256: "46bd72991d9c9c2bf64751e88e52548d852d5fa021da4815ee6f6517a51b18b9",
    mode: "sequence",
  },
  {
    id: "uniprot-human-ras-sv1",
    relativePath: "human-RAS-UniProt-SV1.aln-fasta",
    bytes: 786,
    sha256: "cb32dd89ca7855f7666fbdf3f2ff926f935b1dbc9e7f57573f884dda7e59c68f",
    mode: "alignment",
  },
  {
    id: "ncbi-nc-001416-1",
    relativePath: "codex-viewer-examples/NC_001416.1.gb",
    bytes: 176_721,
    sha256: "3c624302adeeb3c00649f549903ab781b9e75bab16069ae655833d536407367f",
    mode: "sequence",
  },
  {
    id: "rfam-rf00360-15-1",
    relativePath: "codex-viewer-examples/RF00360-rfam-15.1.sto",
    bytes: 3_433,
    sha256: "46005e52b767efcedcb942932adb4f1680b99121b45226ed0c37013e890305b1",
    mode: "alignment",
  },
] as const;
type ExactAsset = (typeof exactAssets)[number];

const alignmentRow = z.object({
  label: z.string(),
  alignedSequence: z.string(),
});
const alignmentColumn = z.object({
  column: z.number().int(),
  identity: z.number().nullable(),
  conservation: z.number().nullable(),
  rows: z.array(z.object({ rowLabel: z.string(), symbol: z.string() })),
});
const viewerJob = z.object({
  kind: z.string(),
  status: z.string(),
  result: z.unknown().optional(),
});
const mcpStatus = z.object({
  advertisedWorkspaceRootCount: z.number(),
  pid: z.number().int(),
  running: z.boolean(),
  spawnCount: z.number().int(),
  workspaceRootListRequestCount: z.number().int(),
});

for (const asset of exactAssets) {
  test(`exact prepared starter ${asset.id}: rootless packaged runtime`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !exactAssetRoot,
      "Set SEQUENCE_VIEWER_CODEX_MANAGED_STARTER_ASSET_ROOT to the prepared asset directory.",
    );
    if (exactAssetRoot == null || !path.isAbsolute(exactAssetRoot)) {
      throw new Error(
        "The exact starter asset root must be an absolute directory.",
      );
    }
    const originalPath = path.join(exactAssetRoot, asset.relativePath);
    const metadata = await lstat(originalPath);
    expect(
      metadata.isFile(),
      "The pinned source must be a regular file, not a symlink.",
    ).toBe(true);
    expect(metadata.size).toBe(asset.bytes);
    const source = await readFile(originalPath);
    expect(
      sha256(source),
      "Prepared source differs from the independent public-data pin.",
    ).toBe(asset.sha256);

    const outputDirectory = path.join(process.cwd(), "output/playwright");
    await mkdir(outputDirectory, { recursive: true });
    const workspace = await mkdtemp(
      path.join(outputDirectory, "exact-starter-"),
    );
    try {
      const copiedPath = path.join(workspace, path.basename(originalPath));
      await writeFile(copiedPath, source, { flag: "wx", mode: 0o600 });
      expect(sha256(await readFile(copiedPath))).toBe(asset.sha256);
      const runtime = await runtimeBinding();
      const opened = await openExactStarter(page, request, asset, copiedPath);
      const observations = await checkExactStarter(
        page,
        opened.sessionId,
        asset,
        workspace,
      );
      const proof = await assertExactOpeningProof(
        page,
        request,
        copiedPath,
        opened,
      );
      expect(
        sha256(await readFile(originalPath)),
        "The original asset must remain untouched.",
      ).toBe(asset.sha256);
      expect(
        await runtimeBinding(),
        "The packaged runtime changed during the case.",
      ).toEqual(runtime);

      await testInfo.attach(`${asset.id}-visible-frame`, {
        body: await page.locator("#viewer").screenshot(),
        contentType: "image/png",
      });
      await testInfo.attach(`${asset.id}-controlled-host-evidence`, {
        body: Buffer.from(
          JSON.stringify(
            {
              scope:
                "packaged controlled-host acceptance; not installed-Codex qualification",
              acquisition:
                "Previously acquired public bytes; no retrieval performed by this test",
              exampleId: asset.id,
              source: {
                name: path.basename(originalPath),
                byteLength: source.byteLength,
                sha256: asset.sha256,
              },
              runtime,
              ...proof,
              observations,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      });
    } finally {
      // Only this test's mkdtemp directory is disposable. Never remove the
      // supplied asset root or the host's separately configured evidence root.
      await rm(workspace, { recursive: true, force: true });
    }
  });
}

async function openExactStarter(
  page: Page,
  request: APIRequestContext,
  asset: ExactAsset,
  copiedPath: string,
) {
  const search = new URLSearchParams({
    "codex-managed-starter": "1",
    "rootless-host": "1",
    fixture: path.basename(copiedPath),
    "starter-prompt": `Inspect the exact prepared ${asset.id} public artifact`,
  });
  await page.goto(`/e2e/installed.html?${search}`);
  await page.evaluate(
    (sourcePath) => window.prepareCodexManagedStarter(sourcePath),
    copiedPath,
  );
  await page.getByRole("button", { name: "Open acquired record" }).click();
  const viewer = page.frameLocator("#viewer");
  await expect(
    viewer.getByLabel(
      asset.mode === "alignment"
        ? "Interactive multiple sequence alignment viewer"
        : "Wrapped sequence view",
    ),
  ).toBeVisible();
  await expect(
    viewer.getByText("Loading sequence…", { exact: true }),
  ).toHaveCount(0);
  const sessionId = z
    .string()
    .uuid()
    .parse(
      await page.evaluate(
        () =>
          window.__publicStarterToolResult.structuredContent.viewerSessionId,
      ),
    );
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({ viewer: asset.mode, viewerSessionId: sessionId });
  await tool(page, "sequence.control_viewer", {
    action: "set_toolbar_visibility",
    visible: true,
    sessionId,
  });
  const status = await readMcpStatus(request);
  expect(status).toMatchObject({
    advertisedWorkspaceRootCount: 0,
    running: true,
  });
  expect(status.workspaceRootListRequestCount).toBeGreaterThan(0);
  return { sessionId, status };
}

async function assertExactOpeningProof(
  page: Page,
  request: APIRequestContext,
  copiedPath: string,
  opened: Awaited<ReturnType<typeof openExactStarter>>,
) {
  const evidence = await page.evaluate(() => ({
    contexts: window.__viewerContexts,
    opening: window.__publicStarterToolResult,
    requests: window.__realMcpRequests,
    openCount: window.__viewerOpenCount,
    hostText: document.body.innerText,
    frameText:
      document.querySelector("iframe")?.contentDocument?.body.innerText,
  }));
  const requests = z
    .array(
      z.object({
        method: z.string(),
        params: z
          .object({
            name: z.string().optional(),
            uri: z.string().optional(),
            arguments: z.record(z.string(), z.unknown()).optional(),
          })
          .optional(),
      }),
    )
    .parse(evidence.requests);
  expect(evidence.openCount).toBe(1);
  expect(
    requests.filter(({ params }) => params?.name === "sequence.open_from_chat"),
  ).toEqual([
    {
      method: "tools/call",
      params: {
        arguments: { path: copiedPath },
        name: "sequence.open_from_chat",
      },
    },
  ]);
  expect(
    requests.filter(
      ({ params }) =>
        params?.name === "sequence.acquire_public_example" ||
        params?.name === "sequence.register_viewer_session",
    ),
  ).toEqual([]);
  for (const { params } of requests) {
    if (params?.arguments?.sessionId != null) {
      expect(params.arguments.sessionId).toBe(opened.sessionId);
    }
  }
  const reads = requests.filter(({ method }) => method === "resources/read");
  expect(reads.length).toBeGreaterThan(0);
  const resourceUris = [...new Set(reads.map(({ params }) => params?.uri))];
  expect(resourceUris).toEqual([
    expect.stringMatching(/^viewer-file:\/\/sequence-viewer\/opened\//u),
  ]);
  const userVisible = JSON.stringify({ ...evidence, requests: reads });
  for (const privatePath of [
    copiedPath,
    path.dirname(copiedPath),
    exactAssetRoot,
  ]) {
    expect(userVisible).not.toContain(privatePath);
  }
  const status = await readMcpStatus(request);
  expect(status).toMatchObject({
    advertisedWorkspaceRootCount: 0,
    running: true,
    pid: opened.status.pid,
    spawnCount: opened.status.spawnCount,
  });
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({ viewerSessionId: opened.sessionId });
  return {
    viewerSessionId: opened.sessionId,
    openCount: 1,
    sourceResourceCount: resourceUris.length,
    resourceReadCount: reads.length,
    advertisedWorkspaceRootCount: 0,
  };
}

async function checkExactStarter(
  page: Page,
  sessionId: string,
  asset: ExactAsset,
  workspace: string,
) {
  switch (asset.id) {
    case "ena-drr037765-first-500":
      return checkEna(page, sessionId);
    case "uniprot-human-ras-sv1":
      return checkRas(page, sessionId, asset.sha256, workspace);
    case "ncbi-nc-001416-1":
      return checkLambda(page, sessionId);
    case "rfam-rf00360-15-1":
      return checkRfam(page, sessionId);
  }
}

async function checkEna(page: Page, sessionId: string) {
  const viewer = page.frameLocator("#viewer");
  await viewer.getByRole("button", { name: "Quality", exact: true }).click();
  await expect(
    viewer.getByText("FASTQ overview", { exact: true }),
  ).toBeVisible();
  const summaryList = viewer
    .getByText("FASTQ overview", { exact: true })
    .locator("..")
    .locator(":scope > dl");
  for (const [label, value] of [
    ["Reads", "500"],
    ["Total bases", "235,490"],
    ["Read length", "469-471 bp"],
    ["GC", "28.8%"],
    ["Q30", "95.4%"],
  ]) {
    await expect(
      summaryList.getByText(label, { exact: true }).locator(".."),
    ).toContainText(value);
  }
  const metrics = await queryItems(
    page,
    sessionId,
    "metrics",
    z.object({
      type: z.literal("fastq-summary"),
      readCount: z.number(),
      totalBases: z.number(),
      readLengthMin: z.number(),
      readLengthMax: z.number(),
      gcPercent: z.number(),
      q30Percent: z.number(),
    }),
  );
  expect(metrics).toHaveLength(1);
  const summary = metrics[0]!;
  expect(summary).toMatchObject({
    readCount: 500,
    totalBases: 235_490,
    readLengthMin: 469,
    readLengthMax: 471,
  });
  expect(summary.gcPercent).toBeCloseTo(28.8462355, 6);
  expect(summary.q30Percent).toBeCloseTo(95.3976814, 6);
  return summary;
}

async function checkRas(
  page: Page,
  sessionId: string,
  sourceSha256: string,
  workspace: string,
) {
  const viewer = page.frameLocator("#viewer");
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({
      artifact: { rowCount: 3, alignedLength: 191, moleculeType: "protein" },
      analysis: { meanIdentity: expect.any(Number) },
    });
  const rows = await queryItems(page, sessionId, "rows", alignmentRow);
  expect(rows.map(({ label }) => label)).toEqual([
    "P01116",
    "P01111",
    "P01112",
  ]);
  expect(rows.map(({ alignedSequence }) => alignedSequence.length)).toEqual([
    191, 191, 191,
  ]);
  expect(
    rows.map(({ alignedSequence }) =>
      alignedSequence.replace(/[-.]/gu, "").slice(-4),
    ),
  ).toEqual(["CIIM", "CVVM", "CVLS"]);
  await tool(page, "sequence.control_viewer", {
    action: "set_alignment_reference",
    reference: "P01116",
    sessionId,
  });
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({ reference: { mode: "anchor", rowId: "P01116" } });
  for (const [start, end, motif] of [
    [10, 17, "GAGGVGKS"],
    [30, 38, "DEYDPTIED"],
    [60, 76, "GQEEYSAMRDQYMRTGE"],
    [116, 119, "NKCD"],
  ] as const) {
    const focus = async (coordinate: number) => {
      const response = await tool(page, "sequence.control_viewer", {
        action: "focus_alignment_reference_coordinate",
        coordinate,
        sessionId,
      });
      return z
        .object({ alignmentColumn: z.number().int() })
        .parse(response.state).alignmentColumn;
    };
    const startColumn = await focus(start);
    const endColumn = await focus(end);
    const columns = await queryItems(
      page,
      sessionId,
      "columns",
      alignmentColumn,
      { start: startColumn, end: endColumn },
    );
    expect(columns).toHaveLength(motif.length);
    for (const column of columns) {
      expect(column.identity).toBe(1);
      expect(column.conservation).toBeGreaterThan(0.5);
      expect(column.rows).toHaveLength(3);
    }
    for (const { label } of rows) {
      expect(
        columns
          .map(
            ({ rows: symbols }) =>
              symbols.find(({ rowLabel }) => rowLabel === label)?.symbol,
          )
          .join(""),
      ).toBe(motif);
    }
  }
  await tool(page, "sequence.run_analysis", {
    analysis: "distance-matrix",
    sessionId,
  });
  const distance = z
    .object({
      distance: z.literal("uncorrected-p-distance"),
      labels: z.array(z.object({ label: z.string() })),
      matrix: z.array(z.array(z.number())),
    })
    .parse(await completedJob(page, sessionId, "distance-matrix"));
  expect(distance.labels.map(({ label }) => label)).toEqual(
    rows.map(({ label }) => label),
  );
  expect(distance.matrix[0]?.[1]).toBeCloseTo(0.1315789474, 9);
  expect(distance.matrix[0]?.[2]).toBeCloseTo(0.1368421053, 9);
  expect(distance.matrix[1]?.[2]).toBeCloseTo(0.1578947368, 9);
  await tool(page, "sequence.run_analysis", {
    analysis: "build-tree",
    algorithm: "neighbor-joining",
    sessionId,
  });
  const { tree } = z
    .object({
      tree: z.object({
        algorithm: z.literal("neighbor-joining"),
        distance: z.literal("uncorrected-p-distance"),
        rowOrder: z.array(z.string()),
        newick: z.string(),
        warning: z.string(),
      }),
    })
    .parse(await completedJob(page, sessionId, "guide-tree"));
  expect([...tree.rowOrder].sort()).toEqual(["P01111", "P01112", "P01116"]);
  expect(tree.newick).toBe(
    "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);",
  );
  expect(tree.warning).toContain("Exploratory guide tree only");
  await viewer.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(viewer.getByLabel("Graphical guide tree")).toBeVisible();

  // Exercise create-new host-side persistence only. This process is neither
  // the plugin publisher nor an actual Codex workspace-tool execution.
  const newick = Buffer.from(`${tree.newick}\n`);
  const provenance = {
    publisher: "controlled-host-test",
    simulatedRole: "Codex-side workspace writer",
    actualCodexPublication: false,
    disposable: true,
    sourceSha256,
    analysis: tree,
    output: { byteLength: newick.byteLength, sha256: sha256(newick) },
  };
  for (const [name, bytes] of [
    ["RAS-P01116-P01111-P01112-NJ.nwk", newick],
    [
      "RAS-P01116-P01111-P01112-NJ.nwk.provenance.json",
      Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`),
    ],
  ] as const) {
    const destination = path.join(workspace, name);
    await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
    await expect(
      writeFile(destination, "must not overwrite", { flag: "wx" }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(destination)).toEqual(bytes);
  }
  return {
    reference: "P01116",
    motifCount: 4,
    distances: distance.matrix,
    tree,
    publication: provenance,
  };
}

async function checkLambda(page: Page, sessionId: string) {
  const viewer = page.frameLocator("#viewer");
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({ displayedRecord: { length: 48_502 } });
  await viewer.getByRole("button", { name: "Inspect", exact: true }).click();
  await viewer.getByText("Record metadata", { exact: true }).click();
  await expect(viewer.getByText("NC_001416.1", { exact: true })).toBeVisible();
  const feature = z.object({
    id: z.string(),
    start: z.number(),
    end: z.number(),
    strand: z.string(),
    geneticCodeId: z.number().optional(),
    sourceLocation: z.string().optional(),
    qualifiers: z.record(z.string(), z.unknown()).optional(),
  });
  const matches = await queryItems(page, sessionId, "features", feature, {
    query: "NP_040628.1",
  });
  const ci = matches.find(
    ({ qualifiers }) => qualifiers?.protein_id === "NP_040628.1",
  );
  expect(ci).toMatchObject({
    start: 37_227,
    end: 37_940,
    strand: "-",
    geneticCodeId: 11,
    sourceLocation: "complement(37227..37940)",
  });
  if (ci == null)
    throw new Error("The pinned cI CDS is absent from the live viewer.");
  for (const [query, start, end] of [
    ["operator-r3", 37_951, 37_967],
    ["operator-r2", 37_974, 37_990],
    ["operator-r1", 37_998, 38_014],
  ] as const) {
    expect(
      await queryItems(page, sessionId, "features", feature, { query }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ start, end })]),
    );
  }
  await tool(page, "sequence.control_viewer", {
    action: "select_sequence_feature",
    featureId: ci.id,
    sessionId,
  });
  await tool(page, "sequence.run_analysis", {
    analysis: "translate",
    start: 37_227,
    end: 37_940,
    frame: -1,
    geneticCodeId: 11,
    sessionId,
  });
  const translation = z
    .object({
      provenance: z.object({
        engine: z.literal("sequence-viewer-translation-v2"),
        geneticCodeId: z.literal(11),
      }),
      result: z.object({
        frames: z.array(
          z.object({ frame: z.number(), aminoAcids: z.string() }),
        ),
      }),
    })
    .parse(await completedJob(page, sessionId, "translation"));
  expect(translation.result.frames).toHaveLength(1);
  const frame = translation.result.frames[0]!;
  expect(frame.frame).toBe(-1);
  const protein = frame.aminoAcids.replace(/\*$/u, "");
  expect(protein).toHaveLength(237);
  expect(sha256(protein)).toBe(
    "ec5d954fd10be8c19c920e78badc5d9e9cc281f6801e2c5fde3803c9f133f580",
  );
  await viewer.getByRole("button", { name: "Tasks" }).click();
  await expect(
    viewer.getByText("Latest result", { exact: true }),
  ).toBeVisible();
  await expect(viewer.locator("pre")).toContainText(
    "sequence-viewer-translation-v2",
  );
  return {
    sequenceLength: 48_502,
    ci: { start: ci.start, end: ci.end, strand: ci.strand },
    operatorsChecked: 3,
    aminoAcids: protein.length,
    proteinSha256: sha256(protein),
    ...translation.provenance,
  };
}

async function checkRfam(page: Page, sessionId: string) {
  await expect
    .poll(() => latestContext(page))
    .toMatchObject({
      artifact: {
        format: "stockholm",
        moleculeType: "rna",
        rowCount: 9,
        alignedLength: 132,
      },
    });
  const rows = await queryItems(page, sessionId, "rows", alignmentRow);
  expect(rows.map(({ label }) => label)).toEqual([
    "AJ298135.1/1-115",
    "AY013245.2/61987-62105",
    "AY013245.2/57789-57907",
    "AJ489952.1/1-119",
    "AJ307928.1/3-121",
    "AJ307662.1/4013-4128",
    "AC135465.23/41412-41522",
    "AJ489954.1/1-104",
    "AF318011.1/1-106",
  ]);
  expect(
    rows.every(
      ({ alignedSequence }) =>
        alignedSequence.length === 132 && /^[ACGU.-]+$/u.test(alignedSequence),
    ),
  ).toBe(true);
  const columns = await queryItems(
    page,
    sessionId,
    "columns",
    alignmentColumn,
    { start: 1, end: 12 },
  );
  expect(columns.map(({ column }) => column)).toEqual(
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  for (const column of columns) {
    expect(
      column.rows.map(({ rowLabel, symbol }) => [rowLabel, symbol]),
    ).toEqual(
      rows.map(({ label, alignedSequence }) => [
        label,
        alignedSequence[column.column - 1],
      ]),
    );
  }
  // The released seed contains variable C/D motifs; do not assert the former
  // blanket conservation claim or substitute a different Rfam family.
  return {
    accession: "RF00360",
    release: "15.1",
    rowCount: rows.length,
    alignedLength: 132,
    queriedColumns: columns.length,
  };
}

async function tool(page: Page, name: string, args: Record<string, unknown>) {
  const response = await page.evaluate(
    ({ name, args }) => window.callRealMcpTool(name, args),
    { name, args },
  );
  expect(
    response.isError,
    `${name}: ${JSON.stringify(response.content ?? [])}`,
  ).not.toBe(true);
  const structured = z
    .record(z.string(), z.unknown())
    .parse(response.structuredContent);
  expect(
    structured.applied,
    `${name} was rejected by the mounted viewer`,
  ).not.toBe(false);
  return structured;
}

async function queryItems<T>(
  page: Page,
  sessionId: string,
  target: "metrics" | "rows" | "columns" | "features" | "jobs",
  item: z.ZodType<T>,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  const response = await tool(page, "sequence.query_viewer", {
    sessionId,
    target,
    ...(target === "columns" ? {} : { limit: 25 }),
    ...args,
  });
  return z.object({ items: z.array(item) }).parse(response.result).items;
}

async function completedJob(page: Page, sessionId: string, kind: string) {
  let completed: z.infer<typeof viewerJob> | undefined;
  await expect
    .poll(
      async () => {
        const jobs = await queryItems(page, sessionId, "jobs", viewerJob);
        completed = jobs.find((job) => job.kind === kind);
        expect(
          completed?.status,
          `${kind} failed in the mounted viewer`,
        ).not.toBe("failed");
        return completed?.status;
      },
      { timeout: 30_000 },
    )
    .toBe("completed");
  if (completed == null) throw new Error(`No completed ${kind} job.`);
  return completed.result;
}

async function latestContext(page: Page): Promise<unknown> {
  return page.evaluate(() => window.__viewerContexts.at(-1)?.structuredContent);
}

async function readMcpStatus(request: APIRequestContext) {
  const response = await request.get(
    "/__sequence-viewer-persistent/mcp-status",
  );
  expect(response.ok()).toBe(true);
  return mcpStatus.parse(await response.json());
}

async function runtimeBinding(): Promise<Record<string, string>> {
  const root = process.env.SEQUENCE_VIEWER_E2E_PLUGIN_ROOT?.trim();
  if (root == null || !path.isAbsolute(root)) {
    throw new Error(
      "Exact starter acceptance requires an explicit absolute SEQUENCE_VIEWER_E2E_PLUGIN_ROOT.",
    );
  }
  return Object.fromEntries(
    await Promise.all(
      [
        ".codex-plugin/plugin.json",
        "starter-examples.json",
        "dist/server.mjs",
        "dist/views/app.js.gz",
        "dist/views/styles.css",
      ].map(
        async (file) =>
          [file, sha256(await readFile(path.join(root, file)))] as const,
      ),
    ),
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

declare global {
  interface Window {
    prepareCodexManagedStarter: (absoluteSourcePath: string) => void;
  }
}
