#!/usr/bin/env node

import {
  contextPlan,
  enumValue,
  executeSkillScript,
  inputPath,
  objectInput,
  optionalBoolean,
  optionalNumber,
  optionalString,
  optionalStringArray,
  reportResult,
  requiredEnum,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import { convertBatch, convertFile } from "../../../dist/conversion/index.js";

const actions = ["file", "batch"];
const formats = ["mp4", "webm", "gif", "webp", "png", "jpeg", "wav", "mp3", "aac", "m4a", "flac", "opus", "ogg"];
const fits = ["contain", "cover", "stretch"];
const existingModes = ["error", "skip", "replace"];

function tuning(input) {
  return {
    ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
    ...(optionalNumber(input, "width") !== undefined ? { width: optionalNumber(input, "width") } : {}),
    ...(optionalNumber(input, "height") !== undefined ? { height: optionalNumber(input, "height") } : {}),
    ...(enumValue(input, "fit", fits) !== undefined ? { fit: enumValue(input, "fit", fits) } : {}),
    ...(optionalString(input, "background") !== undefined ? { background: optionalString(input, "background") } : {}),
    ...(optionalNumber(input, "quality") !== undefined ? { quality: optionalNumber(input, "quality") } : {}),
    ...(optionalNumber(input, "maxColors") !== undefined ? { maxColors: optionalNumber(input, "maxColors") } : {}),
    ...(optionalNumber(input, "loop") !== undefined ? { loop: optionalNumber(input, "loop") } : {}),
    ...(optionalString(input, "audioBitrate") !== undefined ? { audioBitrate: optionalString(input, "audioBitrate") } : {}),
    ...(optionalNumber(input, "sampleRate") !== undefined ? { sampleRate: optionalNumber(input, "sampleRate") } : {}),
    ...(optionalNumber(input, "channels") !== undefined ? { channels: optionalNumber(input, "channels") } : {}),
  };
}

await executeSkillScript("conversion.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "file";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-conversion/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  const to = requiredEnum(input, "to", formats);
  let report;
  if (action === "file") {
    const from = enumValue(input, "from", formats);
    report = await convertFile(inputPath(input, "input", request), {
      ...options,
      to,
      ...(from !== undefined ? { from } : {}),
      ...tuning(input),
    });
  } else {
    const from = requiredEnum(input, "from", formats);
    const recursive = optionalBoolean(input, "recursive");
    const failFast = optionalBoolean(input, "failFast");
    const preserveHierarchy = optionalBoolean(input, "preserveHierarchy");
    const existing = enumValue(input, "existing", existingModes);
    const includes = optionalStringArray(input, "includes");
    const excludes = optionalStringArray(input, "excludes");
    const outputDirectory = optionalString(input, "outputDirectory");
    const parallelism = optionalNumber(input, "parallelism");
    report = await convertBatch(inputPath(input, "directory", request), {
      ...options,
      from,
      to,
      ...(recursive !== undefined ? { recursive } : {}),
      ...(failFast !== undefined ? { failFast } : {}),
      ...(preserveHierarchy !== undefined ? { preserveHierarchy } : {}),
      ...(existing !== undefined ? { existing } : {}),
      ...(includes !== undefined ? { includes } : {}),
      ...(excludes !== undefined ? { excludes } : {}),
      ...(outputDirectory !== undefined ? { outputDirectory } : {}),
      ...(parallelism !== undefined ? { parallelism } : {}),
      ...tuning(input),
    });
  }
  return reportResult(input, report, [
    "For batches, distinguish discovered, succeeded, failed, and skipped items before reporting completion.",
  ]);
});
