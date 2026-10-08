import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.SEQUENCE_VIEWER_E2E_PORT ?? "43128");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("SEQUENCE_VIEWER_E2E_PORT must be a valid TCP port.");
}
const qualificationOutputRoot =
  process.env.SEQUENCE_VIEWER_QUALIFICATION_OUTPUT_ROOT?.trim();
if (
  qualificationOutputRoot != null &&
  qualificationOutputRoot !== "" &&
  !path.isAbsolute(qualificationOutputRoot)
) {
  throw new Error(
    "SEQUENCE_VIEWER_QUALIFICATION_OUTPUT_ROOT must be an absolute directory.",
  );
}
const qualification =
  qualificationOutputRoot != null && qualificationOutputRoot !== "";
const skipBuild = process.env.SEQUENCE_VIEWER_E2E_SKIP_BUILD === "1";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  globalTimeout: qualification ? 45 * 60_000 : 15 * 60_000,
  reporter: "line",
  // Keep browser processes and the qualification's shared workspace bounded.
  workers: 1,
  ...(qualification
    ? {
        outputDir: path.join(qualificationOutputRoot, "test-results"),
      }
    : {}),
  testDir: "./e2e",
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chromium",
    headless: true,
    launchOptions: {
      args: [
        "--disable-gpu",
        "--disable-gpu-compositing",
        "--disable-accelerated-video-decode",
        "--disable-accelerated-video-encode",
      ],
    },
    screenshot: "off",
    trace: qualification
      ? { mode: "on", screenshots: false, snapshots: false, sources: false }
      : "off",
    video: "off",
  },
  webServer: {
    command: `${skipBuild ? "" : "pnpm build && "}node e2e/build-harness.mjs && node e2e/installed-host-server.mjs`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
