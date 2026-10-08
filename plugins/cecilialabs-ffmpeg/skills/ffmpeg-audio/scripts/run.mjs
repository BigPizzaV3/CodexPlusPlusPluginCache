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
  reportResult,
  requiredEnum,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import {
  addSilenceToVideo,
  attachAudio,
  detectSilence,
  generateSilence,
  removeSilence,
  transcodeTelephony,
} from "../../../dist/audio/index.js";

const actions = ["attach", "silence", "add-silence", "detect-silence", "remove-silence", "telephony"];
const modes = ["replace", "append"];
const videoModes = ["auto", "copy", "encode"];
const codecs = ["mulaw", "alaw", "gsm", "pcm"];
const containers = ["wav", "mulaw", "alaw", "gsm", "s16le"];

await executeSkillScript("audio.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "attach";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-audio/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = runtimeOptions(input, request, context, signal);
  let report;
  if (action === "silence") {
    report = await generateSilence({
      ...options,
      ...(optionalNumber(input, "duration") !== undefined ? { duration: optionalNumber(input, "duration") } : {}),
      ...(optionalNumber(input, "sampleRate") !== undefined ? { sampleRate: optionalNumber(input, "sampleRate") } : {}),
      ...(optionalNumber(input, "channels") !== undefined ? { channels: optionalNumber(input, "channels") } : {}),
      ...(optionalString(input, "channelLayout") !== undefined ? { channelLayout: optionalString(input, "channelLayout") } : {}),
    });
  } else if (action === "attach") {
    const mode = enumValue(input, "mode", modes);
    const videoMode = enumValue(input, "videoMode", videoModes);
    const pad = optionalBoolean(input, "pad");
    report = await attachAudio(inputPath(input, "input", request), inputPath(input, "audioInput", request), {
      ...options,
      ...(mode !== undefined ? { mode } : {}),
      ...(videoMode !== undefined ? { videoMode } : {}),
      ...(pad !== undefined ? { pad } : {}),
    });
  } else if (action === "add-silence") {
    const videoMode = enumValue(input, "videoMode", videoModes);
    const replaceExisting = optionalBoolean(input, "replaceExisting");
    report = await addSilenceToVideo(inputPath(input, "input", request), {
      ...options,
      ...(optionalNumber(input, "sampleRate") !== undefined ? { sampleRate: optionalNumber(input, "sampleRate") } : {}),
      ...(optionalNumber(input, "channels") !== undefined ? { channels: optionalNumber(input, "channels") } : {}),
      ...(optionalString(input, "channelLayout") !== undefined ? { channelLayout: optionalString(input, "channelLayout") } : {}),
      ...(videoMode !== undefined ? { videoMode } : {}),
      ...(replaceExisting !== undefined ? { replaceExisting } : {}),
    });
  } else if (action === "detect-silence") {
    report = await detectSilence(inputPath(input, "input", request), {
      ...options,
      ...(optionalNumber(input, "noiseDb") !== undefined ? { noiseDb: optionalNumber(input, "noiseDb") } : {}),
      ...(optionalNumber(input, "minDuration") !== undefined ? { minDuration: optionalNumber(input, "minDuration") } : {}),
    });
  } else if (action === "remove-silence") {
    report = await removeSilence(inputPath(input, "input", request), {
      ...options,
      ...(optionalNumber(input, "noiseDb") !== undefined ? { noiseDb: optionalNumber(input, "noiseDb") } : {}),
      ...(optionalNumber(input, "minDuration") !== undefined ? { minDuration: optionalNumber(input, "minDuration") } : {}),
      ...(optionalNumber(input, "keepSilence") !== undefined ? { keepSilence: optionalNumber(input, "keepSilence") } : {}),
    });
  } else {
    const container = enumValue(input, "container", containers);
    report = await transcodeTelephony(inputPath(input, "input", request), {
      ...options,
      codec: requiredEnum(input, "codec", codecs),
      ...(container !== undefined ? { container } : {}),
      ...(optionalNumber(input, "sampleRate") !== undefined ? { sampleRate: optionalNumber(input, "sampleRate") } : {}),
      ...(optionalNumber(input, "channels") !== undefined ? { channels: optionalNumber(input, "channels") } : {}),
      ...(optionalString(input, "sampleFormat") !== undefined ? { sampleFormat: optionalString(input, "sampleFormat") } : {}),
    });
  }
  return reportResult(input, report, [
    "Verify codec, sample rate, channel layout, stream presence, and duration from the returned report before declaring success.",
  ]);
});
