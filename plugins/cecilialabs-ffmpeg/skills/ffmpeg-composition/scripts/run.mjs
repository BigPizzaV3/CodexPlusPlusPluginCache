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
  requiredStringArray,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import { concatMedia, createSlideshow, transitionMedia } from "../../../dist/composition/index.js";

const actions = ["concat", "transition", "slideshow"];
const transitions = ["fade", "fadeblack", "fadewhite", "wipeleft", "wiperight", "slideup", "slidedown", "circleopen", "circleclose", "dissolve", "pixelize", "distance", "zoomin", "zoomout"];
const audioModes = ["auto", "drop", "preserve"];
const videoFormats = ["mp4", "webm"];
const slideshowFormats = ["mp4", "webm", "gif", "webp"];
const fits = ["contain", "cover", "stretch"];
const styles = ["vertical-stack", "sequence"];
const directions = ["up", "down"];

function normalization(input) {
  return {
    ...(optionalNumber(input, "width") !== undefined ? { width: optionalNumber(input, "width") } : {}),
    ...(optionalNumber(input, "height") !== undefined ? { height: optionalNumber(input, "height") } : {}),
    ...(optionalNumber(input, "fps") !== undefined ? { fps: optionalNumber(input, "fps") } : {}),
    ...(optionalString(input, "pixelFormat") !== undefined ? { pixelFormat: optionalString(input, "pixelFormat") } : {}),
    ...(enumValue(input, "fit", fits) !== undefined ? { fit: enumValue(input, "fit", fits) } : {}),
    ...(optionalString(input, "background") !== undefined ? { background: optionalString(input, "background") } : {}),
  };
}

await executeSkillScript("composition.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "concat";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-composition/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  let report;
  if (action === "concat") {
    const transition = enumValue(input, "transition", ["none", ...transitions]);
    const audio = enumValue(input, "audio", audioModes);
    report = await concatMedia(requiredStringArray(input, "inputs").map((value) => inputPath({ input: value }, "input", request)), {
      ...options,
      ...(transition !== undefined ? { transition } : {}),
      ...(audio !== undefined ? { audio } : {}),
      ...(optionalNumber(input, "transitionDuration") !== undefined ? { transitionDuration: optionalNumber(input, "transitionDuration") } : {}),
      ...(enumValue(input, "to", videoFormats) !== undefined ? { to: enumValue(input, "to", videoFormats) } : {}),
      ...normalization(input),
    });
  } else if (action === "transition") {
    const audio = enumValue(input, "audio", audioModes);
    report = await transitionMedia(inputPath(input, "left", request), inputPath(input, "right", request), {
      ...options,
      ...(enumValue(input, "transition", transitions) !== undefined ? { transition: enumValue(input, "transition", transitions) } : {}),
      ...(audio !== undefined ? { audio } : {}),
      ...(optionalNumber(input, "duration") !== undefined ? { duration: optionalNumber(input, "duration") } : {}),
      ...(optionalNumber(input, "offset") !== undefined ? { offset: optionalNumber(input, "offset") } : {}),
      ...(enumValue(input, "to", videoFormats) !== undefined ? { to: enumValue(input, "to", videoFormats) } : {}),
      ...normalization(input),
    });
  } else {
    const includes = optionalStringArray(input, "includes");
    const excludes = optionalStringArray(input, "excludes");
    const recursive = optionalBoolean(input, "recursive");
    const includeIntro = optionalBoolean(input, "includeIntro");
    const includeOutro = optionalBoolean(input, "includeOutro");
    const direction = enumValue(input, "direction", directions);
    const style = enumValue(input, "style", styles);
    const transition = enumValue(input, "transition", ["none", ...transitions]);
    report = await createSlideshow(inputPath(input, "directory", request), {
      ...options,
      ...(includes !== undefined ? { includes } : {}),
      ...(excludes !== undefined ? { excludes } : {}),
      ...(recursive !== undefined ? { recursive } : {}),
      ...(includeIntro !== undefined ? { includeIntro } : {}),
      ...(includeOutro !== undefined ? { includeOutro } : {}),
      ...(direction !== undefined ? { direction } : {}),
      ...(style !== undefined ? { style } : {}),
      ...(transition !== undefined ? { transition } : {}),
      ...(optionalNumber(input, "transitionDuration") !== undefined ? { transitionDuration: optionalNumber(input, "transitionDuration") } : {}),
      ...(optionalNumber(input, "duration") !== undefined ? { duration: optionalNumber(input, "duration") } : {}),
      ...(enumValue(input, "to", slideshowFormats) !== undefined ? { to: enumValue(input, "to", slideshowFormats) } : {}),
      ...normalization(input),
    });
  }
  return reportResult(input, report, [
    "Probe the composed output and confirm duration, dimensions, frame rate, pixel format, and audio policy.",
  ]);
});
