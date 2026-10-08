#!/usr/bin/env node

import {
  contextPlan,
  enumValue,
  executeSkillScript,
  inputPath,
  objectInput,
  optionalNumber,
  optionalString,
  reportResult,
  requiredNumber,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import {
  changeVideoSpeed,
  createVideoFromImage,
  restoreVideo,
  trimVideoEnd,
  trimVideoRange,
  trimVideoStart,
  upscaleVideo,
} from "../../../dist/video/index.js";

const actions = ["trim-start", "trim-end", "trim", "speed", "from-image", "restore", "upscale"];
const modes = ["copy", "accurate", "auto"];
const audioModes = ["sync", "drop"];
const fits = ["contain", "cover", "stretch"];
const formats = ["mp4", "webm"];
const profiles = ["balanced", "aggressive"];

function imageOptions(input) {
  return {
    ...(optionalNumber(input, "duration") !== undefined ? { duration: optionalNumber(input, "duration") } : {}),
    ...(optionalNumber(input, "width") !== undefined ? { width: optionalNumber(input, "width") } : {}),
    ...(optionalNumber(input, "height") !== undefined ? { height: optionalNumber(input, "height") } : {}),
    ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
    ...(optionalString(input, "pixelFormat") !== undefined ? { pixelFormat: optionalString(input, "pixelFormat") } : {}),
    ...(enumValue(input, "fit", fits) !== undefined ? { fit: enumValue(input, "fit", fits) } : {}),
    ...(optionalString(input, "background") !== undefined ? { background: optionalString(input, "background") } : {}),
    ...(enumValue(input, "to", formats) !== undefined ? { to: enumValue(input, "to", formats) } : {}),
  };
}

function restoreOptions(input) {
  return {
    width: requiredNumber(input, "width"),
    height: requiredNumber(input, "height"),
    ...(enumValue(input, "profile", profiles) !== undefined ? { profile: enumValue(input, "profile", profiles) } : {}),
    ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
    ...(optionalNumber(input, "crf") !== undefined ? { crf: optionalNumber(input, "crf") } : {}),
    ...(optionalString(input, "preset") !== undefined ? { preset: optionalString(input, "preset") } : {}),
    ...(enumValue(input, "fit", fits) !== undefined ? { fit: enumValue(input, "fit", fits) } : {}),
    ...(optionalString(input, "background") !== undefined ? { background: optionalString(input, "background") } : {}),
    ...(enumValue(input, "to", formats) !== undefined ? { to: enumValue(input, "to", formats) } : {}),
  };
}

await executeSkillScript("video.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "trim";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-video-editing/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  let report;
  if (action === "from-image") {
    report = await createVideoFromImage(inputPath(input, "input", request), {
      ...options,
      ...imageOptions(input),
    });
  } else if (action === "restore" || action === "upscale") {
    const requestOptions = { ...options, ...restoreOptions(input) };
    report = action === "restore"
      ? await restoreVideo(inputPath(input, "input", request), requestOptions)
      : await upscaleVideo(inputPath(input, "input", request), requestOptions);
  } else if (action === "speed") {
    const audio = enumValue(input, "audio", audioModes);
    report = await changeVideoSpeed(inputPath(input, "input", request), {
      ...options,
      factor: requiredNumber(input, "factor"),
      ...(audio !== undefined ? { audio } : {}),
    });
  } else if (action === "trim-start") {
    const mode = enumValue(input, "mode", modes);
    report = await trimVideoStart(inputPath(input, "input", request), {
      ...options,
      seconds: requiredNumber(input, "seconds"),
      ...(mode !== undefined ? { mode } : {}),
    });
  } else if (action === "trim-end") {
    const mode = enumValue(input, "mode", modes);
    report = await trimVideoEnd(inputPath(input, "input", request), {
      ...options,
      seconds: requiredNumber(input, "seconds"),
      ...(mode !== undefined ? { mode } : {}),
    });
  } else {
    const mode = enumValue(input, "mode", modes);
    const start = optionalNumber(input, "start");
    const end = optionalNumber(input, "end");
    const duration = optionalNumber(input, "duration");
    report = await trimVideoRange(inputPath(input, "input", request), {
      ...options,
      ...(start !== undefined ? { start } : {}),
      ...(end !== undefined ? { end } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(mode !== undefined ? { mode } : {}),
    });
  }
  return reportResult(input, report, [
    "After execution, use the report outputMedia metadata as the source of truth for the produced video.",
  ]);
});
