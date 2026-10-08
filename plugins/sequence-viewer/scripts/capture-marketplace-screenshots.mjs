import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl =
  process.env.SEQUENCE_VIEWER_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:43128";
const outputDirectory = path.resolve("assets");
const browser = await chromium.launch({
  args: [
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-accelerated-video-decode",
    "--disable-accelerated-video-encode",
  ],
  channel: "chromium",
  headless: true,
  timeout: 30_000,
});

try {
  const page = await browser.newPage({
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: { height: 900, width: 1440 },
  });
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  await page.goto(`${baseUrl}/e2e/installed.html?fixture=circular-plasmid.gb`);
  let viewer = page.frameLocator("#viewer");
  await viewer.getByLabel("Sequence overview and navigation").waitFor();
  await viewer.getByRole("button", { name: "Circular" }).click();
  await viewer.getByRole("button", { name: "Analyze" }).click();
  await page.locator("#viewer").screenshot({
    animations: "disabled",
    path: path.join(outputDirectory, "sequence-workbench.png"),
  });

  await page.goto(`${baseUrl}/e2e/installed.html?fixture=dna-demo.aln-fasta`);
  viewer = page.frameLocator("#viewer");
  await viewer
    .getByLabel("Interactive multiple sequence alignment viewer")
    .waitFor();
  await viewer.getByRole("button", { name: "Analyze" }).click();
  await viewer.getByRole("button", { name: "Neighbor-joining tree" }).click();
  await viewer.getByLabel("Graphical guide tree").waitFor();
  await page.locator("#viewer").screenshot({
    animations: "disabled",
    path: path.join(outputDirectory, "alignment-workbench.png"),
  });
} finally {
  await browser.close();
}
