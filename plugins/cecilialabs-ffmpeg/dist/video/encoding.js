import path from "node:path";
import { ToolkitRuntimeError } from "../core/errors.js";
import { hardwareVideoEncodingArgs } from "../hardware/index.js";
export function resolveEncodingProfile(output, options = {}) {
    const extension = path.extname(output).toLowerCase();
    const crf = options.crf ?? 18;
    const preset = options.preset ?? "medium";
    if (extension === ".webm") {
        return {
            container: "webm",
            videoCodec: "libvpx-vp9",
            audioCodec: "libopus",
            videoQualityArgs: ["-crf", String(Math.max(0, Math.min(63, crf + 12))), "-b:v", "0"],
            audioArgs: ["-b:a", "128k"],
            muxerArgs: [],
            softwareCrf: Math.max(0, Math.min(63, crf + 12)),
        };
    }
    if (extension === ".mp4" || extension === ".m4v" || extension === ".mov" || extension === ".mkv") {
        return {
            container: extension === ".mov" ? "mov" : extension === ".mkv" ? "mkv" : "mp4",
            videoCodec: "libx264",
            audioCodec: "aac",
            videoQualityArgs: ["-preset", preset, "-crf", String(crf)],
            audioArgs: ["-b:a", "192k"],
            muxerArgs: extension === ".mp4" || extension === ".m4v" || extension === ".mov" ? ["-movflags", "+faststart"] : [],
            softwareCrf: crf,
            softwarePreset: preset,
        };
    }
    throw new ToolkitRuntimeError("E_OPERATION_UNSUPPORTED", `Unsupported video output extension: ${extension || "(none)"}`, {
        details: { output, supportedExtensions: [".mp4", ".m4v", ".mov", ".mkv", ".webm"] },
    });
}
export function encodingArgs(profile, includeAudio, hardware) {
    const videoArgs = hardware === undefined
        ? ["-c:v", profile.videoCodec, ...profile.videoQualityArgs]
        : hardwareVideoEncodingArgs(hardware, {
            softwareCrf: profile.softwareCrf,
            ...(profile.softwarePreset !== undefined ? { softwarePreset: profile.softwarePreset } : {}),
        });
    return [
        ...videoArgs,
        ...(includeAudio ? ["-c:a", profile.audioCodec, ...profile.audioArgs] : ["-an"]),
        ...profile.muxerArgs,
    ];
}
//# sourceMappingURL=encoding.js.map