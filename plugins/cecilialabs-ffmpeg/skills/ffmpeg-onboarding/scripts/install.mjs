#!/usr/bin/env node

import { inspectEnvironmentReadiness } from "../../../dist/environment/readiness.js";
import { installCommand, installToolkit } from "../../../dist/environment/install.js";
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

function scope(value) {
  if (value === undefined) return "npm-exec";
  if (value === "global" || value === "local" || value === "npm-exec") return value;
  throw new ToolkitRuntimeError(
    "E_USAGE_INVALID_ARGUMENT",
    "scope must be global, local, or npm-exec",
  );
}

let request = {};
let requestError;
try {
  request = await readSkillScriptRequest();
} catch (error) {
  requestError = error;
}

process.exitCode = await runSkillScript({
  operation: "onboarding.install",
  request,
  handler: async ({ request: current, context, signal }) => {
    if (requestError !== undefined) throw requestError;
    const raw = objectInput(current.input);
    const selectedScope = scope(raw.scope);
    const cwd = raw.cwd ?? current.cwd ?? process.cwd();
    if (typeof cwd !== "string" || cwd.length === 0)
      throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "cwd must be a non-empty string");
    const apply = raw.apply === true;
    const authorized = raw.authorized === true;
    const install = await installToolkit({
      scope: selectedScope,
      cwd,
      context: context.name,
      authorized: apply && authorized && context.canInstallDependencies,
      dryRun: current.dryRun,
      signal,
    });
    const readiness =
      install.status === "completed"
        ? await inspectEnvironmentReadiness({ context: context.name, cwd, signal })
        : undefined;
    const next =
      install.status === "planned"
        ? [
            "Set input.apply=true and input.authorized=true to execute the explicit install.",
            installCommand(install.plan),
          ]
        : [
            "Run the environment.check script again if FFmpeg or FFprobe was also installed separately.",
          ];
    return {
      status: install.status === "planned" ? "needs-authorization" : "completed",
      input: { scope: selectedScope, cwd, apply, authorized },
      output: { install, ...(readiness !== undefined ? { readiness } : {}) },
      artifacts: [{ kind: "command", description: installCommand(install.plan), verified: false }],
      next,
    };
  },
});
