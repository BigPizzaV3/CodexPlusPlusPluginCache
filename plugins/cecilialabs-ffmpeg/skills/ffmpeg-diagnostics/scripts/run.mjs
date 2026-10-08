#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  contextPlan,
  enumValue,
  executeSkillScript,
  inputPath,
  objectInput,
  optionalBoolean,
  optionalNumber,
  optionalString,
  reportResult,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import { diagnoseMedia, normalizeMedia, repairTimestamps } from "../../../dist/diagnostics/index.js";

const actions = ["diagnose", "repair-timestamps", "repair-normalize"];
const repairModes = ["remux", "reencode"];

await executeSkillScript("diagnostics.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "diagnose";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-diagnostics/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  let report;
  if (action === "diagnose") {
    const log = optionalString(input, "log");
    const logText = log === undefined ? undefined : await readFile(inputPath({ input: log }, "input", request), "utf8");
    report = await diagnoseMedia(inputPath(input, "input", request), {
      ...options,
      ...(optionalBoolean(input, "deep") !== undefined ? { deep: optionalBoolean(input, "deep") } : {}),
      ...(optionalNumber(input, "freezeNoiseDb") !== undefined ? { freezeNoiseDb: optionalNumber(input, "freezeNoiseDb") } : {}),
      ...(optionalNumber(input, "freezeDuration") !== undefined ? { freezeDuration: optionalNumber(input, "freezeDuration") } : {}),
      ...(logText !== undefined ? { logText } : {}),
    });
  } else if (action === "repair-timestamps") {
    const mode = enumValue(input, "mode", repairModes);
    report = await repairTimestamps(inputPath(input, "input", request), {
      ...options,
      ...(mode !== undefined ? { mode } : {}),
      ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
    });
  } else {
    report = await normalizeMedia(inputPath(input, "input", request), {
      ...options,
      ...(optionalNumber(input, "width") !== undefined ? { width: optionalNumber(input, "width") } : {}),
      ...(optionalNumber(input, "height") !== undefined ? { height: optionalNumber(input, "height") } : {}),
      ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
      ...(optionalString(input, "pixelFormat") !== undefined ? { pixelFormat: optionalString(input, "pixelFormat") } : {}),
      ...(optionalNumber(input, "sampleRate") !== undefined ? { sampleRate: optionalNumber(input, "sampleRate") } : {}),
      ...(optionalNumber(input, "channels") !== undefined ? { channels: optionalNumber(input, "channels") } : {}),
    });
  }
  return reportResult(input, report, [
    action === "diagnose"
      ? "Choose a repair only from observed diagnostic issues, then re-run diagnosis on the output."
      : "Probe the repaired output and compare before/after diagnostic issues before declaring success.",
  ]);
});
