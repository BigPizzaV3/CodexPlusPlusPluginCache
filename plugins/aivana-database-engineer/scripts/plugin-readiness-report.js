#!/usr/bin/env node

const { dispatch } = require("../runtime/orchestrator");

async function main() {
  const engine = process.argv[2] || "postgres";
  const environment = process.argv[3] || "production";
  const strict = process.argv.includes("--strict");
  const report = await dispatch("release_readiness_report", { engine, environment }, "release-readiness-script");
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = strict && !report.ready ? 1 : 0;
}

main().catch((error) => {
  console.error(JSON.stringify({ error: "readiness_report_failed", message: error.message }, null, 2));
  process.exitCode = 1;
});
