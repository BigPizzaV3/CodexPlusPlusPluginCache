import { ToolkitRuntimeError } from "../core/errors.js";
import { encodingArgs, resolveEncodingProfile } from "./encoding.js";
import { executeVideoTransform, inspectInput, positiveFinite, requireVideo } from "./helpers.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "./io.js";
export function buildAtempoChain(factor) {
    positiveFinite(factor, "factor");
    const stages = [];
    let remaining = factor;
    while (remaining > 2) {
        stages.push(2);
        remaining /= 2;
    }
    while (remaining < 0.5) {
        stages.push(0.5);
        remaining /= 0.5;
    }
    stages.push(remaining);
    return stages.map((value) => `atempo=${Number(value.toFixed(8))}`).join(",");
}
function validateAudioMode(value) {
    const mode = value ?? "sync";
    if (mode !== "sync" && mode !== "drop") {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "audio must be either sync or drop.", {
            details: { audio: mode },
        });
    }
    return mode;
}
export async function changeVideoSpeed(input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const factor = positiveFinite(request.factor, "factor");
    const audioMode = validateAudioMode(request.audio);
    const suffixFactor = Number(factor.toFixed(6)).toString();
    const output = deriveOutputPath(source, `speed-${suffixFactor}x`, request.output, { ...(request.cwd !== undefined ? { cwd: request.cwd } : {}) });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectInput(source, request);
    requireVideo(media, source);
    const profile = resolveEncodingProfile(output);
    const hasSyncedAudio = audioMode === "sync" && media.audio.length > 0;
    const args = [
        "-i", source,
        "-map", "0:v:0",
        ...(hasSyncedAudio ? ["-map", "0:a?"] : []),
        "-vf", `setpts=PTS/${factor}`,
        ...(hasSyncedAudio ? ["-af", buildAtempoChain(factor)] : []),
        ...encodingArgs(profile, hasSyncedAudio),
        "-map_metadata", "0",
    ];
    return await executeVideoTransform({
        operation: "speed",
        source,
        output,
        argsBeforeOutput: args,
        runtime: request,
        inputMedia: media,
        details: { factor, audio: audioMode, audioStreamsPreserved: hasSyncedAudio ? media.audio.length : 0 },
    });
}
//# sourceMappingURL=speed.js.map