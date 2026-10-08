import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { serializeBinarySequenceEnvelope } from "../src/binary-sequence-envelope";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  makeSyntheticSnapGene,
  SYNTHETIC_TRACE_CHANNELS,
} from "../src/sequence/__fixtures__/chromatogram";

const publicCorpusDirectory = path.join(
  process.cwd(),
  "output/playwright/real-public-corpus",
);
const hasVerifiedPublicCorpus =
  existsSync(path.join(publicCorpusDirectory, "PROVENANCE.md")) &&
  existsSync(path.join(publicCorpusDirectory, "SHA256SUMS"));

test("production bundle boots with bounded context and keyboard-accessible sequence state", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  const first = viewer.getByRole("gridcell", { name: /dna_demo position 1 A/ });
  await first.focus();
  await first.press("ArrowRight");
  await expect(
    viewer.getByRole("gridcell", { name: /dna_demo position 2 T/ }),
  ).toBeFocused();
  await expect
    .poll(async () => (await latestContext(page))?.focus)
    .toMatchObject({
      coordinate: 2,
      symbol: "T",
    });
  await viewer
    .getByRole("gridcell", { name: /dna_demo position 2 T/ })
    .press("Shift+ArrowRight");
  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({ end: 3, kind: "sequence-range", start: 2 });

  const context = await latestContextEnvelope(page);
  expect(context.structuredContent.contextBudget).toMatchObject({
    maxBytes: 65_536,
  });
  expect(new TextEncoder().encode(context.text).byteLength).toBeLessThan(
    65_536,
  );
  expect(context.structuredContent.contextRevision).toBeGreaterThan(0);
  expect(context.structuredContent.schemaVersion).toBe(2);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`single-sequence palettes remain readable and agent-switchable (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    // Synthetic alphabet coverage, not an experimental or public starter record.
    await mountTextFixture(page, {
      contents: ">synthetic_palette\nACGTNRYSWKMBDHVACGT\n",
      name: "synthetic-palette.fasta",
    });
    const viewer = viewerFrame(page);
    const residues = viewer.locator(".bio-sequence-residue");
    await expect(residues).toHaveCount(19);
    await viewer.getByRole("button", { name: "Display", exact: true }).click();
    const palette = viewer.getByLabel("Residue palette");
    await expect(palette).toHaveValue("muted-nucleic-acid");
    await expect(palette.locator("option:checked")).toHaveText(
      "Soft nucleotide",
    );

    const defaults = await readSequenceResiduePaints(page);
    expect(defaults.slice(0, 7).map(({ symbol }) => symbol)).toEqual([
      "A",
      "C",
      "G",
      "T",
      "N",
      "R",
      "Y",
    ]);
    for (const paint of defaults) {
      expect(
        paint.contrast,
        `${colorScheme} ${paint.symbol} text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      // Every base has the same light/dark contrast polarity: no alternating white-on-neon letters.
      expect(paint.foregroundLuminance > paint.backgroundLuminance).toBe(
        colorScheme === "dark",
      );
    }

    await palette.selectOption({ label: "NCBI nucleic acid" });
    await expect
      .poll(async () => (await latestContext(page))?.display?.paletteId)
      .toBe("ncbi-nucleic-acid");
    expect(
      (await readSequenceResiduePaints(page))
        .slice(0, 4)
        .map(({ background }) => background),
    ).toEqual([
      [255, 0, 0],
      [255, 255, 0],
      [0, 0, 255],
      [0, 128, 0],
    ]);

    expect(
      await executeViewerCommand(page, {
        action: "set_sequence_view_options",
        palette: "jalview-nucleotide",
      }),
    ).toMatchObject({ applied: true });
    await expect(palette).toHaveValue("jalview-nucleotide");
    expect(
      (await readSequenceResiduePaints(page))
        .slice(0, 4)
        .map(({ background }) => background),
    ).toEqual([
      [100, 247, 63],
      [255, 179, 64],
      [235, 65, 60],
      [60, 136, 238],
    ]);

    await palette.selectOption({ label: "Monochrome" });
    await expect
      .poll(async () => (await latestContext(page))?.display?.paletteId)
      .toBe("neutral");
    const monochrome = await readSequenceResiduePaints(page);
    expect(
      new Set(
        monochrome.map(({ foreground, background }) =>
          JSON.stringify({ foreground, background }),
        ),
      ).size,
    ).toBe(1);
    expect(monochrome[0].contrast).toBeGreaterThanOrEqual(4.5);

    expect(
      await executeViewerCommand(page, {
        action: "set_sequence_view_options",
        palette: "muted-nucleic-acid",
      }),
    ).toMatchObject({ applied: true });
    await expect(palette).toHaveValue("muted-nucleic-acid");
    expect(
      (await readSequenceResiduePaints(page)).map(
        ({ foreground, background }) => ({ foreground, background }),
      ),
    ).toEqual(
      defaults.map(({ foreground, background }) => ({
        foreground,
        background,
      })),
    );

    await viewer.getByLabel("Search sequence").fill("ACGT");
    await expect(residues.first()).toHaveAttribute("data-search-hit", "true");
    const searchPaint = (await readSequenceResiduePaints(page))[0];
    expect(searchPaint.shadowContrasts.some((contrast) => contrast >= 3)).toBe(
      true,
    );
    await residues.first().focus();
    await residues.first().press("ArrowRight");
    await expect(residues.nth(1)).toBeFocused();
    await residues.nth(1).press("Shift+ArrowRight");
    await expect(residues.nth(2)).toBeFocused();
    await expect(residues.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(async () => (await latestContext(page))?.activeTarget)
      .toMatchObject({ end: 3, kind: "sequence-range", start: 2 });
    const focusedSelection = (await readSequenceResiduePaints(page))[2];
    expect(focusedSelection.shadowContrasts).toHaveLength(2);
    for (const contrast of focusedSelection.shadowContrasts)
      expect(contrast).toBeGreaterThanOrEqual(3);
    expect(focusedSelection.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focusedSelection.outlineContrast).toBeGreaterThanOrEqual(3);

    const oppositeTheme = colorScheme === "light" ? "dark" : "light";
    await page.evaluate((theme) => {
      const frame = document.getElementById("viewer") as HTMLIFrameElement;
      frame.contentWindow?.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/host-context-changed",
          params: { theme },
        },
        "*",
      );
    }, oppositeTheme);
    await expect
      .poll(async () => (await readSequenceResiduePaints(page))[0].foreground)
      .not.toEqual(defaults[0].foreground);
    const hostPaint = (await readSequenceResiduePaints(page))[0];
    expect(hostPaint.background).not.toEqual(defaults[0].background);
    expect(hostPaint.foregroundLuminance > hostPaint.backgroundLuminance).toBe(
      oppositeTheme === "dark",
    );
    expect(hostPaint.contrast).toBeGreaterThanOrEqual(4.5);
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    ).toBe(colorScheme === "dark");

    for (const fixture of [
      {
        name: "rna",
        sequence: "ACGUNRYSWKMBDHV",
        molecule: "rna",
        paletteId: "muted-nucleic-acid",
      },
      {
        name: "mixed-nucleic",
        sequence: "ACGTUNRYSWKMBDHV",
        molecule: "nucleic-acid-ambiguous",
        paletteId: "muted-nucleic-acid",
      },
      {
        name: "protein",
        sequence: "ACDEFGHIKLMNPQRSTVWYBZUXO*-",
        molecule: "protein",
        paletteId: "muted-amino-acid",
      },
      {
        name: "gapped-dna",
        sequence: "ACGTN--ACGT.",
        molecule: "dna",
        paletteId: "muted-nucleic-acid",
      },
      {
        name: "unknown-gaps",
        sequence: "---...",
        molecule: "unknown",
        paletteId: "neutral",
      },
    ]) {
      await test.step(`${fixture.name} symbols, contrast and palette round trip`, async () => {
        await mountTextFixture(page, {
          contents: `>synthetic_${fixture.name}\n${fixture.sequence}\n`,
          name: `synthetic-${fixture.name}-palette.fasta`,
        });
        await expect(residues).toHaveCount(fixture.sequence.length);
        await expect
          .poll(async () => (await latestContext(page))?.displayedRecord)
          .toMatchObject({
            molecule: fixture.molecule,
            sequence: fixture.sequence,
          });
        await viewer
          .getByRole("button", { name: "Display", exact: true })
          .click();
        await expect(palette).toHaveValue(fixture.paletteId);
        const initialPaints = await readSequenceResiduePaints(page);
        expect(initialPaints.map(({ symbol }) => symbol).join("")).toBe(
          fixture.sequence,
        );
        for (const paint of initialPaints) {
          expect(
            paint.contrast,
            `${colorScheme} ${fixture.name} ${paint.symbol}`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(paint.foregroundLuminance > paint.backgroundLuminance).toBe(
            colorScheme === "dark",
          );
        }
        if (fixture.molecule === "protein") {
          await palette.selectOption({ label: "RasMol" });
          expect(
            (await readSequenceResiduePaints(page))
              .slice(0, 4)
              .map(({ background }) => background),
          ).toEqual([
            [200, 200, 200],
            [230, 230, 0],
            [230, 10, 10],
            [230, 10, 10],
          ]);
        }
        expect(
          await executeViewerCommand(page, {
            action: "set_sequence_view_options",
            palette: "neutral",
          }),
        ).toMatchObject({ applied: true });
        await expect(palette.locator("option:checked")).toHaveText(
          "Monochrome",
        );
        const neutralPaints = await readSequenceResiduePaints(page);
        expect(
          new Set(
            neutralPaints.map(({ foreground, background }) =>
              JSON.stringify({ foreground, background }),
            ),
          ).size,
        ).toBe(1);
        expect(neutralPaints[0].contrast).toBeGreaterThanOrEqual(4.5);
        expect(
          await executeViewerCommand(page, {
            action: "set_sequence_view_options",
            palette: fixture.paletteId,
          }),
        ).toMatchObject({ applied: true });
        await expect(palette).toHaveValue(fixture.paletteId);
        expect(
          (await readSequenceResiduePaints(page)).map(
            ({ foreground, background }) => ({ foreground, background }),
          ),
        ).toEqual(
          initialPaints.map(({ foreground, background }) => ({
            foreground,
            background,
          })),
        );
      });
    }
  });

  test(`alignment residue palettes remain readable across sequence modalities (${colorScheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    for (const fixture of [
      {
        name: "dna",
        sequence: "ACGTNRYSWKMDHV-",
        paletteId: "muted-nucleic-acid",
        legacy: "ncbi-nucleic-acid",
      },
      {
        name: "rna",
        sequence: "ACGUNRYSWKMDHV-",
        paletteId: "muted-nucleic-acid",
        legacy: "ncbi-nucleic-acid",
      },
      {
        name: "protein",
        sequence: "ACDEFGHIKLMNPQRSTVWYBZUXO*-",
        paletteId: "muted-amino-acid",
        legacy: "rasmol",
      },
    ]) {
      await test.step(`${fixture.name} aligned glyphs and UI/agent palette choices`, async () => {
        await mountTextFixture(page, {
          contents: `>synthetic_reference\n${fixture.sequence}\n>synthetic_peer\n${fixture.sequence}\n`,
          name: `synthetic-${fixture.name}-palette.aln-fasta`,
        });
        const viewer = viewerFrame(page);
        await expect(
          viewer.getByLabel("Interactive multiple sequence alignment viewer"),
        ).toBeVisible();
        await viewer
          .getByRole("button", { name: "Display", exact: true })
          .click();
        const colorMode = viewer.getByLabel("MSA color mode");
        await expect(colorMode).toHaveValue(
          fixture.name === "protein" ? "residue" : "difference",
        );
        expect(
          await executeViewerCommand(page, {
            action: "set_alignment_view_options",
            colorMode: "residue",
            showIdenticalAsDots: false,
          }),
        ).toMatchObject({ applied: true });
        const palette = viewer.getByLabel("MSA residue palette");
        await expect(palette).toHaveValue(fixture.paletteId);
        // The leading Reference row is derived consensus; inspect the exact source row.
        const sourceRow =
          'button[data-msa-cell="true"][aria-label^="synthetic_reference column "]';
        await expect(viewer.locator(sourceRow)).toHaveCount(
          fixture.sequence.length,
        );
        const defaults = await readSequenceResiduePaints(page, sourceRow);
        expect(defaults.map(({ symbol }) => symbol).join("")).toBe(
          fixture.sequence,
        );
        for (const paint of defaults) {
          expect(
            paint.contrast,
            `${colorScheme} aligned ${fixture.name} ${paint.symbol}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        await palette.selectOption(fixture.legacy);
        expect(
          (await readSequenceResiduePaints(page, sourceRow))
            .slice(0, 4)
            .map(({ background }) => background),
        ).toEqual(
          fixture.name === "protein"
            ? [
                [200, 200, 200],
                [230, 230, 0],
                [230, 10, 10],
                [230, 10, 10],
              ]
            : [
                [255, 0, 0],
                [255, 255, 0],
                [0, 0, 255],
                [0, 128, 0],
              ],
        );
        await palette.selectOption({ label: "Monochrome" });
        const monochrome = await readSequenceResiduePaints(page, sourceRow);
        expect(
          new Set(
            monochrome.map(({ foreground, background }) =>
              JSON.stringify({ foreground, background }),
            ),
          ).size,
        ).toBe(1);
        expect(monochrome[0].contrast).toBeGreaterThanOrEqual(4.5);
        expect(
          await executeViewerCommand(page, {
            action: "set_alignment_view_options",
            residuePalette: fixture.paletteId,
          }),
        ).toMatchObject({ applied: true });
        await expect(palette).toHaveValue(fixture.paletteId);
        expect(
          (await readSequenceResiduePaints(page, sourceRow)).map(
            ({ foreground, background }) => ({ foreground, background }),
          ),
        ).toEqual(
          defaults.map(({ foreground, background }) => ({
            foreground,
            background,
          })),
        );
      });
    }
  });
}

test("single-sequence residue, feature, translation and quality tracks stay aligned across base groups at narrow widths", async ({
  page,
}) => {
  // Two explicit format fixtures share the same synthetic 40-base sequence.
  const sequence = "A".repeat(40);
  await mountTextFixture(page, {
    contents: [
      "LOCUS       SYNTHETIC_GEOMETRY         40 bp    DNA     linear   SYN 01-JAN-2000",
      "DEFINITION  Synthetic browser geometry fixture, not experimental data.",
      "FEATURES             Location/Qualifiers",
      "     CDS             8..34",
      '                     /gene="synthetic CDS"',
      '                     /translation="KKKKKKKKK"',
      "ORIGIN",
      `        1 ${sequence.toLowerCase()}`,
      "//",
      "",
    ].join("\n"),
    name: "synthetic-geometry.gb",
  });
  const viewer = viewerFrame(page);
  const grid = viewer.getByLabel("Wrapped sequence view");
  await expect(grid).toBeVisible();
  expect(
    await executeViewerCommand(page, {
      action: "set_sequence_view_options",
      showFeatures: true,
      showTranslation: true,
      wrapWidth: 40,
    }),
  ).toMatchObject({ applied: true });
  await expect(grid.locator("[data-translation-coordinate]")).toHaveCount(9);
  await expect(grid.locator(".bio-sequence-residue").first()).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(grid.locator(".bio-sequence-residue").first()).toHaveCSS(
    "font-weight",
    "400",
  );
  const residue = (coordinate: number) =>
    grid.locator(`[data-sequence-coordinate="${coordinate}"]`);
  for (const coordinate of [8, 11, 20, 23, 32]) {
    await expectHorizontalAlignment(
      grid.locator(`[data-translation-coordinate="${coordinate}"]`),
      residue(coordinate),
    );
  }
  const feature = await requiredBoundingBox(
    grid.getByRole("button", {
      name: "Select CDS feature synthetic CDS",
      exact: true,
    }),
  );
  const featureStart = await requiredBoundingBox(residue(8));
  const featureEnd = await requiredBoundingBox(residue(34));
  expect(Math.abs(feature.x - featureStart.x)).toBeLessThan(0.75);
  expect(
    Math.abs(feature.x + feature.width - featureEnd.x - featureEnd.width),
  ).toBeLessThan(0.75);

  await page.setViewportSize({ width: 390, height: 900 });
  const scrollGeometry = await grid.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollGeometry.scrollWidth).toBeGreaterThan(
    scrollGeometry.clientWidth,
  );
  for (const boundary of [10, 20]) {
    const left = await requiredBoundingBox(residue(boundary));
    const right = await requiredBoundingBox(residue(boundary + 1));
    expect(
      Math.abs(right.x - left.x - left.width - left.width / 1.5),
    ).toBeLessThan(0.75);
  }
  await residue(10).focus();
  await residue(10).press("End");
  await expect(residue(40)).toBeFocused();
  await expect
    .poll(() => grid.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const visibleGrid = await requiredBoundingBox(grid);
  const lastBase = await requiredBoundingBox(residue(40));
  expect(lastBase.x + lastBase.width).toBeLessThanOrEqual(
    visibleGrid.x + visibleGrid.width + 1,
  );
  for (const coordinate of [11, 20, 32]) {
    await expectHorizontalAlignment(
      grid.locator(`[data-translation-coordinate="${coordinate}"]`),
      residue(coordinate),
    );
  }
  expect(
    await viewer
      .locator("html")
      .evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);

  await mountTextFixture(page, {
    contents: `@synthetic_geometry\n${sequence}\n+\n${"I".repeat(sequence.length)}\n`,
    name: "synthetic-geometry.fastq",
  });
  await expect(grid).toBeVisible();
  await expect(grid.locator(".bio-sequence-quality-bar")).toHaveCount(40);
  for (const coordinate of [1, 10, 11, 20, 21, 40]) {
    await expectHorizontalAlignment(
      grid.getByLabel(`Base ${coordinate} quality 40`, { exact: true }),
      residue(coordinate),
    );
  }
  expect(
    await viewer
      .locator("html")
      .evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
});

test("single-sequence co-visible CDS translations stay within each wrapped line", async ({
  page,
}) => {
  const featureLines = ["first", "second", "third"].flatMap((name) => [
    "     CDS             1..120",
    `                     /gene="synthetic ${name}"`,
    `                     /translation="${"K".repeat(40)}"`,
  ]);
  await mountTextFixture(page, {
    contents: [
      "LOCUS       SYNTHETIC_MULTI_CDS      120 bp    DNA     linear   SYN 01-JAN-2000",
      "DEFINITION  Synthetic overlapping-CDS layout fixture, not experimental data.",
      "FEATURES             Location/Qualifiers",
      ...featureLines,
      "ORIGIN",
      `        1 ${"a".repeat(60)}`,
      `       61 ${"a".repeat(60)}`,
      "//",
      "",
    ].join("\n"),
    name: "synthetic-multiple-cds.gb",
  });
  const grid = viewerFrame(page).getByLabel("Wrapped sequence view");
  await expect(grid).toBeVisible();
  expect(
    await executeViewerCommand(page, {
      action: "set_sequence_view_options",
      showFeatures: false,
      showTranslation: true,
      wrapWidth: 60,
    }),
  ).toMatchObject({ applied: true });
  await expect(grid.locator(".bio-sequence-line")).toHaveCount(2);
  await expect(grid.locator("[data-translation-coordinate]")).toHaveCount(120);
  const lineGeometry = await grid
    .locator(".bio-sequence-line")
    .evaluateAll((lines) =>
      lines.map((line) => {
        const bounds = line.getBoundingClientRect();
        const tracks = [
          ...line.querySelectorAll(".bio-sequence-track-row"),
        ].map((track) => {
          const rect = track.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom };
        });
        return { top: bounds.top, bottom: bounds.bottom, tracks };
      }),
    );
  for (const line of lineGeometry) {
    expect(line.tracks).toHaveLength(4);
    for (const track of line.tracks) {
      expect(track.top).toBeGreaterThanOrEqual(line.top);
      expect(track.bottom).toBeLessThanOrEqual(line.bottom);
    }
  }
  expect(lineGeometry[0].tracks.at(-1)!.bottom).toBeLessThanOrEqual(
    lineGeometry[1].tracks[0].top,
  );
});

test("chat handoff keeps its live session and retries a lost completion without reapplying", async ({
  page,
}) => {
  await page.goto(
    "/e2e/installed.html?chat=1&completion-failure=1&fixture=dna-single.fasta",
  );
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect
    .poll(async () => (await latestContext(page))?.viewerSessionId)
    .toBe("22222222-2222-4222-8222-222222222222");

  const result = await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "focus_sequence_coordinate",
      coordinate: 4,
      record: "dna_demo",
    }),
  );
  expect(result).toMatchObject({ applied: true, state: { coordinate: 4 } });
  await expect
    .poll(() => page.evaluate(() => window.__completionAttempts))
    .toBe(2);
  await expect
    .poll(async () => (await latestContext(page))?.selection)
    .toMatchObject({
      end: 4,
      start: 4,
    });
});

test("agent panel controls match the clean sequence UI and preserve pending Save As review", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Copy & share", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    viewer.getByRole("button", { name: "Publish record FASTA" }),
  ).not.toBeVisible();

  const initialPanels = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { target: "workbench-panels" },
  });
  expect(initialPanels).toMatchObject({
    applied: true,
    state: {
      query: {
        items: expect.arrayContaining([
          expect.objectContaining({
            activePanel: null,
            group: "sequence-display",
          }),
          expect.objectContaining({
            activePanel: null,
            group: "sequence-tools",
          }),
        ]),
      },
    },
  });

  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_panel",
      group: "sequence-display",
      panel: "copy",
    }),
  ).toMatchObject({ applied: true, state: { activePanel: "copy" } });
  await viewer.getByRole("button", { name: "Publish record FASTA" }).click();
  const saveDialog = viewer.getByRole("dialog", { name: "Save to workspace" });
  await expect(saveDialog).toBeVisible();

  const blockedSwitch = await executeViewerCommand(page, {
    action: "set_workbench_panel",
    group: "sequence-display",
    panel: "display",
  });
  expect(blockedSwitch).toMatchObject({
    applied: false,
    state: { activePanel: "copy", blocked: true },
  });
  await expect(saveDialog).toBeVisible();
  expect(
    await page.evaluate(() => window.__persistenceToolCalls),
  ).not.toContain("sequence.persist_workbench_payload");

  await saveDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_panel",
      group: "sequence-display",
      panel: "display",
    }),
  ).toMatchObject({ applied: true, state: { activePanel: "display" } });
  await expect(viewer.getByLabel("Residue palette")).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Publish record FASTA" }),
  ).not.toBeVisible();

  await viewer.getByRole("button", { name: "Display", exact: true }).click();
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: { group: "sequence-display", target: "workbench-panels" },
    }),
  ).toMatchObject({
    applied: true,
    state: { query: { items: [{ activePanel: null, blocked: false }] } },
  });
});

test("agent discovers and opens every mounted alignment tool panel", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-demo.aln-fasta");
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();
  const expectedPanels = [
    { id: "display", label: "Display" },
    { id: "rows", label: "Rows" },
    { id: "analyze", label: "Analyze" },
    { id: "edit", label: "Edit copy" },
    { id: "export", label: "Export" },
    { id: "details", label: "Details" },
    { id: "tasks", label: "Tasks" },
  ];
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: { group: "alignment-tools", target: "workbench-panels" },
    }),
  ).toMatchObject({
    applied: true,
    state: {
      query: { items: [{ activePanel: null, panels: expectedPanels }] },
    },
  });

  for (const { id, label } of expectedPanels) {
    expect(
      await executeViewerCommand(page, {
        action: "set_workbench_panel",
        group: "alignment-tools",
        panel: id,
      }),
    ).toMatchObject({ applied: true, state: { activePanel: id } });
    const trigger = viewer.getByRole("button", { name: label, exact: true });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panelId = await trigger.getAttribute("aria-controls");
    if (panelId == null)
      throw new Error("The tool trigger has no controlled panel.");
    await expect(viewer.locator(`[id="${panelId}"]`)).toBeVisible();
  }
  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_panel",
      group: "alignment-tools",
      panel: null,
    }),
  ).toMatchObject({ applied: true, state: { activePanel: null } });
  await expect(
    viewer.getByRole("button", { name: "Tasks", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("sequence workbench keeps origin-spanning selection authoritative and model-controllable", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=circular-plasmid.gb");
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Sequence overview and navigation"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Circular" }).click();
  await viewer.getByText("Select across the origin", { exact: true }).click();
  await viewer.getByLabel("Origin-spanning selection start").fill("20");
  await viewer.getByLabel("Origin-spanning selection end").fill("4");
  await viewer
    .getByRole("button", { name: "Select range", exact: true })
    .click();

  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({
      end: 4,
      kind: "sequence-range",
      segments: [
        { end: 24, start: 20 },
        { end: 4, start: 1 },
      ],
      start: 20,
      wraparound: true,
    });

  await viewer
    .getByRole("gridcell", { name: /MINI_CIRCLE position 10/ })
    .hover();
  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({ start: 20, wraparound: true });

  const result = await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "set_sequence_view_options",
      geneticCodeId: 11,
      layout: "split",
      orientation: "reverse-complement",
      synchronizedViews: false,
    }),
  );
  expect(result).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.display)
    .toMatchObject({
      geneticCodeId: 11,
      layout: "split",
      orientation: "reverse-complement",
      synchronizedViews: false,
    });

  const session = await saveViewerSession(page, "circular.session.json");
  expect(JSON.parse(session)).toMatchObject({ schemaVersion: 1 });
  await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "focus_sequence_coordinate",
      coordinate: 10,
      record: "MINI_CIRCLE",
    }),
  );
  await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "set_sequence_view_options",
      geneticCodeId: 1,
      layout: "linear",
      orientation: "forward",
      synchronizedViews: true,
    }),
  );
  const restored = await page.evaluate(
    (serialized) =>
      window.enqueueViewerCommand({
        action: "restore_session",
        session: serialized,
      }),
    session,
  );
  expect(restored).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({ start: 20, wraparound: true });
  await expect
    .poll(async () => (await latestContext(page))?.display)
    .toMatchObject({
      geneticCodeId: 11,
      layout: "split",
      orientation: "reverse-complement",
      synchronizedViews: false,
    });

  await viewer.getByRole("button", { name: "Export", exact: true }).click();
  await viewer.getByRole("button", { name: "Save session" }).click();
  await expect(
    viewer.getByText(/alignment-session|sequence-session/),
  ).toBeVisible();
});

test("alignment workbench builds a synchronized graphical tree and derived exports", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-demo.aln-fasta");
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();
  const firstCell = viewer.getByRole("gridcell", {
    name: /dna_ref column 1 A/,
  });
  await firstCell.focus();
  await firstCell.press("Shift+ArrowRight");
  await expect(
    viewer.getByRole("gridcell", { name: /dna_ref column 2 T/ }),
  ).toBeFocused();
  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({ endColumn: 2, kind: "alignment-columns", startColumn: 1 });
  await page.evaluate(() =>
    window.enqueueViewerCommand({ action: "clear_alignment_selection" }),
  );

  await viewer.getByRole("button", { name: "Analyze" }).click();
  await viewer.getByRole("button", { name: "Neighbor-joining tree" }).click();
  await expect(viewer.getByLabel("Graphical guide tree")).toBeVisible();
  await viewer.getByRole("button", { name: /All/ }).click();
  await expect
    .poll(async () => (await latestContext(page))?.activeTarget)
    .toMatchObject({ kind: "alignment-rows" });

  await viewer.getByRole("button", { name: /Edit copy/ }).click();
  await expect(viewer.getByLabel("Graphical guide tree")).not.toBeVisible();
  await viewer.getByLabel("Alignment row group name").fill("responders");
  await viewer.getByRole("button", { name: "Group selected" }).click();
  await expect(
    viewer.getByText("responders · dna_ref", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await latestContext(page))?.display?.rowGroups)
    .toEqual([{ name: "responders", rowCount: 3 }]);
  await viewer.getByRole("button", { name: "Export", exact: true }).click();
  await viewer.getByRole("button", { name: "NEWICK" }).click();
  await expect(viewer.getByText(/\.nwk/)).toBeVisible();
  await viewer.getByRole("button", { name: /Edit copy/ }).click();
  await viewer.getByRole("button", { name: "Sort by tree" }).click();
  await expect
    .poll(async () => (await latestContext(page))?.guideTree?.method)
    .toBe("neighbor-joining");
  const removed = await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "edit_copy",
      request: {
        operation: "remove-alignment-rows",
        rowIds: ["dna_sample_2"],
      },
    }),
  );
  expect(removed).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.guideTree)
    .toBeNull();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
});

test("superseded resource loads cannot publish stale viewer state", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?switch=1");
  const viewer = viewerFrame(page);
  await expect(viewer.getByText("fast.fasta")).toBeVisible();
  await expect(
    viewer.getByRole("gridcell", { name: /fast position 1 C/ }),
  ).toBeVisible();
  await page.waitForTimeout(350);
  await expect(viewer.getByText("fast.fasta")).toBeVisible();
  await expect(viewer.getByText("slow.fasta")).toHaveCount(0);
  expect((await latestContext(page))?.artifact?.fileName).toBe("fast.fasta");
});

test("trusted indexed native results supersede the oversized host resource in the installed bundle", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?native-indexed=1");
  const viewer = viewerFrame(page);
  await expect(viewer.getByText("native-large.fasta")).toBeVisible();
  await expect(
    viewer.getByRole("gridcell", { name: /indexed-native position 1 A/ }),
  ).toBeVisible();
  await page.waitForTimeout(350);
  await expect(viewer.getByText("Sequence could not be opened")).toHaveCount(0);
  expect((await latestContext(page))?.artifact?.fileName).toBe(
    "native-large.fasta",
  );
  const evidence = await page.evaluate(() => ({
    contexts: window.__viewerContexts,
    resourceRequests: window.__resourceRequests,
  }));
  expect(evidence.resourceRequests).toEqual(
    expect.arrayContaining([
      "codex-resource://oversized-native",
      expect.stringMatching(
        /^viewer-file:\/\/sequence-viewer\/opened\/[0-9a-f-]{36}$/,
      ),
    ]),
  );
  expect(JSON.stringify(evidence)).not.toContain("/workspace/");
  expect(JSON.stringify(evidence)).not.toContain("openai/resource");
});

test("native opens retain the installed-host resource when trusted path metadata is unavailable", async ({
  page,
}) => {
  await page.goto(
    "/e2e/installed.html?native-fallback=1&fixture=dna-single.fasta",
  );
  const viewer = viewerFrame(page);
  await expect(viewer.getByText("dna-single.fasta")).toBeVisible();
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  const requests = await page.evaluate(() => window.__resourceRequests);
  expect(requests).toEqual(["viewer-file://e2e/dna-single.fasta"]);
});

test("resource failures are recoverable and parse failures do not masquerade as empty ready viewers", async ({
  page,
}) => {
  await page.goto(
    "/e2e/installed.html?resource-error=1&fixture=dna-single.fasta",
  );
  const viewer = viewerFrame(page);
  await expect(viewer.getByText("Sequence viewer link expired")).toBeVisible();
  await viewer.getByRole("button", { name: "Reopen from chat" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__messages.length))
    .toBe(1);

  await page.goto("/e2e/installed.html?fixture=not-an-alignment.txt");
  await expect(viewer.getByText("Sequence could not be opened")).toBeVisible();
  await expect(
    viewer.getByText(/No supported biological sequence records/),
  ).toBeVisible();
});

test("large sequence and FASTQ inputs keep mounted DOM and retained records bounded", async ({
  page,
}) => {
  const viewer = viewerFrame(page);
  await page.goto("/e2e/installed.html?fixture=large-sequence.fasta");
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  expect(await viewer.getByRole("gridcell").count()).toBeLessThan(1_000);

  await page.goto("/e2e/installed.html?fixture=large.fastq");
  await expect(
    viewer.getByText(/summary statistics cover all 6,000 parsed reads/),
  ).toBeVisible();
  await expect(viewer.getByText(/retains the first 5,000/)).toBeVisible();
  expect(
    await executeViewerCommand(page, {
      action: "set_sequence_record_browser",
      expanded: true,
    }),
  ).toMatchObject({ applied: true });
  const records = viewer.getByRole("region", {
    name: "Sequence record selector",
  });
  await expect(records.locator("tbody tr").first()).toBeVisible();
  // QC tables are separate summaries; the retained-record page keeps its 100-row bound.
  expect(await records.locator("tbody tr").count()).toBeLessThanOrEqual(100);
  expect(await viewer.getByRole("gridcell").count()).toBeLessThan(1_000);
});

test("artifact and session persistence stays inside the installed-host proxy envelope", async ({
  page,
}) => {
  await page.goto(
    "/e2e/installed.html?persistence-failure=1&fixture=dna-single.fasta",
  );
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  const saved = await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "save_session",
      name: "proxy-safe.session.json",
    }),
  );
  expect(saved.state).toMatchObject({
    session: {
      name: "proxy-safe.session.json",
      savedSessionId: expect.any(String),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    },
  });
  expect(saved.state?.session).not.toEqual(expect.any(String));

  await page.evaluate(() => window.openViewerFixture("proxy-large.fasta"));
  await expect(
    viewer.getByText("proxy-large.fasta", { exact: true }),
  ).toBeVisible();

  const exported = await page.evaluate(() =>
    window.enqueueViewerCommand({
      action: "export_artifact",
      format: "fasta",
      name: "proxy-large",
      scope: "all",
    }),
  );
  const artifact = (
    exported.state as
      | {
          artifact?: {
            resourceUri?: string;
            sha256?: string;
            size?: number;
          };
        }
      | undefined
  )?.artifact;
  expect(artifact).toMatchObject({
    resourceUri: expect.stringMatching(/^viewer-artifact:/u),
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
  });
  expect(artifact?.size).toBeGreaterThan(2 * 1_024 * 1_024);
  expect(artifact).not.toHaveProperty("content");

  const transport = await page.evaluate(() => ({
    calls: window.__persistenceToolCalls,
    maxBytes: window.__maxToolsCallBytes,
  }));
  expect(transport.calls).toContain("sequence.begin_workbench_payload_upload");
  expect(transport.calls).toContain("sequence.append_workbench_payload_chunk");
  expect(transport.calls).toContain("sequence.finish_workbench_payload_upload");
  expect(transport.calls).toContain("sequence.persist_workbench_payload");
  expect(transport.maxBytes).toBeLessThanOrEqual(280 * 1_024);
});

test("workspace Save As uses only relative metadata and the existing installed-host transport", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await viewer
    .getByRole("button", { name: "Copy & share", exact: true })
    .click();
  const publish = viewer.getByRole("button", { name: "Publish record FASTA" });
  await expect(publish).toBeVisible();
  await publish.click();
  await expect(
    viewer.getByRole("dialog", { name: "Save to workspace" }),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "exports/" }).click();
  await viewer.getByRole("textbox", { name: "New folder" }).fill("saved");
  await viewer.getByRole("button", { name: "Create folder" }).click();
  await viewer
    .getByRole("textbox", { name: "File name" })
    .fill("dna-record.fasta");
  await expect(
    viewer.getByText("data/exports/saved/dna-record.fasta"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    viewer.getByText("Published data/exports/saved/dna-record.fasta"),
  ).toBeVisible();

  await publish.click();
  await viewer.getByRole("button", { name: "exports/" }).click();
  await viewer.getByRole("button", { name: "saved/" }).click();
  await viewer
    .getByRole("textbox", { name: "File name" })
    .fill("dna-record.fasta");
  await expect(
    viewer.getByText("The artifact or provenance sidecar already exists."),
  ).toBeVisible();
  await viewer.getByRole("radio", { name: "Save next version" }).click();
  await expect(
    viewer.getByText("data/exports/saved/dna-record-2.fasta"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    viewer.getByText("Published data/exports/saved/dna-record-2.fasta"),
  ).toBeVisible();

  const evidence = await page.evaluate(() => ({
    artifact: window.readWorkspaceArtifact(
      "data/exports/saved/dna-record.fasta",
    ),
    versionedArtifact: window.readWorkspaceArtifact(
      "data/exports/saved/dna-record-2.fasta",
    ),
    maxBytes: window.__maxToolsCallBytes,
    requests: window.__toolRequests,
  }));
  expect(evidence.artifact).toMatch(/^>dna_demo/u);
  expect(evidence.versionedArtifact).toBe(evidence.artifact);
  expect(evidence.maxBytes).toBeLessThanOrEqual(280 * 1_024);
  expect(evidence.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        arguments: expect.objectContaining({
          destination: {
            base: "opened-source",
            collisionPolicy: "exact",
            kind: "workspace",
            relativePath: "exports/saved/dna-record.fasta",
          },
        }),
        name: "sequence.prepare_workspace_export",
      }),
      expect.objectContaining({
        arguments: expect.objectContaining({
          destination: expect.objectContaining({
            collisionPolicy: "next-version",
          }),
        }),
        name: "sequence.prepare_workspace_export",
      }),
      expect.objectContaining({
        name: "sequence.list_workspace_export_directory",
      }),
      expect.objectContaining({
        name: "sequence.create_workspace_export_directory",
      }),
      expect.objectContaining({
        name: "sequence.begin_workbench_payload_upload",
      }),
      expect.objectContaining({
        name: "sequence.append_workbench_payload_chunk",
      }),
      expect.objectContaining({
        name: "sequence.finish_workbench_payload_upload",
      }),
    ]),
  );
  expect(JSON.stringify(evidence.requests)).not.toContain("openai/resource");
  expect(JSON.stringify(evidence.requests)).not.toContain("fsPath");
  expect(JSON.stringify(evidence.requests)).not.toContain("/workspace/");
});

test("installed host publishes canonical Alignment source through server generation", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-demo.aln-fasta");
  const viewer = viewerFrame(page);
  await viewer.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    viewer.getByRole("button", { name: "Publish source alignment" }),
  ).toBeVisible();
  await viewer
    .getByRole("button", { name: "Publish source alignment" })
    .click();
  await expect(
    viewer.getByRole("dialog", { name: "Save to workspace" }),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(viewer.getByText("Published data/alignment.afa")).toBeVisible();

  const evidence = await page.evaluate(() => ({
    artifact: window.readWorkspaceArtifact("data/alignment.afa"),
    maxBytes: window.__maxToolsCallBytes,
    requests: window.__toolRequests.filter(
      ({ name }) => name === "sequence.generate_workspace_export",
    ),
  }));
  expect(evidence.artifact).toMatch(/^>/u);
  expect(evidence.requests).toHaveLength(1);
  expect(evidence.requests[0]).toMatchObject({
    arguments: {
      destination: {
        base: "opened-source",
        collisionPolicy: "exact",
        kind: "workspace",
        relativePath: "alignment.afa",
      },
      format: "aligned-fasta",
      source: { compression: "auto", kind: "opened-source" },
    },
    name: "sequence.generate_workspace_export",
  });
  expect(evidence.maxBytes).toBeLessThanOrEqual(280 * 1_024);
  expect(JSON.stringify(evidence.requests)).not.toContain("/workspace/");
});

for (const fixture of ["dna-single.fasta", "dna-demo.aln-fasta"]) {
  test(`workspace project Save As and confirmed restore (${fixture})`, async ({
    page,
  }) => {
    await page.goto(`/e2e/installed.html?fixture=${fixture}`);
    const viewer = viewerFrame(page);
    await expect(
      viewer.locator(
        '[aria-label="Wrapped sequence view"], [aria-label="Interactive multiple sequence alignment viewer"]',
      ),
    ).toBeVisible();
    await viewer.getByRole("button", { name: "Export", exact: true }).click();
    await viewer.getByRole("button", { name: "Save project" }).click();
    await expect(
      viewer.getByRole("dialog", { name: "Save to workspace" }),
    ).toBeVisible();
    const expectedName = fixture.replace(/\.[^.]+$/u, "") +
      ".sequence-viewer.session.json";
    await expect(
      viewer.getByRole("textbox", { name: "File name" }),
    ).toHaveValue(expectedName);
    await viewer.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      viewer.getByText(`Saved data/${expectedName}`),
    ).toBeVisible();

    await expect(
      viewer.getByText("1 saved workspace project found for this source."),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: "Review saved projects" })
      .click();
    const restore = viewer.getByRole("button", {
      name: "Restore",
      exact: true,
    });
    await expect(restore).toBeDisabled();
    await viewer
      .getByRole("checkbox", {
        name: /replace the current workbench state/u,
      })
      .check();
    await restore.click();
    await expect(
      viewer.getByRole("dialog", { name: "Restore workspace project" }),
    ).not.toBeVisible();

    const evidence = await page.evaluate((workspacePath) => ({
      requests: window.__toolRequests.filter(({ name }) =>
        name.includes("workspace_session") ||
        name === "sequence.prepare_workspace_export" ||
        name === "sequence.persist_workbench_payload",
      ),
      session: window.readWorkspaceSession(workspacePath),
    }), `data/${expectedName}`);
    expect(evidence.session).toMatchObject({
      mode: fixture === "dna-single.fasta" ? "sequence" : "alignment",
      workspacePath: `data/${expectedName}`,
    });
    expect(evidence.requests.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "sequence.list_workspace_sessions",
        "sequence.prepare_workspace_export",
        "sequence.persist_workbench_payload",
        "sequence.restore_workspace_session",
      ]),
    );
    expect(JSON.stringify(evidence)).not.toContain("/workspace/");
    expect(JSON.stringify(evidence)).not.toContain("openai/resource");
  });
}

test("workspace Save As fails closed when trusted source capability is unavailable", async ({
  page,
}) => {
  await page.goto(
    "/e2e/installed.html?workspace-unavailable=1&fixture=dna-single.fasta",
  );
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await viewer
    .getByRole("button", { name: "Copy & share", exact: true })
    .click();
  await viewer.getByRole("button", { name: "Publish record FASTA" }).click();
  await expect(
    viewer.getByText(/Workspace publication is unavailable for this viewer/),
  ).toBeVisible();
  const calls = await page.evaluate(() => window.__persistenceToolCalls);
  const requests = await page.evaluate(() => window.__toolRequests);
  expect(requests.map(({ name }) => name)).toContain(
    "sequence.list_workspace_export_directory",
  );
  expect(calls).not.toContain("sequence.prepare_workspace_export");
  expect(calls).not.toContain("sequence.persist_workbench_payload");
});

test("workspace browser loads confirmed text and indexed evidence without host paths", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await viewer.getByRole("button", { name: "Tracks" }).click();
  await viewer.getByRole("button", { name: "Add from workspace" }).click();
  const trackDialog = viewer.getByRole("dialog", {
    name: "Add related workspace evidence",
  });
  await expect(trackDialog).toBeVisible();
  await viewer.getByRole("button", { name: /^genes\.gff3 /u }).click();
  await viewer.getByRole("checkbox", { name: /I confirm this track/u }).check();
  await viewer.getByRole("button", { name: "Load confirmed track" }).click();
  await expect(trackDialog.getByRole("status")).toContainText(
    "Loaded genes.gff3 with 1 items; mapping matched.",
  );
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(viewer.getByText("genes.gff3", { exact: true })).toBeVisible();

  await viewer.getByRole("button", { name: "Add from workspace" }).click();
  await viewer
    .getByRole("button", { name: /^reads\.bam data\/reads\.bam /u })
    .click();
  await viewer.getByLabel("Contig").fill("ref");
  await viewer.getByRole("spinbutton", { name: "Start" }).fill("1");
  await viewer.getByRole("spinbutton", { name: "End" }).fill("45");
  await viewer.getByRole("checkbox", { name: /I confirm this track/u }).check();
  await viewer.getByRole("button", { name: "Load confirmed track" }).click();
  await expect(trackDialog.getByRole("status")).toContainText(
    "Loaded reads.bam with 6 items; mapping matched.",
  );
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(viewer.getByText("reads.bam", { exact: true })).toBeVisible();

  const requests = await page.evaluate(() => window.__toolRequests);
  expect(requests.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      "sequence.list_workspace_track_directory",
      "sequence.resolve_workspace_track_bundle",
      "sequence.load_workspace_track",
    ]),
  );
  const trackRequests = requests.filter(({ name }) =>
    name.includes("workspace_track"),
  );
  expect(JSON.stringify(trackRequests)).not.toContain("/workspace/");
  expect(JSON.stringify(trackRequests)).not.toContain("openai/resource");
  expect(JSON.stringify(trackRequests)).not.toContain("fsPath");
});

test("installed RNA editing preserves uracil and rejects invalid nucleotide alphabets", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=rna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect(viewer.getByText("rna", { exact: true })).toBeVisible();

  const selected = await executeViewerCommand(page, {
    action: "select_sequence_range",
    end: 4,
    start: 1,
  });
  expect(selected).toMatchObject({ applied: true });
  await viewer
    .getByRole("button", { name: "Reverse complement", exact: true })
    .click();
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.sequence)
    .toBe("GCAUGUACGUUAGC");
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.molecule)
    .toBe("rna");

  await viewer.getByRole("button", { name: /Edit copy/u }).click();
  const editor = viewer.getByLabel("Replacement or inserted sequence");
  await editor.fill("T!🙂");
  await viewer.getByRole("button", { name: /Insert before/u }).click();
  await expect(viewer.getByRole("alert")).toBeVisible();
  expect((await latestContext(page))?.displayedRecord?.sequence).toBe(
    "GCAUGUACGUUAGC",
  );

  await editor.fill("U");
  await viewer.getByRole("button", { name: /Insert before/u }).click();
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.sequence)
    .toBe("UGCAUGUACGUUAGC");
});

test("installed FASTQ edits preserve measured quality and reject invented inserted quality", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=small.fastq");
  const viewer = viewerFrame(page);
  await viewer.getByRole("button", { name: "Quality", exact: true }).click();
  await expect(viewer.getByText("FASTQ overview")).toBeVisible();
  await viewer.getByRole("button", { name: "Display", exact: true }).click();
  await expect(viewer.getByRole("button", { name: "FASTQ quality" })).toBeEnabled();

  const selected = await executeViewerCommand(page, {
    action: "select_sequence_range",
    end: 3,
    start: 2,
  });
  expect(selected).toMatchObject({ applied: true });

  await viewer.getByRole("button", { name: /Edit copy/u }).click();
  const editor = viewer.getByLabel("Replacement or inserted sequence");
  await editor.fill("GG");
  await viewer.getByRole("button", { name: "Replace selection" }).click();
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.sequence)
    .toBe("AGGTACGT");
  await expect(viewer.getByRole("button", { name: "FASTQ quality" })).toBeEnabled();

  const quality = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { end: 8, start: 1, target: "quality" },
  });
  expect(quality).toMatchObject({
    applied: true,
    state: { query: { result: { values: Array(8).fill(40) } } },
  });

  await editor.fill("A");
  await viewer.getByRole("button", { name: /Insert before/u }).click();
  await expect(viewer.getByRole("alert")).toContainText(/quality/i);
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.sequence)
    .toBe("AGGTACGT");

  const metrics = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { limit: 5, target: "metrics" },
  });
  expect(metrics).toMatchObject({
    applied: true,
    state: { query: { items: [{ readCount: 2, totalBases: 16 }] } },
  });
});

test("FASTQ quality and adapter results are identical through UI actions and agent tools", async ({
  page,
}) => {
  // The repository's two-read FASTQ fixture is synthetic, not a public starter.
  await page.goto("/e2e/installed.html?fixture=small.fastq");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_panel",
      group: "sequence-tools",
      panel: "quality",
    }),
  ).toMatchObject({ applied: true });
  await expect(
    viewer.getByRole("img", {
      name: "Per-cycle quality: mean and observed range",
    }),
  ).toBeVisible();
  expect(
    await executeViewerCommand(page, {
      action: "set_quality_view_options",
      expandedTables: ["cycle-quality"],
      methodsExpanded: true,
    }),
  ).toMatchObject({ applied: true });
  const cycleTable = viewer.getByRole("table", {
    name: "Quality by cycle data",
  });
  await expect(cycleTable).toBeVisible();
  expect(
    await cycleTable
      .locator("tbody tr")
      .first()
      .getByRole("cell")
      .allTextContents(),
  ).toEqual(["1", "2", "39.5", "39", "40"]);

  await viewer.getByLabel("Your adapter sequence").fill("ACGTACGT");
  await viewer
    .getByRole("button", { name: "Screen sequence", exact: true })
    .click();
  const adapterResult = viewer.getByText(
    "1 of 2 analyzed reads contain the supplied sequence (1 exact occurrences).",
    { exact: true },
  );
  await expect(adapterResult).toBeVisible();
  const uiReport = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { target: "quality-report" },
  });
  expect(uiReport).toMatchObject({
    applied: true,
    state: {
      query: {
        result: {
          adapter: { occurrences: 1, records: 1 },
          adapterSequence: "ACGTACGT",
          cycleBins: expect.arrayContaining([
            expect.objectContaining({
              count: 2,
              end: 1,
              maximum: 40,
              mean: 39.5,
              minimum: 39,
              start: 1,
            }),
          ]),
          scope: { analyzedBases: 16, analyzedReads: 2, isSubset: false },
        },
      },
    },
  });

  await viewer
    .getByRole("button", { name: "Clear screen", exact: true })
    .click();
  await expect(
    viewer.getByText(
      "Adapter content not screened: no adapter sequence supplied.",
      { exact: true },
    ),
  ).toBeVisible();
  const jobId = "b5a10000-0000-4000-8000-000000000205";
  expect(
    await executeViewerCommand(page, {
      action: "run_analysis",
      jobId,
      request: { adapterSequence: "ACGTACGT", analysis: "quality-report" },
    }),
  ).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.interface?.quality)
    .toMatchObject({
      adapterSequence: "ACGTACGT",
      jobId,
      pending: false,
      reportAvailable: true,
    });
  await expect(adapterResult).toBeVisible();
  const agentReport = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { target: "quality-report" },
  });
  expect(agentReport).toMatchObject({ applied: true });
  expect(agentReport.state).toEqual(uiReport.state);
  expect(
    Buffer.byteLength(JSON.stringify(agentReport.state), "utf8"),
  ).toBeLessThan(48 * 1_024);

  const session = await saveViewerSession(
    page,
    "synthetic-quality.session.json",
  );
  expect(
    await executeViewerCommand(page, {
      action: "set_quality_view_options",
      expandedTables: [],
      methodsExpanded: false,
    }),
  ).toMatchObject({ applied: true });
  expect(
    await executeViewerCommand(page, {
      action: "run_analysis",
      jobId: "b5a10000-0000-4000-8000-000000000208",
      request: { analysis: "quality-report" },
    }),
  ).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.interface?.quality)
    .toMatchObject({
      adapterSequence: null,
      pending: false,
      reportAvailable: true,
    });
  expect(
    await executeViewerCommand(page, { action: "restore_session", session }),
  ).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.interface)
    .toMatchObject({
      quality: {
        adapterSequence: "ACGTACGT",
        pending: false,
        reportAvailable: true,
      },
      qualityView: { expandedTables: ["cycle-quality"], methodsExpanded: true },
    });
  await expect(adapterResult).toBeVisible();
  await expect(cycleTable).toBeVisible();
});

test("agent read filtering and source-read inspection stay synchronized with the pileup", async ({
  page,
}) => {
  // Explicit synthetic SAM conformance records, never measured or patient reads.
  await mountTextFixture(page, {
    contents: ">synthetic_ref\nACGTACGTACGT\n",
    name: "synthetic-pileup-reference.fasta",
  });
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  const trackId = "b5a10000-0000-4000-8000-000000000206";
  const sam = [
    "@HD\tVN:1.6\tSO:unsorted",
    "@SQ\tSN:synthetic_ref\tLN:12",
    "synthetic_high\t0\tsynthetic_ref\t1\t60\t2M1I1M1D2M2N1M1S\t*\t0\t0\tATGTCGAA\tIIIIIIII",
    "synthetic_low\t16\tsynthetic_ref\t1\t5\t4M\t*\t0\t0\tACGT\t!!!!",
    "synthetic_unknown\t0\tsynthetic_ref\t1\t255\t4M\t*\t0\t0\tAAAA\t*",
    "",
  ].join("\n");
  expect(
    await executeViewerCommand(page, {
      action: "load_track",
      content: sam,
      displayName: "synthetic-pileup.sam",
      encoding: "utf8",
      format: "sam",
      reference: "synthetic_ref",
      trackId,
    }),
  ).toMatchObject({ applied: true });
  await expect(
    viewer.getByRole("button", { name: /^Inspect read synthetic_/u }),
  ).toHaveCount(3);

  expect(
    await executeViewerCommand(page, {
      action: "set_read_pileup_options",
      includeUnknownMappingQuality: false,
      minimumMappingQuality: 30,
      showSoftClips: false,
      sortBy: "mapping-quality",
    }),
  ).toMatchObject({ applied: true });
  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_disclosure",
      disclosureId: "sequence.read-display",
      expanded: true,
    }),
  ).toMatchObject({ applied: true });
  await expect(viewer.getByLabel("Minimum MAPQ")).toBeVisible();
  await expect(viewer.getByLabel("Minimum MAPQ")).toHaveValue("30");
  await expect(viewer.getByLabel("Sort reads")).toHaveValue("mapping-quality");
  await expect(
    viewer.getByRole("button", { name: /^Inspect read synthetic_high,/u }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", {
      name: /^Inspect read synthetic_(low|unknown),/u,
    }),
  ).toHaveCount(0);
  await expect(
    viewer.getByText(/Coverage uses all 1 filtered, loaded alignments/u),
  ).toBeVisible();
  await expect(viewer.locator('[data-cigar-operation="S"]')).toHaveCount(0);

  expect(
    await executeViewerCommand(page, {
      action: "select_read",
      sourceReadIndex: 0,
      trackId,
    }),
  ).toMatchObject({ applied: true });
  const inspector = viewer.getByRole("complementary", {
    name: "Selected read details",
  });
  await expect(inspector).toContainText("2M1I1M1D2M2N1M1S");
  await expect(inspector).toContainText("Q40.0");
  const detail = await executeViewerCommand(page, {
    action: "query_viewer",
    request: {
      end: 12,
      limit: 100,
      sourceReadIndex: 0,
      start: 1,
      target: "read-detail",
      trackId,
    },
  });
  expect(detail).toMatchObject({
    applied: true,
    state: {
      query: {
        coordinateSystem: {
          basis: 1,
          end: "inclusive",
          reference: "synthetic_ref",
        },
        items: expect.arrayContaining([
          expect.objectContaining({
            kind: "insertion",
            sequence: "G",
            type: "boundary-marker",
          }),
          expect.objectContaining({ operation: "D", type: "alignment-block" }),
          expect.objectContaining({
            comparison: "mismatch",
            coordinate: 2,
            quality: 40,
            type: "base-call",
          }),
        ]),
        result: {
          baseQuality: { availableCount: 8, mean: 40 },
          cigar: "2M1I1M1D2M2N1M1S",
          id: "synthetic_high",
          inDisplayedSample: true,
          mappingQuality: 60,
          sourceReadIndex: 0,
          trackId,
        },
      },
    },
  });
  expect(
    await executeViewerCommand(page, {
      action: "select_read",
      sourceReadIndex: 1,
      trackId,
    }),
  ).toMatchObject({
    applied: false,
    message: expect.stringMatching(/excluded by the active pileup filters/u),
  });
  await expect(inspector).toContainText("synthetic_high");
  const session = await saveViewerSession(
    page,
    "synthetic-pileup.session.json",
  );

  await viewer.getByLabel("Minimum MAPQ").selectOption("0");
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: { target: "read-pileup-state" },
    }),
  ).toMatchObject({
    applied: true,
    state: {
      query: {
        result: {
          options: {
            includeUnknownMappingQuality: false,
            minimumMappingQuality: 0,
          },
          selectedRead: { sourceReadIndex: 0, trackId },
        },
      },
    },
  });
  await expect(
    viewer.getByRole("button", { name: /^Inspect read synthetic_low,/u }),
  ).toBeVisible();
  expect(
    await executeViewerCommand(page, { action: "clear_read_selection" }),
  ).toMatchObject({ applied: true });
  await expect(inspector).not.toBeVisible();
  expect(
    await executeViewerCommand(page, { action: "restore_session", session }),
  ).toMatchObject({ applied: true });
  await expect(viewer.getByLabel("Minimum MAPQ")).toHaveValue("30");
  await expect(inspector).toContainText("synthetic_high");
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: { target: "read-pileup-state" },
    }),
  ).toMatchObject({
    applied: true,
    state: {
      query: {
        result: {
          options: {
            includeUnknownMappingQuality: false,
            minimumMappingQuality: 30,
            showSoftClips: false,
          },
          selectedRead: { sourceReadIndex: 0, trackId },
        },
      },
    },
  });
});

test("generated SnapGene test input exposes annotations and metadata through agent tools", async ({
  page,
}) => {
  // Generated packet-format conformance input, not a measured plasmid or starter.
  await mountTextFixture(page, {
    contents: serializeBinarySequenceEnvelope(makeSyntheticSnapGene()),
    name: "synthetic-annotated-plasmid.dna",
  });
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord)
    .toMatchObject({
      length: 12,
      molecule: "dna",
      sequence: "ATGAAACCCGGG",
      topology: "circular",
    });
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: { limit: 10, target: "features" },
    }),
  ).toMatchObject({
    applied: true,
    state: {
      query: { items: [{ end: 8, label: "test gene", start: 2, strand: "+" }] },
    },
  });
  expect(
    await executeViewerCommand(page, {
      action: "select_sequence_feature",
      featureId: "test gene",
    }),
  ).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.selection)
    .toMatchObject({ end: 8, start: 2 });

  expect(
    await executeViewerCommand(page, {
      action: "set_workbench_disclosure",
      disclosureId: "sequence.record-metadata",
      expanded: true,
    }),
  ).toMatchObject({ applied: true });
  await expect(
    viewer.getByRole("button", { name: "Inspect", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    viewer.getByText("snapgeneDnaFlags", { exact: true }),
  ).toBeVisible();
  await viewer.getByText("Record metadata", { exact: true }).click();
  expect(
    await executeViewerCommand(page, {
      action: "query_viewer",
      request: {
        limit: 100,
        mode: "sequence",
        target: "workbench-disclosures",
      },
    }),
  ).toMatchObject({
    applied: true,
    state: {
      query: {
        items: expect.arrayContaining([
          expect.objectContaining({
            expanded: false,
            id: "sequence.record-metadata",
          }),
        ]),
      },
    },
  });
});

for (const { extension, format, makeBytes } of [
  { extension: "ab1", format: "abif", makeBytes: makeSyntheticAbif },
  { extension: "scf", format: "scf", makeBytes: makeSyntheticScf },
] as const) {
  test(`generated ${format.toUpperCase()} test traces preserve UI and agent source coordinates`, async ({
    page,
  }) => {
    // Source-code-generated format conformance data; no binary file is committed.
    await mountTextFixture(page, {
      contents: serializeBinarySequenceEnvelope(makeBytes()),
      name: `synthetic-conformance.${extension}`,
    });
    const viewer = viewerFrame(page);
    await expect(
      viewer.getByRole("region", { name: "Chromatogram", exact: true }),
    ).toBeVisible();
    expect(
      await executeViewerCommand(page, {
        action: "set_chromatogram_view_options",
        basesPerWindow: 3,
        firstBase: 2,
      }),
    ).toMatchObject({
      applied: true,
      state: { chromatogram: { basesPerWindow: 3, firstBase: 2 } },
    });
    await expect(
      viewer.getByRole("figure", { name: /chromatogram, bases 2 to 4,/u }),
    ).toBeVisible();
    const firstPage = await executeViewerCommand(page, {
      action: "query_viewer",
      request: { end: 4, limit: 4, start: 2, target: "chromatogram" },
    });
    expect(firstPage).toMatchObject({
      applied: true,
      state: {
        query: {
          coordinateSystem: {
            basis: 1,
            orientation: "original-forward",
            sampleBasis: 0,
          },
          items: [3, 4, 5, 6].map((sample) => ({
            A: SYNTHETIC_TRACE_CHANNELS.A[sample],
            C: SYNTHETIC_TRACE_CHANNELS.C[sample],
            G: SYNTHETIC_TRACE_CHANNELS.G[sample],
            T: SYNTHETIC_TRACE_CHANNELS.T[sample],
            sample,
          })),
          nextCursor: expect.any(String),
          page: { count: 4, offset: 0, totalCount: 11 },
          result: {
            baseCalls: [
              { base: "C", coordinate: 2, peakSample: 5, quality: 32 },
              { base: "G", coordinate: 3, peakSample: 8, quality: 33 },
              { base: "T", coordinate: 4, peakSample: 11, quality: 34 },
            ],
            downsampled: false,
            format,
            sampleEnd: 13,
            sampleStart: 3,
          },
        },
      },
    });
    const cursor = (firstPage.state as { query: { nextCursor: string } }).query
      .nextCursor;
    expect(
      await executeViewerCommand(page, {
        action: "query_viewer",
        request: { cursor, end: 4, limit: 4, start: 2, target: "chromatogram" },
      }),
    ).toMatchObject({
      applied: true,
      state: {
        query: {
          items: expect.arrayContaining([
            { sample: 7, A: 0, C: 0, G: 25, T: 0 },
          ]),
          page: { count: 4, offset: 4, totalCount: 11 },
        },
      },
    });

    await viewer.getByRole("button", { name: /^Base 3, G,/u }).click();
    await expect
      .poll(async () => (await latestContext(page))?.activeTarget)
      .toMatchObject({ end: 3, kind: "sequence-range", start: 3 });
    expect(
      await executeViewerCommand(page, {
        action: "select_sequence_range",
        end: 4,
        start: 4,
      }),
    ).toMatchObject({ applied: true });
    await expect(
      viewer.getByRole("button", { name: /^Base 4, T,/u }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await executeViewerCommand(page, {
        action: "set_sequence_view_options",
        orientation: "reverse-complement",
      }),
    ).toMatchObject({ applied: true });
    await expect(
      viewer.getByText(`${format.toUpperCase()} · Original read orientation`, {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await executeViewerCommand(page, {
        action: "query_viewer",
        request: { end: 2, start: 2, target: "chromatogram" },
      }),
    ).toMatchObject({
      applied: true,
      state: {
        query: {
          result: { baseCalls: [{ base: "C", coordinate: 2, peakSample: 5 }] },
        },
      },
    });
  });
}

test("a zero-gap threshold removes only genuinely gapped alignment columns", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-demo.aln-fasta");
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: /Edit copy/u }).click();
  await viewer.getByLabel("Minimum gap fraction").fill("0");
  await viewer.getByRole("button", { name: "Remove gappy columns" }).click();

  const rows = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { limit: 10, target: "rows" },
  });
  expect(rows).toMatchObject({
    applied: true,
    state: { query: { page: { totalCount: 3 } } },
  });
  const sequences = (
    (rows.state as { query?: { items?: Array<{ alignedSequence?: string }> } })
      ?.query?.items ?? []
  ).map(({ alignedSequence }) => alignedSequence);
  expect(sequences).toEqual(["ATGCTTAGG", "ATGCTTAGG", "ATGCTTAGG"]);
  await expect(viewer.getByRole("gridcell").first()).toBeVisible();
});

test("installed VCF exports retain selected coordinates, declared metadata, and sample genotypes", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  // Deliberate, fully synthetic VCF 4.3 conformance input; no patient data.
  const variants = [
    "##fileformat=VCFv4.3",
    '##INFO=<ID=DP,Number=1,Type=Integer,Description="Synthetic depth">',
    '##FORMAT=<ID=GT,Number=1,Type=String,Description="Synthetic genotype">',
    '##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Synthetic quality">',
    "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSYNTHETIC_A\tSYNTHETIC_B",
    "dna_demo\t2\tselected\tT\tC\t50\tPASS\tDP=11\tGT:GQ\t0/1:40\t1/1:30",
    "dna_demo\t9\tunselected\tG\tA\t60\tPASS\tDP=12\tGT:GQ\t0/0:50\t0/1:41",
    "other_contig\t3\tother-contig\tA\tG\t70\tPASS\tDP=13\tGT:GQ\t1/1:42\t0/0:43",
    "",
  ].join("\n");
  await loadLocalEvidenceTrack(page, {
    contents: variants,
    name: "synthetic-selected-genotypes.vcf",
  });
  await executeViewerCommand(page, {
    action: "select_sequence_range",
    end: 4,
    start: 1,
  });

  const selected = await exportPersistedArtifact(page, {
    format: "vcf",
    name: "synthetic-selected",
    scope: "selection",
  });
  expect(selected).toContain('##INFO=<ID=DP,Number=1,Type=Integer');
  expect(selected).toContain('##FORMAT=<ID=GT,Number=1,Type=String');
  expect(selected).toContain("FORMAT\tSYNTHETIC_A\tSYNTHETIC_B");
  expect(selected).toContain("\tselected\tT\tC\t50\tPASS\tDP=11\tGT:GQ\t0/1:40\t1/1:30");
  expect(selected).not.toContain("\tunselected\t");
  expect(selected).not.toContain("\tother-contig\t");

  const all = await exportPersistedArtifact(page, {
    format: "vcf",
    name: "synthetic-all",
    scope: "all",
  });
  expect(all).toContain("\tunselected\t");
  expect(all).toContain("\tother-contig\t");
  expect(all).toContain("\t0/1:40\t1/1:30");
});

test("installed BED12 import preserves spliced exon and coding boundaries", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  // Synthetic UCSC BED12 record: exons 1-5 and 9-12, intron 6-8.
  await loadLocalEvidenceTrack(page, {
    contents: "dna_demo\t0\t12\tSYNTHETIC_TX\t960\t+\t1\t11\t255,0,0\t2\t5,4,\t0,8,\n",
    name: "synthetic-spliced-transcript.bed",
  });
  await viewer.getByRole("button", { name: "Import into editable copy" }).click();
  await expect
    .poll(async () => (await latestContext(page))?.features?.items)
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "SYNTHETIC_TX",
          segments: [
            expect.objectContaining({ end: 5, start: 1 }),
            expect.objectContaining({ end: 12, start: 9 }),
          ],
        }),
      ]),
    );

  const gtf = await exportPersistedArtifact(page, {
    format: "gtf",
    name: "synthetic-spliced",
    scope: "all",
  });
  const codingLines = gtf
    .split("\n")
    .filter((line) => line.includes("\tCDS\t"));
  expect(codingLines).toEqual([
    expect.stringMatching(/^dna_demo\t[^\t]+\tCDS\t2\t5\t\.\t\+\t0\t/u),
    expect.stringMatching(/^dna_demo\t[^\t]+\tCDS\t9\t11\t\.\t\+\t2\t/u),
  ]);
  expect(gtf).not.toMatch(/\tCDS\t2\t11\t/u);
});

test("installed Stockholm round trips retain family, row, and secondary-structure annotations", async ({
  page,
}) => {
  // Explicit synthetic Stockholm 1.0 conformance fixture; no public/private data.
  const stockholm = [
    "# STOCKHOLM 1.0",
    "#=GF ID Synthetic_RNA_family",
    "#=GF DE Synthetic annotation round-trip fixture",
    "#=GS rna1 AC SYNTHETIC_ACCESSION_1",
    "#=GS rna1 DE Synthetic first RNA",
    "rna1 AC-G",
    "rna2 AU-G",
    "#=GR rna1 SS <<>>",
    "#=GC SS_cons <<>>",
    "#=GC RF xxxx",
    "//",
    "",
  ].join("\n");
  await mountTextFixture(page, {
    contents: stockholm,
    name: "synthetic-annotated-rna.sto",
  });
  const viewer = viewerFrame(page);
  await expect(
    viewer.getByLabel("Interactive multiple sequence alignment viewer"),
  ).toBeVisible();

  const exported = await exportPersistedArtifact(page, {
    format: "stockholm",
    name: "synthetic-annotations",
    scope: "all",
  });
  expect(exported).toContain("#=GF ID Synthetic_RNA_family");
  expect(exported).toContain("#=GF DE Synthetic annotation round-trip fixture");
  expect(exported).toContain("#=GS rna1 AC SYNTHETIC_ACCESSION_1");
  expect(exported).toContain("#=GR rna1 SS <<>>");
  expect(exported).toContain("#=GC SS_cons <<>>");
  expect(exported).toContain("#=GC RF xxxx");
});

for (const format of ["fastq", "genbank", "embl"] as const) {
  test(`installed ${format.toUpperCase()} all-record export preserves every source entry`, async ({
    page,
  }) => {
    if (format === "fastq") {
      await page.goto("/e2e/installed.html?fixture=small.fastq");
    } else {
      const fixture =
        format === "genbank" ? "minimal-genbank.gb" : "minimal-embl.embl";
      const response = await page.request.get(`/smoke-fixtures/${fixture}`);
      expect(response.ok()).toBe(true);
      const original = await response.text();
      // Duplicate only the repository's documented synthetic smoke fixture.
      const second = original.replaceAll("DEMOSEQ", "SYNTHETIC_TWO");
      await mountTextFixture(page, {
        contents: `${original.trimEnd()}\n${second.trimEnd()}\n`,
        name: `synthetic-multirecord.${format === "genbank" ? "gb" : "embl"}`,
      });
    }

    const viewer = viewerFrame(page);
    await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
    await expect
      .poll(async () => (await latestContext(page))?.displayedRecord?.recordCount)
      .toBe(2);

    const exported = await exportPersistedArtifact(page, {
      format,
      name: `synthetic-all-${format}`,
      scope: "all",
    });
    if (format === "fastq") {
      expect(exported).toContain("@read1\nACGTACGT\n+\nIIIIIIII");
      expect(exported).toContain("@read2\nTGCATGCA\n+\nHHHHHHHH");
    } else {
      expect(exported).toContain("DEMOSEQ");
      expect(exported).toContain("SYNTHETIC_TWO");
      expect(exported.match(/^\/\/$/gmu)).toHaveLength(2);
    }
  });
}

test("installed spreadsheet exports neutralize formulas without changing on-screen annotations", async ({
  page,
}) => {
  await page.goto("/e2e/installed.html?fixture=dna-single.fasta");
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await executeViewerCommand(page, {
    action: "select_sequence_range",
    end: 3,
    start: 1,
  });

  const biologicalLabel = '=HYPERLINK("https://example.invalid","synthetic")';
  await viewer.getByRole("button", { name: /Edit copy/u }).click();
  await viewer.getByLabel("Annotation label").fill(biologicalLabel);
  await viewer.getByRole("button", { name: "Add annotation" }).click();
  await expect
    .poll(async () => (await latestContext(page))?.features?.items)
    .toEqual(expect.arrayContaining([expect.objectContaining({ label: biologicalLabel })]));

  for (const format of ["csv", "tsv"] as const) {
    const exported = await exportPersistedArtifact(page, {
      format,
      name: `synthetic-safe-${format}`,
      scope: "all",
    });
    expect(exported).toContain("'=HYPERLINK");
    expect(exported).not.toMatch(/(?:^|[\t,])"?=HYPERLINK/imu);
  }
});

test("installed viewer pages all sequence records beyond its compact model-context prefix", async ({
  page,
}) => {
  // Synthetic variable-width records avoid falsely implying aligned FASTA.
  const records = Array.from({ length: 80 }, (_, index) => {
    const label = `synthetic_${String(index + 1).padStart(3, "0")}`;
    return `>${label}\n${"ACGT".repeat(2 + (index % 5))}`;
  }).join("\n");
  await mountTextFixture(page, {
    contents: `${records}\n`,
    name: "synthetic-paged-records.fasta",
  });
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
  await expect
    .poll(async () => (await latestContext(page))?.sequenceRecords)
    .toMatchObject({ materializedCount: 80, totalCount: 80, truncated: true });

  const first = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { limit: 17, target: "records" },
  });
  const firstQuery = (
    first.state as {
      query?: {
        items?: Array<{ sourceLabel?: string }>;
        nextCursor?: string;
        page?: { count: number; offset: number; totalCount: number };
      };
    }
  ).query;
  expect(firstQuery?.page).toEqual({ count: 17, offset: 0, totalCount: 80 });
  expect(firstQuery?.nextCursor).toEqual(expect.any(String));

  const second = await executeViewerCommand(page, {
    action: "query_viewer",
    request: { cursor: firstQuery?.nextCursor, limit: 17, target: "records" },
  });
  expect(second).toMatchObject({
    applied: true,
    state: { query: { page: { count: 17, offset: 17, totalCount: 80 } } },
  });

  const last = await executeViewerCommand(page, {
    action: "set_sequence_record",
    record: "synthetic_080",
  });
  expect(last).toMatchObject({ applied: true });
  await expect
    .poll(async () => (await latestContext(page))?.displayedRecord?.sourceLabel)
    .toBe("synthetic_080");
});

test("installed parser rejects mismatched repeated FASTQ identifiers", async ({
  page,
}) => {
  // Deliberately malformed synthetic negative control, never patient data.
  await mountTextFixture(page, {
    contents: "@synthetic_read\nACGT\n+different_read\nIIII\n",
    name: "synthetic-mismatched-identifiers.fastq",
  });
  const viewer = viewerFrame(page);
  await expect(viewer.getByText("Sequence could not be opened")).toBeVisible();
  await expect(viewer.getByText(/No biological sequence records were parsed/i)).toBeVisible();
  await expect(viewer.getByText("FASTQ overview")).toHaveCount(0);
  await expect(viewer.getByLabel("Wrapped sequence view")).toHaveCount(0);
});

test("real RefSeq prefix reports biologically mirrored reverse-strand BsaI cuts", async ({
  page,
}) => {
  // Immutable public RefSeq NC_005816.1 prefix, first 350 nucleotides:
  // biopython/biopython@c9489604d1d9607602ca9199a3852c1219ed330f,
  // Tests/GenBank/NC_005816.fna. No patient or proprietary sequence.
  const refseq = [
    "TGTAACGAACGGTGCAATAGTGATCCACACCCAACGCCTGAAATCAGATCCAGGGGGTAATCTGCTCTCC",
    "TGATTCAGGAGAGTTTATGGTCACTTTTGAGACAGTTATGGAAATTAAAATCCTGCACAAGCAGGGAATG",
    "AGTAGCCGGGCGATTGCCAGAGAACTGGGGATCTCCCGCAATACCGTTAAACGTTATTTGCAGGCAAAAT",
    "CTGAGCCGCCAAAATATACGCCGCGACCTGCTGTTGCTTCACTCCTGGATGAATACCGGGATTATATTCG",
    "TCAACGCATCGCCGATGCTCATCCTTACAAAATCCCGGCAACGGTAATCGCTCGCGAGATCAGAGACCAG",
  ].join("");
  await mountTextFixture(page, {
    contents: `>NC_005816.1 public RefSeq prefix\n${refseq}\n`,
    name: "public-refseq-nc-005816-prefix.fasta",
  });
  const viewer = viewerFrame(page);
  await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();

  const jobId = "b5a10000-0000-4000-8000-000000000204";
  const started = await executeViewerCommand(page, {
    action: "run_analysis",
    jobId,
    request: { analysis: "restriction-analysis", enzymes: ["BsaI"] },
  });
  expect(started).toMatchObject({ applied: true });
  await expect
    .poll(async () =>
      (await latestContext(page))?.workbench?.jobs?.find(
        ({ id }: { id: string }) => id === jobId,
      ),
    )
    .toMatchObject({
      result: {
        result: {
          sites: expect.arrayContaining([
            expect.objectContaining({
              cutBottom: 342,
              cutTop: 338,
              enzymeName: "BsaI",
              strand: "-",
            }),
          ]),
        },
      },
      status: "completed",
    });
});

test.describe("SHA-verified public scientific corpus", () => {
  test.skip(
    !hasVerifiedPublicCorpus,
    "The optional, provenance-documented public QA corpus is not installed.",
  );

  test("official VCF 4.3 round trips all 100 sample genotypes and filters its selected interval", async ({
    page,
  }) => {
    await mountPublicCorpusFixture(
      page,
      "qa-broad-hg19-chr1-first-1m.fasta",
      "e0a21377e2c49315518754aa5014196ec937bb82add44a0ba963b7ea53596178",
    );
    const viewer = viewerFrame(page);
    await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible({
      timeout: 15_000,
    });

    const vcfPath = verifiedPublicFixturePath(
      "spec-complex-valid-v43.vcf",
      "f0618cfb67afdd6fc8ee594217824f34cb40d26b277392876984aa0a5211eadf",
    );
    await viewer.getByRole("button", { name: /^Tracks/u }).click();
    await viewer
      .locator('input[type="file"][accept*=".vcf"]')
      .setInputFiles(vcfPath);
    await expect(
      viewer.getByText("spec-complex-valid-v43.vcf", { exact: true }),
    ).toBeVisible();
    await expect(viewer.getByRole("alert")).toHaveCount(0);
    expect(JSON.stringify(await latestContext(page))).not.toContain("HG00096");

    const variantQuery = await executeViewerCommand(page, {
      action: "query_viewer",
      request: {
        end: 10_583,
        limit: 5,
        reference: "1",
        start: 10_583,
        target: "variants",
      },
    });
    expect(variantQuery).toMatchObject({
      applied: true,
      state: { query: { page: { count: 1, totalCount: 1 } } },
    });
    const trackQuery = await executeViewerCommand(page, {
      action: "query_viewer",
      request: { limit: 5, target: "tracks" },
    });
    expect(trackQuery).toMatchObject({ applied: true });
    for (const modelVisibleResult of [variantQuery, trackQuery]) {
      expect(JSON.stringify(modelVisibleResult)).not.toContain("HG00096");
      expect(JSON.stringify(modelVisibleResult)).not.toContain(
        "0|0:0.200:-0.18,-0.47,-2.42",
      );
    }

    await executeViewerCommand(page, {
      action: "select_sequence_range",
      end: 10_583,
      start: 10_583,
    });
    const selected = await exportPersistedArtifact(page, {
      format: "vcf",
      name: "public-official-selected-variant",
      scope: "selection",
    });
    const selectedRows = selected
      .split("\n")
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toMatch(/^1\t10583\trs58108140\t/u);
    expect(selectedRows[0]?.split("\t")).toHaveLength(109);

    const selectedJson = await exportPersistedArtifact(page, {
      format: "json",
      name: "public-official-selected-variant",
      scope: "selection",
    });
    const selectedPayload = JSON.parse(selectedJson) as {
      document: {
        records: Array<{ length: number; sequence: string; sourceLabel: string }>;
      };
      scope: string;
      selection: { end: number; start: number };
      tracks: Array<{
        variants: Array<{
          id: string;
          position: number;
          reference: string;
          samples: Record<string, string>;
          sampleValues: Array<string>;
        }>;
        vcfHeader: { sampleNames: Array<string> };
      }>;
    };
    expect(selectedPayload).toMatchObject({
      document: {
        records: [{ length: 1, sequence: "G", sourceLabel: "1" }],
      },
      scope: "selection",
      selection: { end: 10_583, start: 10_583 },
    });
    expect(selectedPayload.tracks).toHaveLength(1);
    const selectedTrack = selectedPayload.tracks[0];
    expect(selectedTrack?.variants).toHaveLength(1);
    expect(selectedTrack?.variants[0]).toMatchObject({
      id: "rs58108140",
      position: 10_583,
      reference: "1",
      samples: { HG00096: "0|0:0.200:-0.18,-0.47,-2.42" },
    });
    expect(selectedTrack?.variants[0]?.sampleValues).toHaveLength(100);
    expect(selectedTrack?.vcfHeader.sampleNames).toHaveLength(100);
    expect(selectedJson).not.toContain("<1>");
    expect(selectedJson).not.toContain("rs189107123");
    expect(selectedJson).not.toContain("rs140337953");

    const all = await exportPersistedArtifact(page, {
      format: "vcf",
      name: "public-official-all-variants",
      scope: "all",
    });
    const lines = all.split("\n");
    const header = lines.find((line) => line.startsWith("#CHROM\t"));
    const variantRows = lines.filter(
      (line) => line.length > 0 && !line.startsWith("#"),
    );
    expect(header?.split("\t")).toHaveLength(109);
    expect(variantRows).toHaveLength(27);
    expect(variantRows.every((row) => row.split("\t").length === 109)).toBe(
      true,
    );
    expect(all).toContain("##FORMAT=<ID=GT,");
    expect(all).toContain("\tGT:DS:GL\t0|0:0.200:-0.18,-0.47,-2.42");
  });

  test("real UCSC chr22 BED12 preserves exon blocks and excludes introns", async ({
    page,
  }) => {
    await mountPublicCorpusFixture(
      page,
      "public-hg19-multichromosome-fragments.fa",
      "75e53584eff3373c6a6368d3918cf5561060796584ee769182fbd8e7bc1606b2",
    );
    const viewer = viewerFrame(page);
    await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
    expect(
      await executeViewerCommand(page, {
        action: "set_sequence_record",
        record: "chr22",
      }),
    ).toMatchObject({ applied: true });

    const bedPath = verifiedPublicFixturePath(
      "ucsc-bed12-track.bed",
      "2abf5cf6d9a42792af2cbdede04e63a869a6a4083e77272cd17ef26ca9211a2c",
    );
    await viewer.getByRole("button", { name: /^Tracks/u }).click();
    await viewer
      .locator('input[type="file"][accept*=".vcf"]')
      .setInputFiles(bedPath);
    await expect(
      viewer.getByText("ucsc-bed12-track.bed", { exact: true }),
    ).toBeVisible();
    await viewer.getByRole("button", { name: "Import into editable copy" }).click();
    await expect
      .poll(async () => (await latestContext(page))?.features?.items)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "mRNA1",
            segments: [
              expect.objectContaining({ end: 1567, start: 1001 }),
              expect.objectContaining({ end: 5000, start: 4513 }),
            ],
          }),
          expect.objectContaining({
            label: "mRNA2",
            segments: [
              expect.objectContaining({ end: 6000, start: 5602 }),
              expect.objectContaining({ end: 2433, start: 2001 }),
            ],
            strand: "-",
          }),
        ]),
      );

    await viewer.getByRole("button", { name: /Edit copy/u }).click();
    await expect(
      viewer.getByRole("button", { name: /^mRNA1 region.*2 exons$/u }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: /^mRNA2 region.*2 exons$/u }),
    ).toBeVisible();

    const gtf = await exportPersistedArtifact(page, {
      format: "gtf",
      name: "public-chr22-transcripts",
      scope: "all",
    });
    expect(gtf).toContain("\tregion\t1001\t1567\t");
    expect(gtf).toContain("\tregion\t4513\t5000\t");
    expect(gtf).toContain("\tCDS\t1201\t1567\t.\t+\t0\t");
    expect(gtf).toContain("\tCDS\t4513\t4900\t.\t+\t2\t");
    expect(gtf).toContain("\tCDS\t5602\t5960\t.\t-\t0\t");
    expect(gtf).toContain("\tCDS\t2301\t2433\t.\t-\t1\t");
    expect(gtf).not.toContain("\tregion\t1001\t5000\t");
    expect(gtf).not.toContain("\tCDS\t1201\t4900\t");
  });

  test("real Rfam Stockholm retains RNA classification and family secondary structure", async ({
    page,
  }) => {
    await mountPublicCorpusFixture(
      page,
      "rfam-rna-seed-1.sto",
      "a77480898aab5cc85b2c3eb332b05242c77aef0b9e4a29f5177f7d54adf6c035",
    );
    const viewer = viewerFrame(page);
    await expect(
      viewer.getByLabel("Interactive multiple sequence alignment viewer"),
    ).toBeVisible();
    await expect
      .poll(async () => (await latestContext(page))?.artifact)
      .toMatchObject({ format: "stockholm", moleculeType: "rna", rowCount: 3 });

    const exported = await exportPersistedArtifact(page, {
      format: "stockholm",
      name: "public-rfam-rna",
      scope: "all",
    });
    expect(exported).toMatch(/#=GF\s+ID\s+BTnc005/u);
    expect(exported).toMatch(/#=GF\s+AC\s+RF04178/u);
    expect(exported).toMatch(/#=GC\s+SS_cons\s+[^\n]+/u);
  });

  test("real unaligned HLA PIR collection opens as individually selectable proteins", async ({
    page,
  }) => {
    await mountPublicCorpusFixture(
      page,
      "pir-protein-family.pir",
      "6d9dbca1b1f27ab3b701f7b2d68fd97cbd273313bd13b76e11c402161a529d7d",
    );
    const viewer = viewerFrame(page);
    await expect(viewer.getByLabel("Wrapped sequence view")).toBeVisible();
    await expect
      .poll(async () => (await latestContext(page))?.displayedRecord)
      .toMatchObject({ molecule: "protein", recordCount: 6 });
    await expect(
      viewer.getByLabel("Interactive multiple sequence alignment viewer"),
    ).toHaveCount(0);
  });
});

test("all advertised text formats open through the installed production bundle", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  for (const fixture of [
    "dna-single.fasta",
    "small.fastq",
    "minimal-genbank.gb",
    "minimal-embl.embl",
    "dna-demo.aln-fasta",
    "protein-profile.a2m",
    "protein-profile.a3m",
    "clustal-consensus.aln",
    "rna-structure.sto",
    "interleaved.phy",
    "alignment.nex",
    "alignment.msf",
    "alignment.pir",
  ]) {
    await page.goto(
      `/e2e/installed.html?fixture=${encodeURIComponent(fixture)}`,
    );
    await expect(
      viewerFrame(page).locator(
        '[aria-label="Wrapped sequence view"], [aria-label="Interactive multiple sequence alignment viewer"]',
      ),
    ).toBeVisible();
  }
  expect(consoleErrors).toEqual([]);
});

async function readSequenceResiduePaints(
  page: Page,
  selector = ".bio-sequence-residue",
) {
  return await viewerFrame(page)
    .locator(selector)
    .evaluateAll((residues) => {
      const context = document.createElement("canvas").getContext("2d");
      if (context == null)
        throw new Error("Canvas color conversion is unavailable.");
      const rgba = (color: string): Array<number> => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const composite = (
        color: Array<number>,
        background: Array<number>,
      ): Array<number> =>
        color
          .slice(0, 3)
          .map((channel, index) =>
            Math.round(
              (channel * color[3]) / 255 +
                background[index] * (1 - color[3] / 255),
            ),
          );
      const luminance = (rgb: Array<number>): number => {
        const channels = rgb.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const contrast = (
        foreground: Array<number>,
        background: Array<number>,
      ): number => {
        const values = [luminance(foreground), luminance(background)];
        return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      };
      return residues.map((residue) => {
        const style = getComputedStyle(residue);
        const ancestors: Array<Element> = [];
        for (
          let ancestor: Element | null = residue;
          ancestor != null;
          ancestor = ancestor.parentElement
        )
          ancestors.unshift(ancestor);
        const background = ancestors.reduce(
          (paint, element) =>
            composite(rgba(getComputedStyle(element).backgroundColor), paint),
          [255, 255, 255],
        );
        const foreground = composite(rgba(style.color), background);
        const shadowColors = (
          style.boxShadow.match(/rgba?\([^)]*\)|color\([^)]*\)/gu) ?? []
        )
          .map(rgba)
          .filter((color) => color[3] > 0);
        return {
          symbol: residue.textContent?.trim(),
          foreground,
          background,
          foregroundLuminance: luminance(foreground),
          backgroundLuminance: luminance(background),
          contrast: contrast(foreground, background),
          shadowContrasts: shadowColors.map((color) =>
            contrast(composite(color, background), background),
          ),
          outlineWidth:
            style.outlineStyle === "none"
              ? 0
              : Number.parseFloat(style.outlineWidth),
          outlineContrast: contrast(
            composite(rgba(style.outlineColor), background),
            background,
          ),
        };
      });
    });
}

async function requiredBoundingBox(locator: Locator) {
  const bounds = await locator.boundingBox({ timeout: 15_000 });
  if (bounds == null) throw new Error(`No rendered bounds for ${locator}.`);
  return bounds;
}

async function expectHorizontalAlignment(
  overlay: Locator,
  residue: Locator,
): Promise<void> {
  const overlayBounds = await requiredBoundingBox(overlay);
  const residueBounds = await requiredBoundingBox(residue);
  expect(Math.abs(overlayBounds.x - residueBounds.x)).toBeLessThan(0.75);
  expect(Math.abs(overlayBounds.width - residueBounds.width)).toBeLessThan(
    0.75,
  );
}

async function mountTextFixture(
  page: Page,
  { contents, name }: { contents: string; name: string },
): Promise<void> {
  await page.route(
    `**/smoke-fixtures/${encodeURIComponent(name)}`,
    async (route) => {
      await route.fulfill({
        body: contents,
        contentType: "text/plain; charset=utf-8",
        status: 200,
      });
    },
  );
  await page.goto(
    `/e2e/installed.html?fixture=${encodeURIComponent(name)}`,
  );
}

async function mountPublicCorpusFixture(
  page: Page,
  name: string,
  expectedSha256: string,
): Promise<void> {
  verifiedPublicFixturePath(name, expectedSha256);
  const source = `output/playwright/real-public-corpus/${name}`;
  await page.goto(
    `/e2e/installed.html?name=${encodeURIComponent(name)}&source=${encodeURIComponent(source)}`,
  );
}

function verifiedPublicFixturePath(name: string, expectedSha256: string): string {
  const fixturePath = path.join(publicCorpusDirectory, name);
  const actualSha256 = createHash("sha256")
    .update(readFileSync(fixturePath))
    .digest("hex");
  expect(actualSha256, `${name} no longer matches its public provenance.`).toBe(
    expectedSha256,
  );
  return fixturePath;
}

async function loadLocalEvidenceTrack(
  page: Page,
  { contents, name }: { contents: string; name: string },
): Promise<void> {
  const viewer = viewerFrame(page);
  await viewer.getByRole("button", { name: /^Tracks/u }).click();
  await viewer.locator('input[type="file"][accept*=".vcf"]').setInputFiles({
    buffer: Buffer.from(contents, "utf8"),
    mimeType: "text/plain",
    name,
  });
  await expect(viewer.getByText(name, { exact: true })).toBeVisible();
}

async function executeViewerCommand(
  page: Page,
  command: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return await page.evaluate(
    async (queued) => await window.enqueueViewerCommand(queued),
    command,
  );
}

async function saveViewerSession(page: Page, name: string): Promise<string> {
  const saved = await executeViewerCommand(page, {
    action: "save_session",
    name,
  });
  expect(saved).toMatchObject({
    applied: true,
    state: {
      session: {
        savedSessionId: expect.any(String),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    },
  });
  const savedSession = (saved.state as { session: { savedSessionId: string } })
    .session;
  const session = await page.evaluate(
    (savedSessionId) => window.readSavedSession(savedSessionId),
    savedSession.savedSessionId,
  );
  if (session == null)
    throw new Error("The host did not retain the saved session.");
  return session;
}

async function exportPersistedArtifact(
  page: Page,
  {
    format,
    name,
    scope,
  }: { format: string; name: string; scope: "all" | "selection" | "visible" },
): Promise<string> {
  const exported = await executeViewerCommand(page, {
    action: "export_artifact",
    format,
    name,
    scope,
  });
  expect(exported).toMatchObject({
    applied: true,
    state: {
      artifact: {
        format,
        resourceUri: expect.stringMatching(/^viewer-artifact:/u),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    },
  });

  return await page.evaluate((expectedFormat) => {
    const request = [...window.__toolRequests].reverse().find(
      ({ arguments: args, name: toolName }) =>
        toolName === "sequence.persist_workbench_payload" &&
        args.kind === "artifact" &&
        args.format === expectedFormat,
    );
    if (request == null || typeof request.arguments.dataBase64 !== "string") {
      throw new Error(`No persisted ${expectedFormat} artifact was captured.`);
    }
    const bytes = Uint8Array.from(atob(request.arguments.dataBase64), (value) =>
      value.charCodeAt(0),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }, format);
}

function viewerFrame(page: Page) {
  return page.frameLocator("#viewer");
}

async function latestContext(
  page: Page,
): Promise<Record<string, any> | undefined> {
  return await page.evaluate(
    () => window.__viewerContexts.at(-1)?.structuredContent,
  );
}

async function latestContextEnvelope(page: Page) {
  const context = await page.evaluate(() => window.__viewerContexts.at(-1));
  if (context == null) throw new Error("Viewer did not publish model context.");
  return context;
}

declare global {
  interface Window {
    __completionAttempts: number;
    __messages: Array<unknown>;
    __maxToolsCallBytes: number;
    __persistenceToolCalls: Array<string>;
    __resourceRequests: Array<string>;
    __toolRequests: Array<{
      arguments: Record<string, unknown>;
      name: string;
    }>;
    __viewerContexts: Array<{
      structuredContent: Record<string, any>;
      text: string;
    }>;
    enqueueViewerCommand: (
      command: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    openViewerFixture: (name: string) => void;
    readSavedSession: (id: string) => string | undefined;
    readWorkspaceArtifact: (workspacePath: string) => string | undefined;
    readWorkspaceSession: (workspacePath: string) =>
      | {
          mode: "alignment" | "sequence";
          payload: string;
          workspacePath: string;
        }
      | undefined;
  }
}
