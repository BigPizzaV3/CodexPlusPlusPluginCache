#!/usr/bin/env node

const { dispatch } = require("./orchestrator");
const fs = require("node:fs");

function usage() {
  console.error("Usage: node runTool.js <tool_name> <json_args|-> (use - for JSON on stdin)");
  console.error("Example: node runTool.js list_databases '{\"engine\":\"postgres\"}'");
  process.exitCode = 2;
}

async function main() {
  const [, , tool, argsJson] = process.argv;
  if (!tool || !argsJson) {
    usage();
    return;
  }

  let args;
  try {
    args = JSON.parse(argsJson === "-" ? fs.readFileSync(0, "utf8") : argsJson);
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new Error("Arguments must be a JSON object");
    }
  } catch (error) {
    console.error("Invalid JSON for args:", error.message);
    process.exitCode = 2;
    return;
  }

  try {
    const result = await dispatch(tool, args, process.env.CODERUN_ACTOR || "codex-user");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Tool execution failed:", error.message || String(error));
    process.exitCode = 1;
  }
}

main();
