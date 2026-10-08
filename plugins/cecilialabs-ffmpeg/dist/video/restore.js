import { ToolkitRuntimeError } from "../core/errors.js";
import { hardwareFilterSuffix, hardwareGlobalArgs } from "../hardware/index.js";
import { buildFitFilters } from "../media/fit.js";
import { encodingArgs, resolveEncodingProfile } from "./encoding.js";
import { executeVideoTransform, inspectInput, positiveFinite, requireVideo } from "./helpers.js";
import { resolveVideoHardware, hardwareReportDetails } from "./hardware.js";
import { deriveOutputPath, preflightOutputPath, resolveReadableFile } from "./io.js";
function validateProfile(value) {
    const profile = value ?? "balanced";
    if (profile !== "balanced" && profile !== "aggressive") {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "profile must be balanced or aggressive.", {
            details: { profile },
        });
    }
    return profile;
}
export function buildRestoreFilter(width, height, profile, request = {}) {
    const geometry = [...buildFitFilters({
            width,
            height,
            ...(request.fit !== undefined ? { fit: request.fit } : {}),
            ...(request.background !== undefined ? { background: request.background } : {}),
        }), "setsar=1"].join(",");
    if (profile === "balanced")
        return geometry;
    return [
        "bwdif=mode=send_frame:parity=auto:deint=interlaced",
        "deblock=filter=strong:block=8:alpha=0.12:beta=0.07:gamma=0.06:delta=0.05",
        "hqdn3d=2.4:1.8:4.0:3.0",
        "nlmeans=s=2.4:p=7:r=15",
        geometry,
        "unsharp=3:3:0.18:3:3:0.0",
    ].join(",");
}
async function transformVideo(operation, input, request) {
    const source = await resolveReadableFile(input, request.cwd);
    const width = Math.trunc(positiveFinite(request.width, "width"));
    const height = Math.trunc(positiveFinite(request.height, "height"));
    const profileName = validateProfile(request.profile);
    const fps = request.fps === undefined ? undefined : positiveFinite(request.fps, "fps");
    const crf = request.crf ?? (profileName === "aggressive" ? 14 : 18);
    if (!Number.isFinite(crf) || crf < 0 || crf > 63) {
        throw new ToolkitRuntimeError("E_USAGE_INVALID_ARGUMENT", "crf must be between 0 and 63.", { details: { crf } });
    }
    const preset = request.preset ?? (profileName === "aggressive" ? "slow" : "medium");
    const to = request.to ?? "mp4";
    const output = deriveOutputPath(source, `${operation}-${width}x${height}`, request.output, {
        ...(request.cwd !== undefined ? { cwd: request.cwd } : {}),
        defaultExtension: `.${to}`,
    });
    await preflightOutputPath({ source, output, overwrite: request.overwrite ?? false });
    const media = await inspectInput(source, request);
    requireVideo(media, source);
    const encoding = resolveEncodingProfile(output, { crf, preset });
    const hardware = await resolveVideoHardware(to, request);
    const baseFilter = buildRestoreFilter(width, height, profileName, request);
    const hardwareSuffix = hardware === undefined ? [] : hardwareFilterSuffix(hardware);
    const filter = [...(baseFilter ? [baseFilter] : []), ...hardwareSuffix].join(",");
    const hasAudio = media.audio.length > 0;
    return await executeVideoTransform({
        operation,
        source,
        output,
        argsBeforeOutput: [
            ...(hardware === undefined ? [] : hardwareGlobalArgs(hardware)),
            "-i", source,
            "-map", "0:v:0",
            ...(hasAudio ? ["-map", "0:a?"] : []),
            "-vf", filter,
            ...(fps !== undefined ? ["-r", String(fps)] : []),
            ...encodingArgs(encoding, hasAudio, hardware),
            "-map_metadata", "0",
        ],
        runtime: request,
        inputMedia: media,
        details: {
            width,
            height,
            profile: profileName,
            ...(fps !== undefined ? { fps } : {}),
            crf,
            preset,
            fit: request.fit ?? "contain",
            background: request.background ?? "black",
            to,
            ...hardwareReportDetails(hardware),
        },
        ...(hardware?.warning !== undefined ? { warnings: [hardware.warning] } : {}),
    });
}
export async function upscaleVideo(input, request) {
    return await transformVideo("upscale", input, request);
}
/** @deprecated Use upscaleVideo(). Retained for v0.x CLI/API compatibility. */
export async function restoreVideo(input, request) {
    return await transformVideo("restore", input, request);
}
//# sourceMappingURL=restore.js.map