#!/usr/bin/env node

import { inspectEnvironmentReadiness } from "../../../dist/environment/readiness.js";
import { readSkillScriptRequest } from "../../../dist/skill-runtime/request.js";
import { runSkillScript } from "../../../dist/skill-runtime/runner.js";
import { ToolkitRuntimeError } from "../../../dist/core/errors.js";

function objectInput(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "input must be a JSON object");
  }
  return value;
}

function optionalString(value, name) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0)
    throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", `${name} must be a non-empty string`);
  return value;
}

function envelopeStatus(report) {
  if (report.status === "planned") return "planned";
  if (report.status === "ready") return "completed";
  return "needs-input";
}

let request = {};
let requestError;
try {
  request = await readSkillScriptRequest();
} catch (error) {
  requestError = error;
}

process.exitCode = await runSkillScript({
  operation: "environment.check",
  request,
  handler: async ({ request: current, context, signal }) => {
    if (requestError !== undefined) throw requestError;
    const raw = objectInput(current.input);
    const cwd = raw.cwd ?? current.cwd;
    const input = {
      ...(optionalString(cwd, "cwd") !== undefined ? { cwd } : {}),
      ...(optionalString(raw.outputPath, "outputPath") !== undefined
        ? { outputPath: raw.outputPath }
        : {}),
      ...(optionalString(raw.ffmpegPath, "ffmpegPath") !== undefined
        ? { ffmpegPath: raw.ffmpegPath }
        : {}),
      ...(optionalString(raw.ffprobePath, "ffprobePath") !== undefined
        ? { ffprobePath: raw.ffprobePath }
        : {}),
      ...(optionalString(raw.toolkitPath, "toolkitPath") !== undefined
        ? { toolkitPath: raw.toolkitPath }
        : {}),
    };
    const report = await inspectEnvironmentReadiness({
      context: context.name,
      ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
      ...(input.outputPath !== undefined ? { outputPath: input.outputPath } : {}),
      ...(input.ffmpegPath !== undefined ? { ffmpegPath: input.ffmpegPath } : {}),
      ...(input.ffprobePath !== undefined ? { ffprobePath: input.ffprobePath } : {}),
      ...(input.toolkitPath !== undefined ? { toolkitPath: input.toolkitPath } : {}),
      dryRun: current.dryRun,
      signal,
    });
    return {
      status: envelopeStatus(report),
      input,
      output: report,
      warnings: report.warnings,
      next: report.next,
    };
  },
});
