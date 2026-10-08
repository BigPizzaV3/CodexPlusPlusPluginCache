import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "../media/io.js";
import { resolveEncodingProfile } from "../video/encoding.js";
import { audioCodecForVideoContainer, audioEncodingArgs, resolveAudioEncodingProfile, resolveVideoMode } from "./encoding.js";
import { executeAudioTransform, formatNumber, inspectAudioInput, integerInRange, positiveFinite, requireVideo } from "./helpers.js";
export function channelLayoutFor(channels, explicit) {
    if (explicit && explicit.trim().length > 0)
        return explicit.trim();
    switch (channels) {
        case 1: return "mono";
        case 2: return "stereo";
        case 6: return "5.1";
        case 8: return "7.1";
        default:
            throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "channelLayout is required when channels is not 1, 2, 6, or 8.", {
                details: { channels },
            });
    }
}
function defaultSilenceOutput(cwd) {
    return path.resolve(cwd ?? process.cwd(), "silence.wav");
}
export async function generateSilence(request = {}) {
    const duration = positiveFinite(request.duration ?? 1, "duration");
    const sampleRate = integerInRange(Math.trunc(request.sampleRate ?? 48_000), "sampleRate", 1_000, 384_000);
    const channels = integerInRange(Math.trunc(request.channels ?? 2), "channels", 1, 32);
    const channelLayout = channelLayoutFor(channels, request.channelLayout);
    const output = request.output === undefined
        ? defaultSilenceOutput(request.cwd)
        : path.resolve(request.cwd ?? process.cwd(), request.output);
    await preflightOutputPath({ output, overwrite: request.overwrite ?? false });
    const encoding = resolveAudioEncodingProfile(output);
    return await executeAudioTransform({
        operation: "silence",
        sources: [],
        output,
        argsBeforeOutput: [
            "-f", "lavfi",
            "-i", `anullsrc=r=${sampleRate}:cl=${channelLayout}`,
            "-t", formatNumber(duration),
            "-ar", String(sampleRate),
            "-ac", String(channels),
            ...audioEncodingArgs(encoding),
        ],
        runtime: request,
        details: { duration, sampleRate, channels, channelLayout, codec: encoding.codec, container: encoding.container },
    });
}
export async function addSilenceToVideo(input, request = {}) {
    const source = await resolveReadableFile(input, request.cwd);
    const output = deriveOutputPath(source, "silent-audio", request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectAudioInput(source, request);
    requireVideo(media, source);
    if (media.audio.length > 0 && !request.replaceExisting) {
        throw new ToolkitRuntimeError("E_CONFIG_CONFLICT", "Video already contains audio; refusing to replace it implicitly.", {
            details: { source, audioStreams: media.audio.length, hint: "Pass --replace-existing to replace existing audio with silence." },
        });
    }
    const sampleRate = integerInRange(Math.trunc(request.sampleRate ?? 48_000), "sampleRate", 1_000, 384_000);
    const channels = integerInRange(Math.trunc(request.channels ?? 2), "channels", 1, 32);
    const channelLayout = channelLayoutFor(channels, request.channelLayout);
    const videoMode = resolveVideoMode(media, output, request.videoMode);
    const audioCodec = audioCodecForVideoContainer(output);
    const videoProfile = videoMode === "encode" ? resolveEncodingProfile(output) : undefined;
    const videoArgs = videoMode === "copy"
        ? ["-c:v", "copy"]
        : ["-c:v", videoProfile.videoCodec, ...videoProfile.videoQualityArgs, ...videoProfile.muxerArgs];
    return await executeAudioTransform({
        operation: "add-silence",
        sources: [source],
        output,
        argsBeforeOutput: [
            "-i", source,
            "-f", "lavfi",
            "-i", `anullsrc=r=${sampleRate}:cl=${channelLayout}`,
            "-map", "0:v:0",
            "-map", "1:a:0",
            ...videoArgs,
            "-c:a", audioCodec,
            "-ar", String(sampleRate),
            "-ac", String(channels),
            "-shortest",
            "-map_metadata", "0",
        ],
        runtime: request,
        inputMedia: [media],
        details: { sampleRate, channels, channelLayout, videoMode, audioCodec, replacedExistingAudioStreams: media.audio.length, replaceExisting: request.replaceExisting ?? false },
    });
}
//# sourceMappingURL=silence.js.map