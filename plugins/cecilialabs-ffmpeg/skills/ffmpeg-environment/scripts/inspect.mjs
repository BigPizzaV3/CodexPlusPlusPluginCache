#!/usr/bin/env node

import {
  contextPlan,
  enumValue,
  executeSkillScript,
  inputPath,
  objectInput,
  optionalString,
  reportResult,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import {
  inspectEnvironmentCapabilities,
  inspectEnvironmentVersions,
  inspectDoctor,
} from "../../../dist/environment/index.js";
import { probeMedia } from "../../../dist/media/probe.js";

const actions = ["doctor", "capabilities", "version", "probe"];

await executeSkillScript("environment.inspect", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "doctor";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-environment/scripts/inspect.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  let report;
  if (action === "doctor") {
    report = await inspectDoctor(options);
  } else if (action === "capabilities") {
    report = await inspectEnvironmentCapabilities(options);
  } else if (action === "version") {
    report = await inspectEnvironmentVersions(options);
  } else {
    report = await probeMedia(inputPath(input, "input", request), {
      ...options,
      ...(optionalString(input, "ffprobePath") !== undefined
        ? { ffprobePath: optionalString(input, "ffprobePath") }
        : {}),
    });
  }
  return reportResult(input, report, [
    "Use the matching domain Skill after the required capability or media metadata is confirmed.",
  ]);
});
