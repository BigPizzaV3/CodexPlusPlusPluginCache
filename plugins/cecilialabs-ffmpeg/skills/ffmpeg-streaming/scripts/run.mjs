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
  requiredString,
  runtimeOptions,
} from "../../../dist/skill-scripts/shared.js";
import { streamCamera, streamFile } from "../../../dist/streaming/index.js";

const actions = ["file", "camera"];
const transports = ["http", "rtmp", "rtsp", "srt", "udp", "tcp", "websocket"];
const containers = ["mpegts", "flv", "rtsp"];
const videoCodecs = ["h264", "mpeg1video", "copy"];
const audioCodecs = ["aac", "copy", "none"];
const inputFormats = ["v4l2", "avfoundation", "dshow"];
const rtspTransports = ["tcp", "udp"];

function streamOptions(input, request, context, signal) {
  return {
    ...runtimeOptions(input, request, context, signal),
    url: requiredString(input, "url"),
    ...(enumValue(input, "transport", transports) !== undefined ? { transport: enumValue(input, "transport", transports) } : {}),
    ...(enumValue(input, "container", containers) !== undefined ? { container: enumValue(input, "container", containers) } : {}),
    ...(enumValue(input, "rtspTransport", rtspTransports) !== undefined ? { rtspTransport: enumValue(input, "rtspTransport", rtspTransports) } : {}),
    ...(enumValue(input, "videoCodec", videoCodecs) !== undefined ? { videoCodec: enumValue(input, "videoCodec", videoCodecs) } : {}),
    ...(enumValue(input, "audioCodec", audioCodecs) !== undefined ? { audioCodec: enumValue(input, "audioCodec", audioCodecs) } : {}),
    ...(optionalString(input, "videoBitrate") !== undefined ? { videoBitrate: optionalString(input, "videoBitrate") } : {}),
    ...(optionalString(input, "audioBitrate") !== undefined ? { audioBitrate: optionalString(input, "audioBitrate") } : {}),
    ...(optionalString(input, "preset") !== undefined ? { preset: optionalString(input, "preset") } : {}),
    ...(optionalNumber(input, "gop") !== undefined ? { gop: optionalNumber(input, "gop") } : {}),
    ...(optionalString(input, "pixelFormat") !== undefined ? { pixelFormat: optionalString(input, "pixelFormat") } : {}),
  };
}

await executeSkillScript("streaming.run", async ({ request, context, signal }) => {
  const input = objectInput(request.input);
  const action = enumValue(input, "action", actions) ?? "file";
  const planned = contextPlan(
    input,
    context,
    "Run skills/ffmpeg-streaming/scripts/run.mjs from Codex, Work, or a local terminal.",
  );
  if (planned !== undefined) return planned;

  const options = streamOptions(input, request, context, signal);
  const report = action === "file"
    ? await streamFile(inputPath(input, "input", request), {
        ...options,
        ...(optionalBoolean(input, "realtime") !== undefined ? { realtime: optionalBoolean(input, "realtime") } : {}),
      })
    : await streamCamera({
        ...options,
        device: requiredString(input, "device"),
        ...(enumValue(input, "inputFormat", inputFormats) !== undefined ? { inputFormat: enumValue(input, "inputFormat", inputFormats) } : {}),
        ...(optionalNumber(input, "framerate") !== undefined ? { framerate: optionalNumber(input, "framerate") } : {}),
        ...(optionalString(input, "videoSize") !== undefined ? { videoSize: optionalString(input, "videoSize") } : {}),
      });
  return reportResult(input, report, [
    "Treat the stream result as a validated plan unless the active host reports a completed execution.",
  ]);
});
