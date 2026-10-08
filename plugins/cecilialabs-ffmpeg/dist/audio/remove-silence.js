import { ToolkitRuntimeError } from "../core/errors.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "../media/io.js";
import { audioEncodingArgs, resolveAudioEncodingProfile } from "./encoding.js";
import { executeAudioTransform, formatNumber, inspectAudioInput, nonNegativeFinite, positiveFinite, requireAudio } from "./helpers.js";
function validateNoiseDb(value) {
    if (!Number.isFinite(value) || value < -120 || value > 0) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "noiseDb must be between -120 and 0 dB.", { details: { noiseDb: value } });
    }
    return value;
}
export function buildSilenceRemoveFilter(noiseDb, minDuration, keepSilence) {
    const options = [
        `start_periods=1`,
        `start_duration=${formatNumber(minDuration)}`,
        `start_threshold=${formatNumber(noiseDb)}dB`,
        `start_silence=${formatNumber(keepSilence)}`,
        `stop_periods=-1`,
        `stop_duration=${formatNumber(minDuration)}`,
        `stop_threshold=${formatNumber(noiseDb)}dB`,
        `stop_silence=${formatNumber(keepSilence)}`,
        "detection=rms",
    ];
    return `silenceremove=${options.join(":")}`;
}
export async function removeSilence(input, request = {}) {
    const source = await resolveReadableFile(input, request.cwd);
    const output = deriveOutputPath(source, "desilenced", request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectAudioInput(source, request);
    requireAudio(media, source);
    if (media.video.length > 0) {
        throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", "audio remove-silence currently supports audio-only inputs; removing time from video requires synchronized timeline editing.", {
            details: { source, videoStreams: media.video.length },
        });
    }
    const noiseDb = validateNoiseDb(request.noiseDb ?? -30);
    const minDuration = positiveFinite(request.minDuration ?? 0.5, "minDuration");
    const keepSilence = nonNegativeFinite(request.keepSilence ?? 0.05, "keepSilence");
    const encoding = resolveAudioEncodingProfile(output);
    const filter = buildSilenceRemoveFilter(noiseDb, minDuration, keepSilence);
    return await executeAudioTransform({
        operation: "remove-silence",
        sources: [source],
        output,
        argsBeforeOutput: [
            "-i", source,
            "-map", "0:a:0",
            "-af", filter,
            ...audioEncodingArgs(encoding),
            "-map_metadata", "0",
        ],
        runtime: request,
        inputMedia: [media],
        details: { noiseDb, minDuration, keepSilence, codec: encoding.codec, container: encoding.container, filter },
    });
}
//# sourceMappingURL=remove-silence.js.map