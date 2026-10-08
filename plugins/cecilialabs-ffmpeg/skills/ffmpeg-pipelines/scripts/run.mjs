#!/usr/bin/env node

import {
  contextPlan,
  enumValue,
  executeSkillScript,
  objectInput,
  optionalString,
  reportResult,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import {
  executePipeline,
  inspectPipeline,
  loadPipelineFile,
  parsePipelineText,
  pipelineDocumentSchema,
} from "../../../dist/pipeline/index.js";
import { ToolkitRuntimeError } from "../../../dist/core/errors.js";

const actions = ["validate", "print", "run"];

function loadedPipeline(input, request) {
  const cwd = request.cwd ?? process.cwd();
  const file = optionalString(input, "file") ?? optionalString(input, "pipeline");
  if (file !== undefined) return loadPipelineFile(file, cwd);

  const text = optionalString(input, "text");
  if (text !== undefined) {
    return {
      file: "<inline>",
      baseDirectory: cwd,
      document: parsePipelineText(text, "<inline>"),
    };
  }

  if (input.document !== undefined) {
    return {
      file: "<inline>",
      baseDirectory: cwd,
      document: pipelineDocumentSchema.parse(input.document),
    };
  }

  throw new ToolkitRuntimeError(
    "E_USAGE_INVALID_ARGUMENT",
    "input.file, input.pipeline, input.text, or input.document is required",
  );
}

await executeSkillScript("pipeline.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "run";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-pipelines/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const loaded = await loadedPipeline(input, request);
  const options = runtimeOptions(input, request, context, signal);
  if (action === "validate" || action === "print") {
    const report = inspectPipeline(
      loaded,
      action === "validate" ? "pipeline.validate" : "pipeline.print",
      optionalString(input, "output"),
    );
    return reportResult(input, report, [
      action === "print"
        ? "Review the normalized steps before executing the pipeline."
        : "Use action=print for the expanded plan or action=run with dryRun=true before mutation.",
    ]);
  }

  const report = await executePipeline(loaded, options);
  return reportResult(input, report, [
    "Only report the final artifact after the pipeline report includes output media metadata.",
  ]);
});
